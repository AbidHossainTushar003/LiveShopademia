
import { optimizedFormData } from '../js/utils/optimizeUploadImage.js';
import { mountAdminSidebar } from './adminSidebar.js';

const shopKey = 'shopademia.adminShopId';
const message = document.getElementById('platformMessage');
const shopPicker = document.getElementById('shopPicker');
let activeShop = null;
let isPlatformAdmin = false;
let currentEmail = '';
let adminPermissionRows = [];

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('hidden', !text);
    message.classList.toggle('error', isError);
}

async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (activeShop && !path.endsWith('/admin/shops')) headers.set('X-Shop-Id', activeShop.id);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'same-origin' });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
        window.location.assign('/admin');
    }
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
}

function appendText(parent, text, className = '') {
    const element = document.createElement('p');
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
}

function appendCard(parent, heading, detail = '') {
    const card = document.createElement('article');
    const content = document.createElement('div');
    appendText(content, heading);
    if (detail) appendText(content, detail, 'muted');
    card.append(content);
    parent.append(card);
    return { card, content };
}

function formatAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${new Intl.NumberFormat().format(amount)} BDT` : '—';
}

async function loadShops() {
    const profile = await api('/admin/profile');
    isPlatformAdmin = profile.data.isPlatformAdmin === true;
    currentEmail = profile.data.email;
    const dashboardLink = document.getElementById('dashboardLink');
    dashboardLink.href = isPlatformAdmin ? '/' : '/admin';
    dashboardLink.textContent = isPlatformAdmin ? 'Storefront' : 'Back to orders';
    const { data } = await api('/admin/shops');
    if (!data.length) throw new Error(isPlatformAdmin
        ? 'No shops are configured yet.'
        : 'Your account is not a member of an active shop.');
    shopPicker.replaceChildren();
    data.forEach((shop) => {
        const option = document.createElement('option');
        option.value = shop.id;
        option.textContent = `${shop.name} · ${isPlatformAdmin ? shop.status : shop.role}`;
        shopPicker.append(option);
    });
    const saved = sessionStorage.getItem(shopKey);
    activeShop = data.find((shop) => shop.id === saved) || data[0];
    sessionStorage.setItem(shopKey, activeShop.id);
    shopPicker.value = activeShop.id;
    applyRolePermissions();
    refreshAdminSidebar();
    return data;
}

function applyRolePermissions() {
    const canManageTeam = isPlatformAdmin || ['owner', 'admin'].includes(activeShop?.role);
    document.querySelectorAll('[data-platform-only]').forEach((element) => { element.hidden = !isPlatformAdmin; });
    const memberForm = document.getElementById('memberForm');
    memberForm.hidden = !canManageTeam;
    const adminRoleOption = memberForm.elements.role.querySelector('option[value="admin"]');
    adminRoleOption.hidden = !isPlatformAdmin;
    if (!isPlatformAdmin) memberForm.elements.role.value = 'staff';
    document.getElementById('platformDescription').textContent = isPlatformAdmin
        ? 'Platform-wide oversight of shop access, branding, transactions, deals, notifications, reports, and activity.'
        : 'Manage staff assigned to your shop. Products and customer orders are managed from the shop dashboard.';
}

function refreshAdminSidebar() {
    mountAdminSidebar({
        page: 'platform',
        email: currentEmail,
        role: isPlatformAdmin ? 'Super Admin' : `${activeShop.role} · ${activeShop.name}`,
        isPlatformAdmin,
        shopRole: activeShop.role,
        permissions: adminPermissionRows
    });
}

function updateShopApiPanel() {
    const input = document.getElementById('shopProductApiUrl');
    const status = document.getElementById('shopProductApiStatus');
    const example = document.getElementById('shopProductApiExample');
    const enabled = activeShop?.status === 'active';
    const endpoint = enabled
        ? `${window.location.origin}/api/v1/public/shops/${encodeURIComponent(activeShop.slug)}/products`
        : '';
    input.value = endpoint;
    input.disabled = !enabled;
    document.getElementById('copyShopProductApiUrl').disabled = !enabled;
    document.getElementById('copyShopProductApiExample').disabled = !enabled;
    status.textContent = enabled
        ? 'Public read-only access. No token or credentials are required.'
        : 'This shop is not active, so its public product API is unavailable.';
    example.textContent = enabled
        ? `<div id="shop-products"></div>\n<script type="module">\n  const response = await fetch(${JSON.stringify(endpoint)});\n  if (!response.ok) throw new Error('Could not load shop products');\n  const { shop, data: products, pagination } = await response.json();\n  const container = document.querySelector('#shop-products');\n  for (const product of products) {\n    const card = document.createElement('article');\n    if (product.image) {\n      const image = document.createElement('img');\n      image.src = product.image;\n      image.alt = product.name;\n      image.loading = 'lazy';\n      card.append(image);\n    }\n    const name = document.createElement('h2');\n    name.textContent = product.name;\n    const price = document.createElement('p');\n    price.textContent = new Intl.NumberFormat().format(product.price) + ' BDT';\n    card.append(name, price);\n    container.append(card);\n  }\n</script>\n<!-- Response: shop, products in data, and pagination metadata. -->`
        : 'Select an active shop to view its API example.';
}

async function loadShopDetails() {
    const shops = await api('/admin/shops');
    activeShop = shops.data.find((item) => item.id === shopPicker.value) || activeShop;
    applyRolePermissions();
    updateShopApiPanel();
    const status = document.getElementById('shopStatus');
    if (status) {
        status.textContent = `Status: ${activeShop.status}`;
        document.getElementById('suspendShopButton').hidden = !isPlatformAdmin || activeShop.status !== 'active';
        document.getElementById('reactivateShopButton').hidden = !isPlatformAdmin || activeShop.status === 'active';
        document.getElementById('archiveShopButton').disabled = !isPlatformAdmin || activeShop.status === 'archived';
    }
    document.getElementById('shopSettingsForm').elements.name.value = activeShop.name;
    document.getElementById('shopSettingsForm').elements.advanceCharge.value = activeShop.advanceCharge;
    const preview = document.getElementById('brandingPreview');
    preview.replaceChildren();
    const bannerCard = document.createElement('article');
    appendText(bannerCard, `Banner: ${activeShop.bannerImage || 'Not set'}`);
    if (activeShop.bannerImage) {
        const img = document.createElement('img');
        img.src = activeShop.bannerImage;
        img.alt = `${activeShop.name} banner`;
        bannerCard.append(img);
    }
    preview.append(bannerCard);
    if (isPlatformAdmin) {
        await Promise.all([
            loadMembers(),
            loadHeroSlides(),
            loadTransactions(),
            loadOffers(),
            loadReports(),
            loadActivity(),
            loadAdminSettings(),
            loadPermissionMatrix(),
            loadAdminAudit()
        ]);
    } else {
        await loadMembers();
    }
    refreshAdminSidebar();
}

async function loadHeroSlides() {
    const container = document.getElementById('heroSlidesList');
    container.replaceChildren();
    const { data } = await api('/admin/shop/hero-slides');
    const form = document.getElementById('heroSlideForm');
    const canManage = isPlatformAdmin;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = data.length >= 5 && !form.dataset.slideId;
    if (!data.length) appendText(container, 'No hero slides yet.');
    data.forEach((slide, index) => {
        const { card, content } = appendCard(container, slide.headline, slide.bodyText);
        card.classList.add('hero-slide-card');
        const img = document.createElement('img');
        img.src = slide.image;
        img.alt = `${slide.headline} hero slide`;
        img.className = 'hero-slide-thumbnail';
        content.append(img);
        if (slide.mobileImage) {
            const mobileImg = document.createElement('img');
            mobileImg.src = slide.mobileImage;
            mobileImg.alt = `${slide.headline} mobile hero slide`;
            mobileImg.className = 'hero-slide-thumbnail';
            content.append(mobileImg);
            appendText(content, 'Mobile image', 'muted');
        }
        appendText(content, `Button: ${slide.buttonText} · URL: ${slide.targetUrl}`, 'muted');
        if (!canManage) return;

        const controls = document.createElement('div');
        controls.className = 'hero-slide-controls';
        const move = (label, offset, disabled) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button button-secondary';
            button.textContent = label;
            button.disabled = disabled;
            button.addEventListener('click', async () => {
                const reordered = [...data];
                [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
                try {
                    await api('/admin/shop/hero-slides/order', {
                        method: 'POST',
                        body: JSON.stringify({ ids: reordered.map((item) => String(item.id)) })
                    });
                    await loadHeroSlides();
                } catch (error) {
                    showMessage(error.message, true);
                }
            });
            controls.append(button);
        };
        move('Move up', -1, index === 0);
        move('Move down', 1, index === data.length - 1);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button button-secondary';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => {
            form.dataset.slideId = String(slide.id);
            form.elements.headline.value = slide.headline;
            form.elements.bodyText.value = slide.bodyText;
            form.elements.buttonText.value = slide.buttonText;
            form.elements.targetUrl.value = slide.targetUrl;
            form.elements.image.required = false;
            document.getElementById('clearHeroSlideMobileImageLabel').hidden = !slide.mobileImage;
            form.elements.clearMobileImage.checked = false;
            submit.textContent = 'Save hero slide';
            document.getElementById('cancelHeroSlideEdit').hidden = false;
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        controls.append(edit);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-danger';
        remove.textContent = 'Remove';
        remove.addEventListener('click', async () => {
            if (!confirm(`Remove the hero slide “${slide.headline}”?`)) return;
            try {
                await api(`/admin/shop/hero-slides/${encodeURIComponent(slide.id)}`, { method: 'DELETE' });
                showMessage('Hero slide removed.');
                await Promise.all([loadHeroSlides(), loadActivity()]);
            } catch (error) {
                showMessage(error.message, true);
            }
        });
        controls.append(remove);
        card.append(controls);
    });
}

function resetHeroSlideForm() {
    const form = document.getElementById('heroSlideForm');
    delete form.dataset.slideId;
    form.reset();
    form.elements.image.required = true;
    document.getElementById('clearHeroSlideMobileImageLabel').hidden = true;
    form.querySelector('button[type="submit"]').textContent = 'Add hero slide';
    document.getElementById('cancelHeroSlideEdit').hidden = true;
}

async function loadMembers() {
    const container = document.getElementById('membersList');
    container.replaceChildren();
    const { data } = await api('/admin/shop/members');
    if (!data.length) return appendText(container, 'No team members yet.');
    for (const member of data) {
        const { card } = appendCard(container, member.email, `${member.role} · added ${new Date(member.joinedAt).toLocaleDateString()}`);
        if (member.email === currentEmail) continue;
        if (isPlatformAdmin || ['owner', 'admin'].includes(activeShop.role)) {
            if (member.role !== 'owner' && (isPlatformAdmin || member.role === 'staff')) {
                const roleForm = document.createElement('form');
                roleForm.className = 'inline-form';
                const roleSelect = document.createElement('select');
                roleSelect.setAttribute('aria-label', `Role for ${member.email}`);
                for (const role of (isPlatformAdmin ? ['admin', 'staff'] : ['staff'])) {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = role;
                    option.selected = role === member.role;
                    roleSelect.append(option);
                }
                const saveRole = document.createElement('button');
                saveRole.type = 'submit';
                saveRole.className = 'button button-secondary';
                saveRole.textContent = 'Save role';
                roleForm.append(roleSelect, saveRole);
                roleForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    try {
                        await api(`/admin/shop/members/${encodeURIComponent(member.id)}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role: roleSelect.value })
                        });
                        showMessage('Member role updated.');
                        await loadMembers();
                    } catch (error) {
                        showMessage(error.message, true);
                    }
                });
                card.append(roleForm);
            }
            if (!isPlatformAdmin && member.role !== 'staff') continue;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'button button-danger';
            remove.textContent = 'Remove';
            remove.addEventListener('click', async () => {
                if (!confirm(`Remove ${member.email} from this shop?`)) return;
                try {
                    await api(`/admin/shop/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
                    showMessage('Shop member removed.');
                    await loadMembers();
                } catch (error) {
                    showMessage(error.message, true);
                }
            });
            card.append(remove);
        }
    }
}

async function loadTransactions() {
    const container = document.getElementById('transactionsList');
    container.replaceChildren();
    const { data, total } = await api('/admin/shop/transactions?limit=50');
    appendText(container, `${total} transaction record${total === 1 ? '' : 's'}`);
    for (const transaction of data) {
        const { card } = appendCard(
            container,
            `${transaction.type} · ${formatAmount(transaction.amount)} · ${transaction.status}`,
            `${transaction.method} · ${transaction.reference}${transaction.orderId ? ` · Order ${transaction.orderId}` : ''} · ${new Date(transaction.createdAt).toLocaleString()}`
        );
        if (['owner', 'admin'].includes(activeShop.role) && ['pending', 'verified'].includes(transaction.status)) {
            const reject = document.createElement('button');
            reject.type = 'button';
            reject.className = 'button button-secondary';
            reject.textContent = transaction.status === 'pending' ? 'Reject' : 'Reopen';
            reject.addEventListener('click', async () => {
                try {
                    await api(`/admin/shop/transactions/${transaction.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: transaction.status === 'pending' ? 'rejected' : 'pending' })
                    });
                    await loadTransactions();
                    showMessage('Transaction status updated.');
                } catch (error) {
                    showMessage(error.message, true);
                }
            });
            card.append(reject);
        } else if (['owner', 'admin'].includes(activeShop.role) && transaction.status === 'rejected') {
            const verify = document.createElement('button');
            verify.type = 'button';
            verify.className = 'button button-primary';
            verify.textContent = 'Verify manually';
            verify.addEventListener('click', async () => {
                try {
                    await api(`/admin/shop/transactions/${transaction.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'verified' })
                    });
                    await loadTransactions();
                    showMessage('Transaction marked verified manually.');
                } catch (error) {
                    showMessage(error.message, true);
                }
            });
            card.append(verify);
        }
    }
}

async function loadOffers() {
    const container = document.getElementById('offersList');
    container.replaceChildren();
    const { data } = await api('/admin/shop/offers');
    if (!data.length) return appendText(container, 'No offers have been created.');
    for (const offer of data) {
        const { card } = appendCard(
            container,
            `${offer.title} · ${offer.isPublished ? 'published' : 'draft'}`,
            `${offer.message}${offer.endsAt ? ` · Ends ${new Date(offer.endsAt).toLocaleString()}` : ''}`
        );
        if (['owner', 'admin'].includes(activeShop.role)) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'button button-secondary';
            toggle.textContent = offer.isPublished ? 'Unpublish' : 'Publish';
            toggle.addEventListener('click', async () => {
                try {
                    const result = await api(`/admin/shop/offers/${offer.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isPublished: !offer.isPublished })
                    });
                    await loadOffers();
                    showMessage(result.notificationSent
                        ? `Offer updated and ${result.notificationSent} browser subscriber${result.notificationSent === 1 ? ' was' : 's were'} notified.`
                        : result.pushEnabled
                            ? 'Offer updated. No notification was sent (the offer may be scheduled or there may be no active subscribers).'
                            : 'Offer updated and shown on the shop feed. Configure VAPID keys to enable browser push.');
                } catch (error) {
                    showMessage(error.message, true);
                }
            });
            card.append(toggle);
        }
    }
}

