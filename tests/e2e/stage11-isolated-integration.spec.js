import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';
import { hashAdminPassword } from '../../server/adminPassword.js';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '');
const databaseUrl = process.env.STAGE11_DATABASE_URL;
const expectedDatabase = process.env.STAGE11_DATABASE_NAME;
const expectedRole = process.env.STAGE11_DATABASE_ROLE;
const expectedDatabaseMarker = process.env.STAGE11_DATABASE_MARKER || 'SHOPADEMIA_STAGE11_ISOLATED';
const expectedRoleMarker = process.env.STAGE11_ROLE_MARKER || 'SHOPADEMIA_STAGE11_APP_ROLE';
const adminEmail = process.env.STAGE11_ADMIN_EMAIL;
const adminPassword = process.env.STAGE11_ADMIN_PASSWORD;
const shopId = '00000000-0000-4000-8000-000000000001';
const runId = randomUUID().slice(0, 8);
const categoryName = `Stage 11 ${runId}`;
const categoryId = categoryName.toLowerCase().replaceAll(' ', '-');
const productName = `Stage 11 Product ${runId}`;
const imageUrl = `https://images.example.com/${runId}.png`;
const productImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhZkAAAAASUVORK5CYII=',
    'base64'
);

let pool;
let orderNumber;
let productId;
let productCreateCount = 0;

function assertLocalTarget() {
    const appUrl = new URL(baseUrl);
    if (appUrl.protocol !== 'http:' || !['127.0.0.1', '::1', '[::1]'].includes(appUrl.hostname)) {
        throw new Error('Stage 11 browser tests require an HTTP loopback application URL.');
    }
    if (!databaseUrl || !expectedDatabase || !expectedRole || !adminEmail || !adminPassword) {
        throw new Error('Stage 11 isolated database and synthetic admin settings are required.');
    }
}

async function isolateBrowserNetwork(page) {
    const appOrigin = new URL(baseUrl).origin;
    await page.route('**/*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === appOrigin) {
            await route.continue();
        } else if (requestUrl.href === imageUrl) {
            await route.fulfill({ status: 200, contentType: 'image/png', body: productImage });
        } else {
            await route.abort();
        }
    });
}

async function signIn(page, view) {
    await page.goto(`${baseUrl}/admin?view=${view}`);
    await page.getByLabel('Admin email').fill(adminEmail);
    await page.getByLabel('Password', { exact: true }).fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#dashboardPanel')).toBeVisible();
    if (view === 'products') {
        await page.getByRole('button', { name: 'Open admin navigation' }).click();
        await page.locator('#adminSidebarNav details').filter({ hasText: 'Products' }).locator('summary').click();
        await page.getByRole('button', { name: 'Manage Products' }).click();
    }
    await expect(page.locator(view === 'products' ? '#productsPanel' : '#ordersPanel')).toBeVisible();
}

