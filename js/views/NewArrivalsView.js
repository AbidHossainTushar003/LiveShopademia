import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export class NewArrivalsView {
    constructor(root, homeVM, cartVM, wishlistVM, shopSlug = 'main') {
        this.root = root;
        this.homeVM = homeVM;
        this.cartVM = cartVM;
        this.wishlistVM = wishlistVM;
        this.shopSlug = shopSlug;
        homeVM.newArrivals.subscribe((list) => this.render(list));
        homeVM.loading.subscribe(() => this.render(homeVM.newArrivals.value));
        homeVM.isFiltering.subscribe((filtering) => {
            this.root.closest('section').classList.toggle('hidden', filtering);
        });
        root.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling.classList.remove('hidden');
        }, true);
        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const product = homeVM.findProduct(button.closest('[data-id]').dataset.id);
            if (button.dataset.action === 'add') cartVM.add(product);
            if (button.dataset.action === 'wishlist') wishlistVM.toggle(product);
        });
        wishlistVM.ids.subscribe(() => this.render(homeVM.newArrivals.value));
    }
    render(products) {
        if (this.homeVM.loading.value) {
            this.root.innerHTML = '<p role="status" class="col-span-full py-8 text-center text-sm text-slate-500">Loading more products…</p>';
            return;
        }
        if (!products.length) {
            this.root.innerHTML = '<p class="col-span-full py-8 text-center text-sm text-slate-500">No additional products are available right now.</p>';
            return;
        }
        const wished = this.wishlistVM.ids.value;
        this.root.innerHTML = products.map((p) => {
            const imageUrl = isSafeProductImage(p.image) ? p.image : '';
            const available = p.isAvailableForPurchase !== false;
            const availabilityLabel = p.isAvailable === false ? 'Unavailable' : 'Out of stock';
            const isWished = wished.has(String(p.id));
            return `
            <div data-id="${p.id}" class="glass-card rounded-2xl p-3.5 flex items-center gap-3 group relative">
                <button type="button" data-action="wishlist" aria-label="${isWished ? `Remove ${escapeHtml(p.name)} from wishlist` : `Add ${escapeHtml(p.name)} to wishlist`}" aria-pressed="${isWished}" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 ${isWished ? 'text-rose-500' : 'text-slate-400'} hover:text-rose-500 flex items-center justify-center shadow-sm transition-colors">
                    <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart text-sm"></i>
                </button>
                <a href="/product/${encodeURIComponent(p.id)}?shop=${encodeURIComponent(this.shopSlug)}" aria-label="View details for ${escapeHtml(p.name)}" class="w-14 h-14 rounded-xl bg-${/^[a-z]+$/.test(p.tint) ? p.tint : 'slate'}-50 flex items-center justify-center text-${/^[a-z]+$/.test(p.tint) ? p.tint : 'slate'}-600 shrink-0 group-hover:scale-105 transition-transform overflow-hidden focus-visible:outline-2 focus-visible:outline-blue-600">
                    ${imageUrl ? `<img data-product-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" class="h-full w-full object-contain">` : ''}
                    <i aria-hidden="true" class="fa-solid ${/^[a-z0-9-]+$/.test(p.icon) ? p.icon : 'fa-box'} ${imageUrl ? 'hidden' : ''} text-xl"></i>
                </a>
                <div class="overflow-hidden flex-1 self-stretch pt-7">
                    <h4 class="text-xs font-bold text-slate-800 truncate"><a href="/product/${encodeURIComponent(p.id)}?shop=${encodeURIComponent(this.shopSlug)}" aria-label="View details for ${escapeHtml(p.name)}" class="text-left hover:text-blue-700 focus-visible:outline-blue-600">${escapeHtml(p.name)}</a></h4>
                    <p class="text-xs font-extrabold text-blue-700 mt-0.5">${formatPrice(p.price)}</p>
                    ${available ? '' : `<p class="text-[10px] font-bold text-slate-500">${availabilityLabel}</p>`}
                </div>
                <button type="button" data-action="add" ${available ? '' : 'disabled'} aria-label="${available ? `Add ${escapeHtml(p.name)} to cart` : `${escapeHtml(p.name)}: ${availabilityLabel}`}" class="w-8 h-8 shrink-0 rounded-full ${available ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} transition-colors">
                    <i class="fa-solid ${available ? 'fa-plus' : 'fa-ban'} text-xs"></i>
                </button>
            </div>`;
        }).join('');
    }
}
