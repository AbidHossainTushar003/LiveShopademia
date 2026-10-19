# Production Deployment Report

**Latest reassessment:** 2026-10-19 09:45 UTC (15:45 +06)
**Status:** **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**

## Release and repository

- **Branch:** `feature/admin-v2`
- **Current commit:** `0786d690983d615bf1ef655909872229bd903f18`
- **Application commit:** `790a1305f3fde30aafcd6f0c5347d11ba3272d5d`
- **GitHub target:** `AbidHossainTushar003/LiveShopademia`, branch `feature/admin-v2`
- Local HEAD and the intended GitHub branch both resolve to `0786d690983d615bf1ef655909872229bd903f18`. CI passed for that commit in run [39230764949](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39230764949). CI validates tests, CSS generation, dependency advisories, Compose syntax, Caddy syntax, and image build; it does not deploy or verify production routing.
- The configured `github` remote points to a different repository that now returns “Repository not found”; the configured branch tracking comparison is not the intended GitHub target. Do not infer divergence against it.
- Two unrelated untracked entries remain untouched. No production assets, runtime configuration, database, uploads, or DNS were changed by this investigation.

## Architecture and hosting findings

- The repository's production architecture is Node.js/Express with PostgreSQL, normally deployed as a Docker Compose stack behind Caddy. Its README says the former cPanel deployment workflow is retired.
- **DNS and route probes (2026-10-19 09:37 UTC):** `shopademia.store`, `admin.shopademia.store`, and `api.shopademia.store` each resolve to `122.173.84.249`; the apex AAAA and admin/API CNAME queries returned no answer. This confirms a common IPv4 address, not the destination's ownership or virtual-host mappings.
  - `https://shopademia.store/` returned HTTP 200; `/healthz` returned HTTP 200 and the public same-origin `/api/v1/products?limit=1` returned HTTP 200. The application is responding on this host, but its deployed commit remains unknown.
  - `https://admin.shopademia.store/` returned HTTP 200 with `Server: LiteSpeed`, `Content-Length: 1593`, and a directory index listing `cgi-bin` and `php.ini`. `/admin` returned HTTP 404. Neither listed entry was opened. The result is inconsistent with the repository's intended Caddy-to-Express admin route and strongly indicates a web-server/vhost/document-root mismatch; the actual document root and virtual-host configuration are not accessible, so the precise configuration defect is unconfirmed.
  - `https://api.shopademia.store/healthz` resolved to the same IP, accepted a TCP connection on port 443, negotiated HTTPS/HTTP/1.1, and received the HTTP request, but returned no response bytes within 10 seconds. `/` showed the same timeout behavior in the bounded probe. This is not a DNS resolution or TCP-connect failure. Because the storefront host's health and catalog API respond, the API host failure is isolated to host-specific routing/upstream behavior; missing vhost/proxy configuration, a stalled upstream, or provider filtering remain possible and cannot be distinguished without authorized server logs/configuration.
- HTTPS certificate verification succeeded for the responding storefront and admin requests; the API accepted an HTTPS connection before timing out. This does not prove correct application routing.
- The shared cPanel page currently reports an HTTP 401 resource error. Its visible Tools menu included “Application Manager” and “Setup Node.js App”; this establishes that those menu links exist, not that this account can create a supported persistent Node.js service. Runtime versions, app/process state, reverse-proxy/vhost settings, Docker availability, PostgreSQL connectivity, and domain mappings remain unverified.
- A previous connection using the configured SSH identity and a previously trusted host key established a read-only session and found PostgreSQL client, dump, and restore tools. Node, npm, and Docker were not in that account's normal `PATH`. SSH later timed out; no further host access was attempted during this reassessment.
- The local workspace has no `.env.production`. Production configuration validation therefore failed as expected; no production secrets were requested, generated, or displayed.

## Application routing diagnosis

- The expected admin route is `/admin`, confirmed in `server/app.js`; it serves the login dashboard from `admin.html`. `/admin/platform` is also an explicit route. Existing API tests exercise these pages and their security headers. Express static mounts use `index: false`, so the application does not intentionally expose a web-root directory listing.
- In `Caddyfile`, the storefront hostname denies admin routes; the admin hostname redirects `/` to the storefront and proxies `/admin`, admin assets, and admin API paths to `app:3000`; the API hostname proxies its allowlisted public API paths and `/healthz` to the same Express service. The storefront client uses relative `/api/v1` URLs, so it does not depend on the separate API hostname for normal browsing. Admin requests are same-origin with `HttpOnly`, `Secure`, `SameSite=Strict` cookies and configured-origin checks. The explicit cross-shop product feed is the only documented public API route that allows cross-origin reads.
- The public `/admin` 404 and LiteSpeed listing are not reproduced by the repository's Express route: public traffic is not reaching the intended route as configured. The API subdomain likewise fails before a response while the apex-host API works. No app code or DNS/vhost configuration change is justified by the available evidence.

