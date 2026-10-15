# Shopademia Security Findings

## Finding F-001 — Local bootstrap accepted example administrator password text

- **Severity:** Medium (conditional configuration weakness; no unauthorized access observed).
- **Confidence:** High.
- **Status:** FIXED — regression test passed.
- **Affected components:** `server/index.js`, `server/adminPassword.js`, `server/migrate.js`.
- **Preconditions and privilege:** An operator copies the local example configuration and leaves the example administrator password value unchanged, then starts a fresh non-production application database. An attacker would additionally need access to the admin login endpoint and knowledge of that documented example value.
- **Evidence:** Before this change, non-production startup checked only that `ADMIN_PASSWORD` was at least 12 characters and `hashAdminPassword` accepted any value of that length. The production migration script separately rejected common example prefixes, but local bootstrap did not. The correction centralizes password validation and invokes it before initialization/migration database work. The regression test rejects both supported example-prefix patterns and accepts a synthetic non-placeholder passphrase.
- **Impact:** On a fresh local environment left at the published sample value, an administrator account could be initialized with a predictable password. Exposure depends on the preview being reachable and the operator failing to replace the example.
- **Root cause:** Inconsistent validation between local bootstrap and production migration; example text met the minimum-length requirement.
- **Remediation:** Shared `validateAdminPassword` rejects example placeholder prefixes; bootstrap and migration call it before database initialization. Existing initialized credentials are not changed by this validation and still require a supported reset/rotation path.
- **Regression and retest:** `npm.cmd test` — 124 passed, 0 failed, 0 skipped, including `admin password validation rejects example placeholders`.
- **Residual risk:** No administrator login was attempted. Previously exposed synthetic local credentials remain unrotated; this code change does not rotate them.

## Finding F-002 — Synthetic local launch secrets appeared in parent-process command text

- **Severity:** Medium (local same-account/process-inspection exposure; external reuse is unknown).
- **Confidence:** High that the prior preview launch included secret-bearing values in command text; unknown whether any value was reused outside the isolated preview.
- **Status:** ROTATED FOR THE ISOLATED PREVIEW; external reuse remains unknown.
- **Affected boundary:** Local PowerShell launcher to Node process, database credentials, JWT signing material, and any other secret-bearing launch variables.
- **Evidence:** The preceding environment investigation observed secret-bearing values in the parent PowerShell command text. Only variable names and purposes are retained in this report. On 2026-10-13, the existing PostgreSQL 16 cluster was verified and backed up offline, then its isolated app-role password was rotated. A protected local configuration was installed and TCP authentication verified against the exact preview database/role. The application administrator password and JWT signing key were also rotated; separate MFA/settings encryption keys were configured after read-only checks found zero encrypted MFA or admin-setting rows. Session versions were advanced and existing sessions revoked. The preview now listens only on loopback; no secret values were printed or found in app logs/process arguments.
- **Affected configuration names/purposes:** `DATABASE_URL` (database connection/authentication), `ADMIN_PASSWORD` (non-production administrator bootstrap), and `JWT_SECRET` (session-token signing and fallback MFA-key derivation). `MFA_ENCRYPTION_KEY` is the dedicated MFA-secret encryption key; whether it was set in the affected command is unconfirmed. No values are included.
- **Impact:** A process-command observer with sufficient local access could recover launch values. Reuse outside the isolated synthetic preview could increase the impact, but that scope has not been investigated and no staging/production access was authorized.
- **Root cause:** Secret injection through command text rather than a protected local configuration/secret source.
- **Remediation:** The isolated preview values were replaced using a protected local configuration and offline PostgreSQL administration. Existing sessions were invalidated, database identity/loopback binding was reverified, and app logs/command arguments were checked. The repository `.env` and external environments were not changed.
- **Regression and retest:** `npm.cmd test` — 124 passed; `npm.cmd run test:api` — 78 passed; `git diff --check` passed. Replaced administrator password matched the repository's scrypt verifier; no live login was performed.
- **Residual risk:** It is unknown whether any exposed values were reused outside the local synthetic preview. Those external copies remain potentially compromised; no staging/production investigation or rotation was performed.

## Finding F-003 — Bootstrap environment change does not rotate an existing administrator credential

- **Severity:** Medium.
- **Confidence:** High for the insert-only behavior; runtime credential state was not checked.
- **Status:** LOCAL SYNTHETIC PREVIEW CREDENTIAL RESET COMPLETED; live login remains unverified.
- **Affected components:** `server/db.js` administrator bootstrap and `admin_credentials`.
- **Preconditions and privilege:** An administrator row already exists and an operator changes `ADMIN_PASSWORD` believing the value will replace the stored password.
- **Evidence:** `initializeDatabase` remains insert-only on conflict. For the verified isolated preview, the existing singleton credential and its matching `admin_users` record were updated together offline using `hashAdminPassword` from `server/adminPassword.js`; session versions were advanced and session rows revoked. A read-only check confirmed the new configured password verifies against the application scrypt hash without performing a login.
- **Impact:** A prior password can remain valid despite an assumed rotation, so exposure response may be ineffective. This is especially relevant to the previously exposed synthetic local launch values.
- **Root cause:** Bootstrap is intentionally insert-only and there is no established unauthenticated local reset workflow.
- **Remediation:** The one-time reset was performed only against the verified synthetic preview cluster after a verified offline backup, using the application's existing scrypt hasher and a guarded exactly-one-account update. Bootstrap semantics were not changed. No generic reset command was added.
- **Regression and retest:** The configured replacement password verifies with the application hasher; both credential hashes match and unrevoked sessions count is zero. `npm.cmd test` — 124 passed; `npm.cmd run test:api` — 78 passed. No authenticated login was performed.
- **Residual risk:** Admin login/session behavior after reset remains untested live. This reset applies only to the isolated preview, not any staging/production account.

## Security-review scope note

A bounded read-only review of the then-current changes reported no vulnerabilities in the reviewed diff. It did not perform tests, database checks, live authentication, or infrastructure verification. That result is not a whole-project clearance and does not replace the findings and limitations above.
