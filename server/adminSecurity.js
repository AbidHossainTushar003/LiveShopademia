import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

const secretMask = '••••••••';

function sanitizedText(value, maximumLength) {
    return typeof value === 'string'
        ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maximumLength)
        : null;
}

function keyIdentifier(key) {
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function encryptSettingSecret(value, key) {
    if (!Buffer.isBuffer(key) || key.length !== 32) {
        throw new Error('ADMIN_SETTINGS_ENCRYPTION_KEY must be configured as 64 hexadecimal characters before saving secret settings.');
    }
    const ivBytes = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, ivBytes);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
        version: 1,
        keyId: keyIdentifier(key),
        iv: ivBytes.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        ciphertext: ciphertext.toString('base64')
    };
}

export function decryptSettingSecret(envelope, key) {
    if (!Buffer.isBuffer(key) || key.length !== 32 || !envelope || envelope.version !== 1
        || envelope.keyId !== keyIdentifier(key)
        || !/^[0-9a-f]{24}$/i.test(envelope.iv)
        || !/^[0-9a-f]{32}$/i.test(envelope.tag)
        || typeof envelope.ciphertext !== 'string') {
        throw new Error('Secret setting cannot be decrypted with the configured key.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final()
    ]).toString('utf8');
}

export function publicSettingValue(value, isSecret) {
    if (isSecret) return secretMask;
    return value;
}

export function auditRequestMetadata(req) {
    const rawIp = typeof req.ip === 'string' ? req.ip : null;
    const ip = rawIp && rawIp.length <= 45 ? rawIp : null;
    return {
        ip,
        userAgent: sanitizedText(req.get?.('user-agent'), 512),
        requestId: randomUUID()
    };
}

export function auditChangeSnapshot(settingGroup, settingKey, isSecret) {
    return {
        group: sanitizedText(settingGroup, 48),
        key: sanitizedText(settingKey, 64),
        isSecret: Boolean(isSecret),
        valueChanged: true
    };
}
