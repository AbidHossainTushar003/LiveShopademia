# Shopademia Store — Initial Pre-launch Audit

**Phase:** 0 — baseline inspection with later authorized local verification and scoped remediation
**Audit date:** 2026-10-10 (Asia/Dhaka)
**Repository:** `MyTestProjects007/TestingWeb`, branch `main`
**Audited revision:** `b6efcaef4aeca7695cbf211e161761f7adefbc4f` (`b6efcae`)
**Working tree at audit start:** clean; `main` was synchronized with `2/main`
**Environment:** Windows development workspace; initial audit had no reachable app. A local development run is documented in Section 11; no authorized staging or production evidence was supplied.
**Recommendation:** **NO-GO**

> This is an evidence report, not a claim that the application is secure or compliant. Sections 1–10 record the initial baseline and its original scorecard. After the user separately authorized local verification and a narrowly scoped WEB-001 fix, Section 11 records that local code change and its regression evidence. No production or staging resource was changed.

## 1. Executive summary

### Verified architecture

- Node.js 20+ / Express server with PostgreSQL (`pg`), a static JavaScript storefront, and separate shop/platform admin interfaces.
- Shops share one database. Orders and managed products carry shop scope; storefront selection is primarily `?shop=<slug>`, not per-shop host routing.
- Guest checkout creates a server-priced order request, reserves managed inventory, and has an idempotency key. Payment is manual; README states there is no bKash API integration.
- Caddy is the documented TLS reverse proxy. The production Compose configuration supplies one `DOMAIN` and one `PUBLIC_SITE_URL`.
- The app performs database `CREATE`/`ALTER` statements from `initializeDatabase()` during startup.

### Principal risks and limitations

1. The supplied requirements name separate storefront and admin domains and require store-specific domains, but the committed deployment config describes one Caddy host and one public origin. The separate-host deployment requirement is not met by the inspected configuration (**TENANT-001**, P1).
2. A route can render a product title and description from the global in-memory catalog without checking that the product belongs to the `shop` query parameter. This can expose another shop’s product metadata at the wrong shop URL and create incorrect SEO metadata (**SEO-001**, P2).
3. The privacy policy explicitly leaves retention scheduling to the operator; the implementation has no verified retention/deletion procedure. Published terms defer delivery, cancellation, return, and refund details to each shop without verified shop-specific terms (**PRIV-001**, **LEGAL-001**).
4. Admin MFA/recovery requirements, the approved master specification, production account policy, and staging identity model could not be confirmed. Authentication changes are protected and were not attempted (**AUTH-001**, UNVERIFIED).
5. No isolated database restore, live backup execution, production TLS/DNS, external monitoring, email authentication, or authorized staging verification was available (**OPS-001**, UNVERIFIED).
6. The fresh Playwright run was blocked because `localhost:3000` was not running. A prior local run of the same browser test sources passed 6/6 Chromium tests and had no axe findings on `/`, `/privacy`, and `/terms`; it preceded the final documentation/script-only commit and did not test the complete set of user, admin, device, or production scenarios.

No confirmed P0 exploit or P0 data exposure was established by this Phase 0 source review. Several essential launch controls remain failed or unverified; this is sufficient for a **NO-GO** recommendation under the supplied release gate.

## 2. Summary scorecard

Each named criterion is counted once. PASS means verified only within the stated test scope. FAIL is a confirmed gap or mismatch. UNVERIFIED means evidence/access was insufficient; it is not a pass. Parent sections are not awarded a pass based on partial subchecks.

| Section | Scope | PASS | FAIL | UNVERIFIED |
|---|---:|---:|---:|---:|
| A. Launch readiness | A1–A20 (20) | 2 | 8 | 10 |
| B. API, security, business logic | B1–B14 (14) | 0 | 0 | 14 |
| C. SEO and discoverability | C1–C5 (5) | 0 | 2 | 3 |
| D. Privacy and compliance | D1–D5 (5) | 0 | 2 | 3 |
| E. Deployment and operations | E1–E7 (7) | 0 | 1 | 6 |
| F. Multi-store isolation | F1–F20 (20) | 3 | 3 | 14 |
| G. Accessibility, load, language | G1–G3 (3) | 0 | 0 | 3 |
| H. Test strategy and evidence | H1–H3 (3) | 2 | 0 | 1 |
| **Total** | **77** | **7** | **16** | **54** |

### A. Launch readiness (20)

| ID | Status | Evidence / limitation |
|---|---|---|
| A1 | PASS | `server/app.js` serves branded 404 for unknown HTML routes and JSON 404s for API/other requests; tests cover shell, API errors, and 404 behavior. |
| A2 | FAIL | Product server-rendered metadata looks up a product by ID across the full catalog without scoping to the requested shop; see SEO-001. |
| A3 | FAIL | Product/category descriptions are generated from URL/catalog data without enforcing that the content belongs to the requested shop; see SEO-001. |
| A4 | UNVERIFIED | No current browser session; primary CTA visibility/interactivity was not verified at required mobile, tablet, and desktop viewports. |
| A5 | PASS | SVG favicon is linked and shared branding assets have route tests. No manifest or Apple touch icon was found; applicability and device rendering remain unverified. |
| A6 | FAIL | `robots.txt` is generated from one request origin; separate host/domain behavior for each shop is not configured in the reviewed deployment. |
| A7 | FAIL | Sitemap is shop-aware by query/path, but there is no evidence of per-shop canonical domains or eligibility filtering for unavailable products. |
| A8 | FAIL | Server and client set page titles/descriptions/URLs, but social image is the same generic asset for all pages; Twitter title/description variants are not set dynamically. |
| A9 | UNVERIFIED | Product components supply alt text, but galleries, all page imagery, and manual screen-reader checks were not audited end-to-end. |
| A10 | UNVERIFIED | A previous browser run checked horizontal overflow at 390×844 only. Current, tablet, desktop, product/cart/checkout/admin responsive checks are unavailable. |
| A11 | UNVERIFIED | No dedicated sticky purchase CTA was verified for product/checkout routes or tested for overlap with controls. |
| A12 | UNVERIFIED | Unit tests cover some checkout async states; the full storefront/admin loading, retry, duplicate-submit, and failure matrix was not exercised. |
| A13 | UNVERIFIED | Checkout/order-lookup validation is partially covered; registration, recovery, contact, reviews, and authenticated admin flows were not fully exercised. |
| A14 | UNVERIFIED | Backend tests cover idempotent order creation and receipt shape with test doubles; no real PostgreSQL or staging order confirmation was performed. |
| A15 | FAIL | The privacy page is explicitly a template and leaves retention scheduling, actual provider recipients, and legal review unresolved; see PRIV-001. |
| A16 | FAIL | Published terms do not set shop-specific delivery, cancellation, return, refund, or exchange rules; see LEGAL-001. |
| A17 | UNVERIFIED | Consent accept/reject/reopen was browser-tested previously. Applicable legal requirements, all persistence/withdrawal cases, and cross-store domain behavior remain unverified. |
| A18 | UNVERIFIED | Tracker IDs are disabled in source. When enabled, the purchase event includes order/transaction and event identifiers; provider receipt, tenant-specific IDs, and production data handling were not verified. No phone/address fields were seen in those event payloads. |
| A19 | UNVERIFIED | Contact links exist in shared footer, but the business owner has not verified the published email/phone or hours/address. |
| A20 | FAIL | Browser-side compression can produce WebP, but responsive `srcset`/`sizes`, consistent dimensions/payloads, and real network performance were not verified. |

### B. API, security, and business logic (14)

| ID | Status | Evidence / limitation |
|---|---|---|
| B1 | UNVERIFIED | Tests establish some shop-scoped APIs/RBAC; exhaustive object ownership, tenant, customer, and staging IDOR tests were not authorized/available. |
| B2 | UNVERIFIED | Source uses parameterized SQL in inspected routes and input validators; exhaustive route-by-route injection and malformed-input testing was not completed. |
| B3 | UNVERIFIED | Unit tests establish server catalog pricing and whole-BDT amounts. Tax/coupon/business-rule applicability and concurrency behavior require an approved spec. |
| B4 | UNVERIFIED | Helmet/CSP/HSTS and bearer JWT handling are present; production TLS, full CORS preflight, proxy, browser storage threat, and live headers were not verified. |
| B5 | UNVERIFIED | Login/password change exist; no MFA, OTP, or recovery route was identified. The approved account policy/specification needed to determine mandatory scope is missing. |
| B6 | UNVERIFIED | Source/docs describe manual payment review and no bKash API; no approved COD workflow or provider/courier staging fixtures were supplied. |
| B7 | UNVERIFIED | State transition/idempotency tests pass with test doubles; production persistence, recovery, and repeat/concurrent staging cases were not run. |
| B8 | UNVERIFIED | Transactional inventory changes and stock tests exist; shared inventory and simultaneous last-unit/coupon behavior were not tested against PostgreSQL. |
| B9 | UNVERIFIED | Generic unexpected API errors are returned; authorized representative production logs, redaction, correlation, and alert delivery were unavailable. |
| B10 | UNVERIFIED | Upload MIME allowlist, signature checks, randomized names, and 5 MB limit are in source; dimension/decompression and production storage-isolation behavior were not verified. |
| B11 | UNVERIFIED | `npm audit` found 0 vulnerabilities; no dedicated secret-history scanner was installed/run. Tracked env/credential artifacts were checked without printing local secrets. |
| B12 | UNVERIFIED | Caddy/TLS and security headers are configured in source; no public DNS, certificate, host exposure, or production response evidence was available. |
| B13 | UNVERIFIED | Query patterns are parameterized, but no authorized PostgreSQL connection/data or safe EXPLAIN evidence was available. |
| B14 | UNVERIFIED | Startup executes DDL; backup/restore, rollback, RPO/RTO, and migration safety have not been validated. See OPS-001. |

### C. SEO and discoverability (5)

| ID | Status | Evidence / limitation |
|---|---|---|
| C1 | FAIL | Canonical URLs use one public origin and shop query parameters; no store-specific domain resolution. Product metadata is not shop-scoped. |
| C2 | UNVERIFIED | Route-level pages and internal links have partial tests; full crawler, heading audit, and redirect/loop crawl were not run. |
| C3 | FAIL | No Product, BreadcrumbList, Organization, or other JSON-LD structured data was found in the reviewed public frontend. |
| C4 | UNVERIFIED | Search Console/Bing ownership, verification, and sitemap submission require owner/provider evidence. |
| C5 | UNVERIFIED | No Lighthouse/Core Web Vitals or real-user performance measurement was run. |

### D. Privacy and compliance (5)

| ID | Status | Evidence / limitation |
|---|---|---|
| D1 | FAIL | The policy leaves retention undefined and does not establish the actual service-provider recipient list/retention controls; analytics purchase events can include order/event identifiers if enabled. Legal review required. |
| D2 | UNVERIFIED | Guest order lookup exists, but no customer account/access/correction/deletion workflow was found. Applicability and legal request process require owner/legal decision. |
| D3 | FAIL | No retention period, deletion schedule, or verified minimization process was evidenced for stored order/contact data; see PRIV-001. |
| D4 | UNVERIFIED | No marketing-mailing feature was identified. Consent/unsubscribe requirements and any external campaign system were not verified. |
| D5 | UNVERIFIED | No qualified Bangladesh legal review evidence supplied. |

### E. Deployment and operations (7)

| ID | Status | Evidence / limitation |
|---|---|---|
| E1 | UNVERIFIED | Example environment files and production Compose exist; deployed environment separation and secret values were deliberately not inspected. |
| E2 | UNVERIFIED | Caddy configuration provisions TLS, but DNS, certificate validity, external ports, and both named domains were not tested. |
| E3 | UNVERIFIED | No transactional mail delivery/DNS evidence or SPF/DKIM/DMARC provider configuration was available. |
| E4 | UNVERIFIED | Health endpoint and external uptime/alerting are documented; monitoring, alert delivery, on-call ownership, and incident exercise are unverified. |
| E5 | UNVERIFIED | Deployment instructions exist; staging release, rollback, and recovery have not been exercised. |
| E6 | UNVERIFIED | Paired encrypted database/upload backups are documented, but the script was not executed and no isolated restore evidence exists. |
| E7 | FAIL | Deployment is parameterized for one `DOMAIN` and one `PUBLIC_SITE_URL`; requested distinct admin/store domains and host-specific store routing are not represented. See TENANT-001. |

### F. Multi-store isolation (20)

| ID | Status | Evidence / limitation |
|---|---|---|
| F1 | FAIL | Tenant resolution uses the `shop` query parameter/profile slug, while deployment has one host; requested store-specific host resolution is not implemented. |
| F2 | UNVERIFIED | Production accepted-host and spoofed-host behavior cannot be established without the deployed proxy/DNS configuration. |
| F3 | UNVERIFIED | Partial shop-scoped route tests exist; every route/cache/notification/admin path was not tested with synthetic staging tenants. |
| F4 | UNVERIFIED | No customer account model exists in the documented guest-order flow; cross-store customer auth isolation cannot be tested. |
| F5 | PASS | Test coverage exercises platform-admin/shop-member authorization and shop membership restrictions in the API test suite. |
| F6 | FAIL | Server-rendered product metadata searches the global catalog by product ID without checking shop ownership; see SEO-001. |
| F7 | UNVERIFIED | Product stock is shop-scoped in current model; cross-store shared-inventory requirements and concurrent behavior lack the approved spec/staging test. |
| F8 | UNVERIFIED | Shop name, banner, hero, and advance configuration exist; actual owner contact and complete tenant policy configuration remain unknown. |
| F9 | UNVERIFIED | Tracker configuration is global/static and disabled; per-store provider configuration/delivery is not verified. |
| F10 | UNVERIFIED | The public read-only product API uses wildcard CORS without credentials; allowed-origin policy for the named store domains was not established. |
| F11 | PASS | Checkout validates an active shop and stores `shop_id`; tests cover shop-aware order creation with a fake pool. |
| F12 | UNVERIFIED | Order lookup requires order number plus phone and returns customer-safe details, but synthetic cross-tenant ownership tests on PostgreSQL were not run. |
| F13 | UNVERIFIED | Coupon/tax functionality and each shop’s locked delivery/payment policy are not specified or staging-tested. |
| F14 | PASS | Catalog/category/product repositories accept a shop slug; shop API isolation regression tests distinguish shop-managed products. |
| F15 | UNVERIFIED | No shared CDN/cache deployment evidence; public API cache behavior and production invalidation/tenant keys were not observed. |
| F16 | FAIL | Sitemap/canonical URLs are built from a single public origin rather than each shop’s required canonical host. |
| F17 | UNVERIFIED | Product images are public uploads with randomized names; per-store storage authorization/isolation has not been tested. |
| F18 | UNVERIFIED | Push subscription endpoints exist, but provider configuration, tenant boundaries, delivery and revocation were not verified. |
| F19 | UNVERIFIED | Logs/audit tables exist in source; operational access controls and sensitive-field redaction were not inspected in a deployed environment. |
| F20 | UNVERIFIED | No customer export/deletion/retention workflow or approval policy was evidenced. |

