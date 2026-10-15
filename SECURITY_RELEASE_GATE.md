# Shopademia Security Release Gate

## Current closure recheck — 2026-10-14 19:26 +06

- Unit/fake-dependency suites passed: API 85/85, full Node 133/133 (overlap), staging config 15/15, target guard 7/7.
- Public-only E2E at `http://127.0.0.1:3002` exited 1 because the existing preview was unavailable; all 9 cases failed before reaching app behavior. No preview or database was started/restarted. This does not replace earlier historical browser results.
- `npm.cmd audit --audit-level=low` online: 0 advisories; `.env.staging` absent and validator correctly exited 1.
- Filesystem check/open race remains a blocker. Dedicated secret scan remains unperformed because no supported scanner was available. Remote GitHub protections and secret scopes remain **UNVERIFIED**; checked-in CI conditions are not settings evidence.
- D01–D12 remain pending/unverified/unapproved. No target, cost, approval, provider capability, restoration, or remote control was fabricated.
- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.**

## Fresh production-readiness verification — 2026-10-14 11:15 +06

- Bounded read-only security review identified no actionable vulnerability in the reviewed changes; review scope is not a whole-application certification.
- Static path containment still has a check/open race for a filesystem writer capable of replacing path components. Do not clear this gate without verified immutable/read-only release and asset roots, separate upload ingestion/publication, and runtime ownership/ACL evidence.
- Fresh local results: `npm.cmd test` 133/133, target guard 7/7, public-only Chromium E2E 9/9, CSS build exit 0; fresh online `npm.cmd audit --audit-level=low` reported 0 vulnerabilities. These results do not clear hosted staging or production controls.
- Staging validator remains fail-closed with absent `.env.staging`; GitHub protection settings remain unverified; dedicated secret scanning remains unavailable.
- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.**

## Static and secret-pattern follow-up — 2026-10-14 11:07 +06

- Static path verification retains an unresolved TOCTOU race between `realpath()` and Express's later open. The existing junction fixture is not a race test. Release gate requires immutable deployment-owned code/static trees, read-only runtime permissions, separate unserved writable upload ingestion and immutable published uploads, with actual ACL/mount and runtime write-denial evidence. Otherwise the static race gate stays **BLOCKED**.
- The historical `.env.example` line 9 finding was a bare unassigned loopback PostgreSQL URL with a non-placeholder password-like part. That line was removed; validity and reuse of the historical value remain **UNVERIFIED**. Owner review is required; no DB/secret store was accessed.
- Other matched connection strings are placeholder-backed examples or synthetic test fixture inputs. A dedicated scanner was unavailable; no new scan is claimed.

## Autonomous approval and QA follow-up — 2026-10-14 10:56 +06

