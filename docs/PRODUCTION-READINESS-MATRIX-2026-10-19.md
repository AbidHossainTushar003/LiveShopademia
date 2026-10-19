# Shopademia Production Readiness Matrix

**Reassessed:** 2026-10-19 09:45 UTC (15:45 +06)
**Repository:** `feature/admin-v2`, commit `0786d690983d615bf1ef655909872229bd903f18`
**Intended remote:** `AbidHossainTushar003/LiveShopademia`, `feature/admin-v2`
**Overall verdict:** **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**

“PASS” is limited to the evidence and scope stated. A public HTTP 200 or successful source-level test does not establish a complete production deployment.

## Requirement-to-evidence matrix

| Area | Status | Evidence and limitation | Next safe action |
|---|---|---|---|
| Release source | PASS (source/CI only) | Local HEAD and intended GitHub branch both match `0786d690983d615bf1ef655909872229bd903f18`; CI run `39230764949` passed. CI is not deployment evidence. | Preserve the reviewed commit; determine the live SHA only through an authorized host check. |
| Storefront host | PASS (limited) | `https://shopademia.store/`, `/healthz`, and same-origin `/api/v1/products?limit=1` returned HTTP 200 over verified HTTPS. Live SHA and functional browser flows remain unknown. | Verify product/search/cart behavior in isolated staging and identify the live SHA. |
| Admin host routing | FAIL — HOST CONFIG | `admin.shopademia.store` resolves to the shared IP and returns HTTP 200 from `Server: LiteSpeed` with a 1593-byte directory index listing `cgi-bin` and `php.ini`; `/admin` is 404. Neither listed entry was opened. Express has a `/admin` route; the live result is consistent with a wrong vhost/document root or missing proxy, but server configuration is unavailable. | Provider must disable listing and inspect the webroot read-only, then map this host to the intended app. Do not delete files or edit production config from this workspace. |
| API host routing | FAIL — UPSTREAM/VHOST UNKNOWN | `api.shopademia.store` resolves to the same IP; TCP 443 and HTTPS negotiation succeeded and the HTTP request was sent, but no response arrived within 10 seconds. The apex-host health/catalog API works. | Provider must inspect host-specific vhost, proxy/upstream, process and logs. Do not change DNS as a workaround. |
| DNS | PASS (limited) | All three A records resolved to `122.173.84.249`; the apex AAAA and admin/API CNAME queries returned no answer. Same IP does not prove correct host routing or ownership. | Confirm destination ownership and active vhost mappings through provider support. |
| TLS | PASS (limited) | TLS verification succeeded for storefront and admin HTTP responses; API negotiated HTTPS before timing out. Certificate success does not establish app routing. | Verify renewal and each host's application mapping after routing is corrected. |
| HTTP-to-HTTPS | PASS (limited) | Prior probe showed the storefront HTTP request ending at HTTPS; no fresh redirect behavior was needed to diagnose the current host routing. | Verify direct redirect status/headers after cutover. |
| Storefront/API code | PASS (source/unit scope) | Express routes, product/catalog repositories, server-priced order validation, and `GET /healthz` are present. Tests use fake pools for most API cases. | Validate real PostgreSQL behavior only against an explicitly isolated, marked test database. |
| Product shop isolation / SEO-001 | PASS (source/regression scope) | The server-rendered product route resolves `findProductForShop`; new test confirms another active shop cannot render the main-shop product's metadata. | Retain this regression test. |
| Admin authentication | BLOCKED (production) | Source includes login, token/session controls, production MFA enforcement, HttpOnly/Secure/SameSite=Strict cookies and same-origin checks; the public admin host does not reach that app. | Correct host routing, then test with an authorized synthetic staging identity. |
| Customer orders/payment | PASS (test/source scope only) | Unit/API tests cover server-side prices, validation, idempotency, and order flows. README states payment collection is manual; no bKash API integration exists. | Test only in isolated staging with synthetic data; do not place a live order. |
| PostgreSQL production state | BLOCKED | The authoritative production database, owner, schema, and existing records were not inventoried. A live storefront readiness response alone is not a backup or migration-safety check. | Use authorized, read-only provider access to identify database and schema before planning changes. |
| Backup and restore | BLOCKED | Repository backup/restore scripts exist; no production backup pair, integrity record, or isolated restore drill is evidenced. Script presence is not recovery evidence. | Create protected backups through supported provider tools and validate restoration into an isolated target. |
| Rollback | BLOCKED | No prior release mapping, tested rollback, or recovery time evidence is available. | Preserve the current release and document/test rollback before any cutover. |
| Hosting runtime | BLOCKED / UNVERIFIED | The shared cPanel page shows menu links for Application Manager and Setup Node.js App but currently reports an HTTP 401 resource error; no runtime/version, app state, or domain mapping is visible. A prior trusted SSH read-only session found PostgreSQL tools but no Node/npm/Docker in ordinary `PATH`; later SSH timed out. Neither observation proves unsupported Node. | Ask the provider to confirm Node 20+, persistent process management, Docker/Compose, PostgreSQL connectivity, protected env support, backups, and per-host vhost/upstream details. |
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
| Focused admin/routing tests | PASS — 3 tests passed for admin page/headers, configured admin origin, and staging domain-to-Caddy wiring. |
| Tailwind production CSS build | PASS — built to a temporary file with `npm exec -- tailwindcss -i css/tailwind.input.css -o "$env:TEMP\shopademia-tailwind-generated.css" --minify`; output content matched the checked-in CSS after line-ending normalization. The temporary output was removed; the repository artifact was not modified. |
| Caddy route regression assertions | PASS — added checks for storefront admin-path denial, admin `/admin` forwarding/root redirect, and API `/healthz` and public API forwarding. The focused staging-config test passed. |
| `npm run validate:production` | BLOCKED — `.env.production` is intentionally absent. |
| Playwright | BLOCKED — no isolated local preview; production targets are explicitly refused by the repository guard. |
| Android Gradle build/tests | BLOCKED — Android project is absent from current HEAD. |
| GitHub Actions | PASS — run [39230764949](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39230764949) for commit `0786d690983d615bf1ef655909872229bd903f18`; CI is not a production deployment. |

