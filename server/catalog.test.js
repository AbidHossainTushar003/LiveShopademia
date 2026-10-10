import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getFeaturedProducts,
    getHeroProduct,
    getManagedProducts,
    getNewArrivals,
    removeManagedProduct,
    setManagedProducts,
    updateManagedProduct
} from './catalog.js';

test('starts with no bundled products or hero offer', () => {
    assert.deepEqual(getFeaturedProducts(), []);
    assert.deepEqual(getNewArrivals(), []);
    assert.equal(getHeroProduct(), null);
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
