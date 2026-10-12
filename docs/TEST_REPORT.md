# Shopademia test and verification report

**Updated:** 2026-10-12
**Environment:** Local Windows development workspace; local app at `http://localhost:3000`; isolated development PostgreSQL cluster as recorded in [PROGRESS.md](./PROGRESS.md). No production service or database was accessed.

## Production-readiness prompt execution (2026-10-12)

**Base release source:** `828aca0597b4c25e14956c4c52b6e6ab37c9fb77` on `feature/admin-v2`.
**Verified follow-up:** `dccff169b207cc4d5b8c18e3e81dd769446df4fc` on `feature/admin-v2`, pushed to the GitHub feature branch. CI run [38270740198](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270740198) passed for this exact commit. No production deploy was triggered.
**Current verified branch head before this infrastructure evidence update:** `808871045abf6ab0369b1d1ccdbce51468b3a755`; CI run [38270844665](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270844665) passed for that exact commit. See the infrastructure recheck below for evidence gathered after that run.
**Infrastructure evidence documentation:** commit `1e80d56620304c9023dd4c613f6c632f709d1eba`; exact-commit CI [38271421414](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38271421414) passed. The current infrastructure follow-up below records a later public connectivity sample; no application tests were repeated because the source/runtime is unchanged.
**Staging proposal, support template, and PostgreSQL-authority clarification:** commit `21a11f616b23c465861a009ea12dba818dfac710`; exact-commit CI [38272992537](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38272992537) passed the test and dependency-audit jobs. The production deploy job was skipped. No staging or production service was accessed.
**Latest verified runbook/recovery-procedure commit before this update:** `e78767f19aeb8e1378ed5aef89ba0841c977587d`; exact-commit CI [38273713574](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38273713574) passed tests and dependency audit, with deploy skipped.

| Gate/check | Result | Evidence and limits |
|---|---|---|
| Feature-branch commit and push | **PASS** | Commit `dccff169b207cc4d5b8c18e3e81dd769446df4fc` pushed non-force to `2/feature/admin-v2`; no `main` or production remote push. |
| GitHub CI for verified follow-up | **PASS** | [Workflow run 38270740198](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270740198) succeeded for `dccff169b207cc4d5b8c18e3e81dd769446df4fc`. The Node test and npm dependency audit jobs passed; deploy was skipped on the feature branch. |
| GitHub CI for base release source | **PASS, historical** | [Workflow run 38265641287](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38265641287) succeeded for `828aca0597b4c25e14956c4c52b6e6ab37c9fb77`. This is retained as base-commit history, not used as evidence for the follow-up. |
| Local `npm.cmd test` after logout follow-up | **PASS — 100/100** | Fresh full suite: 100 passed, 0 failed, 0 skipped. |
| Local `npm.cmd audit --audit-level=low` after logout follow-up | **PASS — 0 vulnerabilities** | Dependency advisory audit completed successfully. |
| `npm.cmd run build:css` | **PASS** | Tailwind production CSS build completed after the local logout follow-up; generated output introduced no additional tracked changes. |
| Chromium E2E after logout follow-up | **PASS — 13 passed, 1 skipped** | Serial run against the disposable PostgreSQL 17 cluster. Product-detail skipped because the isolated catalog is empty. |
| Firefox and WebKit full E2E | **PASS on pre-follow-up source — 12 passed, 1 skipped each** | Ran serially per project before the logout change. The current logout regression separately passes in both browsers below; do not interpret these full-suite counts as reruns on the final source. |
| Automated accessibility checks | **PASS, limited** | Each browser suite reported no axe violations on `/?shop=main`, `/privacy`, and `/terms`. Admin pages and manual assistive-technology conformance are not covered by this result. |
| Local readiness | **PASS, limited** | App started against the new disposable database and `GET /healthz` returned `{"status":"ok"}`. No restored or production data was used. |
| All-project single Playwright invocation | **PARTIAL — 34 passed, 3 failed, 2 skipped** | Three Chromium storefront tests received HTTP 429 during the combined 39-test run due to the shared app rate limiter. The same browser suites passed when executed one browser at a time. This run is not reported as a full cross-browser pass. |
| Staging deployment | **BLOCKED / NOT RUN** | No staging host/configuration or staging workflow is present in the repository; no staging environment file or authorized target is available. Docker, `age`, and `rsync` are absent in this environment. No deployment was attempted. |
| Backup/restore verification | **BLOCKED / NOT VERIFIED** | No backup artifacts or restore evidence were found in the repository or accessible session artifact directory. Docker and `age` are unavailable, and no production backup/decryption identity was provided. No backup or restore script was run. |
| Existing public site reachability | **BLOCKED / INCONCLUSIVE** | See “Infrastructure blocker recheck” below. HTTPS timed out after DNS resolution; HTTP returned a redirect to HTTPS. No origin or hosting logs were accessible, so the failing TLS path cannot be attributed to the origin, perimeter, or network route. |
| Monitoring, alert delivery, application rollback, database recovery | **BLOCKED / NOT VERIFIED** | Repository inspection found an application health endpoint and Compose healthcheck, but no configured external monitor, alert receiver, on-call owner, or alert-delivery evidence. The cPanel workflow replaces files in place with `rsync --delete`; no application release snapshot/rollback mechanism is defined. The restore procedure exists but no artifact-backed isolated restore drill has been performed. |
| Production release/deployment | **BLOCKED / NOT RUN** | Required operational, recovery, host, monitoring, and approval evidence remains incomplete. No `main` push, production deployment, migration, or production data access was performed. |

