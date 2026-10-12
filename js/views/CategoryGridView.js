import { escapeHtml } from '../utils/format.js';

export class CategoryGridView {
    constructor(root, homeVM, shopSlug = 'main') {
        this.root = root;
        this.homeVM = homeVM;
        this.shopSlug = shopSlug;
        homeVM.categories.subscribe((list) => this.render(list));
        homeVM.activeCategory.subscribe(() => this.render(homeVM.categories.value));
        homeVM.loading.subscribe(() => this.render(homeVM.categories.value));
    }
    render(categories) {
        if (this.homeVM.loading.value) {
            this.root.innerHTML = '<p role="status" class="col-span-full py-8 text-center text-sm text-slate-600">Loading categories…</p>';
            return;
        }
        if (!categories.length) {
            this.root.innerHTML = '<p class="col-span-full py-8 text-center text-sm text-slate-600">Categories are not available right now.</p>';
            return;
        }
        this.root.innerHTML = categories.map((c, i) => `
            <a href="/category/${encodeURIComponent(c.id)}?shop=${encodeURIComponent(this.shopSlug)}" data-category="${c.id}" class="glass-card rounded-2xl p-4 flex flex-col items-center justify-center text-center group cursor-pointer border border-white/80 ${categories.length % 2 === 1 && i === categories.length - 1 ? 'col-span-2 justify-self-center w-full max-w-[220px] sm:col-span-1 sm:max-w-none' : ''}">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center ${c.color} mb-2.5 group-hover:scale-110 transition-transform shadow-sm">
                    <i class="fa-solid ${c.icon} text-2xl"></i>
                </div>
                <span class="text-xs font-bold text-slate-800">${escapeHtml(c.name)}</span>
            </a>`).join('');
    }
}
