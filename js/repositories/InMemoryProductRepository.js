import { ProductRepository } from './ProductRepository.js';
import { Product } from '../models/Product.js';
import { featuredProductsData, newArrivalsData, heroProductData } from '../data/products.data.js';

export class InMemoryProductRepository extends ProductRepository {
    async getFeatured() { return featuredProductsData.map((d) => new Product(d)); }
    async getNewArrivals() { return newArrivalsData.map((d) => new Product(d)); }
    async getAll() { return [...featuredProductsData, ...newArrivalsData].map((d) => new Product(d)); }
    async getHeroOffer() { return new Product(heroProductData); }
}
