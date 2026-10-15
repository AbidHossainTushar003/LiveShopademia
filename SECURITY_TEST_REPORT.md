# Shopademia Security Test Report

## Current local target availability — 2026-10-14 19:26 +06

- Current safe suites: API 85/85; full Node 133/133 (includes API); staging config 15/15; Playwright target guard 7/7. All exited 0.
- Public-only E2E against `http://127.0.0.1:3002` exited 1: all 9 cases failed before app behavior due to connection refusal. No listener was present on port 3002 or isolated DB port 55441. No service was started/restarted; 5432 was not touched. Record this as **BLOCKED: target unavailable**, not application PASS or confirmed application defects. Earlier 9/9 results remain historical.
- Fresh online dependency audit exited 0 with 0 vulnerabilities (`npm offline=false`, registry `https://registry.npmjs.org/`). Staging validation exited 1 as expected with `.env.staging` absent.
- Static `realpath()`/separate-open TOCTOU remains unresolved; existing junction tests do not test concurrent replacement. Dedicated secret scanner remains unavailable and no fresh secret scan is claimed.
- Checked-in CI YAML has `contents: read`, tests/audits on PR and push, and production deployment gated to push `main` plus `CPANEL_DEPLOY_ENABLED == 'true'`; it declares no environment. Remote GitHub protections, reviewers, actual deployment permissions, and secret scopes remain **UNVERIFIED**.

## Fresh security review and regression rerun — 2026-10-14 11:15 +06

- The bounded read-only security review of the changed route guard, static containment/upload handling, admin authentication/session controls, staging target guard, startup, and migrations reported no actionable code-level vulnerability in the reviewed changes. This is not a certification or a whole-system proof.
- The `realpath()`-then-open TOCTOU filesystem race remains an explicitly documented deployment risk if an actor can replace checked path components; the review did not demonstrate a race exploit and no race-proof claim is made. Require immutable code/static roots and isolated upload publication with verified runtime permissions.
- Fresh `npm.cmd test`: exit 0, 133 passed, 0 failed, 0 skipped. Includes the API/server suite.
- Fresh `node --test scripts\playwright-target.test.js`: exit 0, 7/7 passed. Fresh public-only Chromium `npm.cmd run test:e2e` at `http://127.0.0.1:3002`: exit 0, 9/9 passed. The existing preview was not restarted; no privileged preview operations were sent.
- Fresh online `npm.cmd audit --audit-level=low`: exit 0, 0 advisories. A dedicated secret scan remains unavailable and unperformed.

## Build and dependency recheck — 2026-10-14 11:15 +06

- Fresh `npm.cmd audit --audit-level=low`: exit 0; 0 vulnerabilities. npm offline mode was `false`, registry `https://registry.npmjs.org/`; result is an online registry query.
- `npm.cmd run build:css`: exit 0; Tailwind v4.3.3 completed and regenerated tracked `css/tailwind.generated.css` with a generated `.isolate` utility. No server was started.
- Secret-scanner availability recheck found no `secretlint`, `gitleaks`, `trufflehog`, or `detect-secrets` executable and no project scan script. No fresh secret scan was performed or claimed.
- Staging configuration remains absent by design; `npm.cmd run validate:staging` exited 1 as expected. No placeholder configuration was introduced.

## Static-root and secret-pattern follow-up — 2026-10-14 11:07 +06

- Source review reconfirmed a TOCTOU gap: canonical `realpath()` validation is followed by Express opening the pathname independently. The in-process directory-junction fixture tests only an already-present junction; it is not a concurrent-race test. No race resistance is claimed and no running preview process was changed. Deployment requires immutable release/static roots unreadable for write by the app runtime, separate upload ingestion and immutable publish storage, and actual UID/SID/ACL/mount evidence; otherwise retain the blocker.
- Relevant-file-only redacted triage: `.env.example` line 9 was an unassigned loopback PostgreSQL URL whose password-like part did not match the documented placeholder. That exact standalone line was removed; `.env.example` retains its named placeholder-backed `DATABASE_URL`. The historical value was not printed or tested; validity and reuse remain unknown and owner review is required.
- Other flagged `.env.example`, `.env.production.example`, and `.env.staging.example` DSNs are assigned examples with placeholder-backed passwords; they are harmless template values. The staging test fixture is synthetic invalid-host test data, not live configuration. No values were emitted.
- No dedicated/repository secret scanner was available for a fresh scan. The prior seven-match Secretlint result remains historical; no new secret-scan pass is claimed.

