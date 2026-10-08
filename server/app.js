import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { hashAdminPassword, verifyAdminPassword } from './adminPassword.js';
import {
    addManagedProduct,
    getCategories,
    getFeaturedProducts,
    getHeroProduct,
    getNewArrivals,
    removeManagedProduct,
    updateManagedStock,
    updateManagedProduct
} from './catalog.js';
import { fingerprintOrder, normalizePhone, ORDER_STATUSES, OrderInputError, validateAndPriceOrder } from './orders.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PRODUCT_CATEGORIES = new Set(['gadgets', 'accessories', 'clothing', 'more']);
const IMAGE_TYPES = new Map([
    ['image/jpeg', { extension: '.jpg', signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
    ['image/png', { extension: '.png', signature: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
    ['image/webp', { extension: '.webp', signature: (bytes) => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' }]
]);

class ProductInputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProductInputError';
    }
}

class ProductNotFoundError extends Error {
    constructor() {
        super('Product not found.');
        this.name = 'ProductNotFoundError';
    }
}

class InventoryUnavailableError extends Error {
    constructor() {
        super('The requested stock is no longer available. Refresh the catalog and try again.');
        this.name = 'InventoryUnavailableError';
    }
}

function productUpload(uploadDirectory) {
    return multer({
        storage: multer.diskStorage({
            destination(_req, _file, callback) {
                mkdir(uploadDirectory, { recursive: true }).then(() => callback(null, uploadDirectory), callback);
            },
            filename(_req, file, callback) {
                callback(null, `${randomUUID()}${IMAGE_TYPES.get(file.mimetype).extension}`);
            }
        }),
        limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 7, fieldSize: 4096, parts: 8 },
        fileFilter(_req, file, callback) {
            if (!IMAGE_TYPES.has(file.mimetype)) return callback(new ProductInputError('Upload a JPEG, PNG, or WebP product image.'));
            callback(null, true);
        }
    });
}

function validateManagedProduct(body, image, { requireImage = true } = {}) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const category = typeof body?.category === 'string' ? body.category : '';
    const price = typeof body?.price === 'string' && /^\d{1,15}$/.test(body.price) ? Number(body.price) : NaN;
    const stockQuantity = typeof body?.stockQuantity === 'string' && /^\d{1,15}$/.test(body.stockQuantity)
        ? Number(body.stockQuantity)
        : NaN;
    const isAvailable = body?.isAvailable === 'true' ? true : body?.isAvailable === 'false' ? false : null;
    const oldPrice = body?.oldPrice === '' || body?.oldPrice == null
        ? null
        : typeof body.oldPrice === 'string' && /^\d{1,15}$/.test(body.oldPrice) ? Number(body.oldPrice) : NaN;
    if (name.length < 2 || name.length > 120) throw new ProductInputError('Product name must be between 2 and 120 characters.');
    if (description.length > 2000) throw new ProductInputError('Product description cannot exceed 2000 characters.');
    if (!Number.isSafeInteger(price) || price < 1) throw new ProductInputError('Enter a valid product price in whole BDT.');
    if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) throw new ProductInputError('Enter a valid whole-number stock quantity.');
    if (isAvailable === null) throw new ProductInputError('Choose whether this product is available for purchase.');
    if (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice <= price)) {
        throw new ProductInputError('The previous price must be a whole BDT amount greater than the current price.');
    }
    if (!PRODUCT_CATEGORIES.has(category)) throw new ProductInputError('Choose a valid product category.');
    if (requireImage && !image) throw new ProductInputError('Choose a product image to upload.');
    return { name, description, category, price, oldPrice, stockQuantity, isAvailable };
}

