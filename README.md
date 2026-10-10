# Shopademia storefront and admin

Shopademia includes a responsive storefront, a Node.js/Express API, PostgreSQL-backed order storage, and a password-protected admin orders dashboard.

## Run locally

Requirements: Node.js 20 or newer and Docker Desktop for the included local PostgreSQL service, or an existing PostgreSQL server.

1. Copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```
2. In `.env`, set a unique admin email, an admin password of at least 12 characters, and a random JWT secret of at least 32 characters. Generate a secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   `.env` is ignored by Git. Never share or commit it.
3. Start PostgreSQL:

   ```powershell
   docker compose up -d database
   ```

   If you use another PostgreSQL instance, change `DATABASE_URL` in `.env`.
4. Install dependencies and start the app:

   ```powershell
   npm install
   npm.cmd start
   ```

5. Open <http://localhost:3000> for the storefront and <http://localhost:3000/admin> for the admin dashboard. Keep the server running while using the site. Do not open `index.html` directly or use VS Code Live Server: the storefront and admin dashboard require the API served by this app.

The storefront includes `/privacy` and `/terms`, a consent choice for optional analytics, a social sharing image, and a generated `/sitemap.xml` and `/robots.txt`. Cart and wishlist remain in local browser storage; optional analytics trackers are not loaded unless a visitor allows analytics. Analytics integrations remain disabled until public tracker IDs are configured in `js/config/tracking.config.js`. The published policy text is an operational template and should be reviewed against the operator’s actual practices and local legal requirements.

For production, set `DOMAIN` to the public hostname; Docker passes `https://${DOMAIN}` to the app as `PUBLIC_SITE_URL` for canonical metadata and sitemap links. Caddy terminates TLS, redirects HTTP to HTTPS, and compresses responses. Keep application secrets in the server environment only. Browser-side image uploads are resized/compressed to WebP when the browser can produce a smaller file; the server still validates image type/signature and enforces upload limits.

The server creates the order tables, admin credential table, and indexes at startup. The PostgreSQL Docker volume persists when the app restarts. Back up the database and product-image volumes for disaster recovery. `npm run build:css` regenerates the checked-in production stylesheet when frontend styles change.

### Browser tests

Start the app locally, then set `PLAYWRIGHT_BASE_URL` to that local URL before running `npm run test:e2e`. The default command runs Chromium; `npm run test:e2e:all` runs every configured engine and requires the corresponding Playwright browser dependencies on the host. Do not point the tests at a production service.

## Catalog and API

The storefront uses this application's same-origin API; it does not fetch catalog or checkout data from a third-party demo API. The product endpoints (`GET /api/v1/products`, `/api/v1/products?featured=true`, `/api/v1/products?sort=newest`, `/api/v1/products/hero-offer`, and `/api/v1/categories`) serve the bundled starter catalog together with products published through the admin API. Product additions, edits, stock, availability, and uploaded images are managed through authenticated `/api/v1/admin/products` endpoints and persisted in PostgreSQL. Checkout uses the server-owned catalog prices; the browser cannot set order prices.

### Shop product API for external websites

Every active shop has a public, read-only JSON endpoint containing only products uploaded by that shop (not the bundled starter/demo catalog):

```text
GET https://YOUR_DOMAIN/api/v1/public/shops/SHOP_SLUG/products
```

The Shop Management dashboard shows the selected shop's exact URL and a copyable integration example. The endpoint is unauthenticated by design so external websites can use it, allows cross-origin `GET` requests, and must not contain customer or order information. It is rate-limited and responses may be cached for up to 30 seconds. Suspended or unknown shops return 404.

Optional query parameters are `limit` (1–100, default 50), `offset` (non-negative integer, default 0), and `category` (`gadgets`, `accessories`, `clothing`, or `more`). Responses include `shop`, `data`, and `pagination`; product entries include ID, name, description, price, old price, absolute image URL, category, stock quantity, and availability. Example:

```js
const url = 'https://YOUR_DOMAIN/api/v1/public/shops/SHOP_SLUG/products?limit=50';
const response = await fetch(url);
if (!response.ok) throw new Error('Could not load shop products');
const { shop, data: products, pagination } = await response.json();
```

