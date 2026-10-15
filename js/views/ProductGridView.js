import { renderProductCard } from './productCard.js';

export class ProductGridView {
    constructor(root, { homeVM, cartVM, checkoutVM, wishlistVM, shopSlug = 'main' }) {
        this.root = root;
        this.homeVM = homeVM; this.cartVM = cartVM; this.checkoutVM = checkoutVM; this.wishlistVM = wishlistVM;
        this.shopSlug = shopSlug;
        this.resultsStatus = document.getElementById('productResultsStatus');
        this.clearFiltersButton = document.getElementById('clearProductFilters');
        homeVM.featured.subscribe(() => this.render());
        homeVM.wishlistOnly.subscribe(() => this.render());
        homeVM.dealsOnly.subscribe(() => this.render());
        homeVM.activeCategory.subscribe(() => this.render());
        homeVM.isFiltering.subscribe(() => this.render());
        homeVM.loading.subscribe(() => this.render());
        wishlistVM.ids.subscribe(() => this.render());
        this.clearFiltersButton.addEventListener('click', () => this.#clearFilters());
        root.addEventListener('click', (e) => this.#onClick(e));
        root.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling.classList.remove('hidden');
        }, true);
        document.getElementById('dealsButton').addEventListener('click', () => {
            window.location.assign(`/deals?shop=${encodeURIComponent(this.shopSlug)}`);
        });
        document.querySelectorAll('[data-show-all-products]').forEach((button) => {
            button.addEventListener('click', () => {
                homeVM.showAll();
                this.#clearSearchInputs();
                document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
            });
        });
    }
    #clearSearchInputs() {
        document.getElementById('searchInput').value = '';
        document.getElementById('mobileSearchInput').value = '';
    }
    #clearFilters() {
        this.homeVM.clearFilters();
        this.#clearSearchInputs();
    }
    #onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'clear-filters') {
            this.#clearFilters();
            return;
        }
        if (btn.dataset.action === 'show-all-products') {
            this.homeVM.showAll();
            this.#clearSearchInputs();
            return;
        }
        const product = this.homeVM.findProduct(btn.closest('[data-id]').dataset.id);
        if (btn.dataset.action === 'add') this.cartVM.add(product);
        if (btn.dataset.action === 'buy-now' && this.cartVM.add(product)) this.checkoutVM.open();
        if (btn.dataset.action === 'wishlist') this.wishlistVM.toggle(product);
    }
    render() {
        if (this.homeVM.loading.value) {
            this.resultsStatus.textContent = 'Loading products…';
            this.clearFiltersButton.classList.add('hidden');
            this.root.innerHTML = '';
            return;
        }
        const wished = this.wishlistVM.ids.value;
        const products = this.homeVM.featured.value.filter((p) => !this.homeVM.wishlistOnly.value || wished.has(String(p.id)));
        const emptyMessage = this.homeVM.dealsOnly.value
            ? 'No current discounts are available. Check back soon.'
            : this.homeVM.wishlistOnly.value
                ? 'Your wishlist is empty.'
                : this.homeVM.hasActiveFilters
                    ? 'No matching products found.'
                    : 'No products are available right now.';
        const emptyHint = this.homeVM.dealsOnly.value
            ? 'Clear filters to browse the full catalog, or check back later.'
            : this.homeVM.hasActiveFilters
                ? 'Try changing your search or filters, or browse all products.'
                : 'Please check back later.';
        const category = this.homeVM.categories.value.find((item) => item.id === this.homeVM.activeCategory.value);
        const filters = [
            this.homeVM.query ? `matching “${this.homeVM.query}”` : '',
            category ? `in ${category.name}` : '',
            this.homeVM.dealsOnly.value ? 'on discount' : '',
            this.homeVM.wishlistOnly.value ? 'from your wishlist' : ''
        ].filter(Boolean);
        this.resultsStatus.textContent = this.homeVM.isFiltering.value
            ? `Showing ${products.length} ${products.length === 1 ? 'product' : 'products'}${filters.length ? ` ${filters.join(' · ')}` : ' in the full catalog'}.`
            : `Showing ${products.length} ${products.length === 1 ? 'product' : 'products'}.`;
        this.clearFiltersButton.classList.toggle('hidden', !this.homeVM.hasActiveFilters);
        this.root.innerHTML = products.length
            ? products.map((p) => this.#card(p, wished.has(String(p.id)))).join('')
            : `<div class="sm:col-span-2 lg:col-span-5 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
                <p class="font-bold text-slate-700">${emptyMessage}</p>
                <p class="mt-1 text-sm text-slate-600">${emptyHint}</p>
                <button data-action="show-all-products" class="mt-4 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Browse all products</button>
            </div>`;
    }
    #card(p, isWished) {
        return renderProductCard({ product: p, shopSlug: this.shopSlug, isWished });
    }
}
