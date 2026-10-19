import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyMigrations } from './migrations.js';
import { ADMIN_MIGRATIONS } from './adminMigrations.js';

function migrationPool(existing = []) {
    const queries = [];
    const records = new Map(existing.map((row) => [row.version, row.checksum]));
    const client = {
        async query(sql, params = []) {
            queries.push({ sql, params });
            if (sql.startsWith('SELECT checksum FROM schema_migrations')) {
                const checksum = records.get(params[0]);
                return { rows: checksum ? [{ checksum }] : [] };
            }
            if (sql.startsWith('INSERT INTO schema_migrations')) {
                records.set(params[0], params[1]);
            }
            return { rows: [] };
        },
        release() {
            queries.push({ sql: 'RELEASE' });
        }
    };
    return {
        queries,
        records,
        pool: { async connect() { return client; } }
    };
}

test('schema migrations are applied once under an advisory lock and checksum recorded', async () => {
    const { pool, queries, records } = migrationPool();
    const sql = 'CREATE TABLE test_table (id integer PRIMARY KEY)';
    await applyMigrations(pool, [{ version: '001_create_test_table', sql }]);

    assert.equal(records.get('001_create_test_table'), createHash('sha256').update(sql).digest('hex'));
    assert.ok(queries.some(({ sql: query }) => query.includes('pg_advisory_lock')));
    assert.ok(queries.some(({ sql: query }) => query === 'COMMIT'));
    assert.ok(queries.some(({ sql: query }) => query.includes('pg_advisory_unlock')));
    assert.equal(queries.filter(({ sql: query }) => query === sql).length, 1);
});

test('applied migrations are skipped only when their checksum is unchanged', async () => {
    const sql = 'CREATE TABLE test_table (id integer PRIMARY KEY)';
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { pool, queries } = migrationPool([{ version: '001_create_test_table', checksum }]);
    await applyMigrations(pool, [{ version: '001_create_test_table', sql }]);
    assert.equal(queries.filter(({ sql: query }) => query === sql).length, 0);

    await assert.rejects(
        applyMigrations(pool, [{ version: '001_create_test_table', sql: `${sql} ` }]),
        /has changed/
    );
});

test('invalid or unordered migrations are rejected before opening a database connection', async () => {
    let connected = false;
    const pool = { async connect() { connected = true; throw new Error('unexpected connection'); } };
    await assert.rejects(
        applyMigrations(pool, [
            { version: '002_second', sql: 'SELECT 2' },
            { version: '001_first', sql: 'SELECT 1' }
        ]),
        /unique, ordered version identifiers/
    );
    assert.equal(connected, false);
});

test('external product image links can be reused by multiple catalog items', () => {
    const migration = ADMIN_MIGRATIONS.find(({ version }) => version === '002_reusable_product_image_links');
    assert.ok(migration);
    assert.match(migration.sql, /DROP CONSTRAINT IF EXISTS managed_products_image_key/);
});

test('inventory adjustment history is idempotent and append-only at the database boundary', () => {
    const migration = ADMIN_MIGRATIONS.find(({ version }) => version === '003_inventory_adjustment_history');
    assert.ok(migration);
    assert.match(migration.sql, /UNIQUE \(shop_id, idempotency_key\)/);
    assert.match(migration.sql, /CHECK \(new_quantity = previous_quantity \+ delta\)/);
    assert.match(migration.sql, /BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_adjustments/);
    assert.match(migration.sql, /inventory adjustment history is append-only/);
});

test('product lifecycle migration adds archive state and durable scoped create idempotency', () => {
    const migration = ADMIN_MIGRATIONS.find(({ version }) => version === '004_product_archiving_and_create_idempotency');
    assert.ok(migration);
    assert.match(migration.sql, /ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(migration.sql, /PRIMARY KEY \(shop_id, admin_user_id, idempotency_key\)/);
    assert.match(migration.sql, /request_fingerprint CHAR\(64\)/);
    assert.match(migration.sql, /product_id TEXT NOT NULL REFERENCES managed_products\(id\) ON DELETE RESTRICT/);
});

test('category metadata migration supports bounded descriptions', () => {
    const migration = ADMIN_MIGRATIONS.find(({ version }) => version === '005_category_descriptions');
    assert.ok(migration);
    assert.match(migration.sql, /ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''/);
    assert.match(migration.sql, /char_length\(description\) <= 240/);
});