async function loadReports() {
    const container = document.getElementById('reportSummary');
    container.replaceChildren();
    const days = document.getElementById('reportDays').value;
    const { data } = await api(`/admin/shop/reports?days=${encodeURIComponent(days)}`);
    appendCard(container, `Last ${data.days} days`, `${data.orders.orderCount} orders · ${data.orders.cancelledCount} cancelled`);
    appendCard(
        container,
        `Non-cancelled order value: ${formatAmount(data.orders.grossSales)}`,
        `Delivered order value: ${formatAmount(data.orders.deliveredSales)} · Average non-cancelled order: ${formatAmount(data.orders.averageOrderValue)}. Order values are not proof of collected payments.`
    );
    if (data.topProducts.length) {
        const top = document.createElement('article');
        const wrapper = document.createElement('div');
        appendText(wrapper, 'Top products by units sold');
        data.topProducts.forEach((product, index) => appendText(
            wrapper,
            `${index + 1}. ${product.name} · ${product.quantity} units · ${formatAmount(product.revenue)}`
        ));
        top.append(wrapper);
        container.append(top);
    }
    if (data.transactions.length) {
        const statuses = data.transactions.map((item) => `${item.type} ${item.status}: ${item.count} (${formatAmount(item.amount)})`).join(' · ');
        appendText(container, `Transactions — ${statuses}`);
    }
}

