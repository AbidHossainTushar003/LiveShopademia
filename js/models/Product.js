export class Product {
    constructor({
        id, name, description = '', price, oldPrice = null, rating = 0, reviews = '0',
        icon = 'fa-box', tint = 'blue', category = 'more', image = '',
        stockQuantity = null, isAvailable = true
    }) {
        Object.assign(this, {
            id, name, description, price, oldPrice, rating, reviews, icon, tint, category, image,
            stockQuantity, isAvailable
        });
    }
    get hasDiscount() { return this.oldPrice != null && this.oldPrice > this.price; }
    get isAvailableForPurchase() { return this.isAvailable !== false && this.stockQuantity !== 0; }
    get discountPercent() {
        return this.hasDiscount ? Math.round((1 - this.price / this.oldPrice) * 100) : 0;
    }
}
