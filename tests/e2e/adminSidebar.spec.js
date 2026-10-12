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

test('platform workspace groups existing panels into responsive sections', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await disablePageController(page, 'platform');
    await page.goto('/admin/platform');

    const sections = page.locator('.platform-section');
    await expect(sections).toHaveCount(4);
    await expect(sections.nth(0).locator('.platform-section-heading h2')).toHaveText('Shop and team');
    await expect(sections.nth(1).locator('.platform-section-heading h2')).toHaveText('Storefront and content');
    await expect(sections.nth(2).locator('.platform-section-heading h2')).toHaveText('Transactions, offers and reports');
    await expect(sections.nth(3).locator('.platform-section-heading h2')).toHaveText('Settings, access and audit');
    await expect(sections.nth(0).locator('#shopSettingsPanel')).toBeAttached();
    await expect(sections.nth(1).locator('#heroSlidesPanel')).toBeAttached();
    await expect(sections.nth(2).locator('.transactions-panel')).toBeAttached();
    const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        gridColumns: getComputedStyle(document.querySelector('#shopManagementSection .platform-grid')).gridTemplateColumns
    }));
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.gridColumns.split(' ').length).toBe(1);
});
