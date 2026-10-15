import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { Product } from '../models/Product.js';
import { renderProductCard } from './productCard.js';

function requestJson(url) {
    return fetchWithTimeout(url).then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Page data request failed (${response.status}).`);
        return body;
    });
}

export class RoutePageView {
    constructor({ root, apiBaseUrl, shop, route, homeVM, cartVM, checkoutVM, wishlistVM, customerProfileView }) {
        Object.assign(this, { root, apiBaseUrl, shop, route, homeVM, cartVM, checkoutVM, wishlistVM, customerProfileView });
        this.homeSections = [...document.querySelectorAll('[data-home-section]')];
        root.addEventListener('error', (event) => {
            if (!event.target.matches('img[data-product-image]')) return;
            event.target.classList.add('hidden');
            event.target.nextElementSibling?.classList.remove('hidden');
        }, true);
        root.addEventListener('click', (event) => {
            const thumbnail = event.target.closest('[data-product-gallery-image]');
            if (thumbnail) {
                const image = root.querySelector('[data-product-gallery-main]');
                if (image) image.src = thumbnail.dataset.productGalleryImage;
                root.querySelectorAll('[data-product-gallery-image]').forEach((button) => {
                    button.setAttribute('aria-pressed', String(button === thumbnail));
                });
                return;
            }
            const wishlistButton = event.target.closest('[data-route-wishlist]');
            if (wishlistButton) {
                const product = this.homeVM.findProduct(wishlistButton.dataset.routeWishlist);
                if (product) {
                    this.wishlistVM.toggle(product);
                    this.updateWishlistButton(product, wishlistButton);
                }
                return;
            }
            const button = event.target.closest('[data-route-add]');
            const buyNowButton = event.target.closest('[data-route-buy-now]');
            const purchaseButton = button || buyNowButton;
            if (!purchaseButton) return;
            const product = this.homeVM.findProduct(purchaseButton.dataset.routeAdd || purchaseButton.dataset.routeBuyNow);
            if (!product) return;
            if (buyNowButton) {
                if (this.cartVM.add(product)) this.checkoutVM.open();
            } else {
                this.cartVM.add(product);
            }
        });
    }

    updateWishlistButton(product, button = this.root.querySelector('[data-route-wishlist]')) {
        if (!button) return;
        const wished = this.wishlistVM.isWished(product.id);
        button.setAttribute('aria-pressed', String(wished));
        const label = button.querySelector('span');
        button.setAttribute('aria-label', label
            ? (wished ? 'Remove from wishlist' : 'Save to wishlist')
            : (wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`));
        const icon = button.querySelector('i');
        if (icon) icon.className = `fa-${wished ? 'solid' : 'regular'} fa-heart`;
        if (label) label.textContent = wished ? 'Saved' : 'Save';
    }

    async render() {
        if (this.route.type === 'home') {
            this.root.classList.add('hidden');
            this.homeSections.forEach((section) => section.classList.remove('hidden'));
            this.updateMetadata();
            return;
        }
        this.homeSections.forEach((section) => section.classList.add('hidden'));
        document.getElementById('shopOffersPanel').classList.add('hidden');
        document.getElementById('shopBannerPanel').classList.add('hidden');
        this.root.classList.remove('hidden');
        this.root.replaceChildren();
        try {
            switch (this.route.type) {
                case 'product':
                    this.renderProduct();
                    break;
                case 'category':
                    this.renderCategory();
                    break;
                case 'shops':
                    await this.renderShops();
                    break;
                case 'top-selling':
                    await this.renderTopSelling();
                    break;
                case 'shop':
                    await this.renderShop();
                    break;
                case 'deals':
                    await this.renderDeals();
                    break;
                case 'about':
                    this.renderAbout();
                    break;
                case 'find-order':
                    this.renderOrderLookup();
                    break;
                case 'privacy':
                    this.renderPolicy('privacy');
                    break;
                case 'terms':
                    this.renderPolicy('terms');
                    break;
                default:
                    this.renderNotFound();
            }
        } catch (error) {
            this.root.innerHTML = `<section class="route-error" role="alert"><h1>We couldn’t load this page</h1><p>${escapeHtml(error.message)}</p><a class="route-button" href="/">Return to the shop</a></section>`;
        }
        this.updateMetadata();
        window.scrollTo(0, 0);
        this.root.focus({ preventScroll: true });
    }

    productsGrid(products) {
        if (!products.length) return '<p class="route-empty">There are no products to show right now.</p>';
        const wished = this.wishlistVM.ids.value;
        return `<div class="route-product-grid">${products.map((product) =>
            renderProductCard({ product, shopSlug: this.shop.slug, isWished: wished.has(String(product.id)), mode: 'route' })
        ).join('')}</div>`;
    }

    renderProduct() {
        const product = this.homeVM.findProduct(this.route.id);
        if (!product) return this.renderNotFound('Product not found');
        const available = product.isAvailable !== false && product.stockQuantity !== 0
            && product.isAvailableForPurchase !== false;
        const availabilityLabel = product.isAvailable === false ? 'Unavailable' : 'Out of stock';
        const fallbackIcon = /^[a-z0-9-]+$/.test(product.icon) ? product.icon : 'fa-box-open';
        const wished = this.wishlistVM.isWished(product.id);
        const images = [...new Set((product.images?.length ? product.images : [product.image])
            .filter((imageUrl) => isSafeProductImage(imageUrl)))];
        const image = images.length
            ? `<img data-product-gallery-main src="${escapeHtml(images[0])}" alt="${escapeHtml(product.imageAlt || product.name)}">`
            : `<i class="fa-solid ${fallbackIcon}" aria-hidden="true"></i>`;
        const gallery = images.length > 1
            ? `<div class="route-image-thumbnails" role="group" aria-label="Product images">${images.map((imageUrl, index) =>
                `<button type="button" data-product-gallery-image="${escapeHtml(imageUrl)}" aria-label="Show product image ${index + 1}" aria-pressed="${index === 0}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy"></button>`
            ).join('')}</div>`
            : '';
        const category = this.homeVM.categories.value.find(({ id }) => id === product.category);
        const categoryLink = category
            ? `<a href="/category/${encodeURIComponent(category.id)}?shop=${encodeURIComponent(this.shop.slug)}">${escapeHtml(category.name)}</a>`
            : '<span>Unassigned</span>';
        const categoryBadge = category
            ? `<a class="route-detail-category" href="/category/${encodeURIComponent(category.id)}?shop=${encodeURIComponent(this.shop.slug)}"><i class="fa-solid ${escapeHtml(category.icon || 'fa-tag')}" aria-hidden="true"></i>${escapeHtml(category.name)}</a>`
            : '<span class="route-detail-category">Unassigned</span>';
        this.root.innerHTML = `<nav class="route-breadcrumb" aria-label="Breadcrumb"><a href="/?shop=${encodeURIComponent(this.shop.slug)}">Home</a><span aria-hidden="true">/</span>${categoryLink}<span aria-hidden="true">/</span><span>${escapeHtml(product.name)}</span></nav>
            <article class="route-product-detail">
                <div class="route-detail-visual"><div class="route-detail-image">${image}</div>${gallery}<span class="route-visual-caption"><i class="fa-solid fa-shield-heart" aria-hidden="true"></i> Shop direct · Order reviewed by the seller</span></div>
                <div class="route-detail-copy">${categoryBadge}
                <a class="route-seller-card" href="/shops/${encodeURIComponent(this.shop.slug)}" aria-label="Visit ${escapeHtml(this.shop.name)} shop profile">
                    <span class="route-seller-avatar" aria-hidden="true"><i class="fa-solid fa-store"></i></span>
                    <span class="route-seller-copy"><span class="route-seller-label">Sold by</span><strong>${escapeHtml(this.shop.name)}</strong></span>
                    <span class="route-seller-visit">Visit shop <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
                </a>
                <h1>${escapeHtml(product.name)}</h1>
                <div class="route-price-row"><strong>${formatPrice(product.price)}</strong>${product.hasDiscount ? `<del>${formatPrice(product.oldPrice)}</del><span class="route-discount">Save ${product.discountPercent}%</span>` : ''}</div>
                <p>${escapeHtml(product.description || 'Product information is not available yet.')}</p>
                <p class="route-stock ${available ? '' : 'is-unavailable'}"><span aria-hidden="true"></span>${available ? Number.isSafeInteger(product.stockQuantity) ? `${product.stockQuantity} in stock` : 'Available to order' : availabilityLabel}</p>
                <div class="route-purchase-actions">
                    <button class="route-button route-add-button" type="button" data-route-add="${escapeHtml(product.id)}" ${available ? '' : 'disabled'}><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>${available ? 'Add to cart' : availabilityLabel}</button>
                    <button class="market-product-buy route-buy-button" type="button" data-route-buy-now="${escapeHtml(product.id)}" ${available ? '' : 'disabled'}>${available ? 'Buy now' : availabilityLabel}</button>
                    <button class="route-wishlist-button" type="button" data-route-wishlist="${escapeHtml(product.id)}" aria-label="${wished ? 'Remove from wishlist' : 'Save to wishlist'}" aria-pressed="${wished}"><i class="fa-${wished ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i><span>${wished ? 'Saved' : 'Save'}</span></button>
                </div>
                <section class="route-order-steps" aria-labelledby="route-order-steps-title">
                    <h2 id="route-order-steps-title">How ordering works</h2>
                    <ol><li><span>1</span><div><strong>Add to your cart</strong><p>Keep the items you want together.</p></div></li>
                    <li><span>2</span><div><strong>Send an order request</strong><p>The shop reviews your request before confirming.</p></div></li>
                    <li><span>3</span><div><strong>Coordinate with the shop</strong><p>Payment instructions are shared separately.</p></div></li></ol>
                    <p class="route-payment-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Shopademia does not collect payment on this page.</span></p>
                </section></div>
            </article>`;
        document.title = `${product.name} | ${this.shop.name}`;
    }

    renderCategory() {
        const category = this.homeVM.categories.value.find(({ id }) => id === this.route.id);
        if (!category) return this.renderNotFound('Category not found');
        const products = this.homeVM.getAllProducts().filter((product) => product.category === category.id);
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">${escapeHtml(this.shop.name)} · CATEGORY</p><h1>${escapeHtml(category.name)}</h1><p>Browse ${escapeHtml(category.name.toLowerCase())} from this shop.</p></header>${this.productsGrid(products)}`;
        document.title = `${category.name} | ${this.shop.name}`;
    }

    shopCard(shop) {
        const image = shop.logoImage || shop.bannerImage;
        const art = isSafeProductImage(image)
            ? `<img class="${shop.logoImage && !shop.bannerImage ? 'shop-logo-art' : ''}" src="${escapeHtml(image)}" alt="" loading="lazy">`
            : '<span class="route-shop-placeholder" aria-hidden="true"><i class="fa-solid fa-store"></i></span>';
        return `<article class="route-shop-card marketplace-shop-card">
            <a class="route-shop-art" href="/shops/${encodeURIComponent(shop.slug)}" tabindex="-1" aria-hidden="true">${art}</a>
            <div>
                <p class="route-eyebrow">INDEPENDENT SHOP</p>
                <h3><a href="/shops/${encodeURIComponent(shop.slug)}">${escapeHtml(shop.name)}</a></h3>
                ${shop.description ? `<p>${escapeHtml(shop.description)}</p>` : '<p>Explore this shop’s products and latest offers.</p>'}
                ${shop.location ? `<p class="route-shop-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(shop.location)}</p>` : ''}
                <a class="route-text-link" href="/shops/${encodeURIComponent(shop.slug)}">Explore shop <span aria-hidden="true">→</span></a>
            </div>
        </article>`;
    }

    async renderShops() {
        const { data } = await requestJson(`${this.apiBaseUrl}/shops`);
        if (!Array.isArray(data)) throw new Error('The shop directory returned invalid data.');
        const cards = data.map((shop) => this.shopCard(shop)).join('');
        this.root.innerHTML = `<header class="shops-directory-hero">
                <div class="shops-directory-copy">
                    <p class="route-eyebrow">THE SHOPADEMIA DIRECTORY</p>
                    <h1>Find your next favorite shop.</h1>
                    <p>Meet independent sellers, explore their storefronts, and discover collections selected by each shop.</p>
                    <div class="shops-directory-summary">
                        <span class="shops-directory-count"><i class="fa-solid fa-store" aria-hidden="true"></i><strong>${data.length}</strong> ${data.length === 1 ? 'shop' : 'shops'} to explore</span>
                        <span class="shops-directory-promise"><i class="fa-solid fa-shield-heart" aria-hidden="true"></i> Shop directly with each seller</span>
                    </div>
                </div>
                <div class="shops-directory-art" aria-hidden="true"><span class="shops-directory-art-orbit"></span><i class="fa-solid fa-store"></i><span class="shops-directory-art-tag">Independent finds</span></div>
            </header>
            <section class="shops-directory-results" aria-labelledby="shopsDirectoryTitle">
                <div class="shops-directory-results-heading"><div><p class="route-eyebrow">BROWSE THE MARKETPLACE</p><h2 id="shopsDirectoryTitle">All shops <span>${data.length}</span></h2></div><p>Choose a shop to see its products, categories, and current offers.</p></div>
                ${data.length ? `<div class="route-shop-grid marketplace-shop-grid${data.length === 1 ? ' is-single-shop' : ''}">${cards}</div>` : '<p class="route-empty">There are no active shops to show right now.</p>'}
            </section>`;
        document.title = 'Our shops | Shopademia';
    }

    async renderShop() {
        const [{ data: shop }, { data: offers }] = await Promise.all([
            requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}`),
            requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}/offers`)
        ]);
        const cover = isSafeProductImage(shop.bannerImage)
            ? `<img src="${escapeHtml(shop.bannerImage)}" alt="">`
            : '<span class="shop-profile-cover-art" aria-hidden="true"><i class="fa-solid fa-store"></i></span>';
        const avatar = isSafeProductImage(shop.logoImage)
            ? `<img src="${escapeHtml(shop.logoImage)}" alt="">`
            : '<i class="fa-solid fa-store" aria-hidden="true"></i>';
        const categories = this.homeVM.categories.value.map((category) =>
            `<a class="route-chip" href="/category/${encodeURIComponent(category.id)}?shop=${encodeURIComponent(shop.slug)}">${escapeHtml(category.name)}</a>`
        ).join('');
        const offerCards = offers.map((offer) => `<article class="route-offer-card"><p class="route-eyebrow">CURRENT OFFER</p><h2>${escapeHtml(offer.title)}</h2><p>${escapeHtml(offer.message)}</p></article>`).join('');
        const contacts = [
            shop.contactEmail ? `<a href="mailto:${escapeHtml(shop.contactEmail)}"><i class="fa-solid fa-envelope" aria-hidden="true"></i> ${escapeHtml(shop.contactEmail)}</a>` : '',
            shop.contactPhone ? `<a href="tel:${encodeURIComponent(shop.contactPhone)}"><i class="fa-solid fa-phone" aria-hidden="true"></i> ${escapeHtml(shop.contactPhone)}</a>` : '',
            shop.contactWhatsApp ? `<a href="https://wa.me/${shop.contactWhatsApp.replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>` : ''
        ].filter(Boolean).join('');
        const products = this.homeVM.getAllProducts();
        const tabs = [
            `<a href="#shop-profile-products">Products <span>${products.length}</span></a>`,
            `<a href="#shop-profile-categories">Categories <span>${this.homeVM.categories.value.length}</span></a>`,
            ...(offers.length ? [`<a href="#shop-profile-offers">Offers <span>${offers.length}</span></a>`] : [])
        ].join('');
        const contactAction = shop.contactWhatsApp
            ? `<a class="shop-profile-contact-button" href="https://wa.me/${shop.contactWhatsApp.replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Contact shop</a>`
            : shop.contactEmail
                ? `<a class="shop-profile-contact-button" href="mailto:${escapeHtml(shop.contactEmail)}"><i class="fa-solid fa-envelope" aria-hidden="true"></i> Contact shop</a>`
                : '';
        this.root.innerHTML = `<article class="shop-profile">
                <div class="shop-profile-cover">${cover}<span class="shop-profile-cover-label"><i class="fa-solid fa-store" aria-hidden="true"></i> Shopademia storefront</span></div>
                <header class="shop-profile-header">
                    <div class="shop-profile-avatar" aria-hidden="true">${avatar}</div>
                    <div class="shop-profile-identity">
                        <p class="route-eyebrow">INDEPENDENT SHOP</p>
                        <h1>${escapeHtml(shop.name)}</h1>
                        <p class="shop-profile-description">${escapeHtml(shop.description || `Welcome to ${shop.name}. Browse this shop’s products and current offers.`)}</p>
                        ${shop.location ? `<p class="route-shop-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(shop.location)}</p>` : ''}
                    </div>
                    <div class="shop-profile-actions"><a class="route-button" href="#shop-profile-products"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Browse products</a>${contactAction}</div>
                    ${contacts ? `<nav class="route-shop-contacts shop-profile-contacts" aria-label="Shop contact details">${contacts}</nav>` : ''}
                </header>
                <div class="shop-profile-stats" aria-label="Shop information">
                    <span><strong>${products.length}</strong> ${products.length === 1 ? 'product' : 'products'}</span>
                    <span><strong>${this.homeVM.categories.value.length}</strong> ${this.homeVM.categories.value.length === 1 ? 'category' : 'categories'}</span>
                    <span><strong>${offers.length}</strong> ${offers.length === 1 ? 'current offer' : 'current offers'}</span>
                    ${shop.location ? `<span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(shop.location)}</span>` : ''}
                </div>
                <nav class="shop-profile-tabs" aria-label="Shop profile sections">${tabs}</nav>
            </article>
            <section id="shop-profile-categories" class="route-subsection shop-profile-section"><header class="route-heading route-heading-small"><p class="route-eyebrow">EXPLORE THE SHOP</p><h2>Categories</h2></header><div class="route-chip-row">${categories || '<p class="route-empty">Categories will appear here when available.</p>'}</div></section>
            ${offerCards ? `<section id="shop-profile-offers" class="route-subsection shop-profile-section"><header class="route-heading route-heading-small"><p class="route-eyebrow">WHAT’S NEW</p><h2>Offers and announcements</h2></header><div class="route-offer-grid">${offerCards}</div></section>` : ''}
            <section id="shop-profile-products" class="route-subsection shop-profile-section"><header class="route-heading route-heading-small"><p class="route-eyebrow">SHOP THE COLLECTION</p><h2>Products from ${escapeHtml(shop.name)}</h2></header>${this.productsGrid(products)}</section>`;
        document.title = `${shop.name} | Shopademia`;
    }

    async renderDeals() {
        const [{ data: offers }, { data: discountedProducts }] = await Promise.all([
            requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}/offers`),
            requestJson(`${this.apiBaseUrl}/discounted-products`)
        ]);
        const offerCards = offers.map((offer) => `<article class="route-offer-card"><p class="route-eyebrow">SHOP OFFER</p><h2>${escapeHtml(offer.title)}</h2><p>${escapeHtml(offer.message)}</p></article>`).join('');
        const products = discountedProducts.map((item) => Object.assign(new Product(item), {
            shopSlug: item.shopSlug,
            shopName: item.shopName
        }));
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">MARKETPLACE SAVINGS</p><h1>Deals and offers</h1><p>Browse every currently discounted product from active shops across Shopademia.</p></header>${offerCards ? `<div class="route-offer-grid">${offerCards}</div>` : ''}<section class="route-subsection"><header class="route-heading route-heading-small"><h2>Discounted products</h2></header>${this.productsGrid(products)}</section>`;
        document.title = 'Deals and offers | Shopademia';
    }

    async renderTopSelling() {
        const { data } = await requestJson(`${this.apiBaseUrl}/top-selling`);
        if (!Array.isArray(data)) throw new Error('The weekly top products response is invalid.');
        const products = data.map((item) => Object.assign(new Product(item), {
            shopSlug: item.shopSlug,
            shopName: item.shopName
        }));
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">TRENDING THIS WEEK</p><h1>Top selling this week</h1><p>Popular products ranked by non-cancelled order requests placed since the start of this week.</p></header><section class="route-subsection"><header class="route-heading route-heading-small"><h2>Top products across our shops</h2></header>${this.productsGrid(products)}</section>`;
        document.title = 'Top selling this week | Shopademia';
    }

    renderAbout() {
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">ABOUT</p><h1>Shopping with ${escapeHtml(this.shop.name)}</h1><p>Explore products from our independent shops and send an order request directly to the shop.</p></header>
            <section class="route-about-grid"><article><span class="route-about-icon"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i></span><h2>Browse with confidence</h2><p>Each shop has its own storefront, products, categories, and offers.</p></article><article><span class="route-about-icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span><h2>Order requests</h2><p>After you submit a request, the shop reviews it and contacts you about next steps.</p></article><article><span class="route-about-icon"><i class="fa-solid fa-receipt" aria-hidden="true"></i></span><h2>Keep your receipt</h2><p>Download your order receipt after submitting your request. It is not proof of payment.</p></article></section>
            <section class="route-subsection route-faq" aria-labelledby="faqTitle"><header class="route-heading route-heading-small"><p class="route-eyebrow">HELP &amp; ANSWERS</p><h2 id="faqTitle">Frequently asked questions</h2><p>How orders, payments, and shop policies work on Shopademia.</p></header>
                <details><summary>Is my order confirmed when I submit it?</summary><p>No. Submitting an order sends a request to the shop. The shop reviews availability and contacts you to confirm the order and explain the next steps.</p></details>
                <details><summary>How do I pay for an order?</summary><p>Shopademia does not collect or verify payment through this storefront. Arrange payment directly with the shop using instructions you have verified with them. A submitted transaction reference is not proof of payment.</p></details>
                <details><summary>How can I check my order status?</summary><p>Open <a href="/find-order?shop=${encodeURIComponent(this.shop.slug)}">Find your order</a> and enter the order number and phone number used at checkout.</p></details>
                <details><summary>Can I use the downloadable receipt as proof of payment?</summary><p>No. The receipt confirms that an order request was submitted; it does not confirm payment. Payment status must be confirmed directly by the shop.</p></details>
                <details><summary>What are the delivery, return, or refund terms?</summary><p>These terms can differ by shop. Ask the shop directly and review its terms before completing a sale.</p></details>
            </section>`;
        document.title = `About | ${this.shop.name}`;
    }

    renderOrderLookup() {
        this.root.innerHTML = '<header class="route-heading"><p class="route-eyebrow">ORDER SUPPORT</p><h1>Find your order</h1><p>Enter the order number and phone number used at checkout.</p></header><div id="routeOrderLookup"></div>';
        this.customerProfileView.showStandalone(document.getElementById('routeOrderLookup'));
        document.title = `Find your order | ${this.shop.name}`;
    }

    renderPolicy(type) {
        const isPrivacy = type === 'privacy';
        const title = isPrivacy ? 'Privacy policy' : 'Terms & conditions';
        this.root.innerHTML = isPrivacy
            ? `<article class="route-policy"><p class="route-eyebrow">SHOPADEMIA · PRIVACY</p><h1>Privacy policy</h1><p class="route-policy-updated">Last updated: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>This policy explains how Shopademia handles information when you browse shops or send an order request. Each shop fulfils its own orders. This page is a plain-language description, not legal advice; the operator should review it for the jurisdictions and business practices that apply.</p>
                <h2>Information you provide</h2><p>When you submit an order request, we process your name, phone number, delivery details, requested items, and any transaction reference or sender number you choose to provide. This information is used to create the request, show its status, and let the relevant shop contact you. Order lookup uses the order number and phone number submitted with that request.</p>
                <h2>How information is shared and retained</h2><p>Order details are available to the shop handling the order and to authorised Shopademia administrators for platform operations. We do not sell personal information. Order records are kept in the service database for operational and record-keeping purposes; contact the relevant shop or Shopademia to ask about a record. The operator should set a retention schedule appropriate to applicable law.</p>
                <h2>Browser storage and cookies</h2><p>Cart and wishlist items are stored in your browser so they remain available on that device. A necessary preference stores your cookie choice. Optional analytics are disabled until you allow them in the privacy banner; if configured, the analytics provider may use cookies or similar technologies. Use Cookie settings in the footer to change your choice. Clearing browser storage removes locally saved cart and wishlist items.</p>
                <h2>Payments and security</h2><p>Shopademia does not collect card payments through this storefront. Shops may contact you separately about manual payment arrangements. A submitted transaction reference is not proof of payment. We use access controls and operational safeguards, but no internet service can guarantee absolute security.</p>
                <h2>Contact</h2><p>For privacy questions, contact <a href="mailto:shopademia.official@gmail.com">shopademia.official@gmail.com</a> or call <a href="tel:+8801560024777">+880 1560-024777</a>.</p></article>`
            : `<article class="route-policy"><p class="route-eyebrow">SHOPADEMIA · TERMS</p><h1>Terms &amp; conditions</h1><p class="route-policy-updated">Last updated: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>These terms describe use of the Shopademia storefront. By browsing or sending an order request, you agree to use the service lawfully. The operator should obtain local legal review before relying on these terms as a binding agreement.</p>
                <h2>Shop listings and orders</h2><p>Shopademia provides a platform for independent shops to display products, prices, stock, and offers. Product information may change. An order submission is a request, not a confirmed sale; the relevant shop reviews it and communicates acceptance, availability, delivery, and payment instructions.</p>
                <h2>Payments, delivery, and returns</h2><p>Shopademia does not process or verify payment on this site. A transaction number entered by a customer is for the shop’s manual review only and is not proof of payment. The shop is responsible for arranging fulfilment and explaining its delivery, cancellation, return, and refund terms before completing a sale.</p>
                <h2>Customer responsibilities</h2><p>Provide accurate contact and delivery information, keep your order number private, and only send payments using instructions verified directly with the shop. Do not misuse the storefront, interfere with its operation, or submit false or unauthorised requests.</p>
                <h2>Availability and contact</h2><p>The service and its listings are provided as available and may be changed or withdrawn. Nothing in these terms excludes rights that cannot lawfully be excluded. Questions can be sent to <a href="mailto:shopademia.official@gmail.com">shopademia.official@gmail.com</a>.</p></article>`;
        document.title = `${title} | Shopademia`;
    }

    updateMetadata() {
        const descriptions = {
            home: `Browse products and current offers from ${this.shop.name}. Send an order request to the shop on Shopademia.`,
            product: `Explore ${document.querySelector('#routePage h1')?.textContent || 'this product'} from ${this.shop.name} on Shopademia.`,
            category: `Browse ${document.querySelector('#routePage h1')?.textContent || 'products'} products from ${this.shop.name} on Shopademia.`,
            shops: 'Explore independent shops, storefronts, products, and current deals on Shopademia.',
            'top-selling': 'Browse popular products from independent shops, ranked by this week’s non-cancelled order requests.',
            shop: `Visit ${document.querySelector('#routePage h1')?.textContent || this.shop.name} on Shopademia to browse its shop profile, products, and current offers.`,
            deals: 'Browse discounted products from active independent shops across the Shopademia marketplace.',
            about: 'Learn how Shopademia connects customers with independent shops and order requests.',
            'find-order': 'Look up your Shopademia order request using your order number and checkout phone number.',
            privacy: 'Learn what information Shopademia processes and how browser storage and optional analytics work.',
            terms: 'Review the terms for browsing Shopademia and submitting order requests to independent shops.',
            'not-found': 'The page you requested could not be found on Shopademia.'
        };
        const product = this.route.type === 'product' ? this.homeVM.findProduct(this.route.id) : null;
        const productDescription = product?.description?.trim().replace(/\s+/g, ' ');
        const description = this.route.type === 'product' && product?.metaDescription
            ? product.metaDescription
            : this.route.type === 'product' && productDescription
            ? (productDescription.length > 160 ? `${productDescription.slice(0, 157).trimEnd()}…` : productDescription)
            : descriptions[this.route.type] || descriptions['not-found'];
        const pageHeading = document.querySelector('#routePage h1')?.textContent?.trim();
        const titles = {
            home: `Shop products and deals | ${this.shop.name} | Shopademia`,
            product: `${product?.seoTitle || product?.name || pageHeading || 'Product'} | ${this.shop.name} | Shopademia`,
            category: `${pageHeading || 'Products'} | ${this.shop.name} | Shopademia`,
            shops: 'Explore our shops | Shopademia',
            'top-selling': 'Top selling this week | Shopademia',
            shop: `${pageHeading || this.shop.name} | Shopademia`,
            deals: 'Deals and offers | Shopademia',
            about: `About ${this.shop.name} | Shopademia`,
            'find-order': `Find your order | ${this.shop.name} | Shopademia`,
            privacy: 'Privacy policy | Shopademia',
            terms: 'Terms & conditions | Shopademia',
            'not-found': `Page not found | ${this.shop.name} | Shopademia`
        };
        document.title = titles[this.route.type] || titles['not-found'];
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.append(meta);
        }
        meta.content = description;
        const canonicalShop = ['home', 'product', 'category', 'deals', 'about', 'find-order'].includes(this.route.type)
            ? new URLSearchParams(window.location.search).get('shop')
            : null;
        const canonicalQuery = canonicalShop && canonicalShop !== 'main'
            ? `?shop=${encodeURIComponent(canonicalShop)}`
            : '';
        const canonicalUrl = `${window.location.origin}${window.location.pathname}${canonicalQuery}`;
        for (const [property, content] of [['og:title', document.title], ['og:description', description], ['og:url', canonicalUrl], ['og:image', `${window.location.origin}/public-assets/social-preview.png`]]) {
            let tag = document.querySelector(`meta[property="${property}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute('property', property);
                document.head.append(tag);
            }
            let twitterImage = document.querySelector('meta[name="twitter:image"]');
            if (!twitterImage) {
                twitterImage = document.createElement('meta');
                twitterImage.name = 'twitter:image';
                document.head.append(twitterImage);
            }
            twitterImage.content = `${window.location.origin}/public-assets/social-preview.png`;
            tag.content = content;
        }
        for (const [name, content] of [['twitter:title', document.title], ['twitter:description', description]]) {
            let tag = document.querySelector(`meta[name="${name}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.name = name;
                document.head.append(tag);
            }
            tag.content = content;
        }
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.append(canonical);
        }
        canonical.href = canonicalUrl;
    }

    renderNotFound(title = 'Page not found') {
        this.root.innerHTML = `<section class="route-error"><p class="route-eyebrow">${escapeHtml(this.shop.name)}</p><h1>${escapeHtml(title)}</h1><p>We couldn’t find what you were looking for in this shop.</p><a class="route-button" href="/?shop=${encodeURIComponent(this.shop.slug)}">Return to this shop</a></section>`;
        document.title = `${title} | ${this.shop.name}`;
    }
}
