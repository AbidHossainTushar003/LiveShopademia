import { Observable } from '../utils/Observable.js';

export class HeroViewModel {
    dimmed = new Observable(false);
    constructor(toastViewModel) { this.toast = toastViewModel; }
    switchShowcase() {
        this.dimmed.set(true);
        setTimeout(() => { this.dimmed.set(false); this.toast.show('Switched Showcase Product'); }, 200);
    }
}
