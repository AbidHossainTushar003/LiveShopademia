# Android administrator API readiness and contract

**Status:** local backend contract preparation only. This is not a deployment or production-readiness approval. PostgreSQL remains the only authoritative database; Android must call this Express API over HTTPS remotely and must never connect to PostgreSQL directly.

## Base URL and Android configuration

The deployed API base URL intended by the current domain plan is:

```text
https://api.shopademia.store/api/v1/
```

That hostname is a target configuration, not evidence of a deployed API. Host routing, TLS, DNS, and release gates remain unverified and unchanged. The Express application currently serves its API and browser surfaces from the same process; a reverse proxy must route the API hostname to this application before the remote URL can be used.

The verified local preview listens only on `127.0.0.1:3002`. A standard Android Emulator's `10.0.2.2` host alias will not reach a service bound only to host loopback. For a connected emulator/device with Android Debug Bridge, forward the device's loopback port without widening the server bind:

```powershell
adb reverse tcp:3002 tcp:3002
```

Then use this **development-only** Android setting:

```kotlin
const val API_BASE_URL = "http://127.0.0.1:3002/api/v1/"
```

The ADB forwarding path and Android cleartext policy have not been device-tested. Do not use the local HTTP URL outside this isolated preview. For remote builds, configure `https://api.shopademia.store/api/v1/` only after the API hostname, HTTPS termination, routing, and release approvals are independently verified.

## Authentication and common transport rules

- Native clients use `Authorization: Bearer <token>` on protected requests. They should not use the browser cookie or persist cookies.
- Call `POST /admin/login` without an `Origin` header. A successful shop-admin login returns `{ "token": "...", "expiresIn": 28800 }`; it also emits the existing browser cookie, which a native client should ignore. If an `Origin` header is present, the token is intentionally omitted.
- Platform administrators in production must complete the existing TOTP enrollment/challenge flow. The MFA enrollment response can also contain a bearer token when called without `Origin`.
- Tokens are HS256, issuer `shopademia`, and expire after 8 hours. Every protected request checks the server-side `admin_sessions` record, expiration/revocation, session version, account, selected shop membership, and shop status. Logout revokes only the presented session; password and membership/role changes revoke affected sessions.
- Send `X-Shop-Id: <UUID>` only when selecting a shop different from the token's default. The server checks membership on every request; a client-supplied shop ID is never authorization. Platform administrators must select a shop for shop-scoped resources.
- Browser sessions remain `HttpOnly`, `SameSite=Strict` cookies and unsafe cookie-authenticated admin requests retain the same-origin `Origin` check. Bearer authorization is separate and does not make CORS an authentication mechanism. No broad CORS policy was added.
- The server generates `X-Request-Id` for every response and uses the same ID in admin audit records where audit metadata is captured. Client-supplied request IDs are not trusted.
- JSON request bodies are limited to 32 KiB. Validation/business errors use `{ "error": "..." }`; successful resource responses commonly use `{ "data": ... }`. This existing API is not yet a uniform OpenAPI contract: some responses use additional top-level fields, and some legacy endpoints have distinct pagination/envelope shapes. Clients must model the documented endpoint-specific response rather than assume a universal envelope.
- Malformed JSON returns 400, oversized JSON returns 413, invalid input returns 400, unauthenticated requests return 401, insufficient permission returns 403, missing or out-of-scope resources generally return 404, conflicting business transitions return 409, and rate limits return 429. Unexpected server errors return a generic 500 response; logs contain error name/code only, not request secrets.

### Authorization labels in the inventory

`Public` means no admin session is required. `Any shop member` means an authenticated non-platform account with active membership in the selected shop. `Shop owner/admin` means membership role `owner` or `admin`. `Platform admin` requires the platform-admin identity; some settings/audit routes additionally require the named registered permission. Platform-only management routes are not part of the Android shop-admin MVP.

Paths in the Android-facing table are relative to the `/api/v1/` base URL.

Shop dashboard, order, and product routes reject platform-administrator identities, even when a platform administrator has selected a shop. Shop category/product mutations require the `owner` or `admin` membership role; read-only products, dashboard, and order routes accept any active shop membership, including `staff`.

## Implemented Android-facing contract