The Caddy route regression assertions are uncommitted local changes and were not part of CI run `39230764949`; the complete local test suite above includes them.

## Live domain observations

During the 2026-10-19 09:37 UTC reassessment:

- `shopademia.store`: `/`, `/healthz`, and `/api/v1/products?limit=1` returned HTTP 200 over verified HTTPS.
- `admin.shopademia.store`: HTTP 200 from LiteSpeed directory index (1593 bytes); `/admin` returned 404. The listing names only `cgi-bin` and `php.ini`; their contents were not opened.
- `api.shopademia.store`: TCP/TLS succeeded and HTTP request was sent, but no response bytes arrived within 10 seconds on `/healthz` or `/`.
- All three names resolved to `122.173.84.249`; the apex AAAA and admin/API CNAME queries returned no answer. This does not identify the actual virtual host or upstream.
- The integrated browser returned load failures for the storefront and admin; browser functional behavior therefore remains unverified.

The repository's Express `/admin` route and Caddy host-routing contract are present and covered by tests/config validation. The observations indicate a production vhost/proxy mismatch, not a reproduced application-route failure. Exact document root, API upstream, running process, and provider policy remain unknown without authorized host diagnostics.

## Release gate

**PRODUCTION NO-GO — DEPLOYMENT BLOCKED.** The storefront is partially available, but the admin host exposes a LiteSpeed directory index and fails `/admin`; the API hostname accepts an HTTPS request but sends no response. No application code defect or safe code-level remediation was established. Production database/uploads, verified backups/restore, rollback, supported runtime, deployed SHA, and isolated browser workflows remain unverified. No production changes were attempted.

## Minimum provider action

