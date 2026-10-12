import test from 'node:test';
import assert from 'node:assert/strict';
import { adminMenuManifest, visibleAdminMenuEntries } from '../admin-assets/adminMenuManifest.js';
import { adminSidebarGroups } from '../admin-assets/adminSidebar.js';

test('admin menu shows only built entries granted by the server permission registry', () => {
    const visible = visibleAdminMenuEntries(adminMenuManifest, [
        { roleKey: 'super_admin', permissionKey: 'audit.read', granted: true },
        { roleKey: 'manager', permissionKey: 'settings.read', granted: true },
        { roleKey: 'super_admin', permissionKey: 'settings.read', granted: false }
    ]);
    assert.deepEqual(visible.map(({ label }) => label), ['Admin — Manage Activity']);
});

test('admin menu order follows manifest sort order', () => {
    const permissions = adminMenuManifest.map(({ permission }) => ({
        roleKey: 'super_admin',
        permissionKey: permission,
        granted: true
    }));
    assert.deepEqual(
        visibleAdminMenuEntries([...adminMenuManifest].reverse(), permissions).map(({ sortOrder }) => sortOrder),
        [10, 20, 30]
    );
});

test('sidebar exposes shop-admin screens without platform-only controls', () => {
    const groups = adminSidebarGroups({
        page: 'platform',
        isPlatformAdmin: false,
        shopRole: 'owner'
    });
    const entries = groups.flatMap(({ items }) => items);
    const find = (label) => entries.find((entry) => entry.label === label);
    assert.equal(find('Manage Shop Users').disabled, undefined);
    assert.equal(find('Manage Products').disabled, undefined);
    assert.equal(find('General Settings'), undefined);
    assert.equal(find('Roles & Permissions'), undefined);
    assert.equal(find('Manage Slides').disabled, true);
});

test('sidebar gates foundation destinations by the server permission registry', () => {
    const denied = adminSidebarGroups({
        page: 'platform',
        isPlatformAdmin: true,
        permissions: []
    }).flatMap(({ items }) => items.map(({ label }) => label));
    const granted = adminSidebarGroups({
        page: 'platform',
        isPlatformAdmin: true,
        permissions: [
            { roleKey: 'super_admin', permissionKey: 'settings.read', granted: true },
            { roleKey: 'super_admin', permissionKey: 'permissions.read', granted: true },
            { roleKey: 'super_admin', permissionKey: 'audit.read', granted: true }
        ]
    }).flatMap(({ items }) => items.map(({ label }) => label));
    assert.equal(denied.includes('General Settings'), false);
    assert.equal(denied.includes('Roles & Permissions'), false);
    assert.equal(denied.includes('Security Audit'), false);
    assert.equal(granted.includes('General Settings'), true);
    assert.equal(granted.includes('Roles & Permissions'), true);
    assert.equal(granted.includes('Security Audit'), true);
});
