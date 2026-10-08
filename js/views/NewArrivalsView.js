import { escapeHtml, formatPrice } from '../utils/format.js';

export class NewArrivalsView {
    constructor(root, homeVM, cartVM) {
        this.root = root;
        this.homeVM = homeVM;
        this.cartVM = cartVM;
        homeVM.newArrivals.subscribe((list) => this.render(list));
        homeVM.isFiltering.subscribe((filtering) => {
            this.root.closest('section').classList.toggle('hidden', filtering);
        });
        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action="add"]');
            if (button) cartVM.add(homeVM.findProduct(button.closest('[data-id]').dataset.id));
        });
    }
    render(products) {
        this.root.innerHTML = products.map((p, i) => `
            <div data-id="${p.id}" class="glass-card rounded-2xl p-3.5 flex items-center gap-3 group ${i === products.length - 1 ? 'col-span-2 sm:col-span-1' : ''}">
                <div class="w-14 h-14 rounded-xl bg-${p.tint}-50 flex items-center justify-center text-${p.tint}-600 shrink-0 group-hover:scale-105 transition-transform">
                    <i class="fa-solid ${p.icon} text-xl"></i>
                </div>
                <div class="overflow-hidden flex-1">
                    <h4 class="text-xs font-bold text-slate-800 truncate">${escapeHtml(p.name)}</h4>
                    <p class="text-xs font-extrabold text-blue-700 mt-0.5">${formatPrice(p.price)}</p>
                </div>
                <button type="button" data-action="add" aria-label="Add ${escapeHtml(p.name)} to cart" class="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors">
                    <i class="fa-solid fa-plus text-xs"></i>
                </button>
            </div>`).join('');
    }
}
