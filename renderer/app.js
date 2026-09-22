const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  form: $("#themeForm"),
  backgroundUrl: $("#backgroundUrl"),
  chooseFile: $("#chooseFile"),
  fit: $("#fit"),
  panelColor: $("#panelColor"),
  accent: $("#accent"),
  dim: $("#dim"),
  blur: $("#blur"),
  panelOpacity: $("#panelOpacity"),
  vignette: $("#vignette"),
  panelColorText: $("#panelColorText"),
  accentText: $("#accentText"),
  dimValue: $("#dimValue"),
  blurValue: $("#blurValue"),
  panelOpacityValue: $("#panelOpacityValue"),
  vignetteValue: $("#vignetteValue"),
  preview: $("#preview"),
  urlHint: $("#urlHint"),
  imageState: $("#imageState"),
  statusPill: $("#statusPill"),
  applyButton: $("#applyButton"),
  disableButton: $("#disableButton"),
  toast: $("#toast"),
};

let currentStatus = null;
let toastTimer = null;
let localImageName = null;
let initialized = false;
let saveTimer = null;
let lastValidatedUrl = null;

function hexToRgb(hex) {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ].join(", ");
}

function getTheme() {
  return {
    backgroundUrl: elements.backgroundUrl.value.trim(),
    fit: elements.fit.value,
    position: "center",
    panelColor: elements.panelColor.value,
    accent: elements.accent.value,
    dim: Number(elements.dim.value),
    blur: Number(elements.blur.value),
    panelOpacity: Number(elements.panelOpacity.value),
    vignette: Number(elements.vignette.value),
  };
}

function setTheme(theme) {
  elements.backgroundUrl.value = theme.backgroundUrl || "";
  elements.fit.value = theme.fit || "cover";
  elements.panelColor.value = theme.panelColor || "#111315";
  elements.accent.value = theme.accent || "#d7ff4f";
  elements.dim.value = theme.dim ?? 46;
  elements.blur.value = theme.blur ?? 0;
  elements.panelOpacity.value = theme.panelOpacity ?? 78;
  elements.vignette.value = theme.vignette ?? 35;
  $$("[data-fit]").forEach((button) => button.classList.toggle("is-active", button.dataset.fit === elements.fit.value));
  updatePreview();
}

function updateRange(range) {
  const minimum = Number(range.min || 0);
  const maximum = Number(range.max || 100);
  const progress = ((Number(range.value) - minimum) / (maximum - minimum)) * 100;
  range.style.setProperty("--progress", `${progress}%`);
}

function updatePreview() {
  const theme = getTheme();
  document.documentElement.style.setProperty("--accent", theme.accent);
  elements.preview.style.setProperty("--preview-image", theme.backgroundUrl ? `url(${JSON.stringify(theme.backgroundUrl)})` : "none");
  elements.preview.style.setProperty("--preview-dim", (theme.dim / 100).toFixed(2));
  elements.preview.style.setProperty("--preview-vignette", (theme.vignette / 100).toFixed(2));
  elements.preview.style.setProperty("--preview-blur", `${theme.blur}px`);
  elements.preview.style.setProperty("--preview-opacity", (theme.panelOpacity / 100).toFixed(2));
  elements.preview.style.setProperty("--preview-panel", hexToRgb(theme.panelColor));
  elements.preview.style.setProperty("--preview-fit", theme.fit === "stretch" ? "100% 100%" : theme.fit);

  elements.panelColorText.textContent = theme.panelColor.toUpperCase();
  elements.accentText.textContent = theme.accent.toUpperCase();
  elements.dimValue.textContent = `${theme.dim}%`;
  elements.blurValue.textContent = `${theme.blur}px`;
  elements.panelOpacityValue.textContent = `${theme.panelOpacity}%`;
  elements.vignetteValue.textContent = `${theme.vignette}%`;
  [elements.dim, elements.blur, elements.panelOpacity, elements.vignette].forEach(updateRange);

  if (theme.backgroundUrl !== lastValidatedUrl) {
    lastValidatedUrl = theme.backgroundUrl;
    validateImage(theme.backgroundUrl);
  }
}

