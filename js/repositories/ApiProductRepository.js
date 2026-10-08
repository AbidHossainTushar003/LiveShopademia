import { ProductRepository } from './ProductRepository.js';
import { Product } from '../models/Product.js';

/**
 * Talks to the central API. Adjust endpoint paths/field mapping to your backend.
 * Enable it in main.js by replacing InMemoryProductRepository.
 */
export class ApiProductRepository extends ProductRepository {
    constructor(baseUrl = 'https://api.shopademia.store/api/v1') { super(); this.baseUrl = baseUrl; }
    async #get(path) {
        const res = await fetch(`${this.baseUrl}${path}`);
        if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
        return res.json();
    }
    async getFeatured() { return (await this.#get('/products?featured=true')).data.map((d) => new Product(d)); }
    async getNewArrivals() { return (await this.#get('/products?sort=newest&limit=5')).data.map((d) => new Product(d)); }
    async getHeroOffer() { return new Product((await this.#get('/products/hero-offer')).data); }
}
