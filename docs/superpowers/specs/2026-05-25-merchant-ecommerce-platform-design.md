# Merchant Ecommerce Platform Design

## Goal

Build the current pet-toy shop API into a merchant-grade ecommerce system that can support real catalog operations, cart and order persistence, payment lifecycle handling, merchant operations, and a customer-facing storefront without leaving core modules as demos.

## Current State

The repository already has a NestJS API, Prisma schema, and passing e2e coverage for products, orders, cart, mock payments, and a small admin surface. The important limitation is that the business services still use seed data and in-memory maps. Prisma exists, but the transaction path is not yet backed by durable storage.

## Missing Modules

1. Durable catalog storage: products, variants, images, status, inventory, and seed data must live in the database.
2. Merchant product operations: create, edit, publish, archive, image management, SKU management, and inventory adjustment.
3. Durable cart and order storage: anonymous carts, customer carts, order creation, order reads, and order history must survive process restarts.
4. Inventory reservation and deduction: checkout must handle stock consistency, paid orders, cancellation, timeout release, and refund return flows.
5. Customer and membership: phone login, profiles, address book, user order center, and customer-owned pets if needed later.
6. Payment integration: replace mock payment with provider adapters, signed requests, callback verification, idempotent notifications, and payment status history.
7. Order lifecycle: cancellation, payment timeout, shipment, completion, refund, after-sales, merchant notes, and operation logs.
8. Merchant admin console: authenticated staff UI/API for products, inventory, orders, fulfillment, refunds, customers, and analytics.
9. Storefront commerce UI: product listing, product detail, cart, checkout, payment result, order detail, and account pages.
10. Promotions and channel tracking: coupon, campaign, price rules, landing page attribution, and traffic event reporting.
11. File and media management: upload, validate, store, serve, and attach product images and operational assets.
12. Production hardening: roles, permissions, rate limits, CORS policy, secret management, migration flow, logging, monitoring, and deployment scripts.

## Delivery Strategy

The platform should grow from the durable transaction core outward. We will not build isolated screens that cannot connect to real product, order, and payment data.

Phase 1: Catalog persistence
- Move product reads to Prisma when `DATABASE_URL` is configured.
- Keep seed fallback for local and test environments without a database.
- Add an idempotent product seed command.
- Preserve existing public and admin product API response shapes.

Phase 2: Order and cart persistence
- Convert carts and orders from maps to Prisma-backed services.
- Preserve existing API routes while making order numbers and cart numbers durable.
- Add stock validation against database variants.

Phase 3: Inventory consistency
- Add stock movement records or transaction-protected variant stock updates.
- Deduct/reserve inventory at checkout according to a clear order policy.
- Add cancellation and timeout behavior.

Phase 4: Merchant operations API
- Add admin product CRUD, SKU updates, status changes, inventory adjustment, and order fulfillment APIs.
- Replace the development admin token with a real auth boundary.

Phase 5: Payment lifecycle
- Keep the current mock provider as a development adapter.
- Add provider adapter boundaries for WeChat and Alipay.
- Add callback idempotency, payment event recording, and order status transitions.

Phase 6: Storefront and admin UI
- Build commerce pages into `web/` after the API has durable data.
- Add merchant admin views for catalog and order management.

Phase 7: Production readiness
- Add migration/seed/deploy scripts, observability, security limits, and operational runbooks.

## First Slice Design

The first implementation slice is catalog persistence. It touches the smallest meaningful surface while preparing the rest of the system for durable data.

`ProductsService` will expose asynchronous methods because Prisma reads are asynchronous. Controllers and dependent services will return promises through the existing NestJS flow. When `DATABASE_URL` is absent, `ProductsService` will keep using `starterProducts`, so existing tests and lightweight local development remain fast.

When `DATABASE_URL` is present, `ProductsService` will read products with variants and images from Prisma and map them back to the existing `ProductDetail`, `ProductListItem`, and `ProductVariant` response types. Active public APIs will only expose active products. Admin APIs will include all products.

An idempotent seed script will upsert the starter products into the database. It will use stable slugs and SKU codes rather than relying on generated IDs. The script is the bridge from the current demo catalog to a real merchant catalog.

## Testing

Catalog persistence will be built test-first.

1. Add product mapper unit tests for Prisma-shaped records.
2. Add a `ProductsService` test proving it uses the database repository when configured.
3. Update e2e tests for async service methods without changing route behavior.
4. Run e2e tests, build, and Prisma validation.

## Risks

The main risk is changing synchronous service APIs to asynchronous ones. This is necessary for Prisma and should be handled in one focused pass across product, order, cart, payment, and admin callers.

The second risk is database availability during tests. The intended behavior is explicit: tests without `DATABASE_URL` use the seed fallback, while database-backed tests can be added once a test database is configured.
