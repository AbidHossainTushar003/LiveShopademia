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
        const revealSearchResults = (event) => {
            if (event.key !== 'Enter') return;
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
            if (event.currentTarget === mobileSearch) {
                closeMobileSearch();
                document.getElementById('productResultsStatus').focus({ preventScroll: true });
            }
        };
        desktopSearch.addEventListener('keydown', revealSearchResults);
        mobileSearch.addEventListener('keydown', revealSearchResults);
        const mobileSearchPanel = document.getElementById('mobileSearchPanel');
        const mobileSearchToggle = document.getElementById('mobileSearchToggle');
        const closeMobileSearch = () => {
            mobileSearchPanel.classList.add('hidden');
            mobileSearchToggle.setAttribute('aria-expanded', 'false');
            mobileSearchToggle.setAttribute('aria-label', 'Search products');
        };
        mobileSearchToggle.addEventListener('click', () => {
            const open = mobileSearchPanel.classList.toggle('hidden') === false;
            mobileSearchToggle.setAttribute('aria-expanded', String(open));
            mobileSearchToggle.setAttribute('aria-label', open ? 'Close search' : 'Search products');
            if (open) {
                closeMobileNavigation();
                mobileSearch.focus();
            }
        });
        const mobileNavigationPanel = document.getElementById('mobileNavigationPanel');
        const mobileNavigationToggle = document.getElementById('mobileNavigationToggle');
        const closeMobileNavigation = () => {
            mobileNavigationPanel.classList.add('hidden');
            mobileNavigationToggle.setAttribute('aria-expanded', 'false');
            mobileNavigationToggle.setAttribute('aria-label', 'Open navigation menu');
            mobileNavigationToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        };
        mobileNavigationToggle.addEventListener('click', () => {
            const open = mobileNavigationPanel.classList.toggle('hidden') === false;
            mobileNavigationToggle.setAttribute('aria-expanded', String(open));
            mobileNavigationToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
            mobileNavigationToggle.innerHTML = `<i class="fa-solid ${open ? 'fa-xmark' : 'fa-bars'}"></i>`;
            if (open) closeMobileSearch();
        });
        const syncActiveNavigation = () => {
            const activeHash = window.location.hash || '#home';
            document.querySelectorAll('[data-primary-nav]').forEach((link) => {
                const active = link.getAttribute('href') === activeHash;
                link.classList.toggle('text-blue-600', active);
                link.classList.toggle('font-bold', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        };
        document.querySelectorAll('[data-primary-nav]').forEach((link) => {
            link.addEventListener('click', () => {
                syncActiveNavigation();
                closeMobileNavigation();
                closeMobileSearch();
            });
        });
        window.addEventListener('hashchange', syncActiveNavigation);
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) closeMobileNavigation();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!mobileNavigationPanel.classList.contains('hidden')) {
                closeMobileNavigation();
                mobileNavigationToggle.focus();
            }
            if (!mobileSearchPanel.classList.contains('hidden')) {
                closeMobileSearch();
                mobileSearchToggle.focus();
            }
        });
        syncActiveNavigation();
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
