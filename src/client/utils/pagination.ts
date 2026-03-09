export const buildPaginationHtml = (
  totalPages: number,
  activePage: number,
): string => {
  const maxVisible = 10;
  let startPage = Math.max(1, activePage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  let html = '<div class="pagination-pages">';
  for (let i = startPage; i <= endPage; i++) {
    if (i === activePage) {
      html += `<span class="pagination-current">${i}</span>`;
    } else {
      html += `<a class="pagination-link" data-page="${i}">${i}</a>`;
    }
  }
  html += "</div>";
  return html;
};
