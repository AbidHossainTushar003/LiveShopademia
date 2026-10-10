# Shopademia SEO and AI-discovery audit

Audit date: 2026-10-10  
Environment: local development app at `http://localhost:3000`  
Scope: storefront source, local HTML/robots/sitemap responses, and browser-rendered public routes.

## Executive verdict

**Production deployment exists, but indexability is not currently established.** The HTTPS domain `shopademia.store` and Search Console property are configured. A production smoke test previously returned HTTP 200 for the health, robots, sitemap, and public catalog endpoints, and `www` redirected to the apex domain. During the latest retest, public requests timed out; Search Console still reports an old sitemap fetch error. Google has not confirmed a successful current fetch or indexing. Analytics remains disabled because no verified GA4 ID is configured.

Even after deployment, rankings and AI citations are never guaranteed by metadata or schema. They depend on crawlability, useful and trustworthy pages, real products and business information, competition, reputation/citations, and ongoing measurement.

## Confirmed technical issues and fixes

| Priority | Finding | Why it hurt discovery | Resolution |
|---|---|---|---|
| Critical | The audited address is localhost; no public, crawlable production domain was provided. | Search engines and AI crawlers cannot index a developer's localhost. | **Not fixable from source alone.** Deploy to the verified HTTPS domain, keep `PUBLIC_SITE_URL` aligned with it, and submit the sitemap in Google Search Console and Bing Webmaster Tools. |
| High | `robots.txt` disallowed all `/api/` paths while the storefront loads its product, category, and shop content from those public endpoints. | A crawler respecting robots rules could not fetch the data needed to render catalog pages. | **Fixed.** Public catalog/shop data endpoints are allowed; authenticated admin and customer lookup endpoints remain disallowed. |
| High | Client hydration rewrote shop-specific canonicals and treated `?shop=main` as a second URL. | Conflicting or duplicate canonicals can split indexing signals; shop-specific pages also need their correct shop context. | **Fixed.** Server and browser canonical URLs now agree, normalize the default shop, and retain a non-default shop slug. Sitemap product/category URLs follow that canonical form. |
| High | Product, category, and shop-profile requests that did not resolve could return HTTP 200 with a client-side not-found view. | Soft 404s waste crawl budget and may keep invalid URLs in search results. | **Fixed.** Unknown/inactive shops, products, and categories return the actual 404 page/status. |
| High | Product pages had no Product/Breadcrumb structured data; public pages had no Organization/WebSite graph. | Search and answer engines had fewer reliable machine-readable clues about the publisher, product, offer, and page hierarchy. | **Fixed.** Added request-origin-aware Organization and WebSite JSON-LD, product/offer data, breadcrumbs, and OnlineStore profile data. No review/rating markup is emitted. |
| High | The starter catalog advertised specific star ratings and hundreds/thousands of reviews without a review system or evidence source. | Fabricated social proof damages customer trust and conflicts with accurate content expectations for search and AI answers. | **Fixed.** Removed those invented counts/ratings from the starter products and hid ratings unless real positive review data exists. |
| Medium | Product/category/shop information was primarily client-rendered, leaving script-disabled crawlers with little page text. | Some crawlers and AI retrieval systems do not fully execute JavaScript. | **Partially improved.** Product/category/shop profiles now include useful `<noscript>` fallback content; product offers and page hierarchy are also server-emitted as JSON-LD. Full server rendering of catalog grids remains future work. |
| Medium | Social cards lacked explicit Twitter title/description, and the page did not declare its English-for-Bangladesh locale. | Link previews were less descriptive and locale context was missing. | **Fixed.** Added `twitter:title`, `twitter:description`, and `og:locale`; server responses update social metadata per page. |

## Why Google rankings and AI suggestions are still unlikely/unproven

