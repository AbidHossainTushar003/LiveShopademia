// Composition root: the only place that knows concrete classes and wires dependencies.
import { appConfig } from './config/app.config.js';
import { trackingConfig } from './config/tracking.config.js';
import { ApiProductRepository } from './repositories/ApiProductRepository.js';
import { ApiOrderRepository } from './repositories/ApiOrderRepository.js';
import { ApiCategoryRepository } from './repositories/ApiCategoryRepository.js';
import { CartService } from './services/CartService.js';
import { WishlistService } from './services/WishlistService.js';
import { AnalyticsService } from './services/analytics/AnalyticsService.js';
import { MetaPixelTracker } from './services/analytics/MetaPixelTracker.js';
import { GoogleTagTracker } from './services/analytics/GoogleTagTracker.js';
import { ConsoleTracker } from './services/analytics/ConsoleTracker.js';
import { ToastViewModel } from './viewmodels/ToastViewModel.js';
import { CartViewModel } from './viewmodels/CartViewModel.js';
import { WishlistViewModel } from './viewmodels/WishlistViewModel.js';
import { HomeViewModel } from './viewmodels/HomeViewModel.js';
import { CheckoutViewModel } from './viewmodels/CheckoutViewModel.js';
import { HeaderView } from './views/HeaderView.js';
import { HeroView } from './views/HeroView.js';
import { CategoryGridView } from './views/CategoryGridView.js';
import { ProductGridView } from './views/ProductGridView.js';
import { NewArrivalsView } from './views/NewArrivalsView.js';
import { CartDrawerView } from './views/CartDrawerView.js';
import { CheckoutView } from './views/CheckoutView.js';
import { CustomerProfileView } from './views/CustomerProfileView.js';
import { RoutePageView } from './views/RoutePageView.js';
import { ToastView } from './views/ToastView.js';
import { fetchWithTimeout } from './utils/fetchWithTimeout.js';

