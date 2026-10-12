# Shopademia deployment and recovery runbook

**Status:** Documentation only; deployment is **BLOCKED / NOT AUTHORIZED** by this runbook.
**Updated:** 2026-10-12
**Current release decision:** **NO-GO** until the gates below are closed and an owner explicitly authorizes deployment.

## 1. Stop gates

Do not push to `main`, enable the cPanel workflow, apply migrations to a production database, or alter production data until all of these are resolved:

- The authoritative MGS, full V2 module annex, explicit approval record, and required owner decisions are recorded.
- Database authority is PostgreSQL, as explicitly required by the owner. Do not migrate to MySQL/MariaDB. The intended hosted PostgreSQL service/version, credentials, and connectivity remain unverified.
- D1–D12 and any dependent compatibility/data/status mappings are answered, especially checkout/payment, refunds, inventory, costing, returns, hosting, and repository location.
- Intended host/runtime, database version, native `sharp` compatibility, DNS/TLS, environment variables, and operator access are independently verified.
- A protected production backup has been taken and an isolated restore has been completed and reviewed. Backup/restore scripts and their success are not assumed to be valid merely because they exist.
- A reviewed release commit, tested migration/rollback-or-forward-repair plan, monitoring/alerting owner, incident contact, and recovery authority are established.

## 1.1 Current evidence and unresolved external blockers (2026-10-12)

The feature branch was clean at `808871045abf6ab0369b1d1ccdbce51468b3a755` before this evidence update. It contains logout fix commit `dccff169b207cc4d5b8c18e3e81dd769446df4fc` and evidence commit `808871045abf6ab0369b1d1ccdbce51468b3a755`. GitHub Actions runs [38270740198](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270740198) and [38270844665](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38270844665) passed for those exact commits. CI verifies Node tests and dependency audit only; deployment was skipped on the feature branch.