### G. Accessibility, load, and language (3)

| ID | Status | Evidence / limitation |
|---|---|---|
| G1 | UNVERIFIED | A prior axe scan reported zero findings on home/privacy/terms only. Product, cart, checkout, and authenticated admin plus manual keyboard/screen-reader tests remain. |
| G2 | UNVERIFIED | No staging target, target concurrency, load profile, or resource telemetry supplied; no load test was run. |
| G3 | UNVERIFIED | BDT is used in source/tests; no visual Bangla/font, locale, rounding, and cross-surface currency audit was performed. |

### H. Test strategy and evidence (3)

| ID | Status | Evidence / limitation |
|---|---|---|
| H1 | PASS | Current `npm test` and `npm audit` executed successfully; browser test was attempted and blocked by unavailable server. |
| H2 | UNVERIFIED | Existing tests cover several security controls, but the full prioritized security regression list requires further threat-model and staging work. |
| H3 | PASS | This report records actual command outcomes, test scope, environment, and limitations; unrun tests are explicitly not represented as passes. |

## 3. Confirmed findings and material unknowns

### TENANT-001 — Requested per-store/admin host routing is not represented

- **Priority / severity:** P1 / High
- **Section / requirement:** A6, C1, E7, F1, F16
- **Status:** FAIL
- **Affected source:** `Caddyfile:1`; `docker-compose.production.yml:30,56`; `server/app.js:363-370,424-429`; `js/main.js:27-31`
- **Evidence:** Caddy uses one `{$DOMAIN}` site address. Production config derives a single `PUBLIC_SITE_URL` from that same `DOMAIN`. Runtime store selection is based on a query parameter or `/shops/:slug`, not a host-to-store mapping. The provided requirements name `shopademia.store` and `admin.shopademia.store` and specify store-specific domains.
- **Actual vs expected:** The repository documents `/admin` on the storefront origin and `/?shop=<slug>` for stores; no second admin host or per-store host resolution is defined in the committed production configuration.
- **Risk / impact:** DNS may resolve names without the application/proxy serving the intended distinct site. Canonical, robots, sitemap, CORS, consent, and tenant context can be wrong if the launch requires multiple hosts.
- **Recommended remediation:** First have the owner approve whether each store and admin must have separate domains or whether the existing same-origin/query model is accepted. If separate hosts are required, design host allowlisting/tenant resolution, proxy host routing, canonical/sitemap/CORS behavior, and staging tests as one reviewed change.
- **Protected-area approval:** **HUMAN APPROVAL REQUIRED** before changing deployment/proxy or shared tenant-routing behavior.
- **Required verification:** Staging DNS and host matrix for storefront/admin/each shop; unknown/spoofed host rejection; per-host canonical/robots/sitemap; cross-tenant API and admin tests.
- **Remediation / commit:** Not started; no commit.

### PRIV-001 — Order retention and deletion controls are unresolved

- **Priority / severity:** P1 / Medium
- **Section / requirement:** A15, D1, D3, F20
- **Status:** FAIL
- **Affected source:** `js/views/RoutePageView.js:186-192`; `server/db.js:5-35`; order-lookup route `server/app.js:962-1001`
- **Evidence:** The policy states that records remain for operational/record-keeping purposes and that the operator should set a retention schedule. The inspected order schema persists customer name, phone, address, payment sender number, items, and timestamps. No verified deletion/retention job or customer request workflow was found. The purchase analytics payload in `js/viewmodels/CheckoutViewModel.js` includes a transaction/order identifier and event ID when a tracker is configured; tracker IDs are currently disabled and phone/address are not included in the inspected payload.
- **Actual vs expected:** The implementation/policy do not establish a concrete schedule, criteria, deletion process, or owner-approved exception/retention policy.
- **Risk / impact:** Customer data may be retained longer than necessary; privacy requests and legal obligations cannot be reliably fulfilled from available evidence.
- **Recommended remediation:** Obtain business/legal approval for retention periods and exceptions; then specify lawful archival/deletion behavior and customer request handling. Do not implement database deletion/migration in this audit phase.
- **Protected-area approval:** **HUMAN APPROVAL REQUIRED** for data-retention policy and any database/data-lifecycle change.
- **Required verification:** Approved retention schedule; synthetic-data deletion/export tests in isolated staging; backup-expiry alignment; verify logs and customer-visible policy.
- **Remediation / commit:** Not started; no commit.

### AUTH-001 — MFA and account-recovery requirements cannot be established

- **Priority / severity:** P1 / High if required by the approved policy; otherwise UNVERIFIED risk
- **Section / requirement:** B1, B5
- **Status:** UNVERIFIED
- **Affected source:** Admin login `server/app.js:1003-1065`; token storage `admin-assets/admin.js:472`; repository has no located MFA/OTP/password-recovery routes.
- **Evidence:** Login verifies email/password and issues an eight-hour JWT. No MFA/OTP/recovery flow was identified in the inspected routes. The separately approved master specification and production account policy were not found.
- **Actual vs expected:** Password-only admin login is implemented; whether MFA/recovery is a launch requirement cannot be reconciled to an approved master specification.
- **Risk / impact:** If MFA is mandatory for platform-admin/sensitive operations, a compromised password alone can grant administrative access. Lack of recovery may impede account recovery.
- **Recommended remediation:** Owner/security approver must decide and document MFA, recovery, expiry, and account-enumeration requirements before proposing auth changes.
- **Protected-area approval:** **HUMAN APPROVAL REQUIRED** before any authentication/session/password recovery modification.
- **Required verification:** Approved policy, synthetic admin staging accounts, MFA enrollment/challenge/recovery and session invalidation tests, abuse/rate-limit tests.
- **Remediation / commit:** Not started; no commit.

### SEO-001 — Server-rendered product metadata is not tenant-scoped

- **Priority / severity:** P2 / Medium
- **Section / requirement:** A2, A3, C1, F6
- **Status:** FAIL
- **Affected source:** `server/app.js:434-467`, especially product lookup at `server/app.js:438-440`
- **Evidence:** For `/product/:id`, the shell title/description lookup calls `getAllProducts().find(...)` without comparing the requested `shop` query with the product’s `shopId`. The client-side product route subsequently uses the selected shop’s repository.
- **Reproduction:** With two synthetic shops and products, request `/product/<shop-B-product-id>?shop=main`; inspect the returned HTML title/description and compare it with the not-found content rendered by the main-shop client.
- **Actual vs expected:** HTML metadata may name/describe a product from another shop even when the selected shop cannot display it.
- **Risk / impact:** Cross-shop product metadata disclosure, incorrect indexing/sharing, and a tenant-isolation inconsistency. Product listings are public, so this was not established as disclosure of customer or payment data.
- **Recommended remediation:** Scope the server-side metadata lookup to the validated active shop; return safe not-found metadata when the product does not belong to that shop.
- **Protected-area approval:** **HUMAN APPROVAL REQUIRED** because this changes shared tenant visibility behavior.
- **Required verification:** Regression test for correct shop/product pair, wrong-shop IDs, inactive shop, unknown ID, canonical/OG metadata, and sitemap consistency.
- **Remediation / commit:** Not started; no commit.

### SEO-002 — Sitemap eligibility is not proven

- **Priority / severity:** P2 / Medium
- **Section / requirement:** A7, C1
- **Status:** FAIL
- **Affected source:** `server/app.js:482-502`
- **Evidence:** Sitemap entries are assembled from active shops and `getAllProducts()`; product inclusion does not filter on availability/indexability and all URLs use the single `siteOrigin`.
- **Actual vs expected:** Unavailable or otherwise non-indexable catalog entries may be emitted; the requested separate canonical host model is unsupported by this configuration.
- **Risk / impact:** Search engines can index unsuitable pages or receive cross-store canonical URLs.
- **Recommended remediation:** Obtain an owner-approved indexing policy, filter eligibility, and implement one canonical host per approved store model.
- **Protected-area approval:** Human approval required before tenant/canonical behavior changes.
- **Required verification:** Synthetic active/suspended/available/unavailable products; XML validation, escaping, URL-size limits, and host-specific sitemap tests.
- **Remediation / commit:** Not started; no commit.

### SEO-003 — Structured product data is absent

- **Priority / severity:** P2 / Low
- **Section / requirement:** C3
- **Status:** FAIL
- **Affected source:** Public HTML/templates and `js/views/RoutePageView.js`; no JSON-LD/schema.org markup found in the repository search.
- **Evidence:** Search for `application/ld+json` and `schema.org` in public HTML/JS returned no implementation.
- **Risk / impact:** Search engines cannot consume structured product/breadcrumb/organization data from the current app. No rich-result eligibility is established.
- **Recommended remediation:** If approved, add accurate schema from existing product/shop values; never invent ratings, stock, price, or review data.
- **Protected-area approval:** No protected code change proposed in Phase 0; implementation requires normal review.
- **Required verification:** JSON-LD syntax and schema validation against synthetic data; confirm BDT, availability, and no fabricated review values.
- **Remediation / commit:** Not started; no commit.

### LEGAL-001 — Store-specific fulfillment terms are not stated

- **Priority / severity:** P2 / Medium
- **Section / requirement:** A16, D1, D5
- **Status:** FAIL
- **Affected source:** `js/views/RoutePageView.js:193-198`
- **Evidence:** Current terms state that the relevant shop is responsible for fulfillment and must explain delivery, cancellation, return, and refund terms before completing a sale; no verified per-shop terms/configuration were found.
- **Risk / impact:** Customers may not have clear seller-specific conditions before submitting an order request; legal sufficiency is unknown.
- **Recommended remediation:** Obtain approved shop policies and qualified Bangladesh legal review; make only documented terms visible before checkout/order submission.
- **Protected-area approval:** Owner/legal approval required for business-policy wording.
- **Required verification:** Review every active shop’s terms and test rendering/linkage on its profile and checkout flow.
- **Remediation / commit:** Not started; no commit.

### IMG-001 — Responsive image delivery and performance evidence are missing

- **Priority / severity:** P2 / Low
- **Section / requirement:** A20, C5
- **Status:** FAIL (responsive variants); performance metrics UNVERIFIED
- **Affected source:** `js/views/ProductGridView.js`, `js/views/RoutePageView.js`, product image uploads under `/uploads`
- **Evidence:** Client-side image optimization can produce WebP, but no responsive `srcset`/`sizes` implementation was found. No Lighthouse/network payload measurement was possible.
- **Risk / impact:** Larger-than-needed images may be delivered to small screens; impact cannot be quantified without measurements.
- **Recommended remediation:** Measure representative product images first; if material, add appropriately sized responsive variants with preserved alt text, dimensions, caching, and compatibility fallback.
- **Protected-area approval:** No protected behavior change proposed; any storage/processing changes require separate review.
- **Required verification:** Browser network evidence at mobile/desktop, payload/dimensions, layout shift, and visual regression checks.
- **Remediation / commit:** Not started; no commit.

### OPS-001 — Production recovery and migration safety are unverified

- **Priority / severity:** P1 / High operational risk
- **Section / requirement:** B14, E5, E6
- **Status:** UNVERIFIED
- **Affected source:** `server/index.js:70`; `server/db.js:3-35` and later `ALTER TABLE` statements; `scripts/backup-production.sh`; `README.md` production runbook
- **Evidence:** Startup calls `initializeDatabase()`, which executes DDL. The backup script is documented to create encrypted paired database and upload archives, but it was not executed and no isolated restore result/RPO/RTO is available. Docker/database services were not reachable in this audit.
- **Actual vs expected:** Source and instructions exist; successful backup, restore, rollback, migration concurrency, retention, and alerting are not proven.
- **Risk / impact:** A deployment or data incident may not be recoverable within an acceptable time; runtime DDL can complicate controlled rollback and multi-instance startup.
- **Recommended remediation:** In authorized staging, run backup, decrypt and restore into an isolated empty database, validate schema/orders/images, and record measured recovery time. Separately approve a migration/rollback strategy before altering startup DDL.
- **Protected-area approval:** **HUMAN APPROVAL REQUIRED** for schema, production deployment, backups/restores, or data operations.
- **Required verification:** Staging-only backup/restore, integrity checks, failure simulation, and an approved schema rollback runbook. Never restore over production as part of this audit.
- **Remediation / commit:** Not started; no commit.

## 4. Route inventory (source-level)

The route inventory below is based on `server/app.js` and `server/platform.js`; authentication means middleware is present in source, not that production configuration was verified.

| Route family | Methods / routes | Authentication / scope | Validation and test evidence |
|---|---|---|---|
| Storefront shell | `GET /`, `/product/:id`, `/category/:id`, `/shops`, `/shops/:slug`, `/deals`, `/about`, `/find-order`, `/privacy`, `/terms` | Public; shop selected by query/profile slug | App-shell, route, metadata, and 404 tests; host-based tenant resolution absent. |
| Admin shells | `GET /admin`, `/admin/platform` | Public login shells; API actions protected | Login UI/unauthenticated API check; no authenticated browser session in current audit. |
| Public catalog/config | `GET /api/v1/products`, `/categories`, `/products/hero-offer`, `/shops`, `/shops/:slug`, `/shops/:slug/products`, `/shops/:slug/categories`, `/shops/:slug/products/hero-offer`, `/shops/:slug/config`, `/storefront-config`, offers/push-key | No auth; shop slug/status checked on scoped routes; public catalog rate limit | Unit/API tests cover public shop API isolation, pagination, 404 and validation; not every cross-tenant path. |
| External shop product API | `GET /api/v1/public/shops/:slug/products` | No auth by design; active shop scope; wildcard CORS; 120 requests/IP/minute | Tests cover shop isolation, CORS, paging, category validation, inactive/unknown shop. |
| Customer orders | `POST /api/v1/orders`; `POST /api/v1/customer/order-lookup` | No customer account; 30 orders and 5 lookups/IP/15 minutes | Server pricing, phone/order validation, idempotency, stock and safe lookup have test coverage with fakes. |
| Admin authentication/profile | `POST /api/v1/admin/login`, `GET /api/v1/admin/profile`, `POST /api/v1/admin/logout`, `PATCH /api/v1/admin/profile/password` | Login issues JWT; authenticated routes require bearer token | Login throttling/password/session tests; MFA and recovery policy unverified. |
| Shop admin operations | Product CRUD; order list/activity/status/advance-review routes | `authenticateAdmin` plus shop dashboard/manager role middleware and `shop_id` scoping | Tests cover role membership, order transitions, payment-review states, product upload/update/delete, but no staging PostgreSQL tests. |
| Platform/shop operations | Shop CRUD/status/settings, hero slides, members, branding, transactions, offers, reports, activity | Platform-admin or shop-scoped role middleware | API tests cover several platform actions; full permission matrix and live audit-log review unverified. |
| Push subscriptions | `GET /api/v1/shops/:slug/push-key`; `POST/GET/DELETE /api/v1/shops/:slug/push-subscriptions` | Public browser subscription endpoints with route-level limiting; provider config optional | Provider delivery, abuse, subscription tenancy, and production VAPID setup unverified. |
| Health/error handling | `GET /healthz`; final 404/error handlers | Public readiness response; generic client error for unexpected exceptions | Readiness and generic errors tested with test doubles; production logs/monitoring unverified. |

