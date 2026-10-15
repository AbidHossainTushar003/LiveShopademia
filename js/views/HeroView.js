import { escapeHtml, formatPrice, isSafeProductImage } from '../utils/format.js';

export class HeroView {
    constructor({ homeVM, cartVM, shopSlug = 'main', slides = [] }) {
        this.shopSlug = shopSlug;
        const card = document.getElementById('heroOfferCard');
        const image = document.getElementById('heroProductImage');
        const fallback = document.getElementById('heroProductFallback');
        if (slides.length) {
            this.#setupSlider(slides);
            return;
        }
        card.setAttribute('aria-live', 'polite');
        homeVM.loading.subscribe((loading) => {
            card.setAttribute('aria-busy', String(loading));
            if (loading) card.innerHTML = '<p class="text-xs text-slate-500">Loading featured product…</p>';
            else if (!homeVM.heroOffer.value) card.innerHTML = '<p class="text-xs text-slate-500">Featured product is unavailable right now.</p>';
        });
        homeVM.heroOffer.subscribe((p) => {
            if (!p) return;
            this.#renderOffer(card, p);
            image.alt = p.imageAlt || p.name;
            if (isSafeProductImage(p.image)) {
                image.src = p.image;
                image.classList.remove('hidden');
                fallback.classList.add('hidden');
            } else {
                image.removeAttribute('src');
                image.classList.add('hidden');
                fallback.classList.remove('hidden');
            }
        });
        image.addEventListener('error', () => {
            image.classList.add('hidden');
            fallback.classList.remove('hidden');
        });
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="add"]')) cartVM.add(homeVM.heroOffer.value);
        });
    }

    #setupSlider(slides) {
        document.querySelector('#home .glass-panel').classList.add('hero-slide-mode');
        const image = document.getElementById('heroSlideImage');
        const controls = document.getElementById('heroSliderControls');
        const indicators = document.getElementById('heroSlideIndicators');
        const previous = document.getElementById('heroSlidePrevious');
        const next = document.getElementById('heroSlideNext');
        const mobileViewport = window.matchMedia('(max-width: 48rem)');
        const art = document.querySelector('#home .marketplace-hero-art');
        document.getElementById('heroProductImage').classList.add('hidden');
        document.getElementById('heroProductFallback').classList.add('hidden');
        document.getElementById('heroOfferCard').classList.add('hidden');
        art.setAttribute('role', 'region');
        art.setAttribute('aria-label', 'Featured image carousel');
        image.classList.remove('hidden');
        controls.classList.toggle('hidden', slides.length < 2);
        indicators.replaceChildren();

        let currentIndex = 0;
        const indicatorButtons = slides.map((slide, index) => {
            const indicator = document.createElement('button');
            indicator.type = 'button';
            indicator.setAttribute('aria-label', `Show hero slide ${index + 1}`);
            indicator.addEventListener('click', () => showSlide(index));
            indicators.append(indicator);
            return indicator;
        });

        const showSlide = (index) => {
            currentIndex = (index + slides.length) % slides.length;
            const slide = slides[currentIndex];
            const mobileImage = mobileViewport.matches && isSafeProductImage(slide.mobileImage)
                ? slide.mobileImage
                : slide.image;
            if (isSafeProductImage(mobileImage)) image.src = mobileImage;
            else image.removeAttribute('src');
            image.alt = slide.headline || `Featured marketplace image ${currentIndex + 1}`;
            image.classList.remove('hero-slide-enter');
            void image.offsetWidth;
            image.classList.add('hero-slide-enter');
            indicatorButtons.forEach((indicator, i) => {
                indicator.setAttribute('aria-current', String(i === currentIndex));
            });
        };
        mobileViewport.addEventListener('change', () => showSlide(currentIndex));
        image.addEventListener('error', () => {
            image.removeAttribute('src');
            image.alt = 'Featured image unavailable';
        });
        previous.addEventListener('click', () => showSlide(currentIndex - 1));
        next.addEventListener('click', () => showSlide(currentIndex + 1));
        showSlide(0);
        if (slides.length > 1) {
            let rotationTimer;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let interactionActive = false;
            const startRotation = () => {
                if (reducedMotion || interactionActive) return;
                window.clearInterval(rotationTimer);
                rotationTimer = window.setInterval(() => showSlide(currentIndex + 1), 5000);
            };
            controls.addEventListener('pointerenter', () => {
                interactionActive = true;
                window.clearInterval(rotationTimer);
                rotationTimer = undefined;
            });
            controls.addEventListener('pointerleave', () => {
                interactionActive = false;
                startRotation();
            });
            controls.addEventListener('focusin', () => {
                interactionActive = true;
                window.clearInterval(rotationTimer);
                rotationTimer = undefined;
            });
            controls.addEventListener('focusout', (event) => {
                if (controls.contains(event.relatedTarget)) return;
                interactionActive = false;
                startRotation();
            });
            startRotation();
        }
    }

    #renderOffer(card, p) {
        const available = p.isAvailableForPurchase !== false;
        const availabilityLabel = p.isAvailable === false ? 'Unavailable' : 'Out of stock';
        card.innerHTML = `
            <span class="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">Featured product</span>
            <h4 class="text-xs font-bold text-slate-900 mt-1.5 leading-tight line-clamp-2"><a href="/product/${encodeURIComponent(p.id)}?shop=${encodeURIComponent(this.shopSlug)}" aria-label="View details for ${escapeHtml(p.name)}" class="text-left hover:text-blue-700 focus-visible:outline-blue-600">${escapeHtml(p.name)}</a></h4>
            <p class="text-[10px] text-slate-600 mt-0.5">${escapeHtml(p.category)}</p>
            <div class="mt-2 flex items-baseline gap-1.5">
                <span class="text-sm font-extrabold text-blue-700">${formatPrice(p.price)}</span>
                ${p.hasDiscount ? `<span class="text-[10px] text-slate-600 line-through">${formatPrice(p.oldPrice)}</span>
                <span class="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">-${p.discountPercent}%</span>` : ''}
            </div>
            <button data-action="add" ${available ? '' : 'disabled'} title="${escapeHtml(p.name)}" class="w-full mt-2.5 py-1.5 rounded-lg ${available ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'} text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm">
                <span>${available ? 'Add to Cart' : availabilityLabel}</span>${available ? '<i class="fa-solid fa-arrow-right text-[10px]"></i>' : ''}
            </button>`;
    }
}
