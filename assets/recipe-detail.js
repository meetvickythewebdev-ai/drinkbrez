if (!customElements.get('recipe-gallery')) {
  customElements.define(
    'recipe-gallery',
    class RecipeGallery extends HTMLElement {
      connectedCallback() {
        this.slides = [...this.querySelectorAll('[data-slide]')];
        this.thumbs = [...this.querySelectorAll('[data-thumb]')];
        this.prev = this.querySelector('[data-thumb-prev]');
        this.next = this.querySelector('[data-thumb-next]');
        this.visible = parseInt(this.dataset.visible, 10) || 3;
        this.active = 0;
        this.start = 0;

        this.addEventListener('click', (event) => {
          const thumb = event.target.closest('[data-thumb]');
          if (thumb) this.setActive(Number(thumb.dataset.thumb));
          if (event.target.closest('[data-thumb-prev]')) this.setStart(this.start - 1);
          if (event.target.closest('[data-thumb-next]')) this.setStart(this.start + 1);
        });
        this.setStart(0);
      }

      setActive(index) {
        this.active = index;
        this.slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === index));
        this.thumbs.forEach((thumb, thumbIndex) => thumb.classList.toggle('is-active', thumbIndex === index));
        if (index < this.start) this.setStart(index);
        if (index >= this.start + this.visible) this.setStart(index - this.visible + 1);
      }

      setStart(start) {
        this.start = Math.min(Math.max(start, 0), Math.max(this.thumbs.length - this.visible, 0));
        this.thumbs.forEach((thumb, index) => {
          thumb.hidden = index < this.start || index >= this.start + this.visible;
        });
        if (this.prev) this.prev.disabled = this.start === 0;
        if (this.next) this.next.disabled = this.start >= this.thumbs.length - this.visible;
      }
    }
  );
}

if (!customElements.get('recipe-detail')) {
  customElements.define(
    'recipe-detail',
    class RecipeDetail extends HTMLElement {
      connectedCallback() {
        const handle = new URLSearchParams(window.location.search).get('recipe') || '';
        const recipe = handle ? this.querySelector(`[data-recipe="${CSS.escape(handle)}"]`) : null;
        if (recipe) {
          recipe.hidden = false;
          const title = recipe.querySelector('.recipe-detail__title');
          if (title) document.title = `${title.textContent.trim()} – ${document.title}`;
        } else {
          this.querySelector('[data-recipe-missing]').hidden = false;
        }

        this.addEventListener('click', (event) => {
          const button = event.target.closest('[data-add-variant]');
          if (!button) return;
          event.preventDefault();
          this.addToCart(button);
        });
      }

      // Adds through the cart drawer so it redraws, then opens it. Falls back to the product link.
      addToCart(button) {
        const drawer = document.querySelector('cart-drawer');
        if (!drawer) {
          window.location.href = button.href;
          return;
        }
        button.classList.add('is-loading');
        drawer
          .requestCart(routes.cart_add_url, { items: [{ id: Number(button.dataset.addVariant), quantity: 1 }] })
          .then(() => drawer.open(button))
          .finally(() => button.classList.remove('is-loading'));
      }
    }
  );
}
