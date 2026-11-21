export const CAMERA_FILTERS = [
  { label: "Normal", css: "none", overlay: null },
  { label: "B&W Classic", css: "grayscale(100%) contrast(115%)", overlay: null },
  { label: "Vintage Warm", css: "sepia(65%) contrast(105%) brightness(102%)", overlay: null },
  { label: "Vivid Pop", css: "saturate(135%) brightness(105%)", overlay: null },
  { label: "Cool Cyan", css: "hue-rotate(15deg) saturate(110%) brightness(103%)", overlay: null },
  { label: "Soft Dreamy", css: "brightness(108%) contrast(92%) saturate(90%)", overlay: null }
  // Kung may PNG overlay ka (hal. Shrek), idagdag dito:
  // { label: "Shrek Frame", css: "none", overlay: "images/shrek.png" }
];

export function setupFilters(selectElement, videoElement, overlayImgElement) {
  if (!selectElement) return;

  selectElement.innerHTML = "";
  CAMERA_FILTERS.forEach((f, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = f.label;
    selectElement.appendChild(opt);
  });

  selectElement.addEventListener("change", () => {
    const selected = getActiveFilterObj(selectElement);
    if (videoElement) {
      videoElement.style.filter = selected.css;
    }
    if (overlayImgElement) {
      if (selected.overlay) {
        overlayImgElement.src = selected.overlay;
        overlayImgElement.hidden = false;
      } else {
        overlayImgElement.hidden = true;
        overlayImgElement.src = "";
      }
    }
  });
}

export function getActiveFilterObj(selectElement) {
  const idx = selectElement ? Number(selectElement.value) || 0 : 0;
  return CAMERA_FILTERS[idx] || CAMERA_FILTERS[0];
}