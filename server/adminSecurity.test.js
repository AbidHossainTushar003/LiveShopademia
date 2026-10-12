import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    auditChangeSnapshot,
    auditRequestMetadata,
    decryptSettingSecret,
    encryptSettingSecret,
    publicSettingValue
} from './adminSecurity.js';

test('secret settings use authenticated AES-256-GCM envelopes and masked reads', () => {
    const key = Buffer.alloc(32, 17);
    const envelope = encryptSettingSecret('private-api-key', key);
    assert.equal(envelope.version, 1);
    assert.equal(envelope.keyId, createHash('sha256').update(key).digest('hex').slice(0, 16));
    assert.notEqual(envelope.keyId, key.subarray(0, 8).toString('hex'));
    assert.equal(decryptSettingSecret(envelope, key), 'private-api-key');
    assert.equal(publicSettingValue(envelope, true), '••••••••');
    assert.throws(() => decryptSettingSecret(envelope, Buffer.alloc(32, 18)));
    assert.throws(() => decryptSettingSecret({ ...envelope, tag: '0'.repeat(32) }, key));
    assert.throws(() => encryptSettingSecret('private-api-key', Buffer.alloc(31)));
});

test('audit snapshots include setting identity without values', () => {
    const snapshot = auditChangeSnapshot('integrations', 'mail-token', true);
    assert.deepEqual(snapshot, {
        group: 'integrations',
        key: 'mail-token',
        isSecret: true,
        valueChanged: true
    });
    assert.equal(JSON.stringify(snapshot).includes('private-api-key'), false);
});

test('audit request metadata is bounded and strips control characters', () => {
    const metadata = auditRequestMetadata({
        ip: '127.0.0.1',
        get: () => `browser\u0000agent${'x'.repeat(600)}`
    });
    assert.equal(metadata.ip, '127.0.0.1');
    assert.equal(metadata.userAgent.length, 512);
    assert.equal(metadata.userAgent.includes('\u0000'), false);
    assert.match(metadata.requestId, /^[0-9a-f-]{36}$/);
});
