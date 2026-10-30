class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();

    this.addEventListener('click', (event) => {
      const upgrade = event.target.closest('[data-upgrade]');
      if (upgrade) {
        upgrade.textContent = 'Upgrading...';
        this.changeLine(upgrade, {
          line: Number(upgrade.dataset.line),
          quantity: Number(upgrade.dataset.quantity),
          selling_plan: Number(upgrade.dataset.sellingPlan),
        });
        return;
      }

      const add = event.target.closest('[data-upsell-add]');
      if (add) this.addVariant(add, Number(add.dataset.upsellAdd));
    });

    // Caught on the way down so cart-drawer-items doesn't treat the plan menu as a quantity input.
    this.addEventListener(
      'change',
      (event) => {
        const select = event.target.closest('[data-plan-select]');
        if (!select) return;
        event.stopPropagation();
        this.changeLine(select, {
          line: Number(select.dataset.line),
          quantity: Number(select.dataset.quantity),
          selling_plan: select.value ? Number(select.value) : null,
        });
      },
      true
    );
  }

  // Switches a line to or from a subscription, then redraws the drawer.
  changeLine(control, body) {
    control.disabled = true;
    this.requestCart(routes.cart_change_url, body);
  }

  addVariant(control, variantId) {
    control.disabled = true;
    control.textContent = 'Adding...';
    this.requestCart(routes.cart_add_url, { items: [{ id: variantId, quantity: 1 }] });
  }

  requestCart(url, body) {
    const sections = this.getSectionsToRender().map((section) => section.id);
    return fetch(url, {
      ...fetchConfig('javascript'),
      body: JSON.stringify({ ...body, sections, sections_url: window.location.pathname }),
    })
      .then((response) => response.json())
      .then((state) => {
        if (state.status || state.errors || !state.sections) throw new Error(state.description || state.errors);
        this.renderSections(state.sections);
        const itemCount = state.item_count ?? state.items?.length;
        if (typeof itemCount === 'number') this.classList.toggle('is-empty', itemCount === 0);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: state });
      })
      .catch(() => {
        const errors = this.querySelector('#CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
        this.querySelectorAll('[data-upgrade], [data-upsell-add], [data-plan-select]').forEach((control) => {
          control.disabled = false;
        });
      });
  }

  renderSections(sections) {
    const drawer = this.getSectionDOM(sections['cart-drawer'], '.drawer__inner');
    if (drawer) this.querySelector('.drawer__inner').innerHTML = drawer.innerHTML;
    const bubble = document.getElementById('cart-icon-bubble');
    if (bubble && sections['cart-icon-bubble']) {
      bubble.innerHTML = this.getSectionInnerHTML(sections['cart-icon-bubble']);
    }
    if (this.classList.contains('active')) trapFocus(this.querySelector('.drawer__inner'));
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (this.classList.contains('active')) return;
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true },
    );

    document.body.classList.add('overflow-hidden');

    // cart-drawer-items is a CartItems subclass that extends createViewEventElement.
    // Its `view-event-trigger="manual"` skips auto-dispatch on connect; we fire
    // it here when the drawer opens, with `context: 'dialog'` from the payload attribute.
    this.querySelector('cart-drawer-items')?.dispatchViewEvent();
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') &&
      this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