Send the hosting provider an authenticated support request asking them to (1) confirm Node 20+ persistent-process, Docker/Compose, Caddy ports 80/443, PostgreSQL and persistent-volume support; (2) identify the active document root and vhost/proxy/upstream for each hostname; (3) disable admin directory listing and inspect the webroot read-only without deleting files; (4) inspect API-host upstream/process logs for the no-response timeout; and (5) confirm protected environment-variable and backup/restore capabilities. Require written approval before any DNS, routing, file, database, or service changes. If the plan cannot run the repository's existing Docker Compose architecture, request an authorized Linux VPS rather than replacing the app/database.

Required before a production change: obtain the provider response and authorized host access; inventory persistent data read-only; create protected backups and prove restoration into isolation; document rollback; provision secrets on-host; verify isolated staging; then deploy a known, reviewed release and test all domains.

## Authenticated cPanel evidence update — 2026-10-19

This update supersedes earlier claims that cPanel runtime status and domain roots were unavailable. It does not supersede the production NO-GO verdict.

| Area | Latest verified evidence | Status / remaining gate |
|---|---|---|
| GitHub release and CI | GitHub API confirms `AbidHossainTushar003/LiveShopademia:feature/admin-v2` is at `0786d690983d615bf1ef655909872229bd903f18`; Actions run `39230764949` succeeded for this SHA. The local `github` remote points elsewhere; local investigation edits are uncommitted/unpushed. | PASS for source/CI only; not deployment evidence. |
| cPanel domain roots | cPanel Domains lists `/home/shopadem/public_html`, `/home/shopadem/admin.shopademia.store`, and `/home/shopadem/api.shopademia.store`, with HTTPS forced on each. | Verified roots; effective LiteSpeed/Nginx vhost and upstream settings remain unavailable. |
| Admin host and listing | Public response has `Server: LiteSpeed`; root returns a directory index, `/admin` returns 404. cPanel maps this host to its independent directory; visible entries are `cgi-bin` (0755) and `php.ini` (374 bytes, 0644). Contents and hidden entries were not inspected. cPanel Indexes is `Inherit`; `HEAD` to those paths returned 403. | FAIL — host/application mapping. No sensitive content exposure confirmed. cPanel offers **No Indexing**, but it was not applied. |
| API host and routing | API host has its own cPanel document root. Public `/healthz` received zero response bytes in a 10-second probe; authenticated browser showed HTTP 500 “Request Timeout.” No effective vhost/upstream or error log was available. | FAIL — exact timeout cause unknown. Provider must inspect host routing and logs. |
| Passenger / Node runtime | cPanel Setup Node.js App reports a single production Passenger app at URI `shopademia.store/`, root `/home/shopadem/shopademia-app`, Node `v20.20.2`, startup `server/index.js`, status `started`. | PARTIAL PASS — Node 20 app manager and apex app are verified; admin/API host mapping, live SHA, and database-connected health are not. |
| Runtime environment | cPanel showed environment-variable names only; values were not read. `DATABASE_URL` and `DATABASE_SSL` appear in the displayed list; source-required `ADMIN_SITE_URL` did not. | BLOCKED — host must verify effective configuration securely; no secret values should be placed in reports. |
| PostgreSQL | cPanel lists `shopadem_shopapp` (8.54 MB) and `shopadem_shopuser`. | PARTIAL inventory only — running app's connection target, schema, records, and authoritative production identity are unverified. |
| Backups and recovery | cPanel states there are no automatically generated backups; partial home-directory and database backup downloads dated Oct. 8 are offered. No backup was downloaded or restored; JetBackup provided no usable evidence. | BLOCKED — coverage, integrity, isolated restoration, uploads, and rollback remain unverified. |
| Logs / web-server configuration | cPanel Errors page navigation timed out; no application/error logs or effective vhost configuration were obtained. Public storefront/admin identify LiteSpeed; this does not rule out a proxy layer. | BLOCKED — provider support required to explain API timeout and provide supported host mapping. |
| Hosting architecture | Passenger/Node 20 is present for one app; PostgreSQL management UI is present. | PARTIAL — Docker/Compose/Caddy support and required persistent storage/backup capabilities remain unverified; no production deployment target is approved. |

