import { fetchWithTimeout } from '../js/utils/fetchWithTimeout.js';
import { optimizedFormData } from '../js/utils/optimizeUploadImage.js';
import { mountAdminSidebar } from './adminSidebar.js';

const shopKey = 'shopademia.adminShopId';
const pageSize = 20;
const statusTransitions = {
    new: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: ['new']
};
const loginPanel = document.getElementById('loginPanel');
const dashboardPanel = document.getElementById('dashboardPanel');
const ordersList = document.getElementById('ordersList');
const dashboardMessage = document.getElementById('dashboardMessage');
const orderCount = document.getElementById('orderCount');
const pagination = document.getElementById('pagination');
const ordersPanel = document.getElementById('ordersPanel');
const profilePanel = document.getElementById('profilePanel');
const productsPanel = document.getElementById('productsPanel');
const shopPanel = document.getElementById('shopPanel');
const profileMessage = document.getElementById('profileMessage');
let categoryItems = [];
let activeShop = null;
let page = 1;
let ordersRequestId = 0;
let profileRequestId = 0;
let productsRequestId = 0;
let productImagePreviewUrls = [];
let shopLogoPreviewUrl = null;
let activeShopId = null;
let mfaSetupToken = null;
let currentAdminEmail = '';

function showMessage(message, isError = false) {
    dashboardMessage.textContent = message;
    dashboardMessage.classList.toggle('hidden', !message);
    dashboardMessage.classList.toggle('error', isError);
}

function setAuthenticated(authenticated) {
    loginPanel.classList.toggle('hidden', authenticated);
    dashboardPanel.classList.toggle('hidden', !authenticated);
    document.getElementById('logoutButton').classList.toggle('hidden', !authenticated);
    document.getElementById('adminSidebarToggle').hidden = !authenticated;
}

function clearSession(message = '') {
    mfaSetupToken = null;
    activeShopId = null;
    activeShop = null;
    ordersRequestId += 1;
    profileRequestId += 1;
    productsRequestId += 1;
    setAuthenticated(false);
    document.getElementById('password').value = '';
    document.getElementById('passwordForm').reset();
    document.getElementById('profileEmail').textContent = '—';
    cancelProductEdit();
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productFormError').classList.add('hidden');
    document.getElementById('productsList').replaceChildren();
    document.getElementById('productCount').textContent = '';
    document.getElementById('activeShopName').textContent = '';
    ordersList.replaceChildren();
    orderCount.textContent = '';
    pagination.classList.add('hidden');
    setAdminView('orders');
    document.getElementById('loginError').textContent = message;
    document.getElementById('loginError').classList.toggle('hidden', !message);
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('mfaSetupPanel').classList.add('hidden');
    document.getElementById('mfaSetupError').classList.add('hidden');
    document.getElementById('mfaSetupSecret').textContent = '';
}

