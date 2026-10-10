import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { hashAdminPassword } from './adminPassword.js';
import { findProduct, getManagedProducts, setManagedProducts } from './catalog.js';

const config = {
    adminEmail: 'admin@example.com',
    adminPassword: 'test-only-strong-password',
    jwtSecret: 'test-only-secret-with-more-than-32-characters',
    advanceCharge: 100
};
const initialAdminPasswordHash = await hashAdminPassword(config.adminPassword);

test('service worker source parses successfully', async () => {
    const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
    assert.doesNotThrow(() => new Script(source));
});

function fakePool() {
    const orders = new Map();
    const orderEvents = [];
    const managedProducts = new Map();
    const adminUsers = new Map();
    const shopMemberships = new Map();
    const platformAdmins = new Set();
    const mainShopId = '00000000-0000-4000-8000-000000000001';
    const admin = {
        id: '00000000-0000-4000-8000-000000000101',
        email: config.adminEmail,
        passwordHash: initialAdminPasswordHash,
        sessionVersion: 1
    };
    adminUsers.set(admin.id, admin);
    shopMemberships.set(`${mainShopId}:${admin.id}`, {
        shopId: mainShopId,
        userId: admin.id,
        role: 'owner'
    });
    const sessions = new Map();
    let passwordChangeRaceHash = null;
    let failOrderRetryLookup = false;
    let transactionSnapshot = null;
    return Object.assign({
        markLegacyRequestHash(eventId) {
            orders.get(eventId).requestHash = null;
        },
        failOrderRetryLookup() {
            failOrderRetryLookup = true;
        },
        raceAdminPasswordChange(passwordHash) {
            passwordChangeRaceHash = passwordHash;
        },
        addAdminUser(user) {
            adminUsers.set(user.id, { ...user, sessionVersion: Number(user.sessionVersion ?? 1) });
        },
        addPlatformAdmin(user) {
            adminUsers.set(user.id, { ...user, sessionVersion: Number(user.sessionVersion ?? 1) });
            platformAdmins.add(user.id);
        },
        addShopMembership(shopId, userId, role) {
            shopMemberships.set(`${shopId}:${userId}`, { shopId, userId, role });
        },
        addActiveSession(tokenId, userId, shopId = '00000000-0000-4000-8000-000000000001') {
            sessions.set(tokenId, { userId, shopId, revoked: false });
        },
        async connect() {
            const pool = this;
            return { query: (...args) => pool.query(...args), release() {} };
        },
        async query(sql, values = []) {
            if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
            if (sql === 'BEGIN') {
                transactionSnapshot = {
                    managedProducts: structuredClone([...managedProducts]),
                    orders: structuredClone([...orders]),
                    orderEvents: structuredClone(orderEvents)
                };
                return { rows: [] };
            }
            if (sql === 'COMMIT') {
                transactionSnapshot = null;
                return { rows: [] };
            }
            if (sql === 'ROLLBACK') {
                if (transactionSnapshot) {
                    managedProducts.clear();
                    for (const [id, product] of transactionSnapshot.managedProducts) managedProducts.set(id, product);
                    orders.clear();
                    for (const [eventId, order] of transactionSnapshot.orders) orders.set(eventId, order);
                    orderEvents.splice(0, orderEvents.length, ...transactionSnapshot.orderEvents);
                }
                transactionSnapshot = null;
                return { rows: [] };
            }
            if (sql.includes('WITH requested AS') && sql.includes('stock_quantity')) {
                const [ids, quantities, reserve] = values;
                const requests = ids.map((id, index) => ({ id, quantity: Number(quantities[index]) }));
                const canAdjust = !reserve || requests.every(({ id, quantity }) => {
                    const product = managedProducts.get(id);
                    return product && product.isAvailable && Number(product.stockQuantity) >= quantity;
                });
                const stockUpdates = {};
                if (canAdjust) {
                    for (const { id, quantity } of requests) {
                        const product = managedProducts.get(id);
                        if (!product) continue;
                        product.stockQuantity = String(Number(product.stockQuantity) + (reserve ? -quantity : quantity));
                        stockUpdates[id] = product.stockQuantity;
                    }
                }
                return {
                    rows: [{
                        requestedCount: requests.length,
                        adjustedCount: canAdjust ? Object.keys(stockUpdates).length : 0,
                        stockUpdates
                    }]
                };
            }
            if (sql.includes('UPDATE managed_products')) {
                const [name, description, price, oldPrice, category, id, stockQuantity, isAvailable, image] = values;
                const current = managedProducts.get(id);
                if (!current) return { rows: [] };
                const row = {
                    ...current,
                    name,
                    description,
                    price: String(price),
                    oldPrice: oldPrice === null ? null : String(oldPrice),
                    category,
                    image: image ?? current.image,
                    stockQuantity: String(stockQuantity),
                    isAvailable,
                    previousImage: current.image
                };
                managedProducts.set(id, row);
                return { rows: [row] };
            }
            if (sql.includes('DELETE FROM managed_products')) {
                const [id] = values;
                const current = managedProducts.get(id);
                if (!current) return { rows: [] };
                managedProducts.delete(id);
                return { rows: [{ id, image: current.image }] };
            }
            if (sql.includes('FROM managed_products')) {
                return {
                    rows: [...managedProducts.values()]
                        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                };
            }
            if (sql.includes('INSERT INTO managed_products')) {
                const [id, name, description, price, oldPrice, category, image] = values;
                const row = {
                    id, name, description, price: String(price),
                    oldPrice: oldPrice === null ? null : String(oldPrice),
                    category, image, stockQuantity: String(values[7]), isAvailable: values[8],
                    shopId: values[9], createdAt: new Date()
                };
                managedProducts.set(id, row);
                return { rows: [row] };
            }
            if (sql.includes('SELECT u.id, u.email, u.password_hash')) {
                const user = [...adminUsers.values()].find(({ email }) => email === values[0]);
                return {
                    rows: user ? [{
                        id: user.id,
                        email: user.email,
                        password_hash: user.passwordHash,
                        sessionVersion: user.sessionVersion,
                        isPlatformAdmin: platformAdmins.has(user.id)
                    }] : []
                };
            }
            if (sql.includes('SELECT m.shop_id AS "shopId"') && sql.includes('FROM shop_memberships m')) {
                const membership = shopMemberships.get(`${mainShopId}:${values[0]}`);
                return { rows: membership ? [{ shopId: membership.shopId }] : [] };
            }
            if (sql.includes('SELECT c.email, c.session_version')) {
                const session = sessions.get(values[0]);
                return {
                    rows: session && !session.revoked && session.shopId === values[1]
                        ? [{ email: admin.email, session_version: admin.sessionVersion }]
                        : []
                };
            }
            if (sql.includes('SELECT u.email, u.session_version AS "sessionVersion"') || sql.includes('SELECT u.email, u.session_version AS "sessionVersion"')) {
                const session = sessions.get(values[0]);
                const user = session && session.userId ? adminUsers.get(session.userId) : null;
                if (!session || session.revoked || !user) return { rows: [] };
                const isPlatformAdmin = platformAdmins.has(user.id);
                const membership = shopMemberships.get(`${values[3]}:${user.id}`);
                if (session.shopId !== values[4] || (!isPlatformAdmin && !membership)) {
                    return { rows: [] };
                }
                return {
                    rows: [{
                        email: user.email,
                        sessionVersion: user.sessionVersion,
                        shopId: membership?.shopId ?? null,
                        role: membership?.role ?? null,
                        isPlatformAdmin,
                        status: 'active'
                    }]
                };
            }
            if (sql.includes('SELECT m.shop_id AS "shopId", m.role') && sql.includes('FROM shop_memberships m')) {
                const user = [...adminUsers.values()].find(({ email }) => email === values[0]);
                const membership = user && shopMemberships.get(`${values[1]}:${user.id}`);
                return { rows: membership ? [{ shopId: membership.shopId, role: membership.role }] : [] };
            }
            if (sql.includes('FROM admin_users u') && sql.includes('JOIN shop_memberships m')) {
                return { rows: [] };
            }
            if (sql.includes('SELECT email FROM admin_users WHERE id = $1')) {
                const user = adminUsers.get(values[0]);
                return { rows: user ? [{ email: user.email }] : [] };
            }
            if (sql.includes('SELECT password_hash FROM admin_users WHERE id = $1')) {
                const user = adminUsers.get(values[0]);
                return { rows: user ? [{ password_hash: user.passwordHash }] : [] };
            }
            if (sql.includes('UPDATE admin_users')) {
                const user = adminUsers.get(values[1]);
                if (!user) return { rows: [] };
                if (passwordChangeRaceHash) {
                    user.passwordHash = passwordChangeRaceHash;
                    passwordChangeRaceHash = null;
                }
                if (values[2] !== user.passwordHash) return { rows: [] };
                user.passwordHash = values[0];
                user.sessionVersion += 1;
                return { rows: [{ id: user.id, email: user.email }] };
            }
            if (sql.includes('INSERT INTO admin_sessions')) {
                const tokenId = values[0];
                const hasUserId = sql.includes('user_id, shop_id');
                const userId = hasUserId ? values[1] : null;
                const shopId = hasUserId ? values[2] : values[1];
                sessions.set(tokenId, { userId, shopId, revoked: false });
                return { rows: [] };
            }
            if (sql.includes('UPDATE admin_sessions')) {
                if (sql.includes('WHERE user_id = $1 AND shop_id = $2')) {
                    for (const session of sessions.values()) {
                        if (session.userId === values[0] && session.shopId === values[1]) session.revoked = true;
                    }
                    return { rows: [] };
                }
                if (sql.includes('WHERE user_id = $1')) {
                    for (const session of sessions.values()) {
                        if (session.userId === values[0]) session.revoked = true;
                    }
                    return { rows: [] };
                }
                const session = sessions.get(values[0]);
                if (session) session.revoked = true;
                return { rows: [] };
            }
            if (sql.includes('DELETE FROM admin_sessions')) return { rows: [] };
            if (sql.includes('UPDATE shop_memberships AS m')) {
                const role = values[0];
                const shopId = values[1];
                const userId = values[2];
                const member = shopMemberships.get(`${shopId}:${userId}`);
                if (!member) return { rows: [] };
                member.role = role;
                return { rows: [{ id: userId, email: adminUsers.get(userId)?.email, role }] };
            }
            if (sql.includes('DELETE FROM shop_memberships m USING admin_users u')) {
                const shopId = values[0];
                const userId = values[1];
                const member = shopMemberships.get(`${shopId}:${userId}`);
                if (!member) return { rows: [] };
                shopMemberships.delete(`${shopId}:${userId}`);
                return { rows: [{ id: userId, email: adminUsers.get(userId)?.email }] };
            }
            if (sql.includes('FROM admin_order_events')) {
                return {
                    rows: orderEvents
                        .filter((event) => event.orderId === values[0])
                        .sort((a, b) => b.id - a.id)
                        .slice(0, 100)
                };
            }
            if (sql.includes('SELECT email, session_version FROM admin_credentials')) {
                return { rows: [{ email: admin.email, session_version: admin.sessionVersion }] };
            }
            if (sql.includes('SELECT email, password_hash, session_version FROM admin_credentials')) {
                return { rows: [{
                    email: admin.email,
                    password_hash: admin.passwordHash,
                    session_version: admin.sessionVersion
                }] };
            }
            if (sql.includes('SELECT password_hash FROM admin_credentials')) {
                return { rows: [{ password_hash: admin.passwordHash }] };
            }
            if (sql.includes('SELECT email FROM admin_credentials')) {
                return { rows: [{ email: admin.email }] };
            }
            if (sql.includes('UPDATE admin_credentials')) {
                if (passwordChangeRaceHash) {
                    admin.passwordHash = passwordChangeRaceHash;
                    passwordChangeRaceHash = null;
                }
                if (values[1] !== admin.passwordHash) return { rows: [] };
                admin.passwordHash = values[0];
                admin.sessionVersion += 1;
                return { rows: [{ email: admin.email }] };
            }
            if (sql.includes('INSERT INTO orders')) {
                const [orderNumber, eventId, requestHash, name, phone, address, bkashNumber, items, subtotal, advanceAmount, due, inventoryReserved, shopId] = values;
                if (orders.has(eventId)) return { rows: [] };
                const row = {
                    id: String(orders.size + 1), orderNumber, eventId,
                    shopId,
                    requestHash,
                    customerName: name, phone, address, bkashNumber,
                    items: JSON.parse(items), subtotal: String(subtotal),
                    advanceAmount: String(advanceAmount), due: String(due), status: 'new',
                    inventoryReserved,
                    advancePaymentStatus: 'pending',
                    advancePaymentCheckedAt: null,
                    advancePaymentCheckedBy: null,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                orders.set(eventId, row);
                return { rows: [{ order_number: orderNumber, request_hash: requestHash, subtotal: String(subtotal), advanceAmount: String(advanceAmount), due: String(due) }] };
            }
            if (sql.includes('WHERE order_number = $1 AND phone = $2')) {
                const row = [...orders.values()].find((order) => order.orderNumber === values[0] && order.phone === values[1]);
                return {
                    rows: row ? [{
                        orderNumber: row.orderNumber,
                        status: row.status,
                        items: row.items,
                        subtotal: row.subtotal,
                        advanceAmount: row.advanceAmount,
                        due: row.due,
                        advancePaymentStatus: row.advancePaymentStatus,
                        createdAt: row.createdAt
                    }] : []
                };
            }
            if (sql.includes('FROM orders WHERE event_id')) {
                if (failOrderRetryLookup && !sql.includes('FOR UPDATE')) {
                    throw new Error('Test-only idempotency lookup failure.');
                }
                const row = orders.get(values[0]);
                return { rows: row ? [{
                    order_number: row.orderNumber,
                    request_hash: row.requestHash,
                    customer_name: row.customerName,
                    phone: row.phone,
                    address: row.address,
                    bkash_number: row.bkashNumber,
                    items: row.items,
                    advance_amount: row.advanceAmount,
                    subtotal: row.subtotal,
                    advanceAmount: row.advanceAmount,
                    due: row.due
                }] : [] };
            }
            if (sql.includes('SELECT id, status, items, inventory_reserved')) {
                const row = [...orders.values()].find((order) => order.id === values[0]);
                return { rows: row ? [{
                    id: row.id, status: row.status, items: row.items, inventoryReserved: row.inventoryReserved
                }] : [] };
            }
            if (sql.includes('COUNT(*)')) {
                const all = [...orders.values()];
                return { rows: [{ total: sql.includes('WHERE status') ? all.filter((order) => order.status === values[1]).length : all.length }] };
            }
            if (sql.includes('SELECT id, order_number')) {
                let all = [...orders.values()];
                if (sql.includes('WHERE status')) all = all.filter((order) => order.status === values[1]);
                const offset = values.length === 4 ? values[3] : values[2];
                const limit = values.length === 4 ? values[2] : values[1];
                return { rows: all.slice(offset, offset + limit).map(({ event_id, ...row }) => row) };
            }
            if (sql.includes('advance_payment_status = $1')) {
                const [status, id, checkedBy] = values;
                const row = [...orders.values()].find((order) => order.id === id);
                if (!row) return { rows: [] };
                const previousStatus = row.advancePaymentStatus;
                row.advancePaymentStatus = status;
                row.advancePaymentCheckedAt = new Date().toISOString();
                row.advancePaymentCheckedBy = checkedBy;
                row.updatedAt = row.advancePaymentCheckedAt;
                if (previousStatus !== status) {
                    orderEvents.push({
                        id: orderEvents.length + 1,
                        orderId: id,
                        actorEmail: checkedBy,
                        action: 'advance_payment_reviewed',
                        previousValue: previousStatus,
                        newValue: status,
                        createdAt: row.updatedAt
                    });
                }
                return { rows: [{
                    id: row.id,
                    orderNumber: row.orderNumber,
                    advancePaymentStatus: status,
                    advancePaymentCheckedAt: row.advancePaymentCheckedAt,
                    advancePaymentCheckedBy: checkedBy
                }] };
            }
            if (sql.includes('UPDATE orders')) {
                const isInventoryUpdate = sql.includes('inventory_reserved = $2');
                const [status, inventoryReservedOrId, idOrActor, actorEmail] = values;
                const id = isInventoryUpdate ? idOrActor : inventoryReservedOrId;
                const row = [...orders.values()].find((order) => order.id === id);
                if (!row) return { rows: [] };
                const previousStatus = row.status;
                row.status = status;
                if (isInventoryUpdate) row.inventoryReserved = inventoryReservedOrId;
                row.updatedAt = new Date().toISOString();
                return { rows: [{ id: row.id, orderNumber: row.orderNumber, status, updatedAt: row.updatedAt }] };
            }
            if (sql.includes('INSERT INTO admin_order_events')) {
                const [id, actorEmail, previousValue, newValue] = values;
                orderEvents.push({
                    id: orderEvents.length + 1, orderId: id, actorEmail,
                    action: 'status_changed', previousValue, newValue, createdAt: new Date().toISOString()
                });
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO shop_activity_logs')) return { rows: [] };
            if (sql.includes("SELECT id FROM shops WHERE status = 'active'")) {
                return { rows: [{ id: mainShopId }] };
            }
            if (sql.includes("SELECT status FROM shops WHERE slug = $1")) {
                return { rows: values[0] === 'main' ? [{ status: 'active' }] : [] };
            }
            if (sql.includes("SELECT advance_charge FROM shops WHERE id = $1 AND status = 'active'")) {
                return { rows: values[0] === mainShopId ? [{ advance_charge: 100 }] : [] };
            }
            if (sql.includes('SELECT id AS "shopId", advance_charge AS "advanceCharge"')
                && sql.includes("WHERE slug = 'main' AND status = 'active'")) {
                return { rows: [{ shopId: mainShopId, advanceCharge: 100 }] };
            }
            throw new Error(`Unexpected test query: ${sql}`);
        }
    }, {});
}

const payload = {
    customer: { name: 'Abid Hossain', phone: '01712345678', address: 'House 12, Road 5, Dhaka' },
    payment: { method: 'bkash', bkashNumber: '01812345678', advanceAmount: 1 },
    items: [{ productId: 1, quantity: 1 }],
    eventId: 'event-12345678',
    source: 'storefront'
};

test('shareable storefront routes serve the app shell', async () => {
    const app = createApp({ pool: fakePool(), config: { ...config, siteUrl: 'https://shopademia.example' } });
    for (const path of [
        '/product/1',
        '/category/gadgets',
        '/shops',
        '/shops/main',
        '/deals',
        '/about',
        '/find-order',
        '/privacy',
        '/terms'
    ]) {
        const response = await request(app).get(path).expect(200);
        assert.match(response.headers['content-type'], /text\/html/);
        assert.match(response.text, /\/js\/site-chrome\.js/);
        assert.match(response.text, /favicon\.svg/);
    }
    const product = await request(app).get('/product/1?shop=main').expect(200);
    assert.match(product.text, /<title>Wireless Earbuds Pro \| Shopademia<\/title>/);
    assert.match(product.text, /https:\/\/shopademia\.example\/product\/1\?shop=main/);
    const admin = await request(app).get('/admin').expect(200);
    const platform = await request(app).get('/admin/platform').expect(200);
    for (const response of [admin, platform]) {
        assert.match(response.text, /data-admin-site="true"/);
        assert.match(response.text, /site-chrome\.js/);
        assert.match(response.text, /favicon\.svg/);
        assert.match(response.text, /shopademia-mark\.svg/);
    }
});

test('publishes robots, a shop-aware sitemap, shared brand assets, and an HTML 404', async () => {
    const pool = fakePool();
    const query = pool.query.bind(pool);
    pool.query = async (sql, values) => {
        if (sql === "SELECT id, slug FROM shops WHERE status = 'active'") {
            return { rows: [{ id: '00000000-0000-4000-8000-000000000001', slug: 'main' }] };
        }
        return query(sql, values);
    };
    const app = createApp({ pool, config: { ...config, siteUrl: 'https://shopademia.example' } });

    const robots = await request(app).get('/robots.txt').expect(200);
    assert.match(robots.text, /Disallow: \/admin/);
    assert.match(robots.text, /Sitemap: https:\/\/shopademia\.example\/sitemap\.xml/);
    const sitemap = await request(app).get('/sitemap.xml').expect(200);
    assert.match(sitemap.headers['content-type'], /application\/xml/);
    assert.match(sitemap.text, /https:\/\/shopademia\.example\/privacy/);
    assert.match(sitemap.text, /https:\/\/shopademia\.example\/product\/1\?shop=main/);
    await request(app).get('/public-assets/favicon.svg').expect(200);
    await request(app).get('/public-assets/social-preview.png').expect(200);
    const notFound = await request(app).get('/missing-page').expect(404);
    assert.match(notFound.headers['content-type'], /text\/html/);
    assert.match(notFound.text, /This page took a wrong turn/);
    await request(app).get('/api/not-found').expect(404).expect({ error: 'Not found: GET /api/not-found' });
});

test('public shop directory returns active shop profiles', async () => {
    const pool = fakePool();
    const query = pool.query.bind(pool);
    pool.query = async (sql, values) => {
        if (sql.includes('FROM shops WHERE status =') && sql.includes('ORDER BY name, slug')) {
            return { rows: [{ slug: 'main', name: 'Main Shop', heroImage: null, bannerImage: null }] };
        }
        return query(sql, values);
    };
    const app = createApp({ pool, config });

    const response = await request(app).get('/api/v1/shops').expect(200);

    assert.deepEqual(response.body.data, [{ slug: 'main', name: 'Main Shop', heroImage: null, bannerImage: null }]);
});

test('cross-origin shop API exposes only that shop uploaded products with safe pagination', async (t) => {
    const previousProducts = getManagedProducts();
    t.after(() => setManagedProducts(previousProducts));
    setManagedProducts([
        {
            id: 'shop-one-product',
            shopId: '00000000-0000-4000-8000-000000000011',
            name: 'Shop One Item',
            description: 'Uploaded by shop one',
            price: 1200,
            oldPrice: null,
            image: '/uploads/11111111-1111-4111-8111-111111111111.webp',
            stockQuantity: 4,
            isAvailable: true,
            category: 'gadgets'
        },
        {
            id: 'shop-two-product',
            shopId: '00000000-0000-4000-8000-000000000022',
            name: 'Shop Two Item',
            description: 'Uploaded by shop two',
            price: 2400,
            oldPrice: 3000,
            image: '/uploads/22222222-2222-4222-8222-222222222222.webp',
            stockQuantity: 0,
            isAvailable: true,
            category: 'accessories'
        }
    ]);
    const pool = fakePool();
    const query = pool.query.bind(pool);
    pool.query = async (sql, values) => {
        if (sql.includes("FROM shops WHERE slug = $1 AND status = 'active'")) {
            const shops = {
                'shop-one': { id: '00000000-0000-4000-8000-000000000011', slug: 'shop-one', name: 'Shop One' },
                'shop-two': { id: '00000000-0000-4000-8000-000000000022', slug: 'shop-two', name: 'Shop Two' }
            };
            return { rows: shops[values[0]] ? [shops[values[0]]] : [] };
        }
        return query(sql, values);
    };
    const app = createApp({ pool, config: { ...config, siteUrl: 'https://shopademia.example' } });

    const one = await request(app)
        .get('/api/v1/public/shops/shop-one/products')
        .set('Origin', 'https://external-store.example')
        .expect(200);
    assert.equal(one.headers['access-control-allow-origin'], '*');
    assert.equal(one.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.match(one.headers['cache-control'], /public, max-age=30/);
    assert.equal(one.body.shop.name, 'Shop One');
    assert.deepEqual(one.body.data.map(({ id }) => id), ['shop-one-product']);
    assert.equal(one.body.data[0].image, 'https://shopademia.example/uploads/11111111-1111-4111-8111-111111111111.webp');
    assert.equal(one.body.data[0].isAvailableForPurchase, true);
    assert.equal(Object.hasOwn(one.body.data[0], 'shopId'), false);
    assert.deepEqual(one.body.pagination, { total: 1, limit: 50, offset: 0, hasMore: false });

    const two = await request(app).get('/api/v1/public/shops/shop-two/products?limit=1&category=accessories').expect(200);
    assert.deepEqual(two.body.data.map(({ id }) => id), ['shop-two-product']);
    assert.equal(two.body.data[0].isAvailableForPurchase, false);
    assert.equal(two.body.pagination.total, 1);

    await request(app).get('/api/v1/public/shops/shop-one/products?limit=101').expect(400);
    await request(app).get('/api/v1/public/shops/shop-one/products?category=unknown').expect(400);
    await request(app).get('/api/v1/public/shops/unknown/products').expect(404);
    await request(app).get('/api/v1/public/shops/suspended-shop/products').expect(404);
});

test('persists a correctly priced order and returns the same order for a retry', async () => {
    const app = createApp({ pool: fakePool(), config });
    const first = await request(app).post('/api/v1/orders').send(payload).expect(201);
    const retry = await request(app).post('/api/v1/orders').send(payload).expect(200);
    assert.equal(first.body.data.orderNumber, retry.body.data.orderNumber);
    assert.equal(first.body.data.subtotal, 9990);
    assert.equal(first.body.data.advanceAmount, 100);
});

test('customers can look up an order with the checkout phone and receive only customer-safe details', async () => {
    const app = createApp({ pool: fakePool(), config });
    const created = await request(app).post('/api/v1/orders').send(payload).expect(201);
    const response = await request(app).post('/api/v1/customer/order-lookup')
        .send({ orderNumber: created.body.data.orderNumber.toLowerCase(), phone: '+880 1712-345678' })
        .expect(200);

    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body.data.orderNumber, created.body.data.orderNumber);
    assert.equal(response.body.data.status, 'new');
    assert.equal(response.body.data.advancePaymentStatus, 'pending');
    assert.deepEqual(Object.keys(response.body.data).sort(), [
        'advanceAmount', 'advancePaymentStatus', 'createdAt', 'due', 'items', 'orderNumber', 'status', 'subtotal'
    ]);
    assert.deepEqual(response.body.data.items, [
        { name: 'Wireless Earbuds Pro', quantity: 1, lineTotal: 9990 }
    ]);
    assert.equal(JSON.stringify(response.body).includes(payload.customer.address), false);
    assert.equal(JSON.stringify(response.body).includes(payload.payment.bkashNumber), false);
});

test('order lookup does not reveal whether an order exists when the phone does not match', async () => {
    const app = createApp({ pool: fakePool(), config });
    const created = await request(app).post('/api/v1/orders').send(payload).expect(201);
    const response = await request(app).post('/api/v1/customer/order-lookup')
        .send({ orderNumber: created.body.data.orderNumber, phone: '01912345678' })
        .expect(404);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, {
        error: 'We could not find an order matching those details. Check them and try again.'
    });
});

test('order lookup validates inputs and applies a strict rate limit', async () => {
    const validationApp = createApp({ pool: fakePool(), config });
    await request(validationApp).post('/api/v1/customer/order-lookup')
        .send({ orderNumber: 'not-an-order', phone: '01712345678' })
        .expect(400);
    const malformed = await request(validationApp).post('/api/v1/customer/order-lookup')
        .set('Content-Type', 'application/json')
        .send('{"orderNumber":')
        .expect(400);
    assert.equal(malformed.headers['cache-control'], 'no-store');

    const rateLimitApp = createApp({ pool: fakePool(), config });
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(rateLimitApp).post('/api/v1/customer/order-lookup')
            .send({ orderNumber: 'SH-ABC123-1A2B', phone: '01712345678' })
            .expect(404);
    }
    const limited = await request(rateLimitApp).post('/api/v1/customer/order-lookup')
        .send({ orderNumber: 'SH-ABC123-1A2B', phone: '01712345678' })
        .expect(429);
    assert.equal(limited.headers['cache-control'], 'no-store');
});

