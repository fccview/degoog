const _skeletonCard = (): string =>
  `<div class="skeleton-card">
    <div class="skeleton-line skeleton-line--url"></div>
    <div class="skeleton-line skeleton-line--title"></div>
    <div class="skeleton-line skeleton-line--snippet"></div>
    <div class="skeleton-line skeleton-line--snippet-short"></div>
  </div>`;

export const skeletonResults = (count = 5): string =>
  `<div class="skeleton-results">${Array.from({ length: count }, _skeletonCard).join("")}</div>`;

export const skeletonGlance = (): string =>
  `<div class="glance-box">
    <div class="skeleton-glance">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="skeleton-line skeleton-line--snippet"></div>
      <div class="skeleton-line skeleton-line--snippet"></div>
      <div class="skeleton-line skeleton-line--snippet-short"></div>
    </div>
  </div>`;

export const skeletonFeedCards = (count = 4): string =>
  `<div class="skeleton-feed" aria-hidden="true">${Array.from(
    { length: count },
    () => `
    <div class="skeleton-feed-card">
      <div class="skeleton-feed-image"></div>
      <div class="skeleton-feed-body">
        <div class="skeleton-feed-line skeleton-feed-source"></div>
        <div class="skeleton-feed-line skeleton-feed-title"></div>
      </div>
    </div>`,
  ).join("")}</div>`;
