# Shopademia Production Readiness Matrix

**Reassessed:** 2026-10-19 09:26 UTC
**Repository:** `feature/admin-v2`, commit `49ff88d96ef0661d68c91cc81c4d671b63e592aa`
**Intended remote:** `AbidHossainTushar003/LiveShopademia`, `feature/admin-v2`
**Overall verdict:** **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**

“PASS” is limited to the evidence and scope stated. A public HTTP 200 or successful source-level test does not establish a complete production deployment.

## Requirement-to-evidence matrix

| Area | Status | Evidence and limitation | Next safe action |
|---|---|---|---|
| Release source | PASS | Current local HEAD matches the intended GitHub branch. CI run `39227369801` succeeded for this commit. | Preserve the reviewed commit; do not infer release identity from a live response. |
| Storefront host | PASS (limited) | `https://shopademia.store/` serves the Shopademia shell; `/healthz` returned `{"status":"ok"}`; the public catalog API returned JSON. | Verify product/search/cart behavior in an isolated browser environment and identify the live SHA. |
| Admin host routing | FAIL | `https://admin.shopademia.store/` serves a LiteSpeed directory listing; `/admin` returns 404. Listing includes `cgi-bin` and `php.ini`; file contents were not opened. | Disable directory listing; inspect the web root and configure the intended authenticated admin route through the hosting provider. |
| API host routing | FAIL | `https://api.shopademia.store/` and `/healthz` timed out with no response. | Verify DNS/vhost/proxy and app target using authorized host diagnostics; do not change DNS as a workaround. |
| DNS | PASS (limited) | All three names resolved to `122.173.84.249` during reassessment. This does not prove correct virtual-host routing. | Confirm DNS ownership and hosting-provider mappings through an authorized account. |
| TLS | PASS (limited) | TLS handshakes succeeded with trusted Let's Encrypt chains and observed apex/wildcard hostname coverage. | Verify renewal and each host's application mapping after routing is corrected. |
| HTTP-to-HTTPS | PASS (limited) | A plain HTTP storefront request ended at the HTTPS apex. | Verify direct redirect status/headers after cutover. |
| Storefront/API code | PASS (source/unit scope) | Express routes, product/catalog repositories, server-priced order validation, and `GET /healthz` are present. Tests use fake pools for most API cases. | Validate real PostgreSQL behavior only against an explicitly isolated, marked test database. |
| Product shop isolation / SEO-001 | PASS (source/regression scope) | The server-rendered product route resolves `findProductForShop`; new test confirms another active shop cannot render the main-shop product's metadata. | Retain this regression test. |
| Admin authentication | BLOCKED (production) | Source includes login, token/session controls, MFA enforcement in production, and protected admin APIs; the public admin host does not reach that app. | Correct host routing, then test with an authorized synthetic staging identity. |
| Customer orders/payment | PASS (test/source scope only) | Unit/API tests cover server-side prices, validation, idempotency, and order flows. README states payment collection is manual; no bKash API integration exists. | Test only in isolated staging with synthetic data; do not place a live order. |
| PostgreSQL production state | BLOCKED | The authoritative production database, owner, schema, and existing records were not inventoried. A live storefront readiness response alone is not a backup or migration-safety check. | Use authorized, read-only provider access to identify database and schema before planning changes. |
| Backup and restore | BLOCKED | No verified database/upload backup, checksum record, or isolated restore drill is evidenced. | Create protected backups through supported provider tools and validate restoration into an isolated target. |
| Rollback | BLOCKED | No prior release mapping, tested rollback, or recovery time evidence is available. | Preserve the current release and document/test rollback before any cutover. |
| Hosting runtime | BLOCKED | cPanel lists Application Manager and Setup Node.js App tools, but page navigation failed. A prior trusted SSH read-only session found PostgreSQL tools but no Node/npm/Docker in normal `PATH`; subsequent SSH attempts timed out. | Through a working authenticated cPanel session, record supported Node versions, app state, process restart, environment, database connectivity, and domain mappings. |
| Local test suite | PASS | `npm test`: 169 tests, 168 passed, 0 failed, 1 skipped. | Provision the explicitly isolated PostgreSQL test database to remove the integration-test skip. |
| Dependency audit | PASS | `npm audit --audit-level=low`: 0 vulnerabilities reported. This is not a full source security review. | Continue normal lockfile and CI review. |
| Production configuration | BLOCKED | `.env.production` is absent; `npm run validate:production` refuses to proceed. No production secrets were generated or displayed. | Provision secrets directly in the authorized host's protected environment after runtime and backup checks. |
| Browser/E2E | BLOCKED | Integrated browser could not load the public storefront. No local read-only preview was listening on `127.0.0.1:3002`; Playwright's target guard forbids production hosts. | Provision a separate read-only local preview or isolated staging target, then run the existing storefront and privileged suites as appropriate. |
| Android admin | BLOCKED / absent | Current HEAD contains no Android source. Commit `790a1305f3fde30aafcd6f0c5347d11ba3272d5d` deleted the prior `phone app` Gradle/source/test tree. | Decide/authorize whether the previously removed app should be restored; do not silently rewrite existing user history. |
| Legal/business policies | NOT TESTED | Prior [AUDIT_REPORT.md](../AUDIT_REPORT.md) records unresolved shop-specific fulfillment/refund terms, privacy-retention operations, and owner/legal review. | Obtain owner-approved policies and qualified local legal review. |
| Security review | BLOCKED / PARTIAL | Dependency audit found 0 advisories and a high-confidence scan found no tracked credential-pattern matches. Public admin-host directory indexing is a **Medium-severity information-disclosure/configuration issue**; the listed `php.ini` was not opened. The prior audit's static-file realpath/open race finding was not re-investigated here. | Disable directory indexing and inspect the authorized webroot; perform a focused source review and a dedicated secret-history scan. |
| Upload persistence/performance | BLOCKED | No production upload directory was inventoried; responsive-image and real network performance evidence is absent from the prior audit. | Inventory persistent files read-only and measure in staging before any storage change. |
| Secrets in Git | PASS (limited) | Environment files are ignored except documented examples; no production environment file is tracked. This check does not establish that historical secrets were never committed. | Rotate any previously exposed hosting password through the provider; use a dedicated history scan if needed. |

