import { OrderRepository } from './OrderRepository.js';

/** POSTs to your central API. Adjust the path/response shape to your backend. */
export class ApiOrderRepository extends OrderRepository {
    constructor(baseUrl) { super(); this.baseUrl = baseUrl; }
    async place(orderRequest) {
        const res = await fetch(`${this.baseUrl}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderRequest.toPayload())
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || `Order failed (${res.status})`);
        return { orderNumber: body.data?.orderNumber ?? body.orderNumber };
    }
}
