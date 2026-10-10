import { randomUUID } from 'node:crypto';
import { DEFAULT_SHOP_ID, findProductForShop } from './catalog.js';

const BD_MOBILE = /^01[3-9]\d{8}$/;
const EVENT_ID = /^[\w-]{8,100}$/;
export const ORDER_STATUSES = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
    new: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: ['new']
});

export class OrderInputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OrderInputError';
    }
}

export function canTransitionOrderStatus(currentStatus, nextStatus) {
    return currentStatus === nextStatus || ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;
}

export function normalizePhone(value) {
    const digits = String(value ?? '').replace(/[\s\-()]/g, '').replace(/^\+/, '');
    return digits.startsWith('880') ? digits.slice(2) : digits;
}

export function validateAndPriceOrder(payload, advanceCharge, { checkInventory = true, shopId = DEFAULT_SHOP_ID } = {}) {
    const customer = payload?.customer ?? {};
    const payment = payload?.payment ?? {};
    const items = payload?.items;

    if (typeof customer?.name !== 'string' || customer.name.trim().length < 3 || customer.name.trim().length > 120) {
        throw new OrderInputError('Enter a valid customer name.');
    }
    if (!BD_MOBILE.test(normalizePhone(customer?.phone ?? ''))) {
        throw new OrderInputError('Enter a valid Bangladesh mobile number.');
    }
    if (typeof customer?.address !== 'string' || customer.address.trim().length < 10 || customer.address.trim().length > 1000) {
        throw new OrderInputError('Enter a delivery address between 10 and 1000 characters.');
    }
    if (payment?.method !== 'bkash' || !BD_MOBILE.test(normalizePhone(payment?.bkashNumber ?? ''))) {
        throw new OrderInputError('Enter a valid bKash sender number.');
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
        throw new OrderInputError('An order must contain between 1 and 50 products.');
    }
    if (!Number.isSafeInteger(advanceCharge) || advanceCharge < 0) {
        throw new Error('DELIVERY_ADVANCE_CHARGE must be a non-negative integer.');
    }
    if (payload?.source !== 'storefront' || !EVENT_ID.test(String(payload?.eventId ?? ''))) {
        throw new OrderInputError('Invalid order request. Please refresh and try again.');
    }

    const requestedStock = new Map();
    const pricedItems = items.map((item) => {
        const product = findProductForShop(item?.productId, shopId);
        if (!product || !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 99) {
            throw new OrderInputError('An order contains an invalid product or quantity.');
        }
        const id = String(product.id);
        const totalQuantity = (requestedStock.get(id) ?? 0) + item.quantity;
        if (totalQuantity > 99) throw new OrderInputError('An order cannot contain more than 99 units of a product.');
        requestedStock.set(id, totalQuantity);
        if (checkInventory && (product.isAvailable === false || product.stockQuantity === 0)) {
            throw new OrderInputError(`${product.name} is currently unavailable.`);
        }
        return {
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            quantity: item.quantity,
            lineTotal: product.price * item.quantity
        };
    });
    for (const [productId, quantity] of requestedStock) {
        const product = findProductForShop(productId, shopId);
        if (!checkInventory || !Number.isSafeInteger(product.stockQuantity)) continue;
        if (quantity > product.stockQuantity) {
            throw new OrderInputError('An order quantity exceeds available stock.');
        }
    }
    const subtotal = pricedItems.reduce((total, item) => total + item.lineTotal, 0);
    if (!Number.isSafeInteger(subtotal)) throw new OrderInputError('Order total exceeds the allowed amount.');

    return {
        shopId,
        orderNumber: `SH-${Date.now().toString(36).toUpperCase()}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
        eventId: payload.eventId,
        customerName: customer.name.trim(),
        phone: normalizePhone(customer.phone),
        address: customer.address.trim(),
        bkashNumber: normalizePhone(payment.bkashNumber),
        items: pricedItems,
        subtotal,
        advanceAmount: advanceCharge,
        dueAmount: subtotal
    };
}

export function fingerprintOrder(order) {
    return JSON.stringify({
        shopId: order.shopId ?? DEFAULT_SHOP_ID,
        customerName: order.customerName,
        phone: order.phone,
        address: order.address,
        bkashNumber: order.bkashNumber,
        items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
        advanceAmount: order.advanceAmount
    });
}
