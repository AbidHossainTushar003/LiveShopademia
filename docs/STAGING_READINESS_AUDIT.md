# Shopademia Staging Readiness Audit

- **Audit date:** 2026-10-14
- **Repository:** `feature/admin-v2` at `798e7227e907edbbd262e8fe25b78d9e79cd7247`
- **Decision:** **STAGING BLOCKED / NOT READY; PRODUCTION NO-GO**

This report reconciles current repository and local-preview evidence. Configuration files, passing mocks, and a loopback preview are not evidence that a hosted staging target exists or is safe to release to. No external target, production environment, or DNS was contacted.

## Current closure verification — 2026-10-14 19:26 +06

This entry supersedes earlier claims that the local preview was available for a current browser run. Earlier 9/9 public browser results are historical evidence from their recorded run; the current preview was not listening and the current run did not exercise the storefront.

- **Preservation:** repository root is `C:/Users/Abidh/OneDrive/Desktop/storefront`; branch/HEAD/upstream are `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247` / `github/feature/admin-v2`. Staged diff is empty. Existing tracked and untracked work was preserved.
- **Static containment:** `server/app.js` canonicalizes paths with `realpath()` in middleware, then passes the path to Express static serving, which opens it separately. This does not bind validation to the later open; concurrent filesystem replacement can exploit a TOCTOU window if an actor can write a path component. The disposable junction regression rejects an already-present escape; it is not a race test. No portable race-resistant fix is demonstrated. Require deployment-owned immutable code/static roots; runtime read/traverse only with no create/replace/rename/delete/ACL-change rights; uploads outside served release roots; app-writable non-served ingestion; trusted immutable publication; and actual ownership/ACL/mount and denied-write evidence. Gate remains **BLOCKED** until controls are independently verified.
- **Historical database URL:** the removed value was not read, printed, tested, or reintroduced. Validity and reuse remain unknown. The authorized owner should assess through approved, access-controlled secret procedures whether it was usable or reused. If confirmed or plausibly exposed, revoke/rotate through the secret owner, assess relevant logs and copies, and record scope/outcome without recording the secret. Do not attempt authentication.
- **Secret scan:** no `secretlint`, `gitleaks`, `trufflehog`, or `detect-secrets` executable and no project scan script were available. No tool was installed; no fresh secret scan was performed.
- **CI source only:** `.github/workflows/ci.yml` declares `contents: read`, tests/audits on PR and push, and a production deploy condition requiring push to `main` and `CPANEL_DEPLOY_ENABLED == 'true'`; it declares no GitHub `environment`. These are checked-in YAML facts, not evidence of remote rules, environment protection, or credential scope. Actual GitHub settings remain **UNVERIFIED**.
- **Current safe tests:** `npm.cmd run test:api` 85/85; `npm.cmd test` 133/133 (includes API; overlapping totals); `node --test scripts\staging-config.test.js` 15/15; `node --test scripts\playwright-target.test.js` 7/7; all exit 0. `npm.cmd audit --audit-level=low` exit 0, 0 vulnerabilities, online registry `https://registry.npmjs.org/` with npm offline false. `npm.cmd run validate:staging` exit 1 as expected because `.env.staging` is absent.
- **Current public E2E:** `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` exited 1; all 9 public-only cases failed to connect (`ERR_CONNECTION_REFUSED` / `ECONNREFUSED`). No listener was present on 127.0.0.1:3002 or isolated PostgreSQL 127.0.0.1:55441. This is **BLOCKED by unavailable preview**, not evidence of nine application defects or a passing browser regression. Preview was not started/restarted; PostgreSQL 5432 was not touched.
- Matrix remains 1,000 unique IDs with unchanged historical counts: PASS 23, FAIL 2, BLOCKED 62, NOT TESTED 888, NOT APPLICABLE 25. Current target availability is appended without changing historical scenario outcomes.
- **External decisions:** D01–D12 remain pending/unverified/unapproved. An unsent concise D01 decision request and D02–D12 evidence/acceptance checklist are in `docs/STAGING_APPROVAL_REQUEST.md`; no target or approver has been invented.

## Final pre-staging evidence — 2026-10-14

Branch and HEAD were verified as `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`. The worktree is still dirty with prior source, Android, installer, report and audit artifacts; no existing changes were discarded, staged, committed, or pushed. The local preview was not restarted. Only the explicitly public-only browser suite used it; no prohibited route, privileged request, SQL query/write, or migration was sent/run in this pass.

### Final safe verification

| Command/check | Result |
|---|---|
| `node --test --test-name-pattern='junctions that resolve' server\app.test.js` | Exit 0; 1 passed, 0 failed. The disposable junction fixture verifies in-root upload access and out-of-root rejection for both normal and read-only-preview app configurations. |
| `node --test scripts\playwright-target.test.js` | Exit 0; 7 passed, 0 failed. |
| `npm.cmd run test:api` | Exit 0; 85 passed, 0 failed, 0 skipped. |
| `npm.cmd test` | Exit 0; 132 passed, 0 failed, 0 skipped. This overlaps the API suite. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm.cmd run test:e2e` | Exit 0; 9 public Chromium tests passed. These are allowed public reads; admin/write workflows were not selected. |
| Privileged loopback probe with explicit opt-in: `npm.cmd run test:e2e:all -- --list` | Expected exit 1; both admin spec imports rejected `127.0.0.1` before listing tests; total 0 tests, no browser launched. No prohibited HTTP request was sent. |
| `git diff --check` | Exit 0; no whitespace errors. |

### Static-file guarantee and residual risk

The canonical-realpath check now runs before `express.static` for every static mount and app mode, rejecting observed traversal/NUL/junction escapes with a generic failure; the latest fake-app API tests and disposable Windows junction test passed. This does **not** remove the check-to-open race: a filesystem actor that can replace path components after canonicalization may redirect the later open. No race exploit was demonstrated, and no deterministic concurrent-replacement harness was run. Required deployment constraint: code and public asset roots must be immutable/read-only to untrusted identities; filesystem changes must be restricted to trusted operators; uploads must be isolated and writable only by the application. A stronger guarantee requires an implementation using platform-supported handle-relative confinement or a separately isolated static-serving design.

### CI, secret and dependency evidence

- Source inspection of `.github/workflows/ci.yml` found top-level `contents: read`; PR/push test and audit jobs; a production deployment condition requiring a push to `main` and `CPANEL_DEPLOY_ENABLED == 'true'`; no declared GitHub `environment`; and references to `${{ secrets.CPANEL_SSH_KEY }}` / `${{ secrets.CPANEL_KNOWN_HOSTS }}`. The organization/repository availability and scope of those secrets cannot be inferred from the checked-in YAML.
- Branch protection, required status checks/reviews, GitHub environment approvals, Actions permissions, and actual secret scopes are **UNVERIFIED**. Read-only settings/API calls returned 403/404 and authenticated GitHub CLI was unavailable. These errors are not evidence that settings do not exist.
- `npm.cmd audit --audit-level=low` was an online audit: configured registry `https://registry.npmjs.org/`, npm offline mode false, result `found 0 vulnerabilities`. This is current invocation evidence, not a guarantee of future advisory state.
- Ephemeral Secretlint scan: 173 repository text files scanned; seven DB-connection-string pattern alerts in `.env.example` (2), `.env.production.example` (2), `.env.staging.example` (2), and `scripts/staging-config.test.js` (1). Values were never printed. They are potential matches, not confirmed credentials; the `.env.example` line 9 alert was not classified as a normal key-value placeholder during redacted triage and needs owner review. Temporary scanner config/report were removed; dependency manifests were not changed.

