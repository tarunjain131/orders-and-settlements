import { and, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  lineItems,
  orders,
  refundLineItems,
  refunds,
  transactions,
} from "@/db/schema";
import {
  EDITABLE_STATUSES,
  FinancialStatus,
  OrderInput,
} from "@/lib/types";

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeTotals(
  items: { quantity: number; price: number }[],
  discount: number,
  shipping: number,
  tax: number
) {
  const subtotal = round2(
    items.reduce((sum, li) => sum + li.quantity * li.price, 0)
  );
  const total = round2(subtotal - discount + shipping + tax);
  return { subtotal, total: Math.max(total, 0) };
}

export function isEditable(financialStatus: string) {
  return (EDITABLE_STATUSES as readonly string[]).includes(financialStatus);
}

function statusForPayment(amountPaid: number, total: number): FinancialStatus {
  if (amountPaid <= 0) return "pending";
  if (amountPaid >= total) return "paid";
  return "partially_paid";
}

export async function listOrders(
  userId: number,
  opts: { q?: string; status?: string } = {}
) {
  const conditions: (SQL | undefined)[] = [eq(orders.userId, userId)];
  if (opts.q) {
    conditions.push(
      or(
        ilike(orders.name, `%${opts.q}%`),
        ilike(orders.customerName, `%${opts.q}%`),
        ilike(orders.customerEmail, `%${opts.q}%`)
      )
    );
  }
  if (opts.status && opts.status !== "any") {
    conditions.push(eq(orders.financialStatus, opts.status as FinancialStatus));
  }

  const rows = await db
    .select({
      order: orders,
      itemCount: sql<number>`coalesce(sum(${lineItems.quantity}), 0)`.as(
        "item_count"
      ),
    })
    .from(orders)
    .leftJoin(lineItems, eq(lineItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({ ...r.order, itemCount: Number(r.itemCount) }));
}

export async function getOrder(id: number, userId: number) {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.userId, userId)),
    with: {
      lineItems: true,
      refunds: { with: { refundLineItems: true } },
      transactions: { orderBy: (t, { asc }) => [asc(t.createdAt)] },
    },
  });
  return order ?? null;
}

export async function createOrder(userId: number, input: OrderInput) {
  const { subtotal, total } = computeTotals(
    input.lineItems,
    input.discountAmount,
    input.shippingAmount,
    input.taxAmount
  );

  const initialPayment = Math.min(round2(input.initialPayment ?? 0), total);
  const financialStatus = statusForPayment(initialPayment, total);

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        name: "#TEMP",
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        currency: input.currency || "INR",
        note: input.note || null,
        subtotalAmount: subtotal.toFixed(2),
        discountAmount: input.discountAmount.toFixed(2),
        shippingAmount: input.shippingAmount.toFixed(2),
        taxAmount: input.taxAmount.toFixed(2),
        totalAmount: total.toFixed(2),
        amountPaid: initialPayment.toFixed(2),
        amountRefunded: "0",
        financialStatus,
      })
      .returning();

    // Human-friendly order name derived from the numeric id, e.g. #1001.
    const name = `#${1000 + order.id}`;
    await tx.update(orders).set({ name }).where(eq(orders.id, order.id));

    if (input.lineItems.length) {
      await tx.insert(lineItems).values(
        input.lineItems.map((li) => ({
          orderId: order.id,
          title: li.title,
          variantTitle: li.variantTitle || null,
          sku: li.sku || null,
          quantity: li.quantity,
          price: li.price.toFixed(2),
        }))
      );
    }

    if (initialPayment > 0) {
      await tx.insert(transactions).values({
        orderId: order.id,
        kind: "sale",
        amount: initialPayment.toFixed(2),
        note:
          financialStatus === "paid"
            ? "Order marked as paid at creation"
            : "Partial payment recorded at creation",
      });
    }

    return { ...order, name };
  });
}

export async function updateOrder(
  id: number,
  userId: number,
  input: OrderInput
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.userId, userId)),
    });
    if (!existing) throw new OrderError("Order not found", 404);
    if (!isEditable(existing.financialStatus)) {
      throw new OrderError(
        `This order can't be edited because its payment status is "${existing.financialStatus}". Use a refund or record a payment instead.`,
        409
      );
    }

    const { subtotal, total } = computeTotals(
      input.lineItems,
      input.discountAmount,
      input.shippingAmount,
      input.taxAmount
    );

    const amountPaid = Math.min(Number(existing.amountPaid), total);
    const financialStatus = statusForPayment(amountPaid, total);

    await tx
      .update(orders)
      .set({
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        currency: input.currency || existing.currency,
        note: input.note || null,
        subtotalAmount: subtotal.toFixed(2),
        discountAmount: input.discountAmount.toFixed(2),
        shippingAmount: input.shippingAmount.toFixed(2),
        taxAmount: input.taxAmount.toFixed(2),
        totalAmount: total.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        financialStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    await tx.delete(lineItems).where(eq(lineItems.orderId, id));
    if (input.lineItems.length) {
      await tx.insert(lineItems).values(
        input.lineItems.map((li) => ({
          orderId: id,
          title: li.title,
          variantTitle: li.variantTitle || null,
          sku: li.sku || null,
          quantity: li.quantity,
          price: li.price.toFixed(2),
        }))
      );
    }

    return getOrder(id, userId);
  });
}

