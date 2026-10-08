import { escapeHtml } from '../utils/format.js';

export class CategoryGridView {
    constructor(root, homeVM) {
        this.root = root;
        this.homeVM = homeVM;
        homeVM.categories.subscribe((list) => this.render(list));
        homeVM.activeCategory.subscribe(() => this.render(homeVM.categories.value));
        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-category]');
            if (button) {
                homeVM.setCategory(button.dataset.category);
                document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
            }
        });
        document.getElementById('allProductsBtn').addEventListener('click', () => {
            homeVM.setCategory('all');
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
    }
    render(categories) {
        this.root.innerHTML = categories.map((c, i) => `
            <button type="button" data-category="${c.id}" aria-pressed="${this.homeVM.activeCategory.value === c.id}" class="glass-card rounded-2xl p-4 flex flex-col items-center justify-center text-center group cursor-pointer border border-white/80 aria-pressed:ring-2 aria-pressed:ring-blue-500 ${i === categories.length - 1 ? 'col-span-2 sm:col-span-1' : ''}">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center ${c.color} mb-2.5 group-hover:scale-110 transition-transform shadow-sm">
                    <i class="fa-solid ${c.icon} text-2xl"></i>
                </div>
                <span class="text-xs font-bold text-slate-800">${escapeHtml(c.name)}</span>
            </button>`).join('');
    }
}
