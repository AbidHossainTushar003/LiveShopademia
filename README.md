# Shopademia storefront

Shopademia is a responsive, browser-based storefront for browsing products, managing a cart and wishlist, and trying the checkout flow. The current project uses local demo data and mock order placement; it is not connected to a live inventory, payment, or order service.

## Run locally

Serve the project root over HTTP (ES modules do not work reliably when opening `index.html` directly as a file). With Python installed:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000> in a browser.

## Storefront features

- Search the catalog and filter by category or discounted products.
- Add featured products and new arrivals to the cart; adjust quantities and remove items.
- Save a wishlist and cart in the browser's local storage.
- Submit the checkout form to the mock order repository and see a demo order number.
- Use the mobile search control on narrow screens.

## Before accepting real orders

1. Implement and deploy the product and order API expected by `ApiProductRepository` and `ApiOrderRepository`.
2. Configure the API URL and switch `useMockApi` in `js/config/app.config.js` only after the live order service is ready.
3. Replace the placeholder bKash number and delivery amount with verified business settings.
4. Integrate a payment provider that verifies transactions server-side. Do not collect or trust a payment claim from browser form fields as proof of payment.
5. Configure real customer support, account, newsletter, and social links before launch.

The checkout displays a demo warning and does not collect or process payment. Never send money to the placeholder number.