export async function recordPayment(
  id: number,
  userId: number,
  amount: number,
  note?: string | null
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.userId, userId)),
    });
    if (!existing) throw new OrderError("Order not found", 404);
    if (existing.financialStatus === "voided") {
      throw new OrderError("Voided orders can't accept payments", 409);
    }
    if (existing.financialStatus === "refunded") {
      throw new OrderError("This order has been fully refunded", 409);
    }

    const total = Number(existing.totalAmount);
    const currentPaid = Number(existing.amountPaid);
    const balanceDue = round2(total - currentPaid);
    if (amount > balanceDue + 0.005) {
      throw new OrderError(
        `Payment of ${amount} exceeds the balance due (${balanceDue})`,
        400
      );
    }

    const newPaid = round2(currentPaid + amount);
    const financialStatus = statusForPayment(newPaid, total);

    await tx
      .update(orders)
      .set({ amountPaid: newPaid.toFixed(2), financialStatus, updatedAt: new Date() })
      .where(eq(orders.id, id));

    await tx.insert(transactions).values({
      orderId: id,
      kind: "sale",
      amount: amount.toFixed(2),
      note: note || null,
    });

    return getOrder(id, userId);
  });
}

export async function createRefund(
  id: number,
  userId: number,
  input: {
    amount: number;
    reason?: string | null;
    note?: string | null;
    lineItems: { lineItemId: number; quantity: number }[];
  }
) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.userId, userId)),
    });
    if (!existing) throw new OrderError("Order not found", 404);

    const amountPaid = Number(existing.amountPaid);
    const amountRefunded = Number(existing.amountRefunded);
    const refundable = round2(amountPaid - amountRefunded);

    if (refundable <= 0) {
      throw new OrderError("There is nothing left to refund on this order", 409);
    }
    if (input.amount > refundable + 0.005) {
      throw new OrderError(
        `Refund of ${input.amount} exceeds the refundable amount (${refundable})`,
        400
      );
    }

    const [refund] = await tx
      .insert(refunds)
      .values({
        orderId: id,
        amount: input.amount.toFixed(2),
        reason: input.reason || null,
        note: input.note || null,
      })
      .returning();

    const lineItemRefunds = input.lineItems.filter((li) => li.quantity > 0);
    if (lineItemRefunds.length) {
      const orderLineItems = await tx.query.lineItems.findMany({
        where: eq(lineItems.orderId, id),
      });
      const byId = new Map(orderLineItems.map((li) => [li.id, li]));
      await tx.insert(refundLineItems).values(
        lineItemRefunds.map((li) => {
          const original = byId.get(li.lineItemId);
          const unitPrice = original ? Number(original.price) : 0;
          return {
            refundId: refund.id,
            lineItemId: li.lineItemId,
            quantity: li.quantity,
            amount: round2(unitPrice * li.quantity).toFixed(2),
          };
        })
      );
    }

    const newRefunded = round2(amountRefunded + input.amount);
    const fullyRefunded = newRefunded >= amountPaid - 0.005 && amountPaid > 0;
    const financialStatus: FinancialStatus = fullyRefunded
      ? "refunded"
      : "partially_refunded";

    await tx
      .update(orders)
      .set({
        amountRefunded: newRefunded.toFixed(2),
        financialStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    await tx.insert(transactions).values({
      orderId: id,
      kind: "refund",
      amount: input.amount.toFixed(2),
      note: input.reason || input.note || null,
    });

    return getOrder(id, userId);
  });
}

export async function voidOrder(id: number, userId: number) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.userId, userId)),
    });
    if (!existing) throw new OrderError("Order not found", 404);
    if (Number(existing.amountPaid) > 0) {
      throw new OrderError(
        "Orders with a captured payment can't be voided — issue a refund instead",
        409
      );
    }
    if (existing.financialStatus !== "pending") {
      throw new OrderError(
        `Orders with status "${existing.financialStatus}" can't be voided`,
        409
      );
    }

    await tx
      .update(orders)
      .set({ financialStatus: "voided", updatedAt: new Date() })
      .where(eq(orders.id, id));

    return getOrder(id, userId);
  });
}
