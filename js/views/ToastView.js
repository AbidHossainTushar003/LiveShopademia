export class ToastView {
    constructor(toastVM) {
        const el = document.getElementById('toast');
        const text = document.getElementById('toastMessage');
        toastVM.state.subscribe(({ message, visible }) => {
            if (message) text.textContent = message;
            el.classList.toggle('translate-y-20', !visible);
            el.classList.toggle('opacity-0', !visible);
            el.classList.toggle('translate-y-0', visible);
            el.classList.toggle('opacity-100', visible);
        });
        // Generic hook for static buttons: <button data-toast="message">
        document.addEventListener('click', (e) => {
            const t = e.target.closest('[data-toast]');
            if (t) toastVM.show(t.dataset.toast);
        });
    }
}
