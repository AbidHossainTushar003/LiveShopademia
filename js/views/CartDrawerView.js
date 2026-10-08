import { escapeHtml } from '../utils/format.js';

export class CartDrawerView {
    constructor(cartVM, checkoutVM) {
        const modal = document.getElementById('cartModal');
        const list = document.getElementById('cartItemsContainer');
        const total = document.getElementById('cartTotalPrice');
        cartVM.isOpen.subscribe((open) => modal.classList.toggle('hidden', !open));
        cartVM.summary.subscribe((s) => {
            total.textContent = s.totalText;
            list.innerHTML = s.lines.length ? s.lines.map((l) => `
                <div data-id="${l.id}" class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div class="w-12 h-12 rounded-lg bg-${l.tint}-100/50 flex items-center justify-center text-${l.tint}-600 shrink-0"><i class="fa-solid ${l.icon} text-lg"></i></div>
                    <div class="flex-1">
                        <h5 class="text-xs font-bold text-slate-800">${escapeHtml(l.name)}</h5>
                        <p class="text-xs text-blue-600 font-extrabold mt-0.5">${l.subtotalText}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-action="decrease" aria-label="Decrease ${escapeHtml(l.name)} quantity" class="w-7 h-7 rounded-full bg-white text-slate-600 hover:bg-slate-200">−</button>
                        <span data-quantity class="min-w-4 text-center text-xs font-bold text-slate-700">${l.quantity}</span>
                        <button type="button" data-action="increase" aria-label="Increase ${escapeHtml(l.name)} quantity" class="w-7 h-7 rounded-full bg-white text-slate-600 hover:bg-slate-200">+</button>
                        <button type="button" data-action="remove" aria-label="Remove ${escapeHtml(l.name)}" class="ml-1 text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </div>
                </div>`).join('') : '<p class="text-sm text-slate-500 text-center py-10">Your cart is empty.</p>';
            document.getElementById('checkoutBtn').disabled = s.count === 0;
        });
        list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const item = button.closest('[data-id]');
            const quantity = Number(item.querySelector('[data-quantity]').textContent);
            const productId = item.dataset.id;
            if (button.dataset.action === 'increase') cartVM.setQuantity(productId, quantity + 1);
            if (button.dataset.action === 'decrease') cartVM.setQuantity(productId, quantity - 1);
            if (button.dataset.action === 'remove') cartVM.remove(productId);
        });
        document.getElementById('closeCartBtn').addEventListener('click', () => cartVM.close());
        modal.addEventListener('click', (e) => { if (e.target === modal) cartVM.close(); });
        document.getElementById('checkoutBtn').addEventListener('click', () => { cartVM.close(); checkoutVM.open(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cartVM.close(); });
    }
}