| Method and path | Authentication / permission | Request shape and validation | Response shape and current coverage |
|---|---|---|---|
| `POST /admin/login` | Public; rate-limited | JSON `{email,password,totpCode?}`; valid account password, plus TOTP for production platform admins | `{token,expiresIn}` only without `Origin`; browser cookie also set. Invalid credentials 401. Mock API tests cover login, MFA, throttling, and token use. |
| `POST /admin/mfa/enroll` | Short-lived signed setup token in body; rate-limited | `{setupToken,totpCode}`; TOTP must be current and unused | `{token,expiresIn}` without `Origin`; invalid/expired challenge 401, invalid code 400. Mock API tests cover enrollment and replay rejection. |
| `GET /admin/profile` | Any valid bearer/session | No body | `{data:{email,shopId,role,isPlatformAdmin}}`; mock tests cover active, expired, revoked, and removed-membership sessions. |
| `POST /admin/logout` | Any valid bearer/session | No body | `204` with no body; current token is revoked. Mock tests verify another session remains valid. |
| `PATCH /admin/profile/password` | Any valid bearer/session | `{currentPassword,newPassword}`; new password 12–1024 chars and different from old | `{data:{email,sessionInvalidated:true}}`; password changes revoke the user's sessions. Mock API tests cover validation, races, and revocation. |
| `GET /admin/dashboard` | Any active shop member except platform admins | No body | `{data:{orders:{total,byStatus},products:{total,available,outOfStock,stockUnits},generatedAt}}`; actual shop-scoped PostgreSQL aggregates. New mock API regression test; no live dashboard integration test yet. `stockUnits` may be serialized as a decimal string by PostgreSQL. |
| `GET /admin/products` | Any active shop member except platform admins (read-only) | Legacy call with no pagination parameters remains unbounded for browser compatibility. Android should send `limit` (1–100, default 50) and `offset` (0–99,999,999, default 0); malformed values return 400. | Without pagination: `{data:[Product]}`. With either pagination parameter: `{data:[Product],pagination:{limit,offset,total,hasMore}}`. New mock tests cover pagination and invalid limits; existing tests cover shop-scoped product access. |
| `GET /admin/products/:id` | Any active shop member except platform admins (read-only) | Managed product ID | New `{data:Product}` endpoint; query scopes by product ID and selected `shop_id`; missing/out-of-scope product 404. Mock CRUD test covers detail and out-of-scope behavior. |
| `POST /admin/products` | Shop owner/admin | `multipart/form-data`: `name` (2–120), `description` (≤2000), `price` (positive whole BDT string), `oldPrice?` (whole BDT greater than price), `category`, `stockQuantity` (non-negative whole-number string), `isAvailable` (`true`/`false`), optional `imageAlt`, `seoTitle`, `metaDescription`; one or more JPEG/PNG/WebP image files, up to 10 | `201 {data:Product}`. Signature-checked images, per-file size up to 5 MiB; invalid files/fields 400, upload limits 413/400. Mock API tests cover CRUD and spoofed/truncated uploads. |
| `PUT /admin/products/:id` | Shop owner/admin | Same multipart fields; image optional, up to 10 replacements | `{data:Product}` and optional cleanup `warning`. Product lookup/update is shop-scoped. Mock tests cover update and replacement. |
| `DELETE /admin/products/:id` | Shop owner/admin | No body | `204` on success; scoped missing product 404. Mock tests cover removal and scoped access. |
| `GET /admin/shop/categories` | Shop owner/admin | No body | `{data:[{id,name,icon,active,isDefault,productCount}]}`. Mock tests cover category management. |
| `POST /admin/shop/categories` | Shop owner/admin | `{name}`; 2–60 characters, normalized to a category slug | `201 {data:Category}`; duplicate 409. |
| `PATCH /admin/shop/categories/:id` | Shop owner/admin | `{name}`; 2–60 characters | `{data:Category}`; unknown/inactive category 404, duplicate 409. |
| `DELETE /admin/shop/categories/:id` | Shop owner/admin | `{deleteProducts:boolean}` is required; `true` deletes category products, `false` preserves/reassigns them | `204`; category removal is transactional. Android must present an explicit destructive-action confirmation when `deleteProducts` is true. Mock tests cover both outcomes. |
| `GET /admin/orders` | Any active shop member except platform admins | `page` (1–100000, default 1), `limit` (1–100, default 20), optional `status` from `new, confirmed, processing, shipped, delivered, cancelled`; malformed page/limit or status 400 | `{data:[Order],page,limit,total}`; each order includes customer contact/address and payment details, so handle as sensitive data. Mock tests cover list, validation, scoping, status, and rollback. |
| `GET /admin/orders/:id` | Any active shop member except platform admins | Numeric order ID | New `{data:Order}` endpoint; query is constrained by both order ID and selected `shop_id`; missing/out-of-scope order 404. New mock API test; no live PostgreSQL integration test yet. |
| `GET /admin/orders/:id/activity` | Any active shop member except platform admins | Numeric order ID | `{data:[{id,actorEmail,action,previousValue,newValue,createdAt}]}`; empty data for an existing order with no events. Mock API tests cover status-event history. |
| `PATCH /admin/orders/:id/status` | Any active shop member except platform admins | `{status}`; accepted values are the order lifecycle below | `{data:{id,orderNumber,status}}`; invalid status 400, forbidden transition 409, missing/out-of-scope order 404. Uses a database transaction and row lock; inventory changes and audit activity share the transaction. Mock tests cover transition failures and rollback; concurrency/database behavior is not verified by a live integration test. |
| `PATCH /admin/orders/:id/advance-payment` | Any active shop member except platform admins | `{status:"verified"|"rejected"}` | `{data:...}`; records verification separately from fulfilment status. Mock tests cover valid/invalid verification. |

Order status transitions are server-defined: `new → confirmed|cancelled`, `confirmed → processing|cancelled`, `processing → shipped|cancelled`, `shipped → delivered`, `delivered` has no outgoing transition, and `cancelled → new`. Repeating the current state is allowed. Never send client-calculated prices or totals as authoritative values.

`Product` responses include `id`, `name`, `description`, `price`, `oldPrice`, category, image URLs, `stockQuantity`, `isAvailable`, and timestamps/SEO fields where selected. Price and inventory changes are manager-only; checkout prices are computed from the server catalog.

## Complete route inventory (observed in source)

This table covers the Express route surface currently registered in `server/app.js` and `server/platform.js`. The route handlers are the source of truth; request schemas for several platform-management operations have not yet been centralized into a formal schema/OpenAPI definition. Those surfaces should not be represented in Android as a stable product contract without a follow-up schema review.

