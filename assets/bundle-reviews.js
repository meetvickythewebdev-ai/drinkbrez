if (!customElements.get('bundle-reviews')) {
  const STAR_PATH = 'M9.944 6.4L8 0L6.056 6.4H0L4.944 9.928L3.064 16L8 12.248L12.944 16L11.064 9.928L16 6.4H9.944Z';
  const ICONS = {
    verified:
      '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="6" fill="currentColor"/><path d="M3.4 6.2l1.8 1.8 3.5-3.6" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    recommend:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="8" fill="#262626"/><path d="M4.6 7.4h1.5v4.2H4.6zM7 11.6h3.5c.5 0 .9-.3 1-.8l.6-2.6c.1-.6-.3-1.1-.9-1.1H9.1l.3-1.5c.1-.5-.2-1-.7-1.1L7 7.2v4.4z" fill="#fff"/></svg>',
    up: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M0 5h2.2v6.5H0zM3.2 11.5h5.6c.6 0 1.1-.4 1.2-1l.9-4c.2-.8-.4-1.5-1.2-1.5H7.2l.4-2.3C7.7 2 7.3 1.4 6.7 1.3L3.2 5.3v6.2z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M12 7h-2.2V.5H12zM8.8.5H3.2c-.6 0-1.1.4-1.2 1l-.9 4c-.2.8.4 1.5 1.2 1.5h2.5l-.4 2.3c-.1.7.3 1.3.9 1.4l3.5-4V.5z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 14 16" aria-hidden="true" focusable="false"><path d="M0 0l14 8-14 8z" fill="currentColor"/></svg>',
    google:
      '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="7" fill="#fff"/><path d="M11 7.1c0-.3 0-.6-.1-.9H7v1.7h2.3a2 2 0 0 1-.9 1.3v1.1h1.4c.8-.8 1.2-1.9 1.2-3.2z" fill="#4285F4"/><path d="M7 11.2c1.2 0 2.1-.4 2.8-1l-1.4-1.1c-.4.3-.8.4-1.4.4-1.1 0-2-.7-2.3-1.7H3.3v1.1A4.2 4.2 0 0 0 7 11.2z" fill="#34A853"/><path d="M4.7 7.8a2.5 2.5 0 0 1 0-1.6V5.1H3.3a4.2 4.2 0 0 0 0 3.8z" fill="#FBBC05"/><path d="M7 4.5c.6 0 1.2.2 1.6.6l1.2-1.2A4.2 4.2 0 0 0 3.3 5.1l1.4 1.1C5 5.2 5.9 4.5 7 4.5z" fill="#EA4335"/></svg>',
    facebook:
      '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="7" fill="#1877F2"/><path d="M7.7 11.2V7.6h1.2l.2-1.4H7.7v-.9c0-.4.1-.7.7-.7h.7V3.4l-1-.1c-1.1 0-1.8.7-1.8 1.9v1H5.1v1.4h1.2v3.6z" fill="#fff"/></svg>',
  };
  const VOTES_KEY = 'bundle-reviews:votes';

  customElements.define(
    'bundle-reviews',
    class BundleReviews extends HTMLElement {
      connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;

        try {
          this.reviews = JSON.parse(this.querySelector('[data-reviews-data]').textContent);
        } catch (error) {
          this.reviews = [];
        }
        this.perPage = parseInt(this.dataset.perPage, 10) || 5;
        this.shown = this.perPage;
        this.sort = 'date-desc';
        this.votes = this.loadVotes();

        this.list = this.querySelector('[data-reviews-list]');
        this.more = this.querySelector('[data-reviews-more]');
        this.modal = this.querySelector('[data-reviews-modal]');
        this.stage = this.querySelector('[data-gallery-stage]');
        this.galleryReview = this.querySelector('[data-gallery-review]');
        this.track = this.querySelector('[data-gallery-track]');

        // Every photo and video, newest review first, drives both the strip and the gallery.
        this.gallery = this.sorted('date-desc').flatMap((review) =>
          review.media.map((media, index) => ({ review, media, index }))
        );

        this.querySelector('[data-reviews-sort]').addEventListener('change', (event) => {
          this.sort = event.target.value;
          this.shown = this.perPage;
          this.renderList();
        });
        this.more.addEventListener('click', () => {
          this.shown += this.perPage;
          this.renderList();
        });
        this.addEventListener('click', (event) => this.onClick(event));
        this.querySelector('[data-reviews-close]').addEventListener('click', () => this.closeGallery());
        this.modal.addEventListener('click', (event) => {
          if (event.target === this.modal) this.closeGallery();
        });
        this.querySelector('[data-gallery-prev]').addEventListener('click', () => this.showSlide(this.current - 1));
        this.querySelector('[data-gallery-next]').addEventListener('click', () => this.showSlide(this.current + 1));
        this.modal.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') this.closeGallery();
          if (event.key === 'ArrowLeft') this.showSlide(this.current - 1);
          if (event.key === 'ArrowRight') this.showSlide(this.current + 1);
        });

        this.renderStrip();
        this.renderList();
      }

      sorted(order) {
        const byDate = (a, b) => new Date(b.date) - new Date(a.date);
        const compare = {
          'date-desc': byDate,
          'date-asc': (a, b) => -byDate(a, b),
          'helpful-desc': (a, b) => b.helpful - a.helpful || byDate(a, b),
          'media-desc': (a, b) => (b.media.length > 0) - (a.media.length > 0) || byDate(a, b),
          'rating-desc': (a, b) => b.rating - a.rating || byDate(a, b),
          'rating-asc': (a, b) => a.rating - b.rating || byDate(a, b),
          'unhelpful-desc': (a, b) => b.unhelpful - a.unhelpful || byDate(a, b),
        }[order];
        return [...this.reviews].sort(compare);
      }

      renderStrip() {
        const strip = this.querySelector('[data-reviews-strip]');
        strip.innerHTML = this.gallery
          .slice(0, 5)
          .map((item, index) => `<li>${this.mediaButton(item.media, index)}</li>`)
          .join('');
      }

      renderList() {
        const reviews = this.sorted(this.sort);
        this.list.innerHTML = reviews
          .slice(0, this.shown)
          .map((review) => `<li class="bundle-reviews__item">${this.reviewMarkup(review)}</li>`)
          .join('');
        this.more.hidden = this.shown >= reviews.length;
      }

      reviewMarkup(review) {
        const media = review.media
          .map((item, index) => {
            const galleryIndex = this.gallery.findIndex((entry) => entry.review === review && entry.index === index);
            return `<li>${this.mediaButton(item, galleryIndex)}</li>`;
          })
          .join('');

        return `
          <article class="bundle-review">
            <div class="bundle-review__side">
              ${this.reviewerMarkup(review)}
              ${this.productMarkup(review)}
              <div class="bundle-review__recommend">${review.recommended ? ICONS.recommend : ''}<span>${
                review.recommended ? 'I recommend this product' : 'I do not recommend this product'
              }</span></div>
            </div>
            <div class="bundle-review__main">
              ${this.contentMarkup(review)}
              ${media ? `<ul class="bundle-review__media" role="list">${media}</ul>` : ''}
              <div class="bundle-review__footer">${this.helpfulMarkup(review)}</div>
            </div>
          </article>`;
      }

      reviewerMarkup(review) {
        const initials = (review.author || '')
          .split(/\s+/)
          .map((part) => part.charAt(0))
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return `
          <div class="bundle-reviewer">
            <div class="bundle-reviewer__avatar">
              <strong class="bundle-reviewer__initials">${this.escape(initials)}</strong>
              ${review.avatar ? `<img class="bundle-reviewer__photo" src="${review.avatar}" alt="" loading="lazy" width="48" height="48">` : ''}
              ${review.avatar && ICONS[review.social] ? `<span class="bundle-reviewer__social">${ICONS[review.social]}</span>` : ''}
            </div>
            <div class="bundle-reviewer__details">
              <strong class="bundle-reviewer__name">${this.escape(review.author)}</strong>
              ${review.verified ? `<span class="bundle-reviewer__verified">Verified Buyer ${ICONS.verified}</span>` : ''}
            </div>
          </div>`;
      }

      productMarkup(review) {
        const product = review.product;
        if (!product) return '';
        const open = product.url ? `<a href="${product.url}"` : '<span';
        const close = product.url ? '</a>' : '</span>';
        return `
          <div class="bundle-review__product">
            ${
              product.image
                ? `${open} class="bundle-review__product-thumb" tabindex="-1"><img src="${product.image}" alt="${this.escape(
                    product.title
                  )}" loading="lazy" width="55" height="55">${close}`
                : ''
            }
            <div class="bundle-review__product-details">
              <span class="bundle-review__product-label">Reviewing</span>
              ${open} class="bundle-review__product-name">${this.escape(product.title)}${close}
            </div>
          </div>`;
      }

      contentMarkup(review) {
        return `
          <div class="bundle-review__top">
            ${this.starsMarkup(review.rating)}
            <span class="visually-hidden">Rated ${review.rating} out of 5 stars</span>
            <span class="bundle-review__date">${this.timeAgo(review.date)}</span>
          </div>
          ${review.title ? `<h3 class="bundle-review__title">${this.escape(review.title)}</h3>` : ''}
          <p class="bundle-review__body">${this.escape((review.body || '').trim())}</p>
          ${
            review.reply
              ? `<div class="bundle-review__reply"><strong>Reply from BRĒZ</strong>${this.escape(review.reply)}</div>`
              : ''
          }`;
      }

      helpfulMarkup(review) {
        const vote = this.votes[review.id];
        const count = (type) => review[type] + (vote === type ? 1 : 0);
        const button = (type, icon, label) =>
          `<button type="button" class="bundle-helpful__vote${vote === type ? ' is-voted' : ''}" data-vote="${type}" data-review="${
            review.id
          }" aria-label="${label}"${vote ? ' disabled' : ''}>${icon}<span>${count(type)}</span></button>`;
        return `
          <div class="bundle-helpful">
            <span class="bundle-helpful__label">Was this helpful?</span>
            ${button('helpful', ICONS.up, 'Yes, this was helpful')}
            ${button('unhelpful', ICONS.down, 'No, this was not helpful')}
          </div>`;
      }

      starsMarkup(rating) {
        const paths = [0, 1, 2, 3, 4]
          .map((index) => `<path transform="translate(${index * 18.6667} 0)" d="${STAR_PATH}"/>`)
          .join('');
        const svg = `<svg viewBox="0 0 90.667 16" focusable="false">${paths}</svg>`;
        const fill = Math.max(0, Math.min(100, (rating / 5) * 100));
        return `<span class="bundle-stars" aria-hidden="true"><span class="bundle-stars__layer">${svg}</span><span class="bundle-stars__layer bundle-stars__layer--fill" style="width: ${fill}%">${svg}</span></span>`;
      }

      mediaButton(media, galleryIndex) {
        const thumb = media.thumb || '';
        return `<button type="button" class="bundle-reviews__media-button" data-gallery-open="${galleryIndex}" aria-label="Open media">
          ${thumb ? `<img src="${thumb}" alt="${this.escape(media.alt || '')}" loading="lazy">` : ''}
          ${media.type === 'video' ? `<span class="bundle-reviews__play">${ICONS.play}</span>` : ''}
        </button>`;
      }

      onClick(event) {
        const open = event.target.closest('[data-gallery-open]');
        if (open) {
          this.openGallery(parseInt(open.dataset.galleryOpen, 10), open);
          return;
        }
        const vote = event.target.closest('[data-vote]');
        if (vote) this.vote(vote.dataset.review, vote.dataset.vote);
      }

      // Votes are remembered in this browser; the counts come from the imported reviews.
      vote(id, type) {
        if (this.votes[id]) return;
        this.votes[id] = type;
        try {
          localStorage.setItem(VOTES_KEY, JSON.stringify(this.votes));
        } catch (error) {
          // Storage unavailable; the vote still shows for this visit.
        }
        const review = this.reviews.find((entry) => entry.id === id);
        this.querySelectorAll(`[data-review="${CSS.escape(id)}"]`).forEach((button) => {
          button.closest('.bundle-review__footer').innerHTML = this.helpfulMarkup(review);
        });
      }

      loadVotes() {
        try {
          return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
        } catch (error) {
          return {};
        }
      }

      openGallery(index, trigger) {
        if (!this.gallery.length || Number.isNaN(index) || index < 0) return;
        this.trigger = trigger;
        this.track.innerHTML = this.gallery
          .map(
            (item, i) =>
              `<li><button type="button" class="bundle-reviews__gallery-thumb" data-gallery-thumb="${i}" aria-label="Show media ${
                i + 1
              }">${item.media.thumb ? `<img src="${item.media.thumb}" alt="" loading="lazy">` : ''}</button></li>`
          )
          .join('');
        this.track.onclick = (event) => {
          const thumb = event.target.closest('[data-gallery-thumb]');
          if (thumb) this.showSlide(parseInt(thumb.dataset.galleryThumb, 10));
        };
        this.modal.hidden = false;
        document.body.classList.add('overflow-hidden');
        this.showSlide(index);
        this.modal.querySelector('[role="dialog"]').focus();
      }

      closeGallery() {
        this.modal.hidden = true;
        this.stage.innerHTML = '';
        document.body.classList.remove('overflow-hidden');
        this.trigger?.focus();
      }

      showSlide(index) {
        const count = this.gallery.length;
        this.current = (index + count) % count;
        const { review, media } = this.gallery[this.current];

        this.stage.innerHTML =
          media.type === 'video'
            ? `<video src="${media.src}" ${media.thumb ? `poster="${media.thumb}"` : ''} controls autoplay muted playsinline></video>`
            : `<img src="${media.src}" alt="${this.escape(media.alt || '')}">`;

        this.galleryReview.innerHTML = `
          ${this.reviewerMarkup(review)}
          ${this.productMarkup(review)}
          ${this.contentMarkup(review)}
          ${review.variant ? `<div class="bundle-review__variant">${this.escape(review.variant)}</div>` : ''}
          <div class="bundle-review__footer">${this.helpfulMarkup(review)}</div>`;

        this.track.querySelectorAll('[data-gallery-thumb]').forEach((thumb, i) => {
          thumb.classList.toggle('is-selected', i === this.current);
        });
        const thumb = this.track.children[this.current];
        const viewport = this.track.parentElement;
        // The selected thumbnail always sits in the middle of the strip.
        if (thumb) {
          const offset = thumb.offsetLeft - (viewport.clientWidth - thumb.offsetWidth) / 2;
          this.track.style.transform = `translateX(${-offset}px)`;
        }
      }

      timeAgo(value) {
        const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
        const units = [
          ['year', 31536000],
          ['month', 2592000],
          ['week', 604800],
          ['day', 86400],
          ['hour', 3600],
          ['minute', 60],
        ];
        for (const [unit, size] of units) {
          const amount = Math.floor(seconds / size);
          if (amount >= 1) return `${amount} ${unit}${amount > 1 ? 's' : ''} ago`;
        }
        return 'just now';
      }

      escape(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML.replace(/"/g, '&quot;');
      }
    }
  );
}