test('admin product management supports authenticated create, update, replacement, and removal', async (t) => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), 'shopademia-product-test-'));
    t.after(async () => {
        setManagedProducts([]);
        await rm(uploadDirectory, { recursive: true, force: true });
    });
    const app = createApp({ pool: fakePool(), config: { ...config, uploadsDir: uploadDirectory } });
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');

    await request(app).post('/api/v1/admin/products')
        .field('name', 'Admin Product')
        .attach('image', image, { filename: 'product.png', contentType: 'image/png' })
        .expect(401);

    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;
    const created = await request(app).post('/api/v1/admin/products')
        .set('Authorization', authorization)
        .field('name', 'Admin Product')
        .field('description', 'Added from the admin catalog.')
        .field('price', '1250')
        .field('oldPrice', '1500')
        .field('stockQuantity', '5')
        .field('isAvailable', 'true')
        .field('category', 'gadgets')
        .attach('image', image, { filename: 'product.png', contentType: 'image/png' })
        .expect(201);

    const product = created.body.data;
    assert.equal(product.name, 'Admin Product');
    assert.equal(product.price, 1250);
    assert.equal(product.oldPrice, 1500);
    assert.equal(product.stockQuantity, 5);
    assert.equal(product.isAvailable, true);
    assert.match(product.image, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.equal(findProduct(product.id).price, 1250);
    assert.ok((await readFile(join(uploadDirectory, product.image.split('/').at(-1)))).equals(image));

    const storefront = await request(app).get('/api/v1/products').expect(200);
    assert.ok(storefront.body.data.some(({ id }) => id === product.id));
    const checkout = await request(app).post('/api/v1/orders').send({
        ...payload,
        items: [{ productId: product.id, quantity: 2 }],
        eventId: 'admin-product-event-1'
    }).expect(201);
    assert.equal(checkout.body.data.subtotal, 2500);
    assert.equal(findProduct(product.id).stockQuantity, 3);

    const listed = await request(app).get('/api/v1/admin/products')
        .set('Authorization', authorization)
        .expect(200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].id, product.id);

    const storedImage = await request(app).get(product.image).expect(200);
    assert.equal(storedImage.headers['content-type'], 'image/png');
    assert.match(storedImage.headers['cache-control'], /immutable/);
    assert.equal(storedImage.headers['x-content-type-options'], 'nosniff');

    await request(app).put(`/api/v1/admin/products/${product.id}`)
        .field('name', 'Updated Admin Product')
        .field('description', 'Updated product details.')
        .field('price', '1350')
        .field('oldPrice', '1600')
        .field('stockQuantity', '3')
        .field('isAvailable', 'true')
        .field('category', 'accessories')
        .expect(401);

    const updated = await request(app).put(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', authorization)
        .field('name', 'Updated Admin Product')
        .field('description', 'Updated product details.')
        .field('price', '1350')
        .field('oldPrice', '1600')
        .field('stockQuantity', '3')
        .field('isAvailable', 'true')
        .field('category', 'accessories')
        .expect(200);
    assert.equal(updated.body.data.name, 'Updated Admin Product');
    assert.equal(updated.body.data.price, 1350);
    assert.equal(updated.body.data.image, product.image);
    assert.equal(findProduct(product.id).price, 1350);

    await request(app).put(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', authorization)
        .field('name', 'Updated Admin Product')
        .field('description', 'Updated product details.')
        .field('price', '1350')
        .field('oldPrice', '1350')
        .field('stockQuantity', '3')
        .field('isAvailable', 'true')
        .field('category', 'accessories')
        .expect(400);
    assert.equal(findProduct(product.id).price, 1350);
    assert.ok((await readFile(join(uploadDirectory, product.image.split('/').at(-1)))).equals(image));

    const replacement = await request(app).put(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', authorization)
        .field('name', 'Updated Admin Product')
        .field('description', 'Updated product details.')
        .field('price', '1350')
        .field('oldPrice', '1600')
        .field('stockQuantity', '3')
        .field('isAvailable', 'true')
        .field('category', 'accessories')
        .attach('image', image, { filename: 'replacement.png', contentType: 'image/png' })
        .expect(200);
    assert.notEqual(replacement.body.data.image, product.image);
    await assert.rejects(readFile(join(uploadDirectory, product.image.split('/').at(-1))), { code: 'ENOENT' });
    await request(app).get(product.image).expect(404);
    await request(app).get(replacement.body.data.image).expect(200);

    const inventoryOrder = {
        ...payload,
        items: [{ productId: product.id, quantity: 3 }],
        eventId: 'admin-product-inventory-event'
    };
    await request(app).post('/api/v1/orders').send(inventoryOrder).expect(201);
    assert.equal(findProduct(product.id).stockQuantity, 0);
    await request(app).post('/api/v1/orders').send(inventoryOrder).expect(200);
    assert.equal(findProduct(product.id).stockQuantity, 0);
    await request(app).post('/api/v1/orders').send({
        ...inventoryOrder,
        eventId: 'admin-product-insufficient-stock-event',
        items: [{ productId: product.id, quantity: 1 }]
    }).expect(409);
    assert.equal(findProduct(product.id).stockQuantity, 0);

    await request(app).patch('/api/v1/admin/orders/2/status')
        .set('Authorization', authorization)
        .send({ status: 'cancelled' })
        .expect(200);
    assert.equal(findProduct(product.id).stockQuantity, 3);
    await request(app).patch('/api/v1/admin/orders/2/status')
        .set('Authorization', authorization)
        .send({ status: 'cancelled' })
        .expect(200);
    assert.equal(findProduct(product.id).stockQuantity, 3);
    await request(app).put(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', authorization)
        .field('name', 'Updated Admin Product')
        .field('description', 'Updated product details.')
        .field('price', '1350')
        .field('stockQuantity', '0')
        .field('isAvailable', 'true')
        .field('category', 'accessories')
        .expect(200);
    await request(app).patch('/api/v1/admin/orders/2/status')
        .set('Authorization', authorization)
        .send({ status: 'new' })
        .expect(409);
    assert.equal(findProduct(product.id).stockQuantity, 0);
    const unchangedOrder = await request(app).get('/api/v1/admin/orders')
        .set('Authorization', authorization)
        .expect(200);
    assert.equal(unchangedOrder.body.data.find(({ id }) => id === '2').status, 'cancelled');
    await request(app).patch('/api/v1/admin/orders/2/status')
        .set('Authorization', authorization)
        .send({ status: 'cancelled' })
        .expect(200);
    assert.equal(findProduct(product.id).stockQuantity, 0);

    await request(app).delete(`/api/v1/admin/products/${product.id}`).expect(401);
    await request(app).delete(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', authorization)
        .expect(200, { data: { id: product.id } });
    assert.equal(findProduct(product.id), undefined);
    await assert.rejects(readFile(join(uploadDirectory, replacement.body.data.image.split('/').at(-1))), { code: 'ENOENT' });
    await request(app).get('/api/v1/products').expect(200).expect(({ body }) => {
        assert.ok(!body.data.some(({ id }) => id === product.id));
    });
    await request(app).post('/api/v1/orders').send({
        ...payload,
        items: [{ productId: product.id, quantity: 1 }],
        eventId: 'admin-product-event-after-delete'
    }).expect(400);
    await request(app).delete('/api/v1/admin/products/not-a-product')
        .set('Authorization', authorization)
        .expect(404, { error: 'Product not found.' });
});

test('admin rejects unsupported and spoofed product image uploads without publishing them', async (t) => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), 'shopademia-product-reject-'));
    t.after(async () => {
        setManagedProducts([]);
        await rm(uploadDirectory, { recursive: true, force: true });
    });
    const app = createApp({ pool: fakePool(), config: { ...config, uploadsDir: uploadDirectory } });
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;
    const productFields = (testRequest) => testRequest
        .set('Authorization', authorization)
        .field('name', 'Invalid Image')
        .field('price', '100')
        .field('stockQuantity', '1')
        .field('isAvailable', 'true')
        .field('category', 'more');

    await request(app).get('/api/v1/admin/products').expect(401);
    await productFields(request(app).post('/api/v1/admin/products'))
        .attach('image', Buffer.from('<svg></svg>'), { filename: 'product.svg', contentType: 'image/svg+xml' })
        .expect(400, { error: 'Upload a JPEG, PNG, or WebP product image.' });

    await productFields(request(app).post('/api/v1/admin/products'))
        .attach('image', Buffer.from('<not an image>'), { filename: 'product.png', contentType: 'image/png' })
        .expect(400, { error: 'The uploaded file does not match its JPEG, PNG, or WebP image type.' });

    await productFields(request(app).post('/api/v1/admin/products'))
        .field('oldPrice', '100')
        .attach('image', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64'), {
            filename: 'product.png',
            contentType: 'image/png'
        })
        .expect(400, { error: 'The previous price must be a whole BDT amount greater than the current price.' });

    await request(app).get('/api/v1/admin/products')
        .set('Authorization', authorization)
        .expect(200, { data: [] });
    assert.deepEqual(await readdir(uploadDirectory), []);
});

