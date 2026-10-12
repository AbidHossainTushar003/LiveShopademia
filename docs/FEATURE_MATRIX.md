# Shopademia admin feature and acceptance matrix

**Updated:** 2026-10-12
**Scope:** V3 admin program compared with observed current implementation. “PASS” means only the specifically stated check passed; it does not certify production readiness.

| Requirement / area | Status | Current evidence and remaining acceptance work |
|---|---|---|
| Existing storefront and API baseline | PARTIAL | Existing Node/Express/PostgreSQL app and public/shop APIs exist; tenant, legal, retention, production operations, and full V3 acceptance remain open. |
| Shop Admin orders | PARTIAL | List/filter/status and manual advance-payment review exist. V3 status machine, history, partial delivery, courier, return, exchange, and full financial lifecycle are absent. |
| Products and catalog | PARTIAL | Product CRUD, images, price, stock, category, and availability exist. Approved variants, skin, purchase/cost lifecycle, and V3 acceptance are absent. |
| Categories | PARTIAL | Shop-scoped category CRUD exists; full approved hierarchy/constraints are not established. |
| Accounts/transactions | PARTIAL | Basic shop transaction records exist. Balanced ledger, chart of accounts, transfers, reconciliation, receivables/payables, and approved accounting rules are absent. |
| Dashboard/reports | PARTIAL | Existing order/admin screens and basic reports exist; V3 overview/order pipeline and required finance, inventory, and operations reports are not acceptance-tested. |
| Shop and platform management | PARTIAL | Shop lifecycle, members, branding, slides, offers, reports, and activity are present in part. Full role matrix, action authorization, and required audit coverage remain incomplete. |
| Administrative settings | PARTIAL | Platform-admin setting UI/API and optional encrypted secret writes are implemented and tested locally. Key rotation/recovery, retention/pruning, operations, and production key custody are absent/unverified. |
| Permission catalogue / matrix | PARTIAL | Read-only matrix and server-gated foundation actions exist. Original role mapping is missing; non-platform role grants remain default-deny; no role assignment/editing workflow. |
| Administrative audit | PARTIAL | Append-only setting-change audit records and viewer exist. Product/order/team/finance and other mutation coverage is not generalized. |
| Shop Admin sidebar UI | PASS | Targeted Chromium component test passed at 390×844 for open/search/disabled items/Escape/focus return. Real authenticated browser flow and additional viewport/assistive technology checks remain untested. |
| Platform/Super Admin sidebar UI | PASS | Targeted Chromium component test passed for permission-gated foundation links, unavailable links, and close behavior using mock role/permission data. Real authenticated browser authorization is not thereby verified. |
| Admin login and MFA enrollment browser UI | PARTIAL | Synthetic Chromium test drives the actual sign-in and enrollment UI to the shop dashboard and checks copying the temporary setup key. API calls are intercepted; real account credentials, server cookie issuance, DB enrollment persistence, and subsequent MFA login are not verified by that browser test. |
| Storefront empty/loading catalog contrast | PASS | Axe detected 4.24:1 text contrast on empty/loading cards; text color was darkened, Tailwind CSS rebuilt, and the Chromium axe checks then passed on `/`, `/privacy`, and `/terms`. Other pages/components and manual AT checks remain untested. |
| Disabled sidebar modules | FAIL | Sale, supplier/purchase, variants/brands, customer messaging, landing-page builder, and other missing modules are not implemented. Sidebar labels are disabled placeholders, not functioning features. |
| Customer master, blocklist, messages | FAIL | No complete customer-management workflow located/implemented. |
| Sale / wholesale workflows | FAIL | No Office Sale, Wholesale, or Wholeseller workflow located/implemented. |
| Product supplier / brand / landing page builder | FAIL | No corresponding complete entity and workflow located/implemented. |
| Checkout identity and cart source of truth | BLOCKED | D1–D2 unanswered. Existing guest checkout and browser local-storage cart are evidence only, not approved future requirements. |
| bKash/payment posting and refunds | BLOCKED | D3 and D8 unanswered; existing manual review is not payment gateway verification or complete refund accounting. |
| Inventory reservation/fulfillment lifecycle | BLOCKED | D9 unanswered. Existing product-level stock reservation does not prove concurrent, partial shipment, delivery failure, return, or exchange correctness. |
| Product cost/purchase and return policy | BLOCKED | D10–D11 unanswered; do not invent weighted-average costing, adjustments, eligibility, or return windows. |
| MGS, V2 annex, phase mapping | BLOCKED | Authoritative SHOPADEMIA-MGS-001 approval, full V2 module/menu annex, and mapping are missing. |
| Database engine authority | DECIDED — PostgreSQL | Owner-provided release instructions make PostgreSQL authoritative; do not migrate to MySQL/MariaDB. Hosted service/version, credentials, connectivity, and production data/schema remain unverified. |
| Production data/schema inventory | NOT TESTED | No production database connection or row/status/stock inventory was made. |
| Production backup restore and rollback | NOT TESTED | Scripts/configuration exist; restoreability and recovery time are not evidenced. |
| Production deployment, TLS/DNS, monitoring | NOT TESTED | No production change or authorized staging check was performed. |
| Full security, performance, and cross-browser acceptance | NOT TESTED | The complete required acceptance suite has not been executed. |

## Status definitions

- **PASS:** The stated narrow acceptance check has evidence and passed.
- **FAIL:** The requested feature is absent or the stated criterion is not met.
- **PARTIAL:** Some existing or newly implemented capability exists, but required scope/acceptance remains incomplete.
- **BLOCKED:** Implementation depends on missing owner requirements, decisions, or architecture authority.
- **NOT TESTED:** Evidence has not been gathered in the required environment.

**Overall production status: NO-GO.** This matrix does not substitute for an approved MGS, explicit D1–D12 decisions, or production readiness evidence.