function isManagedProductId(id) {
    return /^admin-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function managedImagePath(uploadsDirectory, imageUrl) {
    if (typeof imageUrl !== 'string' || !/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(imageUrl)) return null;
    return join(uploadsDirectory, imageUrl.slice('/uploads/'.length));
}

function managedStockRequests(items) {
    const quantities = new Map();
    for (const item of items) {
        const id = String(item.productId);
        if (!id.startsWith('admin-')) continue;
        quantities.set(id, (quantities.get(id) ?? 0) + item.quantity);
    }
    return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

async function changeManagedStock(client, items, reserve) {
    const requested = managedStockRequests(items);
    if (!requested.length) return { reserved: false, updates: [] };
    const { rows } = await client.query(
        `WITH requested AS (
             SELECT product_id, SUM(quantity)::BIGINT AS quantity
             FROM UNNEST($1::TEXT[], $2::BIGINT[]) AS item(product_id, quantity)
             GROUP BY product_id
         ),
         adjusted AS (
             UPDATE managed_products AS product
             SET stock_quantity = CASE WHEN $3::BOOLEAN
                 THEN product.stock_quantity - requested.quantity
                 ELSE product.stock_quantity + requested.quantity
             END
             FROM requested
             WHERE product.id = requested.product_id
               AND (NOT $3::BOOLEAN OR (product.is_available = TRUE AND product.stock_quantity >= requested.quantity))
             RETURNING product.id, product.stock_quantity
         )
         SELECT
             (SELECT COUNT(*)::INTEGER FROM requested) AS "requestedCount",
             (SELECT COUNT(*)::INTEGER FROM adjusted) AS "adjustedCount",
             COALESCE(
                 (SELECT JSONB_OBJECT_AGG(id, stock_quantity::TEXT) FROM adjusted),
                 '{}'::JSONB
             ) AS "stockUpdates"`,
        [requested.map(({ id }) => id), requested.map(({ quantity }) => quantity), reserve]
    );
    const result = rows[0];
    if (reserve && Number(result.adjustedCount) !== Number(result.requestedCount)) {
        throw new InventoryUnavailableError();
    }
    return {
        reserved: reserve && requested.length > 0,
        updates: Object.entries(result.stockUpdates ?? {}).map(([id, stockQuantity]) => ({
            id,
            stockQuantity: Number(stockQuantity)
        }))
    };
}

function respondWithExistingOrder(res, saved, requestHash) {
    if (!saved) throw new Error('Could not persist the order.');
    const savedRequestHash = saved.request_hash ?? createHash('sha256').update(fingerprintOrder({
        customerName: saved.customer_name,
        phone: saved.phone,
        address: saved.address,
        bkashNumber: saved.bkash_number,
        items: saved.items,
        advanceAmount: Number(saved.advance_amount)
    })).digest('hex');
    if (savedRequestHash !== requestHash) {
        return res.status(409).json({ error: 'This checkout request was already used for different order details. Refresh and submit again.' });
    }
    return res.status(200).json({
        data: {
            orderNumber: saved.order_number,
            subtotal: Number(saved.subtotal),
            advanceAmount: Number(saved.advanceAmount),
            due: Number(saved.due)
        }
    });
}

async function validImageSignature(file) {
    const type = IMAGE_TYPES.get(file.mimetype);
    const handle = await open(file.path, 'r');
    try {
        const bytes = Buffer.alloc(12);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        return type.signature(bytes.subarray(0, bytesRead));
    } finally {
        await handle.close();
    }
}

function removeUploadedFile(filePath) {
    return unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
    });
}

