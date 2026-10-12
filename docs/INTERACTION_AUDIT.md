# Storefront and Admin Interaction Audit

**Audit date:** 2026-10-12  
**Scope:** User-visible functions, static and generated controls, sidebar destinations, and focused local interaction verification.  
**Environment:** Local Windows development environment at `http://localhost:3000`; local test database and mocked Playwright API responses. No production service, account, or database was accessed.

## Executive assessment

This project contains a real storefront and usable shop/platform administration foundations, but it is not a complete commerce operations system. A button being clickable does not mean the underlying business process is automated or production-ready. Important limits:

- Orders can be submitted and managed, but the admin's advance-payment review is manual and does not verify a bKash payment.
- The transaction screen is a manual register, not a double-entry accounting ledger, payment reconciliation, or provider integration.
- Sale/wholesale, supplier and brand management, customer messaging, product variants, and landing-page-builder destinations remain disabled because those workflows do not exist.
- Admin features have differing roles and permissions. A confirmed staff-role page-load defect was fixed and covered by a focused browser regression test.
- The interaction tests below establish local code behavior only. They do not certify production data, external providers, all roles, all browsers, or full accessibility conformance.

**Release recommendation: NO-GO for production until the blockers in this report and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) are resolved.**

## Scope, method, and evidence limits

Reviewed the rendered controls in `index.html`, `admin.html`, and `admin-platform.html`; their browser modules under `js/views/` and `admin-assets/`; sidebar definitions; relevant API behavior and tests; and current feature-status documentation. The static HTML contains **56 buttons and 16 forms** (22/2 in the storefront, 17/6 in shop admin, 17/8 in platform admin). Repeated and dynamically created controls are inventoried separately below.

The local project test baseline before this audit was 100 passing Node tests and a serial Chromium suite of 11 passed, 1 skipped, 0 failed. During this audit:

- A focused Chromium regression test reproduced the staff-role context and confirmed no team-members request is made; the test suite passed **5/5**.
- The Node suite passed **100/100** after the code changes. Subsequent changes were documentation-only.
- Modified JavaScript files passed `node --check`, and the final code/documentation diff passed `git diff --check`.
- The complete Chromium suite was attempted, but all 13 tests failed during setup because the local app could not connect to PostgreSQL; no browser assertions ran. See [TEST_REPORT.md](./TEST_REPORT.md) for the exact failure and limits.

Mocked browser tests verify client behavior under controlled API responses. They do not prove successful live server interactions. A product-detail E2E scenario is skipped when the isolated local catalog has no product. Firefox and WebKit are not included in the passing browser evidence.

## Finding summary (ranked)

| ID | Severity | Finding | Evidence / action |
|---|---|---|---|
| IA-01 | High | The sidebar presents many menu destinations for workflows that do not exist. | The known missing destinations are disabled, not fake routes. This is honest UX but still a substantial product gap. Do not enable them until implemented and tested. |
| IA-02 | High | The current application is not shown to be production-ready. | No production or staging integration, recovery drill, complete payment provider test, cross-browser acceptance, or complete authorization matrix was performed. See [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) and [AUDIT_REPORT.md](../AUDIT_REPORT.md). |
| IA-03 | Medium | Shop staff could trigger a 403 loading team data and see team-management UI despite lacking that permission. | `allowShopTeamManagement` permits platform admins and shop `owner`/`admin`; the page previously attempted `loadMembers()` for every non-platform role. It now requests team data only for owner/admin and hides `teamPanel` for staff. Focused Chromium regression: **PASS**. |
| IA-04 | Medium | The transaction screen could be mistaken for a payment ledger or verified payment state. | It is a manually entered register; it does not contact a payment provider or implement double-entry bookkeeping. The heading/help text now states that limitation explicitly. |
| IA-05 | Medium | Admin accessibility has not been fully evaluated. | There is a focused sidebar keyboard/mobile test, but no full admin axe scan, screen-reader review, or complete focus/contrast/target-size assessment. |

No security audit is claimed by this interaction review. The prior [AUDIT_REPORT.md](../AUDIT_REPORT.md) documents a separate baseline audit and its own limitations.

## Static control inventory

### Storefront (`index.html`): 22 buttons, 2 forms