No customer registration, account recovery, reviews, courier webhooks, transactional email API, or payment-provider webhook was identified in the inspected route inventory. Whether each is required is unresolved without the approved master specification.

## 5. Multi-store resource matrix

| Resource | Observed model | Audit status / gap |
|---|---|---|
| Host and canonical domain | One configured `DOMAIN` / `PUBLIC_SITE_URL`; `?shop=` selects storefront context | FAIL against requested per-store hosts; TENANT-001 |
| Products/catalog | Bundled starter catalog plus managed products; managed records have shop IDs | Shop isolation partly tested; metadata lookup is not shop-scoped |
| Categories/search | Shop slug passed to API/repository | Source-scoped; exhaustive tenant test unverified |
| Inventory | Managed stock stored with product; reservation in checkout transaction | Cross-shop shared-vs-isolated requirement and PostgreSQL concurrency unverified |
| Orders | `shop_id` association, fake-pool tests | Source/test evidence positive; staging isolation unverified |
| Customer identity | Guest order form and order-number/phone lookup | No customer account model found; access/deletion policy unverified |
| Shop configuration | Name, imagery, hero slides, advance charge | Contact, domain, analytics, policy, and provider configuration completeness unknown |
| Analytics/consent | Global static tracker config, consent localStorage on same origin | Disabled IDs; provider delivery and per-store isolation unverified |
| CORS/cache | Public external catalog has wildcard CORS and 30-second cache; URL path includes shop slug | No credentialed public CORS; deployed intermediary cache/invalidation unverified |
| Media | Uploads served as public static assets; randomized filename; product association scoped in API | Public-image isolation/storage controls unverified |
| Notifications | Optional VAPID; shop-slug endpoints | Live provider and tenant boundary unverified |
| Logs/reports | Shop activity and admin order events in database | Role tests exist; operational access, retention and redaction unverified |
| Exports/deletion | No customer export/deletion workflow found | UNVERIFIED / owner and legal decision required |

## 6. Remediation plan and approval gates

No remediation has started in Phase 0. Do not treat this table as authorization.

| Priority | Finding | Proposed next step | Protected area / approval | Verification |
|---|---|---|---|---|
| P0 | None confirmed | Continue static review and authorized staging verification; do not infer absence of P0 from tests alone. | N/A | Staging security review for cross-tenant private data, checkout, and auth. |
| P1 | TENANT-001 | Owner decides whether separate store/admin domains are required; then stage routing/canonical plan. | **Human approval required** for proxy/deployment/shared tenant routing. | Host-resolution and cross-tenant regression matrix. |
| P1 | PRIV-001 | Owner/legal define retention, deletion, and request-handling policy before implementation. | **Human approval required** for policy and database lifecycle. | Staging synthetic data lifecycle tests and policy review. |
| P1 | AUTH-001 | Obtain approved security policy for MFA/recovery/OTP; do not modify auth meanwhile. | **Human approval required** for authentication/session code. | Synthetic account security, recovery, session, abuse tests. |
| P1 | OPS-001 | Authorized staging backup/restore and migration/rollback review. | **Human approval required** for DB/deployment operations. | Isolated restore plus integrity and recovery-time evidence. |
| P2 | SEO-001 | Scope shell product metadata to active selected shop. | Human approval required because tenant visibility changes. | Wrong-shop ID, inactive shop, metadata/canonical and sitemap tests. |
| P2 | SEO-002 | Approve eligibility and canonical-domain policy; exclude ineligible listings. | Review required for public indexing behavior. | XML validation and synthetic product state matrix. |
| P2 | SEO-003 | Consider accurate Product/Breadcrumb/Organization schema. | Normal implementation review; no invented data. | JSON-LD/schema validation and BDT/availability checks. |
| P2 | LEGAL-001 | Obtain actual seller fulfillment/refund terms and legal review. | Business owner and qualified Bangladesh counsel. | Verify each shop policy before order flow. |
| P2 | IMG-001 | Measure first; add responsive image variants only if supported by evidence. | Normal review; storage changes need separate approval. | Network payload, viewport, CLS and visual tests. |
| P3 | None assigned | No optional polish prioritized before release blockers/evidence. | Separate authorization required. | As proposed per approved scope. |

## 7. Test and scan evidence

| Evidence ID | Command / procedure | Environment and result | Limits |
|---|---|---|---|
| T-001 | `npm.cmd test` | Node `v24.21.0`; **74 passed, 0 failed**, exit 0; test doubles/local Node test runner. | Does not prove PostgreSQL, staging, production, provider, or concurrency behavior. |
| T-002 | `npm.cmd audit` | npm `11.19.0`; **0 vulnerabilities** reported. | Dependency audit only; not source-code security or license review. |
| T-003 | `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://localhost:3000` | Current Phase 0 attempt: browser tests could not connect (`ERR_CONNECTION_REFUSED`); no application server was running. | Not a code-level failure. Server was not started because startup invokes schema initialization. |
| T-004 | Prior local Playwright run at `http://localhost:3137` | Same test suite/revision in recent session history: **6/6 Chromium tests passed**; axe reported no findings on homepage, privacy, and terms. | Historical local evidence only; current environment could not reproduce; pages/viewport coverage is limited. |
| T-005 | `bash -n scripts/backup-production.sh` | Git Bash present; exit 0. | Syntax only; backup not executed. |
| T-006 | `git status --porcelain=v1`, revision/upstream checks | Start state clean; `b6efcae`; `main` tracked `2/main`; ahead/behind `0/0`. | Report file itself is the only Phase 0 worktree change. |
| T-007 | `npm run build:css` | Not run during Phase 0 because it rewrites the checked-in generated stylesheet. | Prior project session had successfully built CSS; that is not a fresh audit build. |
| T-008 | Lint/typecheck/full production build | No corresponding lint/typecheck/full build script found in `package.json`. | Add tooling only after an approved scope requires it. |
| T-009 | Secret scan | `gitleaks` and `trufflehog` unavailable. Tracked `.env` files, key/certificate/dump artifacts, and ignored local `.env` status were inventoried without reading or printing local secret values. | No comprehensive Git-history secret scan performed. |
| T-010 | Database query plans | Not run. No authorized PostgreSQL connection/data or staging DB supplied. | Read-only EXPLAIN requires a safe authorized DB environment. |
| T-011 | Lighthouse/load/concurrency | Not run. No authorized staging URL, target profile, or telemetry supplied. | No performance metrics or load targets are claimed. |
| T-012 | Backup restore | Not run. | Docker/production credentials/storage unavailable; no RPO/RTO claimed. |
| T-013 | DNS/TLS/email/analytics/monitoring/provider checks | Not run. | No authorized production/staging configuration or provider console access supplied. |

## 8. Unverified items and resolution procedures

| IDs | Why unverified / known | Required procedure | Launch impact |
|---|---|---|---|
| A4, A9–A14, A17–A20; G1, G3 | No app server was reachable during the fresh run; previous browser run covered only six journeys and three axe pages. | Start a disposable staging app with approved synthetic data and test responsive viewports, product/cart/checkout/admin, keyboard/screen-reader flow, consent withdrawal, image requests, and Bangla/BDT presentation. | Essential purchase/accessibility/privacy paths block release until verified. |
| B1–B14 (except known gaps in findings) | Source and fake-pool tests are not a staging security/database test; master spec unavailable. | Provide approved master spec and isolated staging identities/data; execute route-by-route authorization, injection, price, inventory, error, upload, database, and provider tests. | Auth, checkout, isolation, and recovery controls block launch until verified. |
| C2, C4–C5 | No crawler/performance/search console evidence. | Crawl authorized staging; run Lighthouse with documented device/network profile; owner verifies Search Console/Bing domain and sitemap. | SEO/performance launch requirements remain unproven. |
| D2, D4–D5 | Customer-rights/marketing applicability and legal signoff unknown. | Owner and qualified Bangladesh counsel define the processing map, retention, rights request channels, and marketing consent rules; record actual provider recipients. | Privacy/legal approval required before accepting customer data. |
| E1–E6 | Runtime secrets intentionally not inspected; production DNS, logs, alerting, mail, restore and rollback evidence unavailable. | Authorized operator verifies production config without sharing secrets; stage alert and backup/restore drills; capture sanitized results. | Recovery, monitoring, and transport launch controls remain unproven. |
| F2–F4, F7–F10, F12–F13, F15, F17–F20 | No complete multi-store model/spec or PostgreSQL staging test; no customer accounts/provider integrations found in the source scope. | Owner supplies shared-vs-isolated resource specification; test two synthetic shops, users, products, orders, media, analytics and notifications in staging. | Store-isolation approval is a launch gate. |
| G2 | No defined target concurrency or staging telemetry. | Engineering/business defines traffic target and success thresholds; run approved staging workload only. | Required if the release policy has load criteria. |

## 9. Remaining risks and required approvals

- **Protected code:** Authentication, MFA/recovery, tenant routing, order/payment behavior, DDL/migrations, database lifecycle, and production deployment remain untouched. The only application change is the approved non-production CSP adjustment in Section 11. Any further change needs its own approval.
- **Business-owner decisions:** Domain topology; required admin MFA/recovery; retention/deletion periods; payment/COD verification and seller fulfillment policies; real contact details; shop-specific canonical/indexing policy.
- **External evidence:** Production DNS/TLS and both domains, analytics provider receipt, mail DNS/authentication, monitoring/alert routing, off-host backup retention and restore evidence, courier/payment provider configurations.
- **Legal review:** Qualified Bangladesh counsel should review privacy/terms and confirm applicable consumer, privacy, tax, payment, and record-retention obligations.
- **Operational safety:** No production migration, restore, DNS edit, load test, live payment, customer transaction, or deployment was performed.
- **Current repository state:** `b6efcae` was clean and synchronized at audit start. Current uncommitted changes are the scoped WEB-001 fix and tests in `server/app.js` and `server/app.test.js`, plus this report.

## 10. Launch decision

# NO-GO

The inspected evidence does not establish the required separate domain/tenant routing, a customer-data retention/deletion policy, or recoverable production backups. Admin MFA/recovery requirements and several essential staging controls remain unresolved. The available unit tests and dependency audit are positive but do not substitute for these release controls.

### Conditions before reconsidering launch

1. Owner confirms the approved master specification and domain/tenant model; implement and verify the selected host routing before using the named store/admin domains.
2. Owner/legal approves retention, deletion, privacy policy, terms, and actual shop fulfillment/payment rules.
3. Security owner confirms the required MFA/recovery policy; implement only after approval and verify in staging.
4. Execute and validate an isolated encrypted backup/restore, and approve migration/rollback operations.
5. Complete tenant-isolation and essential checkout/admin tests on authorized staging with synthetic data.
6. Verify production TLS/DNS, operational monitoring, external provider configuration, and contact details before accepting real orders.

**Phase gate:** The initial Phase 0 report is complete. WEB-001 was remediated only after separate explicit user approval as documented in Section 11. Other findings and launch blockers remain unremediated pending review/authorization.

## 11. Supplemental authorized local browser verification

The user authorized starting the local development server and initializing its configured development database. The server started successfully at `http://localhost:3000`, completed startup schema initialization, and loaded two admin-managed products. This is local development evidence only; it is not staging or production evidence. The separate synthetic order and shop-admin/product actions described below were performed only in the local development environment; no payment was initiated.

### Results

| Check | Result | Scope and limitations |
|---|---|---|
| `npm.cmd test` | **75 passed, 0 failed** | Unit/API tests; database and external integrations use the repository test setup. |
| Chromium Playwright project | **6/6 passed after the scoped fix** | Chromium `156.0.8078.4`; homepage and consent, shop product API isolation/CORS, public routes and product details, 404, 390×844 mobile overflow/navigation, internal links/error display, unauthenticated admin boundary, and axe scans of home/privacy/terms. |
| Firefox Playwright project | **6/6 passed after the scoped fix** | Firefox `157.0`; same six test cases and accessibility pages. |
| WebKit Playwright project | **6/6 passed after the scoped fix** | WebKit `27.2`; all six existing journeys passed, including route loading, product rendering, admin boundary, and axe scans. |
| All configured browser projects, serial runs | **18/18 passed** | Projects were run serially to avoid sharing the catalog request limit concurrently. |
| `npm run test:e2e:all` with three workers | **9 passed, 9 failed; inconclusive** | Projects shared one server and exceeded its 120-request/60-second public-catalog limit. The resulting 429 responses caused cascading route/startup assertions. Separate Chromium and Firefox runs passed; this concurrent run is not treated as a product regression result. |
| Latest full three-engine serial run | **16/18 passed; two WebKit checks failed after catalog 429 responses** | Restarted the local development server to reset its in-memory limiter, then reran the two affected WebKit tests individually/serially: **2/2 passed**. This isolates the observed failure to shared rate-limit interference; it does not change the test configuration or claim the whole suite is limit-proof. |

### Finding and scoped remediation

**WEB-001 — WebKit could not load local HTTP storefront assets (P2 / medium, confidence 9/10); fixed for non-production.** The local response CSP originally contained `upgrade-insecure-requests` from Helmet defaults. WebKit upgraded relative asset requests to `https://localhost:3000`, where the development server had no TLS; CSS and JavaScript failed with `SSL connect error`, leaving the page unstyled and the catalog uninitialized. The CSP now explicitly omits that directive outside production and retains it in production. Tests assert both behaviors. After restart, WebKit passed 6/6 tests and the development CSP and static assets returned HTTP 200. Production HTTPS behavior remains unverified.

### Coverage still not established

- Authenticated platform/shop admin workflows were not exercised; the browser suite verified only the unauthenticated boundary and sign-in form.
- One synthetic local order request was submitted for Portable Blender (৳3,990) with the configured advance shown as unpaid (৳100). No payment was initiated and no seller was contacted. The order lookup returned that order with the correct number and phone; a mismatched phone returned only the generic no-match response. Blank checkout fields were rejected with inline validation. Cart quantity capped at 99; quantity was returned to one before submitting the order.
- The receipt HTML builder is covered by the unit suite, but the shared browser automation did not emit an observable download event after clicking “Download receipt”; actual file download remains unverified.
- The selected product details page showed “Product information is not available yet” while also presenting the product as available to order. This is a confirmed shopper-facing content gap; product images/descriptions and seller terms should be reviewed before real sales.
- A temporary shop-admin account and synthetic product were created through the local platform/shop admin browser screens, then both were removed through those screens. The test product appeared in both the shop catalog and public shop API; the shop-scoped API listed it first while the general catalog API placed it at position 11. Product detail title and canonical URL were correct, but the SEO/social description was generic instead of using the listing description. This was fixed so a product description supplies the metadata (whitespace-normalized and capped at 160 characters); Chromium, Firefox, and WebKit product-route checks passed after the change. The general catalog ordering difference was observed but not changed; whether admins expect newest-first storefront merchandising needs a defined requirement.
- Required product fields were enforced and the test image uploaded. The admin card showed price and stock. Editing a description without choosing a replacement image was attempted, but the browser assertion timed out before verifying the edit outcome; that behavior remains unverified. Cleanup was subsequently confirmed through the authenticated product list and public API after the delete request returned HTTP 200.
- Payment, notification delivery, upload, account/shop lifecycle operation, and destructive flows were not performed.
- Tablet/desktop visual review, screen-reader/manual keyboard review, real device/browser coverage, production TLS/DNS, performance/load targets, and authorized staging behavior remain unverified.
- The concurrent all-browser result indicates the test suite can collectively consume the shared public-catalog request limit; no limit or test configuration was changed.

