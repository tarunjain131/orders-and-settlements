# Order Admin

A small, self-hosted order management app modeled on the parts of the
Shopify merchant admin most people mean when they say "order management":
creating an order, tracking its line items, and following its payment
status (`pending` → `partially_paid`/`paid` → `partially_refunded`/`refunded`,
or `voided`) through refunds and edits.

Stack: **Next.js (App Router) + TypeScript + Tailwind CSS + Drizzle ORM +
PostgreSQL**.

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Setup](#2-setup)
3. [What's included](#3-whats-included)
4. [Business rules (and how they map to Shopify)](#4-business-rules-and-how-they-map-to-shopify)
   - [Is an order editable after payment?](#is-an-order-editable-after-payment)
5. [Order status: derivation and edge cases](#5-order-status-derivation-and-edge-cases)
6. [API reference](#6-api-reference)
7. [Project structure](#7-project-structure)
8. [Not included](#8-not-included-intentionally-to-keep-this-a-small-app)

## 1. Prerequisites

- Node.js 20+
- A running PostgreSQL server (local install, Docker, or a hosted instance
  like Neon/Supabase/RDS)

## 2. Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` — pointing at your Postgres instance.
- `AUTH_SECRET` — a random 32+ byte value used to sign session cookies.
  `.env.example` has a one-liner to generate one:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

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

This also creates a demo login — `demo@example.com` / `password123` — so
you can sign in immediately instead of visiting `/signup` first.

Run the app:

```bash
npm run dev
```

Visit http://localhost:3000/orders and sign in (or go to `/signup` if you
skipped `db:seed`).

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

## 5. Order status: derivation and edge cases

The status shown in the UI (`pending`, `partially_paid`, `paid`, `overdue`,
plus the refund/void states) is **never read off a stored column** for the
first four values — it's computed fresh every time an order is loaded, by
`deriveOrderStatus()` in `src/lib/orders.ts`. This is what makes "overdue"
correct on any given day without a cron job or background update: it's a
function of `amountPaid`, `totalAmount`, `dueDate`, and the current time,
not a flag that gets set once and goes stale.

The stored `financial_status` column still exists and is still the source
of truth for business rules like the edit lock, void, and delete — those
only care about pending/partially_paid/paid/refunded/voided and shouldn't
change just because a clock ticked past midnight. `deriveOrderStatus()` is
purely a *display*-time concern layered on top.

**Priority order**, checked in this exact sequence:

1. **`paid`** — if `amountPaid >= totalAmount`. This wins over everything
   else, including a due date that's already passed.
2. **`overdue`** — if not fully paid, and the current date is past the due
   date.
3. **`partially_paid`** — if not fully paid, not overdue, and
   `amountPaid > 0`.
4. **`pending`** — otherwise (nothing paid, not overdue).

**Edge cases:**

- **An order that was overdue and is then paid in full shows `paid`, not
  `overdue`.** Rule 1 is checked before rule 2, and it wins unconditionally
  — being fully paid always clears the overdue state, no matter how late
  the payment was.
- **An order that's overdue with a partial payment shows `overdue`, not
  `partially_paid`.** Rule 2 is checked before rule 3. Overdue only loses
  to `paid`; a partial payment doesn't buy an order out of being overdue.
- **"Past due date" is defined precisely as:** the due date is a calendar
  date with no time component. An order becomes overdue starting the day
  *after* its due date — i.e. it compares today's UTC calendar date
  (`YYYY-MM-DD`) against the due date as strings; `overdue` is true once
  today's date is strictly greater. A payment due `2026-08-10` is not yet
  overdue on the 10th, and becomes overdue on the 11th, evaluated in the
  server's clock (UTC), regardless of the viewer's timezone.
- **Refunded and voided orders never show as `overdue`, `pending`, etc.**
  If `financial_status` is `voided`, `refunded`, or `partially_refunded`,
  `deriveOrderStatus()` returns that value directly and skips the
  paid/overdue/partially_paid/pending logic entirely — a fully refunded
  order that happens to be past its due date is still shown as `refunded`,
  never `overdue`.

## 6. API reference

All `/api/orders*` routes require a logged-in session. Signing up or
logging in sets an httpOnly `session` cookie (a JWT signed with
`AUTH_SECRET`) — there's no `Authorization` header to manage; a browser
handles the cookie automatically, and curl needs `-c`/`-b` to persist it
across requests (see the walkthrough below).

### Error shape

Every endpoint that can fail returns errors in the same shape, built by
the shared helper in `src/lib/api-error.ts`:

```json
{
  "error": {
    "message": "Human-readable summary",
    "code": "optional_machine_code",
    "fields": { "fieldName": "Field-specific message" }
  }
}
```

`code` and `fields` are both optional. `fields` is only present on `400`
validation failures — one message per invalid field, keyed by field name
(or dotted path for nested fields like `lineItems.0.quantity`).

### Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | none | Creates an account, logs you in |
| POST | `/api/auth/login` | none | Logs in |
| POST | `/api/auth/logout` | none | Clears the session cookie |
| GET | `/api/orders` | required | List/search/filter your orders |
| POST | `/api/orders` | required | Create an order |
| GET | `/api/orders/[id]` | required | Get one order |
| PUT | `/api/orders/[id]` | required | Edit an order (while editable) |
| DELETE | `/api/orders/[id]` | required | Delete an order (while unpaid) |
| POST | `/api/orders/[id]/pay` | required | Record a payment |
| POST | `/api/orders/[id]/refund` | required | Issue a refund |
| POST | `/api/orders/[id]/void` | required | Void an order |

**POST /api/auth/signup**
- Body: `{ "email": string, "password": string (min 8 chars) }`
- Success: `201 { "user": { "id": number, "email": string } }`
- Errors: `400` validation; `409` email already registered (`code: "email_taken"`)

**POST /api/auth/login**
- Body: `{ "email": string, "password": string }`
- Success: `200 { "user": { "id": number, "email": string } }`
- Errors: `400` validation; `401` invalid credentials (`code: "invalid_credentials"`)

**POST /api/auth/logout**
- Body: none
- Success: `200 { "ok": true }`

**GET /api/orders**
- Query params: `q` (optional, searches order name / customer name / customer email), `status` (optional — `any` (default), `pending`, `overdue`, `partially_paid`, `paid`, `partially_refunded`, `refunded`, or `voided`; filters against the *derived* status, see [Order status](#5-order-status-derivation-and-edge-cases), not the raw stored column)
- Success: `200 { "orders": Order[] }` — each order includes `displayStatus` and `itemCount`
- Errors: `401` unauthorized

**POST /api/orders**
- Body:
  ```json
  {
    "customerName": "string",
    "customerEmail": "string | null",
    "customerPhone": "string | null",
    "currency": "string (default INR)",
    "description": "string | null",
    "dueDate": "YYYY-MM-DD",
    "lineItems": [
      { "description": "string", "variantTitle": "string | null", "sku": "string | null", "quantity": "number >= 1", "price": "number >= 0" }
    ],
    "initialPayment": "number >= 0 (default 0)"
  }
  ```
- Success: `201 { "order": Order }`
- Errors: `400` validation (e.g. missing customer name, no line items)

**GET /api/orders/[id]**
- Success: `200 { "order": Order }` — includes `lineItems`, `refunds`, `transactions`, `displayStatus`
- Errors: `401` unauthorized; `404` not found (`code: "not_found"`) — also returned for orders that exist but belong to another user

**PUT /api/orders/[id]**
- Body: same shape as `POST /api/orders`
- Success: `200 { "order": Order }`
- Errors: `400` validation; `404` not found; `409` order isn't editable right now (see [editable after payment](#is-an-order-editable-after-payment))

**DELETE /api/orders/[id]**
- Success: `200 { "success": true }`
- Errors: `404` not found; `409` order has a recorded payment

**POST /api/orders/[id]/pay**
- Body: `{ "amount": "number >= 0.01", "paidOn": "YYYY-MM-DD", "note": "string | null" }`
- Success: `200 { "order": Order }`
- Errors: `400` validation, or amount exceeds the balance due ("Payment of X exceeds the amount due..."); `404` not found; `409` order is `voided` or `refunded`

**POST /api/orders/[id]/refund**
- Body: `{ "amount": "number > 0", "reason": "string | null", "note": "string | null", "lineItems": [{ "lineItemId": "number", "quantity": "number" }] }`
- Success: `200 { "order": Order }`
- Errors: `400` validation, or amount exceeds what's refundable; `404` not found; `409` nothing left to refund

**POST /api/orders/[id]/void**
- Body: none
- Success: `200 { "order": Order }`
- Errors: `404` not found; `409` order has a payment captured, or isn't `pending`

### curl walkthrough

Cookies need to be saved and replayed across requests since sessions are
cookie-based, not token-based — that's what `-c cookies.txt` (save) and
`-b cookies.txt` (send) do below.

```bash
# 1. Sign up (also logs you in)
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"demo@example.com","password":"password123"}'

# 2. Log in (only needed if you already have an account)
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"demo@example.com","password":"password123"}'

# 3. Create an order (uses the session cookie saved above)
curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customerName": "Priya Sharma",
    "currency": "INR",
    "dueDate": "2026-08-20",
    "lineItems": [{ "description": "Wireless Mouse", "quantity": 1, "price": 799 }]
  }'

# 4. Record a payment against the order (swap 1 for the id returned above)
curl -s -X POST http://localhost:3000/api/orders/1/pay \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "amount": 799, "paidOn": "2026-08-15", "note": "Paid via bank transfer" }'
```

## 7. Project structure

```
src/
  db/
    schema.ts      Drizzle table definitions (orders, line items, refunds, transactions)
    index.ts        DB client
    seed.ts         Demo data
  lib/
    orders.ts       All order business logic (create/update/pay/refund/void)
    types.ts        Zod validation schemas + the editable-status list
    api-error.ts     Shared { error: { message, code?, fields? } } response helper
    format.ts        Currency/date formatting helpers
  app/
    orders/...       Pages (list, create, detail, edit, pay, refund)
    api/orders/...   REST-ish route handlers used by the pages' forms
  components/        Order form, status badge, refund/payment forms, action buttons
```

## 8. Not included (intentionally, to keep this a "small" app)

- Fulfillment / shipping tracking
- Product catalog (line items are freeform description/SKU/price/qty, not
  linked to a products table)
- Payment gateway integration — "recording a payment" or "refund" just
  updates the ledger in this app; it doesn't move real money anywhere

These are natural next additions if you want to grow this past a demo/
internal tool.