## Hosting decision and minimum provider request

The shipped production topology requires a Linux host capable of running Docker Engine and Compose, persistent PostgreSQL and upload volumes, and Caddy on public ports 80/443 with three hostname routes. cPanel's Node.js menu alone does not establish support for this topology. Do not use an unverified cPanel app or substitute a second backend/database.

Send the hosting provider this request through its authenticated support channel:

> Please confirm whether this hosting plan can run our existing production architecture: a continuously running Node.js 20+ Express service, Docker Engine/Compose with Caddy listening on ports 80/443, and PostgreSQL with persistent database and uploaded-image storage. The domains `shopademia.store`, `admin.shopademia.store`, and `api.shopademia.store` currently resolve to `122.173.84.249`. The admin hostname returns a LiteSpeed directory index at `/` and 404 at `/admin`; the API hostname completes TLS and accepts HTTP requests but sends no response, while the storefront hostname and same-origin API respond. Please identify the active document root and vhost/proxy/upstream mapping for each hostname, explain how to disable directory indexing without deleting files, and confirm the supported Node version, persistent-process manager, Docker/Compose availability, PostgreSQL connectivity, protected environment-variable support, and backup/restore facilities. Do not change DNS, files, databases, or routing without our written approval.

Request prompt containment of the admin directory index: disable directory listing and inspect the document root read-only for unintended or sensitive files, preserving evidence/logs. The only observed names are `cgi-bin` and `php.ini`; no file contents or secret exposure has been confirmed. If the provider confirms the plan cannot support the required runtime, request an authorized Linux VPS with Docker/Compose, persistent storage, backups, and routing controls instead.

## Recovery and authorization status

- Production database owner/schema/records and persistent uploads remain unidentified. The repository contains encrypted database/upload backup and isolated restore scripts, but their presence is not evidence of a production backup or successful restore; neither was executed or verified on production.
- No protected backup pair, integrity/checksum record, isolated restore drill, rollback rehearsal, staging target, production environment, or authorized deployment target has been verified.
- Do not deploy, change DNS/vhosts, restart services, migrate data, or modify files until provider capability/access, data inventory, verified backups/restore, rollback, secrets, and isolated staging gates are satisfied.

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
| Local `npm test` | **PASS** — 169 tests; 168 passed, 1 skipped, 0 failed |
| Cross-shop metadata regression test | **PASS** — one targeted test confirms an active shop cannot render another shop's product metadata |
| Caddy host-route regression assertions | **PASS** — the staging-config test now asserts storefront admin-path denial, admin-root redirect and `/admin` forwarding, and API health/public-path forwarding |
| Tailwind CSS build | **PASS** — local CLI build to a temporary output matched checked-in CSS after line-ending normalization; temporary output removed. CI also built CSS for the commit. |
| `npm audit --audit-level=low` | **PASS** — 0 dependency vulnerabilities reported |
| `npm run validate:production` | **BLOCKED** — `.env.production` is absent; this is the expected safe failure until secrets are provisioned on the host |
| `npm run validate:staging` | **BLOCKED** — `.env.staging` is absent; no staging secrets or placeholders were created |
| GitHub Actions CI | **PASS** — run `39230764949` succeeded for current commit `0786d690983d615bf1ef655909872229bd903f18` |
| Storefront public HTTP/API | **PASS, limited** — storefront shell, readiness JSON, and catalog JSON responded on the apex host |
| Admin host routing | **FAIL** — LiteSpeed serves a directory index; `/admin` is 404. The Express route exists in source; production vhost/root configuration is unavailable |
| API host routing | **FAIL / ROOT CAUSE UNCONFIRMED** — same-IP DNS and HTTPS connection succeed, but the API hostname returns no HTTP response; the apex-host API works |
| TLS certificate validation | **PASS, limited** — valid chain/hostname coverage observed for the three domains |
| Browser functional testing | **BLOCKED** — integrated browser failed to load external storefront; Playwright has no safe isolated local preview at `127.0.0.1:3002` and explicitly refuses production targets |
| PostgreSQL integration testing | **SKIPPED** — dedicated marked loopback-only isolated-database test is opt-in and its required test identity was not configured |
| Android build/instrumentation | **BLOCKED** — Android source/build tree is absent from current HEAD |
| Production backup/restore/rollback | **BLOCKED** — scripts exist, but no verified production backup, isolated restore drill, or rollback evidence |