- Reverified branch `feature/admin-v2`, HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`, upstream `github/feature/admin-v2`; staged diff empty. Existing dirty work and untracked artifacts preserved.
- D01–D12 now include prerequisites, local-vs-external next action, accountable roles, status, evidence and acceptance criteria. No named approvers or signed decisions are present; all external approvals remain pending.
- Repository-settings inspection got no actual settings payload: REST requests for branch protection, rulesets, Actions permissions, environments and workflow contents returned 403 rate limit; MCP branch listing returned 404; `gh` is unavailable. Actual branch/review/environment/secret controls remain **UNVERIFIED**.
- Safe tests: full Node 132/132; target guard 7/7; public E2E 9/9. Privileged loopback discovery probe correctly exited 1 before discovering tests. Fresh online npm audit returned 0 advisories. Staging validator exited 1 as expected with `.env.staging` absent.
- No dedicated secret scanner was available to rerun; prior ephemeral Secretlint alerts remain historical/unresolved for manual review. `git diff --check` passed.
- No database write, preview restart, provider/DNS access, staging operation or deployment occurred.

## Final pre-staging evidence — 2026-10-14

- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.** Current tests do not supply provider approval, infrastructure isolation, TLS, restore, monitoring, rollback, or remote CI control evidence.
- No named accountable individual or signed approval is recorded for any external staging decision. The approval request now records the owner role, pending/unverified status, required evidence and acceptance criterion for every decision; no decision gate is cleared.
- Read-only GitHub REST GETs for branch protection, rulesets, Actions permissions, environments and workflow contents returned HTTP 403 due to API rate limit. GitHub MCP branch listing returned 404 and GitHub CLI is unavailable. No actual settings payload was retrieved; all branch protection/reviews/environment controls/secret scopes remain **UNVERIFIED**. Local `.github/workflows/ci.yml` only establishes its checked-in source conditions.
- `.env.staging` is absent and `npm.cmd run validate:staging` exited 1 with the expected missing/invalid configuration error; fail-closed behavior is preserved.
- Final checks: static junction regression 1/1; Playwright target guard 7/7; API suite 85/85; complete Node suite 132/132; public Chromium suite 9/9; `git diff --check` clean. Suites overlap. The loopback privileged `--list` probe returned expected exit 1 before discovery with 0 tests/browser launches.
- Static canonical-path containment now precedes `express.static` for all static mounts and both application modes. It rejects tested traversal/NUL/junction cases, but its check-to-open sequence is not race-proof. Race remains **NOT TESTED**; require immutable/read-only code and public-asset roots, operator-only filesystem control, and app-only upload writes or implement stronger handle-relative confinement.
- Online npm advisory check: `npm.cmd audit --audit-level=low`, registry `https://registry.npmjs.org/`, offline false, 0 advisories. Secretlint's ephemeral scan of 173 text files produced 7 potential DB-URL matches in example env files/test fixture; no value was exposed or confirmed as a leaked credential. The `.env.example` line 9 match requires manual review.
- `.github/workflows/ci.yml` source declares `contents: read`; production deploy is gated in source on `push` to `main` and `CPANEL_DEPLOY_ENABLED=true`, has no declared GitHub `environment`, and references `${{ secrets.CPANEL_SSH_KEY }}` / `${{ secrets.CPANEL_KNOWN_HOSTS }}`. Actual secret scope, branch rules, required checks/reviews, environment protection and Actions settings are **UNVERIFIED**: read-only settings/API requests returned 403/404 and authenticated GitHub CLI was unavailable. Do not infer either presence or absence.
- No preview restart, database query/write, DNS/provider action, staging/production access, commit, push, or deployment occurred.

## Current privileged-test and static-containment gate — 2026-10-14

- The public Playwright default selects storefront-only specs. Privileged admin specs are guarded by both an explicit approval opt-in and a non-loopback, exact-match HTTPS staging target with per-run external artifact paths. A loopback `--list` probe exited nonzero before browser startup; target safety tests passed 7/7.
- Read-only static path containment has an in-process canonical-path check and passing isolated directory-junction regression. A filesystem replacement race is not eliminated or tested; the already-running local preview was not restarted, so the middleware change is not claimed active there.
- Latest full/API/public-browser results are 132/132, 85/85, and 9/9 respectively; counts overlap. `git diff --check` passed. These local checks do not clear hosted release gates.
- Production workflow review: a push to `main` can deploy when `CPANEL_DEPLOY_ENABLED=true`; no declared GitHub protected environment is present in the checked workflow. Actual branch protection/environment reviewer settings are unverified. Require owner confirmation before release; no workflow or remote setting was changed.

## Current read-only audit correction — 2026-10-14

- Decision remains **STAGING: BLOCKED / NOT READY; PRODUCTION: NO-GO**.
- Current verified local results: focused guard tests 5/5, API tests 84/84, full Node tests 130/130, public-only Chromium tests 9/9, and `git diff --check` passed. Live checks were limited to allowed public browsing and the health endpoint. No fresh database inventory comparison or staging/production access occurred.
- Scope-control disclosure: before the `test:e2e` default was narrowed to public storefront cases, the broad Chromium suite requested `/admin`, `/admin/platform`, and admin static asset paths from the local preview. Those tests failed to render admin UI; source inspection shows the guard rejects these routes, but that run did not assert/record their HTTP statuses. API requests in specs with `page.route` mocks were intercepted, and the login test timed out before submitting. No login POST or data mutation was observed. Treat those seven admin UI test failures as BLOCKED, not PASS; do not repeat them on the preview.
- The existing 1,000-scenario matrix rows and baseline counts are unchanged; the latest update is a narrow local regression record only.

## Evidence update — 2026-10-14

The older runtime and 124-test entries below are historical and superseded by this update. The release decision does not change.

