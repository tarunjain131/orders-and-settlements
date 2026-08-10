import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Mirrors (a practical subset of) Shopify's order financial_status values.
// Not included: authorized, expired — out of scope for this app.
export const financialStatusEnum = pgEnum("financial_status", [
  "pending",
  "partially_paid",
  "paid",
  "partially_refunded",
  "refunded",
  "voided",
]);

export const transactionKindEnum = pgEnum("transaction_kind", [
  "sale",
  "refund",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "#1001"
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  currency: text("currency").notNull().default("INR"),
  description: text("description"),
  dueDate: date("due_date").notNull(),

  subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  // Vestigial for this assignment — order total is subtotal-only (see README).
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  shippingAmount: numeric("shipping_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  amountRefunded: numeric("amount_refunded", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),

  financialStatus: financialStatusEnum("financial_status")
    .notNull()
    .default("pending"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lineItems = pgTable("line_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  variantTitle: text("variant_title"),
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refundLineItems = pgTable("refund_line_items", {
  id: serial("id").primaryKey(),
  refundId: integer("refund_id")
    .notNull()
    .references(() => refunds.id, { onDelete: "cascade" }),
  lineItemId: integer("line_item_id")
    .notNull()
    .references(() => lineItems.id),
  quantity: integer("quantity").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: transactionKindEnum("kind").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  lineItems: many(lineItems),
  refunds: many(refunds),
  transactions: many(transactions),
}));

export const lineItemsRelations = relations(lineItems, ({ one, many }) => ({
  order: one(orders, { fields: [lineItems.orderId], references: [orders.id] }),
  refundLineItems: many(refundLineItems),
}));

export const refundsRelations = relations(refunds, ({ one, many }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  refundLineItems: many(refundLineItems),
}));

export const refundLineItemsRelations = relations(refundLineItems, ({ one }) => ({
  refund: one(refunds, {
    fields: [refundLineItems.refundId],
    references: [refunds.id],
  }),
  lineItem: one(lineItems, {
    fields: [refundLineItems.lineItemId],
    references: [lineItems.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  order: one(orders, { fields: [transactions.orderId], references: [orders.id] }),
}));
