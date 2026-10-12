import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

function requestJson(url) {
    return fetchWithTimeout(url).then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Page data request failed (${response.status}).`);
        return body;
    });
}

export class RoutePageView {
    constructor({ root, apiBaseUrl, shop, route, homeVM, cartVM, customerProfileView }) {
        Object.assign(this, { root, apiBaseUrl, shop, route, homeVM, cartVM, customerProfileView });
        this.homeSections = [...document.querySelectorAll('[data-home-section]')];
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
            const button = event.target.closest('[data-route-add]');
            if (!button) return;
            const product = this.homeVM.findProduct(button.dataset.routeAdd);
            if (product) this.cartVM.add(product);
        });
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
        return `<div class="route-product-grid">${products.map((product) => {
            const image = isSafeProductImage(product.image)
                ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy">`
                : `<span class="route-product-placeholder" aria-hidden="true"><i class="fa-solid fa-box"></i></span>`;
            const category = this.homeVM.categories.value.find(({ id }) => id === product.category);
            const categoryLink = category
                ? `<a class="route-category-link" href="/category/${encodeURIComponent(category.id)}?shop=${encodeURIComponent(this.shop.slug)}">${escapeHtml(category.name)}</a>`
                : '<span class="route-category-link">Unassigned</span>';
            const productLink = `/product/${encodeURIComponent(product.id)}?shop=${encodeURIComponent(this.shop.slug)}`;
            return `<article class="route-product-card">
                <a class="route-product-image" href="${productLink}">${image}</a>
                <div class="route-product-copy">
                    ${categoryLink}
                    <h2><a href="${productLink}">${escapeHtml(product.name)}</a></h2>
                    <p>${escapeHtml(product.description || 'Discover more about this item.')}</p>
                    <div class="route-price-row"><strong>${formatPrice(product.price)}</strong>${product.hasDiscount ? `<del>${formatPrice(product.oldPrice)}</del><span class="route-discount">-${product.discountPercent}%</span>` : ''}</div>
                    <button class="route-button" type="button" data-route-add="${escapeHtml(product.id)}" ${product.isAvailableForPurchase === false ? 'disabled' : ''}>${product.isAvailableForPurchase === false ? 'Unavailable' : 'Add to cart'}</button>
                </div>
            </article>`;
        }).join('')}</div>`;
    }

    renderProduct() {
        const product = this.homeVM.findProduct(this.route.id);
        if (!product) return this.renderNotFound('Product not found');
        const fallbackIcon = /^[a-z0-9-]+$/.test(product.icon) ? product.icon : 'fa-box-open';
        const images = [...new Set((product.images?.length ? product.images : [product.image])
            .filter((imageUrl) => isSafeProductImage(imageUrl)))];
        const image = images.length
            ? `<img data-product-gallery-main src="${escapeHtml(images[0])}" alt="${escapeHtml(product.imageAlt || product.name)}">`
            : `<i class="fa-solid ${fallbackIcon}" aria-hidden="true"></i>`;
        const gallery = images.length > 1
            ? `<div class="route-image-thumbnails" aria-label="Product images">${images.map((imageUrl, index) =>
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
                <p class="route-stock ${product.isAvailableForPurchase === false ? 'is-unavailable' : ''}"><span aria-hidden="true"></span>${product.isAvailableForPurchase === false ? 'Currently unavailable' : Number.isSafeInteger(product.stockQuantity) ? `${product.stockQuantity} in stock` : 'Available to order'}</p>
                <button class="route-button route-add-button" type="button" data-route-add="${escapeHtml(product.id)}" ${product.isAvailableForPurchase === false ? 'disabled' : ''}><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>${product.isAvailableForPurchase === false ? 'Unavailable' : 'Add to cart'}</button>
                <div class="route-payment-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Order requests are reviewed by the shop. Payment instructions are shared separately; this site does not collect payment.</span></div></div>
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

    async renderShops() {
        const { data } = await requestJson(`${this.apiBaseUrl}/shops`);
        if (!Array.isArray(data)) throw new Error('The shop directory returned invalid data.');
        const cards = data.map((shop) => {
            const image = shop.logoImage || shop.bannerImage;
            const art = isSafeProductImage(image) ? `<img class="${shop.logoImage && !shop.bannerImage ? 'shop-logo-art' : ''}" src="${escapeHtml(image)}" alt="" loading="lazy">` : '<span class="route-shop-placeholder"><i class="fa-solid fa-store" aria-hidden="true"></i></span>';
            return `<article class="route-shop-card"><a class="route-shop-art" href="/shops/${encodeURIComponent(shop.slug)}">${art}</a><div><p class="route-eyebrow">SHOP</p><h2><a href="/shops/${encodeURIComponent(shop.slug)}">${escapeHtml(shop.name)}</a></h2>${shop.description ? `<p>${escapeHtml(shop.description)}</p>` : ''}${shop.location ? `<p class="route-shop-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(shop.location)}</p>` : ''}<a class="route-text-link" href="/shops/${encodeURIComponent(shop.slug)}">Visit shop <span aria-hidden="true">→</span></a></div></article>`;
        }).join('');
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">SHOPADEMIA DIRECTORY</p><h1>Explore our shops</h1><p>Browse each shop’s own storefront, products, and current deals.</p></header>${data.length ? `<div class="route-shop-grid">${cards}</div>` : '<p class="route-empty">There are no active shops to show right now.</p>'}`;
        document.title = 'Our shops | Shopademia';
    }

    async renderShop() {
        const [{ data: shop }, { data: offers }] = await Promise.all([
            requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}`),
            requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}/offers`)
        ]);
        const banner = isSafeProductImage(shop.bannerImage || shop.logoImage)
            ? `<img class="${shop.bannerImage ? '' : 'shop-logo-banner'}" src="${escapeHtml(shop.bannerImage || shop.logoImage)}" alt="${escapeHtml(shop.name)} ${shop.bannerImage ? 'banner' : 'logo'}">`
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
        const topSellers = Array.isArray(shop.topProducts) ? shop.topProducts : [];
        const productsById = new Map(this.homeVM.getAllProducts().map((product) => [String(product.id), product]));
        const topSellerItems = topSellers.map(({ productId, name, quantity }) => {
            const product = productsById.get(String(productId));
            const productName = product?.name || name || 'Product';
            const label = product
                ? `<a href="/product/${encodeURIComponent(product.id)}?shop=${encodeURIComponent(shop.slug)}">${escapeHtml(productName)}</a>`
                : `<span>${escapeHtml(productName)}</span>`;
            return `<li>${label}<span>${escapeHtml(String(quantity))} ordered</span></li>`;
        }).join('');
        this.root.innerHTML = `<section class="route-shop-hero"><div class="route-shop-banner">${banner}</div><div><p class="route-eyebrow">SHOP PROFILE</p><h1>${escapeHtml(shop.name)}</h1><p>${escapeHtml(shop.description || `Welcome to the ${shop.name} storefront. Explore this shop’s products and current offers.`)}</p>${shop.location ? `<p class="route-shop-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(shop.location)}</p>` : ''}${contacts ? `<nav class="route-shop-contacts" aria-label="Shop contact details">${contacts}</nav>` : ''}<a class="route-button route-button-link" href="/?shop=${encodeURIComponent(shop.slug)}#shop">Browse this shop</a></div></section>
            <section class="route-subsection"><header class="route-heading route-heading-small"><h2>Shop categories</h2></header><div class="route-chip-row">${categories}</div></section>
            <section class="route-subsection"><header class="route-heading route-heading-small"><h2>Top selling products</h2></header>${topSellerItems ? `<ol class="route-top-sellers">${topSellerItems}</ol>` : '<p class="route-empty">Top sellers will appear here as orders are placed.</p>'}</section>
            ${offerCards ? `<section class="route-subsection"><header class="route-heading route-heading-small"><h2>Deals and announcements</h2></header><div class="route-offer-grid">${offerCards}</div></section>` : ''}
            <section class="route-subsection"><header class="route-heading route-heading-small"><h2>Products from ${escapeHtml(shop.name)}</h2></header>${this.productsGrid(this.homeVM.getAllProducts())}</section>`;
        document.title = `${shop.name} | Shopademia`;
    }

    async renderDeals() {
        const { data: offers } = await requestJson(`${this.apiBaseUrl}/shops/${encodeURIComponent(this.shop.slug)}/offers`);
        const offerCards = offers.map((offer) => `<article class="route-offer-card"><p class="route-eyebrow">SHOP OFFER</p><h2>${escapeHtml(offer.title)}</h2><p>${escapeHtml(offer.message)}</p></article>`).join('');
        const discounts = this.homeVM.getAllProducts().filter((product) => product.hasDiscount);
        this.root.innerHTML = `<header class="route-heading"><p class="route-eyebrow">${escapeHtml(this.shop.name)}</p><h1>Deals and offers</h1><p>Current price reductions and announcements from this shop.</p></header>${offerCards ? `<div class="route-offer-grid">${offerCards}</div>` : ''}<section class="route-subsection"><header class="route-heading route-heading-small"><h2>Discounted products</h2></header>${this.productsGrid(discounts)}</section>`;
        document.title = `Deals | ${this.shop.name}`;
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
            shop: `Visit ${document.querySelector('#routePage h1')?.textContent || this.shop.name} on Shopademia to browse its shop profile, products, and current offers.`,
            deals: `Browse current offers and discounted products from ${this.shop.name}.`,
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
            shop: `${pageHeading || this.shop.name} | Shopademia`,
            deals: `Deals and offers | ${this.shop.name} | Shopademia`,
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