Public outcomes remain separate: the storefront root, health check, and same-origin catalog API returned HTTP 200; admin root listed directory entries and `/admin` returned 404; API hostname did not return a response within the bounded probe. No code-level application defect explaining those host-specific results has been demonstrated, and no production changes were made. `PRODUCTION NO-GO — DEPLOYMENT BLOCKED` remains the only release verdict.

Latest local verification: `npm test` — 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; `npm audit --audit-level=low` — 0 vulnerabilities; `npm run build:css` — PASS. An independent build to a temporary path was byte-for-byte identical to the generated stylesheet. Against baseline HEAD, generation removes only the unused `.isolate{isolation:isolate}` utility; no source uses the `.isolate` class, and the separate `isolation:isolate` CSS declaration remains. This generated artifact change is included in the candidate. `git diff --check` — PASS. These results do not establish live deployment or production recovery readiness.

## Fresh baseline recheck — 2026-10-19 16:19 +06

| Requirement | Status | Fresh evidence / limitation |
|---|---|---|
| Intended GitHub branch baseline | PASS (baseline only) | `git ls-remote` and GitHub branch listing both report `feature/admin-v2` at `0786d690983d615bf1ef655909872229bd903f18`. CI run `39230764949` succeeded for that SHA, not the subsequent local changes. |
| Storefront | PASS (limited) | Fresh HTTPS `/`: 200, HTML, 34,371 bytes, 0.435 s; `/healthz`: 200 JSON, 15 bytes, 0.264 s; `/api/v1/products?limit=1`: 200 JSON, 3,770 bytes, 0.260 s. `Server: LiteSpeed`; TLS verification succeeded. No browser customer-flow test. |
| Admin | FAIL | Fresh HTTPS `/`: 200 LiteSpeed HTML directory index, 1,593 bytes, 0.357 s. `/admin`: 404 HTML, 1,251 bytes, 0.239 s. cPanel's admin root remains separate from Passenger; Indexes remains `Inherit`; no production setting was changed. |
| API | FAIL | Fresh HTTPS `/healthz`: HTTP `000`, curl exit 28 after 10.013 s, zero response bytes and no content type. TLS/HTTP connection was made before timeout; effective upstream cause remains unknown. |
| DNS | PASS (limited) | All three A lookups returned `122.173.84.249`; this does not identify routing or origin ownership. |
| cPanel containment capability | PASS (control observed; not applied) | Indexes `No Indexing` states no files appear if no default file exists; current selection is `Inherit`. It does not route requests to Express. No setting was saved. |
| Recovery/deployment gates | BLOCKED | Running app's database identity, schema/data and upload inventory; complete backup integrity; isolated restoration; rollback; isolated staging; effective vhosts/logs; and production authorization remain unverified. |

Probes were certificate-validating HTTPS GETs with a 10-second maximum and redirect-following enabled; redirect counts were not captured. No live deployment, application restart, production file/database/upload/DNS mutation, commit, or push is established by this check. The two unrelated untracked files remain untouched. Verdict remains **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**.

Current local suite and artifact checks: `npm test` — 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; `npm audit --audit-level=low` — 0 vulnerabilities; production CSS build plus independent comparison — PASS; `git diff --check` — PASS.

## Published source and CI — 2026-10-19 16:25 +06

| Area | Status | Evidence |
|---|---|---|
| Candidate source | PASS (source only) | Commit `1ec245ca10a9d4c552b7718ad1ea6c7739ae108c` was pushed to `AbidHossainTushar003/LiveShopademia:feature/admin-v2`; GitHub branch SHA and `git ls-remote` match. |
| CI for candidate | PASS (CI only) | GitHub Actions run [39237231146](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39237231146) completed successfully for the exact commit above. No live deployment is implied. |
| Production | BLOCKED | Admin/API routing and production recovery/authorization gates remain unresolved; no production change was made. |

## Latest audit refresh — 2026-10-19 16:41 +06