To show subsequent pages, request the same endpoint with `offset` increased by `pagination.limit` while `pagination.hasMore` is true.

### Admin account inventory (keep passwords private)

There are no universal or hard-coded demo passwords. Use this inventory to identify the accounts for your deployment; record the actual email addresses and passwords only in a private password manager, not in this repository, a README, or a public issue.

| Account | Username / email source | Password source |
| --- | --- | --- |
| Main platform administrator | `ADMIN_EMAIL` in the private server environment | `ADMIN_PASSWORD` in the private server environment |
| Shop administrator 1 | Email assigned when the platform admin adds the shop member | Temporary password set during account creation; share securely and change after first sign-in |
| Shop administrator 2 | Email assigned when the platform admin adds the shop member | Temporary password set during account creation; share securely and change after first sign-in |

Shop names and admin emails depend on the actual deployment database and are intentionally not guessed or committed here. Create the shops and members in `/admin/platform`; keep the private credential inventory outside Git.

Checkout submits orders to `POST /api/v1/orders`; customers can query them through `POST /api/v1/customer/order-lookup`. The admin dashboard uses this app's `/api/v1/admin` login, order-management, product-management, and profile endpoints.

New installations include a small bundled starter catalog for the initial storefront display. Replace or supplement it with your own listings in the admin dashboard at `/admin`.

The storefront divides the home catalog between an initial product row and a second **More Products** row; this is a display split, not a claim about popularity or arrival dates. Product details, category listings, deals, the public shop directory, and individual shop profiles have separate shareable URLs (`/product/<id>`, `/category/<id>`, `/deals`, `/shops`, and `/shops/<slug>`). Each shop-specific page preserves its shop context with `?shop=<slug>` where needed. The `/about` and `/find-order` pages provide store information and order lookup. Search covers product names, categories, and descriptions; both product rows support wishlist actions. The storefront navigation collapses into an accessible menu on smaller screens.

## Multi-shop management

Open `/admin/platform` after signing in to create storefronts, switch the active shop, manage its users and roles, configure up to five hero slides with individual desktop images, optional mobile images, headlines, descriptions, and Buy Now URLs, set a separate store banner, record manual transactions, publish offers, and review shop-scoped reports and activity. Shops share one PostgreSQL database; each product and order carries a `shop_id`, and shop URLs use `/?shop=<slug>`. Existing products and orders are migrated into the `main` shop. The regular `/admin` dashboard uses the active shop selected in Shop management for both its product and order APIs.

Shop owners can add/remove shop members and change their admin/staff roles. Admins can manage shop settings, products, branding, transactions, and offers; staff can read shop data and process order-status/payment-review actions, but cannot change shop settings, catalog, branding, transactions, offers, or memberships. The platform does not provide account self-registration, email-based invitations, password-reset delivery, or ownership transfer. Account creation uses an owner-supplied temporary password, which must be shared securely and changed by the user after sign-in.

The payment ledger is manual bookkeeping only; it does not connect to bKash, banks, or another payment provider. Reported order values represent order records, not collected cash. Verified/refund/expense entries in the ledger must be reconciled with the external payment records.

Offer feeds are public at `/api/v1/shops/<slug>/offers`. Browser push is optional and requires `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT` in the server environment; configure all three together. A browser subscription can follow more than one shop. Publishing an offer that is already active sends a push to current subscribers. Future-dated offers become visible when their start time arrives, but this release does not schedule a push for that future time; publish the offer when it is active if a push alert is required. Customers can enable or disable alerts independently for each shop.

Shop activity records successful logins/logouts and supported shop, member, product, order, offer, branding, and transaction changes. It is an operational audit trail, not a tamper-proof compliance log; retain database backups and restrict database access.

## Order management

