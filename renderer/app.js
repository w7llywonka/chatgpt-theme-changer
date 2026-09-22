const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const EDITOR_DEFAULTS = Object.freeze({
  backgroundUrl: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2400&q=88",
  fit: "cover",
  position: "center",
  panelColor: "#111315",
  accent: "#d7ff4f",
  dim: 46,
  blur: 0,
  panelOpacity: 78,
  vignette: 35,
});

const ACCESSIBILITY_KEY = "theme-studio-accessibility-v1";

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
  resetButton: $("#resetButton"),
  toast: $("#toast"),
  accessibilityDialog: $("#accessibilityDialog"),
  openAccessibility: $("#openAccessibility"),
  closeAccessibility: $("#closeAccessibility"),
  highContrast: $("#highContrast"),
  reduceMotion: $("#reduceMotion"),
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
  $$('[data-fit]').forEach((button) => {
    const selected = button.dataset.fit === elements.fit.value;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  updatePreview();
}

function updateRange(range) {
  const minimum = Number(range.min || 0);
  const maximum = Number(range.max || 100);
  const value = Number(range.value);
  const progress = ((value - minimum) / (maximum - minimum)) * 100;
  range.style.setProperty("--progress", `${progress}%`);
  range.setAttribute("aria-valuetext", range.id === "blur" ? `${value} pixels` : `${value} percent`);
}

function updatePreview() {
  const theme = getTheme();
  const previewImage = theme.backgroundUrl ? `url(${JSON.stringify(theme.backgroundUrl)})` : "none";
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--studio-image", previewImage);
  elements.preview.style.setProperty("--preview-image", previewImage);
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
  elements.backgroundUrl.removeAttribute("aria-invalid");
  if (!url) {
    elements.imageState.textContent = "Add an image";
    elements.urlHint.textContent = "Direct links work best. Local images never leave this computer.";
    return;
  }
  if (!url.startsWith("https://") && !url.startsWith("data:image/")) {
    elements.urlHint.textContent = "Use a complete HTTPS image link.";
    elements.urlHint.classList.add("is-error");
    elements.backgroundUrl.setAttribute("aria-invalid", "true");
    elements.imageState.textContent = "Link needed";
    return;
  }

  elements.imageState.textContent = "Loading";
  const image = new Image();
  image.onload = () => {
    if (sequence !== validationSequence) return;
    elements.imageState.textContent = localImageName || "Image ready";
    elements.urlHint.textContent = localImageName
      ? "Saved inside Theme Studio settings on this computer."
      : "Image loaded. Direct links work best; local files stay local.";
  };
  image.onerror = () => {
    if (sequence !== validationSequence) return;
    elements.imageState.textContent = "Check link";
    elements.urlHint.textContent = "That image did not load. Try a direct image URL or choose a local file.";
    elements.urlHint.classList.add("is-error");
    elements.backgroundUrl.setAttribute("aria-invalid", "true");
  };
  image.src = url;
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
  elements.toast.setAttribute("role", error ? "alert" : "status");
  elements.toast.setAttribute("aria-live", error ? "assertive" : "polite");
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 4800);
}

function renderStatus(status) {
  currentStatus = status;
  elements.statusPill.className = "status-pill";
  const label = elements.statusPill.querySelector("span");

  if (status.connected) {
    elements.statusPill.classList.add("is-live");
    label.textContent = status.enabled ? "Live" : "Connected";
    elements.applyButton.querySelector("span").textContent = "Apply live";
  } else if (status.running) {
    elements.statusPill.classList.add("is-off");
    label.textContent = "Restart needed";
    elements.applyButton.querySelector("span").textContent = "Restart + apply";
  } else if (status.installed) {
    elements.statusPill.classList.add("is-off");
    label.textContent = "Ready";
    elements.applyButton.querySelector("span").textContent = "Open + apply";
  } else {
    elements.statusPill.classList.add("is-off");
    label.textContent = "App not found";
  }
}

