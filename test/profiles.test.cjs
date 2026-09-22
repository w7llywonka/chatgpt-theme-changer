const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeProfileName,
  normalizeProfilesFile,
  parseThemeFile,
  serializeThemeFile,
} = require("../lib/profiles.cjs");

test("theme exports round-trip embedded local assets", () => {
  const source = {
    backgroundUrl: "data:image/png;base64,iVBORw0KGgo=",
    uiFontDataUrl: "data:font/woff2;base64,d09GMgABAAAA",
    uiFontFileName: "quiet.woff2",
    customSoundDataUrl: "data:audio/mpeg;base64,SUQzBAAAAAAA",
    customSoundFileName: "done.mp3",
    soundId: "custom",
  };
  const restored = parseThemeFile(serializeThemeFile(source));
  assert.equal(restored.backgroundUrl, source.backgroundUrl);
  assert.equal(restored.uiFontDataUrl, source.uiFontDataUrl);
  assert.equal(restored.customSoundDataUrl, source.customSoundDataUrl);
  assert.equal(restored.soundId, "custom");
  assert.equal(restored.enabled, false);
});

test("profile storage keeps valid unique profiles only", () => {
  const profiles = normalizeProfilesFile({ profiles: [
    { id: "profile-one", name: "Night coding", theme: {}, updatedAt: 10 },
    { id: "profile-one", name: "Duplicate", theme: {}, updatedAt: 11 },
    { id: "bad", name: "Invalid id", theme: {} },
  ] });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, "Night coding");
  assert.equal(normalizeProfileName("  Soft   glass  "), "Soft glass");
  assert.throws(() => normalizeProfileName(""), /profile name/i);
});

test("theme imports reject unrelated JSON", () => {
  assert.throws(() => parseThemeFile('{"theme":{}}'), /Theme Studio export/);
  assert.throws(() => parseThemeFile("not json"), /valid JSON/);
});
