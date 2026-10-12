import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { setManagedProducts } from './catalog.js';
import { initializeDatabase, loadManagedProducts } from './db.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function required(name, minimumLength = 1) {
    const value = process.env[name]?.trim();
    if (!value || value.length < minimumLength) throw new Error(`${name} must be set and contain at least ${minimumLength} characters.`);
    return value;
}

async function start() {
    const config = {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT || 3000),
        trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
        siteUrl: process.env.PUBLIC_SITE_URL?.trim() || null,
        databaseUrl: required('DATABASE_URL'),
        databaseSsl: String(process.env.DATABASE_SSL || '').toLowerCase() === 'true' || String(process.env.DATABASE_SSL || '').toLowerCase() === '1',
        jwtSecret: required('JWT_SECRET', 32),
        advanceCharge: Number(process.env.DELIVERY_ADVANCE_CHARGE || 100),
        vapidPublicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null,
        vapidPrivateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || null,
        vapidSubject: process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || null
    };
    const mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY?.trim() || '';
    if (config.nodeEnv === 'production' && !mfaEncryptionKey) {
        throw new Error('MFA_ENCRYPTION_KEY must be set in production to protect platform-admin authenticator secrets.');
    }
    if (mfaEncryptionKey && !/^[0-9a-f]{64}$/i.test(mfaEncryptionKey)) {
        throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
    }
    config.mfaEncryptionKey = mfaEncryptionKey
        ? Buffer.from(mfaEncryptionKey, 'hex')
        : createHash('sha256').update(`shopademia-mfa-encryption\0${config.jwtSecret}`).digest();
    if (!['development', 'production', 'test'].includes(config.nodeEnv)) throw new Error('NODE_ENV must be one of development, production, or test.');
    if (config.siteUrl) {
        const siteUrl = new URL(config.siteUrl);
        if (!['http:', 'https:'].includes(siteUrl.protocol) || siteUrl.origin !== config.siteUrl.replace(/\/+$/, '')) {
            throw new Error('PUBLIC_SITE_URL must be an absolute HTTP(S) origin without a path, query, or fragment.');
        }
        config.siteUrl = siteUrl.origin;
    } else if (config.nodeEnv === 'production') {
        throw new Error('PUBLIC_SITE_URL must be set in production for canonical URLs and the sitemap.');
    }
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT must be a valid TCP port.');
    if (!Number.isInteger(config.trustProxyHops) || config.trustProxyHops < 0 || config.trustProxyHops > 10) {
        throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
    }
    if (!Number.isSafeInteger(config.advanceCharge) || config.advanceCharge < 0) throw new Error('DELIVERY_ADVANCE_CHARGE must be a non-negative integer.');
    if (Boolean(config.vapidPublicKey) !== Boolean(config.vapidPrivateKey)
        || (config.vapidPublicKey && !config.vapidSubject)) {
        throw new Error('Set WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT together to enable offer notifications.');
    }
    if (/replace-with|change-this/i.test(config.jwtSecret)) {
        throw new Error('Replace the example JWT secret in .env before starting the server.');
    }
    const uploadsDir = join(root, 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const poolConfig = {
        connectionString: config.databaseUrl,
        max: 10,
        connectionTimeoutMillis: 5000,
        statement_timeout: 15000,
        idleTimeoutMillis: 30000,
        ...(config.databaseSsl ? { ssl: { rejectUnauthorized: true } } : {})
    };
    const pool = new Pool(poolConfig);
    pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', {
        name: error.name || 'Error',
        code: typeof error.code === 'string' ? error.code : undefined
    }));
    if (config.nodeEnv !== 'production') {
        const adminEmail = required('ADMIN_EMAIL');
        const adminPassword = required('ADMIN_PASSWORD', 12);
        await initializeDatabase(pool, {
            email: adminEmail,
            password: adminPassword,
            advanceCharge: config.advanceCharge
        });
    }
    const managedProducts = await loadManagedProducts(pool);
    setManagedProducts(managedProducts);
    console.info(`Loaded ${managedProducts.length} admin-managed products.`);

    const app = createApp({ pool, config: { ...config, uploadsDir } });
    const server = createServer(app);
    server.listen(config.port, () => console.info(`Shopademia listening on http://localhost:${config.port}`));

    const shutdown = () => server.close(async () => {
        await pool.end();
        process.exit(0);
    });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch((error) => {
    console.error('Shopademia server failed to start:', {
        name: error.name || 'Error',
        code: typeof error.code === 'string' ? error.code : undefined
    });
    process.exitCode = 1;
});