The original scorecard and **NO-GO** launch decision remain unchanged. Apart from the approved WEB-001 development configuration fix and the narrowly scoped product SEO metadata fix, this addendum records evidence only; no other remediation was performed.

## 12. Current admin-program status addendum — 2026-10-12

This addendum updates implementation and test evidence after the historical Phase 0 audit. It does **not** silently recalculate the original 77-criterion scorecard; the scorecard describes its stated baseline. For current admin-program work, see the linked progress and feature-matrix documents.

- B0 repository reconciliation/documentation is complete. The user later authorized safe local B1 foundation work on branch `feature/admin-v2`; that authorization did not supply the missing MGS approval, V2 annex, D1–D12 decisions, or database-engine authority.
- B1 now includes local PostgreSQL migration tracking, additive admin settings/permission/audit foundations, and settings-change audit viewing. These remain partial and have not been deployed or verified in production.
- Shop Admin and Platform/Super Admin slide-out sidebars are implemented. Targeted Chromium component tests pass **2/2** using mocked identity/permission data. This is not authenticated end-to-end verification.
- Latest `npm.cmd test`: **100 passed, 0 failed**. Full serial Chromium E2E: **9 passed, 1 skipped, 0 failed**; product detail skipped because the fresh local catalog is empty. Includes synthetic development email/password login UI coverage; no real credentials are validated by that test. Axe reports no violations on `/`, `/privacy`, and `/terms` after a local text-contrast correction. Production integration, authenticated browser flow, migration recovery, concurrency, payments/refunds, courier operations, performance, full accessibility, and production host compatibility remain unverified or blocked.
- First platform-admin MFA enrollment now explains manual authenticator setup more clearly and offers a copy button for the one-time setup key; this does not change MFA policy or bypass a real authenticator.
- For the explicitly requested local-development simplification, platform-admin MFA is not challenged in non-production when `adminMfaRequired` is false. `server/index.js` enables that setting for development, while `server/app.js` unconditionally enforces MFA for production. This does not remove existing MFA enrollment or change stored account data; it is not a production security-policy change.
- The browser accessibility run exposed low contrast on empty/loading catalog messages. Their text classes were darkened and Tailwind CSS rebuilt. This is a limited, verified improvement and not an accessibility certification.
- Disabled drawer items are explicit placeholders for unimplemented modules, not evidence that those modules work.
- Current production recommendation remains **NO-GO**. The full decision, risk, test, and deployment handoff is recorded in [docs/PROGRESS.md](./docs/PROGRESS.md), [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md), [docs/TEST_REPORT.md](./docs/TEST_REPORT.md), [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md), and [docs/FEATURE_MATRIX.md](./docs/FEATURE_MATRIX.md).

## 13. Full project audit and local remediation — 2026-10-15

This addendum records a fresh audit of the current checkout, including the latest uncommitted marketplace product-card and seller-specific checkout work. It supplements, rather than overwrites, the dated baseline and admin-program evidence above. Only local code and the loopback demo were tested; no staging or production service, account, or database was changed.

### Newly verified findings and dispositions

| ID | Priority | Status | Finding and impact | Remediation / evidence |
|---|---|---|---|---|
| AUD-UI-001 | P2 / Medium | **FIXED** | Struck-through former prices used `#94a3b8` on white, giving a 2.56:1 contrast ratio and failing WCAG AA. | Darkened the old-price text in marketplace cards and product details to `#64748b`. The full Chromium accessibility checks now pass. |
| AUD-E2E-001 | P2 / test reliability | **FIXED** | Browser assertions still expected the previous “View product” accessible name, the old shop-directory heading, and no purchase buttons on marketplace ranking/deal cards. These stale expectations caused false failures and did not verify the current purchase UX. | Updated the assertions to the current accessible names and headings and to require enabled Add to cart and Buy now controls. |
| AUD-E2E-002 | P2 / test reliability | **FIXED** | Purchase and product-detail tests assumed the default `main` shop had an available product. In a multi-shop catalog it may not, causing tests to skip or fail before exercising the behavior. Repeated SPA startup requests in the route smoke test also exhausted the local app’s 120-request/minute public-catalog limiter and produced 429 errors in the suite. | Select an available item from the marketplace catalog and use its seller slug; mock public APIs only in the route-rendering smoke test. Production rate limits were not relaxed or bypassed. The complete public Chromium suite now passes 18/18 with no skipped tests. |

### Current verification

| Check | Result | Scope / limitation |
|---|---|---|
| `npm.cmd test` | **146 passed, 0 failed** | Unit and API suites; not a live PostgreSQL/staging test. |
| `npm.cmd run test:e2e` | **18 passed, 0 failed, 0 skipped** | Public Chromium flows against the existing loopback demo at `127.0.0.1:3000`; includes seller-specific product detail, card purchase actions, responsive checks, and axe checks on home, directory, privacy, and terms. |
| `npm.cmd audit --audit-level=low` | **0 vulnerabilities** | Dependency advisory scan only; not a source-code security review. |
| `git diff --check` | **Passed** | Git reports existing LF-to-CRLF worktree warnings; no whitespace errors. |
| `npm.cmd run validate:staging` | **Blocked as expected** | `.env.staging` is not configured; no placeholder or secret was created. |
| Android `testDebugUnitTest` | **Not run** | The environment has no Java runtime (`JAVA_HOME` and `java` are unavailable). |

### Existing open release blockers

The existing findings and approval gates in Sections 3, 6, 8, and 9 remain relevant and are **not** closed by these local tests. The release decision remains **STAGING: BLOCKED / NOT READY; PRODUCTION: NO-GO**. In particular:

- Store/admin domain topology and tenant/canonical URL behavior need an owner-approved decision before changes to cross-shop visibility or indexing.
- Retention/deletion, seller fulfillment/refund terms, and applicable privacy/legal wording need owner and qualified legal approval.
- Production MFA/recovery policy, repository-level deployment protections, and provider/secret configuration were not verified.
- No authorized staging database migration, backup/restore drill, rollback test, production TLS/DNS check, or operational monitoring validation was performed.
- Android unit tests and authenticated Android/admin end-to-end behavior remain unverified.

The existing untracked `Docker Desktop Installer.exe` was left untouched and excluded from the audit fixes. No changes were committed or pushed.

## Docker VPS release-readiness follow-up — 2026-10-15 20:53 +06

**Decision: PRODUCTION NO-GO.** This section supersedes earlier deployment-path notes: the target is Docker Compose on a Linux VPS using PostgreSQL, not cPanel. The cPanel deployment job was removed from active CI. No production or staging system, provider, DNS record, database, secret file, or remote host was contacted or changed.

- Reviewed the Compose stack, Caddy routing, image build context, startup/environment validation, PostgreSQL roles/migrations, persistent volumes, health checks, shutdown handling, existing backup/restore scripts, CI, and deployment docs.
- Added a fixed Compose project name to keep named persistent volumes stable; the app and one-shot migrator share the SHA-tagged application image. Caddy separates `shopademia.store`, `admin.shopademia.store`, and `api.shopademia.store`. App/admin origin validation and a regression test cover the distinct admin origin. The app and Caddy containers use read-only roots, `no-new-privileges`, and explicit writable data paths.
- Added a fail-closed production environment validator that requires the exact domains, immutable Git SHA, private Compose PostgreSQL endpoint and least-privilege roles, protected unique secrets, HTTPS admin origin, and an age backup recipient. No secret values are recorded. The validator also rejects reusing the optional admin-settings encryption key.
- Repaired two locally observed UI issues: single-item product grids now constrain card width at desktop breakpoints, and the hero discount label uses contrast-compliant text. Focused Chromium card/accessibility tests passed 2/2 against the local synthetic preview.
- Verification: `npm.cmd test` **153/153**; production-config plus admin-origin tests **66/66**; CSS build passed; `npm.cmd audit --audit-level=low` reported 0 vulnerabilities; JavaScript syntax passed for 98 files; offline production Compose config parse passed; `git diff --check` passed with line-ending warnings. Full Chromium against the non-production preview was 13/18; five remaining failures are fixture mismatches (shop identity, CORS, unknown-path status, and canonical metadata), not a release-candidate E2E pass.
- Docker CLI `29.8.2` and Compose `v5.6.0` are installed, but the `desktop-linux` daemon pipe is missing. Image build, Caddy parser validation, and application/PostgreSQL/Caddy runtime checks are **BLOCKED**. The production config validator correctly failed because `.env.production` is absent. No production env, secrets, or DNS was fabricated.
- Recovery evidence is not established: backup/restore scripts were inspected, but no real backup artifacts, off-host storage, age identity custody, isolated restore, RPO/RTO, or rollback rehearsal were available. External monitoring, TLS/DNS and VPS ownership/access are also unverified. PostgreSQL 16 target is preserved; `postgres:16-alpine` and `caddy:2-alpine` remain mutable image tags and need reviewed digest pinning.
- Existing dirty application files and the untracked `Docker Desktop Installer.exe` were preserved. The installer is excluded from Docker build context but was not executed or removed. No commit, push, deployment, migration, or live change occurred.

See [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md) for the exact local evidence, authorized VPS procedure, rollback boundaries, and remaining gates; [docs/TEST_REPORT.md](./docs/TEST_REPORT.md) records command results and limitations.

## 12. Full engineering master-prompt audit — 2026-10-16

### Repository and starting state

- **Repository/branch:** Shopademia storefront, `feature/admin-v2`.
- **Starting commit:** `d2c755aaf196a57f3ba42d818e371dacda1739f6`.
- **Starting worktree:** 32 tracked files modified, four untracked paths, none staged. Existing changes were preserved. The untracked `Docker Desktop Installer.exe` was left untouched. No commit, push, deployment, DNS update, production database operation, or credential/configuration creation occurred.
- **Architecture found:** Node.js/Express, PostgreSQL, static JavaScript storefront/admin, Docker Compose/Caddy deployment files, and a native Kotlin/XML Android admin project. PostgreSQL is the sole intended authoritative database.

### Current evidence

| Area | Status | Evidence |
|---|---|---|
| Web/backend unit and API suite | **VERIFIED** | `npm test`: 153 passed, 0 failed, 0 skipped. This suite includes test doubles and does not establish live PostgreSQL behavior. |
| Dependency advisories | **VERIFIED** | `npm audit --audit-level=low`: zero reported vulnerabilities. This is not a source-code/security or secret scan. |
| Selected JavaScript syntax / diff hygiene | **VERIFIED** | `node --check` passed for the selected server/config files; `git diff --check` passed with line-ending warnings. No lint script is defined. |
| Compose configuration syntax | **VERIFIED, LIMITED** | Staging and production Compose config parsed using checked-in example files. No image was built and no container or service was started. |
| Storefront browser/accessibility E2E | **BLOCKED** | Playwright configuration rejected test discovery because `PLAYWRIGHT_BASE_URL` was unset; no app listener existed on the inspected local ports. No cases ran in this audit. Earlier browser passes remain historical. |
| Android build/tests/lint | **BLOCKED** | Gradle wrapper exists, but Java/JAVA_HOME is absent; Gradle stopped before executing. No Android test or build result is claimed. |
| Docker image/Caddy/runtime | **BLOCKED** | Docker CLI is present, but the Docker Desktop Linux engine pipe is unavailable. |
| Staging/production configuration | **BLOCKED, FAIL-CLOSED** | Staging and production validators refused to proceed because `.env.staging` and `.env.production` are absent. No secrets or placeholder runtime files were created. |
| Database migration, concurrency, backup/restore, rollback | **NOT RUN / UNVERIFIED** | No live test database or approved isolated deployment target was available. Backup/restore procedures were reviewed only. |
| Hosted CI, DNS/TLS, monitoring, legal/security approvals | **NOT RUN / UNVERIFIED** | Workflow source was inspected, but no hosted workflow or external service was contacted. Specialist and owner approval evidence is absent. |
| Dedicated secret scan | **NOT RUN** | No supported scanner executable was available; dependency audit must not be interpreted as secret scanning. |

### Findings and remaining implementation gaps

1. **Android admin application is not feature-complete against the requested scope.** The existing app supports authentication/MFA and read-only dashboard/product/order views. It does not implement product create/edit/archive or image upload, order-state changes, inventory adjustments, category workflows, backend sales summaries, or push notifications. It uses `findViewById`, not ViewBinding. Android implementation and regression verification remain open.
2. **Inventory adjustment workflow is incomplete.** The server has managed-stock reservation behavior and product update paths, but the documented Android-facing contract has no dedicated stock adjustment with reason/operator audit history. The Android app exposes no stock mutation.
3. **Current browser acceptance is not demonstrated.** There is no active local target and no authorized staging target for E2E or manual accessibility testing. Prior results in earlier audit sections are dated evidence, not this-run verification.
4. **Operational release evidence is incomplete.** Compose syntax alone does not establish image reproducibility/runtime behavior. Mutable `postgres:16-alpine` and `caddy:2-alpine` tags still need reviewed digest pinning. No authorized VPS, verified domains/TLS, live migration, off-host backup, isolated restore, rollback rehearsal, monitoring, or alert delivery was verified.
5. **Security/legal review remains open.** Dependency audit passed, but no comprehensive source security clearance or fresh secret scan was performed. The previously documented static-file realpath/open race and uncertainty about external credential reuse remain unresolved. Privacy/terms, payment, consumer, tax, retention, and fulfillment policies require qualified review and owner approval.
6. **Payment-provider integration is absent/unverified.** Existing bKash/manual payment wording must not be treated as provider processing or payment verification. No payment flow was invented or enabled.

### Remediation in this audit pass

- Re-ran the current Node suite, dependency audit, Compose syntax checks, configuration gates, selected syntax checks, and diff hygiene.
- Updated [docs/TEST_REPORT.md](./docs/TEST_REPORT.md) with the current evidence, test/tooling blockers, Android scope gaps, and precise release status.
- No application behavior was changed in this pass because the Android build and browser target were unavailable and no additional safe defect was reproduced. Existing uncommitted application work was preserved.

### Release decision and next safe action

**STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.** Do not deploy or expose real customer data. The next safe local step is to make a Java 17+ / Android SDK toolchain and the approved local browser target available, then implement and test the Android write workflows and inventory audit path. Reconsider staging only after a verified isolated target, authorized configuration/secrets, image/Caddy runtime validation, migration review, paired backup and successful isolated restore, rollback rehearsal, monitoring, and required specialist/owner approvals are evidenced. Production still requires explicit authorization for the exact release and target.