### External release decisions still outstanding

No authorized target or approvals were supplied. Release owner/provider/DBA/security/billing/SRE must still provide: provider, account, region and named owners; runtime/process model and sizing; staging hostname/DNS authority, TLS certificate and API routing; dedicated PostgreSQL service/database/least-privilege roles/network boundary; isolated persistent upload storage and backup coverage; unique secret manager, access and rotation policy; restricted admin access and synthetic-only identities/data; itemized costs, cap and spending approval; backup retention/RPO/RTO and independent restoration reviewer; monitoring, alert acknowledgment and escalation ownership; measured rollback triggers/procedure and release authorization; protected CI environment/reviewers, staging-scoped deployment credentials and artifact provenance. The detailed approver/evidence/dependency package is in [STAGING_APPROVAL_REQUEST.md](./STAGING_APPROVAL_REQUEST.md) and [STAGING_TARGET_APPROVAL_BRIEF.md](./STAGING_TARGET_APPROVAL_BRIEF.md).

**Release decision unchanged: STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.** No external capability or approval is inferred from local configuration or inaccessible settings APIs.

### External approval completeness check — 2026-10-14 10:52 +06

The approval package now assigns an accountable owner **role** to each decision, records all as pending/unverified or unapproved, identifies the required evidence, and states an acceptance criterion. No individual approver names or signed approval records exist in the inspected documents. The release owner must assign named people; role labels alone do not clear a gate. The decision-by-decision register is in [STAGING_APPROVAL_REQUEST.md](./STAGING_APPROVAL_REQUEST.md).

Actual GitHub protection/settings were not observable in this pass: five unauthenticated REST GETs (branch protection, rulesets, Actions permissions, environments, and workflow contents) returned HTTP 403 API rate-limit responses; the GitHub MCP branch list returned 404 for the configured mirror; `gh` is not installed. No actual settings payload was received. Branch protection, required checks/reviews, environment reviewers, Actions permissions, credential scopes, and remote workflow content therefore remain **UNVERIFIED**. The local `.github/workflows/ci.yml` is the only inspected workflow evidence and cannot establish account-level protection.

The staging configuration gate was rechecked: `.env.staging` is absent; `npm.cmd run validate:staging` exited 1 and reported that staging configuration is invalid because it must be created from the example with placeholders replaced. This is the expected fail-closed result. No configuration or secret was created.

The 12 decisions now have IDs D01–D12 and explicitly record dependencies, whether the next step is external or locally preparable, the accountable role, exact next action, approval status, required evidence and acceptance criterion. No named individuals or approvals are recorded. A concise release-owner/provider summary and manual repository-admin verification checklist are in [STAGING_TARGET_APPROVAL_BRIEF.md](./STAGING_TARGET_APPROVAL_BRIEF.md). The settings request remains unanswered/unverified.

### Static-file TOCTOU and historical secret-pattern triage — 2026-10-14 11:07 +06

- **Static serving:** inspection confirms `realpath()` validation occurs before `express.static` separately opens the path. A concurrent replacement can still escape the checked path. The junction fixture verifies only rejection of a pre-existing junction; it does not verify race resistance. No code change can safely claim to close this cross-platform Express pathname TOCTOU without a handle-relative serving design. Keep the race gate **BLOCKED** absent enforced filesystem separation or platform-specific implementation and race evidence.
- **Required hosted ownership:** deployment/release principal owns immutable code and static roots plus their parents; runtime principal has read/traverse only and no directory-entry create/replace/rename/delete or ACL-change rights. Keep uploads outside the release tree; do not directly serve app-writable ingestion. Prefer isolated app-writable quarantine followed by trusted validation/publish into immutable content-addressed storage mounted read-only to the serving process. Block untrusted symlink/junction/reparse-point creation. Acceptance evidence must show actual staging UID/SID, owners, ACL/mount identities, failed runtime mutation attempts, allowed ingestion-only writes, immutable publication, and paired DB/upload restore. If those controls cannot be evidenced, the gate remains blocked.
- **Secret-pattern finding:** redacted structural inspection found `.env.example` line 9 was a bare, unassigned loopback PostgreSQL connection string with a non-placeholder password-like component. It has been removed from the current worktree; the password was not printed or tested. Whether it was usable, used, or reused elsewhere is **UNVERIFIED** and requires owner review. Do not connect to a database or rotate anything without authorization.
- The remaining flagged URL examples have placeholder-backed passwords and are classified as harmless documented templates. The `scripts/staging-config.test.js` match is a synthetic invalid-host fixture with synthetic password variables, not runtime configuration. No scanner was rerun; no dedicated/repository-supported scanner is installed. Do not claim a fresh secret scan passed.
- Current regression results: `node --test scripts\staging-config.test.js` 15/15; `npm.cmd run test:api` 85/85; `npm.cmd test` 133/133; `node --test scripts\playwright-target.test.js` 7/7; public-only `npm.cmd run test:e2e` against the already-running loopback preview 9/9. All exited 0. API tests overlap with the full Node suite. `npm.cmd run validate:staging` exited 1 as expected because `.env.staging` remains absent.
- Current GitHub REST recheck: five unauthenticated read-only GETs for branch protection, rulesets, Actions permissions, environments, and workflow content each returned HTTP 403 (API rate limit exceeded). No actual settings were observed; all repository-level protection and credential-scope claims remain **UNVERIFIED**.

### Build and dependency recheck — 2026-10-14 11:15 +06