## Credentials and recovery

No password, private key, session token, or database connection string is included in this report. Treat any cPanel password previously disclosed outside the provider's secure interface as exposed and rotate it through the hosting provider before deployment. The configured SSH key was used only for read-only inspection.

Before any production write: confirm the hosting plan can run the required Node.js service and route the three domains; identify the authoritative PostgreSQL database and uploads; create and verify recoverable backups; establish rollback; provision secrets directly through a secure server-side mechanism; then deploy a reviewed commit and verify the actual health endpoint and browser workflows.

**Conclusion:** The storefront and same-origin API respond on the apex host, but the admin and API host routing are broken. The observed admin result points to a LiteSpeed vhost/document-root mismatch; the exact host configuration and API upstream failure remain unknown pending provider diagnostics. This is **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**. No application code defect was confirmed, no production fix was made, and production must remain unchanged until hosting support, data/recovery evidence, rollback, staging, and authorized host access are established.

The new Caddy route assertions in `scripts/staging-config.test.js` are local and uncommitted; CI run `39230764949` predates that test edit. The full local suite was rerun with the added assertions and passed.

## Authenticated cPanel and refreshed GitHub evidence — 2026-10-19

This read-only follow-up supersedes the earlier cPanel-access and hosting-runtime statements above. cPanel page labels and status are account-visible evidence; no production setting, file, process, database, upload, or DNS record was changed.

