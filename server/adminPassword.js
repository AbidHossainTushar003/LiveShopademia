import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export function validateAdminPassword(password) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 1024
        || /replace-with|change-this/i.test(password)) {
        throw new Error('Admin passwords must be 12 to 1024 characters and must not use an example placeholder.');
    }
    return password;
}

export async function hashAdminPassword(password) {
    validateAdminPassword(password);
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, keyLength, scryptOptions);
    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export async function verifyAdminPassword(password, storedHash) {
    if (typeof password !== 'string' || password.length > 1024 || typeof storedHash !== 'string') return false;
    const [algorithm, saltValue, keyValue, extra] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !keyValue || extra !== undefined) return false;

    let salt;
    let expected;
    try {
        salt = Buffer.from(saltValue, 'base64url');
        expected = Buffer.from(keyValue, 'base64url');
    } catch {
        return false;
    }
    if (salt.length !== 16 || expected.length !== keyLength) return false;

    const actual = await scrypt(password, salt, keyLength, scryptOptions);
    return timingSafeEqual(actual, expected);
}
