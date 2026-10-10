import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canTransitionOrderStatus,
    fingerprintOrder,
    OrderInputError,
    normalizePhone,
    validateAndPriceOrder
} from './orders.js';
import { findProduct, getHeroProduct, setManagedProducts } from './catalog.js';

const testProducts = [
    { id: 1, name: 'Test earbuds', price: 9990, oldPrice: 11990, category: 'gadgets', stockQuantity: 10, isAvailable: true },
    { id: 101, name: 'Test blender', price: 3990, oldPrice: null, category: 'more', stockQuantity: 10, isAvailable: true }
];
setManagedProducts(testProducts);
const validOrder = {
    customer: { name: '  Abid Hossain ', phone: '+8801712345678', address: 'House 12, Road 5, Dhaka' },
    payment: { method: 'bkash', bkashNumber: '01812345678', advanceAmount: 999999 },
    items: [{ productId: 1, quantity: 2 }, { productId: 101, quantity: 1 }],
    eventId: 'event-12345678',
    source: 'storefront'
};

test('order status transitions follow the fulfillment lifecycle', () => {
    assert.equal(canTransitionOrderStatus('new', 'confirmed'), true);
    assert.equal(canTransitionOrderStatus('new', 'cancelled'), true);
    assert.equal(canTransitionOrderStatus('processing', 'shipped'), true);
    assert.equal(canTransitionOrderStatus('shipped', 'delivered'), true);
    assert.equal(canTransitionOrderStatus('cancelled', 'new'), true);
    assert.equal(canTransitionOrderStatus('new', 'new'), true);
    assert.equal(canTransitionOrderStatus('new', 'shipped'), false);
    assert.equal(canTransitionOrderStatus('shipped', 'cancelled'), false);
    assert.equal(canTransitionOrderStatus('delivered', 'cancelled'), false);
    assert.equal(canTransitionOrderStatus('cancelled', 'delivered'), false);
});

test('normalizes Bangladesh phone numbers with country codes', () => {
    assert.equal(normalizePhone('+880 1712-345678'), '01712345678');
});

test('prices orders from the server catalog, not submitted prices', () => {
    const order = validateAndPriceOrder(validOrder, 150);
    assert.equal(order.customerName, 'Abid Hossain');
    assert.equal(order.subtotal, 23970);
    assert.equal(order.advanceAmount, 150);
    assert.equal(order.dueAmount, 23970);
    assert.deepEqual(order.items.map((item) => item.unitPrice), [9990, 3990]);
    assert.match(order.orderNumber, /^SH-[A-Z0-9]{1,12}-[A-F0-9]{12}$/);
});

test('does not publish a fallback hero product when the shop has no products', () => {
    assert.equal(getHeroProduct(), null);
});

test('rejects an invalid phone, unavailable product, and excessive quantity', () => {
    assert.throws(() => validateAndPriceOrder({
        ...validOrder, customer: { ...validOrder.customer, phone: '123' }
    }, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder({
        ...validOrder, items: [{ productId: 'missing', quantity: 1 }]
    }, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder({
        ...validOrder, items: [{ productId: 1, quantity: 100 }]
    }, 100), OrderInputError);
});

test('rejects missing idempotency identifiers and invalid delivery config', () => {
    assert.throws(() => validateAndPriceOrder({ ...validOrder, eventId: '' }, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder(validOrder, -1), /DELIVERY_ADVANCE_CHARGE/);
});

test('rejects malformed payloads without crashing with TypeError', () => {
    assert.throws(() => validateAndPriceOrder(undefined, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder({ customer: {}, payment: {}, items: [] }, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder({ ...validOrder, payment: {} }, 100), OrderInputError);
    assert.throws(() => validateAndPriceOrder({ ...validOrder, source: 'bogus' }, 100), OrderInputError);
});

test('order retry fingerprints change when customer or item details change', () => {
    const original = validateAndPriceOrder(validOrder, 100);
    const changed = validateAndPriceOrder({
        ...validOrder,
        customer: { ...validOrder.customer, address: 'Different address, Dhaka' }
    }, 100);
    assert.notEqual(fingerprintOrder(original), fingerprintOrder(changed));
    assert.equal(fingerprintOrder(original), fingerprintOrder(validateAndPriceOrder(validOrder, 100)));
});

test('managed stock blocks unavailable, out-of-stock, and over-quantity orders', (t) => {
    t.after(() => setManagedProducts([]));
    const productId = 'admin-00000000-0000-4000-8000-000000000001';
    setManagedProducts([{
        id: productId, name: 'Tracked product', description: '', price: 100, oldPrice: null,
        category: 'more', image: '/uploads/00000000-0000-4000-8000-000000000001.png',
        stockQuantity: 2, isAvailable: true
    }]);

    assert.throws(() => validateAndPriceOrder({
        ...validOrder,
        items: [{ productId, quantity: 2 }, { productId, quantity: 1 }]
    }, 100), /exceeds available stock/);
    assert.throws(() => validateAndPriceOrder({
        ...validOrder,
        items: [{ productId, quantity: 99 }, { productId, quantity: 1 }]
    }, 100, { checkInventory: false }), /more than 99 units/);
    setManagedProducts([{ ...findProduct(productId), stockQuantity: 0 }]);
    assert.throws(() => validateAndPriceOrder({
        ...validOrder, items: [{ productId, quantity: 1 }]
    }, 100), /currently unavailable/);
    setManagedProducts([{ ...findProduct(productId), stockQuantity: 2, isAvailable: false }]);
    assert.throws(() => validateAndPriceOrder({
        ...validOrder, items: [{ productId, quantity: 1 }]
    }, 100), /currently unavailable/);
    assert.equal(validateAndPriceOrder({
        ...validOrder, items: [{ productId, quantity: 1 }]
    }, 100, { checkInventory: false }).items[0].productId, productId);
});
