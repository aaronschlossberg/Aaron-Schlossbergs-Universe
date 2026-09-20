import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

const PACKAGE_ROOT = path.join(
    SITE_ROOT,
    "node_modules",
    "@fontsource",
    "lora"
);

const OUTPUT_ROOT = path.join(
    SITE_ROOT,
    "assets",
    "fonts"
);

const fontFiles = [
    "lora-latin-400-normal.woff2",
    "lora-latin-400-italic.woff2",
    "lora-latin-600-normal.woff2",
    "lora-latin-600-italic.woff2",
    "lora-latin-700-normal.woff2",
    "lora-latin-700-italic.woff2"
];

await mkdir(OUTPUT_ROOT, {
    recursive: true
});

for (const filename of fontFiles) {
    await copyFile(
        path.join(PACKAGE_ROOT, "files", filename),
        path.join(OUTPUT_ROOT, filename)
    );
}

await copyFile(
    path.join(PACKAGE_ROOT, "LICENSE"),
    path.join(OUTPUT_ROOT, "Lora-LICENSE.txt")
);

console.log(
    `Copied ${fontFiles.length} self-hosted Lora font files.`
);
