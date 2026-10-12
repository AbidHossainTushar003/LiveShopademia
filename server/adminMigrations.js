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
    }
];
