import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export class ProductGridView {
    constructor(root, { homeVM, cartVM, wishlistVM }) {
        this.root = root;
        this.homeVM = homeVM; this.cartVM = cartVM; this.wishlistVM = wishlistVM;
        homeVM.featured.subscribe(() => this.render());
        homeVM.wishlistOnly.subscribe(() => this.render());
        homeVM.dealsOnly.subscribe(() => this.render());
        wishlistVM.ids.subscribe(() => this.render());
        root.addEventListener('click', (e) => this.#onClick(e));
        root.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling.classList.remove('hidden');
        }, true);
        document.getElementById('dealsButton').addEventListener('click', () => {
            homeVM.showDeals();
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
    }
    #onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'clear-filters') {
            this.homeVM.clearFilters();
            document.getElementById('searchInput').value = '';
            document.getElementById('mobileSearchInput').value = '';
            return;
        }
        const product = this.homeVM.findProduct(btn.closest('[data-id]').dataset.id);
        if (btn.dataset.action === 'add') this.cartVM.add(product);
        if (btn.dataset.action === 'wishlist') this.wishlistVM.toggle(product);
    }
    render() {
        const wished = this.wishlistVM.ids.value;
        const products = this.homeVM.featured.value.filter((p) => !this.homeVM.wishlistOnly.value || wished.has(String(p.id)));
        const emptyMessage = this.homeVM.dealsOnly.value
            ? 'No current discounts are available. Check back soon.'
            : this.homeVM.wishlistOnly.value
                ? 'Your wishlist is empty.'
                : 'No products found.';
        const emptyHint = this.homeVM.dealsOnly.value
            ? 'Browse our featured products or check back later.'
            : 'Try another search or browse all products.';
        this.root.innerHTML = products.length
            ? products.map((p) => this.#card(p, wished.has(String(p.id)))).join('')
            : `<div class="sm:col-span-2 lg:col-span-5 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
                <p class="font-bold text-slate-700">${emptyMessage}</p>
                <p class="mt-1 text-sm text-slate-500">${emptyHint}</p>
                <button data-action="clear-filters" class="mt-4 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Browse all products</button>
            </div>`;
    }
    #card(p, isWished) {
        const imageUrl = isSafeProductImage(p.image) ? p.image : '';
        const icon = /^[a-z0-9-]+$/.test(p.icon) ? p.icon : 'fa-box';
        const available = p.isAvailableForPurchase !== false;
        const availabilityLabel = p.isAvailable === false ? 'Unavailable' : 'Out of stock';
        return `
        <div data-id="${p.id}" class="glass-card rounded-2xl p-4 flex flex-col justify-between relative group border border-white/90">
            ${p.hasDiscount ? `<span class="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">-${p.discountPercent}%</span>` : ''}
            ${available ? '' : `<span class="absolute top-10 left-3 bg-slate-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10">${availabilityLabel}</span>`}
            <button data-action="wishlist" aria-label="${isWished ? 'Remove from wishlist' : 'Add to wishlist'}" aria-pressed="${isWished}" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white ${isWished ? 'text-rose-500' : 'text-slate-400'} hover:text-rose-500 flex items-center justify-center z-10 transition-colors shadow-sm">
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart text-sm"></i>
            </button>
            <div class="w-full aspect-square rounded-xl bg-gradient-to-b from-slate-50 to-blue-50/30 flex items-center justify-center p-4 mb-3 overflow-hidden">
                ${imageUrl ? `<img data-product-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" class="h-full w-full object-contain mix-blend-multiply">` : ''}
                <i class="fa-solid ${escapeHtml(icon)} ${imageUrl ? 'hidden' : ''} text-6xl text-slate-700 group-hover:scale-110 transition-transform duration-300 drop-shadow-md"></i>
            </div>
            <div>
                <h3 class="font-bold text-slate-800 text-sm leading-snug line-clamp-1">${escapeHtml(p.name)}</h3>
                ${p.description ? `<p class="mt-1 text-xs leading-5 text-slate-500 line-clamp-2">${escapeHtml(p.description)}</p>` : ''}
                <div class="mt-1 flex items-baseline gap-2">
                    <span class="text-base font-extrabold text-blue-700">${formatPrice(p.price)}</span>
                    ${p.hasDiscount ? `<span class="text-xs text-slate-400 line-through">${formatPrice(p.oldPrice)}</span>` : ''}
                </div>
                <div class="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                    <i class="fa-solid fa-star text-amber-400 text-[11px]"></i>
                    <span class="font-bold text-slate-800">${p.rating}</span><span>(${escapeHtml(p.reviews)})</span>
                </div>
            </div>
            <button data-action="add" ${available ? '' : 'disabled'} class="w-full mt-4 py-2 rounded-xl ${available ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'} text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all">
                <i class="fa-solid ${available ? 'fa-cart-shopping' : 'fa-ban'}"></i><span>${available ? 'Add to Cart' : availabilityLabel}</span>
            </button>
        </div>`;
    }
}
