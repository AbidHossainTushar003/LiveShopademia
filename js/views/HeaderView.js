export class HeaderView {
    constructor({ cartVM, wishlistVM, homeVM }) {
        const cartBadge = document.getElementById('cartBadge');
        const wishBadge = document.getElementById('wishlistBadge');
        cartVM.summary.subscribe((s) => { cartBadge.textContent = s.count; });
        wishlistVM.count.subscribe((n) => { wishBadge.textContent = n; });
        document.getElementById('cartDrawerBtn').addEventListener('click', () => cartVM.open());
        const desktopSearch = document.getElementById('searchInput');
        const mobileSearch = document.getElementById('mobileSearchInput');
        const syncSearch = (source, target) => {
            target.value = source.value;
            homeVM.search(source.value);
        };
        desktopSearch.addEventListener('input', () => syncSearch(desktopSearch, mobileSearch));
        mobileSearch.addEventListener('input', () => syncSearch(mobileSearch, desktopSearch));
        const mobileSearchPanel = document.getElementById('mobileSearchPanel');
        const mobileSearchToggle = document.getElementById('mobileSearchToggle');
        mobileSearchToggle.addEventListener('click', () => {
            const open = mobileSearchPanel.classList.toggle('hidden') === false;
            mobileSearchToggle.setAttribute('aria-expanded', String(open));
            if (open) mobileSearch.focus();
        });
        const wishlistButton = document.getElementById('wishlistBtn');
        homeVM.wishlistOnly.subscribe((active) => {
            wishlistButton.setAttribute('aria-pressed', String(active));
            wishlistButton.classList.toggle('text-rose-500', active);
        });
        wishlistButton.addEventListener('click', () => {
            homeVM.toggleWishlistFilter();
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
    }
}
