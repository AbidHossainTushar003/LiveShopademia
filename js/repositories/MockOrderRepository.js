import { OrderRepository } from './OrderRepository.js';

export class MockOrderRepository extends OrderRepository {
    async place(orderRequest) {
        console.info('[mock order]', orderRequest.toPayload());
        await new Promise((r) => setTimeout(r, 600));
        return { orderNumber: `SH-${String(Date.now()).slice(-6)}` };
    }
}