async function api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (activeShopId && path !== '/admin/shops') headers.set('X-Shop-Id', activeShopId);
    const response = await fetchWithTimeout(`/api/v1${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && !['/admin/login', '/admin/mfa/enroll'].includes(path)
        && !dashboardPanel.classList.contains('hidden')) {
        clearSession(body.error || 'Your session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
}

async function resolveActiveShop() {
    const { data } = await api('/admin/shops');
    if (!Array.isArray(data) || !data.length) {
        throw new Error('Your account is not a member of any shops. Ask a shop owner to restore access.');
    }
    const savedShopId = sessionStorage.getItem(shopKey);
    const shop = data.find(({ id }) => id === savedShopId) || data[0];
    activeShopId = shop.id;
    activeShop = shop;
    sessionStorage.setItem(shopKey, shop.id);
    const label = document.getElementById('activeShopName');
    if (label) label.textContent = `Managing ${shop.name} (${shop.slug})`;
    mountAdminSidebar({
        page: 'orders',
        email: currentAdminEmail,
        role: `${shop.role} · ${shop.name}`,
        shopRole: shop.role,
        onView(view, target) {
            setAdminView(view === 'categories' ? 'products' : view);
            if (target) requestAnimationFrame(() => document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    });
}

function setAdminView(view) {
    const views = {
        orders: {
            title: 'Customer orders',
            description: 'Review orders, record manual advance-payment checks, and update fulfilment status. Payment checks are not verified by a bKash API.'
        },
        products: {
            title: 'Products',
            description: 'Upload and publish products to the storefront catalog.'
        },
        shop: {
            title: 'Shop profile',
            description: 'Update the public information customers see on your shop page.'
        },
        profile: {
            title: 'Admin profile',
            description: 'View the configured admin account and manage its password.'
        }
    };
    if (!Object.hasOwn(views, view)) view = 'orders';
    document.getElementById('dashboardTitle').textContent = views[view].title;
    document.getElementById('dashboardDescription').textContent = views[view].description;
    ordersPanel.classList.toggle('hidden', view !== 'orders');
    productsPanel.classList.toggle('hidden', view !== 'products');
    shopPanel.classList.toggle('hidden', view !== 'shop');
    profilePanel.classList.toggle('hidden', view !== 'profile');
    document.querySelectorAll('[data-admin-view]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.adminView === view));
    });
    document.querySelectorAll('.admin-sidebar-link[data-admin-view]').forEach((button) => {
        if (button.dataset.adminView === view) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    document.getElementById('refreshButton').classList.toggle('hidden', view !== 'orders');
    showMessage('');
    if (view === 'profile') loadProfile();
    if (view === 'products') {
        loadCategories().then(loadProducts);
    }
    if (view === 'shop') loadShopProfile();
}

function clearProductImagePreview() {
    productImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    productImagePreviewUrls = [];
    document.getElementById('productImagePreview').replaceChildren();
    document.getElementById('productImagePreview').classList.add('hidden');
}

function cancelProductEdit() {
    const form = document.getElementById('productForm');
    form.reset();
    delete form.dataset.productId;
    const imageInput = document.getElementById('productImage');
    imageInput.required = true;
    imageInput.closest('div').querySelector('.muted').textContent = 'Choose up to 10 images, 5 MB each. Images are resized automatically.';
    document.getElementById('createProductButton').textContent = 'Upload and publish product';
    document.getElementById('cancelProductEditButton').classList.add('hidden');
    document.getElementById('productEditNotice').classList.add('hidden');
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productFormError').classList.add('hidden');
    clearProductImagePreview();
}

function beginProductEdit(product) {
    const form = document.getElementById('productForm');
    form.dataset.productId = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOldPrice').value = product.oldPrice ?? '';
    document.getElementById('productStockQuantity').value = product.stockQuantity;
    document.getElementById('productAvailability').value = String(product.isAvailable);
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productDescription').value = product.description;
    document.getElementById('productImageAlt').value = product.imageAlt || '';
    document.getElementById('productSeoTitle').value = product.seoTitle || '';
    document.getElementById('productMetaDescription').value = product.metaDescription || '';
    const imageInput = document.getElementById('productImage');
    imageInput.value = '';
    imageInput.required = false;
    imageInput.closest('div').querySelector('.muted').textContent = 'Choose up to 10 replacement images, 5 MB each. Leave empty to keep current images.';
    document.getElementById('createProductButton').textContent = 'Save product changes';
    document.getElementById('cancelProductEditButton').classList.remove('hidden');
    document.getElementById('productEditNotice').classList.remove('hidden');
    document.getElementById('productFormError').textContent = '';
    document.getElementById('productFormError').classList.add('hidden');
    clearProductImagePreview();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('productName').focus({ preventScroll: true });
}

function renderManagedProduct(product) {
    const card = document.createElement('article');
    card.className = 'product-admin-card';
    const image = document.createElement('img');
    if (/^\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(product.image)) image.src = product.image;
    image.alt = product.imageAlt || product.name;
    image.loading = 'lazy';
    image.addEventListener('error', () => image.classList.add('hidden'), { once: true });
    const details = document.createElement('div');
    const name = createText('h4', '', product.name);
    const priceText = product.oldPrice
        ? `${formatPrice(product.price)} (was ${formatPrice(product.oldPrice)})`
        : formatPrice(product.price);
    const stockText = !product.isAvailable
        ? `Unavailable · ${product.stockQuantity} in stock`
        : product.stockQuantity === 0 ? 'Out of stock' : `${product.stockQuantity} in stock`;
    const actions = document.createElement('div');
    actions.className = 'product-admin-actions';
    const editButton = createText('button', 'button button-secondary', 'Edit');
    editButton.type = 'button';
    editButton.addEventListener('click', () => beginProductEdit(product));
    const deleteButton = createText('button', 'button button-danger', 'Delete');
    deleteButton.type = 'button';
    deleteButton.addEventListener('click', async () => {
        if (!window.confirm(`Remove "${product.name}" from the storefront? Existing orders will remain unchanged.`)) return;
        deleteButton.disabled = true;
        try {
            const result = await api(`/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
            if (document.getElementById('productForm').dataset.productId === product.id) cancelProductEdit();
            showMessage(result.warning || `${product.name} was removed from the storefront.`, Boolean(result.warning));
            await loadProducts();
        } catch (error) {
            showMessage(error.message, true);
            deleteButton.disabled = false;
        }
    });
    actions.append(editButton, deleteButton);
    details.append(
        name,
        createText('p', '', priceText),
        createText('p', '', categoryItems.find(({ id }) => id === product.category)?.name || productCategoryLabel(product.category)),
        createText('p', product.stockQuantity === 0 || !product.isAvailable ? 'error' : '', stockText),
        actions
    );
    card.append(image, details);
    return card;
}

