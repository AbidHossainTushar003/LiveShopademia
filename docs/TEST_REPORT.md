# Shopademia test and verification report

## Current release-gate verification — 2026-10-14 19:26 +06

| Command/check | Exit | Result, target, and limitations |
|---|---:|---|
| `npm.cmd run test:api` | 0 | 85 passed, 0 failed, 0 skipped. Test harness/fake dependencies; not live staging evidence. |
| `npm.cmd test` | 0 | 133 passed, 0 failed, 0 skipped. Includes API/server tests above; do not add totals. |
| `node --test scripts\staging-config.test.js` | 0 | 15 passed, 0 failed; includes missing/placeholder rejection and `.env.example` URL regression. |
| `node --test scripts\playwright-target.test.js` | 0 | 7 passed, 0 failed; target guard only. |
| `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` | 1 | 9 public-only Chromium cases attempted against existing preview; all failed before app behavior with `ERR_CONNECTION_REFUSED`/`ECONNREFUSED`. No listener was present on 3002; no server was started/restarted. |
| `npm.cmd audit --audit-level=low` | 0 | 0 vulnerabilities. Fresh online audit: npm offline `false`, registry `https://registry.npmjs.org/`. |
| `npm.cmd run validate:staging` | 1 (expected) | `.env.staging` absent; missing/placeholder configuration rejected. No configuration or secrets fabricated. |
| `node -e "const m=require('./SECURITY_TEST_MATRIX.json'),ids=m.scenarios.map(s=>s.id),c={};for(const s of m.scenarios)c[s.status]=(c[s.status]||0)+1;if(ids.length!==1000||new Set(ids).size!==1000||Object.entries(m.statusCounts).some(([k,v])=>(c[k]||0)!==v))process.exit(1);console.log('matrix valid')"` | 0 | 1,000 unique IDs and declared historical counts verified; current E2E unavailability appended as BLOCKED evidence. |
| `git diff --check` | 0 | No whitespace errors; line-ending warnings may be emitted for edited files. |

This E2E result neither erases nor reinterprets earlier 9/9 runs; it records a new run against an unavailable local target. Historical browser passes remain historical. No privileged browser operations were selected. Dedicated secret scanning was unavailable. Filesystem check/open race remains unresolved. **STAGING: BLOCKED / NOT READY; PRODUCTION: NO-GO.**

## Build and dependency verification — 2026-10-14 11:15 +06

- `npm.cmd run build:css`: exit 0; Tailwind v4.3.3 completed. It regenerated the tracked `css/tailwind.generated.css`, adding one `.isolate` utility; this generated output remains as a worktree change. No application server was started.
- `npm.cmd audit --audit-level=low`: exit 0; `found 0 vulnerabilities`. `npm.cmd config get offline` returned `false`; registry was `https://registry.npmjs.org/`, so this was a fresh online advisory query, not a cached/offline result.
- `npm.cmd run validate:staging`: expected exit 1 because `.env.staging` is absent; validator reported missing/placeholder configuration. No staging file or secret was created.
- Secret scanner availability check found no `secretlint`, `gitleaks`, `trufflehog`, or `detect-secrets` executable and no package script for secret scanning. No new secret scan is claimed.
- The full Node suite, target guard, and public-only E2E suite were subsequently rerun in the fresh regression entry below.

### Fresh regression rerun — 2026-10-14 11:15 +06

| Command | Exit | Result and scope |
|---|---:|---|
| `npm.cmd test` | 0 | 133 passed, 0 failed, 0 skipped; includes API/server tests. |
| `node --test scripts\playwright-target.test.js` | 0 | 7 passed, 0 failed; loopback/production/target policy guard. |
| `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` | 0 | 9 public-only Chromium tests passed against the existing read-only preview. No privileged or write-capable workflow was run. |

The test and API totals overlap. The E2E suite exercised public browsing, product details, layout/responsiveness, keyboard focus, CDN failure resilience, and accessibility; it did not exercise cart/wishlist mutations, checkout, admin, or order writes against the preview.

## Static race and example-URL follow-up — 2026-10-14 11:07 +06

- Removed one bare, unassigned loopback PostgreSQL URL from `.env.example` after redacted inspection showed its password-like component was not a placeholder. The named `DATABASE_URL` example remains placeholder-backed. The removed value was not printed or tested; treat it as potentially usable until the owner determines whether it was valid/reused.
- Added a regression test that rejects an unassigned PostgreSQL URL in `.env.example`; test output does not include line contents.
- Remaining environment-example DB URLs use placeholder passwords; the URL in `scripts/staging-config.test.js` is deliberate synthetic invalid-host test data. The old Secretlint result is not a new scan. No dedicated scanner was available; no fresh secret scan passed.
- Static serving still validates `realpath()` before Express opens the pathname; junction tests do not address races. No race-proof implementation is claimed; use immutable read-only asset roots, separate upload ingestion/publication, and actual runtime ownership/ACL acceptance evidence as detailed in the runbook.

### Commands rerun for this follow-up

| Command | Exit | Result |
|---|---:|---|
| `node --test scripts\staging-config.test.js` | 0 | 15 passed, 0 failed; includes unassigned-URL regression. |
| `npm.cmd run test:api` | 0 | 85 passed, 0 failed, 0 skipped; includes API/read-only enforcement and junction containment tests. |
| `npm.cmd test` | 0 | 133 passed, 0 failed, 0 skipped. Includes the API suite; totals overlap and must not be added. |
| `node --test scripts\playwright-target.test.js` | 0 | 7 passed, 0 failed. |
| `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` | 0 | 9 public Chromium tests passed against the existing preview; no privileged tests or prohibited operations. |
| `npm.cmd run validate:staging` | 1 (expected) | `.env.staging` absent; validation rejected missing/placeholder configuration. |
| `git diff --check` | 0 | No whitespace errors; Git emitted an LF-to-CRLF working-copy warning for `.env.example`. |

The five unauthenticated read-only GitHub REST requests in this pass (branch protection, rulesets, Actions permissions, environments and workflow content) each returned HTTP 403, API rate limit exceeded. No settings payload was obtained; settings remain **UNVERIFIED**.

## Approval-gate validation follow-up — 2026-10-14

