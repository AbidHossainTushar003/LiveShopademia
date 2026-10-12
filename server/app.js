import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { hashAdminPassword, verifyAdminPassword } from './adminPassword.js';
import {
    addManagedProduct,
    DEFAULT_SHOP_ID,
    getCategories,
    getFeaturedProducts,
    getAllProducts,
    getHeroProduct,
    getHeroProductForShop,
    getNewArrivals,
    getProductsForShop,
    getUploadedProductsForShop,
    removeManagedProduct,
    updateManagedStock,
    updateManagedProduct,
    findProductForShop
} from './catalog.js';
import {
    canTransitionOrderStatus,
    fingerprintOrder,
    normalizePhone,
    ORDER_STATUSES,
    OrderInputError,
    validateAndPriceOrder
} from './orders.js';
import { registerPlatformRoutes } from './platform.js';
import {
    decryptTotpSecret,
    encryptTotpSecret,
    generateTotpSecret,
    totpProvisioningUri,
    verifyTotpCode
} from './adminTotp.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PRODUCT_CATEGORY_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/;
const IMAGE_TYPES = new Map([
    ['image/jpeg', { extension: '.jpg', format: 'jpeg' }],
    ['image/png', { extension: '.png', format: 'png' }],
    ['image/webp', { extension: '.webp', format: 'webp' }]
]);

function escapeXml(value) {
    return String(value).replace(/[<>&'"]/g, (character) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    })[character]);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function normalizeMetaDescription(value, fallback) {
    const normalized = String(value || fallback).trim().replace(/\s+/g, ' ');
    return normalized.length > 160 ? `${normalized.slice(0, 157).trimEnd()}…` : normalized;
}

function serializeJsonLd(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

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
        limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 10, fieldSize: 4096, parts: 21 },
        fileFilter(_req, file, callback) {
            if (!IMAGE_TYPES.has(file.mimetype)) return callback(new ProductInputError('Upload a JPEG, PNG, or WebP product image.'));
            callback(null, true);
        }
    });
}

function validateManagedProduct(body, images, { requireImage = true } = {}) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const imageAlt = typeof body?.imageAlt === 'string' ? body.imageAlt.trim() : '';
    const seoTitle = typeof body?.seoTitle === 'string' ? body.seoTitle.trim() : '';
    const metaDescription = typeof body?.metaDescription === 'string' ? body.metaDescription.trim() : '';
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
    if (imageAlt.length > 250) throw new ProductInputError('Image alt text cannot exceed 250 characters.');
    if (seoTitle.length > 70) throw new ProductInputError('SEO title cannot exceed 70 characters.');
    if (metaDescription.length > 160) throw new ProductInputError('Meta description cannot exceed 160 characters.');
    if (!Number.isSafeInteger(price) || price < 1) throw new ProductInputError('Enter a valid product price in whole BDT.');
    if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) throw new ProductInputError('Enter a valid whole-number stock quantity.');
    if (isAvailable === null) throw new ProductInputError('Choose whether this product is available for purchase.');
    if (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice <= price)) {
        throw new ProductInputError('The previous price must be a whole BDT amount greater than the current price.');
    }
    if (!PRODUCT_CATEGORY_PATTERN.test(category) && category !== 'uncategorized') {
        throw new ProductInputError('Choose a valid product category.');
    }
    if (requireImage && !images?.length) throw new ProductInputError('Choose at least one product image to upload.');
    if (images?.length > 10) throw new ProductInputError('A product can have up to 10 images.');
    return {
        name,
        description,
        imageAlt: imageAlt || name,
        seoTitle: seoTitle || name,
        metaDescription: metaDescription || (description.length > 160
            ? `${description.slice(0, 157).trimEnd()}…`
            : description),
        category,
        price,
        oldPrice,
        stockQuantity,
        isAvailable
    };
}

function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function revokeAdminSessions(pool, userId, shopId = null) {
    if (typeof userId === 'string') {
        if (shopId) {
            await pool.query(
                'UPDATE admin_sessions SET revoked_at = NOW() WHERE user_id = $1 AND shop_id = $2 AND revoked_at IS NULL',
                [userId, shopId]
            );
            return;
        }
        await pool.query(
            'UPDATE admin_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
            [userId]
        );
        return;
    }
}

function isManagedProductId(id) {
    return /^admin-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function managedImagePath(uploadsDirectory, imageUrl) {
    if (typeof imageUrl !== 'string' || !/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(imageUrl)) return null;
    return join(uploadsDirectory, imageUrl.slice('/uploads/'.length));
}

function imagePathsForProduct(uploadsDirectory, product) {
    return [...new Set([product.image, ...(Array.isArray(product.images) ? product.images : [])])]
        .map((image) => managedImagePath(uploadsDirectory, image))
        .filter(Boolean);
}

async function categoriesForShop(pool, shopId) {
    const { rows } = await pool.query(
        `SELECT id, name, icon, is_active AS active
         FROM shop_product_categories WHERE shop_id = $1`,
        [shopId]
    );
    const saved = new Map(rows.map((category) => [category.id, category]));
    const categories = new Map(getCategories(shopId).map((category) => [category.id, category]));
    for (const [id, category] of saved) {
        if (!category.active) {
            categories.delete(id);
            continue;
        }
        const previous = categories.get(id);
        categories.set(id, {
            ...previous,
            ...category,
            gradient: previous?.gradient || 'from-slate-100 to-blue-50',
            color: previous?.color || 'text-slate-700'
        });
    }
    return [...categories.values()];
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
    if (!type) return false;
    let sanitized;
    try {
        const image = sharp(await readFile(file.path), { failOn: 'error', limitInputPixels: 25_000_000 });
        const metadata = await image.metadata();
        if (metadata.format !== type.format || !metadata.width || !metadata.height
            || metadata.width > 10000 || metadata.height > 10000) return false;
        sanitized = await image.rotate().resize({
            width: 1600,
            height: 1600,
            fit: 'inside',
            withoutEnlargement: true
        }).toFormat(type.format, {
            ...(type.format === 'jpeg' || type.format === 'webp' ? { quality: 88 } : { compressionLevel: 9 })
        }).toBuffer();
    } catch (error) {
        if (['ENOENT', 'EACCES', 'EPERM', 'EIO'].includes(error?.code)) throw error;
        return false;
    }
    if (!sanitized.length || sanitized.length > 5 * 1024 * 1024) return false;
    await writeFile(file.path, sanitized);
    return true;
}

function removeUploadedFile(filePath) {
    return unlink(filePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
    });
}

const adminCookieName = 'shopademia_admin';

function adminCookieToken(req) {
    const cookieHeader = req.get('cookie') ?? '';
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0 || part.slice(0, separator).trim() !== adminCookieName) continue;
        return part.slice(separator + 1).trim();
    }
    return '';
}

