import { adminMenuManifest, visibleAdminMenuEntries } from './adminMenuManifest.js';

const unavailable = (label) => ({ label, disabled: true });

export function adminSidebarGroups({ page, isPlatformAdmin, shopRole, permissions = [] }) {
    const canManageTeam = isPlatformAdmin || ['owner', 'admin'].includes(shopRole);
    const builtPermissions = new Set(visibleAdminMenuEntries(adminMenuManifest, permissions)
        .map((entry) => entry.permission));
    const item = (label, href, options = {}) => ({ label, href, ...options });
    const view = (label, name, options = {}) => item(label, `/admin?view=${name}`, {
        view: name,
        ...options
    });
    const groups = [
        {
            label: 'Dashboard',
            icon: 'grid',
            items: [item('Overview', page === 'platform' ? '#pageTop' : '/admin?view=orders', {
                view: page === 'orders' ? 'orders' : undefined
            })]
        },
        {
            label: 'Orders',
            icon: 'orders',
            items: [
                page === 'orders'
                    ? view('Manage Orders', 'orders')
                    : item('Manage Orders', '/admin?view=orders'),
                unavailable('Add Exchange Order'),
                unavailable('Order Processing Report')
            ]
        },
        {
            label: 'Sale',
            icon: 'sale',
            items: [unavailable('Office Sale'), unavailable('Wholesale'), unavailable('Wholeseller')]
        },
        {
            label: 'Accounts',
            icon: 'accounts',
            items: [
                unavailable('Income'),
                unavailable('Expense'),
                unavailable('Due'),
                unavailable('Balance'),
                unavailable('Fund Transfer'),
                unavailable('Account Purpose'),
                unavailable('Employee Salary'),
                unavailable('Bill Statements')
            ]
        },
        {
            label: 'Products',
            icon: 'products',
            items: [
                page === 'orders' ? view('Manage Products', 'products') : item('Manage Products', '/admin?view=products'),
                unavailable('Attribute / Size'),
                unavailable('Variants'),
                unavailable('Product Purchase'),
                unavailable('Product Reviews'),
                unavailable('Product View Report'),
                unavailable('Country'),
                unavailable('Skin')
            ]
        },
        { label: 'Product Supplier', icon: 'supplier', items: [unavailable('Add'), unavailable('Manage')] },
        {
            label: 'Category',
            icon: 'category',
            items: [
                page === 'orders'
                    ? view('Manage Categories', 'categories', { target: '#categoriesPanel' })
                    : item('Manage Categories', '/admin?view=categories#categoriesPanel'),
                unavailable('Sub Category'),
                unavailable('Sub Sub Category')
            ]
        },
        { label: 'Brand', icon: 'brand', items: [unavailable('Manage Brands')] },
        {
            label: 'Slider',
            icon: 'slider',
            items: page === 'platform' && isPlatformAdmin
                ? [item('Manage Slides', '#heroSlidesPanel')]
                : [unavailable('Manage Slides')]
        },
        {
            label: 'Website Setup',
            icon: 'website',
            items: page === 'orders'
                ? [view('Shop Profile', 'shop')]
                : [
                    ...(isPlatformAdmin
                        ? [item('Header & Footer', '#brandingPanel'), item('Theme Color', '#brandingPanel'), item('Pages', '#brandingPanel')]
                        : [unavailable('Header & Footer'), unavailable('Theme Color'), unavailable('Pages')])
                ]
        },
        {
            label: 'Setting & Configuration',
            icon: 'settings',
            items: page === 'platform' && isPlatformAdmin
                ? [
                    ...(builtPermissions.has('settings.read')
                        ? [item('General Settings', '#adminSettingsPanel', { permission: 'settings.read' })]
                        : []),
                    item('Shop Settings', '#shopSettingsPanel'),
                    item('Marketing', '#offersPanel'),
                    unavailable('Courier API'),
                    unavailable('Invoice Address'),
                    item('Delivery Charge', '#shopSettingsPanel'),
                    unavailable('Social Login'),
                    unavailable('City, Sub City'),
                    unavailable('Courier'),
                    unavailable('Order Source'),
                    unavailable('Order Processing Note')
                ]
                : page === 'orders'
                    ? [view('Admin Profile', 'profile'), item('Shop Management', '/admin/platform')]
                    : [unavailable('Settings')]
        },
        {
            label: 'Campaign / Offer',
            icon: 'campaign',
            items: page === 'platform' && isPlatformAdmin
                ? [item('Coupons', '#offersPanel'), item('Offer Banner', '#offersPanel')]
                : [unavailable('Coupons'), unavailable('Offer Banner')]
        },
        {
            label: 'Admin',
            icon: 'admin',
            items: page === 'platform'
                ? [
                    ...(canManageTeam ? [item('Manage Shop Users', '#teamPanel')] : [unavailable('Manage Shop Users')]),
                    ...(isPlatformAdmin && builtPermissions.has('permissions.read')
                        ? [item('Roles & Permissions', '#permissionMatrixPanel', { permission: 'permissions.read' })]
                        : []),
                    ...(isPlatformAdmin && builtPermissions.has('audit.read')
                        ? [item('Security Audit', '#adminAuditPanel', { permission: 'audit.read' })]
                        : [])
                ]
                : [view('Account Profile', 'profile'), item('Shop Management', '/admin/platform')]
        },
        { label: 'Customer', icon: 'customer', items: [unavailable('Customers'), unavailable('Messages')] },
        {
            label: 'Report',
            icon: 'report',
            items: page === 'platform' && isPlatformAdmin
                ? [item('Business Reports', '#reportsPanel')]
                : [unavailable('Business Reports')]
        },
        { label: 'Landing Page', icon: 'landing', items: [unavailable('Manage Landing Page')] }
    ];
    return groups;
}

