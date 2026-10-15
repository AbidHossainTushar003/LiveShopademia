import { isIP } from 'node:net';
import { join } from 'node:path';
import { URL } from 'node:url';
import webpush from 'web-push';
import rateLimit from 'express-rate-limit';
import { hashAdminPassword } from './adminPassword.js';
import {
    auditChangeSnapshot,
    auditRequestMetadata,
    encryptSettingSecret,
    publicSettingValue
} from './adminSecurity.js';

const shopSlugPattern = /^[a-z0-9][a-z0-9-]{1,47}$/;
const roles = new Set(['admin', 'staff']);
const transactionTypes = new Set(['payment', 'refund', 'expense', 'adjustment']);
const transactionStatuses = new Set(['pending', 'verified', 'rejected']);
const pushHosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
    return typeof value === 'string' && uuidPattern.test(value);
}

function requirePlatformAdmin(req, res, next) {
    if (!req.isPlatformAdmin) return res.status(403).json({ error: 'Platform administrator permission is required.' });
    return next();
}

async function hasRegisteredPermission(pool, permissionKey) {
    const { rows } = await pool.query(
        `SELECT rp.granted
         FROM admin_role_permissions rp
         JOIN admin_permissions p ON p.permission_key = rp.permission_key
         WHERE rp.role_key = 'super_admin' AND p.permission_key = $1`,
        [permissionKey]
    );
    return rows[0]?.granted === true;
}

function requireRegisteredPermission(pool, permissionKey) {
    return async (req, res, next) => {
        if (!req.isPlatformAdmin) return res.status(403).json({ error: 'Platform administrator permission is required.' });
        try {
            if (!await hasRegisteredPermission(pool, permissionKey)) {
                return res.status(403).json({ error: 'This administrative action is not enabled for your role.' });
            }
            return next();
        } catch (error) {
            return next(error);
        }
    };
}

function allowShopTeamManagement(req, res, next) {
    if (req.isPlatformAdmin || ['owner', 'admin'].includes(req.shopRole)) return next();
    return res.status(403).json({ error: 'Shop admin permission is required.' });
}

function requireSelectedShop(req, res, next) {
    if (!isUuid(req.shopId)) return res.status(400).json({ error: 'Select a shop before using this feature.' });
    return next();
}

export async function writeShopAudit(pool, req, action, entityType, entityId, details = {}) {
    await pool.query(
        `INSERT INTO shop_activity_logs
            (shop_id, actor_email, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [req.shopId, req.admin.sub, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(details)]
    );
}

async function withTransaction(pool, action) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch((rollbackError) => {
            console.error('Could not roll back shop management transaction:', {
                name: rollbackError.name || 'Error',
                code: typeof rollbackError.code === 'string' ? rollbackError.code : undefined
            });
        });
        throw error;
    } finally {
        client.release();
    }
}

async function revokeUserSessions(pool, userId, shopId = null) {
    if (!userId) return;
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
}

function validSubscription(subscription) {
    if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) return false;
    if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
    let endpoint;
    try {
        endpoint = new URL(subscription.endpoint);
    } catch {
        return false;
    }
    return endpoint.protocol === 'https:'
        && !endpoint.username
        && !endpoint.password
        && !endpoint.port
        && !isIP(endpoint.hostname)
        && pushHosts.some((host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`))
        && typeof subscription.keys?.p256dh === 'string'
        && /^[A-Za-z0-9_-]{80,100}$/.test(subscription.keys.p256dh)
        && typeof subscription.keys?.auth === 'string'
        && /^[A-Za-z0-9_-]{16,64}$/.test(subscription.keys.auth);
}

function dateOrNull(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
}

function shopImagePath(uploadsDirectory, imageUrl) {
    if (typeof imageUrl !== 'string' || !/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(imageUrl)) return null;
    return join(uploadsDirectory, imageUrl.slice('/uploads/'.length));
}

function validHeroTargetUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || !value.trim()) return false;
    if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return true;
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

function heroSlideFields(body) {
    const headline = typeof body?.headline === 'string' ? body.headline.trim() : '';
    const bodyText = typeof body?.bodyText === 'string' ? body.bodyText.trim() : '';
    const buttonText = typeof body?.buttonText === 'string' ? body.buttonText.trim() : '';
    const targetUrl = typeof body?.targetUrl === 'string' ? body.targetUrl.trim() : '';
    if (headline.length < 2 || headline.length > 120
        || bodyText.length < 2 || bodyText.length > 500
        || buttonText.length < 2 || buttonText.length > 40
        || !validHeroTargetUrl(targetUrl)) return null;
    return { headline, bodyText, buttonText, targetUrl };
}

async function cleanupHeroSlideUploads(files, removeUploadedFile) {
    await Promise.all(files.filter(Boolean).map((file) => removeUploadedFile(file.path).catch((error) => {
        if (error.code !== 'ENOENT') console.error('Could not remove rejected hero slide image:', error.message);
    })));
}