- Baseline verification (not a re-run of prior suites): branch `feature/admin-v2`, HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`, upstream `github/feature/admin-v2`; staged diff empty. Dirty and untracked work were preserved.
- `.env.staging` is absent. `npm.cmd run validate:staging` exited 1 with the expected missing/placeholder configuration error; no environment file or secret was created.
- Read-only GitHub settings queries (branch protection, rulesets, Actions permissions, environments, workflow contents) each returned HTTP 403 API rate-limit errors; MCP branch listing returned 404; `gh` is unavailable. No remote settings were observed. Local CI YAML was inspected separately and does not establish repository protection settings.
- The repo has no configured dedicated secret-scanner package/script or available scanner executable in this environment. The previously reported ephemeral Secretlint scan is historical and was **not re-executed** in this pass. Previous fresh online npm audit result is also historical here; no new dependency-audit invocation was made during this approval-only pass.
- No test contacted privileged preview routes, and the preview was not restarted or reconfigured. No database, DNS, provider account, or deployment was accessed.
- Documentation and integrity checks for this pass are recorded in the final report; release remains **STAGING: BLOCKED / NOT READY; PRODUCTION: NO-GO**.

### Independently rerun safe checks — 2026-10-14 10:56 +06

| Command | Exit | Result and scope |
|---|---:|---|
| `npm.cmd test` | 0 | 132 passed, 0 failed, 0 skipped. Includes API tests; counts not additive to prior runs. |
| `node --test scripts\playwright-target.test.js` | 0 | 7 passed, 0 failed. |
| `npm.cmd run test:e2e -- --list` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` | 0 | 9 tests listed in the single public storefront spec. |
| `npm.cmd run test:e2e` with the same loopback base URL | 0 | 9 public Chromium tests passed. Only allowed read-only browsing ran. |
| `npm.cmd run test:e2e:all -- --list` with explicit privileged opt-in against loopback | 1 (expected) | Both admin specs rejected the loopback target at discovery; 0 tests listed, no browser launched. |
| `npm.cmd audit --audit-level=low` | 0 | Fresh online query; 0 vulnerabilities, npm offline false, registry `https://registry.npmjs.org/`. |
| `npm.cmd run validate:staging` | 1 (expected) | `.env.staging` absent; validator rejected missing config. No placeholder created. |
| `git diff --check` | 0 | No whitespace errors. |

No dedicated/repository-supported secret scanner was available (no scanner script/dependency or known executable). The prior ephemeral Secretlint scan was not re-run; its seven potential DB-URL matches remain historical findings for manual triage. No detected values were printed.

## Read-only and privileged-browser safety follow-up (2026-10-14)

This newer evidence supplements earlier staging remediation results and does not imply a hosted deployment.

- `npm.cmd run test:api`: **85 passed, 0 failed, 0 skipped** (exit 0).
- `npm.cmd test`: **132 passed, 0 failed, 0 skipped** (exit 0). The API suite overlaps this total; do not sum the two.
- `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002`: **9 passed, 0 failed** (exit 0); this command now selects only public storefront tests.
- `node --test scripts\\playwright-target.test.js`: **7 passed, 0 failed** (exit 0). `npm.cmd run test:e2e:all -- --list` against loopback returned nonzero before discovery, with both privileged admin specs rejecting the target and **0 tests listed**. This was the expected guard behavior; no browser was launched.
- An in-process `server/app.test.js` directory-junction fixture passed: the in-root asset was served and a junction to a sibling directory returned generic 404. The canonical-path check has a time-of-check/time-of-use window; no concurrent replacement race test ran.
- `npm.cmd audit --offline --audit-level=low`: **0 vulnerabilities** in cached advisory metadata; this does not establish current registry advisory freshness. `git diff --check`: passed.
- The existing loopback preview process was not restarted. The static containment source change is verified in tests but is not asserted active in that running process. No database counts were freshly queried; no database writes, staging/production access, DNS changes, or deployment occurred.
- Branch/HEAD remain `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`; existing staged/unstaged/untracked content was preserved, and no file was staged or discarded.
- Production workflow source has a main-push and repository-variable condition but declares no protected GitHub `environment`. Remote branch protection/environment rules remain **NOT TESTED** and require owner verification.
- Release decision remains **STAGING: BLOCKED / NOT READY; PRODUCTION: NO-GO**.

**Updated:** 2026-10-13
**Environment:** Local Windows development workspace. The security-audit services were cleaned up; a separate synthetic browser preview is currently running on loopback `127.0.0.1:3002` with an isolated PostgreSQL 16 cluster on `127.0.0.1:55441`. No production or hosted staging database was accessed.

## Staging-readiness remediation (2026-10-13)

This section supersedes earlier statements in this report that Docker/Compose was unavailable and that cross-browser suites could only pass by manual per-engine invocation. It records the current remediation checks; it does not establish a staging deployment.

