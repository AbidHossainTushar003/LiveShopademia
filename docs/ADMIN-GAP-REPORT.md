# Shopademia Admin Panel V3 — B0 Gap Report

**Date:** 2026-10-12
**Scope:** Non-destructive repository reconciliation only
**Authority:** User-supplied V3 prompt preserved in [ADMIN-MASTER-PROMPT.md](./ADMIN-MASTER-PROMPT.md)

## 1. B0 conclusion

This repository is an existing PostgreSQL-backed Node/Express storefront with order/product administration and multi-shop management. It is not a blank admin-panel project. The V3 prompt requires a substantially broader commerce, inventory, accounting, and reporting platform.

**B0 is complete as an evidence-gathering/documentation pass. B1 is blocked and has not been authorized.** The authoritative SHOPADEMIA-MGS-001 v1.0, its explicit owner approval, the original V2 requirements annex, and the MGS phase mapping are missing. The prompt's approval placeholder is not evidence of approval. No application code or production service was changed or accessed for this report.

## 2. Repository and toolchain

| Area | Observed evidence |
|---|---|
| Frontend | Static HTML/CSS and browser ES modules; storefront files under `index.html`, `js/`, `css/`; admin pages in `admin.html` and `admin-platform.html`, with `admin-assets/`. |
| Backend | Node.js ES modules, Express 4, route handlers/business logic in `server/app.js` and `server/platform.js`; domain helpers include `server/orders.js` and `server/catalog.js`. |
| Database | PostgreSQL, accessed through `pg` and initialized by `server/db.js`. The V3 MySQL/MariaDB hosting requirement conflicts with this existing stack and must be resolved before migrations are designed. |
| Declared versions | `package.json` declares Node `>=20`, Express `^4.21.2`, and `pg` `^8.13.1`. Current installed versions include Express 4.22.3, `pg` 8.23.1, and `sharp` 0.35.5. |
| Local runtime | Node.js 24.21.0 and npm 11.19.0. CI config uses Ubuntu and Node 22. |
| Tests/build | `npm test`, API tests, Playwright browser tests, and Tailwind CSS build are declared in `package.json`. Existing installed test dependencies include Playwright and axe-core. |
| Workspace | The current checkout is under OneDrive. D12 asks whether to move it, but D12 is unanswered; no relocation was attempted. |
| Branch | `main` was current, the tracked worktree was clean before this report, and `feature/admin-v2` was absent. No branch change or commit was made. |

Historical cPanel information in the prior session summary reports Node 20.20.2. That value and the executable path were not independently rechecked during B0. The deployment workflow activates a Node 20 virtual environment path, but that is not proof of the actual binary path required by V3. Production PostgreSQL version is also unverified. `sharp` is a native image-processing dependency; cPanel compatibility must be verified before relying on it there.

## 3. Authority, approvals, and scope

- No `SHOPADEMIA-MGS-001` specification or approval record was found in the repository.
- No `docs/PROGRESS.md`, `docs/ADMIN-GAP-REPORT.md`, or `docs/ADMIN-MASTER-PROMPT.md` existed before this B0 pass.
- The attachment includes an approval template (`[name, date, explicit approval statement]`), not a completed owner approval.
- The V3 prompt refers to a full V2 Part E/Part F annex but does not include that annex's complete original module requirements; no V2 source was found.
- No OpenAPI document or existing OpenAPI validation tooling was found.
- Because the MGS phase structure and the V2 annex are absent, MGS-to-B0–B9 mapping cannot be responsibly completed.
- No application features were implemented. All D1–D12 are recorded as **UNANSWERED** until explicit owner decisions are supplied.

## 4. Existing route, API, and authentication contracts

The server serves the storefront and admin from one origin. Existing page routes include `/`, product/category/shop/deals/about/order-lookup/privacy/terms routes, `/admin`, and `/admin/platform`.

Observed API groups in `server/app.js` and `server/platform.js` include:

