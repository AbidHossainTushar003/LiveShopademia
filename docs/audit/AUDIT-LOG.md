# Audit log — Phase 0

## Scope and timing
- Date: 2026-10-10
- Phase: Discovery and baseline
- Scope: repository inspection, repo health check, app structure mapping, baseline test verification, documentation gap review

## Repository health and preservation
- Working tree was already dirty before the audit; preserved all existing user changes as required.
- Current branch: `main` (with a local `main...2/main` tracking state reported by Git; no destructive commands were run).
- No application-code changes were made during Phase 0.

## Source-of-truth review
The project does not contain a repository instruction file or approved master requirements file at the expected locations:
- `SHOPADEMIA-MGS-001.md` — not found
- `CLAUDE.md` — not found
- `docs/openapi.yaml` — not found

This means the current codebase and runtime behavior are the primary evidence source, and the project’s actual behavior is treated as the working contract until explicit owner-approved requirements are added.

## Observed project structure and 3-section mapping
### Admin
- `admin.html` — administrative dashboard and order-management UI
- `admin-platform.html` — multi-shop/platform management UI
- `admin-assets/` — admin CSS/JS assets
- `server/app.js` — admin authentication, product management, order review, status transitions, and platform routes
- `server/db.js` — admin credential and admin-session schema, plus shop/platform tables

### API
- `server/` — Express backend entrypoints and business logic
- `server/index.js` — server startup, environment validation, PostgreSQL pool setup, database initialization
- `server/app.js` — HTTP routes, validation, auth, order creation, admin endpoints, product APIs
- `server/catalog.js` — server-owned catalog manipulation and product listing logic
- `server/orders.js` — pricing, validation, stock enforcement, and order lifecycle logic
- `server/platform.js` — shop management, roles, offers, push subscriptions, and dashboard analytics

### Public HTML
- `index.html` — storefront UI
- `css/` — storefront CSS and generated Tailwind stylesheet
- `js/` — storefront JS modules, viewmodels, repositories, utilities, and tests
- `uploads/` — local product image storage
- `service-worker.js` — optional browser notification/service-worker support

## Actual technology and deployment evidence
- `package.json` declares: `type: module`, `express`, `pg`, `helmet`, `multer`, `jsonwebtoken`, `dotenv`, `express-rate-limit`, `supertest`
- `server/db.js` initializes PostgreSQL tables and uses `pg` `Pool`
- `server/index.js` requires `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, and uses PostgreSQL via `Pool`
- `docker-compose.yml` and `docker-compose.production.yml` are configured for PostgreSQL containers
- `.env.example` and `.env.production.example` contain PostgreSQL environment variables, not MySQL

This differs from the master prompt’s target statement that the backend should be Node.js 22 + Express + MySQL for cPanel hosting. The project currently implements a PostgreSQL-backed Express API and is already aligned to that schema and runtime configuration.

## Route and API inventory summary
The app mounts a same-origin API under `/api/v1` and serves both storefront and admin pages from the same host.

Notable routes found in the current code:
- `GET /` — storefront homepage
- `GET /admin` — admin login/dashboard
- `GET /admin/platform` — platform/shop management UI
- `GET /api/v1/products`
- `GET /api/v1/categories`
- `GET /api/v1/products/hero-offer`
- `GET /api/v1/storefront-config`
- `GET /api/v1/shops/:slug/products`
- `GET /api/v1/shops/:slug/categories`
- `GET /api/v1/shops/:slug/products/hero-offer`
- `GET /api/v1/shops/:slug`
- `GET /api/v1/shops/:slug/config`
- `POST /api/v1/orders`
- `POST /api/v1/customer/order-lookup`
- `POST /api/v1/admin/login`
- `POST /api/v1/admin/logout`
- `GET /api/v1/admin/profile`
- `GET /api/v1/admin/products`
- `POST /api/v1/admin/products`
- `PATCH /api/v1/admin/products/:id`
- `DELETE /api/v1/admin/products/:id`
- `GET /api/v1/admin/orders`
- `PATCH /api/v1/admin/orders/:id/status`
- `PATCH /api/v1/admin/orders/:id/advance-payment`
- `GET /api/v1/admin/shop/...` and `POST /api/v1/admin/shops` (platform flows)

## Security and integrity notes from the code review
Important facts observed:
- Security headers are set with `helmet` and a restrictive CSP.
- Admin authentication is enforced before protected admin endpoints.
- Orders validate prices against the server catalog instead of trusting client input.
- Order idempotency and request hashing are implemented for duplicate checkout protection.
- Product uploads enforce file type and size limits.
- Admin password hashing uses a dedicated password helper and the project seeds the admin login from environment values.
- The app does not expose a public admin registration flow.
- The project has explicit logic for shop membership roles, order lifecycle restrictions, and manual advance-payment review states.

## Important gaps and unresolved decisions
The following items are still materially unresolved or owner-dependent:
1. `Checkout identity`: guest checkout is effectively allowed in the current customer flow; an explicit owner decision may still be needed if the business wants a forced login requirement.
2. `Cart architecture`: current app behavior stores cart and wishlist in the browser only; this is a deliberate browser-side architecture, but it should be confirmed as approved for the live business if the owner expects account-backed carts.
3. `Manual advance-payment review`: the code implements a manual review workflow with `pending/verified/rejected` states, but the business policy for bKash/advance-charge handling still needs explicit owner signoff.
4. `Delivery and inventory policy`: discount, delivery, cancellation, refund, and stock-reservation rules are embedded in the server logic and appear intentionally implemented, but they should be validated against owner requirements.

## Baseline verification
Executed command:
- `cmd /c "npm.cmd test -- --test-reporter=spec"`

Result:
- 58 tests passed
- 0 failed
- exit code 0

This is the baseline evidence for the current codebase before any Phase 1 security fixes.

## Phase 0 conclusion
The project is operational and testable, but it is not a blank or generic repo. It already contains a working storefront, admin dashboard, and PostgreSQL-backed API with a multi-shop architecture. The next logical step after Phase 0 is Phase 1: audit and repair security and data-integrity issues, if any are discovered, while preserving the working behavior that the current tests confirm.