The prior setup-blocked browser attempt below is superseded for local browser coverage by the dedicated isolated-database runs above. The earlier wrong-host canonical assertion and combined-suite rate-limit failures are test-invocation/environment issues; they were not addressed by weakening assertions or changing production rate limits.

### Infrastructure blocker recheck (2026-10-12)

The checked-out branch was `feature/admin-v2`, clean at `808871045abf6ab0369b1d1ccdbce51468b3a755` before this documentation update. Both requested commits are ancestors of that HEAD. GitHub Actions runs [38270740198](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270740198) and [38270844665](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270844665) each completed successfully for their respective exact commits. Their test and dependency-audit jobs passed; deployment was skipped on the feature branch.

| Blocker | Current evidence/result | Conclusion |
|---|---|---|
| Public DNS and HTTP/TLS | At 2026-10-12 21:33 +06, `Resolve-DnsName shopademia.store -Type A` returned `122.173.84.249`; AAAA returned no address. `curl.exe --silent --show-error --location --max-time 12 --connect-timeout 5 --output NUL ... https://shopademia.store/healthz` and the same request to `/` each timed out during connection (HTTP 000, no remote IP). A bounded HTTP request to each path connected to `122.173.84.249` and received HTTP 301 to HTTPS; following that redirect timed out. TCP 80 connected, TCP 443 timed out, while a TCP 443 connectivity control to `github.com` connected. | **Cause not established.** This narrows the symptom to HTTPS reachability from this network, not proof of an application/origin outage. Origin, proxy/firewall, and route cannot be distinguished without authorized hosting/CDN logs or a second independent network vantage. No production access or changes were made. |
| Hosting and deployment path | `.github/workflows/ci.yml` has one deployment job: push to `main`, successful test job, and `CPANEL_DEPLOY_ENABLED == 'true'`; it targets the cPanel production host/app root and runs an in-place `rsync --delete`, then restarts Node and checks production `/healthz`. It does not provision a staging target, take backups, run migrations, or retain a previous application release for rollback. Only this workflow exists under `.github/workflows/`. The `origin` Git remote is the production cPanel SSH destination; it was not contacted. | **Staging BLOCKED / NOT RUN.** No staging host, isolated PostgreSQL service, stage deployment identity, secrets, or authorized target was supplied. The production workflow/remote was not used. |
| Local prerequisites and backup artifacts | In this environment `docker`, `age`, and `rsync` were not found; SSH exists but was not used against production. `.env` exists, but its contents were not read; `.env.production` and `.env.staging` are absent. No `.dump`, `.age`, `.backup`, `.tar`, or `.gz` backup artifact was found in the repository or named session artifact directory. PostgreSQL client tools available locally are version 16; the intended hosted PostgreSQL version is unverified. | **Restore drill BLOCKED / NOT RUN.** No source backup pair, age identity, staging database/directory, timestamps, checksums, logs, or consistency-check results were available. Scripts were not run; no restore is claimed. |
| Monitoring and alerting | Compose defines an internal container healthcheck and `/healthz`; README/runbook recommend an external uptime monitor, but repository inspection found no configured external provider, alert destination, delivery test, named on-call contact, or service-level target. | **NOT VERIFIED.** Repository recommendations do not prove external monitoring or alert delivery. Hosting/provider evidence and an owner/contact are required. |
| Application and database recovery | cPanel deploy syncs into the live application directory with deletion of untracked destination files; no release snapshot/symlink/rollback command is configured. The restore script is designed to restore PostgreSQL to a new `shopademia_restore_*` database and uploads to a new directory, but there are no artifacts or restore results. Runbook records migration rollback/forward-repair as unproven. | **NOT VERIFIED.** Safe application rollback requires a reviewed prior-release restore/switch procedure; database recovery requires a reviewed migration-compatible recovery plan and a successful isolated restore from a real paired backup. |