## PostgreSQL recovery investigation — 2026-10-19

- Local database investigation found two PostgreSQL clusters listening on loopback: PostgreSQL 17 on `127.0.0.1:5432` (Windows service `postgresql-x64-17`) and PostgreSQL 16 on `127.0.0.1:5433` (`C:\Program Files\PostgreSQL\16\data`). The 17 cluster uses `scram-sha-256` auth on loopback and the 16 cluster listens on `*` with `port = 5433`.
- Direct authentication probes using the project’s configured local database role and password failed: `127.0.0.1:5432` returned SQLSTATE `28P01` (password authentication failed) and `127.0.0.1:5433` returned `28000` (authentication/configuration failure). The project’s app remains blocked by invalid or unauthorised credentials.
- `docker version` failed because the Docker Desktop engine pipe is not available; the repository’s Docker Compose local PostgreSQL bootstrap method therefore remains unavailable in this environment.
- No writable local Shopademia database, role, migration run, or synthetic order creation was performed. No system-global authentication settings or databases were changed. This remains a genuine infrastructure and authorization blocker, not a code fix.
- Final local status: browser preview is live at `http://127.0.0.1:3002`, full writable local startup remains blocked, staging remains **BLOCKED / NOT READY**, and production remains **NO-GO**.

## Android admin and inventory-integrity continuation — 2026-10-17

The subsequent implementation pass completed the Android product and order-management paths against the existing authenticated APIs, added regression tests, and closed a stock-audit bypass in the generic product-update endpoint. Existing product edits now must submit the current stock value and the server does not update that column; attempts to change it are rejected with guidance to use the dedicated inventory adjustment route. The Android editor makes the existing stock value read-only and directs managers to the audited adjustment workflow. Initial stock on product creation remains supported.

### Evidence from this continuation

- `npm test`: **155 passed, 0 failed**.
- `npm audit --audit-level=low`: **0 vulnerabilities reported** (dependency advisory coverage only).
- `git diff --check`: passed; existing line-ending warnings remain.
- `node --check` passed for `server/app.js` and `server/app.test.js`.
- Changed Android XML parsed successfully with Python's XML parser.
- Added server regression coverage verifies that a generic product update cannot change stock and that an audited adjustment does change it. Other tests cover concurrent inventory adjustments/idempotency, order search validation, staff authorization denial, and order transition rules.
- Android repository/ViewModel/navigation tests were added but **not executed**: the Gradle command stopped before Gradle because Java/JAVA_HOME is absent (exit 9009). No Android build is claimed.
- Docker image/runtime validation remains blocked by the missing Docker Desktop Linux engine pipe. No live PostgreSQL transaction/migration run or staging verification was performed in this continuation.

### Updated implementation status

- Android: product create/edit, availability control, validated image upload with progress and retryable error state, stock display/adjustment/history, order search/filter/detail/status/audit history, dashboard metrics from the backend, and expired-session/logout cleanup are implemented. Role gating is enforced in the UI and backend. Product archiving and shop-category management are not implemented. Product-create retry after an ambiguous lost response is not durably idempotent, so a manual retry could create a duplicate; no false persistence state is shown. Push notifications remain out of scope until infrastructure support is established.
- Backend: existing product and order APIs are reused; order-status updates require owner/admin authorization, and product edits can no longer bypass audited stock adjustment. The existing transactional inventory route retains idempotency and audit history. The regression harness is not a substitute for live PostgreSQL concurrency verification.
- The existing worktree remains dirty by design and includes the untracked Docker installer and other pre-existing files; nothing was staged, committed, pushed, deployed, reset, or discarded during this continuation.

**Release decision remains unchanged: STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.** Required remaining gates include Android build/tests, an authorized isolated staging target, live database/migration and concurrency verification, container/runtime checks, specialist security/legal review, verified backup/restore and rollback evidence, and explicit release authorization. No claim of security clearance, legal approval, recovery validation, or production readiness is made.

## Product lifecycle and retry-safety continuation — 2026-10-17

### Implemented behavior

- Product archive/restore uses the authenticated manager API and retains historical product/order/inventory records. Public catalog and checkout queries exclude archived products; permanent deletion is rejected.
- Product creation now requires a UUID `Idempotency-Key`. A PostgreSQL transaction lock serializes requests within the shop/admin/key scope; the database records the request fingerprint and product reference. Identical retries replay the product, while reuse with a different normalized payload or uploaded-image hash returns a conflict.
- Shop categories support validated descriptions and slug updates. Product category references are updated in the same database transaction as a slug rename. Category removal is a soft deactivation/reassignment to Uncategorized, never a product deletion.
- Category regression coverage verifies staff cannot rename categories and slug collisions return a conflict without replacing the existing category.
- Android product/archive/category/inventory/order workflows are connected to existing authenticated server routes. Image uploads use multipart requests with local type/size checks and progress reporting. Inventory changes retain request idempotency after a lost response while the ViewModel remains alive, and history displays the server actor, reason, delta, and resulting quantity.
- Android product creation now persists its pending UUID idempotency key, original draft, administrator/shop scope, and copied images in app-private no-backup storage before the request. A process-recreated retry reuses that exact request; changed payloads and cross-account retries are rejected. State is cleared only after a confirmed response. The Android unit suite passes; instrumentation sources compile but instrumentation execution still requires a device/emulator.
- Product archive/restore tests additionally verify restoration preserves both current stock and availability. The focused server test and full JavaScript suite pass.
- Existing push support is browser Web Push for storefront offer publication only. No verified Android/admin order-status notification delivery, provider readiness, or durable event outbox was found; native/admin push remains unimplemented and unverified.

### Latest verification and limits

- `npm test`: **157 passed, 0 failed, 0 skipped**.
- `node --test --test-name-pattern="admin product management supports authenticated create" server\app.test.js`: **1 passed, 0 failed**, including restore preservation of stock and availability.
- Targeted product lifecycle and migration tests: **2 passed, 0 failed**.
- Targeted category permission and slug-collision test: **1 passed, 0 failed**.
- `npm audit --audit-level=low`: **0 reported vulnerabilities**; dependency advisory coverage only.
- `node --check` and `git diff --check` passed with existing line-ending warnings.
- Android verification follow-up is recorded below: 37 unit tests and the debug assemble pass using the Android Studio bundled JBR; instrumentation source compilation passes, but no device/emulator is attached to execute instrumentation.
- `npm run test:e2e`: blocked before test discovery because `PLAYWRIGHT_BASE_URL` is unset. `npm run validate:staging` and `npm run validate:production` fail closed because `.env.staging` and `.env.production` are absent. Production Compose parses with placeholder-only values; Docker cannot reach its `desktop-linux` engine.
- Product-create concurrency was tested with the repository's fake database. No live PostgreSQL transaction, migration, or concurrent request verification was performed. Docker, staging, browser E2E, backup/restore, and rollback evidence remain unavailable.

**Updated decision: IMPLEMENTATION INCOMPLETE; STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.** No production/staging resource was contacted or modified, and no commit, push, deployment, reset, staging, or cleanup was performed. Automated JavaScript and Android unit tests pass, but browser E2E and Android instrumentation execution are blocked by missing targets. No live PostgreSQL concurrency/migration, Docker runtime, backup/restore, rollback, legal/security approval, monitoring, or explicit release authorization was verified. The dependency audit is not a source security review.

## Android build verification and retry-store audit — 2026-10-17

- **Repository:** `feature/admin-v2`, `HEAD d2c755aaf196a57f3ba42d818e371dacda1739f6`. The worktree was already dirty; no staging, commit, push, reset, branch change, or cleanup occurred.
- **Toolchain:** Gradle wrapper `9.6.0`, Android Gradle Plugin `9.4.1`, compile SDK `37`, build-tools `36.0.0`, and JVM source/target `17` are confirmed in project files. `JAVA_HOME`/`java` are not globally configured, but Android Studio is registered at `I:\Android` and its bundled OpenJDK `25.0.3` JBR was compatible with the cached Gradle/AGP stack. Process-local `JAVA_HOME`, `ANDROID_HOME`, and `PATH` settings were used; no software or system settings were installed or altered.
- **Final Android command:** from `phone app`, `.\gradlew.bat --offline :app:testDebugUnitTest :app:assembleDebug :app:compileDebugAndroidTestKotlin` — **exit 0**. The Android unit suite passed **37/37** (21 repository, 16 ViewModel), the debug APK was assembled, and Android instrumentation source compiled. The unit XML reports show zero failures/errors/skips. Instrumentation tests were not executed: `emulator -list-avds` returned no AVDs and `adb devices -l` reported no attached device.
- Initial compiler/test runs found defects that were fixed rather than suppressed: `AtomicFile.exists()` was replaced with a base-file existence check; the archive request model import and nullable image MIME guard were corrected; Android test call sites/types/imports were repaired; deterministic I/O dispatcher injection stopped tests leaking work across `Dispatchers.Main` resets; and the fake upload repository now records its progress callbacks.
- Added instrumentation assertions that pending image corruption/missing files fail closed and another admin or shop cannot reuse the pending operation. These new tests were compiled, not run.
- Retry-store review: the atomic JSON operation record contains the immutable idempotency key, normalized draft, admin/shop scope, image metadata and SHA-256 values. Image bytes are copied and synced in `noBackupFilesDir`; load re-checks metadata, path, size, hash, and draft fingerprint before the repository/API call. The ViewModel checks current identity and clears only after a confirmed response; thrown/lost responses retain the operation. The production `AndroidPendingProductCreateStore` is used by the application, while unit tests use an in-memory fake; real process-death persistence remains covered only by compiled instrumentation source, not an executed device test. Server idempotency fingerprint conflict and same-key replay tests use the fake database; PostgreSQL behavior remains unverified.
- Backend evidence: `npm test` **157/157**; targeted product/archive-retry and category permission tests **2/2**; dependency audit **0 vulnerabilities** (dependency advisories only); syntax checks passed for **27** changed/untracked JavaScript files; placeholder-only production Compose config parsed. No live DB or migration was used.
- Browser E2E is blocked before discovery because `PLAYWRIGHT_BASE_URL` is unset. Docker CLI 29.8.2 cannot connect to the missing `desktop-linux` engine pipe. `.env.staging` and `.env.production` are absent; no target or credentials were invented.

**Release decision: STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.** Remaining gates include approved isolated staging and browser target, live PostgreSQL migration/concurrency evidence, Docker runtime, backup/restore, rollback rehearsal, required security/legal review, monitoring/on-call readiness, and explicit release authorization.

## Android backup-recovery and staging-readiness follow-up — 2026-10-17

- Fresh Android validation exited 0: **37/37** unit tests passed, debug APK assembled, and instrumentation sources compiled. No instrumentation tests were executed because `adb devices -l` showed no device and `emulator -list-avds` returned no AVDs.
- Retry-store inspection identified an AtomicFile recovery edge: if the main operation file is absent while its `.bak` file remains, returning `null` could incorrectly treat an unresolved create as absent. The store now opens AtomicFile when either the base or backup exists; a backup-recovery instrumentation regression test was added. The source/test compile, but this backup recovery behavior is not claimed as device-runtime verified.
- Fresh checks: `npm test` **157/157**; `npm audit --audit-level=low` **0 vulnerabilities**; `node --check` for 27 changed/untracked JS files passed; `git diff --check` passed with pre-existing line-ending warnings. No live PostgreSQL was contacted.
- Instrumentation, Playwright, and Docker execution are blocked by no emulator/device, unset `PLAYWRIGHT_BASE_URL`, and the unavailable Docker Engine named pipe. Both staging and production config validators correctly exit 1 because the secret-bearing environment files are absent. No staging or production runtime was contacted.
- The deployment runbook now lists staging provisioning gates, required evidence, and an ordered safe provisioning plan. Infrastructure, database, secrets, endpoint, backup/restore, rollback, monitoring, and required approvals remain unverified; the checklist does not imply provisioning.

**Decision unchanged: STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.** The highest-priority next action is to obtain an authorized isolated staging owner/target and written scope, then provision it with separate runtime/database/secrets before attempting any staging validation.

## Post-instrumentation integration audit — 2026-10-17

### Verified Android results

- Re-ran from `phone app`: `.\gradlew.bat --offline :app:testDebugUnitTest :app:assembleDebug :app:connectedDebugAndroidTest` — **exit 0**, unit tests **37/37**, instrumentation **6/6**, debug APK assembled. The fresh XML report at `phone app/app/build/outputs/androidTest-results/connected/debug/TEST-emulator-5554 - 14.xml` identifies device `emulator-5554`, model `PHZ110`, Android 14/API 34, six tests and zero failures/errors/skips.
- Instrumentation scope: Keystore token encryption/clear (1), pending product state/image/scope/recovery (4), and a fake-repository sign-in/dashboard/products/product-detail/orders/order-detail/logout flow (1). This does not test real HTTP authentication or the full admin workflow end to end.
- `screen_dashboard.xml` gives all four metric TextViews match-parent width/wrap-content height. The navigation test checks that the orders metric is displayed; it is not a screenshot, metric-value, small-screen, or accessibility test.

### Retry and authentication findings

- Code trace verified Android durable operation data → ViewModel identity/fingerprint check → Retrofit `Idempotency-Key` header → authorized Express product route → transaction-scoped advisory lock and `(shop_id, admin_user_id, idempotency_key)` record/fingerprint → original product replay or 409 conflict. Android retains pending state until confirmed success; on-device cases cover AtomicFile backup recovery, store recreation, copied-image integrity, and admin/shop scope.
- Audit found and fixed a server ambiguity defect: if a COMMIT acknowledgement is lost after commit, the former error path could delete the image file referenced by the committed product. The route now releases/rolls back the uncertain transaction, reacquires the same advisory lock, and looks up the durable idempotency record before deciding how to respond or clean up. If reconciliation itself fails, it retains files and reports the unresolved error. A regression test simulates persisted fake state followed by a lost acknowledgement, verifies the product and image remain, and verifies same-key replay. This is fake-pool evidence only, not PostgreSQL commit-failure evidence.
- `npm test`: **159/159 passed** after adding regressions for both successful reconciliation and safe file retention when reconciliation is unavailable. `npm audit --audit-level=low`: **0 vulnerabilities**. Changed JS syntax and `git diff --check` passed.
- Authentication code inspection: server-side session rows are database-backed and per-request authorization joins check token `jti`, DB expiry/revocation, user/session version, shop and current membership. JWTs use HS256/issuer and eight-hour expiry. Logout revokes the current token; password and membership/role changes invalidate affected sessions. Existing tests verify invalid credentials, protected-route denial, expiry, logout revocation with another session preserved, password-change invalidation, member-role/removal revocation, and cookie flags against a fake pool. Android bearer tokens use Android Keystore AES-GCM; its instrumentation test verifies encrypted-at-rest storage and clearing.
- Session persistence across an app restart depends on the same persistent PostgreSQL database and JWT signing secret. No restart, revocation race, or restore scenario was executed with real PostgreSQL. Express login throttling is process-local memory and resets on restart/is not shared among replicas.

