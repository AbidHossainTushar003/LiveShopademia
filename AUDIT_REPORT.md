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
