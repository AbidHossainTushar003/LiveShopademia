import { Observable } from '../utils/Observable.js';

export class WishlistService {
    ids = new Observable(new Set());
    has(id) { return this.ids.value.has(id); }
    /** @returns {boolean} true if the item is now in the wishlist */
    toggle(id) {
        const next = new Set(this.ids.value);
        const added = !next.delete(id);
        if (added) next.add(id);
        this.ids.set(next);
        return added;
    }
}
