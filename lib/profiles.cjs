const { normalizeTheme } = require("./theme.cjs");

const THEME_FILE_FORMAT = "chatgpt-theme-studio";
const THEME_FILE_VERSION = 1;
const MAX_PROFILES = 12;

function normalizeProfileName(value) {
  const name = String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Enter a profile name first.");
  if (name.length > 40) throw new Error("Keep profile names to 40 characters or fewer.");
  return name;
}

function themeForProfile(input) {
  return { ...normalizeTheme(input), enabled: false };
}

function normalizeProfilesFile(input) {
  const source = Array.isArray(input?.profiles) ? input.profiles : [];
  const seen = new Set();
  const profiles = [];

  for (const item of source) {
    if (!item || typeof item !== "object" || profiles.length >= MAX_PROFILES) continue;
    const id = String(item.id || "").trim();
    if (!/^[a-z0-9-]{8,80}$/i.test(id) || seen.has(id)) continue;
    try {
      profiles.push({
        id,
        name: normalizeProfileName(item.name),
        theme: themeForProfile(item.theme),
        updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : 0,
      });
      seen.add(id);
    } catch {
      // Skip malformed entries while preserving every usable local profile.
    }
  }

  return profiles;
}

function serializeThemeFile(input) {
  return `${JSON.stringify({
    format: THEME_FILE_FORMAT,
    version: THEME_FILE_VERSION,
    theme: themeForProfile(input),
  }, null, 2)}\n`;
}

function parseThemeFile(text) {
  let file;
  try {
    file = JSON.parse(String(text || ""));
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (file?.format !== THEME_FILE_FORMAT || file?.version !== THEME_FILE_VERSION || !file.theme) {
    throw new Error("Choose a ChatGPT Theme Studio export file.");
  }
  return themeForProfile(file.theme);
}

module.exports = {
  MAX_PROFILES,
  THEME_FILE_FORMAT,
  normalizeProfileName,
  normalizeProfilesFile,
  parseThemeFile,
  serializeThemeFile,
  themeForProfile,
};
