import { Observable } from '../utils/Observable.js';

export class WishlistService {
    ids = new Observable(new Set());
    constructor() {
        try {
            const savedIds = JSON.parse(globalThis.localStorage?.getItem('shopademia.wishlist.v2') ?? '[]');
            if (Array.isArray(savedIds)) {
                this.ids.set(new Set(savedIds
                    .filter((id) => typeof id === 'string' || typeof id === 'number')
                    .map(String)));
            }
        } catch (error) {
            console.warn('Could not restore the saved wishlist:', error);
        }
        this.ids.subscribe((ids) => {
            try {
                globalThis.localStorage?.setItem('shopademia.wishlist.v2', JSON.stringify([...ids]));
            } catch (error) {
                console.warn('Could not save the wishlist:', error);
            }
        });
    }
    has(id) { return this.ids.value.has(String(id)); }
    /** @returns {boolean} true if the item is now in the wishlist */
    toggle(id) {
        const next = new Set(this.ids.value);
        const key = String(id);
        const added = !next.delete(key);
        if (added) next.add(key);
        this.ids.set(next);
        return added;
    }
    retainAvailable(products) {
        const availableIds = new Set(products.map((product) => String(product.id)));
        const next = new Set([...this.ids.value].filter((id) => availableIds.has(String(id))));
        if (next.size !== this.ids.value.size) this.ids.set(next);
    }
}