## Staging approval, GitHub access and safe QA — 2026-10-14 10:56 +06

- Verified baseline: branch `feature/admin-v2`, HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`, upstream `github/feature/admin-v2`; no staged changes. Existing dirty/untracked work was left intact.
- The staging register is now D01–D12 and records dependencies, actionability/next action, owner roles, pending status, evidence and acceptance criteria. No named people or written approvals exist; see [STAGING_APPROVAL_REQUEST.md](./docs/STAGING_APPROVAL_REQUEST.md). A concise provider/release-owner request and GitHub administrator checklist was prepared but not sent.
- Actual repository settings remain **UNVERIFIED**. REST GETs for branch protection, rulesets, Actions permissions, environments and workflow contents returned HTTP 403 rate-limit responses; GitHub MCP branch listing returned HTTP 404; `gh` is unavailable. No settings payload was retrieved and no access control was bypassed or changed.
- `npm.cmd test`: exit 0, 132/132 passed, 0 failed/skipped. `node --test scripts\playwright-target.test.js`: exit 0, 7/7 passed.
- `npm.cmd run test:e2e -- --list`: exit 0, listed exactly 9 public storefront tests. `npm.cmd run test:e2e`: exit 0, 9/9 public Chromium tests passed against loopback; no privileged/write workflow was run and the preview was not restarted.
- `npm.cmd run test:e2e:all -- --list` with explicit privileged opt-in against loopback: expected exit 1, 0 tests discovered; both admin specs rejected the target before browser launch.
- Fresh `npm.cmd audit --audit-level=low`: exit 0, 0 vulnerabilities; npm offline mode false, registry `https://registry.npmjs.org/`.
- `npm.cmd run validate:staging`: expected exit 1 because `.env.staging` is absent. `git diff --check`: exit 0.
- No repository-supported/dedicated secret scanner was available; previous ephemeral Secretlint results were not rerun and remain historical (seven potential DB URL pattern matches, values suppressed, one `.env.example` match still requiring review). No secret values were printed.
- No direct database query/write, preview restart, provider access, DNS change, staging/production request, or deployment occurred. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

## Final pre-staging verification — 2026-10-14

- External decision review: all staging decisions remain pending/unverified or unapproved, with owner roles (but no named individuals), requested evidence and explicit acceptance criteria recorded in `docs/STAGING_APPROVAL_REQUEST.md`. No written approvals were found.
- Read-only GitHub settings recheck: REST GETs for branch protection, rulesets, Actions permissions, environments and workflow contents returned HTTP 403 API rate-limit responses; the GitHub MCP branch listing returned 404; `gh` is unavailable. No settings data was retrieved, so branch/review/environment protection and secret scope are **UNVERIFIED**, not absent. Local workflow YAML is not proof of remote settings.
- Staging validator recheck: `.env.staging` absent; `npm.cmd run validate:staging` exit 1 as expected, reporting invalid/missing staging configuration. No placeholder or secret was created.
- `node --test --test-name-pattern='junctions that resolve' server\app.test.js`: exit 0, 1/1 passed; the disposable Windows junction case covers both normal and read-only-preview app configurations.
- `node --test scripts\playwright-target.test.js`: exit 0, 7/7 passed.
- `npm.cmd run test:api`: exit 0, 85/85 passed. `npm.cmd test`: exit 0, 132/132 passed. These suites overlap.
- Public-only `npm.cmd run test:e2e` against the existing loopback target: exit 0, 9/9 Chromium tests passed. No preview restart occurred; no privileged or prohibited route was requested.
- With privileged opt-in explicitly set, `npm.cmd run test:e2e:all -- --list` against `http://127.0.0.1:3002` exited 1 as expected: both admin spec imports rejected loopback before test discovery, 0 tests listed and no browser launched.
- `git diff --check`: exit 0.
- Static containment is enforced before `express.static` for all static roots/app modes. Traversal/malformed-path API regressions and the junction fixture passed; a concurrent filesystem-replacement race was not tested and remains possible in the check-to-open interval. Require immutable/read-only code/public-asset roots and operator-only filesystem access; isolate uploads as app-writable only. Do not claim descriptor-relative race resistance.
- `.github/workflows/ci.yml` source declares `contents: read`, PR/push test/audit jobs, and a production deploy condition of push to `main` plus `CPANEL_DEPLOY_ENABLED=true`; no GitHub environment is declared and workflow-context SSH secrets are referenced. Branch rules, required checks/reviews, environment approvers, Actions settings, and secret scopes remain unverified (read-only GitHub APIs/settings returned 403/404; authenticated CLI unavailable).
- Online `npm.cmd audit --audit-level=low` (configured npm registry, offline false) reported 0 vulnerabilities. Ephemeral Secretlint scanned 173 text files and reported seven possible DB-URL matches: 2 in `.env.example`, 2 in `.env.production.example`, 2 in `.env.staging.example`, and 1 in `scripts/staging-config.test.js`. Values were not printed; no confirmed leaked credential was found. One `.env.example` alert (line 9) needs manual review; do not describe the scan as a clean zero-finding result. No dependency manifest was changed.
- No fresh database inventory comparison was made; no database was queried or written in this pass. No staging/production service, DNS, or provider was contacted. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

