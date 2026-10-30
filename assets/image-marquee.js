if (!customElements.get('image-marquee')) {
  customElements.define(
    'image-marquee',
    class ImageMarquee extends HTMLElement {
      connectedCallback() {
        this.viewport = this.querySelector('[data-marquee-viewport]');
        this.track = this.querySelector('[data-marquee-track]');
        if (!this.viewport || !this.track || this.initialized) return;
        this.initialized = true;

        this.speed = parseInt(this.dataset.speed, 10) || 0;
        this.loopWidth = this.track.scrollWidth;
        [...this.track.children].forEach((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          this.track.append(clone);
        });
        this.position = 0;

        this.viewport.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        // A drag shouldn't also follow the card's link.
        this.viewport.addEventListener('click', (event) => {
          if (this.dragged) event.preventDefault();
        }, true);
        if (this.speed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.frame = requestAnimationFrame((time) => this.step(time));
        }
      }

      disconnectedCallback() {
        cancelAnimationFrame(this.frame);
      }

      // Position is kept as a float because scrollLeft rounds away sub-pixel steps in Safari.
      step(time) {
        const elapsed = this.lastTime ? time - this.lastTime : 0;
        this.lastTime = time;
        if (!this.dragging) {
          this.position += (this.speed * elapsed) / 1000;
          if (this.position >= this.loopWidth) this.position -= this.loopWidth;
          this.viewport.scrollLeft = this.position;
        }
        this.frame = requestAnimationFrame((next) => this.step(next));
      }

      onPointerDown(event) {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        event.preventDefault();
        this.dragging = true;
        this.dragged = false;
        this.viewport.classList.add('is-dragging');
        const startX = event.clientX;
        const startScroll = this.viewport.scrollLeft;

        const onMove = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          if (Math.abs(delta) > 5) this.dragged = true;
          this.viewport.scrollLeft = startScroll - delta;
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          this.position = this.viewport.scrollLeft;
          this.dragging = false;
          this.viewport.classList.remove('is-dragging');
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }
    }
  );
}