- **Target isolation:** Docker is available locally (Docker Engine 29.8.2; Compose 5.6.0) and the only PostgreSQL container used for earlier API security work was verified as `postgres:16-alpine`, bound to `127.0.0.1:54329`. During this remediation that Docker Desktop engine became unavailable, so no Compose service was started. A new native PostgreSQL 16 cluster was instead initialized under this session's private evidence directory and bound only to `127.0.0.1:55441`; it contains one explicitly synthetic preview product and zero orders.
- **Interactive browser preview:** Shopademia is running only on `http://127.0.0.1:3002` against database `shopademia_browser_preview` on `127.0.0.1:55441`. Opened the storefront and synthetic product detail page; confirmed configured SEO title, price/discount, description, and available stock. Added the synthetic item to the browser cart and observed the cart count change to one. No checkout/order submission occurred. The disposable fixture uses a bundled local image for display; it is not a hosted storefront.
- **Combined browser coverage:** a single Playwright process against one app previously exhausted the fixed 120-requests/minute public-catalog limiter across browser engines (HTTP 429). The limiter remains unchanged. Using a newly initialized isolated DB and a fresh loopback-only app process for each engine, the complete 14-test storefront suite passed in Chromium **14/14**, Firefox **14/14**, and WebKit **14/14**; each app was stopped with graceful `server.close()` and its pool was closed before starting the next. Reports were retained outside the repository in session evidence. This is the documented safe equivalent of the cross-browser combined suite; the one-app all-project invocation remains rate-limited and is not claimed as passing.
- **Additional regression coverage:** added tests prove expired signed admin JWT rejection, fail-closed `/healthz` behavior without exposing database error text, and transaction rollback of a synthetic inventory reservation when order persistence is interrupted. These are mock-pool API regressions; the independent PostgreSQL/API probe below exercised transaction recovery and concurrency against the isolated local database.
- The API suite's synthetic platform-admin MFA test exercises required enrollment, malformed code rejection, valid TOTP enrollment, successful next-code login, and rejection of replaying the same code. This route test uses the isolated in-memory test pool; no live authenticator or hosted MFA account was used. Existing API checks also cover anonymous admin denial, shop-vs-platform role restrictions, password/session revocation, membership removal, and shop scoping; exhaustive permission combinations remain untested.
- **Current checks:** `npm.cmd test` **123 passed, 0 failed, 0 skipped**; `npm.cmd run test:api` **77 passed, 0 failed, 0 skipped**; staging/Playwright config guards **20/20 passed**; `npm.cmd audit` reported **0 vulnerabilities**. Playwright `--list` discovered 42 cases across Chromium, Firefox, and WebKit. With a fresh isolated app process per browser engine, all 14 storefront cases passed in each engine (**42/42 total, no skips/failures**). `node --check` on changed JavaScript, Bash syntax, and `git diff --check` passed.
- `docker compose -f docker-compose.staging.yml config --quiet` passed using synthetic-only environment values. `docker compose -f docker-compose.staging.yml build` completed for app, migrator, and PostgreSQL images; no containers/services were started. The checked-out `.env.staging` was confirmed absent, ignored by Git, and untracked; `npm.cmd run validate:staging` rejected its absence with exit 1 as designed.
- The attempted synthetic PostgreSQL outage was bound to an unused loopback port only. `node server/index.js` exited with code 1, logged sanitized `ECONNREFUSED`, did not print the synthetic connection URL, and opened no app listener. The `/healthz` failure branch is covered by the new automated regression.
- One browser test harness startup attempt failed before running tests because the harness did not pass its temporary dotenv path; no application or database was changed by that attempt. The harness was corrected, and the final per-engine browser runs listed above passed. A first graceful-stop helper also treated Windows' `SIGTERM` exit result as failure; the app itself closed correctly, and the final harness used an explicit stdin-triggered `server.close()`/`pool.end()` path.
- The first local PostgreSQL provisioning attempt omitted the synthetic cluster superuser password and failed to connect; no database writes occurred in that attempt. Provisioning was repeated with the password set explicitly, then database identity and empty counts were verified before schema setup and fixture insertion.
- **Remaining blocked:** Docker Desktop became unavailable after the successful config/build checks. Do not start the staging stack, run migrations under staging Compose, or deploy until an authorized and isolated staging target is provisioned. External hostname ownership, staging credentials/resources, provider TLS/network evidence, backup restore, alert delivery, rollback, database recovery, and named recovery operators remain unverified. The interactive browser test used only a local application and synthetic data, made no order submission, and did not access production or staging; existing static assets may be requested from their configured CDN origins.

## Repository-side staging preparation checks (current worktree)

The repository still has no verified staging host, credentials, database, or Docker engine. Current checkout: `feature/admin-v2`, HEAD `732edd25391599b3d793ed50dc0c59f5a6f909e8`, upstream `2/feature/admin-v2`; nine modified tracked files and eight untracked files, with no staged changes. These checks cover only repository guardrails and the existing unit suite; the historical local PostgreSQL/browser counts below are not results for this staging configuration.

- `npm.cmd test` — **120 passed, 0 failed, 0 skipped (exit 0)**. `node --test scripts/staging-config.test.js scripts/playwright-target.test.js` — **20 passed, 0 failed, 0 skipped (exit 0)**. Earlier regression runs exposed incorrect test-fixture expectations, a short synthetic MFA fixture, and a genuine validator early-return bug that skipped other checks when a required value was missing; the implementation and fixtures were corrected before these final passing runs.
- `node --check` for every changed JavaScript file (`server/index.js`, `playwright.config.js`, `tests/e2e/storefront.spec.js`, and all five new staging/target JavaScript files) — **passed**. `git diff --check` — **passed**. `C:\Program Files\Git\bin\bash.exe -n scripts/staging-compose.sh` — **passed**.
- `npm.cmd run validate:staging` with no `.env.staging` — **rejected as expected**, exit 1: `create .env.staging from .env.staging.example and replace every placeholder.` A complete synthetic-only `.env.staging` passed the CLI; after tightening secret-strength and PostgreSQL identifier checks, the CLI passed again with a fresh synthetic fixture. Both files were removed immediately afterward. An initial synthetic CLI attempt failed because its PowerShell harness wrote only the first environment line, so the validator correctly reported missing PostgreSQL settings. The harness was corrected; no CLI/load defect remained.
- The checked-in `.env.staging.example` was parsed with `dotenv` and rejected for placeholders/disabled authorization. Unit tests also reject production and reserved hostnames/database names, production DB hosts, mismatched app/migration database URLs, shared credentials, URL overrides, and secret-bearing error output. No database or external service was contacted.
- The validator can reject known production hostnames/database names and secrets reused across the staging fields, but cannot compare an arbitrary supplied value or DNS destination to inaccessible production credentials or infrastructure. The owner/operator must independently provision staging-only secrets and verify hostname ownership/addressing; this remains an external gate.
- `npm.cmd run test:e2e -- --list` with loopback base URL — **passed**, listing 14 Chromium cases without connecting to an app. The same command with `https://shopademia.store` — **refused before test discovery**, confirming the production target guard.
- The storefront canonical-URL browser assertion previously hard-coded `http://localhost:3000/`, preventing a real staging-origin run from passing. It now derives the expected origin from the explicitly approved `PLAYWRIGHT_BASE_URL`; JavaScript syntax and staging-target test discovery passed. Browser execution remains **not run** because no verified isolated app target exists.
- Further target-guard review found remote URLs could specify a nonstandard port, query, or path, and artifact paths were not constrained to a configured parent. The guard now requires HTTPS port 443, rejects URL credentials (including empty userinfo), query strings and path prefixes, normalizes trailing hostname dots, and requires exact per-run report/trace paths beneath an external `PLAYWRIGHT_ARTIFACTS_ROOT`; existing symlink ancestors are resolved for containment checks. Added regression cases; the final targeted suite passes **20/20**. This remains configuration validation only: it cannot prove DNS/host ownership or the contents/permissions of an arbitrary artifact root.
- During that hardening, a regression case first failed because the WHATWG `URL` parser canonicalizes an empty userinfo marker (`https://@host`) away. The validator now checks the raw URL authority for `@` before relying on parsed credentials; the targeted suite then passed **20/20**, and the full suite passed **120/120**. This was a test-discovered parsing gap, not an external-service failure.
- A scoped static security review of the current staging and related changes found no exploitable vulnerability. This does not verify runtime deployment, DNS ownership, or arbitrary staging secret provenance and is not a security certification.
- YAML: installed PyYAML `6.0.3` into a unique temporary directory, parsed the complete `docker-compose.staging.yml` with duplicate-key rejection, and asserted the expected services, internal DB network, absence of DB host ports, dedicated volumes, and migration dependency — **passed**. The temporary parser directory was removed; project dependencies were unchanged. Docker/Compose is **unavailable**, so `docker compose config`, image build, and staging stack execution remain **not verified**.
- No staging deployment, migration, browser execution against an app, database operation, backup/restore, alert delivery, or rollback rehearsal occurred. `.env.staging` is absent and ignored by Git; only `.env.staging.example` is allow-listed. Production remains **NO-GO**.

