if (!customElements.get('bundle-carousel')) {
  customElements.define(
    'bundle-carousel',
    class BundleCarousel extends HTMLElement {
      connectedCallback() {
        this.viewport = this.querySelector('[data-carousel-viewport]');
        this.track = this.querySelector('[data-carousel-track]');
        this.originals = [...this.track.querySelectorAll('[data-carousel-slide]')];
        this.count = this.originals.length;
        if (this.count < 2 || this.initialized) return;
        this.initialized = true;

        this.speed = parseInt(this.dataset.speed, 10) || 1600;
        this.delay = parseInt(this.dataset.delay, 10) || 3000;
        this.autoplay =
          this.dataset.autoplay === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // A full set of clones on each side lets the strip loop in both directions.
        const clone = (slide) => {
          const copy = slide.cloneNode(true);
          copy.removeAttribute('data-carousel-slide');
          copy.removeAttribute('id');
          copy.setAttribute('aria-hidden', 'true');
          copy.inert = true;
          return copy;
        };
        this.track.prepend(...this.originals.map(clone));
        this.track.append(...this.originals.map(clone));
        this.index = this.count;

        this.track.addEventListener('transitionend', (event) => {
          if (event.target === this.track) this.onTransitionEnd();
        });
        this.viewport.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        this.viewport.addEventListener('click', (event) => {
          if (this.dragged) event.preventDefault();
        }, true);
        document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.schedule()));

        this.resizeObserver = new ResizeObserver(() => this.layout());
        this.resizeObserver.observe(this.viewport);
        this.layout();
        this.schedule();
      }

      disconnectedCallback() {
        this.stop();
        this.resizeObserver?.disconnect();
      }

      layout() {
        const slide = this.track.children[0];
        const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
        this.step = slide.getBoundingClientRect().width + gap;
        this.setPosition(this.index, false);
      }

      setPosition(position, animate) {
        this.track.style.transitionDuration = animate ? `${this.speed}ms` : '0ms';
        this.track.style.transform = `translate3d(${-position * this.step}px, 0, 0)`;
      }

      goTo(index) {
        this.index = index;
        this.moving = true;
        this.setPosition(index, true);
      }

      // Jumps back into the original set without animation once a clone is showing.
      onTransitionEnd() {
        this.moving = false;
        if (this.index >= this.count * 2) this.index -= this.count;
        if (this.index < this.count) this.index += this.count;
        this.setPosition(this.index, false);
        this.schedule();
      }

      schedule() {
        this.stop();
        if (!this.autoplay || document.hidden) return;
        this.timer = setTimeout(() => this.goTo(this.index + 1), this.delay);
      }

      stop() {
        clearTimeout(this.timer);
      }

      currentPosition() {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(this.track).transform);
        return -matrix.m41 / this.step;
      }

      onPointerDown(event) {
        if (event.button !== 0) return;
        this.stop();
        this.dragged = false;
        const startX = event.clientX;
        const startPosition = this.currentPosition();
        this.setPosition(startPosition, false);

        const onMove = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          if (Math.abs(delta) > 5) this.dragged = true;
          this.setPosition(startPosition - delta / this.step, false);
        };
        const onUp = (upEvent) => {
          this.viewport.removeEventListener('pointermove', onMove);
          this.viewport.removeEventListener('pointerup', onUp);
          this.viewport.removeEventListener('pointercancel', onUp);
          const delta = upEvent.clientX - startX;
          let target = Math.round(startPosition - delta / this.step);
          if (delta < -50) target = Math.max(target, Math.floor(startPosition) + 1);
          if (delta > 50) target = Math.min(target, Math.ceil(startPosition) - 1);
          if (Math.abs(target * this.step - this.currentPosition() * this.step) < 1) {
            this.index = target;
            this.onTransitionEnd();
          } else {
            this.goTo(target);
          }
        };

        this.viewport.setPointerCapture(event.pointerId);
        this.viewport.addEventListener('pointermove', onMove);
        this.viewport.addEventListener('pointerup', onUp);
        this.viewport.addEventListener('pointercancel', onUp);
      }
    }
  );
}
