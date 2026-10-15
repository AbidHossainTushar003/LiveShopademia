# Shopademia Staging Hosting and Release Approval Request

**To:** Authorized business/release owner; hosting/account provider representative
**From:** Shopademia engineering / release management
**Request:** Approve a specific isolated, non-production staging target and supply the provider facts needed for a target-specific provisioning plan.
**Decision remains:** **STAGING BLOCKED / NOT READY; PRODUCTION NO-GO.**

This is a request for decisions and evidence only. It does **not** authorize provider contact by engineering, purchases, resource creation, DNS changes, credential creation, migrations, deployment, or production access. Unknown provider capabilities below are **UNVERIFIED**, not assumed available.

## Outstanding decision register — 2026-10-14 10:56 +06

No named approver, written approval, provider response, or external staging evidence is recorded for any row below. Accountable owners are identified by role only; the release owner must assign named people. “Acceptance criterion” describes the evidence needed to close that gate, not a claim that it is met.

| ID / decision | Accountable owner (named person) | Status | Dependencies | Actionability and exact next action | Required evidence | Acceptance criterion |
|---|---|---|---|---|
| D01 — Provider, account/project, region, target and operators | Business/release owner; account owner (**not named**) | **PENDING / UNVERIFIED** | None | **External:** release owner selects and records one target; assign named business, account, security, DBA, SRE, QA and release owners. | Signed target/scope record, account/project/region identifiers, named operators, separation declaration. | One identifiable non-production target and its accountable operators are approved and demonstrably distinct from production. |
| D02 — Runtime, sizing, process model and deployment method | Hosting provider/operator; DevOps (**not named**) | **PENDING / UNVERIFIED** | D01 | **External:** provider returns supported Node/runtime, supervision, deployment, resource-limit and native-`sharp` compatibility details. | Provider support statement, sizing/quotas, process/restart and deployment method. | Chosen runtime supports the app/dependencies; owner-approved capacity and deployment method are documented. |
| D03 — Hostname, DNS authority, TLS, ingress and API routing | Domain owner; provider/network operator; security owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02 | **External:** owner selects hostname; provider confirms routing/TLS/ingress capabilities. Do not change DNS in this phase. | Domain-control and hostname mapping evidence; routing/firewall/proxy details; certificate chain, SAN and renewal evidence. | Approved hostname maps only to staging, TLS validates, and authorized health/public/API routes work through documented ingress. |
| D04 — Separate PostgreSQL, network boundary, roles and synthetic data | DBA; provider operator; security owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02 | **External:** DBA/provider confirms an isolated PostgreSQL option, private connectivity and distinct runtime/migration privileges; no provisioning yet. | Service/version and sanitized identity; network boundary; role grants; encryption/backup scope; non-sharing proof; synthetic-data policy. | Staging DB is isolated from production/preview, reachable only over approved paths, least privilege is verified and data is synthetic. |
| D05 — Persistent upload storage and upload isolation | Storage/provider owner; application owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02, D04 | **External:** provider confirms dedicated storage, ACL, capacity, durability and paired backup/restore capability. | Storage identity, encryption/access/capacity policy, persistence behavior and DB+upload backup coverage. | Storage is staging-only and app-writable only; approved restart and paired restore checks preserve expected files. |
| D06 — Secret management, access, audit and rotation | Security owner; secret custodian (**not named**) | **PENDING / UNVERIFIED** | D01, D04 | **External:** security owner selects an approved manager; provider confirms delivery/access controls; no secret creation in this phase. | Manager/reader policy, secret-purpose inventory without values, access audit and rotation/revocation owners/procedure. | Unique staging-only values are accessible solely to authorized principals, never reused from production/preview, and rotation/revocation is testable. |
| D07 — Admin restrictions, MFA, test identities and outbound effects | Business owner; security/privacy owner; staging operator (**not named**) | **PENDING / UNAPPROVED** | D01, D03, D06 | **Mixed:** owner approves scope and synthetic-data policy; provider confirms supported ingress restriction; QA proposes role-based synthetic cases. | Written admin/MFA policy, synthetic identities/data, cleanup owner, payment/notification suppression or sandbox evidence. | Only approved testers can access admin; all test data/identities are synthetic; no real payment, customer message or production integration can be triggered. |
| D08 — Itemized cost, budget cap and spending approval | Billing owner; business/release owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02, D04, D05, D09, D10 | **External:** provider supplies itemized quote and billing behavior; billing/release owner sets and signs numeric cap. No paid resource is authorized. | One-time/recurring amounts, currency/period, quotas, overage alerts, shutdown/retention terms and approval. | Written authorization covers each cost category and numeric cap/overage response before chargeable provisioning. |
| D09 — Backup policy, retention, RPO/RTO and independent restore | Business/release owner; DBA; operations owner; independent reviewer (**not named**) | **PENDING / UNAPPROVED** | D01, D04, D05 | **External:** owners set numeric objectives and reviewer; provider confirms backup/restore capability. Later execute only on approved staging. | Retention/encryption/off-host policy; named operators/reviewer; sanitized checksums/decryption, isolated restore, validation and timing. | Independent reviewer confirms DB and uploads restore to a separate target, invariants pass and measured recovery meets approved RPO/RTO. |
| D10 — Monitoring, alert delivery, logs and incident escalation | SRE/operations owner; security/privacy owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02, D03, D04 | **External:** operations names monitor/receiver/escalation; provider confirms integration/retention. | Alert rules, receiver/acknowledgment, redaction/access/retention policy and primary/backup escalation contacts. | Approved test alert is acknowledged by the named owner; responders can access appropriately redacted logs and follow escalation. |
| D11 — Rollback triggers, recovery procedure and release authority | Release owner; DBA; application owner (**not named**) | **PENDING / UNAPPROVED** | D02, D04, D09, D10, D12 | **Mixed:** release/DBA define measurable triggers and recovery choices locally; rehearse only on approved disposable staging. | Decision authority, artifact retention, migration recovery plan, rehearsal logs and post-recovery health/invariant evidence. | A staging rehearsal demonstrates app and DB/schema recovery; stop triggers, authority and successful checks are recorded before release. |
| D12 — CI/CD permissions, branch controls, protected environments and provenance | Repository administrator; security owner; release owner (**not named**) | **PENDING / UNVERIFIED** | D01, D02, D06 | **Mixed:** local workflow source has been reviewed; repository administrator must retrieve actual settings read-only and approve any later staging workflow plan. | Branch/ruleset, required review/check, Actions permission, environment reviewers, secret scope, event/ref restriction and artifact SHA/provenance evidence. | Authorized reviewer confirms protections and staging-only credentials; deploy is restricted to approved refs/environment and a tested immutable artifact, separate from production. |

