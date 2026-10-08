import { Observable } from '../utils/Observable.js';

export class HomeViewModel {
    categories = new Observable([]);
    featured = new Observable([]);
    newArrivals = new Observable([]);
    heroOffer = new Observable(null);
    activeCategory = new Observable('all');
    wishlistOnly = new Observable(false);
    dealsOnly = new Observable(false);
    #allFeatured = [];
    #allProducts = [];
    #query = '';
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
        this.#allProducts = [...featured, ...arrivals];
        this.categories.set(categories);
        this.featured.set(featured);
        this.newArrivals.set(arrivals);
        this.heroOffer.set(hero);
    }
    findProduct(id) { return this.#lookup.get(String(id)); }
    search(query) {
        this.#query = query.trim().toLowerCase();
        this.#applyFilters();
    }
    setCategory(category) {
        this.activeCategory.set(category);
        this.wishlistOnly.set(false);
        this.dealsOnly.set(false);
        this.#applyFilters();
    }
    showDeals() {
        this.dealsOnly.set(true);
        this.wishlistOnly.set(false);
        this.activeCategory.set('all');
        this.#applyFilters();
    }
    toggleWishlistFilter() {
        const enabled = !this.wishlistOnly.value;
        this.wishlistOnly.set(enabled);
        if (enabled) this.activeCategory.set('all');
        this.#applyFilters();
    }
    clearFilters() {
        this.#query = '';
        this.activeCategory.set('all');
        this.wishlistOnly.set(false);
        this.dealsOnly.set(false);
        this.#applyFilters();
    }
    #applyFilters() {
        const isFiltering = Boolean(this.#query) || this.activeCategory.value !== 'all' || this.wishlistOnly.value || this.dealsOnly.value;
        const products = isFiltering ? this.#allProducts : this.#allFeatured;
        this.featured.set(products.filter((p) => {
            const matchesQuery = !this.#query || `${p.name} ${p.category}`.toLowerCase().includes(this.#query);
            const matchesCategory = this.activeCategory.value === 'all'
                || this.activeCategory.value === 'more'
                || p.category === this.activeCategory.value;
            return matchesQuery && matchesCategory && (!this.dealsOnly.value || p.hasDiscount);
        }));
        this.isFiltering.set(isFiltering);
    }
    isFiltering = new Observable(false);
}
