import { escapeHtml, formatPrice } from '../utils/format.js';

export class ProductGridView {
    constructor(root, { homeVM, cartVM, wishlistVM }) {
        this.root = root;
        this.homeVM = homeVM; this.cartVM = cartVM; this.wishlistVM = wishlistVM;
        homeVM.featured.subscribe(() => this.render());
        wishlistVM.ids.subscribe(() => this.render());
        root.addEventListener('click', (e) => this.#onClick(e));
    }
    #onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const product = this.homeVM.findProduct(btn.closest('[data-id]').dataset.id);
        if (btn.dataset.action === 'add') this.cartVM.add(product);
        if (btn.dataset.action === 'wishlist') this.wishlistVM.toggle(product);
    }
    render() {
        const wished = this.wishlistVM.ids.value;
        this.root.innerHTML = this.homeVM.featured.value.map((p) => this.#card(p, wished.has(p.id))).join('');
    }
    #card(p, isWished) {
        return `
        <div data-id="${p.id}" class="glass-card rounded-2xl p-4 flex flex-col justify-between relative group border border-white/90">
            ${p.hasDiscount ? `<span class="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">-${p.discountPercent}%</span>` : ''}
            <button data-action="wishlist" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white ${isWished ? 'text-rose-500' : 'text-slate-400'} hover:text-rose-500 flex items-center justify-center z-10 transition-colors shadow-sm">
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart text-sm"></i>
            </button>
            <div class="w-full aspect-square rounded-xl bg-gradient-to-b from-slate-50 to-blue-50/30 flex items-center justify-center p-4 mb-3 overflow-hidden">
                <i class="fa-solid ${p.icon} text-6xl text-slate-700 group-hover:scale-110 transition-transform duration-300 drop-shadow-md"></i>
            </div>
            <div>
                <h3 class="font-bold text-slate-800 text-sm leading-snug line-clamp-1">${escapeHtml(p.name)}</h3>
                <div class="mt-1 flex items-baseline gap-2">
                    <span class="text-base font-extrabold text-blue-700">${formatPrice(p.price)}</span>
                    ${p.hasDiscount ? `<span class="text-xs text-slate-400 line-through">${formatPrice(p.oldPrice)}</span>` : ''}
                </div>
                <div class="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                    <i class="fa-solid fa-star text-amber-400 text-[11px]"></i>
                    <span class="font-bold text-slate-800">${p.rating}</span><span>(${escapeHtml(p.reviews)})</span>
                </div>
            </div>
            <button data-action="add" class="w-full mt-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-blue-500/20">
                <i class="fa-solid fa-cart-shopping"></i><span>Add to Cart</span>
            </button>
        </div>`;
    }
}