async function bootstrap() {
    const pathname = window.location.pathname;
    const shopProfileMatch = pathname.match(/^\/shops\/([a-z0-9][a-z0-9-]{1,47})$/);
    const shopSlug = shopProfileMatch?.[1] || new URLSearchParams(window.location.search).get('shop') || 'main';
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(shopSlug)) throw new Error('This shop URL is invalid.');
    const route = resolveRoute(pathname, shopProfileMatch);
    const runtimeConfig = { ...appConfig, delivery: { ...appConfig.delivery } };
    const response = await fetchWithTimeout(`${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/config`);
    if (!response.ok) throw new Error(`Store configuration failed (${response.status}).`);
    const result = await response.json();
    if (!Number.isSafeInteger(result.delivery?.advanceCharge) || result.delivery.advanceCharge < 0) {
        throw new Error('Store returned an invalid delivery advance configuration.');
    }
    runtimeConfig.shopId = result.data.shopId;
    runtimeConfig.shopSlug = result.data.slug;
    runtimeConfig.shopName = result.data.name;
    runtimeConfig.delivery.advanceCharge = result.delivery.advanceCharge;
    const productRepo = new ApiProductRepository(appConfig.apiBaseUrl, shopSlug);
    const orderRepo = new ApiOrderRepository(appConfig.apiBaseUrl, runtimeConfig.shopId);
    const cartService = new CartService();
    const wishlistService = new WishlistService();

    const analytics = new AnalyticsService(trackingConfig.debug ? [new ConsoleTracker()] : []);
    const updateAnalyticsConsent = ({ analytics: enabled }) => {
        const debugTrackers = trackingConfig.debug ? [new ConsoleTracker()] : [];
        analytics.trackers = enabled
            ? [...debugTrackers, new MetaPixelTracker(trackingConfig.metaPixel), new GoogleTagTracker(trackingConfig.googleTag)]
            : debugTrackers;
        if (!enabled) {
            if (window.gtag) window.gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            if (window.fbq) window.fbq('consent', 'revoke');
        }
    };
    try {
        const consent = JSON.parse(localStorage.getItem('shopademia.privacyConsent.v1') || 'null');
        if (consent?.necessary === true) updateAnalyticsConsent(consent);
    } catch (error) {
        console.warn('Saved analytics preferences could not be read; analytics remain disabled.', error);
    }
    window.addEventListener('shopademia:consent', (event) => updateAnalyticsConsent(event.detail));

    const toastVM = new ToastViewModel();
    const cartVM = new CartViewModel(cartService, toastVM, analytics);
    const wishlistVM = new WishlistViewModel(wishlistService, toastVM);
    const homeVM = new HomeViewModel(productRepo, new ApiCategoryRepository(appConfig.apiBaseUrl, shopSlug));
    const checkoutVM = new CheckoutViewModel({ cartService, orderRepository: orderRepo, analytics, toast: toastVM, config: runtimeConfig });

    new ToastView(toastVM);
    new HeaderView({ cartVM, wishlistVM, homeVM });
    new CartDrawerView(cartVM, checkoutVM);
    new CheckoutView(checkoutVM);
    const customerProfileView = new CustomerProfileView({ apiBaseUrl: appConfig.apiBaseUrl });
    new CategoryGridView(document.getElementById('categoryGrid'), homeVM, shopSlug);
    new ProductGridView(document.getElementById('featuredProductGrid'), { homeVM, cartVM, wishlistVM, shopSlug });
    new NewArrivalsView(document.getElementById('newArrivalsGrid'), homeVM, cartVM, wishlistVM, shopSlug);
    new HeroView({ homeVM, cartVM, shopSlug, slides: result.data.heroSlides || [] });
    const bannerImage = document.getElementById('shopBannerImage');
    if (result.data.bannerImage) {
        bannerImage.src = result.data.bannerImage;
        document.getElementById('shopBannerPanel').classList.remove('hidden');
    } else {
        bannerImage.removeAttribute('src');
        document.getElementById('shopBannerPanel').classList.add('hidden');
    }
    document.title = `${result.data.name} | Shopademia`;
    setupShopOffers(shopSlug, route.type === 'home');

    await homeVM.load();
    configureNavigation(shopSlug, homeVM.categories.value[0]?.id || null);
    const routePage = new RoutePageView({
        root: document.getElementById('routePage'),
        apiBaseUrl: appConfig.apiBaseUrl,
        shop: { ...result.data, slug: shopSlug },
        route,
        homeVM,
        cartVM,
        customerProfileView
    });
    await routePage.render();
    wishlistService.retainAvailable([...homeVM.featured.value, ...homeVM.newArrivals.value, homeVM.heroOffer.value].filter(Boolean));
    const availableProducts = [...homeVM.featured.value, ...homeVM.newArrivals.value, homeVM.heroOffer.value].filter(Boolean);
    const removedCartItems = cartService.reconcile(availableProducts);
    if (removedCartItems) toastVM.show(`${removedCartItems} saved cart item${removedCartItems === 1 ? ' is' : 's are'} no longer available and ${removedCartItems === 1 ? 'was' : 'were'} removed.`);
}

function resolveRoute(pathname, shopProfileMatch) {
    if (shopProfileMatch) return { type: 'shop' };
    if (pathname === '/') return { type: 'home' };
    if (pathname === '/shops') return { type: 'shops' };
    if (pathname === '/deals') return { type: 'deals' };
    if (pathname === '/about') return { type: 'about' };
    if (pathname === '/find-order') return { type: 'find-order' };
    if (pathname === '/privacy') return { type: 'privacy' };
    if (pathname === '/terms') return { type: 'terms' };
    const product = pathname.match(/^\/product\/([^/]+)$/);
    if (product) return { type: 'product', id: decodeURIComponent(product[1]) };
    const category = pathname.match(/^\/category\/([a-z0-9-]+)$/);
    if (category) return { type: 'category', id: category[1] };
    return { type: 'not-found' };
}

function configureNavigation(shopSlug, categoryId) {
    const shop = encodeURIComponent(shopSlug);
    const routes = {
        '#home': `/?shop=${shop}`,
        '/': `/?shop=${shop}`,
        '/?shop=main#shop': `/?shop=${shop}#shop`,
        '/deals': `/deals?shop=${shop}`,
        '/shops': '/shops',
        '/about': `/about?shop=${shop}`,
        '/find-order': `/find-order?shop=${shop}`
    };
    document.querySelectorAll('a[href="/category/gadgets"]').forEach((link) => {
        if (categoryId) link.href = `/category/${encodeURIComponent(categoryId)}?shop=${shop}`;
        else link.hidden = true;
    });
    document.querySelectorAll('a[href]').forEach((link) => {
        const target = link.getAttribute('href');
        if (target in routes) link.href = routes[target];
    });
}