### Current GitHub settings inspection result

At 2026-10-14 10:52 +06, read-only REST GETs were attempted for branch protection on `feature/admin-v2`, repository rulesets, Actions permissions, GitHub environments, and the workflow file. All returned HTTP 403 with an API rate-limit response; no settings payload was obtained. GitHub MCP branch listing returned HTTP 404 for the configured `MyTestProjects007/ShopademiaAdmin` mirror, and GitHub CLI (`gh`) is unavailable. Thus actual branch protections, required reviews/checks, environment reviewers, Actions permissions, secret scopes, and remote workflow state remain **UNVERIFIED**; neither presence nor absence is inferred. The only workflow facts available are from the current local `.github/workflows/ci.yml` source, not a live repository-settings read. No bypass or settings change was attempted.

### Concise outstanding decisions — release owner/provider (prepared, not sent)

**Release owner:** name the accountable people; approve the distinct provider/account/region and test scope (D01); choose synthetic-only accounts/data and integration suppression (D07); approve quoted spend/cap (D08), recovery objectives/reviewer (D09), monitoring/escalation (D10), rollback authority/triggers (D11), and the staging CI authorization model (D12).

**Hosting provider/account operator:** confirm supported runtime/Node version/sizing/deploy method (D02); candidate hostname/DNS authority, TLS, ingress/proxy and API routing capabilities (D03); isolated PostgreSQL/network/least-privilege role support (D04); persistent isolated uploads and paired backups (D05); secret-delivery/access/rotation capabilities (D06); itemized costs/quotas (D08); backup restore, monitoring and alert capabilities (D09-D10). Provide evidence, not credentials. No message has been sent and no resource, DNS, secret, or deployment action is authorized.

**Repository administrator/security/release owner:** provide read-only evidence for default branch, branch protection/rulesets, required approvals/status checks, direct-push restrictions, GitHub environment reviewers/branch restrictions, Actions permissions, environment-scoped secret exposure, workflow triggers and immutable artifact provenance (D12). Actual settings remain unverified.

### Release-owner approval response template (copy, complete, and return)

