// Composition root: the only place that knows concrete classes and wires dependencies.
import { appConfig } from './config/app.config.js';
import { trackingConfig } from './config/tracking.config.js';
import { InMemoryProductRepository } from './repositories/InMemoryProductRepository.js';
import { ApiProductRepository } from './repositories/ApiProductRepository.js';
import { MockOrderRepository } from './repositories/MockOrderRepository.js';
import { ApiOrderRepository } from './repositories/ApiOrderRepository.js';
import { CategoryRepository } from './repositories/CategoryRepository.js';
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
import { HeroViewModel } from './viewmodels/HeroViewModel.js';
import { CheckoutViewModel } from './viewmodels/CheckoutViewModel.js';
import { HeaderView } from './views/HeaderView.js';
import { HeroView } from './views/HeroView.js';
import { CategoryGridView } from './views/CategoryGridView.js';
import { ProductGridView } from './views/ProductGridView.js';
import { NewArrivalsView } from './views/NewArrivalsView.js';
import { CartDrawerView } from './views/CartDrawerView.js';
import { CheckoutView } from './views/CheckoutView.js';
import { CustomerProfileView } from './views/CustomerProfileView.js';
import { ToastView } from './views/ToastView.js';
import { fetchWithTimeout } from './utils/fetchWithTimeout.js';

async function bootstrap() {
    const live = !appConfig.useMockApi;
    const runtimeConfig = { ...appConfig, delivery: { ...appConfig.delivery } };
    if (live) {
        const response = await fetchWithTimeout(`${appConfig.apiBaseUrl}/storefront-config`);
        if (!response.ok) throw new Error(`Store configuration failed (${response.status}).`);
        const result = await response.json();
        if (!Number.isSafeInteger(result.delivery?.advanceCharge) || result.delivery.advanceCharge < 0) {
            throw new Error('Store returned an invalid delivery advance configuration.');
        }
        runtimeConfig.delivery.advanceCharge = result.delivery.advanceCharge;
        if (!Number.isSafeInteger(result.demo?.usdToBdt) || result.demo.usdToBdt < 1) {
            throw new Error('Store returned an invalid demo currency conversion rate.');
        }
        runtimeConfig.demoUsdToBdt = result.demo.usdToBdt;
    }
    document.getElementById('demoPriceRate').textContent = `Demo rate: USD 1 = BDT ${runtimeConfig.demoUsdToBdt}.`;
    const productRepo = live ? new ApiProductRepository(appConfig.apiBaseUrl) : new InMemoryProductRepository();
    const orderRepo = live ? new ApiOrderRepository(appConfig.apiBaseUrl) : new MockOrderRepository();
    const cartService = new CartService();
    const wishlistService = new WishlistService();

    const analytics = new AnalyticsService([
        new MetaPixelTracker(trackingConfig.metaPixel),
        new GoogleTagTracker(trackingConfig.googleTag),
        ...(trackingConfig.debug ? [new ConsoleTracker()] : [])
    ]);

    const toastVM = new ToastViewModel();
    const cartVM = new CartViewModel(cartService, toastVM, analytics);
    const wishlistVM = new WishlistViewModel(wishlistService, toastVM);
    const homeVM = new HomeViewModel(productRepo, live ? new ApiCategoryRepository(appConfig.apiBaseUrl) : new CategoryRepository());
    const heroVM = new HeroViewModel(toastVM);
    const checkoutVM = new CheckoutViewModel({ cartService, orderRepository: orderRepo, analytics, toast: toastVM, config: runtimeConfig });

    new ToastView(toastVM);
    new HeaderView({ cartVM, wishlistVM, homeVM });
    new CartDrawerView(cartVM, checkoutVM);
    new CheckoutView(checkoutVM);
    new CustomerProfileView({ apiBaseUrl: appConfig.apiBaseUrl });
    new CategoryGridView(document.getElementById('categoryGrid'), homeVM);
    new ProductGridView(document.getElementById('featuredProductGrid'), { homeVM, cartVM, wishlistVM });
    new NewArrivalsView(document.getElementById('newArrivalsGrid'), homeVM, cartVM);
    new HeroView({ homeVM, cartVM, heroVM });

    await homeVM.load();
    wishlistService.retainAvailable([...homeVM.featured.value, ...homeVM.newArrivals.value, homeVM.heroOffer.value]);
    const availableProducts = [...homeVM.featured.value, ...homeVM.newArrivals.value, homeVM.heroOffer.value];
    const removedCartItems = cartService.reconcile(availableProducts);
    if (removedCartItems) toastVM.show(`${removedCartItems} saved cart item${removedCartItems === 1 ? ' is' : 's are'} no longer available and ${removedCartItems === 1 ? 'was' : 'were'} removed.`);
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