- Public catalog/configuration: `/api/v1/products`, categories, hero offer, storefront config, shop directory/profile/config, and shop-scoped product/category/offer endpoints.
- Checkout/customer: `POST /api/v1/orders` and `POST /api/v1/customer/order-lookup`.
- Admin identity: login, logout, profile, password change, MFA enrollment, and order activity.
- Orders: list, manual advance-payment review, and status update.
- Products/categories: authenticated product create/update/delete and shop-category create/update/delete.
- Shop/platform: shop create/status/archive/settings, membership management, branding, hero slides, transactions, reports, activity, and offers.
- Push: public shop push-key/subscription endpoints.

Existing response shapes are not a single uniform envelope: catalog APIs commonly return `{ data: ... }`, errors return `{ error: ... }`, and login returns token/expiry fields. Preserve these contracts unless a separately approved compatibility plan says otherwise.

Admin authentication behavior observed in source:

- JWT uses HS256, issuer `shopademia`, an eight-hour lifetime, and a database-backed session record; platform-admin MFA enrollment/login is implemented.
- The API accepts Bearer tokens and an HttpOnly `SameSite=Strict` admin cookie; the cookie is `Secure` in production and scoped to `/api/v1/admin`.
- The request authorization layer resolves current user, session, shop membership, role, and shop status from the database.
- Login is rate-limited to 8 attempts per 15 minutes by the existing rate-limit middleware. The V3 five-failures/15-minute account lockout and single-use password-reset workflow are not present.
- Shop roles currently include `owner`, `admin`, and `staff`; platform-admin status is separate. The V3 role list and action-level permission registry do not exist.
- Password changes and membership changes revoke applicable sessions.
- The original checkout is public/guest-facing and submits customer and bKash details; the browser cart/wishlist are local-storage based per README. Keep the current API/token behavior as the compatibility baseline; do not assume a server-side cart.

## 5. Database and migration inventory

The application schema is expressed as startup/helper DDL in `server/db.js`, not ordered versioned migration files. Observed tables:

1. `orders`
2. `admin_credentials` (legacy credential source copied into platform admin tables)
3. `admin_sessions`
4. `admin_order_events`
5. `managed_products`
6. `shops`
7. `admin_users`
8. `shop_memberships`
9. `platform_admins`
10. `shop_product_categories`
11. `shop_transactions`
12. `shop_offers`
13. `shop_hero_slides`
14. `shop_push_subscriptions`
15. `shop_activity_logs`

Foreign-key examples include shop membership to `shops`/`admin_users`, platform-admin to `admin_users`, order activity to `orders`, shop transactions to `shops` and optionally `orders`, and shop-owned content to `shops`. Products and orders have shop IDs; shop-scoped checkout event IDs and transaction references have unique indexes.

Important current representation and gaps:

- `orders.items` is JSONB rather than normalized order-line/variant/fulfillment rows.
- Existing order money fields (`subtotal`, `advance_amount`, `due_amount`) and product prices/stock use integer `BIGINT` units (whole BDT), not the V3 `DECIMAL(12,2)` strategy.
- Stock is a product-level `managed_products.stock_quantity`; orders use an `inventory_reserved` boolean. There is no variant, warehouse, stock-movement ledger, reservation-quantity history, or reconciliation table/service.
- There are no supplier, purchase, account, double-entry ledger, courier, settlement, return, exchange, refund-payable, generalized idempotency, centralized settings/secret, or versioned status-history tables in the observed schema.
- `admin_order_events` records status/advance-payment actions; `shop_activity_logs` is shop-scoped activity. Neither is the full centralized immutable/redacted audit design specified in V3.
- `shop_transactions` records simple payment/refund/expense/adjustment entries and statuses; it is not evidence of a balanced account ledger or complete settlement workflow.
- `server/migrate.js` invokes the shared initializer using `MIGRATION_DATABASE_URL` in production. It does not provide migration version tracking, dry-run, reconciliation, rollback, or forward-repair orchestration.
- `database/init/10-app-role.sh` creates separate application/migration roles and default privileges for PostgreSQL.
- Production data/table counts, indexes, constraints, legacy discrepancies, and backup restoreability remain **UNVERIFIED**; B0 did not connect to production.

The local browser run uses a newly initialized, isolated PostgreSQL 17.11 development cluster on loopback port 5433. It logged zero admin-managed products. The existing local PostgreSQL service on port 5432 was left untouched. The blank local catalog is expected for a fresh installation; it is not evidence about production data.

