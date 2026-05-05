#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-.}"
DRY_RUN="${DRY_RUN:-0}"

if [ ! -d "$TARGET" ]; then
  echo "ERROR: '$TARGET' is not a directory." >&2
  exit 1
fi

has_bin() { command -v "$1" >/dev/null 2>&1; }
if ! has_bin perl; then
  echo "ERROR: perl is required." >&2
  exit 1
fi

declare -A MAP=(
  ["ext-card"]="degoog-panel"
  ["sidebar-panel"]="degoog-panel"
  ["results-slot-panel"]="degoog-panel"

  ["tools-dropdown"]="degoog-dropdown"
  ["tools-submenu"]="degoog-dropdown"
  ["result-actions-menu"]="degoog-dropdown"

  ["search-bar"]="degoog-search-bar"
  ["results-search-bar"]="degoog-search-bar"
  ["settings-nav-search"]="degoog-search-bar"

  ["store-input-url"]="degoog-input"
  ["ext-field-input"]="degoog-input"
  ["ext-field-urllist-input"]="degoog-input"
  ["settings-rate-limit-input"]="degoog-input"
  ["settings-proxy-urls"]="degoog-input"
  ["settings-score-domain"]="degoog-input"
  ["settings-score-value"]="degoog-input"
  ["store-search-input"]="degoog-input"
  ["tools-date-input"]="degoog-input"
  ["tools-lang-filter"]="degoog-input"

  ["theme-select-wrap"]="degoog-select-wrap"
  ["settings-nav-mobile"]="degoog-select-wrap"
  ["ext-field-select-wrap"]="degoog-select-wrap"

  ["settings-toggle-wrap"]="degoog-toggle-wrap"
  ["engine-toggle"]="degoog-toggle-wrap"

  ["toggle-slider"]="degoog-toggle"

  ["sidebar-accordion-toggle"]="degoog-accordion-toggle"
  ["store-updates-toggle"]="degoog-accordion-toggle"

  ["results-tab"]="degoog-tab"
  ["tools-toggle"]="degoog-tab"

  ["tools-menu-item"]="degoog-menu-item"
  ["tools-option"]="degoog-menu-item"
  ["result-actions-item"]="degoog-menu-item"

  ["result-engine-tag"]="degoog-badge"
  ["store-type-badge"]="degoog-badge"
  ["store-subtype-badge"]="degoog-badge"
  ["glance-ai-badge"]="degoog-badge"

  ["search-submit-btn"]="degoog-icon-btn"
  ["settings-gear"]="degoog-icon-btn"
  ["img-lightbox-close"]="degoog-icon-btn"
  ["ext-modal-close"]="degoog-icon-btn"
  ["media-preview-close"]="degoog-icon-btn"
)

append_for_file() {
  local file="$1"
  local tmp="${file}.tmp.$$"

  cp "$file" "$tmp"

  for old in "${!MAP[@]}"; do
    local new="${MAP[$old]}"
    OLD_CLASS="$old" NEW_CLASS="$new" perl -0777 -i -pe '
      my $old = $ENV{OLD_CLASS};
      my $new = $ENV{NEW_CLASS};
      s/(class=(["'\''"]))(.*?)(\2)/$1 . _append($3, $old, $new) . $4/ge;
      sub _append {
        my ($v, $old, $new) = @_;
        my @c = grep { length } split(/\s+/, $v);
        my %seen; @c = grep { !$seen{$_}++ } @c;
        my %has = map { $_ => 1 } @c;
        if ($has{$old} && !$has{$new}) { push @c, $new; }
        return join(" ", @c);
      }
    ' -- "$tmp"
  done

  if ! cmp -s "$file" "$tmp"; then
    if [ "$DRY_RUN" = "1" ]; then
      echo "would-update: ${file#$TARGET/}"
      rm -f "$tmp"
    else
      mv "$tmp" "$file"
      echo "updated: ${file#$TARGET/}"
    fi
  else
    rm -f "$tmp"
  fi
}

export -f append_for_file
export TARGET DRY_RUN

while IFS= read -r -d '' file; do
  append_for_file "$file"
done < <(find "$TARGET" \
  -not \( -path "*/node_modules/*" -o -path "*/stores/*" -o -path "*/.git/*" \) \
  \( -name "*.html" -o -name "*.htm" \) \
  -print0)

