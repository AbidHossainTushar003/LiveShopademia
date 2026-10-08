/** Fans an event out to all trackers. A failing tracker must never break shopping/checkout. */
export class AnalyticsService {
    constructor(trackers = []) { this.trackers = trackers; }
    track(eventName, payload) {
        for (const t of this.trackers) {
            try { t.track(eventName, payload); } catch (err) { console.warn('Tracker failed:', err); }
        }
    }
    /** Builds the normalized payload from cart lines. */
    static fromLines(lines, extra = {}) {
        const items = lines.map((l) => ({ id: l.product.id, name: l.product.name, price: l.product.price, quantity: l.quantity }));
        const value = items.reduce((s, i) => s + i.price * i.quantity, 0);
        return { items, value, currency: 'BDT', ...extra };
    }
}
