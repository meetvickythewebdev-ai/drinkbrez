if (!customElements.get('bundle-builder')) {
  customElements.define(
    'bundle-builder',
    class BundleBuilder extends HTMLElement {
      connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;

        this.config = JSON.parse(this.querySelector('[data-bundle-config]').textContent);
        this.tiers = [...this.config.tiers].sort((a, b) => a.threshold - b.threshold);
        this.strings = this.config.strings;
        this.minSlots = parseInt(this.dataset.minSlots, 10) || 8;
        this.moneyFormat = this.dataset.moneyFormat || '${{amount}}';
        this.items = [];
        this.products = new Map();

        this.slotsList = this.querySelector('[data-bundle-slots]');
        this.submitButton = this.querySelector('[data-bundle-submit]');
        this.errorMessage = this.querySelector('[data-bundle-error]');
        this.fill = this.querySelector('[data-bundle-fill]');
        this.steps = [...this.querySelectorAll('[data-bundle-step]')];
        this.panel = this.querySelector('[data-bundle-panel]');
        this.toggleButton = this.querySelector('[data-bundle-toggle]');

        this.querySelectorAll('[data-bundle-card]').forEach((card) => this.setupCard(card));

        this.subscriptionOption = this.querySelector('[data-bundle-subscription-option]');
        if (this.subscriptionOption && ![...this.products.values()].some((product) => product.sellingPlan)) {
          this.subscriptionOption.remove();
          this.subscriptionOption = null;
          const oneTime = this.querySelector('[data-bundle-purchase][value="onetime"]');
          if (oneTime) oneTime.checked = true;
        }

        this.querySelectorAll('[data-bundle-purchase]').forEach((input) =>
          input.addEventListener('change', () => this.render())
        );
        this.slotsList.addEventListener('click', (event) => {
          const button = event.target.closest('[data-bundle-remove]');
          if (button) this.removeItem(parseInt(button.dataset.index, 10));
        });
        this.submitButton.addEventListener('click', () => this.addToCart());
        this.toggleButton?.addEventListener('click', () => this.togglePanel());

        this.render();
      }

      setupCard(card) {
        const product = JSON.parse(card.querySelector('[data-bundle-product]').textContent);
        product.variantMap = new Map(product.variants.map((variant) => [String(variant.id), variant]));
        this.products.set(String(product.id), product);

        const select = card.querySelector('[data-bundle-variant-select]');
        const button = card.querySelector('[data-bundle-add]');
        card.bundle = { product, select, button, price: card.querySelector('[data-bundle-card-price]') };

        select.addEventListener('change', () => this.updateCard(card));
        button.addEventListener('click', () => {
          const variant = product.variantMap.get(select.value);
          if (!variant || !variant.available) return;
          this.items.push({ productId: String(product.id), variantId: String(variant.id) });
          this.render();
          this.scrollSlotsToEnd();
        });
      }

      updateCard(card) {
        const { product, select, button, price } = card.bundle;
        const variant = product.variantMap.get(select.value);
        if (!variant) return;

        price.textContent = this.formatMoney(variant.price);
        button.disabled = !variant.available;

        const inBundle = this.items.some((item) => item.variantId === String(variant.id));
        button.classList.toggle('is-added', variant.available && inBundle);
        if (!variant.available) {
          button.textContent = this.strings.soldOut;
        } else {
          button.textContent = inBundle ? this.strings.added : this.strings.add;
        }
      }

      removeItem(index) {
        if (Number.isNaN(index)) return;
        this.items.splice(index, 1);
        this.render();
      }

      get purchaseType() {
        const checked = this.querySelector('[data-bundle-purchase]:checked');
        return checked ? checked.value : 'onetime';
      }

      getItemData(item) {
        const product = this.products.get(item.productId);
        return { product, variant: product.variantMap.get(item.variantId) };
      }

      // Mirrors Shopify selling plan price adjustments so the displayed subscription price matches checkout.
      getSubscriptionPrice(product, price) {
        const adjustment = product.sellingPlan?.adjustments?.[0];
        if (!adjustment) return price;

        switch (adjustment.value_type) {
          case 'percentage':
            return Math.round(price * (1 - adjustment.value / 100));
          case 'fixed_amount':
            return Math.max(price - adjustment.value, 0);
          case 'price':
            return adjustment.value;
          default:
            return price;
        }
      }

      getTotals() {
        let subtotal = 0;
        let subscriptionSubtotal = 0;

        this.items.forEach((item) => {
          const { product, variant } = this.getItemData(item);
          subtotal += variant.price;
          subscriptionSubtotal += this.getSubscriptionPrice(product, variant.price);
        });

        const totalFor = (base) => {
          const tier = this.getActiveTier(base);
          return Math.max(base - (tier ? tier.discount : 0), 0);
        };

        return {
          subtotal,
          oneTime: { base: subtotal, total: totalFor(subtotal) },
          subscription: { base: subscriptionSubtotal, total: totalFor(subscriptionSubtotal) },
        };
      }

      getActiveTier(amount) {
        return this.tiers.reduce((best, tier) => {
          if (amount < tier.threshold || tier.discount <= 0) return best;
          return !best || tier.discount > best.discount ? tier : best;
        }, null);
      }

      // Maps the amount onto the bar so the fill lines up with each milestone marker.
      getProgressPercent(amount) {
        if (!this.tiers.length || amount <= 0) return 0;

        let previous = { threshold: 0, position: 0 };
        for (const tier of this.tiers) {
          if (amount < tier.threshold) {
            const span = tier.threshold - previous.threshold || 1;
            return previous.position + ((amount - previous.threshold) / span) * (tier.position - previous.position);
          }
          previous = tier;
        }
        return 100;
      }

      render() {
        const totals = this.getTotals();
        const active = this.purchaseType === 'subscription' ? totals.subscription : totals.oneTime;

        this.renderSlots();
        this.renderPrices(totals);
        this.renderProgress(active.base);
        this.querySelectorAll('[data-bundle-card]').forEach((card) => this.updateCard(card));

        this.submitButton.disabled = this.items.length === 0;
        this.errorMessage.hidden = true;
      }

      renderSlots() {
        const slotCount = Math.max(this.minSlots, this.items.length + 1);
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < slotCount; index++) {
          const slot = document.createElement('li');
          slot.className = 'bundle-slot';
          const item = this.items[index];

          if (!item) {
            slot.classList.add('bundle-slot--empty');
          } else {
            const { product, variant } = this.getItemData(item);
            const image = variant.image || product.image;
            const label = `${variant.option} ${this.strings.pack}`.trim();
            slot.innerHTML = `
              <button type="button" class="bundle-slot__remove" data-bundle-remove data-index="${index}"
                aria-label="${this.escape(this.strings.remove.replace('[title]', product.title))}">
                <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="10" height="10">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </button>
              <div class="bundle-slot__media">
                ${image ? `<img src="${image}" alt="${this.escape(product.title)}" loading="lazy" width="65" height="95">` : ''}
              </div>
              <div class="bundle-slot__info">
                <span class="bundle-slot__variant">${this.escape(label)}</span>
                <span class="bundle-slot__price">${this.formatMoney(variant.price)}</span>
              </div>`;
          }
          fragment.appendChild(slot);
        }

        this.slotsList.replaceChildren(fragment);
      }

      renderPrices(totals) {
        const setPrice = (type, data) => {
          const element = this.querySelector(`[data-bundle-price="${type}"]`);
          if (!element) return;
          if (!this.items.length) {
            element.innerHTML = '';
            return;
          }
          const compare =
            data.total < totals.subtotal ? `<s class="bundle-purchase__compare">${this.formatMoney(totals.subtotal)}</s>` : '';
          element.innerHTML = `${compare}<span class="bundle-purchase__total">${this.formatMoney(data.total)}</span>`;
        };

        setPrice('onetime', totals.oneTime);
        setPrice('subscription', totals.subscription);
      }

      renderProgress(amount) {
        const percent = Math.min(this.getProgressPercent(amount), 100);
        if (this.fill) {
          this.fill.style.width = `${percent}%`;
          this.fill.parentElement.setAttribute('aria-valuenow', Math.round(percent));
        }
        this.steps.forEach((step) => {
          step.classList.toggle('is-complete', amount > 0 && amount >= parseInt(step.dataset.threshold, 10));
        });
      }

      scrollSlotsToEnd() {
        const filled = this.slotsList.children[this.items.length - 1];
        if (!filled) return;
        const container = this.slotsList.parentElement;
        const overflow = filled.getBoundingClientRect().right - container.getBoundingClientRect().right;
        if (overflow > 0) container.scrollBy({ left: overflow + 8, behavior: 'smooth' });
      }

      togglePanel() {
        const collapsed = this.panel.classList.toggle('is-collapsed');
        this.toggleButton.setAttribute('aria-expanded', String(!collapsed));
      }

      async addToCart() {
        if (!this.items.length) return;

        const useSubscription = this.purchaseType === 'subscription';
        const lines = new Map();
        this.items.forEach((item) => {
          const { product } = this.getItemData(item);
          const line = lines.get(item.variantId) || {
            id: Number(item.variantId),
            quantity: 0,
            properties: { _bundle: this.dataset.bundleName },
          };
          if (useSubscription && product.sellingPlan) line.selling_plan = product.sellingPlan.id;
          line.quantity += 1;
          lines.set(item.variantId, line);
        });

        const cartDrawer = document.querySelector('cart-drawer');
        const body = { items: [...lines.values()] };
        if (cartDrawer) {
          body.sections = cartDrawer.getSectionsToRender().map((section) => section.id);
          body.sections_url = window.location.pathname;
        }

        this.setLoading(true);
        try {
          const response = await fetch(`${window.routes?.cart_add_url || '/cart/add'}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          if (!response.ok || data.status) throw new Error(data.description || data.message || this.strings.error);

          if (this.dataset.afterAdd === 'checkout') {
            window.location.href = '/checkout';
            return;
          }

          this.items = [];
          this.render();

          if (cartDrawer && data.sections) {
            cartDrawer.classList.remove('is-empty');
            cartDrawer.renderContents({ id: data.items?.[0]?.product_id, sections: data.sections });
          } else {
            window.location.href = window.routes?.cart_url || '/cart';
          }
        } catch (error) {
          this.errorMessage.textContent = error.message || this.strings.error;
          this.errorMessage.hidden = false;
        } finally {
          this.setLoading(false);
        }
      }

      setLoading(isLoading) {
        this.submitButton.classList.toggle('loading', isLoading);
        this.submitButton.setAttribute('aria-busy', String(isLoading));
        this.submitButton.querySelector('.loading__spinner')?.classList.toggle('hidden', !isLoading);
        if (isLoading) this.submitButton.disabled = true;
        else this.submitButton.disabled = this.items.length === 0;
      }

      escape(value) {
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML.replace(/"/g, '&quot;');
      }

      formatMoney(cents) {
        const format = this.moneyFormat;
        const match = format.match(/\{\{\s*(\w+)\s*\}\}/);
        if (!match) return (cents / 100).toFixed(2);

        const formatWithDelimiters = (number, precision, thousands = ',', decimal = '.') => {
          const [whole, fraction] = (number / 100).toFixed(precision).split('.');
          const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
          return fraction ? `${withThousands}${decimal}${fraction}` : withThousands;
        };

        const formatters = {
          amount: () => formatWithDelimiters(cents, 2),
          amount_no_decimals: () => formatWithDelimiters(cents, 0),
          amount_with_comma_separator: () => formatWithDelimiters(cents, 2, '.', ','),
          amount_no_decimals_with_comma_separator: () => formatWithDelimiters(cents, 0, '.', ','),
          amount_with_apostrophe_separator: () => formatWithDelimiters(cents, 2, "'", '.'),
        };

        return format.replace(match[0], (formatters[match[1]] || formatters.amount)());
      }
    }
  );
}
