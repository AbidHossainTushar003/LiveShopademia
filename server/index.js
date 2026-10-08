import 'dotenv/config';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { loadFakeStoreCatalog, setManagedProducts } from './catalog.js';
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
        databaseUrl: required('DATABASE_URL'),
        databaseSsl: String(process.env.DATABASE_SSL || '').toLowerCase() === 'true' || String(process.env.DATABASE_SSL || '').toLowerCase() === '1',
        adminEmail: required('ADMIN_EMAIL'),
        adminPassword: required('ADMIN_PASSWORD', 12),
        jwtSecret: required('JWT_SECRET', 32),
        advanceCharge: Number(process.env.DELIVERY_ADVANCE_CHARGE || 100),
        demoUsdToBdt: Number(process.env.DEMO_USD_TO_BDT || 120)
    };
    if (!['development', 'production', 'test'].includes(config.nodeEnv)) throw new Error('NODE_ENV must be one of development, production, or test.');
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT must be a valid TCP port.');
    if (!Number.isInteger(config.trustProxyHops) || config.trustProxyHops < 0 || config.trustProxyHops > 10) {
        throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
    }
    if (!Number.isSafeInteger(config.advanceCharge) || config.advanceCharge < 0) throw new Error('DELIVERY_ADVANCE_CHARGE must be a non-negative integer.');
    if (!Number.isSafeInteger(config.demoUsdToBdt) || config.demoUsdToBdt < 1 || config.demoUsdToBdt > 10000) {
        throw new Error('DEMO_USD_TO_BDT must be an integer between 1 and 10000.');
    }
    if (/replace-with|change-this/i.test(config.jwtSecret) || /replace-with|change-this/i.test(config.adminPassword)) {
        throw new Error('Replace example admin credentials and JWT secret in .env before starting the server.');
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
    pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));
    try {
        const count = await loadFakeStoreCatalog({
            url: process.env.FAKE_STORE_API_URL || 'https://fakestoreapi.com/products',
            usdToBdt: config.demoUsdToBdt
        });
        console.info(`Loaded ${count} demo products from Fake Store API at ৳${config.demoUsdToBdt}/USD.`);
    } catch (error) {
        console.error(`Could not load Fake Store API demo catalog: ${error.message}. Using built-in demo products.`);
    }
    await initializeDatabase(pool, { email: config.adminEmail, password: config.adminPassword });
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
    console.error('Shopademia server failed to start:', error.message);
    process.exitCode = 1;
});