- **Git and CI:** local branch `feature/admin-v2` remains at `0786d690983d615bf1ef655909872229bd903f18`. GitHub API confirms `AbidHossainTushar003/LiveShopademia:feature/admin-v2` points to this same SHA, and workflow run `39230764949` completed successfully for it. This still does not indicate a deployment. The configured local `github` remote points to a different repository, and `origin` is the cPanel SSH deployment target; the two unrelated untracked entries were preserved. Four tracked files are locally modified (three reports and the Caddy regression test); these changes have not been committed or pushed.
- **Domains and web server:** cPanel Domains shows roots `/home/shopadem/public_html`, `/home/shopadem/admin.shopademia.store`, and `/home/shopadem/api.shopademia.store`; HTTPS is forced for each. Public storefront and admin responses identify `Server: LiteSpeed`. This confirms LiteSpeed handled those responses; it does not rule out an upstream Nginx layer or reveal effective virtual-host/proxy configuration.
- **Admin root cause:** cPanel maps the admin hostname to its own separate static directory, not to the Express app. File Manager showed visible entries `cgi-bin` (directory, 0755) and `php.ini` (374 bytes, 0644); neither file was opened, and hidden entries were not inspected. cPanel Indexes reports **Inherit** for this directory. Its supported **No Indexing** choice would suppress directory contents when there is no default index, but it was not saved because that would change production configuration and the recovery gates are unmet. Bounded `HEAD` requests to `/php.ini` and `/cgi-bin/` returned HTTP 403; no sensitive file contents or secret exposure were confirmed. The public root index and `/admin` 404 remain a real routing/configuration failure. The repository's Express route is `/admin`; the repository's Caddy configuration makes the admin-host root redirect to the storefront and forwards `/admin` to Express.
- **API root cause:** cPanel maps the API hostname to a separate static root; the only visible Passenger app is attached to `shopademia.store/`, not the API hostname. The API `/healthz` public probe received no response bytes within its 10-second bound; the authenticated browser showed the hosting server's HTTP 500 “Request Timeout” page. This narrows the fault to host-specific routing/upstream/provider behavior, but the exact timeout cause is unconfirmed because effective virtual-host/proxy configuration and logs were unavailable. The cPanel Errors page navigation timed out; no logs were obtained. Do not infer that the API is correctly mapped merely because the app is started.
- **Express runtime:** cPanel Setup Node.js App reports one Passenger application: URI `shopademia.store/`, application root `/home/shopadem/shopademia-app`, production mode, Node.js `v20.20.2`, startup file `server/index.js`, status `started`. This verifies that cPanel reports a Node 20 Passenger app started for the apex host. It does not verify the live deployed SHA, API/admin hostname mapping, successful database connection, or request health on those hosts. The app-root File Manager timestamps for key project entries were Oct. 10–12, earlier than the Oct. 19 source commit; timestamps do not identify the deployed code or prove a mismatch. The cPanel environment list showed names only; `DATABASE_URL`, `DATABASE_SSL`, and other application names were visible, but no values were read. `ADMIN_SITE_URL`, which the source expects in production, was not present in the displayed list; the provider must verify the effective runtime environment rather than assume it is configured.
- **Database and recovery:** cPanel PostgreSQL lists database `shopadem_shopapp` (8.54 MB) and user `shopadem_shopuser`. The `DATABASE_URL` value was not inspected, so this does not prove which database the running app uses or establish production inventory/schema/records. cPanel Backup reported no automatically generated backups; it offered partial home-directory and database downloads dated Oct. 8, including `shopadem_shop.sql.gz`. Nothing was downloaded or restored. Backup coverage, integrity, production consistency, isolated restore, and rollback therefore remain unverified. JetBackup did not provide usable evidence. No upload inventory or staging target was established.
- **Storefront outcome:** the earlier public probes remain the evidence: storefront `/`, `/healthz`, and same-origin catalog API returned HTTP 200 over HTTPS. cPanel now reports the apex Passenger app started, but the live application SHA, PostgreSQL target, and customer flows remain unverified. Its relative `/api/v1` base means ordinary storefront API traffic does not rely on `api.shopademia.store`.
- **Supported containment action:** cPanel Indexes visibly supports setting `admin.shopademia.store` to **No Indexing**. It was not applied. Once the recovery/authorization gate is met, use cPanel Indexes → the admin directory → Edit → No Indexing → Save; this only addresses listing and does not fix the admin route. Ask the host to map `/admin` and the API allowlist/`/healthz` to the existing Passenger Express application, or provide the supported same-app proxy mapping, and to inspect the effective vhosts and timeout logs. Do not delete the listed files, create a second backend, or change DNS as a guess.
- **Fresh local validation:** `npm test` passed (169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped); `npm audit --audit-level=low` reported 0 vulnerabilities. `npm run build:css` succeeded, and a separate build to a temporary path was byte-for-byte identical to the generated stylesheet. Compared with baseline HEAD, the generated CSS changes only by removing the unused `.isolate{isolation:isolate}` Tailwind utility; no source uses the `.isolate` class (the separate CSS declaration `isolation:isolate` remains in `css/styles.css`). This generated asset change is included in the current candidate. `git diff --check` passed. These local checks do not verify hosting or production.

**Current release decision remains PRODUCTION NO-GO — DEPLOYMENT BLOCKED.** The next safe action is for the hosting provider to confirm the supported routing, effective vhosts and API timeout cause, the application’s actual PostgreSQL target, protected backups and isolated restore/rollback capability, and the missing production environment configuration. No production change is authorized by this investigation.

## Fresh baseline recheck — 2026-10-19 16:19 +06

This section records a new bounded read-only check after the preceding cPanel investigation; values below were observed at 16:19 local time and supersede earlier public HTTP observations where they differ.

- **Git/remote/CI:** working repository is the storefront root, branch `feature/admin-v2`, HEAD `0786d690983d615bf1ef655909872229bd903f18`. `git ls-remote` confirms GitHub `AbidHossainTushar003/LiveShopademia:feature/admin-v2` still points to that SHA. CI run `39230764949` is successful for that same baseline SHA; it does not include the current local regression assertions, regenerated CSS, or report edits. Configured `github` points to a different repository; `origin` points to the cPanel SSH deployment location. Five tracked files are modified locally, with no staged changes; two unrelated untracked entries remain untouched. No deployment or push is evidenced.
- **DNS:** each hostname's A query returned `122.173.84.249`.
- **Fresh HTTPS probes:** `curl.exe` used certificate verification and a 10-second maximum; redirects were followed, but redirect counts were not captured. Final effective URLs remained the requested HTTPS URLs.
  - Storefront `/`: HTTP 200, `text/html; charset=utf-8`, 34,371 response bytes, 0.435 s, `Server: LiteSpeed`.
  - Storefront `/healthz`: HTTP 200, `application/json; charset=utf-8`, 15 bytes, 0.264 s, `Server: LiteSpeed`.
  - Storefront `/api/v1/products?limit=1`: HTTP 200, `application/json; charset=utf-8`, 3,770 bytes, 0.260 s, `Server: LiteSpeed`.
  - Admin `/`: HTTP 200, `text/html; charset=UTF-8`, 1,593 bytes, 0.357 s, `Server: LiteSpeed`; the previously observed response is a directory index.
  - Admin `/admin`: HTTP 404, `text/html`, 1,251 bytes, 0.239 s, `Server: LiteSpeed`.
  - API `/healthz`: curl exit 28 after 10.013 s, HTTP status `000`, zero response bytes and no response content type. This confirms the timeout persists; it is not evidence of a backend/database timeout cause.
