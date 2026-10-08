export class OrderRepository {
    /** @param {import('../models/OrderRequest.js').OrderRequest} orderRequest @returns {Promise<{orderNumber:string, subtotal:number, advanceAmount:number, due:number}>} */
    async place(orderRequest) { throw new Error('Not implemented'); }
}
