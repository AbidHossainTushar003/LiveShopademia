import { escapeHtml, formatPrice } from '../utils/format.js';

export class NewArrivalsView {
    constructor(root, homeVM) { homeVM.newArrivals.subscribe((list) => this.render(root, list)); }
    render(root, products) {
        root.innerHTML = products.map((p, i) => `
            <div class="glass-card rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer group ${i === products.length - 1 ? 'col-span-2 sm:col-span-1' : ''}">
                <div class="w-14 h-14 rounded-xl bg-${p.tint}-50 flex items-center justify-center text-${p.tint}-600 shrink-0 group-hover:scale-105 transition-transform">
                    <i class="fa-solid ${p.icon} text-xl"></i>
                </div>
                <div class="overflow-hidden">
                    <h4 class="text-xs font-bold text-slate-800 truncate">${escapeHtml(p.name)}</h4>
                    <p class="text-xs font-extrabold text-blue-700 mt-0.5">${formatPrice(p.price)}</p>
                </div>
            </div>`).join('');
    }
}
