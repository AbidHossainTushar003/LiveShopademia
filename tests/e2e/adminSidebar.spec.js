import { expect, test } from '@playwright/test';

async function disablePageController(page, name) {
    await page.route(`**/admin-assets/${name}.js`, (route) => route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: ''
    }));
}

async function renderMockedSidebar(page, options) {
    await page.evaluate(async (sidebarOptions) => {
        document.getElementById('loginPanel')?.classList.add('hidden');
        document.getElementById('dashboardPanel')?.classList.remove('hidden');
        const { mountAdminSidebar } = await import('/admin-assets/adminSidebar.js');
        mountAdminSidebar(sidebarOptions);
    }, options);
}

test('shop-admin sidebar supports search, disabled entries, and keyboard dismissal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await disablePageController(page, 'admin');
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/admin');
    await renderMockedSidebar(page, {
        page: 'orders',
        email: 'shop-admin@example.test',
        role: 'owner · Demo Shop',
        shopRole: 'owner'
    });
    await expect(page.locator('#dashboardPanel')).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Open admin navigation' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const sidebar = page.getByRole('dialog', { name: 'Admin navigation' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('shop-admin@example.test');
    await expect(sidebar).toContainText('Manage Orders');
    await page.getByRole('searchbox', { name: 'Search menu' }).fill('variants');
    await expect(sidebar.getByRole('button', { name: 'Variants' })).toBeDisabled();

    await expect(sidebar.getByRole('button', { name: 'Variants' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Income' })).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    expect(pageErrors).toEqual([]);
});

test('platform-admin sidebar reveals only permission-granted built links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await disablePageController(page, 'platform');
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/admin/platform');
    await renderMockedSidebar(page, {
        page: 'platform',
        email: 'platform-admin@example.test',
        role: 'Super Admin',
        isPlatformAdmin: true,
        shopRole: 'owner',
        permissions: ['settings.read', 'permissions.read', 'audit.read'].map((permissionKey) => ({
            roleKey: 'super_admin',
            permissionKey,
            granted: true
        }))
    });
    const toggle = page.getByRole('button', { name: 'Open admin navigation' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const sidebar = page.getByRole('dialog', { name: 'Admin navigation' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('platform-admin@example.test');
    await sidebar.getByText('Setting & Configuration', { exact: true }).click();
    await expect(sidebar.getByRole('link', { name: 'General Settings' })).toBeVisible();
    await sidebar.getByText('Admin', { exact: true }).click();
    await expect(sidebar.getByRole('link', { name: 'Roles & Permissions' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Security Audit' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Courier API' })).toBeDisabled();
    await sidebar.getByText('Website Setup', { exact: true }).click();
    await expect(sidebar.getByRole('link', { name: 'Store Banner' })).toHaveAttribute('href', '#brandingPanel');
    await sidebar.getByText('Campaign / Offer', { exact: true }).click();
    await expect(sidebar.getByRole('link', { name: 'Manage Offers' })).toHaveAttribute('href', '#offersPanel');
    await expect(sidebar.getByRole('button', { name: 'Coupons' })).toBeDisabled();
    await expect(sidebar.getByRole('button', { name: 'Offer Banner' })).toBeDisabled();
    await page.locator('#adminSidebarClose').click();
    await expect(sidebar).toBeHidden();
    expect(pageErrors).toEqual([]);
});

test('shop-admin can open shop features without platform-only controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await disablePageController(page, 'platform');
    await page.goto('/admin/platform');
    await renderMockedSidebar(page, {
        page: 'platform',
        email: 'shop-admin@example.test',
        role: 'owner · Demo Shop',
        shopRole: 'owner'
    });

    const toggle = page.getByRole('button', { name: 'Open admin navigation' });
    await toggle.click();
    const sidebar = page.getByRole('dialog', { name: 'Admin navigation' });
    await sidebar.getByText('Website Setup', { exact: true }).click();
    await expect(sidebar.getByRole('link', { name: 'Public product API' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Store Banner' })).toBeDisabled();
    await expect(sidebar.getByRole('link', { name: 'Create shop' })).toHaveCount(0);
    await sidebar.getByRole('link', { name: 'Public product API' }).click();
    await expect(page).toHaveURL(/#shopProductApiPanel$/);
    await expect(page.locator('#shopProductApiPanel')).toBeVisible();
    await expect(page.locator('.platform-feature-panel.is-active:visible')).toHaveCount(1);
});

test('shop staff can use platform workspace without requesting team-management data', async ({ page }) => {
    const requests = [];
    await page.route('**/api/v1/admin/**', async (route) => {
        const url = new URL(route.request().url());
        requests.push(url.pathname);
        if (url.pathname === '/api/v1/admin/profile') {
            await route.fulfill({ json: { data: { email: 'staff@example.test', isPlatformAdmin: false } } });
            return;
        }
        if (url.pathname === '/api/v1/admin/shops') {
            await route.fulfill({
                json: {
                    data: [{ id: '7', slug: 'demo-shop', name: 'Demo Shop', status: 'active', role: 'staff', advanceCharge: 100 }]
                }
            });
            return;
        }
        if (url.pathname === '/api/v1/admin/shop/members') {
            await route.fulfill({ status: 403, json: { error: 'Shop admin permission is required.' } });
            return;
        }
        await route.fulfill({ status: 404, json: { error: 'Unexpected admin API request.' } });
    });
    await page.goto('/admin/platform');

    await expect(page.locator('#platformMessage')).toBeHidden();
    await expect(page.locator('#teamPanel')).toBeHidden();
    await expect(page.locator('#adminSidebarToggle')).toBeVisible();
    expect(requests).not.toContain('/api/v1/admin/shop/members');
});

test('platform admins can sign out and return to the login form', async ({ page }) => {
    let signedOut = false;
    let logoutMethod = '';
    await page.route('**/api/v1/admin/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/v1/admin/profile') {
            await route.fulfill(signedOut
                ? { status: 401, json: { error: 'Please sign in.' } }
                : { json: { data: { email: 'platform@example.test', isPlatformAdmin: true } } });
            return;
        }
        if (url.pathname === '/api/v1/admin/shops') {
            await route.fulfill({
                json: {
                    data: [{ id: '7', slug: 'demo-shop', name: 'Demo Shop', status: 'active', role: 'owner', advanceCharge: 100 }]
                }
            });
            return;
        }
        if (url.pathname === '/api/v1/admin/shop/reports') {
            await route.fulfill({
                json: {
                    data: {
                        days: 30,
                        orders: { orderCount: 0, cancelledCount: 0, grossSales: 0, deliveredSales: 0, averageOrderValue: 0 },
                        topProducts: [],
                        transactions: []
                    }
                }
            });
            return;
        }
        if (url.pathname === '/api/v1/admin/logout') {
            logoutMethod = route.request().method();
            signedOut = true;
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        await route.fulfill({ json: { data: [] } });
    });

    await page.goto('/admin/platform');
    const signOut = page.getByRole('button', { name: 'Sign out' });
    await expect(signOut).toBeVisible();
    await signOut.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('#loginPanel')).toBeVisible();
    expect(logoutMethod).toBe('POST');

    const profileStatus = await page.evaluate(async () => (await fetch('/api/v1/admin/profile')).status);
    expect(profileStatus).toBe(401);
    await page.goto('/admin/platform');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('#loginPanel')).toBeVisible();
});

test('platform workspace shows one selected feature and navigates to it from the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await disablePageController(page, 'platform');
    await page.goto('/admin/platform');
    await renderMockedSidebar(page, {
        page: 'platform',
        email: 'platform-admin@example.test',
        role: 'Super Admin',
        isPlatformAdmin: true,
        shopRole: 'owner',
        permissions: ['settings.read', 'permissions.read', 'audit.read'].map((permissionKey) => ({
            roleKey: 'super_admin',
            permissionKey,
            granted: true
        }))
    });

    await expect(page.locator('#platformOverviewPanel')).toBeVisible();
    await expect(page.locator('.platform-feature-panel.is-active:visible')).toHaveCount(1);
    const toggle = page.getByRole('button', { name: 'Open admin navigation' });
    await toggle.click();
    const sidebar = page.getByRole('dialog', { name: 'Admin navigation' });
    await sidebar.getByRole('link', { name: 'Create shop' }).click();
    await expect(page).toHaveURL(/#createShopPanel$/);
    await expect(page.locator('#createShopPanel')).toBeVisible();
    await expect(page.locator('#platformOverviewPanel')).toBeHidden();

    await toggle.click();
    await sidebar.getByText('Website Setup', { exact: true }).click();
    await sidebar.getByRole('link', { name: 'Public product API' }).click();
    await expect(page).toHaveURL(/#shopProductApiPanel$/);
    await expect(page.locator('#shopProductApiPanel')).toBeVisible();
    await expect(page.locator('#createShopPanel')).toBeHidden();
    await expect(page.locator('.platform-feature-panel.is-active:visible')).toHaveCount(1);
    const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        gridColumns: getComputedStyle(document.querySelector('#storefrontSection .platform-grid')).gridTemplateColumns
    }));
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.gridColumns.split(' ').length).toBe(1);
});