- `npm.cmd run build:css` exited 0 using Tailwind v4.3.3. The tracked generated stylesheet changed by adding one `.isolate` utility; no server was started.
- Fresh `npm.cmd audit --audit-level=low` exited 0 and reported 0 vulnerabilities. npm offline mode was `false` and registry was `https://registry.npmjs.org/`, confirming an online advisory query.
- Secret-scanner check found no supported executable or project script; no fresh scan is claimed. The historical example-URL finding remains subject to owner verification as documented above.
- `.env.staging` remains absent; validation exited 1 as expected. Branch, HEAD, staged state, and dirty/untracked work remain as recorded in the current integrity check.

### Fresh regression and bounded security review — 2026-10-14 11:15 +06

- `npm.cmd test` exited 0: 133 passed, 0 failed/skipped (includes API/server tests).
- `node --test scripts\playwright-target.test.js` exited 0: 7 passed. Public-only `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` exited 0: 9 passed against the existing preview. No server restart or privileged preview operation occurred.
- The read-only security review found no actionable vulnerability in the reviewed changes; it was bounded and is not a full-system security certification.
- Public browser coverage did not exercise cart/wishlist state changes, checkout, admin, order lookup, or any other prohibited preview workflow. Such operations remain untested against the live process.
- Local green results do not change the release gates. Static TOCTOU, GitHub controls, D01–D12 evidence, independent recovery, TLS/routing, monitoring, rollback, and authorized target ownership remain unresolved.

### Safe QA follow-up — 2026-10-14 10:56 +06

- Rechecked repository: branch `feature/admin-v2`, HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`, upstream `github/feature/admin-v2`. Existing staged state is empty; existing unstaged/untracked artifacts were not discarded.
- `npm.cmd test` passed **132/132**, exit 0; this includes the API/server test files. `node --test scripts\playwright-target.test.js` passed **7/7**, exit 0.
- Public E2E discovery listed only 9 tests from `tests/e2e/storefront.spec.js` (exit 0); running the public suite against the current configured loopback preview passed **9/9** (exit 0). It did not restart/reconfigure the process and did not request privileged routes or operations.
- Privileged guard probe used explicit opt-in against loopback: `npm.cmd run test:e2e:all -- --list` exited 1 as expected, listed 0 tests and launched no browser.
- Fresh online `npm.cmd audit --audit-level=low` exited 0 and reported 0 vulnerabilities (registry `https://registry.npmjs.org/`, npm offline false). No dedicated secret scanner or repository-supported scan target was available; prior ephemeral Secretlint results are not represented as freshly re-run.
- The staging validator was confirmed fail-closed with absent `.env.staging` (expected exit 1); `git diff --check` exited 0. Public browser E2E performed only allowed app-mediated reads; no direct database connection/query, database write, preview restart, DNS/provider operation or deployment occurred.

## Current read-only audit follow-up — 2026-10-14

The latest follow-up below supersedes test totals and static-link statements in this section where they differ.

### Request lifecycle and route enforcement

- Source review confirms request-ID/security headers and Helmet run before the read-only guard. The guard runs before canonical redirects, body parsing, static middleware, routers, and business handlers. Only allowlisted GET/HEAD requests proceed; other methods receive 405 with `Allow: GET, HEAD`, and unapproved GET/HEAD routes receive a generic 404.
- The fake-pool HTTP regression checks representative admin, order lookup, notification, unknown, encoded-alias, query-string, and HEAD paths. Denied paths issue no SQL; the fake pool rejects any non-SELECT query. Allowed catalog/static GET and HEAD requests succeed. Exact and alternate encoded traversal probes return generic 404 without sensitive markers.
- In-process static middleware in both app modes canonicalizes paths before `express.static`. A disposable Windows directory-junction test confirms an in-root upload serves and a junction to a sibling path is rejected. The check has a time-of-check/time-of-use window if another actor can replace filesystem paths concurrently; no race exploit was run, and this is not race-proof descriptor-relative confinement. Keep roots immutable/read-only to untrusted actors and uploads separately writable only by the app. The live preview process was not restarted, so this code change is not asserted as active in that process.
- The first containment regression run exposed an HTTP 500 for a percent-encoded NUL path because it reached filesystem resolution. The guard now rejects decoded NUL bytes as a generic 404; the full traversal/malformed-path regression and API suite passed afterward.
- Public shop catalog CORS is intentionally `Access-Control-Allow-Origin: *` for public listing data. The guard precedes CORS/application handlers for unapproved routes. The public-page security headers include a restrictive CSP and `Referrer-Policy: strict-origin-when-cross-origin`. A live health GET returned 200 with a request ID and `Cache-Control: no-store`.
- `index.html` requests Font Awesome CSS from cdnjs and fonts from Google Fonts; CSP permits those stylesheet/font origins. The browser outage test confirms graceful rendering when those requests are aborted. These third parties can observe visitor network/browser metadata; strict-origin referrer policy limits cross-origin referrer detail. Tracking defaults are disabled until configured/consented, but no independent review of third-party privacy terms was performed. Decide whether to self-host or disclose these dependencies.

### Public browser evidence

- `npm.cmd run test:e2e` now runs only `tests/e2e/storefront.spec.js` against the explicitly configured local target: **9 passed, 0 failed** in Chromium.
- Covered `/?shop=main`, `/privacy?shop=main`, `/terms?shop=main`, `/about?shop=main`, `/shops?shop=main`, `/deals?shop=main`, a synthetic product detail, the corresponding category, and a generic unknown path (404). Public shop/catalog APIs, internal same-origin requests, static CSS/JavaScript/SVG and rendered images are exercised by those browser flows and the in-process HTTP regression.
- Responsive checks used 390×844, 768×1024, and 1365×900. Keyboard focus/name, the category product-link accessible name/destination, no same-origin failed/4xx homepage resources, runtime page errors, CDN outage fallback, and Axe WCAG 2.1 AA/WCAG 2.2 AA checks for homepage/privacy/terms were verified. The CDN test deliberately aborts Google Fonts and cdnjs requests; it demonstrates local fallback only, not vendor uptime.
- Privileged Playwright specs now fail closed unless `PLAYWRIGHT_ALLOW_PRIVILEGED_E2E=1` is explicitly set and a validated non-loopback HTTPS staging target is configured. The staging target must match the supplied hostname and retain per-run artifacts outside the repository. Local unit tests verify localhost, trailing-dot localhost, `.localhost`, IPv4 loopback and IPv6 loopback rejection. This does not establish DNS ownership or prevent an approved hostname from resolving to an unintended network.

### Scope-control incident and correction

