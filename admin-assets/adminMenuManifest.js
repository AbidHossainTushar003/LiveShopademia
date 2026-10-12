export const adminMenuManifest = Object.freeze([
    Object.freeze({
        label: 'Setting & Configuration',
        href: '#adminSettingsPanel',
        permission: 'settings.read',
        status: 'built',
        sortOrder: 10
    }),
    Object.freeze({
        label: 'Admin — Roles & Permissions',
        href: '#permissionMatrixPanel',
        permission: 'permissions.read',
        status: 'built',
        sortOrder: 20
    }),
    Object.freeze({
        label: 'Admin — Manage Activity',
        href: '#adminAuditPanel',
        permission: 'audit.read',
        status: 'built',
        sortOrder: 30
    })
]);

export function visibleAdminMenuEntries(manifest, permissionRows) {
    const grants = new Set(permissionRows
        .filter((row) => row.roleKey === 'super_admin' && row.granted === true)
        .map((row) => row.permissionKey));
    return manifest
        .filter((entry) => entry.status === 'built' && grants.has(entry.permission))
        .sort((left, right) => left.sortOrder - right.sortOrder);
}