## Tests and artifacts

| Command or check | Result |
|---|---|
| `node --test --test-name-pattern="product metadata is not exposed under another shop route" server/app.test.js` | PASS — 1 passed |
| `npm test` | PASS — 169 total; 168 passed, 1 skipped, 0 failed |
| Skipped test | `PostgreSQL checkout reads current product state and prevents concurrent oversell`; it is explicitly opt-in and requires a loopback-only isolated database with marked database/role identity. No test identity was configured. |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities |
| Lint/type-check | NOT APPLICABLE — no lint or type-check script is defined in `package.json`. |
| `npm run build:css` | PASS in the preceding assessment; the generated-only diff was restored. |
| `npm run validate:production` | BLOCKED — `.env.production` is intentionally absent. |
| Playwright | BLOCKED — no isolated local preview; production targets are explicitly refused by the repository guard. |
| Android Gradle build/tests | BLOCKED — Android project is absent from current HEAD. |
| GitHub Actions | PASS — workflow run [39227369801](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39227369801). |

## Live domain observations

During the 2026-10-19 reassessment:

- `shopademia.store`: storefront HTML, health JSON, and public catalog JSON responded over HTTPS.
- `admin.shopademia.store`: LiteSpeed directory index; `/admin` returned 404.
- `api.shopademia.store`: requests timed out.
- The integrated browser returned load failures for the storefront and admin; browser functional behavior therefore remains unverified.

These observations do not identify the deployed code SHA, validate admin authorization in production, or establish data recoverability.

## Release gate

**NO-GO.** The storefront's partial availability does not satisfy the three-host architecture. The admin host is incorrectly routed and directory indexing is enabled; the API host is unreachable. The production database/uploads, backups, restore, rollback, runtime, deployed SHA, and isolated browser workflow checks remain unverified. No production changes were attempted.

Required before a production change: restore reliable authorized host access; verify supported runtime and routing; inventory persistent data read-only; create and restore-test protected backups; document rollback; provision secrets on-host; verify isolated staging; then deploy a known, reviewed release and test all domains.
