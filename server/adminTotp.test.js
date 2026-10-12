import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createTotpCode,
    decryptTotpSecret,
    encryptTotpSecret,
    generateTotpSecret,
    verifyTotpCode
} from './adminTotp.js';

test('TOTP codes verify within the allowed time window and reject malformed values', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const counter = Math.floor(now / 30_000);
    assert.match(secret, /^[A-Z2-7]{32}$/);
    assert.equal(verifyTotpCode(secret, createTotpCode(secret, counter), now), counter);
    assert.equal(verifyTotpCode(secret, createTotpCode(secret, counter + 1), now), counter + 1);
    assert.equal(verifyTotpCode(secret, '12x456', now), null);
    assert.equal(verifyTotpCode(secret, '00000000', now), null);
});

test('encrypted TOTP secrets require an intact AES-GCM payload and the original key', () => {
    const secret = generateTotpSecret();
    const key = Buffer.alloc(32, 42);
    const encrypted = encryptTotpSecret(secret, key);
    assert.equal(decryptTotpSecret(encrypted, key), secret);
    assert.throws(() => decryptTotpSecret(encrypted, Buffer.alloc(32, 43)));
    const damaged = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
    assert.throws(() => decryptTotpSecret(damaged, key));
});
