const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const EDITOR_DEFAULTS = Object.freeze({
  backgroundUrl: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2400&q=88",
  fit: "cover",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  panelColor: "#111315",
  accent: "#d8d4cc",
  dim: 46,
  blur: 0,
  panelOpacity: 78,
  vignette: 35,
  uiFont: "Segoe UI",
  uiFontDataUrl: "",
  uiFontFileName: "",
  codeFont: "Cascadia Code",
  uiFontSize: 16,
  codeFontSize: 14,
  lineHeight: 160,
  soundEnabled: false,
  soundId: "soft",
  soundVolume: 55,
  customSoundDataUrl: "",
  customSoundFileName: "",
});

const ACCESSIBILITY_KEY = "theme-studio-accessibility-v1";

const elements = {
  form: $("#themeForm"),
  backgroundUrl: $("#backgroundUrl"),
  chooseFile: $("#chooseFile"),
  fit: $("#fit"),
  backgroundPositionX: $("#backgroundPositionX"),
  backgroundPositionY: $("#backgroundPositionY"),
  panelColor: $("#panelColor"),
  accent: $("#accent"),
  dim: $("#dim"),
  blur: $("#blur"),
  panelOpacity: $("#panelOpacity"),
  vignette: $("#vignette"),
  uiFont: $("#uiFont"),
  uiFontDataUrl: $("#uiFontDataUrl"),
  uiFontFileName: $("#uiFontFileName"),
  uiFontName: $("#uiFontName"),
  chooseFont: $("#chooseFont"),
  clearFont: $("#clearFont"),
  codeFont: $("#codeFont"),
  uiFontSize: $("#uiFontSize"),
  codeFontSize: $("#codeFontSize"),
  lineHeight: $("#lineHeight"),
  soundEnabled: $("#soundEnabled"),
  soundVolume: $("#soundVolume"),
  customSoundDataUrl: $("#customSoundDataUrl"),
  customSoundFileName: $("#customSoundFileName"),
  customSoundName: $("#customSoundName"),
  soundCustom: $("#soundCustom"),
  chooseSound: $("#chooseSound"),
  clearSound: $("#clearSound"),
  panelColorText: $("#panelColorText"),
  accentText: $("#accentText"),
  dimValue: $("#dimValue"),
  blurValue: $("#blurValue"),
  panelOpacityValue: $("#panelOpacityValue"),
  vignetteValue: $("#vignetteValue"),
  uiFontSizeValue: $("#uiFontSizeValue"),
  codeFontSizeValue: $("#codeFontSizeValue"),
  lineHeightValue: $("#lineHeightValue"),
  soundVolumeValue: $("#soundVolumeValue"),
  backgroundPositionXValue: $("#backgroundPositionXValue"),
  backgroundPositionYValue: $("#backgroundPositionYValue"),
  fontPreview: $("#fontPreview"),
  preview: $("#preview"),
  urlHint: $("#urlHint"),
  imageState: $("#imageState"),
  statusPill: $("#statusPill"),
  applyButton: $("#applyButton"),
  disableButton: $("#disableButton"),
  resetButton: $("#resetButton"),
  testSound: $("#testSound"),
  toast: $("#toast"),
  accessibilityDialog: $("#accessibilityDialog"),
  openAccessibility: $("#openAccessibility"),
  closeAccessibility: $("#closeAccessibility"),
  highContrast: $("#highContrast"),
  reduceMotion: $("#reduceMotion"),
  profileSelect: $("#profileSelect"),
  profileName: $("#profileName"),
  loadProfile: $("#loadProfile"),
  saveProfile: $("#saveProfile"),
  deleteProfile: $("#deleteProfile"),
  importTheme: $("#importTheme"),
  exportTheme: $("#exportTheme"),
};

let currentStatus = null;
let toastTimer = null;
let localImageName = null;
let initialized = false;
let saveTimer = null;
let lastValidatedUrl = null;
let profiles = [];
const previewFontStyle = document.createElement("style");
previewFontStyle.id = "theme-studio-preview-font";
document.head.appendChild(previewFontStyle);

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
    backgroundPositionX: Number(elements.backgroundPositionX.value),
    backgroundPositionY: Number(elements.backgroundPositionY.value),
    panelColor: elements.panelColor.value,
    accent: elements.accent.value,
    dim: Number(elements.dim.value),
    blur: Number(elements.blur.value),
    panelOpacity: Number(elements.panelOpacity.value),
    vignette: Number(elements.vignette.value),
    uiFont: elements.uiFont.value,
    uiFontDataUrl: elements.uiFontDataUrl.value,
    uiFontFileName: elements.uiFontFileName.value,
    codeFont: elements.codeFont.value,
    uiFontSize: Number(elements.uiFontSize.value),
    codeFontSize: Number(elements.codeFontSize.value),
    lineHeight: Number(elements.lineHeight.value),
    soundEnabled: elements.soundEnabled.checked,
    soundId: $('[name="soundId"]:checked')?.value || "soft",
    soundVolume: Number(elements.soundVolume.value),
    customSoundDataUrl: elements.customSoundDataUrl.value,
    customSoundFileName: elements.customSoundFileName.value,
  };
}

