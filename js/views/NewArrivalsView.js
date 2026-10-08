import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export class NewArrivalsView {
    constructor(root, homeVM, cartVM) {
        this.root = root;
        this.homeVM = homeVM;
        this.cartVM = cartVM;
        homeVM.newArrivals.subscribe((list) => this.render(list));
        homeVM.isFiltering.subscribe((filtering) => {
            this.root.closest('section').classList.toggle('hidden', filtering);
        });
        root.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling.classList.remove('hidden');
        }, true);
        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action="add"]');
            if (button) cartVM.add(homeVM.findProduct(button.closest('[data-id]').dataset.id));
        });
    }
    render(products) {
        this.root.innerHTML = products.map((p, i) => {
            const imageUrl = isSafeProductImage(p.image) ? p.image : '';
            const available = p.isAvailableForPurchase !== false;
            const availabilityLabel = p.isAvailable === false ? 'Unavailable' : 'Out of stock';
            return `
            <div data-id="${p.id}" class="glass-card rounded-2xl p-3.5 flex items-center gap-3 group ${i === products.length - 1 ? 'col-span-2 sm:col-span-1' : ''}">
                <div class="w-14 h-14 rounded-xl bg-${/^[a-z]+$/.test(p.tint) ? p.tint : 'slate'}-50 flex items-center justify-center text-${/^[a-z]+$/.test(p.tint) ? p.tint : 'slate'}-600 shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                    ${imageUrl ? `<img data-product-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" class="h-full w-full object-contain">` : ''}
                    <i class="fa-solid ${/^[a-z0-9-]+$/.test(p.icon) ? p.icon : 'fa-box'} ${imageUrl ? 'hidden' : ''} text-xl"></i>
                </div>
                <div class="overflow-hidden flex-1">
                    <h4 class="text-xs font-bold text-slate-800 truncate">${escapeHtml(p.name)}</h4>
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
