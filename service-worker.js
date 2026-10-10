self.addEventListener('push', (event) => {
    let offer = {};
    try {
        offer = event.data ? event.data.json() : {};
    } catch {
        offer = { title: 'New shop offer', body: event.data?.text() || '' };
    }
    const title = typeof offer.title === 'string' ? offer.title : 'New shop offer';
    const options = {
        body: typeof offer.body === 'string' ? offer.body : 'A new offer is available.',
        tag: typeof offer.tag === 'string' ? offer.tag : 'shop-offer',
        data: { url: typeof offer.url === 'string' && offer.url.startsWith('/') ? offer.url : '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
        const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
            await existing.navigate(url);
            return existing.focus();
        }
        return clients.openWindow(url);
    }));
});