test('rejects malformed shop IDs before the admin auth query runs', async () => {
    const app = createApp({ pool: fakePool(), config });
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    await request(app).get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${login.body.token}`)
        .set('x-shop-id', 'not-a-shop-id')
        .expect(400, { error: 'The selected shop ID is invalid.' });
});

test('admin branding uploads save the image and record the shop activity', async (t) => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), 'shopademia-branding-test-'));
    t.after(async () => {
        await rm(uploadDirectory, { recursive: true, force: true });
    });
    const shopId = '00000000-0000-4000-8000-000000000001';
    const shop = { heroImage: null };
    const activityEntries = [];
    const pool = fakePool();
    pool.addPlatformAdmin({
        id: '00000000-0000-4000-8000-000000000101',
        email: config.adminEmail,
        passwordHash: initialAdminPasswordHash,
        sessionVersion: 1
    });
    const query = pool.query.bind(pool);
    pool.query = async (sql, values = []) => {
        if (sql.includes('SELECT hero_image AS "previousImage" FROM shops')) {
            return values[0] === shopId ? { rows: [{ previousImage: shop.heroImage }] } : { rows: [] };
        }
        if (sql.includes('UPDATE shops SET hero_image = $1, updated_at = NOW()')) {
            if (values[1] !== shopId) return { rows: [] };
            shop.heroImage = values[0];
            return { rows: [{ id: shopId }] };
        }
        if (sql.includes('INSERT INTO shop_activity_logs')
            && sql.includes("VALUES ($1, $2, $3, 'shop', $4, $5::jsonb)")) {
            activityEntries.push(values);
            return { rows: [] };
        }
        return query(sql, values);
    };
    const app = createApp({ pool, config: { ...config, uploadsDir: uploadDirectory } });
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);

    const uploaded = await request(app).post('/api/v1/admin/shop/branding')
        .set('Authorization', `Bearer ${login.body.token}`)
        .set('x-shop-id', shopId)
        .field('kind', 'hero')
        .attach('image', image, { filename: 'hero.png', contentType: 'image/png' });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));

    assert.equal(shop.heroImage, uploaded.body.data.image);
    assert.ok((await readFile(join(uploadDirectory, uploaded.body.data.image.split('/').at(-1)))).equals(image));
    assert.equal(activityEntries.length, 1);
    assert.equal(activityEntries[0][0], shopId);
    assert.equal(activityEntries[0][2], 'shop.hero_image_updated');
    assert.equal(activityEntries[0][3], shopId);
    assert.equal(typeof activityEntries[0][3], 'string');
});

test('platform admins can create, edit, reorder, and remove up to five hero slides', async (t) => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), 'shopademia-hero-slides-test-'));
    t.after(async () => {
        await rm(uploadDirectory, { recursive: true, force: true });
    });
    const shopId = '00000000-0000-4000-8000-000000000001';
    const slides = [];
    let nextId = 1;
    const pool = fakePool();
    pool.addPlatformAdmin({
        id: '00000000-0000-4000-8000-000000000101',
        email: config.adminEmail,
        passwordHash: initialAdminPasswordHash,
        sessionVersion: 1
    });
    const query = pool.query.bind(pool);
    pool.query = async (sql, values = []) => {
        if (sql.includes('SELECT COUNT(*)::int AS count FROM shop_hero_slides')) {
            return { rows: [{ count: slides.length }] };
        }
        if (sql.includes('FROM shops WHERE slug = $1')) {
            return { rows: values[0] === 'demo-shop'
                ? [{ shopId, slug: 'demo-shop', name: 'Demo Shop', heroImage: null, bannerImage: null, advanceCharge: '100' }]
                : [] };
        }
        if (sql.includes('FROM shop_hero_slides WHERE shop_id = $1 ORDER BY position')) {
            return { rows: slides.filter((slide) => slide.shopId === values[0]).sort((a, b) => a.position - b.position).map(({ shopId: _shopId, ...slide }) => ({ ...slide })) };
        }
        if (sql.includes('INSERT INTO shop_hero_slides')) {
            const [storedShopId, position, image, mobileImage, headline, bodyText, buttonText, targetUrl] = values;
            const slide = { id: String(nextId++), shopId: storedShopId, position, image, mobileImage, headline, bodyText, buttonText, targetUrl };
            slides.push(slide);
            return { rows: [{ ...slide }] };
        }
        if (sql.includes('SELECT image, mobile_image AS "mobileImage" FROM shop_hero_slides WHERE id = $1 AND shop_id = $2')) {
            const slide = slides.find((item) => item.id === String(values[0]) && item.shopId === values[1]);
            return { rows: slide ? [{ image: slide.image, mobileImage: slide.mobileImage }] : [] };
        }
        if (sql.includes('UPDATE shop_hero_slides') && sql.includes('SET image = $1, mobile_image = $2')) {
            const [image, mobileImage, headline, bodyText, buttonText, targetUrl, id, storedShopId] = values;
            const slide = slides.find((item) => item.id === String(id) && item.shopId === storedShopId);
            if (!slide) return { rows: [] };
            Object.assign(slide, { image, mobileImage, headline, bodyText, buttonText, targetUrl });
            return { rows: [{ ...slide }] };
        }
        if (sql.includes('SELECT id FROM shop_hero_slides WHERE shop_id = $1 ORDER BY position')) {
            return { rows: slides.filter((slide) => slide.shopId === values[0]).sort((a, b) => a.position - b.position).map(({ id }) => ({ id })) };
        }
        if (sql.includes('UPDATE shop_hero_slides SET position = $1')) {
            const [position, id, storedShopId] = values;
            const slide = slides.find((item) => item.id === String(id) && item.shopId === storedShopId);
            if (slide) slide.position = position;
            return { rows: slide ? [{ id }] : [] };
        }
        if (sql.includes('DELETE FROM shop_hero_slides')) {
            const slideIndex = slides.findIndex((item) => item.id === String(values[0]) && item.shopId === values[1]);
            if (slideIndex < 0) return { rows: [] };
            const [slide] = slides.splice(slideIndex, 1);
            return { rows: [{ id: slide.id, position: slide.position, image: slide.image, mobileImage: slide.mobileImage }] };
        }
        if (sql.includes('UPDATE shop_hero_slides SET position = position - 1')) {
            for (const slide of slides) {
                if (slide.shopId === values[0] && slide.position > values[1]) slide.position -= 1;
            }
            return { rows: [] };
        }
        return query(sql, values);
    };
    const app = createApp({ pool, config: { ...config, uploadsDir: uploadDirectory } });
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;
    const createSlide = (headline, includeMobile = false) => {
        const submission = request(app).post('/api/v1/admin/shop/hero-slides')
            .set('Authorization', authorization)
            .set('x-shop-id', shopId)
            .field('headline', headline)
            .field('bodyText', `${headline} supporting text`)
            .field('buttonText', 'Buy Now')
            .field('targetUrl', '/#shop')
            .attach('image', image, { filename: 'hero.png', contentType: 'image/png' });
        if (includeMobile) submission.attach('mobileImage', image, { filename: 'hero-mobile.png', contentType: 'image/png' });
        return submission;
    };

    const first = await createSlide('First promotion').expect(201);
    const second = await createSlide('Second promotion', true).expect(201);
    assert.equal(first.body.data.position, 0);
    assert.equal(second.body.data.position, 1);
    assert.match(second.body.data.mobileImage, /^\/uploads\//);
    assert.equal((await request(app).get('/api/v1/admin/shop/hero-slides')
        .set('Authorization', authorization).set('x-shop-id', shopId).expect(200)).body.data.length, 2);
    const storefrontConfig = await request(app).get('/api/v1/shops/demo-shop/config').expect(200);
    assert.equal(storefrontConfig.body.data.heroSlides.length, 2);
    assert.equal(storefrontConfig.body.data.heroSlides[0].headline, 'First promotion');
    assert.equal(storefrontConfig.body.data.heroSlides[1].mobileImage, second.body.data.mobileImage);

    const edited = await request(app).put(`/api/v1/admin/shop/hero-slides/${first.body.data.id}`)
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .field('headline', 'Updated first promotion')
        .field('bodyText', 'Updated supporting text for the first promotion.')
        .field('buttonText', 'Explore')
        .field('targetUrl', 'https://example.com/product')
        .expect(200);
    assert.equal(edited.body.data.image, first.body.data.image);
    assert.equal(edited.body.data.headline, 'Updated first promotion');

    const mobileUpdated = await request(app).put(`/api/v1/admin/shop/hero-slides/${first.body.data.id}`)
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .field('headline', 'Updated first promotion')
        .field('bodyText', 'Updated supporting text for the first promotion.')
        .field('buttonText', 'Explore')
        .field('targetUrl', 'https://example.com/product')
        .attach('mobileImage', image, { filename: 'new-mobile.png', contentType: 'image/png' })
        .expect(200);
    assert.match(mobileUpdated.body.data.mobileImage, /^\/uploads\//);
    assert.equal(mobileUpdated.body.data.image, first.body.data.image);
    assert.equal((await readdir(uploadDirectory)).length, 4);

    const mobileCleared = await request(app).put(`/api/v1/admin/shop/hero-slides/${first.body.data.id}`)
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .field('headline', 'Updated first promotion')
        .field('bodyText', 'Updated supporting text for the first promotion.')
        .field('buttonText', 'Explore')
        .field('targetUrl', 'https://example.com/product')
        .field('clearMobileImage', 'true')
        .expect(200);
    assert.equal(mobileCleared.body.data.mobileImage, null);
    assert.equal((await readdir(uploadDirectory)).length, 3);

    const invalidTarget = await request(app).put(`/api/v1/admin/shop/hero-slides/${first.body.data.id}`)
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .field('headline', 'Invalid target')
        .field('bodyText', 'This target should not be accepted.')
        .field('buttonText', 'Buy Now')
        .field('targetUrl', 'javascript:alert(1)')
        .expect(400);
    assert.equal(invalidTarget.body.error.includes('valid Buy Now URL'), true);

    const reordered = await request(app).post('/api/v1/admin/shop/hero-slides/order')
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .send({ ids: [second.body.data.id, first.body.data.id] });
    assert.equal(reordered.status, 200, JSON.stringify(reordered.body));
    assert.deepEqual(slides.map(({ id }) => slides.find((slide) => slide.id === id)).sort((a, b) => a.position - b.position).map(({ headline }) => headline), [
        'Second promotion', 'Updated first promotion'
    ]);

    const extraSlides = [];
    for (let index = 3; index <= 5; index += 1) {
        extraSlides.push(await createSlide(`Promotion ${index}`).expect(201));
    }
    await createSlide('Sixth promotion').expect(409, { error: 'A shop can have up to 5 hero slides.' });
    assert.equal(slides.length, 5);

    await request(app).delete(`/api/v1/admin/shop/hero-slides/${second.body.data.id}`)
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .expect(200);
    assert.equal(slides.length, 4);
    assert.deepEqual(slides.map(({ position }) => position).sort(), [0, 1, 2, 3]);
    assert.deepEqual((await readdir(uploadDirectory)).sort(), [
        first.body.data.image.split('/').at(-1),
        ...extraSlides.map(({ body }) => body.data.image.split('/').at(-1))
    ].sort());
});

test('legacy admin sessions can access additional shops only with membership', async () => {
    const pool = fakePool();
    const app = createApp({ pool, config });
    const shopId = '22222222-2222-4222-8222-222222222222';
    const adminUserId = '00000000-0000-4000-8000-000000000101';
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;

    await request(app).get('/api/v1/admin/products')
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .expect(401, { error: 'Your admin session expired or shop access was removed.' });

    pool.addShopMembership(shopId, adminUserId, 'owner');
    await request(app).get('/api/v1/admin/products')
        .set('Authorization', authorization)
        .set('x-shop-id', shopId)
        .expect(200, { data: [] });
});

test('rejects reuse of an idempotency key for changed order details', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    await request(app).post('/api/v1/orders')
        .send({ ...payload, customer: { ...payload.customer, address: 'Different address, Dhaka' } })
        .expect(409);
});

test('rejects malformed checkout shop IDs as client input', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders')
        .send({ ...payload, shopId: 'not-a-uuid' })
        .expect(400, { error: 'Choose a valid shop before placing the order.' });
});

test('forwards idempotency lookup failures after inventory conflicts to API error handling', async (t) => {
    const pool = fakePool();
    const productId = 'admin-00000000-0000-4000-8000-000000000002';
    setManagedProducts([{
        id: productId, name: 'Out-of-stock product', description: '', price: 100, oldPrice: null,
        category: 'more', image: '/uploads/00000000-0000-4000-8000-000000000002.png',
        stockQuantity: 0, isAvailable: true
    }]);
    t.after(() => setManagedProducts([]));
    pool.failOrderRetryLookup();
    const app = createApp({ pool, config });

    await request(app).post('/api/v1/orders')
        .send({ ...payload, items: [{ productId, quantity: 1 }] })
        .expect(500, { error: 'The request could not be completed. Please try again.' });
});

test('accepts a matching retry of a pre-hash legacy order', async () => {
    const pool = fakePool();
    const app = createApp({ pool, config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    pool.markLegacyRequestHash(payload.eventId);
    await request(app).post('/api/v1/orders').send(payload).expect(200);
});

test('requires admin authentication to read customer orders', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).get('/api/v1/admin/orders').expect(401);
    await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: 'incorrect-password' })
        .expect(401);
});

test('admin can sign in, review orders, and update order status', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    assert.ok(login.body.token);

    const orders = await request(app).get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);
    assert.equal(orders.body.total, 1);
    assert.equal(orders.body.data[0].customerName, 'Abid Hossain');

    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
        await request(app).patch('/api/v1/admin/orders/1/status')
            .set('Authorization', `Bearer ${login.body.token}`)
            .send({ status })
            .expect(200)
            .expect(({ body }) => assert.equal(body.data.status, status));
    }
    await request(app).get('/api/v1/admin/orders/1/activity')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200)
        .expect(({ body }) => {
            assert.equal(body.data[0].action, 'status_changed');
            assert.equal(body.data[0].previousValue, 'shipped');
            assert.equal(body.data[0].newValue, 'delivered');
            assert.equal(body.data[0].actorEmail, config.adminEmail);
        });
});

test('admin rejects invalid order status transitions without changing the order', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;

    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', authorization)
        .send({ status: 'shipped' })
        .expect(409, { error: 'Order status cannot change from new to shipped.' });
    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', authorization)
        .send({ status: 'cancelled' })
        .expect(200);
    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', authorization)
        .send({ status: 'delivered' })
        .expect(409, { error: 'Order status cannot change from cancelled to delivered.' });
    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', authorization)
        .send({ status: 'new' })
        .expect(200);
    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', authorization)
        .send({ status: 'processing' })
        .expect(409, { error: 'Order status cannot change from new to processing.' });

    const orders = await request(app).get('/api/v1/admin/orders')
        .set('Authorization', authorization)
        .expect(200);
    assert.equal(orders.body.data[0].status, 'new');
});

test('admin logout revokes only the current server-side session', async () => {
    const app = createApp({ pool: fakePool(), config });
    const firstLogin = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const secondLogin = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${firstLogin.body.token}`)
        .expect(200);
    await request(app).post('/api/v1/admin/logout')
        .set('Authorization', `Bearer ${firstLogin.body.token}`)
        .expect(204);
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${firstLogin.body.token}`)
        .expect(401);
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${secondLogin.body.token}`)
        .expect(200);
});

