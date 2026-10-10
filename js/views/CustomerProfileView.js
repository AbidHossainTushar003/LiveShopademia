import { formatPrice } from '../utils/format.js';
import { CheckoutValidator } from '../services/CheckoutValidator.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

const ORDER_NUMBER = /^SH-[A-Z0-9]{1,12}-(?:[A-Z0-9]{4}|[A-F0-9]{12})$/;
const BD_MOBILE = /^01[3-9]\d{8}$/;
const ORDER_STATUS_LABELS = {
    new: 'Received',
    confirmed: 'Confirmed',
    processing: 'Being prepared',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
};
const PAYMENT_STATUS_LABELS = {
    pending: 'Awaiting staff review',
    verified: 'Marked verified by staff (manual review)',
    rejected: 'Marked rejected by staff (manual review)'
};

function isLookupOrder(order) {
    return order && typeof order === 'object'
        && typeof order.orderNumber === 'string' && ORDER_NUMBER.test(order.orderNumber)
        && Object.hasOwn(ORDER_STATUS_LABELS, order.status)
        && Array.isArray(order.items) && order.items.length > 0 && order.items.length <= 50
        && order.items.every((item) => item && typeof item.name === 'string'
            && item.name.length > 0 && item.name.length <= 250
            && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99
            && Number.isSafeInteger(item.lineTotal) && item.lineTotal >= 0)
        && ['subtotal', 'advanceAmount', 'due'].every((field) => Number.isSafeInteger(order[field]) && order[field] >= 0)
        && ['pending', 'verified', 'rejected'].includes(order.advancePaymentStatus)
        && typeof order.createdAt === 'string' && Number.isFinite(Date.parse(order.createdAt))
        && order.items.reduce((total, item) => total + item.lineTotal, 0) === order.subtotal;
}

