import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export class HeaderView {
    constructor({ cartVM, wishlistVM, homeVM }) {
        this.loadAnnouncement();
        const announcement = document.querySelector('.marketplace-announcement');
        const announcementToggle = document.getElementById('announcementMotionToggle');
        announcementToggle.addEventListener('click', () => {
            const paused = announcement.classList.toggle('is-paused');
            announcementToggle.setAttribute('aria-pressed', String(paused));
            announcementToggle.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} announcement`);
            announcementToggle.textContent = paused ? 'Resume' : 'Pause';
        });
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
            if (event.currentTarget === mobileSearch) {
                closeMobileSearch();
                document.getElementById('productResultsStatus').focus({ preventScroll: true });
            }
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        };
        desktopSearch.addEventListener('keydown', revealSearchResults);
        mobileSearch.addEventListener('keydown', revealSearchResults);
        document.getElementById('searchSubmitBtn').addEventListener('click', () => {
            document.getElementById('productResultsStatus').focus({ preventScroll: true });
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
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
            const { pathname } = window.location;
            const activeRoute = pathname === '/'
                ? 'home'
                : pathname === '/shops'
                    ? 'stores'
                    : pathname === '/top-selling'
                        ? 'top-selling'
                        : pathname === '/deals'
                            ? 'deals'
                            : pathname === '/about'
                                ? 'about'
                                : pathname === '/find-order'
                                    ? 'find-order'
                                    : /^\/category\/[a-z0-9-]+$/.test(pathname)
                                        ? 'categories'
                                        : null;
            document.querySelectorAll('[data-primary-nav]').forEach((link) => {
                const active = link.dataset.navRoute === activeRoute;
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

    async loadAnnouncement() {
        try {
            const response = await fetchWithTimeout('/api/v1/storefront-announcement');
            if (!response.ok) throw new Error(`Announcement request failed (${response.status}).`);
            const { data } = await response.json();
            if (typeof data?.text !== 'string' || !data.text.trim()) {
                throw new Error('The storefront announcement response is invalid.');
            }
            document.getElementById('marketplaceAnnouncementText').textContent = data.text;
            document.querySelector('[data-announcement-copy]').textContent = data.text;
        } catch (error) {
            console.warn('The storefront announcement could not be loaded; the default message is shown.', error);
        }
    }
}
