import { createHash } from 'node:crypto';
import { ADMIN_MIGRATIONS } from './adminMigrations.js';

const expectedDatabase = 'shopademia_browser_preview';
const expectedRole = 'shopademia_browser_preview';
const readOnlyPreviewExactPaths = new Set([
    '/',
    '/shops',
    '/top-selling',
    '/deals',
    '/about',
    '/privacy',
    '/terms',
    '/service-worker.js',
    '/robots.txt',
    '/sitemap.xml',
    '/404',
    '/healthz',
    '/api/v1/products',
    '/api/v1/products/hero-offer',
    '/api/v1/categories',
    '/api/v1/shops',
    '/api/v1/storefront-config',
    '/api/v1/storefront-announcement',
    '/api/v1/discounted-products',
    '/api/v1/top-selling'
]);
const expectedColumns = [
    ['shops', 'id'], ['shops', 'slug'], ['shops', 'status'],
    ['admin_users', 'id'], ['admin_users', 'email'], ['admin_users', 'session_version'],
    ['admin_users', 'mfa_enabled'], ['admin_users', 'mfa_secret'], ['admin_users', 'last_mfa_counter'],
    ['admin_sessions', 'token_id'], ['admin_sessions', 'expires_at'], ['admin_sessions', 'revoked_at'],
    ['admin_sessions', 'user_id'], ['admin_sessions', 'shop_id'],
    ['platform_admins', 'user_id'],
    ['shop_memberships', 'user_id'], ['shop_memberships', 'shop_id'], ['shop_memberships', 'role'],
    ['managed_products', 'id'], ['managed_products', 'name'], ['managed_products', 'description'],
    ['managed_products', 'image_alt'], ['managed_products', 'seo_title'], ['managed_products', 'meta_description'],
    ['managed_products', 'price'], ['managed_products', 'old_price'], ['managed_products', 'category'],
    ['managed_products', 'image'], ['managed_products', 'images'], ['managed_products', 'stock_quantity'],
    ['managed_products', 'is_available'], ['managed_products', 'shop_id'], ['managed_products', 'created_at'],
    ['orders', 'id'], ['orders', 'order_number'], ['orders', 'customer_name'], ['orders', 'phone'],
    ['orders', 'address'], ['orders', 'bkash_number'], ['orders', 'items'], ['orders', 'subtotal'],
    ['orders', 'advance_amount'], ['orders', 'due_amount'], ['orders', 'status'],
    ['orders', 'advance_payment_status'], ['orders', 'advance_payment_checked_at'],
    ['orders', 'advance_payment_checked_by'], ['orders', 'created_at'], ['orders', 'updated_at'],
    ['orders', 'shop_id']
];

const requiredMigrationChecksums = new Map([
    ['000_legacy_baseline', createHash('sha256').update('shopademia-legacy-schema-baseline-v1').digest('hex')],
    ...ADMIN_MIGRATIONS.map(({ version, sql }) => [version, createHash('sha256').update(sql).digest('hex')])
]);

export function resolveReadOnlyPreviewMode(value) {
    if (value === undefined) return false;
    if (value === '1') return true;
    throw new Error('SHOPADEMIA_READ_ONLY_PREVIEW must be unset or exactly 1.');
}

export function validateReadOnlyPreviewConfig({ nodeEnv, host, port, databaseUrl, databaseSsl, trustProxyHops }) {
    let parsed;
    try {
        parsed = new URL(databaseUrl);
        if (decodeURIComponent(parsed.username) !== expectedRole) throw new Error();
    } catch {
        throw new Error('Read-only preview mode requires the verified isolated PostgreSQL target.');
    }
    if (nodeEnv !== 'development' || host !== '127.0.0.1' || port !== 3002
        || !['postgres:', 'postgresql:'].includes(parsed.protocol)
        || parsed.hostname !== '127.0.0.1' || parsed.port !== '55441'
        || parsed.pathname !== `/${expectedDatabase}` || databaseSsl
        || trustProxyHops !== 0) {
        throw new Error('Read-only preview mode requires the verified isolated PostgreSQL target and loopback-only app binding.');
    }
}

export async function verifyReadOnlyPreviewDatabase(pool) {
    const { rows: [identity] } = await pool.query(`
        SELECT current_database() AS database_name,
               current_user AS role_name,
               host(inet_server_addr()) AS server_address,
               inet_server_port() AS server_port,
               current_setting('default_transaction_read_only') AS read_only,
               (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser
    `);
    if (identity?.database_name !== expectedDatabase || identity?.role_name !== expectedRole
        || identity?.server_address !== '127.0.0.1' || Number(identity?.server_port) !== 55441
        || !['on', 'true', '1'].includes(identity?.read_only)
        || identity?.is_superuser !== false) {
        throw new Error('Read-only preview mode could not verify the isolated, read-only PostgreSQL target.');
    }

    const requiredVersions = [...requiredMigrationChecksums.keys()];
    const { rows: migrations } = await pool.query(
        'SELECT version, checksum FROM schema_migrations WHERE version = ANY($1::text[])',
        [requiredVersions]
    );
    const migrationChecksums = new Map(migrations.map(({ version, checksum }) => [version, checksum]));
    if (requiredVersions.some((version) => migrationChecksums.get(version) !== requiredMigrationChecksums.get(version))) {
        throw new Error('Read-only preview mode requires the verified application schema migrations.');
    }

    const tableNames = expectedColumns.map(([table]) => table);
    const columnNames = expectedColumns.map(([, column]) => column);
    const { rows: foundColumns } = await pool.query(`
        WITH required(table_name, column_name) AS (
            SELECT * FROM unnest($1::text[], $2::text[])
        )
        SELECT required.table_name, required.column_name
        FROM required
        LEFT JOIN information_schema.columns actual
          ON actual.table_schema = current_schema()
         AND actual.table_name = required.table_name
         AND actual.column_name = required.column_name
        WHERE actual.column_name IS NULL
    `, [tableNames, columnNames]);
    if (foundColumns.length) {
        throw new Error('Read-only preview mode requires the compatible admin API schema.');
    }
}

export function isReadOnlyPreviewRequest(method, path) {
    if (!['GET', 'HEAD'].includes(method)) return false;
    return readOnlyPreviewExactPaths.has(path)
        || /^\/(?:product|category)\/[^/]+$/.test(path)
        || /^\/shops\/[a-z0-9][a-z0-9-]{1,47}$/.test(path)
        || /^\/api\/v1\/(?:public\/)?shops\/[a-z0-9][a-z0-9-]{1,47}(?:\/(?:products(?:\/hero-offer)?|categories|config|offers))?$/.test(path)
        || /^\/(?:css|js|public-assets|uploads)\/[^/]+(?:\/[^/]+)*$/.test(path);
}
