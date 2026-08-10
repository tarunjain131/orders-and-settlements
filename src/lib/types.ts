import { z } from "zod";

export const lineItemInputSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  variantTitle: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  price: z.coerce.number().min(0, "Price can't be negative"),
});

export const orderInputSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().optional().or(z.literal("")).nullable(),
  customerPhone: z.string().optional().nullable(),
  currency: z.string().min(1).default("INR"),
  description: z.string().optional().nullable(),
  dueDate: z.string().min(1, "Due date is required"),
  lineItems: z.array(lineItemInputSchema).min(1, "Add at least one line item"),
  // How much of the order total is being paid at creation time.
  // 0 -> pending, between 0 and total -> partially_paid, == total -> paid
  initialPayment: z.coerce.number().min(0).default(0),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const paymentInputSchema = z.object({
  amount: z.coerce
    .number()
    .min(0.01, "Amount must be at least 0.01")
    .transform((n) => Math.round(n * 100) / 100),
  paidOn: z.string().min(1, "Payment date is required"),
  note: z.string().optional().nullable(),
});

export const refundLineItemInputSchema = z.object({
  lineItemId: z.coerce.number().int(),
  quantity: z.coerce.number().int().min(0),
});

export const refundInputSchema = z.object({
  amount: z.coerce.number().positive("Refund amount must be greater than 0"),
  reason: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lineItems: z.array(refundLineItemInputSchema).default([]),
});

// Statuses in which an order's line items / amounts can still be edited.
// Mirrors Shopify: once an order is paid in full (or refunded/voided),
// direct edits are locked — further changes must go through a refund,
// an additional payment, or a new order.
export const EDITABLE_STATUSES = ["pending", "partially_paid"] as const;

export const signupInputSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginInputSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type FinancialStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "voided";

// The status actually shown to users. Same as FinancialStatus, plus
// "overdue" — a read-time derived state, never stored (see
// deriveOrderStatus in lib/orders.ts and the README).
export type DisplayStatus = FinancialStatus | "overdue";
