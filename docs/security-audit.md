# Shopademia security and production-readiness audit

**Audit date:** 2026-10-11 (Asia/Dhaka)  
**Scope:** Read-only source/configuration review and safe dependency audit. No application code, database data, authentication settings, payment records, or migrations were changed.  
**Stack confirmed:** Node.js/Express with PostgreSQL (`pg`), not MySQL (`package.json:23-25`, `server/index.js:6`).  
**Runtime limitation:** Production credentials, deployment host settings, DNS/TLS, and GitHub branch-protection settings were not inspected. The local project may be run separately; no production requests or state-changing browser operations were made for this audit.

The verdicts and evidence in sections 1–6 are the read-only baseline captured before the user-approved remediation. Section 7 records subsequent code changes and validation; it does not imply that external production controls were verified.

The requested list is described as 70 checks and contains 70 unique IDs, but repeats #15 in the final section. The duplicate was consolidated into one row which covers both admin and checkout client-side enforcement. Verdict counts below therefore total 70.

## 1. Summary

| Verdict | Count |
|---|---:|
| PASS | 35 |
| FAIL | 2 |
| PARTIAL | 19 |
| UNVERIFIED | 4 |
| NOT APPLICABLE | 10 |
| **Total** | **70** |

`UNVERIFIED` means repository evidence or safe local checks cannot establish the deployed state; the evidence needed is stated in the table. `NOT APPLICABLE` means the feature or technology is not implemented in the reviewed code, not that a future integration would be safe.

### Top risks

