import test from 'node:test';
import assert from 'node:assert/strict';
import { WishlistService } from './WishlistService.js';

test('wishlist IDs match across numeric and string product IDs', () => {
    const wishlist = new WishlistService();

    assert.equal(wishlist.toggle(42), true);
    assert.equal(wishlist.has('42'), true);
    assert.equal(wishlist.toggle('42'), false);
    assert.equal(wishlist.has(42), false);
});

test('restored wishlist IDs retain only products still in the catalog', (t) => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map([['shopademia.wishlist.v2', JSON.stringify([42, 'retired-product'])]]);
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

    const wishlist = new WishlistService();
    wishlist.retainAvailable([{ id: '42' }]);

    assert.deepEqual([...wishlist.ids.value], ['42']);
    assert.equal(wishlist.has(42), true);
});