test.beforeAll(async () => {
    assertLocalTarget();
    pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const identity = await pool.query(`
        SELECT current_database() AS database_name,
               current_user AS role_name,
               split_part(inet_server_addr()::text, '/', 1) AS server_address,
               inet_server_port() AS server_port,
               role.rolsuper AS is_superuser,
               role.rolcreatedb AS can_create_database,
               role.rolcreaterole AS can_create_role,
               shobj_description(db.oid, 'pg_database') AS database_marker,
               shobj_description(role.oid, 'pg_authid') AS role_marker
        FROM pg_database db
        JOIN pg_roles role ON role.rolname = current_user
        WHERE db.datname = current_database()
    `);
    const target = identity.rows[0];
    expect(target.database_name).toBe(expectedDatabase);
    expect(target.role_name).toBe(expectedRole);
    expect(target.server_address).toBe('127.0.0.1');
    expect(target.is_superuser).toBe(false);
    expect(target.can_create_database).toBe(false);
    expect(target.can_create_role).toBe(false);
    expect(target.database_marker).toContain(expectedDatabaseMarker);
    expect(target.role_marker).toContain(expectedRoleMarker);

    const passwordHash = await hashAdminPassword(adminPassword);
    const user = await pool.query(
        `INSERT INTO admin_users (email, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [adminEmail, passwordHash]
    );
    await pool.query(
        `INSERT INTO shop_memberships (shop_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (shop_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [shopId, user.rows[0].id, 'owner']
    );
});

test.afterAll(async () => {
    await pool?.end();
});

test('admin signs in and creates an isolated category and product through the UI', async ({ page }) => {
    await isolateBrowserNetwork(page);
    await signIn(page, 'products');

    await page.getByLabel('Category name').fill(categoryName);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByText('Category added.')).toBeVisible();
    await expect(page.locator('#productCategory option').filter({ hasText: categoryName })).toHaveCount(1);

    await page.getByLabel('Product name').fill(productName);
    await page.getByLabel('Price (whole BDT)').fill('1250');
    await page.getByLabel('Stock quantity').fill('5');
    await page.getByLabel('Category', { exact: true }).selectOption(categoryId);
    await page.locator('#productDescription').fill('Synthetic Stage 11 browser test product.');
    await page.getByLabel('Product image alt text').fill('Synthetic browser test item');
    await page.getByLabel('SEO title').fill(`${productName} | Test`);
    await page.getByLabel('Meta description').fill('Synthetic isolated browser test product.');
    await page.getByLabel('Or add image links').fill(imageUrl);

    let releaseProductCreate;
    let signalProductRequest;
    const productRequestStarted = new Promise((resolve) => { signalProductRequest = resolve; });
    const productRequestGate = new Promise((resolve) => { releaseProductCreate = resolve; });
    await page.route('**/api/v1/admin/products', async (route) => {
        if (route.request().method() === 'POST') {
            productCreateCount += 1;
            signalProductRequest();
            await productRequestGate;
        }
        await route.continue();
    });
    const createButton = page.locator('#createProductButton');
    await createButton.click();
    await productRequestStarted;
    await expect(createButton).toBeDisabled();
    await createButton.evaluate((button) => button.click());
    expect(productCreateCount).toBe(1);
    releaseProductCreate();
    await expect(page.getByText(`${productName} was uploaded and published.`)).toBeVisible();
    expect(productCreateCount).toBe(1);

    const created = await pool.query(
        `SELECT id, name, category, price, stock_quantity, is_available
         FROM managed_products WHERE shop_id = $1 AND name = $2`,
        [shopId, productName]
    );
    expect(created.rows).toHaveLength(1);
    productId = created.rows[0].id;
    expect(created.rows[0]).toMatchObject({
        name: productName,
        category: categoryId,
        price: '1250',
        stock_quantity: '5',
        is_available: true
    });
});

test('storefront loads product details and safely retries checkout after a transient failure', async ({ page }) => {
    test.skip(!productId, 'The preceding isolated admin UI test must create the product.');
    await isolateBrowserNetwork(page);
    const initialOrderCount = await pool.query('SELECT count(*)::int AS count FROM orders');
    let orderRequestCount = 0;
    const submittedEventIds = [];
    await page.route('**/api/v1/orders', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        orderRequestCount += 1;
        const payload = route.request().postDataJSON();
        submittedEventIds.push(payload.eventId);
        if (orderRequestCount === 1) {
            return route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Temporary test interruption.' })
            });
        }
        return route.continue();
    });

    await page.goto(`${baseUrl}/?shop=main`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await page.locator('#searchInput').fill(productName);
    await expect(page.locator(`#featuredProductGrid [data-id="${productId}"]`)).toBeVisible();
    await page.locator(`#featuredProductGrid [data-id="${productId}"]`)
        .getByRole('link', { name: `View details for ${productName}` }).click();
    await expect(page).toHaveURL(new RegExp(`/product/${productId}`));
    await expect(page.getByRole('heading', { name: productName })).toBeVisible();

    await page.goto(`${baseUrl}/?shop=main`);
    await page.locator('#searchInput').fill(productName);
    await page.locator(`#featuredProductGrid [data-id="${productId}"]`).getByRole('button', { name: 'Buy now' }).click();
    await expect(page.locator('#checkoutModal')).not.toHaveClass(/hidden/);

    await page.locator('#coName').fill('Stage 11 Test Buyer');
    await page.locator('#coPhone').fill('01712345678');
    await page.locator('#coAddress').fill('House 11, Test Road, Isolated City');
    await page.locator('#coBkash').fill('01712345678');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.locator('#checkoutServerError')).toContainText('Temporary test interruption.');
    await expect(page.locator('#coName')).toHaveValue('Stage 11 Test Buyer');
    expect(orderRequestCount).toBe(1);
    const beforeRetry = await pool.query('SELECT count(*)::int AS count FROM orders');
    expect(beforeRetry.rows[0].count).toBe(initialOrderCount.rows[0].count);

    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.locator('#checkoutSuccessPanel')).toBeVisible();
    expect(orderRequestCount).toBe(2);
    expect(submittedEventIds[0]).toBeTruthy();
    expect(submittedEventIds[1]).toBe(submittedEventIds[0]);
    orderNumber = (await page.locator('#coOrderNumber').textContent()).trim();
    expect(orderNumber).not.toBe('');

    const persisted = await pool.query(
        `SELECT order_number, event_id, status, subtotal, advance_amount, due_amount,
                items, inventory_reserved
         FROM orders WHERE order_number = $1`,
        [orderNumber]
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0].event_id).toBe(submittedEventIds[0]);
    expect(persisted.rows[0].status).toBe('new');
    expect(persisted.rows[0].subtotal).toBe('1250');
    expect(persisted.rows[0].inventory_reserved).toBe(true);
    expect(persisted.rows[0].items).toEqual([
        expect.objectContaining({ productId, quantity: 1, name: productName })
    ]);
    const stock = await pool.query('SELECT stock_quantity FROM managed_products WHERE id = $1', [productId]);
    expect(stock.rows[0].stock_quantity).toBe('4');
});

test('shop administrator updates order status and the activity is persisted', async ({ page }) => {
    test.skip(!orderNumber, 'The preceding storefront test must persist an isolated test order.');
    await isolateBrowserNetwork(page);
    await signIn(page, 'orders');
    const orderCard = page.locator('.order-card').filter({ hasText: orderNumber });
    await expect(orderCard).toBeVisible();
    await orderCard.getByLabel(`Update status for order ${orderNumber}`).selectOption('confirmed');
    await orderCard.getByRole('button', { name: 'Save status' }).click();
    await expect(page.getByText(`Order ${orderNumber} updated.`)).toBeVisible();
    await orderCard.getByRole('button', { name: 'View activity' }).click();
    await expect(orderCard.locator('.order-activity')).toContainText('new → confirmed');

    const persisted = await pool.query(
        `SELECT o.status, event.action, event.previous_value, event.new_value
         FROM orders o
         JOIN admin_order_events event ON event.order_id = o.id
         WHERE o.order_number = $1
         ORDER BY event.id DESC LIMIT 1`,
        [orderNumber]
    );
    expect(persisted.rows).toEqual([{
        status: 'confirmed',
        action: 'status_changed',
        previous_value: 'new',
        new_value: 'confirmed'
    }]);
});