function setTheme(theme) {
  elements.backgroundUrl.value = theme.backgroundUrl || "";
  elements.fit.value = theme.fit || "cover";
  elements.backgroundPositionX.value = theme.backgroundPositionX ?? 50;
  elements.backgroundPositionY.value = theme.backgroundPositionY ?? 50;
  elements.panelColor.value = theme.panelColor || "#111315";
  elements.accent.value = theme.accent || "#d8d4cc";
  elements.dim.value = theme.dim ?? 46;
  elements.blur.value = theme.blur ?? 0;
  elements.panelOpacity.value = theme.panelOpacity ?? 78;
  elements.vignette.value = theme.vignette ?? 35;
  elements.uiFont.value = theme.uiFont || EDITOR_DEFAULTS.uiFont;
  elements.uiFontDataUrl.value = theme.uiFontDataUrl || "";
  elements.uiFontFileName.value = theme.uiFontFileName || "";
  elements.codeFont.value = theme.codeFont || EDITOR_DEFAULTS.codeFont;
  elements.uiFontSize.value = theme.uiFontSize ?? EDITOR_DEFAULTS.uiFontSize;
  elements.codeFontSize.value = theme.codeFontSize ?? EDITOR_DEFAULTS.codeFontSize;
  elements.lineHeight.value = theme.lineHeight ?? EDITOR_DEFAULTS.lineHeight;
  elements.soundEnabled.checked = Boolean(theme.soundEnabled);
  elements.soundVolume.value = theme.soundVolume ?? EDITOR_DEFAULTS.soundVolume;
  elements.customSoundDataUrl.value = theme.customSoundDataUrl || "";
  elements.customSoundFileName.value = theme.customSoundFileName || "";
  renderCustomSoundState();
  const soundChoice = $(`[name="soundId"][value="${theme.soundId || EDITOR_DEFAULTS.soundId}"]`);
  if (soundChoice) soundChoice.checked = true;
  renderFontImportState();
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
  const usesPixels = ["blur", "uiFontSize", "codeFontSize"].includes(range.id);
  range.setAttribute("aria-valuetext", usesPixels ? `${value} pixels` : `${value} percent`);
}

