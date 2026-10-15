import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAdminPassword } from './adminPassword.js';

test('admin password validation rejects example placeholders', () => {
    assert.throws(
        () => validateAdminPassword('replace-with-a-long-placeholder-value'),
        /example placeholder/
    );
    assert.throws(
        () => validateAdminPassword('change-this-long-placeholder-value'),
        /example placeholder/
    );
    assert.equal(validateAdminPassword('synthetic-strong-admin-passphrase'), 'synthetic-strong-admin-passphrase');
});
