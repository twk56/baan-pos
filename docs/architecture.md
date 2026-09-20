# Architecture and implementation notes

## Business logic

`server/index.js`: HTTP, authentication, authorization, validation and endpoint handlers.
`server/service.js`: checkout, receipt and cancellation business rules.
`server/db.js`: schema, parameterized queries, transaction helper and initial seed.
`src/main.tsx`: React pages, forms, cart, payment and receipt.

Money is integer satang. Server computes subtotal from current product prices, checks the client expected price and computes tax after discount. UTC timestamps are aggregated in Asia/Bangkok (UTC+7). Only completed, paid orders count as revenue. Gross profit excludes tax, includes discount and uses cost snapshots at sale time.

Checkout runs synchronously inside BEGIN IMMEDIATE → inserts order/items/payment, decrements stock, writes movement and audit → COMMIT. Any error rolls back all writes. The unique request key prevents repeat submission. Pending reserves stock; failed payments roll back without an order. Cancellation restores stock exactly once and simulates refund, with audit records.

## Database

users → sessions, orders, stock_movements, audit_logs.
categories → products → order_items, stock_movements.
customers → orders → order_items, payments.
settings stores shop name, tax rate and receipt footer.

Schema initialization and demo seed are idempotent. Monetary columns use integer satang. Stock has a database CHECK constraint to reject negative balances. All application SQL uses bound parameters; SQLite foreign keys are enabled.

## API overview

All endpoints use `/api`. Success: `{data: ...}`. Error: `{code, message}`. Session is required except login.

| Resource | Endpoints | Access |
|---|---|---|
| Auth | POST /auth/login, /auth/logout; GET /auth/me | Both roles |
| Products | GET /products, /products/:id; POST /products; PATCH/DELETE /products/:id | Read both, writes admin |
| Categories | GET/POST /categories; PATCH /categories/:id | Read both, writes admin |
| Customers | GET/POST /customers; PATCH /customers/:id | Both |
| Orders | GET/POST /orders; GET /orders/:id | Both |
| Cancel | POST /orders/:id/cancel | Admin |
| Payment | POST /orders/:id/payment | Both |
| Inventory | GET /inventory, /inventory/movements; POST /inventory/receive, /inventory/adjust | Admin |
| Dashboard | GET /dashboard/summary, /dashboard/sales, /dashboard/top-products | Admin |
| Reports | GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD | Admin |
| Settings | GET/PATCH /settings | Read both, writes admin |
| Users | GET/POST /users; PATCH /users/:id | Admin |
| Audit | GET /audit | Admin |

DELETE product deactivates it, preserving history. Product PATCH validates a full editable product form. Category deactivation prevents assigning products to that category but does not itself deactivate existing products. An admin cannot change their own role/status.

## Case study

Problem: a POS must never record revenue without a matching payment record and inventory movement, even when a request fails midway or is submitted twice.

Solution: enforce transactional changes on the server, use integer money, validate all inputs, snapshot prices/costs and retain stock/audit records. Client UI handles empty/error/loading states and shows payment results only after commit.

Tradeoff: SQLite enables immediate local use without external database credentials and serializes writes reliably for a single store demo. A future multi-instance deployment should migrate the data access layer to PostgreSQL, add migrations, pagination, operational monitoring and offline/retry policy.