let validationSequence = 0;
function validateImage(url) {
  const sequence = ++validationSequence;
  elements.urlHint.classList.remove("is-error");
  if (!url) {
    elements.imageState.textContent = "ADD AN IMAGE";
    return;
  }
  if (!url.startsWith("https://") && !url.startsWith("data:image/")) {
    elements.urlHint.textContent = "Use an HTTPS image link.";
    elements.urlHint.classList.add("is-error");
    elements.imageState.textContent = "LINK NEEDED";
    return;
  }

  elements.imageState.textContent = "LOADING…";
  const image = new Image();
  image.onload = () => {
    if (sequence !== validationSequence) return;
    elements.imageState.textContent = localImageName ? localImageName.toUpperCase() : "IMAGE READY";
    elements.urlHint.textContent = localImageName
      ? "Saved locally inside your Theme Studio settings."
      : "Direct HTTPS links work best. Local files stay on this PC.";
  };
  image.onerror = () => {
    if (sequence !== validationSequence) return;
    elements.imageState.textContent = "CHECK LINK";
    elements.urlHint.textContent = "That image did not load in the preview. Try a direct image link.";
    elements.urlHint.classList.add("is-error");
  };
  image.src = url;
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 4200);
}

function renderStatus(status) {
  currentStatus = status;
  elements.statusPill.className = "status-pill";
  const label = elements.statusPill.querySelector("span");

  if (status.connected) {
    elements.statusPill.classList.add("is-live");
    label.textContent = status.enabled ? "LIVE" : "CONNECTED";
    elements.applyButton.querySelector("span").textContent = "Apply live";
  } else if (status.running) {
    elements.statusPill.classList.add("is-off");
    label.textContent = "RESTART NEEDED";
    elements.applyButton.querySelector("span").textContent = "Restart ChatGPT + apply";
  } else if (status.installed) {
    elements.statusPill.classList.add("is-off");
    label.textContent = "READY";
    elements.applyButton.querySelector("span").textContent = "Open ChatGPT + apply";
  } else {
    elements.statusPill.classList.add("is-off");
    label.textContent = "APP NOT FOUND";
  }
}

async function refreshStatus() {
  try {
    renderStatus(await window.themeStudio.getStatus());
  } catch {
    // Leave the last known state visible.
  }
}

elements.form.addEventListener("input", () => {
  updatePreview();
  if (!initialized) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.themeStudio.save(getTheme()).catch(() => {}), 350);
});

elements.backgroundUrl.addEventListener("input", () => {
  localImageName = null;
});

$$("[data-fit]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.fit.value = button.dataset.fit;
    $$("[data-fit]").forEach((item) => item.classList.toggle("is-active", item === button));
    updatePreview();
  });
});

elements.chooseFile.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.chooseImage();
    if (!result) return;
    localImageName = result.name;
    elements.backgroundUrl.value = result.dataUrl;
    updatePreview();
  } catch (error) {
    showToast(error.message || "Couldn’t open that image.", true);
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!getTheme().backgroundUrl) {
    showToast("Add an image link or choose a local file first.", true);
    elements.backgroundUrl.focus();
    return;
  }

  elements.applyButton.disabled = true;
  try {
    const result = await window.themeStudio.activate(getTheme());
    if (result.cancelled) {
      showToast("No changes made.");
      return;
    }
    showToast(result.restarted ? "ChatGPT restarted with your theme." : "Theme applied. Looking clean.");
    await refreshStatus();
  } catch (error) {
    showToast(error.message || "Couldn’t apply the theme.", true);
  } finally {
    elements.applyButton.disabled = false;
  }
});

elements.disableButton.addEventListener("click", async () => {
  try {
    await window.themeStudio.disable();
    showToast(currentStatus?.connected ? "Custom background removed." : "Theme disabled for the next launch.");
    await refreshStatus();
  } catch (error) {
    showToast(error.message || "Couldn’t disable the theme.", true);
  }
});

async function initialize() {
  try {
    const { theme } = await window.themeStudio.getState();
    setTheme(theme);
    initialized = true;
    await refreshStatus();
  } catch (error) {
    showToast(error.message || "Theme Studio couldn’t initialize.", true);
  }

  setInterval(refreshStatus, 2500);
}

initialize();