The later infrastructure documentation commit `1e80d56620304c9023dd4c613f6c632f709d1eba` passed CI run [38271421414](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38271421414). The follow-up clarifying PostgreSQL authority and adding the support template/staging proposal, `21a11f616b23c465861a009ea12dba818dfac710`, passed CI run [38272992537](https://github.com/MyTestProjects007/TestingWeb/actions/runs/38272992537). Both runs passed tests and dependency audit; deploy was skipped.

Read-only reachability checks at 2026-10-12 21:33 +06 resolved `shopademia.store` to `122.173.84.249`. HTTP port 80 connected and returned a redirect to HTTPS for `/healthz` and `/`; HTTPS port 443 timed out before an HTTP response. A TCP 443 check to `github.com` connected. This proves only that HTTPS to this hostname was unreachable from this test vantage at that time. It does not establish an origin outage or locate the fault in the origin, CDN/proxy, firewall, or route. No origin/hosting logs or independent network-vantage test were available. Do not make a speculative firewall, DNS, TLS, or service change; obtain authorized host/CDN logs and provider-side listener/firewall status first.

Repository inspection found no staging workflow or stage target. The only deploy job in [ci.yml](../.github/workflows/ci.yml) is gated on `main`, successful CI, and `CPANEL_DEPLOY_ENABLED=true`, and targets the cPanel production app. It syncs files in place with `rsync --delete`, restarts the existing Node app, and checks the production health endpoint. It does not provision staging, back up data, run migrations, or preserve/switch to a previous release for application rollback. The configured `origin` remote points to the cPanel production host and was not contacted.

No backup artifact, paired uploads archive, decryption identity, checksums, timestamps, restore logs, or isolated restore environment was available in the workspace. Docker, `age`, and `rsync` were unavailable locally; `.env` was not read, and no `.env.production` or `.env.staging` was present. The existing backup/restore scripts were not run. Accordingly, neither backup integrity nor restoration/recovery time is verified.

The repository provides a database-backed `/healthz` endpoint and a Compose container healthcheck. External uptime monitoring/alerting appears as a recommendation, not a configured or delivery-tested integration; no provider evidence, alert destination, named on-call contact, or SLO was supplied. Application rollback and database migration recovery are likewise not demonstrated.

These are evidence gaps, not completed repairs. Continue to block release until the owner/operator supplies authorized staging host and isolated PostgreSQL access, separate stage credentials configured through the approved secret store, a real paired backup plus separately held decryption identity and isolated restore target, hosting/CDN logs for the HTTPS failure, and monitoring/rollback ownership and procedures. Never send credentials or private keys in this runbook or chat.

### Provider support request template (not sent)

**Subject:** Read-only investigation requested: HTTPS port 443 timeout for `shopademia.store`

> Please investigate without changing production configuration.
>
> At 2026-10-12 21:43:27 +06, read-only checks resolved `shopademia.store` to A record `122.173.84.249`; the reported authoritative nameservers were `ns1.chephost.top` and `ns2.chephost.top`. TCP port 80 connected. An HTTP HEAD request to `/healthz` returned HTTP 301 with `Location: https://shopademia.store/healthz` in about 0.147 seconds. TCP port 443 timed out. HTTPS `/healthz` and `/` requests timed out before a TLS handshake; an independent public fetch also failed at the transport level.
>
> Please confirm whether `122.173.84.249` is the currently assigned endpoint for this domain; whether a listener/front end accepts TCP 443; and whether firewall/network ACL, routing, reverse proxy, or CDN configuration is dropping the connection. Please verify the HTTPS virtual-host/SNI mapping and TLS logs after confirming 443 reachability, and provide relevant connection, proxy, and web-server logs for approximately 2026-10-12 21:40–21:44 +06. Please report findings and a recommended corrective action before making any production change.
>
> No production files, databases, DNS, certificates, firewall rules, or hosting configuration have been changed or authorized for change as part of this investigation.

This is a prepared template only. It was not sent; provider-side evidence and ticket status are unavailable here.

### Staging candidate architecture (not provisioned)

No staging provider/host, hostname, account, isolated PostgreSQL service, or credentials have been selected or supplied. A compatible candidate, subject to owner/provider approval, is a separate Linux VM or staging service with Node.js 20+ (the repository requires Node `>=20`; CI uses Node 22), PostgreSQL, persistent uploads, and an HTTPS proxy. It must not share the production cPanel filesystem, production database, production secrets, backup identity, or deploy key.

Before implementation or a first deploy, the owner/operator must provision a staging-only hostname and network/host, a new PostgreSQL database and least-privilege roles, separate secrets in an approved secret store, upload storage, TLS, restricted staging access, and log/alert access. Use synthetic data only. Verify `sharp` against the selected Node/OS runtime. Then add a separately named GitHub Actions `staging` environment and a feature-branch/manual staging workflow that can access only staging credentials, runs CI first, deploys the selected feature commit, checks `/healthz`, and runs approved smoke tests. Keep the existing main-only production job unchanged; do not reuse its cPanel host variables, credentials, or `rsync --delete` target. No staging workflow is added until a real target and authorization are available, because a targetless workflow cannot be safely or meaningfully tested.

## 2. Existing deployment paths (not interchangeable)

The repository documents two deployment shapes. Select and verify one; do not combine instructions or infer that either is production-ready:

1. **Docker Compose + PostgreSQL + Caddy:** single Linux VM, one public `DOMAIN`, app and database services, one-shot migration service, and Caddy TLS proxy. See [docker-compose.production.yml](../docker-compose.production.yml) and the deployment section in [README.md](../README.md).
2. **cPanel GitHub Actions:** push to `main` can deploy when `CPANEL_DEPLOY_ENABLED=true`; workflow uses SSH/rsync and a Node 20 virtual environment path. The workflow is not a backup or database migration system and must remain disabled until its documented prerequisites and live environment are verified. See [ci.yml](../.github/workflows/ci.yml).

PostgreSQL remains the authoritative database engine. Deployment and migration steps remain blocked on a verified hosting target, PostgreSQL version/connectivity, backup/restore evidence, and the other release gates; no engine migration is authorized.

## 3. Configuration and secrets

- Use the chosen host's approved configuration template and exact runtime contract. For the Compose PostgreSQL path, current documented values include `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `POSTGRES_MIGRATION_PASSWORD`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DOMAIN`, `JWT_SECRET`, and `MFA_ENCRYPTION_KEY`.
- Keep real environment files, private SSH keys, MFA keys, backup decryption identities, and settings encryption keys outside version control. Never paste them into chat, logs, or this runbook.
- `ADMIN_SETTINGS_ENCRYPTION_KEY` is optional for local settings-secret writes; it must be a distinct, protected 64-character hexadecimal key before using that capability. Losing it prevents decryption of saved secrets; key rotation/recovery tooling is not implemented.
- Production platform administrators must enroll TOTP and use an authenticator. The local development environment permits password-only platform-admin login for convenience; this mode is disabled in production, where the server enforces MFA regardless of the development setting. Establish an independent, documented recovery process before launch.
- Validate proxy trust, HTTPS, hostnames, database TLS, filesystem permissions, and secret backup without exposing secret values.

## 4. Pre-deployment and backup sequence

Only after the stop gates are signed off by the responsible owner/operator:

1. Identify the exact release commit, deployment target, maintenance window, operator, and rollback decision-maker.
2. Verify target host/runtime/database versions and confirm application/DB hosts and database name are the intended target. Refuse destructive or migration work if target identity is ambiguous.
3. Run CI and approved phase acceptance tests on an isolated environment built from the release commit.
4. Take paired database and uploads backups using the approved host-specific procedure. Store encrypted copies off-host, retain the decryption identity separately, and record checksums and timestamps.
5. Restore the pair into a newly named isolated database and a new directory; verify tables, counts, application assets, and recovery time. Never restore over production as a test.
6. Review the migration plan and its failure behavior. Current migration support is PostgreSQL-specific and does not yet provide dry-run/data reconciliation or a demonstrated rollback workflow. Do not proceed until a reviewed recovery path exists.
7. Obtain explicit authorization for the exact deployment/migration operation; verify the feature flag and secrets out of band. Do not enable automatic deployment merely to test it.

README documents scripts at [backup-production.sh](../scripts/backup-production.sh), [restore-production.sh](../scripts/restore-production.sh), and [upgrade-database-role.sh](../scripts/upgrade-database-role.sh). Their production execution and restore success are **UNVERIFIED**. Never run the role-upgrade or migration scripts against production as an exploratory check.

## 5. Deployment and smoke tests

After separate deployment authorization and a completed rehearsal:

- Follow only the selected deployment path and its reviewed change ticket. Do not run both deployment paths.
- Confirm migration service completion and inspect its status/logs before starting application traffic.
- Verify the public health endpoint returns HTTP 200 and `{"status":"ok"}`; check the storefront shell and admin sign-in page return successfully.
- Verify TLS certificate, canonical host, static assets, public catalog, database readiness, and service logs. Treat an unauthenticated admin API `401` as the expected boundary, not proof of admin business flows.
- Use only synthetic data for approved smoke tests; do not create a real financial transaction, verify real payment, or create a shipment without explicit authorization.
- Confirm alerts, backup schedule, and the on-call/rollback operator before announcing service availability.

## 6. Monitoring and ongoing operations

The repo README recommends an external uptime monitor on `/healthz`, service log review, host patching, log retention, secret custody/rotation, off-host encrypted backups, and periodic isolated restore drills. The health endpoint is database-backed. Rate limits are in-process; the README says not to horizontally scale without a shared rate-limit store.

Before launch, assign named owners and measurable targets for availability, alert response, retention, backup cadence, RPO/RTO, log access, incident escalation, and key recovery. These operational values are not approved by this runbook.

## 7. Recovery and rollback

- Stop rollout and preserve logs if health, migration, permissions, or smoke checks fail.
- Do not automatically reverse a schema or restore over a live database. Use only the pre-reviewed, target-specific forward-repair or isolated restore procedure approved for that release.
- Preserve the failed release identifier, migration IDs/checksums, timestamps, relevant redacted logs, and backup pair. Avoid copying customer or secret values into incident notes.
- Restore to an isolated target first; compare integrity and confirm the chosen recovery point before an authorized operator makes any production switch.
- Record recovery duration, data-loss window, integrity checks, and follow-up actions. Reopen launch only after the owner reviews the evidence.

No production deployment or recovery operation was performed in preparing this document.
