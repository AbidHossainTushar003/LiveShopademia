# Shopademia Staging Target Approval Brief

**Purpose:** Obtain release-owner approval of a distinct, non-production staging target before planning any provisioning.
**Current decision:** **STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.**
**Current repository:** `feature/admin-v2` at `798e7227e907edbbd262e8fe25b78d9e79cd7247`.

No hosting provider, account, region, hostname, staging credential, DNS record, or staging service is selected or verified. This brief is for decisions and evidence only; it does not authorize purchasing, provisioning, DNS changes, deployment, or database writes.

## Final pre-staging evidence update — 2026-10-14

- The working branch/HEAD remain `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`; the approval request and latest readiness report remain the authoritative lists of outstanding owner decisions.
- Static real-path containment rejects observed symlink/junction escapes before serving, but it is a check-then-open sequence and is **not race-proof** against an actor able to replace path components concurrently. No deterministic race exploit was demonstrated. Before release, require immutable/read-only code and public-asset roots, strict operator-only filesystem access, and a separately controlled upload root writable only by the application. Stronger race-safe confinement needs platform-specific handle-relative serving or an isolated static-serving design; this repository does not claim that guarantee.
- The checked-in `.github/workflows/ci.yml` grants `contents: read`; its production deploy job is triggered by a push to `main` when `CPANEL_DEPLOY_ENABLED` is true. The workflow declares no protected GitHub `environment`; it references `${{ secrets.CPANEL_SSH_KEY }}` / `${{ secrets.CPANEL_KNOWN_HOSTS }}`. Actual organization/repository secret scope, branch rules, required checks/reviews, environment reviewers and Actions permissions are **UNVERIFIED**: read-only GitHub API/settings requests returned 403/404, and authenticated GitHub CLI access was unavailable. These responses do not prove that protections are absent.
- An online `npm.cmd audit --audit-level=low` against the configured `https://registry.npmjs.org/` registry reported zero advisories; npm offline mode was false. Secretlint scanned 173 repository text files and reported seven database-connection-string patterns confined to example environment templates and a staging-config test fixture. Values were not emitted; all are potential-pattern alerts, not confirmed leaked credentials.
- **Owner decisions:** No named people or signed approvals are recorded. The approval request now has an explicit register for each external decision: role owner, pending/unverified status, evidence, and acceptance criterion. Role assignments are not a substitute for naming the accountable people.
- **GitHub settings:** REST GETs for branch protection, rulesets, Actions permissions, environments, and workflow contents returned HTTP 403 (API rate limit); GitHub MCP branch listing returned 404; `gh` is unavailable. No settings payload was obtained. Actual protections, reviewers, environment approvals, permissions, secret scopes, and remote workflow state remain **UNVERIFIED**. Local workflow YAML is source evidence only.
- **Staging validator:** `.env.staging` is absent and the latest `npm.cmd run validate:staging` exited 1 with the expected missing-configuration/placeholder message; no placeholder was created.

## Concise external decision request — prepared, not sent

- **Release owner:** name the accountable business, account, technical, security, DBA, billing, QA, SRE and release approvers; select/approve the non-production account and region, test scope, synthetic-only data and integrations policy, spend cap, RPO/RTO and independent restore reviewer, monitoring/escalation owner, rollback authority and release authorization. No decision is approved yet.
- **Hosting provider:** confirm supported runtime, Node version, process model/sizing/deployment method; staging hostname ownership/mapping, TLS and API ingress; isolated PostgreSQL/network/roles; persistent upload storage and backups; secret delivery/access/rotation; itemized pricing/quotas; restore, monitoring and alert capabilities. Supply evidence and capability limits; do not send credentials.
- **Repository administrator:** verify canonical GitHub repository, default branch, protection/rulesets, required PR approvals/checks, push restrictions, environment reviewers/ref restrictions, Actions token permissions, secret scope, deployment triggers and artifact provenance. These account settings are currently **UNVERIFIED**.

Engineering next prepares a separate target-specific provisioning/evidence plan only after written target, owner and budget approval and provider confirmations. This brief has not been sent; it authorizes no provider contact, charge, resource, DNS, credential, or deployment action. Detailed IDs D01–D12, status, dependencies, owner roles, evidence and acceptance criteria are recorded in [STAGING_APPROVAL_REQUEST.md](./STAGING_APPROVAL_REQUEST.md).

## Filesystem race controls required before deployment

The current Express middleware resolves the requested path with `realpath()` and then passes the pathname to `express.static`, which opens it separately. A filesystem actor who can replace a path component in between can win the TOCTOU window. Junction containment tests verify static-link rejection, not race resistance. No in-process code change is claimed to close this race.

