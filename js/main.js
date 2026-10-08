// Composition root: the only place that knows concrete classes and wires dependencies.
import { appConfig } from './config/app.config.js';
import { trackingConfig } from './config/tracking.config.js';
import { InMemoryProductRepository } from './repositories/InMemoryProductRepository.js';
import { ApiProductRepository } from './repositories/ApiProductRepository.js';
import { MockOrderRepository } from './repositories/MockOrderRepository.js';
import { ApiOrderRepository } from './repositories/ApiOrderRepository.js';
import { CategoryRepository } from './repositories/CategoryRepository.js';
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
import { ToastView } from './views/ToastView.js';

async function bootstrap() {
    const live = !appConfig.useMockApi;
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
    const homeVM = new HomeViewModel(productRepo, new CategoryRepository());
    const heroVM = new HeroViewModel(toastVM);
    const checkoutVM = new CheckoutViewModel({ cartService, orderRepository: orderRepo, analytics, toast: toastVM, config: appConfig });

    new ToastView(toastVM);
    new HeaderView({ cartVM, wishlistVM, homeVM });
    new CartDrawerView(cartVM, checkoutVM);
    new CheckoutView(checkoutVM, appConfig);
    new CategoryGridView(document.getElementById('categoryGrid'), homeVM);
    new ProductGridView(document.getElementById('featuredProductGrid'), { homeVM, cartVM, wishlistVM });
    new NewArrivalsView(document.getElementById('newArrivalsGrid'), homeVM);
    new HeroView({ homeVM, cartVM, heroVM });

    await homeVM.load();
}

bootstrap().catch((err) => console.error('Shopademia failed to start:', err));
