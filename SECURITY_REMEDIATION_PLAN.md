# Shopademia Security Remediation Plan

## Completed in this assessment

| Priority | Action | Result | Evidence |
|---|---|---|---|
| P2 | Reject documented example admin password text consistently in local bootstrap and production migration. | Complete | `validateAdminPassword`; regression test; full suite 124/124. |

This correction prevents new bootstrap/migration initialization with common example-prefix values. It does not update an existing administrator credential, rotate previously exposed secrets, or prove that an account is secure.

## Required next actions

| Priority | Action | Completion evidence |
|---|---|---|
| P0 | Identify whether any previously exposed synthetic secret was reused outside the isolated preview; do not access external environments without authorization. | Owner-approved scope statement and secret inventory metadata (names/purpose only). |
| P0 | Rotate exposed local database/admin/JWT/MFA-related values through supported mechanisms and revoke dependent sessions/tokens. | Protected config permission evidence; sanitized startup identity; DB role verification; session invalidation result; no values in logs. |
| P1 | Establish a documented synthetic administrator reset/provisioning path that handles the existing insert-only credential row safely. | Approved procedure, isolated target identity, pre/post metadata, and credential never shown to the test runner/report. |
| P1 | Restart only the isolated local preview after configuration and target checks; perform authenticated browser/API tests with synthetic roles. | Application-to-database identity check, working synthetic login, screenshot/trace with secrets redacted, and cleanup verification. |
| P1 | Verify role/function/property and cross-shop access with synthetic accounts; test cookie CSRF, MFA replay, session expiry/revocation, and direct-route behavior. | API/browser evidence and regression tests per route/role. |
| P1 | Verify production/staging secret isolation, database roles, network binding, TLS, backup restore, monitoring receipt, rollback, and named operators. | Independent documented evidence per gate; no inferred success from configuration. |
| P2 | Execute bounded live concurrency/recovery tests against an explicitly disposable database. | Baseline, unique fixture inventory, measured results, cleanup query and final counts. |
| P2 | Review log retention, customer data minimization, external push configuration, CI protection rules, and deployment identity. | Owner-approved operational evidence and focused remediation where required. |

## Safe sequencing

1. Keep the preview and database stopped while unsupported reset/rotation steps remain unresolved.
2. Approve and document the isolated local secret source and admin reset procedure.
3. Confirm database identity and role with sanitized read-only queries before any write.
4. Rotate secrets by purpose; do not change repository `.env` or production/staging configuration as a substitute.
5. Invalidate sessions/tokens affected by key/password rotation and verify rejection.
6. Start the local preview bound to loopback; verify database identity again.
7. Run authenticated tests with synthetic identities; record baselines and fixture ownership before writes.
8. Clean up only test-created fixtures and verify their absence.
9. Re-run tests, dependency audit, and diff hygiene.
10. Keep staging blocked and production NO-GO until their independent gates pass.

## Explicitly out of scope

No commit, push, deployment, staging/production access, production migration, public DNS/firewall change, real payment/notification/fulfillment, destructive DB operation, or administrator credential guess is authorized.
