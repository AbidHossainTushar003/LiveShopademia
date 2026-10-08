import { escapeHtml } from '../utils/format.js';

export class CategoryGridView {
    constructor(root, homeVM) { homeVM.categories.subscribe((list) => this.render(root, list)); }
    render(root, categories) {
        root.innerHTML = categories.map((c, i) => `
            <div class="glass-card rounded-2xl p-4 flex flex-col items-center justify-center text-center group cursor-pointer border border-white/80 ${i === categories.length - 1 ? 'col-span-2 sm:col-span-1' : ''}">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center ${c.color} mb-2.5 group-hover:scale-110 transition-transform shadow-sm">
                    <i class="fa-solid ${c.icon} text-2xl"></i>
                </div>
                <span class="text-xs font-bold text-slate-800">${escapeHtml(c.name)}</span>
            </div>`).join('');
    }
}
