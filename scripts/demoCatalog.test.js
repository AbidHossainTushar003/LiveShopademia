import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PRODUCTS, DEMO_SHOPS, getDemoCatalogCounts } from './demoCatalog.js';

test('demo catalog contains 15–20 clearly labeled shops with 30–40 complete products each', () => {
    const counts = getDemoCatalogCounts();
    assert.ok(counts.shops >= 15 && counts.shops <= 20);
    assert.ok(counts.minProductsPerShop >= 30 && counts.maxProductsPerShop <= 40);
    assert.equal(counts.products, DEMO_SHOPS.length * 32);
    assert.ok(DEMO_SHOPS.every(({ name, slug, description }) =>
        name.startsWith('Demo ') && slug.startsWith('demo-') && description.includes('fictional')));
    assert.ok(DEMO_PRODUCTS.every((product) =>
        product.name && product.description && product.imageAlt && product.seoTitle
        && product.metaDescription && Number.isSafeInteger(product.price)
        && product.category && product.stockQuantity > 0 && product.isAvailable
        && /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/.test(product.image)
        && product.images.length === 1 && product.images[0] === product.image));
});

test('demo catalog product and shop identifiers are stable and unique', () => {
    assert.equal(new Set(DEMO_SHOPS.map(({ id }) => id)).size, DEMO_SHOPS.length);
    assert.equal(new Set(DEMO_SHOPS.map(({ slug }) => slug)).size, DEMO_SHOPS.length);
    assert.equal(new Set(DEMO_PRODUCTS.map(({ id }) => id)).size, DEMO_PRODUCTS.length);
    assert.ok(DEMO_PRODUCTS.every(({ id }) => /^admin-[0-9a-f-]{36}$/.test(id)));
});
