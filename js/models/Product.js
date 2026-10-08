export class Product {
    constructor({ id, name, price, oldPrice = null, rating = 0, reviews = '0', icon = 'fa-box', tint = 'blue', category = 'more' }) {
        Object.assign(this, { id, name, price, oldPrice, rating, reviews, icon, tint, category });
    }
    get hasDiscount() { return this.oldPrice != null && this.oldPrice > this.price; }
    get discountPercent() {
        return this.hasDiscount ? Math.round((1 - this.price / this.oldPrice) * 100) : 0;
    }
}