async function refreshStatus() {
  try {
    renderStatus(await window.themeStudio.getStatus());
  } catch {
    // Preserve the last useful status if a poll races an app restart.
  }
}

function readAccessibilityPreferences() {
  try {
    return {
      textScale: "100",
      highContrast: false,
      reduceMotion: false,
      ...JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || "{}"),
    };
  } catch {
    return { textScale: "100", highContrast: false, reduceMotion: false };
  }
}

function applyAccessibilityPreferences(preferences, save = true) {
  const textScale = ["100", "115", "130"].includes(String(preferences.textScale))
    ? String(preferences.textScale)
    : "100";
  document.documentElement.dataset.textScale = textScale;
  document.body.classList.toggle("high-contrast", Boolean(preferences.highContrast));
  document.body.classList.toggle("reduce-motion", Boolean(preferences.reduceMotion));
  elements.highContrast.checked = Boolean(preferences.highContrast);
  elements.reduceMotion.checked = Boolean(preferences.reduceMotion);
  $$('[data-text-scale]').forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.textScale === textScale));
  });
  if (save) localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify({ ...preferences, textScale }));
}

function openAccessibilityDialog() {
  if (!elements.accessibilityDialog.open) elements.accessibilityDialog.showModal();
  elements.closeAccessibility.focus();
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

$$('[data-fit]').forEach((button) => {
  button.addEventListener("click", () => {
    elements.fit.value = button.dataset.fit;
    $$('[data-fit]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    updatePreview();
    if (initialized) window.themeStudio.save(getTheme()).catch(() => {});
  });
});

elements.chooseFile.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.chooseImage();
    if (!result) return;
    localImageName = result.name;
    elements.backgroundUrl.value = result.dataUrl;
    updatePreview();
    await window.themeStudio.save(getTheme());
  } catch (error) {
    showToast(error.message || "Couldn’t open that image.", true);
  }
});

elements.resetButton.addEventListener("click", async () => {
  localImageName = null;
  setTheme(EDITOR_DEFAULTS);
  try {
    await window.themeStudio.save(getTheme());
    showToast("Controls reset to the default theme.");
  } catch (error) {
    showToast(error.message || "Couldn’t reset the controls.", true);
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
  elements.applyButton.setAttribute("aria-busy", "true");
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
    elements.applyButton.removeAttribute("aria-busy");
  }
});

elements.disableButton.addEventListener("click", async () => {
  try {
    await window.themeStudio.disable();
    showToast(currentStatus?.connected ? "Custom background removed." : "Theme disabled for the next launch.");
    await refreshStatus();
  } catch (error) {
    showToast(error.message || "Couldn’t remove the theme.", true);
  }
});

elements.openAccessibility.addEventListener("click", openAccessibilityDialog);
elements.closeAccessibility.addEventListener("click", () => elements.accessibilityDialog.close());
elements.accessibilityDialog.addEventListener("click", (event) => {
  if (event.target === elements.accessibilityDialog) elements.accessibilityDialog.close();
});

$$('[data-text-scale]').forEach((button) => {
  button.addEventListener("click", () => {
    const preferences = readAccessibilityPreferences();
    applyAccessibilityPreferences({ ...preferences, textScale: button.dataset.textScale });
  });
});

elements.highContrast.addEventListener("change", () => {
  const preferences = readAccessibilityPreferences();
  applyAccessibilityPreferences({ ...preferences, highContrast: elements.highContrast.checked });
});

elements.reduceMotion.addEventListener("change", () => {
  const preferences = readAccessibilityPreferences();
  applyAccessibilityPreferences({ ...preferences, reduceMotion: elements.reduceMotion.checked });
});

document.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    openAccessibilityDialog();
  }
});

async function initialize() {
  applyAccessibilityPreferences(readAccessibilityPreferences(), false);
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
