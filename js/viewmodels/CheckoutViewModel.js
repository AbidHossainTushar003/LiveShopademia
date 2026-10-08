import { Observable } from '../utils/Observable.js';
import { OrderRequest } from '../models/OrderRequest.js';
import { CheckoutValidator } from '../services/CheckoutValidator.js';
import { AnalyticsService } from '../services/analytics/AnalyticsService.js';

const newEventId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class CheckoutViewModel {
    isOpen = new Observable(false);
    status = new Observable('idle'); // idle | submitting | success | error
    fields = new Observable({ name: '', phone: '', address: '', bkashNumber: '' });
    errors = new Observable({});
    summary = new Observable({ subtotal: 0, advance: 0, due: 0 });
    result = new Observable({ orderNumber: '', error: '' });

    constructor({ cartService, orderRepository, analytics, toast, config }) {
        Object.assign(this, { cart: cartService, orders: orderRepository, analytics, toast, config });
        this.validator = new CheckoutValidator();
    }
    open() {
        if (this.cart.count === 0) { this.toast.show('Your cart is empty'); return; }
        const subtotal = this.cart.total, advance = this.config.delivery.advanceCharge;
        this.summary.set({ subtotal, advance, due: subtotal }); // advance covers delivery; the rest is paid on delivery
        this.errors.set({}); this.status.set('idle'); this.result.set({ orderNumber: '', error: '' });
        this.isOpen.set(true);
        this.analytics.track('begin_checkout', AnalyticsService.fromLines(this.cart.lines.value));
    }
    close() { if (this.status.value !== 'submitting') this.isOpen.set(false); }
    update(field, value) {
        this.fields.set({ ...this.fields.value, [field]: value });
        if (this.errors.value[field]) { const { [field]: _, ...rest } = this.errors.value; this.errors.set(rest); }
    }
    async submit() {
        if (this.status.value === 'submitting') return; // double-click guard
        const errors = this.validator.validate(this.fields.value);
        this.errors.set(errors);
        if (Object.keys(errors).length) return;

        const f = this.fields.value, lines = this.cart.lines.value;
        const request = new OrderRequest({
            name: f.name.trim(), address: f.address.trim(),
            phone: CheckoutValidator.normalizePhone(f.phone),
            bkashNumber: CheckoutValidator.normalizePhone(f.bkashNumber),
            items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
            advanceAmount: this.summary.value.advance, eventId: newEventId()
        });
        this.status.set('submitting');
        try {
            const { orderNumber } = await this.orders.place(request);
            this.analytics.track('purchase', AnalyticsService.fromLines(lines, {
                transactionId: orderNumber, eventId: request.eventId,
                value: this.summary.value.subtotal + this.summary.value.advance
            }));
            this.cart.clear();
            this.result.set({ orderNumber, error: '' });
            this.status.set('success');
        } catch (err) {
            this.result.set({ orderNumber: '', error: err.message || 'Could not place order. Please try again.' });
            this.status.set('error');
        }
    }
}
