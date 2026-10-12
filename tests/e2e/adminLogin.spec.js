import { expect, test } from '@playwright/test';

test('development admin login uses email and password without an authenticator prompt', async ({ page }) => {
    const requests = [];
    let loggedIn = false;

    await page.route('**/api/v1/admin/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        requests.push([request.method(), path]);

        if (path.endsWith('/admin/profile')) {
            if (!loggedIn) {
                await route.fulfill({ status: 401, json: { error: 'Admin authentication required.' } });
                return;
            }
            await route.fulfill({
                status: 200,
                json: { data: { email: 'test-admin@example.test', isPlatformAdmin: false, role: 'owner' } }
            });
            return;
        }
        if (path.endsWith('/admin/login')) {
            loggedIn = true;
            await route.fulfill({ status: 200, json: { data: { enrolled: true } } });
            return;
        }
        if (path.endsWith('/admin/shops')) {
            await route.fulfill({
                status: 200,
                json: { data: [{ id: 'synthetic-shop', name: 'Synthetic Shop', slug: 'synthetic-shop', status: 'active', role: 'owner' }] }
            });
            return;
        }
        if (path.endsWith('/admin/orders')) {
            await route.fulfill({ status: 200, json: { data: [], total: 0, page: 1 } });
            return;
        }
        await route.fulfill({ status: 200, json: { data: [] } });
    });

    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/admin');
    await page.getByLabel('Admin email').fill('test-admin@example.test');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
    await expect(page.locator('#mfaLoginFields')).toBeHidden();
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('#dashboardPanel')).toBeVisible();
    await expect(page.locator('#loginPanel')).toBeHidden();
    await expect(page.locator('#dashboardTitle')).toHaveText('Customer orders');
    await expect(page.locator('#ordersList')).toContainText('No orders found.');
    expect(loggedIn).toBe(true);
    expect(requests.some(([method, path]) => method === 'POST' && path.endsWith('/admin/login'))).toBe(true);
    expect(requests.some(([, path]) => path.endsWith('/admin/mfa/enroll'))).toBe(false);
    expect(pageErrors).toEqual([]);
});
