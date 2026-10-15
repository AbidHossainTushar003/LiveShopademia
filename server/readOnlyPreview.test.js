import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ADMIN_MIGRATIONS } from './adminMigrations.js';
import {
    isReadOnlyPreviewRequest,
    resolveReadOnlyPreviewMode,
    validateReadOnlyPreviewConfig,
    verifyReadOnlyPreviewDatabase
} from './readOnlyPreview.js';

const validConfig = {
    nodeEnv: 'development',
    host: '127.0.0.1',
    port: 3002,
    databaseUrl: 'postgresql://shopademia_browser_preview:secret@127.0.0.1:55441/shopademia_browser_preview',
    databaseSsl: false,
    trustProxyHops: 0
};

test('read-only preview mode fails closed on ambiguous flag values', () => {
    assert.equal(resolveReadOnlyPreviewMode(undefined), false);
    assert.equal(resolveReadOnlyPreviewMode('1'), true);
    for (const value of ['', '0', 'true', 'yes']) {
        assert.throws(() => resolveReadOnlyPreviewMode(value), /must be unset or exactly 1/);
    }
});

test('read-only preview config is restricted to the verified loopback app and database', () => {
    assert.doesNotThrow(() => validateReadOnlyPreviewConfig(validConfig));
    for (const override of [
        { nodeEnv: 'production' },
        { host: '0.0.0.0' },
        { port: 3000 },
        { databaseUrl: validConfig.databaseUrl.replace('55441', '5432') },
        { databaseUrl: validConfig.databaseUrl.replace('shopademia_browser_preview:secret', 'other:secret') },
        { databaseUrl: validConfig.databaseUrl.replace('/shopademia_browser_preview', '/other') },
        { databaseSsl: true },
        { trustProxyHops: 1 }
    ]) {
        assert.throws(
            () => validateReadOnlyPreviewConfig({ ...validConfig, ...override }),
            /verified isolated PostgreSQL target|loopback-only app binding/
        );
    }
});

test('read-only preview admits only safe GET/HEAD API routes', () => {
    for (const [method, path] of [
        ['GET', '/healthz'],
        ['GET', '/'],
        ['HEAD', '/product/synthetic-product'],
        ['GET', '/category/gadgets'],
        ['GET', '/shops'],
        ['GET', '/top-selling'],
        ['GET', '/shops/main'],
        ['GET', '/service-worker.js'],
        ['GET', '/css/styles.css'],
        ['GET', '/js/main.js'],
        ['GET', '/public-assets/favicon.svg'],
        ['HEAD', '/api/v1/products'],
        ['HEAD', '/api/v1/shops/main/products'],
        ['HEAD', '/css/styles.css'],
        ['GET', '/api/v1/products/hero-offer'],
        ['GET', '/api/v1/categories'],
        ['GET', '/api/v1/shops'],
        ['GET', '/api/v1/shops/main'],
        ['GET', '/api/v1/shops/main/products'],
        ['GET', '/api/v1/shops/main/products/hero-offer'],
        ['GET', '/api/v1/shops/main/categories'],
        ['GET', '/api/v1/shops/main/config'],
        ['GET', '/api/v1/storefront-announcement'],
        ['GET', '/api/v1/discounted-products'],
        ['GET', '/api/v1/top-selling'],
        ['GET', '/api/v1/shops/main/offers'],
        ['GET', '/api/v1/public/shops/main/products']
    ]) assert.equal(isReadOnlyPreviewRequest(method, path), true);

    for (const [method, path] of [
        ['POST', '/api/v1/admin/login'],
        ['POST', '/api/v1/orders'],
        ['POST', '/api/v1/customer/order-lookup'],
        ['POST', '/api/v1/shops/main/push-subscriptions'],
        ['GET', '/api/v1/shops/main/push-subscriptions'],
        ['GET', '/api/v1/shops/main/push-key'],
        ['GET', '/api/v1/shops/main/push-key/extra'],
        ['GET', '/api/v1/shops/main/members'],
        ['HEAD', '/api/v1/admin/dashboard'],
        ['HEAD', '/api/v1/orders'],
        ['HEAD', '/api/v1/customer/order-lookup'],
        ['GET', '/find-order'],
        ['GET', '/api/v1/admin/dashboard'],
        ['GET', '/api/v1/admin/profile'],
        ['GET', '/api/v1/admin/products'],
        ['GET', '/api/v1/admin/products/synthetic-product'],
        ['GET', '/api/v1/admin/orders'],
        ['GET', '/api/v1/admin/orders/123'],
        ['GET', '/admin'],
        ['GET', '/admin-assets/admin.js'],
        ['PATCH', '/api/v1/admin/products/synthetic-product'],
        ['DELETE', '/api/v1/admin/products/synthetic-product'],
        ['GET', '/api/v1/admin/products/synthetic-product/upload'],
        ['GET', '/not-a-storefront-route']
    ]) assert.equal(isReadOnlyPreviewRequest(method, path), false);
});

test('read-only preview validates target identity, schema migrations, and required columns using SELECT only', async () => {
    const baselineChecksum = createHash('sha256')
        .update('shopademia-legacy-schema-baseline-v1')
        .digest('hex');
    const migrationRows = [
        { version: '000_legacy_baseline', checksum: baselineChecksum },
        ...ADMIN_MIGRATIONS.map(({ version, sql }) => ({
            version,
            checksum: createHash('sha256').update(sql).digest('hex')
        }))
    ];
    const statements = [];
    const pool = {
        async query(sql) {
            statements.push(sql);
            if (sql.includes('current_database()')) {
                return { rows: [{
                    database_name: 'shopademia_browser_preview',
                    role_name: 'shopademia_browser_preview',
                    server_address: '127.0.0.1',
                    server_port: 55441,
                    read_only: 'on',
                    is_superuser: false
                }] };
            }
            if (sql.includes('FROM schema_migrations')) return { rows: migrationRows };
            if (sql.includes('information_schema.columns')) return { rows: [] };
            throw new Error('Unexpected query in read-only schema verification.');
        }
    };

    await assert.doesNotReject(verifyReadOnlyPreviewDatabase(pool));
    assert.equal(statements.length, 3);
    assert.ok(statements.every((sql) => /^\s*(SELECT|WITH)\b/i.test(sql)));

    pool.query = async (sql) => {
        if (sql.includes('current_database()')) {
            return { rows: [{ database_name: 'wrong_database' }] };
        }
        throw new Error('Verification must stop after a mismatched target identity.');
    };
    await assert.rejects(verifyReadOnlyPreviewDatabase(pool), /could not verify the isolated, read-only PostgreSQL target/);
});