## Latest isolated verification (2026-10-12)

This follow-up supersedes the earlier “not rerun” statements below for the current uncommitted worktree. It does not replace the historical runs or establish staging/production readiness.

- **Target isolation:** Docker was unavailable. Used native PostgreSQL 16.15 in a newly initialized, unique temporary cluster, bound only to `127.0.0.1:55432`; positively checked `current_database()`, `inet_server_port()`, and the exact temporary `data_directory` before creating `shopademia_test`. The app bound only to IPv6 loopback `[::1]:3000`, ran as `NODE_ENV=test` with synthetic credentials, and used an empty temporary `DOTENV_CONFIG_PATH`. The repository `.env` was not read, port 5432 was not queried or contacted, and the production-only `server/migrate.js` was not invoked.
- **Runtime:** Node `v24.21.0`, npm `11.19.0`, PostgreSQL `16.15`, and Playwright `1.64.0`; installed browser revisions were Chromium `1248`, Firefox `1555`, and WebKit `2370`.
- **Node and repository checks:** `npm.cmd test` — **100 passed, 0 failed, 0 skipped**; `npm.cmd audit --audit-level=low` — **0 vulnerabilities**; `npm.cmd run build:css` — passed with no generated stylesheet diff; `node --check` — all 21 server JavaScript files and `playwright.config.js` passed; `git diff --check` — passed before the final documentation update and was rerun afterward.
- **Browser tests:** one-worker Playwright combined run with a seeded synthetic product — **39 passed, 3 failed**. All three failures occurred in Firefox after the shared app’s 120-per-60-second client-IP catalog limiter returned HTTP 429. A preceding empty-catalog combined run had 38 passed, 1 such failure, and 3 product-detail skips. With a fresh app process and rate-limit window per engine, the final full suite passed **14/14 Chromium, 14/14 Firefox, and 14/14 WebKit**; product-detail coverage ran against a synthetic managed product. An intermediate fixture-only attempt failed because its deliberately supplied meta description differed from its product description; the disposable row was corrected and the final per-engine runs passed. No production rate limit was changed or bypassed.
- **Browser smoke:** Chromium opened the synthetic product, added it to the cart, opened checkout, and showed all four blank-field validation errors. The test observed zero order POSTs and blocked all non-local browser requests.
- **PostgreSQL-backed application smoke:** `/healthz` returned 200/`ok`; anonymous admin profile returned 401; synthetic admin login/profile/logout returned 200/200/204 and the revoked session then returned 401. Invalid checkout returned 400; one synthetic order returned 201 with server-calculated subtotal/advance, identical retry returned 200, and a conflicting retry returned 409. Database assertions confirmed one order, a reserved inventory flag, and stock `10 -> 9`. No payment, email, courier, or other external customer communication was invoked.
- **Migration state:** the isolated DB recorded `000_legacy_baseline` (`aacc6bb66605e5d83020842e4c81ac0d663a77a96a0fa26a7152d720cd9ad4f4`) and `001_admin_foundations` (`7a95952de022ba4e8275718b9293591e2f352ada7b82909c7ca22c7e0cfc3666`) checksums. It contained one synthetic product and one synthetic order; the whole temporary cluster, synthetic records, and its logs were removed after recording results.
- **Raw evidence:** HTML reports, per-engine stdout, app logs, and failure traces/screenshots/video for the combined 429 run are retained outside the repository under `C:\Users\Abidh\.copilot\session-state\711a3284-1b09-48eb-9464-46501195ba9b\files\shopademia-readiness-*20261012`. A scan found no configured synthetic credentials or customer-like values in retained text evidence. These files are local session evidence, not committed or uploaded CI artifacts; CI still does not run Playwright or retain artifacts.
- **Release state:** no staging host, staging secrets/database, provider diagnostics, real backup/restore, external alert delivery, or application/database rollback rehearsal was available or attempted. No commit, push, deploy, production access, or external infrastructure change occurred. Production remains **NO-GO**.

## Post-integration security and HOST review (2026-10-12)

- Static security review found no exploitable vulnerability in the reviewed changes. The review covered the requested auth/session/authorization, shop scoping, upload validation, order and inventory handling, migrations/database configuration, cookies/secrets, errors/logging, HOST binding, and Playwright configuration. This was not a full security certification or live-service test.
- Review found the first HOST implementation changed the old no-host `server.listen(port, callback)` behavior to explicit IPv4 wildcard binding. `server/index.js` now passes a host only when `HOST` is explicitly set, preserving Node/OS wildcard selection when unset. Configured HOST values remain IP literals only; unsupported names fail before pool creation. The `.env.example` comment and runbook now distinguish host-process loopback development from container/reverse-proxy binding.
- Local ephemeral-socket check: Node bound and closed both `127.0.0.1` and `::1` successfully. Safe invalid-HOST startup check: `HOST=not-an-ip.example` exited `1` before database-pool creation and emitted `HOST must be an IP address.`; a synthetic, non-listening database URL was supplied, and no database was contacted. `node --check server/index.js` and `git diff --check` passed.
- The startup logger continues to omit arbitrary error messages to avoid disclosing unexpected details; only the safe HOST validation message is surfaced. The application/database and browser suites were **not rerun** for this review because no database target was verified as isolated. These checks do not establish the hosting platform's actual IPv6 or reverse-proxy path.
- The 120-per-60-second public catalog rate limit is applied by client IP and does not distinguish browser tests from ordinary clients; the local browser engines share the app and loopback source address, so their catalog requests accumulate across projects. Single-worker mode limits concurrent test work but does not reset the limiter between projects. The existing unit test checks the 120-request boundary. No production rate-limit exception or brittle browser-only limiter test was added; the latest combined run reproduced Firefox 429 failures, while fresh isolated app processes yielded 14/14 per engine.
- The previous local run's raw test output, traces, PostgreSQL/application logs, and inline smoke script were not retained; the exact-commit CI run has zero artifacts. The historical test counts below remain contemporaneous report entries, not independently reconstructable raw evidence. No new CI run covers the uncommitted changes.