| Control(s) | Purpose and effect |
|---|---|
| `mobileNavigationToggle` | Opens/closes the responsive primary-navigation disclosure. |
| `mobileSearchToggle` | Opens/closes the responsive search disclosure. |
| `wishlistBtn` | Opens the wishlist view; `wishlistBadge` shows its item count. Wishlist state is browser-side, not an order or account record. |
| `customerProfileBtn` | Opens the order-lookup dialog (labelled “Find my order”). |
| `cartDrawerBtn` | Opens the cart drawer; `cartBadge` displays quantity. |
| `dealNotificationsButton` | Starts browser deal-notification subscription flow when supported/available; permission and push configuration affect the result. |
| `heroSlidePrevious`, `heroSlideNext` | Changes the visible hero slide. |
| Two `View All Products` buttons | Clears the relevant limited/home selection and reveals the broader product list. |
| `clearProductFilters` | Clears product filters/search state. |
| `View All` | Expands the associated home-page product section. |
| `dealsButton` (“Explore Deals”) | Navigates to the deals route. |
| `customerProfileCloseBtn` | Closes the order-lookup dialog. |
| `customerProfileSubmitBtn` + `customerProfileForm` | Looks up an order using order number and phone; result is rendered in the dialog. |
| `productDetailsCloseBtn` | Closes product details. Product card/gallery/add controls are dynamically rendered and listed below. |
| `closeCartBtn` | Closes the cart drawer. |
| `checkoutBtn` (“Checkout Now”) | Opens checkout from the cart. |
| `checkoutCloseBtn` | Closes checkout. |
| `checkoutSubmitBtn` + `checkoutForm` | Submits an order request; server-side product prices are authoritative. It is not proof of payment collection. |
| `downloadReceiptBtn` | Downloads the receipt for the just-submitted order when available. |
| `checkoutDoneBtn` (“Continue Shopping”) | Resets checkout UI state and closes the completion flow. |

Primary and mobile navigation links route to Home, Shop, Categories, Deals, Stores, About, and Find Order. Product search and filter controls change the displayed catalog; see generated controls.

### Shop admin (`admin.html`): 17 buttons, 6 forms

| Control/form | Purpose and effect |
|---|---|
| `adminSidebarToggle`, `adminSidebarClose`, `adminSidebarBackdrop` | Open/close the responsive admin navigation; Escape and focus handling are covered by focused browser tests. |
| `loginForm` / `loginButton` (“Sign in”) | Authenticates with email/password and, when required, a six-digit TOTP code. Production MFA enforcement is not disabled by the development-only setting. |
| `copyMfaSetupSecret` | Copies the one-time MFA setup key; status feedback is announced. |
| `mfaEnrollmentForm` / `mfaEnrollmentButton` | Verifies the authenticator code and enables MFA. |
| `logoutButton` | Ends the authenticated admin session. |
| `refreshButton` | Reloads the order list. |
| `statusFilter` | Filters the order list by the available order statuses. |
| `previousPage`, `nextPage` | Changes order-list pagination. |
| `refreshProductsButton` | Reloads product data. |
| `productForm` / `createProductButton` (“Upload and publish product”) | Creates or updates a product with its image, name/details, price, stock/availability, and category. Image optimization/validation applies. |
| `cancelProductEditButton` | Leaves product-edit mode and restores the create form. |
| `categoryForm` / `saveCategoryButton` | Creates a category or saves a rename, depending on current edit state. |
| `cancelCategoryEditButton` | Cancels category rename mode. |
| `shopProfileForm` / `saveShopProfileButton` | Saves the shop profile fields exposed on this page. |
| `passwordForm` / `changePasswordButton` | Changes the signed-in admin password subject to server validation. |

### Platform/shop-management admin (`admin-platform.html`): 17 buttons, 8 forms

| Control/form | Purpose and effect |
|---|---|
| `adminSidebarToggle`, `adminSidebarClose`, `adminSidebarBackdrop` | Open/close navigation drawer. |
| `shopPicker` | Selects the active shop. Selection is retained in `sessionStorage`; requests use the selected shop header. |
| `suspendShopButton`, `reactivateShopButton`, `archiveShopButton` | Platform-admin shop lifecycle actions. Confirmations/status rules apply; these actions do not delete production data automatically. |
| `shopSettingsForm` | Saves selected shop name and delivery-advance configuration. |
| `createShopForm` | Creates a shop and its public slug/advance configuration. |
| `memberForm` | Adds a shop member (staff; platform admins can grant admin where supported). Owner/admin team-management access is required. |
| `copyShopProductApiUrl`, `copyShopProductApiExample` | Copies the selected active shop's public, read-only product endpoint or sample integration. No API key is required. |
| Branding form (`data-kind="banner"`) | Uploads/replaces the shop banner image. |
| `heroSlideForm` | Adds or edits a slide with desktop/mobile image, headline, text, and destination URL. |
| `cancelHeroSlideEdit` | Cancels slide editing and resets the form. |
| Dynamically generated slide `Move up`, `Move down`, `Edit`, `Remove` | Reorders, edits, or deletes the corresponding slide. Remove asks for confirmation. |
| `transactionForm` | Records a manual payment/refund/expense/adjustment entry. This is not payment verification or accounting reconciliation. |
| `offerForm` | Creates an offer as draft or published; publishing may notify browser-push subscribers if configured and eligible. |
| Dynamically generated offer `Publish` / `Unpublish` | Changes an offer's publication state; notification delivery is conditional, not guaranteed. |
| `reportDays` | Selects the reporting window and reloads the aggregate report. |
| `adminSettingForm` / `saveAdminSetting` | Saves a platform setting; optional secret values are encrypted only when the server has the required encryption key. |
| `adminSettingSecret` | Toggles secret-value masking in the settings form. |