## Privileged E2E and static-root containment follow-up — 2026-10-14

- Admin E2E specs now require the explicit `PLAYWRIGHT_ALLOW_PRIVILEGED_E2E=1` opt-in and reject loopback targets. Tests cover localhost, localhost with trailing dot, `.localhost`, IPv4 loopback, IPv6 loopback, missing approval flag, and staging-host mismatch. `node --test scripts\\playwright-target.test.js`: **7 passed, 0 failed**.
- Fail-closed discovery probe: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm.cmd run test:e2e:all -- --list` returned nonzero, rejected both privileged admin spec files before execution, listed zero tests, and launched no browser.
- Static serving in both app modes canonicalizes requested paths against each static root before `express.static`. An isolated directory-junction regression passed **1/1** on this Windows host, rejecting a path that resolves outside the upload root and continuing to serve the in-root file. The check is subject to a path replacement TOCTOU window; no concurrent race test was executed. The existing preview process was not restarted, so this change is verified in tests but is not claimed active in the currently running process.
- The first traversal regression after adding canonicalization found a 500 for a percent-encoded NUL path at filesystem resolution. The middleware now rejects decoded NUL bytes with a generic 404; the subsequent full API suite passed.
- Latest results: `npm.cmd run test:api` **85/85**, `npm.cmd test` **132/132**, public-only `npm.cmd run test:e2e` **9/9**, and `git diff --check` passed. Suite counts overlap.
- No runtime restart, live prohibited route probe, database query/write, staging/production request, or deployment was performed. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

## Read-only request-lifecycle and browser audit — 2026-10-14

- Route order review and fake-pool regressions verified the preview guard precedes redirects, parsing, static serving, routers, and business routes. Denied admin/order-lookup/notification/unknown/encoded/query-bypass/HEAD cases return generic 404 or 405 before handlers; denied reads issue no SQL. Static URL traversal regressions return generic 404. These are in-process tests, not live blocked-route probes.
- Public Chromium audit: `npm.cmd run test:e2e` — 9 passed, 0 failed. It covered the homepage, informational pages, shops, deals, a synthetic product/category flow, public catalog APIs, static resources, three viewports, keyboard focus, accessible product-link naming/navigation, CDN outage fallback, browser errors/network failures, and automated accessibility checks.
- `npm.cmd run test:api` — 84 passed; `npm.cmd test` — 130 passed; focused route tests — 5 passed; `git diff --check` — passed.
- Live-only evidence in this run was permitted browsing and `GET /healthz` (200, request ID present). Listener inspection confirmed loopback app/preview-DB targets; PostgreSQL 17/5432 and any 5433 service were not contacted. No fresh database count comparison was made.
- Scope-control correction: an earlier invocation used the old broad `test:e2e` script and requested `/admin`, `/admin/platform`, and admin static asset paths. Those tests failed to render admin UI; the source guard is configured to reject these routes, but the run did not record explicit HTTP statuses and therefore is not status evidence. API requests in specs with `page.route` mocks were intercepted; the login test timed out before form submission. No admin POST or database write was observed. That run had 8 passed / 8 failed and does not count as admin verification. The default command is now restricted to `tests/e2e/storefront.spec.js`; the broad suite must not be run against the local preview.
- The current preview returned 200 from `/healthz`. `index.html` loads Font Awesome from cdnjs and fonts from Google Fonts, permitted by CSP; these providers can observe visitor network/browser metadata. Tracking is disabled by default and is consent/configuration-gated. An interception test confirms fallback rendering during CDN failures, not provider uptime or privacy-term compliance; self-hosting/disclosure remains a product/privacy decision.
- Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**. Authenticated staging acceptance, tenant isolation, sessions/MFA, writable order/inventory/upload workflows, TLS, monitoring, backup restore, and rollback are not verified.

## Staging audit reconciliation — 2026-10-14

This update supersedes older statements below that the local preview is stopped and that recent suites remain at 78 API / 124 total tests. Historical entries are retained to preserve chronology.

- The current local app is loopback-bound at `127.0.0.1:3002`; its isolated PostgreSQL 16 preview is loopback-bound at `127.0.0.1:55441`. PostgreSQL 17 on 5432 was not touched; no 5433 listener was observed.
- Read-only database identity was `shopademia_browser_preview`; the connected role is nonsuperuser and `default_transaction_read_only=on`. Before/after inventory remained 1 product, 0 orders, 1 admin, 0 sessions, and 2 migration records.
- Latest regression evidence: `npm.cmd run test:api` — 84 passed; `npm.cmd test` — 130 passed; `git diff --check` — passed.
- Prior browser regression evidence confirms the four exact traversal-shaped requests return generic 404, legitimate storefront/static resources return 200, and the accessible product image link navigates to its expected detail page.
- An offline cached npm advisory query reported zero vulnerabilities; it did not refresh advisories from the registry.
- This audit did not perform authenticated staging tests, database writes, staging/production access, DNS or deployment. Staging remains **BLOCKED / NOT READY** and production remains **NO-GO**.
- Full readiness blockers, test gaps, staged test plans, architecture proposal, and operational checklists are in [STAGING_READINESS_AUDIT.md](./docs/STAGING_READINESS_AUDIT.md). The matrix's dated reconciliation preserves its original 1,000 scenarios and baseline status counts.

## Mandatory read-only preview policy — 2026-10-14

The current policy supersedes historical observations below that unauthenticated admin reads returned 401. The local-preview server allowlist now blocks every admin route (including GET dashboard/product/order/profile routes), all notification routes including push-key reads, the order-lookup page, checkout, unknown paths, and every method other than GET/HEAD before business handlers. Blocked GET/HEAD routes return generic 404; other methods return 405 with `Allow: GET, HEAD`. The focused regression uses an in-process app with a fake database pool and verifies denied privileged GETs issue no SQL. The preview was restarted under its existing protected read-only configuration, completed startup identity/schema checks, and serves approved homepage/category/product/catalog/static GETs on loopback. No write-capable or prohibited route request was sent to the live preview.

### Blocker investigation follow-up — 2026-10-14

- Fresh local HTTP checks: `/healthz`, `/`, and `/api/v1/products` returned 200. The app and preview PostgreSQL listeners were loopback-bound on ports 3002 and 55441. PostgreSQL 17 on 5432 was not queried or modified; no 5433, 3003, 80, or 443 listener was found.
- The current Docker context is `desktop-linux`, but `docker ps` could not connect because the Docker Desktop Linux-engine named pipe is missing. No staging containers or volumes were inspected; prior Compose image-build results are historical.
- `npm.cmd run validate:staging` failed safely because `.env.staging` is absent; this checkout has no staging config and no secrets were created.
- Added a deterministic offline dependency regression to `tests/e2e/storefront.spec.js`. Exact command: `npm.cmd run test:e2e -- --grep 'storefront remains usable when external font and icon CDNs are unavailable'` — **1 passed** in Chromium. The test blocks cdnjs, Google Fonts, and Google font-file requests if requested; it observed the cdnjs and Google Fonts stylesheet failures, then verified core storefront/catalog rendering, no horizontal overflow, and no page errors.
- Regression rerun: `npm.cmd run test:api` — **84 passed, 0 failed**; `npm.cmd test` — **130 passed, 0 failed**; `git diff --check` — passed.
- This does not verify the current database's exact identity via a direct DB query, nor external staging/TLS/backup/monitoring. Those remain unverified and release-blocking.

## Local preview recovery update — 2026-10-13

This section supersedes earlier statements below that the local preview was stopped or unavailable. The historical security-test scope and its limitations remain unchanged.

- Repository remains `feature/admin-v2` at `798e7227e907edbbd262e8fe25b78d9e79cd7247`; the existing installer, security reports, and 1,000-scenario matrix are preserved.
- Recovered the original PostgreSQL 16.15 cluster from its existing session-state data directory. Before the offline PostgreSQL single-user administration procedure, the server was cleanly stopped and a complete file-level copy was verified: 1,386 files, matching SHA-256 hashes, matching cluster system identifier. The cluster was not replaced or reinitialized.
- Verified the database and role as `shopademia_browser_preview`. The role password was rotated. The protected application configuration is outside the repository at `%LOCALAPPDATA%\\Shopademia\\preview-recovery\\shopademia.env`; its ACL is protected and grants access only to the current Windows account and SYSTEM. Its contents and all secret values are intentionally omitted.
- Before cryptographic rotation, the isolated database contained one product, zero orders, one administrator credential, zero encrypted MFA records, and zero encrypted administrator-setting records. A separate MFA encryption key is now configured; the previous JWT-derived MFA key therefore has no remaining stored ciphertext dependency in this database.
- The administrator credential and matching platform-admin record were reset together with the existing application scrypt hasher. Session versions were incremented and existing sessions invalidated; no administrator login was attempted. Token rejection was not live-tested.
- Existing schema initialization/migration ran only after target identity, backup, and impact checks. The current source checksum for `001_admin_foundations` matched its applied checksum; it was already applied. Pre-start counts were zero for platform-admin memberships targeted by cleanup and zero product/order rows needing tenant backfill. Post-start schema-version count is two; product/order counts remain one/zero.
- App: listening only on `127.0.0.1:3002`. PostgreSQL: listening only on `127.0.0.1:55441`. Protected-config `SELECT 1` returned successfully with the expected database and role.
- Live non-destructive checks: `GET /healthz` — HTTP 200, `{"status":"ok"}`; `GET /` — HTTP 200; `GET /api/v1/products` — one synthetic preview product; `/product/admin-55555555-5555-4555-8555-555555555555` — rendered in Playwright; `/admin` — HTTP 200 with sign-in form. An anonymous admin API request returned the expected 401. No checkout or order creation occurred.
- Tests: `npm.cmd test` — **124 passed, 0 failed, 0 skipped**; `npm.cmd run test:api` — **78 passed, 0 failed, 0 skipped**; `git diff --check` — passed. Replacement secret values were absent from checked application logs and process arguments.
- Exposed-value reuse beyond the local synthetic preview remains unknown. No production/staging access, deployment, commit, or push occurred. Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**. Authenticated dashboard functionality remains unverified.

## Environment and repository

- Repository: `C:/Users/Abidh/OneDrive/Desktop/storefront`.
- Branch/HEAD: `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`.
- Installer: existing untracked `Docker Desktop Installer.exe` preserved.
- Current listener check: no listener on TCP 3002 or 55441.
- Prior environment evidence: the isolated app/database identity had previously been independently verified as a loopback PostgreSQL target with one synthetic product, zero orders, and one admin credential row. The services are stopped now, so that evidence is historical.
- Current dependency/container runtime: no live Docker Compose or PostgreSQL test run was performed. The Docker CLI is present, but `docker ps` failed with exit code 1 because the Docker Desktop Linux-engine named pipe was unavailable; the Docker daemon is not running.
- No production or staging access occurred.

## Commands and results

| Command/check | Result |
|---|---|
| `git rev-parse --show-toplevel` | Repository root is the expected storefront workspace. |
| `git branch --show-current` | `feature/admin-v2`. |
| `git rev-parse HEAD` | `798e7227e907edbbd262e8fe25b78d9e79cd7247`. |
| `git status --short` before changes | Only untracked `Docker Desktop Installer.exe`; no pre-existing tracked edits. |
| `Get-NetTCPConnection -State Listen` filtered to 3002 and 55441 | No listeners. |
| `npm.cmd test` | **124 passed, 0 failed, 0 skipped, 0 cancelled**. Includes the new placeholder-password regression test. |
| `npm.cmd audit --audit-level=low` | **0 vulnerabilities** reported. |
| `node -e "const m=require('./SECURITY_TEST_MATRIX.json'),s=m.scenarios;const result=[s.length,new Set(s.map(x=>x.id)).size,new Set(s.map(x=>x.title)).size,m.allocation.reduce((n,d)=>n+d.count,0)];console.log('scenarios/unique IDs/unique titles/allocated: '+result.join('/'));if(result.some(n=>n!==1000))process.exit(1)"` | **1000/1000/1000/1000**. A second validator also checked required fields, status totals, ordered IDs, and applicability/status consistency. |
| `git diff --check` | Passed on the final tracked diff; generated JSON is independently parsed and validated. |
| `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'` | Failed with exit code 1: Docker Desktop Linux engine named pipe unavailable; no container runtime check was possible. |
| Security-review agent | Bounded read-only review of then-current changes reported no findings in the reviewed diff; it performed no tests or runtime checks. |