test('admin profile displays the configured account and password changes revoke active sessions', async () => {
    const pool = fakePool();
    const app = createApp({ pool, config });
    await request(app).get('/api/v1/admin/profile').expect(401);
    await request(app).patch('/api/v1/admin/profile/password')
        .send({ currentPassword: config.adminPassword, newPassword: 'replacement-password-123' })
        .expect(401);
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    const oldToken = login.body.token;

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(200, { data: {
            email: config.adminEmail,
            shopId: '00000000-0000-4000-8000-000000000001',
            role: 'owner',
            isPlatformAdmin: false
        } });
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: 'incorrect-password', newPassword: 'replacement-password-123' })
        .expect(403);
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: config.adminPassword, newPassword: 'short' })
        .expect(400);
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: config.adminPassword, newPassword: config.adminPassword })
        .expect(400);
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: config.adminPassword, newPassword: 'replacement-password-123' })
        .expect(200, { data: { email: config.adminEmail, sessionInvalidated: true } });
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);
    await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(401);

    const replacementLogin = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: 'replacement-password-123' })
        .expect(200);
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${replacementLogin.body.token}`)
        .expect(200, { data: {
            email: config.adminEmail,
            shopId: '00000000-0000-4000-8000-000000000001',
            role: 'owner',
            isPlatformAdmin: false
        } });
    pool.raceAdminPasswordChange(await hashAdminPassword('another-password-123'));
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${replacementLogin.body.token}`)
        .send({ currentPassword: 'replacement-password-123', newPassword: 'a-new-password-456' })
        .expect(409);
});

