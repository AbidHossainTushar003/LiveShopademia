import { Observable } from '../utils/Observable.js';

export class WishlistViewModel {
    count = new Observable(0);
    ids = new Observable(new Set());
    constructor(wishlistService, toastViewModel) {
        this.wishlist = wishlistService;
        this.toast = toastViewModel;
        this.wishlist.ids.subscribe((ids) => { this.ids.set(ids); this.count.set(ids.size); });
    }
    toggle(product) {
        const added = this.wishlist.toggle(product.id);
        this.toast.show(added ? 'Added to Wishlist' : 'Removed from Wishlist');
    }
}