async function loadActivity() {
    const container = document.getElementById('activityList');
    container.replaceChildren();
    const { data } = await api('/admin/shop/activity?limit=50');
    if (!data.length) return appendText(container, 'No recorded activity yet.');
    data.forEach((entry) => appendCard(
        container,
        `${entry.action} · ${entry.entityType}${entry.entityId ? ` ${entry.entityId}` : ''}`,
        `${entry.actorEmail} · ${new Date(entry.createdAt).toLocaleString()}${Object.keys(entry.details || {}).length ? ` · ${JSON.stringify(entry.details)}` : ''}`
    ));
}

async function loadAdminSettings() {
    const container = document.getElementById('adminSettingsList');
    container.replaceChildren();
    const { data } = await api('/admin/settings');
    if (!data.length) return appendText(container, 'No administrative settings have been saved.');
    data.forEach((setting) => appendCard(
        container,
        `${setting.group}.${setting.key}${setting.isSecret ? ' · encrypted secret' : ''}`,
        `${String(setting.value)} · updated ${new Date(setting.updatedAt).toLocaleString()}`
    ));
}

async function loadPermissionMatrix() {
    const container = document.getElementById('permissionMatrix');
    container.replaceChildren();
    const { data } = await api('/admin/permissions');
    adminPermissionRows = data;
    if (!data.length) return appendText(container, 'No permissions are registered.');
    const table = document.createElement('table');
    table.className = 'platform-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Role', 'Mapping', 'Action permission', 'Access'].forEach((label) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = label;
        headerRow.append(th);
    });
    head.append(headerRow);
    table.append(head);
    const body = document.createElement('tbody');
    data.forEach((permission) => {
        const row = document.createElement('tr');
        [
            permission.roleName,
            permission.mappingStatus,
            `${permission.permissionKey} — ${permission.description}`,
            permission.granted ? 'Granted' : 'Denied'
        ].forEach((value) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        });
        body.append(row);
    });
    table.append(body);
    container.append(table);
}

