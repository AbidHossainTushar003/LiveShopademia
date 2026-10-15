import { escapeHtml, isSafeProductImage } from '../utils/format.js';
import { MAX_CART_QUANTITY } from '../services/CartService.js';

export class CartDrawerView {
    constructor(cartVM, checkoutVM) {
        const modal = document.getElementById('cartModal');
        const list = document.getElementById('cartItemsContainer');
        const total = document.getElementById('cartTotalPrice');
        list.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-cart-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling?.classList.remove('hidden');
        }, true);
        let returnFocus = null;
        cartVM.isOpen.subscribe((open) => {
            modal.classList.toggle('hidden', !open);
            if (open) {
                returnFocus = document.activeElement;
                document.getElementById('closeCartBtn').focus();
            } else if (returnFocus?.isConnected && !returnFocus.closest('.hidden')) {
                returnFocus.focus();
                returnFocus = null;
            }
        });
        cartVM.summary.subscribe((s) => {
            total.textContent = s.totalText;
            list.innerHTML = s.lines.length ? s.lines.map((l) => `
                <div data-id="${l.id}" class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div class="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
                        ${isSafeProductImage(l.image) ? `<img data-cart-image src="${escapeHtml(l.image)}" alt="${escapeHtml(l.imageAlt || l.name)}" class="w-full h-full object-contain">` : ''}
                        <i aria-hidden="true" class="fa-solid ${/^[a-z0-9-]+$/.test(l.icon) ? l.icon : 'fa-box'} text-lg ${isSafeProductImage(l.image) ? 'hidden' : ''}"></i>
                    </div>
                    <div class="flex-1">
                        <h5 class="text-xs font-bold text-slate-800">${escapeHtml(l.name)}</h5>
                        <p class="text-xs text-blue-600 font-extrabold mt-0.5">${l.subtotalText}</p>
                        ${l.isAvailableForPurchase ? '' : `<p class="mt-1 text-[11px] font-semibold text-rose-600">${escapeHtml(
                            l.isAvailable === false ? 'Unavailable'
                                : l.stockQuantity === 0 ? 'Out of stock'
                                    : `Only ${l.stockQuantity} in stock; reduce quantity or remove this item.`
                        )}</p>`}
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-action="decrease" aria-label="Decrease ${escapeHtml(l.name)} quantity" class="w-7 h-7 rounded-full bg-white text-slate-600 hover:bg-slate-200">−</button>
                        <span data-quantity class="min-w-4 text-center text-xs font-bold text-slate-700">${l.quantity}</span>
                        <button type="button" data-action="increase" aria-label="Increase ${escapeHtml(l.name)} quantity" ${!l.isAvailableForPurchase || l.quantity >= Math.min(MAX_CART_QUANTITY, l.stockQuantity ?? MAX_CART_QUANTITY) ? 'disabled' : ''} class="w-7 h-7 rounded-full bg-white text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50">+</button>
                        <button type="button" data-action="remove" aria-label="Remove ${escapeHtml(l.name)}" class="ml-1 text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </div>
                </div>`).join('') : '<p class="text-sm text-slate-500 text-center py-10">Your cart is empty.</p>';
            document.getElementById('checkoutBtn').disabled = !s.canCheckout;
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
        document.getElementById('checkoutBtn').addEventListener('click', () => {
            cartVM.close();
            document.getElementById('cartDrawerBtn').focus();
            checkoutVM.open();
        });
        document.addEventListener('keydown', (event) => {
            if (!cartVM.isOpen.value) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                cartVM.close();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
                .filter((element) => !element.closest('.hidden'));
            const first = focusable[0];
            const last = focusable.at(-1);
            if (!first || !last) {
                event.preventDefault();
            } else if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });
    }
}
