import { Observable } from '../utils/Observable.js';

export class ToastViewModel {
    state = new Observable({ message: '', visible: false });
    #timer = null;
    constructor(durationMs = 2500) { this.durationMs = durationMs; }
    show(message) {
        clearTimeout(this.#timer);
        this.state.set({ message, visible: true });
        this.#timer = setTimeout(() => this.state.set({ message, visible: false }), this.durationMs);
    }
}
