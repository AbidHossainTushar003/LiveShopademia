import { createHash } from 'node:crypto';

const migrationVersionPattern = /^\d{3}_[a-z0-9_]+$/;
const advisoryLockKey = 741029;

function migrationChecksum(sql) {
    return createHash('sha256').update(sql).digest('hex');
}

export async function applyMigrations(pool, migrations) {
    if (!Array.isArray(migrations)) throw new TypeError('Migrations must be an array.');
    const seen = new Set();
    let previousVersion = '';
    for (const migration of migrations) {
        if (!migration || !migrationVersionPattern.test(migration.version)
            || migration.version === '000_legacy_baseline'
            || typeof migration.sql !== 'string' || !migration.sql.trim()
            || seen.has(migration.version) || migration.version <= previousVersion) {
            throw new Error('Migrations must have unique, ordered version identifiers and non-empty SQL.');
        }
        seen.add(migration.version);
        previousVersion = migration.version;
    }

    const client = await pool.connect();
    let lockAcquired = false;
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY CHECK (version ~ '^[0-9]{3}_[a-z0-9_]+$'),
                checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await client.query('SELECT pg_advisory_lock($1)', [advisoryLockKey]);
        lockAcquired = true;

        for (const migration of migrations) {
            const checksum = migrationChecksum(migration.sql);
            const existing = await client.query(
                'SELECT checksum FROM schema_migrations WHERE version = $1',
                [migration.version]
            );
            if (existing.rows[0]) {
                if (existing.rows[0].checksum !== checksum) {
                    throw new Error(`Applied migration ${migration.version} has changed; add a new migration instead.`);
                }
                continue;
            }

            await client.query('BEGIN');
            try {
                await client.query(migration.sql);
                await client.query(
                    'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
                    [migration.version, checksum]
                );
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK').catch((rollbackError) => {
                    console.error('Could not roll back schema migration:', {
                        name: rollbackError.name || 'Error',
                        code: typeof rollbackError.code === 'string' ? rollbackError.code : undefined
                    });
                });
                throw error;
            }
        }
    } finally {
        try {
            if (lockAcquired) await client.query('SELECT pg_advisory_unlock($1)', [advisoryLockKey]);
        } finally {
            client.release();
        }
    }
}
