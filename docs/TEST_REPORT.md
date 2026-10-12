# Shopademia test and verification report

**Updated:** 2026-10-12
**Environment:** Local Windows development workspace; local app at `http://localhost:3000`; isolated development PostgreSQL cluster as recorded in [PROGRESS.md](./PROGRESS.md). No production service or database was accessed.

## Executed checks

| Check | Result | Evidence and limits |
|---|---|---|
| `npm.cmd test` | **PASS — 100/100** | Full Node test suite completed with 100 passed, 0 failed, 0 skipped. Test doubles/local test setup do not establish production integration. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test adminSidebar.spec.js --project=chromium --workers=1` | **PASS — 3/3** | Shop and platform sidebar component tests plus a responsive platform-workspace layout check at 390×844. Covers drawer behavior, search, unavailable entries, permission-filtered destinations, focus restoration, four dashboard section headings, and one-column/no-horizontal-overflow layout. Sidebar identity and permissions are mocked; this does not authenticate to the real admin API. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test adminLogin.spec.js --project=chromium --workers=1` | **PASS — 1/1** | Exercises the development email/password-only admin UI with intercepted API calls. It does not validate the real local account credentials or session persistence. |
| `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; .\node_modules\.bin\playwright.cmd test --project=chromium --workers=1` | **PASS — 9 passed, 1 skipped, 0 failed** | Serial Chromium suite after the login change. Product-detail E2E was skipped because the local database contains no shop catalog item; run predates the new platform section-layout test. |
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
- Platform Admin panels are now grouped under Shop and team, Storefront and content, Transactions/offers/reports, and Settings/access/audit. The focused mobile browser check confirms these four headings render without horizontal overflow at 390 px; it does not test real API actions within those panels.

## Not tested

- Production MFA enrollment/sign-in, session expiry behavior, and full server permission authorization across all admin modules.
- Firefox/WebKit sidebar coverage, Linux/CI run, accessibility audit of admin drawer with axe/screen reader, and tablet/desktop manual visual review.
- Production/staging database integration, schema/data inventory, upgrade or rollback, isolated backup restore, RPO/RTO, and recovery drill.
- Concurrent stock reservation, duplicate/racing order requests against PostgreSQL, payment verification/refund, courier/webhook behavior, shipment/return/exchange, or real financial actions.
- Performance/load targets, security assessment of the complete current diff, target-host Node/PostgreSQL/`sharp` compatibility, production DNS/TLS, monitoring, and deployment rollback.

## Regression and release assessment

The latest full Node suite passed, and the focused admin login/sidebar/layout browser checks passed (4/4 combined). This is a limited regression result; it is not evidence that untested flows work.

**Production decision: NO-GO.** See [AUDIT_REPORT.md](../AUDIT_REPORT.md), [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for blockers and per-area status. Do not infer payment, shipment, data migration, or production readiness from these test results.