No production or staging logs were accessible from this workspace. The result summaries above are from the bounded command outputs at the stated time; no synthetic server logs, checksums, backup timestamps, restore metrics, or staging URLs were created.

#### Follow-up public connectivity sample (2026-10-12 21:43:27 +06)

Read-only PowerShell DNS lookup again returned A `122.173.84.249` and nameservers `ns1.chephost.top` / `ns2.chephost.top`; no AAAA answer was returned. `curl.exe --noproxy '*' --head http://shopademia.store/healthz` returned HTTP 301 to `https://shopademia.store/healthz` in 0.147 seconds. Direct TCP checks: port 80 connected, port 443 timed out after 4 seconds. A separate `web_fetch` request to HTTPS failed at transport level. Since no TCP 443 connection completed, no TLS handshake or certificate inspection was possible. These observations do not establish endpoint ownership or distinguish provider listener, firewall, routing, proxy/CDN, or hosting configuration. An unsent support-request template is recorded in [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md); no hosting ticket was submitted.

#### Provider-response status and safe preparation

No hosting-provider response was included in the current user message or available shared workspace. There are therefore no provider-confirmed findings; only client-side observations above are established. The runbook now records conditional production remediation prerequisites (written diagnosis, exact delta, separate owner approval, change window, recovery/rollback, and post-change checks), an unprovisioned staging compatibility/acceptance plan, and a detailed isolated PostgreSQL backup/restore drill checklist. These are plans, not executed infrastructure work or proof of readiness.

Repository compatibility evidence: `package.json` declares Node `>=20`; CI uses Node 22; `Dockerfile` pins Node `22.22.0-alpine3.22`; `database/Dockerfile` uses `postgres:16-alpine`. The cPanel workflow activates a Node 20 path, but actual host binary/version and hosted PostgreSQL version remain unverified. No staging host, backup pair, decryption identity, restore result, monitoring provider, alert-delivery evidence, or rollback rehearsal was available.

### Follow-up repair: platform-admin logout

The real-backend login smoke test exposed that the platform shop-management page had no sign-out control, despite the shop dashboard having one. Added a platform-page **Sign out** button, wired it to session revocation, and added a regression that verifies `POST /api/v1/admin/logout` returns to the login page. This is not a deployment authorization.

| Follow-up check | Result | Evidence and limits |
|---|---|---|
| Source security review of the logout follow-up | **PASS, source-review scope only** | Read-only specialist review checked the logout flow and related session/revocation path; it reported no findings. This does not establish overall application security or production configuration safety. |
| Local `npm.cmd test` after logout repair | **PASS — 100/100** | Fresh full suite: 100 passed, 0 failed, 0 skipped. |
| Local `npm.cmd audit --audit-level=low` after logout repair | **PASS — 0 vulnerabilities** | Repeated after the code change. |
| Full Chromium suite after logout repair | **PASS — 13 passed, 1 skipped** | Serial run against disposable PostgreSQL. |
| Logout regression after repair | **PASS — Chromium 1/1, Firefox 1/1, WebKit 1/1** | Tested serially in each browser against the browser/API harness. Confirms POST logout, profile API rejection (401), and redirect from a protected workspace to login. A concurrent Firefox attempt failed during Playwright artifact teardown with `ENOENT`; serial rerun passed. |
| Real-backend platform-admin login/profile/logout | **PASS, local only** | Actual configured local account on the disposable database: login redirected to platform workspace, profile returned HTTP 200, logout returned HTTP 204, the revoked session then received HTTP 401, and protected workspace navigation redirected to login. Credentials are not recorded. |
| Syntax and diff checks | **PASS** | `node --check` on the modified module and E2E test, and `git diff --check`, passed. |
| GitHub CI for logout follow-up | **PASS** | Run [38270740198](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270740198) passed on exact commit `dccff169b207cc4d5b8c18e3e81dd769446df4fc`; deploy job was skipped. |

