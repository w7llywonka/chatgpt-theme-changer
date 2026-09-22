const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildInstallExpression,
  buildThemeCss,
  normalizeBackgroundUrl,
  normalizeTheme,
} = require("../lib/theme.cjs");

test("accepts secure image URLs and rejects unsafe protocols", () => {
  assert.equal(normalizeBackgroundUrl("https://example.com/wall.jpg"), "https://example.com/wall.jpg");
  assert.throws(() => normalizeBackgroundUrl("http://example.com/wall.jpg"), /HTTPS/);
  assert.throws(() => normalizeBackgroundUrl("javascript:alert(1)"), /HTTPS/);
});

test("normalizes ranges and colors", () => {
  const theme = normalizeTheme({
    dim: 999,
    blur: -4,
    panelOpacity: "70",
    panelColor: "not-a-color",
    accent: "#AABBCC",
  });
  assert.equal(theme.dim, 85);
  assert.equal(theme.blur, 0);
  assert.equal(theme.panelOpacity, 70);
  assert.equal(theme.panelColor, "#111315");
  assert.equal(theme.accent, "#aabbcc");
});

test("generated CSS safely quotes URLs", () => {
  const css = buildThemeCss({
    backgroundUrl: "https://example.com/image%22name.jpg",
    panelColor: "#123456",
    accent: "#abcdef",
  });
  assert.match(css, /background-image: url\("https:\/\/example\.com\/image%22name\.jpg"\)/);
  assert.match(css, /--theme-studio-accent: #abcdef/);
  assert.match(css, /rgba\(18, 52, 86,/);
});

test("install expression replaces one stable style element", () => {
  const expression = buildInstallExpression("body { color: red; }");
  assert.match(expression, /chatgpt-theme-studio-style/);
  assert.match(expression, /style\.textContent/);
});