function updatePreview() {
  const theme = getTheme();
  const previewUiFont = theme.uiFontDataUrl ? "Theme Studio Preview UI" : theme.uiFont;
  previewFontStyle.textContent = theme.uiFontDataUrl
    ? `@font-face { font-family: "Theme Studio Preview UI"; src: url(${JSON.stringify(theme.uiFontDataUrl)}); font-style: normal; font-weight: 100 900; font-display: swap; }`
    : "";
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
  elements.preview.style.setProperty("--preview-position", `${theme.backgroundPositionX}% ${theme.backgroundPositionY}%`);
  elements.preview.style.setProperty("--preview-ui-font", `${JSON.stringify(previewUiFont)}, "Segoe UI", sans-serif`);
  elements.preview.style.setProperty("--preview-code-font", `${JSON.stringify(theme.codeFont)}, monospace`);
  elements.preview.style.setProperty("--preview-ui-size", `${theme.uiFontSize}px`);
  elements.preview.style.setProperty("--preview-code-size", `${theme.codeFontSize}px`);
  elements.preview.style.setProperty("--preview-line-height", (theme.lineHeight / 100).toFixed(2));
  elements.fontPreview.style.fontFamily = `${JSON.stringify(previewUiFont)}, "Segoe UI", sans-serif`;
  elements.fontPreview.style.lineHeight = (theme.lineHeight / 100).toFixed(2);
  elements.fontPreview.querySelector("code").style.fontFamily = `${JSON.stringify(theme.codeFont)}, monospace`;
  elements.fontPreview.querySelector("code").style.fontSize = `${theme.codeFontSize}px`;

  elements.panelColorText.textContent = theme.panelColor.toUpperCase();
  elements.accentText.textContent = theme.accent.toUpperCase();
  elements.dimValue.textContent = `${theme.dim}%`;
  elements.blurValue.textContent = `${theme.blur}px`;
  elements.panelOpacityValue.textContent = `${theme.panelOpacity}%`;
  elements.vignetteValue.textContent = `${theme.vignette}%`;
  elements.uiFontSizeValue.textContent = `${theme.uiFontSize}px`;
  elements.codeFontSizeValue.textContent = `${theme.codeFontSize}px`;
  elements.lineHeightValue.textContent = `${theme.lineHeight}%`;
  elements.soundVolumeValue.textContent = `${theme.soundVolume}%`;
  elements.backgroundPositionXValue.textContent = `${theme.backgroundPositionX}%`;
  elements.backgroundPositionYValue.textContent = `${theme.backgroundPositionY}%`;
  [
    elements.dim,
    elements.blur,
    elements.panelOpacity,
    elements.vignette,
    elements.uiFontSize,
    elements.codeFontSize,
    elements.lineHeight,
    elements.soundVolume,
    elements.backgroundPositionX,
    elements.backgroundPositionY,
  ].forEach(updateRange);

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

function renderFontImportState() {
  const fileName = elements.uiFontFileName.value;
  const hasImportedFont = Boolean(elements.uiFontDataUrl.value && fileName);
  elements.uiFontName.textContent = hasImportedFont ? fileName : "System font";
  elements.chooseFont.textContent = hasImportedFont ? "Replace font" : "Import font";
  elements.clearFont.hidden = !hasImportedFont;
}

function renderCustomSoundState() {
  const fileName = elements.customSoundFileName.value;
  const hasCustomSound = Boolean(elements.customSoundDataUrl.value && fileName);
  elements.customSoundName.textContent = hasCustomSound ? fileName : "Import a local sound";
  elements.soundCustom.disabled = !hasCustomSound;
  elements.chooseSound.textContent = hasCustomSound ? "Replace sound" : "Import sound";
  elements.clearSound.hidden = !hasCustomSound;
  if (!hasCustomSound && elements.soundCustom.checked) $("#soundSoft").checked = true;
}

function renderProfiles(nextProfiles, selectedId = elements.profileSelect.value) {
  profiles = Array.isArray(nextProfiles) ? nextProfiles : [];
  elements.profileSelect.replaceChildren();
  const currentOption = document.createElement("option");
  currentOption.value = "";
  currentOption.textContent = "Current controls";
  elements.profileSelect.append(currentOption);
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    elements.profileSelect.append(option);
  }
  elements.profileSelect.value = profiles.some((profile) => profile.id === selectedId) ? selectedId : "";
  updateProfileSelection();
}

function updateProfileSelection() {
  const profile = profiles.find((item) => item.id === elements.profileSelect.value);
  elements.loadProfile.disabled = !profile;
  elements.deleteProfile.disabled = !profile;
  if (profile) elements.profileName.value = profile.name;
}

function activateConfigTab(tab, moveFocus = false) {
  const name = tab.dataset.configTab;
  $$('[data-config-tab]').forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  $$('[data-config-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.configPanel !== name;
  });
  if (moveFocus) tab.focus();
}

function playPreviewSound(theme) {
  const volume = theme.soundVolume / 100;
  if (volume <= 0) {
    showToast("Raise the sound volume to hear a preview.", true);
    return;
  }
  try {
    if (theme.soundId === "custom") {
      if (!theme.customSoundDataUrl) throw new Error("Import a custom sound first.");
      const audio = new Audio(theme.customSoundDataUrl);
      audio.volume = volume;
      audio.play().catch(() => showToast("Couldn’t play that sound file.", true));
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Audio preview is unavailable.");
    const context = new AudioContextClass();
    const patterns = {
      soft: [[523.25, 0, 0.16], [659.25, 0.12, 0.24]],
      glass: [[880, 0, 0.1], [1318.51, 0.07, 0.3]],
      pulse: [[392, 0, 0.09], [523.25, 0.11, 0.09], [783.99, 0.22, 0.18]],
    };
    const pattern = patterns[theme.soundId] || patterns.soft;
    const start = context.currentTime + 0.025;
    for (const [frequency, delay, duration] of pattern) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = theme.soundId === "pulse" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.16), start + delay + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + duration + 0.02);
    }
    setTimeout(() => context.close().catch(() => {}), 900);
  } catch (error) {
    showToast(error.message || "Couldn’t play that sound.", true);
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

$$('[data-config-tab]').forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => activateConfigTab(tab));
  tab.addEventListener("keydown", (event) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateConfigTab(tabs[nextIndex], true);
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

elements.chooseFont.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.chooseFont();
    if (!result) return;
    elements.uiFont.value = result.label || EDITOR_DEFAULTS.uiFont;
    elements.uiFontDataUrl.value = result.dataUrl;
    elements.uiFontFileName.value = result.name;
    renderFontImportState();
    updatePreview();
    await window.themeStudio.save(getTheme());
    showToast(`${result.name} imported and applied to the preview.`);
  } catch (error) {
    showToast(error.message || "Couldn’t import that font.", true);
  }
});