- Before the default browser script was narrowed, `npm.cmd run test:e2e` expanded to all Chromium specs. That run requested `/admin`, `/admin/platform`, and admin asset paths against the local read-only preview. The specs failed to render the admin UI; the active guard is configured to reject those paths, but the run did not assert or record their response status, so it is not route-status evidence. API requests in specs with `page.route` mocks were intercepted; the admin login test timed out while looking for its email field before submitting. No login POST, database write, or prohibited order/checkout operation was observed. The run finished 8 passed / 8 failed; its admin failures are blocked UI tests, not evidence of admin behavior.
- This was outside the requested browser scope and is recorded as a process error, not a security test result. The `test:e2e` default now targets only public storefront specs; `test:e2e:all` is documented for an independently approved disposable staging target only. Do not repeat the broad suite against this preview.

### Test and environment evidence

| Check | Result |
|---|---|
| Focused preview route tests | `node --test --test-name-pattern='read-only preview' server\\app.test.js server\\readOnlyPreview.test.js` — 5 passed, 0 failed (before static-junction regression was added) |
| Static junction containment regression | `node --test --test-name-pattern='junctions that resolve' server\\app.test.js` — 1 passed, 0 failed, 0 skipped |
| Playwright target-safety tests | `node --test scripts\\playwright-target.test.js` — 7 passed, 0 failed |
| Privileged E2E fail-closed probe | PowerShell `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'; npm.cmd run test:e2e:all -- --list` — expected nonzero; both privileged spec files rejected loopback target at import/discovery, 0 tests listed and no browser launched |
| API suite | `npm.cmd run test:api` — 85 passed, 0 failed |
| Complete Node suite | `npm.cmd test` — 132 passed, 0 failed |
| Public Chromium suite | `npm.cmd run test:e2e` — 9 passed, 0 failed |
| Whitespace check | `git diff --check` — passed |
| Live preview health | `GET http://127.0.0.1:3002/healthz` — 200, `{"status":"ok"}`, request ID present |
| Listener inspection | App PID 19896 on `127.0.0.1:3002`; preview PostgreSQL PID 24368 on `127.0.0.1:55441`; PostgreSQL 17 PID 8084 on loopback 5432; no 5433 listener. No connection was made to 5432 or 5433. |
| Database inventory | No fresh direct database count comparison was made in this audit. Browser traffic used only public reads; route tests used an in-process fake pool. The prior recorded inventory is historical evidence, not a new before/after comparison. |
| Staging and production | No external target, DNS, provider, staging, or production request/action was performed. |

The matrix adds only scoped evidence to `assessmentUpdates`; its 1,000 scenario rows and prior aggregate statuses remain unchanged. Authenticated administration, session/MFA flows, order lifecycle, uploads against a writable database/storage target, inventory concurrency, the static path race window, external TLS/reachability, monitoring, backups/restoration, and disaster recovery remain untested or blocked. External font/icon requests also remain third-party dependencies; consider self-hosting after a product/privacy decision. **Staging remains BLOCKED / NOT READY; production remains NO-GO.**

## 0. Follow-up blocker investigation — 2026-10-14

### Fresh local revalidation

- Branch/HEAD remain `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`. The worktree remains dirty with prior application, Android, security-report, matrix, and installer changes; none were reverted or staged.
- The preview currently answers `GET /healthz` with 200, `GET /` with 200, and `GET /api/v1/products` with 200. The browser target remains `127.0.0.1:3002`.
- Current listener inspection found the app on `127.0.0.1:3002`, PostgreSQL preview on `127.0.0.1:55441`, PostgreSQL 17 on port 5432, and no listeners on 3003, 5433, 80, or 443. PostgreSQL 17 was not queried or changed. No 5433 connection was attempted.
- Docker context is `desktop-linux`; `docker ps` failed because the Docker Desktop Linux-engine named pipe is unavailable. Consequently no current Compose runtime, container identity, staging container, or staging volume can be verified. Historical image-build/config checks in the deployment runbook remain historical, not current runtime evidence.
- `npm.cmd run validate:staging` failed safely because `.env.staging` is absent. No staging credentials or configuration were created; this confirms the local checkout is not configured for a staging target.
- The last read-only database identity/inventory evidence remains the prior audit's evidence, not a fresh database query in this follow-up. This check made only HTTP reads; it did not run SQL, migration, bootstrap, or write operations.

### Blocker register