async function loadProducts() {
    const requestId = ++productsRequestId;
    const list = document.getElementById('productsList');
    list.replaceChildren(createText('p', 'muted', 'Loading products…'));
    try {
        const result = await api('/admin/products');
        if (requestId !== productsRequestId) return;
        document.getElementById('productCount').textContent = `${result.data.length} product${result.data.length === 1 ? '' : 's'}`;
        list.replaceChildren(...result.data.map(renderManagedProduct));
        if (!result.data.length) list.append(createText('p', 'empty-state', 'No admin-added products yet.'));
    } catch (error) {
        if (requestId !== productsRequestId) return;
        list.replaceChildren();
        if (!dashboardPanel.classList.contains('hidden')) showMessage(error.message, true);
    }
}

function setProductCategoryOptions(selected = '') {
    const select = document.getElementById('productCategory');
    select.replaceChildren(new Option('Choose a category', ''));
    categoryItems.forEach((category) => select.add(new Option(category.name, category.id)));
    select.add(new Option('Unassigned', 'uncategorized'));
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function renderCategory(category) {
    const item = document.createElement('article');
    item.className = 'category-admin-card';
    const details = document.createElement('div');
    details.append(createText('h4', '', category.name));
    details.append(createText('p', 'muted', `${category.productCount || 0} product${category.productCount === 1 ? '' : 's'}${category.isDefault ? ' · standard category' : ''}`));
    const actions = document.createElement('div');
    actions.className = 'product-admin-actions';
    const rename = createText('button', 'button button-secondary', 'Rename');
    rename.type = 'button';
    rename.addEventListener('click', () => {
        const form = document.getElementById('categoryForm');
        form.dataset.categoryId = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('saveCategoryButton').textContent = 'Save category name';
        document.getElementById('cancelCategoryEditButton').classList.remove('hidden');
        document.getElementById('categoryName').focus();
    });
    const remove = createText('button', 'button button-danger', 'Delete');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete the “${category.name}” category?`)) return;
        const deleteProducts = category.productCount > 0
            && window.confirm(`Also delete all ${category.productCount} product${category.productCount === 1 ? '' : 's'} in this category? Choose Cancel to keep them and leave them unassigned.`);
        remove.disabled = true;
        try {
            const result = await api(`/admin/shop/categories/${encodeURIComponent(category.id)}`, {
                method: 'DELETE',
                body: JSON.stringify({ deleteProducts })
            });
            showMessage(deleteProducts
                ? `Category deleted with ${result.data.deletedProducts} product${result.data.deletedProducts === 1 ? '' : 's'}.`
                : 'Category deleted. Its products remain in your catalog as unassigned.');
            await refreshCatalogAdmin();
        } catch (error) {
            showMessage(error.message, true);
            remove.disabled = false;
        }
    });
    actions.append(rename, remove);
    item.append(details, actions);
    return item;
}

async function loadCategories() {
    const list = document.getElementById('categoriesList');
    try {
        const { data } = await api('/admin/shop/categories');
        categoryItems = data;
        setProductCategoryOptions(document.getElementById('productCategory').value);
        list.replaceChildren(...data.map(renderCategory));
        if (!data.length) list.append(createText('p', 'empty-state', 'No categories yet. Add one to classify products.'));
    } catch (error) {
        list.replaceChildren(createText('p', 'error', error.message));
    }
}

function refreshCatalogAdmin() {
    return loadCategories().then(loadProducts);
}

function resetCategoryForm() {
    const form = document.getElementById('categoryForm');
    form.reset();
    delete form.dataset.categoryId;
    document.getElementById('saveCategoryButton').textContent = 'Add category';
    document.getElementById('cancelCategoryEditButton').classList.add('hidden');
    document.getElementById('categoryFormError').textContent = '';
    document.getElementById('categoryFormError').classList.add('hidden');
}

async function loadShopProfile() {
    try {
        const { data } = await api('/admin/shop/profile');
        document.getElementById('shopProfileName').value = data.name || '';
        document.getElementById('shopProfileDescription').value = data.description || '';
        document.getElementById('shopProfileLocation').value = data.location || '';
        document.getElementById('shopProfileEmail').value = data.contactEmail || '';
        document.getElementById('shopProfilePhone').value = data.contactPhone || '';
        document.getElementById('shopProfileWhatsApp').value = data.contactWhatsApp || '';
        const preview = document.getElementById('shopProfileLogoPreview');
        if (shopLogoPreviewUrl) URL.revokeObjectURL(shopLogoPreviewUrl);
        shopLogoPreviewUrl = null;
        preview.replaceChildren();
        document.getElementById('removeShopLogo').checked = false;
        document.getElementById('shopProfileLogo').value = '';
        if (data.logoImage) {
            const image = document.createElement('img');
            image.src = data.logoImage;
            image.alt = 'Current shop logo';
            preview.append(image, createText('span', '', 'Current shop logo'));
        }
    } catch (error) {
        document.getElementById('shopProfileError').textContent = error.message;
        document.getElementById('shopProfileError').classList.remove('hidden');
    }
}

async function loadProfile() {
    const requestId = ++profileRequestId;
    try {
        const result = await api('/admin/profile');
        if (requestId !== profileRequestId) return;
        document.getElementById('profileEmail').textContent = result.data.email;
    } catch (error) {
        if (requestId === profileRequestId && !dashboardPanel.classList.contains('hidden')) showMessage(error.message, true);
    }
}

function formatPrice(amount) {
    return `৳ ${Number(amount).toLocaleString('en-US')}`;
}

function productCategoryLabel(category) {
    return {
        gadgets: 'Electronics',
        accessories: 'Jewelry & Accessories',
        clothing: 'Clothing',
        more: 'Other'
    }[category] || 'Other';
}

function createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function renderOrder(order) {
    const article = document.createElement('article');
    article.className = 'order-card';

    const heading = document.createElement('div');
    heading.className = 'order-heading';
    const title = document.createElement('div');
    title.append(createText('h2', 'order-number', order.orderNumber));
    title.append(createText('p', 'muted', new Date(order.createdAt).toLocaleString()));
    const badge = createText('span', `status status-${order.status}`, order.status);
    heading.append(title, badge);

    const columns = document.createElement('div');
    columns.className = 'order-columns';
    const customer = document.createElement('section');
    customer.append(createText('h3', 'section-label', 'CUSTOMER'));
    customer.append(createText('p', 'strong', order.customerName));
    customer.append(createText('p', '', order.phone));
    customer.append(createText('p', '', order.address));
    customer.append(createText('p', 'muted', `bKash sender: ${order.bkashNumber}`));

    const products = document.createElement('section');
    products.append(createText('h3', 'section-label', 'ITEMS & PAYMENT'));
    for (const item of order.items) {
        products.append(createText('p', '', `${item.name} × ${item.quantity} — ${formatPrice(item.lineTotal)}`));
    }
    products.append(createText('p', 'payment-line', `Products: ${formatPrice(order.subtotal)}`));
    products.append(createText('p', '', `Advance requested: ${formatPrice(order.advanceAmount)}`));
    products.append(createText('p', '', `Due on delivery: ${formatPrice(order.due)}`));
    const paymentStatus = order.advancePaymentStatus || 'pending';
    const paymentLabels = { pending: 'Pending manual review', verified: 'Verified manually', rejected: 'Not verified' };
    products.append(createText('p', 'payment-line', `Advance payment: ${paymentLabels[paymentStatus] || 'Pending manual review'}`));
    if (order.advancePaymentCheckedAt) {
        const checkedAt = new Date(order.advancePaymentCheckedAt).toLocaleString();
        products.append(createText('p', 'muted', `Last checked ${checkedAt} by ${order.advancePaymentCheckedBy || 'admin'}`));
    }

    const paymentControls = document.createElement('form');
    paymentControls.className = 'payment-verification-form';
    const paymentLabel = document.createElement('label');
    paymentLabel.textContent = 'Manual advance review';
    const paymentSelect = document.createElement('select');
    paymentSelect.setAttribute('aria-label', `Manual advance review for order ${order.orderNumber}`);
    const paymentActions = [
        { value: '', label: 'Choose result', disabled: true },
        { value: 'verified', label: 'Payment verified' },
        { value: 'rejected', label: 'Not received / invalid' }
    ];
    for (const action of paymentActions) {
        const option = document.createElement('option');
        option.value = action.value;
        option.textContent = action.label;
        option.disabled = Boolean(action.disabled);
        option.selected = action.value === '';
        paymentSelect.append(option);
    }
    const paymentSave = document.createElement('button');
    paymentSave.type = 'submit';
    paymentSave.className = 'button button-secondary';
    paymentSave.textContent = 'Save payment review';
    paymentSave.disabled = true;
    paymentControls.append(paymentLabel, paymentSelect, paymentSave);
    paymentSelect.addEventListener('change', () => {
        paymentSave.disabled = !paymentSelect.value;
    });
    paymentControls.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!paymentSelect.value) return;
        paymentSave.disabled = true;
        showMessage('');
        try {
            await api(`/admin/orders/${encodeURIComponent(order.id)}/advance-payment`, {
                method: 'PATCH',
                body: JSON.stringify({ status: paymentSelect.value })
            });
            if (await loadOrders({ preserveMessage: true })) {
                showMessage(`Advance payment review saved for ${order.orderNumber}. Verify against your bKash transaction records; this dashboard does not contact bKash.`);
            }
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            paymentSave.disabled = false;
        }
    });

    const controls = document.createElement('form');
    controls.className = 'status-form';
    const label = document.createElement('label');
    label.textContent = 'Update status';
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Update status for order ${order.orderNumber}`);
    for (const status of [order.status, ...(statusTransitions[order.status] || [])]) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status[0].toUpperCase() + status.slice(1);
        option.selected = status === order.status;
        select.append(option);
    }
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button button-primary';
    save.textContent = 'Save status';
    controls.append(label, select, save);
    controls.addEventListener('submit', async (event) => {
        event.preventDefault();
        save.disabled = true;
        showMessage('');
        try {
            await api(`/admin/orders/${encodeURIComponent(order.id)}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: select.value })
            });
            if (await loadOrders({ preserveMessage: true })) showMessage(`Order ${order.orderNumber} updated.`);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            save.disabled = false;
        }
    });

    const activityToggle = document.createElement('button');
    activityToggle.type = 'button';
    activityToggle.className = 'activity-toggle button button-secondary';
    activityToggle.textContent = 'View activity';
    activityToggle.setAttribute('aria-expanded', 'false');
    activityToggle.setAttribute('aria-controls', `orderActivity-${order.id}`);
    const activity = document.createElement('div');
    activity.id = `orderActivity-${order.id}`;
    activity.className = 'order-activity hidden';
    activity.setAttribute('aria-live', 'polite');
    let activityLoaded = false;
    activityToggle.addEventListener('click', async () => {
        const open = activity.classList.toggle('hidden') === false;
        activityToggle.setAttribute('aria-expanded', String(open));
        activityToggle.textContent = open ? 'Hide activity' : 'View activity';
        if (!open || activityLoaded) return;
        activity.replaceChildren(createText('p', 'muted', 'Loading activity…'));
        try {
            const result = await api(`/admin/orders/${encodeURIComponent(order.id)}/activity`);
            const labels = {
                status_changed: 'Order status',
                advance_payment_reviewed: 'Manual advance-payment review'
            };
            activity.replaceChildren(...(result.data.length
                ? result.data.map((entry) => createText(
                    'p',
                    '',
                    `${new Date(entry.createdAt).toLocaleString()} — ${labels[entry.action] || 'Admin action'}: ${entry.previousValue} → ${entry.newValue} by ${entry.actorEmail}`
                ))
                : [createText('p', 'muted', 'No admin changes have been recorded.')]));
            activityLoaded = true;
        } catch (error) {
            activity.replaceChildren(createText('p', 'error', error.message));
        }
    });

    columns.append(customer, products);
    article.append(heading, columns, paymentControls, controls, activityToggle, activity);
    return article;
}

async function loadOrders({ preserveMessage = false } = {}) {
    const requestId = ++ordersRequestId;
    if (!preserveMessage) showMessage('');
    ordersList.replaceChildren(createText('p', 'muted', 'Loading orders…'));
    const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    const status = document.getElementById('statusFilter').value;
    if (status) query.set('status', status);
    try {
        const result = await api(`/admin/orders?${query}`);
        if (requestId !== ordersRequestId) return false;
        orderCount.textContent = `${result.total} order${result.total === 1 ? '' : 's'}`;
        ordersList.replaceChildren(...result.data.map(renderOrder));
        if (!result.data.length) ordersList.append(createText('p', 'empty-state', 'No orders found.'));
        pagination.classList.toggle('hidden', result.total <= pageSize);
        document.getElementById('pageLabel').textContent = `Page ${result.page} of ${Math.max(1, Math.ceil(result.total / pageSize))}`;
        document.getElementById('previousPage').disabled = page <= 1;
        document.getElementById('nextPage').disabled = page * pageSize >= result.total;
        return true;
    } catch (error) {
        if (requestId !== ordersRequestId) return false;
        ordersList.replaceChildren();
        if (!dashboardPanel.classList.contains('hidden')) showMessage(error.message, true);
        return false;
    }
}

async function finishLogin() {
    document.getElementById('password').value = '';
    document.getElementById('totpCode').value = '';
    const profile = await api('/admin/profile');
    if (profile.data.isPlatformAdmin) {
        window.location.assign('/admin/platform');
        return;
    }
    page = 1;
    await resolveActiveShop();
    setAuthenticated(true);
    await loadOrders();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('loginButton');
    const error = document.getElementById('loginError');
    button.disabled = true;
    error.textContent = '';
    error.classList.add('hidden');
    let loginCompleted = false;
    try {
        const result = await api('/admin/login', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                totpCode: document.getElementById('totpCode').value
            })
        });
        loginCompleted = !result.mfaSetupRequired;
        if (result.mfaSetupRequired) {
            mfaSetupToken = result.setupToken;
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('mfaSetupEmail').textContent = document.getElementById('email').value.trim();
            document.getElementById('mfaSetupSecret').textContent = result.totpSecret;
            document.getElementById('mfaSetupPanel').classList.remove('hidden');
            return;
        }
        await finishLogin();
    } catch (requestError) {
        if (loginCompleted) clearSession(requestError.message);
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('mfaEnrollmentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('mfaEnrollmentButton');
    const error = document.getElementById('mfaSetupError');
    button.disabled = true;
    error.classList.add('hidden');
    try {
        if (!mfaSetupToken) throw new Error('The MFA setup session expired. Sign in again.');
        const result = await api('/admin/mfa/enroll', {
            method: 'POST',
            body: JSON.stringify({
                setupToken: mfaSetupToken,
                totpCode: document.getElementById('mfaEnrollmentCode').value
            })
        });
        mfaSetupToken = null;
        await finishLogin();
    } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('copyMfaSetupSecret').addEventListener('click', async () => {
    const status = document.getElementById('mfaSetupCopyStatus');
    try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
        await navigator.clipboard.writeText(document.getElementById('mfaSetupSecret').textContent);
        status.textContent = 'Setup key copied. Keep it private and store it securely.';
    } catch {
        status.textContent = 'Could not copy the setup key. Select and copy it manually, then store it securely.';
    }
});

document.getElementById('logoutButton').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    let message = 'You have been signed out.';
    try {
        await api('/admin/logout', { method: 'POST' });
    } catch (error) {
        message = `Signed out on this device, but the server session could not be revoked and may remain valid until expiry. ${error.message}`;
    } finally {
        clearSession(message);
        button.disabled = false;
    }
});
document.getElementById('refreshButton').addEventListener('click', loadOrders);
document.getElementById('refreshProductsButton').addEventListener('click', refreshCatalogAdmin);
document.getElementById('cancelProductEditButton').addEventListener('click', cancelProductEdit);
document.getElementById('cancelCategoryEditButton').addEventListener('click', resetCategoryForm);
document.querySelectorAll('[data-admin-view]').forEach((button) => {
    button.addEventListener('click', () => setAdminView(button.dataset.adminView));
});
document.getElementById('productImage').addEventListener('change', (event) => {
    clearProductImagePreview();
    const files = [...event.currentTarget.files];
    const preview = document.getElementById('productImagePreview');
    if (files.length > 10) {
        event.currentTarget.setCustomValidity('Choose no more than 10 product images.');
        event.currentTarget.reportValidity();
        event.currentTarget.value = '';
        return;
    }
    event.currentTarget.setCustomValidity('');
    for (const [index, file] of files.entries()) {
        const url = URL.createObjectURL(file);
        productImagePreviewUrls.push(url);
        const item = document.createElement('div');
        const image = document.createElement('img');
        image.src = url;
        image.alt = `Selected product image ${index + 1}`;
        item.append(image, createText('span', '', file.name));
        preview.append(item);
    }
    if (!files.length) return;
    preview.classList.remove('hidden');
});
document.getElementById('productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.getElementById('createProductButton');
    const error = document.getElementById('productFormError');
    error.textContent = '';
    error.classList.add('hidden');
    button.disabled = true;
    const productId = form.dataset.productId;
    button.textContent = productId ? 'Saving product…' : 'Uploading product…';
    showMessage('');
    try {
        const imageInput = document.getElementById('productImage');
        if (imageInput.files.length > 10) throw new Error('Choose no more than 10 product images.');
        if (productId) {
            const update = await api(`/admin/products/${encodeURIComponent(productId)}`, {
                method: 'PUT',
                body: await optimizedFormData(form)
            });
            cancelProductEdit();
            showMessage(
                update.warning || `${update.data.name} was updated. Refresh the storefront to see the changes.`,
                Boolean(update.warning)
            );
        } else {
            const result = await api('/admin/products', {
                method: 'POST',
                body: await optimizedFormData(form)
            });
            form.reset();
            clearProductImagePreview();
            showMessage(`${result.data.name} was uploaded and published. Refresh the storefront to see it.`);
        }
        await loadProducts();
    } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
        button.textContent = form.dataset.productId ? 'Save product changes' : 'Upload and publish product';
    }
});
document.getElementById('categoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const categoryId = form.dataset.categoryId;
    const error = document.getElementById('categoryFormError');
    error.textContent = '';
    error.classList.add('hidden');
    const button = document.getElementById('saveCategoryButton');
    button.disabled = true;
    try {
        await api(categoryId
            ? `/admin/shop/categories/${encodeURIComponent(categoryId)}`
            : '/admin/shop/categories', {
            method: categoryId ? 'PATCH' : 'POST',
            body: JSON.stringify({ name: document.getElementById('categoryName').value })
        });
        resetCategoryForm();
        await refreshCatalogAdmin();
        showMessage(categoryId ? 'Category name updated.' : 'Category added.');
    } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});
document.getElementById('shopProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('shopProfileError');
    error.textContent = '';
    error.classList.add('hidden');
    const button = document.getElementById('saveShopProfileButton');
    button.disabled = true;
    try {
        const result = await api('/admin/shop/profile', {
            method: 'PATCH',
            body: await optimizedFormData(event.currentTarget)
        });
        activeShop = { ...activeShop, name: result.data.name };
        document.getElementById('activeShopName').textContent = `Managing ${result.data.name} (${activeShop.slug})`;
        showMessage(result.warning || 'Your shop profile was saved.', Boolean(result.warning));
        await loadShopProfile();
    } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});
document.getElementById('shopProfileLogo').addEventListener('change', (event) => {
    const preview = document.getElementById('shopProfileLogoPreview');
    if (shopLogoPreviewUrl) URL.revokeObjectURL(shopLogoPreviewUrl);
    shopLogoPreviewUrl = null;
    preview.replaceChildren();
    const file = event.currentTarget.files[0];
    if (file) document.getElementById('removeShopLogo').checked = false;
    if (!file) return;
    const image = document.createElement('img');
    shopLogoPreviewUrl = URL.createObjectURL(file);
    image.src = shopLogoPreviewUrl;
    image.alt = 'Selected shop logo preview';
    preview.append(image, createText('span', '', file.name));
});
document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    profileMessage.textContent = '';
    profileMessage.classList.add('hidden');
    const button = document.getElementById('changePasswordButton');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    if (newPassword.value !== confirmPassword.value) {
        profileMessage.textContent = 'The new passwords do not match.';
        profileMessage.classList.remove('hidden');
        confirmPassword.focus();
        return;
    }
    button.disabled = true;
    try {
        await api('/admin/profile/password', {
            method: 'PATCH',
            body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value })
        });
        document.getElementById('passwordForm').reset();
        clearSession('Password changed. Sign in with your new password.');
    } catch (error) {
        profileMessage.textContent = error.message;
        profileMessage.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
});
document.getElementById('statusFilter').addEventListener('change', () => {
    page = 1;
    loadOrders();
});
document.getElementById('previousPage').addEventListener('click', () => {
    if (page > 1) {
        page -= 1;
        loadOrders();
    }
});
document.getElementById('nextPage').addEventListener('click', () => {
    page += 1;
    loadOrders();
});

setAuthenticated(false);
setAdminView('orders');
const mfaRequirement = document.querySelector('meta[name="shopademia-platform-admin-mfa-required"]')?.content;
if (mfaRequirement === 'true' || mfaRequirement === 'false') {
    document.getElementById('mfaLoginFields').classList.toggle('hidden', mfaRequirement === 'false');
    document.getElementById('loginButton').disabled = false;
} else {
    const loginError = document.getElementById('loginError');
    loginError.textContent = 'Could not load sign-in requirements. Refresh the page and try again.';
    loginError.classList.remove('hidden');
}
api('/admin/profile')
    .then(({ data }) => {
        currentAdminEmail = data.email;
        if (data.isPlatformAdmin) {
            window.location.replace('/admin/platform');
            return null;
        }
        return resolveActiveShop();
    })
    .then((shop) => {
        if (!shop) return;
        setAuthenticated(true);
        const requestedView = new URLSearchParams(window.location.search).get('view');
        const view = ['orders', 'products', 'shop', 'profile', 'categories'].includes(requestedView)
            ? requestedView
            : 'orders';
        setAdminView(view === 'categories' ? 'products' : view);
        if (view === 'categories') requestAnimationFrame(() => document.getElementById('categoriesPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }));
        if (view === 'orders') loadOrders();
    })
    .catch(() => clearSession());
