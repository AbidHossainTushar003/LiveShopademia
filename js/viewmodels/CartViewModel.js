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
            lines: lines.map((l) => ({ ...l.product, quantity: l.quantity, priceText: formatPrice(l.product.price) }))
        }));
    }
    add(product) {
        this.cart.add(product);
        this.analytics?.track('add_to_cart', { items: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }], value: product.price, currency: 'BDT' }); this.toast.show(`${product.name} added to cart!`);
    }
    seed(products) { products.forEach((p) => this.cart.add(p)); }
    open() { this.isOpen.set(true); }
    close() { this.isOpen.set(false); }
}