- Orders are validated, priced against the server catalog, and persisted in PostgreSQL.
- Repeated checkout submissions with the same event ID and order details return the original order instead of creating duplicates. Reusing an event ID for different details is rejected.
- The cart and wishlist are saved in the current browser only; they are not linked to an account or synchronized across devices. The cart reconciles saved products with the current catalog, caps each product at 99 units and known stock, and blocks checkout when saved quantities are no longer available. The server independently enforces the same per-product limit and inventory at order placement.
- Customers can use **Find your order** in the storefront to look up an order using its order number and the checkout phone number; no account or registration is required. The lookup is rate-limited, is not cached, and returns only order items, totals, fulfillment status, and manual advance-review status (not delivery address or sender phone). Manual review is not payment-provider confirmation.
- After an order request is accepted, customers can download an HTML receipt containing the order number, customer/order summary, and totals. It confirms an order request only and is not proof of payment.
- The first admin email and password are seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; passwords are stored as scrypt hashes. There is no public admin registration.
- The dashboard requires sign-in, supports status filtering and pagination, shows customer/item/payment-reference details, and updates order status through the enforced lifecycle: `new` → `confirmed` → `processing` → `shipped` → `delivered`. Orders can be cancelled before shipping; cancelled orders can only be reopened as `new`, with stock reserved again. Delivered orders are terminal; returns/refunds require a separate workflow.
- The authenticated **Products** admin section accepts JPEG, PNG, and WebP product images up to 5 MB, validates image signatures and product fields, saves product details in PostgreSQL and images in persistent storage, and publishes each product through the storefront catalog API. Admins can edit listing details, stock quantity, and purchase availability; replace an image; and delete products that should no longer be offered. Replaced and deleted images are removed from storage; cleanup failures are logged and surfaced in the dashboard. Product IDs, prices, inventory, and checkout availability are server-owned. Managed-product stock is reserved atomically when checkout accepts an order, so concurrent orders cannot oversell it; cancelling an order returns its reserved stock, and reopening it reserves that stock again or leaves the order cancelled if stock is no longer available. Legacy orders are not restocked because their inventory was not reserved. A database migration gives existing managed products zero stock, so set their actual stock in the admin dashboard before accepting orders. Deleting a product prevents new checkouts but does not alter historical order snapshots. Back up the `shopademia-product-images` Docker volume together with the database; local development stores images in the ignored `uploads/` directory.
- Admin order-status changes and manual advance-payment reviews are recorded in an order activity history with actor and before/after values. Existing orders have no historical events before this feature was deployed.
- The authenticated Admin profile section shows the account email and supports password changes. Passwords are stored as salted scrypt hashes; changing a password invalidates every active admin session. `ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the account only when the database has no admin account; later password changes persist in the database and are not reset by app restarts or environment edits. The email is read-only in the dashboard; change it only through a planned, authenticated database maintenance operation.
- Admin sessions use signed eight-hour tokens tracked server-side; signing out revokes the current token, and changing a password invalidates all sessions. Customer order records are available only from authenticated admin endpoints.
- Order statuses: `new`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`. Valid transitions are `new` → `confirmed` or `cancelled`; `confirmed` → `processing` or `cancelled`; `processing` → `shipped` or `cancelled`; `shipped` → `delivered`; and `cancelled` → `new`. Repeating the current status is an idempotent no-op.

The admin login is served on the same origin as the API. `/healthz` reports readiness only while PostgreSQL is reachable. The production Compose stack below keeps Node and PostgreSQL off the public host ports, places the database on a private Docker network, and configures the app to trust only its single Caddy proxy hop.

## Payment and launch requirements

There is **no bKash API integration**. Checkout collects the sender number as a reference only; the customer must wait for the store's payment instructions, and that number is not evidence of payment. Admins can record a manual advance review as verified or rejected, including reviewer and timestamp. Verify the transaction against your own bKash records before marking it verified. This review record is operational bookkeeping, not a payment-provider confirmation. The requested advance amount is served from `DELIVERY_ADVANCE_CHARGE`; it is not automatically deducted from the products due on delivery.

The storefront footer lists Shopademia's customer-support email, phone, and WhatsApp contact. Configure database backups, monitoring, and HTTPS on the production host before accepting orders. Review the bundled starter catalog and replace its sample listings with your own product details, prices, and inventory before accepting real orders.