test('shop member role changes revoke the member session immediately', async () => {
    const pool = fakePool();
    const app = createApp({ pool, config });
    const shopId = '00000000-0000-4000-8000-000000000001';
    const memberId = '11111111-1111-4111-8111-111111111111';
    const memberEmail = 'member@example.com';

    pool.addAdminUser({
        id: memberId,
        email: memberEmail,
        passwordHash: await hashAdminPassword('member-strong-password-123'),
        sessionVersion: 2,
        shopId
    });
    pool.addShopMembership(shopId, memberId, 'staff');
    const memberToken = jwt.sign({
        sub: memberEmail,
        role: 'admin',
        userId: memberId,
        shopId,
        sessionVersion: 2,
        jti: 'member-session-token'
    }, config.jwtSecret, {
        algorithm: 'HS256',
        issuer: 'shopademia',
        expiresIn: '8h'
    });
    pool.addActiveSession('member-session-token', memberId);

    pool.addPlatformAdmin({
        id: '00000000-0000-4000-8000-000000000101',
        email: config.adminEmail,
        passwordHash: initialAdminPasswordHash,
        sessionVersion: 1
    });
    const platformLogin = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200, { data: { email: memberEmail, shopId, role: 'staff', isPlatformAdmin: false } });

    await request(app).patch(`/api/v1/admin/shop/members/${memberId}`)
        .set('Authorization', `Bearer ${platformLogin.body.token}`)
        .set('x-shop-id', shopId)
        .send({ role: 'admin' })
        .expect(200, { data: { id: memberId, email: memberEmail, role: 'admin' } });

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(401);
});