function setAdminCookie(res, token, maxAge, secure) {
    res.append('Set-Cookie', [
        `${adminCookieName}=${token}`,
        'Path=/api/v1/admin',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${maxAge}`,
        ...(secure ? ['Secure'] : [])
    ].join('; '));
}

function clearAdminCookie(res, secure) {
    setAdminCookie(res, '', 0, secure);
}

function adminAuth(pool, secret, secureCookie) {
    return (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const authorization = req.get('authorization') ?? '';
        const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
        const cookieToken = adminCookieToken(req);
        const token = bearerToken || cookieToken;
        const isCookieAuth = !bearerToken && Boolean(cookieToken);
        const expireCookie = () => {
            if (isCookieAuth) clearAdminCookie(res, secureCookie);
        };
        if (!token) return res.status(401).json({ error: 'Admin authentication required.' });
        try {
            req.admin = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'shopademia' });
        } catch {
            expireCookie();
            return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
        }
        if (req.admin.role !== 'admin' || typeof req.admin.jti !== 'string'
            || !Number.isSafeInteger(req.admin.sessionVersion)) {
            expireCookie();
            return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
        }
        const requestedShopId = req.get('x-shop-id');
        if (requestedShopId != null && !isUuid(requestedShopId)) {
            return res.status(400).json({ error: 'The selected shop ID is invalid.' });
        }
        if (typeof req.admin.userId !== 'string') {
            expireCookie();
            return res.status(401).json({ error: 'Your admin session expired. Sign in again.' });
        }
        const isPlatformToken = req.admin.isPlatformAdmin === true;
        const resolvedShopId = requestedShopId ?? req.admin.shopId ?? null;
        if (resolvedShopId !== null && !isUuid(resolvedShopId)) {
            return res.status(400).json({ error: 'The selected shop ID is invalid.' });
        }
        pool.query(
            `SELECT u.email, u.session_version AS "sessionVersion",
                    (pa.user_id IS NOT NULL) AS "isPlatformAdmin",
                    m.shop_id AS "shopId", m.role, sh.status
             FROM admin_users u
             JOIN admin_sessions s ON s.user_id = u.id
             LEFT JOIN platform_admins pa ON pa.user_id = u.id
             LEFT JOIN shop_memberships m ON m.user_id = u.id AND m.shop_id = $4
             LEFT JOIN shops sh ON sh.id = $4
             WHERE s.token_id = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
               AND u.id = $2 AND u.email = $3
               AND s.shop_id IS NOT DISTINCT FROM $5
               AND ((pa.user_id IS NOT NULL AND $6::boolean)
                    OR (pa.user_id IS NULL AND m.shop_id IS NOT NULL))`,
            [req.admin.jti, req.admin.userId, req.admin.sub, resolvedShopId, req.admin.shopId ?? null, isPlatformToken]
        ).then(({ rows }) => {
            const account = rows[0];
            if (!account || req.admin.sessionVersion !== Number(account.sessionVersion)) {
                expireCookie();
                return res.status(401).json({ error: 'Your admin session expired or shop access was removed.' });
            }
            req.isPlatformAdmin = account.isPlatformAdmin;
            if (!req.isPlatformAdmin && account.status !== 'active') {
                return res.status(403).json({ error: 'This shop is suspended or archived. Contact the platform administrator.' });
            }
            if (resolvedShopId && !account.status) {
                return res.status(404).json({ error: 'Shop not found.' });
            }
            req.shopId = account.shopId ?? (req.isPlatformAdmin ? resolvedShopId : undefined);
            req.shopRole = account.role;
            return next();
        }).catch(next);
    };
}

export function createApp({ pool, config }) {
    const app = express();
    const secureAdminCookie = config.nodeEnv === 'production';
    const platformAdminMfaRequired = config.nodeEnv === 'production' || config.adminMfaRequired !== false;
    const authenticateAdmin = adminAuth(pool, config.jwtSecret, secureAdminCookie);
    const requireShopManager = (req, res, next) => {
        if (req.isPlatformAdmin || !['owner', 'admin'].includes(req.shopRole)) {
            return res.status(403).json({ error: 'Shop owner or admin permission is required.' });
        }
        return next();
    };
    const requireShopDashboard = (req, res, next) => {
        if (req.isPlatformAdmin || !req.shopId) {
            return res.status(403).json({ error: 'The platform administrator cannot access shop products or orders.' });
        }
        return next();
    };
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
    const publicCatalogLimit = rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many catalog requests. Please try again shortly.' }
    });
    const passwordChangeLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many password changes. Try again later.' }
    });
    const canonicalHostname = config.siteUrl ? new URL(config.siteUrl).hostname.toLowerCase() : null;
    const siteOrigin = (req) => config.siteUrl || `${req.protocol}://${req.get('host')}`;
    const sendStorefrontShell = async (req, res, title, description, pageEntities = [], fallbackHtml = '') => {
        const html = await readFile(join(root, 'index.html'), 'utf8');
        const origin = siteOrigin(req);
        const url = new URL(req.originalUrl, origin);
        const includeShop = ['/','/product/','/category/','/deals','/about','/find-order'].some((path) => path === '/' ? url.pathname === '/' : url.pathname.startsWith(path));
        const requestedShop = includeShop ? url.searchParams.get('shop') : null;
        const shop = requestedShop === 'main' ? null : requestedShop;
        const canonicalUrl = `${origin}${url.pathname}${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;
        const safeTitle = escapeHtml(title);
        const safeDescription = escapeHtml(normalizeMetaDescription(description, 'Explore products and independent shops on Shopademia.'));
        const escapedUrl = escapeHtml(canonicalUrl);
        const escapedImage = escapeHtml(`${origin}/public-assets/social-preview.png`);
        const organizationId = `${origin}/#organization`;
        const structuredData = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Organization',
                    '@id': organizationId,
                    name: 'Shopademia',
                    url: `${origin}/`,
                    logo: `${origin}/public-assets/shopademia-mark.svg`
                },
                {
                    '@type': 'WebSite',
                    '@id': `${origin}/#website`,
                    name: 'Shopademia',
                    url: `${origin}/`,
                    publisher: { '@id': organizationId }
                },
                ...pageEntities
            ]
        };
        const rendered = html
            .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
            .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${safeDescription}">`)
            .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${safeTitle}">`)
            .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${safeDescription}">`)
            .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapedImage}">`)
            .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapedUrl}">`)
            .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${safeTitle}">`)
            .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${safeDescription}">`)
            .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapedImage}">`)
            .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapedUrl}">`)
            .replace('</head>', `<script type="application/ld+json">${serializeJsonLd(structuredData)}</script>\n</head>`)
            .replace('<script type="module" src="/js/main.js">', `${fallbackHtml}<script type="module" src="/js/main.js">`);
        return res.type('html').send(rendered);
    };

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
                imgSrc: ["'self'", 'data:', 'blob:', 'https://www.facebook.com'],
                connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://www.googletagmanager.com', 'https://www.facebook.com'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
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
    app.use((req, res, next) => {
        const requestHosts = [req.get('x-forwarded-host'), req.get('host')]
            .filter(Boolean)
            .map((host) => host.split(',')[0].trim().replace(/:\d+$/, '').toLowerCase());
        if (canonicalHostname && requestHosts.includes(`www.${canonicalHostname}`)) {
            return res.redirect(301, new URL(req.originalUrl, config.siteUrl).toString());
        }
        return next();
    });
    app.use('/api/v1/customer/order-lookup', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    app.use(express.json({ limit: '32kb', strict: true, type: 'application/json' }));
    app.use('/api/v1/admin', (req, res, next) => {
        if (!adminCookieToken(req) || req.get('authorization')
            || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        const origin = req.get('origin');
        const expectedOrigin = config.siteUrl || `${req.protocol}://${req.get('host')}`;
        if (origin !== expectedOrigin) {
            return res.status(403).json({ error: 'This admin request must come from the same origin.' });
        }
        return next();
    });

    app.get('/', async (req, res, next) => {
        try {
            const slug = typeof req.query.shop === 'string' ? req.query.shop : 'main';
            const { rows } = await pool.query('SELECT id, slug, name, status FROM shops WHERE slug = $1', [slug]);
            if (rows[0]?.status !== 'active') return res.status(404).sendFile(join(root, '404.html'));
            return await sendStorefrontShell(
                req,
                res,
                `Shop products and deals | ${rows[0].name} | Shopademia`,
                `Browse products and current offers from ${rows[0].name}. Send an order request to the shop on Shopademia.`
            );
        } catch (error) {
            return next(error);
        }
    });
    app.get(['/product/:id', '/category/:id', '/shops', '/shops/:slug', '/deals', '/about', '/find-order', '/privacy', '/terms'], async (req, res, next) => {
        try {
            let title = 'Explore independent shops | Shopademia';
            let description = 'Explore products, shop profiles, and current deals on Shopademia.';
            let pageEntities = [];
            let fallbackHtml = '';
            const productRoute = req.path.startsWith('/product/');
            const categoryRoute = req.path.startsWith('/category/');
            const shopProfileRoute = /^\/shops\/[^/]+$/.test(req.path);
            const selectedShopRoute = ['/deals', '/about', '/find-order'].includes(req.path);
            let selectedShop = null;
            if (productRoute || categoryRoute || shopProfileRoute || selectedShopRoute) {
                const shopSlug = shopProfileRoute
                    ? req.params.slug
                    : (typeof req.query.shop === 'string' ? req.query.shop : 'main');
                const { rows } = await pool.query(
                    'SELECT id, slug, name, status FROM shops WHERE slug = $1',
                    [shopSlug]
                );
                selectedShop = rows[0];
                if (selectedShop?.status !== 'active') return res.status(404).sendFile(join(root, '404.html'));
            }
            if (req.path.startsWith('/product/')) {
                const product = findProductForShop(req.params.id, selectedShop.id);
                if (!product) return res.status(404).sendFile(join(root, '404.html'));
                const seoTitle = product.seoTitle?.trim() || product.name;
                title = `${seoTitle} | ${selectedShop.name} | Shopademia`;
                description = product.metaDescription?.trim()
                    || product.description
                    || `${product.name} from ${selectedShop.name}. View price and availability on Shopademia.`;
                const image = typeof product.image === 'string' && /^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(product.image)
                    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || product.name)}">`
                    : '';
                const available = product.isAvailable !== false
                    && !(Number.isSafeInteger(product.stockQuantity) && product.stockQuantity <= 0);
                fallbackHtml = `<noscript><main><article><h1>${escapeHtml(product.name)}</h1>${image}<p>${escapeHtml(product.description || `Product details for ${product.name}.`)}</p><p>Sold by ${escapeHtml(selectedShop.name)}</p><p>Price: BDT ${Number(product.price).toLocaleString('en-US')}</p><p>${available ? 'Available to order' : 'Currently unavailable'}</p></article></main></noscript>\n`;
                const origin = siteOrigin(req);
                const productUrl = `${origin}${req.path}${selectedShop.slug === 'main' ? '' : `?shop=${encodeURIComponent(selectedShop.slug)}`}`;
                const productSchema = {
                    '@type': 'Product',
                    name: product.name,
                    sku: String(product.id),
                    url: productUrl,
                    ...(product.metaDescription || product.description
                        ? { description: product.metaDescription || product.description }
                        : {}),
                    ...(typeof product.image === 'string' && /^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(product.image)
                        ? { image: new URL(product.image, origin).href }
                        : {}),
                    offers: {
                        '@type': 'Offer',
                        url: productUrl,
                        priceCurrency: 'BDT',
                        price: String(product.price),
                        availability: product.isAvailable === false || (Number.isSafeInteger(product.stockQuantity) && product.stockQuantity <= 0)
                            ? 'https://schema.org/OutOfStock'
                            : 'https://schema.org/InStock'
                    }
                };
                const category = (await categoriesForShop(pool, selectedShop.id)).find(({ id }) => id === product.category);
                const categoryName = category?.name || 'Category';
                const homeUrl = `${origin}/${selectedShop.slug === 'main' ? '' : `?shop=${encodeURIComponent(selectedShop.slug)}`}`;
                const categoryUrl = `${origin}/category/${encodeURIComponent(product.category)}${selectedShop.slug === 'main' ? '' : `?shop=${encodeURIComponent(selectedShop.slug)}`}`;
                pageEntities = [
                    productSchema,
                    {
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            { '@type': 'ListItem', position: 1, name: selectedShop.name, item: homeUrl },
                            { '@type': 'ListItem', position: 2, name: categoryName, item: categoryUrl },
                            { '@type': 'ListItem', position: 3, name: product.name, item: productUrl }
                        ]
                    }
                ];
            } else if (req.path.startsWith('/category/')) {
                const category = (await categoriesForShop(pool, selectedShop.id)).find(({ id }) => id === req.params.id);
                if (!category) return res.status(404).sendFile(join(root, '404.html'));
                title = `${category.name} | ${selectedShop.name} | Shopademia`;
                description = `Browse ${category.name} products from ${selectedShop.name} on Shopademia.`;
                fallbackHtml = `<noscript><main><h1>${escapeHtml(category.name)}</h1><p>Browse ${escapeHtml(category.name.toLowerCase())} products from ${escapeHtml(selectedShop.name)} on Shopademia.</p></main></noscript>\n`;
            } else if (req.path === '/shops') {
                title = 'Explore our shops | Shopademia';
                description = 'Explore shop profiles, products, storefronts, and current deals on Shopademia.';
            } else if (shopProfileRoute) {
                title = `${selectedShop.name} | Shopademia`;
                description = `Visit ${selectedShop.name} on Shopademia to browse its shop profile, products, and current offers.`;
                pageEntities.push({
                    '@type': 'OnlineStore',
                    '@id': `${siteOrigin(req)}${req.path}#store`,
                    name: selectedShop.name,
                    url: `${siteOrigin(req)}${req.path}`,
                    parentOrganization: { '@id': `${siteOrigin(req)}/#organization` }
                });
                fallbackHtml = `<noscript><main><h1>${escapeHtml(selectedShop.name)}</h1><p>Visit ${escapeHtml(selectedShop.name)} on Shopademia to browse its products and current offers.</p></main></noscript>\n`;
            } else if (req.path === '/deals') {
                title = `Deals and offers | ${selectedShop.name} | Shopademia`;
                description = `Browse current offers and discounted products from ${selectedShop.name}.`;
            } else if (req.path === '/about') {
                title = `About ${selectedShop.name} | Shopademia`;
                description = 'Learn how Shopademia connects customers with independent shops and order requests.';
            } else if (req.path === '/find-order') {
                title = `Find your order | ${selectedShop.name} | Shopademia`;
                description = 'Look up your Shopademia order request using your order number and checkout phone number.';
            } else if (req.path === '/privacy') {
                title = 'Privacy policy | Shopademia';
                description = 'Learn what information Shopademia processes and how browser storage and optional analytics work.';
            } else if (req.path === '/terms') {
                title = 'Terms & conditions | Shopademia';
                description = 'Review the terms for browsing Shopademia and submitting order requests to independent shops.';
            }
            return await sendStorefrontShell(req, res, title, description, pageEntities, fallbackHtml);
        } catch (error) {
            return next(error);
        }
    });
    app.get('/admin', async (_req, res, next) => {
        try {
            const html = await readFile(join(root, 'admin.html'), 'utf8');
            return res.set('Cache-Control', 'no-store')
                .type('html')
                .send(html.replace('content="__PLATFORM_ADMIN_MFA_REQUIRED__"',
                    `content="${platformAdminMfaRequired}"`));
        } catch (error) {
            return next(error);
        }
    });
    app.get('/admin/platform', (_req, res) => res.sendFile(join(root, 'admin-platform.html')));
    app.get('/service-worker.js', (_req, res) => {
        res.set('Cache-Control', 'no-cache');
        return res.sendFile(join(root, 'service-worker.js'));
    });
    app.get('/robots.txt', (req, res) => {
        const origin = siteOrigin(req);
        return res.type('text/plain').send(
            `User-agent: *\nAllow: /\nAllow: /api/v1/products\nAllow: /api/v1/categories\nAllow: /api/v1/shops\nAllow: /api/v1/shops/\nDisallow: /admin\nDisallow: /api/v1/admin/\nDisallow: /api/v1/customer/\nDisallow: /api/v1/shops/*/push-subscriptions\nSitemap: ${origin}/sitemap.xml\n`
        );
    });
    app.get('/sitemap.xml', async (req, res, next) => {
        try {
            const origin = siteOrigin(req);
            const { rows } = await pool.query("SELECT id, slug FROM shops WHERE status = 'active'");
            const slugByShopId = new Map(rows.map(({ id, slug }) => [id, slug]));
            const shopSlugs = rows.map(({ slug }) => slug);
            const urls = new Set(['/', '/shops', '/deals', '/about', '/find-order', '/privacy', '/terms']);
            for (const slug of shopSlugs) {
                urls.add(`/shops/${encodeURIComponent(slug)}`);
                if (slug !== 'main') urls.add(`/?shop=${encodeURIComponent(slug)}`);
            }
            for (const product of getAllProducts()) {
                const shopSlug = slugByShopId.get(product.shopId);
                if (!shopSlug) continue;
                const shopQuery = shopSlug === 'main' ? '' : `?shop=${encodeURIComponent(shopSlug)}`;
                urls.add(`/product/${encodeURIComponent(product.id)}${shopQuery}`);
                urls.add(`/category/${encodeURIComponent(product.category)}${shopQuery}`);
            }
            const xml = [...urls].map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`).join('\n');
            return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xml}\n</urlset>\n`);
        } catch (error) {
            return next(error);
        }
    });
    app.get('/404', (_req, res) => res.status(404).sendFile(join(root, '404.html')));
    app.get('/admin/', (_req, res) => res.redirect(308, '/admin'));
    app.use('/css', express.static(join(root, 'css'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/js', express.static(join(root, 'js'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/admin-assets', express.static(join(root, 'admin-assets'), { index: false, fallthrough: false, maxAge: 0 }));
    app.use('/public-assets', express.static(join(root, 'public-assets'), { index: false, fallthrough: false, maxAge: '1d' }));
    app.use('/uploads', express.static(uploadsDirectory, {
        index: false,
        fallthrough: false,
        immutable: true,
        maxAge: '1y'
    }));

    app.get('/api/v1/products', publicCatalogLimit, async (req, res, next) => {
        try {
            const { rows } = await pool.query("SELECT id FROM shops WHERE status = 'active'");
            const activeShopIds = new Set(rows.map(({ id }) => id));
            const allProducts = [...getFeaturedProducts(), ...getNewArrivals()]
                .map((product) => ({ ...product, shopId: product.shopId ?? DEFAULT_SHOP_ID }))
                .filter((product) => activeShopIds.has(product.shopId));
            if (req.query.featured === 'true') {
                return res.json({ data: allProducts.slice(0, Math.ceil(allProducts.length / 2)) });
            }
            if (req.query.sort === 'newest') {
                const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
                return res.json({ data: allProducts.slice(-limit).reverse() });
            }
            return res.json({ data: allProducts });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops/:slug/products', publicCatalogLimit, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, slug, name FROM shops WHERE slug = $1 AND status = 'active'`,
                [req.params.slug]
            );
            const shop = rows[0];
            if (!shop) return res.status(404).json({ error: 'Shop not found.' });
            const data = getProductsForShop(shop.id);
            if (req.query.featured === 'true') {
                return res.json({ data: data.slice(0, Math.ceil(data.length / 2)), shop: { id: shop.id, slug: shop.slug, name: shop.name } });
            }
            if (req.query.sort === 'newest') {
                const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
                return res.json({ data: data.slice(-limit).reverse(), shop: { id: shop.id, slug: shop.slug, name: shop.name } });
            }
            return res.json({ data, shop: { id: shop.id, slug: shop.slug, name: shop.name } });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/public/shops/:slug/products', publicCatalogLimit, async (req, res, next) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Cache-Control', 'public, max-age=30');
        try {
            const limitValue = req.query.limit === undefined ? '50' : req.query.limit;
            const offsetValue = req.query.offset === undefined ? '0' : req.query.offset;
            if (typeof limitValue !== 'string' || !/^[1-9]\d{0,2}$/.test(limitValue) || Number(limitValue) > 100) {
                return res.status(400).json({ error: 'Limit must be a whole number from 1 to 100.' });
            }
            if (typeof offsetValue !== 'string' || !/^(0|[1-9]\d{0,7})$/.test(offsetValue)) {
                return res.status(400).json({ error: 'Offset must be a non-negative whole number.' });
            }
            const category = req.query.category;
            if (category !== undefined && (typeof category !== 'string' || !PRODUCT_CATEGORY_PATTERN.test(category))) {
                return res.status(400).json({ error: 'Choose a valid product category.' });
            }
            const { rows } = await pool.query(
                `SELECT id, slug, name FROM shops WHERE slug = $1 AND status = 'active'`,
                [req.params.slug]
            );
            const shop = rows[0];
            if (!shop) return res.status(404).json({ error: 'Shop not found.' });
            if (category !== undefined && !(await categoriesForShop(pool, shop.id)).some((item) => item.id === category)) {
                return res.status(400).json({ error: 'Choose a valid product category.' });
            }
            const offset = Number(offsetValue);
            const limit = Number(limitValue);
            const products = getUploadedProductsForShop(shop.id)
                .filter((product) => category === undefined || product.category === category);
            const data = products.slice(offset, offset + limit).map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                imageAlt: product.imageAlt || product.name,
                seoTitle: product.seoTitle || product.name,
                metaDescription: product.metaDescription || (product.description.length > 160
                    ? `${product.description.slice(0, 157).trimEnd()}…`
                    : product.description),
                price: product.price,
                oldPrice: product.oldPrice,
                image: product.image ? new URL(product.image, siteOrigin(req)).href : null,
                images: product.images.map((image) => new URL(image, siteOrigin(req)).href),
                category: product.category,
                stockQuantity: product.stockQuantity,
                isAvailable: product.isAvailable,
                isAvailableForPurchase: product.isAvailable && product.stockQuantity > 0
            }));
            return res.json({
                shop: { slug: shop.slug, name: shop.name },
                data,
                pagination: { total: products.length, limit, offset, hasMore: offset + data.length < products.length }
            });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops/:slug/categories', publicCatalogLimit, async (req, res, next) => {
        try {
            const shop = await pool.query("SELECT id FROM shops WHERE slug = $1 AND status = 'active'", [req.params.slug]);
            if (!shop.rows[0]) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: await categoriesForShop(pool, shop.rows[0].id) });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops/:slug/products/hero-offer', publicCatalogLimit, async (req, res, next) => {
        try {
            const shop = await pool.query("SELECT id FROM shops WHERE slug = $1 AND status = 'active'", [req.params.slug]);
            if (!shop.rows[0]) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: getHeroProductForShop(shop.rows[0].id) });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops/:slug', publicCatalogLimit, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, slug, name, description, location,
                        contact_email AS "contactEmail", contact_phone AS "contactPhone",
                        contact_whatsapp AS "contactWhatsApp", logo_image AS "logoImage",
                        hero_image AS "heroImage", banner_image AS "bannerImage",
                        advance_charge AS "advanceCharge",
                        COALESCE((
                            SELECT jsonb_agg(top_sellers.product)
                            FROM (
                                SELECT jsonb_build_object(
                                    'productId', item->>'productId',
                                    'name', item->>'name',
                                    'quantity', SUM((item->>'quantity')::integer)
                                ) AS product
                                FROM orders o
                                CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
                                WHERE o.shop_id = s.id AND o.status <> 'cancelled'
                                GROUP BY item->>'productId', item->>'name'
                                ORDER BY SUM((item->>'quantity')::integer) DESC
                                LIMIT 5
                            ) top_sellers
                        ), '[]'::jsonb) AS "topProducts"
                 FROM shops s WHERE slug = $1 AND status = 'active'`,
                [req.params.slug]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: rows[0] });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops', publicCatalogLimit, async (_req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT slug, name, description, location, logo_image AS "logoImage",
                        hero_image AS "heroImage", banner_image AS "bannerImage"
                 FROM shops WHERE status = 'active' ORDER BY name, slug`
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/categories', publicCatalogLimit, (_req, res) => res.json({ data: getCategories() }));
    app.get('/api/v1/admin/shop/categories', authenticateAdmin, requireShopManager, async (req, res, next) => {
        try {
            const data = await categoriesForShop(pool, req.shopId);
            const { rows } = await pool.query(
                `SELECT category AS id, COUNT(*)::int AS "productCount"
                 FROM managed_products WHERE shop_id = $1 GROUP BY category`,
                [req.shopId]
            );
            const counts = new Map(rows.map((row) => [row.id, row.productCount]));
            return res.json({ data: data.map((category) => ({ ...category, productCount: counts.get(category.id) || 0 })) });
        } catch (error) {
            return next(error);
        }
    });
    app.post('/api/v1/admin/shop/categories', authenticateAdmin, requireShopManager, async (req, res, next) => {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
        if (name.length < 2 || name.length > 60) {
            return res.status(400).json({ error: 'Category name must be between 2 and 60 characters.' });
        }
        const id = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
        if (!PRODUCT_CATEGORY_PATTERN.test(id)) {
            return res.status(400).json({ error: 'Use a category name containing at least two letters or numbers.' });
        }
        try {
            const { rows } = await pool.query(
                `WITH created AS (
                     INSERT INTO shop_product_categories (shop_id, id, name, icon)
                     VALUES ($1, $2, $3, 'fa-box')
                     ON CONFLICT (shop_id, id) DO UPDATE
                         SET name = EXCLUDED.name, is_active = TRUE
                     RETURNING id, name, icon, is_active AS active, is_default AS "isDefault"
                 ), logged AS (
                     INSERT INTO shop_activity_logs (shop_id, actor_email, action, entity_type, entity_id, details)
                     SELECT $1, $4, 'category.created', 'category', id, jsonb_build_object('name', name)
                     FROM created RETURNING id
                 )
                 SELECT created.* FROM created CROSS JOIN logged`,
                [req.shopId, id, name, req.admin.sub]
            );
            return res.status(201).json({ data: rows[0] });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with that name already exists.' });
            return next(error);
        }
    });
    app.patch('/api/v1/admin/shop/categories/:id', authenticateAdmin, requireShopManager, async (req, res, next) => {
        const id = req.params.id;
        const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
        if (!PRODUCT_CATEGORY_PATTERN.test(id) || name.length < 2 || name.length > 60) {
            return res.status(400).json({ error: 'Choose a category and enter a name between 2 and 60 characters.' });
        }
        try {
            const { rows } = await pool.query(
                `WITH updated AS (
                     UPDATE shop_product_categories SET name = $1
                     WHERE shop_id = $2 AND id = $3 AND is_active = TRUE
                     RETURNING id, name, icon, is_active AS active, is_default AS "isDefault"
                 ), logged AS (
                     INSERT INTO shop_activity_logs (shop_id, actor_email, action, entity_type, entity_id, details)
                     SELECT $2, $4, 'category.renamed', 'category', id, jsonb_build_object('name', name)
                     FROM updated RETURNING id
                 )
                 SELECT updated.* FROM updated CROSS JOIN logged`,
                [name, req.shopId, id, req.admin.sub]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Category not found.' });
            return res.json({ data: rows[0] });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with that name already exists.' });
            return next(error);
        }
    });
    app.delete('/api/v1/admin/shop/categories/:id', authenticateAdmin, requireShopManager, async (req, res, next) => {
        const id = req.params.id;
        const deleteProducts = req.body?.deleteProducts;
        if (!PRODUCT_CATEGORY_PATTERN.test(id) || typeof deleteProducts !== 'boolean') {
            return res.status(400).json({ error: 'Choose whether to keep or delete products in this category.' });
        }
        const client = await pool.connect();
        let transactionOpen = false;
        try {
            await client.query('BEGIN');
            transactionOpen = true;
            const { rows: categoryRows } = await client.query(
                `SELECT id, is_default AS "isDefault" FROM shop_product_categories
                 WHERE shop_id = $1 AND id = $2 AND is_active = TRUE FOR UPDATE`,
                [req.shopId, id]
            );
            const category = categoryRows[0];
            if (!category) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(404).json({ error: 'Category not found.' });
            }
            let removedProducts = [];
            if (deleteProducts) {
                const { rows } = await client.query(
                    `DELETE FROM managed_products WHERE shop_id = $1 AND category = $2
                     RETURNING id, image, images`,
                    [req.shopId, id]
                );
                removedProducts = rows;
            } else {
                await client.query(
                    `UPDATE managed_products SET category = 'uncategorized'
                     WHERE shop_id = $1 AND category = $2`,
                    [req.shopId, id]
                );
            }
            if (category.isDefault) {
                await client.query(
                    `UPDATE shop_product_categories SET is_active = FALSE
                     WHERE shop_id = $1 AND id = $2`,
                    [req.shopId, id]
                );
            } else {
                await client.query(
                    `DELETE FROM shop_product_categories WHERE shop_id = $1 AND id = $2`,
                    [req.shopId, id]
                );
            }
            await client.query(
                `INSERT INTO shop_activity_logs (shop_id, actor_email, action, entity_type, entity_id, details)
                 VALUES ($1, $2, 'category.deleted', 'category', $3, $4::jsonb)`,
                [req.shopId, req.admin.sub, id, JSON.stringify({ deleteProducts, productCount: removedProducts.length })]
            );
            await client.query('COMMIT');
            transactionOpen = false;
            for (const product of removedProducts) removeManagedProduct(product.id);
            if (deleteProducts) {
                const paths = removedProducts.flatMap((product) => imagePathsForProduct(uploadsDirectory, product));
                await Promise.all(paths.map((path) => removeUploadedFile(path).catch((error) => {
                    if (error.code !== 'ENOENT') console.error('Could not remove deleted category product image:', error.message);
                })));
            } else {
                for (const product of getUploadedProductsForShop(req.shopId).filter((item) => item.category === id)) {
                    updateManagedProduct({ ...product, category: 'uncategorized' });
                }
            }
            return res.json({ data: { id, deletedProducts: removedProducts.length } });
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK');
            return next(error);
        } finally {
            client.release();
        }
    });
    app.get('/api/v1/storefront-config', publicCatalogLimit, async (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        try {
            const { rows } = await pool.query(
                `SELECT id AS "shopId", advance_charge AS "advanceCharge"
                 FROM shops WHERE slug = 'main' AND status = 'active'`
            );
            if (!rows[0]) return res.status(404).json({ error: 'Shop not found or unavailable.' });
            return res.json({ shop: rows[0], delivery: { advanceCharge: Number(rows[0].advanceCharge) } });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/shops/:slug/config', publicCatalogLimit, async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        try {
            const { rows } = await pool.query(
                `SELECT id AS "shopId", slug, name, description, location,
                        contact_email AS "contactEmail", contact_phone AS "contactPhone",
                        contact_whatsapp AS "contactWhatsApp", logo_image AS "logoImage",
                        hero_image AS "heroImage",
                        banner_image AS "bannerImage", advance_charge AS "advanceCharge"
                 FROM shops WHERE slug = $1 AND status = 'active'`,
                [req.params.slug]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Shop not found.' });
            const { rows: heroSlides } = await pool.query(
                `SELECT id, position, image, mobile_image AS "mobileImage", headline, body_text AS "bodyText",
                        button_text AS "buttonText", target_url AS "targetUrl"
                 FROM shop_hero_slides WHERE shop_id = $1 ORDER BY position`,
                [rows[0].shopId]
            );
            return res.json({
                data: { ...rows[0], heroSlides },
                delivery: { advanceCharge: Number(rows[0].advanceCharge) }
            });
        } catch (error) {
            return next(error);
        }
    });
    app.get('/api/v1/products/hero-offer', publicCatalogLimit, (_req, res) => res.json({ data: getHeroProduct() }));
    app.get('/api/v1/admin/products', authenticateAdmin, requireShopDashboard, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, name, description, image_alt AS "imageAlt",
                        seo_title AS "seoTitle", meta_description AS "metaDescription",
                        price, old_price AS "oldPrice",
                        category, image, images, stock_quantity AS "stockQuantity",
                        is_available AS "isAvailable", shop_id AS "shopId",
                        created_at AS "createdAt"
                 FROM managed_products
                 WHERE shop_id = $1
                 ORDER BY created_at DESC, id DESC`
                , [req.shopId]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });
    const productImagesUpload = uploadProductImage.fields([
        { name: 'image', maxCount: 1 },
        { name: 'images', maxCount: 10 }
    ]);
    app.post('/api/v1/admin/products', authenticateAdmin, requireShopManager, productUploadLimit, productImagesUpload, async (req, res, next) => {
        const imageFiles = [...(req.files?.images ?? []), ...(req.files?.image ?? [])];
        try {
            const product = validateManagedProduct(req.body, imageFiles);
            if (product.category !== 'uncategorized') {
                const category = await pool.query(
                    'SELECT id FROM shop_product_categories WHERE shop_id = $1 AND id = $2 AND is_active = TRUE',
                    [req.shopId, product.category]
                );
                if (!category.rows[0]) throw new ProductInputError('Choose a valid product category.');
            }
            for (const imageFile of imageFiles) {
                if (!await validImageSignature(imageFile)) {
                    throw new ProductInputError('The uploaded file does not match its JPEG, PNG, or WebP image type.');
                }
            }
            const record = {
                id: `admin-${randomUUID()}`,
                shopId: req.shopId,
                ...product,
                image: `/uploads/${imageFiles[0].filename}`,
                images: imageFiles.map((file) => `/uploads/${file.filename}`)
            };
            const { rows } = await pool.query(
                `WITH saved AS (
                    INSERT INTO managed_products
                    (id, name, description, image_alt, seo_title, meta_description,
                     price, old_price, category, image, stock_quantity, is_available, shop_id, images)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING *
                 ), logged AS (
                    INSERT INTO shop_activity_logs (shop_id, actor_email, action, entity_type, entity_id, details)
                    SELECT shop_id, $15, 'product.created', 'product', id,
                           jsonb_build_object('name', name)
                    FROM saved
                    RETURNING id
                 )
                 SELECT saved.id, saved.name, saved.description,
                        saved.image_alt AS "imageAlt", saved.seo_title AS "seoTitle",
                        saved.meta_description AS "metaDescription", saved.price,
                        saved.old_price AS "oldPrice", saved.category, saved.image,
                        saved.images,
                        saved.stock_quantity AS "stockQuantity",
                        saved.is_available AS "isAvailable", saved.shop_id AS "shopId",
                        saved.created_at AS "createdAt"
                 FROM saved CROSS JOIN logged`,
                [record.id, record.name, record.description, record.imageAlt, record.seoTitle,
                    record.metaDescription, record.price, record.oldPrice, record.category,
                    record.image, record.stockQuantity, record.isAvailable, record.shopId, record.images, req.admin.sub]
            );
            const saved = rows[0];
            const published = addManagedProduct(saved);
            return res.status(201).json({ data: published });
        } catch (error) {
            for (const imageFile of imageFiles) {
                await removeUploadedFile(imageFile.path).catch((cleanupError) => {
                    console.error('Could not remove rejected product image:', cleanupError.message);
                });
            }
            return next(error);
        }
    });
    app.put('/api/v1/admin/products/:id', authenticateAdmin, requireShopManager, productUploadLimit, productImagesUpload, async (req, res, next) => {
        const imageFiles = [...(req.files?.images ?? []), ...(req.files?.image ?? [])];
        try {
            const id = req.params.id;
            if (!isManagedProductId(id)) throw new ProductNotFoundError();
            const product = validateManagedProduct(req.body, imageFiles, { requireImage: false });
            if (product.category !== 'uncategorized') {
                const category = await pool.query(
                    'SELECT id FROM shop_product_categories WHERE shop_id = $1 AND id = $2 AND is_active = TRUE',
                    [req.shopId, product.category]
                );
                if (!category.rows[0]) throw new ProductInputError('Choose a valid product category.');
            }
            for (const imageFile of imageFiles) {
                if (!await validImageSignature(imageFile)) {
                    throw new ProductInputError('The uploaded file does not match its JPEG, PNG, or WebP image type.');
                }
            }
            const imageUrls = imageFiles.length ? imageFiles.map((file) => `/uploads/${file.filename}`) : null;
            const imageUrl = imageUrls?.[0] ?? null;
            const { rows } = await pool.query(
                `WITH previous AS MATERIALIZED (
                     SELECT image, images FROM managed_products WHERE id = $6 AND shop_id = $10
                 ),
                 updated AS (
                     UPDATE managed_products
                     SET name = $1, description = $2, price = $3, old_price = $4,
                         category = $5, stock_quantity = $7, is_available = $8,
                         image = COALESCE($9, image), images = COALESCE($15, images), image_alt = $12,
                         seo_title = $13, meta_description = $14
                     WHERE id = $6 AND shop_id = $10
                     RETURNING id, name, description, image_alt AS "imageAlt",
                               seo_title AS "seoTitle", meta_description AS "metaDescription",
                               price, old_price AS "oldPrice",
                               category, image, images, stock_quantity AS "stockQuantity",
                               is_available AS "isAvailable", shop_id AS "shopId",
                               created_at AS "createdAt"
                 ),
                 logged AS (
                     INSERT INTO shop_activity_logs
                         (shop_id, actor_email, action, entity_type, entity_id, details)
                     SELECT "shopId", $11, 'product.updated', 'product', id,
                            jsonb_build_object('name', name)
                     FROM updated
                     RETURNING id
                 )
                 SELECT updated.*, previous.image AS "previousImage", previous.images AS "previousImages"
                 FROM updated CROSS JOIN previous CROSS JOIN logged`,
                [product.name, product.description, product.price, product.oldPrice, product.category, id,
                    product.stockQuantity, product.isAvailable, imageUrl, req.shopId, req.admin.sub,
                    product.imageAlt, product.seoTitle, product.metaDescription, imageUrls]
            );
            const saved = rows[0];
            if (!saved) throw new ProductNotFoundError();
            const published = updateManagedProduct(saved);
            const previousImages = [...new Set([saved.previousImage, ...(saved.previousImages ?? [])])];
            const nextImages = new Set(saved.images ?? [saved.image]);
            const previousImagePaths = imageFiles.length
                ? previousImages.filter((image) => !nextImages.has(image))
                    .map((image) => managedImagePath(uploadsDirectory, image)).filter(Boolean)
                : [];
            let warning;
            for (const previousImagePath of previousImagePaths) {
                await removeUploadedFile(previousImagePath).catch((cleanupError) => {
                    console.error('Could not remove replaced product image:', cleanupError.message);
                    warning = 'Product details were saved, but the previous image could not be deleted. Review the server logs.';
                });
            }
            return res.json({ data: published, ...(warning ? { warning } : {}) });
        } catch (error) {
            for (const imageFile of imageFiles) {
                await removeUploadedFile(imageFile.path).catch((cleanupError) => {
                    console.error('Could not remove rejected product image:', cleanupError.message);
                });
            }
            return next(error);
        }
    });
    app.delete('/api/v1/admin/products/:id', authenticateAdmin, requireShopManager, productUploadLimit, async (req, res, next) => {
        try {
            const id = req.params.id;
            if (!isManagedProductId(id)) throw new ProductNotFoundError();
            const { rows } = await pool.query(
                `WITH deleted AS (
                    DELETE FROM managed_products
                    WHERE id = $1 AND shop_id = $2
                    RETURNING id, image, images, shop_id
                 ), logged AS (
                    INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                    SELECT shop_id, $3, 'product.deleted', 'product', id, '{}'::jsonb
                    FROM deleted
                    RETURNING id
                 )
                 SELECT deleted.id, deleted.image, deleted.images FROM deleted CROSS JOIN logged`,
                [id, req.shopId, req.admin.sub]
            );
            const deleted = rows[0];
            if (!deleted) throw new ProductNotFoundError();
            removeManagedProduct(id);
            const imagePaths = imagePathsForProduct(uploadsDirectory, deleted);
            let warning;
            for (const imagePath of imagePaths) {
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
            console.error('Readiness check failed:', {
                name: error.name || 'Error',
                code: typeof error.code === 'string' ? error.code : undefined
            });
            return res.status(503).json({ status: 'unavailable' });
        }
    });

    registerPlatformRoutes(app, {
        pool,
        authenticateAdmin,
        uploadProductImage,
        validImageSignature,
        removeUploadedFile,
        uploadsDirectory,
        productUploadLimit,
        vapidPublicKey: config.vapidPublicKey,
        vapidPrivateKey: config.vapidPrivateKey,
        vapidSubject: config.vapidSubject,
        adminSettingsEncryptionKey: config.adminSettingsEncryptionKey
    });

    app.post('/api/v1/orders', orderLimit, async (req, res, next) => {
        let client;
        let transactionOpen = false;
        let requestHash;
        const shopId = req.body?.shopId ?? DEFAULT_SHOP_ID;
        try {
            if (!isUuid(shopId)) {
                return res.status(400).json({ error: 'Choose a valid shop before placing the order.' });
            }
            const shop = await pool.query(
                `SELECT advance_charge FROM shops WHERE id = $1 AND status = 'active'`,
                [shopId]
            );
            if (!shop.rows[0]) return res.status(404).json({ error: 'Shop not found or unavailable.' });
            const advanceCharge = Number(shop.rows[0].advance_charge);
            const order = validateAndPriceOrder(req.body, advanceCharge, { checkInventory: false, shopId });
            requestHash = createHash('sha256').update(fingerprintOrder(order)).digest('hex');
            client = await pool.connect();
            await client.query('BEGIN');
            transactionOpen = true;
            const existing = await client.query(
                `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                        advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                 FROM orders WHERE event_id = $1 AND shop_id = $2 FOR UPDATE`,
                [order.eventId, shopId]
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
                     subtotal, advance_amount, due_amount, inventory_reserved, shop_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
                 ON CONFLICT (shop_id, event_id) DO NOTHING
                 RETURNING order_number, request_hash, subtotal, advance_amount AS "advanceAmount", due_amount AS due`,
                [order.orderNumber, order.eventId, requestHash, order.customerName, order.phone, order.address, order.bkashNumber,
                    JSON.stringify(order.items), order.subtotal, order.advanceAmount, order.dueAmount, inventory.reserved, shopId]
            );
            if (!inserted.rows.length) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                const saved = (await pool.query(
                    `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                            advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                     FROM orders WHERE event_id = $1 AND shop_id = $2`,
                    [order.eventId, shopId]
                )).rows[0];
                return respondWithExistingOrder(res, saved, requestHash);
            }
            await client.query(
                `INSERT INTO shop_activity_logs
                    (shop_id, actor_email, action, entity_type, entity_id, details)
                 VALUES ($1, 'customer', 'order.created', 'order', $2, $3::jsonb)`,
                [shopId, inserted.rows[0].order_number, JSON.stringify({ subtotal: order.subtotal, itemCount: order.items.length })]
            );
            await client.query('COMMIT');
            transactionOpen = false;
            updateManagedStock(inventory.updates);
            const saved = inserted.rows[0];
            return res.status(201).json({
                data: { orderNumber: saved.order_number, subtotal: Number(saved.subtotal), advanceAmount: Number(saved.advanceAmount), due: Number(saved.due) }
            });
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Could not roll back checkout inventory reservation:', {
                    name: rollbackError.name || 'Error',
                    code: typeof rollbackError.code === 'string' ? rollbackError.code : undefined
                });
            });
            if (error instanceof InventoryUnavailableError) {
                let saved;
                try {
                    saved = (await pool.query(
                        `SELECT order_number, request_hash, customer_name, phone, address, bkash_number, items,
                                advance_amount, subtotal, advance_amount AS "advanceAmount", due_amount AS due
                         FROM orders WHERE event_id = $1 AND shop_id = $2`,
                        [req.body?.eventId, shopId]
                    )).rows[0];
                } catch (lookupError) {
                    return next(lookupError);
                }
                if (saved) return respondWithExistingOrder(res, saved, requestHash);
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
                `SELECT u.id, u.email, u.password_hash, u.mfa_secret AS "mfaSecret",
                        u.mfa_enabled AS "mfaEnabled", u.last_mfa_counter AS "lastMfaCounter",
                        u.session_version AS "sessionVersion",
                        (pa.user_id IS NOT NULL) AS "isPlatformAdmin"
                 FROM admin_users u
                 LEFT JOIN platform_admins pa ON pa.user_id = u.id
                 WHERE u.email = $1`,
                [email]
            );
            const account = rows[0];
            if (!account || !await verifyAdminPassword(password, account.password_hash)) {
                return res.status(401).json({ error: 'Email or password is incorrect.' });
            }
            if (platformAdminMfaRequired && account.isPlatformAdmin && !account.mfaEnabled) {
                const secret = generateTotpSecret();
                const setupToken = jwt.sign({
                    sub: account.email,
                    userId: account.id,
                    purpose: 'mfa-enrollment',
                    encryptedSecret: encryptTotpSecret(secret, config.mfaEncryptionKey)
                }, config.jwtSecret, {
                    algorithm: 'HS256',
                    expiresIn: '10m',
                    issuer: 'shopademia-mfa'
                });
                return res.json({
                    mfaSetupRequired: true,
                    setupToken,
                    totpSecret: secret,
                    provisioningUri: totpProvisioningUri(secret, account.email)
                });
            }
            if (platformAdminMfaRequired && account.isPlatformAdmin) {
                let secret;
                try {
                    secret = decryptTotpSecret(account.mfaSecret, config.mfaEncryptionKey);
                } catch (error) {
                    return next(error);
                }
                const counter = verifyTotpCode(secret, req.body?.totpCode);
                if (counter === null) {
                    return res.status(401).json({ error: 'Email, password, or authenticator code is incorrect.' });
                }
                const consumedCode = await pool.query(
                    `UPDATE admin_users SET last_mfa_counter = $1
                     WHERE id = $2 AND mfa_enabled = TRUE AND last_mfa_counter < $1
                     RETURNING id`,
                    [counter, account.id]
                );
                if (!consumedCode.rows[0]) {
                    return res.status(401).json({ error: 'Email, password, or authenticator code is incorrect.' });
                }
            }
            let shopId = null;
            if (!account.isPlatformAdmin) {
                const membership = await pool.query(
                    `SELECT m.shop_id AS "shopId"
                     FROM shop_memberships m
                     JOIN shops s ON s.id = m.shop_id
                     WHERE m.user_id = $1 AND s.status = 'active'
                     ORDER BY s.created_at, s.id LIMIT 1`,
                    [account.id]
                );
                shopId = membership.rows[0]?.shopId;
                if (!shopId) return res.status(403).json({ error: 'This account has no active shop access.' });
            }
            await pool.query(
                `DELETE FROM admin_sessions
                 WHERE expires_at <= NOW() OR revoked_at < NOW() - INTERVAL '7 days'`
            );
            const tokenId = randomUUID();
            const token = jwt.sign({
                sub: account.email,
                role: 'admin',
                userId: account.id,
                ...(shopId ? { shopId } : {}),
                isPlatformAdmin: account.isPlatformAdmin,
                sessionVersion: Number(account.sessionVersion)
            }, config.jwtSecret, {
                algorithm: 'HS256', expiresIn: '8h', issuer: 'shopademia', jwtid: tokenId
            });
            await pool.query(
                `INSERT INTO admin_sessions (token_id, expires_at, user_id, shop_id)
                 VALUES ($1, NOW() + INTERVAL '8 hours', $2, $3)`,
                [tokenId, account.id, shopId]
            );
            setAdminCookie(res, token, 8 * 60 * 60, secureAdminCookie);
            if (shopId) {
                await pool.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'auth.login', 'admin_user', $3, '{}'::jsonb)`,
                    [shopId, account.email, account.id]
                );
            }
            return res.json({
                ...(!req.get('origin') ? { token } : {}),
                expiresIn: 28800
            });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/mfa/enroll', loginLimit, async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const setupToken = typeof req.body?.setupToken === 'string' ? req.body.setupToken : '';
        const code = req.body?.totpCode;
        let challenge;
        try {
            challenge = jwt.verify(setupToken, config.jwtSecret, {
                algorithms: ['HS256'],
                issuer: 'shopademia-mfa'
            });
        } catch {
            return res.status(401).json({ error: 'The MFA setup session expired. Sign in again.' });
        }
        if (challenge.purpose !== 'mfa-enrollment'
            || typeof challenge.userId !== 'string'
            || typeof challenge.sub !== 'string'
            || typeof challenge.encryptedSecret !== 'string') {
            return res.status(401).json({ error: 'The MFA setup session is invalid. Sign in again.' });
        }
        try {
            const secret = decryptTotpSecret(challenge.encryptedSecret, config.mfaEncryptionKey);
            const counter = verifyTotpCode(secret, code);
            if (counter === null) {
                return res.status(400).json({ error: 'Enter the current six-digit code from your authenticator app.' });
            }
            const updated = await pool.query(
                `UPDATE admin_users AS u
                 SET mfa_secret = $1, mfa_enabled = TRUE, last_mfa_counter = $2, updated_at = NOW()
                 WHERE u.id = $3 AND u.email = $4 AND u.mfa_enabled = FALSE
                   AND EXISTS (SELECT 1 FROM platform_admins WHERE user_id = u.id)
                 RETURNING u.id, u.email, u.session_version AS "sessionVersion"`,
                [challenge.encryptedSecret, counter, challenge.userId, challenge.sub]
            );
            const account = updated.rows[0];
            if (!account) return res.status(409).json({ error: 'MFA is already enabled or this account is no longer a platform administrator.' });
            await revokeAdminSessions(pool, account.id);
            const tokenId = randomUUID();
            const token = jwt.sign({
                sub: account.email,
                role: 'admin',
                userId: account.id,
                isPlatformAdmin: true,
                sessionVersion: Number(account.sessionVersion)
            }, config.jwtSecret, {
                algorithm: 'HS256', expiresIn: '8h', issuer: 'shopademia', jwtid: tokenId
            });
            await pool.query(
                `INSERT INTO admin_sessions (token_id, expires_at, user_id, shop_id)
                 VALUES ($1, NOW() + INTERVAL '8 hours', $2, NULL)`,
                [tokenId, account.id]
            );
            setAdminCookie(res, token, 8 * 60 * 60, secureAdminCookie);
            return res.json({
                ...(!req.get('origin') ? { token } : {}),
                expiresIn: 28800
            });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/profile', authenticateAdmin, async (req, res, next) => {
        try {
            const { rows } = await pool.query('SELECT email FROM admin_users WHERE id = $1', [req.admin.userId]);
            if (!rows[0]) return res.status(404).json({ error: 'Admin profile not found.' });
            return res.json({
                data: {
                    email: rows[0].email,
                    shopId: req.shopId,
                    role: req.shopRole,
                    isPlatformAdmin: req.isPlatformAdmin
                }
            });
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
            clearAdminCookie(res, secureAdminCookie);
            if (req.shopId) {
                await pool.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'auth.logout', 'admin_user', $3, '{}'::jsonb)`,
                    [req.shopId, req.admin.sub, req.admin.userId]
                );
            }
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/orders/:id/activity', authenticateAdmin, requireShopDashboard, async (req, res, next) => {
        const orderId = String(req.params.id);
        if (!/^\d{1,18}$/.test(orderId)) return res.status(404).json({ error: 'Order not found.' });
        try {
            const { rows } = await pool.query(
                `SELECT id, actor_email AS "actorEmail", action,
                        previous_value AS "previousValue", new_value AS "newValue",
                        created_at AS "createdAt"
                 FROM admin_order_events
                 WHERE order_id = $1
                   AND EXISTS (SELECT 1 FROM orders WHERE id = $1 AND shop_id = $2)
                 ORDER BY id DESC
                 LIMIT 100`,
                [orderId, req.shopId]
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
                'SELECT password_hash FROM admin_users WHERE id = $1',
                [req.admin.userId]
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
                `UPDATE admin_users
                 SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
                 WHERE id = $2 AND password_hash = $3
                 RETURNING id, email`,
                [passwordHash, req.admin.userId, account.password_hash]
            );
            if (!updated.rows[0]) {
                return res.status(409).json({ error: 'Your password changed in another session. Sign in again and retry.' });
            }
            await revokeAdminSessions(pool, updated.rows[0].id, null);
            if (req.shopId) {
                await pool.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'account.password_changed', 'admin_user', $3, '{}'::jsonb)`,
                    [req.shopId, req.admin.sub, updated.rows[0].id]
                );
            }
            return res.json({ data: { email: updated.rows[0].email, sessionInvalidated: true } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/orders', authenticateAdmin, requireShopDashboard, async (req, res, next) => {
        try {
            const status = typeof req.query.status === 'string' ? req.query.status : '';
            if (status && !ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid order status filter.' });
            const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 100000);
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
            const offset = (page - 1) * limit;
            const where = status ? 'WHERE shop_id = $1 AND status = $2' : 'WHERE shop_id = $1';
            const values = status ? [req.shopId, status] : [req.shopId];
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

    app.patch('/api/v1/admin/orders/:id/advance-payment', authenticateAdmin, requireShopDashboard, async (req, res, next) => {
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
                     WHERE id = $2 AND shop_id = $4
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
                 ), shop_logged AS (
                     INSERT INTO shop_activity_logs
                         (shop_id, actor_email, action, entity_type, entity_id, details)
                     SELECT $4, $3, 'order.advance_payment_reviewed', 'order', id,
                            jsonb_build_object('from', previous_status, 'to', "advancePaymentStatus")
                     FROM updated
                     WHERE previous_status <> "advancePaymentStatus"
                     RETURNING id
                 )
                 SELECT id, "orderNumber", "advancePaymentStatus",
                        "advancePaymentCheckedAt", "advancePaymentCheckedBy"
                 FROM updated`,
                [status, orderId, req.admin.sub, req.shopId]
            );
            if (!result.rows[0]) return res.status(404).json({ error: 'Order not found.' });
            return res.json({ data: result.rows[0] });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/orders/:id/status', authenticateAdmin, requireShopDashboard, async (req, res, next) => {
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
                 FROM orders WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
                [orderId, req.shopId]
            )).rows[0];
            if (!previous) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(404).json({ error: 'Order not found.' });
            }
            if (!canTransitionOrderStatus(previous.status, status)) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(409).json({
                    error: `Order status cannot change from ${previous.status} to ${status}.`
                });
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
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'order.status_changed', 'order', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, orderId, JSON.stringify({ from: previous.status, to: status })]
                );
            }
            await client.query('COMMIT');
            transactionOpen = false;
            updateManagedStock(stockUpdates);
            return res.json({ data: updated.rows[0] });
        } catch (error) {
            if (transactionOpen) await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Could not roll back order status inventory update:', {
                    name: rollbackError.name || 'Error',
                    code: typeof rollbackError.code === 'string' ? rollbackError.code : undefined
                });
            });
            return next(error);
        } finally {
            client?.release();
        }
    });

    app.use((req, res) => {
        if (req.method === 'GET' && !req.path.startsWith('/api/') && !/\.[^/]+$/.test(req.path) && req.accepts('html')) {
            return res.status(404).sendFile(join(root, '404.html'));
        }
        return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
    });
    app.use((error, _req, res, _next) => {
        if (error instanceof OrderInputError) return res.status(400).json({ error: error.message });
        if (error instanceof ProductInputError) return res.status(400).json({ error: error.message });
        if (error instanceof ProductNotFoundError) return res.status(404).json({ error: error.message });
        if (error instanceof InventoryUnavailableError) return res.status(409).json({ error: error.message });
        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Uploaded images must be 5 MB or smaller.'
                : 'The upload exceeds the allowed file count or form limits.';
            return res.status(status).json({ error: message });
        }
        if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
        if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
        if (error?.status === 404 || error?.statusCode === 404) return res.status(404).json({ error: 'Not found.' });
        console.error('Request failed:', {
            name: error?.name || 'Error',
            code: typeof error?.code === 'string' ? error.code : undefined
        });
        return res.status(500).json({ error: 'The request could not be completed. Please try again.' });
    });

    return app;
}