| Priority / severity | Exact blocker | Can this be resolved locally? | Evidence currently available | Missing evidence | Safest next action and accountable owner |
|---|---|---|---|---|---|
| P0 / Critical | No authorized, distinct staging host/runtime and no independently verified database isolation. | **Partly**: Compose semantics and safe local validation can be tested. Actual ownership, host/account, running network, DB identity, role grants and volume separation require the account/provider operator. | `docker-compose.staging.yml` describes separate app, migration, private DB network and named volumes; validator tests exist. Current Docker engine is unavailable. Local preview is a different read-only service at 3002/55441. | Written scope/target ownership; actual isolated staging app, DB, roles, credentials, storage and ingress identities; proof no shared production resource; successful app-to-staging-DB identity check. | **Business/release owner** identifies/authorizes the target; **hosting operator + DBA** provision and provide sanitized identity/network/grant evidence. Do not run Compose `up` until target and secret provenance are approved. |
| P0 / Critical | No verified staging HTTPS hostname, TLS certificate, API routing, or external reachability. | **No** for real DNS/provider TLS/reachability; local Caddy syntax/config validation is possible after Docker is available. | Repository Caddy/Compose configuration proposes proxy routing; no current listener on local 80/443. Playwright target guards require exact staging-host approval before remote browser tests. | Verified hostname ownership/mapping, certificate chain/SAN/SNI/expiry, redirect/HSTS, exposed ports/firewall, trusted-proxy behavior, external API and storefront responses/request IDs. | **Domain/account owner + hosting/network operator** supply verified hostname and ingress evidence; then execute authorized HTTPS smoke checks. No DNS or remote probe now. |
| P0 / Critical | No staging backup restoration, migration recovery, or application rollback rehearsal. | **Not against an actual staging dataset.** Procedure/unit-test preparation can be local, but a meaningful restore requires an approved staging source plus separate isolated restore destination and credentials. | Runbook contains a proposed paired DB/uploads backup and restore process. Local preview recovery backup is unrelated to staging. No independent staging restore was run. | Verified backup integrity/decryption, isolated restore identity, DB/schema/upload invariant checks, recorded time/RPO/RTO, migration interruption recovery and app rollback evidence, second reviewer. | **DBA + release manager** run paired backup and restore drill only after staging exists; capture sanitized logs and independent review. Never restore over source. |
| P1 / High | Monitoring, alert receipt, log review, health-check ownership and escalation are absent/unverified. | **Partly**: health endpoint behavior and sanitized local logging can be tested. Delivery to an external monitoring destination requires its owner and configured service. | Local `/healthz` returns 200 now; Compose proposes an internal app health check. No external monitor/alert destination is configured or evidenced. | Named monitor/receiver, alert thresholds, alert receipt/acknowledgement, log retention/redaction, DB saturation/disk checks, on-call and escalation owner. | **SRE/operations owner** selects approved staging-only destination and operators; test synthetic alert after authorization. |
| P1 / High | Authenticated admin, MFA, authorization/tenant separation, session revocation and write-path acceptance are not live-tested on staging. | **Only mock/API regression** locally. Real staging authentication requires verified disposable staging identities and reset/provisioning procedures. | Existing automated API suite covers selected login/MFA/logout/revocation/authorization behavior; anonymous local API gates were tested previously. Current read-only preview intentionally disables writes. | Live synthetic account results for roles/shops, MFA/replay, cross-tenant denial, logout/expiry/revocation, audit/request correlation and access restrictions on the staging target. | **Application owner + security QA** first establish staging identities and a scoped test plan; execute only against verified disposable staging. |
| P1 / High | Checkout, order lifecycle, inventory concurrency and uploads lack live integration evidence. | **No** on the current read-only preview. Can extend mock/unit coverage; write-path integration requires a disposable staging DB/storage. | Unit/API tests cover selected server pricing, validation, idempotency, transaction rollback, inventory conflicts, and upload validation. Local preview write routes remain blocked. | Bounded live synthetic checkout/order cleanup, concurrency invariants/no oversell, uploaded object containment/restart persistence, no real payment/customer traffic, inventory/audit before/after snapshots. | **QA + DBA + application owner** provision disposable fixtures, baseline assertions and cleanup plan in staging; prohibit real payment/notification recipients. |
| P1 / High | CDN/font outage behavior and third-party privacy implications are incompletely evidenced. | **Yes** for deterministic browser interception and code/privacy review; provider-wide availability remains external. | Source imports Font Awesome from cdnjs and Google fonts; tracking defaults off and is consent-gated. Previous browser interception attempt timed out before readiness. | Reproducible browser proof of fallback layout/navigation with CDN requests blocked; tested no-tracking behavior; privacy disclosure review; owned decision on self-hosting/version/SRI and CSP. | **Frontend/privacy owner** reviews the test and notices. A new deterministic local browser test is added below; do not interpret this as provider uptime evidence. |
| P1 / High | CI/deployment authorization and artifact provenance for staging are not established. | **Partly**: workflow source tests can be added after release design approval. GitHub environment settings/secret scopes/branch protection require repository-admin evidence. | CI source runs tests and npm audit; deployment job is main-only, cPanel-specific, and gated. No staging deploy workflow or verified staging environment was found. | Protected staging environment approvals, staging-only secrets, branch protection, runner restrictions, immutable artifact SHA/provenance and target-scoped deployment permission. | **Repository administrator + release owner** inspect GitHub settings and design a separate staging workflow after target selection. Do not repurpose production deploy job. |
| P2 / Medium | Fresh dependency advisory state and comprehensive cross-browser/accessibility coverage are incomplete. | **Partly**: local tests can run; current registry status needs approved network/CI. Cross-browser runtime may need browser installations. | CI has a locked `npm ci` and online audit step; prior offline audit used cached metadata. Narrow Chromium checks exist. | Fresh advisory report at exact SHA; Firefox/WebKit/device coverage; full keyboard/screen-reader/accessibility review and CDN failure result. | **CI owner + QA/accessibility owner** run locked CI on release SHA and broaden browser/accessibility checks with staging only after its test target is authorized. |

### What this follow-up resolves locally

- The former CDN/font outage test gap is addressed with a deterministic Playwright test that aborts only requests to the declared font/icon hosts and checks that core content, catalog results, layout width and runtime errors remain acceptable. The result below is limited to the local browser/preview and does not prove any external provider is available.
- Exact test: `npm.cmd run test:e2e -- --grep 'storefront remains usable when external font and icon CDNs are unavailable'` — Chromium **1 passed**. The test observed the cdnjs and Google Fonts stylesheet requests fail and verified the homepage/catalog remained usable without page errors or horizontal overflow. Since the Google Fonts stylesheet itself is aborted, this does not exercise a subsequent `fonts.gstatic.com` font-file request.
- Current regression results: `npm.cmd run test:api` — **84/84 passed**; `npm.cmd test` — **130/130 passed**; `git diff --check` — passed. These tests are local/mocked and not a staging acceptance run.
- `npm.cmd run validate:staging` — **blocked as expected** because `.env.staging` is absent. No staging secrets/configuration were created.
- Current preview HTTP responsiveness has been rechecked. This is a local development capability, not a staging blocker closure.
- No external/provider-dependent blocker is resolved. **Staging remains BLOCKED / NOT READY; production remains NO-GO.**

## Local-preview operating-policy enforcement — 2026-10-14

The mandatory local policy is stricter than the earlier audit's authenticated-admin-read behavior. The server allowlist is now limited to public storefront pages, public catalog/configuration reads, and approved static assets. All admin pages and admin API routes (including dashboard, products, orders, and profile reads), notification routes including push-key reads, the order-lookup page, and other unknown GET/HEAD paths return a generic 404 before business handlers or database queries. All non-GET/HEAD methods return 405 with `Allow: GET, HEAD` before route handlers. PostgreSQL connections are configured read-only, migrations/bootstrap are skipped, and startup requires the verified loopback target.

Earlier evidence that anonymous admin reads returned 401 describes the prior behavior and is historical; under the current policy those routes are unavailable. The preview was restarted as the verified local server process (PID 19896) under its existing protected configuration. Startup logged one managed product loaded and the loopback bind; startup target/schema verification uses SELECT-only queries. Homepage, category, synthetic product detail, catalog/categories APIs, CSS, JavaScript and SVG GETs returned 200. No disallowed endpoint or write-capable method was sent to the running preview. Automated guard regression tests exercise an in-process app with a fake pool that rejects non-SELECT SQL, and verify blocked admin/order-lookup/notification GETs do not issue database queries. The before/after read-only database inventory was not re-queried during this reload.

