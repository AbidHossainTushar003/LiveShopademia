import { hashAdminPassword } from './adminPassword.js';

export async function initializeDatabase(pool, admin) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_number TEXT NOT NULL UNIQUE,
            event_id TEXT NOT NULL UNIQUE,
            request_hash TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            bkash_number TEXT NOT NULL,
            items JSONB NOT NULL,
            subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
            advance_amount BIGINT NOT NULL CHECK (advance_amount >= 0),
            due_amount BIGINT NOT NULL CHECK (due_amount >= 0),
            status TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_hash TEXT');
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_reserved BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS advance_payment_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (advance_payment_status IN ('pending', 'verified', 'rejected')),
        ADD COLUMN IF NOT EXISTS advance_payment_checked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS advance_payment_checked_by TEXT
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS orders_status_created_at_idx ON orders (status, created_at DESC)');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_credentials (
            id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            session_version BIGINT NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_id TEXT PRIMARY KEY,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at)');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_order_events (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            actor_email TEXT NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('status_changed', 'advance_payment_reviewed')),
            previous_value TEXT NOT NULL,
            new_value TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS admin_order_events_order_id_created_at_idx ON admin_order_events (order_id, created_at DESC)');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS managed_products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
            description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
            price BIGINT NOT NULL CHECK (price > 0),
            old_price BIGINT CHECK (old_price IS NULL OR old_price > price),
            category TEXT NOT NULL CHECK (category IN ('gadgets', 'accessories', 'clothing', 'more')),
            image TEXT NOT NULL UNIQUE,
            stock_quantity BIGINT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS stock_quantity BIGINT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE');
    await pool.query('CREATE INDEX IF NOT EXISTS managed_products_created_at_idx ON managed_products (created_at DESC)');
    const passwordHash = await hashAdminPassword(admin.password);
    await pool.query(
        `INSERT INTO admin_credentials (id, email, password_hash)
         VALUES (TRUE, $1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [admin.email.trim().toLowerCase(), passwordHash]
    );
}

export async function loadManagedProducts(pool) {
    const { rows } = await pool.query(
        `SELECT id, name, description, price, old_price AS "oldPrice",
                category, image, stock_quantity AS "stockQuantity", is_available AS "isAvailable",
                created_at AS "createdAt"
         FROM managed_products
         ORDER BY created_at DESC, id DESC`
    );
    return rows;
}
