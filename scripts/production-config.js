const requiredValues = [
    'STOREFRONT_DOMAIN',
    'ADMIN_DOMAIN',
    'API_DOMAIN',
    'ADMIN_SITE_URL',
    'SHOPADEMIA_RELEASE',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_APP_PASSWORD',
    'POSTGRES_MIGRATION_PASSWORD',
    'DATABASE_URL',
    'DATABASE_SSL',
    'MIGRATION_DATABASE_URL',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'JWT_SECRET',
    'MFA_ENCRYPTION_KEY',
    'BACKUP_AGE_RECIPIENT'
];
const optionalValues = [
    'ADMIN_SETTINGS_ENCRYPTION_KEY',
    'DELIVERY_ADVANCE_CHARGE',
    'WEB_PUSH_VAPID_PUBLIC_KEY',
    'WEB_PUSH_VAPID_PRIVATE_KEY',
    'WEB_PUSH_VAPID_SUBJECT'
];
const allowedValues = new Set([...requiredValues, ...optionalValues]);
const productionDomains = {
    storefront: 'shopademia.store',
    admin: 'admin.shopademia.store',
    api: 'api.shopademia.store'
};

function hasSufficientEntropy(value) {
    const frequencies = new Map();
    for (const character of value) frequencies.set(character, (frequencies.get(character) || 0) + 1);
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
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'database'
        || url.port !== '5432' || url.pathname.slice(1) !== 'shopademia' || url.search || url.hash) {
        errors.push(`${name} must target the private Compose PostgreSQL service and shopademia database.`);
        return null;
    }
    try {
        return {
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password)
        };
    } catch {
        errors.push(`${name} contains invalid URL-encoded credentials.`);
        return null;
    }
}

export function validateProductionConfig(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
        return ['Production configuration must be a key/value object.'];
    }
    const errors = [];
    if (Object.keys(values).some((name) => !allowedValues.has(name))) {
        errors.push('.env.production contains unsupported entries; remove unapproved variables.');
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

    for (const [name, expected] of Object.entries(productionDomains)) {
        const key = `${name.toUpperCase()}_DOMAIN`;
        if (values[key].trim().toLowerCase() !== expected) {
            errors.push(`${key} must be ${expected}; verify DNS and VPS ownership before deployment.`);
        }
    }
    if (values.ADMIN_SITE_URL.trim() !== `https://${productionDomains.admin}`) {
        errors.push(`ADMIN_SITE_URL must be https://${productionDomains.admin}.`);
    }
    if (!/^[a-f0-9]{40,64}$/i.test(values.SHOPADEMIA_RELEASE.trim())) {
        errors.push('SHOPADEMIA_RELEASE must be an immutable 40- to 64-character Git commit identifier.');
    }

    if (values.POSTGRES_DB.trim() !== 'shopademia' || values.POSTGRES_USER.trim() !== 'shopademia_owner') {
        errors.push('POSTGRES_DB and POSTGRES_USER must match the isolated production Compose database contract.');
    }
    if (values.DATABASE_SSL.trim().toLowerCase() !== 'false') {
        errors.push('DATABASE_SSL must be false only for the private Compose database network.');
    }

    const secretNames = [
        'POSTGRES_PASSWORD',
        'POSTGRES_APP_PASSWORD',
        'POSTGRES_MIGRATION_PASSWORD',
        'ADMIN_PASSWORD',
        'JWT_SECRET',
        'MFA_ENCRYPTION_KEY'
    ];
    for (const name of secretNames) {
        const value = values[name].trim();
        if (value.length < 64 || !hasSufficientEntropy(value)) {
            errors.push(`${name} must be a unique, high-entropy secret of at least 64 characters.`);
        }
    }
    for (const name of ['POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD', 'POSTGRES_MIGRATION_PASSWORD', 'JWT_SECRET']) {
        if (!/^[a-f0-9]{64}$/i.test(values[name].trim())) {
            errors.push(`${name} must be 64 hexadecimal characters so it is safe in PostgreSQL URLs.`);
        }
    }
    if (!/^[a-f0-9]{64}$/i.test(values.MFA_ENCRYPTION_KEY.trim())) {
        errors.push('MFA_ENCRYPTION_KEY must be 64 hexadecimal characters.');
    }
    if (new Set(secretNames.map((name) => values[name].trim())).size !== secretNames.length) {
        errors.push('All database, administrator, JWT, and MFA secrets must be different.');
    }
    if (values.ADMIN_PASSWORD.trim().length > 1024) {
        errors.push('ADMIN_PASSWORD must not exceed 1024 characters.');
    }

    const database = parseDatabaseUrl('DATABASE_URL', values.DATABASE_URL.trim(), errors);
    const migrator = parseDatabaseUrl('MIGRATION_DATABASE_URL', values.MIGRATION_DATABASE_URL.trim(), errors);
    if (database && (database.user !== 'shopademia_app'
        || database.password !== values.POSTGRES_APP_PASSWORD.trim())) {
        errors.push('DATABASE_URL must match the shopademia_app role and app password.');
    }
    if (migrator && (migrator.user !== 'shopademia_migrator'
        || migrator.password !== values.POSTGRES_MIGRATION_PASSWORD.trim())) {
        errors.push('MIGRATION_DATABASE_URL must match the shopademia_migrator role and migration password.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ADMIN_EMAIL.trim())) {
        errors.push('ADMIN_EMAIL must be a valid email address.');
    }
    if (!/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(values.BACKUP_AGE_RECIPIENT.trim())) {
        errors.push('BACKUP_AGE_RECIPIENT must be the public age recipient for off-host encrypted backups.');
    }
    if (values.DELIVERY_ADVANCE_CHARGE !== undefined
        && !/^(0|[1-9][0-9]*)$/.test(String(values.DELIVERY_ADVANCE_CHARGE).trim())) {
        errors.push('DELIVERY_ADVANCE_CHARGE must be a non-negative integer.');
    }
    const pushSettings = [
        values.WEB_PUSH_VAPID_PUBLIC_KEY,
        values.WEB_PUSH_VAPID_PRIVATE_KEY,
        values.WEB_PUSH_VAPID_SUBJECT
    ];
    if (pushSettings.some((value) => value?.trim()) && pushSettings.some((value) => !value?.trim())) {
        errors.push('WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT must be set together.');
    }
    if (values.ADMIN_SETTINGS_ENCRYPTION_KEY?.trim()
        && !/^[a-f0-9]{64}$/i.test(values.ADMIN_SETTINGS_ENCRYPTION_KEY.trim())) {
        errors.push('ADMIN_SETTINGS_ENCRYPTION_KEY must be 64 hexadecimal characters.');
    }
    if (values.ADMIN_SETTINGS_ENCRYPTION_KEY?.trim()
        && secretNames.some((name) => values.ADMIN_SETTINGS_ENCRYPTION_KEY.trim() === values[name].trim())) {
        errors.push('ADMIN_SETTINGS_ENCRYPTION_KEY must be different from all other production secrets.');
    }
    return errors;
}