## 6. Existing order statuses and V3 mapping

Current code defines `new`, `confirmed`, `processing`, `shipped`, `delivered`, and `cancelled` in `server/orders.js`/`server/db.js`. Current allowed transitions include `cancelled -> new`, unlike the V3 terminal-cancelled rule. The V3 additionally requires `pending`, `on_hold`, `approved`, `packaging`, `ready_to_ship`, `partial_delivered`, `delivery_failed`, and `returned`.

| Existing status | V3 status candidate | Reconciliation |
|---|---|---|
| `new` | `new` | Label matches; populated records and behavioral equivalence still require local/production inventory and owner confirmation. |
| `confirmed` | `approved` or another status | **Unresolved**; do not map without confirming the business meaning. |
| `processing` | `packaging` or another status | **Unresolved**; do not map without confirming the business meaning. |
| `shipped` | `shipped` | Label matches; partial-fulfillment semantics are absent and need owner-approved handling. |
| `delivered` | `delivered` | Label matches; partial delivery and COD evidence are not represented. |
| `cancelled` | `cancelled` | Label matches, but existing reopen transition conflicts with V3 terminal behavior. |

No populated production status was queried. Do not run a status migration until actual values/counts and an approved mapping are documented.

## 7. Required menu comparison

Statuses below describe source evidence only: **EXISTS-WORKING** means a scoped workflow is present in current UI/API; **EXISTS-PARTIAL** means only a subset of V3 scope exists; **MISSING** means no corresponding workflow was located. None of these statuses means V3 acceptance criteria have passed.

| V3 top-level menu | Status | Current evidence / principal gaps |
|---|---|---|
| Dashboard | EXISTS-PARTIAL | Order-oriented admin page and shop analytics exist; no V3 dashboard/order-pipeline design or full report fixtures. |
| Orders | EXISTS-PARTIAL | List, filter, pagination, status and manual advance review exist; required history/status machine, partial delivery, courier, return, exchange and financial lifecycle are absent. |
| Sale | MISSING | No OfficeSale, Wholesale, or Wholeseller workflow. |
| Accounts | EXISTS-PARTIAL | Shop transaction recording/review exists; no account chart, balanced ledger, transfer, payable/receivable or reconciliation workflows. |
| Products | EXISTS-PARTIAL | Basic shop products, images, prices, stock and availability exist; no variant/skin/attribute/purchase/cost lifecycle. |
| Product Supplier | MISSING | No supplier entity/workflow located. |
| Category | EXISTS-PARTIAL | Shop-scoped category CRUD exists; no full approved hierarchy/constraints module. |
| Brand | MISSING | No brand entity/workflow located. |
| Slider | EXISTS-PARTIAL | Shop hero slides support up to five slides and ordering; not a general content/landing-page management system. |
| Website Setup | EXISTS-PARTIAL | Shop profile, logo/banner/hero assets and public storefront configuration exist; no complete website-setup scope. |
| Setting & Configuration | EXISTS-PARTIAL | Shop name and advance charge are configurable; no grouped settings/secrets registry or key-rotation workflow. |
| Campaign/Offer | EXISTS-PARTIAL | Shop offers exist; coupons and full promotion/redemption lifecycle are absent. |
| Admin | EXISTS-PARTIAL | Platform/shop administration and team membership exist; requested named role matrix, action permissions, complete user administration and permission registry are absent. |
| Customer | EXISTS-PARTIAL | Order records and privacy-limited phone/order lookup exist; no customer master, blocklist, message-management workflow. |
| Report | EXISTS-PARTIAL | Basic shop report endpoint exists; required finance/inventory/operations reports and performance evidence are absent. |
| Landing Page | MISSING | Static storefront pages exist, but no landing-page builder/workflow was located. |

The current admin navigation is a small tab set (Orders, Products, Shop profile, Admin profile, Shop management), not the V3 menu manifest/accordion. The required child label `OfficeSale` and the original label `Wholeseller` were not found in the admin UI/API. Because the original V2 annex was not supplied, child-module requirements cannot be exhaustively marked.

## 8. D1–D12 decision register

All are **UNANSWERED**. Current implementation behavior below is evidence, not an approved decision.

