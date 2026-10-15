export const formatPrice = (amount) => `৳ ${Number(amount).toLocaleString('en-US')}`;
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isSafeProductImage = (image) => {
    if (typeof image !== 'string') return false;
    if (/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(image)) return true;
    try {
        const url = new URL(image);
        const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        return url.protocol === 'https:' && !url.username && !url.password
            && hostname.includes('.') && !/^\d+(?:\.\d+){3}$/.test(hostname)
            && !/(?:^|\.)localhost$|(?:^|\.)local$|(?:^|\.)internal$/.test(hostname);
    } catch {
        return false;
    }
};