### PostgreSQL and staging blockers

- `pg_isready -h 127.0.0.1 -p 5432` reports a local PostgreSQL listener, but read-only `psql` identity inspection exited 2 because no password was supplied. Identity/isolation are unverified, so no writes, migrations, fixture setup, or cleanup were performed. Other checked local ports 54329, 55432, and 55441 did not respond. Current transaction/idempotency/migration tests are fake-pool or static checks.
- Migration code inspection found advisory locking, migration checksums, and per-version transaction/rollback. Base schema initialization runs sequential DDL before the versioned migration runner; clean install, prior-schema upgrade, and failure recovery remain unverified against a real supported PostgreSQL instance.
- `.env.staging` and `.env.production` are absent; validators exited 1 as designed. Playwright URL/host variables are unset. Docker cannot connect to the `desktop-linux` engine. No staging or production resources were accessed.

**Staging remains BLOCKED / NOT READY; production remains NO-GO.** First obtain an identified, authorized, dedicated disposable PostgreSQL test target. Do not run migrations against the currently unidentified local listener.

## Fresh autonomous master-audit follow-up — 2026-10-18 22:18 +06

This is a bounded local follow-up, not completion of the master audit and not a security certification. It reuses prior repository evidence only where identified as historical and records fresh checks separately. No application behavior, dependency, deployment, database, or owner decision was changed.

### Baseline and tool availability

- Repository: `C:\Users\Abidh\OneDrive\Desktop\storefront`; branch `feature/admin-v2`; HEAD `d2c755aaf196a57f3ba42d818e371dacda1739f6`.
- Starting Git state: 58 modified tracked paths, 119 untracked paths, 0 staged, 0 deleted, 0 conflicts. The repository was already dirty; the untracked `Docker Desktop Installer.exe` and all other existing work were preserved.
- Windows; Node.js `v24.21.0`, npm `11.19.0`, Python `3.14.7`, Java `17.0.20.1`, Docker CLI `29.8.2`. Android SDK and Chromium were present; `adb` was unavailable and the Docker Engine was unreachable.
- `.env.staging`, `.env.production`, `TEST_DATABASE_URL`, and the opt-in catalog PostgreSQL test configuration were absent/unset. No `.env` contents were read or emitted. A dedicated secret-scanner executable was unavailable.
- No approved primary SHOPADEMIA-MGS-001/V2 annex or owner approval for D1-D12 was established. The existing [requirements recovery report](./docs/REQUIREMENTS_RECOVERY_REPORT.md) and [owner decision register](./docs/OWNER_DECISIONS_REQUIRED.md) remain authoritative project blockers; this pass did not infer a business rule.

### Current coverage matrix

| Feature / subsystem | Source and route surface | Auth / expected behavior evidence | Fresh verification and coverage gap | Status |
|---|---|---|---|---|
| Public storefront, catalog, cart and policy pages | [index.html](./index.html), [js/main.js](./js/main.js), [server/app.js](./server/app.js); public pages and catalog GET routes | Current rendered behavior and source; policy/consent behavior is only partially accepted absent owner/legal approval | Public Chromium suite exercised 19 cases: 16 passed, 3 product-dependent cases skipped because the read-only preview has no products. Axe found no violations on Home, Shops, Privacy and Terms. No Firefox/WebKit, assistive-technology, full checkout or Bangla acceptance run. | PARTIAL |
| Guest checkout, pricing, idempotency and stock | [server/app.js](./server/app.js), [server/orders.js](./server/orders.js), [server/db.js](./server/db.js); public `POST /api/v1/orders` | Guest access is currently allowed; server calculates prices, uses a shop-scoped event ID and transaction-scoped managed-product rows/stock reservation. D1 checkout identity remains unresolved. | Node/API tests passed with fake pools. The guarded PostgreSQL test was skipped; no real database concurrency, rollback, ambiguous-commit or multi-process claim is made. | BLOCKED |
| Admin authentication, sessions and authorization | [server/app.js](./server/app.js), [server/platform.js](./server/platform.js), [server/adminSecurity.js](./server/adminSecurity.js) | Server checks HS256/issuer, persisted session/revocation/expiry/version, current shop membership and role. Mutating cookie-auth requests require the configured same origin; privileged routes have server middleware. | Full Node tests passed, including representative denial, expiry, revocation, cookie and role-change cases using fake pools. No complete endpoint-by-endpoint identity matrix, real PostgreSQL session race, or privileged browser run. | PARTIAL |
| Manual bKash review, fulfillment and refunds | [server/app.js](./server/app.js), [server/orders.js](./server/orders.js), [server/platform.js](./server/platform.js) | Source implements manual `pending/verified/rejected` review and a separate fulfillment lifecycle; it does not establish provider settlement/authenticity or an order-linked refund policy. | No provider sandbox, reconciliation, replay, refund, or live payment action was run. D3/D8 and related lifecycle decisions remain unresolved; no behavior was invented. | BLOCKED |
| PostgreSQL schema, migrations, transactions and recovery | [server/db.js](./server/db.js), [server/migrations.js](./server/migrations.js) | Source has constraints, a unique shop/event index, row locks and per-version migration transaction/checksum/advisory lock; base schema initialization also runs sequential DDL outside one encompassing transaction. | Fake-pool migration/API tests passed. No authorized writable target, real PostgreSQL transaction/concurrency/failure test, backup restore, rollback rehearsal, or RPO/RTO evidence. | BLOCKED |
| Rate limits, sessions across instances and ingress | [server/app.js](./server/app.js), [server/platform.js](./server/platform.js), [docker-compose.production.yml](./docker-compose.production.yml) | Limiters use default process-local MemoryStore and `req.ip`; Compose declares one app service and one trusted proxy hop, but does not prove actual runtime topology or IP derivation. | Source/config review only. No two-process test or shared store; owner must decide supported topology and storage-outage behavior. | BLOCKED |
| Android admin client | [phone app/app/build.gradle.kts](./phone%20app/app/build.gradle.kts), Android data/UI sources and tests | Debug base URL is loopback; release requires HTTPS. Current unit sources exercise repository and ViewModel paths. | Isolated temporary copy: 39 JVM tests, 0 failures, 2 target-dependent skips; debug APK built and instrumentation source compiled. No device/emulator execution (`adb` unavailable), and no live API integration. | PARTIAL |
| Dependencies, CI and deployment config | [package.json](./package.json), [package-lock.json](./package-lock.json), [ci.yml](./.github/workflows/ci.yml), Compose files and config validators | CI source runs npm tests/audit, CSS build, config parsing, Caddy validation and image build; local configuration validators fail closed when secret-bearing files are absent. | Fresh npm audit reported 0 advisories; both Compose templates parsed. Validators exited 1 because `.env.staging`/`.env.production` are absent. CI was not run remotely; Docker image/Caddy runtime, remote protections and secret provenance were not verified. | PARTIAL |

### Findings and disposition

- No new reproducible application defect with an approved expected behavior was confirmed in this follow-up; no application-code change was justified.
- The checkout stale-cache correction remains source- and fake-test-supported, but PostgreSQL locking and oversell behavior remain **NOT TESTED** on real PostgreSQL.
- Process-local rate limiting is a verified source limitation, not distributed protection. Keep the multi-instance guarantee **BLOCKED** until topology and outage policy are approved and two independent processes are tested.
- The previously documented static-root realpath/open time-of-check/time-of-use concern remains potential and unproven under the actual runtime filesystem permissions. No concurrent replacement reproduction or immutable-root verification was performed here; do not treat it as fixed or as a confirmed exploit.
- Payment, refund, retention, inventory/fulfillment, and checkout identity policies remain owner decisions. See [OWNER_DECISIONS_REQUIRED.md](./docs/OWNER_DECISIONS_REQUIRED.md); no policy was changed.

### Release gates and final disposition

- Requirements and scope approval: **BLOCKED** by missing primary specification/annex and unresolved owner decisions.
- Application functionality/security: **PARTIAL**; local suites passed, but full route/role acceptance and live integrations remain incomplete.
- Database integrity/recovery: **BLOCKED**; no isolated writable PostgreSQL or restore evidence.
- Authorized staging/infrastructure: **BLOCKED**; secret files/target authorization absent and Docker Engine unavailable.
- Production release authorization: **NO-GO**.
- This audit follow-up did not inspect or revalidate every repository feature, route, Android device journey, legal requirement, external service or historical report. Treat this evidence as applying only to the tested dirty working tree. Exact commands and skips are in [docs/TEST_REPORT.md](./docs/TEST_REPORT.md).

### Independent final verification — 2026-10-18 22:29 +06

- After documenting the audit, independently reran `npm.cmd test` against the current source: exit 0; 166 tests, 165 passed, 0 failed, 1 skipped. The PostgreSQL concurrency case remains skipped because its authorized isolated target is unavailable.
- Reviewed the final report additions and status. Relative to the immediate pre-edit diff counts, the already-modified [AUDIT_REPORT.md](./AUDIT_REPORT.md) grew by 49 lines and [TEST_REPORT.md](./docs/TEST_REPORT.md) grew by 46 lines, with append-only audit evidence and one clarification to the Compose result description. No application/test source changed in this audit follow-up.
- Final `git diff --check`: exit 0, with existing line-ending warnings. Branch/HEAD and counts remain `feature/admin-v2` / `d2c755aaf196a57f3ba42d818e371dacda1739f6`, 58 modified tracked, 119 untracked, 0 staged, 0 deleted, 0 conflicts. No pre-existing or untracked work was intentionally discarded or overwritten.
- These final checks corroborate local tests and report/worktree integrity only. They do not close unresolved product, database, device, infrastructure, payment, recovery, or release-authorization gates. **Overall status: PARTIAL; staging BLOCKED / NOT READY; production NO-GO.**

## Continued audit — checkout replay, Android availability, and database gate (2026-10-18 22:41 +06)

This continuation resumes the existing coverage matrix; it does not restart the audit. It preserves the captured dirty-worktree baseline and addresses the highest-priority safely actionable checkout concern identified in the prior continuation.

### Baseline, evidence and change ledger

- Branch/HEAD remain `feature/admin-v2` / `d2c755aaf196a57f3ba42d818e371dacda1739f6`. Starting/current status is 58 modified tracked paths, 119 untracked paths, zero staged paths; the project was already dirty. No pre-existing work was staged, committed, pushed, switched, cleaned, reset, stashed, discarded or overwritten.
- The D1 contract trace and existing retry test establish that an unchanged request with the same shop-scoped `eventId` replays the saved order. Existing archived-product tests establish that a *new* order must not accept an archived product. The unresolved customer-authentication choice is not implicated by this finding.
- **Original defect reproduced:** after a successful order, archiving its managed product caused an identical retry to return HTTP 400 instead of replaying the saved order. The cause was the checkout row query filtering archived products before the transaction checked for an existing `eventId`.
- **Correction:** [server/app.js](./server/app.js) now loads and locks the requested managed-product row, including archived rows, inside the checkout transaction. It checks for and replays an existing order before rejecting an archived product for a new order. New archived-product checkout remains rejected; no identity, pricing, payment, inventory, cancellation or refund policy was changed.
- **Regression:** [server/app.test.js](./server/app.test.js) adds a fake-pool API case that creates an order, archives the product and retries with the same request. It asserts HTTP 200, the same order number and subtotal, one persisted order, and exactly one reserved stock unit. Fake-pool support mirrors the SQL predicate and archive update; it does not model PostgreSQL locking or concurrency.
- **Audit change ledger for this continuation:** `server/app.js`, `server/app.test.js`, `AUDIT_REPORT.md`, `docs/TEST_REPORT.md`, and `docs/OWNER_DECISIONS_REQUIRED.md`. The two source files had extensive pre-existing modifications; only the described checkout query/guard and targeted regression-fixture/test hunks were added. The reports were appended; the owner decision itself was not changed.
- This supersedes the earlier catalog section's statement that checkout excludes archived products at the row-query stage. The resulting behavior intentionally loads archived rows so an existing order can be found, then rejects the archived product only if no prior order exists.

### Updated coverage and disposition

| Finding | Classification | Current evidence and closure condition |
|---|---|---|
| Replay after the ordered product is archived | **VERIFIED FAIL reproduced, then regression PASS with fake pool** | Before correction, the new regression failed: expected HTTP 200, received 400. After correction, the regression and existing archive-rejection/idempotency cases pass. This is local API/fake-pool evidence only. Close the database-concurrency component only with the already-authorized isolated PostgreSQL test target and results; no such target is available now. |
| Checkout rollback, duplicate retry and stock contention | **PARTIAL / REAL DATABASE BLOCKED** | The current Node suite and earlier focused fake-pool tests cover rollback, same-request replay, changed-payload conflict and inventory reservation at the mocked API layer. The full run still skips the opt-in PostgreSQL competing-checkout test. Fake transactions do not verify PostgreSQL locking, rollback or simultaneous processes. |
| Android instrumentation availability | **BLOCKED / NOT RUN** | Direct SDK checks: `adb devices -l` returned only the heading and no device; `emulator -list-avds` returned no AVDs; `%LOCALAPPDATA%\Android\Sdk\system-images` is absent. Android emulator/device instrumentation was not run. Close when an authorized device or configured AVD/system image is available, then run the repository's instrumentation task. |
| Writable PostgreSQL target and checkout concurrency | **BLOCKED / NOT RUN** | The guarded integration test remains opt-in and requires an explicitly identified, marked, non-superuser writable isolated target. No target was authorized or positively verified; the read-only preview remains prohibited for writes. The full test run reports the PostgreSQL integration case skipped. Close only after independent target identity/ownership/isolation evidence and an authorized test run; do not infer safety from URL, name or environment variables. |
| Multi-instance rate limiting/session behavior, payment verification/refunds, recovery and release gates | **BLOCKED / OWNER DECISION REQUIRED / EXTERNAL EVIDENCE REQUIRED as previously recorded** | No deployment, provider, live database, Android device, staging or production system was contacted. Existing topology and D1/D3/D8 decisions remain unresolved. See the coverage matrix and [OWNER_DECISIONS_REQUIRED.md](./docs/OWNER_DECISIONS_REQUIRED.md); no single-process fake test closes these gates. |

### Validation and remaining prioritized backlog

