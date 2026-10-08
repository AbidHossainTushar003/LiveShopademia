import test from 'node:test';
import assert from 'node:assert/strict';
import { CartService } from '../services/CartService.js';
import { CheckoutViewModel } from './CheckoutViewModel.js';

test('checkout reuses its retry key after a timeout even if cart contents change', async () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const originalWarn = console.warn;
    const eventIds = [];
    const storageUnavailable = {
        getItem() { throw new Error('Storage unavailable'); },
        setItem() { throw new Error('Storage unavailable'); },
        removeItem() { throw new Error('Storage unavailable'); }
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: storageUnavailable
    });
    console.warn = () => {};

    try {
        const cart = new CartService();
        cart.add({ id: `retry-${crypto.randomUUID()}`, name: 'Test product', price: 100 });
        const checkout = new CheckoutViewModel({
            cartService: cart,
            orderRepository: {
                async place(request) {
                    eventIds.push(request.eventId);
                    throw new Error('Network unavailable');
                }
            },
            analytics: { track() {} },
            toast: { show() {} },
            config: { delivery: { advanceCharge: 100 } }
        });
        checkout.open();
        checkout.fields.set({
            name: 'Test Customer',
            phone: '01712345678',
            address: 'Test address, Dhaka',
            bkashNumber: '01812345678'
        });

        await checkout.submit();
        cart.add({ id: `retry-added-${crypto.randomUUID()}`, name: 'Added after timeout', price: 50 });
        await checkout.submit();

        assert.equal(eventIds.length, 2);
        assert.equal(eventIds[0], eventIds[1]);
    } finally {
        console.warn = originalWarn;
        if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
        else delete globalThis.sessionStorage;
    }
});

test('checkout clears customer personal data after success and when dismissed after an error', async () => {
    const cart = new CartService();
    cart.add({ id: `privacy-${crypto.randomUUID()}`, name: 'Test product', price: 100 });
    let shouldFail = false;
    const checkout = new CheckoutViewModel({
        cartService: cart,
        orderRepository: {
            async place() {
                if (shouldFail) throw new Error('Temporary failure');
                return { orderNumber: 'SH-ABC123-1A2B', subtotal: 100, advanceAmount: 10, due: 100 };
            }
        },
        analytics: { track() {} },
        toast: { show() {} },
        config: { delivery: { advanceCharge: 10 } }
    });
    const customerDetails = {
        name: 'Test Customer',
        phone: '01712345678',
        address: 'Test address, Dhaka',
        bkashNumber: '01812345678'
    };

    checkout.open();
    checkout.fields.set(customerDetails);
    await checkout.submit();
    assert.deepEqual(checkout.fields.value, { name: '', phone: '', address: '', bkashNumber: '' });
    assert.equal(checkout.status.value, 'success');

    shouldFail = true;
    checkout.open();
    checkout.fields.set(customerDetails);
    await checkout.submit();
    assert.deepEqual(checkout.fields.value, customerDetails);
    checkout.close();
    assert.deepEqual(checkout.fields.value, { name: '', phone: '', address: '', bkashNumber: '' });
    assert.equal(checkout.isOpen.value, false);
});
