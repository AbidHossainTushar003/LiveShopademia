import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiOrderRepository } from '../js/repositories/ApiOrderRepository.js';

test('returns the server-generated order confirmation', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { orderNumber: 'SH-TEST-0001', subtotal: 9990, advanceAmount: 100, due: 9990 } }), { status: 201 });
    const repository = new ApiOrderRepository('/api/v1');
    const result = await repository.place({ toPayload: () => ({ items: [] }) });
    assert.equal(result.orderNumber, 'SH-TEST-0001');
});

test('does not report success when the API omits its order confirmation number', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { subtotal: 9990, advanceAmount: 100, due: 9990 } }), { status: 201 });
    const repository = new ApiOrderRepository('/api/v1');
    await assert.rejects(
        repository.place({ toPayload: () => ({ items: [] }) }),
        /invalid confirmation number/
    );
});

test('shows server validation errors to the customer', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid order request.' }), { status: 400 });
    const repository = new ApiOrderRepository('/api/v1');
    await assert.rejects(
        repository.place({ toPayload: () => ({ items: [] }) }),
        /Invalid order request/
    );
});