| Method and path | Authentication / permission | Request and response schema summary | Existing test evidence |
|---|---|---|---|
| `GET /healthz` | Public | No body; `{status:"ok"}` or 503 `{status:"unavailable"}`. | Supertest readiness and failure-redaction tests; mocked pool. |
| `GET /api/v1/products`, `GET /api/v1/products/hero-offer`, `GET /api/v1/categories` | Public, rate-limited | Optional featured/newest query on products; `{data:[Product]}` or `{data:Product|null}`. | Mocked catalog/product tests and browser-shell checks; route-by-route live DB coverage absent. |
| `GET /api/v1/shops`, `GET /api/v1/shops/:slug`, `GET /api/v1/shops/:slug/products`, `GET /api/v1/shops/:slug/categories`, `GET /api/v1/shops/:slug/products/hero-offer`, `GET /api/v1/shops/:slug/config`, `GET /api/v1/shops/:slug/offers` | Public; catalog routes rate-limited | Shop profile/config or `{data:[...]}`; slug is resolved against active shops. Unknown/inactive shop 404. | Mocked public shop directory/catalog and page-shell tests; config/offers lack separate direct integration tests. |
| `GET /api/v1/public/shops/:slug/products` | Public, rate-limited | Optional `limit` (1–100), `offset`, `category`; `{shop,data,pagination}`. Cross-origin read access is deliberately limited to this public catalog route. | Supertest mock tests cover scoping, pagination, and public product fields. |
| `GET /api/v1/storefront-config` | Public, rate-limited | No body; `{data:...}` public storefront configuration. | No direct route test identified; storefront shell is mocked. |
| `GET /api/v1/shops/:slug/push-key` | Public | No body; public push key or unavailable result. | No direct route test identified. |
| `POST /api/v1/shops/:slug/push-subscriptions` | Public, rate-limited | Push subscription `{endpoint,keys:{p256dh,auth}}`, endpoint HTTPS and host-allowlisted; success `{data:...}`, validation 400/limit 429. | Supertest mock covers per-shop subscription cap; not real push delivery. |
| `GET /api/v1/shops/:slug/push-subscriptions` | Public, rate-limited | Subscription lookup data, validated endpoint input. | No direct route test identified. |
| `DELETE /api/v1/shops/:slug/push-subscriptions` | Public, rate-limited | Endpoint removal request; no customer/admin credential. | No direct route test identified. |
| `POST /api/v1/orders` | Public, rate-limited | `{customer:{name,phone,address},payment:{method:"bkash",bkashNumber},items:[{productId,quantity}],eventId,source:"storefront",shopId?}`. Server reprices and reserves stock transactionally; `201 {data:{orderNumber,subtotal,advanceAmount,due}}`; bad input 400, inventory conflict 409. | Supertest fake-pool tests cover validation, pricing, idempotency, and rollback; no real concurrent PostgreSQL test. |
| `POST /api/v1/customer/order-lookup` | Public, rate-limited | `{orderNumber,phone}`; returns only customer-safe order fields under `{data:...}`; invalid input 400 and unmatched details 404. | Supertest mock tests cover success, privacy, validation, and rate limits. |
| `POST /api/v1/admin/login`, `POST /api/v1/admin/mfa/enroll`, `GET /api/v1/admin/profile`, `POST /api/v1/admin/logout`, `PATCH /api/v1/admin/profile/password` | As listed in Android contract | Authentication/session routes; login and MFA routes are rate-limited. | Supertest mocks cover bearer/cookie login, MFA, expiry/revocation, logout, password/session changes, and browser CSRF. |
| `GET /api/v1/admin/dashboard`, `GET/POST /api/v1/admin/products`, `GET/PUT/DELETE /api/v1/admin/products/:id`, `GET/POST/PATCH/DELETE /api/v1/admin/shop/categories`, `GET /api/v1/admin/orders`, `GET /api/v1/admin/orders/:id`, `GET /api/v1/admin/orders/:id/activity`, `PATCH /api/v1/admin/orders/:id/status`, `PATCH /api/v1/admin/orders/:id/advance-payment` | As listed in Android contract | Core shop operations. `POST`/`PUT` products are multipart; category delete requires an explicit product-deletion boolean; order operations are shop-scoped. | Supertest mocks cover CRUD, scoping, upload validation, session access, status transitions, validation, and rollback; new dashboard/detail/pagination tests are mocked, not live DB integration. |
| `GET /api/v1/admin/shops` | Any authenticated admin | Platform admins receive the shop list; other accounts receive only active memberships; `{data:[Shop]}`. | Multi-shop membership tests use mock pools; no direct shop-list test identified. |
| `POST /api/v1/admin/shops`, `PATCH /api/v1/admin/shops/:shopId/status`, `DELETE /api/v1/admin/shops/:shopId` | Platform admin | Create shop `{name,slug,advanceCharge?}`; status `{status:"active"|"suspended"}`; delete archives rather than hard-deletes. Responses `{data:Shop}`, invalid input 400, conflicts 409. Not Android shop-admin operations. | Create/status/archive routes lack individual direct tests in the current API suite. |
| `PATCH /api/v1/admin/shops/settings` | Platform admin with selected shop | `{name,advanceCharge}`; `{data:Shop}`. | No direct route test identified. |
| `GET /api/v1/admin/shop/members` | Shop owner/admin or platform admin with selected shop | `{data:[{id,email,role,joinedAt}]}`. | Role/removal and membership scoping tests use mock pools; direct member-list test not identified. |
| `POST /api/v1/admin/shop/members`, `PATCH /api/v1/admin/shop/members/:userId`, `DELETE /api/v1/admin/shop/members/:userId` | Shop owner/admin or platform admin with selected shop | Add `{email,role,password?}`; change `{role}`; delete by UUID. Shop admins may assign only `staff`; member role changes/removal revoke sessions. | Role change/removal and session invalidation tests; add/list flows lack full direct coverage. |
| `GET /api/v1/admin/shop/profile`, `PATCH /api/v1/admin/shop/profile` | Shop owner/admin or platform admin with selected shop | Read `{data:ShopProfile}`; update name/description/location/contact fields and optional multipart `logo`/`removeLogo`. | Mock test covers profile update validation; read path not separately tested. |
| `POST /api/v1/admin/shop/branding` | Platform admin with selected shop | Multipart `kind:"hero"|"banner"` plus one JPEG/PNG/WebP `image`; `{data:{kind,image}}`. | Supertest mock covers successful branding upload and activity record. |
| `GET /api/v1/admin/shop/hero-slides` | Platform admin with selected shop | `{data:[HeroSlide]}`. | Slide create/edit/reorder/delete test exists; list is exercised as part of mock flow. |
| `POST /api/v1/admin/shop/hero-slides`, `PUT /api/v1/admin/shop/hero-slides/:id`, `POST /api/v1/admin/shop/hero-slides/order`, `DELETE /api/v1/admin/shop/hero-slides/:id` | Platform admin with selected shop | Multipart images plus headline/body/button/target fields; max five slides. Reordering accepts `{ids:[...]}`. Strict URL/image checks. | Supertest mock covers create/edit/reorder/delete and slide cap. |
| `GET /api/v1/admin/shop/transactions` | Platform admin with selected shop | `page`,`limit`; `{data:[Transaction],page,limit,total}`. Current pagination parsing is permissive/clamped, unlike the new core mobile contract. | No direct route test identified. |
| `POST /api/v1/admin/shop/transactions`, `PATCH /api/v1/admin/shop/transactions/:id/status` | Platform admin with selected shop | Record `{type,method,amount,reference,status?,notes?,orderId?}`; update `{status:"pending"|"verified"|"rejected"}`. Transaction and order ownership are checked; `{data:Transaction}`, invalid 400/conflict 409. | Mock tests cover duplicate transaction references and order ownership conflict; full lifecycle coverage is missing. |
| `GET /api/v1/admin/shop/reports`, `GET /api/v1/admin/shop/activity`, `GET /api/v1/admin/shop/offers` | Platform admin with selected shop | Reports accepts `days` (default 30, clamped 1–365); activity accepts `limit`; returns shop-scoped aggregates/activity/offers. These are not the shop-admin dashboard APIs. | No direct route tests identified for reports/activity/offer listing. |
| `POST /api/v1/admin/shop/offers`, `PATCH /api/v1/admin/shop/offers/:id` | Platform admin with selected shop | Create `{title,message,startsAt?,endsAt?,isPublished?}`; update `{isPublished}`. Publishing may send push notifications when configured. | No direct route tests identified; notification delivery is not covered. |
| `GET /api/v1/admin/permissions` | Platform admin with registered `permissions.read` | `{data:[{roleKey,roleName,mappingStatus,permissionKey,description,granted}]}`. | Mock tests cover permitted reads and shop-user denial. |
| `GET /api/v1/admin/settings`, `PUT /api/v1/admin/settings/:settingGroup/:settingKey` | Platform admin with registered `settings.read` / `settings.write`; secret writes additionally require `secrets.write` | Read `{data:[Setting]}` with secret values masked. Write `{value,isSecret}`; encrypted secret writes require configured key, audit entries omit secret values. | Mock tests cover encrypt/mask/audit and unauthorized shop-user access. |
| `GET /api/v1/admin/audit` | Platform admin with registered `audit.read` | Optional `limit` (clamped 1–100); `{data:[AuditEvent]}`. | Mock tests verify secret values are absent from audit views; no real audit-database integration test. |

