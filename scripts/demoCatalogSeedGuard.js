import { isIP } from 'node:net';

export function validateDemoCatalogSeedTarget({ args, env }) {
    if (!['development', undefined].includes(env.NODE_ENV)) {
        throw new Error('Demo catalog seeding is only allowed in development mode.');
    }
    if (env.SHOPADEMIA_READ_ONLY_PREVIEW === '1') {
        throw new Error('Demo catalog seeding is disabled in read-only preview mode.');
    }
    if (args.length !== 1 || args[0] !== '--apply') {
        throw new Error('Pass --apply to seed the local development database.');
    }
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL must point to a local development database.');
    let target;
    try {
        target = new URL(env.DATABASE_URL);
    } catch {
        throw new Error('Demo catalog seeding requires a direct, non-SSL loopback PostgreSQL connection.');
    }
    const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const isLoopback = hostname === 'localhost' || hostname === '::1'
        || (isIP(hostname) === 4 && /^127(?:\.\d{1,3}){3}$/.test(hostname));
    if (!['postgres:', 'postgresql:'].includes(target.protocol)
        || !isLoopback || target.searchParams.has('host') || target.searchParams.has('hostaddr')
        || target.searchParams.has('ssl')
        || (target.searchParams.has('sslmode') && target.searchParams.get('sslmode') !== 'disable')
        || env.DATABASE_SSL === 'true' || env.DATABASE_SSL === '1') {
        throw new Error('Demo catalog seeding requires a direct, non-SSL loopback PostgreSQL connection.');
    }
}
