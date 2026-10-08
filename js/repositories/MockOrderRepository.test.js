import test from 'node:test';
import assert from 'node:assert/strict';
import { MockOrderRepository } from './MockOrderRepository.js';
import { OrderRequest } from '../models/OrderRequest.js';

test('mock checkout returns the same confirmation and totals shape as the API', async (t) => {
    const originalTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback) => {
        callback();
        return 0;
    };
    t.after(() => { globalThis.setTimeout = originalTimeout; });

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
    const result = await new MockOrderRepository().place(request);

    assert.match(result.orderNumber, /^SH-[A-Z0-9]{1,12}-[A-F0-9]{12}$/);
    assert.equal(result.subtotal, 200);
    assert.equal(result.advanceAmount, 25);
    assert.equal(result.due, 200);
    assert.equal(Object.hasOwn(request.toPayload(), 'subtotal'), false);
});
