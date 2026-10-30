/* Brand product page: subscription pricing, strength switching, tier background, gallery arrows and the sticky mobile bar. */

const formatMoney = (cents) => {
  const format = window.Shopify?.money_format || '${{amount}}';
  const amount = (cents / 100).toFixed(2);
  return format.replace(/\{\{\s*amount[a-z_]*\s*\}\}/, amount.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
};

if (!customElements.get('product-subscription')) {
  customElements.define(
    'product-subscription',
    class ProductSubscription extends HTMLElement {
      connectedCallback() {
        this.variants = JSON.parse(this.querySelector('[data-variants]').textContent);
        this.form = document.getElementById(this.dataset.form);
        this.sellingPlanInput = this.querySelector('[data-selling-plan]');
        this.unit = this.dataset.unit || 'unit';

        this.addEventListener('change', (event) => {
          if (event.target.name?.startsWith('PurchaseType')) this.update();
        });
        this.onVariantChange = (event) => {
          if (event.target.matches('.product-variant-id, input[name="id"]')) this.update();
        };
        document.addEventListener('change', this.onVariantChange);
        this.update();
      }

      disconnectedCallback() {
        document.removeEventListener('change', this.onVariantChange);
      }

      get variant() {
        const input = this.form?.querySelector('input[name="id"]');
        const id = Number(input?.value);
        return this.variants.find((variant) => variant.id === id) || this.variants[0];
      }

      get isSubscription() {
        return this.querySelector('input[type="radio"]:checked')?.value === 'subscription';
      }

      setPrice(type, cents, units) {
        const holder = this.querySelector(`[data-price="${type}"]`);
        if (!holder) return;
        holder.querySelector('.product-subscription__amount').textContent = formatMoney(cents);
        holder.querySelector('.product-subscription__unit').textContent =
          units > 0 ? `${formatMoney(Math.round(cents / units))} per ${this.unit}` : '';
      }

      // Keep the selected purchase type in the URL, as the reference does.
      updateUrl(variantId, subscribe) {
        if (window.Shopify?.designMode) return;
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variantId);
        if (subscribe && this.sellingPlanInput.value) {
          url.searchParams.set('selling_plan', this.sellingPlanInput.value);
        } else {
          url.searchParams.delete('selling_plan');
        }
        window.history.replaceState(window.history.state, '', url);
      }

      update() {
        const variant = this.variant;
        if (!variant) return;
        const subscribe = this.isSubscription;
        const units = parseInt(variant.option, 10) || 0;

        this.querySelectorAll('[data-option]').forEach((option) => {
          option.classList.toggle('is-selected', (option.dataset.option === 'subscription') === subscribe);
        });
        this.sellingPlanInput.value = subscribe ? this.sellingPlanInput.dataset.sellingPlan : '';

        this.setPrice('subscription', variant.subscription_price, units);
        this.setPrice('onetime', variant.price, units);
        const savings = variant.price - variant.subscription_price;
        this.querySelector('[data-savings]').textContent = formatMoney(savings);
        if (variant.price > 0) {
          this.querySelector('[data-percent]').textContent = `${Math.round((savings / variant.price) * 100)}%`;
        }

        this.updateUrl(variant.id, subscribe);

        const total = subscribe ? variant.subscription_price : variant.price;
        document.querySelectorAll(`[data-final-price]`).forEach((price) => {
          if (!this.form || this.form.contains(price) || price.closest('[data-sticky-bar]')) price.textContent = formatMoney(total);
        });
      }
    }
  );
}

if (!customElements.get('bundle-tiers')) {
  customElements.define(
    'bundle-tiers',
    class BundleTiers extends HTMLElement {
      connectedCallback() {
        if (!this.dataset.scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        this.scene = this.querySelector('.bundle-tiers__scene');
        if (!this.scene) return;
        const start = () => {
          BundleTiers.loadRuntime()
            .then(() =>
              window.UnicornStudio.addScene({
                elementId: this.scene.id,
                filePath: this.dataset.scene,
                scale: 1,
                dpi: 1,
                fps: 30,
                lazyLoad: false,
                fixed: false,
              })
            )
            .then((scene) => {
              this.instance = scene;
              // Unicorn caches the scene's position for mouse effects; refresh it now, as the reference does.
              scene?.resize?.();
              this.onResize = () => {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => scene?.resize?.(), 120);
              };
              window.addEventListener('resize', this.onResize);
            })
            .catch(() => {});
        };
        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            this.observer.disconnect();
            start();
          });
          this.observer.observe(this);
        } else {
          start();
        }
      }

      disconnectedCallback() {
        this.observer?.disconnect();
        if (this.onResize) window.removeEventListener('resize', this.onResize);
        this.instance?.destroy?.();
      }

      static loadRuntime() {
        if (window.UnicornStudio?.addScene) return Promise.resolve();
        if (!BundleTiers.runtime) {
          BundleTiers.runtime = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.32/dist/unicornStudio.umd.js';
            script.async = true;
            script.onload = () => (window.UnicornStudio?.addScene ? resolve() : reject());
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        return BundleTiers.runtime;
      }
    }
  );
}

