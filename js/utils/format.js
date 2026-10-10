export const formatPrice = (amount) => `৳ ${Number(amount).toLocaleString('en-US')}`;
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isSafeProductImage = (image) => typeof image === 'string'
    && /^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(image);
