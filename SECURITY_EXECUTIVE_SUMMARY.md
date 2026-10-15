# Shopademia Security Assessment — Executive Summary

## Current local verification correction — 2026-10-14 19:26 +06

- Current public-only E2E attempted 9 Chromium cases against `http://127.0.0.1:3002` and exited 1 because the existing preview refused connections. No app listener on 3002 or isolated DB listener on 55441 was present. Nothing was started/restarted. Earlier 9/9 public browser results remain historical and are not overwritten.
- Current safe results: API 85/85; full Node 133/133 (includes API); staging config 15/15; target guard 7/7. Fresh online npm audit found 0 vulnerabilities. Absent `.env.staging` continues to make validation fail closed.
- Static `realpath()`/open TOCTOU is not fixed; immutable/read-only served roots and isolated writable upload ingestion require deployment evidence. A fresh dedicated secret scan was not performed because no scanner or project scan script is available.
- D01–D12 remain pending/unverified. GitHub remote protection and credential-scope settings remain unverified; workflow YAML does not establish them.
- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.**

## Production-readiness follow-up — 2026-10-14 11:15 +06

- Bounded security review of the changed route enforcement, static serving/upload handling, admin session controls, staging test-target guard, startup and migration code found no actionable vulnerability in the reviewed changes. This does not establish whole-system security.
- Static `realpath()`/open TOCTOU remains unresolved if a filesystem actor can replace path components; junction containment tests are not race tests. Hosted acceptance still requires immutable read-only release/static roots, uploads kept outside those roots, and verified runtime ACL/ownership evidence.
- Fresh local verification: full Node suite 133/133; target guard 7/7; public-only Chromium E2E 9/9; configured CSS build exited 0. Fresh online npm audit found 0 vulnerabilities. No dedicated fresh secret scan was available.
- GitHub settings remain **UNVERIFIED** after HTTP 403 rate-limit responses. External D01–D12 approvals and evidence remain outstanding.
- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.**

## Static race and secret-pattern disposition — 2026-10-14 11:07 +06

- Static containment remains vulnerable to check/open replacement races: `realpath()` check is not bound to the later `express.static` open. Junction tests are not race proof. Hosted gate requires deployment-owned immutable code/static roots, runtime Read & Execute only, separate non-served app-writable upload ingestion, and immutable/read-only published uploads. Capture actual ownership/ACL/mounts and prove runtime write attempts fail; otherwise keep the gate blocked. No local runtime change was made.
- The previously flagged `.env.example` line 9 was a bare unassigned loopback PostgreSQL URL with a non-placeholder password-like component. It was removed from the current file; its validity/use/reuse is unknown and requires owner review. No credential was printed or tested.
- Remaining environment-example DSNs use explicit placeholder passwords; the staging-config test match is synthetic invalid-host fixture data. No dedicated secret scanner was available to rerun. The prior Secretlint alerts are historical and not represented as a fresh clean scan.
- Staging remains **BLOCKED / NOT READY**; production remains **NO-GO**.

## Staging approval closure follow-up — 2026-10-14

- The 12 staging decisions are identified as D01–D12 with dependencies, local/external actionability, owner roles, pending/unverified status, exact next action, evidence and acceptance criteria in [STAGING_APPROVAL_REQUEST.md](./docs/STAGING_APPROVAL_REQUEST.md). No individual approvers or signed approvals are recorded.
- The concise request for the release owner, provider and repository administrator is in [STAGING_TARGET_APPROVAL_BRIEF.md](./docs/STAGING_TARGET_APPROVAL_BRIEF.md); it was prepared but not sent.
- GitHub read-only settings inspection obtained no settings payload: REST calls returned 403 API rate limit, MCP branch listing returned 404, and `gh` is unavailable. Branch protections, required reviews/checks, environment reviewers, Actions permissions, secret scopes and remote workflow state remain **UNVERIFIED**. The local workflow only evidences source-level conditions.
- `.env.staging` remains absent. `npm.cmd run validate:staging` exited 1 as expected for absent configuration; no placeholders or credentials were created.
- Fresh local follow-up: `npm.cmd test` 132/132; public Playwright list 9 public cases and public E2E 9/9; target guard 7/7; privileged loopback listing refused execution with 0 tests; fresh online `npm.cmd audit --audit-level=low` reported 0 advisories. These checks do not authorize staging or production.
- No repository-supported/dedicated secret scanner was available to rerun. The previous ephemeral Secretlint scan is historical only and reported seven potential DB URL patterns; manual review is outstanding and no value was printed.
- **STAGING: BLOCKED / NOT READY. PRODUCTION: NO-GO.** No infrastructure, DNS, provider account, database, running preview, or deployment was altered.