elements.clearFont.addEventListener("click", async () => {
  elements.uiFont.value = EDITOR_DEFAULTS.uiFont;
  elements.uiFontDataUrl.value = "";
  elements.uiFontFileName.value = "";
  renderFontImportState();
  updatePreview();
  try {
    await window.themeStudio.save(getTheme());
    showToast("Imported font removed. Using the system font.");
  } catch (error) {
    showToast(error.message || "Couldn’t update the font setting.", true);
  }
});

elements.chooseSound.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.chooseSound();
    if (!result) return;
    elements.customSoundDataUrl.value = result.dataUrl;
    elements.customSoundFileName.value = result.name;
    elements.soundCustom.disabled = false;
    elements.soundCustom.checked = true;
    elements.soundEnabled.checked = true;
    renderCustomSoundState();
    updatePreview();
    await window.themeStudio.save(getTheme());
    showToast(`${result.name} imported. Test it before applying.`);
  } catch (error) {
    showToast(error.message || "Couldn’t import that sound.", true);
  }
});

elements.clearSound.addEventListener("click", async () => {
  elements.customSoundDataUrl.value = "";
  elements.customSoundFileName.value = "";
  if (elements.soundCustom.checked) $("#soundSoft").checked = true;
  renderCustomSoundState();
  updatePreview();
  try {
    await window.themeStudio.save(getTheme());
    showToast("Custom sound removed.");
  } catch (error) {
    showToast(error.message || "Couldn’t update the sound setting.", true);
  }
});

elements.profileSelect.addEventListener("change", updateProfileSelection);

elements.loadProfile.addEventListener("click", async () => {
  if (!elements.profileSelect.value) return;
  try {
    const result = await window.themeStudio.loadProfile(elements.profileSelect.value);
    setTheme(result.theme);
    elements.profileName.value = result.profile.name;
    showToast(`${result.profile.name} loaded.`);
  } catch (error) {
    showToast(error.message || "Couldn’t load that profile.", true);
  }
});

elements.saveProfile.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.saveProfile({
      id: elements.profileSelect.value || undefined,
      name: elements.profileName.value,
      theme: getTheme(),
    });
    renderProfiles(result.profiles, result.profile.id);
    elements.profileName.value = result.profile.name;
    showToast(`${result.profile.name} saved.`);
  } catch (error) {
    showToast(error.message || "Couldn’t save that profile.", true);
  }
});

elements.deleteProfile.addEventListener("click", async () => {
  const profile = profiles.find((item) => item.id === elements.profileSelect.value);
  if (!profile || !window.confirm(`Delete the “${profile.name}” profile?`)) return;
  try {
    const result = await window.themeStudio.deleteProfile(profile.id);
    renderProfiles(result.profiles);
    elements.profileName.value = "";
    showToast(`${profile.name} deleted.`);
  } catch (error) {
    showToast(error.message || "Couldn’t delete that profile.", true);
  }
});

elements.importTheme.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.importTheme();
    if (result.cancelled) return;
    setTheme(result.theme);
    elements.profileSelect.value = "";
    elements.profileName.value = result.suggestedName || "Imported theme";
    updateProfileSelection();
    showToast("Theme imported. Save it as a profile or apply it now.");
  } catch (error) {
    showToast(error.message || "Couldn’t import that theme.", true);
  }
});

elements.exportTheme.addEventListener("click", async () => {
  try {
    const result = await window.themeStudio.exportTheme(getTheme(), elements.profileName.value || "theme");
    if (!result.cancelled) showToast(`${result.name} exported.`);
  } catch (error) {
    showToast(error.message || "Couldn’t export that theme.", true);
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

elements.testSound.addEventListener("click", () => {
  playPreviewSound(getTheme());
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
    const [{ theme }, profileState] = await Promise.all([
      window.themeStudio.getState(),
      window.themeStudio.getProfiles(),
    ]);
    setTheme(theme);
    renderProfiles(profileState.profiles);
    initialized = true;
    await refreshStatus();
  } catch (error) {
    showToast(error.message || "Theme Studio couldn’t initialize.", true);
  }

  setInterval(refreshStatus, 2500);
}

initialize();
