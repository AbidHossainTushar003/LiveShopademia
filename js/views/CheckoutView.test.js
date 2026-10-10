import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptDocument } from './CheckoutView.js';

test('downloadable receipt escapes customer and shop text and clarifies payment status', () => {
    const receipt = {
        customer: { name: '<script>alert(1)</script>', phone: '01712345678', address: 'Dhaka & Chattogram' },
        items: [{ name: '<b>Test item</b>', quantity: 2, lineTotal: 200 }],
        shopName: '<img src=x>',
        issuedAt: '2026-01-02T03:04:05.000Z',
        subtotal: 200,
        advanceAmount: 50,
        due: 200
    };

    const html = receiptDocument('SH-ABC123-1A2B', receipt);

    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /&lt;b&gt;Test item&lt;\/b&gt;/);
    assert.match(html, /not proof of payment/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
