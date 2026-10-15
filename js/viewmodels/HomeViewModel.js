import { Observable } from '../utils/Observable.js';

export class HomeViewModel {
    categories = new Observable([]);
    featured = new Observable([]);
    newArrivals = new Observable([]);
    heroOffer = new Observable(null);
    activeCategory = new Observable('all');
    wishlistOnly = new Observable(false);
    dealsOnly = new Observable(false);
    loading = new Observable(true);
    #allFeatured = [];
    #allProducts = [];
    #query = '';
    #lookup = new Map();
    #showAllProducts = false;

    constructor(productRepository, categoryRepository) {
        this.products = productRepository;
        this.categoryRepo = categoryRepository;
    }
    get query() { return this.#query; }
    get hasActiveFilters() {
        return Boolean(this.#query) || this.activeCategory.value !== 'all'
            || this.wishlistOnly.value || this.dealsOnly.value;
    }
    async load() {
        this.loading.set(true);
        try {
            const [categories, featured, arrivals, hero, allProducts] = await Promise.all([
                this.categoryRepo.getAll(), this.products.getFeatured(),
                this.products.getNewArrivals(), this.products.getHeroOffer(),
                typeof this.products.getAll === 'function'
                    ? this.products.getAll()
                    : Promise.resolve(null)
            ]);
            const products = allProducts || [...featured, ...arrivals];
            [...products, hero].filter(Boolean).forEach((p) => this.#lookup.set(String(p.id), p));
            this.#allFeatured = featured;
            this.#allProducts = products;
            this.categories.set(categories);
            this.featured.set(featured);
            this.newArrivals.set(arrivals);
            this.heroOffer.set(hero);
        } finally {
            this.loading.set(false);
        }
    }
    findProduct(id) { return this.#lookup.get(String(id)); }
    getAllProducts() { return [...this.#allProducts]; }
    search(query) {
        this.#query = query.trim().toLowerCase();
        this.#showAllProducts = false;
        this.#applyFilters();
    }
    setCategory(category) {
        this.activeCategory.set(category);
        this.wishlistOnly.set(false);
        this.dealsOnly.set(false);
        this.#showAllProducts = false;
        this.#applyFilters();
    }
    showDeals() {
        this.dealsOnly.set(true);
        this.wishlistOnly.set(false);
        this.activeCategory.set('all');
        this.#showAllProducts = false;
        this.#applyFilters();
    }
    toggleWishlistFilter() {
        const enabled = !this.wishlistOnly.value;
        this.wishlistOnly.set(enabled);
        if (enabled) this.activeCategory.set('all');
        this.#showAllProducts = false;
        this.#applyFilters();
    }
    clearFilters() {
        this.#query = '';
        this.activeCategory.set('all');
        this.wishlistOnly.set(false);
        this.dealsOnly.set(false);
        this.#showAllProducts = false;
        this.#applyFilters();
    }
    showAll() {
        this.#query = '';
        this.activeCategory.set('all');
        this.wishlistOnly.set(false);
        this.dealsOnly.set(false);
        this.#showAllProducts = true;
        this.#applyFilters();
    }
    #applyFilters() {
        const isFiltering = this.#showAllProducts || Boolean(this.#query) || this.activeCategory.value !== 'all' || this.wishlistOnly.value || this.dealsOnly.value;
        const products = isFiltering ? this.#allProducts : this.#allFeatured;
        this.featured.set(products.filter((p) => {
            const matchesQuery = !this.#query || p.name.toLowerCase().includes(this.#query);
            const matchesCategory = this.activeCategory.value === 'all' || p.category === this.activeCategory.value;
            return matchesQuery && matchesCategory && (!this.dealsOnly.value || p.hasDiscount);
        }));
        this.isFiltering.set(isFiltering);
    }
    isFiltering = new Observable(false);
}