- **cPanel control:** reopened Indexes for `/home/shopadem/admin.shopademia.store`; `Inherit` remains selected. “No Indexing” is described as showing no files when a default file is missing. No option was selected or saved. This is a narrowly scoped listing control, not a host-to-Express route or content-access policy; no production settings were changed.
- **Source/request flow:** `server/app.js` defines `/admin` (serves `admin.html`), `/admin/platform`, and `/healthz`; `server/index.js` reads `DATABASE_URL`, optional `DATABASE_SSL`, production `ADMIN_SITE_URL`, and creates `<project root>/uploads`. Storefront JavaScript uses relative `/api/v1`. README documents the Docker Compose + Caddy production topology and explicitly marks the former cPanel deployment path retired. Repository config is not proof that Caddy is running on the live cPanel host.
- **Current unknowns/gates:** cPanel's previously observed Passenger app remains reported at the apex URI only (Node 20.20.2, started); effective public vhosts, proxy/upstream, app logs, actual PostgreSQL target, production schema/data/uploads, complete protected backup, isolated restore, rollback, staging, and deploy authorization remain unverified. No source-level cause for the live host-specific responses was reproduced.
- **Fresh local verification:** `npm test` — 169 total, 168 passed, 0 failed, 1 opt-in PostgreSQL test skipped; `npm audit --audit-level=low` — 0 vulnerabilities; `npm run build:css` and independent temporary build succeeded with identical generated output; baseline CSS diff is limited to the stale unused utility described above; `git diff --check` passed.

**Fresh domain disposition:** storefront reachable (limited endpoint checks); admin remains failed at root and `/admin`; API remains timed out. **PRODUCTION NO-GO — DEPLOYMENT BLOCKED.**

## Published source candidate and CI — 2026-10-19 16:25 +06

- Commit `1ec245ca10a9d4c552b7718ad1ea6c7739ae108c` was created from the reviewed five-file scope and pushed without force to `AbidHossainTushar003/LiveShopademia:feature/admin-v2`. GitHub branch lookup and `git ls-remote` both confirmed the remote SHA.
- GitHub Actions CI run [39237231146](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39237231146) completed successfully for exactly this commit. It validates the workflow checks, not a production deployment.
- Local verification for this candidate: 169 tests total, 168 passed, 0 failed, 1 opt-in PostgreSQL integration test skipped; dependency audit found 0 vulnerabilities; CSS build and independent output comparison passed; `git diff --check` passed.
- No production deployment, file/configuration change, DNS change, process restart, or database/upload mutation was performed. Two unrelated untracked entries remain untouched. The release verdict remains **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**.

## Latest bounded production and source audit — 2026-10-19 16:41 +06

### Repository, published candidate, and CI

- Local branch `feature/admin-v2` and HEAD are `61eff3c199ecb2fadf9574bbd168ce52b934367a`. GitHub confirms `AbidHossainTushar003/LiveShopademia:feature/admin-v2` points to this exact SHA; Actions run [39237401770](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39237401770) completed successfully for it.
- The local `github` tracking remote points to a different repository, and `origin` is the cPanel SSH deployment target. The local “ahead 6” label is relative to that unrelated tracking ref; it is not evidence of divergence from the intended GitHub repository. The intended GitHub branch was independently checked through GitHub.
- The tracked worktree was clean at audit start. The resulting three report updates and generated CSS artifact were committed and pushed as `affc95fbe515a5d2ed86a16bcd651f1d67b3f127`; Actions run [39239950754](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39239950754) passed for that exact SHA. Two unrelated untracked entries remain untouched. No production deployment, cPanel configuration, DNS, process, database, upload, or customer record was changed.

### Fresh public checks

