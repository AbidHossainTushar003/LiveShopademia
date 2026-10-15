# Shopademia Incident and Recovery Readiness

## Local preview recovery update — 2026-10-13

The isolated local preview was recovered using the existing PostgreSQL 16.15 cluster; no cluster replacement or authentication-policy weakening was performed.

- Official PostgreSQL 16 [single-user mode](https://www.postgresql.org/docs/16/app-postgres.html#APP-POSTGRES-SINGLE-USER) was used only after a clean stop and a complete offline backup. The backup contains 1,386 files; every copied file's SHA-256 matched the stopped source cluster and both cluster system identifiers matched.
- The database was verified as `shopademia_browser_preview`, owned by the login role `shopademia_browser_preview`. The database role password was replaced offline; protected-config TCP authentication then succeeded. The application account password was reset using `server/adminPassword.js`'s scrypt hasher. Both credential hashes were synchronized and session versions advanced; existing admin sessions were revoked. No admin login was attempted.
- Before key rotation, read-only inspection found zero encrypted MFA records and zero encrypted admin-setting records. A separate `MFA_ENCRYPTION_KEY` and `ADMIN_SETTINGS_ENCRYPTION_KEY` are now configured, so JWT signing-key rotation does not orphan stored ciphertext. The new configuration is outside the repository at `%LOCALAPPDATA%\\Shopademia\\preview-recovery\\shopademia.env`; its protected Windows ACL grants access only to the current account and SYSTEM. No secret values are recorded here.
- Startup completed the existing idempotent database initialization. The only versioned migration (`001_admin_foundations`) was already applied with a checksum matching the checked-out source. Pre-start inventory showed zero platform-admin memberships to clean up and zero product/order rows needing shop backfill.
- Authenticated read-only SQL confirmed `SELECT 1`, current database and role, one synthetic product, zero orders, one administrator credential, and zero encrypted MFA records. Post-start counts remained unchanged; schema migration rows remain at two (legacy baseline plus the applied migration).
- The app listens only on `127.0.0.1:3002`; PostgreSQL listens only on `127.0.0.1:55441`. Live checks passed for `/healthz` (HTTP 200, `{"status":"ok"}`), `/`, `/api/v1/products` (the synthetic preview product), `/product/{id}` (rendered in Playwright), and `/admin` (sign-in form rendered). The browser's anonymous admin request returned the expected 401; no credentials were submitted.
- `npm.cmd test`: 124 passed, 0 failed, 0 skipped. `npm.cmd run test:api`: 78 passed, 0 failed, 0 skipped. `git diff --check` passed. Secret-value scans found no replacement values in app logs or process arguments.
- Branch and HEAD remain `feature/admin-v2` / `798e7227e907edbbd262e8fe25b78d9e79cd7247`. Existing security changes/reports, all 1,000 unique scenario IDs, and the untracked `Docker Desktop Installer.exe` remain preserved. No commit, push, deployment, staging/production access, or checkout/order write occurred.
- The prior exposed values remain potentially compromised if reused outside this synthetic preview; that scope was not investigated. Staging remains **BLOCKED / NOT READY** and production remains **NO-GO**.

## Known local secret exposure

Prior preview launch configuration placed secret-bearing values in parent PowerShell command text. Treat those synthetic values as exposed. This report records variable names/purposes only and does not include values.

- **Known security-relevant names/purposes:** `DATABASE_URL` (database connection/authentication), `ADMIN_PASSWORD` (non-production administrator bootstrap), and `JWT_SECRET` (session signing and fallback MFA-key derivation). `MFA_ENCRYPTION_KEY` is the dedicated MFA-secret encryption key; whether it was explicitly set in the affected command remains unconfirmed.
- The 2026-10-13 recovery update above supersedes earlier statements in this report that the preview was stopped and that local rotation/reset had not been completed.
- No evidence establishes that any exposed value was reused outside the isolated local preview. External scope must not be inferred or investigated without authorization.
- No production/staging access, customer-data inspection, or incident containment outside the local preview occurred.

## Containment and recovery procedure

1. Keep the affected local preview stopped until an approved protected secret source and reset procedure are available.
2. Preserve relevant local process/log metadata without copying secret values into tickets, screenshots, or reports.
3. Determine the affected secret categories from trusted configuration metadata: database role, administrator credential, JWT signing key, MFA encryption key, and other enabled integration keys.
4. For each category, use the supported local-only rotation procedure. Do not change unrelated `.env`, staging, or production values.
5. Rotate the database role credential through its authorized local database procedure; update the protected app configuration and verify sanitized database identity.
6. Change the existing administrator credential through a supported mechanism; bootstrap environment changes alone do not update an existing insert-only row.
7. Rotate JWT signing material only with an explicit MFA-key plan. If the MFA encryption key was derived from the JWT key, preserve/decrypt/re-encrypt enrolled MFA state through a supported procedure before retiring the old key. No such operation was performed here.
8. Revoke active sessions/tokens as appropriate and verify previously issued sessions fail.
9. Verify local secret-file access controls and Git exclusion without displaying file contents.
10. Restart only the isolated preview, re-confirm loopback binding and the intended database, then conduct read-only health checks.
11. If any secret may have been used outside the synthetic preview, stop and escalate to the authorized owner; do not probe staging/production.

## Evidence required to close

- Approved scope stating which synthetic local secrets were affected and whether reuse is ruled out.
- Protected configuration path and Windows ACL evidence without values.
- Per-secret rotation completion evidence; no claim based only on editing a file.
- Admin password reset confirmation and session invalidation result.
- MFA decryptability/re-enrollment validation if encrypted MFA state exists.
- Sanitized app/database identity and loopback listener checks after restart.
- Log review confirming no values were copied to test artifacts.

## Recovery readiness

Backup creation, independent restoration, RPO/RTO, restore validation, alert delivery, recovery operator assignments, and incident escalation were not independently tested. These remain staging and production release blockers.