- **Staging: BLOCKED / NOT READY. Production: NO-GO.**
- Latest local regression results: API 84/84, full suite 130/130, `git diff --check` passed. These do not establish hosted staging readiness.
- The isolated read-only preview is loopback-only at `127.0.0.1:3002` and PostgreSQL `127.0.0.1:55441`; read-only inventory is unchanged. No staging or production service was contacted.
- Follow-up local checks again found `/healthz`, `/`, and `/api/v1/products` healthy. Docker Desktop's Linux engine is currently unavailable, so current staging containers/volumes cannot be inventoried. A new Chromium CDN/font-outage regression passed 1/1; this closes only a local browser fallback check.
- Local preview policy was tightened: admin/API, order-lookup, notification, and non-GET/HEAD paths are rejected server-side before handlers; the preview was restarted with its protected read-only config. Focused route tests passed and allowed public browsing checks passed. No prohibited endpoint/method was sent to the preview.
- The 1,000 candidate scenarios and historical outcomes remain preserved. See the dated `assessmentUpdates` evidence in `SECURITY_TEST_MATRIX.json`.
- A detailed prioritized blocker list and required independent release evidence are in [STAGING_READINESS_AUDIT.md](./docs/STAGING_READINESS_AUDIT.md).

## Decision

- **Staging: BLOCKED / NOT READY**
- **Production: NO-GO**

Local unit/API tests and a dependency audit do not authorize a deployment.

## Gate evidence

| Gate | Status | Evidence required to clear |
|---|---|---|
| Authorized target ownership and release scope | BLOCKED | Written approval naming the target, owner, authorized operators, and permitted actions. |
| Staging hostname, DNS, and service routing | BLOCKED | Verified ownership and target mapping; no hostname or public record is invented here. |
| Dedicated staging DB, roles, credentials, and volumes | BLOCKED | Sanitized connection identity, role grants/ownership, network isolation, persistent-volume mapping, and proof distinct from production. |
| Secret provisioning, access control, and rotation | BLOCKED | The isolated preview's synthetic DB credential was rotated during its 2026-10-13 recovery; whether any exposed values were reused outside that preview remains unknown. Staging-only keys, secret-store ACLs, and rotation/revocation evidence are not established. |
| TLS, reverse proxy, trusted proxy chain, and listener exposure | BLOCKED | Live test against the authorized staging target plus verified Caddy/upstream settings and listener/network inspection. |
| Authentication, MFA, authorization, and tenant isolation | PARTIAL | Selected source/mock coverage and unauthenticated read-only preview checks exist; authenticated staging tests remain blocked until a staging target and synthetic identities are independently verified. |
| Backup and independent restore | BLOCKED | Restore into a separate disposable target; integrity and application-level checks; recorded operators and recovery objectives. |
| Database recovery and migration rollback | BLOCKED | Tested backup restore and rollback procedure for the exact release/migration plan. |
| Monitoring and alert delivery | BLOCKED | Authorized test alert received by the named monitoring destination and acknowledged. |
| Recovery operators and responsibilities | BLOCKED | Named primary/secondary operators, escalation contacts, and approved runbook. |
| CI/CD deployment authorization and artifact provenance | PARTIAL | Workflow source has read-only default permissions, pinned actions, and an explicit deployment gate; branch protection, environment approvals, secrets, runner controls, and destination ownership are not verified. |
| Open release-blocking findings | BLOCKED | Resolve secret exposure and any high/critical findings under the approved risk policy; independently retest. |
| Local automated regression suite | PASS | Latest: `npm.cmd run test:api` 85 passed and `npm.cmd test` 132 passed, no failures or skips; public Chromium 9/9 and target guard 7/7. This is not a release authorization. |
| Dependency advisory audit | PASS (point-in-time) | Online `npm.cmd audit --audit-level=low` against configured npm registry with offline mode false reported 0 vulnerabilities; future advisory state is not guaranteed. |

## Re-evaluation criteria

Staging cannot be marked ready until every staging gate has independent evidence and the isolated authenticated test phase is complete. Production remains NO-GO until its own target, authorization, secret, data recovery, monitoring, migration, rollback, and operator gates are independently verified. No deployment, migration, public DNS, or provider action was performed.
