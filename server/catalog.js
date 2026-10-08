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

let products = [...featuredProductsData, ...newArrivalsData];
let heroProduct = heroProductData;
let baseProducts = [...products];
let managedProducts = [];
let productsById = new Map([...products, heroProduct].map((product) => [String(product.id), product]));

const categoryFor = (sourceCategory) => {
    if (sourceCategory === 'electronics') return 'gadgets';
    if (sourceCategory === 'jewelery') return 'accessories';
    if (sourceCategory === "men's clothing" || sourceCategory === "women's clothing") return 'clothing';
    return 'more';
};

export function mapFakeStoreProducts(records, usdToBdt) {
    if (!Array.isArray(records) || records.length === 0) throw new Error('Fake Store API returned no products.');
    if (!Number.isSafeInteger(usdToBdt) || usdToBdt < 1 || usdToBdt > 10000) {
        throw new Error('DEMO_USD_TO_BDT must be an integer between 1 and 10000.');
    }

    const seenIds = new Set();
    return records.map((record) => {
        if (!Number.isSafeInteger(record?.id) || record.id < 1 || seenIds.has(record.id)) {
            throw new Error('Fake Store API returned an invalid or duplicate product ID.');
        }
        if (typeof record.title !== 'string' || !record.title.trim()
            || !Number.isFinite(record.price) || record.price <= 0
            || typeof record.category !== 'string') {
            throw new Error(`Fake Store API returned invalid product data for ID ${record.id}.`);
        }
        let imageUrl;
        try {
            imageUrl = new URL(record.image);
        } catch {
            throw new Error(`Fake Store API returned an invalid image URL for product ${record.id}.`);
        }
        if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'fakestoreapi.com') {
            throw new Error(`Fake Store API returned an untrusted image URL for product ${record.id}.`);
        }
        seenIds.add(record.id);
        const category = categoryFor(record.category);
        const price = Math.round(record.price * usdToBdt);
        if (!Number.isSafeInteger(price) || price <= 0) throw new Error(`Invalid converted price for product ${record.id}.`);
        const rating = Number.isFinite(record.rating?.rate) ? Math.min(Math.max(record.rating.rate, 0), 5) : 0;
        const reviewCount = Number.isInteger(record.rating?.count) ? Math.max(record.rating.count, 0) : 0;
        return {
            id: record.id,
            name: record.title.trim().slice(0, 250),
            description: typeof record.description === 'string' ? record.description.trim().slice(0, 2000) : '',
            price,
            oldPrice: null,
            rating,
            reviews: String(reviewCount),
            image: imageUrl.href,
            icon: iconByCategory[category],
            tint: tintByCategory[category],
            category
        };
    });
}

export async function loadFakeStoreCatalog({ url = 'https://fakestoreapi.com/products', usdToBdt = 120, fetchImpl = fetch } = {}) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Fake Store API returned HTTP ${response.status}.`);
    const mappedProducts = mapFakeStoreProducts(await response.json(), usdToBdt);
    setProducts(mappedProducts);
    return mappedProducts.length;
}

export function setProducts(nextProducts) {
    if (!Array.isArray(nextProducts) || nextProducts.length < 2) throw new Error('Catalog must contain at least two products.');
    heroProduct = nextProducts[0];
    baseProducts = nextProducts.slice(1);
    refreshProducts();
}

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
        price: Number(record.price),
        oldPrice: record.oldPrice === null ? null : Number(record.oldPrice),
        rating: 0,
        reviews: '0',
        image: record.image,
        stockQuantity: record.stockQuantity == null ? 0 : Number(record.stockQuantity),
        isAvailable: record.isAvailable !== false,
        icon: iconByCategory[record.category],
        tint: tintByCategory[record.category],
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
    return products.slice(0, Math.ceil(products.length / 2));
}

export function getNewArrivals() {
    return products.slice(Math.ceil(products.length / 2));
}

export function getHeroProduct() {
    return heroProduct;
}

export function findProduct(id) {
    const key = String(id);
    return productsById.get(key) ?? (String(heroProduct.id) === key ? heroProduct : undefined);
}

export function getCategories() {
    const categoryNames = {
        gadgets: { name: 'Electronics', icon: 'fa-laptop', gradient: 'from-blue-100 to-cyan-50', color: 'text-blue-600' },
        accessories: { name: 'Jewelry & Accessories', icon: 'fa-gem', gradient: 'from-purple-100 to-pink-50', color: 'text-purple-600' },
        clothing: { name: 'Clothing', icon: 'fa-shirt', gradient: 'from-rose-100 to-orange-50', color: 'text-rose-600' },
        more: { name: 'Other', icon: 'fa-border-all', gradient: 'from-slate-200 to-slate-100', color: 'text-slate-700' }
    };
    const available = new Set([...products, heroProduct].map((product) => product.category));
    return Object.entries(categoryNames)
        .filter(([id]) => available.has(id))
        .map(([id, data]) => ({ id, ...data }));
}
