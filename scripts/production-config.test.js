import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from './production-config.js';

function validConfig() {
    const alphabet = '0123456789abcdef';
    const secrets = Array.from({ length: 6 }, (_, seed) =>
        Array.from({ length: 64 }, (_value, index) => alphabet[(index + seed) % alphabet.length]).join('')
    );
    const [ownerPassword, appPassword, migrationPassword, adminPassword, jwtSecret, mfaKey] = secrets;
    return {
        STOREFRONT_DOMAIN: 'shopademia.store',
        ADMIN_DOMAIN: 'admin.shopademia.store',
        API_DOMAIN: 'api.shopademia.store',
        ADMIN_SITE_URL: 'https://admin.shopademia.store',
        SHOPADEMIA_RELEASE: 'a'.repeat(40),
        POSTGRES_DB: 'shopademia',
        POSTGRES_USER: 'shopademia_owner',
        POSTGRES_PASSWORD: ownerPassword,
        POSTGRES_APP_PASSWORD: appPassword,
        POSTGRES_MIGRATION_PASSWORD: migrationPassword,
        DATABASE_URL: `postgresql://shopademia_app:${appPassword}@database:5432/shopademia`,
        DATABASE_SSL: 'false',
        MIGRATION_DATABASE_URL: `postgresql://shopademia_migrator:${migrationPassword}@database:5432/shopademia`,
        ADMIN_EMAIL: 'operator@shopademia.store',
        ADMIN_PASSWORD: adminPassword,
        JWT_SECRET: jwtSecret,
        MFA_ENCRYPTION_KEY: mfaKey,
        BACKUP_AGE_RECIPIENT: `age1${'q'.repeat(58)}`,
        DELIVERY_ADVANCE_CHARGE: '100',
        WEB_PUSH_VAPID_PUBLIC_KEY: '',
        WEB_PUSH_VAPID_PRIVATE_KEY: '',
        WEB_PUSH_VAPID_SUBJECT: ''
    };
}

test('accepts a valid Docker VPS production configuration without printing secret material', () => {
    assert.deepEqual(validateProductionConfig(validConfig()), []);
});

test('rejects the checked-in example placeholders', () => {
    const errors = validateProductionConfig({
        ...validConfig(),
        SHOPADEMIA_RELEASE: 'replace-with-an-immutable-release-id',
        POSTGRES_PASSWORD: 'replace-with-a-random-64-character-hex-secret',
        BACKUP_AGE_RECIPIENT: 'replace-with-your-age-public-recipient'
    });
    assert.ok(errors.some((error) => error.includes('SHOPADEMIA_RELEASE')));
    assert.ok(errors.some((error) => error.includes('POSTGRES_PASSWORD')));
    assert.ok(errors.some((error) => error.includes('BACKUP_AGE_RECIPIENT')));
    assert.ok(errors.every((error) => !error.includes('replace-with-a-random')));
});

test('requires the exact storefront, admin, and API production domains', () => {
    const errors = validateProductionConfig({
        ...validConfig(),
        ADMIN_DOMAIN: 'admin.attacker.invalid',
        ADMIN_SITE_URL: 'https://admin.attacker.invalid'
    });
    assert.ok(errors.some((error) => error.includes('ADMIN_DOMAIN')));
    assert.ok(errors.some((error) => error.includes('ADMIN_SITE_URL')));
});

test('rejects database URLs that bypass the private Compose database or use another role', () => {
    const config = validConfig();
    config.DATABASE_URL = `postgresql://shopademia_owner:${config.POSTGRES_PASSWORD}@database:5432/shopademia`;
    config.MIGRATION_DATABASE_URL = `postgresql://shopademia_migrator:${config.POSTGRES_MIGRATION_PASSWORD}@production.example:5432/shopademia`;
    const errors = validateProductionConfig(config);
    assert.ok(errors.some((error) => error.includes('DATABASE_URL must match')));
    assert.ok(errors.some((error) => error.includes('MIGRATION_DATABASE_URL must target')));
    assert.ok(errors.every((error) => !error.includes(config.POSTGRES_PASSWORD)));
});

test('rejects reused secrets, insecure TLS origins, invalid backup keys, and partial push configuration', () => {
    const config = validConfig();
    config.JWT_SECRET = config.MFA_ENCRYPTION_KEY;
    config.ADMIN_SITE_URL = 'http://admin.shopademia.store';
    config.BACKUP_AGE_RECIPIENT = 'not-an-age-recipient';
    config.WEB_PUSH_VAPID_PUBLIC_KEY = 'public-key';
    const errors = validateProductionConfig(config);
    assert.ok(errors.some((error) => error.includes('ADMIN_SITE_URL')));
    assert.ok(errors.some((error) => error.includes('different')));
    assert.ok(errors.some((error) => error.includes('BACKUP_AGE_RECIPIENT')));
    assert.ok(errors.some((error) => error.includes('WEB_PUSH_VAPID')));
});

test('requires the optional settings encryption key to be unique', () => {
    const config = validConfig();
    config.ADMIN_SETTINGS_ENCRYPTION_KEY = config.JWT_SECRET;
    const errors = validateProductionConfig(config);
    assert.ok(errors.some((error) => error.includes('ADMIN_SETTINGS_ENCRYPTION_KEY must be different')));
});