test('shop member removal revokes the member session immediately', async () => {
    const pool = fakePool();
    const app = createApp({ pool, config });
    const shopId = '00000000-0000-4000-8000-000000000001';
    const memberId = '22222222-2222-4222-8222-222222222222';
    const memberEmail = 'removed-member@example.com';

    pool.addAdminUser({
        id: memberId,
        email: memberEmail,
        passwordHash: await hashAdminPassword('member-strong-password-456'),
        sessionVersion: 3,
        shopId
    });
    pool.addShopMembership(shopId, memberId, 'staff');
    const memberToken = jwt.sign({
        sub: memberEmail,
        role: 'admin',
        userId: memberId,
        shopId,
        sessionVersion: 3,
        jti: 'removed-member-session-token'
    }, config.jwtSecret, {
        algorithm: 'HS256',
        issuer: 'shopademia',
        expiresIn: '8h'
    });
    pool.addActiveSession('removed-member-session-token', memberId);

    const ownerLogin = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200, { data: { email: memberEmail, shopId, role: 'staff', isPlatformAdmin: false } });

    await request(app).delete(`/api/v1/admin/shop/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerLogin.body.token}`)
        .expect(204);

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(401);
});

test('shop admins can switch only to shops where they have a membership', async () => {
    const shopIds = [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003'
    ];
    const user = {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'multi-shop-admin@example.com',
        passwordHash: await hashAdminPassword('multi-shop-password-123'),
        sessionVersion: 1
    };
    const memberships = new Map([
        [shopIds[0], 'admin'],
        [shopIds[1], 'staff']
    ]);
    const sessions = new Set();
    const pool = {
        async query(sql, values = []) {
            if (sql.includes('SELECT u.id, u.email, u.password_hash')
                && sql.includes('LEFT JOIN platform_admins')) {
                return { rows: [{
                    id: user.id,
                    email: user.email,
                    password_hash: user.passwordHash,
                    sessionVersion: user.sessionVersion,
                    isPlatformAdmin: false
                }] };
            }
            if (sql.includes('SELECT m.shop_id AS "shopId"') && sql.includes('FROM shop_memberships m')) {
                return { rows: [{ shopId: shopIds[0] }] };
            }
            if (sql.includes('INSERT INTO admin_sessions')) {
                sessions.add(values[0]);
                return { rows: [] };
            }
            if (sql.includes('SELECT u.email, u.session_version AS "sessionVersion"')) {
                const [tokenId, userId, email, selectedShopId, sessionShopId, isPlatformToken] = values;
                const role = memberships.get(selectedShopId);
                return sessions.has(tokenId) && userId === user.id && email === user.email
                    && sessionShopId === shopIds[0] && !isPlatformToken && role
                    ? { rows: [{
                        email: user.email,
                        sessionVersion: user.sessionVersion,
                        isPlatformAdmin: false,
                        shopId: selectedShopId,
                        role,
                        status: 'active'
                    }] }
                    : { rows: [] };
            }
            if (sql.includes('SELECT u.id, u.email, m.role')) return { rows: [] };
            if (sql.includes('SELECT email FROM admin_users WHERE id = $1')) {
                return { rows: [{ email: user.email }] };
            }
            if (sql.includes('INSERT INTO shop_activity_logs')) return { rows: [] };
            if (sql.includes('UPDATE admin_sessions')) return { rows: [] };
            if (sql.includes('DELETE FROM admin_sessions')) return { rows: [] };
            throw new Error(`Unexpected multi-shop authorization test query: ${sql}`);
        }
    };
    const app = createApp({ pool, config });
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: user.email, password: 'multi-shop-password-123' })
        .expect(200);
    const authorization = `Bearer ${login.body.token}`;

    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', authorization)
        .expect(200);
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', authorization)
        .set('x-shop-id', shopIds[1])
        .expect(200);
    await request(app).get('/api/v1/admin/profile')
        .set('Authorization', authorization)
        .set('x-shop-id', shopIds[2])
        .expect(401);
});