- `node --test --test-name-pattern='checkout|persists a correctly priced order' server/app.test.js` — **PASS**, 8 passed, 0 failed, 0 skipped. Local API tests use the repository's fake pool.
- `npm.cmd test` — **PASS**, exit 0; 167 tests, 166 passed, 0 failed, 1 skipped. The skip is the opt-in PostgreSQL checkout/concurrency integration test; it is not a PostgreSQL pass. Node.js `v24.21.0`, npm `11.19.0`.
- Before the fix, `node --test --test-name-pattern='checkout retries replay a saved order after its product is archived' server/app.test.js` — **FAIL as expected to reproduce the defect**, exit 1; expected 200, got 400. This was not a final-state failure.
- Prior check evidence: connected-device list empty, configured AVD list empty and no Android system-images directory. No instrumentation task was attempted against a nonexistent target.
- Prior guarded PostgreSQL setup review remains in force: no authorized isolated writable database, no database writes/migrations/seeds, and no use of the read-only preview. Exact guard variables and marker requirements are in [server/catalog-postgres.integration.test.js](./server/catalog-postgres.integration.test.js).
- **Prioritized open work:** (1) obtain owner-authorized and independently verified isolated PostgreSQL identity/authorization/isolation evidence, then run checkout concurrency, retry and rollback integration tests; (2) provide an Android device or configured AVD for instrumentation; (3) approve the supported deployment topology and shared-rate-limit/session verification; (4) resolve D1/D3/D8 and complete payment/refund and customer-identity acceptance tests; (5) complete backup/restore, staging authorization and independent production release gates.
- Current outcome remains **PARTIAL**. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

### Independent final verification — 2026-10-18 22:42 +06

- After the source correction and append-only report updates, independently reran the focused critical cases: `node --test --test-name-pattern='checkout retries replay a saved order after its product is archived|checkout rejects a managed product archived in the database|persists a correctly priced order and returns the same order for a retry' server/app.test.js` — **PASS**, 3 passed, 0 failed, 0 skipped. The broad `npm.cmd test` run above was also against the final application/test source; no source changed afterward.
- Reviewed the final checkout query/guard, fake-pool support and regression case, plus each new report addendum against this continuation's change ledger. No unrelated file was changed by this continuation; all pre-existing dirty-worktree changes were preserved.
- Final `git diff --check` — **PASS**, exit 0. Git still reports only existing LF-to-CRLF working-copy warnings. Final status is 58 modified tracked paths, 119 untracked, 0 staged, 0 deleted, 0 conflicts; branch/HEAD unchanged. No test outputs, secrets or generated files were added to the repository.
- The independent pass verifies local source and report consistency only. PostgreSQL, Android instrumentation, multi-instance topology, provider/payment, recovery, staging and production gates remain open. **Overall: PARTIAL; staging BLOCKED / NOT READY; production NO-GO.**

## Checkout idempotency verification continuation — 2026-10-18 23:16 +06

### Refreshed baseline and change ledger

- Rechecked the repository before action: branch `feature/admin-v2`, HEAD `d2c755aaf196a57f3ba42d818e371dacda1739f6`; 58 modified tracked paths, 119 untracked paths, 0 staged, 0 deleted, 0 conflicted. The existing user worktree is intentionally dirty. No user changes were reverted, overwritten, staged, committed, pushed, switched, reset, cleaned, stashed, or discarded.
- Reviewed the current audit, test, owner-decision, defect, release-evidence, audit-log, verification-matrix, project-completion, checkout, schema, and test-harness files. Relevant pre-existing application changes remain intact.
- Test-only changes in [server/app.test.js](./server/app.test.js): fake-pool support for a COMMIT that durably applies state and then loses its acknowledgement; an API regression for recovering that order with the same event ID; and stronger rollback assertions for absence of partial order, stock, or activity-log state. No production application behavior changed in this continuation.
- Change ledger for this continuation: [server/app.test.js](./server/app.test.js), [AUDIT_REPORT.md](./AUDIT_REPORT.md), [docs/TEST_REPORT.md](./docs/TEST_REPORT.md), [docs/RELEASE_EVIDENCE_REGISTER.md](./docs/RELEASE_EVIDENCE_REGISTER.md), [docs/audit/VERIFICATION-MATRIX.md](./docs/audit/VERIFICATION-MATRIX.md), and [docs/audit/AUDIT-LOG.md](./docs/audit/AUDIT-LOG.md). The matrix and log were clean in the refreshed baseline; the release register was already untracked. Other listed files had pre-existing modifications. All report changes were append-only.
- The regression asserts the original request receives a generic HTTP 500 while the simulated committed order persists; the same request then receives HTTP 200 for the same saved order. Assertions cover one order, one inventory decrement, and one order-created activity-log insertion after retry. The fake pool is not evidence of PostgreSQL semantics.

### Checkout path, idempotency scope, and risk review

- Observed request path in [server/app.js](./server/app.js) / [server/orders.js](./server/orders.js): validate active shop; begin transaction; collect managed IDs and sort them; select shop-scoped managed product rows in `ORDER BY id FOR UPDATE`; server-price/validate request; fingerprint; select existing `(shop_id, event_id)` order `FOR UPDATE`; replay a match or return 409 for changed details; reject an archived product for a new order; conditionally reserve stock; insert the order with `ON CONFLICT (shop_id, event_id) DO NOTHING`; insert the activity log; commit; only then update the process catalog snapshot.
- [server/db.js](./server/db.js) creates unique index `orders_shop_event_id_idx` on `(shop_id, event_id)`. **The event ID is scoped per shop**, not global and not tied to a customer identity. It is a retry key, not authentication or authorization. Guest checkout remains public and the existing separate order-number-plus-phone lookup contract is unchanged.
- The request fingerprint includes shop, customer name, normalized phone, address, bKash number, product IDs/quantities, and advance amount; it does not treat the event ID as identity. Existing coverage proves a materially changed address for a reused event ID returns 409. A same-request retry replays saved persisted amounts, including after product archive.
- Source inspection finds deterministic ordering for requested managed-product row locks and the same `product rows → existing event-order lookup → insert` sequence across checkout requests. The unique constraint and rollback-on-conflict path are present. This is static ordering/constraint evidence only: no claim is made that PostgreSQL has been shown deadlock-free or that cross-process duplicate requests/stock contention are safe.

### Checkout cases and evidence classification

| Case | Result | Evidence / limitation |
|---|---|---|
| New event creates one order; identical retry returns the saved order | **PASS — fake-pool API** | Existing checkout retry test; one logical event record. |
| Retry after archive returns the original order and does not reserve stock twice | **PASS — fake-pool API** | Regression checks same order number/subtotal, one order, and one unit reserved once. |
| New event for an archived product remains rejected | **PASS — fake-pool API** | Existing regression returns 400 and creates no order or stock mutation. |
| Reused event ID with materially changed details | **PASS — fake-pool API** | Existing contract test returns 409. |
| Rollback after order persistence failure | **PASS — fake-pool API** | Injected failure asserts zero orders, unchanged database stock, and zero order-created log entries after rollback; a retry then creates one order and one reservation. No live PostgreSQL transaction was exercised. |
| Commit applied but response lost; retry recovers original result without duplicate stock/log/order | **PASS — fake-pool API** | New regression injects `ECONNRESET` after the fake commit persists; first response is generic 500, retry is 200, and counts remain one. This does not simulate a real network or PostgreSQL connection failure. |
| Guest checkout/order lookup contract | **PASS — fake-pool API** | Existing tests still pass; no identity or authorization semantics changed. |
| Same-event requests truly concurrent across PostgreSQL connections/processes; event-ID conflict/deadlock behavior | **BLOCKED / NOT TESTED** | PostgreSQL integration was not enabled and no authorized isolated target is available. The fake pool serializes transaction clients and cannot prove concurrency. |
| Competing checkouts for the last stock unit; transaction rollback/commit ambiguity on PostgreSQL | **BLOCKED / NOT TESTED** | Guarded `server/catalog-postgres.integration.test.js` remained skipped. No unverified DB was contacted or written. |

### Fresh validation and independent gates

- Final focused rerun at 23:16: `node --test --test-name-pattern='persists a correctly priced order and returns the same order for a retry|checkout retry recovers the committed order after a lost commit acknowledgement|checkout prices managed products from database state instead of a stale process catalog|checkout retries replay a saved order after its product is archived|checkout rejects a managed product archived in the database despite a stale active cache|checkout rolls back inventory reservation when order persistence fails|rejects reuse of an idempotency key for changed order details|accepts a matching retry of a pre-hash legacy order|customers can look up an order with the checkout phone and receive only customer-safe details|order lookup does not reveal whether an order exists when the phone does not match' server/app.test.js` — **PASS**, 10 passed, 0 failed, 0 skipped, exit 0.
- Final broad rerun after the strengthened rollback assertions: `npm.cmd test` — **PASS**, 168 tests, 167 passed, 0 failed, 1 skipped, exit 0. The single skip is the explicitly gated PostgreSQL checkout/concurrent-oversell integration test, not a database pass. Node.js `v24.21.0`; npm `11.19.0`.
- First focused attempt of the new lost-COMMIT test failed one assertion because the fake-pool activity counter was checking a parameter instead of the SQL literal `order.created`. The harness predicate was corrected; the isolated regression then passed, followed by the final focused and broad passing runs. This was a test-harness defect; no assertion was weakened.
- PostgreSQL gate rechecked without connecting: `TEST_DATABASE_URL` absent; catalog PG opt-in and URL/database/role settings absent. The guarded test requires explicit target identity/marker/role/write-mode checks plus owner authorization and verified isolation. The read-only browser preview is not an eligible write target. No DB writes, migrations, seeds, or cleanup ran.
- Android gate rechecked: `adb devices -l` listed no device; `emulator -list-avds` returned no configured AVD; Android SDK `system-images` directory absent. Instrumentation is **BLOCKED / NOT RUN**; no image/device was provisioned.
- Independent final review: the updated checkout test and its exact assertions were inspected; the final suite covers the current test source. No security assertions or skip conditions were weakened. The two previously clean tracked audit-log/matrix files now add two modified tracked paths, so end-state Git status is 60 modified tracked paths, 119 untracked, 0 staged/deleted/conflicted; branch and HEAD unchanged.
- Remaining gates: real PostgreSQL transactions/concurrency and recovery; device instrumentation; supported multi-instance rate-limit/session topology; owner decisions D1/D3/D8 and payment/refund acceptance; backup/restore; authorized staging and independent production approval. Overall **PARTIAL**; staging **BLOCKED / NOT READY**; production **NO-GO**.

## Local continuation verification — 2026-10-18 23:23 +06

### Fresh checks

- `npm.cmd test` — **PASS**, exit 0: 168 tests, 167 passed, 0 failed, 1 skipped. The skipped case is `server/catalog-postgres.integration.test.js`; its opt-in guard was not enabled. This suite's checkout/database fakes do not establish PostgreSQL concurrency or recovery behavior.
- Focused checkout retry/rollback/lookup regressions at 23:26 — **PASS**, exit 0: 10 passed, 0 failed, 0 skipped. This reran the exact 10-case command recorded earlier in `docs/TEST_REPORT.md`; coverage uses the repository fake pool.
- `npm.cmd run test:e2e -- --workers=1 --reporter=line`, with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002/` and output/report paths configured under `%TEMP%` — **PASS**, exit 0: 19 tests, 16 passed, 0 failed, 3 skipped. The skipped tests require an available marketplace product; no checkout/order submission or privileged/admin browser flow was performed. Automated accessibility checks reported no violations on Home, Shops, Privacy, and Terms in this run. This is local loopback-preview evidence only.
- `git diff --check` — **PASS**, exit 0. Git printed existing LF-to-CRLF working-copy warnings; no whitespace errors were reported.
- Tool versions: Node `v24.21.0`, npm `11.19.0`, Git `2.56.0.windows.2`. The evidence run was recorded at `2026-10-18 23:23 +06`.

### Rechecked blockers and limits

- The integration test's exact environment settings `SHOPADEMIA_CATALOG_PG_TEST`, `SHOPADEMIA_CATALOG_PG_DATABASE_URL`, `SHOPADEMIA_CATALOG_PG_DATABASE`, and `SHOPADEMIA_CATALOG_PG_ROLE` are absent. No PostgreSQL connection or write was attempted. There is still no positively verified, owner-authorized isolated writable target. To run the guarded test safely, the owner must provide authorization and independent target-separation evidence, then a loopback-only marked database and dedicated non-superuser role with the test's required identity, write, and active-shop prerequisites. The existing read-only browser preview is not a writable integration target.
- Android instrumentation remains **BLOCKED / NOT RUN**: `adb` and `emulator` commands are unavailable and `ANDROID_SDK_ROOT` is absent or points to a missing path. No device or AVD could be discovered; no image or software was downloaded or installed.
- This pass adds no new live security, multi-instance session/rate-limit, migration/rollback, backup/restore, provider, staging, or production verification. Existing mock/source evidence does not close these gates. Rate-limit/session behavior under the supported deployment topology remains unverified; owner decisions and operational targets remain open.

### Change ledger and disposition

- This pass changed only these existing evidence files, by appending this verification: `AUDIT_REPORT.md`, `docs/TEST_REPORT.md`, `docs/RELEASE_EVIDENCE_REGISTER.md`, `docs/audit/VERIFICATION-MATRIX.md`, and `docs/audit/AUDIT-LOG.md`. All five were already modified or untracked at the fresh starting baseline. No application or test source was changed.
- Starting and final Git state: branch `feature/admin-v2`, HEAD `d2c755aaf196a57f3ba42d818e371dacda1739f6`, 60 modified tracked paths, 119 untracked paths, 0 staged, 0 deleted, 0 conflicted. Existing modifications and untracked paths were preserved; Playwright outputs were directed outside the repository.
- No new reproducible defect with an established expected behavior was confirmed. Overall remains **PARTIAL**; staging **BLOCKED / NOT READY**; production **NO-GO**.

## PostgreSQL integration gate and audit continuation — 2026-10-19

### Verified blocker and exact requirements

The guarded PostgreSQL integration test in [server/catalog-postgres.integration.test.js](./server/catalog-postgres.integration.test.js) remains **BLOCKED / NOT RUN** because the required opt-in and identity settings are absent. The test requires all of the following variables to be set and valid before any write is attempted:

- `SHOPADEMIA_CATALOG_PG_TEST='1'`
- `SHOPADEMIA_CATALOG_PG_DATABASE_URL` (loopback-only PostgreSQL URL to the isolated target)
- `SHOPADEMIA_CATALOG_PG_DATABASE` (exact target database name expected by the test)
- `SHOPADEMIA_CATALOG_PG_ROLE` (exact non-superuser role name expected by the test)

The test asserts the database is reachable at `127.0.0.1`, the current role is not a superuser, `transaction_read_only='off'`, the database marker matches `SHOPADEMIA_CATALOG_CONSISTENCY_TEST`, and the role marker matches `SHOPADEMIA_CATALOG_TEST_ROLE`. It then creates temporary managed-product and order rows for a known `shop_id` and cleans them up in `t.after()`; the cleanup deletes matching orders and products for the synthetic IDs. It is designed to be a write-only isolated integration test, not a local preview or a shared development database.

No database writes, migrations, seeds, or cleanup were attempted because the required authorization and isolation evidence were not present. The local read-only browser preview at `127.0.0.1:3002` and its PostgreSQL preview database on `127.0.0.1:55441` are not eligible integration targets for this gate.

### Evidence from the current command set

- `node --test server/catalog-postgres.integration.test.js` — **SKIPPED**, exit 0: 1 test, 0 passed, 0 failed, 1 skipped. The skip is the guarded PostgreSQL test, not a pass.
- `npm test -- --test-reporter=spec` — **PASS**, exit 0: 168 tests, 167 passed, 0 failed, 1 skipped.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npx playwright test tests/e2e/storefront.spec.js --project=chromium --reporter=line` — **PASS**, exit 0: 19 tests, 16 passed, 0 failed, 3 skipped.
- `adb devices` — **BLOCKED**, command not found; `adb` is unavailable in this environment. No Android emulator or connected device was available.
- `git diff --check` — **PASS**, exit 0.