## Security and readiness findings

**Already implemented and retained:** server-side bearer/cookie session validation and revocation; per-request account/shop membership checks; role and registered-permission gates; same-origin protection for browser cookie writes; login/order/upload rate limits; scoped product/order/transaction SQL; parameterized queries; product image MIME/signature/size limits; checkout-side authoritative pricing and inventory validation; transactional stock/order transition operations with row locking; safe generic unexpected-error responses.

**Implemented for this preparation:** one server-generated request ID per response; audit events reuse that request ID; a shop-scoped dashboard aggregate; shop-scoped order detail; opt-in bounded product pagination that preserves the legacy unpaged browser response; strict page/limit validation for the existing order list; bearer login/profile/logout and the new response shapes receive API regression coverage.

**Gaps / gates:** there is no checked-in OpenAPI/JSON Schema document or shared runtime schema layer; response envelopes and pagination rules are not globally uniform; some platform pagination/query parsing remains permissive; native login returns a bearer token only when the client omits `Origin`; the newly added dashboard/detail behavior and query plans are mock-tested, not verified by live PostgreSQL integration; broader concurrency/transaction tests use a fake pool, not a concurrent database; the ADB reverse route is not Android-device tested; the public API hostname/reverse-proxy/HTTPS configuration is not verified. No mobile authentication, push, or platform-management behavior should be claimed as production-ready from this work.

Do not duplicate business logic or store authoritative prices, stock, permissions, or order totals in Android. Android is a client of this server and PostgreSQL remains behind it.

## Minimal follow-up implementation plan

1. Freeze the Android-used routes into an OpenAPI 3.1 contract and shared request/response schemas, including auth errors, pagination, numeric-string serialization, and multipart uploads; preserve existing browser response compatibility.
2. Expand role-matrix and malformed-input tests for every mobile-used operation, then run the same contract suite against an isolated PostgreSQL integration database.
3. Add real-database integration coverage for shop IDOR isolation, dashboard aggregates, order transitions, rollback, inventory contention, and session revocation.
4. Verify login/MFA, secure token storage, logout, upload, and the `adb reverse` base URL from an Android emulator without weakening loopback binding or browser CSRF.
5. Independently configure and verify HTTPS/reverse-proxy routing for the API hostname before providing the remote base URL to a release build.

## Local preview verification snapshot

Read-only checks on 2026-10-13 confirmed PostgreSQL 16.15 is accepting connections on `127.0.0.1:55441`; the protected local environment file is present with access limited to the current Windows account and SYSTEM. Using that configuration without printing its values, a read-only transaction verified database `shopademia_browser_preview`, role `shopademia_browser_preview`, server address `127.0.0.1`, port `55441`, `SELECT 1`, one managed product, zero orders, one administrator account, zero MFA-enabled administrators, and zero active administrator sessions. The Node listener had an established TCP connection to that PostgreSQL listener, and PostgreSQL activity matched the Node process's local socket to the expected database and role.

The application listener is loopback-only on `127.0.0.1:3002`, but the currently running process is stale relative to this source: it started at 22:43 local time, before the edited `server/app.js` timestamp at 23:02. Live read-only HTTP results were:

