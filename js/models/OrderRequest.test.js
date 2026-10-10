import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderRequest } from './OrderRequest.js';

test('order request payload excludes client-calculated prices', () => {
    const request = new OrderRequest({
        name: 'Test Customer',
        phone: '01712345678',
        address: 'Test address, Dhaka',
        bkashNumber: '01812345678',
        items: [{ productId: 1, quantity: 2 }],
        subtotal: 200,
        advanceAmount: 25,
        eventId: 'test-event-id'
    });
    const payload = request.toPayload();

    assert.deepEqual(payload, {
        customer: { name: 'Test Customer', phone: '01712345678', address: 'Test address, Dhaka' },
        payment: { method: 'bkash', bkashNumber: '01812345678', advanceAmount: 25 },
        items: [{ productId: 1, quantity: 2 }],
        eventId: 'test-event-id',
        source: 'storefront'
    });
    assert.equal(Object.hasOwn(payload, 'subtotal'), false);
});
