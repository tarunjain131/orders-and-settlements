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
- **Create order** (`/orders/new`) — customer details, dynamic line items
  (add/remove rows, quantity × price), discount/shipping/tax, and a choice
  of leaving the order unpaid, marking it fully paid, or recording a partial
  payment at creation time.
- **Order detail** (`/orders/[id]`) — line items, payment summary (subtotal,
  discount, shipping, tax, total, paid, refunded, balance due), a timeline
  of payments/refunds, and the available actions for that order's current
  status.
- **Edit order** (`/orders/[id]/edit`) — re-open the same form to change the
  customer, line items, or amounts, subject to the edit-lock rule below.
- **Record a payment** (`/orders/[id]/pay`) — log a full or partial payment
  against the balance due.
- **Refund** (`/orders/[id]/refund`) — refund specific line-item quantities
  and/or an extra amount (e.g. shipping), with a reason and note. Refund
  amount is capped at what's actually been paid and not yet refunded.
- **Void** — cancel an order that has no payment captured yet.

## 4. Business rules (and how they map to Shopify)

Shopify's real `financial_status` field also includes `authorized` and
`expired`, which only apply to card-authorization flows this app doesn't
implement. The subset used here is:

`pending → partially_paid → paid → partially_refunded → refunded`, plus
`voided` as a terminal state for orders that never took a payment.

**Editing after creation.** This was the main behavioral question in
building this app, and it's implemented to mirror Shopify's real
constraint: once an order has been paid in full, you can't silently change
what's in it. Concretely:

- An order is editable (line items, quantities, prices, discount/shipping/
  tax, customer info) while its status is `pending` or `partially_paid`.
- Once status is `paid`, `partially_refunded`, `refunded`, or `voided`, the
  Edit page shows a locked banner instead of the form, and the API rejects
  edit requests with a 409. From that point, changes have to go through a
  **refund** (to give money back) or an **additional payment** (to collect
  more) — or a new order — exactly like Shopify's own edit-order flow.
- The server enforces this independently of the UI (the `PUT
  /api/orders/[id]` route re-checks status before writing), so it can't be
  bypassed by calling the API directly.

**Refunds.** A refund can be issued for any amount up to (paid − already
refunded). You can select specific line-item quantities to refund (this is
recorded for the line-item breakdown Shopify shows) and/or add a flat
amount for things like shipping. The order's status becomes
`partially_refunded` once any refund is issued, or `refunded` once the
refunded total catches up to the paid total.

**Voiding.** Only allowed while an order is `pending` with nothing paid
against it — matching Shopify, where you can't void an order that's already
collected money; you'd refund it instead.

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
- Product catalog (line items are freeform title/SKU/price/qty, not linked
  to a products table)
- Payment gateway integration — "recording a payment" or "refund" just
  updates the ledger in this app; it doesn't move real money anywhere

These are natural next additions if you want to grow this past a demo/
internal tool.
