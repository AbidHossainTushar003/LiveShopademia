import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from './app.js';
import { hashAdminPassword } from './adminPassword.js';
import { findProduct, setManagedProducts } from './catalog.js';

const config = {
    adminEmail: 'admin@example.com',
    adminPassword: 'test-only-strong-password',
    jwtSecret: 'test-only-secret-with-more-than-32-characters',
    advanceCharge: 100
};
const initialAdminPasswordHash = await hashAdminPassword(config.adminPassword);

function fakePool() {
    const orders = new Map();
    const orderEvents = [];
    const managedProducts = new Map();
    const admin = {
        email: config.adminEmail,
        passwordHash: initialAdminPasswordHash,
        sessionVersion: 1
    };
    const sessions = new Map();
    let passwordChangeRaceHash = null;
    let transactionSnapshot = null;
    return Object.assign({
        markLegacyRequestHash(eventId) {
            orders.get(eventId).requestHash = null;
        },
        raceAdminPasswordChange(passwordHash) {
            passwordChangeRaceHash = passwordHash;
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
                    category, image, stockQuantity: String(values[7]), isAvailable: values[8], createdAt: new Date()
                };
                managedProducts.set(id, row);
                return { rows: [row] };
            }
            if (sql.includes('SELECT c.email, c.session_version')) {
                const session = sessions.get(values[0]);
                return {
                    rows: session && !session.revoked
                        ? [{ email: admin.email, session_version: admin.sessionVersion }]
                        : []
                };
            }
            if (sql.includes('INSERT INTO admin_sessions')) {
                sessions.set(values[0], { revoked: false });
                return { rows: [] };
            }
            if (sql.includes('UPDATE admin_sessions')) {
                const session = sessions.get(values[0]);
                if (session) session.revoked = true;
                return { rows: [] };
            }
            if (sql.includes('DELETE FROM admin_sessions')) return { rows: [] };
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
                const [orderNumber, eventId, requestHash, name, phone, address, bkashNumber, items, subtotal, advanceAmount, due, inventoryReserved] = values;
                if (orders.has(eventId)) return { rows: [] };
                const row = {
                    id: String(orders.size + 1), orderNumber, eventId,
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
                return { rows: [{ total: sql.includes('WHERE status') ? all.filter((order) => order.status === values[0]).length : all.length }] };
            }
            if (sql.includes('SELECT id, order_number')) {
                let all = [...orders.values()];
                if (sql.includes('WHERE status')) all = all.filter((order) => order.status === values[0]);
                const offset = values.length === 3 ? values[2] : values[1];
                const limit = values.length === 3 ? values[1] : values[0];
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
        .send({ status: 'confirmed' })
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

test('rejects reuse of an idempotency key for changed order details', async () => {
    const app = createApp({ pool: fakePool(), config });
    await request(app).post('/api/v1/orders').send(payload).expect(201);
    await request(app).post('/api/v1/orders')
        .send({ ...payload, customer: { ...payload.customer, address: 'Different address, Dhaka' } })
        .expect(409);
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

    await request(app).patch('/api/v1/admin/orders/1/status')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ status: 'shipped' })
        .expect(200)
        .expect(({ body }) => assert.equal(body.data.status, 'shipped'));
    await request(app).get('/api/v1/admin/orders/1/activity')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200)
        .expect(({ body }) => {
            assert.equal(body.data[0].action, 'status_changed');
            assert.equal(body.data[0].previousValue, 'new');
            assert.equal(body.data[0].newValue, 'shipped');
            assert.equal(body.data[0].actorEmail, config.adminEmail);
        });
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
        .expect(200, { data: { email: config.adminEmail } });
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
        .expect(200, { data: { email: config.adminEmail } });
    pool.raceAdminPasswordChange(await hashAdminPassword('another-password-123'));
    await request(app).patch('/api/v1/admin/profile/password')
        .set('Authorization', `Bearer ${replacementLogin.body.token}`)
        .send({ currentPassword: 'replacement-password-123', newPassword: 'a-new-password-456' })
        .expect(409);
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
    assert.match(policy, /img-src 'self' data: blob:/);
    assert.match(policy, /connect-src 'self'.*googletagmanager/);
    const catalog = await request(app).get('/api/v1/products?featured=true').expect(200);
    assert.equal(catalog.body.data.length, 6);
    const storeConfig = await request(app).get('/api/v1/storefront-config').expect(200);
    assert.equal(storeConfig.body.delivery.advanceCharge, config.advanceCharge);
    assert.equal(storeConfig.body.demo.usdToBdt, 120);
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
