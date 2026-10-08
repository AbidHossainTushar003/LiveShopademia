import { Observable } from '../utils/Observable.js';
import { CartLine } from '../models/CartLine.js';

export class CartService {
    lines = new Observable([]);
    constructor() {
        try {
            const savedLines = JSON.parse(globalThis.localStorage?.getItem('shopademia.cart') ?? '[]');
            if (Array.isArray(savedLines)) {
                this.lines.set(savedLines
                    .filter((line) => line?.product && line.product.id != null && Number.isFinite(line.product.price)
                        && Number.isInteger(line.quantity) && line.quantity > 0)
                    .map((line) => new CartLine(line.product, line.quantity)));
            }
        } catch (error) {
            console.warn('Could not restore the saved cart:', error);
        }
        this.lines.subscribe((lines) => {
            try {
                globalThis.localStorage?.setItem('shopademia.cart', JSON.stringify(lines));
            } catch (error) {
                console.warn('Could not save the cart:', error);
            }
        });
    }
    add(product) {
        const lines = [...this.lines.value];
        const existing = lines.find((l) => l.product.id === product.id);
        if (existing) existing.quantity += 1; else lines.push(new CartLine(product));
        this.lines.set(lines);
    }
    setQuantity(productId, quantity) {
        const lines = this.lines.value
            .map((line) => String(line.product.id) === String(productId) ? new CartLine(line.product, quantity) : line)
            .filter((line) => line.quantity > 0);
        this.lines.set(lines);
    }
    remove(productId) {
        this.lines.set(this.lines.value.filter((line) => String(line.product.id) !== String(productId)));
    }
    clear() { this.lines.set([]); }
    get count() { return this.lines.value.reduce((n, l) => n + l.quantity, 0); }
    get total() { return this.lines.value.reduce((sum, l) => sum + l.subtotal, 0); }
}