| ID | Current evidence | Required owner clarification before dependent work |
|---|---|---|
| D1 Checkout identity | Guest checkout accepts customer name, phone, address, and bKash number; preserve the current checkout contract. | Confirm guest/account identity and token compatibility. |
| D2 Cart source | README describes browser local-storage cart/wishlist. | Confirm whether to retain this or adopt the proposed server cart and define token lifecycle. |
| D3 bKash | Manual advance-payment review exists; no gateway integration. | Define advance rules, duplicate/rejected verification, and payment posting. |
| D4 Product skin | No variant/skin table observed. | Define skin meaning, lookup/variant relationship, SKU and stock identity. |
| D5 Dashboard | Orders-first admin and basic shop reports exist. | Confirm Overview and Order Pipeline measures, filters, and role visibility. |
| D6 Languages | Browser HTML is English; database uses PostgreSQL UTF-8-compatible types. | Confirm Bangla UI requirements, collation/search, and localized formatting. |
| D7 Architecture | Existing Express handlers contain route logic and SQL; there is no broad repository/service/MVVM split. | Confirm how far separation should go without a risky rewrite. |
| D8 Cancellation/refund | Cancellation can return reserved stock before shipment; no refund-payable lifecycle. | Define verified-advance refund/retention, payment, ledger reversal and audit. |
| D9 Stock | Product-level quantities are decremented/reserved at order creation and released on eligible cancellation; no movement ledger or partial shipment quantities. | Resolve shipment multiplicity, failed delivery, expiry, partial delivery, returns and exchanges. |
| D10 Cost | No weighted-average cost/purchase costing model observed. | Approve precision, purchase allocation/void/return policy and frozen cost snapshots. |
| D11 Return window | No return workflow/window setting observed. | Confirm window, Dhaka-time boundary, item eligibility and adjustment rules. |
| D12 Repository location | Workspace is in OneDrive. | Decide whether to relocate and approve a destination before any move. |

## 9. Migration, operations, and hosting risks

- **P0 — Authority absent:** no approved MGS/approval; blocks B1 and all dependent implementation.
- **P0 — PostgreSQL/MySQL conflict:** code, Docker config, app, and prior deployment history identify PostgreSQL; V3 C12 specifies MySQL/MariaDB. Choosing the wrong engine would make migrations and deployment unsafe.
- **P0 — Financial/inventory rules unresolved:** D3, D8–D11 and Part D acceptance details block order/accounting/stock-dependent work.
- **P1 — Unknown production data:** no production table/row/status/stock inventory was run, by design. Any data migration requires a verified local backup, reconciliation report, and approved mapping first.
- **P1 — Migration recovery gap:** current initializer is not a versioned, dry-run, reconciliation-based migration system. Backup/restore scripts exist but successful restore evidence is absent.
- **P1 — Deployment compatibility:** cPanel Node version/path, PostgreSQL version, `sharp` native compatibility, cron paths, and Linux-specific tests require independent verification. Do not infer them from Windows or CI.
- **P1 — OneDrive synchronization:** repository, `node_modules`, and ignored upload artifacts are under the synchronized workspace; resolve D12 and sync exclusions before expanded development.
- **P1 — Roles/audit gaps:** the existing three shop roles and platform-admin flag do not implement the requested action-level role registry, field filtering matrix, or centralized immutable audit schema.
- **P1 — V2 requirements absent:** preserving V2 child labels, module behavior, and phase allocation cannot be verified from the truncated V3 reference alone.
- **P2 — Native/dependency audit:** current `sharp` is installed locally; Linux/cPanel runtime installation and audit evidence remain outstanding.

The repository's GitHub workflow runs CI on Ubuntu/Node 22 and gates cPanel deployment on `CPANEL_DEPLOY_ENABLED == 'true'`. It does not perform database backups or run migrations. The prior session summary records deployment disabled; do not enable it as part of B0.

## 10. Tests and evidence

- Command: `npm.cmd test`
- Environment: local Windows workspace; no production connection.
- Result: **87 passed, 0 failed, 0 skipped**.
- Local run evidence: `http://localhost:3000/healthz`, `/`, `/api/v1/products`, `/admin`, and `/admin/platform` returned HTTP 200. The browser rendered the storefront shell. The isolated local catalog is empty.
- Not run in B0: Linux/WSL CI rerun, Playwright E2E acceptance, production integration, data migration/restore, security review, load/performance targets, live courier or payment integration.

