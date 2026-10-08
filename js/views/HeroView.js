import { escapeHtml, formatPrice } from '../utils/format.js';

export class HeroView {
    constructor({ homeVM, cartVM, heroVM }) {
        const card = document.getElementById('heroOfferCard');
        const stage = document.getElementById('heroSlideContainer');
        homeVM.heroOffer.subscribe((p) => p && this.#renderOffer(card, p));
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="add"]')) cartVM.add(homeVM.heroOffer.value);
        });
        document.getElementById('heroPrevBtn').addEventListener('click', () => heroVM.switchShowcase());
        document.getElementById('heroNextBtn').addEventListener('click', () => heroVM.switchShowcase());
        heroVM.dimmed.subscribe((d) => { stage.style.opacity = d ? '0.4' : '1'; });
    }
    #renderOffer(card, p) {
        card.innerHTML = `
            <span class="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider">Best Seller</span>
            <h4 class="text-xs font-bold text-slate-900 mt-1.5 leading-tight">Premium Tech, Better Everyday.</h4>
            <p class="text-[10px] text-slate-500 mt-0.5">Latest gadgets for a smarter you.</p>
            <div class="mt-2 flex items-baseline gap-1.5">
                <span class="text-sm font-extrabold text-blue-700">${formatPrice(p.price)}</span>
                ${p.hasDiscount ? `<span class="text-[10px] text-slate-400 line-through">${formatPrice(p.oldPrice)}</span>
                <span class="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">-${p.discountPercent}%</span>` : ''}
            </div>
            <button data-action="add" title="${escapeHtml(p.name)}" class="w-full mt-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm">
                <span>Add to Cart</span><i class="fa-solid fa-arrow-right text-[10px]"></i>
            </button>`;
    }
}
