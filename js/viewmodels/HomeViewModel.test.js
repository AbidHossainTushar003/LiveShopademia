import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeViewModel } from './HomeViewModel.js';
import { InMemoryProductRepository } from '../repositories/InMemoryProductRepository.js';
import { CategoryRepository } from '../repositories/CategoryRepository.js';

async function loadHome() {
    const home = new HomeViewModel(new InMemoryProductRepository(), new CategoryRepository());
    await home.load();
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
