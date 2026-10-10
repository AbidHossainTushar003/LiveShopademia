# Verification matrix — Phase 0

| Area | Check | Evidence | Result | Notes |
|---|---|---|---|---|
| Repo state | Git status inspected before changes | `git status --short --branch` | PASS | Working tree was dirty before the audit; no destructive actions were taken |
| Project root | Root folders and app entrypoints inventoried | `Get-ChildItem -Force` | PASS | `admin.html`, `admin-platform.html`, `index.html`, `server/`, `js/`, `css/`, `uploads/` present |
| Requirements docs | Search for `SHOPADEMIA-MGS-001.md`, `CLAUDE.md`, and OpenAPI | File system search | PASS | No matching files found; project documentation gap recorded |
| Contract mapping | Three-section architecture mapped to existing source layout | Code and folder inspection | PASS | Admin + API + Public HTML are represented in the current repo |
| Startup config | App runtime configuration reviewed | `server/index.js` + `.env.example` | PASS | PostgreSQL-backed Node/Express app with required environment values |
| Database type | DB stack verified from code and config | `server/db.js`, `docker-compose.yml`, `.env.example` | PASS | PostgreSQL, not MySQL |
| Package scripts | Test and run scripts inspected | `package.json` | PASS | `npm test`, `npm start`, `npm run build:css` |
| API route inventory | Core routes reviewed | `server/app.js` | PASS | `/api/v1` routes, admin endpoints, storefront endpoints present |
| Security posture | Security middleware reviewed | `server/app.js` | PASS | Helmet, CSP, Referrer-Policy, no `x-powered-by`, `express.json` validation |
| Product workflow | Admin product management routes reviewed | `server/app.js` | PASS | Create/update/delete/replacement supported |
| Order workflow | Order lifecycle and pricing logic reviewed | `server/orders.js`, `server/app.js` | PASS | Server prices and stock checks enforced |
| Admin auth | Login/logout and session logic reviewed | `server/app.js`, `server/db.js` | PASS | Authenticated admin endpoints implemented |
| Baseline testing | App test suite executed | `cmd /c "npm.cmd test -- --test-reporter=spec"` | PASS | 58/58 tests passed |
| Performance/health | Readiness endpoint present | `server/app.test.js` + `server/app.js` | PASS | Database-backed readiness endpoint exists |
| Production safety | Production config reviewed but not deployed | `docker-compose.production.yml` + README | PASS | Deployment material inspected; no live changes made |
| Owner decisions status | Business decisions requiring owner confirmation | Phase 0 notes | BLOCKED | Guest checkout, cart persistence, and manual payment-review policy require explicit owner confirmation if not already documented |

## Validation commands
- `git --no-pager status --short --branch`
- `cmd /c "npm.cmd test -- --test-reporter=spec"`
- `Get-ChildItem -Force`

## Status legend
- PASS = verified in current repo state
- BLOCKED = requires owner decision or missing approved requirement
- FAIL = current implementation is not satisfying the requirement
- NOT TESTED = not yet executed in this phase

## Phase 0 result summary
Current project state is generally healthy and baseline-tested. No blocking defects were found in the current test suite. However, the repository is missing formally approved requirements and a formal OpenAPI contract, so future implementation decisions should be referenced back to the real code and any later owner-approved documentation added to the repo.
