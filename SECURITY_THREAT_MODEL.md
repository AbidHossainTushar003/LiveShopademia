# Shopademia Security Threat Model

## System model

### Implemented architecture observed in source

- Browser storefront and admin pages are served by a Node.js/Express application.
- Express exposes public catalog, shop, configuration, customer order lookup, and checkout APIs; admin login/profile/session, product/category/order APIs; and a multi-shop platform API.
- PostgreSQL is the authoritative persistence layer. Managed products and orders are shop-scoped. Admin sessions, memberships, roles, permissions, settings, and audit events are database-backed.
- Product-image uploads are handled by the app and image processing; outbound web-push is optional.
- The staging Compose configuration describes a PostgreSQL service on an internal-only network, an application container, and Caddy publishing HTTP/HTTPS ports. This is configuration evidence, not proof of deployed behavior.
- CI runs tests and dependency audit with read-only repository permission and pinned action revisions. A separate deployment job is guarded by a push to `main` and an explicit repository variable.

The intended public domains in project documentation are architecture intent only. Domain ownership, DNS, routing, certificate state, and production target were not verified.

## Assets and security objectives

| Asset | Security objective |
|---|---|
| Admin credentials, MFA secrets, JWT signing key | Confidentiality, integrity, revocation and recovery |
| Customer order details and contact data | Confidentiality, scoped access and retention |
| Product, price, stock and availability records | Integrity and correct tenant scope |
| Order state, payment-review status and inventory reservation | Integrity, transition correctness and idempotency |
| PostgreSQL data and migrations | Confidentiality, integrity, availability and recoverability |
| Uploaded images and generated variants | Safe processing, tenant association and filesystem containment |
| Admin settings and audit trail | Confidentiality, integrity, attributable changes |
| Push subscription endpoints and VAPID keys | Confidentiality and safe outbound requests |
| CI deployment key and destination configuration | Restricted deployment authority and provenance |
| Backups, logs and incident evidence | Confidentiality, retention and recoverability |

## Principals and trust boundaries

- Anonymous internet/browser caller.
- Authenticated shop administrator, owner, staff, and platform administrator.
- Application process and PostgreSQL runtime/migration roles.
- Reverse proxy/Caddy to application network boundary.
- CI workflow and deployment host.
- Browser-to-API boundary, including cookie-authenticated state-changing requests.
- Application-to-PostgreSQL boundary.
- Application-to-upload storage/image processing boundary.
- Application-to-external web-push provider boundary.
- Operator workstation and local secret/process boundary.

## Main data flows and controls seen in source

1. Browser requests public catalog and storefront content. Public catalog endpoints use a rate limiter.
2. Browser submits checkout input. The server resolves current catalog prices and checks quantities/inventory rather than trusting client prices.
3. Admin login validates a password and optional MFA; subsequent tokens are checked against database session state. Cookie-authenticated API requests include origin/CSRF-related checks.
4. Admin requests pass authentication, role/permission, and shop-membership checks before shop-scoped operations.
5. Product/image inputs pass validation and upload/image processing before persistence.
6. Application code uses PostgreSQL through a pool; migration/setup functions create schema and bootstrap an admin. Runtime database role privileges were not verified during this assessment.
7. The optional push integration sends notifications through external push endpoints. No live send was performed.

## Attack trees

### Objective 1: Obtain administrator access

`Reach admin login` → exploit reusable/default bootstrap value, password reuse, or local secret exposure → satisfy password and any required MFA → obtain a valid DB-backed session → use role-scoped APIs.

- **Preconditions:** Reachable admin interface; weak/known credential or exposed secret; MFA requirements depend on environment/role.
- **Observed controls:** Scrypt password hashing, session records and expiry/revocation, production MFA requirement for platform administrators, rate limits.
- **Evidence gap:** No live credentials, MFA state, active preview, or authenticated session were available. Synthetic launch secrets remain unrotated.
- **Mitigations:** Rotate all exposed synthetic values; use the documented MFA process; independently test login, expiry, logout, and role boundaries in an isolated environment.

### Objective 2: Read or modify another shop's data

`Authenticate as lower-privilege shop member` → select/guess another shop or object identifier → exploit missing membership, object scope, or property-level check → access customer orders or alter products/status.

- **Preconditions:** Valid shop account and a cross-tenant target.
- **Observed controls:** Membership and tenant-scoped code paths; role changes/removals revoke affected sessions; automated mock/API tests cover selected membership/session cases.
- **Evidence gap:** No live cross-tenant identity or database was available for authenticated browser tests.
- **Mitigations:** Verify every object/function/property permission with at least two synthetic shops and roles; capture direct API responses and audit events.

### Objective 3: Manipulate checkout or oversell stock

`Submit checkout` → tamper with client prices/quantities or replay a request → exploit stale stock or inconsistent order/inventory transaction → obtain underpriced order or negative/oversold inventory.

- **Preconditions:** Public checkout endpoint and concurrent/replayed requests.
- **Observed controls:** Server-owned pricing, input bounds, event/idempotency handling, inventory reservation and rollback paths; automated rollback and conflict tests pass.
- **Evidence gap:** No live database concurrency or real checkout was run in this assessment.
- **Mitigations:** Retain transaction constraints; run bounded concurrency tests only against verified disposable test data; never trigger real payment/fulfillment.

### Objective 4: Exfiltrate or laterally use secrets

`Access operator/process/log/repository boundary` → obtain a database, JWT, MFA-encryption, or CI secret → use it against its intended service → pivot to admin sessions, data, or deployment.

- **Preconditions:** Local same-account process visibility, secret reuse, or control of an authorized secret store/workflow.
- **Observed evidence:** Synthetic values were previously exposed in PowerShell command text. The current environment has no preview/database listener. Rotation is incomplete.
- **Mitigations:** Rotate by secret purpose, revoke dependent sessions/tokens, avoid command-line secret transport, restrict local configuration ACLs, and verify non-secret metadata only.

### Objective 5: Disrupt or corrupt service through operations

`Compromise CI/operator or exploit unsafe migration/backup procedure` → deploy incorrect artifact or apply irreversible schema/data change → corrupt production data or prevent service recovery.

- **Preconditions:** Deployment authorization or operator/control-plane access.
- **Observed controls:** CI job has explicit branch/variable gate and pinned actions; staging migration guard exists. Backup restore, production ownership, branch protection, and recovery controls were not independently verified.
- **Mitigations:** Require independent release approval, protected environments, least-privilege credentials, tested backups/restores, reversible migration/rollback plans, and named on-call/recovery operators.

## Assumptions and open questions

- Runtime configuration and authorization are not inferred from `.env.example`, mocked tests, or Compose declarations.
- No customer account/password-reset feature, coupon redemption, refund provider, or payment webhook was identified in the inspected route inventory; the implementation includes manual payment review and optional push integration.
- The local isolated DB identity was verified in prior evidence but is stopped now. Current authentication and account state are not verified.
- Database least privilege, TLS to any remote database, external alert delivery, backup restore, DNS/domain ownership, and production exposure remain unverified.