**Required filesystem ownership and permissions:**

- Release/deployment identity owns the application bundle and static roots; the runtime service identity receives read/traverse (POSIX `r-x`) only. It must not create, replace, rename, or delete files in the release root, `css`, `js`, `admin-assets`, or `public-assets`, nor alter their parent directories. Deployments should publish a new immutable release tree and switch it using a separately authorized release operation; the live app identity must not perform that switch.
- Do not place writable uploads inside the release tree. Separate upload ingestion from published static content. An ingestion area may be writable only by the app and must not be served directly; a trusted validation/publish step should move accepted files to a content-addressed/immutable serving tree mounted read-only to the web runtime. Where separate identities or immutable publication are unavailable, record that the upload-serving path retains TOCTOU risk and do not claim full race resistance.
- Apply equivalent Windows ACLs when applicable: runtime receives Read & Execute on immutable roots and no Create/Write/Modify/Delete rights on those directories or parents; ingestion ACLs are separate. Do not allow untrusted users to create junctions/reparse points or replace path components.
- Use platform isolation/mount controls where available (read-only asset mount; `noexec,nodev,nosuid` on writable upload storage as compatible). Confirm deployed owner/group/ACLs and mount identities, not just Compose declarations.

**Acceptance evidence:** verify the actual runtime UID/SID cannot create, replace, rename or remove an asset or directory entry under every served immutable root; verify only the designated upload-ingest identity can write the unserved ingestion area; verify publication produces immutable content and the serving identity cannot mutate it; verify uploads are isolated and survive the approved backup/restore; inspect ACL/mount output from the actual staging target. If any writer can mutate a served tree, keep the race gate **BLOCKED** unless handle-relative confinement is implemented and independently race-tested on the deployment OS.

### Manual repository-settings evidence checklist

An authorized repository administrator should confirm canonical repository/default branch; branch and ruleset enforcement (approvals, required status checks, direct-push and bypass controls); staging/production environment reviewers and allowed refs; Actions token/default permissions, allowed actions and fork-PR policy; secret/variable scopes without disclosing values; workflow SHA, events/ref conditions, job environment and permissions; and tested immutable artifact digest/provenance. Return sanitized evidence and observation time. Do not change settings or trigger a deployment during inspection.

## Approval required

The release owner should approve a specific staging scope and complete or assign each decision below. Values must be supplied by the owner/provider; none are inferred here.