| Request | Status | Observed result |
|---|---:|---|
| `GET /healthz` | 200 | `{"status":"ok"}` |
| `GET /api/v1/products` | 200 | One product returned. |
| `GET /api/v1/admin/dashboard` | 404 | Route is absent from the running process. |
| `GET /api/v1/admin/products` | 401 | Unauthenticated request rejected. |
| `GET /api/v1/admin/products/:id` (synthetic product ID) | 404 | Route is absent from the running process. |
| `GET /api/v1/admin/products?limit=1&offset=0` | 401 | Unauthenticated request rejected; pagination behavior was not reached. |
| `GET /api/v1/admin/orders` | 401 | Unauthenticated request rejected. |
| `GET /api/v1/admin/orders/1` | 404 | Route is absent from the running process. |

None of these live responses included `X-Request-Id`. The catalog/browser legacy surface is still serving, but dashboard, detail, live pagination, request-ID correlation, and authenticated role/shop-isolation behavior from the edited source have **not** been verified against the running application. No synthetic admin login was attempted: there are zero active sessions, and login would create a session row. No new endpoint request was made with an administrator token.

The app was not restarted during that earlier verification: normal non-production startup calls `initializeDatabase`, which executes schema/migration statements and bootstrap writes before listening. The old 404/401 results above are a historical snapshot of the stale process, not results from the updated process.

### Safe local preview startup gate

Source inspection found no existing read-only startup option. Normal `initializeDatabase` performs DDL and index/constraint changes; inserts schema migration bookkeeping, the configured administrator credential (insert-only on conflict), the default shop/categories and platform administrator; removes memberships for platform administrators; revokes their active sessions; backfills null product/order shop IDs; and calls migrations that create tables, constraints, indexes, triggers, seed role/permission rows, and migration checksums inside transactions. `server/index.js` also creates the uploads directory before connecting. `server/migrate.js` is not a read-only alternative; it calls the same initializer.

The opt-in `SHOPADEMIA_READ_ONLY_PREVIEW=1` path was added for local verification. It is hard-restricted to development mode, `127.0.0.1:3002`, the `shopademia_browser_preview` role/database on `127.0.0.1:55441`, no TLS, and no trusted proxy hops. It requires the existing uploads directory rather than creating it; skips `initializeDatabase` and administrator bootstrap; opens connections with PostgreSQL `default_transaction_read_only=on`; and fails startup unless read-only target identity, migration checksums, and the required admin API columns match. App-level gating admits only GET/HEAD requests to `/healthz`, `/api/v1/products`, and the dashboard, product-list/detail, and order-list/detail API routes. Authentication and all route authorization remain unchanged; unsafe methods return 405, and other paths are not served in this mode. Its unit tests verify the target/schema gates, write-method rejection, auth retention, and SELECT-only fake-pool behavior.

This mode does not provide a way to mint or bypass an administrator session. Live authenticated dashboard/product/order responses, role-denial, and tenant-isolation checks remain blocked unless an already-authorized session exists; none is to be fabricated or created for this read-only verification. The results of any run using this mode are recorded separately below.

### Latest safe preview run

The updated process was started with the read-only mode after the database identity, PostgreSQL 16.15 version, expected migration checksums, required columns, and nonsuperuser application role were verified through SELECT-only connections. It listened only on `127.0.0.1:3002`, held an established connection to PostgreSQL on `127.0.0.1:55441`, loaded the existing single managed product, and returned a database-backed health response. Read-only inventory remained one product, zero orders, one administrator, and zero unrevoked, unexpired administrator sessions.

| Endpoint/control | HTTP result | Authentication | Expected and observed | Evidence and status |
|---|---:|---|---|---|
| Read-only startup and target identity | Listening | Protected local config; no HTTP auth | Exact preview database/schema verified; initializer/bootstrap skipped; connection default is read-only; role is not a superuser; both services remain loopback-bound. | Live startup and SELECT-only PostgreSQL checks — **PASS** |
| `GET /healthz` | 200 | None | Expected healthy response; observed `{"status":"ok"}` and a UUID `X-Request-Id`. | Live updated process; database-backed — **PASS** |
| `GET /api/v1/products` | 200 | None | Expected legacy `{data:[...]}` catalog contract; observed one product with the existing product fields. | Live updated process, actual preview catalog — **PASS** |
| `GET /api/v1/admin/dashboard` | 401 | None (anonymous) | Expected rejection without an admin session; observed 401 and a UUID `X-Request-Id`. Dashboard SQL did not run. | Live updated process — anonymous-auth control **PASS**; authenticated result **BLOCKED** |
| `GET /api/v1/admin/products` | 401 | None (anonymous) | Expected rejection without an admin session; observed 401 and a UUID request ID. Product query did not run. | Live updated process — anonymous-auth control **PASS**; authenticated result **BLOCKED** |
| `GET /api/v1/admin/products?limit=0&offset=0` | 401 | None (anonymous) | Authentication ran before pagination validation, so the expected validation response was not reached. | Live updated process — auth control **PASS**; live pagination validation **NOT TESTED** |
| `GET /api/v1/admin/products/:id` using the existing product ID | 401 | None (anonymous) | Expected auth rejection; observed 401 and request ID. The detail query did not run; no product detail result is claimed. | Live updated process — auth control **PASS**; authenticated detail **BLOCKED** |
| `GET /api/v1/admin/orders` | 401 | None (anonymous) | Expected rejection without an admin session; observed 401 and request ID. Order query did not run. | Live updated process — auth control **PASS**; authenticated listing **BLOCKED** |
| `GET /api/v1/admin/orders?page=0&limit=101` | 401 | None (anonymous) | Authentication ran before pagination validation; no live validation result is claimed. | Live updated process — auth control **PASS**; live pagination validation **NOT TESTED** |
| `GET /api/v1/admin/orders/1` | 401 | None (anonymous) | Expected auth rejection; observed 401 and request ID. The order lookup did not run, so this does not establish whether order 1 exists. The read-only inventory contained zero orders. | Live updated process — auth control **PASS**; authenticated detail **BLOCKED** |
| `POST /api/v1/orders` | 405 | None | Read-only preview rejected the write method before route execution; a UUID request ID was returned. | Live updated process — write gate **PASS** |
| Request-ID correlation to admin audit metadata | N/A | Mock tests only | Mock tests verify that audit metadata reuses the request ID. No authenticated audit event was generated in this read-only run. | Mocked **PASS**; live audit correlation **NOT TESTED** |
| Role denial and cross-shop isolation | N/A | Mock tests only | Existing fake-pool tests exercise bearer-session, role, and shop-scope controls; no live session or cross-shop resource request was available. | Mocked **PASS**; live verification **BLOCKED** |

