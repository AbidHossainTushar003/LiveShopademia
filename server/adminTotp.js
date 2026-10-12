import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
    timingSafeEqual
} from 'node:crypto';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
    const bytes = randomBytes(20);
    let bits = 0;
    let value = 0;
    let encoded = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            encoded += base32Alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) encoded += base32Alphabet[(value << (5 - bits)) & 31];
    return encoded;
}

function decodeBase32(secret) {
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const character of secret.toUpperCase().replace(/=+$/, '')) {
        const digit = base32Alphabet.indexOf(character);
        if (digit < 0) throw new Error('Invalid TOTP secret.');
        value = (value << 5) | digit;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

export function createTotpCode(secret, counter) {
    const movingFactor = Buffer.alloc(8);
    movingFactor.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', decodeBase32(secret)).update(movingFactor).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = digest.readUInt32BE(offset) & 0x7fffffff;
    return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret, code, now = Date.now()) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
    const currentCounter = Math.floor(now / 30_000);
    const supplied = Buffer.from(code);
    for (const counter of [currentCounter - 1, currentCounter, currentCounter + 1]) {
        const expected = Buffer.from(createTotpCode(secret, counter));
        if (timingSafeEqual(supplied, expected)) return counter;
    }
    return null;
}

export function encryptTotpSecret(secret, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptTotpSecret(encrypted, key) {
    const [version, ivText, tagText, ciphertextText, extra] = String(encrypted).split('.');
    if (version !== 'v1' || !ivText || !tagText || !ciphertextText || extra) {
        throw new Error('The stored MFA secret has an invalid format.');
    }
    const iv = Buffer.from(ivText, 'base64url');
    const tag = Buffer.from(tagText, 'base64url');
    const ciphertext = Buffer.from(ciphertextText, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 32) {
        throw new Error('The stored MFA secret has invalid lengths.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function totpProvisioningUri(secret, email) {
    const label = encodeURIComponent(`Shopademia:${email}`);
    const issuer = encodeURIComponent('Shopademia');
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
