export class HeaderView {
    constructor({ cartVM, wishlistVM, homeVM }) {
        const cartBadge = document.getElementById('cartBadge');
        const wishBadge = document.getElementById('wishlistBadge');
        cartVM.summary.subscribe((s) => { cartBadge.textContent = s.count; });
        wishlistVM.count.subscribe((n) => { wishBadge.textContent = n; });
        document.getElementById('cartDrawerBtn').addEventListener('click', () => cartVM.open());
        document.getElementById('searchInput').addEventListener('input', (e) => homeVM.search(e.target.value));
    }
}