| Area | Status | Latest evidence and limitation |
|---|---|---|
| Intended GitHub source and CI | PASS (source/CI only) | The audit snapshot `affc95fbe515a5d2ed86a16bcd651f1d67b3f127` is pushed to `feature/admin-v2`; CI run [39239950754](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39239950754) succeeded for this exact SHA. This is not deployment evidence. Local tracking points to a different repository; the intended GitHub ref was checked independently. |
| Storefront hostname | PASS (limited) | HTTPS `/` returned 200 HTML (34,371 bytes, 0.338 s); same-origin `/api/v1/products?limit=1` returned 200 JSON (3,770 bytes, 0.257 s). Both identified LiteSpeed; TLS verified. Full browser customer journeys and live release SHA are unknown. |
| Admin hostname | FAIL — host mapping/indexing | HTTPS `/` returned 200 HTML (1,593 bytes, 0.261 s); `/admin` returned 404 HTML (1,251 bytes, 0.262 s). cPanel maps the hostname to a separate document root and Indexes remains Inherit. The public index and missing Express route remain a confirmed operational failure; no sensitive file contents were examined. |
| API hostname | FAIL — exact cause unknown | HTTPS `/healthz` timed out after 10.007 s, HTTP `000`, zero bytes. cPanel logs show Passenger context markers for the API hostname but no error/timeout marker in the visible snapshot. Effective proxy/upstream/request handling remains unverified. |
| DNS/TLS | PASS (limited) | All three A records resolve to `122.173.84.249`; curl certificate validation succeeded. This does not identify the effective vhost or upstream. |
| Responding web server | PARTIAL | Public responses identify LiteSpeed. Effective virtual-host configuration is unavailable; an upstream Nginx layer is neither confirmed nor ruled out. |
| cPanel runtime | PARTIAL | Node.js `v20.20.2`, Passenger, startup `server/index.js`, application root `/home/shopadem/shopademia-app`, and `started` status are reported for the storefront URI. The live deployed SHA and actual request mapping remain unknown. |
| cPanel logs | PARTIAL / non-diagnostic | Visible Errors-page snapshot showed Passenger INFO/restart-marker entries for storefront/admin/API host contexts and no error-level/timeout strings. It does not establish request routing, process health for each hostname, or explain the API timeout. |
| PostgreSQL and recovery | BLOCKED | cPanel lists `shopadem_shopapp` (8.54 MB); the app's actual connection target remains unknown. No automatic backups are reported; partial Oct. 8 downloads were not restored. Backup integrity, uploads, isolated restore, rollback, and staging are unverified. |
| Source security review | PASS (bounded) | Focused source review found no vulnerabilities at `61eff3c`; live secrets, DB grants, deployed proxy configuration, and runtime behavior were not reviewed. Dependency audit separately reports 0 vulnerabilities. |
| Test/build | PASS (local scope) | `npm test`: 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped. CSS build passed and the generated artifact was synchronized with the command output. No real PostgreSQL integration, full browser flow, or production smoke test. |
| Other audit scope | OPEN | No Android project/manifest is present in this revision. Full browser customer/admin journeys, PostgreSQL restore/concurrency checks, and owner-approved privacy/fulfillment/refund decisions remain outstanding; see `AUDIT_REPORT.md`. |

### Prioritized release issues

1. **P1 HOST-001 — Admin listing and `/admin` 404:** suppress indexing using the supported cPanel control, then map the hostname to the existing Express app. Do not delete files.
2. **P1 HOST-002 — API hostname timeout:** provider must inspect effective LiteSpeed/Passenger/proxy configuration and request-timeout logs; map the allowlisted API paths and health route to the existing Express process.
3. **P1 OPS-001 — Recovery not proven:** identify the live PostgreSQL target privately; back up database and uploads; prove isolated restore and application/data rollback.
4. **P1 DEP-001 — Deployment target/live revision unknown:** verify deployed commit, effective environment, staging, persistent storage, and authorized rollback path.
5. **P2 AUD-001 — Product acceptance gaps:** complete isolated database and browser tests, recover owner-approved requirements/policies, and do not imply Android support for this source tree.

**Verdict remains `PRODUCTION NO-GO — DEPLOYMENT BLOCKED`.** No production configuration or data was changed.