// Strength buttons keep the selected pack size when the other product offers it.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.product-strength__button[data-options]');
  if (!button) return;
  const info = button.closest('product-info') || document;
  const checked = info.querySelector('variant-selects input[type="radio"]:checked, variant-selects select option:checked');
  if (!checked) return;
  const options = button.dataset.options.split('|');
  const ids = button.dataset.variantIds.split('|');
  const index = options.indexOf(checked.value);
  if (index < 0) return;
  event.preventDefault();
  const url = new URL(button.href, window.location.origin);
  url.searchParams.set('variant', ids[index]);
  window.location.href = url.toString();
});

// The star summary scrolls to the reviews section.
document.addEventListener('click', (event) => {
  const link = event.target.closest('[data-review-summary]');
  if (!link) return;
  const target =
    document.querySelector(link.getAttribute('href')) || document.querySelector('.bundle-reviews, [data-reviews-section]');
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Gallery arrows under the main image cycle through the slides, wrapping at either end.
document.querySelectorAll('[data-gallery-arrows]').forEach((arrows) => {
  const gallery = arrows.closest('slider-component');
  const slider = gallery?.querySelector('.product__media-list');
  if (!slider) return;
  const slides = () => [...slider.querySelectorAll('.product__media-item')].filter((slide) => slide.offsetParent !== null || window.innerWidth >= 750);
  const activate = (step) => {
    const list = slides();
    if (!list.length) return;
    const mediaGallery = gallery.closest('media-gallery');
    if (mediaGallery?.setActiveMedia && window.innerWidth >= 750) {
      const current = Math.max(0, list.findIndex((slide) => slide.classList.contains('is-active')));
      const next = list[(current + step + list.length) % list.length];
      mediaGallery.setActiveMedia(next.dataset.mediaId, false);
      return;
    }
    // On phones the visitor may have swiped, so start from the slide nearest the scroll position.
    const current = list.reduce(
      (nearest, slide, index) =>
        Math.abs(slide.offsetLeft - slider.scrollLeft) < Math.abs(list[nearest].offsetLeft - slider.scrollLeft) ? index : nearest,
      0
    );
    const next = list[(current + step + list.length) % list.length];
    list.forEach((slide) => slide.classList.toggle('is-active', slide === next));
    slider.scrollTo({ left: next.offsetLeft, behavior: 'smooth' });
  };
  arrows.querySelector('[data-gallery-prev]')?.addEventListener('click', () => activate(-1));
  arrows.querySelector('[data-gallery-next]')?.addEventListener('click', () => activate(1));

  // Desktop has no scroll to swipe, so a mouse drag past the threshold steps the gallery.
  slider.addEventListener('dragstart', (event) => event.preventDefault());
  slider.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || window.innerWidth < 750) return;
    const startX = event.clientX;
    const onUp = (upEvent) => {
      window.removeEventListener('pointerup', onUp);
      const delta = upEvent.clientX - startX;
      if (Math.abs(delta) > 40) activate(delta < 0 ? 1 : -1);
    };
    window.addEventListener('pointerup', onUp);
  });
});

// Sticky Add to cart bar on mobile, shown once the visitor scrolls past the first screen.
document.querySelectorAll('[data-sticky-bar]').forEach((bar) => {
  const source = document.getElementById(bar.dataset.button);
  const button = bar.querySelector('button');
  if (!source || !button) return;
  const sync = () => {
    button.disabled = source.disabled;
    const label = source.querySelector('span');
    if (label) button.querySelector('[data-sticky-label]').textContent = label.textContent.trim();
    const price = source.querySelector('[data-final-price]');
    const target = bar.querySelector('[data-final-price]');
    if (price && target) target.textContent = price.textContent;
  };
  button.addEventListener('click', () => source.click());
  new MutationObserver(sync).observe(source, { attributes: true, childList: true, subtree: true, characterData: true });
  const onScroll = () => bar.classList.toggle('is-visible', window.scrollY > window.innerHeight + 250);
  window.addEventListener('scroll', onScroll, { passive: true });
  sync();
  onScroll();
});

// A selected pack size that is hidden on this page moves to the next visible one, as on the reference.
Promise.all([customElements.whenDefined('product-info'), customElements.whenDefined('variant-selects')]).then(() => {
  // product-info subscribes to option changes in its connectedCallback, so wait a frame before switching.
  requestAnimationFrame(() => {
    document.querySelectorAll('product-info variant-selects').forEach((picker) => {
      const checked = picker.querySelector('input.is-hidden-option:checked');
      if (!checked) return;
      const next = [...picker.querySelectorAll('input[type="radio"]')].find(
        (input) => input.name === checked.name && !input.classList.contains('is-hidden-option') && !input.classList.contains('disabled')
      );
      if (!next) return;
      next.checked = true;
      next.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
});

// Regional notices: an element with data-geo-region="CA" is hidden once a location lookup places the
// visitor outside that state. If the lookup fails, the notice stays visible, as on the reference.
(() => {
  const notices = document.querySelectorAll('[data-geo-region]');
  if (!notices.length || window.Shopify?.designMode) return;
  fetch('https://ipapi.co/json/')
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((data) => {
      if (!data?.region_code) return;
      notices.forEach((notice) => {
        notice.hidden = notice.dataset.geoRegion.split(',').map((region) => region.trim()).indexOf(data.region_code) === -1;
      });
    })
    .catch(() => {});
})();
