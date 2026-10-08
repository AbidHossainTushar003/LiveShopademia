import { Tracker } from './Tracker.js';

const EVENT_MAP = { view_item: 'view_item', add_to_cart: 'add_to_cart', begin_checkout: 'begin_checkout', purchase: 'purchase' };

export class GoogleTagTracker extends Tracker {
    #active = false;
    constructor({ enabled, tagId }) {
        super();
        if (!enabled || !tagId) return;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        const s = document.createElement('script');
        s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
        document.head.appendChild(s);
        window.gtag('js', new Date());
        window.gtag('config', tagId);
        this.#active = true;
    }
    track(eventName, p) {
        const gaEvent = EVENT_MAP[eventName];
        if (!this.#active || !gaEvent) return;
        window.gtag('event', gaEvent, {
            currency: p.currency, value: p.value,
            ...(p.transactionId && { transaction_id: p.transactionId }),
            items: p.items.map((i) => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.quantity }))
        });
    }
}