## Disposable local PostgreSQL and browser integration (2026-10-12)

**Repository:** `C:\Users\Abidh\OneDrive\Desktop\storefront`, `feature/admin-v2`, HEAD `732edd25391599b3d793ed50dc0c59f5a6f909e8`, upstream `2/feature/admin-v2`. Existing documentation edits were preserved. No production, staging, port-5432 listener, or `.env` value was accessed.

### Isolated environment and exact setup

- Docker was **NOT AVAILABLE** (`docker` executable absent); no software/system configuration was installed or changed. Native PostgreSQL 16.15, `initdb`, `pg_ctl`, and `psql` were available; Chromium, Firefox, and WebKit Playwright browsers were installed.
- Created a fresh cluster in a unique `%LOCALAPPDATA%\Temp\shopademia-e2e-<GUID>\pgdata` directory, using `initdb -D <temp>\pgdata -U shopademia_test --auth-local=trust --auth-host=trust --encoding=UTF8`. Started it with `pg_ctl -D <temp>\pgdata -l <temp>\postgres.log -o "-h 127.0.0.1 -p 55432 -c listen_addresses=127.0.0.1" -w start`, then used `psql --host=127.0.0.1 --port=55432 --username=shopademia_test --dbname=postgres --command "CREATE DATABASE shopademia_test"`.
- Verified directly on that endpoint that `current_database()` was `shopademia_test`, `inet_server_port()` was `55432`, and `data_directory` was the unique temporary directory. Both the database and application listeners were checked as `127.0.0.1` only. **Port 5432 was never queried or contacted.**
- An initial attempt to use the installed `createdb.exe` was blocked by Windows Application Control. No different database endpoint was tried; the same isolated instance created the dedicated database successfully through `psql` on port 55432.
- The server ran under `NODE_ENV=test`, `HOST=127.0.0.1`, `PORT=3000`, `TRUST_PROXY_HOPS=0`, `DATABASE_URL=postgresql://shopademia_test@127.0.0.1:55432/shopademia_test`, `DATABASE_SSL=false`, and `PUBLIC_SITE_URL=http://localhost:3000`. `DOTENV_CONFIG_PATH` pointed to a newly created empty temp file, so the repository `.env` could not contribute values. Synthetic-only JWT/admin credentials were supplied through the process environment; optional push integrations were unset.
- `server/index.js` initialized the empty PostgreSQL database and its ordered/checksummed migration procedure on startup. `server/migrate.js` was not used: it explicitly refuses to run outside production. A disposable managed product and shop-owner test account were then added to this database only.
- The app’s `/healthz` returned `{"status":"ok"}`. After testing, the verified test app PID was stopped with `Stop-Process -Id <PID>`, PostgreSQL was cleanly stopped using `pg_ctl -D <temp>\pgdata -m fast -w stop`, ports 3000/55432 were verified closed, and only the unique temp directory (including synthetic data, logs, and test credentials) was removed.

### Commands/checks and outcomes

| Command/check | Result |
|---|---|
| `npm.cmd test` | **PASS — 100 passed, 0 failed, 0 skipped** |
| `node --check server/index.js`; `node --check playwright.config.js` | **PASS** |
| `npm.cmd run test:e2e` with `PLAYWRIGHT_BASE_URL=http://localhost:3000` | **PASS — Chromium 14/14**, on a fresh test-app process |
| `npm.cmd run test:e2e:all -- --project=firefox --workers=1` | **PASS — Firefox 14/14**, after resetting the test app’s in-process rate-limit window |
| `npm.cmd run test:e2e:all -- --project=webkit --workers=1` | **PASS — WebKit 14/14**, after resetting the test app’s in-process rate-limit window |
| Real API/browser integration smoke (inline Node + Playwright script; isolated app/DB only) | **PASS** — `/healthz`; anonymous admin-orders denial `401`; synthetic platform admin profile `200` but shop orders denied `403`; synthetic shop-owner profile/orders `200`; wrong-shop request denied `401`; logout revoked both test sessions and subsequent protected requests returned `401`; synthetic managed product was browseable; cart worked; blank checkout showed validation errors and sent no order; synthetic checkout persisted one order (`201`); managed stock decremented from 10 to 9. Remote origins were intercepted/aborted; no payment, email, courier, or other customer communication was invoked. |
| Isolated PostgreSQL assertions | **PASS** — `shopademia_test`, port `55432`, `schema_migrations` rows `2`, synthetic orders `1`, synthetic product stock `9`, revoked admin sessions `3`. |
| Full all-browser command `npm.cmd run test:e2e:all -- --workers=1` in one app process | **PARTIAL — 39 passed, 3 failed**. Chromium passed; 3 Firefox storefront checks hit the app’s shared in-process public-catalog rate limiter (`429`) after preceding browser-project requests; all WebKit tests passed. Re-running Firefox alone after app restart passed 14/14. This combined invocation is not represented as a full pass. |
| Standard Chromium invocation with Playwright defaults before single-worker adjustment | **FAILED in the test harness** — concurrent requests reached the shared catalog limit; one earlier run also used `127.0.0.1` and correctly failed an assertion expecting the canonical `localhost` origin. The tests passed with `localhost` and one worker on a fresh app. |

### Retained evidence limits

The figures above are recorded from the local run, but raw per-test output, Playwright traces/reports, PostgreSQL and application logs, and the inline integration-smoke script were not retained in the repository. The temporary cluster and its logs were deliberately removed after cleanup. GitHub Actions run `38273806131` has no retained workflow artifacts; its result applies only to commit `732edd25391599b3d793ed50dc0c59f5a6f909e8`. Therefore, the 100-test, per-browser, and integration results can be reported as the contemporaneous recorded outcomes, but cannot now be independently rechecked from raw artifacts. No test was rerun for this review because no database/service was verified as isolated.

The observed 429s are a test invocation/environment interaction with the repository’s per-process catalog rate limit, not evidence of an application correctness failure. [playwright.config.js](../playwright.config.js) now uses one worker to avoid parallel file-level collisions; when running multiple browser projects against one local app, run one project per fresh app process or wait for the one-minute limiter window to reset. The normal E2E configuration still requires an explicit `PLAYWRIGHT_BASE_URL`.