## Production hardening checklist

### Self-hosted Docker deployment

This deployment targets a single Linux VM with Docker Compose and a public DNS name. It is deliberately single-app-instance because rate limits use per-process memory and the managed-product catalog/inventory has a process-local cache.

1. Point the domain's DNS A record (and any AAAA record) at the VM. Allow inbound TCP ports 80 and 443; allow UDP 443 if HTTP/3 is desired. Install Docker Engine and the Docker Compose plugin.
2. Create the production environment file and edit it with unique values:

   ```sh
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

   Generate random secrets (run separately for each password and the JWT secret):

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Use the generated values for `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`, `ADMIN_PASSWORD`, and `JWT_SECRET`. Put the app password in `DATABASE_URL` as well. Hex values are URL-safe. Set `DOMAIN` to the DNS name. Install `age`, generate an encryption identity with `age-keygen`, keep its private key off the server, and set `BACKUP_AGE_RECIPIENT` to its public recipient. Keep `.env.production` private; it is ignored by Git.
3. Start the stack:

   ```sh
   docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
   docker compose --env-file .env.production -f docker-compose.production.yml ps
   ```

   Caddy obtains and renews the TLS certificate automatically. Do not publish the Node or database ports; only Caddy exposes 80/443. `DATABASE_SSL=false` is used only for traffic on the isolated private Docker network. For a managed database, use its TLS endpoint with `DATABASE_SSL=true`, a trusted CA, restricted network access, and a deployment configuration that removes the local database service.
4. Verify deployment:

   ```sh
   curl --fail --show-error https://your-domain.example/healthz
   ```

   The endpoint should return HTTP 200 and `{"status":"ok"}`. Confirm `https://<your-domain>/` and `/admin` load, and check service logs with `docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100`.
5. Install `age` on the VM and create the backup directory for your deployment user. Test the encrypted backup command:

   ```sh
   chmod 700 scripts/backup-production.sh
   sudo install -d -m 700 -o "$USER" /var/backups/shopademia
   BACKUP_DIR=/var/backups/shopademia scripts/backup-production.sh
   ```

   The script creates a paired, timestamped, encrypted PostgreSQL dump and product-upload archive. Schedule it with the host's systemd timer or cron, retain both files together according to your policy, and copy the encrypted files to an off-host backup provider. Keep the age private key separately; without it, backups cannot be decrypted. Regularly test restore into a separate empty database before relying on backups.
6. Configure an external uptime monitor to request `https://<your-domain>/healthz`, alert on non-200 responses, and check service logs. Configure log retention, host patching, secret rotation, and an incident contact before opening the service to customers. The PostgreSQL volume is persistent but is not itself a backup.

The database runs as an unprivileged `shopademia_app` role; the separate bootstrap role is used only by PostgreSQL initialization. The init script runs only when the database volume is first created. This production Compose stack uses a dedicated volume; do not point it at an existing database volume without planning a role/ownership migration. The app has no published host port, and `TRUST_PROXY_HOPS=1` is correct only while Caddy is its sole trusted proxy. If you add another proxy/load balancer, update the hop count and ensure the proxy chain strips client-supplied forwarding headers.

Login and checkout are limited to 8 and 30 requests per client IP per 15 minutes, respectively. Order lookup allows 5 requests and product uploads 10 per IP per 15 minutes; public catalog reads allow 120 per minute. These limits are in-memory and reset on restart; do not scale to multiple app replicas without adding a shared rate-limit store, and add edge-level abuse controls if traffic warrants them.

### Launch blockers for real commerce

This deployment provides TLS and hardened service networking, but a fresh database still starts with bundled sample products. Before accepting real orders, replace those listings with actual business products and inventory, test database restore and order recovery, configure actual off-host backup storage and uptime alerts, and review local privacy/tax/consumer requirements. Payments remain manual: train staff to compare sender numbers and transactions in the bKash merchant records, and never treat the dashboard's manual status as provider verification.

Run backend validation and route tests with `npm test`.
