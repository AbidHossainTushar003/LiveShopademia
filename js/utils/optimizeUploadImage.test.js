import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeImageFile, optimizedFormData } from './optimizeUploadImage.js';

test('compresses and resizes supported images when WebP is smaller', async () => {
    const previousBitmap = globalThis.createImageBitmap;
    const previousDocument = globalThis.document;
    let closed = false;
    let drawnSize;
    globalThis.createImageBitmap = async () => ({
        width: 3200,
        height: 1600,
        close() { closed = true; }
    });
    globalThis.document = {
        createElement(name) {
            assert.equal(name, 'canvas');
            return {
                width: 0,
                height: 0,
                getContext() {
                    return {
                        drawImage(_bitmap, _x, _y, width, height) {
                            drawnSize = [width, height];
                        }
                    };
                },
                toBlob(callback, type, quality) {
                    assert.equal(type, 'image/webp');
                    assert.equal(quality, 0.82);
                    callback(new Blob([new Uint8Array(100)], { type }));
                }
            };
        }
    };
    try {
        const original = new File([new Uint8Array(2000)], 'item.jpg', { type: 'image/jpeg' });
        const result = await optimizeImageFile(original);
        assert.notEqual(result, original);
        assert.equal(result.name, 'item.webp');
        assert.equal(result.type, 'image/webp');
        assert.deepEqual(drawnSize, [1600, 800]);
        assert.equal(closed, true);
    } finally {
        if (previousBitmap === undefined) delete globalThis.createImageBitmap;
        else globalThis.createImageBitmap = previousBitmap;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
});

test('keeps original files when compression is unavailable or larger', async () => {
    const previousBitmap = globalThis.createImageBitmap;
    const previousDocument = globalThis.document;
    globalThis.createImageBitmap = async () => ({
        width: 600,
        height: 400,
        close() {}
    });
    globalThis.document = {
        createElement() {
            return {
                getContext: () => ({ drawImage() {} }),
                toBlob(callback) {
                    callback(new Blob([new Uint8Array(1000)], { type: 'image/webp' }));
                }
            };
        }
    };
    try {
        const original = new File([new Uint8Array(100)], 'item.png', { type: 'image/png' });
        assert.equal(await optimizeImageFile(original), original);
        const unsupported = new File([new Uint8Array(20)], 'art.svg', { type: 'image/svg+xml' });
        assert.equal(await optimizeImageFile(unsupported), unsupported);
    } finally {
        if (previousBitmap === undefined) delete globalThis.createImageBitmap;
        else globalThis.createImageBitmap = previousBitmap;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
});

test('uses the actual fallback image MIME type returned by the browser', async () => {
    const previousBitmap = globalThis.createImageBitmap;
    const previousDocument = globalThis.document;
    globalThis.createImageBitmap = async () => ({ width: 1000, height: 600, close() {} });
    globalThis.document = {
        createElement() {
            return {
                getContext: () => ({ drawImage() {} }),
                toBlob(callback) {
                    callback(new Blob([new Uint8Array(100)], { type: 'image/png' }));
                }
            };
        }
    };
    try {
        const original = new File([new Uint8Array(1000)], 'item.jpg', { type: 'image/jpeg' });
        const optimized = await optimizeImageFile(original);
        assert.equal(optimized.type, 'image/png');
        assert.equal(optimized.name, 'item.png');
    } finally {
        if (previousBitmap === undefined) delete globalThis.createImageBitmap;
        else globalThis.createImageBitmap = previousBitmap;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
});

test('optimizes every image entry without dropping multiple files that share a form field', async () => {
    const previousFormData = globalThis.FormData;
    class TestFormData {
        constructor(form) {
            this.values = new Map([
                ['images', [...(form?.images || [])]],
                ['name', [form?.name || '']]
            ]);
        }
        append(name, value) {
            if (!this.values.has(name)) this.values.set(name, []);
            this.values.get(name).push(value);
        }
        delete(name) { this.values.delete(name); }
        entries() { return [...this.values].flatMap(([name, values]) => values.map((value) => [name, value]))[Symbol.iterator](); }
        getAll(name) { return this.values.get(name) || []; }
        keys() { return this.values.keys(); }
    }
    globalThis.FormData = TestFormData;
    try {
        const first = new File([new Uint8Array(5)], 'first.jpg', { type: 'image/jpeg' });
        const second = new File([new Uint8Array(6)], 'second.png', { type: 'image/png' });
        const form = { images: [first, second] };
        const optimized = await optimizedFormData(form);
        assert.equal(optimized.getAll('images').length, 2);
        assert.equal(optimized.getAll('images')[0], first);
        assert.equal(optimized.getAll('images')[1], second);
    } finally {
        if (previousFormData === undefined) delete globalThis.FormData;
        else globalThis.FormData = previousFormData;
    }
});