Additional platform panels are read-only displays: permission catalogue/matrix, recent activity, and administrative security-audit events. They do not currently provide a general role-grant editor or complete mutation audit trail.

## Dynamically generated controls and user effects

### Storefront

| Generated control / action | Result and boundary |
|---|---|
| Category selection and product search | Filters the currently loaded catalog and updates the product grid. Search fields synchronize between desktop and mobile. |
| Product card, details/gallery, slide indicator/next/previous | Opens product information or moves the hero carousel. |
| Product `Add` / `Buy Now` | Adds an available product to the browser cart; unavailable items are disabled. Quantity is bounded and managed stock is considered client-side, but server validation remains authoritative. |
| Product `Wishlist` / remove-from-wishlist | Toggles browser-side wishlist membership and badge; it is not synchronized to an authenticated customer account. |
| Cart `Increase`, `Decrease`, `Remove` | Updates cart quantity, removes at zero, and updates cart display/badge. Persisted cart quantities are validated/capped when restored. |
| Checkout fields | Collect contact/delivery and payment-reference information used for an order request. Client-calculated prices are excluded from the trusted order payload; payment is not automatically verified. |
| Order lookup validation/results | Validates the submitted order number/phone and displays matching order status/receipt information subject to API response. |
| Consent controls | Save browser consent choices; legal/regulatory adequacy and cross-device handling have not been certified. |
| Toast/status feedback | Displays transient local feedback for supported interactions. Not every server-backed response has been manually checked with assistive technology. |

### Shop admin

| Generated control / action | Result and boundary |
|---|---|
| Product `Edit`, `Delete`, availability/status controls | Modify product fields, remove a product, or change its storefront availability. Deletion/stock effects depend on server constraints; inventory lifecycle is not a full reservation/purchase/return system. |
| Category `Rename`, `Delete` | Changes the category name or deletes it, subject to server constraints. |
| Order manual-advance review | Selects verified/not verified and saves the admin's manual review. The operator must independently check the payment provider; this UI does not call bKash. |
| Order status `Save status` | Requests a permitted status transition through the server API. It is not a full partial-shipment, courier, cancellation/refund, return, or exchange workflow. |
| Order `View activity` / `Hide activity` | Lazily loads status/payment-review activity for that order. The log is not a comprehensive audit of every business mutation. |

### Platform admin

| Generated control / action | Result and boundary |
|---|---|
| Shop selector | Switches selected shop, refreshes shop-scoped panels, and stores selection for the browser tab/session. Platform-wide panels are visible only to platform admins. |
| Member `Change role` / `Remove` | Updates/removes a member using shop team APIs. Server authorization remains authoritative. |
| Banner / slide uploads | Send selected image files; upload optimization and accepted image formats/size constraints apply. |
| Offer publication toggle | Publishes/unpublishes an offer; browser push depends on configured VAPID keys, schedule, and active subscribers. |
| Read-only reports | Shows order counts/value summaries, top products, and transaction aggregates for the selected date window. Sales/order values are not proof of collected funds. |
| Shop public product API | Read-only endpoint exposes that active shop's public products, with pagination; it is not a write API. |

## Sidebar destination audit: all 16 groups

An enabled destination means the link resolves to an existing panel/view, not that every business capability within the destination is complete. Disabled links deliberately do not masquerade as working routes.