test('rejects invalid order input, status filter, and status update', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send({ ...payload, items: [] }).expect(400);
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    await request(app).get('/api/v1/admin/orders?status=invalid')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(400);
    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ status: 'not-a-status' })
        .expect(400);
    await request(app).patch('/api/v1/admin/orders/1x/status')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ status: 'shipped' })
        .expect(404);
});

test('admin can record manual advance verification without changing order fulfilment status', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);

    const verified = await request(app).patch('/api/v1/admin/orders/1/advance-payment')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ status: 'verified' })
        .expect(200);
    assert.equal(verified.body.data.advancePaymentStatus, 'verified');
    assert.equal(verified.body.data.advancePaymentCheckedBy, config.adminEmail);
    assert.ok(verified.body.data.advancePaymentCheckedAt);
    const activity = await request(app).get('/api/v1/admin/orders/1/activity')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);
    assert.equal(activity.body.data[0].action, 'advance_payment_reviewed');
    assert.equal(activity.body.data[0].previousValue, 'pending');
    assert.equal(activity.body.data[0].newValue, 'verified');

    const orders = await request(app).get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);
    assert.equal(orders.body.data[0].advancePaymentStatus, 'verified');
    assert.equal(orders.body.data[0].status, 'new');
});

test('rejects invalid manual advance verification status', async () => {
    const app = createApp({ pool: fakePool(), config });
    const login = await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: config.adminPassword })
        .expect(200);
    await request(app).patch('/api/v1/admin/orders/1/advance-payment')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ status: 'pending' })
        .expect(400);
});

