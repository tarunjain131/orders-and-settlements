# Order Admin

Order Admin is a small, self-hosted order-management tool: create an
order, track its line items, take payments against it (in full, in
part, or over time), issue refunds, and see its status — including
whether it's overdue — without ever trusting a value that could go
stale. It's built on **Next.js (App Router) + TypeScript + Tailwind CSS
+ Drizzle ORM + PostgreSQL**.

It's a from-scratch demo, not a fork of any commerce platform's code —
but its domain modeling (line items, an order financial-status
lifecycle, per-line-item refunds, status computed at read time instead
of cached) deliberately follows patterns used by real order/fulfillment
systems, for reasons laid out below.

**Live demo:** https://orders-and-settlements-six.vercel.app/ — the
login page comes prefilled with the demo account
(`demo@example.com` / `password123`), so you can just hit **Log in**
and land straight in a populated dashboard (pending, paid, partially
paid, refunded, and voided example orders). Hosted on **Vercel**
(app) + **Neon** (Postgres).

## Contents

- [Why this project exists](#why-this-project-exists)
- [Background: where the domain modeling comes from](#background-where-the-domain-modeling-comes-from)
1. [Prerequisites](#1-prerequisites)
2. [Setup](#2-setup)
3. [What's included](#3-whats-included)
4. [Design decisions and rationale](#4-design-decisions-and-rationale)
   - [Is an order editable after payment?](#is-an-order-editable-after-payment)
   - [Refunds: why they exist and how they're modeled](#refunds-why-they-exist-and-how-theyre-modeled)
   - [Voiding vs. deleting vs. refunding](#voiding-vs-deleting-vs-refunding)
   - [Order totals are subtotal-only](#order-totals-are-subtotal-only)
   - [Payment dates: why `paidOn` is tracked separately](#payment-dates-why-paidon-is-tracked-separately)
   - [Consistent API error shape](#consistent-api-error-shape)
5. [Order status: derivation and edge cases](#5-order-status-derivation-and-edge-cases)
6. [API reference](#6-api-reference)
7. [Project structure](#7-project-structure)
8. [Not included](#8-not-included-intentionally-to-keep-this-a-small-app)

## Why this project exists

Most demo CRUD apps only model the happy path: create a record, list
it, edit it. Order Admin exists to model the *whole* lifecycle an order
actually goes through in a real business — partial payments arriving
over time, payments getting backdated once someone finds the bank
statement, a due date passing before the money shows up, a customer
needing part of an order refunded, an order needing to be cancelled
before anything was ever charged. Those aren't edge cases in commerce
or fulfillment operations — they're daily occurrences, and a tool that
can't represent them isn't really an order-management tool. Every
design decision in this repo (see [section 4](#4-design-decisions-and-rationale))
is aimed at handling that full lifecycle correctly, not just the
first-write path.

## Background: where the domain modeling comes from

This app is not Shopify code, and it isn't an official or production
Shopify integration — it's a small, original, from-scratch project. But
the specific modeling choices in it aren't guesses; they come out of
production experience working on Shopify integrations — Shopify
Partner apps, the Shopify Admin API (both REST and GraphQL), Shopify
webhooks, and order/inventory/tracking synchronization between Shopify
and external systems — including work on Shopify integrations at
Shipmozo, such as reliability improvements and migrating webhook
ingestion from Laravel to Node.js.

The connection to this codebase is concrete, not decorative:

- **Refunds are modeled per line item, not as a flat amount**, because
  a refund is only actually attributable if you know *what* was
  returned, not just that money moved — the same reasoning that governs
  Shopify's own refund API, and that matters for inventory and
  reporting in any real fulfillment pipeline.
- **Order status is derived at read time (`deriveOrderStatus`), never
  cached** — see [section 5](#5-order-status-derivation-and-edge-cases).
  Trusting a stored status flag is exactly the class of bug that shows
  up once events can arrive late or out of order: a webhook-driven
  system can't trust "the last state we wrote," it has to recompute
  truth from source fields on every read. That discipline carries over
  even to a small CRUD app like this one.
- **Payment dates (`paidOn`) are tracked separately from `createdAt`**
  — see [Payment dates](#payment-dates-why-paidon-is-tracked-separately)
  — because reconciliation always lags reality, the same gap between
  "when something happened" and "when the system found out" that shows
  up constantly in webhook processing.
- **Amount-based invariants** — a payment can't push `amountPaid` past
  `totalAmount`, a refund can't push `amountRefunded` past
  `amountPaid` — are a lightweight version of the same
  consistency/idempotency guards that matter even more once the same
  event can be delivered, or retried, more than once, which is the
  normal case for high-volume webhook ingestion.

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

- **Order list** (`/orders`) — searchable, filterable by status
  (including the derived `overdue` state), with customer, status, due
  date, total, paid, and balance-due columns.
- **Create order** (`/orders/new`) — customer details, a required due
  date (when payment is expected), an order description, dynamic line
  items (add/remove rows, quantity × price), and a choice of leaving
  the order unpaid, marking it fully paid, or recording a partial
  payment at creation time.
- **Order detail** (`/orders/[id]`) — line items, a full payment
  history table (amount, date paid, note, when it was recorded), a
  payment summary (subtotal, total, paid, refunded, balance due), a
  timeline of lifecycle events, and the actions available for the
  order's current status.
- **Edit order** (`/orders/[id]/edit`) — re-open the same form to
  change the customer, due date, description, or line items, subject
  to the edit-lock rule below.
- **Record a payment** (`/orders/[id]/pay`) — log a full or partial
  payment against the balance due, with its own payment date
  (defaults to today, editable for backdating) and an optional note.
- **Refund** (`/orders/[id]/refund`) — refund specific line-item
  quantities and/or an extra flat amount (e.g. shipping), with a
  reason and note. Capped at what's actually been paid and not yet
  refunded.
- **Void** — cancel an order that has no payment captured yet.
- **Delete** — permanently remove an order that has zero payments
  recorded, with a confirm step.

## 4. Design decisions and rationale

### Is an order editable after payment?

This was the main behavioral question in building this app: once
money has moved against an order, you can't just silently rewrite what
was sold. Concretely:

- An order is editable (line items, quantities, prices, customer info,
  due date, description) while its status is `pending` or
  `partially_paid`.
- Once status is `paid`, `partially_refunded`, `refunded`, or
  `voided`, the Edit page shows a locked banner instead of the form,
  and the API rejects edit requests with a `409`. From that point,
  changes go through a **refund** (to give money back) or an
  **additional payment** (to collect more) — or a new order.
- The server enforces this independently of the UI — the `PUT
  /api/orders/[id]` route re-checks status before writing — so it
  can't be bypassed by calling the API directly.

The order locks only once it's **fully** paid, not the moment the
first payment lands. That's deliberate: it lets you record partial
payments over time (a deposit, then the balance later) without losing
the ability to fix a typo in a line item or adjust the due date before
the order is fully settled. Locking on the first payment received
would make any partial-payment or installment workflow unusable —
which is most real orders that aren't paid up front.

### Refunds: why they exist and how they're modeled

A payment ledger that only records money coming in is half a model of
commerce. Returns, damaged goods, service failures, and simple order
corrections are routine — not exceptional — and a tool that can record
a sale but can't correct one only handles the easy half of the
lifecycle. Refunds are exactly as core an operation here as recording
a payment.

How they're modeled, and why:

- **Refunds are attributed to specific line items and quantities**,
  not just a flat dollar amount. `POST /api/orders/[id]/refund` takes
  a `lineItems: [{ lineItemId, quantity }]` array alongside the total
  amount, so a refund records *what* was returned, not just that money
  moved. That distinction matters the moment you need a return report,
  or need to feed a returned quantity into anything downstream — a
  refund that's just "-₹500, no detail" throws that information away.
- **A refund is capped at what's actually been paid and not yet
  refunded** (`amountPaid − amountRefunded`), enforced server-side in
  `createRefund`. This is a basic ledger-integrity invariant: you can't
  hand back money the order never collected, and you can't refund the
  same money twice. It's the same category of check that matters even
  more in systems where the same refund event could be delivered, or
  retried, more than once.
- **The order's status reflects how much has been refunded**, not just
  that a refund happened: `partially_refunded` once any refund is
  issued, `refunded` once the refunded total catches up to the paid
  total. That distinction is what lets the dashboard and detail page
  tell "this order still has money outstanding on it" apart from "this
  order is fully unwound," instead of collapsing both into one vague
  "refunded" bucket.

### Voiding vs. deleting vs. refunding

Order Admin has three different ways to "undo" an order, on purpose,
because they undo three different things:

- **Void** is for an order that should never have gone anywhere — no
  money has moved, so there's no ledger entry to reconcile. It's a
  pure status flip to a terminal `voided` state, only allowed while
  `pending` with `amountPaid = 0`.
- **Delete** is for removing a mistaken or test order outright, again
  only while `amountPaid = 0` — if a payment exists, there's a payment
  record that has to stay reconcilable, so it can't just be deleted
  out from under it.
- **Refund** is the only way to undo money that has already moved.

Collapsing these into one generic "cancel" button would hide a real
distinction: an order nothing has been paid on and an order that's
been paid and needs correcting are fundamentally different states,
and treating them the same is how ledgers end up wrong.

### Order totals are subtotal-only

Per this project's scope, an order's total is its **subtotal only** —
no order-level discount, shipping, or tax. The `discount_amount`,
`shipping_amount`, and `tax_amount` columns are still present on the
`orders` table (left in place rather than dropped, since removing a
column is a one-way door and there's no cost to leaving unused ones
defaulted to zero) but they're vestigial: always `0`, no inputs for
them on the create/edit form, and `createOrder`/`updateOrder` don't
accept nonzero values for them.

### Payment dates: why `paidOn` is tracked separately

Every transaction has both a `paidOn` date and a `createdAt`
timestamp, and they're allowed to differ. `paidOn` is a plain,
editable date field (defaults to today, but can be backdated) —
because reconciliation always lags reality. Money can arrive today but
not get logged until tomorrow, or get backdated a week later once
someone finds the relevant bank statement. If the system only recorded
`createdAt` — when the row happened to be inserted — every aging or
collections report built on this data would silently reflect data-entry
lag instead of the truth. Carrying the real event date through the
system, instead of substituting "when we happened to observe it," is
the same problem event timestamps solve in any system that processes
things asynchronously.

### Consistent API error shape

Every route under `src/app/api/**` returns errors in one shape, built
by the shared helper in `src/lib/api-error.ts`:

```json
{
  "error": {
    "message": "Human-readable summary",
    "code": "optional_machine_code",
    "fields": { "fieldName": "Field-specific message" }
  }
}
```

Once an API has more than one consumer — and this one already has
several pages and components calling it — ad hoc error shapes (a plain
string in one route, something else in another) turn every consumer
into a special case that has to know each endpoint's quirks.
Standardizing the shape up front, with a `fields` map for per-field
validation messages instead of one joined string, means any future
client can rely on one contract instead of reverse-engineering it
endpoint by endpoint.

## 5. Order status: derivation and edge cases

The status shown in the UI (`pending`, `partially_paid`, `paid`,
`overdue`, plus the refund/void states) is **never read off a stored
column** for the first four values — it's computed fresh every time an
order is loaded, by `deriveOrderStatus()` in `src/lib/orders.ts`. That's
what makes `overdue` correct on any given day with no cron job or
background update: it's a function of `amountPaid`, `totalAmount`,
`dueDate`, and the current time, not a flag that was set once and can
go stale.

The stored `financial_status` column still exists and is still the
source of truth for business rules like the edit lock, void, and
delete — those only care about
pending/partially_paid/paid/refunded/voided and shouldn't change just
because a clock ticked past midnight. `deriveOrderStatus()` is purely a
*display*-time concern layered on top.

**Priority order**, checked in this exact sequence:

1. **`paid`** — if `amountPaid >= totalAmount`. This wins over
   everything else, including a due date that's already passed.
2. **`overdue`** — if not fully paid, and the current date is past the
   due date.
3. **`partially_paid`** — if not fully paid, not overdue, and
   `amountPaid > 0`.
4. **`pending`** — otherwise (nothing paid, not overdue).

**Edge cases:**

- **An order that was overdue and is then paid in full shows `paid`,
  not `overdue`.** Rule 1 is checked before rule 2 and wins
  unconditionally — being fully paid always clears the overdue state,
  no matter how late the payment was.
- **An order that's overdue with a partial payment shows `overdue`,
  not `partially_paid`.** Rule 2 is checked before rule 3. Overdue
  only loses to `paid`; a partial payment doesn't buy an order out of
  being overdue.
- **"Past due date" is defined precisely as:** the due date is a
  calendar date with no time component. An order becomes overdue
  starting the day *after* its due date — today's UTC calendar date
  (`YYYY-MM-DD`) is compared against the due date as strings, and
  `overdue` is true once today's date is strictly greater. A payment
  due `2026-08-10` is not yet overdue on the 10th, and becomes overdue
  on the 11th, evaluated in the server's clock (UTC), regardless of
  the viewer's timezone.
- **Refunded and voided orders never show as `overdue`, `pending`,
  etc.** If `financial_status` is `voided`, `refunded`, or
  `partially_refunded`, `deriveOrderStatus()` returns that value
  directly and skips the paid/overdue/partially_paid/pending logic
  entirely — a fully refunded order that happens to be past its due
  date is still shown as `refunded`, never `overdue`.

## 6. API reference

All `/api/orders*` routes require a logged-in session. Signing up or
logging in sets an httpOnly `session` cookie (a JWT signed with
`AUTH_SECRET`) — there's no `Authorization` header to manage; a browser
handles the cookie automatically, and curl needs `-c`/`-b` to persist it
across requests (see the walkthrough below).

### Error shape

Every endpoint that can fail returns errors in the shape described in
[Consistent API error shape](#consistent-api-error-shape):

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
    orders.ts       All order business logic (create/update/pay/refund/void/status)
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
