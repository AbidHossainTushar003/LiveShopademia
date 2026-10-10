import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeViewModel } from './HomeViewModel.js';
import { InMemoryProductRepository } from '../repositories/InMemoryProductRepository.js';
import { CategoryRepository } from '../repositories/CategoryRepository.js';

async function loadHome() {
    const home = new HomeViewModel(new InMemoryProductRepository(), new CategoryRepository());
    assert.equal(home.loading.value, true);
    await home.load();
    assert.equal(home.loading.value, false);
    return home;
}

test('category filters include only products in that category', async () => {
    const home = await loadHome();
    home.setCategory('gadgets');
    assert.ok(home.featured.value.length > 0);
    assert.ok(home.featured.value.every((product) => product.category === 'gadgets'));
});

test('More displays only fallback products mapped to the other category', async () => {
    const home = await loadHome();
    home.setCategory('more');
    assert.ok(home.featured.value.length > 0);
    assert.ok(home.featured.value.every((product) => product.category === 'more'));
});

test('search includes arrivals and deals show only discounted items', async () => {
    const home = await loadHome();
    home.search('blender');
    assert.deepEqual(home.featured.value.map((product) => product.name), ['Portable Blender']);
    home.clearFilters();
    home.showDeals();
    assert.ok(home.featured.value.length > 0);
    assert.ok(home.featured.value.every((product) => product.hasDiscount));
});

test('view all includes arrivals without duplicating the featured list', async () => {
    const home = await loadHome();
    const initialCount = home.featured.value.length;
    home.setCategory('gadgets');
    home.search('wireless');
    home.showAll();
    assert.equal(home.featured.value.length, initialCount + home.newArrivals.value.length);
    assert.equal(new Set(home.featured.value.map((product) => product.id)).size, home.featured.value.length);
    assert.equal(home.isFiltering.value, true);
    home.search('');
    assert.equal(home.featured.value.length, initialCount);
    assert.equal(home.isFiltering.value, false);
});

test('clearing filters restores the default split catalog while view all stays explicit', async () => {
    const home = await loadHome();
    const featuredCount = home.featured.value.length;
    home.showDeals();
    home.clearFilters();
    assert.equal(home.featured.value.length, featuredCount);
    assert.equal(home.isFiltering.value, false);
    home.showAll();
    assert.equal(home.featured.value.length, featuredCount + home.newArrivals.value.length);
    assert.equal(home.isFiltering.value, true);
});

test('search matches product descriptions', async () => {
    const home = new HomeViewModel({
        async getFeatured() {
            return [{ id: 1, name: 'Desk accessory', description: 'Rechargeable travel light', category: 'more' }];
        },
        async getNewArrivals() { return []; },
        async getHeroOffer() { return { id: 2, name: 'Featured item', category: 'gadgets' }; }
    }, new CategoryRepository());
    await home.load();
    home.search('rechargeable');
    assert.deepEqual(home.featured.value.map((product) => product.name), ['Desk accessory']);
});

test('all catalog products are available to direct product routes', async () => {
    const listedProduct = { id: 'featured', name: 'Featured item', category: 'gadgets' };
    const detailOnlyProduct = { id: 'detail-only', name: 'Catalog item', category: 'more' };
    const home = new HomeViewModel({
        async getFeatured() { return [listedProduct]; },
        async getNewArrivals() { return []; },
        async getAll() { return [listedProduct, detailOnlyProduct]; },
        async getHeroOffer() { return null; }
    }, new CategoryRepository());

    await home.load();

    assert.equal(home.findProduct('detail-only'), detailOnlyProduct);
    assert.deepEqual(home.getAllProducts(), [listedProduct, detailOnlyProduct]);
});

test('catalog loading state clears and load failures remain visible to callers', async () => {
    const home = new HomeViewModel({
        async getFeatured() { throw new Error('catalog unavailable'); },
        async getNewArrivals() { return []; },
        async getHeroOffer() { return {}; }
    }, new CategoryRepository());
    await assert.rejects(home.load(), /catalog unavailable/);
    assert.equal(home.loading.value, false);
});
