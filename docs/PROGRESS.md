# Shopademia admin program progress

Updated: 2026-10-12

## Current phase and authorization

- Current phase: **B1 — Foundation and Admin**
- The owner explicitly authorized implementation on 2026-10-12: “i approve all now implement those now”.
- The supplied V3 prompt is the implementation scope for this authorization. This does not claim that the missing SHOPADEMIA-MGS-001 was found or separately approved.
- B1 implementation is limited to foundational/admin capabilities that do not depend on unresolved commerce decisions. D1–D12 remain unresolved; dependent checkout, payment, stock, costing, returns, and migration behavior must not be guessed.
- To preserve the existing app and local data, implementation targets the current PostgreSQL stack locally. Production database migration/deployment remains blocked until the PostgreSQL/MySQL conflict and production readiness are explicitly resolved.
- The V3 specification is preserved at [ADMIN-MASTER-PROMPT.md](./ADMIN-MASTER-PROMPT.md). The attachment contains an approval template, not an approval record.
- Detailed evidence and blockers: [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md).
- Current handoff documents: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), [TEST_REPORT.md](./TEST_REPORT.md), [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md).

## Git and workspace safety

- Repository root: `C:\Users\Abidh\OneDrive\Desktop\storefront` (inside OneDrive).
- Implementation branch: `feature/admin-v2`, created from `main` after owner authorization.
- The repository location decision D12 remains unanswered; no relocation was attempted.
- No commit was created.

## Menu status

Statuses are against the V3 scope and are not claims of acceptance:

| Menu item | Status |
|---|---|
| Dashboard | IN-PROGRESS |
| Orders | IN-PROGRESS |
| Sale | PLANNED |
| Accounts | IN-PROGRESS |
| Products | IN-PROGRESS |
| Product Supplier | PLANNED |
| Category | IN-PROGRESS |
| Brand | PLANNED |
| Slider | IN-PROGRESS |
| Website Setup | IN-PROGRESS |
| Setting & Configuration | IN-PROGRESS |
| Campaign/Offer | IN-PROGRESS |
| Admin | IN-PROGRESS |
| Customer | IN-PROGRESS |
| Report | IN-PROGRESS |
| Landing Page | PLANNED |

The existing partial features are not yet acceptance-tested against the V3 requirements. The full V2 child-menu annex was not supplied or found in the repository.

## Decisions and blockers

- D1–D12: **UNANSWERED**. Existing code behavior is recorded as evidence only, not as owner approval.
- SHOPADEMIA-MGS-001 v1.0: **MISSING**.
- Explicit owner approval record for SHOPADEMIA-MGS-001: **MISSING**; owner authorized only the safe B1 scope described here.
- Full V2 menu/module annex and MGS-to-B0–B9 mapping: **MISSING**.
- Database-engine authority: **BLOCKED**. The project is PostgreSQL-backed; the V3 hosting section requires MySQL/MariaDB.
- Legacy production schema/data inventory and status/stock reconciliation: **UNVERIFIED**; production was not accessed.
- Remaining B1 work: **PARTIALLY BLOCKED** on the missing V2 role/menu annex and unresolved business/hosting decisions.

## Database, migration, and environment status

- Application database engine: PostgreSQL via `pg`.
- Local browser-run database: isolated PostgreSQL 17.11 development cluster on loopback port 5433; freshly initialized and contains no admin-managed products. The pre-existing local PostgreSQL service on port 5432 was left untouched.
- Current production database schema/version and row counts: **UNVERIFIED**; no production database connection was made.
- Legacy schema creation and incremental `ALTER TABLE` statements remain in `server/db.js`. New additive changes use `server/migrations.js` with ordered IDs, checksums, PostgreSQL advisory locking, and per-migration transactions. Dry-run, data reconciliation, and rollback tooling remain absent.
- `scripts/backup-production.sh`, `scripts/restore-production.sh`, and `scripts/upgrade-database-role.sh` exist. Backup/restore recovery against the intended deployment remains **UNVERIFIED**.
- Database and upload backups were previously recorded on the hosting account, but no offsite copy or restore verification is recorded.
- Local runtime observed: Node.js 24.21.0, npm 11.19.0. `package.json` permits Node >=20; CI uses Node 22. The intended cPanel Node runtime/path and PostgreSQL version require current independent verification before deployment work.
- Installed native image dependency `sharp` works in the local environment; compatibility with the intended cPanel runtime is **UNVERIFIED**.

## Verification evidence