### Safe local testing changes

- At the time of the integration run, [server/index.js](../server/index.js) accepted and validated an IP-literal `HOST` and used `0.0.0.0` when unset. The post-integration review above corrected that fallback to preserve the prior Node/OS-selected wildcard binding; local integration tests explicitly set `127.0.0.1`.
- [.env.example](../.env.example) sets `HOST=127.0.0.1` for ordinary local development.
- [playwright.config.js](../playwright.config.js) sets `workers: 1` because of the shared app-level API limiter.
- Do not use the standard [docker-compose.yml](../docker-compose.yml) as a disposable test DB without changing its design: it binds host port 5432 and mounts a persistent named volume. The tested temporary-cluster procedure above used a unique data directory and port 55432 instead.

These checks verify one local Windows/Node 24.21.0/PostgreSQL 16.15 environment, not staging or the hosted runtime. The exact CI run [38273806131](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38273806131) applies to the pre-change SHA `732edd2`, not this worktree.

## Safe local readiness audit (2026-10-12)

**Starting repository state:** `C:\Users\Abidh\OneDrive\Desktop\storefront`, branch `feature/admin-v2`, HEAD `732edd25391599b3d793ed50dc0c59f5a6f909e8`, upstream `2/feature/admin-v2`; the worktree was clean before this documentation update. The supplied logout and release-evidence commits are ancestors. Exact-commit GitHub Actions run [38273806131](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38273806131) passed its `test` job (Node tests and dependency audit); the production `deploy` job was skipped.

### Checks executed in this audit

| Check | Result | Scope |
|---|---|---|
| `npm.cmd test` | **PASS — 100 passed, 0 failed, 0 skipped** | Existing Node test suite. No production or live DB was used. |
| `npm.cmd audit --audit-level=low` | **PASS — 0 vulnerabilities** | npm advisory audit at the time of this run. |
| `npm.cmd run build:css` | **PASS** | Tailwind CSS build completed; generated stylesheet had no diff. |
| `node --check` for `server\*.js` | **PASS — 21 files** | Server JavaScript syntax only. |
| `git diff --check` | **PASS** | No whitespace errors in the documentation changes. |
| Lint/type-check | **NOT CONFIGURED** | `package.json` exposes no lint or type-check script/configuration. |
| E2E rerun | **NOT RUN** | This audit made no application-code change; Playwright requires an explicit `PLAYWRIGHT_BASE_URL`, no local app was listening on port 3000, and the local database listener was not verified as isolated. Prior isolated browser evidence is recorded below; do not treat it as a fresh rerun. |
| Live PostgreSQL compatibility/migration, production/staging smoke, backup restore, monitoring/alert, rollback | **NOT RUN / BLOCKED** | No target was verified as an isolated/approved database, and no backup pair, credentials, alert integration, or provider access was available. A local TCP 5432 listener was observed but not contacted because its ownership/data isolation were not established; no app was listening on TCP 3000. No local `.env` contents were read. |

### Code and configuration review observations

- **Verified stack:** Node.js ES modules and Express; `package.json` requires Node `>=20`; CI uses Node 22; the application image pins Node `22.22.0-alpine3.22`. PostgreSQL is authoritative. The database image is `postgres:16-alpine`; this confirms the repository's intended image, not the hosted database version or successful live compatibility.
- **Database/migrations:** PostgreSQL `pg` queries use parameter binding in the inspected order/product/auth paths. The existing schema initializer retains legacy `CREATE/ALTER TABLE` setup; additive admin migrations use version IDs, SHA-256 checksums, advisory locking, and per-migration transactions. No production migration or database connection was attempted. There is no demonstrated migration down/rollback or verified restore path.
- **Authentication/access:** Inspected admin login, MFA enrollment, cookie/session, logout, profile, and shop authorization paths. Admin cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in production; admin routes validate JWTs and server-side session revocation and resolve current account/shop access in PostgreSQL. Shop management and platform-admin route guards are present. This is source inspection, not a full security certification or production auth test.
- **Checkout/public API:** Inspected public order lookup, checkout validation/pricing, idempotency and stock-reservation transaction, public product routes, and admin product CRUD. Checkout recalculates/validates server-side and uses a PostgreSQL transaction for order/stock writes. No order was submitted in this audit; payment/courier integrations and concurrency/recovery guarantees are not thereby verified.
- **Input/error/logging:** Inspected product validation, image MIME/signature checks, upload size/count limits, prepared SQL values in sampled paths, generic API 500 response, and logs that generally emit error name/code rather than request payloads. This bounded review did not cover every field/route or prove absence of vulnerabilities.
- **Health/config:** `/healthz` performs `SELECT 1`, disables caching, and returns 503 on DB readiness failure. Production startup requires separate MFA key and public URL; optional database TLS validates the certificate. Compose has a database healthcheck and internal DB network. Neither runtime configuration nor health was tested against the hosted environment.
- **Release safeguards:** The only deploy workflow targets cPanel production, and requires a push to `main`, passing tests, and `CPANEL_DEPLOY_ENABLED=true`. It performs in-place `rsync --delete`; it does not stage, back up, run migrations, or keep a release switch/rollback. No deployment was triggered, and no deployment files changed.
- **No verified code defect was established by this bounded audit.** No application code or infrastructure configuration was changed. The material outstanding issues are missing infrastructure evidence and operational recovery/rollback capability, not a claim that all application behavior is secure or correct.

The current local documentation changes in this report, [PROGRESS.md](./PROGRESS.md), and [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) are not committed or pushed. No commit was required for these local notes by the existing workflow. The exact CI result above applies to HEAD `732edd2`, not to these documentation edits. A local TCP 5432 listener was observed during follow-up; it was not contacted because its instance/data isolation could not be established.

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
- At that earlier point, a Playwright run completed Chromium (8 passed, 1 skipped) but the Firefox binary exited immediately with Windows exit code `3236495362`; Firefox/WebKit were not tested in that run. See the latest Admin/API audit below for current browser results.
- Development platform-admin login now uses email and password only. The server still enforces MFA in production regardless of configuration; stored MFA enrollment has not been changed. A server/API boundary test and updated browser test cover this behavior.
- Verified local `/healthz` and `/admin` return HTTP 200; the rendered local login page carries the development-only MFA-off setting. The actual supplied local account credentials also passed the Chromium form flow; profile returned 200, redirect reached the Platform Admin page, and logout revoked the session.
- The shared browser tool repeatedly timed out on `/api/v1/admin/*`, while a clean local Chromium browser completed the real form login, authenticated profile redirect, and logout. The remaining timeout appears isolated to the shared browser session/tool context.
- Platform Admin now opens one feature panel at a time, selected by the sidebar or a deep-link fragment. Sidebar destinations for Store Banner, Manage Offers, and Delivery Advance now target the existing features; Coupons and Offer Banner remain disabled rather than linking to unrelated offer behavior. The focused mobile browser check confirms feature switching, role-specific API navigation, a single visible panel, and no horizontal overflow at 390 px; it does not test real API actions within those panels.

