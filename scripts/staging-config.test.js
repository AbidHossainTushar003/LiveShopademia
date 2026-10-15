import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { validateStagingConfig } from './staging-config.js';

function validConfig() {
    const database = 'shopademia_staging_fixture';
    const ownerPassword = 'synthetic-staging-owner-password-0001';
    const appPassword = 'synthetic-staging-app-password-00002';
    const migrationPassword = 'synthetic-staging-migrator-password-03';
    return {
        STAGING_DOMAIN: 'stage.shopademia.dev',
        STAGING_DEPLOY_AUTHORIZED: 'true',
        STAGING_CHANGE_ID: 'STAGING-TEST-001',
        STAGING_OPERATOR: 'Synthetic Test Operator',
        POSTGRES_DB: database,
        POSTGRES_USER: 'shopademia_staging_owner',
        POSTGRES_PASSWORD: ownerPassword,
        POSTGRES_APP_PASSWORD: appPassword,
        POSTGRES_MIGRATION_PASSWORD: migrationPassword,
        DATABASE_URL: `postgresql://shopademia_app:${appPassword}@database:5432/${database}`,
        MIGRATION_DATABASE_URL: `postgresql://shopademia_migrator:${migrationPassword}@database:5432/${database}`,
        JWT_SECRET: 'synthetic-staging-jwt-secret-value-000001',
        MFA_ENCRYPTION_KEY: 'd03f7a91c624be58a7d0c3e95f21684b4d8e3a70c16f529be7a413d8059c2f60',
        ADMIN_EMAIL: 'staging-admin@shopademia.dev',
        ADMIN_PASSWORD: 'synthetic-staging-admin-password-0001'
    };
}

test('staging config accepts private DB URLs and independent staging secrets', () => {
    assert.deepEqual(validateStagingConfig(validConfig()), []);
});

test('staging config rejects missing values and placeholders without echoing values', () => {
    const config = validConfig();
    config.ADMIN_PASSWORD = 'replace-with-a-real-secret';
    assert.ok(validateStagingConfig(config).some((error) => error.includes('placeholder')));
    delete config.JWT_SECRET;
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('JWT_SECRET is required')));
    assert.ok(errors.every((error) => !error.includes('replace-with-a-real-secret')));
});

test('staging config rejects malformed objects and weak repeated secrets', () => {
    assert.ok(validateStagingConfig(null).some((error) => error.includes('key/value object')));
    assert.ok(validateStagingConfig([]).some((error) => error.includes('key/value object')));
    const config = validConfig();
    config.JWT_SECRET = 'a'.repeat(48);
    config.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('JWT_SECRET must contain a non-repetitive')));
    assert.ok(errors.some((error) => error.includes('MFA_ENCRYPTION_KEY must contain a non-repetitive')));
});

test('the checked-in staging template is rejected by the same dotenv-backed validator', async () => {
    const templatePath = fileURLToPath(new URL('../.env.staging.example', import.meta.url));
    const values = dotenv.parse(await readFile(templatePath, 'utf8'));
    const errors = validateStagingConfig(values);
    assert.ok(errors.some((error) => error.includes('placeholder')));
    assert.ok(errors.some((error) => error.includes('STAGING_DEPLOY_AUTHORIZED')));
    assert.ok(errors.every((error) => !error.includes('replace-with-')));
});

test('the local environment example contains no unassigned database connection URL', async () => {
    const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));
    const lines = (await readFile(examplePath, 'utf8')).split(/\r?\n/);
    assert.equal(
        lines.some((line) => /^\s*postgres(?:ql)?:\/\//i.test(line)),
        false
    );
});

test('staging config rejects production domain and non-staging database names', () => {
    const config = validConfig();
    config.STAGING_DOMAIN = 'shopademia.store';
    config.POSTGRES_DB = 'shopademia';
    assert.ok(validateStagingConfig(config).some((error) => error.includes('STAGING_DOMAIN')));
    assert.ok(validateStagingConfig(config).some((error) => error.includes('POSTGRES_DB')));
});