- Targeted admin, migration, and database tests — **PASS**, 55 passed, 0 failed, 0 skipped (local Windows environment).
- `npm.cmd test` — **PASS**, 100 passed, 0 failed, 0 skipped (local Windows environment; latest run includes the development/production MFA boundary test).
- Targeted Chromium sidebar browser checks — **PASS**, 2 passed. Tests render both sidebar variants with isolated mock identity/permission data and verify mobile drawer display, search, disabled entries, permission-gated links, Escape dismissal, close control, and focus restoration. These are sidebar UI checks, not authenticated end-to-end admin authorization tests.
- Synthetic development admin login browser flow — **PASS**, 1 passed. Exercises the email/password-only UI path with intercepted APIs; it does not establish that the saved local account credentials or persistent backend session work.
- Real local Chromium platform-admin sign-in — **PASS**. The actual browser form returned 200, authenticated profile returned 200, redirected to `/admin/platform`, and logout returned 204. The session was revoked after the check; no credentials are included in this report.
- Development/production MFA boundary test — **PASS**, platform-admin MFA is optional only when explicitly disabled for non-production; production ignores that setting and requires MFA.
- Full configured Chromium E2E suite — **PASS**, 9 passed, 1 skipped, 0 failed. The product-detail check is skipped because the local catalog is empty.
- The development login page now hides the MFA prompt and uses email/password only. Production still enforces MFA.
- Axe WCAG 2.1 AA checks — **PASS**, no violations on `/`, `/privacy`, and `/terms` after fixing a 4.24:1 contrast issue in empty/loading catalog copy. This is not a full-site or manual accessibility certification.
- `npm.cmd run build:css` — **PASS**, rebuilt the Tailwind stylesheet after the contrast fix.
- Local browser: `http://localhost:3000/` loaded; `/healthz`, `/api/v1/products`, `/admin`, and `/admin/platform` returned HTTP 200.
- Local app restart applied the new B1 schema migration successfully; `/healthz` returned `ok`.
- The restart invalidated previous platform-admin sessions per existing startup behavior; sign in again before using the new panels.
- The visible storefront is empty because this is a fresh local database, not because the server is down.
- Linux/CI, E2E, production integration, migration recovery, and performance targets: **NOT TESTED**.
- Real local platform-admin browser sign-in is verified for the supplied local account. Production authentication and MFA remain **NOT TESTED**; development skips the TOTP step only.
- Earlier `docs/audit/` records are historical; their baseline count differs from the current 99-test run and was not overwritten.

## Latest task

- Added PostgreSQL `schema_migrations` tracking and an ordered/checksummed migration runner with advisory locking and per-migration transactions.
- Added the B1 additive migration for role/permission catalogues, admin settings, and an append-only administrative audit log.
- Added platform-admin APIs/UI to view the permission matrix, save ordinary settings, save AES-256-GCM-encrypted secrets when an environment key is configured, and review setting-change audit events.
- Added a permission-driven admin foundation menu manifest; only built entries granted by the server registry are rendered.
- Secret-setting key identifiers are derived from a SHA-256 fingerprint rather than exposing any bytes of the encryption key.
- Added matching slide-out navigation shells for platform and shop administrators, with searchable grouped menus, keyboard dismissal/focus handling, links to existing screens, permission-gated foundation links, and disabled entries for unimplemented modules. This is navigation UI only; it does not claim the disabled business features are implemented.
- Added isolated Chromium sidebar UI tests; these exercise the sidebar component with test identity/permission data and do not simulate a real authenticated session.
- Added current implementation, test, deployment/recovery handoff documents and a V3 feature matrix. All deployment steps are documentation only; no production action was run.
- Fixed insufficient contrast on category/product empty/loading states discovered by the full browser axe suite; updated the storefront browser test so missing seeded products skip only product-detail coverage instead of failing unrelated route checks.
- Added a development-only email/password platform-admin login mode. Production continues to require authenticator enrollment and current TOTP; no account MFA enrollment or credential data was modified.
- Changed the Platform Admin workspace from showing all panels together to showing one selected feature at a time. Sidebar destinations and URL fragments select the shop profile/lifecycle controls, shop creation, team, public product API, branding, hero slides, transactions, offers, reports, settings, permissions, and audit/activity panels. Shop lifecycle controls now live inside Shop details; the global header retains only the active-shop selector.
- The overview no longer repeats feature shortcuts. Public product API is reachable from Website Setup for both platform admins and shop admins; platform-only controls remain role/permission gated. Unimplemented menu entries remain disabled.
- Latest focused Chromium verification: admin login, both sidebar role variants, and single-panel feature navigation passed, 5/5 at mobile viewport. Full Node suite passed, 100/100. These tests verify layout/navigation, not real API actions in every feature.
- Permission grants beyond platform `super_admin` foundations remain default-deny because the original V2 role matrix is missing.
- No role assignment UI, generalized audit coverage for all existing admin actions, key-rotation tooling, commerce data migration, production connection, or deployment was made.

## Next five actions

1. Obtain the authoritative SHOPADEMIA-MGS-001 v1.0, its explicit owner approval record, the complete V2 module/menu annex, and intended phase mapping.
2. Resolve and record D1–D12, including PostgreSQL vs MySQL/MariaDB and the repository location, before implementing dependent business behavior.
3. Agree the role matrix and self-demotion/last-super-admin safeguards before building role assignment or expanding non-platform grants.
4. Approve audit coverage, secret rotation/recovery, and retention requirements before extending those security-sensitive foundation services.
5. After each decision gate, update the feature matrix, implement only approved scope, run acceptance checks in isolated test environments, and stop for review before advancing; keep deployment blocked until restore and host verification pass.