Every live API response listed above carried a server-generated UUID request ID. The current local Android development base URL remains `http://127.0.0.1:3002/api/v1/`; remote HTTPS routing and Android-device connectivity are not verified. No administrator login or session was created.

## Test evidence and rollout status

API tests use Supertest with fake/in-memory database pools unless a test explicitly says otherwise. They establish route behavior and business control flow, not PostgreSQL transaction isolation or a remote deployment. The local recovery smoke tests previously verified the storefront and anonymous catalog against the isolated preview; they did not authenticate the admin UI and do not constitute live tests of the new dashboard/order-detail endpoints.

For the earlier read-only-preview verification, `npm.cmd run test:api` passed **84/84** tests and `npm.cmd test` passed **130/130** tests; `git diff --check` passed. These suites are primarily mocked/unit tests. The SELECT-only database identity/schema/inventory checks and anonymous HTTP statuses in the preview table above are the live preview evidence; authenticated admin endpoints were not reached on that preview. The later authorized disposable live results are recorded below.

Staging remains **BLOCKED / NOT READY**. Production remains **NO-GO**. No DNS, deployment, staging, production, commit, or push operation is authorized by this document.

## Authenticated verification and Android client readiness

The read-only-preview inventory and results in the first part of this section are a historical snapshot for `127.0.0.1:3002` only. They remain accurate for that read-only preview, but do not describe the later disposable authenticated integration run documented below.

### Authentication implementation and read-only preview evidence

The supported native mechanism is a bearer token returned by `POST /api/v1/admin/login` when the client omits an `Origin` header. The response also sets the browser cookie; native clients should ignore it. Tokens are HS256, issued for eight hours, and every protected request checks the corresponding active database session, account/session version, shop membership, and shop status. Shop-admin login verifies the password and active membership, cleans expired/revoked session rows, inserts a server-side session, and records login activity. Production platform-admin login additionally consumes the TOTP counter with an UPDATE; enrollment changes MFA state and creates a session. `POST /api/v1/admin/logout` revokes the current session and records activity. Browser cookie security and CSRF checks remain separate and unchanged.

At the time of the read-only preview verification, its inventory was one admin account, zero MFA-enabled accounts, zero active sessions, one managed product, and zero orders. No legitimate pre-existing bearer session was available there. Repository search found no supported pre-authorized live test-session fixture. The historical `shopademia_test` integration run in `docs/TEST_REPORT.md` used a different disposable database with synthetic credentials; those temporary resources were removed and are not usable as credentials or a session for this preview.

In read-only mode, login, MFA enrollment, and logout are rejected with 405 before their handlers. This is intentional: the operations write session, MFA, cleanup, or audit state. No credentials were submitted, no session was minted or fabricated, and PostgreSQL read-only protections were not relaxed on the preview. At the time of that verification, authenticated checks required separate authorization for an isolated disposable database/cluster and synthetic fixtures; that authorization was subsequently granted and exercised as detailed below.

| Control / endpoint | Mocked evidence | Live result on current isolated preview | Status |
|---|---|---|---|
| Admin login and bearer issuance | API tests exercise password verification and session/token issuance against a fake pool. | Not attempted; login requires session cleanup/creation and activity writes; preview rejects POST with 405. | Mock **PASS**; live auth **BLOCKED** |
| Platform MFA/TOTP | API tests cover setup/challenge and replay rejection. | No MFA-enabled account; write route is blocked; production MFA behavior not exercised. | Mock **PASS**; live **NOT TESTED** |
| Session expiry/revocation and membership/role enforcement | Mock tests cover valid, expired/revoked, and changed/removed-membership behavior. | Zero active sessions; no authorized token available to reach the authenticated query path. | Mock **PASS**; live valid-session path **BLOCKED** |
| `GET /admin/dashboard`, `/admin/products`, `/admin/products/:id`, `/admin/orders`, `/admin/orders/:id` | Route, scope, and response behavior covered by fake-pool tests. | Anonymous requests return 401 (with server request IDs); handlers and data queries were not reached. | Anonymous gate **PASS**; authenticated resource behavior **BLOCKED** |
| Product/order pagination validation | Mock tests cover boundaries and malformed values. | Invalid product and order pagination requests returned 401 before route validation. | Mock **PASS**; live validation **NOT TESTED** |
| `POST /admin/logout` and session revocation | Mock test verifies the current session is revoked without revoking another. | Not attempted; requires a legitimate session and performs DB writes; preview rejects POST with 405. | Mock **PASS**; live **BLOCKED** |
| Request ID and admin-audit correlation | Mock tests confirm audit metadata reuses the generated request ID. | UUID response IDs observed; no authenticated audit event was created/read. | Header **PASS** live; audit persistence **NOT TESTED** |
| Role restriction / cross-shop isolation | Fake-pool tests cover role and shop-scoped access. | No authenticated cross-shop requests or synthetic records were available. | Mock **PASS**; live **BLOCKED** |
| Health and public product responses | Unit/API tests pass. | Health 200; public products 200 with one existing product. | **PASS** live, updated process |
| Unsafe methods in preview | Safe-mode unit test verifies rejection. | Login and order POST return 405 before route handling. | **PASS** live |

### Kotlin client configuration requirements (not an implemented or device-tested client)