```text
Decision/change reference:
Date and timezone:
Release owner name/title:
Business approver name/title:
Provider/account owner name/title:
Security approver name/title:
DBA / operations / QA / repository-admin names:

Target selected (provider, account/project, region):
Staging hostname(s) (if approved; no DNS change authorized by this response):
Approved staging test scope and time window:
Permitted write tests (staging only):
Synthetic-data and integration-suppression policy:
Itemized cost quote reference / currency / period:
Approved spending cap and overage action:
Approved RPO / RTO / backup retention:
Independent restore reviewer:
Monitoring receiver / escalation owner:
Rollback decision-maker / objective stop triggers:
Approved release refs/SHA policy:
Conditions or rejected items:

For each decision D01-D12, mark exactly one:
  APPROVED / REJECTED / PENDING
  Approver name and role:
  Evidence reference (sanitized; no secret values):
  Conditions / expiry:

This response approves planning only. It does not authorize resource creation,
spending, DNS changes, credential creation, migration, deployment, or production access.
Separate written authorization will be required for each such activity.
```

### Concise D01 decision request — pending, not sent

Authorized release owner: return a written D01 decision naming accountable people and identifying the proposed non-production provider, account/project, region, and target. State how it is separate from production and the local preview, plus the approved staging purpose/test scope and permitted operators. Attach a sanitized target/scope record; do not include credentials. Mark **APPROVED**, **REJECTED**, or **PENDING**, name the approver and date, and cite evidence. No provider, target, cost, or approver is presumed.

D01 approval permits target-specific planning only. It does not approve spending, provisioning, DNS changes, credentials, migrations, deployment, or production access; those require separate written authorization.

### D02–D12 evidence checklist

Keep each decision **PENDING / UNVERIFIED** until the stated evidence exists and the acceptance criterion in the register is met. Provider capabilities are unknown unless evidenced by the provider.

| Decision | Evidence still required | Acceptance check |
|---|---|---|
| D02 Runtime/deployment | Provider-supported Node version, supervision, limits, deployment/rollback method, and native `sharp` compatibility. | Dependencies supported within owner-approved sizing and documented operation. |
| D03 Hostname/TLS/routing | Approved hostname/authority, DNS mapping, certificate chain/SAN/renewal, ingress/proxy/firewall/API routing and forwarded-header policy. | Staging-only routing and valid HTTPS; documented routes verified through ingress. |
| D04 PostgreSQL | Sanitized service/version/identity, network boundary, staging database, role grants and runtime/migration separation, synthetic-data declaration. | Independent of production/preview; least-privilege access verified over approved paths. |
| D05 Upload storage | Storage identity, persistence/capacity/encryption/ACL, upload isolation, paired DB/file backup scope. | Staging-only storage; served roots immutable to runtime; persistence/restore checks pass. |
| D06 Secrets | Secret manager/delivery mechanism, named custodians/readers, access audit, distinct staging values, rotation/revocation process. | Least-privilege staging-only values, independently revocable and never reused from production/preview. |
| D07 Admin/synthetic tests | Admin/MFA/ingress policy, synthetic accounts/data and cleanup owner, payment/messaging/production side-effect suppression evidence. | Only approved testers can access admin; no real customer or production effect can occur. |
| D08 Cost | Itemized quote, currency/period, quotas/overages/shutdown terms, numeric cap and signed spending approval. | All cost categories and overage actions approved before paid provisioning. |
| D09 Backup/restore | Retention/encryption policy, numeric RPO/RTO, named operators and independent reviewer, isolated paired restore evidence/timing. | Reviewer confirms integrity and app/DB/upload consistency within approved objectives. |
| D10 Monitoring | Health/error/capacity/backup alerts, receiver/acknowledgement, log access/redaction/retention, escalation owners. | Approved synthetic alert acknowledged and response ownership demonstrated. |
| D11 Rollback | Named release/DBA authorities, measurable stop triggers, app/schema recovery plan and staging rehearsal evidence. | Rehearsal recovers app/schema/data and passes recorded health/invariant checks. |
| D12 CI/CD | Actual rules/review/check/environment settings, Actions permissions, credential scopes, ref restrictions and immutable artifact SHA/provenance. | Approved refs/environment only, staging-only access, and production separation demonstrated. |

### Provider capability questionnaire (prepared, not sent)

