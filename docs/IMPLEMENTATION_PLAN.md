# Shopademia admin and production-readiness implementation plan

**Updated:** 2026-10-12
**Scope basis:** The owner-supplied V3 prompt, existing repository contracts, current branch `feature/admin-v2`, and evidence in [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md).
**Current disposition:** B0 reconciliation is complete. Safe B1 foundation work is partially implemented. The production release decision remains **NO-GO**.

## Phase status and execution order

| Phase | Scope and dependencies | Status |
|---|---|---|
| 0 — Repository audit | Inspect existing stack, routes, schema, auth, tests, integrations, docs, and deployment. No production access. | **Complete** as an evidence-gathering pass. |
| 1 — Requirements and decision gate | Obtain the authoritative approved MGS v1.0, full original V2 module/menu annex and phase mapping; answer D1–D12; confirm repository location. PostgreSQL is authoritative and must not be replaced. | **Blocked.** Documents/decisions are missing or unanswered. General approval to implement does not provide these business rules. |
| 2 — Storefront/navigation/accessibility | Implement only approved navigation, search, responsive, and accessibility requirements while preserving current contracts. | **Partial.** Requested admin slide-out navigation is implemented and targeted component-browser-tested; remaining V3 acceptance is not established. |
| 3 — Customer, wishlist, cart, media | Define guest/customer identity and cart persistence first; then implement approved account, wishlist, cart, and media scope. | **Blocked** on MGS/V2 scope and D1–D2. |
| 4 — Checkout, payment, inventory, orders, shipping | Requires approved checkout and payment handling, status mapping, refund rules, reservation/fulfillment semantics, cost policy, return policy, and isolation. | **Blocked** on D1, D3, D8–D11 and approved status/data mappings. No real transactions or shipments in tests. |
| 5 — Security, regression, performance, readiness | Complete action-level authorization/audit, recovery and retention controls; run isolated integration, concurrency, failure, accessibility, performance, and restore tests. | **Not complete.** Unit/API tests and two sidebar UI checks pass; many production acceptance scenarios are untested. |
| 6 — Deployment handoff and launch decision | Select and verify target hosting/database, backup and restore, migration rehearsal, secrets, monitoring, smoke tests, rollback and operator ownership. | **Blocked.** Conflicting target database requirements and production evidence gaps remain. |

## Safe B1 work already present

- Versioned PostgreSQL migration tracking with migration ordering, checksums, advisory locking, and per-migration transactions.
- Additive role/permission catalogue, administrative settings, and append-only setting-change audit storage.
- Platform-admin settings, read-only permission matrix, and settings-audit UI/API; secret values use AES-256-GCM when a separate environment key is configured.
- Permission-filtered navigation entries for implemented foundation panels.
- Screenshot-inspired Shop Admin and Platform Admin sidebars with menu search, mobile drawer controls, keyboard dismissal/focus return, working destinations, and disabled entries for unavailable modules.
- Targeted unit/API tests and isolated Chromium sidebar component tests.

These items are locally implemented; they are not a V3 acceptance sign-off, production deployment, complete role system, or complete audit trail.

## Required gates before dependent implementation

1. Record the exact approved MGS v1.0 and the owner approval using the requested approval record. Supply the full V2 annex and phase allocation.
2. Resolve D1–D12 explicitly and the OneDrive/repository location. PostgreSQL is authoritative per the owner; record remaining answers before changing dependent behavior.
3. Produce a requirement-to-feature mapping and acceptance criteria for the approved modules. Preserve existing API, authentication, database, and branding contracts unless an approved compatibility plan says otherwise.
4. For payment, inventory, migrations, financial, or destructive testing, provision and prove isolated test systems with synthetic data. Do not use production or initiate real transactions/shipments.
5. After each approved phase, run its targeted tests, update [TEST_REPORT.md](./TEST_REPORT.md) and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md), review the diff, and stop for owner review before crossing into the next phase.

## Principal risks

- Guessing D1–D12 could change payment, stock, refund, accounting, or data-retention behavior.
- PostgreSQL is authoritative; the actual hosted PostgreSQL target/version and compatibility with the intended runtime remain unverified.
- Existing tests do not prove authenticated browser behavior, concurrent stock correctness, production data integrity, backup recovery, or host compatibility.
- Existing platform/shop screens are partial foundations; disabled menu entries are not implemented features.
- Secrets, production data, deployment switches, and live services must remain untouched until their specific gates and approvals are satisfied.

## Overall acceptance criteria

Do not recommend launch until the approved specification and decisions are reconciled; the matrix's critical flows have documented PASS evidence; isolated migration, restore, authorization, concurrency/idempotency, payment/refund, inventory, shipping, and recovery tests meet approved criteria; and production monitoring, secret custody, retention, and rollback responsibilities are verified. A passing build or unit suite alone is insufficient.