- **Emulator/physical device:** API base URL after ADB reverse is `http://127.0.0.1:3002/api/v1/`; run `adb reverse tcp:3002 tcp:3002` without changing the host listener binding. A standard emulator's `10.0.2.2` alias does not reach a host service bound only to `127.0.0.1`. ADB forwarding and Android cleartext policy are **NOT TESTED**. Do not use local HTTP remotely.
- **Remote:** intended base URL is `https://api.shopademia.store/api/v1/`, but DNS, TLS, proxy routing, and remote connectivity are **NOT TESTED**. Configure it only after those release checks pass.
- **Token safety:** omit `Origin` to receive the native bearer token, send it in the Authorization header, and store it only using Android Keystore-backed protected storage. Never put database credentials, JWT signing secrets, or other server secrets in the app; never log bearer tokens. Clear client token state on logout or 401 and require sign-in again because server-side session validity is checked per request. Android token-storage/login implementation is **NOT TESTED**.
- **Models and errors:** parse endpoint-specific `{data: ...}` and pagination shapes rather than assuming a uniform envelope. Handle PostgreSQL numeric values serialized as decimal strings where applicable (for example dashboard stock-unit totals). Map `{error: string}` with 400/401/403/404/409/413/429/500 to validation, sign-in/session-expired, forbidden, not-found/out-of-scope, conflict, upload-size, throttling, and generic server-error states. Treat loading, empty data, network failure, expired auth, forbidden, and missing resource as distinct UI states. Retain `X-Request-Id` only as safe diagnostic context; do not log credentials or tokens.
- **Pagination:** product lists accept `limit` 1–100 and zero-based `offset`; order lists accept one-based `page` 1–100000 and `limit` 1–100 with an optional validated status. The legacy unpaged product response remains for browser compatibility.
- **Logout:** native logout is a POST with the bearer token, returns 204, and revokes the current database session. It cannot be tested against this read-only preview; it requires an authorized isolated write-enabled integration environment.

**Integration decision:** authenticated Android-admin verification is **BLOCKED**, not passed on the basis of mocked tests. No login, logout, session creation, MFA change, product/order write, migration, schema change, or other database write occurred during this verification. Staging remains **BLOCKED / NOT READY** and production remains **NO-GO**.

### Authorized disposable authenticated integration run

The user subsequently authorized a separate disposable environment. The live run used PostgreSQL 16.15 at `127.0.0.1:55442`, database `shopademia_android_it_20261014`, application role `shopademia_android_it_app`, and the application at `127.0.0.1:3003`. The cluster data directory and all test-only configuration were under `%LOCALAPPDATA%\Shopademia\android-admin-it-20261014`. This is distinct from the existing preview (`127.0.0.1:55441`, `shopademia_browser_preview`) and PostgreSQL 17 (`5432`).

Before initializing application schema, the new cluster's server-reported database, role, address, port, data-directory path, and `pg_hba.conf` path were checked. Its five SCRAM/reject rules allowed only the bootstrap account to the bootstrap/test databases and the nonsuperuser app role to the test database from `127.0.0.1/32`; catch-all IPv4 and IPv6 rules rejected other connections. The bootstrap role could not connect to another database through those rules. The app role was verified `NOSUPERUSER`, `NOCREATEDB`, and `NOCREATEROLE`, and could connect only to its application database. The process listened only on `127.0.0.1`. Secrets were generated uniquely for this test and held under user/SYSTEM-only Windows ACLs; no preview or production secret was reused or printed.

The test database was initialized using the project's real `initializeDatabase` and migrations. Synthetic data consisted of two shops, a platform administrator, a shop owner, a shop staff member, one product and one order per shop, and one non-secret platform setting used to correlate audit metadata. Order customer fields were synthetic placeholders, not real customer data. A production-mode app process enabled the actual platform-admin MFA requirement. No payment, notification, upload, or customer communication was initiated.

