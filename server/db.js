import { hashAdminPassword } from './adminPassword.js';

export async function initializeDatabase(pool, admin) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            order_number TEXT NOT NULL UNIQUE,
            event_id TEXT NOT NULL,
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
            image_alt TEXT NOT NULL DEFAULT '' CHECK (char_length(image_alt) <= 250),
            seo_title TEXT NOT NULL DEFAULT '' CHECK (char_length(seo_title) <= 70),
            meta_description TEXT NOT NULL DEFAULT '' CHECK (char_length(meta_description) <= 160),
            price BIGINT NOT NULL CHECK (price > 0),
            old_price BIGINT CHECK (old_price IS NULL OR old_price > price),
            category TEXT NOT NULL DEFAULT 'uncategorized',
            image TEXT NOT NULL UNIQUE,
            images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            stock_quantity BIGINT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('ALTER TABLE managed_products DROP CONSTRAINT IF EXISTS managed_products_category_check');
    await pool.query("ALTER TABLE managed_products ALTER COLUMN category SET DEFAULT 'uncategorized'");
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS stock_quantity BIGINT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT \'\' CHECK (char_length(image_alt) <= 250)');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT \'\' CHECK (char_length(seo_title) <= 70)');
    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT \'\' CHECK (char_length(meta_description) <= 160)');
    await pool.query('CREATE INDEX IF NOT EXISTS managed_products_created_at_idx ON managed_products (created_at DESC)');
    const passwordHash = await hashAdminPassword(admin.password);
    await pool.query(
        `INSERT INTO admin_credentials (id, email, password_hash)
         VALUES (TRUE, $1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [admin.email.trim().toLowerCase(), passwordHash]
    );
    await initializeShopPlatform(pool, admin);
}

async function initializeShopPlatform(pool, admin) {
    const defaultShopId = '00000000-0000-4000-8000-000000000001';
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
            name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
            description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
            location TEXT NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
            contact_email TEXT NOT NULL DEFAULT '' CHECK (char_length(contact_email) <= 254),
            contact_phone TEXT NOT NULL DEFAULT '' CHECK (char_length(contact_phone) <= 40),
            contact_whatsapp TEXT NOT NULL DEFAULT '' CHECK (char_length(contact_whatsapp) <= 40),
            logo_image TEXT,
            hero_image TEXT,
            banner_image TEXT,
            advance_charge BIGINT NOT NULL DEFAULT 100 CHECK (advance_charge >= 0),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
            status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT NOT NULL DEFAULT ''");
    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_image TEXT');
    await pool.query("ALTER TABLE shops ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    await pool.query('ALTER TABLE shops ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    await pool.query(`
        DO $$ BEGIN
            ALTER TABLE shops ADD CONSTRAINT shops_status_check
                CHECK (status IN ('active', 'suspended', 'archived'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            session_version BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_secret TEXT');
    await pool.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_mfa_counter BIGINT NOT NULL DEFAULT -1');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_memberships (
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (shop_id, user_id)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS platform_admins (
            user_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        INSERT INTO shops (id, slug, name, advance_charge)
        VALUES ($1, 'main', 'Main Shop', $2)
        ON CONFLICT (id) DO NOTHING
    `, [defaultShopId, Number.isSafeInteger(admin.advanceCharge) ? admin.advanceCharge : 100]);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_product_categories (
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            id TEXT NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
            name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
            icon TEXT NOT NULL DEFAULT 'fa-box' CHECK (icon ~ '^fa-[a-z0-9-]{1,48}$'),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (shop_id, id)
        )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS shop_product_categories_active_name_idx
        ON shop_product_categories (shop_id, lower(name)) WHERE is_active = TRUE`);
    await pool.query(`
        INSERT INTO shop_product_categories (shop_id, id, name, icon, is_default)
        SELECT s.id, defaults.id, defaults.name, defaults.icon, TRUE
        FROM shops s
        CROSS JOIN (VALUES
            ('gadgets', 'Electronics', 'fa-laptop'),
            ('accessories', 'Jewelry & Accessories', 'fa-gem'),
            ('clothing', 'Clothing', 'fa-shirt'),
            ('more', 'Other', 'fa-box')
        ) AS defaults(id, name, icon)
        ON CONFLICT (shop_id, id) DO NOTHING
    `);
    await pool.query(`
        INSERT INTO admin_users (email, password_hash)
        SELECT email, password_hash FROM admin_credentials WHERE id = TRUE
        ON CONFLICT (email) DO NOTHING
    `);
    await pool.query(`
        INSERT INTO platform_admins (user_id)
        SELECT u.id
        FROM admin_users u
        JOIN admin_credentials c ON c.email = u.email
        WHERE c.id = TRUE
        ON CONFLICT (user_id) DO NOTHING
    `);
    await pool.query('ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE');
    await pool.query('ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE CASCADE');
    await pool.query(`
        DELETE FROM shop_memberships
        WHERE user_id IN (SELECT user_id FROM platform_admins)
    `);
    await pool.query(`
        UPDATE admin_sessions SET revoked_at = NOW()
        WHERE user_id IN (SELECT user_id FROM platform_admins) AND revoked_at IS NULL
    `);

    await pool.query('ALTER TABLE managed_products ADD COLUMN IF NOT EXISTS shop_id UUID');
    await pool.query('UPDATE managed_products SET shop_id = $1 WHERE shop_id IS NULL', [defaultShopId]);
    await pool.query('ALTER TABLE managed_products ALTER COLUMN shop_id SET NOT NULL');
    await pool.query(`
        DO $$ BEGIN
            ALTER TABLE managed_products ADD CONSTRAINT managed_products_shop_id_fkey
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS managed_products_shop_created_idx ON managed_products (shop_id, created_at DESC)');

    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id UUID');
    await pool.query('UPDATE orders SET shop_id = $1 WHERE shop_id IS NULL', [defaultShopId]);
    await pool.query('ALTER TABLE orders ALTER COLUMN shop_id SET NOT NULL');
    await pool.query(`
        DO $$ BEGIN
            ALTER TABLE orders ADD CONSTRAINT orders_shop_id_fkey
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS orders_shop_created_idx ON orders (shop_id, created_at DESC, id DESC)');
    await pool.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_event_id_key');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS orders_shop_event_id_idx ON orders (shop_id, event_id)');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_transactions (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'expense', 'adjustment')),
            method TEXT NOT NULL CHECK (char_length(method) BETWEEN 2 AND 40),
            amount BIGINT NOT NULL CHECK (amount > 0),
            reference TEXT NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 160),
            status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected')),
            notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
            recorded_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS shop_transactions_shop_created_idx ON shop_transactions (shop_id, created_at DESC, id DESC)');
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS shop_transactions_shop_reference_idx
        ON shop_transactions (shop_id, lower(btrim(reference)))
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_offers (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
            message TEXT NOT NULL CHECK (char_length(message) BETWEEN 2 AND 1000),
            image TEXT,
            starts_at TIMESTAMPTZ,
            ends_at TIMESTAMPTZ,
            is_published BOOLEAN NOT NULL DEFAULT FALSE,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS shop_offers_public_idx ON shop_offers (shop_id, is_published, starts_at, ends_at)');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_hero_slides (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 4),
            image TEXT NOT NULL,
            headline TEXT NOT NULL CHECK (char_length(headline) BETWEEN 2 AND 120),
            body_text TEXT NOT NULL CHECK (char_length(body_text) BETWEEN 2 AND 500),
            button_text TEXT NOT NULL CHECK (char_length(button_text) BETWEEN 2 AND 40),
            target_url TEXT NOT NULL CHECK (char_length(target_url) BETWEEN 1 AND 2048),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (shop_id, position) DEFERRABLE INITIALLY DEFERRED
        )
    `);
    await pool.query('ALTER TABLE shop_hero_slides ADD COLUMN IF NOT EXISTS mobile_image TEXT');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_push_subscriptions (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL,
            subscription JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('ALTER TABLE shop_push_subscriptions DROP CONSTRAINT IF EXISTS shop_push_subscriptions_endpoint_key');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS shop_push_subscriptions_shop_endpoint_idx ON shop_push_subscriptions (shop_id, endpoint)');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_activity_logs (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            actor_email TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details JSONB NOT NULL DEFAULT '{}'::JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS shop_activity_logs_shop_created_idx ON shop_activity_logs (shop_id, created_at DESC, id DESC)');
}

export async function loadManagedProducts(pool) {
    const { rows } = await pool.query(
        `SELECT id, name, description, image_alt AS "imageAlt",
                seo_title AS "seoTitle", meta_description AS "metaDescription",
                price, old_price AS "oldPrice",
                category, image, images, stock_quantity AS "stockQuantity", is_available AS "isAvailable",
                shop_id AS "shopId", created_at AS "createdAt"
         FROM managed_products
         ORDER BY created_at DESC, id DESC`
    );
    return rows;
}

export async function loadShopCategories(pool) {
    const { rows } = await pool.query(
        `SELECT shop_id AS "shopId", id, name, icon, is_active AS active, is_default AS "isDefault"
         FROM shop_product_categories ORDER BY created_at, id`
    );
    return rows;
}