Certificate-validating HTTPS probes used a 10-second maximum and followed redirects; final URLs remained the requested HTTPS URLs. An initial parallel probe was repeated once per route after a local PowerShell output-filter error; no further retries were made.

| Host and route | Result | Response evidence |
|---|---|---|
| `shopademia.store/` | RESPONDING | HTTP 200; HTML; 34,371 bytes; 0.338 s; `Server: LiteSpeed`; HSTS present. |
| `shopademia.store/api/v1/products?limit=1` | RESPONDING | HTTP 200; JSON; 3,770 bytes; 0.257 s; `Server: LiteSpeed`; HSTS present. |
| `admin.shopademia.store/` | MISROUTED | HTTP 200; HTML; 1,593 bytes; 0.261 s; `Server: LiteSpeed`. cPanel still maps this hostname to its own document root, and its Indexes setting remains Inherit. Previous bounded inspection observed a directory index; no listed file contents were opened. |
| `admin.shopademia.store/admin` | MISROUTED | HTTP 404; HTML; 1,251 bytes; 0.262 s; `Server: LiteSpeed`. |
| `api.shopademia.store/healthz` | NO RESPONSE | curl exit 28 after 10.007 s; HTTP `000`; zero bytes; no content type. The TCP/TLS/HTTP handshake had succeeded in the earlier bounded probe; this request received no HTTP response. |

All three A lookups returned `122.173.84.249`. The requests validated TLS certificates. These observations establish the current public outcomes, not the server's complete proxy topology or live application revision.

### Current cPanel evidence and uncertainty

- cPanel Domains continues to show separate document roots for the storefront, admin, and API. The Setup Node.js App screen reports one production Passenger app at URI `shopademia.store/`, application root `/home/shopadem/shopademia-app`, Node.js `v20.20.2`, startup `server/index.js`, status `started`. It does not expose the live Git SHA, database target, per-request routing, or effective web-server proxy configuration.
- Public responses identify LiteSpeed as the responding web server. The effective virtual-host configuration was not available, so an upstream Nginx layer is neither confirmed nor ruled out.
- The cPanel Errors page snapshot visible during this check contained Passenger `[INFO]` messages and restart-marker entries timestamped between 06:45 and 16:02 +06. It included virtual-host labels for storefront, admin, and API contexts, including 23 admin and 10 API label occurrences. The displayed snapshot contained no `ERROR`, `WARN`, `timeout`, `failed`, `exception`, `502`, `503`, or `upstream` markers. This limited log view does not establish that requests reached Express or explain the API timeout.
- The Passenger host-context markers qualify, but do not resolve, the application-mapping question: the app manager lists only the storefront URI, while the log snapshot also names admin/API virtual-host contexts. Neither is effective vhost/upstream configuration. Do not conclude from either alone that admin/API requests are correctly mapped or that an app is absent.
- cPanel Indexes for the admin root remains set to **Inherit**. **No Indexing** is available but was not applied. Earlier `HEAD` checks to `/php.ini` and `/cgi-bin/` returned 403; this does not prove that all files are protected. No sensitive contents or secret exposure were confirmed.
- The environment-variable screen exposed names only; no values were read. It displayed `DATABASE_URL` and related names but not `ADMIN_SITE_URL`, which production source validation requires. The displayed list does not prove the effective process environment is missing that variable; the provider must verify it securely.
- cPanel lists PostgreSQL database `shopadem_shopapp` (8.54 MB) and user `shopadem_shopuser`, but the live `DATABASE_URL` was not inspected. The Backup page says no automatic backups and offers partial downloads dated Oct. 8; none was downloaded or restored. Isolated recovery, uploads coverage, rollback, staging, and production database identity remain unverified.

### Prioritized issue register

