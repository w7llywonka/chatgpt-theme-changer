const DEFAULT_THEME = Object.freeze({
  backgroundUrl: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2400&q=88",
  fit: "cover",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  dim: 46,
  blur: 0,
  panelOpacity: 78,
  panelColor: "#111315",
  accent: "#d8d4cc",
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
  enabled: false,
});

const FITS = new Set(["cover", "contain", "stretch"]);
const SOUND_IDS = new Set(["soft", "glass", "pulse", "custom"]);

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}

function normalizeFontFamily(value, fallback) {
  const text = String(value || "").trim();
  if (!text || text.length > 80 || /["'\\;{}<>\u0000-\u001f]/.test(text)) return fallback;
  return text;
}

function normalizeFontDataUrl(value) {
  const text = String(value || "").replace(/\s/g, "");
  if (!text) return "";
  if (!/^data:font\/(?:woff2?|ttf|otf|truetype|opentype);base64,[a-z0-9+/=]+$/i.test(text)) return "";
  return text;
}

function normalizeAudioDataUrl(value) {
  const text = String(value || "").replace(/\s/g, "");
  if (!text) return "";
  if (!/^data:audio\/(?:mpeg|mp3|wav|wave|x-wav|ogg|mp4|m4a|aac);base64,[a-z0-9+/=]+$/i.test(text)) return "";
  return text;
}

function normalizeFileName(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 160 || /[\\/:*?"<>|\u0000-\u001f]/.test(text)) return "";
  return text;
}

function normalizeBackgroundUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(text)) {
    return text.replace(/\s/g, "");
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Use a complete HTTPS image link, such as https://…/image.jpg");
  }

  if (url.protocol !== "https:") {
    throw new Error("Background links must use HTTPS.");
  }

  return url.href;
}

function normalizeTheme(input = {}) {
  const merged = { ...DEFAULT_THEME, ...input };
  const legacyPositionY = merged.position === "top" ? 0 : merged.position === "bottom" ? 100 : 50;
  const positionX = Object.prototype.hasOwnProperty.call(input, "backgroundPositionX")
    ? merged.backgroundPositionX
    : DEFAULT_THEME.backgroundPositionX;
  const positionY = Object.prototype.hasOwnProperty.call(input, "backgroundPositionY")
    ? merged.backgroundPositionY
    : legacyPositionY;
  const customSoundDataUrl = normalizeAudioDataUrl(merged.customSoundDataUrl);
  return {
    backgroundUrl: normalizeBackgroundUrl(merged.backgroundUrl),
    fit: FITS.has(merged.fit) ? merged.fit : DEFAULT_THEME.fit,
    backgroundPositionX: clamp(positionX, 0, 100, DEFAULT_THEME.backgroundPositionX),
    backgroundPositionY: clamp(positionY, 0, 100, legacyPositionY),
    dim: clamp(merged.dim, 0, 85, DEFAULT_THEME.dim),
    blur: clamp(merged.blur, 0, 24, DEFAULT_THEME.blur),
    panelOpacity: clamp(merged.panelOpacity, 25, 100, DEFAULT_THEME.panelOpacity),
    panelColor: normalizeHex(merged.panelColor, DEFAULT_THEME.panelColor),
    accent: normalizeHex(merged.accent, DEFAULT_THEME.accent),
    vignette: clamp(merged.vignette, 0, 85, DEFAULT_THEME.vignette),
    uiFont: normalizeFontFamily(merged.uiFont, DEFAULT_THEME.uiFont),
    uiFontDataUrl: normalizeFontDataUrl(merged.uiFontDataUrl),
    uiFontFileName: normalizeFileName(merged.uiFontFileName),
    codeFont: normalizeFontFamily(merged.codeFont, DEFAULT_THEME.codeFont),
    uiFontSize: clamp(merged.uiFontSize, 12, 22, DEFAULT_THEME.uiFontSize),
    codeFontSize: clamp(merged.codeFontSize, 11, 22, DEFAULT_THEME.codeFontSize),
    lineHeight: clamp(merged.lineHeight, 120, 200, DEFAULT_THEME.lineHeight),
    soundEnabled: Boolean(merged.soundEnabled),
    soundId: SOUND_IDS.has(merged.soundId) && (merged.soundId !== "custom" || customSoundDataUrl)
      ? merged.soundId
      : DEFAULT_THEME.soundId,
    soundVolume: clamp(merged.soundVolume, 0, 100, DEFAULT_THEME.soundVolume),
    customSoundDataUrl,
    customSoundFileName: normalizeFileName(merged.customSoundFileName),
    enabled: Boolean(merged.enabled),
  };
}

function hexToRgb(hex) {
  const value = normalizeHex(hex, "#000000").slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgba(hex, opacity) {
  const [red, green, blue] = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${opacity.toFixed(3)})`;
}

function cssUrl(value) {
  return `url(${JSON.stringify(value)})`;
}

function buildThemeCss(input) {
  const theme = normalizeTheme(input);
  if (!theme.backgroundUrl) throw new Error("Add a background image link first.");

  const opacity = theme.panelOpacity / 100;
  const underOpacity = Math.max(0.22, opacity - 0.14);
  const elevatedOpacity = Math.min(1, opacity + 0.1);
  const editorOpacity = Math.min(1, opacity + 0.04);
  const fit = theme.fit === "stretch" ? "100% 100%" : theme.fit;
  const importedUiFont = "Theme Studio Imported UI";
  const uiFont = theme.uiFontDataUrl ? importedUiFont : theme.uiFont;
  const importedFontFace = theme.uiFontDataUrl
    ? `@font-face {
  font-family: ${JSON.stringify(importedUiFont)};
  src: url(${JSON.stringify(theme.uiFontDataUrl)});
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}`
    : "";

  return `
/* ChatGPT Theme Studio — runtime-only and reversible */
${importedFontFace}

:root {
  --theme-studio-accent: ${theme.accent};
  --theme-studio-ui-font: ${JSON.stringify(uiFont)}, "Segoe UI", sans-serif;
  --theme-studio-code-font: ${JSON.stringify(theme.codeFont)}, Consolas, monospace;
  --theme-studio-line-height: ${(theme.lineHeight / 100).toFixed(2)};
  --font-ui-family: var(--theme-studio-ui-font) !important;
  --font-sans-default: var(--theme-studio-ui-font) !important;
  --font-sans: var(--theme-studio-ui-font) !important;
  --default-font-family: var(--theme-studio-ui-font) !important;
  --app-color-background-surface: ${rgba(theme.panelColor, opacity)} !important;
  --app-color-background-surface-under: ${rgba(theme.panelColor, underOpacity)} !important;
  --app-color-background-editor-opaque: ${rgba(theme.panelColor, editorOpacity)} !important;
  --app-color-background-elevated-primary: ${rgba(theme.panelColor, elevatedOpacity)} !important;
  --app-color-background-recovery: ${rgba(theme.panelColor, elevatedOpacity)} !important;
  --app-shell-panel-background: ${rgba(theme.panelColor, opacity)} !important;
  --color-surface: ${rgba(theme.panelColor, opacity)} !important;
  --color-surface-secondary: ${rgba(theme.panelColor, underOpacity)} !important;
  --color-surface-tertiary: ${rgba(theme.panelColor, editorOpacity)} !important;
  --color-surface-elevated: ${rgba(theme.panelColor, elevatedOpacity)} !important;
  --color-surface-elevated-secondary: ${rgba(theme.panelColor, elevatedOpacity)} !important;
  --chat-background-color: transparent !important;
  --smoothing-background-color: transparent !important;
  --app-color-text-accent: ${theme.accent} !important;
  --color-text-info: ${theme.accent} !important;
  --color-ring: ${theme.accent} !important;
}

html {
  font-size: ${theme.uiFontSize}px !important;
  background: ${theme.panelColor} !important;
}

body {
  position: relative !important;
  isolation: isolate !important;
  font-family: var(--theme-studio-ui-font) !important;
  background: transparent !important;
}

[class*="_Paragraph_"],
[class*="_MarkdownRoot_"],
[data-markdown-text-style],
[data-message-author-role],
[data-message-author-role] p,
[data-message-author-role] li,
[data-message-author-role] span {
  font-family: var(--theme-studio-ui-font) !important;
}

button,
input,
textarea,
select {
  font-family: var(--theme-studio-ui-font) !important;
}

pre,
code,
kbd,
samp,
.cm-editor,
[class*="font-mono"] {
  font-family: var(--theme-studio-code-font) !important;
  font-size: ${theme.codeFontSize}px !important;
}

[data-message-author-role] p,
[data-message-author-role] li {
  line-height: var(--theme-studio-line-height) !important;
}

body::before {
  content: "";
  position: fixed;
  z-index: -2;
  inset: ${theme.blur ? `-${theme.blur * 2}px` : "0"};
  pointer-events: none;
  background-image: ${cssUrl(theme.backgroundUrl)};
  background-position: ${theme.backgroundPositionX}% ${theme.backgroundPositionY}%;
  background-repeat: no-repeat;
  background-size: ${fit};
  filter: blur(${theme.blur}px);
  transform: scale(${theme.blur ? 1.03 : 1});
}

body::after {
  content: "";
  position: fixed;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 42%, transparent 18%, rgba(0, 0, 0, ${(theme.vignette / 100).toFixed(3)}) 125%),
    rgba(0, 0, 0, ${(theme.dim / 100).toFixed(3)});
}

#root,
.bg-surface-canvas {
  background-color: transparent !important;
}

.bg-surface,
.bg-surface-secondary,
.bg-surface-tertiary,
.bg-surface-elevated,
.bg-surface-elevated-secondary {
  -webkit-backdrop-filter: blur(18px) saturate(112%);
  backdrop-filter: blur(18px) saturate(112%);
}

::selection {
  background: color-mix(in srgb, ${theme.accent} 36%, transparent);
}
`.trim();
}

function buildInstallExpression(css, input = {}) {
  const serializedCss = JSON.stringify(css);
  const theme = normalizeTheme(input);
  const serializedSound = JSON.stringify({
    enabled: theme.soundEnabled,
    id: theme.soundId,
    volume: theme.soundVolume / 100,
    customDataUrl: theme.customSoundDataUrl,
  });
  return `(() => {
    const id = "chatgpt-theme-studio-style";
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = ${serializedCss};
    document.documentElement.dataset.themeStudio = "active";
    const soundKey = "__chatgptThemeStudioCompletionSound";
    globalThis[soundKey]?.disconnect?.();
    const soundConfig = ${serializedSound};
    let wasGenerating = false;
    let checkTimer = null;
    let completionTimer = null;
    let customAudio = null;

    const isGenerating = () => Boolean(document.querySelector(
      'button[data-testid="stop-button"], button[data-testid*="stop"], button[aria-label="Stop"], button[aria-label*="Stop generating"], button[aria-label*="stop generating"]'
    ));

    const play = () => {
      if (!soundConfig.enabled || soundConfig.volume <= 0) return false;
      try {
        if (soundConfig.id === "custom" && soundConfig.customDataUrl) {
          customAudio?.pause?.();
          customAudio = new Audio(soundConfig.customDataUrl);
          customAudio.volume = soundConfig.volume;
          customAudio.play().catch(() => {});
          return true;
        }
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        const context = new AudioContextClass();
        const patterns = {
          soft: [[523.25, 0, 0.16], [659.25, 0.12, 0.24]],
          glass: [[880, 0, 0.1], [1318.51, 0.07, 0.3]],
          pulse: [[392, 0, 0.09], [523.25, 0.11, 0.09], [783.99, 0.22, 0.18]],
        };
        const pattern = patterns[soundConfig.id] || patterns.soft;
        const start = context.currentTime + 0.025;
        for (const [frequency, delay, duration] of pattern) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = soundConfig.id === "pulse" ? "triangle" : "sine";
          oscillator.frequency.setValueAtTime(frequency, start + delay);
          gain.gain.setValueAtTime(0.0001, start + delay);
          gain.gain.exponentialRampToValueAtTime(Math.max(0.001, soundConfig.volume * 0.16), start + delay + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(start + delay);
          oscillator.stop(start + delay + duration + 0.02);
        }
        setTimeout(() => context.close().catch(() => {}), 900);
        return true;
      } catch {
        return false;
      }
    };

    const check = () => {
      const generating = isGenerating();
      if (generating) {
        wasGenerating = true;
        clearTimeout(completionTimer);
      } else if (wasGenerating) {
        wasGenerating = false;
        clearTimeout(completionTimer);
        completionTimer = setTimeout(() => {
          if (!isGenerating()) play();
        }, 450);
      }
    };

    const observer = new MutationObserver(() => {
      clearTimeout(checkTimer);
      checkTimer = setTimeout(check, 90);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    wasGenerating = isGenerating();
    globalThis[soundKey] = {
      play,
      disconnect() {
        observer.disconnect();
        clearTimeout(checkTimer);
        clearTimeout(completionTimer);
        customAudio?.pause?.();
        customAudio = null;
      },
    };
    return true;
  })()`;
}

const REMOVE_EXPRESSION = `(() => {
  document.getElementById("chatgpt-theme-studio-style")?.remove();
  globalThis.__chatgptThemeStudioCompletionSound?.disconnect?.();
  delete globalThis.__chatgptThemeStudioCompletionSound;
  delete document.documentElement.dataset.themeStudio;
  return true;
})()`;

module.exports = {
  DEFAULT_THEME,
  REMOVE_EXPRESSION,
  buildInstallExpression,
  buildThemeCss,
  normalizeBackgroundUrl,
  normalizeAudioDataUrl,
  normalizeFontDataUrl,
  normalizeTheme,
};
