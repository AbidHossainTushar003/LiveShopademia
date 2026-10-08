import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutValidator } from './CheckoutValidator.js';

test('checkout validation matches server name and address length limits', () => {
    const validator = new CheckoutValidator();
    const valid = {
        name: 'Test Customer',
        phone: '01712345678',
        address: 'House 12, Road 5, Dhaka',
        bkashNumber: '01812345678'
    };

    assert.deepEqual(validator.validate(valid), {});
    assert.ok(validator.validate({ ...valid, name: 'A'.repeat(121) }).name);
    assert.ok(validator.validate({ ...valid, address: 'A'.repeat(1001) }).address);
});