async function loadAdminAudit() {
    const container = document.getElementById('adminAuditList');
    container.replaceChildren();
    const { data } = await api('/admin/audit?limit=50');
    if (!data.length) return appendText(container, 'No administrative security events recorded yet.');
    data.forEach((entry) => appendCard(
        container,
        `${entry.action} · ${entry.entity}${entry.entityId ? ` ${entry.entityId}` : ''}`,
        `${entry.actorEmail} · ${new Date(entry.createdAt).toLocaleString()} · ${entry.ip || 'IP unavailable'} · ${entry.userAgent || 'User agent unavailable'} · request ${entry.requestId}`
    ));
}

document.getElementById('adminSettingSecret').addEventListener('change', (event) => {
    const valueInput = document.getElementById('adminSettingValue');
    valueInput.type = event.currentTarget.checked ? 'password' : 'text';
    valueInput.autocomplete = event.currentTarget.checked ? 'new-password' : 'off';
});

document.getElementById('adminSettingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = document.getElementById('saveAdminSetting');
    const error = document.getElementById('adminSettingError');
    const isSecret = form.elements.isSecret.checked;
    submit.disabled = true;
    error.textContent = '';
    error.classList.add('hidden');
    try {
        await api(`/admin/settings/${encodeURIComponent(form.elements.group.value)}/${encodeURIComponent(form.elements.key.value)}`, {
            method: 'PUT',
            body: JSON.stringify({
                value: form.elements.value.value,
                isSecret
            })
        });
        form.elements.value.value = '';
        showMessage('Administrative setting saved.');
        await Promise.all([loadAdminSettings(), loadAdminAudit()]);
    } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        submit.disabled = false;
    }
});

