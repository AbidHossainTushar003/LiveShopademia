/** Abstraction the ViewModels depend on. Swap implementations without touching them. */
export class ProductRepository {
    async getFeatured() { throw new Error('Not implemented'); }
    async getNewArrivals() { throw new Error('Not implemented'); }
    async getHeroOffer() { throw new Error('Not implemented'); }
}