| ID | Priority | Status | Evidence | Minimum next action |
|---|---|---|---|---|
| HOST-001 | P1 | Confirmed | Admin hostname serves a LiteSpeed HTML index from its separate cPanel document root; `/admin` is 404, while Express source defines `/admin`. | In cPanel, use the supported No Indexing control to suppress listing, then have the host map the admin hostname and `/admin` to the existing Express app. Preserve files; do not guess at vhost changes. |
| HOST-002 | P1 | Confirmed failure; cause unresolved | API `/healthz` times out with zero bytes. cPanel shows a separate API root and Passenger context markers, but effective routing and upstream logs are unavailable. | Ask the host to inspect effective LiteSpeed/proxy/Passenger routing and request-timeout logs for this hostname; provide a supported mapping to the existing Express app. |
| OPS-001 | P1 | Blocked | The running app's PostgreSQL target and production data/uploads inventory are unverified; no complete backup has been successfully restored in isolation, and rollback is untested. | Verify the connection target without revealing credentials; obtain protected database/upload backups; restore to an isolated target and rehearse application/data rollback before any release. |
| DEP-001 | P1 | Blocked | Passenger reports Node 20.20.2 started, but live SHA, effective production environment, staging, and deploy/rollback target are unknown. | Host confirms deployed release identity, runtime environment, route map, persistence, and safe staging/release/rollback support. |
| AUD-001 | P2 | Open / scope-limited | Full browser customer/admin journeys and real PostgreSQL concurrency/restore are not verified. The opt-in PostgreSQL test is skipped. The current tree has no Android Gradle project or manifest. Earlier audit items still include owner/legal decisions for privacy retention and shop-specific fulfillment/refund policy. | Use isolated PostgreSQL and browser staging with synthetic identities/data; obtain owner-approved requirements and policy decisions; do not claim Android coverage for this revision. |

### Local validation and source review

- `npm test`: 169 tests; 168 passed, 0 failed, 1 opt-in PostgreSQL integration test skipped.
- `npm audit --audit-level=low`: 0 vulnerabilities.
- `npm run build:css`: PASS. The generated artifact now includes `.isolate{isolation:isolate}`; no HTML or JavaScript class reference was found, while `css/styles.css` has a separate `isolation:isolate` declaration. This is an unused generated utility, not an observed functional defect; the checked-in generated file was rebuilt to match the reproducible command.
- A focused security review of Express routes, admin authentication/session/origin controls, PostgreSQL access and migrations, upload/static-path handling, environment configuration, and deployment assets found no security vulnerabilities in the reviewed source at `61eff3c`. It did not verify production configuration, database grants, live routing, or runtime behavior. `npm audit` is reported separately.
- No application routing defect was reproduced in source that explains the public admin/API failures. The code-level admin route and relative storefront API configuration remain consistent with the successful same-origin storefront API; the failures are host-specific and require hosting evidence/actions.

**Release decision:** **PRODUCTION NO-GO — DEPLOYMENT BLOCKED**. Do not deploy or alter production data. First contain directory indexing via the supported cPanel control, obtain the provider's effective host/upstream diagnosis and supported route mapping, and complete verified database/upload backup, isolated restore, and rollback gates.

## Production-release continuation — 2026-10-19 16:57 +06

### Current Git and CI baseline

