if (!customElements.get('home-reviews-carousel')) {
  const VOTES_KEY = 'bundle-reviews:votes';
  const ICONS = {
    verified:
      '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><circle cx="6" cy="6" r="6" fill="currentColor"/><path d="M3.4 6.2l1.8 1.8 3.5-3.6" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M0 5h2.2v6.5H0zM3.2 11.5h5.6c.6 0 1.1-.4 1.2-1l.9-4c.2-.8-.4-1.5-1.2-1.5H7.2l.4-2.3C7.7 2 7.3 1.4 6.7 1.3L3.2 5.3v6.2z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M12 7h-2.2V.5H12zM8.8.5H3.2c-.6 0-1.1.4-1.2 1l-.9 4c-.2.8.4 1.5 1.2 1.5h2.5l-.4 2.3c-.1.7.3 1.3.9 1.4l3.5-4V.5z" fill="currentColor"/></svg>',
  };
  const STAR =
    'M9.944 6.4L8 0L6.056 6.4H0L4.944 9.928L3.064 16L8 12.248L12.944 16L11.064 9.928L16 6.4H9.944Z';

  customElements.define(
    'home-reviews-carousel',
    class HomeReviewsCarousel extends HTMLElement {
      connectedCallback() {
        this.viewport = this.querySelector('[data-viewport]');
        this.track = this.querySelector('[data-track]');
        const data = JSON.parse(this.querySelector('[data-reviews]').textContent || '[]');
        this.votes = this.readVotes();
        this.reviews = data
          .filter((review) => review.body)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, Number(this.dataset.limit) || 25);
        this.track.innerHTML = this.reviews.map((review) => this.cardMarkup(review)).join('');

        this.querySelector('[data-prev]').addEventListener('click', () => this.step(-1));
        this.querySelector('[data-next]').addEventListener('click', () => this.step(1));
        this.track.addEventListener('click', (event) => this.onVote(event));
        this.track.addEventListener('click', (event) => {
          const more = event.target.closest('[data-more]');
          if (!more) return;
          const card = more.closest('.home-review');
          card.classList.add('is-expanded');
          card.classList.remove('is-clamped');
        });

        // Show "Read more" only on reviews whose text is cut off.
        this.resizeObserver = new ResizeObserver(() => this.markClamped());
        this.resizeObserver.observe(this.viewport);
      }

      disconnectedCallback() {
        this.resizeObserver?.disconnect();
      }

      markClamped() {
        this.track.querySelectorAll('.home-review:not(.is-expanded)').forEach((card) => {
          const body = card.querySelector('.home-review__body');
          card.classList.toggle('is-clamped', body.scrollHeight > body.clientHeight + 1);
        });
      }

      step(direction) {
        const card = this.track.firstElementChild;
        if (!card) return;
        const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
        const size = card.offsetWidth + gap;
        const max = this.viewport.scrollWidth - this.viewport.clientWidth;
        let target = this.viewport.scrollLeft + direction * size;
        if (target > max + 2) target = 0;
        else if (target < -2) target = max;
        this.viewport.scrollTo({ left: target, behavior: 'smooth' });
      }

      stars(rating) {
        const fill = Math.max(0, Math.min(100, (rating / 5) * 100));
        const paths = [0, 1, 2, 3, 4]
          .map((i) => `<path transform="translate(${(i * 18.6667).toFixed(4)} 0)" d="${STAR}"/>`)
          .join('');
        const svg = `<svg viewBox="0 0 90.667 16" focusable="false">${paths}</svg>`;
        return `<span class="home-review__stars" role="img" aria-label="Rated ${rating} out of 5 stars"><span class="home-review__stars-layer">${svg}</span><span class="home-review__stars-layer home-review__stars-layer--fill" style="width: ${fill}%">${svg}</span></span>`;
      }

      cardMarkup(review) {
        const e = (value) => this.escape(value);
        const product = review.product
          ? `<div class="home-review__product">
              ${review.image ? `<a href="${e(review.url)}" class="home-review__thumb"><img src="${e(review.image)}" alt="${e(review.product)}" width="48" height="48" loading="lazy"></a>` : ''}
              <div><div class="home-review__product-label">Reviewing</div><a href="${e(review.url)}" class="home-review__product-name">${e(review.product)}</a></div>
            </div>`
          : '';
        return `<article class="home-review" role="listitem">
            <div class="home-review__main">
              <div class="home-review__top">${this.stars(review.rating)}<span class="home-review__date">${this.timeAgo(review.date)}</span></div>
              ${review.title ? `<div class="home-review__title">${e(review.title)}</div>` : ''}
              <p class="home-review__body">${e(review.body)}</p>
              <button type="button" class="home-review__more" data-more>Read more</button>
            </div>
            <div class="home-review__foot">
              <div class="home-review__author"><strong>${e(review.author)}</strong>${review.verified ? `<span class="home-review__verified">Verified Buyer ${ICONS.verified}</span>` : ''}</div>
              ${product}
              <div class="home-review__helpful" data-helpful="${e(review.id)}">${this.helpfulMarkup(review)}</div>
            </div>
          </article>`;
      }

      helpfulMarkup(review) {
        const vote = this.votes[review.id];
        const button = (type, icon, label) =>
          `<button type="button" class="home-review__vote${vote === type ? ' is-voted' : ''}" data-vote="${type}" aria-label="${label}" aria-pressed="${vote === type}">${icon}<span>${review[type] + (vote === type ? 1 : 0)}</span></button>`;
        return `<span>Was this helpful?</span>${button('helpful', ICONS.up, 'Yes, this was helpful')}${button('unhelpful', ICONS.down, 'No, this was not helpful')}`;
      }

      onVote(event) {
        const button = event.target.closest('[data-vote]');
        if (!button) return;
        const holder = button.closest('[data-helpful]');
        const review = this.reviews.find((item) => item.id === holder.dataset.helpful);
        if (!review) return;
        const type = button.dataset.vote;
        this.votes[review.id] = this.votes[review.id] === type ? undefined : type;
        try {
          localStorage.setItem(VOTES_KEY, JSON.stringify(this.votes));
        } catch (error) {
          // Votes still show for this visit when storage is unavailable.
        }
        holder.innerHTML = this.helpfulMarkup(review);
      }

      readVotes() {
        try {
          return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
        } catch (error) {
          return {};
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
