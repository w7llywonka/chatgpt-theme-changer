const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function renderIcon() {
  const svg = await fs.readFile(path.join(__dirname, "..", "renderer", "icon.svg"), "utf8");
  const outputDirectory = path.join(__dirname, "..", "build");
  await fs.mkdir(outputDirectory, { recursive: true });
  await sharp(Buffer.from(svg)).resize(256, 256).png().toFile(path.join(outputDirectory, "icon.png"));
}

renderIcon().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