An older `docs/audit/VERIFICATION-MATRIX.md` records a 58-test baseline. That historical document was not rewritten; this report records the more recent 87-test run.

## 11. Required next actions and phase gate

1. Owner supplies the authoritative SHOPADEMIA-MGS-001 v1.0 and an explicit dated approval record.
2. Owner supplies the full original V2 Part E/Part F module annex and intended MGS phase allocation.
3. Owner answers D1–D12, prioritizing finance, stock, checkout compatibility, database engine, and repository location.
4. Verify deployment runtime/database versions and native dependency compatibility without connecting to production.
5. Owner reviews P0 risks and explicitly authorizes B1. Only then may approved B1 implementation begin.

**Release/deployment disposition for this proposed admin program: NO-GO.** This is a phase-gate finding, not a new assessment of the existing storefront release.

## 12. B1 implementation addendum — 2026-10-12

The owner explicitly authorized implementation against the supplied V3 prompt on 2026-10-12. This authorization does not supply the missing SHOPADEMIA-MGS-001 approval record or the original V2 role/menu annex. Work is limited to safe B1 foundations on the existing PostgreSQL stack; no production database or deployment was accessed.

Implemented locally:

- Added `schema_migrations` baseline tracking and a PostgreSQL migration runner with ordered version IDs, immutable checksums, advisory locking, and per-migration transactions.
- Added role and action-permission catalogues. `super_admin` foundations are mapped to the existing platform-admin status; other requested roles remain marked unresolved and receive no permission grants.
- Added platform-admin settings APIs and UI. Secret setting writes require the optional environment-provided `ADMIN_SETTINGS_ENCRYPTION_KEY`, use AES-256-GCM, and return masked values. No secret-read permission is granted.
- Added a single-source admin-foundation menu manifest whose settings, permissions, and activity links are rendered only when the server permission registry grants them.
- Added an append-only audit table protected by a database trigger and a read-only viewer for setting create/update events. Audit snapshots omit setting values and secrets.
- Added tests for migration validation, settings/permissions authorization, secret encryption/masking, and audit redaction.
- Local startup applied the migration and `/healthz` returned `ok`; `npm.cmd test` passed 97 tests after the menu manifest and encryption-key identifier hardening.

Still incomplete or blocked:

- The audit viewer covers settings changes only; important mutations in existing product/order/team/finance APIs are not yet routed through a central audit writer.
- Role assignment/editing remains disabled until the original V2 role matrix and self-demotion/last-super-admin rules are supplied.
- Secret-read, multi-key rotation, key recovery verification, retention configuration, and dry-run pruning are not implemented.
- The V2 child-menu annex and MGS-to-B0–B9 mapping remain unavailable; the full V3 module tree is not implemented.
- PostgreSQL versus MySQL/MariaDB and all D1–D12 business decisions remain unresolved. No production migration, data reconciliation, or deployment was performed.

## 13. Current implementation and decision status addendum — 2026-10-12

Sections 1 and 3 above record the original B0-only state and are historical. Since that pass, the owner authorized safe local B1 foundation work and admin sidebar UI on `feature/admin-v2`; B1 is now **partially implemented**, not wholly blocked. This work did not access production.

- The current local changes include PostgreSQL schema-migration tracking, additive settings/permission/audit foundations, and the requested Shop Admin and Platform/Super Admin sidebar UI.
- The settings viewer currently audits settings changes only. General audit coverage, role assignment/editing, secret rotation/recovery, retention/pruning, and complete V3 modules are not implemented.
- `npm.cmd test` passes **99/99**. Two Chromium sidebar component tests pass using mocked identity/permission data; they do not prove real authenticated admin authorization.
- D1–D12, the approved MGS and V2 annex, and PostgreSQL-versus-MySQL authority remain unresolved. Existing behavior is evidence, not a substitute for those decisions.
- No production database connection, migration, data reconciliation, financial transaction, shipment, or deployment was performed.

Current handoff: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), [TEST_REPORT.md](./TEST_REPORT.md), [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md). Production status remains **NO-GO**.