function setupShopOffers(shopSlug, showHomeOffers) {
    const offerContainer = document.getElementById('shopOfferList');
    const offerPanel = document.getElementById('shopOffersPanel');
    const notificationButton = document.getElementById('dealNotificationsButton');
    const notificationStatus = document.getElementById('dealNotificationStatus');
    if (!showHomeOffers) return;
    fetchWithTimeout(`${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/offers`)
        .then((response) => {
            if (!response.ok) throw new Error(`Offer feed failed (${response.status}).`);
            return response.json();
        })
        .then(({ data }) => {
            if (!Array.isArray(data) || !data.length) return;
            offerPanel.classList.remove('hidden');
            for (const offer of data) {
                const card = document.createElement('article');
                card.className = 'offer-card';
                if (offer.image) {
                    const image = document.createElement('img');
                    image.src = offer.image;
                    image.alt = '';
                    image.loading = 'lazy';
                    card.append(image);
                }
                const title = document.createElement('h3');
                title.textContent = offer.title;
                const detail = document.createElement('p');
                detail.textContent = offer.message;
                card.append(title, detail);
                offerContainer.append(card);
            }
        })
        .catch((error) => console.error('Shop offers could not be loaded:', error));

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.getRegistration('/').then(async (registration) => {
            const subscription = await registration?.pushManager.getSubscription();
            if (subscription && await isShopPushSubscribed(shopSlug, subscription.endpoint)) {
                notificationButton.textContent = 'Disable deal alerts';
            }
        }).catch((error) => console.error('Notification subscription state could not be loaded:', error));
    }

    notificationButton.addEventListener('click', async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            notificationStatus.textContent = 'Browser push alerts are not supported here.';
            return;
        }
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription && await isShopPushSubscribed(shopSlug, existingSubscription.endpoint)) {
                const removed = await fetchWithTimeout(`${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/push-subscriptions`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: existingSubscription.endpoint })
                });
                if (!removed.ok) {
                    const body = await removed.json().catch(() => ({}));
                    throw new Error(body.error || 'Could not disable deal alerts.');
                }
                notificationButton.textContent = 'Enable deal alerts';
                notificationStatus.textContent = 'Deal alerts are disabled for this shop in this browser.';
                return;
            }
            const response = await fetchWithTimeout(`${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/push-key`);
            const { data } = await response.json();
            if (!response.ok || !data.enabled || !data.publicKey) {
                notificationStatus.textContent = 'Browser alerts are not configured for this store yet.';
                return;
            }
            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') throw new Error('Notification permission was not granted.');
            }
            const subscription = existingSubscription || await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: decodeVapidKey(data.publicKey)
                });
            const saved = await fetchWithTimeout(`${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/push-subscriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
            if (!saved.ok) {
                const body = await saved.json().catch(() => ({}));
                throw new Error(body.error || 'Could not register offer alerts.');
            }
            notificationButton.textContent = 'Disable deal alerts';
            notificationStatus.textContent = 'Deal alerts are enabled for this browser.';
        } catch (error) {
            notificationStatus.textContent = error.message || 'Could not enable deal alerts.';
        }
    });
}

async function isShopPushSubscribed(shopSlug, endpoint) {
    const query = new URLSearchParams({ endpoint });
    const response = await fetchWithTimeout(
        `${appConfig.apiBaseUrl}/shops/${encodeURIComponent(shopSlug)}/push-subscriptions?${query}`
    );
    if (!response.ok) throw new Error(`Subscription status failed (${response.status}).`);
    const { data } = await response.json();
    return data.subscribed === true;
}

function decodeVapidKey(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

bootstrap().catch((err) => {
    console.error('Shopademia failed to start:', err);
    const errorPanel = document.getElementById('appStartupError');
    if (err.message === 'Store configuration failed (404).') {
        errorPanel.textContent = 'The store API was not found at this address. Start the Shopademia server and open ';
        const link = document.createElement('a');
        link.href = 'http://localhost:3000/';
        link.textContent = 'http://localhost:3000/';
        errorPanel.append(link);
    } else {
        errorPanel.textContent = `The store could not load. ${err.message || 'Please refresh or try again later.'}`;
    }
    errorPanel.classList.remove('hidden');
});