Exact validation: `node --test server/readOnlyPreview.test.js` — 4/4 passed; `node --test --test-name-pattern="read-only preview rejects privileged and write routes" server/app.test.js` — 1/1 passed; safe Chromium Playwright subset for homepage/catalog, category product accessible-name navigation, and CDN/font failure — 3/3 passed; `git diff --check` passed. The Playwright subset stayed on approved public reads/assets and did not visit the order-lookup or admin routes.

## 1. Evidence and current state

### Verified in this audit

| Item | Result | Evidence |
|---|---|---|
| Branch and revision | PASS | `feature/admin-v2`; expected HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`. |
| Local application | PASS | Reloaded Shopademia process PID 19896 serves `127.0.0.1:3002`; `/healthz` returned 200 after startup identity/schema checks. |
| Isolated local database | PASS (local-preview scope only) | PostgreSQL 16 process PID 24368 serves `127.0.0.1:55441`; read-only identity query reported database/role `shopademia_browser_preview`, `default_transaction_read_only=on`, and nonsuperuser. |
| Database inventory | PASS (unchanged in compared snapshots) | Before/after counts: 1 product, 0 orders, 1 admin, 0 sessions, 2 migration records. These checks were SELECT-only. |
| PostgreSQL 17 / configured 5433 | NOT TOUCHED | PostgreSQL listener on 5432 remained present; no 5433 listener was observed. No query was made to either target. |
| Read-only browser remediations | PASS | The four encoded traversal regression requests now return generic 404 responses; normal CSS, JavaScript, SVG, homepage, category, and detail paths return 200. The category image link exposes an accurate accessible name and opens the expected synthetic detail page. |
| API suite | PASS | `npm.cmd run test:api`: 84 passed, 0 failed, 0 skipped. |
| Full Node suite | PASS | `npm.cmd test`: 130 passed, 0 failed, 0 skipped. These suites include unit/API/mock evidence and are not hosted staging acceptance. |
| Browser accessibility regression | PASS (narrow scope) | Chromium Playwright role/name locator found the named category image link, verified its exact destination, clicked it, and found the product detail heading (1/1). This is not a full accessibility audit or cross-browser certification. |
| Dependency advisory snapshot | PASS (cached snapshot only) | `npm audit --audit-level=low --offline`: 0 vulnerabilities from locally available advisory metadata. Fresh registry advisory state was not fetched in this audit. |
| Whitespace | PASS | `git diff --check` passed. |

The latest audit did not change the expected branch/HEAD. Existing worktree changes and untracked audit evidence remain preserved. The only active application/database listeners relevant to this preview are loopback-bound. PostgreSQL 17 on 5432 remains a separate untouched listener.

### Historical facts that remain relevant

- The offline PG16 cluster backup and recovery logs from the prior authorized preview restoration remain preserved outside the repository. That recovery backup is not a staging backup and is not evidence of a staging restore drill.
- Prior preview recovery included authorized local recovery/bootstrap/reset work. The latest browser regression audit made no database writes. The database snapshot comparison in this report is the latest read-only inventory evidence.
- A previously exposed synthetic launch-secret incident was contained/rotated for the isolated local preview, but whether any values were reused outside that preview is unknown. Do not infer global rotation or closure from local evidence.
- The repository's 1,000-row security catalogue is a candidate scenario inventory, not 1,000 executed tests. Historical statuses are preserved; see the dated reconciliation in `SECURITY_TEST_MATRIX.json`.

### Release configuration evidence

- `.github/workflows/ci.yml` runs `npm test` and `npm audit --audit-level=low` on CI. It grants repository `contents: read`, uses pinned checkout/setup-node action SHAs, and has a production cPanel deploy job gated to a push on `main` and `CPANEL_DEPLOY_ENABLED == 'true'`.
- No independently verified staging workflow, GitHub environment approval configuration, branch protection, runner policy, protected staging secrets, or deploy artifact provenance was established.
- `docker-compose.staging.yml` is a repository-side proposal: separate database/app/migration services; distinct app and migration URLs/roles; internal database network; named database, uploads, and Caddy volumes; health checks; and Caddy ports 80/443. It is not proof of a provisioned host, valid DNS, successful certificate issuance, ingress controls, deployment, or rollback.
- The staging runbook says a local Compose candidate and images were prepared earlier; its recorded Docker engine was unavailable during that prior check. No staging Compose runtime is established by this audit.
- The production CI deploy uses in-place `rsync --delete`, installs dependencies in the target app directory, and restarts. It has no atomic release switch or health-triggered automatic rollback. Do not reuse it as a staging deployment procedure.
- The deployment runbook's backup scripts and proposed restore process have not completed an independent staging restore drill. No RPO/RTO or named recovery operators are evidenced.

## 2. Updated matrix reconciliation

`SECURITY_TEST_MATRIX.json` retains all original 1,000 scenario IDs, applicability values, and historical statuses. The original distribution (**23 PASS, 2 FAIL, 62 BLOCKED, 888 NOT TESTED, 25 NOT APPLICABLE**) is retained as its catalogue baseline, not represented as the latest complete assessment.

This audit adds a dated evidence record instead of converting broad candidate scenarios to PASS based on narrow local checks:

| Check group | Status | Scope |
|---|---|---|
| Exact encoded static traversal cases and encoding variants | PASS | Eight local read-only HTTP probes; generic 404, no file contents or secret/stack markers. |
| Normal static assets and public pages | PASS | Local HTTP status/content-type checks for CSS, JS, SVG, home, category, and synthetic product detail. |
| Category image-link accessible name and destination | PASS | One Chromium Playwright accessible role/name locator, exact href, click, and detail-heading assertion. |
| Unauthenticated admin reads and blocked writes | PASS for prior preview audit scope | Prior local evidence only; no authenticated session or mutation was used in this audit. |
| Live staging TLS, DNS, host routing, deployment and isolation | BLOCKED | No authorized staging target or external infrastructure evidence. |
| Authenticated workflow, tenant boundary, MFA, session revocation | BLOCKED / NOT TESTED live | Automated test evidence exists for selected paths; no live authenticated staging identity was used. |
| Production and any remote environment | NOT TESTED | No production access, DNS lookup, or remote request was made. |

The two historical FAIL scenarios for exposed launch text and insert-only bootstrap behavior remain FAIL at catalogue scope: local containment evidence does not establish that no external reuse occurred, and changing bootstrap configuration alone still does not rotate an existing account. The local preview's separately performed reset does not change that general behavioral finding.

## 3. Staging architecture and isolation proposal

This is a proposed target design, not authorization to provision resources.

1. **Dedicated runtime:** a separately owned staging host/account or isolated cloud project. Pin an immutable application SHA/image and runtime (repository CI uses Node 22; the project requires Node >=20). Validate `sharp` on the actual target OS/runtime.
2. **Private PostgreSQL:** a new PostgreSQL 16 staging database and private network. Use a one-shot migration/owner identity distinct from a least-privilege runtime app role; prohibit public DB ingress. Record server identity, version, grants, database/role names, and network policy without secret values.
3. **Secrets and sessions:** provision unique staging-only database passwords, JWT signing key, dedicated MFA encryption key, and any separately required encryption/integration keys in a staging-only secret store. No local-preview or production value is copied. Restrict secret readers, document rotation/revocation, and invalidate sessions on signing-key rotation.
4. **Storage:** separate persistent staging upload storage with app-only access. No production uploads or customer content. Test synthetic upload, validation, readback, persistence after app restart, and cleanup with a synthetic fixture.
5. **Ingress and TLS:** owner-verified staging hostname -> explicitly approved ingress -> Caddy/reverse proxy -> internal app service. Keep DB private and app inaccessible directly from the internet. Verify DNS ownership, routing, certificate chain/SNI/expiry, TLS redirects, forwarded-host/proto handling and trusted-proxy count from an authorized external network.
6. **Admin access:** preserve application login, MFA, role and tenant checks. Add an owner-approved VPN/IP/identity-proxy restriction where available; create separate synthetic platform/shop-admin accounts and at least two synthetic shops. No live customer account or production data.
7. **Observability:** stage-specific structured/sanitized logs, uptime/health checks, error-rate/latency alerts, DB saturation/disk alerts, audit-event retention, and an approved alert destination. Test delivery and acknowledgement; keep secrets and customer payloads out of logs.
8. **CI/CD:** a separately protected `staging` environment and workflow that runs tests first, deploys only an explicitly selected immutable feature SHA, has staging-only permissions/secrets, validates target identity before migration, and runs authenticated synthetic smoke tests. Keep production secrets and the main-only production job unavailable to this workflow.
9. **Rollback:** retain the prior immutable app artifact and use a tested traffic/pointer switch-back. Prefer backward-compatible expand/contract migrations; a schema/data rollback requires a separate rehearsed forward-repair or isolated restore plan. Define objective stop/rollback triggers and named decision authority before first deploy.

Unknown and requiring an authorized owner/provider decision: hosting provider/account, region, staging hostname, ingress/network controls, secret manager, storage service, external monitoring destination, costs, operators, alert contacts, retention, RPO/RTO, and accepted rollback thresholds. No capability is assumed.

## 4. Prioritized blockers and evidence owners

| Priority | Owner role | Blocker / action | Evidence required before release |
|---|---|---|---|
| P0 | Business/release owner | Name and authorize the staging target, scope, SHA, operators, and test data policy. | Written approval/change record; account/target ownership evidence; explicit staging-only permissions. |
| P0 | Hosting/network operator | Provision isolated host, hostname, routing, firewall, TLS and admin ingress controls. | DNS/control-plane evidence; external HTTPS/SNI/certificate checks; listener/firewall inspection; `/healthz` and storefront smoke. |
| P0 | DBA/security operator | Provision separate PG16 DB, owner/migrator and runtime roles, credentials and private routing. | Sanitized DB identity/version, grants, role separation, network proof, migration checksums and app-role privilege test. |
| P0 | Security/secret owner | Generate/store staging-only keys and credentials; resolve scope of previously exposed local synthetic values without touching production absent authorization. | Secret metadata/provenance, ACL/access log, rotation/revocation procedure and successful key/session lifecycle tests; never disclose values. |
| P0 | Release manager/DBA | Create paired staging DB/upload backups and independently restore into newly named isolated targets. | Hashes, decrypt/list checks, versioned restore log, schema/data/upload invariants, elapsed time, second-operator review, approved RPO/RTO. |
| P0 | Release manager/application owner | Rehearse migration failure recovery and app rollback on staging. | Exact SHA/migration state, reproducible failure injection, rollback/forward-repair record, objective triggers and decision sign-off. |
| P1 | SRE/operator | Configure and test monitoring/alert delivery. | Named destination, test alert receipt/acknowledgement, sanitized dashboards/log samples, retention and escalation. |
| P1 | QA/security tester | Run authenticated functional/security suite using synthetic accounts and two shops. | Direct HTTP/browser traces for MFA, permissions, tenant denial, session revocation, orders/inventory and audit correlation. |
| P1 | CI/repository administrator | Verify branch protections, environment approvals, secret scoping, runner controls and artifact provenance; add staging workflow only after target authorization. | GitHub settings/run evidence for exact SHA; proof no production secrets/target in staging job. |
| P2 | Frontend/privacy owner | Decide external asset hosting and privacy/csp hardening. | CDN outage test, privacy disclosure review, dependency/version/SRI or self-host plan, CSP regression evidence. |

## 5. Outstanding test plan

All write-path tests below are for a verified disposable staging database with synthetic accounts/data, explicit cleanup ownership, and baseline/post-run inventory. They are not permitted against the read-only preview.

| Area | Existing evidence | Staging test plan / current status |
|---|---|---|
| Login, MFA, logout, expiry, server-side revocation | Mock/API tests cover login, enrollment, TOTP replay, logout and session/role revocation. | BLOCKED live: valid synthetic shop/platform accounts; correct/wrong/replayed TOTP; expiry; logout; revoked JWT rejection; cookie origin/CSRF; no session after logout. |
| Authorization and tenant isolation | Mock tests cover selected roles and shop memberships; local unauthenticated reads returned 401. | BLOCKED live: at least two shops and owner/manager/staff/platform roles; object/function/property access matrix; cross-shop IDs; verify denial and audit correlation. |
| Checkout and order lifecycle | Automated tests cover server pricing, validation, idempotency, transitions, and selected rollback paths. | BLOCKED live: synthetic order only; no real payment/fulfillment; validation, retry, state transitions, privacy-safe lookup, audit trail and cleanup. |
| Inventory and concurrency | Unit/API logic tests cover reservation rollback and conflict behavior. | BLOCKED live: bounded concurrent requests and idempotent retries; verify no oversell, negative stock, duplicate orders, or partial state; preserve query and inventory invariants. |
| Upload validation/storage | Automated image-processing/upload tests cover selected formats, spoofing, and size limits. | PARTIAL test-only: staging synthetic benign/invalid/oversized images, path/name traversal, MIME/signature mismatch, decompression limits, authorization, storage containment, restart persistence and cleanup. No hostile payload against the local preview. |
| Payment/notifications | Manual/offline payment workflow; optional web-push source paths. No live provider test. | BLOCKED / NOT TESTED: confirm no real money; use provider sandbox only after separate authorization. Test absent integration config, invalid subscription, bounded rate and safe outbound host controls. No real push recipients. |
| Rate limiting/abuse | Source and unit tests cover public catalog and selected login/order/push throttles. | PARTIAL mocks; live staging test bounded by approved limits: per-IP behavior behind proxy, reset window, retry headers, distributed-instance implications, and no lockout/DoS of real users. |
| Security headers/error handling | Automated tests cover CSP/HSTS/readiness errors; traversal path regression now checks generic 404 and no disclosure. | PARTIAL. Verify staging proxy/header composition, CSP on each page, hostile/malformed request behavior, no stack/secrets in body/logs, and alert correlation. |
| Dependencies/supply chain | CI runs `npm audit --audit-level=low`; current offline cached audit reports zero. | PARTIAL: run fresh locked install and online advisory review within authorized CI/network; review transitive updates, action pinning, SBOM/provenance and remediation SLA. |
| Browser/mobile/accessibility | Local Playwright route test verifies one named link; prior visual checks covered 390x844, 768x1024, 1365x900. | PARTIAL: full keyboard and axe scan per key page, touch flows, reduced motion/zoom, Chrome/Firefox/WebKit and real device/emulator API connectivity are NOT TESTED here. |
| Backup/restore/DR | Local preview recovery backup was verified for the restored preview. | BLOCKED staging: paired DB/uploads backup, independent restore to separate target, consistency manifest, recovery timing, second review, RPO/RTO acceptance, failure/retry rehearsal. |

## 6. Release-operation checklist

### Before first staging deploy

- [ ] Written staging scope/approval, target owner, selected immutable SHA and authorized operator.
- [ ] Verify host/account, DNS owner, private DB route, firewall, app/storage/DB identities and no shared production volume or credential.
- [ ] Generate unique staging keys in the approved secret manager; verify access/rotation/revocation without printing values.
- [ ] Clean `npm ci --omit=dev` on target OS/runtime; verify native `sharp` processing and Node/PostgreSQL compatibility.
- [ ] Review migrations/checksums, destructive operations, lock behavior and forward-repair/rollback plan.
- [ ] Capture paired backup and perform a separately named restore drill before relying on recovery.
- [ ] Verify proxy routes and HTTPS certificate from an authorized external path; verify only intended ports are public.
- [ ] Verify admin access restriction, MFA, synthetic test users/data, session and audit logging.
- [ ] Verify logs, dashboards, health/error alerts and test-alert receipt.
- [ ] Confirm rollback artifact, DB recovery option, decision-maker and triggers.

### TLS, health, monitoring, and rollback acceptance

- [ ] Resolve the owner-verified hostname and compare the destination with the authorized staging target; do not test by guessing hostnames.
- [ ] Check certificate chain, SAN, validity dates, SNI, redirect behavior, HSTS policy, and absence of mixed content.
- [ ] Confirm proxy sets and app trusts only the intended forwarded headers/hops; verify direct app and database ports are not public.
- [ ] Confirm `/healthz`, storefront, static assets, and one synthetic authenticated smoke check through the HTTPS host; collect request IDs and sanitized logs.
- [ ] Trigger an approved synthetic availability/error alert and retain receipt/acknowledgement.
- [ ] State objective rollback triggers before release (for example: readiness failure, error/latency threshold breach, migration invariant failure, unauthorized data access, or failed security smoke). Exact thresholds are owner decisions and currently UNKNOWN.
- [ ] Execute app switch-back and database forward-repair/restore rehearsal separately; compare migration/schema/data invariants and record elapsed recovery time.

### Backup and restoration

- [ ] Verify source DB and upload volume identities before backup; record UTC, tool versions and sanitized job ID.
- [ ] Create paired DB and uploads backups, encrypt, hash, and store off-host under retention policy with decryption identity held separately.
- [ ] Verify decryption/listing and archive path safety without writing into the source.
- [ ] Restore only to a newly named disposable database and new empty directory after proving isolation.
- [ ] Validate PostgreSQL version, migrations/checksums, row/count constraints, synthetic app reads, and uploaded asset integrity.
- [ ] Measure actual RPO/RTO; obtain second-person review; retain sanitized logs and a resource-specific cleanup record.

## 7. CDN, fonts, privacy, and CSP

`index.html` imports Font Awesome 6.4.0 from cdnjs and Plus Jakarta Sans/Reenie Beanie from Google Fonts. The CSP in `server/app.js` permits those style/font origins, inline styles, and analytics-related Google/Meta script/connect origins. `js/config/tracking.config.js` defaults both tracking providers off with blank IDs; browser code loads trackers only after analytics consent and valid configuration. No live tracker was enabled by this audit.

Browser evidence from the local preview observed asset requests to `cdnjs.cloudflare.com` and `fonts.googleapis.com`; local CSS/JS/SVG assets loaded. It did not establish CDN availability under failure. If those providers are unavailable, browser CSS can still load locally and declared system fallback fonts should be used, but icon glyphs/remote fonts may be missing. Verify outage behavior explicitly without contacting third parties by aborting those hosts in a browser test. Any third-party asset request discloses client network metadata (at minimum the network request/IP and user agent); keep the privacy notice accurate.

Recommendations:

1. Prefer self-hosting pinned icon/font assets when license and update process permit; otherwise pin exact versions and add SRI where supported.
2. Remove unused third-party CSP origins and tighten CSP incrementally; assess replacing `'unsafe-inline'` styles with hashes/nonces where the app architecture supports it.
3. Preserve consent-before-tracking; test rejected/absent consent and blank tracking IDs produce no analytics calls. Document that static CDN/font requests are separate from analytics consent.
4. A local browser simulation intercepted/aborted requests to the three CDN/font hosts, but navigation did not reach `DOMContentLoaded` before timeout. After removing the interception, the homepage rendered normally. Therefore the outage rendering/fallback behavior is **BLOCKED / NOT VERIFIED**, not PASS. Add a bounded offline browser regression asserting layout, accessible control names, and usable navigation when CDN/font requests fail; do not make third-party loading a critical rendering dependency.

## 8. Release decision

**Staging: BLOCKED / NOT READY. Production: NO-GO.** The local preview and automated tests provide useful regression evidence but do not demonstrate an authorized staging target, authenticated staging functionality, HTTPS/TLS, backup restoration, monitoring, rollback, or operator readiness. Do not deploy, migrate, create DNS, or access production until the P0 evidence is independently reviewed.
