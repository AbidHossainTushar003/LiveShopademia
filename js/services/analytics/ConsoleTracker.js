import { Tracker } from './Tracker.js';

export class ConsoleTracker extends Tracker {
    track(eventName, payload) { console.info('[track]', eventName, payload); }
}
