import { Observable } from '../utils/Observable.js';

export class HomeViewModel {
    categories = new Observable([]);
    featured = new Observable([]);
    newArrivals = new Observable([]);
    heroOffer = new Observable(null);
    #allFeatured = [];
    #lookup = new Map();

    constructor(productRepository, categoryRepository) {
        this.products = productRepository;
        this.categoryRepo = categoryRepository;
    }
    async load() {
        const [categories, featured, arrivals, hero] = await Promise.all([
            this.categoryRepo.getAll(), this.products.getFeatured(),
            this.products.getNewArrivals(), this.products.getHeroOffer()
        ]);
        [...featured, ...arrivals, hero].forEach((p) => this.#lookup.set(String(p.id), p));
        this.#allFeatured = featured;
        this.categories.set(categories);
        this.featured.set(featured);
        this.newArrivals.set(arrivals);
        this.heroOffer.set(hero);
    }
    findProduct(id) { return this.#lookup.get(String(id)); }
    search(query) {
        const q = query.trim().toLowerCase();
        this.featured.set(this.#allFeatured.filter((p) => p.name.toLowerCase().includes(q)));
    }
}
