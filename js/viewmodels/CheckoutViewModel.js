import { Observable } from '../utils/Observable.js';
import { OrderRequest } from '../models/OrderRequest.js';
import { CheckoutValidator } from '../services/CheckoutValidator.js';
import { AnalyticsService } from '../services/analytics/AnalyticsService.js';

const newEventId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const volatileEventIds = new Map();
const eventStorageKey = 'shopademia.orderAttempt';

function eventIdFor(key) {
    try {
        const saved = globalThis.sessionStorage?.getItem(key);
        if (saved) {
            volatileEventIds.set(key, saved);
            return saved;
        }
        if (volatileEventIds.has(key)) return volatileEventIds.get(key);
        const eventId = newEventId();
        volatileEventIds.set(key, eventId);
        globalThis.sessionStorage?.setItem(key, eventId);
        return eventId;
    } catch (error) {
        console.warn('Could not persist the order retry key for this browser session:', error);
        const eventId = volatileEventIds.get(key) ?? newEventId();
        volatileEventIds.set(key, eventId);
        return eventId;
    }
}

function clearEventId(key) {
    volatileEventIds.delete(key);
    try {
        globalThis.sessionStorage?.removeItem(key);
    } catch (error) {
        console.warn('Could not clear the completed order retry key:', error);
    }
}

export class CheckoutViewModel {
    isOpen = new Observable(false);
    status = new Observable('idle'); // idle | submitting | success | error
    fields = new Observable({ name: '', phone: '', address: '', bkashNumber: '' });
    errors = new Observable({});
    summary = new Observable({ subtotal: 0, advance: 0, due: 0 });
    result = new Observable({ orderNumber: '', error: '', receipt: null });

    constructor({ cartService, orderRepository, analytics, toast, config }) {
        Object.assign(this, { cart: cartService, orders: orderRepository, analytics, toast, config });
        this.validator = new CheckoutValidator();
    }
    open() {
        if (this.cart.count === 0) { this.toast.show('Your cart is empty'); return; }
        if (!this.cart.canCheckout()) {
            this.toast.show('Checkout one shop at a time and update or remove unavailable items.');
            return;
        }
        const product = this.cart.lines.value[0].product;
        this.checkoutShopId = product.shopId || this.config.shopId;
        this.checkoutShopName = product.shopName || this.config.shopName;
        const advanceCharge = product.shopAdvanceCharge;
        const advance = Number.isSafeInteger(advanceCharge) && advanceCharge >= 0
            ? advanceCharge
            : this.checkoutShopId === this.config.shopId
                ? this.config.delivery.advanceCharge
                : null;
        if (advance === null) {
            this.toast.show('Could not verify this shop’s delivery advance. Refresh the catalog and try again.');
            return;
        }
        const subtotal = this.cart.total;
        this.summary.set({ subtotal, advance, due: subtotal });
        this.errors.set({}); this.status.set('idle'); this.result.set({ orderNumber: '', error: '', receipt: null });
        this.isOpen.set(true);
        this.analytics.track('begin_checkout', AnalyticsService.fromLines(this.cart.lines.value));
    }
    close() {
        if (this.status.value === 'submitting') return;
        this.fields.set({ name: '', phone: '', address: '', bkashNumber: '' });
        this.errors.set({});
        this.isOpen.set(false);
    }
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
        const receipt = {
            customer: { name: f.name.trim(), phone: CheckoutValidator.normalizePhone(f.phone), address: f.address.trim() },
            items: lines.map(({ product, quantity }) => ({ name: product.name, quantity, lineTotal: product.price * quantity })),
            shopName: this.checkoutShopName || 'Shopademia',
            issuedAt: new Date().toISOString()
        };
        const retryKey = eventStorageKey;
        const request = new OrderRequest({
            name: f.name.trim(), address: f.address.trim(),
            phone: CheckoutValidator.normalizePhone(f.phone),
            bkashNumber: CheckoutValidator.normalizePhone(f.bkashNumber),
            items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
            advanceAmount: this.summary.value.advance,
            subtotal: this.summary.value.subtotal,
            eventId: eventIdFor(retryKey)
        });
        this.status.set('submitting');
        try {
            const { orderNumber, subtotal, advanceAmount, due } = await this.orders.place(request, this.checkoutShopId);
            this.summary.set({ subtotal, advance: advanceAmount, due });
            this.analytics.track('purchase', AnalyticsService.fromLines(lines, {
                transactionId: orderNumber, eventId: request.eventId,
                value: this.summary.value.subtotal + this.summary.value.advance
            }));
            this.cart.clear();
            clearEventId(retryKey);
            this.fields.set({ name: '', phone: '', address: '', bkashNumber: '' });
            this.errors.set({});
            this.result.set({ orderNumber, error: '', receipt: { ...receipt, orderNumber, subtotal, advanceAmount, due } });
            this.status.set('success');
        } catch (err) {
            if (err?.status === 409) clearEventId(retryKey);
            this.result.set({ orderNumber: '', error: err.message || 'Could not place order. Please try again.', receipt: null });
            this.status.set('error');
        }
    }
}