## Current evidence reconciliation — 2026-10-14

This dated update supersedes the older runtime and test-total statements below; those statements are retained as historical records.

- **Latest local verification:** API 85/85, full Node suite 132/132, public-only Chromium 9/9, Playwright target guard 7/7, and offline cached `npm.cmd audit --offline --audit-level=low` reported 0 vulnerabilities. `git diff --check` passed. Suite counts overlap.
- Privileged Playwright files require an explicit opt-in and fail closed for loopback/localhost targets; the read-only preview `--list` probe launched no browser and listed zero tests. Static preview serving now has a canonical realpath containment check; an isolated Windows directory-junction test passed. A filesystem path-replacement race is not eliminated or tested.
- The currently running app process was not restarted, so the new static containment middleware is not claimed active in that process. No direct database connection/query or inventory comparison, prohibited live-preview probe, remote staging/production request, or deployment occurred.
- Repository workflow review found production deploy logic gated on push to `main` plus `CPANEL_DEPLOY_ENABLED=true`, but no declared GitHub protected `environment`; actual branch/environment protection settings were not inspected. This requires owner verification before release.
- **Staging:** BLOCKED / NOT READY. **Production:** NO-GO.
- The loopback-only read-only preview is currently serving at `127.0.0.1:3002`, with its isolated PostgreSQL 16 preview at `127.0.0.1:55441`. This does not establish hosted staging readiness.
- Latest read-only database inventory: 1 product, 0 orders, 1 admin, 0 sessions, 2 migration records. The compared inventory was unchanged.
- The preview's synthetic database credential was rotated and the local administrator record/session version were reset during the separately authorized 2026-10-13 recovery. Whether any previously exposed values were reused outside this isolated preview remains unknown; this does not provision staging secrets or clear a global exposure concern.
- `npm.cmd run test:api`: 84 passed, 0 failed, 0 skipped. `npm.cmd test`: 130 passed, 0 failed, 0 skipped. `git diff --check`: passed.
- Encoded static traversal probes fail with generic 404 responses; public assets continue to load. The category product image link has an accessible name and navigates to its expected synthetic product detail.
- `npm audit --audit-level=low --offline` reported 0 vulnerabilities using cached advisory metadata; current online advisory freshness was not checked.
- Hosted staging DNS/TLS, authenticated staging workflows, independent staging backup restoration, monitoring/alert delivery, rollback rehearsal, and external operational ownership remain unverified. See [STAGING_READINESS_AUDIT.md](./docs/STAGING_READINESS_AUDIT.md).
- The 1,000-scenario catalogue and historical counts are preserved. Its dated local-evidence reconciliation is recorded in `SECURITY_TEST_MATRIX.json`; narrow local checks do not clear broader candidate scenarios or the two historical FAIL entries.

## Follow-up blocker revalidation — 2026-10-14

- The local preview still responds on loopback: `/healthz`, `/`, and `/api/v1/products` all returned HTTP 200. Current process/listener checks found the app at `127.0.0.1:3002` and preview PostgreSQL at `127.0.0.1:55441`; port 5432 remained a separate, untouched PostgreSQL 17 listener. No 5433, 3003, 80, or 443 listener was found.
- Docker Desktop's Linux-engine named pipe is unavailable now; no current staging container or volume inventory could be established. Previous image-build/config validation remains historical.
- A bounded Chromium regression now passes with cdnjs and Google Fonts CSS requests blocked (1/1). It establishes local content/layout fallback behavior only, not CDN uptime or hosted staging.
- Current suites pass: API 84/84 and full suite 130/130; `git diff --check` passes. `npm.cmd run validate:staging` safely reports `.env.staging` absent; no staging configuration or credentials were created.
- No staging/provider-dependent blocker was cleared; see [STAGING_READINESS_AUDIT.md](./docs/STAGING_READINESS_AUDIT.md) for exact evidence gaps and accountable owners.

