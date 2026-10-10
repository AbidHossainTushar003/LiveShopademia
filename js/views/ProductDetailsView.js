import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export class ProductDetailsView {
    constructor({ homeVM, cartVM }) {
        this.homeVM = homeVM;
        this.cartVM = cartVM;
        this.dialog = document.getElementById('productDetailsDialog');
        this.content = document.getElementById('productDetailsContent');
        document.getElementById('productDetailsCloseBtn').addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.dialog.close();
            if (event.target.closest('[data-detail-add]')) {
                this.cartVM.add(this.product);
                this.dialog.close();
            }
        });
        this.dialog.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling.classList.remove('hidden');
        }, true);
    }
    open(product) {
        if (!product) throw new Error('Cannot show details for a missing product.');
        this.product = product;
        const imageUrl = isSafeProductImage(product.image) ? product.image : '';
        const icon = /^[a-z0-9-]+$/.test(product.icon) ? product.icon : 'fa-box';
        const category = this.homeVM.categories.value.find((item) => item.id === product.category)?.name || product.category;
        const available = product.isAvailableForPurchase !== false;
        const availability = product.isAvailable === false ? 'Unavailable' : 'Out of stock';
        this.content.innerHTML = `
            <div class="grid gap-6 sm:grid-cols-2">
                <div class="relative flex min-h-64 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-50 to-blue-50/40 p-6">
                    ${imageUrl ? `<img data-product-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.imageAlt || product.name)}" class="h-64 w-full object-contain">` : ''}
                    <i aria-hidden="true" class="fa-solid ${escapeHtml(icon)} ${imageUrl ? 'hidden' : ''} text-7xl text-slate-600"></i>
                </div>
                <div class="flex flex-col">
                    <p class="text-xs font-bold uppercase tracking-wide text-blue-700">${escapeHtml(category)}</p>
                    <h3 class="mt-2 text-xl font-extrabold text-slate-900">${escapeHtml(product.name)}</h3>
                    <div class="mt-3 flex flex-wrap items-baseline gap-2">
                        <span class="text-xl font-extrabold text-blue-700">${formatPrice(product.price)}</span>
                        ${product.hasDiscount ? `<span class="text-sm text-slate-400 line-through">${formatPrice(product.oldPrice)}</span><span class="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-bold text-rose-600">-${product.discountPercent}%</span>` : ''}
                    </div>
                    <p class="mt-3 text-sm leading-6 text-slate-600">${escapeHtml(product.description || 'No product description is available.')}</p>
                    ${Number.isFinite(product.rating) && product.rating > 0 && Number(product.reviews) > 0 ? `<p class="mt-3 text-sm text-slate-600"><span class="font-semibold text-slate-800">Rating:</span> ${escapeHtml(product.rating)} (${escapeHtml(product.reviews)} reviews)</p>` : ''}
                    <p class="mt-2 text-sm font-semibold ${available ? 'text-emerald-700' : 'text-rose-700'}">${available ? (Number.isSafeInteger(product.stockQuantity) ? `${product.stockQuantity} in stock` : 'Available to order') : availability}</p>
                    <button type="button" data-detail-add ${available ? '' : 'disabled'} class="mt-auto rounded-xl ${available ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'} px-5 py-3 text-sm font-bold text-white transition-colors">
                        ${available ? 'Add to Cart' : availability}
                    </button>
                </div>
            </div>`;
        if (!this.dialog.open) this.dialog.showModal();
        document.getElementById('productDetailsCloseBtn').focus();
    }
}
