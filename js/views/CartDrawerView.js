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
                <div class="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                    <div class="w-12 h-12 rounded-lg bg-${l.tint}-100/50 flex items-center justify-center text-${l.tint}-600 shrink-0"><i class="fa-solid ${l.icon} text-lg"></i></div>
                    <div class="flex-1">
                        <h5 class="text-xs font-bold text-slate-800">${escapeHtml(l.name)}</h5>
                        <p class="text-xs text-blue-600 font-extrabold mt-0.5">${l.priceText}</p>
                    </div>
                    <span class="text-xs font-bold text-slate-500">x${l.quantity}</span>
                </div>`).join('') : '<p class="text-sm text-slate-500 text-center py-10">Your cart is empty.</p>';
        });
        document.getElementById('closeCartBtn').addEventListener('click', () => cartVM.close());
        modal.addEventListener('click', (e) => { if (e.target === modal) cartVM.close(); });
        document.getElementById('checkoutBtn').addEventListener('click', () => { cartVM.close(); checkoutVM.open(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cartVM.close(); });
    }
}
