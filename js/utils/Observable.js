/** Minimal observable value: the binding mechanism between ViewModels and Views. */
export class Observable {
    #value;
    #subscribers = new Set();
    constructor(initial) { this.#value = initial; }
    get value() { return this.#value; }
    set(next) { this.#value = next; this.#subscribers.forEach((fn) => fn(next)); }
    /** Calls fn immediately and on every change. Returns an unsubscribe function. */
    subscribe(fn) { this.#subscribers.add(fn); fn(this.#value); return () => this.#subscribers.delete(fn); }
}
