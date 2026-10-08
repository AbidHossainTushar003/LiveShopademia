import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getFeaturedProducts,
    getHeroProduct,
    getManagedProducts,
    getNewArrivals,
    loadFakeStoreCatalog,
    mapFakeStoreProducts,
    removeManagedProduct,
    setManagedProducts,
    updateManagedProduct
} from './catalog.js';

const products = [
    {
        id: 1,
        title: 'Laptop demo',
        description: 'Demo description',
        price: 109.95,
        category: 'electronics',
        image: 'https://fakestoreapi.com/img/demo.png',
        rating: { rate: 4.5, count: 20 }
    },
    {
        id: 2,
        title: 'Ring demo',
        price: 10,
        category: 'jewelery',
        image: 'https://fakestoreapi.com/img/ring.png',
        rating: { rate: 3, count: 7 }
    }
];

test('maps Fake Store products to safe BDT demo products and supported categories', () => {
    const mapped = mapFakeStoreProducts(products, 120);
    assert.equal(mapped[0].price, 13194);
    assert.equal(mapped[0].category, 'gadgets');
    assert.equal(mapped[0].rating, 4.5);
    assert.equal(mapped[1].price, 1200);
    assert.equal(mapped[1].category, 'accessories');
    assert.equal(mapped[1].oldPrice, null);
});

test('rejects unsafe images, duplicate identifiers, empty data, and invalid rates', () => {
    assert.throws(() => mapFakeStoreProducts([], 120), /no products/);
    assert.throws(() => mapFakeStoreProducts(products, 0), /DEMO_USD_TO_BDT/);
    assert.throws(() => mapFakeStoreProducts([{ ...products[0], image: 'https://attacker.example/p.png' }], 120), /untrusted image/);
    assert.throws(() => mapFakeStoreProducts([products[0], products[0]], 120), /duplicate product ID/);
});

test('loads the full demo catalog without duplicating the hero product in the product grid', async () => {
    const count = await loadFakeStoreCatalog({
        url: 'https://example.test/products',
        usdToBdt: 120,
        fetchImpl: async (url, { signal }) => {
            assert.equal(url, 'https://example.test/products');
            assert.ok(signal);
            return { ok: true, json: async () => products };
        }
    });
    const visible = [...getFeaturedProducts(), ...getNewArrivals(), getHeroProduct()];
    assert.equal(count, products.length);
    assert.equal(visible.length, products.length);
    assert.equal(new Set(visible.map((product) => product.id)).size, products.length);
});

test('updates managed products without changing their catalog order and removes them from checkout lookup', () => {
    const first = {
        id: 'admin-00000000-0000-4000-8000-000000000001',
        name: 'First',
        description: '',
        price: 100,
        oldPrice: null,
        category: 'more',
        image: '/uploads/00000000-0000-4000-8000-000000000001.png'
    };
    const second = { ...first, id: 'admin-00000000-0000-4000-8000-000000000002', name: 'Second' };
    setManagedProducts([first, second]);
    updateManagedProduct({ ...first, name: 'First updated', price: 200 });
    assert.deepEqual(getManagedProducts().map(({ name }) => name), ['First updated', 'Second']);
    assert.equal(getManagedProducts()[0].price, 200);
    removeManagedProduct(first.id);
    assert.deepEqual(getManagedProducts().map(({ id }) => id), [second.id]);
    setManagedProducts([]);
});
