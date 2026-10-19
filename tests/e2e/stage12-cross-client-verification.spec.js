import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, request, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '');
const databaseUrl = process.env.STAGE12_DATABASE_URL;
const expectedDatabase = process.env.STAGE12_DATABASE_NAME;
const expectedRole = process.env.STAGE12_DATABASE_ROLE;
const databaseMarker = process.env.STAGE12_DATABASE_MARKER;
const roleMarker = process.env.STAGE12_ROLE_MARKER;
const adminEmail = process.env.STAGE12_ADMIN_EMAIL;
const adminPassword = process.env.STAGE12_ADMIN_PASSWORD;
const runId = process.env.STAGE12_RUN_ID;
const webProductId = process.env.STAGE12_WEB_PRODUCT_ID;
const androidProductId = process.env.STAGE12_ANDROID_PRODUCT_ID;
const orderId = process.env.STAGE12_ORDER_ID;
const orderNumber = process.env.STAGE12_ORDER_NUMBER;
let pool;

function assertLocalTarget() {
    const appUrl = new URL(baseUrl);
    if (appUrl.protocol !== 'http:' || !['127.0.0.1', '::1', '[::1]'].includes(appUrl.hostname)) {
        throw new Error('Stage 12 verification requires an HTTP loopback application URL.');
    }
    if (!databaseUrl || !expectedDatabase || !expectedRole || !databaseMarker || !roleMarker || !adminEmail || !adminPassword
        || !runId || !webProductId || !androidProductId || !orderId || !orderNumber) {
        throw new Error('Stage 12 isolated target, test account, and test record settings are required.');
    }
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
               role.rolsuper AS is_superuser,
               role.rolcreatedb AS can_create_database,
               role.rolcreaterole AS can_create_role,
               shobj_description(db.oid, 'pg_database') AS database_marker,
               shobj_description(role.oid, 'pg_authid') AS role_marker
        FROM pg_database db
        JOIN pg_roles role ON role.rolname = current_user
        WHERE db.datname = current_database()
    `);
    expect(identity.rows).toHaveLength(1);
    expect(identity.rows[0]).toMatchObject({
        database_name: expectedDatabase,
        role_name: expectedRole,
        server_address: '127.0.0.1',
        is_superuser: false,
        can_create_database: false,
        can_create_role: false
    });
    expect(identity.rows[0].database_marker).toContain(databaseMarker);
    expect(identity.rows[0].role_marker).toContain(roleMarker);
});

test.afterAll(async () => {
    await pool?.end();
});

test('web admin and public catalog read Android product and inventory changes', async ({ page }) => {
    await signIn(page, 'products');

    const products = page.locator('#productsList .product-admin-card');
    const webProduct = products.filter({ hasText: `Stage12 Android edited ${runId}` });
    await expect(webProduct).toBeVisible();
    await expect(webProduct).toContainText('4 in stock');

    const androidProduct = products.filter({ hasText: `Stage12 Android product ${runId}` });
    await expect(androidProduct).toBeVisible();
    await expect(androidProduct).toContainText('5 in stock');
    await expect(page.locator('#categoriesList')).toContainText(`Stage12 renamed ${runId}`);

    const publicResponse = await page.request.get(`${baseUrl}/api/v1/shops/main/products`);
    expect(publicResponse.ok()).toBe(true);
    const publicCatalog = await publicResponse.json();
    expect(publicCatalog.data).toEqual(expect.arrayContaining([
        expect.objectContaining({
            id: webProductId,
            name: `Stage12 Android edited ${runId}`,
            stockQuantity: 4
        }),
        expect.objectContaining({
            id: androidProductId,
            name: `Stage12 Android product ${runId}`,
            stockQuantity: 5
        })
    ]));

    const persisted = await pool.query(
        `SELECT id, name, description, stock_quantity
         FROM managed_products WHERE id = ANY($1::text[])
         ORDER BY id`,
        [[webProductId, androidProductId]]
    );
    expect(persisted.rows).toHaveLength(2);
    expect(persisted.rows.find(({ id }) => id === webProductId)).toMatchObject({
        name: `Stage12 Android edited ${runId}`,
        description: 'Edited by the Android client for isolated Stage 12 verification.',
        stock_quantity: '4'
    });
    expect(persisted.rows.find(({ id }) => id === androidProductId)).toMatchObject({
        name: `Stage12 Android product ${runId}`,
        stock_quantity: '5'
    });

    const adjustments = await pool.query(
        `SELECT count(*)::int AS count
         FROM inventory_adjustments
         WHERE product_id = $1 AND delta = 2`,
        [androidProductId]
    );
    expect(adjustments.rows[0].count).toBe(1);
});

test('web order activity reflects Android status change', async ({ page }) => {
    await signIn(page, 'orders');
    const orderCard = page.locator('.order-card').filter({ hasText: orderNumber });
    await expect(orderCard).toBeVisible();
    await expect(orderCard.locator('.status-processing')).toBeVisible();
    await orderCard.getByRole('button', { name: 'View activity' }).click();
    await expect(orderCard.locator('.order-activity')).toContainText('confirmed → processing');

    const persisted = await pool.query(
        `SELECT o.status, event.action, event.previous_value, event.new_value
         FROM orders o
         JOIN admin_order_events event ON event.order_id = o.id
         WHERE o.id = $1
         ORDER BY event.id DESC LIMIT 1`,
        [orderId]
    );
    expect(persisted.rows).toEqual([{
        status: 'processing',
        action: 'status_changed',
        previous_value: 'confirmed',
        new_value: 'processing'
    }]);
});

test('unauthenticated browser API mutations are rejected without changing shared state', async () => {
    const anonymous = await request.newContext({ baseURL: baseUrl });
    const before = await pool.query(`
        SELECT (SELECT count(*)::int FROM managed_products) AS products,
               (SELECT stock_quantity FROM managed_products WHERE id = $1) AS stock,
               (SELECT status FROM orders WHERE id = $2) AS order_status
    `, [webProductId, orderId]);
    try {
        const productResponse = await anonymous.post('/api/v1/admin/products', {
            headers: { 'Idempotency-Key': randomUUID() }
        });
        const inventoryResponse = await anonymous.post(
            `/api/v1/admin/products/${encodeURIComponent(webProductId)}/inventory-adjustments`,
            { data: { delta: 1, reason: 'Unauthorized browser request', idempotencyKey: randomUUID() } }
        );
        const orderResponse = await anonymous.patch(
            `/api/v1/admin/orders/${encodeURIComponent(orderId)}/status`,
            { data: { status: 'shipped' } }
        );
        expect(productResponse.status()).toBe(401);
        expect(inventoryResponse.status()).toBe(401);
        expect(orderResponse.status()).toBe(401);
    } finally {
        await anonymous.dispose();
    }
    const after = await pool.query(`
        SELECT (SELECT count(*)::int FROM managed_products) AS products,
               (SELECT stock_quantity FROM managed_products WHERE id = $1) AS stock,
               (SELECT status FROM orders WHERE id = $2) AS order_status
    `, [webProductId, orderId]);
    expect(after.rows).toEqual(before.rows);
});
