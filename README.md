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

The server creates the order tables, admin credential table, and indexes at startup. The PostgreSQL Docker volume persists when the app restarts. Back up the database and product-image volumes for disaster recovery. `npm run build:css` regenerates the checked-in production stylesheet when frontend styles change.

## Demo catalog

The server loads products from `https://fakestoreapi.com/products` at startup and maps them to the storefront's supported categories. Fake Store API prices are USD; `DEMO_USD_TO_BDT` converts them to whole BDT amounts (default `120`). This is a fixed demo conversion rate, not a live exchange rate. Change it in `.env` as needed. If the API is unavailable or returns invalid data, the server logs the failure and uses its bundled sample catalog instead. The catalog is server-owned for checkout pricing; the browser cannot set order prices.

## Order management

- Orders are validated, priced against the server catalog, and persisted in PostgreSQL.
- Repeated checkout submissions with the same event ID and order details return the original order instead of creating duplicates. Reusing an event ID for different details is rejected.
- The cart and wishlist are saved in the current browser only; they are not linked to an account or synchronized across devices. The cart reconciles saved products with the current catalog, caps each product at 99 units and known stock, and blocks checkout when saved quantities are no longer available. The server independently enforces the same per-product limit and inventory at order placement.
- Customers can use **Find your order** in the storefront to look up an order using its order number and the checkout phone number; no account or registration is required. The lookup is rate-limited, is not cached, and returns only order items, totals, fulfillment status, and manual advance-review status (not delivery address or sender phone). Manual review is not payment-provider confirmation.
- The first admin email and password are seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; passwords are stored as scrypt hashes. There is no public admin registration.
- The dashboard requires sign-in, supports status filtering and pagination, shows customer/item/payment-reference details, and updates order status.
- The authenticated **Products** admin section accepts JPEG, PNG, and WebP product images up to 5 MB, validates image signatures and product fields, saves product details in PostgreSQL and images in persistent storage, and publishes each product through the storefront catalog API. Admins can edit listing details, stock quantity, and purchase availability; replace an image; and delete products that should no longer be offered. Replaced and deleted images are removed from storage; cleanup failures are logged and surfaced in the dashboard. Product IDs, prices, inventory, and checkout availability are server-owned. Managed-product stock is reserved atomically when checkout accepts an order, so concurrent orders cannot oversell it; cancelling an order returns its reserved stock, and reopening it reserves that stock again or leaves the order cancelled if stock is no longer available. Legacy orders are not restocked because their inventory was not reserved. A database migration gives existing managed products zero stock, so set their actual stock in the admin dashboard before accepting orders. Deleting a product prevents new checkouts but does not alter historical order snapshots. Back up the `shopademia-product-images` Docker volume together with the database; local development stores images in the ignored `uploads/` directory.
- Admin order-status changes and manual advance-payment reviews are recorded in an order activity history with actor and before/after values. Existing orders have no historical events before this feature was deployed.
- The authenticated Admin profile section shows the account email and supports password changes. Passwords are stored as salted scrypt hashes; changing a password invalidates every active admin session. `ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the account only when the database has no admin account; later password changes persist in the database and are not reset by app restarts or environment edits. The email is read-only in the dashboard; change it only through a planned, authenticated database maintenance operation.
- Admin sessions use signed eight-hour tokens tracked server-side; signing out revokes the current token, and changing a password invalidates all sessions. Customer order records are available only from authenticated admin endpoints.
- Order statuses: `new`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.

The admin login is served on the same origin as the API. `/healthz` reports readiness only while PostgreSQL is reachable. The production Compose stack below keeps Node and PostgreSQL off the public host ports, places the database on a private Docker network, and configures the app to trust only its single Caddy proxy hop.

## Payment and launch requirements

There is **no bKash API integration**. Per the current launch plan, the product catalog temporarily uses `https://fakestoreapi.com/products`; its data and converted prices are not owned inventory and are not authoritative business pricing. Checkout collects the sender number as a reference only; the customer must wait for the store's payment instructions, and that number is not evidence of payment. Admins can record a manual advance review as verified or rejected, including reviewer and timestamp. Verify the transaction against your own bKash records before marking it verified. This review record is operational bookkeeping, not a payment-provider confirmation. The requested advance amount is served from `DELIVERY_ADVANCE_CHARGE`; it is not automatically deducted from the products due on delivery.

The storefront footer lists Shopademia's customer-support email, phone, and WhatsApp contact. Configure database backups, monitoring, and HTTPS on the production host before accepting orders. The Fake Store catalog and conversion rate are being used temporarily as requested, but remain demo data rather than owned inventory or authoritative business pricing.

## Production hardening checklist

### Self-hosted Docker deployment

This deployment targets a single Linux VM with Docker Compose and a public DNS name. It is deliberately single-app-instance because the current rate limiter uses per-process memory.

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

   Schedule it with the host's systemd timer or cron, retain backups according to your policy, and copy encrypted files to an off-host backup provider. Keep the age private key separately; without it, backups cannot be decrypted. Regularly test restore into a separate empty database before relying on backups.
6. Configure an external uptime monitor to request `https://<your-domain>/healthz`, alert on non-200 responses, and check service logs. Configure log retention, host patching, secret rotation, and an incident contact before opening the service to customers. The PostgreSQL volume is persistent but is not itself a backup.

The database runs as an unprivileged `shopademia_app` role; the separate bootstrap role is used only by PostgreSQL initialization. The init script runs only when the database volume is first created. This production Compose stack uses a dedicated volume; do not point it at an existing database volume without planning a role/ownership migration. The app has no published host port, and `TRUST_PROXY_HOPS=1` is correct only while Caddy is its sole trusted proxy. If you add another proxy/load balancer, update the hop count and ensure the proxy chain strips client-supplied forwarding headers.

Login and checkout are limited to 8 and 30 requests per client IP per 15 minutes, respectively. These limits are in-memory and reset on restart; do not scale to multiple app replicas without adding a shared rate-limit store, and add edge-level abuse controls if traffic warrants them.

### Launch blockers for real commerce

This deployment provides TLS and hardened service networking, but it does **not** make the demo catalog production commerce-ready. Before accepting real orders, test database restore and order recovery, configure actual off-host backup storage and uptime alerts, and review local privacy/tax/consumer requirements. The Fake Store catalog and conversion pricing are temporary and are not authoritative business inventory/prices. Payments remain manual: train staff to compare sender numbers and transactions in the bKash merchant records, and never treat the dashboard's manual status as provider verification.

Run backend validation and route tests with `npm test`.
