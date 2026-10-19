export const ADMIN_MIGRATIONS = [
    {
        version: '001_admin_foundations',
        sql: `
            CREATE TABLE admin_roles (
                role_key TEXT PRIMARY KEY CHECK (role_key ~ '^[a-z][a-z0-9_]{1,47}$'),
                display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
                mapping_status TEXT NOT NULL CHECK (mapping_status IN ('verified', 'unresolved')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE admin_permissions (
                permission_key TEXT PRIMARY KEY CHECK (permission_key ~ '^[a-z][a-z0-9_.]{1,95}$'),
                description TEXT NOT NULL CHECK (char_length(description) BETWEEN 2 AND 240),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE admin_role_permissions (
                role_key TEXT NOT NULL REFERENCES admin_roles(role_key) ON DELETE RESTRICT,
                permission_key TEXT NOT NULL REFERENCES admin_permissions(permission_key) ON DELETE RESTRICT,
                granted BOOLEAN NOT NULL DEFAULT FALSE,
                PRIMARY KEY (role_key, permission_key)
            );

            CREATE TABLE admin_settings (
                setting_group TEXT NOT NULL CHECK (setting_group ~ '^[a-z][a-z0-9_-]{1,47}$'),
                setting_key TEXT NOT NULL CHECK (setting_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
                value JSONB NOT NULL,
                is_secret BOOLEAN NOT NULL DEFAULT FALSE,
                updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (setting_group, setting_key)
            );

            CREATE TABLE admin_audit_log (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                admin_user_id UUID,
                actor_email TEXT NOT NULL CHECK (char_length(actor_email) <= 254),
                action TEXT NOT NULL CHECK (char_length(action) BETWEEN 2 AND 120),
                entity TEXT NOT NULL CHECK (char_length(entity) BETWEEN 2 AND 120),
                entity_id TEXT CHECK (entity_id IS NULL OR char_length(entity_id) <= 160),
                before_data JSONB,
                after_data JSONB,
                ip INET,
                user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
                request_id UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC, id DESC);
            CREATE INDEX admin_audit_log_entity_idx ON admin_audit_log (entity, entity_id, created_at DESC);

            CREATE FUNCTION reject_admin_audit_mutation() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'admin audit records are append-only';
            END;
            $$;

            CREATE TRIGGER admin_audit_log_append_only
            BEFORE UPDATE OR DELETE ON admin_audit_log
            FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_mutation();

            INSERT INTO admin_roles (role_key, display_name, mapping_status) VALUES
                ('super_admin', 'Super Admin', 'verified'),
                ('manager', 'Manager', 'unresolved'),
                ('order_processor', 'Order Processor', 'unresolved'),
                ('accountant', 'Accountant', 'unresolved'),
                ('content_editor', 'Content Editor', 'unresolved'),
                ('support', 'Support', 'unresolved')
            ON CONFLICT (role_key) DO NOTHING;

            INSERT INTO admin_permissions (permission_key, description) VALUES
                ('settings.read', 'View configured administrative settings.'),
                ('settings.write', 'Create or update administrative settings.'),
                ('audit.read', 'View append-only administrative audit events.'),
                ('permissions.read', 'View role and action-permission assignments.'),
                ('users.manage', 'Create, edit, deactivate, and assign administrative users.'),
                ('secrets.read', 'Read decrypted secret settings.'),
                ('secrets.write', 'Create or rotate encrypted secret settings.')
            ON CONFLICT (permission_key) DO NOTHING;

            INSERT INTO admin_role_permissions (role_key, permission_key, granted)
            VALUES
                ('super_admin', 'settings.read', TRUE),
                ('super_admin', 'settings.write', TRUE),
                ('super_admin', 'audit.read', TRUE),
                ('super_admin', 'permissions.read', TRUE),
                ('super_admin', 'secrets.write', TRUE)
            ON CONFLICT (role_key, permission_key) DO NOTHING;
        `
    },
    {
        version: '002_reusable_product_image_links',
        sql: `ALTER TABLE managed_products DROP CONSTRAINT IF EXISTS managed_products_image_key;`
    },
    {
        version: '003_inventory_adjustment_history',
        sql: `
            CREATE TABLE inventory_adjustments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
                product_id TEXT NOT NULL,
                actor_user_id UUID NOT NULL,
                actor_email TEXT NOT NULL CHECK (char_length(actor_email) BETWEEN 3 AND 254),
                idempotency_key UUID NOT NULL,
                request_id UUID NOT NULL,
                delta INTEGER NOT NULL CHECK (delta <> 0),
                previous_quantity BIGINT NOT NULL CHECK (previous_quantity >= 0),
                new_quantity BIGINT NOT NULL CHECK (new_quantity >= 0),
                reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 500),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (shop_id, idempotency_key),
                CHECK (new_quantity = previous_quantity + delta)
            );

            CREATE INDEX inventory_adjustments_shop_product_created_at_idx
                ON inventory_adjustments (shop_id, product_id, created_at DESC);

            CREATE FUNCTION reject_inventory_adjustment_mutation() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'inventory adjustment history is append-only';
            END;
            $$;

            CREATE TRIGGER inventory_adjustments_append_only
            BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_adjustments
            FOR EACH STATEMENT EXECUTE FUNCTION reject_inventory_adjustment_mutation();
        `
    },
    {
        version: '004_product_archiving_and_create_idempotency',
        sql: `
            ALTER TABLE managed_products
                ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

            CREATE INDEX IF NOT EXISTS managed_products_shop_archived_created_idx
                ON managed_products (shop_id, is_archived, created_at DESC, id DESC);

            CREATE TABLE admin_product_creation_requests (
                shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
                admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
                idempotency_key UUID NOT NULL,
                request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
                product_id TEXT NOT NULL REFERENCES managed_products(id) ON DELETE RESTRICT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (shop_id, admin_user_id, idempotency_key)
            );
        `
    },
    {
        version: '005_category_descriptions',
        sql: `ALTER TABLE shop_product_categories ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 240);`
    }
];