1. Identify provider, billing account/project, region, accountable support owner, and whether a technically separate staging account/project can be used.
2. Which supported Node versions include Node 22? Describe process supervision, restart behavior, CPU/RAM/disk quotas, outbound network policy, deployment interface, and native `sharp` build/runtime support.
3. Can staging use a dedicated hostname and ingress? Describe customer DNS responsibilities, routing for `/api`, port/firewall controls, trusted proxy headers, TLS certificate issuance/renewal, and how SAN/chain/expiry are evidenced.
4. Is a dedicated PostgreSQL service/cluster/version available? Describe private networking, encryption, database/role/grant isolation, maintenance, access audit, backups, and proof staging shares no production or preview cluster/volume/credential.
5. What isolated persistent upload storage is available? Describe identity/ACL, encryption, capacity, lifecycle/retention, restart behavior, snapshots, paired DB/file backups, and restore-to-new-target capability.
6. What secret-delivery mechanism is supported? Can staging-only secrets be scoped to named principals, audited, rotated and revoked independently of production? Do not send secret values.
7. Which administrator access restrictions are available (VPN, identity-aware proxy, source-IP filtering or alternative), and can MFA/ingress policy be evidenced? How can outbound email, payment and push notifications be disabled or sandboxed?
8. Provide itemized one-time and recurring estimates for compute, DB, storage, backups, bandwidth/egress, DNS/domain, TLS, monitoring/logging and support. State currency, billing period, quotas, overage charges/alerts and shutdown/retention fees.
9. What backup retention, encryption/key ownership and restore options exist? Can a paired database/upload restore to a new isolated target be measured against an owner-approved RPO/RTO?
10. What health/log/metric collection, retention, redaction, alert delivery, acknowledgment and incident escalation are supported? Identify service boundaries and support-response expectations.
11. Can CI/CD use a separately protected staging environment with reviewers, approved ref restrictions, staging-only deploy identity, least-privilege runner token and immutable artifact digest without production access? Supply sanitized capability evidence.
12. Which capabilities are unavailable, separately billed, customer-managed, or require a support plan? Identify evidence the provider cannot supply.

These questions are informational only. No provider communication was sent.

### Manual GitHub verification checklist for an authorized repository administrator

1. Confirm the canonical owner/repository and default branch; the local `github` remote is `MyTestProjects007/ShopademiaAdmin`, but the `TestingWeb` remote also exists and repository identity should be confirmed.
2. In **Settings → Branches** and **Settings → Rules → Rulesets**, inspect applicable rules for the default/release branches: required PR reviews and approval count, required status checks, stale-review dismissal/last-push approval if required, direct-push restrictions, bypass actors, and enforcement state. Save sanitized screenshots/export and observation time.
3. In **Settings → Environments**, inspect staging and production separately: required reviewers, self-review policy, wait timers/protection rules, allowed branches/tags, deployment history, and whether each secret/variable is scoped to an environment or available repository-wide. Do not reveal values.
4. In **Settings → Actions → General**, inspect default and workflow token permissions, allowed actions, fork-PR token behavior, and approval policy. Compare the remote workflow SHA/content with the reviewed local workflow.
5. For every deploy workflow/job, record event/ref conditions, `permissions`, `environment`, secrets/variables referenced and scope, runner, artifact build/test provenance, immutable artifact digest, and separation between staging and production credentials/targets.
6. Have an authorized administrator or a permitted read-only credential return this evidence. Do not grant new permissions, modify settings, trigger deployment, or paste secret values as part of verification.

## Final pre-staging verification — 2026-10-14

### Follow-up verification — 2026-10-14 10:56 +06

- Rechecked baseline: branch `feature/admin-v2`, HEAD `798e7227e907edbbd262e8fe25b78d9e79cd7247`, upstream `github/feature/admin-v2`; no staged changes. Existing dirty and untracked work remains preserved.
- `npm.cmd test`: exit 0, **132 passed, 0 failed, 0 skipped**.
- `node --test scripts\playwright-target.test.js`: exit 0, **7 passed, 0 failed**.
- `npm.cmd run test:e2e -- --list`: exit 0; **9 tests in 1 public storefront spec**. `npm.cmd run test:e2e` against the configured loopback target: exit 0, **9 passed**. No privileged or prohibited flow was selected.
- With explicit privileged opt-in set, `npm.cmd run test:e2e:all -- --list` against `127.0.0.1`: expected exit 1, **0 tests discovered**, both privileged specs rejected loopback before browser startup.
- `npm.cmd audit --audit-level=low`: exit 0, found **0 vulnerabilities**. `npm.cmd config get offline` returned `false`; registry was `https://registry.npmjs.org/`, so this was a fresh online advisory query.
- Dedicated secret scanners (`secretlint`, `gitleaks`, `trufflehog`, `detect-secrets`) and a repository secret-scan script/dependency were unavailable. The prior ephemeral Secretlint result is historical, not a scan rerun for this follow-up; its seven potential DB-URL pattern matches remain subject to manual review, including `.env.example` line 9. No values were displayed.
- `npm.cmd run validate:staging`: expected exit 1 because `.env.staging` is absent. No secret/configuration was fabricated. `git diff --check`: exit 0.