function makeIcon(name) {
    const paths = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        orders: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
        sale: '<path d="m4 8 8-5 8 5v11H4z"/><circle cx="12" cy="13" r="2.5"/>',
        accounts: '<path d="M3 5h2l2.2 11h11.6L21 8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
        products: '<path d="M4 5h16v15H4zM8 5V3h8v2M8 10h8"/>',
        supplier: '<path d="M3 7h12v11H3zM15 11h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
        category: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
        brand: '<path d="M12 3 14 9l6 1-4.5 4 1.2 6L12 17l-4.7 3 1.2-6L4 10l6-1z"/>',
        slider: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
        website: '<path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/>',
        campaign: '<path d="M4 14V9l14-5v15L4 14zM7 15l2 6h4l-2-5M18 9h3v5h-3"/>',
        admin: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        customer: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>',
        report: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-8h4v8"/>',
        landing: '<path d="m3 11 18-8-8 18-2-8zM11 13l5-5"/>'
    };
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = paths[name] || paths.grid;
    return icon;
}

export function mountAdminSidebar({ page, email, role, isPlatformAdmin = false, shopRole = '', permissions = [], onView }) {
    const sidebar = document.getElementById('adminSidebar');
    const nav = document.getElementById('adminSidebarNav');
    const toggle = document.getElementById('adminSidebarToggle');
    const closeButton = document.getElementById('adminSidebarClose');
    const backdrop = document.getElementById('adminSidebarBackdrop');
    const search = document.getElementById('adminSidebarSearch');
    const groups = adminSidebarGroups({ page, isPlatformAdmin, shopRole, permissions });
    const close = () => {
        sidebar.hidden = true;
        backdrop.hidden = true;
        sidebar.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
    };

    document.getElementById('sidebarAccountEmail').textContent = email || 'Administrator';
    document.getElementById('sidebarRole').textContent = role;
    nav.replaceChildren();

    groups.forEach((group, index) => {
        const details = document.createElement('details');
        details.className = 'admin-sidebar-group';
        details.open = index < 2;
        const summary = document.createElement('summary');
        summary.append(makeIcon(group.icon));
        const label = document.createElement('span');
        label.textContent = group.label;
        summary.append(label);
        details.append(summary);
        const list = document.createElement('div');
        list.className = 'admin-sidebar-submenu';
        group.items.forEach((entry) => {
            if (entry.permission && !visibleAdminMenuEntries(adminMenuManifest, permissions)
                .some(({ permission }) => permission === entry.permission)) return;
            let control;
            if (entry.disabled) {
                control = document.createElement('button');
                control.type = 'button';
                control.disabled = true;
                control.title = 'This section is not implemented yet.';
            } else if (entry.href?.startsWith('#')) {
                control = document.createElement('a');
                control.href = entry.href;
            } else if (entry.view && page === 'orders') {
                control = document.createElement('button');
                control.type = 'button';
                control.dataset.adminView = entry.view;
                control.addEventListener('click', () => {
                    onView?.(entry.view, entry.target);
                    close();
                });
            } else {
                control = document.createElement('a');
                control.href = entry.href;
            }
            control.className = 'admin-sidebar-link';
            control.textContent = entry.label;
            if (entry.disabled) control.setAttribute('aria-disabled', 'true');
            if (entry.href?.startsWith('#')) {
                control.addEventListener('click', (event) => {
                    const target = document.querySelector(entry.href);
                    if (!target || target.hidden) {
                        event.preventDefault();
                        return;
                    }
                    close();
                });
            } else if (!entry.disabled && !(entry.view && page === 'orders')) {
                control.addEventListener('click', close);
            }
            list.append(control);
        });
        details.append(list);
        nav.append(details);
    });

    const applySearch = () => {
        const query = search.value.trim().toLocaleLowerCase();
        nav.querySelectorAll('.admin-sidebar-group').forEach((group) => {
            let matches = false;
            group.querySelectorAll('.admin-sidebar-link').forEach((link) => {
                const visible = !query || link.textContent.toLocaleLowerCase().includes(query);
                link.hidden = !visible;
                matches ||= visible;
            });
            group.hidden = Boolean(query) && !matches;
            if (query && matches) group.open = true;
        });
    };
    search.value = '';
    search.oninput = applySearch;
    toggle.hidden = false;
    if (sidebar.dataset.behaviorBound === 'true') return;
    sidebar.dataset.behaviorBound = 'true';
    toggle.addEventListener('click', () => {
        sidebar.hidden = false;
        backdrop.hidden = false;
        sidebar.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'true');
        closeButton.focus();
    });
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
        if (event.key !== 'Tab') return;
        const focusable = [...sidebar.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), summary')];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) {
            event.preventDefault();
            focusable.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
            event.preventDefault();
            focusable[0].focus();
        }
    });
}
