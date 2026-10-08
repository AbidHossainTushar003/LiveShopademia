/**
 * Contract for every tracker. Event names are domain-level:
 * view_item | add_to_cart | begin_checkout | purchase
 * payload: { items:[{id,name,price,quantity}], value, currency, transactionId?, eventId? }
 */
export class Tracker {
    track(eventName, payload) { throw new Error('Not implemented'); }
}