## Interaction audit verification (2026-10-12)

| Check | Result | Evidence and limits |
|---|---|---|
| `npm.cmd test` | **PASS — 100/100** | Rerun after the staff-role fix and audit report; 100 passed, 0 failed, 0 skipped. |
| Focused `adminSidebar.spec.js` Chromium run | **PASS — 5/5** | Includes the new shop-staff regression: a staff-role workspace load makes no `/api/v1/admin/shop/members` request and hides the team-management panel. API responses are mocked. |
| Complete Chromium E2E rerun | **BLOCKED — 13 setup failures** | The runner could not connect to `http://localhost:3000` (`ERR_CONNECTION_REFUSED`). Starting the app failed with PostgreSQL authentication error `28P01` against the isolated local database on port 5433. No E2E assertion ran to a meaningful pass/fail result. This is not counted as a test regression or pass. |
| `node --check admin-assets/platform.js` and `node --check tests/e2e/adminSidebar.spec.js` | **PASS** | Modified JavaScript files parse. |
| `git diff --check` | **PASS** | No whitespace errors in the current diff. |
| Interaction inventory/report | **COMPLETE** | [INTERACTION_AUDIT.md](./INTERACTION_AUDIT.md) inventories 57 static buttons, 16 static forms, generated controls, all 16 sidebar groups, external UX/accessibility guidance, scope limits, and ranked findings. |

At the time this earlier section was written, the complete-suite run was **NOT VERIFIED** because the local API server was unavailable. This status was superseded by the isolated-database Chromium, Firefox, and WebKit runs in “Production-readiness prompt execution” above; that newer evidence includes the staff authorization regression but predates the platform logout follow-up.

## Executed checks

| Check | Result | Evidence and limits |
|---|---|---|
| `npm.cmd test` | **PASS — 100/100** | Full Node test suite completed with 100 passed, 0 failed, 0 skipped. Test doubles/local test setup do not establish production integration. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test adminSidebar.spec.js --project=chromium --workers=1` | **PASS — 4/4** | Covers sidebar drawer/search/keyboard behavior, permission-filtered destinations, shop-admin access boundaries, accurate links for built features, and platform single-feature navigation at 390×844 with mocked identities and permissions. Confirms only the selected feature panel is visible and the one-column layout has no horizontal overflow. Does not authenticate to the real admin API. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test adminLogin.spec.js --project=chromium --workers=1` | **PASS — 1/1** | Exercises the development email/password-only admin UI with intercepted API calls. It does not validate the real local account credentials or session persistence. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test --project=chromium --workers=1` | **PASS — 9 passed, 1 skipped, 0 failed** | Serial Chromium suite after the login change. Product-detail E2E was skipped because the local database contains no shop catalog item; run predates the new feature-navigation tests. |
| Manual local Chromium admin sign-in using the account holder's supplied credentials | **PASS** | Submitted the actual `/admin` form to the local backend; login and authenticated profile returned HTTP 200, redirected to `/admin/platform` with the “Shop management” heading, and logout returned HTTP 204. Development-only MFA bypass was active. The session was revoked; credentials are not recorded here. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test --workers=1` | **PARTIAL — Chromium 9 passed, 1 skipped; Firefox/WebKit unavailable** | Chromium completed; Firefox's installed binary exited immediately with Windows process exit code `3236495362`, so its tests and WebKit did not run. This is a local browser-launch limitation, not a passing cross-browser result. |
| Playwright axe WCAG 2.1 AA checks | **PASS — 3 pages** | `/`, `/privacy`, and `/terms` report no violations after darkening empty/loading category and product messages. This does not establish full-site or manual assistive-technology conformance. |
| `npm.cmd run build:css` | **PASS** | Tailwind production stylesheet rebuilt after the contrast adjustment. |
| `node --check tests/e2e/adminSidebar.spec.js` | **PASS** | Browser test source parses. |
| `git diff --check` | **PASS** | No whitespace errors at the time of the check. |
| Local HTTP checks | **PASS, limited** | `/healthz` and admin page routes returned HTTP 200. An unauthenticated `/api/v1/admin/profile` request correctly returned HTTP 401. |
| Local migration startup | **PASS, limited** | The new B1 migration applied on local startup and startup was repeated. This is not a backup/restore or production migration rehearsal. |

