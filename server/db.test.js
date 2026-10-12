import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase } from './db.js';

test('admin session columns are migrated before platform-admin session cleanup', async () => {
    const queries = [];
    const client = {
        async query(sql) {
            queries.push(sql);
            return { rows: [] };
        },
        release() {}
    };
    const pool = {
        async query(sql) {
            queries.push(sql);
            return { rows: [] };
        },
        async connect() { return client; }
    };

    await initializeDatabase(pool, {
        email: 'admin@example.com',
        password: 'a-secure-test-password',
        advanceCharge: 100
    });

    const userIdMigration = queries.findIndex((sql) => sql.includes('ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id'));
    const shopIdMigration = queries.findIndex((sql) => sql.includes('ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS shop_id'));
    const membershipCleanup = queries.findIndex((sql) => sql.includes('DELETE FROM shop_memberships'));
    const sessionCleanup = queries.findIndex((sql) => sql.includes('UPDATE admin_sessions SET revoked_at'));
    const schemaBaseline = queries.findIndex((sql) => sql.includes('000_legacy_baseline'));
    const migrationLock = queries.findIndex((sql) => sql.includes('pg_advisory_lock'));

    assert.ok(userIdMigration >= 0);
    assert.ok(shopIdMigration >= 0);
    assert.ok(userIdMigration < membershipCleanup);
    assert.ok(shopIdMigration < sessionCleanup);
    assert.ok(schemaBaseline >= 0);
    assert.ok(migrationLock > schemaBaseline);
});
