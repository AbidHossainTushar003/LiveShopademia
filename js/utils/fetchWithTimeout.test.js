import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithTimeout } from './fetchWithTimeout.js';

test('fetchWithTimeout aborts a stalled request', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = (_input, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });

    await assert.rejects(fetchWithTimeout('/api/test', {}, 5), { name: 'TimeoutError' });
});

test('fetchWithTimeout retains its timeout when a caller supplies an abort signal', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = (_input, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });

    await assert.rejects(
        fetchWithTimeout('/api/test', { signal: new AbortController().signal }, 5),
        { name: 'TimeoutError' }
    );
});
