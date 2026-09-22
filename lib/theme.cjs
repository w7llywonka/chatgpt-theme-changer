const DEFAULT_THEME = Object.freeze({
  backgroundUrl: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2400&q=88",
  fit: "cover",
  position: "center",
  dim: 46,
  blur: 0,
  panelOpacity: 78,
  panelColor: "#111315",
  accent: "#d7ff4f",
  vignette: 35,
  enabled: false,
});

const FITS = new Set(["cover", "contain", "stretch"]);
const POSITIONS = new Set(["center", "top", "bottom"]);

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
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
  return {
    backgroundUrl: normalizeBackgroundUrl(merged.backgroundUrl),
    fit: FITS.has(merged.fit) ? merged.fit : DEFAULT_THEME.fit,
    position: POSITIONS.has(merged.position) ? merged.position : DEFAULT_THEME.position,
    dim: clamp(merged.dim, 0, 85, DEFAULT_THEME.dim),
    blur: clamp(merged.blur, 0, 24, DEFAULT_THEME.blur),
    panelOpacity: clamp(merged.panelOpacity, 25, 100, DEFAULT_THEME.panelOpacity),
    panelColor: normalizeHex(merged.panelColor, DEFAULT_THEME.panelColor),
    accent: normalizeHex(merged.accent, DEFAULT_THEME.accent),
    vignette: clamp(merged.vignette, 0, 85, DEFAULT_THEME.vignette),
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

  return `
/* ChatGPT Theme Studio — runtime-only and reversible */
:root {
  --theme-studio-accent: ${theme.accent};
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
  background: ${theme.panelColor} !important;
}

body {
  position: relative !important;
  isolation: isolate !important;
  background: transparent !important;
}

body::before {
  content: "";
  position: fixed;
  z-index: -2;
  inset: ${theme.blur ? `-${theme.blur * 2}px` : "0"};
  pointer-events: none;
  background-image: ${cssUrl(theme.backgroundUrl)};
  background-position: ${theme.position};
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

function buildInstallExpression(css) {
  const serializedCss = JSON.stringify(css);
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
    return true;
  })()`;
}

const REMOVE_EXPRESSION = `(() => {
  document.getElementById("chatgpt-theme-studio-style")?.remove();
  delete document.documentElement.dataset.themeStudio;
  return true;
})()`;

module.exports = {
  DEFAULT_THEME,
  REMOVE_EXPRESSION,
  buildInstallExpression,
  buildThemeCss,
  normalizeBackgroundUrl,
  normalizeTheme,
};