export function registerPlatformRoutes(app, {
    pool,
    authenticateAdmin,
    uploadProductImage,
    validImageSignature,
    removeUploadedFile,
    uploadsDirectory,
    productUploadLimit,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    adminSettingsEncryptionKey
}) {
    const platformAdmin = [authenticateAdmin, requirePlatformAdmin];
    const maximumShopPushSubscriptions = 5000;
    const platformShop = [...platformAdmin, requireSelectedShop];
    const teamManager = [authenticateAdmin, allowShopTeamManagement, requireSelectedShop];
    const teamReader = [...teamManager];
    const platformReader = platformShop;
    const settingsReader = [authenticateAdmin, requireRegisteredPermission(pool, 'settings.read')];
    const settingsWriter = [authenticateAdmin, requireRegisteredPermission(pool, 'settings.write')];
    const auditReader = [authenticateAdmin, requireRegisteredPermission(pool, 'audit.read')];
    const permissionsReader = [authenticateAdmin, requireRegisteredPermission(pool, 'permissions.read')];
    const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);
    const pushSubscriptionLimit = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many notification subscription requests. Please try again later.' }
    });
    if (pushEnabled) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    app.get('/api/v1/admin/permissions', ...permissionsReader, async (_req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT r.role_key AS "roleKey", r.display_name AS "roleName",
                        r.mapping_status AS "mappingStatus", p.permission_key AS "permissionKey",
                        p.description, COALESCE(rp.granted, FALSE) AS granted
                 FROM admin_roles r CROSS JOIN admin_permissions p
                 LEFT JOIN admin_role_permissions rp
                   ON rp.role_key = r.role_key AND rp.permission_key = p.permission_key
                 ORDER BY r.role_key, p.permission_key`
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/settings', ...settingsReader, async (_req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT setting_group AS "group", setting_key AS "key", value, is_secret AS "isSecret",
                        updated_at AS "updatedAt"
                 FROM admin_settings ORDER BY setting_group, setting_key`
            );
            return res.json({
                data: rows.map((setting) => ({
                    ...setting,
                    value: publicSettingValue(setting.value, setting.isSecret)
                }))
            });
        } catch (error) {
            return next(error);
        }
    });

    app.put('/api/v1/admin/settings/:settingGroup/:settingKey', ...settingsWriter, async (req, res, next) => {
        const settingGroup = req.params.settingGroup;
        const settingKey = req.params.settingKey;
        const body = req.body;
        if (!/^[a-z][a-z0-9_-]{1,47}$/.test(settingGroup)
            || !/^[a-z][a-z0-9_-]{1,63}$/.test(settingKey)
            || !body || typeof body !== 'object' || Array.isArray(body)
            || Object.keys(body).some((key) => !['value', 'isSecret'].includes(key))
            || typeof body.isSecret !== 'boolean'
            || !Object.hasOwn(body, 'value')) {
            return res.status(400).json({ error: 'Provide a valid setting group, key, value, and secret flag.' });
        }
        const isStorefrontAnnouncement = settingGroup === 'storefront' && settingKey === 'announcement';
        if (isStorefrontAnnouncement && !req.isPlatformAdmin) {
            return res.status(403).json({ error: 'Only a platform super admin can change the storefront announcement.' });
        }
        if (isStorefrontAnnouncement && (body.isSecret || typeof body.value !== 'string'
            || !body.value.trim() || body.value.length > 160)) {
            return res.status(400).json({ error: 'The storefront announcement must be public text between 1 and 160 characters.' });
        }
        const settingValue = isStorefrontAnnouncement ? body.value.trim() : body.value;
        let encodedValue;
        try {
            const serialized = JSON.stringify(settingValue);
            if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > 4096) {
                return res.status(400).json({ error: 'Setting values must be valid JSON under 4 KB.' });
            }
            if (body.isSecret) {
                if (typeof body.value !== 'string' || !body.value || body.value.length > 2048) {
                    return res.status(400).json({ error: 'Secret settings must be non-empty strings of at most 2048 characters.' });
                }
                if (!await hasRegisteredPermission(pool, 'secrets.write')) {
                    return res.status(403).json({ error: 'Secret-setting permission is not enabled for your role.' });
                }
                if (!adminSettingsEncryptionKey) {
                    return res.status(503).json({ error: 'Secret settings are disabled until ADMIN_SETTINGS_ENCRYPTION_KEY is configured.' });
                }
                encodedValue = encryptSettingSecret(body.value, adminSettingsEncryptionKey);
            } else {
                encodedValue = settingValue;
            }
        } catch (error) {
            return next(error);
        }

        try {
            const result = await withTransaction(pool, async (client) => {
                const previousResult = await client.query(
                    `SELECT is_secret AS "isSecret" FROM admin_settings
                     WHERE setting_group = $1 AND setting_key = $2 FOR UPDATE`,
                    [settingGroup, settingKey]
                );
                const previous = previousResult.rows[0] || null;
                await client.query(
                    `INSERT INTO admin_settings
                        (setting_group, setting_key, value, is_secret, updated_by, updated_at)
                     VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
                     ON CONFLICT (setting_group, setting_key)
                     DO UPDATE SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret,
                                   updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
                    [settingGroup, settingKey, JSON.stringify(encodedValue), body.isSecret, req.admin.userId]
                );
                const metadata = auditRequestMetadata(req);
                await client.query(
                    `INSERT INTO admin_audit_log
                        (admin_user_id, actor_email, action, entity, entity_id, before_data, after_data,
                         ip, user_agent, request_id)
                     VALUES ($1, $2, $3, 'setting', $4, $5::jsonb, $6::jsonb, $7::inet, $8, $9::uuid)`,
                    [
                        req.admin.userId,
                        req.admin.sub,
                        previous ? 'setting.updated' : 'setting.created',
                        `${settingGroup}.${settingKey}`,
                        previous ? JSON.stringify(auditChangeSnapshot(settingGroup, settingKey, previous.isSecret)) : null,
                        JSON.stringify(auditChangeSnapshot(settingGroup, settingKey, body.isSecret)),
                        metadata.ip,
                        metadata.userAgent,
                        metadata.requestId
                    ]
                );
                return { group: settingGroup, key: settingKey, isSecret: body.isSecret };
            });
            return res.json({ data: { ...result, value: publicSettingValue(settingValue, body.isSecret) } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/audit', ...auditReader, async (req, res, next) => {
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
        try {
            const { rows } = await pool.query(
                `SELECT id, actor_email AS "actorEmail", action, entity, entity_id AS "entityId",
                        before_data AS "before", after_data AS "after", ip::text,
                        user_agent AS "userAgent", request_id AS "requestId", created_at AS "createdAt"
                 FROM admin_audit_log
                 ORDER BY id DESC LIMIT $1`,
                [limit]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/hero-slides', ...platformReader, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, position, image, mobile_image AS "mobileImage", headline, body_text AS "bodyText",
                        button_text AS "buttonText", target_url AS "targetUrl"
                 FROM shop_hero_slides WHERE shop_id = $1 ORDER BY position`,
                [req.shopId]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/hero-slides', ...platformShop, productUploadLimit, uploadProductImage.fields([
        { name: 'image', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 }
    ]), async (req, res, next) => {
        const file = req.files?.image?.[0];
        const mobileFile = req.files?.mobileImage?.[0];
        const uploadedFiles = [file, mobileFile];
        const fields = heroSlideFields(req.body);
        if (!file || !fields) {
            await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
            return res.status(400).json({ error: 'Provide an image, headline, description, button text, and a valid Buy Now URL.' });
        }
        try {
            for (const uploaded of uploadedFiles.filter(Boolean)) {
                if (!await validImageSignature(uploaded)) {
                    await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
                    return res.status(400).json({ error: 'The uploaded file does not match its JPEG, PNG, or WebP image type.' });
                }
            }
            const slide = await withTransaction(pool, async (client) => {
                const { rows: countRows } = await client.query(
                    'SELECT COUNT(*)::int AS count FROM shop_hero_slides WHERE shop_id = $1',
                    [req.shopId]
                );
                if (countRows[0].count >= 5) {
                    const error = new Error('A shop can have up to 5 hero slides.');
                    error.code = 'HERO_SLIDE_LIMIT';
                    throw error;
                }
                const position = countRows[0].count;
                const { rows } = await client.query(
                    `INSERT INTO shop_hero_slides
                        (shop_id, position, image, mobile_image, headline, body_text, button_text, target_url)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     RETURNING id, position, image, mobile_image AS "mobileImage", headline, body_text AS "bodyText",
                               button_text AS "buttonText", target_url AS "targetUrl"`,
                    [req.shopId, position, `/uploads/${file.filename}`, mobileFile ? `/uploads/${mobileFile.filename}` : null, fields.headline, fields.bodyText, fields.buttonText, fields.targetUrl]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'hero_slide.created', 'hero_slide', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, rows[0].id, JSON.stringify({ headline: fields.headline, position })]
                );
                return rows[0];
            });
            return res.status(201).json({ data: slide });
        } catch (error) {
            await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
            if (error.code === 'HERO_SLIDE_LIMIT') return res.status(409).json({ error: error.message });
            return next(error);
        }
    });

    app.put('/api/v1/admin/shop/hero-slides/:id', ...platformShop, productUploadLimit, uploadProductImage.fields([
        { name: 'image', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 }
    ]), async (req, res, next) => {
        const file = req.files?.image?.[0];
        const mobileFile = req.files?.mobileImage?.[0];
        const uploadedFiles = [file, mobileFile];
        const fields = heroSlideFields(req.body);
        if (!/^\d{1,18}$/.test(req.params.id) || !fields) {
            await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
            return res.status(400).json({ error: 'Provide valid hero slide text and a valid Buy Now URL.' });
        }
        try {
            for (const uploaded of uploadedFiles.filter(Boolean)) {
                if (!await validImageSignature(uploaded)) {
                    await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
                    return res.status(400).json({ error: 'The uploaded file does not match its JPEG, PNG, or WebP image type.' });
                }
            }
            const slide = await withTransaction(pool, async (client) => {
                const { rows: previousRows } = await client.query(
                    'SELECT image, mobile_image AS "mobileImage" FROM shop_hero_slides WHERE id = $1 AND shop_id = $2 FOR UPDATE',
                    [req.params.id, req.shopId]
                );
                if (!previousRows[0]) return null;
                const image = file ? `/uploads/${file.filename}` : previousRows[0].image;
                const mobileImage = mobileFile
                    ? `/uploads/${mobileFile.filename}`
                    : req.body.clearMobileImage === 'true' ? null : previousRows[0].mobileImage;
                const { rows } = await client.query(
                    `UPDATE shop_hero_slides
                     SET image = $1, mobile_image = $2, headline = $3, body_text = $4, button_text = $5,
                         target_url = $6, updated_at = NOW()
                     WHERE id = $7 AND shop_id = $8
                     RETURNING id, position, image, mobile_image AS "mobileImage", headline, body_text AS "bodyText",
                               button_text AS "buttonText", target_url AS "targetUrl"`,
                    [image, mobileImage, fields.headline, fields.bodyText, fields.buttonText, fields.targetUrl, req.params.id, req.shopId]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'hero_slide.updated', 'hero_slide', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, req.params.id, JSON.stringify({ headline: fields.headline })]
                );
                return { slide: rows[0], previousImage: previousRows[0].image, previousMobileImage: previousRows[0].mobileImage };
            });
            if (!slide) {
                await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
                return res.status(404).json({ error: 'Hero slide not found.' });
            }
            const replacedImagePaths = [
                file && shopImagePath(uploadsDirectory, slide.previousImage),
                (mobileFile || req.body.clearMobileImage === 'true') && shopImagePath(uploadsDirectory, slide.previousMobileImage)
            ].filter(Boolean);
            await Promise.all(replacedImagePaths.map((path) => removeUploadedFile(path).catch((error) => {
                if (error.code !== 'ENOENT') console.error('Could not remove replaced hero slide image:', error.message);
            })));
            return res.json({ data: slide.slide });
        } catch (error) {
            await cleanupHeroSlideUploads(uploadedFiles, removeUploadedFile);
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/hero-slides/order', ...platformShop, async (req, res, next) => {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length > 5 || ids.some((id) => !/^\d{1,18}$/.test(String(id)))) {
            return res.status(400).json({ error: 'Provide the ordered IDs for up to 5 hero slides.' });
        }
        try {
            const updated = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    'SELECT id FROM shop_hero_slides WHERE shop_id = $1 ORDER BY position FOR UPDATE',
                    [req.shopId]
                );
                const currentIds = rows.map((row) => String(row.id));
                if (ids.length !== currentIds.length || new Set(ids.map(String)).size !== ids.length
                    || ids.some((id) => !currentIds.includes(String(id)))) return false;
                for (const [position, id] of ids.entries()) {
                    await client.query(
                        'UPDATE shop_hero_slides SET position = $1, updated_at = NOW() WHERE id = $2 AND shop_id = $3',
                        [position, id, req.shopId]
                    );
                }
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'hero_slides.reordered', 'shop', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, String(req.shopId), JSON.stringify({ ids: ids.map(String) })]
                );
                return true;
            });
            if (!updated) return res.status(400).json({ error: 'Hero slide order does not match this shop’s slides.' });
            return res.json({ data: { updated: true } });
        } catch (error) {
            return next(error);
        }
    });

    app.delete('/api/v1/admin/shop/hero-slides/:id', ...platformShop, async (req, res, next) => {
        if (!/^\d{1,18}$/.test(req.params.id)) return res.status(400).json({ error: 'The selected hero slide ID is invalid.' });
        try {
            const removed = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    'DELETE FROM shop_hero_slides WHERE id = $1 AND shop_id = $2 RETURNING id, position, image, mobile_image AS "mobileImage"',
                    [req.params.id, req.shopId]
                );
                if (!rows[0]) return null;
                await client.query('UPDATE shop_hero_slides SET position = position - 1 WHERE shop_id = $1 AND position > $2', [req.shopId, rows[0].position]);
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'hero_slide.deleted', 'hero_slide', $3, '{}'::jsonb)`,
                    [req.shopId, req.admin.sub, req.params.id]
                );
                return rows[0];
            });
            if (!removed) return res.status(404).json({ error: 'Hero slide not found.' });
            const imagePaths = [removed.image, removed.mobileImage]
                .map((image) => shopImagePath(uploadsDirectory, image))
                .filter(Boolean);
            await Promise.all(imagePaths.map((imagePath) => removeUploadedFile(imagePath).catch((error) => {
                if (error.code !== 'ENOENT') console.error('Could not remove deleted hero slide image:', error.message);
            })));
            return res.json({ data: { id: removed.id } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/shops', authenticateAdmin, async (req, res, next) => {
        try {
            const { rows } = req.isPlatformAdmin
                ? await pool.query(
                    `SELECT s.id, s.slug, s.name, s.hero_image AS "heroImage",
                            s.banner_image AS "bannerImage", s.advance_charge AS "advanceCharge",
                            s.status, NULL::text AS role, s.created_at AS "joinedAt"
                     FROM shops s ORDER BY s.created_at, s.id`
                )
                : await pool.query(
                    `SELECT s.id, s.slug, s.name, s.hero_image AS "heroImage",
                            s.banner_image AS "bannerImage", s.advance_charge AS "advanceCharge",
                            s.status, m.role, m.created_at AS "joinedAt"
                     FROM shop_memberships m
                     JOIN admin_users u ON u.id = m.user_id
                     JOIN shops s ON s.id = m.shop_id
                     WHERE u.email = $1 AND s.status = 'active'
                     ORDER BY s.created_at, s.id`,
                    [req.admin.sub]
                );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shops', ...platformAdmin, async (req, res, next) => {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim().toLowerCase() : '';
        if (name.length < 2 || name.length > 120 || !shopSlugPattern.test(slug)) {
            return res.status(400).json({ error: 'Enter a shop name (2–120 characters) and a URL-safe shop ID (2–48 lowercase letters, numbers, or hyphens).' });
        }
        try {
            const shop = await withTransaction(pool, async (client) => {
                const created = await client.query(
                    `INSERT INTO shops (slug, name, advance_charge)
                     VALUES ($1, $2, COALESCE($3, 100))
                     RETURNING id, slug, name, hero_image AS "heroImage",
                               banner_image AS "bannerImage", advance_charge AS "advanceCharge"`,
                    [slug, name, Number.isSafeInteger(req.body.advanceCharge) && req.body.advanceCharge >= 0
                        ? req.body.advanceCharge : null]
                );
                await client.query(`
                    INSERT INTO shop_product_categories (shop_id, id, name, icon, is_default)
                    VALUES
                        ($1, 'gadgets', 'Electronics', 'fa-laptop', TRUE),
                        ($1, 'accessories', 'Jewelry & Accessories', 'fa-gem', TRUE),
                        ($1, 'clothing', 'Clothing', 'fa-shirt', TRUE),
                        ($1, 'more', 'Other', 'fa-box', TRUE)
                    ON CONFLICT (shop_id, id) DO NOTHING
                `, [created.rows[0].id]);
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'shop.created', 'shop', $4, $3::jsonb)`,
                    [created.rows[0].id, req.admin.sub, JSON.stringify({ slug, name }), String(created.rows[0].id)]
                );
                return created.rows[0];
            });
            return res.status(201).json({ data: shop });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'That shop ID is already in use.' });
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shops/:shopId/status', ...platformAdmin, async (req, res, next) => {
        const status = req.body?.status;
        if (!isUuid(req.params.shopId) || req.params.shopId !== req.shopId
            || !['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Choose a valid shop and set its status to active or suspended.' });
        }
        try {
            const shop = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `UPDATE shops SET status = $1, status_updated_at = NOW(), updated_at = NOW()
                     WHERE id = $2
                     RETURNING id, slug, name, status`,
                    [status, req.shopId]
                );
                if (!rows[0]) return null;
                if (status !== 'active') {
                    await client.query(
                        `UPDATE admin_sessions SET revoked_at = NOW()
                         WHERE shop_id = $1 AND revoked_at IS NULL`,
                        [req.shopId]
                    );
                }
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'shop.status_changed', 'shop', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, String(req.shopId), JSON.stringify({ status })]
                );
                return rows[0];
            });
            if (!shop) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: shop });
        } catch (error) {
            return next(error);
        }
    });

    app.delete('/api/v1/admin/shops/:shopId', ...platformAdmin, async (req, res, next) => {
        if (!isUuid(req.params.shopId) || req.params.shopId !== req.shopId) {
            return res.status(400).json({ error: 'Choose a valid shop to archive.' });
        }
        try {
            const shop = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `UPDATE shops SET status = 'archived', status_updated_at = NOW(), updated_at = NOW()
                     WHERE id = $1
                     RETURNING id, slug, name, status`,
                    [req.shopId]
                );
                if (!rows[0]) return null;
                await client.query(
                    `UPDATE admin_sessions SET revoked_at = NOW()
                     WHERE shop_id = $1 AND revoked_at IS NULL`,
                    [req.shopId]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'shop.archived', 'shop', $3, '{}'::jsonb)`,
                    [req.shopId, req.admin.sub, String(req.shopId)]
                );
                return rows[0];
            });
            if (!shop) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: shop });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shops/settings', ...platformShop, async (req, res, next) => {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const advanceCharge = req.body?.advanceCharge;
        if (name.length < 2 || name.length > 120 || !Number.isSafeInteger(advanceCharge) || advanceCharge < 0) {
            return res.status(400).json({ error: 'Enter a shop name and a non-negative whole-number delivery advance charge.' });
        }
        try {
            const shop = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `UPDATE shops SET name = $1, advance_charge = $2, updated_at = NOW()
                     WHERE id = $3
                     RETURNING id, slug, name, hero_image AS "heroImage",
                               banner_image AS "bannerImage", advance_charge AS "advanceCharge"`,
                    [name, advanceCharge, req.shopId]
                );
                if (!rows[0]) return null;
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'shop.settings_updated', 'shop', $4, $3::jsonb)`,
                    [req.shopId, req.admin.sub, JSON.stringify({ name, advanceCharge }), String(req.shopId)]
                );
                return rows[0];
            });
            if (!shop) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: shop });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/members', ...teamManager, async (req, res, next) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const role = req.body?.role;
        const password = req.body?.password;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !roles.has(role)) {
            return res.status(400).json({ error: 'Enter a valid email and choose the admin or staff role.' });
        }
        if (!req.isPlatformAdmin && role !== 'staff') {
            return res.status(403).json({ error: 'Only the platform administrator can assign shop admin access.' });
        }
        if (password != null && (typeof password !== 'string' || password.length < 12 || password.length > 1024)) {
            return res.status(400).json({ error: 'A new user password must be between 12 and 1024 characters.' });
        }
        if (password == null && role === 'admin') {
            return res.status(400).json({ error: 'Set a temporary password when creating an admin account.' });
        }
        try {
            const passwordHash = password == null ? null : await hashAdminPassword(password);
            const member = await withTransaction(pool, async (client) => {
                let userResult = await client.query(
                    `SELECT u.id, u.email, (pa.user_id IS NOT NULL) AS "isPlatformAdmin"
                     FROM admin_users u
                     LEFT JOIN platform_admins pa ON pa.user_id = u.id
                     WHERE u.email = $1`,
                    [email]
                );
                if (!userResult.rows[0] && passwordHash) {
                    userResult = await client.query(
                        `INSERT INTO admin_users (email, password_hash)
                         VALUES ($1, $2) RETURNING id, email`,
                        [email, passwordHash]
                    );
                }
                if (!userResult.rows[0]) {
                    const error = new Error('No account exists for this email. Provide a password to create one.');
                    error.code = 'USER_ACCOUNT_MISSING';
                    throw error;
                }
                if (userResult.rows[0].isPlatformAdmin) {
                    const error = new Error('A platform administrator cannot be assigned to a shop.');
                    error.code = 'PLATFORM_ADMIN_MEMBERSHIP';
                    throw error;
                }
                const inserted = await client.query(
                    `INSERT INTO shop_memberships (shop_id, user_id, role)
                     VALUES ($1, $2, $3)
                     RETURNING role, created_at AS "joinedAt"`,
                    [req.shopId, userResult.rows[0].id, role]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'member.added', 'admin_user', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, userResult.rows[0].id, JSON.stringify({ email, role })]
                );
                return { ...userResult.rows[0], ...inserted.rows[0] };
            });
            return res.status(201).json({ data: member });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'This user already belongs to the selected shop.' });
            if (error.code === 'USER_ACCOUNT_MISSING') return res.status(404).json({ error: error.message });
            if (error.code === 'PLATFORM_ADMIN_MEMBERSHIP') return res.status(409).json({ error: error.message });
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/members', ...teamReader, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT u.id, u.email, m.role, m.created_at AS "joinedAt"
                 FROM shop_memberships m JOIN admin_users u ON u.id = m.user_id
                 WHERE m.shop_id = $1 ORDER BY m.created_at, u.email`,
                [req.shopId]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shop/members/:userId', ...teamManager, async (req, res, next) => {
        if (!isUuid(req.params.userId) || !roles.has(req.body?.role)) {
            return res.status(400).json({ error: 'Choose a valid member and the admin or staff role.' });
        }
        if (!req.isPlatformAdmin && req.body.role !== 'staff') {
            return res.status(403).json({ error: 'Only the platform administrator can assign shop admin access.' });
        }
        try {
            const member = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `UPDATE shop_memberships AS m
                     SET role = $1
                     FROM admin_users AS u
                     WHERE m.shop_id = $2 AND m.user_id = u.id AND u.id = $3
                       AND u.email <> $4
                       AND ($5::boolean OR m.role = 'staff')
                     RETURNING u.id, u.email, m.role`,
                    [req.body.role, req.shopId, req.params.userId, req.admin.sub, req.isPlatformAdmin]
                );
                if (!rows[0]) return null;
                await revokeUserSessions(client, rows[0].id, req.shopId);
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'member.role_changed', 'admin_user', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, rows[0].id, JSON.stringify({ email: rows[0].email, role: rows[0].role })]
                );
                return rows[0];
            });
            if (!member) return res.status(404).json({ error: 'Shop member not found, or you cannot change your own owner role.' });
            return res.json({ data: member });
        } catch (error) {
            return next(error);
        }
    });

    app.delete('/api/v1/admin/shop/members/:userId', ...teamManager, async (req, res, next) => {
        if (!isUuid(req.params.userId)) {
            return res.status(400).json({ error: 'The selected member ID is invalid.' });
        }
        try {
            const member = await withTransaction(pool, async (client) => {
                const result = await client.query(
                    `DELETE FROM shop_memberships m USING admin_users u
                     WHERE m.shop_id = $1 AND m.user_id = u.id AND u.id = $2
                       AND u.email <> $3
                       AND ($4::boolean OR m.role = 'staff')
                     RETURNING u.id, u.email`,
                    [req.shopId, req.params.userId, req.admin.sub, req.isPlatformAdmin]
                );
                if (!result.rows[0]) return null;
                await revokeUserSessions(client, result.rows[0].id, req.shopId);
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'member.removed', 'admin_user', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, result.rows[0].id, JSON.stringify({ email: result.rows[0].email })]
                );
                return result.rows[0];
            });
            if (!member) return res.status(404).json({ error: 'Shop member not found, or you cannot remove your own owner access.' });
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/branding', ...platformShop, productUploadLimit, uploadProductImage.single('image'), async (req, res, next) => {
        const file = req.file;
        const kind = req.body?.kind;
        if (!file || !['hero', 'banner'].includes(kind)) {
            if (file) await removeUploadedFile(file.path).catch((error) => {
                console.error('Could not remove rejected shop image:', error.message);
            });
            return res.status(400).json({ error: 'Choose a hero or banner image to upload.' });
        }
        try {
            if (!await validImageSignature(file)) {
                await removeUploadedFile(file.path);
                return res.status(400).json({ error: 'The uploaded file does not match its JPEG, PNG, or WebP image type.' });
            }
            const column = kind === 'hero' ? 'hero_image' : 'banner_image';
            const image = `/uploads/${file.filename}`;
            const saved = await withTransaction(pool, async (client) => {
                const { rows: previousRows } = await client.query(
                    `SELECT ${column} AS "previousImage" FROM shops WHERE id = $1 FOR UPDATE`,
                    [req.shopId]
                );
                if (!previousRows[0]) return null;
                const { rows: updatedRows } = await client.query(
                    `UPDATE shops SET ${column} = $1, updated_at = NOW()
                     WHERE id = $2 RETURNING id`,
                    [image, req.shopId]
                );
                if (!updatedRows[0]) return null;
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, $3, 'shop', $4, $5::jsonb)`,
                    [req.shopId, req.admin.sub, `shop.${kind}_image_updated`, String(req.shopId), JSON.stringify({ image })]
                );
                return previousRows[0];
            });
            if (!saved) {
                await removeUploadedFile(file.path);
                return res.status(404).json({ error: 'Shop not found.' });
            }
            const previousImagePath = shopImagePath(uploadsDirectory, saved.previousImage);
            let warning;
            if (previousImagePath && previousImagePath !== file.path) {
                await removeUploadedFile(previousImagePath).catch((cleanupError) => {
                    console.error('Could not remove replaced shop image:', cleanupError.message);
                    warning = 'The image was saved, but the previous image could not be deleted. Review the server logs.';
                });

            }
            return res.json({ data: { kind, image }, ...(warning ? { warning } : {}) });
        } catch (error) {
            await removeUploadedFile(file.path).catch((cleanupError) => {
                if (cleanupError.code !== 'ENOENT') console.error('Could not remove rejected shop image:', cleanupError.message);
            });
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/profile', ...teamManager, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, slug, name, description, location,
                        contact_email AS "contactEmail", contact_phone AS "contactPhone",
                        contact_whatsapp AS "contactWhatsApp", logo_image AS "logoImage"
                 FROM shops WHERE id = $1`,
                [req.shopId]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Shop not found.' });
            return res.json({ data: rows[0] });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shop/profile', ...teamManager, productUploadLimit, uploadProductImage.single('logo'), async (req, res, next) => {
        const file = req.file;
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const location = typeof req.body?.location === 'string' ? req.body.location.trim() : '';
        const contactEmail = typeof req.body?.contactEmail === 'string' ? req.body.contactEmail.trim() : '';
        const contactPhone = typeof req.body?.contactPhone === 'string' ? req.body.contactPhone.trim() : '';
        const contactWhatsApp = typeof req.body?.contactWhatsApp === 'string' ? req.body.contactWhatsApp.trim() : '';
        const removeLogo = req.body?.removeLogo === 'true';
        if (name.length < 2 || name.length > 120 || description.length > 2000 || location.length > 200
            || contactEmail.length > 254 || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
            || contactPhone.length > 40 || contactWhatsApp.length > 40 || (removeLogo && file)) {
            if (file) await removeUploadedFile(file.path).catch((error) => console.error('Could not remove rejected shop logo:', error.message));
            return res.status(400).json({ error: 'Check the shop profile fields and contact details, then try again.' });
        }
        try {
            if (file && !await validImageSignature(file)) {
                await removeUploadedFile(file.path);
                return res.status(400).json({ error: 'The uploaded logo does not match its JPEG, PNG, or WebP image type.' });
            }
            const logo = file ? `/uploads/${file.filename}` : null;
            const saved = await withTransaction(pool, async (client) => {
                const { rows: previousRows } = await client.query(
                    'SELECT logo_image AS "previousLogo" FROM shops WHERE id = $1 FOR UPDATE',
                    [req.shopId]
                );
                if (!previousRows[0]) return null;
                const { rows } = await client.query(
                    `UPDATE shops
                     SET name = $1, description = $2, location = $3,
                         contact_email = $4, contact_phone = $5, contact_whatsapp = $6,
                         logo_image = CASE WHEN $8 THEN NULL ELSE COALESCE($7, logo_image) END,
                         updated_at = NOW()
                     WHERE id = $9
                     RETURNING id, slug, name, description, location,
                               contact_email AS "contactEmail", contact_phone AS "contactPhone",
                               contact_whatsapp AS "contactWhatsApp", logo_image AS "logoImage"`,
                    [name, description, location, contactEmail, contactPhone, contactWhatsApp,
                        logo, removeLogo, req.shopId]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'shop.profile_updated', 'shop', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, String(req.shopId), JSON.stringify({ name, location })]
                );
                return { shop: rows[0], previousLogo: previousRows[0].previousLogo };
            });
            if (!saved) {
                if (file) await removeUploadedFile(file.path);
                return res.status(404).json({ error: 'Shop not found.' });
            }
            const oldLogoPath = shopImagePath(uploadsDirectory, saved.previousLogo);
            let warning;
            if ((file || removeLogo) && oldLogoPath) {
                await removeUploadedFile(oldLogoPath).catch((error) => {
                    console.error('Could not remove replaced shop logo:', error.message);
                    warning = 'Your profile was saved, but the previous logo could not be deleted.';
                });
            }
            return res.json({ data: saved.shop, ...(warning ? { warning } : {}) });
        } catch (error) {
            if (file) await removeUploadedFile(file.path).catch((cleanupError) => {
                if (cleanupError.code !== 'ENOENT') console.error('Could not remove rejected shop logo:', cleanupError.message);
            });
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/transactions', ...platformReader, async (req, res, next) => {
        const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
        const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 30, 100));
        try {
            const [transactions, counts] = await Promise.all([
                pool.query(
                    `SELECT id, order_id AS "orderId", transaction_type AS type, method, amount,
                            reference, status, notes, recorded_by AS "recordedBy",
                            created_at AS "createdAt", updated_at AS "updatedAt"
                     FROM shop_transactions WHERE shop_id = $1
                     ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
                    [req.shopId, limit, (page - 1) * limit]
                ),
                pool.query('SELECT COUNT(*)::int AS total FROM shop_transactions WHERE shop_id = $1', [req.shopId])
            ]);
            return res.json({ data: transactions.rows, page, limit, total: counts.rows[0].total });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/transactions', ...platformShop, async (req, res, next) => {
        const { type, method, amount, reference, status = 'pending', notes = '', orderId = null } = req.body ?? {};
        if (!transactionTypes.has(type) || typeof method !== 'string' || method.trim().length < 2
            || method.trim().length > 40 || !Number.isSafeInteger(amount) || amount < 1
            || typeof reference !== 'string' || reference.trim().length < 1 || reference.trim().length > 160
            || !transactionStatuses.has(status) || typeof notes !== 'string' || notes.length > 1000
            || (orderId != null && !/^\d{1,18}$/.test(String(orderId)))) {
            return res.status(400).json({ error: 'Enter a valid transaction type, method, positive whole-number amount, reference, status, notes, and optional order ID.' });
        }
        try {
            const transaction = await withTransaction(pool, async (client) => {
                if (orderId != null) {
                    const order = await client.query('SELECT id FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shopId]);
                    if (!order.rows[0]) {
                        const error = new Error('The order does not belong to this shop.');
                        error.code = 'ORDER_SCOPE';
                        throw error;
                    }
                }
                const result = await client.query(
                    `INSERT INTO shop_transactions
                        (shop_id, order_id, transaction_type, method, amount, reference, status, notes, recorded_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING id, order_id AS "orderId", transaction_type AS type, method, amount,
                               reference, status, notes, recorded_by AS "recordedBy", created_at AS "createdAt"`,
                    [req.shopId, orderId, type, method.trim(), amount, reference.trim(), status, notes.trim(), req.admin.sub]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'transaction.recorded', 'transaction', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, result.rows[0].id, JSON.stringify({ type, method, amount, status, reference })]
                );
                return result.rows[0];
            });
            return res.status(201).json({ data: transaction });
        } catch (error) {
            if (error.code === '23505' && error.constraint === 'shop_transactions_shop_reference_idx') {
                return res.status(409).json({ error: 'This transaction reference is already recorded for this shop.' });
            }
            if (error.code === 'ORDER_SCOPE') return res.status(404).json({ error: error.message });
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shop/transactions/:id/status', ...platformShop, async (req, res, next) => {
        const status = req.body?.status;
        if (!['verified', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Choose pending, verified, or rejected.' });
        }
        if (!/^\d{1,18}$/.test(String(req.params.id))) {
            return res.status(400).json({ error: 'The selected transaction ID is invalid.' });
        }
        try {
            const result = await withTransaction(pool, async (client) => {
                const updated = await client.query(
                    `WITH previous AS MATERIALIZED (
                         SELECT id, status FROM shop_transactions
                         WHERE shop_id = $2 AND id = $3 FOR UPDATE
                     ), changed AS (
                         UPDATE shop_transactions AS t
                         SET status = $1, updated_at = NOW()
                         FROM previous
                         WHERE t.id = previous.id
                         RETURNING t.id, t.status, previous.status AS "previousStatus"
                     )
                     SELECT id, status, "previousStatus" FROM changed`,
                    [status, req.shopId, req.params.id]
                );
                if (!updated.rows[0]) return null;
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'transaction.status_changed', 'transaction', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, req.params.id,
                        JSON.stringify({ from: updated.rows[0].previousStatus, to: status })]
                );
                return { id: updated.rows[0].id, status: updated.rows[0].status };
            });
            if (!result) return res.status(404).json({ error: 'Transaction not found.' });
            return res.json({ data: result });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/reports', ...platformReader, async (req, res, next) => {
        const days = Math.max(1, Math.min(Number.parseInt(req.query.days, 10) || 30, 365));
        try {
            const [orders, payments] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS "orderCount",
                            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS "cancelledCount",
                            COALESCE(SUM(subtotal) FILTER (WHERE status <> 'cancelled'), 0)::text AS "grossSales",
                            COALESCE(SUM(subtotal) FILTER (WHERE status = 'delivered'), 0)::text AS "deliveredSales",
                            COALESCE(AVG(subtotal) FILTER (WHERE status <> 'cancelled'), 0)::numeric(14,2)::text AS "averageOrderValue"
                     FROM orders WHERE shop_id = $1 AND created_at >= NOW() - ($2 * INTERVAL '1 day')`,
                    [req.shopId, days]
                ),
                pool.query(
                    `SELECT transaction_type AS type, status,
                            COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::text AS amount
                     FROM shop_transactions WHERE shop_id = $1
                       AND created_at >= NOW() - ($2 * INTERVAL '1 day')
                     GROUP BY transaction_type, status
                     ORDER BY transaction_type, status`,
                    [req.shopId, days]
                )
            ]);
            return res.json({
                data: {
                    days,
                    orders: orders.rows[0],
                    transactions: payments.rows
                }
            });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/platform/top-products', ...platformAdmin, async (req, res, next) => {
        const days = Math.max(1, Math.min(Number.parseInt(req.query.days, 10) || 30, 365));
        try {
            const { rows } = await pool.query(
                `SELECT s.id AS "shopId", s.name AS "shopName",
                        item->>'productId' AS "productId", item->>'name' AS name,
                        SUM((item->>'quantity')::integer)::int AS quantity,
                        SUM((item->>'lineTotal')::bigint)::text AS revenue
                 FROM orders o
                 JOIN shops s ON s.id = o.shop_id
                 CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
                 WHERE o.status <> 'cancelled'
                   AND o.created_at >= NOW() - ($1 * INTERVAL '1 day')
                 GROUP BY s.id, s.name, item->>'productId', item->>'name'
                 ORDER BY SUM((item->>'quantity')::integer) DESC,
                          SUM((item->>'lineTotal')::bigint) DESC,
                          s.name, item->>'name'
                 LIMIT 10`,
                [days]
            );
            return res.json({ data: { days, topProducts: rows } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/activity', ...platformReader, async (req, res, next) => {
        const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 50, 100));
        try {
            const { rows } = await pool.query(
                `SELECT id, actor_email AS "actorEmail", action, entity_type AS "entityType",
                        entity_id AS "entityId", details, created_at AS "createdAt"
                 FROM shop_activity_logs WHERE shop_id = $1
                 ORDER BY id DESC LIMIT $2`,
                [req.shopId, limit]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/shops/:slug/offers', async (req, res, next) => {
        if (!shopSlugPattern.test(req.params.slug)) {
            return res.status(404).json({ error: 'Shop not found.' });
        }
        try {
            const { rows } = await pool.query(
                `SELECT o.id, o.title, o.message, o.image,
                        o.starts_at AS "startsAt", o.ends_at AS "endsAt",
                        s.id AS "shopId", s.slug AS "shopSlug", s.name AS "shopName"
                 FROM shop_offers o JOIN shops s ON s.id = o.shop_id
                 WHERE s.slug = $1 AND s.status = 'active' AND o.is_published = TRUE
                   AND (o.starts_at IS NULL OR o.starts_at <= NOW())
                   AND (o.ends_at IS NULL OR o.ends_at > NOW())
                 ORDER BY o.created_at DESC`,
                [req.params.slug]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/admin/shop/offers', ...platformReader, async (req, res, next) => {
        try {
            const { rows } = await pool.query(
                `SELECT id, title, message, image, starts_at AS "startsAt", ends_at AS "endsAt",
                        is_published AS "isPublished", created_at AS "createdAt"
                 FROM shop_offers WHERE shop_id = $1 ORDER BY created_at DESC, id DESC`,
                [req.shopId]
            );
            return res.json({ data: rows });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/admin/shop/offers', ...platformShop, async (req, res, next) => {
        const { title, message } = req.body ?? {};
        const startsAt = dateOrNull(req.body?.startsAt);
        const endsAt = dateOrNull(req.body?.endsAt);
        const isPublished = req.body?.isPublished === true;
        if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 120
            || typeof message !== 'string' || message.trim().length < 2 || message.trim().length > 1000
            || startsAt === undefined || endsAt === undefined || (startsAt && endsAt && endsAt <= startsAt)) {
            return res.status(400).json({ error: 'Enter valid offer text and an end date later than its start date.' });
        }
        try {
            const offer = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `INSERT INTO shop_offers (shop_id, title, message, starts_at, ends_at, is_published, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id, title, message, starts_at AS "startsAt", ends_at AS "endsAt",
                               is_published AS "isPublished", created_at AS "createdAt"`,
                    [req.shopId, title.trim(), message.trim(), startsAt, endsAt, isPublished, req.admin.sub]
                );
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, 'offer.created', 'offer', $3, $4::jsonb)`,
                    [req.shopId, req.admin.sub, rows[0].id, JSON.stringify({ title: rows[0].title, isPublished })]
                );
                return rows[0];
            });
            const notificationSent = isPublished && (!startsAt || new Date(startsAt).getTime() <= Date.now())
                ? await sendOfferPush(pool, req.shopId, offer, pushEnabled)
                : 0;
            return res.status(201).json({ data: offer, pushEnabled, notificationSent });
        } catch (error) {
            return next(error);
        }
    });

    app.patch('/api/v1/admin/shop/offers/:id', ...platformShop, async (req, res, next) => {
        const isPublished = req.body?.isPublished;
        if (typeof isPublished !== 'boolean') return res.status(400).json({ error: 'Choose whether this offer is published.' });
        if (!/^\d{1,18}$/.test(String(req.params.id))) {
            return res.status(400).json({ error: 'The selected offer ID is invalid.' });
        }
        try {
            const offer = await withTransaction(pool, async (client) => {
                const { rows } = await client.query(
                    `WITH previous AS MATERIALIZED (
                         SELECT id, is_published, starts_at FROM shop_offers
                         WHERE shop_id = $2 AND id = $3 FOR UPDATE
                     ), updated AS (
                         UPDATE shop_offers AS o
                         SET is_published = $1, updated_at = NOW()
                         FROM previous
                         WHERE o.id = previous.id
                         RETURNING o.id, o.title, o.message, o.is_published AS "isPublished",
                                   o.starts_at AS "startsAt", previous.is_published AS "wasPublished"
                     )
                     SELECT * FROM updated`,
                    [isPublished, req.shopId, req.params.id]
                );
                if (!rows[0]) return null;
                await client.query(
                    `INSERT INTO shop_activity_logs
                        (shop_id, actor_email, action, entity_type, entity_id, details)
                     VALUES ($1, $2, $3, 'offer', $4, $5::jsonb)`,
                    [req.shopId, req.admin.sub,
                        isPublished ? 'offer.published' : 'offer.unpublished', req.params.id,
                        JSON.stringify({ from: rows[0].wasPublished, to: isPublished })]
                );
                return rows[0];
            });
            if (!offer) return res.status(404).json({ error: 'Offer not found.' });
            const shouldNotify = isPublished && !offer.wasPublished
                && (!offer.startsAt || new Date(offer.startsAt).getTime() <= Date.now());
            const notificationSent = shouldNotify
                ? await sendOfferPush(pool, req.shopId, offer, pushEnabled)
                : 0;
            return res.json({
                data: { id: offer.id, title: offer.title, message: offer.message, isPublished: offer.isPublished },
                pushEnabled,
                notificationSent
            });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/shops/:slug/push-key', async (req, res, next) => {
        if (!shopSlugPattern.test(req.params.slug)) {
            return res.status(404).json({ error: 'Shop not found.' });
        }
        try {
            const { rows } = await pool.query(
                `SELECT id FROM shops WHERE slug = $1 AND status = 'active'`,
                [req.params.slug]
            );
            if (!rows[0]) return res.status(404).json({ error: 'Shop not found or unavailable.' });
            res.set('Cache-Control', 'no-store');
            return res.json({ data: { enabled: pushEnabled, publicKey: pushEnabled ? vapidPublicKey : null } });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/v1/shops/:slug/push-subscriptions', pushSubscriptionLimit, async (req, res, next) => {
        if (!shopSlugPattern.test(req.params.slug)) {
            return res.status(404).json({ error: 'Shop not found.' });
        }
        if (!pushEnabled) return res.status(503).json({ error: 'Browser offer notifications are not configured on this server.' });
        if (!validSubscription(req.body)) return res.status(400).json({ error: 'The browser push subscription is invalid.' });
        try {
            const result = await withTransaction(pool, async (client) => {
                const shop = await client.query(
                    "SELECT id FROM shops WHERE slug = $1 AND status = 'active' FOR UPDATE",
                    [req.params.slug]
                );
                if (!shop.rows[0]) return { notFound: true };
                const existing = await client.query(
                    'SELECT id FROM shop_push_subscriptions WHERE shop_id = $1 AND endpoint = $2',
                    [shop.rows[0].id, req.body.endpoint]
                );
                if (existing.rows[0]) {
                    await client.query(
                        `UPDATE shop_push_subscriptions SET subscription = $1::jsonb
                         WHERE shop_id = $2 AND endpoint = $3`,
                        [JSON.stringify(req.body), shop.rows[0].id, req.body.endpoint]
                    );
                    return { saved: true };
                }
                const count = await client.query(
                    'SELECT COUNT(*)::int AS count FROM shop_push_subscriptions WHERE shop_id = $1',
                    [shop.rows[0].id]
                );
                if (count.rows[0].count >= maximumShopPushSubscriptions) return { limitReached: true };
                await client.query(
                    `INSERT INTO shop_push_subscriptions (shop_id, endpoint, subscription)
                     VALUES ($1, $2, $3::jsonb)`,
                    [shop.rows[0].id, req.body.endpoint, JSON.stringify(req.body)]
                );
                return { saved: true };
            });
            if (result.notFound) return res.status(404).json({ error: 'Shop not found.' });
            if (result.limitReached) return res.status(429).json({ error: 'This shop has reached its notification subscriber limit.' });
            return res.status(201).json({ data: { subscribed: true } });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/api/v1/shops/:slug/push-subscriptions', pushSubscriptionLimit, async (req, res, next) => {
        if (!shopSlugPattern.test(req.params.slug)) {
            return res.status(404).json({ error: 'Shop not found.' });
        }
        const endpoint = req.query.endpoint;
        if (typeof endpoint !== 'string' || endpoint.length > 2048) {
            return res.status(400).json({ error: 'A valid subscription endpoint is required.' });
        }
        try {
            const { rows } = await pool.query(
                `SELECT EXISTS (
                     SELECT 1 FROM shop_push_subscriptions s JOIN shops sh ON sh.id = s.shop_id
                     WHERE sh.slug = $1 AND sh.status = 'active' AND s.endpoint = $2
                 ) AS subscribed`,
                [req.params.slug, endpoint]
            );
            return res.json({ data: { subscribed: rows[0].subscribed } });
        } catch (error) {
            return next(error);
        }
    });

    app.delete('/api/v1/shops/:slug/push-subscriptions', pushSubscriptionLimit, async (req, res, next) => {
        if (!shopSlugPattern.test(req.params.slug)) {
            return res.status(404).json({ error: 'Shop not found.' });
        }
        const endpoint = req.body?.endpoint;
        if (typeof endpoint !== 'string' || endpoint.length > 2048) {
            return res.status(400).json({ error: 'A valid subscription endpoint is required.' });
        }
        try {
            const deleted = await pool.query(
                `DELETE FROM shop_push_subscriptions s USING shops sh
                 WHERE s.shop_id = sh.id AND sh.slug = $1 AND sh.status = 'active' AND s.endpoint = $2
                 RETURNING s.id`,
                [req.params.slug, endpoint]
            );
            return res.json({ data: { unsubscribed: deleted.rowCount > 0 } });
        } catch (error) {
            return next(error);
        }
    });
}

async function sendOfferPush(pool, shopId, offer, enabled) {
    if (!enabled) return 0;
    const { rows } = await pool.query(
        `SELECT s.id, s.subscription, sh.slug
         FROM shop_push_subscriptions s JOIN shops sh ON sh.id = s.shop_id
         WHERE s.shop_id = $1 AND sh.status = 'active'`,
        [shopId]
    );
    if (!rows.length) return 0;
    const payload = JSON.stringify({
        title: offer.title,
        body: offer.message,
        url: `/?shop=${encodeURIComponent(rows[0]?.slug ?? 'main')}`,
        tag: `shop-offer-${offer.id}`
    });
    const results = await Promise.allSettled(rows.map(({ subscription }) =>
        webpush.sendNotification(subscription, payload, { TTL: 3600 })
    ));
    const expiredIds = [];
    let failed = 0;
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        const statusCode = result.reason?.statusCode;
        if (statusCode === 404 || statusCode === 410) expiredIds.push(rows[index].id);
        else failed += 1;
    });
    if (expiredIds.length) {
        await pool.query('DELETE FROM shop_push_subscriptions WHERE id = ANY($1::BIGINT[])', [expiredIds]);
    }
    if (failed) console.error(`Could not deliver ${failed} offer notification(s) for shop ${shopId}.`);
    return results.filter((result) => result.status === 'fulfilled').length;
}