| Decision | Required approval / provider evidence | What is currently evidenced |
|---|---|---|
| Provider and ownership | Provider name; account/project/subscription identifier; region; named account owner, technical operator, and billing owner; confirmation this target is separate from production. | **Unknown.** No staging provider/account is recorded. Existing production CI references a cPanel destination; that does not prove staging capability or authorize reuse. |
| Runtime | Confirm a supported isolated VM/container service, Docker/Compose or an approved equivalent, persistent process supervision, outbound access needed for package/runtime operations, and compatibility with the project Node runtime (CI uses Node 22; app requires Node >=20) and native `sharp` module. Supply proposed CPU/RAM/disk, availability/maintenance model, and runtime access method. | **Repository proposal only:** `docker-compose.staging.yml` defines app, migrator, PostgreSQL, and Caddy services. Historical local image builds are documented, but current Docker Desktop is unavailable and no hosted runtime was inspected. |
| Hostnames and routing | Owner-approved staging hostname(s), proof of DNS/domain control, hostname-to-ingress mapping, API path/routing behavior, public/private reachability, firewall/port policy, and certificate issuance/renewal method. Do not provide or create DNS records as part of approval. | **Repository proposal only:** Caddy routes its configured domain to the internal app on port 3000; Compose declares inbound 80/443. No hostname, route, certificate, or reachable listener is verified. |
| PostgreSQL isolation | PostgreSQL service/version and hosting model; a new staging-only database, separate migration/owner and least-privilege runtime roles, private network policy, storage/backup location, and evidence no database, credential, cluster, or volume is shared with production or the read-only preview. | **Repository proposal only:** a PostgreSQL container, internal-only database network, and distinct app/migration URLs/roles are represented in Compose. No staging database or grants exist as verified evidence. |
| Persistent uploads/storage | Confirm isolated staging-only persistent storage (provider volume or approved object store), access policy, capacity/quotas, encryption, retention, backup pairing with DB, and restart/restore behavior. | **Repository proposal only:** named app upload volume. No hosted storage, persistence test, backup, or restore is verified. |
| Secrets | Approve the secret manager and administrators/readers; provision unique staging-only database, JWT signing, MFA encryption, and any required integration secrets only after separate authorization. Define rotation/revocation ownership and prohibit production/local-preview secret reuse. | **No staging secrets exist.** Compose expects values, and local validation rejects absent/placeholder configuration. `.env.staging` is currently absent and must remain absent until an authorized target and secret process are approved. |
| Access controls and test data | Approve admin ingress restrictions (e.g., VPN, identity proxy, or IP allowlist if supported), MFA policy, named synthetic test identities/roles, synthetic dataset and cleanup owner, and outbound/payment/notification restrictions so no real customers or transactions are contacted. | Application supports authentication/authorization controls and Compose has no published app port in its source configuration. Provider ingress restrictions, staging identities, and operational policy are not verified. |
| Costs and limits | Provider quote or estimate for compute, PostgreSQL/storage, upload storage, backups, bandwidth/egress, DNS/domain, TLS if charged, monitoring/log retention, and support; spending limit, alerts, currency, billing period, and shutdown/retention policy. | **Unknown.** No price, quota, account, or paid capability is evidenced. Do not create resources until the billing owner approves the estimate and cap. |
| Backup and recovery | Approve database + uploads backup method, encryption/key ownership, retention, off-host destination, restore reviewer, recovery operators, and objective RPO/RTO. Require an isolated restore rehearsal before staging release; never restore over production. | Runbook specifies a proposed procedure only. No staging backup, independent restore, timing, or RPO/RTO has been demonstrated. |
| Monitoring and logs | Name the monitoring/logging service and receiver; approve health, availability, error, latency, DB capacity/disk and backup-failure alerts; retention, redaction, access, escalation and test-alert acknowledgement. | Compose proposes an app health check and local `/healthz` currently works. No external monitoring, alert receiver, retention policy, or operator is evidenced. |
| Rollback and release authority | Name release approver and rollback decision-maker; approve immutable artifact/SHA policy, prior app artifact retention, migration compatibility/forward-repair strategy, objective stop/rollback thresholds, and rehearsal requirement. | Production CI is a main-only cPanel in-place `rsync --delete` deployment. No staging deploy workflow or verified atomic rollback exists; production procedure must not be repurposed without separate review. |
| CI/CD and audit evidence | Confirm protected staging environment, approvers, branch/ref restrictions, staging-only secrets, runner permissions, artifact provenance and test gates. | **UNVERIFIED externally:** checked workflow has `contents: read`, no declared protected environment, and a production-only main-push deploy condition. Read-only GitHub settings/API access returned 403/404; actual branch/environment rules and secret scopes were not inspectable. |

For per-decision accountable roles, pending approval state, evidence, and closure criteria, see the **Outstanding decision register** in [STAGING_APPROVAL_REQUEST.md](./STAGING_APPROVAL_REQUEST.md). No row is considered approved based solely on a repository proposal.

## Required owner response

Approval should be returned as a written change/decision record containing:

1. Approved provider/account/project and region, with named account, technical, security, billing, DBA, QA, and release owners.
2. The specific staging application hostname(s) and the provider evidence proving ownership and target mapping.
3. Runtime and database service choice/version, isolation model, and a declaration that production and the local preview are excluded.
4. Storage, secret-manager, access-control, and synthetic-data choices.
5. Itemized expected costs, currency/period, quota limits, budget cap, and explicit spending approval.
6. Backup/restore, monitoring/alert receiver, RPO/RTO, escalation and rollback decisions.
7. Approved staging test scope, permitted write tests, and cleanup authority.

Approval of this brief is not approval to deploy. After the release owner approves and provider facts are independently verified, prepare a separate target-specific provisioning plan and evidence checklist for review. No `up`, migration, DNS, secret creation, public probe, or write test should occur before that next authorization.

## Current fail-closed state

- `.env.staging` is absent. `npm.cmd run validate:staging` correctly fails with a missing-config message. Do not create placeholder or fabricated configuration to make validation pass.
- Local read-only preview remains separate at `127.0.0.1:3002` with preview PostgreSQL at `127.0.0.1:55441`; neither is staging.
- Staging remains **BLOCKED / NOT READY**. Production remains **NO-GO**.

See the [staging readiness audit](./STAGING_READINESS_AUDIT.md), [deployment runbook](./DEPLOYMENT_RUNBOOK.md), [staging Compose proposal](../docker-compose.staging.yml), and [CI workflow](../.github/workflows/ci.yml) for underlying evidence and limitations.
