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
    await expect(sidebar.getByRole('button', { name: 'Header & Footer' })).toBeDisabled();
    await expect(sidebar.getByRole('link', { name: 'Create shop' })).toHaveCount(0);
    await sidebar.getByRole('link', { name: 'Public product API' }).click();
    await expect(page).toHaveURL(/#shopProductApiPanel$/);
    await expect(page.locator('#shopProductApiPanel')).toBeVisible();
    await expect(page.locator('.platform-feature-panel.is-active:visible')).toHaveCount(1);
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
