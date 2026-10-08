import { formatPrice } from '../utils/format.js';

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
        });

        form.addEventListener('input', (e) => { if (e.target.dataset.field) vm.update(e.target.dataset.field, e.target.value); });
        form.addEventListener('submit', (e) => { e.preventDefault(); vm.submit(); });
        $('checkoutCloseBtn').addEventListener('click', () => vm.close());
        $('checkoutDoneBtn').addEventListener('click', () => { form.reset(); vm.fields.set({ name: '', phone: '', address: '', bkashNumber: '' }); vm.close(); });
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
