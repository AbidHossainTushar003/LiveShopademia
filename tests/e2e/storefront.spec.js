import { createServer } from 'node:http';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const storefrontPath = '/?shop=main';
const trackers = /googletagmanager\.com|connect\.facebook\.net/;
const expectedSiteOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL).origin;

test('homepage loads catalog and essential-only consent remains changeable', async ({ page }) => {
    const pageErrors = [];
    const trackerRequests = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
        if (trackers.test(request.url())) trackerRequests.push(request.url());
    });

    const response = await page.goto(storefrontPath);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Shop products and deals | Main Shop | Shopademia');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${expectedSiteOrigin}/`);
    await expect(page.getByRole('heading', { name: 'Shop Products' })).toBeVisible();
    await expect(page.locator('#productResultsStatus')).toContainText('Showing');
    await expect(page.locator('#featuredProductGrid .fa-star')).toHaveCount(0);
    await page.getByRole('button', { name: 'Essential only' }).click();
    await expect(page.getByRole('button', { name: 'Essential only' })).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shopademia.privacyConsent.v1'))))
        .toMatchObject({ necessary: true, analytics: false });
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(page.getByRole('button', { name: 'Allow analytics' })).toBeVisible();
    expect(trackerRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
});

test('shop product API is public, CORS-readable, and returns only managed listings', async ({ page }) => {
    const shopsResponse = await page.request.get('/api/v1/shops');
    expect(shopsResponse.status()).toBe(200);
    const shops = (await shopsResponse.json()).data;
    expect(shops.some(({ slug }) => slug === 'main')).toBe(true);

    const productsResponse = await page.request.get('/api/v1/public/shops/main/products', {
        headers: { Origin: 'https://external-shop.example' }
    });
    expect(productsResponse.status()).toBe(200);
    expect(productsResponse.headers()['access-control-allow-origin']).toBe('*');
    expect(productsResponse.headers()['cross-origin-resource-policy']).toBe('cross-origin');
    const result = await productsResponse.json();
    expect(result.shop.slug).toBe('main');
    expect(result.data.every(({ id }) => /^admin-[0-9a-f-]{36}$/i.test(id))).toBe(true);
    expect(result.data.some((product) => 'phone' in product || 'address' in product)).toBe(false);
    expect(result.pagination).toMatchObject({ limit: 50, offset: 0 });

    const crossOriginServer = createServer((_request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<!doctype html><title>External integration check</title>');
    });
    await new Promise((resolve, reject) => {
        crossOriginServer.once('error', reject);
        crossOriginServer.listen(0, '127.0.0.1', resolve);
    });
    try {
        const address = crossOriginServer.address();
        await page.goto(`http://127.0.0.1:${address.port}`);
        const browserFetch = await page.evaluate(async (url) => {
            const response = await fetch(url);
            return { status: response.status, body: await response.json() };
        }, new URL('/api/v1/public/shops/main/products', process.env.PLAYWRIGHT_BASE_URL).href);
        expect(browserFetch.status).toBe(200);
        expect(browserFetch.body.shop.slug).toBe('main');
    } finally {
        await new Promise((resolve, reject) => crossOriginServer.close((error) => error ? reject(error) : resolve()));
    }
});

