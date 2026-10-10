import { escapeHtml, formatPrice } from '../utils/format.js';

export function receiptDocument(orderNumber, receipt) {
    const items = receipt.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${formatPrice(item.lineTotal)}</td></tr>`).join('');
    const issuedAt = new Date(receipt.issuedAt).toLocaleString();
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order ${escapeHtml(orderNumber)} receipt</title>
<style>body{font:16px/1.5 Arial,sans-serif;color:#172033;max-width:760px;margin:40px auto;padding:24px}h1{margin-bottom:0}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;border-bottom:1px solid #dbe2ea;padding:12px 8px}.total{text-align:right}.notice{background:#fff7df;padding:16px;border-radius:8px}@media print{body{margin:0}}</style></head>
<body><p>${escapeHtml(receipt.shopName)}</p><h1>Order request receipt</h1><p>Order number: <strong>${escapeHtml(orderNumber)}</strong><br>Issued: ${escapeHtml(issuedAt)}</p>
<h2>Customer</h2><p>${escapeHtml(receipt.customer.name)}<br>${escapeHtml(receipt.customer.phone)}<br>${escapeHtml(receipt.customer.address)}</p>
<h2>Items</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Line total</th></tr></thead><tbody>${items}</tbody></table>
<p class="total">Subtotal: <strong>${formatPrice(receipt.subtotal)}</strong><br>Advance requested: ${formatPrice(receipt.advanceAmount)}<br>Due: <strong>${formatPrice(receipt.due)}</strong></p>
<p class="notice"><strong>This receipt confirms an order request only. It is not proof of payment.</strong> The shop will contact you about payment and delivery.</p></body></html>`;
}

function downloadReceipt(orderNumber, receipt) {
    const file = new Blob([receiptDocument(orderNumber, receipt)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${orderNumber}-receipt.html`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class CheckoutView {
    constructor(vm) {
        const $ = (id) => document.getElementById(id);
        const modal = $('checkoutModal'), form = $('checkoutForm');
        const formPanel = $('checkoutFormPanel'), successPanel = $('checkoutSuccessPanel');
        const submitBtn = $('checkoutSubmitBtn'), serverError = $('checkoutServerError');

        let returnFocus = null;
        vm.isOpen.subscribe((open) => {
            modal.classList.toggle('hidden', !open);
            if (open) {
                returnFocus = document.activeElement;
                $('coName').focus();
            } else if (returnFocus?.isConnected && !returnFocus.closest('.hidden')) {
                returnFocus.focus();
                returnFocus = null;
            }
        });
        vm.summary.subscribe((s) => {
            $('coSubtotal').textContent = formatPrice(s.subtotal);
            $('coAdvance').textContent = formatPrice(s.advance);
            $('coDue').textContent = formatPrice(s.due);
            $('coConfirmedSubtotal').textContent = formatPrice(s.subtotal);
            $('coConfirmedAdvance').textContent = formatPrice(s.advance);
            $('coConfirmedDue').textContent = formatPrice(s.due);
        });
        vm.errors.subscribe((errs) => {
            form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = errs[el.dataset.error] ?? ''; });
            form.querySelectorAll('[data-field]').forEach((el) => {
                el.classList.toggle('border-rose-400', Boolean(errs[el.dataset.field]));
                el.setAttribute('aria-invalid', String(Boolean(errs[el.dataset.field])));
            });
        });
        vm.fields.subscribe((fields) => {
            form.querySelectorAll('[data-field]').forEach((input) => {
                const value = fields[input.dataset.field] ?? '';
                if (input.value !== value) input.value = value;
            });
        });
        vm.status.subscribe((st) => {
            formPanel.classList.toggle('hidden', st === 'success');
            successPanel.classList.toggle('hidden', st !== 'success');
            submitBtn.disabled = st === 'submitting';
            submitBtn.querySelector('span').textContent = st === 'submitting' ? 'Placing order...' : 'Place Order';
            if (st === 'success' && vm.isOpen.value) $('checkoutDoneBtn').focus();
        });
        vm.result.subscribe(({ orderNumber, error }) => {
            $('coOrderNumber').textContent = orderNumber;
            serverError.textContent = error;
            serverError.classList.toggle('hidden', !error);
            const receiptButton = $('downloadReceiptBtn');
            receiptButton.disabled = !orderNumber || !vm.result.value.receipt;
        });

        form.addEventListener('input', (e) => { if (e.target.dataset.field) vm.update(e.target.dataset.field, e.target.value); });
        form.addEventListener('submit', (e) => { e.preventDefault(); vm.submit(); });
        $('checkoutCloseBtn').addEventListener('click', () => vm.close());
        $('checkoutDoneBtn').addEventListener('click', () => { form.reset(); vm.fields.set({ name: '', phone: '', address: '', bkashNumber: '' }); vm.close(); });
        $('downloadReceiptBtn').addEventListener('click', () => {
            const { orderNumber, receipt } = vm.result.value;
            if (orderNumber && receipt) downloadReceipt(orderNumber, receipt);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) vm.close(); });
        document.addEventListener('keydown', (event) => {
            if (!vm.isOpen.value) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                vm.close();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
                .filter((element) => !element.closest('.hidden'));
            const first = focusable[0];
            const last = focusable.at(-1);
            if (!first || !last) {
                event.preventDefault();
            } else if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        });
    }
}
