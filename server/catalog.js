import { featuredProductsData, newArrivalsData, heroProductData } from '../js/data/products.data.js';

const tintByCategory = Object.freeze({
    gadgets: 'blue',
    accessories: 'purple',
    clothing: 'rose',
    more: 'slate'
});

const iconByCategory = Object.freeze({
    gadgets: 'fa-laptop',
    accessories: 'fa-gem',
    clothing: 'fa-shirt',
    more: 'fa-box'
});

export const DEFAULT_SHOP_ID = '00000000-0000-4000-8000-000000000001';
let products = [...featuredProductsData, ...newArrivalsData];
let heroProduct = heroProductData;
const baseProducts = [...products];
let managedProducts = [];
let productsById = new Map([...products, heroProduct].filter(Boolean).map((product) => [String(product.id), product]));

function refreshProducts() {
    products = [...baseProducts.slice(0, Math.ceil(baseProducts.length / 2)), ...managedProducts, ...baseProducts.slice(Math.ceil(baseProducts.length / 2))];
    productsById = new Map(products.map((product) => [String(product.id), product]));
}

export function setManagedProducts(records) {
    if (!Array.isArray(records)) throw new Error('Managed product catalog must be an array.');
    managedProducts = records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        imageAlt: record.imageAlt || record.name,
        seoTitle: record.seoTitle || record.name,
        metaDescription: record.metaDescription || (record.description?.length > 160
            ? `${record.description.slice(0, 157).trimEnd()}…`
            : record.description || ''),
        price: Number(record.price),
        oldPrice: record.oldPrice === null ? null : Number(record.oldPrice),
        rating: 0,
        reviews: '0',
        image: record.image,
        images: Array.isArray(record.images) && record.images.length
            ? record.images
            : (record.image ? [record.image] : []),
        stockQuantity: record.stockQuantity == null ? 0 : Number(record.stockQuantity),
        isAvailable: record.isAvailable !== false,
        isArchived: record.isArchived === true,
        shopId: record.shopId ?? DEFAULT_SHOP_ID,
        icon: iconByCategory[record.category] || 'fa-box',
        tint: tintByCategory[record.category] || 'slate',
        category: record.category
    }));
    refreshProducts();
}

export function getManagedProducts() {
    return managedProducts;
}

export function addManagedProduct(record) {
    setManagedProducts([record, ...managedProducts]);
    return productsById.get(String(record.id));
}

export function updateManagedProduct(record) {
    const index = managedProducts.findIndex((product) => String(product.id) === String(record.id));
    if (index === -1) {
        setManagedProducts([record, ...managedProducts]);
    } else {
        const updated = [...managedProducts];
        updated[index] = record;
        setManagedProducts(updated);
    }
    return productsById.get(String(record.id));
}

export function removeManagedProduct(id) {
    setManagedProducts(managedProducts.filter((product) => String(product.id) !== String(id)));
    return true;
}

export function updateManagedStock(stockUpdates) {
    if (!Array.isArray(stockUpdates) || stockUpdates.length === 0) return;
    const quantities = new Map(stockUpdates.map(({ id, stockQuantity }) => [String(id), Number(stockQuantity)]));
    setManagedProducts(managedProducts.map((product) => quantities.has(String(product.id))
        ? { ...product, stockQuantity: quantities.get(String(product.id)) }
        : product));
}

export function getFeaturedProducts() {
    const visible = products.filter((product) => !product.isArchived);
    return visible.slice(0, Math.ceil(visible.length / 2));
}

export function getNewArrivals() {
    const visible = products.filter((product) => !product.isArchived);
    return visible.slice(Math.ceil(visible.length / 2));
}

export function getHeroProduct() {
    return heroProduct;
}

export function findProduct(id) {
    const key = String(id);
    return productsById.get(key) ?? (heroProduct && String(heroProduct.id) === key ? heroProduct : undefined);
}

export function getProductsForShop(shopId) {
    return [
        ...(shopId === DEFAULT_SHOP_ID ? baseProducts.map((product) => ({ ...product, shopId: DEFAULT_SHOP_ID })) : []),
        ...managedProducts.filter((product) => product.shopId === shopId && !product.isArchived)
    ];
}

export function getUploadedProductsForShop(shopId) {
    return managedProducts.filter((product) => product.shopId === shopId && !product.isArchived);
}

export function getHeroProductForShop(shopId) {
    if (shopId === DEFAULT_SHOP_ID) return heroProduct;
    return getProductsForShop(shopId).find((product) => product.oldPrice && product.oldPrice > product.price)
        ?? getProductsForShop(shopId)[0]
        ?? null;
}

export function getAllProducts() {
    return [
        ...baseProducts.map((product) => ({ ...product, shopId: DEFAULT_SHOP_ID })),
        ...managedProducts.filter((product) => !product.isArchived)
    ];
}

export function findProductForShop(id, shopId) {
    const product = findProduct(id);
    if (!product) return undefined;
    return !product.isArchived && (product.shopId ?? DEFAULT_SHOP_ID) === shopId ? product : undefined;
}

export function getCategories(shopId = null) {
    const categoryNames = {
        gadgets: { name: 'Electronics', icon: 'fa-laptop', gradient: 'from-blue-100 to-cyan-50', color: 'text-blue-600' },
        accessories: { name: 'Jewelry & Accessories', icon: 'fa-gem', gradient: 'from-purple-100 to-pink-50', color: 'text-purple-600' },
        clothing: { name: 'Clothing', icon: 'fa-shirt', gradient: 'from-rose-100 to-orange-50', color: 'text-rose-600' },
        more: { name: 'Other', icon: 'fa-border-all', gradient: 'from-slate-200 to-slate-100', color: 'text-slate-700' }
    };
    const scopedProducts = shopId ? getProductsForShop(shopId) : [...products, heroProduct].filter(Boolean);
    const available = new Set(scopedProducts.map((product) => product.category));
    return Object.entries(categoryNames)
        .filter(([id]) => available.has(id))
        .map(([id, data]) => ({ id, ...data }));
}
