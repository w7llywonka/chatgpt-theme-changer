const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "renderer", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "renderer", "styles.css"), "utf8");

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("the editor exposes navigation and status landmarks", () => {
  assert.match(html, /<a class="skip-link" href="#theme-controls">/);
  assert.match(html, /<main id="top">/);
  assert.match(html, /<section id="theme-controls"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
});

test("every visible editor input has a programmatic label", () => {
  const inputIds = [...html.matchAll(/<(?:input|select)\b(?=[^>]*\bid="([^"]+)")(?![^>]*\btype="hidden")[^>]*>/g)]
    .map((match) => match[1]);
  assert.ok(inputIds.length >= 9, "expected the full visible editor control set");
  for (const id of inputIds) {
    const hasLabel = new RegExp(`<label\\b[^>]*\\bfor="${id}"`).test(html);
    const hasAriaLabel = new RegExp(`<(?:input|select)\\b[^>]*\\bid="${id}"[^>]*\\baria-label="`).test(html);
    assert.ok(hasLabel || hasAriaLabel, `${id} needs a label`);
  }
});

test("accessibility controls are keyboard discoverable", () => {
  assert.match(html, /<dialog[^>]*id="accessibilityDialog"[^>]*aria-labelledby="accessibility-title"/);
  assert.match(html, /<kbd>Alt<\/kbd> \+ <kbd>A<\/kbd>/);
  assert.match(html, /role="switch"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test("the configuration sidebar uses accessible tabs and labeled feature controls", () => {
  assert.match(html, /role="tablist" aria-label="Theme configuration sections"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 3);
  assert.match(html, /<label class="select-control" for="uiFont">/);
  assert.match(html, /<label class="select-control" for="codeFont">/);
  assert.match(html, /<label class="config-switch" for="soundEnabled">/);
});

test("core interface colors exceed WCAG AA text contrast", () => {
  assert.ok(contrast("#f2f5f0", "#080a08") >= 4.5, "primary text contrast");
  assert.ok(contrast("#969c96", "#080a08") >= 4.5, "secondary text contrast");
  assert.ok(contrast("#101309", "#d7ff4f") >= 4.5, "accent button contrast");
  assert.ok(contrast("#ff8179", "#080a08") >= 4.5, "error text contrast");
});

test("the layout remains usable below desktop width", () => {
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow:\s*hidden/s);
});
