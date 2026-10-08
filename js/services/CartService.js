import { Observable } from '../utils/Observable.js';
import { CartLine } from '../models/CartLine.js';

export class CartService {
    lines = new Observable([]);
    add(product) {
        const lines = [...this.lines.value];
        const existing = lines.find((l) => l.product.id === product.id);
        if (existing) existing.quantity += 1; else lines.push(new CartLine(product));
        this.lines.set(lines);
    }
    clear() { this.lines.set([]); }
    get count() { return this.lines.value.reduce((n, l) => n + l.quantity, 0); }
    get total() { return this.lines.value.reduce((sum, l) => sum + l.subtotal, 0); }
}
