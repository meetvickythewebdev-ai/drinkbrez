if (!customElements.get('recipe-list')) {
  customElements.define(
    'recipe-list',
    class RecipeList extends HTMLElement {
      connectedCallback() {
        // Liquid returns recipes alphabetically, so the position field is applied here.
        this.cards = [...this.querySelectorAll('.recipe-card')].sort((a, b) => a.dataset.position - b.dataset.position);
        this.querySelector('.recipe-list__grid').append(...this.cards);
        this.pagination = this.querySelector('[data-recipe-pagination]');
        this.empty = this.querySelector('[data-recipe-empty]');
        this.perPage = parseInt(this.dataset.perPage, 10) || this.cards.length || 1;
        this.page = 1;
        this.flavors = new Set();
        this.categories = new Set();
        this.query = '';

        this.addEventListener('click', (event) => this.onClick(event));
        this.querySelector('[data-recipe-search]')?.addEventListener('input', (event) => {
          this.query = event.target.value.trim().toLowerCase();
          this.update(1);
        });
        this.update(1);
      }

      onClick(event) {
        const flavor = event.target.closest('[data-flavor]');
        const category = event.target.closest('[data-category]');
        const pageButton = event.target.closest('[data-page]');
        if (flavor) this.toggle(this.flavors, flavor, flavor.dataset.flavor);
        if (category) this.toggle(this.categories, category, category.dataset.category);
        if (pageButton) {
          this.update(Number(pageButton.dataset.page));
          this.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      toggle(set, button, value) {
        const active = !set.has(value);
        if (active) set.add(value);
        else set.delete(value);
        button.setAttribute('aria-pressed', active);
        button.blur();
        this.update(1);
      }

      matches(card) {
        const categories = JSON.parse(card.dataset.categories || 'null') || [];
        const flavors = JSON.parse(card.dataset.flavors || 'null') || [];
        if (this.query && !card.dataset.title.includes(this.query)) return false;
        if (this.categories.size && !categories.some((category) => this.categories.has(category))) return false;
        if (this.flavors.size && !flavors.some((flavor) => this.flavors.has(flavor))) return false;
        return true;
      }

      update(page) {
        const matched = this.cards.filter((card) => this.matches(card));
        const totalPages = Math.max(1, Math.ceil(matched.length / this.perPage));
        this.page = Math.min(Math.max(page, 1), totalPages);
        const start = (this.page - 1) * this.perPage;
        const visible = new Set(matched.slice(start, start + this.perPage));
        this.cards.forEach((card) => {
          card.hidden = !visible.has(card);
        });
        this.empty.hidden = matched.length > 0;
        this.renderPagination(totalPages);
      }

      renderPagination(totalPages) {
        this.pagination.hidden = totalPages < 2;
        this.pagination.replaceChildren();
        if (totalPages < 2) return;
        const button = (label, page, options = {}) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = 'recipe-pagination__button';
          element.textContent = label;
          element.dataset.page = page;
          element.disabled = Boolean(options.disabled);
          if (options.label) element.setAttribute('aria-label', options.label);
          if (options.current) {
            element.classList.add('is-active');
            element.setAttribute('aria-current', 'page');
          }
          return element;
        };
        this.pagination.append(button('‹', this.page - 1, { disabled: this.page === 1, label: 'Previous page' }));
        for (let page = 1; page <= totalPages; page += 1) {
          this.pagination.append(button(page, page, { current: page === this.page }));
        }
        this.pagination.append(button('›', this.page + 1, { disabled: this.page === totalPages, label: 'Next page' }));
      }
    }
  );
}
