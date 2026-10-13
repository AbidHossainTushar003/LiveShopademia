import { isIP } from 'node:net';

const requiredValues = [
    'STAGING_DOMAIN',
    'STAGING_DEPLOY_AUTHORIZED',
    'STAGING_CHANGE_ID',
    'STAGING_OPERATOR',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_APP_PASSWORD',
    'POSTGRES_MIGRATION_PASSWORD',
    'DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'JWT_SECRET',
    'MFA_ENCRYPTION_KEY',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
];
const allowedValues = new Set([...requiredValues, 'DELIVERY_ADVANCE_CHARGE']);
const productionDomain = 'shopademia.store';
const reservedDomainSuffixes = ['.example', '.test', '.invalid', '.localhost'];

function hasSufficientEntropy(value) {
    const frequencies = new Map();
    for (const character of value) {
        frequencies.set(character, (frequencies.get(character) || 0) + 1);
    }
    const entropy = [...frequencies.values()].reduce((total, count) => {
        const probability = count / value.length;
        return total - probability * Math.log2(probability);
    }, 0);
    return frequencies.size >= 12 && entropy >= 3.5;
}

function parseDatabaseUrl(name, value, errors) {
    let url;
    try {
        url = new URL(value);
    } catch {
        errors.push(`${name} must be a valid PostgreSQL connection URL.`);
        return null;
    }

    if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || url.hostname !== 'database'
        || url.port !== '5432'
        || url.pathname.slice(1) === ''
        || url.search
        || url.hash) {
        errors.push(`${name} must target the private Compose database service on port 5432.`);
        return null;
    }
    try {
        return {
            database: decodeURIComponent(url.pathname.slice(1)),
            password: decodeURIComponent(url.password),
            user: decodeURIComponent(url.username)
        };
    } catch {
        errors.push(`${name} contains invalid URL-encoded credentials or database name.`);
        return null;
    }
}

