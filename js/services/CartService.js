import { Observable } from '../utils/Observable.js';
import { CartLine } from '../models/CartLine.js';

export const MAX_CART_QUANTITY = 99;

function isProductAvailable(product) {
    return product?.isAvailable !== false && product?.stockQuantity !== 0
        && product?.isAvailableForPurchase !== false;
}

function maxQuantityFor(product) {
    if (!isProductAvailable(product)) return 0;
    if (product?.stockQuantity == null) return MAX_CART_QUANTITY;
    if (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < 0) return 0;
    return Math.min(MAX_CART_QUANTITY, product.stockQuantity);
}

export class CartService {
    lines = new Observable([]);
    constructor() {
        try {
            const savedLines = JSON.parse(globalThis.localStorage?.getItem('shopademia.cart.v2') ?? '[]');
            if (Array.isArray(savedLines)) {
                const restored = new Map();
                for (const line of savedLines
                    .filter((line) => line?.product && line.product.id != null && Number.isFinite(line.product.price)
                        && Number.isInteger(line.quantity) && line.quantity > 0)) {
                    const key = String(line.product.id);
                    const existing = restored.get(key);
                    if (existing) existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + line.quantity);
                    else restored.set(key, new CartLine(line.product, Math.min(line.quantity, MAX_CART_QUANTITY)));
                }
                this.lines.set([...restored.values()]);
            }
        } catch (error) {
            console.warn('Could not restore the saved cart:', error);
        }
        this.lines.subscribe((lines) => {
            try {
                globalThis.localStorage?.setItem('shopademia.cart.v2', JSON.stringify(lines));
            } catch (error) {
                console.warn('Could not save the cart:', error);
            }
        });
    }
    add(product) {
        if (!product) return false;
        const lines = [...this.lines.value];
        const existing = lines.find((l) => String(l.product.id) === String(product.id));
        if ((existing?.quantity ?? 0) >= maxQuantityFor(product)) return false;
        if (existing) existing.quantity += 1; else lines.push(new CartLine(product));
        this.lines.set(lines);
        return true;
    }
    setQuantity(productId, quantity) {
        if (!Number.isInteger(quantity) || quantity < 0) return;
        const requestedQuantity = Math.min(quantity, MAX_CART_QUANTITY);
        const lines = this.lines.value
            .map((line) => {
                if (String(line.product.id) !== String(productId)) return line;
                let nextQuantity = requestedQuantity;
                if (nextQuantity > line.quantity) {
                    if (!isProductAvailable(line.product)) return line;
                    nextQuantity = Math.min(nextQuantity, maxQuantityFor(line.product));
                }
                return new CartLine(line.product, nextQuantity);
            })
            .filter((line) => line.quantity > 0);
        this.lines.set(lines);
    }
    remove(productId) {
        this.lines.set(this.lines.value.filter((line) => String(line.product.id) !== String(productId)));
    }
    reconcile(products) {
        const current = new Map(products.map((product) => [String(product.id), product]));
        const removed = this.lines.value.length - this.lines.value.filter((line) => current.has(String(line.product.id))).length;
        const lines = new Map();
        for (const line of this.lines.value) {
            const product = current.get(String(line.product.id));
            if (!product) continue;
            const key = String(product.id);
            const existing = lines.get(key);
            const quantity = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + line.quantity);
            lines.set(key, new CartLine(product, quantity));
        }
        this.lines.set([...lines.values()]);
        return removed;
    }
    clear() { this.lines.set([]); }
    canCheckout() {
        if (this.lines.value.length === 0) return false;
        const quantities = new Map();
        for (const line of this.lines.value) {
            const key = String(line.product.id);
            quantities.set(key, (quantities.get(key) ?? 0) + line.quantity);
            if (!isProductAvailable(line.product)) return false;
        }
        return this.lines.value.every((line) => line.product.stockQuantity == null
            || quantities.get(String(line.product.id)) <= line.product.stockQuantity);
    }
    get count() { return this.lines.value.reduce((n, l) => n + l.quantity, 0); }
    get total() { return this.lines.value.reduce((sum, l) => sum + l.subtotal, 0); }
}