| Group | Enabled destination(s) | Disabled / absent destinations |
|---|---|---|
| Dashboard | Overview; platform admins also get Create shop | — |
| Orders | Manage Orders | Add Exchange Order; Order Processing Report |
| Sale | — | Office Sale; Wholesale; Wholeseller |
| Accounts | Platform admin: Transactions (manual register) | Income; Expense; Due; Balance; Fund Transfer; Account Purpose; Employee Salary; Bill Statements |
| Products | Manage Products | Attribute / Size; Variants; Product Purchase; Product Reviews; Product View Report; Country; Skin |
| Product Supplier | — | Add; Manage |
| Category | Manage Categories | Sub Category; Sub Sub Category |
| Brand | — | Manage Brands |
| Slider | Platform admin: Manage Slides | Shop admin: Manage Slides is disabled |
| Website Setup | Orders page: Shop Profile; management page: Public product API; platform admin: Store Banner | Non-platform role: Store Banner |
| Setting & Configuration | Platform admin: General Settings only when `settings.read`; Shop Settings; Delivery Advance; orders page: Admin Profile and Shop Management | Courier API; Invoice Address; Social Login; City/Sub City; Courier; Order Source; Order Processing Note; generic non-platform Settings |
| Campaign / Offer | Platform admin: Manage Offers | Coupons; Offer Banner |
| Admin | Platform page: permitted Manage Shop Users, Roles & Permissions, Security Audit, Recent Activity; orders page: Account Profile and Shop Management | User/role/audit destinations hidden or disabled when role/permission does not allow them |
| Customer | — | Customers; Messages |
| Report | Platform admin: Business Reports | Other roles: Business Reports disabled |
| Landing Page | — | Manage Landing Page |

## External UX/accessibility research and audit checklist

The following sources were reviewed for criteria and implementation guidance. WCAG 2.2 is the normative standard; WAI-ARIA APG and GOV.UK are design/implementation guidance and are not additional WCAG conformance requirements.

- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA APG Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
- [APG Disclosure Navigation Example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
- [APG Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WCAG 4.1.3 Status Messages understanding](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [WCAG 3.3.1 Error Identification understanding](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
- [WAI Forms Validation tutorial](https://www.w3.org/WAI/tutorials/forms/validation/)
- [GOV.UK form validation pattern](https://design-system.service.gov.uk/patterns/validation/)

Apply these checks to every interactive surface, not only the sidebar:

1. Operate all links, buttons, disclosures, forms, and dialogs using keyboard only; ensure visible, logical focus and no keyboard trap.
2. Ensure every control has an accessible name, role, state, and keyboard behavior; disclosure state should match `aria-expanded`.
3. Verify modal focus entry, containment while open, Escape/close behavior, and focus return.
4. Associate form labels, instructions, required state, inline errors, and summary/error announcements with the relevant inputs.
5. Ensure async success, failure, loading, and count/status updates are announced appropriately without moving focus unexpectedly.
6. Verify WCAG 2.2 AA color contrast and target-size requirements (24×24 CSS px minimum subject to WCAG exceptions) at each supported viewport and zoom level.
7. Test dynamic state changes, responsive navigation, and role-based hidden/disabled controls with keyboard and a screen reader.

Previous axe evidence for `/`, `/privacy`, and `/terms` does not cover the admin pages. Focused admin sidebar Chromium tests cover a narrow keyboard/mobile slice; they are not a full accessibility audit.

## Unimplemented or blocked functions

The disabled sidebar labels are product scope gaps, not hidden features. Before enabling them, implement and test: office/wholesale sales; supplier/purchase management; product variants/attributes/brands; product reviews and view reporting; customer management/messaging; exchanges; courier integration; complete financial accounts, balanced ledger and reconciliation; coupons/offer banners; and landing-page editing.

Business behavior is also blocked on requirements and external evidence. Do not invent payment posting/refund rules, inventory reservation/fulfilment and return policy, product-costing method, customer identity/cart ownership, legal retention, or PostgreSQL-vs-MySQL authority. See [ADMIN-GAP-REPORT.md](./ADMIN-GAP-REPORT.md) and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md). Production database, recovery, deployment, load, and provider integrations remain unverified.

## Prioritized next actions

1. Keep absent sidebar features disabled; agree module scope and acceptance criteria before implementation.
2. Resolve the owner decisions, approved master specification, role/menu annex, payment/refund rules, inventory/returns, and database-engine conflict.
3. Build role-by-action server authorization tests and role-specific end-to-end browser coverage (platform admin, shop owner/admin, staff).
4. Run complete axe checks and manual keyboard/screen-reader reviews across storefront, shop admin, and platform admin.
5. Exercise real staging payment-provider behavior, database migration/rollback and backup restore, then load/performance and production operations acceptance.
6. Maintain exact language distinguishing manual records/reviews from externally verified financial outcomes.