### Conclusion and next action

This remains a **real PostgreSQL verification blocker**, not a code defect. The required next step is not to change the repository or the database blindly; it is to obtain written authorization and independent proof of an isolated, writable PostgreSQL target with the exact database name, role, host, and least-privilege permissions expected by the integration test. Until that target is verified, staging stays **BLOCKED / NOT READY** and production stays **NO-GO**.

## Current production and source reassessment — 2026-10-19

This update supersedes earlier domain, source-tree, and release notes in this report; all older test numbers and browser observations are historical.

- **Source/release:** baseline HEAD `49ff88d96ef0661d68c91cc81c4d671b63e592aa` on `feature/admin-v2` matched the intended GitHub branch. Hosted CI run `39227369801` passed. Current local changes add a cross-shop metadata regression test and updated evidence reports; they are not yet included in that CI run.
- **Current test evidence:** final `npm test` — 169 total, 168 passed, 0 failed, 1 skipped. The skip is the opt-in PostgreSQL checkout/concurrency test; its isolated database/role markers were not configured. `npm audit --audit-level=low` — zero advisories. `npm run build:css` succeeded. Production and staging config validators failed closed because their private `.env.production` and `.env.staging` files are absent. No lint or type-check script is configured.
- **SEO-001:** current server-rendered product metadata uses `findProductForShop`. A new regression test confirms another active shop cannot render a product's metadata; targeted and full tests passed. The old unscoped-lookup finding is stale for the current source.
- **Live domains:** `shopademia.store` serves Shopademia HTML; `/healthz` returned `{"status":"ok"}` and its same-origin public catalog API returned JSON. `admin.shopademia.store` serves a LiteSpeed directory index listing `cgi-bin` and `php.ini`, while `/admin` is 404. `api.shopademia.store` timed out. HTTPS certificate chains validated. The admin listing is a **Medium-severity information-disclosure/configuration issue**; its listed file contents were not opened.
- **Browser/hosting:** the integrated browser could not load the external site. No isolated local preview was listening on `127.0.0.1:3002`, and the repository Playwright guard refuses production hosts. cPanel exposes Node.js/Application Manager tool links, but navigation failed; actual app runtime, version, vhosts, and process state remain unverified. Previous SSH read-only access was intermittent; no production writes were performed.
- **Data/recovery:** production database owner/schema/records and upload storage remain unidentified. No production backup, checksum, isolated restore, rollback rehearsal, or staging environment was verified. No migration, service restart, DNS/vhost edit, or data mutation was attempted.
- **Mobile:** current HEAD has no Android project. Commit `790a1305f3fde30aafcd6f0c5347d11ba3272d5` removed the previously tracked `phone app` tree; Android build and API compatibility are not verified.
- **Security scope:** no high-confidence credential patterns were found in tracked HEAD. This is not a full secret-history or source security review. The earlier static-file realpath/open race item remains unverified. Rotate any hosting password previously disclosed through the provider's secure interface.

See [docs/PRODUCTION-READINESS-MATRIX-2026-10-19.md](./docs/PRODUCTION-READINESS-MATRIX-2026-10-19.md) and [docs/PRODUCTION-DEPLOYMENT-REPORT-2026-10-19.md](./docs/PRODUCTION-DEPLOYMENT-REPORT-2026-10-19.md) for the full requirement matrix, test counts, route evidence, and safety gates. **Release verdict: PRODUCTION NO-GO — DEPLOYMENT BLOCKED.**

## Post-CI production routing investigation — probes 2026-10-19 09:37 UTC; local validation by 09:45 UTC

This is the latest read-only production diagnosis. It supersedes the domain-routing and GitHub-CI observations above; it does not claim a deployment.

- **Repository and CI:** branch `feature/admin-v2`, HEAD `0786d690983d615bf1ef655909872229bd903f18`; the intended GitHub branch matches. CI run `39230764949` passed for this SHA. The local worktree had no tracked modifications at investigation start; the two unrelated untracked entries were preserved. This CI run validates code/build/config artifacts, not production.
- **Local verification:** `npm test` passed with 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL integration test skipped; `npm audit --audit-level=low` reported zero vulnerabilities. Three focused admin-origin/page/Caddy tests passed. Tailwind CSS built to a temporary output with normalized content matching the checked-in artifact; the temporary output was removed. The additional Caddy regression assertions were made after the hosted CI run and were verified in local tests only.
- **DNS:** all three A records resolved to `122.173.84.249`; the apex AAAA and admin/API CNAME queries returned no answer. DNS resolution does not verify the destination owner or virtual-host configuration.
- **Storefront:** `https://shopademia.store/`, `/healthz`, and `/api/v1/products?limit=1` returned HTTP 200 over verified HTTPS. This establishes a currently responsive storefront and same-origin API only; live release SHA and browser flows remain unverified.
- **Admin:** `https://admin.shopademia.store/` returned HTTP 200 with `Server: LiteSpeed` and `Content-Length: 1593`; the directory listing showed `cgi-bin` and `php.ini`. Neither entry was opened. `/admin` returned HTTP 404. In source, `server/app.js` explicitly serves `/admin` from `admin.html`; static mounts set `index: false`. `Caddyfile` expects the admin hostname to redirect `/` to the storefront and proxy `/admin`, assets, and admin APIs to `app:3000`. The live result is consistent with LiteSpeed serving a different webroot/vhost or missing proxy route; actual server config is not accessible, so the exact defect is unknown. No contents of a sensitive file or secret exposure were confirmed.
- **API hostname:** `api.shopademia.store` resolves to the same IP. Port 443 accepted TCP, HTTPS negotiation completed, and curl sent `GET /healthz`; the server sent zero response bytes before the 10-second timeout. `/` behaved the same. Since the apex health endpoint and public catalog route respond, the app process/database are not globally unavailable; the fault is specific to the API hostname's route/upstream/provider behavior. Whether the cause is missing vhost/proxy, a stalled upstream, or provider filtering requires authorized server logs/configuration.
- **Frontend/security contract:** storefront `js/config/app.config.js` uses relative `/api/v1`, so regular storefront operations are same-origin and do not require the API subdomain. The Caddy API site separately maps allowlisted API paths and `/healthz` to the same app. Admin browser writes require the configured same-origin and use `HttpOnly`, `Secure`, `SameSite=Strict` cookies. The only documented API route explicitly allowing cross-origin read access is the public shop-product feed. No frontend/API-base, CORS, session, or route-source defect was reproduced.
- **Hosting evidence:** the shared cPanel page emitted an HTTP 401 resource error; its visible Tools menu contains “Application Manager” and “Setup Node.js App”. Those menu entries do not verify an enabled/persistent Node 20+ runtime, Docker/Compose, running app, PostgreSQL connectivity, or the three vhosts. A prior SSH read-only observation found PostgreSQL tools, not Node/npm/Docker in the ordinary `PATH`; later connections timed out. No further SSH retry or cPanel setting change was made.
- **Recovery gates:** production database owner/schema/records and uploads remain unknown. Encrypted backup/restore scripts exist in source but were not run against production; no production backup, checksum/integrity evidence, isolated restoration, rollback, staging target, or secret provisioning was verified.
- **Safe remediation decision:** no repository code defect explaining the public responses is established, so no application behavior was changed. The responsible next step is authenticated provider support: disable LiteSpeed directory indexing without deleting files; inspect the webroot read-only; map admin host and `/admin` to the intended Express app; diagnose the API host's vhost/upstream using logs; and confirm Docker/Compose, Node, PostgreSQL, persistence, protected environment, and recovery support. Require written approval before any provider-side changes.
- **Local work in this continuation:** updated the deployment report, readiness matrix, and this audit addendum; added regression assertions in `scripts/staging-config.test.js` for the expected storefront/admin/API Caddy host mappings. No runtime application code, secrets, DNS, production files, services, databases, or uploads were changed. No commit or push was made.

See [docs/PRODUCTION-DEPLOYMENT-REPORT-2026-10-19.md](./docs/PRODUCTION-DEPLOYMENT-REPORT-2026-10-19.md) for the provider support request, and [docs/PRODUCTION-READINESS-MATRIX-2026-10-19.md](./docs/PRODUCTION-READINESS-MATRIX-2026-10-19.md) for the per-host evidence and test gates. **Outcome: PRODUCTION NO-GO — DEPLOYMENT BLOCKED.**

## Authenticated cPanel follow-up — 2026-10-19

This read-only addendum supersedes the earlier cPanel-runtime uncertainty in the prior routing section:

- cPanel Domains maps the apex, admin, and API hostnames to `/home/shopadem/public_html`, `/home/shopadem/admin.shopademia.store`, and `/home/shopadem/api.shopademia.store`, respectively, with HTTPS forced on all three.
- The public storefront and admin responses identify LiteSpeed. This establishes the responding server software, but not whether Nginx is also present upstream or the effective vhost configuration.
- The admin and API hostnames have separate document roots. The admin root's visible File Manager entries are `cgi-bin` (0755) and `php.ini` (374 bytes, 0644); contents and hidden entries were not inspected. The Indexes tool reports `Inherit` for admin and offers a `No Indexing` setting. It was not saved. Bounded `HEAD` requests to `/php.ini` and `/cgi-bin/` returned 403; no sensitive contents or credentials were confirmed exposed.
- cPanel reports one production Passenger application: URI `shopademia.store/`, root `/home/shopadem/shopademia-app`, Node.js `v20.20.2`, startup `server/index.js`, status `started`. That verifies an apex-host Node application is configured and reported started, not that admin/API traffic reaches it or that it is healthy against PostgreSQL. File Manager timestamps for project entries were Oct. 10–12 and cannot establish deployed source identity.
- The displayed cPanel environment-variable names included `DATABASE_URL` and `DATABASE_SSL`; values were not inspected. `ADMIN_SITE_URL`, expected by the current source in production, was not present in the displayed list. cPanel must verify the actual required environment without disclosing values.
- cPanel PostgreSQL lists `shopadem_shopapp` (8.54 MB) and `shopadem_shopuser`; no connection string was inspected, so the app's actual database and data inventory remain unverified. The Backup interface reports no automatic backups and offers partial home/database backup downloads dated Oct. 8. No artifact was downloaded or restored; no isolated restoration or rollback is established. JetBackup yielded no usable evidence.
- The API public probe timed out without response bytes within 10 seconds; the authenticated browser showed the host's HTTP 500 “Request Timeout.” cPanel's Errors page timed out, and no effective vhost/upstream or logs were available. The API failure's exact cause therefore remains unknown, though the sole visible Passenger application is attached only to the apex URI.
- The storefront separately returned HTTP 200 for its root, `/healthz`, and same-origin catalog API. The admin root still exposed an index of directory names and `/admin` returned 404. No production settings, DNS, app files, database, uploads, or processes were changed.
- GitHub API confirms the intended `LiveShopademia:feature/admin-v2` branch and successful Actions run `39230764949` both correspond to `0786d690983d615bf1ef655909872229bd903f18`. Current local reports and Caddy regression assertions remain uncommitted and unpushed; the unrelated untracked entries were preserved.

**Disposition:** `PRODUCTION NO-GO — DEPLOYMENT BLOCKED`. The next action is a provider-supported mapping of `/admin` and API paths to the existing Express/Passenger application, review of the API timeout logs/effective virtual hosts, confirmation of PostgreSQL target and protected production configuration, and verified backup/isolated-restore/rollback evidence. cPanel's `No Indexing` control can suppress the admin directory listing, but using it would modify production and remains gated; it would not repair host routing.

Fresh local verification after this follow-up: `npm test` — 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; `npm audit --audit-level=low` — 0 vulnerabilities; `npm run build:css` passed and a separate build to a temporary path was byte-for-byte identical to `css/tailwind.generated.css`; no CSS asset change remains. `git diff --check` passed. No production changes were made during this follow-up.

## Fresh baseline and public-route recheck — 2026-10-19 16:19 +06

- Branch `feature/admin-v2`, local HEAD `0786d690983d615bf1ef655909872229bd903f18`; GitHub `LiveShopademia:feature/admin-v2` still points to that SHA. CI `39230764949` is green for that baseline only. The current five tracked edits are local and unstaged; both unrelated untracked entries remain untouched.
- DNS A lookups for storefront, admin, and API each returned `122.173.84.249`.
- Fresh HTTPS requests with certificate verification and 10-second maximum: storefront `/` 200 HTML (34,371 bytes, 0.435 s); `/healthz` 200 JSON (15 bytes, 0.264 s); same-origin catalog API 200 JSON (3,770 bytes, 0.260 s). All identify `Server: LiteSpeed`.
- Admin `/` returned 200 HTML (1,593 bytes, 0.357 s; previously identified as a directory index); `/admin` returned 404 HTML (1,251 bytes, 0.239 s). Both identify `Server: LiteSpeed`.
- API `/healthz` returned no HTTP response: curl exit 28 after 10.013 s, HTTP `000`, zero body bytes/content type. This is a hostname routing/upstream failure; the exact cause remains unknown.
- cPanel Indexes for the admin root again showed `Inherit`; `No Indexing` remains available but unapplied. That control suppresses an index listing in directories without a default file and does not fix routing. No production changes were made.
- Source confirms the intended `/admin` and `/healthz` Express routes; storefront API configuration is relative `/api/v1`. README documents Docker Compose/Caddy as the production topology and states the cPanel deployment path is retired. Live cPanel routing is not proved by repository Caddy config.

**Current disposition remains `PRODUCTION NO-GO — DEPLOYMENT BLOCKED`.** The API vhost/upstream and production recovery gates remain unverified; successful storefront responses and baseline CI do not establish a complete release.

Fresh local verification after the recheck: `npm test` — 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; `npm audit --audit-level=low` — 0 vulnerabilities; `npm run build:css` plus an independent temporary build passed. The regenerated asset differs from baseline by removal of only the unused `.isolate{isolation:isolate}` Tailwind utility; source uses no `.isolate` class, while the separate `isolation:isolate` CSS declaration remains. `git diff --check` passed. This local asset correction is not a production deployment.

## Published source candidate and CI — 2026-10-19 16:25 +06

Commit `1ec245ca10a9d4c552b7718ad1ea6c7739ae108c` was pushed to the verified GitHub branch `AbidHossainTushar003/LiveShopademia:feature/admin-v2`. Actions run `39237231146` completed successfully for this exact SHA. Local validation was 168/169 passing (one opt-in PostgreSQL test skipped), zero dependency vulnerabilities, CSS build/comparison passing, and `git diff --check` passing. This is source publication only; the production admin/API failures, database identity, recovery evidence, and release authorization remain blockers. No production changes were made.