document.getElementById('shopPicker').addEventListener('change', async () => {
    sessionStorage.setItem(shopKey, shopPicker.value);
    window.location.reload();
});

async function copyShopApiText(text, label) {
    const status = document.getElementById('shopProductApiStatus');
    try {
        await navigator.clipboard.writeText(text);
        status.textContent = `${label} copied.`;
    } catch (error) {
        console.error('Could not copy the shop product API details:', error);
        status.textContent = 'Clipboard access was denied. Select and copy the text above.';
    }
}

document.getElementById('copyShopProductApiUrl').addEventListener('click', () => {
    copyShopApiText(document.getElementById('shopProductApiUrl').value, 'API URL');
});
document.getElementById('copyShopProductApiExample').addEventListener('click', () => {
    copyShopApiText(document.getElementById('shopProductApiExample').textContent, 'Example code');
});

async function updateShopStatus(status) {
    try {
        await api(`/admin/shops/${encodeURIComponent(activeShop.id)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showMessage(status === 'active' ? 'Shop reactivated.' : 'Shop suspended.');
        await loadShops();
        await loadShopDetails();
    } catch (error) {
        showMessage(error.message, true);
    }
}

document.getElementById('suspendShopButton').addEventListener('click', () => updateShopStatus('suspended'));
document.getElementById('reactivateShopButton').addEventListener('click', () => updateShopStatus('active'));
document.getElementById('archiveShopButton').addEventListener('click', async () => {
    if (!activeShop || !confirm(`Archive ${activeShop.name}? Its records and files will be retained; you can reactivate it later.`)) return;
    try {
        await api(`/admin/shops/${encodeURIComponent(activeShop.id)}`, { method: 'DELETE' });
        showMessage('Shop archived. Its historical records were retained.');
        await loadShops();
        await loadShopDetails();
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('shopSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        await api('/admin/shops/settings', {
            method: 'PATCH',
            body: JSON.stringify({
                name: document.getElementById('shopName').value,
                advanceCharge: Number(document.getElementById('shopAdvanceCharge').value)
            })
        });
        showMessage('Shop settings saved.');
        await loadShops();
        await loadShopDetails();
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('createShopForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
        const created = await api('/admin/shops', {
            method: 'POST',
            body: JSON.stringify({
                name: form.get('name'),
                slug: form.get('slug'),
                advanceCharge: Number(form.get('advanceCharge'))
            })
        });
        sessionStorage.setItem(shopKey, created.data.id);
        showMessage('Shop created and selected. Manage its products and orders from the admin dashboard.');
        await loadShops();
        await loadShopDetails();
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('memberForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const form = new FormData(submittedForm);
    const password = String(form.get('password') || '');
    try {
        await api('/admin/shop/members', {
            method: 'POST',
            body: JSON.stringify({
                email: form.get('email'),
                role: form.get('role'),
                ...(password ? { password } : {})
            })
        });
        submittedForm.reset();
        showMessage('User added to this shop. Share the account credentials securely if it was newly created.');
        await loadMembers();
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.querySelectorAll('.branding-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const body = await optimizedFormData(form);
            body.append('kind', form.dataset.kind);
            await api('/admin/shop/branding', { method: 'POST', body });
            form.reset();
            showMessage(`${form.dataset.kind === 'hero' ? 'Hero' : 'Banner'} image uploaded.`);
            await loadShops();
            await loadShopDetails();
        } catch (error) {
            showMessage(error.message, true);
        }
    });
});

document.getElementById('cancelHeroSlideEdit').addEventListener('click', resetHeroSlideForm);

document.getElementById('heroSlideForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        const body = await optimizedFormData(form);
        const slideId = form.dataset.slideId;
        if (!body.get('image')?.size) body.delete('image');
        if (!body.get('mobileImage')?.size) body.delete('mobileImage');
        await api(slideId
            ? `/admin/shop/hero-slides/${encodeURIComponent(slideId)}`
            : '/admin/shop/hero-slides', {
            method: slideId ? 'PUT' : 'POST',
            body
        });
        resetHeroSlideForm();
        showMessage(slideId ? 'Hero slide saved.' : 'Hero slide added.');
        await Promise.all([loadHeroSlides(), loadActivity()]);
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('transactionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const form = new FormData(submittedForm);
    const orderId = String(form.get('orderId') || '').trim();
    try {
        await api('/admin/shop/transactions', {
            method: 'POST',
            body: JSON.stringify({
                type: form.get('type'),
                method: form.get('method'),
                amount: Number(form.get('amount')),
                reference: form.get('reference'),
                notes: form.get('notes'),
                ...(orderId ? { orderId } : {})
            })
        });
        submittedForm.reset();
        showMessage('Transaction recorded.');
        await Promise.all([loadTransactions(), loadReports(), loadActivity()]);
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('offerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const form = new FormData(submittedForm);
    const startsAt = String(form.get('startsAt') || '');
    const endsAt = String(form.get('endsAt') || '');
    try {
        const result = await api('/admin/shop/offers', {
            method: 'POST',
            body: JSON.stringify({
                title: form.get('title'),
                message: form.get('message'),
                startsAt: startsAt ? new Date(startsAt).toISOString() : null,
                endsAt: endsAt ? new Date(endsAt).toISOString() : null,
                isPublished: document.getElementById('offerPublished').checked
            })
        });
        submittedForm.reset();
        showMessage(result.notificationSent
            ? `Offer saved and ${result.notificationSent} browser subscriber${result.notificationSent === 1 ? ' was' : 's were'} notified.`
            : result.pushEnabled
                ? 'Offer saved. No notification was sent (the offer may be scheduled or there may be no active subscribers).'
                : 'Offer saved. Configure VAPID keys to enable browser push notifications.');
        await Promise.all([loadOffers(), loadActivity()]);
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById('reportDays').addEventListener('change', () => loadReports().catch((error) => showMessage(error.message, true)));

loadShops()
    .then(loadShopDetails)
    .catch((error) => {
        showMessage(error.message, true);
        if (error.message.includes('Sign in')) window.location.assign('/admin');
    });