The automated tests use in-memory/mock API/database behavior where designed; they are not evidence of current live authenticated behavior.

## Implemented surface discovered

The Express API includes:

- Public catalog/shop/product/category/configuration routes; public product catalog routes are rate-limited.
- `POST /api/v1/orders` checkout and `POST /api/v1/customer/order-lookup`.
- Admin login, MFA enrollment, profile, logout, password change, products, categories, order list/activity, order status, and manual advance-payment review.
- Platform APIs for shops, membership/roles, permissions, settings/audit, hero slides, branding, transactions, reports/activity, offers, and public push-subscription operations.
- Admin pages `/admin` and `/admin/platform`.

This route inventory is source-derived. It is not a claim that each route or role was live-tested. No customer-account login, customer password-reset, coupon redemption, refund API, or provider payment-webhook route was identified in the inspected route registration.

### Registered API/health operations (source-derived)

The following list covers the 65 API/health route registrations in `server/app.js` and `server/platform.js`. Input and output summaries are based on handler validation and SQL, not an OpenAPI schema; an individual runtime result was not observed unless separately stated. Standard API errors go through route validation or Express error handling; test evidence is not live evidence.

| Methods and paths | Identity and authorization | Input, response, and side effects | Rate/error controls observed |
|---|---|---|---|
| `GET /api/v1/products`; `GET /api/v1/categories`; `GET /api/v1/products/hero-offer`; `GET /api/v1/storefront-config` | Anonymous, read-only | Catalog/category/configuration data; query options filter/sort catalog output. No customer/order data intended. | Public catalog limiter: 120 requests/minute per limiter key. |
| `GET /api/v1/shops`; `GET /api/v1/shops/:slug`; `GET /api/v1/shops/:slug/products`; `GET /api/v1/public/shops/:slug/products`; `GET /api/v1/shops/:slug/categories`; `GET /api/v1/shops/:slug/products/hero-offer`; `GET /api/v1/shops/:slug/config` | Anonymous, read-only | Shop profile/catalog/configuration. Public product API supports bounded pagination/category filtering; serializer exposes product data, not order/customer data. | Public catalog limiter: 120/minute. Invalid/unknown shop behavior is handler-specific (including 404). |
| `GET /healthz` | Anonymous | Health/readiness response; readiness queries the database and returns status only. | No route-specific limiter identified; automated test verifies database failure fails closed without detail. |
| `POST /api/v1/orders` | Anonymous customer | Accepts shop, customer/contact/address, payment-method/sender, item IDs/quantities, source/event ID. Server resolves price and stock; creates order and reserves inventory transactionally. | 30 requests/15 minutes; validation and generic error handler. |
| `POST /api/v1/customer/order-lookup` | Anonymous customer with order number plus phone | Returns a constrained order summary after matching both identifiers; no mutation. | 5 requests/15 minutes; input format validation and non-specific no-match response. |
| `POST /api/v1/admin/login`; `POST /api/v1/admin/mfa/enroll` | Login starts unauthenticated; MFA enrollment requires a valid short-lived signed setup token returned only after password verification. Successful login/enrollment issues an admin session; production platform-admin MFA is required by configuration. | Login accepts email/password and, for enrolled platform admins, TOTP. An unenrolled platform admin receives a 10-minute setup token/secret; enrollment accepts that token plus a valid TOTP proof and stores the encrypted secret. | Login/enrollment limiter: 8/15 minutes; no-store on login/enrollment responses; invalid/expired proof is rejected. |
| `GET /api/v1/admin/profile`; `POST /api/v1/admin/logout`; `PATCH /api/v1/admin/profile/password` | Authenticated admin; password change also requires current-password proof | Profile returns the configured identity/role; logout revokes current server-side session; password change updates hash and revokes active sessions. | Password-change limiter: 5/15 minutes. |
| `GET /api/v1/admin/shop/categories`; `POST /api/v1/admin/shop/categories`; `PATCH /api/v1/admin/shop/categories/:id`; `DELETE /api/v1/admin/shop/categories/:id` | Authenticated selected-shop owner/admin; platform-admin is not accepted by the shop-manager guard | Read category/product counts; create/rename bounded category name; deletion requires explicit boolean `deleteProducts` and performs a transaction. | Category-name/ID validation, parameterized queries, uniqueness conflicts return 409; no dedicated limiter identified. |
| `GET /api/v1/admin/products`; `POST /api/v1/admin/products`; `PUT /api/v1/admin/products/:id`; `DELETE /api/v1/admin/products/:id` | Authenticated selected shop; read requires shop-dashboard access; mutations require shop owner/admin | Read is shop-scoped. Mutations validate product fields and category, accept bounded image fields, generate IDs, update/delete shop-scoped records, and record activity. | Upload limiter: 10/15 minutes; image upload limits/signature checks; invalid inputs and missing objects return explicit errors. |
| `GET /api/v1/admin/orders`; `GET /api/v1/admin/orders/:id/activity`; `PATCH /api/v1/admin/orders/:id/status`; `PATCH /api/v1/admin/orders/:id/advance-payment` | Authenticated selected-shop dashboard role; platform admin is denied shop order access | Reads shop-scoped orders/activity; mutations accept order status or payment-review transition, enforce current state/ownership, and record audit/activity. | No route-specific limiter identified; validation/state errors are handled by routes. |
| `GET /api/v1/admin/permissions`; `GET /api/v1/admin/settings`; `PUT /api/v1/admin/settings/:settingGroup/:settingKey`; `GET /api/v1/admin/audit` | Authenticated platform administrator with registered `permissions.read`, `settings.read`, `settings.write`, or `audit.read` permission respectively | Reads role/permission settings; writes a selected setting value and secret flag via validated key/group; audit output is redacted. | Permission middleware returns 403; handler/database errors go to common error handling. |
| `GET /api/v1/admin/shops`; `POST /api/v1/admin/shops`; `PATCH /api/v1/admin/shops/:shopId/status`; `DELETE /api/v1/admin/shops/:shopId`; `PATCH /api/v1/admin/shops/settings` | Listing requires authentication; create/status/delete require platform admin; current-shop settings require platform admin plus selected shop | Shop list/creation, state changes/deletion, and selected shop settings. Writes are shop-scoped/validated and may record audit/activity. | UUID, slug, state, and body validation in handlers; no dedicated limiter identified. |
| `POST /api/v1/admin/shop/members`; `GET /api/v1/admin/shop/members`; `PATCH /api/v1/admin/shop/members/:userId`; `DELETE /api/v1/admin/shop/members/:userId` | Authenticated platform administrator or selected-shop owner/admin; selected shop required | Create/list/change/remove member identity/role; role/removal paths revoke the affected member session and record activity. | Role/email/body validation; membership authorization is server-side. |
| `GET /api/v1/admin/shop/hero-slides`; `POST /api/v1/admin/shop/hero-slides`; `PUT /api/v1/admin/shop/hero-slides/:id`; `POST /api/v1/admin/shop/hero-slides/order`; `DELETE /api/v1/admin/shop/hero-slides/:id` | Read requires platform reader; writes require platform admin and selected shop | Slide text/target URL/order and desktop/mobile images; mutations alter shop presentation and clean rejected uploads. | Upload limiter and image validation; target URL length/protocol checks. |
| `POST /api/v1/admin/shop/branding`; `GET /api/v1/admin/shop/profile`; `PATCH /api/v1/admin/shop/profile` | Authenticated platform admin or selected-shop owner/admin; selected shop required | Upload branding image and read/update shop profile fields/logo; changes are tenant-scoped. | Upload limiter, signature/size validation and field bounds. |
| `GET /api/v1/admin/shop/transactions`; `POST /api/v1/admin/shop/transactions`; `PATCH /api/v1/admin/shop/transactions/:id/status` | Reads require platform reader; writes require platform admin plus selected shop | Read/create manual transaction entries and change pending/verified/rejected state; no payment-provider request is implied. | Transaction type/status/date/amount validated by handler; no external money movement tested. |
| `GET /api/v1/admin/shop/reports`; `GET /api/v1/admin/shop/activity` | Authenticated platform admin plus selected shop | Shop-scoped report/activity summaries; query filters are handler-defined. | Permission/tenant guard; query cost and bounds not live-tested. |
| `GET /api/v1/shops/:slug/offers`; `GET /api/v1/admin/shop/offers`; `POST /api/v1/admin/shop/offers`; `PATCH /api/v1/admin/shop/offers/:id` | Public offer read; administrative read requires platform reader; writes require platform admin plus selected shop | Public shop offers and shop-scoped create/update; no coupon redemption or discount checkout route identified. | Public-offer limiter not identified in route registration; inputs validated in handler. |
| `GET /api/v1/shops/:slug/push-key`; `POST /api/v1/shops/:slug/push-subscriptions`; `GET /api/v1/shops/:slug/push-subscriptions`; `DELETE /api/v1/shops/:slug/push-subscriptions` | Public endpoint; no admin identity required | Exposes configured public VAPID key; creates a subscription, checks subscribed state for one supplied endpoint, or removes the subscription when its exact endpoint is supplied. It does not return the subscription list. Subscriptions are capped per shop and endpoint hosts are allowlisted. | Push subscription limiter: 10/15 minutes; optional feature depends on VAPID configuration. No push send was triggered. |

