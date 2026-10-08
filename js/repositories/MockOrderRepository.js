import { OrderRepository } from './OrderRepository.js';

export class MockOrderRepository extends OrderRepository {
    async place(orderRequest) {
        await new Promise((r) => setTimeout(r, 600));
        const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const suffix = eventId.replaceAll('-', '').slice(0, 12).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        return {
            orderNumber: `SH-${timestamp}-${suffix}`,
            subtotal: orderRequest.subtotal,
            advanceAmount: orderRequest.advanceAmount,
            due: orderRequest.subtotal
        };
    }
}