## Local preview operating-policy update — 2026-10-14

- Server-side preview access is now restricted to allowlisted public browsing/catalog/static GET/HEAD routes. Admin pages and APIs, order-lookup page, notification/push-key endpoints, all non-GET/HEAD methods, and unapproved paths are rejected before handlers; denied reads do not query the database.
- The existing loopback preview was restarted with its protected read-only configuration. Approved homepage, category, synthetic product detail, public catalog/category APIs and static asset reads passed. No prohibited request was sent to the live preview.
- Focused server policy tests passed (4 allowlist/config tests and 1 in-process route-guard test); safe Chromium browsing/accessibility/CDN tests passed 3/3.
- Staging remains **BLOCKED / NOT READY** and production remains **NO-GO**.

## Decision

- **Staging:** BLOCKED / NOT READY.
- **Production:** NO-GO.
- **Assessment completeness:** Partial. This is an evidence-backed source, automated-test, and local-environment review, not a full penetration test or security clearance.

The repository is on `feature/admin-v2` at `798e7227e907edbbd262e8fe25b78d9e79cd7247`. The preview application and isolated PostgreSQL listener are currently stopped. Live administrator login, authenticated browser tests, live writes, and external infrastructure checks therefore remain unperformed.

## Main results

- Fixed a local bootstrap validation defect: the documented example administrator password placeholder passed the development bootstrap's length check. Shared validation now rejects example placeholders before database initialization and the production migration path uses the same validator.
- Regression suite after the fix: **124 passed, 0 failed, 0 skipped** (`npm.cmd test`).
- Dependency audit: **0 vulnerabilities** (`npm.cmd audit --audit-level=low`).
- Previous local verification established the preview application's connection to its dedicated loopback PostgreSQL database and recorded one synthetic product, zero orders, and one administrator credential row. That environment is stopped now; these are historical, read-only observations, not present runtime verification.
- Synthetic secret values were previously exposed in local PowerShell launch command text. The values are not repeated here. Rotation and dependent-session invalidation have **not** been completed because a supported administrator reset procedure was not established.
- A total of 1,000 uniquely identified candidate scenarios is recorded in `SECURITY_TEST_MATRIX.json`. Catalogue entries explicitly distinguish tested, blocked, not-tested, and not-applicable cases. The count is not a count of findings or executed tests.
- Scenario statuses: **23 PASS, 2 FAIL, 62 BLOCKED, 888 NOT TESTED, 25 NOT APPLICABLE**. The 23 passes are limited to the specific automated/static evidence named in each entry.

## Highest-priority residual risks

1. Determine whether any previously exposed synthetic local values were reused outside the preview and document the containment scope; no production credential was accessed or changed.
2. Verify staging ownership, target identity, staging-only secrets, TLS, backups with independent restore, monitoring/alert receipt, recovery operators, and rollback before any staging release.
3. Obtain independent production release authorization and evidence for the production target, secret rotation, backup restoration, monitoring, recovery, migration, and rollback gates.

## Scope and limitations

Source inspection covered the Express application, platform routes, PostgreSQL access/bootstrap, password and TOTP helpers, environment setup, staging Compose, CI workflow, and project documentation. Automated Node tests and npm advisory audit ran locally. Authenticated runtime testing, public network testing, staging/production access, live database checks during this run, and destructive or external service tests were not performed.

See [SECURITY_FINDINGS.md](./SECURITY_FINDINGS.md), [SECURITY_THREAT_MODEL.md](./SECURITY_THREAT_MODEL.md), [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md), and [SECURITY_RELEASE_GATE.md](./SECURITY_RELEASE_GATE.md) for detail.
