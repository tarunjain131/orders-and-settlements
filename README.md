# Order Admin

A small, self-hosted order management app modeled on the parts of the
Shopify merchant admin most people mean when they say "order management":
creating an order, tracking its line items, and following its payment
status (`pending` → `partially_paid`/`paid` → `partially_refunded`/`refunded`,
or `voided`) through refunds and edits.

Stack: **Next.js (App Router) + TypeScript + Tailwind CSS + Drizzle ORM +
PostgreSQL**.

## 1. Prerequisites

- Node.js 20+
- A running PostgreSQL server (local install, Docker, or a hosted instance
  like Neon/Supabase/RDS)

## 2. Setup

```bash
npm install
cp .env.example .env
# edit .env and set DATABASE_URL to point at your Postgres instance
```

Create the database (skip if it already exists):

```bash
createdb shopify_orders
```

Push the schema (Drizzle reads `src/db/schema.ts` and creates the tables —
no manual SQL needed):

```bash
npm run db:push
```

Optionally load some demo orders (pending, paid, partially paid, refunded,
and voided examples):

```bash
npm run db:seed
```

Run the app:

```bash
npm run dev
```

Visit http://localhost:3000/orders.

## 3. What's included

- **Order list** (`/orders`) — searchable, filterable by payment status,
  Shopify-admin-style table.
- **Create order** (`/orders/new`) — customer details, a required due date
  (when payment is expected), an order description, dynamic line items
  (add/remove rows, quantity × price), and a choice of leaving the order
  unpaid, marking it fully paid, or recording a partial payment at creation
  time.
- **Order detail** (`/orders/[id]`) — line items, payment summary (subtotal,
  total, paid, refunded, balance due), a timeline of payments/refunds, and
  the available actions for that order's current status.
- **Edit order** (`/orders/[id]/edit`) — re-open the same form to change the
  customer, due date, description, or line items, subject to the edit-lock
  rule below.
- **Record a payment** (`/orders/[id]/pay`) — log a full or partial payment
  against the balance due.
- **Refund** (`/orders/[id]/refund`) — refund specific line-item quantities
  and/or an extra amount (e.g. shipping), with a reason and note. Refund
  amount is capped at what's actually been paid and not yet refunded.
- **Void** — cancel an order that has no payment captured yet.
- **Delete** — permanently remove an order that has zero payments recorded
  (`amount_paid = 0`), with a confirm step. Once any payment has been made,
  deletion is blocked — void or refund instead.

## 4. Business rules (and how they map to Shopify)

Shopify's real `financial_status` field also includes `authorized` and
`expired`, which only apply to card-authorization flows this app doesn't
implement. The subset used here is:

`pending → partially_paid → paid → partially_refunded → refunded`, plus
`voided` as a terminal state for orders that never took a payment.

### Is an order editable after payment?

This was the main behavioral question in building this app, and it's
implemented to mirror Shopify's real constraint: once an order has been
paid **in full**, you can't silently change what's in it. Concretely:

- An order is editable (line items, quantities, prices, customer info, due
  date, description) while its status is `pending` or `partially_paid`.
- Once status is `paid`, `partially_refunded`, `refunded`, or `voided`, the
  Edit page shows a locked banner instead of the form, and the API rejects
  edit requests with a 409. From that point, changes have to go through a
  **refund** (to give money back) or an **additional payment** (to collect
  more) — or a new order — exactly like Shopify's own edit-order flow.
- The server enforces this independently of the UI (the `PUT
  /api/orders/[id]` route re-checks status before writing), so it can't be
  bypassed by calling the API directly.

The order is locked only once it's **fully** paid — not the moment the
first payment lands. This is a deliberate choice: it lets you record
partial payments against an order over time (e.g. a deposit, then the
balance later) without losing the ability to fix a typo in a line item or
adjust the due date before the order is fully settled. Locking on the
first rupee received would make partial-payment workflows unnecessarily
painful, since almost any real order with an installment plan would become
uneditable immediately.

**Refunds.** A refund can be issued for any amount up to (paid − already
refunded). You can select specific line-item quantities to refund (this is
recorded for the line-item breakdown Shopify shows) and/or add a flat
amount for things like shipping. The order's status becomes
`partially_refunded` once any refund is issued, or `refunded` once the
refunded total catches up to the paid total.

**Voiding.** Only allowed while an order is `pending` with nothing paid
against it — matching Shopify, where you can't void an order that's already
collected money; you'd refund it instead.

**Deleting.** Only allowed while an order has zero payments recorded
(`amount_paid = 0`) — the same "nothing paid yet" bar as voiding. Once a
single payment exists against an order, `DELETE /api/orders/[id]` returns a
409 and the Delete button is hidden; use void (if still `pending`) or a
refund instead.

**Order totals.** Per this assignment's spec, an order's total is its
**subtotal only** — there's no order-level discount, shipping, or tax. The
`discount_amount`, `shipping_amount`, and `tax_amount` columns are still
present on the `orders` table (left in place rather than dropped, for
simplicity) but are vestigial: they're always `0`, the create/edit form has
no inputs for them, and `createOrder`/`updateOrder` don't accept nonzero
values for them.

## 5. Project structure

```
src/
  db/
    schema.ts      Drizzle table definitions (orders, line items, refunds, transactions)
    index.ts        DB client
    seed.ts         Demo data
  lib/
    orders.ts       All order business logic (create/update/pay/refund/void)
    types.ts        Zod validation schemas + the editable-status list
    format.ts        Currency/date formatting helpers
  app/
    orders/...       Pages (list, create, detail, edit, pay, refund)
    api/orders/...   REST-ish route handlers used by the pages' forms
  components/        Order form, status badge, refund/payment forms, action buttons
```

## 6. Not included (intentionally, to keep this a "small" app)

- Authentication / multi-user accounts
- Fulfillment / shipping tracking
- Product catalog (line items are freeform description/SKU/price/qty, not
  linked to a products table)
- Payment gateway integration — "recording a payment" or "refund" just
  updates the ledger in this app; it doesn't move real money anywhere

These are natural next additions if you want to grow this past a demo/
internal tool.
