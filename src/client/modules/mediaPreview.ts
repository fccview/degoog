import { closeMediaPreview } from "./media";

export function initMediaPreview(): void {
  document.getElementById("media-preview-close")?.addEventListener("click", closeMediaPreview);
}
