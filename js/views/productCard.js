import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export function renderProductCard({ product, shopSlug, isWished = false, mode = 'home' }) {
    const productShopSlug = product.shopSlug || shopSlug;
    const productLink = `/product/${encodeURIComponent(product.id)}?shop=${encodeURIComponent(productShopSlug)}`;
    const imageUrl = isSafeProductImage(product.image) ? product.image : '';
    const icon = /^[a-z0-9-]+$/.test(product.icon) ? product.icon : 'fa-box';
    const available = product.isAvailable !== false && product.stockQuantity !== 0
        && product.isAvailableForPurchase !== false;
    const availabilityLabel = product.isAvailable === false ? 'Unavailable' : 'Out of stock';
    const routeMode = mode === 'route';
    const wishlistAction = routeMode
        ? `data-route-wishlist="${escapeHtml(product.id)}"`
        : 'data-action="wishlist"';
    const addAction = routeMode
        ? `data-route-add="${escapeHtml(product.id)}"`
        : 'data-action="add"';
    const buyNowAction = routeMode
        ? `data-route-buy-now="${escapeHtml(product.id)}"`
        : 'data-action="buy-now"';
    const shopLink = product.shopName
        ? `<a class="market-product-shop" href="/shops/${encodeURIComponent(productShopSlug)}">${escapeHtml(product.shopName)}</a>`
        : '';
    const actions = `<div class="market-product-actions">
            <button type="button" ${addAction} ${available ? '' : 'disabled'} class="market-product-add">${available ? '<i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>Add to cart' : availabilityLabel}</button>
            <button type="button" ${buyNowAction} ${available ? '' : 'disabled'} class="market-product-buy">${available ? 'Buy now' : 'Unavailable'}</button>
        </div>`;

    return `<article data-id="${escapeHtml(product.id)}" class="market-product-card${routeMode ? ' route-product-card' : ''} group">
        <div class="market-product-visual">
            ${product.hasDiscount ? `<span class="market-product-discount">-${product.discountPercent}%</span>` : ''}
            <button type="button" ${wishlistAction} aria-label="${isWished ? `Remove ${escapeHtml(product.name)} from wishlist` : `Add ${escapeHtml(product.name)} to wishlist`}" aria-pressed="${isWished}" class="market-product-wishlist ${isWished ? 'is-saved' : ''}">
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart" aria-hidden="true"></i>
            </button>
            <a href="${productLink}" aria-label="View details for ${escapeHtml(product.name)}" class="market-product-image">
                ${imageUrl ? `<img data-product-image src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy">` : ''}
                <i aria-hidden="true" class="fa-solid ${escapeHtml(icon)} ${imageUrl ? 'hidden' : ''}"></i>
            </a>
        </div>
        <div class="market-product-info">
            ${shopLink}
            <h3><a href="${productLink}">${escapeHtml(product.name)}</a></h3>
            ${product.description ? `<p class="market-product-description">${escapeHtml(product.description)}</p>` : ''}
            <div class="market-product-price">
                <span>${formatPrice(product.price)}</span>
                ${product.hasDiscount ? `<del>${formatPrice(product.oldPrice)}</del>` : ''}
            </div>
            ${Number.isFinite(product.rating) && product.rating > 0 && Number(product.reviews) > 0 ? `<div class="market-product-rating" aria-label="Rated ${product.rating} out of 5 from ${escapeHtml(product.reviews)} reviews">
                <i class="fa-solid fa-star" aria-hidden="true"></i><strong>${product.rating}</strong><span>(${escapeHtml(product.reviews)})</span>
            </div>` : ''}
            ${available ? '' : `<p class="market-product-unavailable">${availabilityLabel}</p>`}
            ${actions}
        </div>
    </article>`;
}