| Actual live request/control | HTTP | Authentication and verified result |
|---|---:|---|
| `GET /api/v1/admin/dashboard` (anonymous) | 401 | Anonymous access denied with JSON `{error:string}`. |
| `POST /api/v1/admin/login` (shop owner, no `Origin`) | 200 | Actual password login returned a bearer token and 8-hour expiry; profile identified the expected owner/shop. |
| `GET /api/v1/admin/dashboard` (owner) | 200 | Actual DB aggregates matched synthetic data: one `new` order, one product, seven stock units. |
| `GET /api/v1/admin/products?limit=1&offset=0` (owner) | 200 | One shop-scoped product; pagination reported `total:1`, `hasMore:false`. |
| `GET /api/v1/admin/products` (owner, legacy shape) | 200 | Existing unpaged `{data:[...]}` response remained intact without a `pagination` property. |
| `GET /api/v1/admin/products/:id` (owner's shop) | 200 | Returned the matching synthetic product and its shop ID. |
| `GET /api/v1/admin/products/:other-shop-id` (owner) | 404 | Correctly concealed the other shop's product as not found. |
| `GET /api/v1/admin/products` with `X-Shop-Id` set to non-member shop | 401 | Membership/session binding rejected the cross-shop selection. |
| `GET /api/v1/admin/products` with malformed `X-Shop-Id` | 400 | Invalid selector rejected as JSON error. |
| Product pagination: `limit=0`, `offset=100000000` | 400 each | Invalid limit and offset rejected after successful authentication. |
| Product pagination: `limit=100&offset=0` | 200 | Maximum limit boundary accepted. |
| `GET /api/v1/admin/orders?page=1&limit=1` (owner) | 200 | Returned one synthetic shop order and `total:1`. |
| `GET /api/v1/admin/orders?page=100000&limit=100` (owner) | 200 | Maximum page/limit accepted; empty page correctly returned zero rows. |
| Order pagination: `page=0`, `limit=101`, unknown `status` | 400 each | Invalid page, limit, and status rejected after authentication. |
| `GET /api/v1/admin/orders/:id` (owner's shop) | 200 | Returned the expected synthetic order. |
| `GET /api/v1/admin/orders/:other-shop-id` (owner) | 404 | Correctly concealed the other shop's order as not found. |
| `POST /api/v1/admin/login` (staff; actual password) | 200 | Issued a valid shop-member session. |
| `GET /api/v1/admin/dashboard` (staff) | 200 | Staff's configured read access was confirmed. |
| `POST /api/v1/admin/products` (staff) | 403 | Owner/admin-only product mutation was denied before upload/body processing. |
| `POST /api/v1/admin/login` (platform admin, before MFA) | 200 | Returned the required MFA enrollment challenge, not a normal session. |
| `POST /api/v1/admin/mfa/enroll` (current synthetic TOTP) | 200 | Actual enrollment stored encrypted MFA state and returned a bearer session. TOTP secret/code were handled in memory only and never logged. |
| Platform login without TOTP / with current TOTP / replayed TOTP | 401 / 200 / 401 | MFA was required; valid code authenticated; one-time counter replay was rejected. |
| `GET /api/v1/admin/profile` (platform admin after enrollment) | 200 | Verified platform-admin identity. |
| `GET /api/v1/admin/dashboard` (platform admin) | 403 | Platform identity was denied shop dashboard access. |
| `GET /api/v1/admin/permissions` (platform admin) | 200 | Returned registry including the seeded `settings.write` permission. |
| `PUT /api/v1/admin/settings/android-it/marker` then `GET /api/v1/admin/audit` | 200 / 200 | A synthetic non-secret setting was written; its audit event's persisted `requestId` exactly matched the setting-write response's server-generated `X-Request-Id`. |
| `POST /api/v1/admin/logout` then profile for owner, staff, and platform tokens | 204 then 401 for each | All three actual server-side sessions were revoked; post-logout protected requests were rejected. |
| Request-ID behavior | All 41 exercised admin API responses | Every response carried a server-generated UUID request ID, including success, validation/auth failures, and 204 logout responses. |

For reproducibility, repeat only in a newly authorized disposable root: initialize a fresh PostgreSQL 16 cluster with `initdb --auth-host=scram-sha-256 --auth-local=scram-sha-256`, bind its config to loopback and a free dedicated port, install database/user-scoped SCRAM `pg_hba.conf` allow rules followed by IPv4/IPv6 reject rules, verify server-reported cluster identity and app-role attributes, then create an app-owned test database. Generate all app, admin, JWT, and MFA values for that run and ACL-protect its config; run `initializeDatabase` against that database; seed only synthetic rows for two shops, owner/staff/platform identities, products, and orders; start `server/index.js` with `NODE_ENV=production`, `HOST=127.0.0.1`, and a separate free `PORT`; and execute the request sequence and assertions in the table above. Use no `Origin` header for native bearer login. Generate TOTP codes in memory with the project's TOTP implementation, and compare the audit row to the setting-write response request ID. Afterward confirm zero active test sessions, stop only the recorded app PID and the PostgreSQL instance using that exact `-D` data directory, and remove only that run's dedicated root. Never point this procedure at either existing PostgreSQL service.

The one-off live request harness and temporary test config were not retained in the repository; the table records actual observed responses, not a claim that a checked-in integration command exists. During this run, `npm.cmd run test:api` passed **84/84**, `npm.cmd test` passed **130/130**, and `git diff --check` passed. A read-only post-run check of the original preview still showed its prior one product, zero orders, one admin, zero active sessions. The PostgreSQL 17 service remained running with its prior listener. However, a separate identity-probe command was launched without loading the test environment and may have attempted the default local PostgreSQL endpoint on port 5432; it was terminated before returning a result. Its code was read-only (`SELECT` and `default_transaction_read_only=on`), and issued no write statement, but whether a connection completed cannot be verified. Therefore this run cannot claim zero contact with PostgreSQL 17, although no modification was made or observed.

**Cleanup status:** the test application was stopped by its exact verified PID, then the test PostgreSQL 16 cluster was shut down gracefully using `pg_ctl` with its exact verified data directory. Ports 3003 and 55442 closed; preview ports 3002 and 55441 remained bound to their original processes, and PostgreSQL 17 remained running on its original listener. The dedicated `%LOCALAPPDATA%\Shopademia\android-admin-it-20261014` root was removed after confirming its exact path and that both authorized test processes had stopped. Android emulator/device connectivity, Android token-storage implementation, uploads, order mutation/concurrency, and remote HTTPS routing remain unverified. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

## Native Android client implementation status

The first native client implementation is in [`phone app/README.md`](../phone%20app/README.md). It uses Kotlin with XML layouts, MVVM/Repository boundaries, coroutines and `StateFlow`, Retrofit/OkHttp, and manual dependency construction. Its documented API surface is limited to login, MFA enrollment, profile/session restoration, logout, dashboard, paginated product and order lists, and product/order details. It implements bearer authentication without browser cookies, profile-based role display, encrypted token persistence with Android Keystore (AES-256-GCM), typed HTTP/network error states, request-ID display for HTTP failures, and read-only screens.

**Native client verification: BLOCKED / NOT TESTED.** JVM MockWebServer and fake-repository tests have been added under `phone app/app/src/test`; Android Keystore and Espresso navigation tests have been added under `phone app/app/src/androidTest`. They are test sources only: none has been executed in this environment because no Java/JDK executable or `JAVA_HOME` is available. The Android Gradle build is therefore also **BLOCKED**, and compilation is not established. The only attached device was reported unauthorized and no authorized emulator was available, so instrumentation tests are **NOT TESTED**. The previous disposable backend's live results above are server-side HTTP integration evidence, not a native Android client test; no Android device connected to it. The disposable service has been cleaned up. Do not authenticate against the read-only port-3002 preview.

The app's configured loopback URL and ADB reverse commands are development instructions, not verified connectivity. Physical-device networking, Android emulator networking, remote HTTPS/DNS/proxy configuration, UI accessibility on real devices, and live native session/MFA/logout behavior remain **NOT TESTED**. No endpoint is claimed as live-tested by the Android app. Only the mock/fake coverage described in its test sources is currently claimed; results await a JDK 17+ and an authorized Android emulator/device. Staging remains **BLOCKED / NOT READY** and production remains **NO-GO**.