test('serves the admin dashboard and same-origin catalog with a restrictive script policy', async () => {
    const app = createApp({ pool: fakePool(), config });
    const adminPage = await request(app).get('/admin').expect(200);
    assert.match(adminPage.text, /Customer orders/);
    assert.equal(adminPage.headers['x-content-type-options'], 'nosniff');
    assert.equal(adminPage.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.match(adminPage.headers['permissions-policy'], /payment=\(\)/);
    const policy = adminPage.headers['content-security-policy'];
    assert.match(policy, /script-src 'self'/);
    assert.doesNotMatch(policy, /unsafe-eval/);
    assert.doesNotMatch(policy, /fakestoreapi\.com/);
    assert.match(policy, /img-src 'self' data: blob:/);
    assert.match(policy, /connect-src 'self'.*googletagmanager/);
    const catalog = await request(app).get('/api/v1/products?featured=true').expect(200);
    assert.equal(catalog.body.data.length, 6);
    const storeConfig = await request(app).get('/api/v1/storefront-config').expect(200);
    assert.equal(storeConfig.body.delivery.advanceCharge, config.advanceCharge);
    assert.deepEqual(Object.keys(storeConfig.body), ['shop', 'delivery']);
    assert.equal(storeConfig.body.shop.shopId, '00000000-0000-4000-8000-000000000001');
    const categories = await request(app).get('/api/v1/categories').expect(200);
    assert.ok(categories.body.data.length > 0);
    await request(app).get('/css/tailwind.generated.css').expect(200);
    await request(app).get('/admin-assets/admin.js').expect(200);
});

test('static assets revalidate and missing files return 404', async () => {
    const app = createApp({ pool: fakePool(), config });
    const script = await request(app).get('/js/main.js').expect(200);
    const stylesheet = await request(app).get('/css/styles.css').expect(200);
    const adminScript = await request(app).get('/admin-assets/admin.js').expect(200);
    for (const response of [script, stylesheet, adminScript]) {
        assert.match(response.headers['cache-control'], /max-age=0/);
    }
    await request(app).get('/js/missing-file.js').expect(404, { error: 'Not found.' });
});

test('sets HSTS only when the request is secure behind the configured proxy', async () => {
    const app = createApp({ pool: fakePool(), config: { ...config, trustProxyHops: 1 } });
    const response = await request(app).get('/admin').set('X-Forwarded-Proto', 'https').expect(200);
    assert.equal(response.headers['strict-transport-security'], 'max-age=31536000');
});

test('limits repeated admin login attempts', async () => {
    const app = createApp({ pool: fakePool(), config });
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await request(app).post('/api/v1/admin/login')
            .send({ email: config.adminEmail, password: 'incorrect-password' })
            .expect(401);
    }
    await request(app).post('/api/v1/admin/login')
        .send({ email: config.adminEmail, password: 'incorrect-password' })
        .expect(429);
});

test('exposes a database-backed readiness endpoint', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).get('/healthz').expect(200, { status: 'ok' });
});