No approval decision has been supplied. The following remain outstanding and must be answered by the named owner/provider before a target-specific provisioning plan:

| External decision | Current state | Required approver/evidence |
|---|---|---|
| Provider/account/project/region, target ownership and accountable operators | UNVERIFIED | Business/account owner selects the exact target, region, billing account, technical/security/DBA/release owners, and provides scope/separation approval. |
| Runtime/process model, Node version, CPU/RAM/disk limits, deployment and native `sharp` compatibility | UNVERIFIED | Provider confirms supported runtime, process supervision, sizing/quotas, deployment interface, egress and native module compatibility. |
| Staging hostnames, DNS authority, ingress/API routing, HTTPS/TLS, proxy headers/firewalls | UNVERIFIED | Domain/network owner approves hostname; provider supplies ownership/mapping, cert chain/renewal, routing and access-control evidence. |
| Separate PostgreSQL service/version/database/network and least-privilege roles | UNVERIFIED | DBA/provider supplies sanitized server/database identity, network boundary, grants, migration/runtime role split, encryption and proof of no production/preview sharing. |
| Persistent uploads/storage and paired backup coverage | UNVERIFIED | Storage owner confirms isolated volume/object store, ACLs, encryption, capacity, restart behavior and backup/restore scope. |
| Secret manager, unique staging secrets, access/audit/rotation policy | UNVERIFIED | Security owner/secret custodian specifies approved store, authorized readers, delivery method and rotation/revocation owners. No values belong in this request. |
| Admin access restrictions and synthetic identities/data | UNAPPROVED | Business/security owners approve ingress restriction, MFA, role/shop test accounts, synthetic-only data, outbound payment/notification suppression and cleanup authority. |
| Itemized cost, recurring/one-time charges, budget cap and overage policy | UNVERIFIED | Billing owner provides provider quote, currency/period, quotas, budget cap, alert and shutdown policy and written spending authorization. |
| Backup retention, RPO/RTO, independent restore reviewer/operators | UNAPPROVED | Business/DBA/operations owners set retention/RPO/RTO and name restore operator plus independent reviewer; provider confirms restore capability. |
| Monitoring, alert receiver, log retention/redaction, incident escalation | UNVERIFIED | SRE/security owner names systems, thresholds, receiver, test-alert acknowledgment and primary/backup escalation contacts. |
| Rollback triggers, recovery procedure and release authority | UNAPPROVED | Release owner/DBA approve measurable stop triggers, app/schema recovery choice, rollback decision-maker and rehearsal evidence. |
| CI/CD environment approvals, branch/ref restrictions, secrets and artifact provenance | UNVERIFIED | Repository administrator supplies read-only evidence of branch rules, required checks/reviews, protected environment reviewers, Actions permissions, scoped secrets and immutable artifact policy. |

### Repository-level CI/CD evidence and access limitation

Local source inspection of `.github/workflows/ci.yml` shows `contents: read`; test/audit jobs run on pull requests and pushes. Production deployment is conditioned on a push to `main` and `CPANEL_DEPLOY_ENABLED == 'true'`, follows the test job, declares no GitHub `environment`, and references `${{ secrets.CPANEL_SSH_KEY }}` / `${{ secrets.CPANEL_KNOWN_HOSTS }}`. Because no environment is declared, the actual organization/repository secret availability and scope cannot be inferred from this file. This is workflow-source evidence only. Current read-only REST calls were rate-limited (403), the repository branch lookup returned 404, and no GitHub CLI was available; actual branch-protection rules, required checks/reviews, environment reviewers, action allowlists, and secret scopes remain unknown. Do not infer they are enabled or absent.

The local static path guard detects out-of-root symlink/junction resolution before `express.static`, but cannot eliminate the check-to-open race if filesystem paths can be concurrently replaced. No exploit was demonstrated. Before any hosted release, require operator-only access and immutable/read-only code/public-asset mounts, with uploads isolated and writable only by the app; obtain a stronger platform-specific confinement design if the threat model includes a concurrent filesystem writer.

