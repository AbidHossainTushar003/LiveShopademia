import test from 'node:test';
import assert from 'node:assert/strict';
import { CartService, MAX_CART_QUANTITY } from './CartService.js';

const product = { id: 1, name: 'Demo product', price: 100 };

test('cart quantities stay within the API limit', () => {
    const cart = new CartService();
    for (let quantity = 0; quantity < MAX_CART_QUANTITY; quantity += 1) {
        assert.equal(cart.add(product), true);
    }

    assert.equal(cart.add(product), false);
    assert.equal(cart.lines.value[0].quantity, MAX_CART_QUANTITY);

    cart.setQuantity('1', MAX_CART_QUANTITY + 1);
    assert.equal(cart.lines.value[0].quantity, MAX_CART_QUANTITY);
    cart.setQuantity(1, 1.5);
    assert.equal(cart.lines.value[0].quantity, MAX_CART_QUANTITY);
});

test('setting a cart quantity to zero removes the item', () => {
    const cart = new CartService();
    cart.add(product);

    cart.setQuantity(product.id, 0);

    assert.equal(cart.lines.value.length, 0);
});

test('unavailable products cannot be added to the cart', () => {
    const cart = new CartService();

    assert.equal(cart.add({ ...product, isAvailableForPurchase: false }), false);
    assert.equal(cart.lines.value.length, 0);
});

test('managed stock caps cart additions and prevents checkout for a stale quantity', () => {
    const cart = new CartService();
    const stockedProduct = { ...product, id: 'managed-stock', stockQuantity: 2, isAvailable: true };

    assert.equal(cart.add(stockedProduct), true);
    assert.equal(cart.add(stockedProduct), true);
    assert.equal(cart.add(stockedProduct), false);
    assert.equal(cart.canCheckout(), true);

    cart.lines.set([{ product: { ...stockedProduct, stockQuantity: 1 }, quantity: 2 }]);
    assert.equal(cart.canCheckout(), false);
    cart.setQuantity(stockedProduct.id, 1);
    assert.equal(cart.lines.value[0].quantity, 1);
    assert.equal(cart.canCheckout(), true);
});

test('cart accepts products from only one shop per order', () => {
    const cart = new CartService();
    const mainProduct = { ...product, id: 'main-item', shopId: 'main', shopName: 'Main Shop' };
    const otherProduct = { ...product, id: 'other-item', shopId: 'other', shopName: 'Other Shop' };

    assert.equal(cart.add(mainProduct), true);
    assert.equal(cart.canAddFromShop(otherProduct), false);
    assert.equal(cart.add(otherProduct), false);
    assert.equal(cart.lines.value.length, 1);
    assert.equal(cart.canCheckout(), true);

    cart.remove(mainProduct.id);
    assert.equal(cart.add(otherProduct), true);
    assert.equal(cart.canCheckout(), true);
});

test('restored cart quantities are capped rather than discarding saved items', (t) => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map([['shopademia.cart.v2', JSON.stringify([
        { product, quantity: 70 },
        { product: { ...product, id: '1' }, quantity: 50 }
    ])]]);
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, value); }
        }
    });
    t.after(() => {
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else delete globalThis.localStorage;
    });

    const cart = new CartService();

    assert.equal(cart.lines.value[0].quantity, MAX_CART_QUANTITY);
});
