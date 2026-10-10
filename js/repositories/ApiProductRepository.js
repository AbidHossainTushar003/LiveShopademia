import { ProductRepository } from './ProductRepository.js';
import { Product } from '../models/Product.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

/** Reads the server-owned storefront catalog and its current prices. */
export class ApiProductRepository extends ProductRepository {
    constructor(baseUrl = '/api/v1', shopSlug = null) {
        super();
        this.baseUrl = baseUrl;
        this.shopPath = shopSlug ? `/shops/${encodeURIComponent(shopSlug)}` : '';
    }
    async #get(path) {
        const res = await fetchWithTimeout(`${this.baseUrl}${path}`);
        if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
        return res.json();
    }
    async getFeatured() { return (await this.#get(`${this.shopPath}/products?featured=true`)).data.map((d) => new Product(d)); }
    async getNewArrivals() { return (await this.#get(`${this.shopPath}/products?sort=newest&limit=50`)).data.map((d) => new Product(d)); }
    async getAll() { return (await this.#get(`${this.shopPath}/products`)).data.map((d) => new Product(d)); }
    async getHeroOffer() {
        const data = (await this.#get(this.shopPath ? `${this.shopPath}/products/hero-offer` : '/products/hero-offer')).data;
        return data ? new Product(data) : null;
    }
}