## Current evidence and boundary

- No staging provider/account, region, hostname, DNS mapping, staging secret, or hosted staging service is identified or verified.
- The repository contains a candidate Compose design for an application, migration job, PostgreSQL, and Caddy. It expresses an internal database network and named database/upload volumes, but configuration is not evidence that a provider offers or runs these capabilities.
- Repository CI tests on Node 22; the app declares Node `>=20`. Native `sharp` compatibility must be confirmed on the selected runtime.
- The CI deploy job is production-specific and main-only. No verified staging deployment workflow, protected staging environment, or staging credential scope is established.
- The local read-only preview is not staging. No staging resources should share its database, storage, or credentials.
- `.env.staging` is absent, and `npm.cmd run validate:staging` correctly fails closed. Do not create a placeholder or fabricate configuration to satisfy validation.

## Decisions requiring approval

### A. Business and release-owner decisions

| Decision | Approver | Approval/evidence requested | Implementation dependency |
|---|---|---|---|---|---|---|
| Provider, account/project, region, target owner | Business/release owner; account/billing owner | Select the provider, exact account/project/subscription and region; name accountable owner, operator and escalation contact; confirm staging is organizationally and technically separate from production. Provider/account existence and capability are currently **UNVERIFIED**. | Required before any provisioning plan, access request, or resource creation. |
| Scope and release authority | Business/release owner | Define the purpose, permitted release refs/SHA, test window, approving authority, authorized operators, stop conditions and explicit limits of the staging exercise. | Required before staging deployment, migrations, or authenticated/write testing. |
| Test-data and integration policy | Business owner; security/privacy owner | Approve synthetic-only accounts/data; identify cleanup owner; prohibit real customer data, real payments, customer notifications, and production integrations unless separately authorized. | Required before seeding, checkout, notification, or workflow tests. |
| Cost ceiling and spending authorization | Billing owner; business/release owner | Approve itemized one-time and recurring estimates by currency and billing period, quotas, budget cap, overage alerts, shutdown/retention policy, and written spending authorization. Actual prices and paid capabilities are **UNVERIFIED**. | Required before enabling billable resources or provider features. |
| Availability and recovery objectives | Business/release owner; operations owner | Approve service window/availability expectation, RPO, RTO, maintenance window and recovery priority. | Required to select sizing, backups, monitoring thresholds and rollback triggers. |

### B. Provider/account confirmations

| Decision | Approver | Provider evidence requested | Implementation dependency |
|---|---|---|---|
| Runtime and process model | Hosting provider/account operator | Confirm a supported isolated VM/container/app runtime, Node version including Node 22 option, long-running process/supervision, restart behavior, build/deploy interface, outbound network needs, resource limits (CPU/RAM/disk), quotas, and compatibility path for native `sharp`. These capabilities are **UNVERIFIED**. | Required before selecting the final deployment model/image and resource profile. |
| Hostnames, DNS authority and routing | Domain/DNS owner; provider/network operator | Identify approved staging hostname(s), prove DNS control, map each hostname to staging ingress, specify API routing/path behavior, firewall/public/private exposure, available ports and trusted proxy/header behavior. No hostname is selected. | Required before certificate requests, target configuration or any external browser test. |
| HTTPS/TLS and reverse proxy | Provider/network operator; security owner | Confirm TLS termination option, certificate issuance/renewal, supported TLS policy, proxy configuration, redirect/HSTS behavior, access restrictions, health/routing visibility and sanitized logs. Caddy is a repository proposal only; provider TLS/proxy capability is **UNVERIFIED**. | Required before any staging endpoint is considered testable or safe for credentials. |
| PostgreSQL service and isolation | Provider/DBA; security owner | Confirm PostgreSQL service/version and isolation model; private-only connectivity; distinct staging database/cluster, migration owner and least-privilege runtime role; grant/ownership inspection; encryption, maintenance and capacity limits. Confirm no production or preview sharing. Provider database features are **UNVERIFIED**. | Required before configuring database URLs, provisioning secrets, migration or app startup. |
| Persistent upload storage | Provider/storage owner; application owner | Confirm dedicated persistent volume or approved object storage, app identity/access policy, encryption, capacity/quota, lifecycle/retention, restart behavior, and paired backup/restore coverage. Compose's named volume is not provider evidence. | Required before testing uploads or deploying a release that handles files. |
| Secret storage and access | Provider/account operator; security owner | Identify approved secret manager and access-control/audit capabilities; authorized readers and rotation/revocation operators; secret delivery mechanism. Never provide secret values in this approval record. Provider capability is **UNVERIFIED**. | Required before generating or storing staging-only credentials/keys. |
| Backup/monitoring services | Provider/account operator; operations owner | Confirm available DB and file backup mechanisms, off-host/encrypted retention options, restore destinations; logging/metrics/alert integrations, retention, access and delivery. All provider features are **UNVERIFIED**. | Required before staging acceptance; backup/restore must be rehearsed before release. |