## Not tested

- Live platform-admin MFA enrollment/recovery and replay testing; unit tests cover TOTP verification/replay, and live synthetic shop-admin sessions were tested. The configured eight-hour session lifetime was not observed by waiting eight hours.
- Authorization review/execution for every platform-admin module and staff permission combination; targeted anonymous, shop-owner, cross-shop, product, and order gates were exercised.
- Linux/CI, screen-reader/manual accessibility, and tablet/desktop visual reviews.
- Hosted staging deployment, provider/network/TLS diagnosis, staging resource provisioning, production schema/data inventory, production migration, backup restore, RPO/RTO, monitoring/alert delivery, and rollback/recovery drills.
- Forced database-failure/rollback injection beyond the concurrent stock-reservation conflict test; real payment verification/refund, notifications, courier/webhook behavior, shipment/return/exchange, or other financial actions.
- Performance/load targets and target-host Node/PostgreSQL/`sharp` compatibility.

## Regression and release assessment

The latest full Node suite passed (120/120), the API suite passed (74/74), and dependency audit reported zero vulnerabilities. Chromium, Firefox, and WebKit passed when run individually against a fresh isolated app; the combined all-project invocation exceeded the shared public-catalog request limit and is reported below. This remains local evidence, not a release approval.

**Production decision: NO-GO.** See [AUDIT_REPORT.md](../AUDIT_REPORT.md), [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for blockers and per-area status. Do not infer payment, shipment, data migration, or production readiness from these test results.

## Browser QA continuation (2026-10-13)

### Target and fixture

- Verified branch `feature/admin-v2`, HEAD `dcb52b007d737456bd50aeb8f39174f7550670ce`; no production or staging target was used.
- The previous empty catalog was expected: `js/data/products.data.js` exports empty built-in product lists, and `initializeDatabase` creates schema/default shop/admin records but does not seed products. The isolated PostgreSQL `managed_products` table had 0 rows and `orders` had 0 rows. No project fixture-seeder exists. Normal product creation is through authenticated admin product management with an accepted uploaded image.
- For this browser check only, inserted one clearly synthetic product directly into a newly created disposable PostgreSQL 16.15 container after verifying database `shopademia_local`, local app target, database role, default shop, and zero pre-existing product/order rows. The DB was published only on `127.0.0.1:54329`; the app listened only on `127.0.0.1:3000`. The fixture was removed after testing. No production/staging connection, data, or credentials were used.
- Analytics consent was set to essential-only before successful checkout. The checkout endpoint stores an order request without collecting payment; no notification/payment integration was invoked. Synthetic order data and the fixture were removed with exact-key guarded deletes; final isolated DB counts were 0 orders and 0 managed products.

### Results

| Check | Result | Evidence and limits |
|---|---|---|
| `npm.cmd run test:e2e -- storefront.spec.js --workers=1` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` | **PASS — 7 passed, 0 failed, 0 skipped** | Chromium storefront spec against the isolated app and synthetic catalog item. Includes product detail/SEO, public catalog API, route/mobile checks, error handling, unauthenticated admin page, and axe checks on home/privacy/terms. HTML report generated locally at ignored `playwright-report/index.html`. |
| First run of the same storefront spec | **6 passed, 1 failed** | Existing product-detail assertion incorrectly expected product name/description even when the API returns explicitly configured `seoTitle` and `metaDescription`. Corrected the E2E expectations to honor those fields; no application behavior was changed. Rerun above passed with a fixture using distinct custom SEO metadata. |
| `node --check tests/e2e/storefront.spec.js`; `git diff --check` | **PASS** | The modified test parses and the diff has no whitespace errors. |
| Browser product detail | **PASS** | Synthetic managed product detail rendered with configured custom SEO title/description, price/discount, and available stock. |
| Browser cart quantity/totals/removal | **PASS** | Added two units: total ৳2,500; increased to three: ৳3,750; decreased to two: ৳2,500; removing the line emptied the cart and disabled checkout. |
| Browser wishlist add/remove | **PASS** | Adding updated count 0→1 and local storage; removing from the wishlist view returned count to 0 and displayed the empty state. |
| Checkout client validation | **PASS** | Empty submission marked all four required fields invalid and sent no order POST. |
| Checkout API validation | **PASS** | Direct synthetic malformed checkout returned HTTP 400 (`Enter a valid customer name.`); no row was stored for its unique invalid event ID. |
| Successful non-payment checkout and PostgreSQL persistence | **PASS, disposable local only** | One synthetic request returned HTTP 201. PostgreSQL contained exactly one matching synthetic order with 2 units, subtotal 2500, advance requested 100 (not paid), due 2500, status `new`; stock changed 12→10. Browser cart cleared. This is not a real customer order, payment, notification, staging test, or release check. |
| Synthetic order lookup | **PASS, disposable local only** | Correct order number and synthetic phone returned HTTP 200 with matching item/quantity/subtotal/status. |
| Prior browser checks from this continuation | **Retained, not repeated** | Category/deals/shops/about navigation, no-match search and Clear filters, empty wishlist/cart behavior, checkout-disabled empty cart, required-field order lookup blocking, and mobile menu/no-overflow had already passed as documented in the preceding user turn. |

No confirmed storefront runtime defect was found. A test-oracle defect for custom SEO metadata was fixed in `tests/e2e/storefront.spec.js`. This report does not establish hosted staging behavior, successful backup/restore, monitoring alert delivery, rollback/recovery, or production readiness. **Production remains NO-GO.**

## Admin/API security regression and release-evidence audit (2026-10-13)

### Target and safety

- Rechecked branch `feature/admin-v2`, HEAD `dcb52b007d737456bd50aeb8f39174f7550670ce`, worktree, and diff. The pre-existing changes to this report, [PROGRESS.md](./PROGRESS.md), and `tests/e2e/storefront.spec.js` were preserved; the untracked Docker installer was left untouched. No commit or push was made.
- Did not use the app on port 3000 for writes. Its repository `.env` parses to `127.0.0.1:5433/shopademia`, which is not the known disposable database mapping; the active process's environment could not be verified, so it was not used for data changes. All database-backed writes below used a newly created, uniquely named database in the existing disposable PostgreSQL container, exposed only at `127.0.0.1:54329`, with synthetic credentials and accounts.
- Verified the synthetic audit database name, owner, loopback-only DB port, and initial product/order counts before writes. A synthetic owner, two temporary products, and two synthetic orders were used. Before teardown the DB contained **0 products / 2 synthetic orders**; the exact audit database and its app/migrator roles were then dropped, and catalog queries confirmed no such database or roles remained.
- No production/staging connection, customer data, external payment, push notification, or provider resource was used.

### Test commands and outcomes

| Check | Result | Evidence and limits |
|---|---|---|
| `npm.cmd test` | **PASS — 120 passed, 0 failed, 0 skipped** | Current full Node suite; no source changes were made during this audit. |
| `npm.cmd run test:api` | **PASS — 74 passed, 0 failed, 0 skipped** | Server/API tests include authorization, CRUD, sessions, login throttling, MFA, order status, lookup, and validation cases using isolated test doubles. |
| `npm.cmd audit` | **PASS — 0 vulnerabilities** | Dependency audit result at audit time. |
| `npm.cmd run test:e2e -- --workers=1` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` | **PASS — 13 passed, 0 failed, 1 skipped** | Fresh isolated audit DB; product detail is conditionally skipped when the catalog is empty. |
| `npm.cmd run test:e2e:all -- --workers=1` | **FAIL — 33 passed, 8 failed, 1 skipped** | Combined projects shared the app's 120-request/minute public catalog limiter; later catalog/config fetches received HTTP 429. The limiter was not changed. The failure is a combined-run/test-isolation constraint, not evidence of an authorization bypass. |
| `npm.cmd run test:e2e:all -- --project=firefox --workers=1` | **PASS — 13 passed, 0 failed, 1 skipped** | Firefox run against a fresh app process and isolated DB. |
| `npm.cmd run test:e2e:all -- --project=webkit --workers=1` | **PASS — 13 passed, 0 failed, 1 skipped** | WebKit run against a fresh app process and isolated DB. Chromium also passed individually as shown above. All Playwright reports/traces were written outside the repository. |
| `node --check tests/e2e/storefront.spec.js`; `git diff --check` | **PASS** | Test syntax and current diff hygiene. |

### Authentication, authorization, API, and browser evidence

- Real synthetic shop-owner login succeeded in the local app. Same-origin login returned no bearer token and set an HttpOnly, `SameSite=Strict` cookie; profile/orders endpoints succeeded while authenticated. Logout revoked the server session, and the same cookie then received HTTP 401. A signed expired JWT, invalid cookie, anonymous protected requests, and a valid foreign-shop selector were denied (401). A cross-origin cookie-authenticated write was denied (403).
- Missing/malformed and SQL-injection-style login inputs returned generic 401 responses; the per-IP login limiter allowed the configured attempts and then returned 429. Validation errors did not include passwords, hashes, database URLs, SQL text, or internal credentials. Unexpected database-error paths were not artificially forced; the common handler returns a generic 500 and logs only error type/code.
- Authenticated product API create, update (including price, stock, and availability), and delete succeeded; malformed identifiers, oversized descriptions, unsupported numeric SQL-like values, and spoofed product values were rejected without changing the record. An inert synthetic HTML event-handler payload was persisted as product metadata and rendered on the detail page without executing; no page errors occurred.
- Actual Chromium admin UI login/logout passed. The owner reviewed the synthetic order in the authenticated dashboard and changed status from `confirmed` to `processing`; the API then returned that persisted state. In a separate fresh disposable database, the 390×844 admin product screen created a synthetic product through the UI, edited its price/stock/availability, and deleted it; API reads confirmed each persisted state. A synthetic HTML event-handler payload in its name remained text, with no script execution, page errors, or horizontal overflow. The database was verified at 0 products / 0 orders with both synthetic sessions revoked, then the exact database and role were dropped.
- An out-of-sequence `new` → `delivered` request returned HTTP 409 and left the order `new`; `new` → `confirmed` and browser `confirmed` → `processing` succeeded. SQL-like status input returned 400. Order lookup with another phone returned 404; the matching synthetic phone returned only the approved order projection, without address, phone, or bKash number.
- Two simultaneous distinct synthetic orders competed for one unit of stock: exactly one returned 201 and one returned 409. The order row recorded the server catalog price (৳2,500), not the submitted price (৳1); the advance was the shop-configured 100, not the submitted amount. Before product cleanup, the database showed `inventory_reserved=true` and no negative inventory. No real payment was attempted.
- A separate local synthetic app/migrator role setup was verified: the app role had no superuser, database-create, role-create, persistent schema-create, or `TRUNCATE` privilege, but had the required table DML and sequence privileges; the migrator owned the DB/schema objects and created/dropped an exact probe table. `node server/migrate.js` completed against only this isolated database using `MIGRATION_DATABASE_URL`. A production-mode local app then successfully authenticated, created/deleted a product, reserved inventory, updated an order and audit event, and revoked a session while using the DML-only role. This is local simulated evidence; it does not verify roles on a hosted staging database.
- Browser requests to the known static asset origins `cdnjs.cloudflare.com` and `fonts.googleapis.com` were intercepted and aborted before network access during the targeted XSS/admin browser checks. No payment or notification integration was invoked. The standard Playwright suites were not globally configured to block these static asset origins.

### Security review and release decision

- The delegated static security review found **no confirmed exploitable vulnerability** in its reviewed scope. No application source defect was confirmed during the live synthetic checks; the observed HTTP 409 was the correct invalid-transition response, and two local test-harness locator/expectation mistakes were corrected without changing application behavior.
- **Staging readiness: BLOCKED / NOT READY.** Local configuration and isolated-role behavior are not a hosted staging deployment. A separately owned host/hostname, authorized access, staging-only secrets/database/uploads, provider HTTPS/443/TLS evidence, and external monitoring/recovery gates remain unavailable or unverified.
- **Production: NO-GO.** No production deployment, migration, DNS/configuration change, backup restore, alert delivery, rollback, or database recovery was performed. Continue to require verifiable isolated staging and recovery evidence before any release.