export class CustomerProfileView {
    constructor({ apiBaseUrl }) {
        this.apiBaseUrl = apiBaseUrl;
        this.dialog = document.getElementById('customerProfileDialog');
        this.content = this.dialog.querySelector('.customer-profile-content');
        this.form = document.getElementById('customerProfileForm');
        this.error = document.getElementById('customerProfileError');
        this.result = document.getElementById('customerProfileResult');
        this.submitButton = document.getElementById('customerProfileSubmitBtn');
        this.orderNumberInput = this.form.elements.orderNumber;
        this.phoneInput = this.form.elements.phone;
        this.controller = null;
        this.requestId = 0;
        this.standalone = false;

        for (const trigger of document.querySelectorAll('[data-open-customer-profile]')) {
            trigger.addEventListener('click', () => {
                this.dialog.showModal();
                this.orderNumberInput.focus();
            });
        }
        document.getElementById('customerProfileCloseBtn').addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', (event) => {
            if (event.target === this.dialog) this.dialog.close();
        });
        this.dialog.addEventListener('close', () => this.clear());
        this.form.addEventListener('submit', (event) => this.lookup(event));
        this.orderNumberInput.addEventListener('input', () => this.clearFieldError(this.orderNumberInput, 'lookupOrderNumberError'));
        this.phoneInput.addEventListener('input', () => this.clearFieldError(this.phoneInput, 'lookupPhoneError'));
    }

    showStandalone(container) {
        this.standalone = true;
        document.getElementById('customerProfileCloseBtn').classList.add('hidden');
        this.content.classList.add('customer-profile-standalone');
        container.append(this.content);
    }

    restoreDialog() {
        if (!this.standalone) return;
        this.standalone = false;
        document.getElementById('customerProfileCloseBtn').classList.remove('hidden');
        this.content.classList.remove('customer-profile-standalone');
        this.dialog.append(this.content);
    }

    clear() {
        this.requestId += 1;
        this.controller?.abort();
        this.controller = null;
        this.form.reset();
        this.clearFieldError(this.orderNumberInput, 'lookupOrderNumberError');
        this.clearFieldError(this.phoneInput, 'lookupPhoneError');
        this.error.textContent = '';
        this.error.classList.add('hidden');
        this.result.replaceChildren();
        this.result.classList.add('hidden');
        this.submitButton.disabled = false;
        this.submitButton.textContent = 'Look up order';
        this.form.removeAttribute('aria-busy');
    }

    clearFieldError(input, errorId) {
        input.removeAttribute('aria-invalid');
        input.classList.remove('border-rose-400');
        document.getElementById(errorId).textContent = '';
        document.getElementById(errorId).classList.add('hidden');
    }

    setFieldError(input, errorId, message) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('border-rose-400');
        const error = document.getElementById(errorId);
        error.textContent = message;
        error.classList.remove('hidden');
    }

    async lookup(event) {
        event.preventDefault();
        this.error.textContent = '';
        this.error.classList.add('hidden');
        this.clearFieldError(this.orderNumberInput, 'lookupOrderNumberError');
        this.clearFieldError(this.phoneInput, 'lookupPhoneError');
        this.result.replaceChildren();
        this.result.classList.add('hidden');
        if (this.controller) return;
        const orderNumber = this.orderNumberInput.value.trim().toUpperCase();
        const phone = this.phoneInput.value.trim();
        let invalidInput = false;
        if (!ORDER_NUMBER.test(orderNumber)) {
            this.setFieldError(this.orderNumberInput, 'lookupOrderNumberError', 'Enter the order number shown after checkout (for example, SH-ABC123-1A2B3C4D5E6F).');
            invalidInput = true;
        }
        if (!BD_MOBILE.test(CheckoutValidator.normalizePhone(phone))) {
            this.setFieldError(this.phoneInput, 'lookupPhoneError', 'Enter the Bangladesh mobile number used at checkout.');
            invalidInput = true;
        }
        if (invalidInput) {
            this.error.textContent = 'Check the highlighted details and try again.';
            this.error.classList.remove('hidden');
            (this.orderNumberInput.getAttribute('aria-invalid') ? this.orderNumberInput : this.phoneInput).focus();
            return;
        }

        this.submitButton.disabled = true;
        this.submitButton.textContent = 'Looking up...';
        this.form.setAttribute('aria-busy', 'true');
        const controller = new AbortController();
        const requestId = ++this.requestId;
        this.controller = controller;
        try {
            const response = await fetchWithTimeout(`${this.apiBaseUrl}/customer/order-lookup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderNumber, phone }),
                signal: controller.signal
            });
            const payload = await response.json().catch(() => null);
            if (requestId !== this.requestId || (!this.dialog.open && !this.standalone)) return;
            if (!response.ok) {
                throw new Error(typeof payload?.error === 'string'
                    ? payload.error
                    : 'Order lookup failed. Please check your connection and try again.');
            }
            if (!isLookupOrder(payload?.data)) {
                throw new Error('The order service returned an invalid response. Please try again later.');
            }
            this.renderOrder(payload.data);
        } catch (error) {
            if (requestId !== this.requestId || error?.name === 'AbortError' || (!this.dialog.open && !this.standalone)) return;
            this.error.textContent = error?.name === 'TimeoutError'
                ? 'The order lookup timed out. Check your connection and try again.'
                : error instanceof Error ? error.message : 'Order lookup failed. Please try again later.';
            this.error.classList.remove('hidden');
        } finally {
            if (requestId === this.requestId && (this.dialog.open || this.standalone)) {
                this.submitButton.disabled = false;
                this.submitButton.textContent = 'Look up order';
                this.form.removeAttribute('aria-busy');
            }
            if (requestId === this.requestId) this.controller = null;
        }
    }

    renderOrder(order) {
        const heading = document.createElement('h3');
        heading.className = 'font-bold text-slate-900';
        heading.textContent = `Order ${order.orderNumber}`;
        const metadata = document.createElement('p');
        metadata.className = 'mt-1 text-xs text-slate-500';
        metadata.textContent = `Placed ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}`;
        const status = document.createElement('p');
        status.className = 'mt-3 text-sm text-slate-700';
        status.textContent = `Order status: ${ORDER_STATUS_LABELS[order.status] ?? 'Updated by the store'}`;

        const items = document.createElement('ul');
        items.className = 'mt-3 divide-y divide-slate-100 border-y border-slate-100';
        for (const item of order.items) {
            const row = document.createElement('li');
            row.className = 'flex justify-between gap-4 py-2 text-sm';
            const name = document.createElement('span');
            name.className = 'text-slate-700';
            name.textContent = `${item.name} × ${item.quantity}`;
            const price = document.createElement('span');
            price.className = 'shrink-0 font-semibold text-slate-900';
            price.textContent = formatPrice(item.lineTotal);
            row.append(name, price);
            items.append(row);
        }

        const totals = document.createElement('dl');
        totals.className = 'mt-3 space-y-1 text-sm';
        const addTotal = (label, amount, emphasis = false) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between gap-4';
            const term = document.createElement('dt');
            term.textContent = label;
            const value = document.createElement('dd');
            value.className = emphasis ? 'font-bold text-slate-900' : 'text-slate-700';
            value.textContent = formatPrice(amount);
            row.append(term, value);
            totals.append(row);
        };
        addTotal('Products subtotal', order.subtotal, true);
        addTotal('Advance requested (not paid)', order.advanceAmount);
        addTotal('Products due on delivery', order.due, true);

        const paymentStatus = document.createElement('p');
        paymentStatus.className = 'mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600';
        paymentStatus.textContent = `Advance review: ${PAYMENT_STATUS_LABELS[order.advancePaymentStatus] ?? 'No review recorded'}. This is a staff record, not a payment-provider confirmation.`;
        this.result.append(heading, metadata, status, items, totals, paymentStatus);
        this.result.classList.remove('hidden');
    }
}
