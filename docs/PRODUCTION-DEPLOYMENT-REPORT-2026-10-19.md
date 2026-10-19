# Production Deployment Report

**Latest reassessment:** 2026-10-19 09:28:28 UTC
**Status:** **NOT LIVE — DEPLOYMENT BLOCKED**

## Release and repository

- **Branch:** `feature/admin-v2`
- **Current commit:** `49ff88d96ef0661d68c91cc81c4d671b63e592aa`
- **Application commit:** `790a1305f3fde30aafcd6f0c5347d11ba3272d5d`
- **GitHub target:** `AbidHossainTushar003/LiveShopademia`, branch `feature/admin-v2`
- The intended GitHub branch was fetched and matched the current local commit at reassessment time. CI completed successfully for `49ff88d96ef0661d68c91cc81c4d671b63e592aa` in run [39227369801](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39227369801).
- The configured `github` remote points to a different repository that now returns “Repository not found”; the configured branch tracking comparison is not the intended GitHub target. Do not infer divergence against it.
- Two pre-existing unrelated untracked entries remain untouched. `.env`, `uploads/`, and generated test artifacts are ignored; no values or contents were inspected for this report.
- The only application-tree change in this reassessment is a regression test for cross-shop product metadata. No production assets, runtime configuration, database, uploads, or DNS were changed.

## Architecture and hosting findings

- The repository's production architecture is Node.js/Express with PostgreSQL, normally deployed as a Docker Compose stack behind Caddy. Its README says the former cPanel deployment workflow is retired.
- All three domains resolve to `122.173.84.249`. Current probes show different, inconsistent routing:
  - `https://shopademia.store/` serves the Shopademia storefront shell (HTTP 200); `/healthz` returns `{"status":"ok"}` (HTTP 200 JSON); `/api/v1/products?limit=1` returns HTTP 200 JSON. This verifies a responsive application on the storefront host only; it does not identify its deployed SHA or establish backup/recovery safety.
  - `https://admin.shopademia.store/` serves a LiteSpeed autoindex page (HTTP 200) listing `cgi-bin` and `php.ini`; `/admin` returns 404. The listed files were not opened. Disable public directory listing and inspect the document root for unintended files through an authorized host session.
  - Requests to `https://api.shopademia.store/` and `/healthz` timed out with no response during repeated current probes. The intended API hostname is not verified.
- A valid Let's Encrypt chain and expected apex/wildcard hostname coverage were observed at reassessment; certificates alone do not validate application routing.
- The cPanel Tools page displayed links for “Application Manager” and “Setup Node.js App”, but navigation to the Node.js tool did not complete. Its selected runtime/version, configured application list, persistent process support, PostgreSQL network connectivity, and domain mappings remain unverified.
- A previous connection using the configured SSH identity and a previously trusted host key established a read-only session and found PostgreSQL client, dump, and restore tools. Node, npm, and Docker were not in that account's normal `PATH`. SSH later timed out; no further host access was attempted during this reassessment.
- The local workspace has no `.env.production`. Production configuration validation therefore failed as expected; no production secrets were requested, generated, or displayed.

## Safety gates not passed

- The production PostgreSQL database, its owner, records, and schema state have not been identified.
- Uploaded files and their persistent location have not been inventoried.
- No production backup was created or verified, and no isolated restore test was performed.
- No rollback release or procedure has been confirmed on the host.
- Staging with a separate database and synthetic records was not available or verified.
- No production migration, service restart, DNS change, cPanel configuration change, or file cutover was attempted.
- The Android application and its Gradle/test sources are absent from the current tree. Commit `790a1305f3fde30aafcd6f0c5347d11ba3272d5d` deleted the previously tracked `phone app` tree; it was not restored because that is existing user Git history. Android build/API compatibility is therefore not verified for this release.

## Checks performed

| Check | Result |
|---|---|
| `npm test` | **PASS** — 169 tests; 168 passed, 1 skipped, 0 failed |
| Cross-shop metadata regression test | **PASS** — one targeted test confirms an active shop cannot render another shop's product metadata |
| `npm run build:css` | **PASS** — completed in this reassessment; its output differed only by removing an unused `.isolate` utility, and the generated-only diff was restored |
| `npm audit --audit-level=low` | **PASS** — 0 dependency vulnerabilities reported |
| `npm run validate:production` | **BLOCKED** — `.env.production` is absent; this is the expected safe failure until secrets are provisioned on the host |
| `npm run validate:staging` | **BLOCKED** — `.env.staging` is absent; no staging secrets or placeholders were created |
| GitHub Actions CI | **PASS** — run `39227369801` succeeded for current commit |
| Storefront public HTTP/API | **PASS, limited** — storefront shell, readiness JSON, and catalog JSON responded on the apex host |
| Admin and API host routing | **FAIL** — admin host exposes a LiteSpeed directory index and `/admin` is 404; API host timed out |
| TLS certificate validation | **PASS, limited** — valid chain/hostname coverage observed for the three domains |
| Browser functional testing | **BLOCKED** — integrated browser failed to load external storefront; Playwright has no safe isolated local preview at `127.0.0.1:3002` and explicitly refuses production targets |
| PostgreSQL integration testing | **SKIPPED** — dedicated marked loopback-only isolated-database test is opt-in and its required test identity was not configured |
| Android build/instrumentation | **BLOCKED** — Android source/build tree is absent from current HEAD |
| Production backup/restore/rollback | **BLOCKED** — no verified backup, restore drill, or rollback evidence |

## Credentials and recovery

No password, private key, session token, or database connection string is included in this report. Treat any cPanel password previously disclosed outside the provider's secure interface as exposed and rotate it through the hosting provider before deployment. The configured SSH key was used only for read-only inspection.

Before any production write: confirm the hosting plan can run the required Node.js service and route the three domains; identify the authoritative PostgreSQL database and uploads; create and verify recoverable backups; establish rollback; provision secrets directly through a secure server-side mechanism; then deploy a reviewed commit and verify the actual health endpoint and browser workflows.

**Conclusion:** The storefront and a readiness-capable backend are publicly serving on the apex host, but the deployed commit is unknown and the required admin/API host routes are not working. This is **not** a complete release and is **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**. Production must remain unchanged until the database/uploads, verified backups, rollback, runtime support, and reliable authenticated host access are established.