1. **P1 — Platform-admin MFA is absent (FAIL #55).** Password-based sign-in is not protected by the required MFA control. See `server/app.js:1174-1233`; no MFA enrollment or challenge route was found.
2. **P1 — Tenant boundaries depend on application code (PARTIAL #49).** Shop scoping is implemented and test-covered, but no database row-level security policy was found. A missed tenant predicate could expose another shop’s records. See `server/app.js:277-334`, `server/db.js:177-201`, and `server/app.test.js:1244-1260,1565-1590`.
3. **P1 — Sensitive order fields are stored as plaintext columns (PARTIAL #48).** Phone, address, and payment sender number are stored directly in PostgreSQL; infrastructure-level disk encryption was not verifiable. See `server/db.js:5-14`.
4. **P1 — Backup recovery is not demonstrated (PARTIAL #44).** Encrypted backup creation is implemented, but scheduling, off-host retention, key recovery, and a restore drill are operator tasks with no verified outcome. See `scripts/backup-production.sh:19-55` and `README.md:161-170`.
5. **P2 — Production changes have no repository CI workflow (FAIL #60).** No tracked CI workflow was found; automated release gates and workflow provenance cannot be confirmed. See absence of tracked `.github/workflows/` and `package.json:8-17`.

Other material risks include an application database role with schema `CREATE` privileges (PARTIAL #41), unauthenticated push-subscription mutation endpoints (PARTIAL #70), and browser storage of the admin bearer token (PARTIAL #68).

## 2. Full checklist

| # | Check | Status | Evidence |
|---:|---|---|---|
| 1 | Exposed DB credentials | PARTIAL | Tracked development template includes a fixed local PostgreSQL password (`.env.example:5-10`); production secrets are environment-injected (`docker-compose.production.yml:8-35`) and were not inspected. |
| 2 | Public `.env` files | PASS | `.env` and `.env.*` are ignored, with only example templates whitelisted (`.gitignore:2-4`); `git ls-files` showed only `.env.example` and `.env.production.example`. Express serves explicit asset directories, not the repository root (`server/app.js:667-677`). |
| 3 | Hardcoded secrets | PARTIAL | No production API/private key was found in source; the tracked local template password is a known development value (`.env.example:10`). It must never be reused outside local development. |
| 4 | Weak auth | PARTIAL | Passwords use scrypt and require at least 12 characters (`server/adminPassword.js:8-15`), but the required platform-admin MFA is missing (#55), and recovery is operator-dependent (#24). |
| 5 | Missing authz check | PASS | Admin middleware validates active DB sessions, user version, shop membership/status, and role; management routes apply shop/platform guards (`server/app.js:277-352`, `server/platform.js:19-30,147-150`). |
| 6 | Cross user access | PASS | Order lookup requires both order number and phone and returns customer-safe fields; admin access resolves the authenticated user ID from the session (`server/app.js:277-334,1133-1168`). |
| 7 | Open DB permissions | PASS | Production Compose exposes only Caddy ports 80/443; PostgreSQL is on an internal network and has no published host port (`docker-compose.production.yml:52-74`). |
| 8 | Cloud service misconfig | UNVERIFIED | No cloud-provider infrastructure is described in source beyond external push delivery; live hosting, cloud account controls, and provider configuration require authorized operator review (`docker-compose.production.yml:1-74`, `server/platform.js:12,1109`). |
| 9 | Unprotected admin routes | PASS | `/admin` and `/admin/platform` serve public login shells, but order/product/platform API handlers use authentication and role middleware (`server/app.js:625-626,849-984,1239-1493`; `server/platform.js:147-150,162-873`). |
| 10 | Exposed prod debug tools | PASS | `/healthz` returns only readiness status and is not a debug console (`server/app.js:1019-1028`); no debug route was found. |
| 11 | Logs leak secrets | PARTIAL | No explicit logging of request passwords, bearer tokens, full phones, or addresses was found; the generic handler logs the full raw error object (`server/app.js:1522`), so production log content, retention, and access need redaction/review. |
| 12 | Verbose prod errors | PASS | Unhandled requests receive a generic 500 JSON message; detailed errors are logged server-side (`server/app.js:1500-1523`). |
| 13 | Secrets in git history | PASS | Safe history scan of reachable commits for common private-key, cloud-key, GitHub-token, live-payment-key, and JWT-like patterns returned no hits; `.env` paths were not tracked in history. This pattern scan is not proof that no secret of any form ever existed. |
| 14 | Secrets in JS | PASS | Browser tracking configuration has empty public IDs and is disabled by default (`js/config/tracking.config.js:1-6`); no private credentials were found in client JS. |
| 15 | Client-only security (admin and checkout recheck) | PASS | Client UI is not the trust boundary: admin APIs verify bearer sessions/roles, while order validation reprices products and checks availability/quantity on the server (`server/app.js:277-352,849-984,1043-1127`; `server/orders.js:26-103`). |
| 16 | Input validation | PASS | Checkout fields, item counts/quantities, prices, categories, and image metadata have explicit server-side validation (`server/orders.js:26-86`; `server/app.js:107-138`). |
| 17 | SQL injection | PASS | User-supplied values in authentication/order queries are passed as PostgreSQL bind parameters (`server/app.js:297-303,1059-1080,1138-1148`); no user-controlled SQL execution was found. |
| 18 | NoSQL injection | NOT APPLICABLE | The project uses PostgreSQL and `pg`, with no MongoDB/NoSQL driver (`package.json:23-25`, `server/index.js:6`). |
| 19 | XSS | PASS | Server HTML helpers escape text/attributes (`server/app.js:46-57`), and storefront templates escape product text (`js/views/ProductGridView.js:105-125`); admin rendering predominantly uses `textContent`/DOM creation (`admin-assets/admin.js:263-269`, `admin-assets/platform.js:34-45`). |
| 20 | CSRF | PASS | Admin authentication uses an explicit `Authorization: Bearer` header, not an ambient cookie; JSON requests are strict and credentialed cross-origin access is not enabled (`server/app.js:277-284,493`; `admin-assets/admin.js:71-78`). |
| 21 | Insecure file uploads | PARTIAL | Upload types, file size/field counts, generated names, and signatures are checked (`server/app.js:39-42,92-106,259-271`); only leading-byte signatures are verified—there is no full decoder/re-encode or malware scan. |
| 22 | Path traversal | PASS | Upload path resolution accepts only UUID image names with approved extensions (`server/platform.js:96-99`); uploads are served from a fixed directory (`server/app.js:667-673`). |
| 23 | SSRF | PASS | Push endpoints are HTTPS-only and host-allowlisted, and private IP literals/ports are rejected (`server/platform.js:12,75-91`); arbitrary user URLs are not fetched by the server. |
| 24 | Broken password reset | PARTIAL | No self-service reset or recovery flow exists; an authenticated user can change password only after supplying the current password (`server/app.js:1297-1338`; `admin.html:169-178`). Define a protected recovery process before launch. |
| 25 | Weak session management | PARTIAL | JWTs expire after eight hours and are checked against revocable DB sessions/session versions (`server/app.js:1209-1223,277-334`); the bearer token is held in `sessionStorage` and remains exposed to same-origin script execution (`admin-assets/admin.js:4,71-78,475`). |
| 26 | JWT secrets | PASS | Startup requires a 32-character JWT secret, rejects example placeholders, and verification pins HS256 plus issuer (`server/index.js:28-29,54-58`; `server/app.js:284`). Actual production secret strength was not inspected. |
| 27 | Permissive CORS | PASS | Wildcard CORS is set only on the intentionally public, read-only external shop-products endpoint (`server/app.js:714-716`); no credentialed wildcard CORS middleware was found. |
| 28 | Rate limits | PARTIAL | Limits cover login, orders, lookup, uploads, catalog, password changes, and push subscriptions (`server/app.js:355-396`; `server/platform.js:153-160`). They use process-local memory; no search/review/OTP routes exist, and multi-instance deployments need a shared store (`README.md:129`). |
| 29 | Exposed environments | UNVERIFIED | Production environment variables, hosting control panel, and staging exposure were not inspected; production Compose specifies injected secrets and a private database network (`docker-compose.production.yml:8-35,52-74`). |
| 30 | Default credentials | PARTIAL | No default admin password is accepted: startup requires a configured password and rejects example placeholders (`server/index.js:27-29,54-58`); the development DB example contains a fixed local password (`.env.example:10`). |
| 31 | Unsigned webhooks | NOT APPLICABLE | No bKash/Nagad/SSLCommerz/courier webhook endpoint or signature verifier was found; payment is described as manual (`README.md:96,110`; `server/app.js:1043-1127`). |
| 32 | FE payment checks | PASS | The client submits product IDs/quantities; the server derives prices from its catalog, recalculates totals, and takes the shop’s configured advance charge (`server/orders.js:26-103`; `server/app.js:1043-1103`). Manual payment review is not gateway verification. |
| 33 | IDOR / BOLA | PASS | Product lookup for detail/order is shop-scoped, and order activity/status queries include shop ownership predicates (`server/catalog.js:131-134`; `server/app.js:533-535,1282-1289,1441-1447`). Regression tests cover membership/shop boundaries (`server/app.test.js:1244-1260,1565-1590`). |
| 34 | APIs + user input | PASS | JSON size is capped; checkout, product, shop, and transaction values are validated before database writes (`server/app.js:493,107-138`; `server/orders.js:26-86`; `server/platform.js:743-750`). |
| 35 | Exposed logs | PASS | No HTTP log-viewer route was found; production Compose exposes only the reverse proxy and private DB network (`server/app.js:674-1523`; `docker-compose.production.yml:52-74`). Host-level log ACLs remain unverified. |
| 36 | Exposed source maps | PASS | No tracked `.map` source-map files were found; static serving is restricted to explicit directories (`server/app.js:667-673`). |
| 37 | Vulnerable dependencies | PASS | `npm audit --json` completed: **0 total** known advisories (0 info, low, moderate, high, critical), 205 dependency nodes. This is advisory-database coverage, not a guarantee of safety. |
| 38 | Malicious packages | PARTIAL | A lockfile exists and `npm audit` found no known advisories (`package-lock.json:1-18`); neither tool verifies maintainer intent, package provenance, or account compromise. |
| 39 | Prompt injection | NOT APPLICABLE | No LLM/AI feature or model dependency was found in the reviewed runtime source and manifest (`package.json:1-32`). |
| 40 | Unpermissioned AI access | NOT APPLICABLE | No AI agent/tool integration exists in the reviewed app (`package.json:1-32`; no AI routes in `server/app.js` or `server/platform.js`). |
| 41 | Excessive DB permissions | PARTIAL | The runtime `shopademia_app` role receives `CREATE` on the `public` schema (`database/init/10-app-role.sh:4-11`), while startup runs schema creation and ALTER statements (`server/index.js:69-74`; `server/db.js:3-96,98-276`). Separate reviewed migration privileges from runtime privileges. |
| 42 | Missing audit logs | PASS | Shop activity captures product, member, transaction, offer, and order actions; status and advance review have actor/before/after event records (`server/app.js:889-996,1401-1410,1476-1484`; `server/platform.js:215-220,763-773`; `server/db.js:54-64,265-276`). README correctly notes logs are not tamper-proof (`README.md:100`). |
| 43 | No security monitoring | PARTIAL | A DB-backed readiness endpoint exists (`server/app.js:1019-1028`); uptime alerting is only an operator instruction, with no configured monitor/alert evidence (`README.md:170`). |
| 44 | No backups/restore | PARTIAL | Encrypted paired PostgreSQL and uploads backup script exists (`scripts/backup-production.sh:19-55`); README asks operators to schedule, off-site, and test restore, but gives no restore procedure or evidence of a successful drill (`README.md:161-170`). |
| 45 | Exposed internal dashboards | PASS | Admin HTML shells are public login pages; sensitive API routes require authentication and applicable shop/platform roles (`server/app.js:625-626,849-984,1239-1493`; `server/platform.js:147-150`). |
| 46 | Missing security headers | PASS | Helmet configures CSP, HSTS, frame ancestors, MIME sniffing protection, referrer policy, and permissions policy (`server/app.js:449-479`). Production TLS/DNS and actual headers at the host were not tested. |
| 47 | Insecure cookie settings | NOT APPLICABLE | Admin auth does not use cookies; tokens are sent in an Authorization header and held in session storage (`server/app.js:277-284`; `admin-assets/admin.js:71-78`). |
| 48 | Unencrypted data | PARTIAL | Order PII is stored as ordinary PostgreSQL text columns, with no application-level field encryption (`server/db.js:5-14`). Production volume/host encryption and physical access controls were not verified. |
| 49 | Poor tenant isolation | PARTIAL | API queries and runtime catalog lookups apply `shop_id`/membership scoping, and tests cover cross-shop access (`server/app.js:297-334,533-535,1059-1080`; `server/db.js:177-201`; `server/app.test.js:1244-1260,1565-1590`). No database row-level security policy was found; isolation currently depends on application predicates. |
| 50 | Unreviewed code | UNVERIFIED | Git history shows commits, but this checkout does not establish human review, verified authorship, or approval policy; obtain PR and branch-review records from the Git host. |
| 51 | Mass assignment | PASS | Product fields are individually parsed/validated and SQL insert/update column lists are explicit (`server/app.js:107-138,879-900,934-951`); shop/member routes similarly validate allowed role/status fields (`server/platform.js:518-584,598-651`). |
| 52 | Command injection | NOT APPLICABLE | No HTTP handler invokes a shell with user-controlled arguments; the backup script runs fixed commands from operator-controlled deployment configuration (`scripts/backup-production.sh:1-55`). |
| 53 | Insecure deserialisation | PASS | Request bodies use strict bounded JSON parsing (`server/app.js:493`); no unsafe object deserializer or `eval` path was found. |
| 54 | Misconfigured OAuth | NOT APPLICABLE | No OAuth provider or callback implementation/dependency was found (`package.json:1-32`; route inventory below). |
| 55 | No MFA (super admin requires MFA per spec) | FAIL | Platform admins sign in using email/password and receive an eight-hour bearer token; no MFA factor, enrollment, or challenge is present (`server/app.js:1174-1233`). |
| 56 | Account enumeration | PASS | Login returns the same “Email or password is incorrect” response for unknown account and bad password (`server/app.js:1174-1192`); order lookup returns a generic mismatch response (`server/app.js:1133-1168`). |
| 57 | Business logic abuse | PASS | Server rejects invalid/negative/excessive quantities and computes price from server catalog; there is no coupon/COD or client-authoritative total path (`server/orders.js:26-103`). Payment remains manual and needs operational reconciliation. |
| 58 | Race conditions | PASS | Checkout uses a DB transaction, row lock/idempotency key, unique `(shop_id,event_id)` index, and conditional stock decrement (`server/app.js:1059-1087`; `server/db.js:199-201`; `server/app.js:191-221`). |
| 59 | Webhook replay / duplicate transaction IDs | PARTIAL | There are no webhooks; checkout retries are idempotent (`server/app.js:1066-1087`). Manual transaction references are not unique in schema (`server/db.js:204-219`), so duplicate references are not rejected at DB level. |
| 60 | Insecure CI/CD | FAIL | No tracked CI workflow exists in this repository; build/test scripts are available but there is no in-repo automated release gate (`package.json:8-17`; no tracked `.github/workflows/`). |
| 61 | Untrusted build actions | NOT APPLICABLE | No GitHub Actions or other repository CI workflow using third-party actions was found; host configuration remains external (`git ls-files .github` returned no files). |
| 62 | Unpinned build dependencies | PARTIAL | `package.json` uses semver ranges, while `package-lock.json` locks resolved versions and the Docker build uses `npm ci` (`package.json:19-32`; `Dockerfile:6-7`). Container base image is a floating major tag (`Dockerfile:1`), not a digest. |
| 63 | Checks fail open | UNVERIFIED | No CI checks are defined in-repo; GitHub required-check and branch-protection settings are not visible from this checkout and require repository-admin verification. |
| 64 | Missing timeouts | PASS | PostgreSQL has connection and statement timeouts (`server/index.js:61-65`); browser fetches use a 15-second abort timeout (`js/utils/fetchWithTimeout.js:1-3`). |
| 65 | Sensitive info leak | PASS | Customer lookup matches order number plus normalized phone and returns item/totals/status only, not contact/address/payment sender fields (`server/app.js:1133-1168`); a regression test checks non-disclosure (`server/app.test.js:709-720`). |
| 66 | Invalid AI output | NOT APPLICABLE | No AI-generated runtime output or model integration was found (`package.json:1-32`). |
| 67 | Excessive AI permissions | NOT APPLICABLE | No AI service/agent is integrated into the application (`package.json:1-32`). |
| 68 | Sensitive browser storage | PARTIAL | Admin bearer token is kept in `sessionStorage` (`admin-assets/admin.js:4,71-78,475`); same-origin script execution could read it. Cart/wishlist local storage contains catalog identifiers/items rather than order contact PII (`js/services/CartService.js:22-40`; `js/services/WishlistService.js:7-18`). |
| 69 | Open redirects | PASS | The only canonical redirect is constructed from the configured site origin; hero-slide targets are validated as internal paths or HTTP(S) links, not server redirect responses (`server/app.js:481-485`; `server/platform.js:107-125`). |
| 70 | Unsecured endpoints | PARTIAL | Public read APIs are intentional; push-subscription POST/GET/DELETE also lack admin auth and can be abused for subscription churn/storage pressure, though endpoint validation and per-IP limiting exist. Full inventory follows (`server/app.js:674-848,1019-1233`; `server/platform.js:889-909,1011-1088`). |

## 3. Unauthenticated route inventory

The following API endpoints are declared without admin bearer-auth middleware. Public catalog and shop data, checkout, customer order lookup, sign-in, health, and public offers are expected to be public. Push-subscription endpoints mutate/read a subscription record without login; they validate provider endpoint shape and apply a rate limit, but remain an abuse surface.

### Public API endpoints

- `GET /api/v1/products` — `server/app.js:674-692`
- `GET /api/v1/shops/:slug/products` — `server/app.js:693-713`
- `GET /api/v1/public/shops/:slug/products` — `server/app.js:714-766` (intentional wildcard CORS)
- `GET /api/v1/shops/:slug/categories` — `server/app.js:767-775`
- `GET /api/v1/shops/:slug/products/hero-offer` — `server/app.js:776-784`
- `GET /api/v1/shops/:slug` — `server/app.js:785-798`
- `GET /api/v1/shops` — `server/app.js:799-809`
- `GET /api/v1/categories` — `server/app.js:810`
- `GET /api/v1/storefront-config` — `server/app.js:811-823`
- `GET /api/v1/shops/:slug/config` — `server/app.js:824-847`
- `GET /api/v1/products/hero-offer` — `server/app.js:848`
- `GET /healthz` — `server/app.js:1019-1028`
- `POST /api/v1/orders` — `server/app.js:1043-1127` (guest checkout, rate-limited and server-priced)
- `POST /api/v1/customer/order-lookup` — `server/app.js:1133-1170` (requires order number and phone)
- `POST /api/v1/admin/login` — `server/app.js:1174-1236`
- `GET /api/v1/shops/:slug/offers` — `server/platform.js:889-909`
- `GET /api/v1/shops/:slug/push-key` — `server/platform.js:1011-1026`
- `POST /api/v1/shops/:slug/push-subscriptions` — `server/platform.js:1028-1047`
- `GET /api/v1/shops/:slug/push-subscriptions` — `server/platform.js:1049-1069`
- `DELETE /api/v1/shops/:slug/push-subscriptions` — `server/platform.js:1071-1088`

### Public page/static routes

The storefront shell, policy and shop pages, admin sign-in shells, service worker, robots/sitemap/404, and explicit CSS/JS/assets/uploads static mounts are public by design. The admin pages do not themselves grant data access; the APIs above the public list that use `/api/v1/admin/...` require authentication. See `server/app.js:495-662,667-673` and the API middleware definitions at `server/app.js:277-352`, `server/platform.js:147-150`.

## 4. Remediation plan

No remediation was applied during this audit. Changes touching authentication, payments, data retention, or schema/migrations require human approval before implementation.

| Check(s) | Recommended action | Severity | Protected area? |
|---|---|---:|---|
| #1, #3, #30 | Keep local-only template credentials obviously non-production; replace the fixed local DB password with an explicitly generated local secret or a non-reusable dev-only value, and verify production secrets are unique and never copied from examples. | P2 | No |
| #4, #55 | Require phishing-resistant or TOTP MFA for platform administrators, then review recovery codes and enrollment/revocation paths. | P1 | **Yes — authentication** |
| #7, #41 | Remove runtime schema `CREATE` privilege; move startup DDL into a reviewed migration identity and grant the app only required DML/sequence privileges. Validate privilege changes against production migration procedures. | P1 | **Yes — migrations/database** |
| #11 | Replace raw error-object logging with structured, redacted fields; prohibit request/credential values in logs and define access/retention controls. | P2 | Yes — logs/customer data |
| #21 | Decode/re-encode accepted images using a maintained image library, cap decoded dimensions/pixels, and consider malware scanning where operationally available. | P2 | No |
| #24 | Define a secure operator-assisted recovery process (identity proofing, single-use short expiry reset, revocation, and audit trail) if self-service recovery is required. | P2 | **Yes — authentication** |
| #25, #68 | Assess replacing browser-stored bearer tokens with a Secure, HttpOnly, SameSite session design; explicitly add CSRF protections if cookies are adopted. If bearer tokens remain, strengthen CSP/XSS controls and shorten exposure as business UX permits. | P1 | **Yes — authentication** |
| #28 | Use a shared rate-limit store before adding replicas; add specific abuse limits to any future search/review/OTP features and edge controls for distributed abuse. | P2 | No |
| #38 | Add dependency provenance review (maintainer/source verification, lockfile review, automated supply-chain policy); keep auditing advisories. | P3 | No |
| #43 | Configure external uptime/security alerting, ownership/escalation, and incident drills; verify delivery rather than relying only on `/healthz`. | P2 | No |
| #44 | Document restore commands and key recovery; schedule encrypted off-host database+upload backups and record periodic isolated restore evidence. | P1 | **Yes — database/customer data** |
| #48 | Obtain host/provider evidence for encrypted storage and backups; if not available, design encryption/key-management for PII with a reviewed retention and recovery plan. | P1 | **Yes — customer data** |
| #49 | Add explicit tenant-isolation tests against a real PostgreSQL staging DB; review every tenant query and consider PostgreSQL RLS as defense in depth. Avoid changing constraints before migration review. | P1 | **Yes — tenant/customer data and migrations** |
| #59 | If transaction references are relied on to prevent duplicate bookkeeping, define canonicalization and add a shop-scoped uniqueness/idempotency rule after reconciling existing records. | P2 | **Yes — payments/ledger** |
| #60, #63 | Add CI that runs tests, `npm audit`, and build checks; require successful checks and human review before merge/deploy. Verify Git-host branch protections and failure behavior. | P2 | No (Git-host settings need owner access) |
| #62 | Pin the production container base image by digest and keep the lockfile plus `npm ci`; document controlled upgrade/rebuild cadence. | P3 | No |
| #70 | Reassess public subscription mutation APIs: add proof-of-control/abuse protections or restrict the ability to delete subscriptions to the endpoint owner; monitor subscription growth and rejected push volumes. | P2 | No |

## 5. Human review required

- **Authentication:** platform-admin MFA requirement; recovery flow; bearer-token storage/session architecture; default-admin/bootstrap policy. Do not change auth behavior without owner/security review.
- **Payments:** payments are manual and no signed gateway/courier webhook exists. Confirm that manual advance verification, transaction-reference uniqueness, refund handling, and ledger roles meet the operating policy. No payment flow was exercised.
- **Database/migrations:** `initializeDatabase()` performs DDL at app startup and the runtime role has schema `CREATE`. Review a least-privilege migration plan and test it against a restorable staging copy before any production change.
- **Tenant isolation:** confirm role/tenant requirements and run two-shop PostgreSQL tests; current checks are application-enforced and no RLS policy was found.
- **Privacy/retention:** approve PII retention, deletion, encryption-at-rest, backup expiry, and customer access procedure before processing real orders.
- **Operations:** prove encrypted backup restore, key recovery, monitoring alerts, production proxy/TLS settings, environment secret uniqueness, and log retention with the hosting operator.
- **Supply chain/Git host:** verify PR approvals, branch protection/required checks, repository visibility, and deployment credentials using an authorized Git-host administrator.

## 6. Safe-check record and limitations

- `npm audit --json`: 0 known vulnerabilities, 205 dependency nodes (113 production, 92 development; optional dependencies are included in the total breakdown).
- Git history checks used common high-confidence credential signatures and returned no matches; pattern scanning cannot prove absence of every secret format or credentials stored outside reachable refs.
- No `.env` values were read or included in this report. The local `.env` exists and is ignored by Git.
- No production or staging host was contacted for state-changing tests. Deployment values, TLS behavior, DB/storage encryption, alerting, log access, restore success, and account MFA cannot be established from this repository alone.
- The code uses PostgreSQL. MySQL-specific controls are not applicable.
- At the time of the initial audit, no code fixes, migrations, payments, order creation, shop changes, or account changes were made. The user later approved remediation; see section 7.

## 7. Post-audit remediation follow-up

The user approved fixing the reported issues after the baseline report. These changes are local and remain uncommitted; no production database, account, payment, or hosted service was changed.

### Implemented and locally verified

| Area | Remediation | Current evidence |
|---|---|---|
| Platform-admin MFA (#4, #55) | Required six-digit TOTP enrollment at first platform-admin sign-in, encrypted secret storage, time-step replay rejection, and TOTP challenge on subsequent sign-ins. | `server/adminTotp.js:54-88`; `server/app.js:1245-1390`; `server/app.test.js` MFA test. |
| Admin session and CSRF controls (#20, #25, #47, #68) | Browser sessions use HttpOnly, SameSite=Strict cookies (Secure in production), unsafe cookie-authenticated requests require same-origin Origin, and the browser UI no longer stores admin bearer tokens in web storage. Non-browser bearer clients remain supported. | `server/app.js:306-316,321-375,540-554,1245-1355`; `admin-assets/admin.js:91-94` stores only the selected shop ID; cookie/CSRF test in `server/app.test.js`. |
| Image uploads (#21) | Decode images with Sharp, enforce decoded pixel/dimension limits, rotate and re-encode accepted formats, strip metadata, and bound output size. | `server/app.js:100-135,272-290`; upload tests in `server/app.test.js`. |
| Ledger duplicate handling (#59) | Add a case-insensitive, trimmed, per-shop unique transaction-reference index and return HTTP 409 on duplicate references. Existing duplicates block index creation and must be reconciled without deleting ledger records. | `server/db.js:224-225`; `server/platform.js:770-784`; duplicate test in `server/app.test.js`. |
| Public push enrollment abuse (#28, #70) | Rate-limit push-subscription routes and cap each shop at 5,000 subscriptions, serializing new registrations per shop. This reduces resource abuse but does not prove endpoint ownership for deletion. | `server/platform.js:151,1064-1066`; cap test in `server/app.test.js`. |
| Runtime database privileges (#41, #60) | Production Compose runs schema migrations in a one-shot service using `shopademia_migrator`; the web process uses `shopademia_app` with DML/sequence grants. New-volume roles are created by the database init script. An explicit, confirmation-gated upgrade script supports existing volumes. | `docker-compose.production.yml:30,50,59`; `database/init/10-app-role.sh:25`; `server/migrate.js:26-40`; `server/index.js:85`; `scripts/upgrade-database-role.sh:36-84`. |
| Logs (#11, #12) | Generic request/readiness/startup/database-pool/rollback logs no longer emit raw database error objects or messages. | `server/app.js:1703-1707`; startup logging in `server/index.js`. |
| CI and container base (#37, #60–63) | Add test and low-severity npm-audit workflow, pin third-party workflow actions to commit SHAs, and pin the Node container image by digest. `npm audit` currently reports zero known vulnerabilities. | `.github/workflows/ci.yml:15-26`; `Dockerfile:1`; lockfile; local audit below. Branch protection is not configured by this code change. |
| Backup recovery (#44) | Add an isolated restore script that decrypts paired backups, rejects unexpected archive paths/links, restores into a newly named database and directory, and does not overwrite live data. Document the required operator restore drill. | `scripts/restore-production.sh:68-86`; `README.md` restore instructions. Script has not been run against a real backup or database. |
| Development secret hygiene (#1, #3) | Replace the fixed development database password in the tracked example with a placeholder; production examples require unique, sufficiently long database passwords. | `.env.example:5-10`; `.env.production.example`; `database/init/10-app-role.sh:4-16`. |

### Remaining findings and operator actions

These baseline items remain partial, unverified, or require real deployment/provider access; they are not represented as fixed:

- **Tenant isolation (#49, P1):** Shop scoping remains enforced in application queries and middleware; database row-level security was not added. Exercise two-shop reads/writes against a restorable staging database and obtain human authorization review.
- **PII at rest (#48, P1):** Phone, address, and payment sender-number columns remain plaintext at the application/database layer. Enable and verify encrypted host/provider storage, approve retention/deletion policy, and assess whether field-level encryption is required.
- **Backup and recovery (#44, P1):** Configure off-host encrypted backup scheduling/retention and perform/document a restore drill. The new restore script is not a substitute for a successful drill; protect and recover the age identity separately.
- **Payments and recovery (#24, #31, #32, #57, #58–59):** Payment remains manual and no signed gateway/courier webhook is implemented. Independently review transaction/reconciliation and refund operations; password recovery remains an operator process, not a self-service flow. Do not treat manual statuses as provider confirmation.
- **Public subscription ownership (#70, P2):** Rate limiting and a per-shop cap mitigate flooding, but public unsubscribe-by-endpoint ownership was not proved. Review a proof-of-control or equivalent design before relying on it.
- **Monitoring, logs, cloud, and release controls (#8, #29, #35, #43, #50, #60, #63):** Configure and verify host/provider controls, external alerts and log retention, repository review/branch protection and required CI checks, and deployment secret access with authorized operators.
- **Scaling rate limits (#28):** Limits are in-memory. Keep a single app replica or add a shared store and edge abuse controls before scaling.
- **MFA operations (#55):** Set and back up a unique production `MFA_ENCRYPTION_KEY` outside the database, enroll existing platform administrators, and document an independently verified recovery/key-rotation process before production rollout.
- **Existing database rollout:** Back up and verify recoverability, check for duplicate shop transaction references, then run `scripts/upgrade-database-role.sh` with the PostgreSQL bootstrap account and typed confirmation. Do not deploy the role-separated Compose configuration to an existing volume until this is complete. This script was not executed.

### Validation performed after remediation

- `npm test`: **83 passed, 0 failed**.
- `npm audit --audit-level=low`: **0 known vulnerabilities**.
- `node --check` on edited server/admin JavaScript: **passed**.
- `git diff --check`: **passed**; Git emitted only a working-copy LF/CRLF normalization warning for `.env.example`.
- Production Compose validation and Bash syntax checks: **not run** because Docker Compose and Bash are not installed in this environment. Validate both in the deployment/CI environment before rollout.
- No production database migration, deployment, backup, or restore was run.