## Production-release continuation — 2026-10-19 16:57 +06

This refresh rechecks the current published candidate and public service outcomes. HTTP reachability is not end-to-end product acceptance.

| Requirement | Status | Current evidence / limitation |
|---|---|---|
| GitHub branch, push, and CI | FIXED AND VERIFIED | Local HEAD, GitHub branch, and `git ls-remote` match `c50408de67163f5b727dc45639d3ad630b64c396`. CI run [39240110333](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39240110333) passed for this SHA. No production deployment is implied. |
| Storefront host | OPEN | HTTPS root 200 HTML (34,371 bytes, 0.381 s); `/healthz` 200 JSON `{"status":"ok"}`; same-origin catalog 200 JSON. No current browser customer journey, release identity, or database persistence verification. |
| Admin host | BLOCKED — PROVIDER | Root remains a 1,593-byte LiteSpeed index; `/admin` remains 404. Separate cPanel document root is confirmed; the previously observed setting is Indexes Inherit. No production setting was changed. |
| API host | BLOCKED — PROVIDER | `/healthz` still times out after 10.013 s with no response bytes; browser shows provider HTTP 500 Request Timeout. cPanel log snapshot is informational only and not request-correlated. |
| PostgreSQL identity and grants | BLOCKED — PROVIDER | cPanel lists a database/user, but effective app URL, target, schema, and permissions remain unverified. |
| Backup, restore, uploads, rollback | BLOCKED — RECOVERY | No verified full backup, isolated restore, uploads recovery check, or rollback rehearsal. |
| Staging/E2E/real PostgreSQL integration | BLOCKED — PROVIDER | Required `.env.staging` and `.env.production` are absent; config validators fail closed. E2E listing is blocked by missing `PLAYWRIGHT_BASE_URL`; production is disallowed by the target guard. The opt-in PostgreSQL integration test remains skipped. |
| Local unit/API suite | FIXED AND VERIFIED | `npm test`: 169 total, 168 passed, 0 failed, 1 skipped. Scope is automated local tests; no live or end-to-end acceptance. |
| CSS output | FIXED AND VERIFIED | `npm run build:css` output matches the checked-in artifact exactly. |
| Dependency audit | FIXED AND VERIFIED | `npm audit --audit-level=low`: zero advisories. |
| Source security / secret checks | OPEN | Source review at `61eff3c` reported no vulnerabilities in scope; no dedicated scanner or history scan. The local pattern scan found two test-only URL-credential validation fixtures, not emitted as secret values. Production configuration and database grants remain outside scope. |
| Android/client scope | OPEN | No Android Gradle project or manifest in current HEAD; reconcile with release scope before claiming cross-client acceptance. |
| Legal/business, monitoring, operations | OPEN | Earlier owner/legal decisions and monitoring requirements remain unresolved; no staging or live observability acceptance. |

Production remains NO-GO. Provider route diagnosis and recovery proof are release gates, not code-test gaps that can be waived by CI.

## Post-containment verification — 2026-10-19 17:09 +06

| Requirement | Status | Current evidence / remaining action |
|---|---|---|
| Admin directory-index containment | FIXED AND VERIFIED (containment only) | For the confirmed cPanel root `/home/shopadem/admin.shopademia.store`, prior setting was **Inherit**; cPanel saved **No Indexing** and confirmed directory indexing disabled. Reopened control shows No Indexing selected. Rollback is to select Inherit for this same root. Public `/` now returns LiteSpeed HTTP 403 (1,242 bytes); no directory-index marker was present. |
| Admin application and protected routes | BLOCKED — PROVIDER | Public `/admin` still returns LiteSpeed HTTP 404; the containment setting does not map the domain to Express. Provider-supported routing to the existing app and authenticated protected-route verification remain required. |
| Storefront host and same-origin API | OPEN | Fresh HTTPS probes: root 200 HTML (34,371 bytes); `/healthz` 200 JSON (15 bytes); `/api/v1/products` 200 JSON (3,770 bytes). No browser customer journey, deployed SHA, or persistence acceptance. |
| Dedicated API hostname | BLOCKED — PROVIDER | Fresh `/healthz` probe timed out at 10.008 s with HTTP `000` and zero bytes. Effective LiteSpeed/Passenger/upstream mapping and correlated logs are required. |
| PostgreSQL, backup/restore, rollback, staging | BLOCKED — RECOVERY / PROVIDER | Production connection identity, complete database/upload backup, successful isolated restore, rollback rehearsal, and isolated staging remain unverified. |
| Git and CI evidence at probe time | PASS (source/CI only) | At the time of the public/cPanel recheck, local `feature/admin-v2` was at `7c7895ac635f93882e8c46e67e737b0d953f35c4`; GitHub Actions run [39241513265](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39241513265) passed for that SHA. The configured local `github` remote points elsewhere and `git ls-remote` returned repository-not-found; this does not invalidate the repository Actions record or prove deployment. |

