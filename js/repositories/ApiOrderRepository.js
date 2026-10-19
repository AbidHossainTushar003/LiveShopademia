import { OrderRepository } from './OrderRepository.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

/** POSTs to your central API. Adjust the path/response shape to your backend. */
export class ApiOrderRepository extends OrderRepository {
    constructor(baseUrl, shopId = null) { super(); this.baseUrl = baseUrl; this.shopId = shopId; }
    async place(orderRequest, shopId = this.shopId) {
        const res = await fetchWithTimeout(`${this.baseUrl}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...orderRequest.toPayload(),
                ...(shopId ? { shopId } : {})
            })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const error = new Error(body.error || body.message || `Order failed (${res.status})`);
            error.status = res.status;
            throw error;
        }
        const data = body.data ?? body;
        const orderNumber = data.orderNumber;
        if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
            throw new Error('Order service returned an invalid confirmation number.');
        }
        for (const field of ['subtotal', 'advanceAmount', 'due']) {
            if (!Number.isSafeInteger(data[field]) || data[field] < 0) {
                throw new Error(`Order service returned an invalid ${field}.`);
            }
        }
        return { orderNumber, subtotal: data.subtotal, advanceAmount: data.advanceAmount, due: data.due };
    }
}
