const consentKey = 'shopademia.privacyConsent.v1';

const footerMarkup = `
    <div class="site-footer-inner">
        <section class="site-footer-brand" aria-label="Shopademia">
            <a class="site-brand-lockup" href="/" aria-label="Shopademia home">
                <img src="/public-assets/shopademia-mark.svg" width="42" height="42" alt="">
                <span>Shopademia</span>
            </a>
            <p>Find your next favorite from our growing community of independent shops.</p>
            <span class="site-copyright">© ${new Date().getFullYear()} Shopademia</span>
        </section>
        <nav class="site-footer-links" aria-label="Explore">
            <h2>Explore</h2>
            <a href="/">Home</a>
            <a href="/shops">All shops</a>
            <a href="/deals">Deals</a>
            <a href="/about">About us</a>
        </nav>
        <nav class="site-footer-links" aria-label="Help and policies">
            <h2>Help &amp; policies</h2>
            <a href="/find-order">Find my order</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms &amp; conditions</a>
            <button class="site-consent-settings" type="button" data-open-consent>Cookie settings</button>
        </nav>
        <section class="site-footer-contact">
            <h2>Need help?</h2>
            <a href="mailto:shopademia.official@gmail.com">shopademia.official@gmail.com</a>
            <a href="tel:+8801560024777">+880 1560-024777</a>
            <a href="https://wa.me/8801560024777" target="_blank" rel="noopener noreferrer">WhatsApp support</a>
        </section>
    </div>
    <div class="site-footer-bottom"><span>Orders are reviewed by each shop. Payment is arranged separately with the seller.</span><a href="/privacy">Your privacy matters</a></div>`;

function readConsent() {
    try {
        const saved = JSON.parse(localStorage.getItem(consentKey) || 'null');
        return saved && saved.necessary === true && typeof saved.analytics === 'boolean' ? saved : null;
    } catch (error) {
        console.warn('Cookie preferences could not be read:', error);
        return null;
    }
}

function writeConsent(analytics) {
    const value = { necessary: true, analytics, updatedAt: new Date().toISOString() };
    try {
        localStorage.setItem(consentKey, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent('shopademia:consent', { detail: value }));
        return true;
    } catch (error) {
        console.error('Cookie preferences could not be saved:', error);
        return false;
    }
}

function mountConsentBanner() {
    if (document.body.dataset.adminSite === 'true') return;
    const existing = readConsent();
    const banner = document.createElement('aside');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-label', 'Privacy choices');
    banner.hidden = Boolean(existing);
    banner.innerHTML = `
        <div class="cookie-banner-copy"><p class="cookie-eyebrow">YOUR PRIVACY</p><h2>Choose your privacy settings</h2><p>Essential storage keeps your cart and site preferences working. Optional analytics helps us understand site usage and stays off unless you allow it. <a href="/privacy">Read our privacy policy</a>.</p></div>
        <div class="cookie-banner-actions"><button type="button" class="cookie-button cookie-accept" data-consent="accept">Allow analytics</button><button type="button" class="cookie-button cookie-reject" data-consent="reject">Essential only</button></div>`;
    document.body.append(banner);
    banner.addEventListener('click', (event) => {
        const button = event.target.closest('[data-consent]');
        if (!button) return;
        if (!writeConsent(button.dataset.consent === 'accept')) return;
        banner.hidden = true;
    });
    document.querySelectorAll('[data-open-consent]').forEach((button) => button.addEventListener('click', () => {
        banner.hidden = false;
        banner.querySelector('[data-consent="reject"]').focus();
    }));
}

function addFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = '/public-assets/favicon.svg';
    document.head.append(icon);
}

function mountFooter() {
    let footer = document.getElementById('siteFooter');
    if (!footer) {
        footer = document.createElement('footer');
        footer.id = 'siteFooter';
        footer.className = 'site-footer';
        document.body.append(footer);
    }
    footer.classList.add('site-footer');
    footer.innerHTML = footerMarkup;
}

addFavicon();
mountFooter();
mountConsentBanner();