No application code, production files, DNS, process, database, uploads, orders, inventory, or customer records were changed. The cPanel setting is a narrowly scoped, reversible listing containment only. **PRODUCTION NO-GO — DEPLOYMENT BLOCKED** remains the verdict.

## Recovery and routing recheck — 2026-10-19 17:17–17:22 +06

| Gate | Status | New evidence / next action |
|---|---|---|
| Admin directory indexing | PASS — containment | cPanel still showed No Indexing for `/home/shopadem/admin.shopademia.store`; public root returned LiteSpeed 403, 1,242 bytes, with no directory-index marker. This is not admin availability. |
| Admin app route | FAIL — provider mapping | Public `/admin` returned LiteSpeed 404. Source registers Express `/admin` and `/admin/` redirect; effective virtual host/proxy mapping remains unavailable. |
| Storefront | PASS — reachability only | Root, `/healthz`, and same-origin `/api/v1/products?limit=1` returned HTTPS 200. |
| Dedicated API | FAIL — provider diagnosis | `/healthz` timed out at 10.014 seconds with HTTP `000`, zero bytes. All three A records resolve to `122.173.84.249`; this does not establish correct virtual hosts. |
| PostgreSQL identity | BLOCKED — ACCESS | cPanel lists `shopadem_shopapp` (8.54 MB) and `shopadem_shopuser`; no live application connection target or grants were verified. |
| Database backup and restore | BLOCKED — SAFETY | cPanel Backup has no automatic backups; its partial SQL download is `shopadem_shop.sql.gz`, not the listed PostgreSQL DB name. JetBackup Restore & Download → Full Backups lists four records, but its Databases category shows No Backups Found. No download/integrity/isolated-restore test was performed. |
| Upload inventory/recovery | PARTIAL / BLOCKED | File Manager metadata only confirms app-root `/uploads` with two image files (~252.77 KB total); contents were not opened. JetBackup Home Directory category shows No Backups Found; backup coverage and restored references remain unverified. |
| Rollback and staging | BLOCKED — SAFETY / ACCESS | No current release rollback rehearsal or isolated environment. `.env.staging`, `.env.production`, `TEST_DATABASE_URL`, and `PLAYWRIGHT_BASE_URL` are absent; validators and E2E listing fail closed. |
| Local tests/security/build | PASS — local scope | 169 tests: 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; npm audit zero vulnerabilities; CSS build passed without tracked output change; `git diff --check` passed. |
| Git and exact-SHA CI at evidence collection | PASS — source/CI only | Branch `feature/admin-v2` at `bfb7277de0de1fe4f7a772fdcdfd00799e935fd7`; intended GitHub branch matches; Actions run [39243091143](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39243091143) succeeded. This is not deployment evidence. |

**Next action:** provider to supply effective LiteSpeed/Passenger routing and request-correlated logs for the probe window, map both hostnames to the existing Express app through a supported change, and establish consistent protected PostgreSQL/upload backup plus isolated restore/rollback. No production mutation or deployment is approved by this verification. **PRODUCTION NO-GO — DEPLOYMENT BLOCKED.**