export function validateStagingConfig(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
        return ['Staging configuration must be a key/value object.'];
    }
    const errors = [];
    if (Object.keys(values).some((name) => !allowedValues.has(name))) {
        errors.push('.env.staging contains unsupported entries; remove unapproved variables.');
    }
    let hasMissingValue = false;
    for (const name of requiredValues) {
        if (typeof values[name] !== 'string' || values[name].trim() === '') {
            errors.push(`${name} is required.`);
            hasMissingValue = true;
        }
    }
    if (hasMissingValue) return errors;

    const entries = requiredValues.map((name) => [name, values[name].trim()]);
    const placeholders = /replace-with|change-this|example(?:\.(?:com|net|org))?$|<[^>]+>/i;
    for (const [name, value] of entries) {
        if (placeholders.test(value)) errors.push(`${name} still contains a placeholder value.`);
    }

    const domain = values.STAGING_DOMAIN.trim().toLowerCase();
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(domain)
        || !domain.includes('.')
        || isIP(domain)
        || domain === productionDomain
        || domain.endsWith(`.${productionDomain}`)
        || domain.split('.').some((label) => ['prod', 'production'].includes(label))
        || reservedDomainSuffixes.some((suffix) => domain.endsWith(suffix))
        || ['example.com', 'example.net', 'example.org'].some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`))) {
        errors.push('STAGING_DOMAIN must be a valid, non-reserved staging hostname, not a production hostname or IP address.');
    }
    if (values.STAGING_DEPLOY_AUTHORIZED.trim() !== 'true') {
        errors.push('STAGING_DEPLOY_AUTHORIZED must be true only after an authorized operator approves this staging target.');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,127}$/.test(values.STAGING_CHANGE_ID.trim())) {
        errors.push('STAGING_CHANGE_ID must identify the approved staging change.');
    }
    if (values.STAGING_OPERATOR.trim().length < 3) {
        errors.push('STAGING_OPERATOR must identify the authorized staging operator.');
    }

    if (values.POSTGRES_DB.trim().length > 63
        || !/^shopademia_staging_[a-z0-9_]+$/.test(values.POSTGRES_DB.trim())
        || /(?:^|_)(?:prod|production)(?:_|$)/.test(values.POSTGRES_DB.trim().slice('shopademia_staging_'.length))) {
        errors.push('POSTGRES_DB must use the isolated shopademia_staging_ prefix.');
    }
    if (values.POSTGRES_USER.trim().length > 63
        || !/^shopademia_staging_[a-z0-9_]+$/.test(values.POSTGRES_USER.trim())
        || /(?:^|_)(?:prod|production)(?:_|$)/.test(values.POSTGRES_USER.trim().slice('shopademia_staging_'.length))) {
        errors.push('POSTGRES_USER must use the isolated shopademia_staging_ prefix.');
    }

    const passwords = [
        'POSTGRES_PASSWORD',
        'POSTGRES_APP_PASSWORD',
        'POSTGRES_MIGRATION_PASSWORD',
        'JWT_SECRET',
        'ADMIN_PASSWORD',
        'MFA_ENCRYPTION_KEY'
    ];
    for (const name of passwords) {
        const minimumLength = name === 'ADMIN_PASSWORD' ? 20 : 32;
        if (values[name].trim().length < minimumLength) {
            errors.push(`${name} must contain at least ${minimumLength} characters.`);
        }
        if (!/^[A-Za-z0-9_-]+$/.test(values[name].trim())) {
            errors.push(`${name} must use URL-safe base64 characters only.`);
        }
        if (!hasSufficientEntropy(values[name].trim())) {
            errors.push(`${name} must contain a non-repetitive, sufficiently varied secret value.`);
        }
    }
    if (!/^[0-9a-f]{64}$/i.test(values.MFA_ENCRYPTION_KEY.trim())) {
        errors.push('MFA_ENCRYPTION_KEY must be 64 hexadecimal characters.');
    }
    if (new Set(passwords.map((name) => values[name].trim())).size !== passwords.length) {
        errors.push('Database, application, JWT, and admin secrets must all be different.');
    }
    if (values.POSTGRES_PASSWORD.trim() === values.POSTGRES_APP_PASSWORD.trim()
        || values.POSTGRES_PASSWORD.trim() === values.POSTGRES_MIGRATION_PASSWORD.trim()
        || values.POSTGRES_APP_PASSWORD.trim() === values.POSTGRES_MIGRATION_PASSWORD.trim()) {
        errors.push('The database owner, app, and migration passwords must be different.');
    }

    const app = parseDatabaseUrl('DATABASE_URL', values.DATABASE_URL.trim(), errors);
    const migrator = parseDatabaseUrl('MIGRATION_DATABASE_URL', values.MIGRATION_DATABASE_URL.trim(), errors);
    if (app && (app.database !== values.POSTGRES_DB.trim()
        || app.user !== 'shopademia_app'
        || app.password !== values.POSTGRES_APP_PASSWORD.trim())) {
        errors.push('DATABASE_URL must match the staging database, shopademia_app role, and app password.');
    }
    if (migrator && (migrator.database !== values.POSTGRES_DB.trim()
        || migrator.user !== 'shopademia_migrator'
        || migrator.password !== values.POSTGRES_MIGRATION_PASSWORD.trim())) {
        errors.push('MIGRATION_DATABASE_URL must match the staging database, shopademia_migrator role, and migration password.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ADMIN_EMAIL.trim())) {
        errors.push('ADMIN_EMAIL must be a valid email address.');
    }
    if (values.DELIVERY_ADVANCE_CHARGE !== undefined
        && !/^(0|[1-9][0-9]*)$/.test(String(values.DELIVERY_ADVANCE_CHARGE).trim())) {
        errors.push('DELIVERY_ADVANCE_CHARGE must be a non-negative integer.');
    }
    return errors;
}