test('staging config rejects production subdomains and reserved example domains', () => {
    for (const domain of ['stage.shopademia.store', 'stage.example.net', 'stage.invalid', 'prod.stage.shopademia.dev']) {
        const config = validConfig();
        config.STAGING_DOMAIN = domain;
        assert.ok(validateStagingConfig(config).some((error) => error.includes('STAGING_DOMAIN')), domain);
    }
});

test('staging config requires explicit operator authorization and staging domain', () => {
    const config = validConfig();
    config.STAGING_DEPLOY_AUTHORIZED = 'false';
    config.STAGING_DOMAIN = 'stage.shopademia.example';
    assert.ok(validateStagingConfig(config).some((error) => error.includes('placeholder')));
    assert.ok(validateStagingConfig(config).some((error) => error.includes('STAGING_DEPLOY_AUTHORIZED')));
});

test('staging config rejects public and mismatched database URLs', () => {
    const config = validConfig();
    config.DATABASE_URL = 'postgresql://shopademia_app:secret@production-db.example:5432/shopademia';
    config.MIGRATION_DATABASE_URL = 'postgresql://shopademia_migrator:wrong@database:5432/shopademia_staging_fixture';
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('private Compose database service')));
    assert.ok(errors.some((error) => error.includes('migration password')));
});

test('staging app and migration URLs must point to the same staging database', () => {
    const config = validConfig();
    config.MIGRATION_DATABASE_URL = `postgresql://shopademia_migrator:${config.POSTGRES_MIGRATION_PASSWORD}@database:5432/shopademia_staging_another`;
    assert.ok(validateStagingConfig(config).some((error) => error.includes('migration password')));
});

test('staging config rejects production-like isolated database and owner names', () => {
    for (const name of ['shopademia_staging_production', 'shopademia_staging_prod_owner']) {
        const config = validConfig();
        config.POSTGRES_DB = name;
        assert.ok(validateStagingConfig(config).some((error) => error.includes('POSTGRES_DB')), name);
    }
    const config = validConfig();
    config.POSTGRES_USER = 'shopademia_staging_prod_owner';
    assert.ok(validateStagingConfig(config).some((error) => error.includes('POSTGRES_USER')));
});

test('staging config rejects PostgreSQL identifiers longer than 63 characters', () => {
    const config = validConfig();
    config.POSTGRES_DB = `shopademia_staging_${'a'.repeat(50)}`;
    assert.ok(validateStagingConfig(config).some((error) => error.includes('POSTGRES_DB')));
    config.POSTGRES_DB = 'shopademia_staging_fixture';
    config.POSTGRES_USER = `shopademia_staging_${'a'.repeat(50)}`;
    assert.ok(validateStagingConfig(config).some((error) => error.includes('POSTGRES_USER')));
});

test('staging config rejects a production database hostname without echoing secrets', () => {
    const config = validConfig();
    config.DATABASE_URL = `postgresql://shopademia_app:${config.POSTGRES_APP_PASSWORD}@db.shopademia.store:5432/${config.POSTGRES_DB}`;
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('private Compose database service')));
    assert.ok(errors.every((error) => !error.includes(config.POSTGRES_APP_PASSWORD)));
});

test('staging config rejects database URL overrides and Compose-sensitive secrets', () => {
    const config = validConfig();
    config.DATABASE_URL += '?host=production-db.example';
    config.JWT_SECRET = 'synthetic$compose-sensitive-jwt-secret-value';
    config.COMPOSE_PROJECT_NAME = 'shopademia';
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('private Compose database service')));
    assert.ok(errors.some((error) => error.includes('URL-safe base64')));
    assert.ok(errors.some((error) => error.includes('unsupported entries')));
});

test('staging config rejects shared DB role credentials and shared secrets', () => {
    const config = validConfig();
    config.POSTGRES_MIGRATION_PASSWORD = config.POSTGRES_APP_PASSWORD;
    config.MIGRATION_DATABASE_URL = `postgresql://shopademia_migrator:${config.POSTGRES_MIGRATION_PASSWORD}@database:5432/${config.POSTGRES_DB}`;
    const errors = validateStagingConfig(config);
    assert.ok(errors.some((error) => error.includes('must all be different')));
    assert.ok(errors.some((error) => error.includes('passwords must be different')));
});
