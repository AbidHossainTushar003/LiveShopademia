import { formatPrice } from '../utils/format.js';

export class CheckoutView {
    constructor(vm, config) {
        const $ = (id) => document.getElementById(id);
        const modal = $('checkoutModal'), form = $('checkoutForm');
        const formPanel = $('checkoutFormPanel'), successPanel = $('checkoutSuccessPanel');
        const submitBtn = $('checkoutSubmitBtn'), serverError = $('checkoutServerError');

        $('bkashMerchantNumber').textContent = config.bkash.merchantNumber;
        $('demoCheckoutNotice').classList.toggle('hidden', !config.useMockApi && !config.bkash.merchantNumber.includes('X'));

        vm.isOpen.subscribe((open) => modal.classList.toggle('hidden', !open));
        vm.summary.subscribe((s) => {
            $('coSubtotal').textContent = formatPrice(s.subtotal);
            $('coAdvance').textContent = formatPrice(s.advance);
            $('coDue').textContent = formatPrice(s.due);
            $('bkashAmount').textContent = formatPrice(s.advance);
        });
        vm.errors.subscribe((errs) => {
            form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = errs[el.dataset.error] ?? ''; });
            form.querySelectorAll('[data-field]').forEach((el) => {
                el.classList.toggle('border-rose-400', Boolean(errs[el.dataset.field]));
                el.setAttribute('aria-invalid', String(Boolean(errs[el.dataset.field])));
            });
        });
        vm.status.subscribe((st) => {
            formPanel.classList.toggle('hidden', st === 'success');
            successPanel.classList.toggle('hidden', st !== 'success');
            submitBtn.disabled = st === 'submitting';
            submitBtn.querySelector('span').textContent = st === 'submitting' ? 'Placing order...' : 'Place Order';
        });
        vm.result.subscribe(({ orderNumber, error }) => {
            $('coOrderNumber').textContent = orderNumber;
            serverError.textContent = error;
            serverError.classList.toggle('hidden', !error);
        });

        form.addEventListener('input', (e) => { if (e.target.dataset.field) vm.update(e.target.dataset.field, e.target.value); });
        form.addEventListener('submit', (e) => { e.preventDefault(); vm.submit(); });
        $('checkoutCloseBtn').addEventListener('click', () => vm.close());
        $('checkoutDoneBtn').addEventListener('click', () => { form.reset(); vm.fields.set({ name: '', phone: '', address: '', bkashNumber: '' }); vm.close(); });
        modal.addEventListener('click', (e) => { if (e.target === modal) vm.close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && vm.isOpen.value) vm.close(); });
    }
}