1. **Production availability and indexing are unproven.** Although HTTPS and the canonical `www` redirect were previously verified, the latest production requests timed out. Search Console still shows a stale sitemap fetch error, so current crawling and indexing are unconfirmed.
2. **The starter inventory is generic and appears demonstrative.** Several products have no real photos or substantive descriptions; product content must match real stock, prices, brand/model details, delivery terms, and the seller. Do not publish invented claims, discounts, reviews, or specifications.
3. **Shop pages have little first-hand expertise or differentiation.** Add verified shop histories, seller identities, support/return/delivery policies, warranty terms, product-specific use/care details, and original photography where accurate and legally approved. Avoid thin, duplicated template copy.
4. **Reputation and citations are unknown.** No legitimate independent mentions, business profiles, customer feedback, or backlink evidence was available. Earn real citations and reviews; do not buy links or manufacture testimonials.
5. **No search performance data was available.** Search Console/Bing verification, index coverage, query impressions, crawl errors, conversions, and AI referral/citation tracking were not supplied. Analytics integrations are disabled in `js/config/tracking.config.js`; configure only with approved IDs and consent-compliant behavior.
6. **Performance is not certified.** No production Lighthouse/PageSpeed or Core Web Vitals field data was available. Run mobile and desktop tests against production and fix measured LCP, INP, CLS, image transfer size, and slow API responses against agreed targets.
7. **Legal and transaction facts need owner review.** Current policy/terms text describes a template platform and asks the operator to set an appropriate retention schedule. Publish the real operator identity, seller responsibilities, payment, delivery, returns/refunds, support, privacy, and retention practices after legal approval.
8. **AI answers cannot be forced.** Accessible factual text, stable URLs, structured data, crawl permission, and reputable citations improve eligibility and retrieval quality; no special file or schema guarantees an AI recommendation.

## Checklist

- [x] Custom 404: invalid product, category, and shop routes return the not-found page/status.
- [x] Unique title on supported pages; managed products can set an SEO title in the shop admin.
- [x] Meta description on supported pages; managed products can set a product-specific description in the shop admin.
- [x] Social preview metadata and shared preview image references are present. Validate actual previews on the deployed domain.
- [x] Product and other storefront images have alt text; managed product images have editable alt text.
- [x] Internal product/category/shop links and breadcrumb links are present.
- [x] Sitemap and robots endpoints exist, and public catalog APIs are crawlable.
- [ ] Confirm Search Console can fetch the sitemap and verify indexing. The property currently shows an earlier `Couldn't fetch` result; a fresh fetch has not been confirmed.
- [x] robots.txt does not block the public site/catalog APIs.
- [x] Production TLS and the `www`-to-apex 301 redirect were verified during deployment. **Retest required:** the latest public requests timed out.
- [x] Order-form validation and server-side spam/rate protections are present.
- [x] Successful order confirmation is shown; downloadable receipt behavior was implemented and previously exercised.
- [ ] Configure a real analytics property and verify consent-compliant events (IDs are intentionally not guessed; integrations remain disabled).
- [x] Privacy policy page exists. Owner/legal review of operator-specific claims and retention is still required before production.
- [x] Visitor FAQ added to the About page using verified order, payment, lookup, receipt, and shop-policy behavior.
- [x] No fabricated testimonials or review counts are used. Add testimonials only when supported by genuine customer permission/evidence.
- [ ] Replace demo inventory with verified listings and complete seller-authored content/photos.
- [ ] Obtain owner/legal approval for real business, fulfillment, returns, support, privacy, and retention details.
- [ ] Run production Lighthouse/PageSpeed and review field Core Web Vitals.
- [ ] Build legitimate brand/shop citations and collect genuine customer feedback.

The shop-specific product API now returns `imageAlt`, `seoTitle`, and `metaDescription` for uploaded products. Shop admins can edit these values; omitted values fall back to the product name/description. The values are stored in PostgreSQL and used in product image accessibility text and product-page title/description metadata.

## Verification

The local app was inspected in the browser; `robots.txt`, sitemap, canonical/meta output, and public route status were checked. `npm test` passed **75/75**. Focused homepage and public-route/product metadata journeys passed **6/6** serially across Chromium, Firefox, and WebKit. An initial parallel browser attempt hit the app's known shared 120-request catalog rate limit; the final isolated serial run passed.

Production endpoint smoke checks previously returned HTTP 200 for health, robots, sitemap, and public catalog routes; the latest requests timed out. Search Console continues to show a stale sitemap fetch failure. No successful current Google/Bing crawl, Lighthouse run, backlink audit, or AI citation test is claimed.
