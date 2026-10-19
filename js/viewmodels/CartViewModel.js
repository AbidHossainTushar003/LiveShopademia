import { Observable } from '../utils/Observable.js';
import { formatPrice } from '../utils/format.js';

export class CartViewModel {
    summary = new Observable({ count: 0, totalText: formatPrice(0), lines: [] });
    isOpen = new Observable(false);

    constructor(cartService, toastViewModel, analytics) {
        this.analytics = analytics;
        this.cart = cartService;
        this.toast = toastViewModel;
        this.cart.lines.subscribe((lines) => this.summary.set({
            count: this.cart.count,
            totalText: formatPrice(this.cart.total),
            canCheckout: this.cart.canCheckout(),
            lines: lines.map((l) => ({
                ...l.product,
                quantity: l.quantity,
                isAvailableForPurchase: l.product.isAvailable !== false
                    && l.product.stockQuantity !== 0
                    && l.product.isAvailableForPurchase !== false
                    && (l.product.stockQuantity == null || l.quantity <= l.product.stockQuantity),
                priceText: formatPrice(l.product.price),
                subtotalText: formatPrice(l.subtotal)
            }))
        }));
    }
    add(product) {
        if (!this.cart.canAddFromShop(product)) {
            const currentShop = this.cart.lines.value[0]?.product.shopName || 'another shop';
            this.toast.show(`Your cart has items from ${currentShop}. Checkout or remove them before shopping from another shop.`);
            return false;
        }
        if (!this.cart.add(product)) {
            if (product?.isAvailable === false || product?.stockQuantity === 0 || product?.isAvailableForPurchase === false) {
                this.toast.show('This product is currently unavailable.');
            } else if (Number.isSafeInteger(product?.stockQuantity)) {
                this.toast.show(`Only ${product.stockQuantity} of this product are currently in stock.`);
            } else {
                this.toast.show('You can add up to 99 of each product.');
            }
            return false;
        }
        this.analytics?.track('add_to_cart', { items: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }], value: product.price, currency: 'BDT' }); this.toast.show(`${product.name} added to cart!`);
        return true;
    }
    setQuantity(productId, quantity) {
        this.cart.setQuantity(productId, quantity);
    }
    remove(productId) {
        this.cart.remove(productId);
        this.toast.show('Item removed from cart');
    }
    seed(products) { products.forEach((p) => this.cart.add(p)); }
    open() { this.isOpen.set(true); }
    close() { this.isOpen.set(false); }
}