## Failed or inconclusive attempts

- The shared browser tool repeatedly timed out on `/api/v1/admin/*`. This was not reproduced in a clean local Chromium browser, where the actual form login and authenticated profile redirect succeeded.
- The first targeted Playwright test invocation included the `tests/e2e/` directory even though the repository config already sets that test directory, and reported no tests found. The corrected command using the test filename passed.
- Initial browser-test iterations exposed test setup/locator mistakes; these were corrected. The final two tests passed.
- First full Chromium run found a serious contrast violation (4.24:1) on empty/loading catalog text and exposed that product-detail coverage depended on pre-existing local products. Contrast classes were corrected and CSS rebuilt; the product check now skips with an explicit reason only when no item is available. The subsequent full Chromium suite and three-page axe checks passed.
- An immediate repeat full Chromium run hit the existing 120/minute catalog API limit (HTTP 429), causing three dependent test failures. After allowing the rate window to reset, the full suite was rerun serially with `--workers=1`: **8 passed, 1 skipped, 0 failed**. No production rate limit was changed.
- A later all-project Playwright run completed Chromium (8 passed, 1 skipped) but the Firefox binary exited immediately with Windows exit code `3236495362`; the remaining Firefox tests and WebKit project consequently could not launch. Cross-browser status remains **NOT TESTED** for Firefox/WebKit.
- Development platform-admin login now uses email and password only. The server still enforces MFA in production regardless of configuration; stored MFA enrollment has not been changed. A server/API boundary test and updated browser test cover this behavior.
- Verified local `/healthz` and `/admin` return HTTP 200; the rendered local login page carries the development-only MFA-off setting. The actual supplied local account credentials also passed the Chromium form flow; profile returned 200, redirect reached the Platform Admin page, and logout revoked the session.
- The shared browser tool repeatedly timed out on `/api/v1/admin/*`, while a clean local Chromium browser completed the real form login, authenticated profile redirect, and logout. The remaining timeout appears isolated to the shared browser session/tool context.
- Platform Admin now opens one feature panel at a time, selected by the sidebar or a deep-link fragment. Sidebar destinations for Store Banner, Manage Offers, and Delivery Advance now target the existing features; Coupons and Offer Banner remain disabled rather than linking to unrelated offer behavior. The focused mobile browser check confirms feature switching, role-specific API navigation, a single visible panel, and no horizontal overflow at 390 px; it does not test real API actions within those panels.

## Not tested

- Production MFA enrollment/sign-in, session expiry behavior, and full server permission authorization across all admin modules.
- Firefox/WebKit sidebar coverage, Linux/CI run, accessibility audit of admin drawer with axe/screen reader, and tablet/desktop manual visual review.
- Production/staging database integration, schema/data inventory, upgrade or rollback, isolated backup restore, RPO/RTO, and recovery drill.
- Concurrent stock reservation, duplicate/racing order requests against PostgreSQL, payment verification/refund, courier/webhook behavior, shipment/return/exchange, or real financial actions.
- Performance/load targets, security assessment of the complete current diff, target-host Node/PostgreSQL/`sharp` compatibility, production DNS/TLS, monitoring, and deployment rollback.

## Regression and release assessment

The latest full Node suite passed (100/100), and the focused admin login/sidebar feature-navigation browser checks passed (5/5 combined). This is a limited regression result; it is not evidence that untested flows work.

**Production decision: NO-GO.** See [AUDIT_REPORT.md](../AUDIT_REPORT.md), [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for blockers and per-area status. Do not infer payment, shipment, data migration, or production readiness from these test results.
