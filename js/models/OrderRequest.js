/**
 * What the storefront sends to POST /orders. Prices are deliberately NOT sent:
 * the server must price the order from its own product data.
 */
export class OrderRequest {
    constructor({ name, phone, address, bkashNumber, items, advanceAmount, subtotal, eventId }) {
        Object.assign(this, { name, phone, address, bkashNumber, items, advanceAmount, subtotal, eventId });
    }
    toPayload() {
        return {
            customer: { name: this.name, phone: this.phone, address: this.address },
            payment: { method: 'bkash', bkashNumber: this.bkashNumber, advanceAmount: this.advanceAmount },
            items: this.items, // [{ productId, quantity }]
            eventId: this.eventId,
            source: 'storefront'
        };
    }
}