## Limitations of the route inventory

- Route registration and middleware order were inspected, but no exhaustive per-route live input/response exercise was possible while the preview and database were stopped.
- The code does not provide a complete machine-readable OpenAPI schema; field summaries above are derived from inline validators and handler behavior.
- Authentication, tenant scope, status codes, rate limits, and output shapes still require an authenticated synthetic test matrix after a documented account reset is available.

## Coverage summary

The machine-readable matrix contains **1,000 unique candidate scenarios**. Automated test totals are not added to catalogue totals.

| Scenario status | Count |
|---|---:|
| PASS | 23 |
| FAIL | 2 |
| BLOCKED | 62 |
| NOT TESTED | 888 |
| NOT APPLICABLE | 25 |
| **Total** | **1,000** |

Applicability counts are 974 applicable, 1 needs confirmation, and 25 not applicable. The 23 PASS entries are limited to explicitly identified unit/API/mock, dependency-audit, or source-review evidence. The two FAIL entries describe the previously exposed local launch text and insert-only credential bootstrap behavior; they are not live exploit claims.

Evidence classes are separated as:

- **Automated unit/API/mock tests:** password validation, selected session and role behaviors, membership checks, checkout rollback/idempotency, readiness failure behavior, audit redaction, migration validation, staging-config validation, and other existing suite cases.
- **Source review:** route registration, middleware sequencing, secret/bootstrap code, PostgreSQL query/bootstrap design, Docker Compose, CI workflow.
- **Prior live local evidence:** application-to-database identity and read-only fixture counts. This environment is stopped now.
- **Blocked:** live authenticated browser/API tests, session expiry/revocation on the running preview, database writes/concurrency, secret rotation, current DB identity, and restore tests.
- **Not tested:** production/staging, external network/TLS/DNS ownership, real push/payment, alert receipt, independent backup restoration, and many protocol-level tests.
- **Not applicable:** scenarios for features not present in the inspected implementation, with individual rationale in the JSON.

No active exploitation, guessed credential, real checkout, live write, staging/production access, or destructive operation occurred.

## Security references

- OWASP Top 10:2025 — `https://top10.owasp.org/2025/`.
- OWASP API Security Top 10:2023 — `https://api-security.owasp.org/editions/2023/en/0x00-header/`.
- OWASP ASVS 5.0.0 — `https://owasp.org/projects/asvs`.
- OWASP WSTG v4.2 — `https://wstg.owasp.org/v4.2/`.
- MITRE CWE catalog v4.20 — official MITRE CWE catalog archive (`cwec_v4.20.xml`).
- Node.js v22 process documentation — `https://nodejs.org/docs/latest-v22.x/api/process.html`.

The versioned references are classification and test-design sources, not assertions of certification.