### C. Security and operational approvals

| Decision | Approver | Approval/evidence requested | Implementation dependency |
|---|---|---|---|
| Isolation and least privilege | Security owner; DBA; provider operator | Approve distinct staging network, database, roles, storage and credentials; private DB path; app role limited to runtime needs; migration role used only for approved migration. Require sanitized identity/grant/network evidence and proof no production/preview resource is shared. | Required before any connection string is configured or migration runs. |
| Secrets and rotation | Security owner; secret custodian | Approve unique staging-only DB passwords, JWT signing key, MFA encryption key, and any needed integration keys; define readers, audit, rotation, revocation and incident process. Production and local-preview secrets must not be reused. | Required before login/session tests or any app startup requiring these values. |
| Admin access restrictions | Security owner; business owner; provider operator | Choose supported restriction (for example VPN, identity proxy, or IP allowlist only if confirmed available), MFA policy, named synthetic roles/accounts, credential reset owner, session invalidation process and admin audit retention. | Required before creating or enabling synthetic admin identities. |
| Backups, restoration and recovery ownership | DBA; operations owner; independent restore reviewer | Approve DB + upload backup pairing, encryption/key handling, retention, off-host location, restore-to-new-target-only rule, independent reviewer, named primary/backup operators, escalation path, RPO/RTO and evidence retention. | Required before relying on staging recovery; successful isolated restore is a release gate. |
| Monitoring, alerts and logging | SRE/operations owner; security/privacy owner | Name health/availability/error/latency/DB-capacity/disk/backup alerts, receiver, acknowledgement path, retention/redaction/access policy and on-call escalation. Approve a synthetic alert test. | Required before staging release and before any extended test window. |
| Rollback and release decision | Release owner; application owner; DBA | Define measurable rollback/stop triggers; app artifact rollback; migration compatibility/forward-repair or restore decision; who can halt/recover; required rehearsal and sign-off. | Required before first staging deployment or schema migration. |

### D. Technical implementation tasks after approval

These are engineering actions for a later, separately reviewed provisioning plan—not authorized work in this request.

| Task | Responsible role | Required evidence | Depends on |
|---|---|---|---|
| Produce target-specific isolation/network and resource diagram | DevOps + provider operator | Approved account/region, identities, ingress/egress, app/DB/storage boundaries and no shared production resources | A1, B1-B5, C1 |
| Prepare target-specific runtime and configuration | DevOps + application owner | Selected Node/runtime, immutable commit/image, `sharp` smoke, protected staging-only configuration, successful fail-closed validation without exposing values | A1, B1, B6, C1-C2 |
| Implement protected staging CI/CD path | Repository administrator + DevOps | Protected environment approvals, source/ref limits, staging-only credentials, minimal runner permissions, immutable artifact provenance, successful test gates; no production secrets/target | A2, B1, C2, C6 |
| Provision and verify PostgreSQL/roles | DBA + provider operator | Sanitized server/database identity, version, network proof, role grants, migration/runtime separation and app connection identity | B1, B5, C1 |
| Verify hostname/TLS/API routing | Network operator + QA | DNS ownership and mapping, certificate chain/SAN/SNI/expiry, HTTPS redirect, proxy header policy, `/healthz`, storefront/API routes and request IDs | B2-B3, C1-C2 |
| Establish storage, backup, restore and monitoring | Storage/DBA/SRE | Upload persistence, paired backups, checksum/decrypt/list verification, isolated restore results, measured RPO/RTO, test alert receipt and escalation record | B4, B7, C4-C5 |
| Execute authorized staging acceptance and rollback rehearsal | QA/security + DBA + release owner | Synthetic auth/MFA/tenant/session tests, checkout/order/inventory/upload tests, baseline/post-test invariants, cleanup, logs/request IDs, rollback proof and approval | A2-A5, C1-C6 and all prerequisites above |

## Concise provider questionnaire

Please answer each item with **Yes / No / Not offered / Requires upgrade**, supporting evidence, constraints, and any cost. Do not send secrets.

