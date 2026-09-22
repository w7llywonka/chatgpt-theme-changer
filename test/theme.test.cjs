const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const {
  buildInstallExpression,
  buildThemeCss,
  normalizeAudioDataUrl,
  normalizeBackgroundUrl,
  normalizeFontDataUrl,
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
    uiFont: "Bad; } body { display:none",
    uiFontSize: 99,
    codeFontSize: 2,
    lineHeight: 999,
    soundId: "airhorn",
    soundVolume: -20,
    backgroundPositionX: -20,
    backgroundPositionY: 140,
  });
  assert.equal(theme.dim, 85);
  assert.equal(theme.blur, 0);
  assert.equal(theme.panelOpacity, 70);
  assert.equal(theme.panelColor, "#111315");
  assert.equal(theme.accent, "#aabbcc");
  assert.equal(theme.uiFont, "Segoe UI");
  assert.equal(theme.uiFontSize, 22);
  assert.equal(theme.codeFontSize, 11);
  assert.equal(theme.lineHeight, 200);
  assert.equal(theme.soundId, "soft");
  assert.equal(theme.soundVolume, 0);
  assert.equal(theme.backgroundPositionX, 0);
  assert.equal(theme.backgroundPositionY, 100);
});

test("migrates legacy background positions and emits a focal point", () => {
  assert.equal(normalizeTheme({ position: "top" }).backgroundPositionY, 0);
  const css = buildThemeCss({
    backgroundUrl: "https://example.com/background.jpg",
    backgroundPositionX: 28,
    backgroundPositionY: 73,
  });
  assert.match(css, /background-position: 28% 73%/);
});

test("generated CSS safely quotes URLs", () => {
  const css = buildThemeCss({
    backgroundUrl: "https://example.com/image%22name.jpg",
    panelColor: "#123456",
    accent: "#abcdef",
    uiFont: "Georgia",
    codeFont: "Cascadia Code",
    uiFontSize: 18,
    codeFontSize: 15,
    lineHeight: 175,
  });
  assert.match(css, /background-image: url\("https:\/\/example\.com\/image%22name\.jpg"\)/);
  assert.match(css, /--theme-studio-accent: #abcdef/);
  assert.match(css, /rgba\(18, 52, 86,/);
  assert.match(css, /--theme-studio-ui-font: "Georgia"/);
  assert.match(css, /--theme-studio-code-font: "Cascadia Code"/);
  assert.match(css, /font-size: 18px !important/);
  assert.match(css, /--theme-studio-line-height: 1\.75/);
  assert.match(css, /--font-ui-family: var\(--theme-studio-ui-font\) !important/);
  assert.match(css, /\[class\*="_Paragraph_"\]/);
});

test("accepts local font data and emits one embedded interface face", () => {
  const fontData = "data:font/woff2;base64,d09GMgABAAAA";
  assert.equal(normalizeFontDataUrl(fontData), fontData);
  assert.equal(normalizeFontDataUrl("https://example.com/font.woff2"), "");

  const theme = normalizeTheme({
    uiFont: "Imported display name",
    uiFontDataUrl: fontData,
    uiFontFileName: "quiet-face.woff2",
  });
  assert.equal(theme.uiFontFileName, "quiet-face.woff2");

  const css = buildThemeCss({
    backgroundUrl: "https://example.com/background.jpg",
    uiFontDataUrl: fontData,
    uiFontFileName: "quiet-face.woff2",
  });
  assert.match(css, /@font-face/);
  assert.match(css, /Theme Studio Imported UI/);
  assert.match(css, /data:font\/woff2;base64,d09GMgABAAAA/);
});

test("install expression replaces one stable style element", () => {
  const expression = buildInstallExpression("body { color: red; }", {
    soundEnabled: true,
    soundId: "glass",
    soundVolume: 40,
  });
  assert.match(expression, /chatgpt-theme-studio-style/);
  assert.match(expression, /style\.textContent/);
  assert.match(expression, /__chatgptThemeStudioCompletionSound/);
  assert.match(expression, /MutationObserver/);
  assert.match(expression, /"id":"glass"/);
  assert.match(expression, /"volume":0\.4/);
});

test("accepts embedded custom audio and installs local playback", () => {
  const audioData = "data:audio/mpeg;base64,SUQzBAAAAAAA";
  assert.equal(normalizeAudioDataUrl(audioData), audioData);
  assert.equal(normalizeAudioDataUrl("https://example.com/sound.mp3"), "");
  const theme = normalizeTheme({
    soundId: "custom",
    customSoundDataUrl: audioData,
    customSoundFileName: "done.mp3",
  });
  assert.equal(theme.soundId, "custom");
  assert.equal(theme.customSoundFileName, "done.mp3");
  assert.match(buildInstallExpression("body {}", theme), /customDataUrl/);
  assert.match(buildInstallExpression("body {}", theme), /new Audio/);
});

test("completion sound expression installs and synthesizes locally", () => {
  let oscillatorStarts = 0;
  const documentElement = { dataset: {} };
  const context = {
    document: {
      documentElement,
      head: { appendChild() {} },
      getElementById() { return null; },
      createElement() { return {}; },
      querySelector() { return null; },
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    AudioContext: class {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
      }
      createOscillator() {
        return {
          frequency: { setValueAtTime() {} },
          connect(node) { return node; },
          start() { oscillatorStarts += 1; },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect(node) { return node; },
        };
      }
      close() { return Promise.resolve(); }
    },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
  };
  context.globalThis = context;
  vm.runInNewContext(buildInstallExpression("body {}", {
    soundEnabled: true,
    soundId: "pulse",
    soundVolume: 60,
  }), context);

  assert.equal(typeof context.__chatgptThemeStudioCompletionSound.play, "function");
  assert.equal(context.__chatgptThemeStudioCompletionSound.play(), true);
  assert.equal(oscillatorStarts, 3);
  context.__chatgptThemeStudioCompletionSound.disconnect();
});