function equalSecret(received, expected) {
    const receivedBuffer = createHash('sha256').update(String(received)).digest();
    const expectedBuffer = createHash('sha256').update(String(expected)).digest();
    if (receivedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function adminAuth(pool, secret) {
    return (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const authorization = req.get('authorization') ?? '';
        const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return res.status(401).json({ error: 'Admin authentication required.' });
        try {
            req.admin = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'shopademia' });
        } catch {
            return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
        }
        if (req.admin.role !== 'admin' || typeof req.admin.jti !== 'string'
            || !Number.isSafeInteger(req.admin.sessionVersion)) {
            return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
        }
        pool.query(
            `SELECT c.email, c.session_version
             FROM admin_credentials c
             JOIN admin_sessions s ON s.token_id = $1
             WHERE c.id = TRUE AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
            [req.admin.jti]
        ).then(({ rows }) => {
            const account = rows[0];
            if (!account || req.admin.sub !== account.email || req.admin.sessionVersion !== Number(account.session_version)) {
                return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
            }
            return next();
        }).catch(next);
    };
}

export function createApp({ pool, config }) {
    const app = express();
    const authenticateAdmin = adminAuth(pool, config.jwtSecret);
    const uploadsDirectory = config.uploadsDir ?? join(root, 'uploads');
    const uploadProductImage = productUpload(uploadsDirectory);
    const loginLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 8,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many login attempts. Try again later.' }
    });
    const orderLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many order requests. Please try again later.' }
    });
    const orderLookupLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many order lookups. Please wait before trying again.' }
    });
    const productUploadLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many product uploads. Please try again later.' }
    });
    const passwordChangeLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many password changes. Try again later.' }
    });

    app.disable('x-powered-by');
    app.set('trust proxy', config.trustProxyHops ?? 0);
    app.use((req, res, next) => {
        res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
        next();
    });
    app.use(helmet({
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://www.googletagmanager.com', 'https://connect.facebook.net'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https://fakestoreapi.com', 'https://www.facebook.com'],
                connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://www.googletagmanager.com', 'https://www.facebook.com'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: false,
            preload: false
        },
        noSniff: true,
        crossOriginResourcePolicy: { policy: 'same-origin' }
    }));
    app.use('/api/v1/customer/order-lookup', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    app.use(express.json({ limit: '32kb', strict: true, type: 'application/json' }));

    app.get('/', (_req, res) => res.sendFile(join(root, 'index.html')));
    app.get('/admin', (_req, res) => res.sendFile(join(root, 'admin.html')));
    app.get('/admin/', (_req, res) => res.redirect(308, '/admin'));
    app.use('/css', express.static(join(root, 'css'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/js', express.static(join(root, 'js'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/admin-assets', express.static(join(root, 'admin-assets'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/uploads', express.static(uploadsDirectory, {
        index: false,
        fallthrough: false,
        immutable: true,
        maxAge: '1y'
    }));

    app.get('/api/v1/products', (req, res) => {
        if (req.query.featured === 'true') return res.json({ data: getFeaturedProducts() });
        if (req.query.sort === 'newest') {
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
            return res.json({ data: getNewArrivals().slice(0, limit) });
        }
        return res.json({ data: [...getFeaturedProducts(), ...getNewArrivals()] });
    });
    app.get('/api/v1/categories', (_req, res) => res.json({ data: getCategories() }));
    app.get('/api/v1/storefront-config', (_req, res) => {
        res.set('Cache-Control', 'no-store');
        return res.json({
            delivery: { advanceCharge: config.advanceCharge },
            demo: { usdToBdt: config.demoUsdToBdt ?? 120 }
        });
    });
    app.get('/api/v1/products/hero-offer', (_req, res) => res.json({ data: getHeroProduct() }));
    app.get('/api/v1/admin/products', authenticateAdmin, async (_req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, name, description, price, old_price AS "oldPrice",
                        category, image, stock_quantity AS "stockQuantity",
                        is_available AS "isAvailable", created_at AS "createdAt"
                 FROM managed_products
                 ORDER BY created_at DESC, id DESC`
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });
    app.post('/api/v1/admin/products', authenticateAdmin, productUploadLimit, uploadProductImage.single('image'), async (req, res, next) => {
        const imageFile = req.file;
        try {
            const product = validateManagedProduct(req.body, imageFile);
            if (!await validImageSignature(imageFile)) {
                throw new ProductInputError('The uploaded file does not match its JPEG, PNG, or WebP image type.');
            }
            const record = {
                id: `admin-${randomUUID()}`,
                ...product,
                image: `/uploads/${imageFile.filename}`
            };
            const { rows } = await pool.query(
                `INSERT INTO managed_products
                    (id, name, description, price, old_price, category, image, stock_quantity, is_available)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, name, description, price, old_price AS "oldPrice",
                           category, image, stock_quantity AS "stockQuantity",
                           is_available AS "isAvailable", created_at AS "createdAt"`,
                [record.id, record.name, record.description, record.price, record.oldPrice, record.category,
                    record.image, record.stockQuantity, record.isAvailable]
            );
            const saved = rows[0];
            const published = addManagedProduct(saved);
            return res.status(201).json({ data: published });
        } catch (error) {
            if (imageFile) {
                await removeUploadedFile(imageFile.path).catch((cleanupError) => {
                    console.error('Could not remove rejected product image:', cleanupError.message);
                });
            }
            return next(error);
        }
    });
    app.put('/api/v1/admin/products/:id', authenticateAdmin, productUploadLimit, uploadProductImage.single('image'), async (req, res, next) => {
        const imageFile = req.file;
        try {
            const id = req.params.id;
            if (!isManagedProductId(id)) throw new ProductNotFoundError();
            const product = validateManagedProduct(req.body, imageFile, { requireImage: false });
            if (imageFile && !await validImageSignature(imageFile)) {
                throw new ProductInputError('The uploaded file does not match its JPEG, PNG, or WebP image type.');
            }
            const imageUrl = imageFile ? `/uploads/${imageFile.filename}` : null;
            const { rows } = await pool.query(
                `WITH previous AS MATERIALIZED (
                     SELECT image FROM managed_products WHERE id = $6
                 ),
                 updated AS (
                     UPDATE managed_products
                     SET name = $1, description = $2, price = $3, old_price = $4,
                         category = $5, stock_quantity = $7, is_available = $8,
                         image = COALESCE($9, image)
                     WHERE id = $6
                     RETURNING id, name, description, price, old_price AS "oldPrice",
                               category, image, stock_quantity AS "stockQuantity",
                               is_available AS "isAvailable", created_at AS "createdAt"
                 )
                 SELECT updated.*, previous.image AS "previousImage"
                 FROM updated CROSS JOIN previous`,
                [product.name, product.description, product.price, product.oldPrice, product.category, id,
                    product.stockQuantity, product.isAvailable, imageUrl]
            );
            const saved = rows[0];
            if (!saved) throw new ProductNotFoundError();
            const published = updateManagedProduct(saved);
            const previousImagePath = imageFile && saved.previousImage !== saved.image
                ? managedImagePath(uploadsDirectory, saved.previousImage)
                : null;
            let warning;
            if (previousImagePath) {
                await removeUploadedFile(previousImagePath).catch((cleanupError) => {
                    console.error('Could not remove replaced product image:', cleanupError.message);
                    warning = 'Product details were saved, but the previous image could not be deleted. Review the server logs.';
                });
            }
            return res.json({ data: published, ...(warning ? { warning } : {}) });
        } catch (error) {
            if (imageFile) {
                await removeUploadedFile(imageFile.path).catch((cleanupError) => {
                    console.error('Could not remove rejected product image:', cleanupError.message);
                });
            }
            return next(error);
        }
    });
    app.delete('/api/v1/admin/products/:id', authenticateAdmin, productUploadLimit, async (req, res, next) => {
        try {
            const id = req.params.id;
            if (!isManagedProductId(id)) throw new ProductNotFoundError();
            const { rows } = await pool.query(
                `DELETE FROM managed_products
                 WHERE id = $1
                 RETURNING id, image`,
                [id]
            );
            const deleted = rows[0];
            if (!deleted) throw new ProductNotFoundError();
            removeManagedProduct(id);
            const imagePath = managedImagePath(uploadsDirectory, deleted.image);
            let warning;
            if (imagePath) {
                await removeUploadedFile(imagePath).catch((cleanupError) => {
                    console.error('Could not remove deleted product image:', cleanupError.message);
                    warning = 'The product was removed, but its image file could not be deleted. Review the server logs.';
                });
            }
            return res.json({ data: { id }, ...(warning ? { warning } : {}) });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/healthz', async (_req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            await pool.query('SELECT 1');
            return res.json({ status: 'ok' });
        } catch (error) {
            console.error('Readiness check failed:', error.message);
            return res.status(503).json({ status: 'unavailable' });
        }
    });

    app.post('/api/v1/orders', orderLimit, async (req, res, next) => {
        let client;
        let transactionOpen = false;
        try {
            const order = validateAndPriceOrder(req.body, config.advanceCharge, { checkInventory: false });
            const requestHash = createHash('sha256').update(fingerprintOrder(order)).digest('hex');
            client = await pool.connect();
            await client.query('BEGIN');
            transactionOpen = true;
            const existing = await client.query(
                `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                        advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                 FROM orders WHERE event_id = $1 FOR UPDATE`,
                [order.eventId]
            );
            if (existing.rows[0]) {
                await client.query('COMMIT');
                transactionOpen = false;
                return respondWithExistingOrder(res, existing.rows[0], requestHash);
            }
            const inventory = await changeManagedStock(client, order.items, true);
            const inserted = await client.query(
                `INSERT INTO orders
                    (order_number, event_id, request_hash, customer_name, phone, address, bkash_number, items,
                     subtotal, advance_amount, due_amount, inventory_reserved)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
                 ON CONFLICT (event_id) DO NOTHING
                 RETURNING order_number, request_hash, subtotal, advance_amount AS "advanceAmount", due_amount AS due`,
                [order.orderNumber, order.eventId, requestHash, order.customerName, order.phone, order.address, order.bkashNumber,
                    JSON.stringify(order.items), order.subtotal, order.advanceAmount, order.dueAmount, inventory.reserved]
            );
            if (!inserted.rows.length) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                const saved = (await pool.query(
                    `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                            advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                     FROM orders WHERE event_id = $1`,
                    [order.eventId]
                )).rows[0];
                return respondWithExistingOrder(res, saved, requestHash);
            }
            await client.query('COMMIT');
            transactionOpen = false;
            updateManagedStock(inventory.updates);
            const saved = inserted.rows[0];
            return res.status(201).json({
                data: { orderNumber: saved.order_number, subtotal: Number(saved.subtotal), advanceAmount: Number(saved.advanceAmount), due: Number(saved.due) }
            });
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Could not roll back checkout inventory reservation:', rollbackError.message);
            });
            if (error instanceof InventoryUnavailableError) {
                const saved = (await pool.query(
                    `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                            advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                     FROM orders WHERE event_id = $1`,
                    [req.body?.eventId]
                )).rows[0];
                if (saved) return respondWithExistingOrder(res, saved, createHash('sha256').update(fingerprintOrder(
                    validateAndPriceOrder(req.body, config.advanceCharge, { checkInventory: false })
                )).digest('hex'));
            }
            return next(error);
        } finally {
            client?.release();
        }
    });

    app.post('/api/v1/customer/order-lookup', orderLookupLimit, async (req, res, next) => {
        const orderNumber = typeof req.body?.orderNumber === 'string' ? req.body.orderNumber.trim().toUpperCase() : '';
        const phone = normalizePhone(req.body?.phone);
        if (!/^SH-[A-Z0-9]{1,12}-(?:[A-Z0-9]{4}|[A-F0-9]{12})$/.test(orderNumber)
            || !/^01[3-9]\d{8}$/.test(phone)) {
            return res.status(400).json({ error: 'Enter a valid order number and Bangladesh mobile number.' });
        }
        try {
            const { rows } = await pool.query(
                `SELECT order_number AS "orderNumber", status, items, subtotal,
                        advance_amount AS "advanceAmount", due_amount AS due,
                        advance_payment_status AS "advancePaymentStatus", created_at AS "createdAt"
                 FROM orders
                 WHERE order_number = $1 AND phone = $2`,
                [orderNumber, phone]
            );
            const order = rows[0];
            if (!order) {
                return res.status(404).json({ error: 'We could not find an order matching those details. Check them and try again.' });
            }
            return res.json({
                data: {
                    orderNumber: order.orderNumber,
                    status: order.status,
                    items: order.items.map((item) => ({
                        name: item.name,
                        quantity: Number(item.quantity),
                        lineTotal: Number(item.lineTotal)
                    })),
                    subtotal: Number(order.subtotal),
                    advanceAmount: Number(order.advanceAmount),
                    due: Number(order.due),
                    advancePaymentStatus: order.advancePaymentStatus,
                    createdAt: order.createdAt
                }
            });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/login', loginLimit, async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        try {
            const { rows } = await pool.query(
                'SELECT email, password_hash, session_version FROM admin_credentials WHERE id = TRUE'
            );
            const account = rows[0];
            const validEmail = equalSecret(email, account?.email ?? config.adminEmail.toLowerCase());
            const validPassword = await verifyAdminPassword(password, account?.password_hash);
            if (!account || !validEmail || !validPassword) {
                return res.status(401).json({ error: 'Email or password is incorrect.' });
            }
            await pool.query(
                `DELETE FROM admin_sessions
                 WHERE expires_at <= NOW() OR revoked_at < NOW() - INTERVAL '7 days'`
            );
            const tokenId = randomUUID();
            const token = jwt.sign({
                sub: account.email,
                role: 'admin',
                sessionVersion: Number(account.session_version)
            }, config.jwtSecret, {
                algorithm: 'HS256', expiresIn: '8h', issuer: 'shopademia', jwtid: tokenId
            });
            await pool.query(
                `INSERT INTO admin_sessions (token_id, expires_at)
                 VALUES ($1, NOW() + INTERVAL '8 hours')`,
                [tokenId]
            );
            return res.json({ token, expiresIn: 28800 });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/profile', authenticateAdmin, async (_req, res, next) => {
        try {
            const { rows } = await pool.query(
                'SELECT email FROM admin_credentials WHERE id = TRUE'
            );
            if (!rows[0]) return res.status(404).json({ error: 'Admin profile not found.' });
            return res.json({ data: { email: rows[0].email } });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/logout', authenticateAdmin, async (req, res, next) => {
        try {
            await pool.query(
                'UPDATE admin_sessions SET revoked_at = NOW() WHERE token_id = $1 AND revoked_at IS NULL',
                [req.admin.jti]
            );
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/orders/:id/activity', authenticateAdmin, async (req, res, next) => {
        const orderId = String(req.params.id);
        if (!/^\d{1,18}$/.test(orderId)) return res.status(404).json({ error: 'Order not found.' });
        try {
            const { rows } = await pool.query(
                `SELECT id, actor_email AS "actorEmail", action,
                        previous_value AS "previousValue", new_value AS "newValue",
                        created_at AS "createdAt"
                 FROM admin_order_events
                 WHERE order_id = $1
                 ORDER BY id DESC
                 LIMIT 100`,
                [orderId]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/profile/password', authenticateAdmin, passwordChangeLimit, async (req, res, next) => {
        const currentPassword = req.body?.currentPassword;
        const newPassword = req.body?.newPassword;
        if (typeof currentPassword !== 'string' || !currentPassword
            || typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 1024) {
            return res.status(400).json({ error: 'Enter your current password and a new password of at least 12 characters.' });
        }
        try {
            const { rows } = await pool.query(
                'SELECT password_hash FROM admin_credentials WHERE id = TRUE'
            );
            const account = rows[0];
            if (!account || !await verifyAdminPassword(currentPassword, account.password_hash)) {
                return res.status(403).json({ error: 'Current password is incorrect.' });
            }
            if (await verifyAdminPassword(newPassword, account.password_hash)) {
                return res.status(400).json({ error: 'Choose a new password that differs from your current password.' });
            }
            const passwordHash = await hashAdminPassword(newPassword);
            const updated = await pool.query(
                `UPDATE admin_credentials
                 SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
                 WHERE id = TRUE AND password_hash = $2
                 RETURNING email`,
                [passwordHash, account.password_hash]
            );
            if (!updated.rows[0]) {
                return res.status(409).json({ error: 'Your password changed in another session. Sign in again and retry.' });
            }
            return res.json({ data: { email: updated.rows[0].email, sessionInvalidated: true } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/orders', authenticateAdmin, async (req, res, next) => {
        try {
            const status = typeof req.query.status === 'string' ? req.query.status : '';
            if (status && !ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid order status filter.' });
            const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 100000);
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
            const offset = (page - 1) * limit;
            const where = status ? 'WHERE status = $1' : '';
            const values = status ? [status] : [];
            const [orders, counts] = await Promise.all([
                pool.query(
                    `SELECT id, order_number AS "orderNumber", customer_name AS "customerName", phone, address,
                            bkash_number AS "bkashNumber", items, subtotal, advance_amount AS "advanceAmount",
                            due_amount AS due, status, advance_payment_status AS "advancePaymentStatus",
                            advance_payment_checked_at AS "advancePaymentCheckedAt",
                            advance_payment_checked_by AS "advancePaymentCheckedBy",
                            created_at AS "createdAt", updated_at AS "updatedAt"
                     FROM orders ${where}
                     ORDER BY created_at DESC, id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
                    [...values, limit, offset]
                ),
                pool.query(`SELECT COUNT(*)::int AS total FROM orders ${where}`, values)
            ]);
            return res.json({ data: orders.rows, page, limit, total: counts.rows[0].total });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/orders/:id/advance-payment', authenticateAdmin, async (req, res, next) => {
        try {
            const { status } = req.body ?? {};
            if (!['verified', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Choose whether the advance payment was verified or rejected.' });
            }
            const orderId = String(req.params.id);
            if (!/^\d{1,18}$/.test(orderId)) return res.status(404).json({ error: 'Order not found.' });
            const result = await pool.query(
                `WITH previous AS MATERIALIZED (
                     SELECT id, advance_payment_status
                     FROM orders
                     WHERE id = $2
                     FOR UPDATE
                 ),
                 updated AS (
                     UPDATE orders o
                     SET advance_payment_status = $1,
                         advance_payment_checked_at = NOW(),
                         advance_payment_checked_by = $3,
                         updated_at = NOW()
                     FROM previous p
                     WHERE o.id = p.id
                     RETURNING o.id, o.order_number AS "orderNumber",
                               o.advance_payment_status AS "advancePaymentStatus",
                               o.advance_payment_checked_at AS "advancePaymentCheckedAt",
                               o.advance_payment_checked_by AS "advancePaymentCheckedBy",
                               p.advance_payment_status AS previous_status
                 ),
                 logged AS (
                     INSERT INTO admin_order_events
                         (order_id, actor_email, action, previous_value, new_value)
                     SELECT id, $3, 'advance_payment_reviewed', previous_status, "advancePaymentStatus"
                     FROM updated
                     WHERE previous_status <> "advancePaymentStatus"
                     RETURNING id
                 )
                 SELECT id, "orderNumber", "advancePaymentStatus",
                        "advancePaymentCheckedAt", "advancePaymentCheckedBy"
                 FROM updated`,
                [status, orderId, req.admin.sub]
            );
            if (!result.rows[0]) return res.status(404).json({ error: 'Order not found.' });
            return res.json({ data: result.rows[0] });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/orders/:id/status', authenticateAdmin, async (req, res, next) => {
        let client;
        let transactionOpen = false;
        try {
            const { status } = req.body ?? {};
            if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Choose a valid order status.' });
            const orderId = String(req.params.id);
            if (!/^\d{1,18}$/.test(orderId)) return res.status(404).json({ error: 'Order not found.' });
            client = await pool.connect();
            await client.query('BEGIN');
            transactionOpen = true;
            const previous = (await client.query(
                `SELECT id, status, items, inventory_reserved AS "inventoryReserved"
                 FROM orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            )).rows[0];
            if (!previous) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(404).json({ error: 'Order not found.' });
            }
            let inventoryReserved = previous.inventoryReserved;
            let stockUpdates = [];
            if (previous.status !== status && status === 'cancelled' && inventoryReserved) {
                const inventory = await changeManagedStock(client, previous.items, false);
                stockUpdates = inventory.updates;
                inventoryReserved = false;
            } else if (previous.status === 'cancelled' && status !== 'cancelled') {
                const inventory = await changeManagedStock(client, previous.items, true);
                stockUpdates = inventory.updates;
                inventoryReserved = inventory.reserved;
            }
            const updated = await client.query(
                `UPDATE orders
                 SET status = $1, inventory_reserved = $2, updated_at = NOW()
                 WHERE id = $3
                 RETURNING id, order_number AS "orderNumber", status, updated_at AS "updatedAt"`,
                [status, inventoryReserved, orderId]
            );
            if (previous.status !== status) {
                await client.query(
                    `INSERT INTO admin_order_events (order_id, actor_email, action, previous_value, new_value)
                     VALUES ($1, $2, 'status_changed', $3, $4)`,
                    [orderId, req.admin.sub, previous.status, status]
                );
            }
            await client.query('COMMIT');
            transactionOpen = false;
            updateManagedStock(stockUpdates);
            return res.json({ data: updated.rows[0] });
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Could not roll back order status inventory update:', rollbackError.message);
            });
            return next(error);
        } finally {
            client?.release();
        }
    });

    app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
    app.use((error, _req, res, _next) => {
        if (error instanceof OrderInputError) return res.status(400).json({ error: error.message });
        if (error instanceof ProductInputError) return res.status(400).json({ error: error.message });
        if (error instanceof ProductNotFoundError) return res.status(404).json({ error: error.message });
        if (error instanceof InventoryUnavailableError) return res.status(409).json({ error: error.message });
        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Product images must be 5 MB or smaller.'
                : 'Upload one product image and no more than seven product fields.';
            return res.status(status).json({ error: message });
        }
        if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
        if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
        if (error?.status === 404 || error?.statusCode === 404) return res.status(404).json({ error: 'Not found.' });
        console.error('Request failed:', error);
        return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
    });

    return app;
}