- Rechecked local branch `feature/admin-v2`, HEAD `c50408de67163f5b727dc45639d3ad630b64c396`, and GitHub's `feature/admin-v2` ref; both SHAs match. `git ls-remote` independently returned the same SHA.
- GitHub Actions run [39240110333](https://github.com/AbidHossainTushar003/LiveShopademia/actions/runs/39240110333) completed successfully for that exact SHA. The worktree has no tracked changes at audit start. The two existing unrelated untracked entries remain untouched.
- The configured `github` tracking remote still points to `MyTestProjects007/ShopademiaAdmin`, not the intended `AbidHossainTushar003/LiveShopademia`; compare release publication to the explicit intended GitHub remote, not the local upstream count.

### Fresh public probes

Certificate-validating HTTPS requests used a 10-second maximum. All three DNS A records resolved to `122.173.84.249`.

| Target | Observed result |
|---|---|
| `https://shopademia.store/` | HTTP 200, HTML, 34,371 bytes, 0.381 s, `Server: LiteSpeed`, HSTS present. This proves an HTML response only, not storefront customer-flow acceptance or release identity. |
| `https://shopademia.store/healthz` | HTTP 200 JSON `{"status":"ok"}`, 15 bytes, 0.290 s, `Server: LiteSpeed`, HSTS present. This is the apex app's observed readiness response. |
| `https://shopademia.store/api/v1/products?limit=1` | HTTP 200 JSON, 3,770 bytes, 0.285 s, `Server: LiteSpeed`, HSTS present. |
| `https://admin.shopademia.store/` | HTTP 200 HTML, 1,593 bytes, 0.354 s, `Server: LiteSpeed`; this is still the separate-host index response, not the admin UI. |
| `https://admin.shopademia.store/admin` | HTTP 404 HTML, 1,251 bytes, 0.270 s, `Server: LiteSpeed`. |
| `https://api.shopademia.store/healthz` | curl exit 28 after 10.013 s; HTTP `000`, zero response bytes. The shared browser shows the provider's HTTP 500 “Request Timeout” page for this URL. |

### Hosting, application, and recovery disposition

- Admin failure remains attributable to host mapping: cPanel's separate admin document root serves a directory index, while Express source serves `/admin`. cPanel's previously observed Indexes value was **Inherit**, with **No Indexing** available. No file contents were opened. No production setting was changed during this audit; containment remains outstanding.
- API failure remains host-specific, but the exact cause is unresolved. The cPanel Errors page snapshot (retrieved during this audit) showed 110 Passenger log records from 06:45 through 16:02 +06, all `[INFO]`; it contains admin/API Passenger virtual-host labels but no error, warning, timeout, failure, exception, 502/503, or upstream marker. The snapshot is not request-correlated and predates the current probe, so it cannot explain the timeout or prove the request reached Express.
- cPanel still reports a single Node.js 20.20.2 Passenger app at the storefront URI, root `/home/shopadem/shopademia-app`, startup `server/index.js`, status `started`. The effective request mappings and live release SHA are not visible. Public response headers identify LiteSpeed; any upstream Nginx layer remains unverified.
- PostgreSQL database `shopadem_shopapp` is listed in cPanel, but the running app's `DATABASE_URL`, actual database/role, schema state, and persistent upload inventory are not verified. cPanel reports no automatic backups; the partial Oct. 8 database/home downloads have not been restored. Backup integrity, isolated recovery, rollback, and staging remain unproven.
- No production setting, DNS, service, database, upload, order, inventory, or customer record was changed. No deployment occurred.

### Current acceptance matrix

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Storefront host and same-origin API | OPEN | Root, health, and catalog endpoints respond over HTTPS. Customer workflows, browser/device layouts, deployed SHA, and persistence have not been accepted end-to-end. Run the existing browser suite only on a verified isolated local/staging target. |
| Admin hostname and protected routes | BLOCKED — PROVIDER | Separate document root returns an index and `/admin` is 404. Provider/cPanel-supported route mapping is required; privileged operations cannot be safely verified on the current host. |
| API hostname | BLOCKED — PROVIDER | `/healthz` times out, despite the apex health and catalog endpoints responding. Obtain effective LiteSpeed/Passenger/upstream config and request-correlated error logs. |
| PostgreSQL target, schema, and role | BLOCKED — PROVIDER | cPanel database inventory does not prove the application connection target or effective role/grants. Verify without disclosing credentials. |
| Database/upload backup, isolated restore, and rollback | BLOCKED — RECOVERY | No complete verified backup pair, successful isolated restore, upload validation, or rollback rehearsal. No production deployment until demonstrated. |
| Staging and E2E acceptance | BLOCKED — PROVIDER | `.env.staging`, `.env.production`, and the isolated `TEST_DATABASE_URL` are absent. Both config validators fail closed. `npm run test:e2e -- --list` is blocked because `PLAYWRIGHT_BASE_URL` is unset; production targets are explicitly refused. |
| Unit/API suite and local build | FIXED AND VERIFIED | 169 tests: 168 passed, 0 failed, 1 opt-in PostgreSQL integration test skipped. CSS build exactly matches tracked generated output. This is local automated-test/build evidence, not end-to-end acceptance. |
| Exact-commit CI | FIXED AND VERIFIED | Run `39240110333` passed for `c50408de67163f5b727dc45639d3ad630b64c396`; this is CI evidence only, not deployment or production verification. |
| Source/dependency security checks | OPEN | Focused source review reported no vulnerabilities at `61eff3c`; dependencies report 0 advisories. No dedicated secret scanner is installed; a narrow current-tree pattern scan found only two credential-URL validation fixtures in tests, with values not emitted. No secret-history scan or production security review was performed. |
| Android, monitoring, owner-approved policy | OPEN | No Android Gradle project/manifest is present. Monitoring, full acceptance flows, and earlier owner/legal decisions remain open; see the historical audit findings. |

The cPanel Indexes menu was not changed: production recovery evidence remains incomplete, and the current browser interaction did not successfully open that control. The exact next step is an authorized, narrowly scoped cPanel **No Indexing** change after the recovery/rollback gate, followed by a public check that the directory listing is gone; it will not fix the `/admin` or API route mapping. Do not guess at the API upstream or migrate away from PostgreSQL.

**Final release decision remains PRODUCTION NO-GO — DEPLOYMENT BLOCKED.**