1. Which provider, account/project, and region will host the isolated staging target, and who owns/administers it?
2. Is an isolated VM/container runtime with long-running process supervision available? Which Node versions (including Node 22), resource limits, deployment methods, and native-module constraints apply?
3. Can you provide an owner-controlled staging hostname, DNS mapping, HTTPS certificate issuance/renewal, reverse proxy, API routing, firewall rules, and trusted forwarded-header configuration? Which parts are customer-managed?
4. Is a separate PostgreSQL service/cluster supported? State versions, private network options, database/role isolation, backup, maintenance and access-audit capabilities.
5. What persistent upload storage is available, and how are encryption, access, capacity, retention, backups and restores handled?
6. Which secret manager or secure secret-delivery mechanism is available? Can access be restricted/audited and values rotated/revoked independently of production?
7. Which admin-ingress controls are supported (VPN, identity proxy, source-IP allowlist, or equivalent), and what evidence can be supplied?
8. What are one-time and recurring charges for compute, database, storage, backups, bandwidth/egress, DNS/domain, TLS, monitoring/logging and support? State currency, billing period, quotas, overages and shutdown charges.
9. What DB and upload backup retention/restore options are available? Can a restore be performed to a new isolated target and timed for an agreed RPO/RTO?
10. What monitoring, log retention/redaction, alert delivery, escalation and support response capabilities are available?
11. Can the target support a separately protected staging CI/CD environment with staging-only credentials and immutable artifact deployment, without access to production credentials or hosts?

## Approval and evidence checklist

### Business/release owner

- [ ] Provider, account/project, region and accountable owners approved.
- [ ] Staging purpose, permitted refs/SHA, test scope, operators and release authority approved.
- [ ] Synthetic-only dataset, test accounts, cleanup owner, and real payment/customer/notification prohibitions approved.
- [ ] Itemized costs, currency/period, quotas, budget cap, overage alerts and spending authorization approved.
- [ ] RPO/RTO, availability expectations, escalation contacts, stop conditions and rollback authority approved.

### Provider/account owner

- [ ] Runtime/process model, Node version, native `sharp` compatibility, resource limits and deployment interface evidenced.
- [ ] Hostname/DNS authority, ingress target, API routes, firewall, TLS/certificate and proxy behavior evidenced.
- [ ] Separate PostgreSQL service/version, private route, distinct database/roles and non-sharing evidence supplied.
- [ ] Persistent uploads, access policy, encryption, capacity and DB+file backup coverage supplied.
- [ ] Secret-manager capability, access policy, rotation/revocation mechanism, monitoring and support boundaries documented.
- [ ] One-time/recurring quote and provider limits supplied.

### Security/operations/release

- [ ] Staging-only secrets and access policy approved; no production/local-preview reuse.
- [ ] Admin restrictions, MFA, synthetic identities, session invalidation, logs and audit policy approved.
- [ ] Backup retention, restore destination, independent reviewer, recovery operators and RPO/RTO recorded.
- [ ] Monitoring checks, alert receiver, test-alert acknowledgement and escalation ownership recorded.
- [ ] Rollback triggers and separate app/schema recovery procedure approved and rehearsed.
- [ ] Staging CI/CD environment permissions, artifact provenance, staging-only credentials, and production separation evidenced.

## Exact external decisions still outstanding

At minimum, the release owner must select/approve the provider/account/region and named owners; staging hostname(s) and provider-confirmed DNS/TLS/routing capability; runtime and resource profile; PostgreSQL service/version and isolation; upload storage; secret manager and access policy; admin access restrictions and synthetic test policy; itemized costs and budget cap; backup retention and RPO/RTO; monitoring receiver/escalation; rollback/recovery authority; and staging CI/CD permissions/secrets.

Once these are approved and the provider returns evidence, engineering should prepare a separate, target-specific provisioning plan and evidence checklist for review. This request does not authorize that provisioning.

## Release status

No provider was contacted, and no infrastructure, DNS, credentials, environment files, database, or deployment was changed for this request. `.env.staging` remains absent and validation remains fail-closed. **Staging remains BLOCKED / NOT READY. Production remains NO-GO.**

Related evidence: [staging target approval brief](./STAGING_TARGET_APPROVAL_BRIEF.md), [staging readiness audit](./STAGING_READINESS_AUDIT.md), [deployment runbook](./DEPLOYMENT_RUNBOOK.md), [candidate staging Compose](../docker-compose.staging.yml), [CI workflow](../.github/workflows/ci.yml).
