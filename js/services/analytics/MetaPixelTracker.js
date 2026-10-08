import { Tracker } from './Tracker.js';

const EVENT_MAP = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' };

export class MetaPixelTracker extends Tracker {
    #active = false;
    constructor({ enabled, pixelId }) {
        super();
        if (!enabled || !pixelId) return;
        this.#loadSdk();
        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
        this.#active = true;
    }
    #loadSdk() {
        if (window.fbq) return;
        const n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!window._fbq) window._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        const s = document.createElement('script');
        s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(s);
    }
    track(eventName, p) {
        const metaEvent = EVENT_MAP[eventName];
        if (!this.#active || !metaEvent) return;
        const data = {
            content_type: 'product',
            content_ids: p.items.map((i) => String(i.id)),
            contents: p.items.map((i) => ({ id: String(i.id), quantity: i.quantity })),
            value: p.value, currency: p.currency
        };
        // eventID lets Meta de-duplicate with a server-side Conversions API event
        window.fbq('track', metaEvent, data, p.eventId ? { eventID: p.eventId } : undefined);
    }
}