test('public routes, error page, and mobile layout work', async ({ page }) => {
    for (const [path, heading] of [
        ['/privacy', 'Privacy policy'],
        ['/terms', 'Terms & conditions'],
        ['/about', 'Shopping with main shop'],
        ['/find-order', 'Find your order'],
        ['/shops', 'Explore our shops'],
        ['/deals', 'Deals and offers']
    ]) {
        const response = await page.goto(`${path}?shop=main`);
        expect(response?.status(), path).toBe(200);
        await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') }).first()).toBeVisible();
    }
    await page.goto('/about?shop=main');
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
    await expect(page.getByText('Is my order confirmed when I submit it?')).toBeVisible();
    await page.locator('.route-faq details').nth(2).locator('summary').click();
    await expect(page.locator('.route-faq a')).toHaveAttribute('href', '/find-order?shop=main');

    const lookupRequests = [];
    page.on('request', (request) => {
        if (request.url().includes('/customer/order-lookup')) lookupRequests.push(request.url());
    });
    await page.goto('/find-order?shop=main');
    await page.locator('#lookupOrderNumber').fill('invalid');
    await page.locator('#lookupPhone').fill('not-a-phone');
    await page.getByRole('button', { name: 'Look up order' }).click();
    await expect(page.locator('#lookupOrderNumberError')).toBeVisible();
    await expect(page.locator('#lookupPhoneError')).toBeVisible();
    expect(lookupRequests).toEqual([]);

    const missingResponse = await page.goto('/a-page-that-does-not-exist');
    expect(missingResponse?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /took a wrong turn/i })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(storefrontPath);
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('product detail route and metadata render for an available catalog item', async ({ page }) => {
    const catalogResponse = await page.request.get('/api/v1/shops/main/products');
    expect(catalogResponse.status()).toBe(200);
    const product = (await catalogResponse.json()).data[0];
    test.skip(!product, 'Product detail acceptance requires a seeded shop catalog item.');

    const productResponse = await page.goto(`/product/${encodeURIComponent(product.id)}?shop=main`);
    expect(productResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(`${product.name} | Main Shop | Shopademia`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/product/${encodeURIComponent(product.id)}$`));
    const structuredData = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(structuredData['@graph'].some(({ '@type': type }) => type === 'Product')).toBe(true);
    expect(structuredData['@graph'].some(({ '@type': type }) => type === 'BreadcrumbList')).toBe(true);
    expect(structuredData['@graph'].some(({ '@type': type }) => type === 'WebSite')).toBe(true);
    expect(structuredData['@graph'].some(({ aggregateRating }) => aggregateRating)).toBe(false);
    const productDescription = product.description?.trim().replace(/\s+/g, ' ');
    const expectedMetaDescription = productDescription
        ? (productDescription.length > 160 ? `${productDescription.slice(0, 157).trimEnd()}…` : productDescription)
        : `Explore ${product.name} from Main Shop on Shopademia.`;
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', expectedMetaDescription);
});

test('homepage internal links resolve and shop-list network errors are visible', async ({ page }) => {
    await page.goto(storefrontPath);
    const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL);
    const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => anchor.href));
    const internalUrls = [...new Set(hrefs.filter((href) => {
        const url = new URL(href);
        return url.origin === baseUrl.origin && url.pathname !== '/';
    }))];
    const failures = [];
    for (const url of internalUrls) {
        const response = await page.request.get(url);
        if (response.status() >= 400) failures.push(`${response.status()} ${url}`);
    }
    expect(failures).toEqual([]);

    await page.route('**/api/v1/shops', (route) => route.abort());
    await page.goto('/shops?shop=main');
    await expect(page.getByRole('alert')).toContainText('We couldn’t load this page');
});

test('admin APIs reject unauthenticated access and login screen is accessible', async ({ page }) => {
    const profile = await page.request.get('/api/v1/admin/profile');
    expect(profile.status()).toBe(401);

    const response = await page.goto('/admin');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('region', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByLabel('Admin email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

test('homepage and policy pages pass automated WCAG 2.1 AA checks', async ({ page }) => {
    for (const path of [storefrontPath, '/privacy', '/terms']) {
        await page.goto(path);
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
        const summary = results.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            count: violation.nodes.length,
            examples: violation.nodes.slice(0, 12).map((node) => ({
                target: node.target,
                issue: node.any.map(({ message, data }) => ({
                    message,
                    contrastRatio: data?.contrastRatio,
                    foreground: data?.fgColor,
                    background: data?.bgColor
                }))
            }))
        }));
        console.log(`Accessibility results for ${path}: ${JSON.stringify(summary)}`);
        expect(summary, `${path} has WCAG accessibility violations`).toEqual([]);
    }
});
