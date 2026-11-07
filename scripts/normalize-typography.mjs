import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeHtmlTypography, normalizeJsonTypography } from "./site-typography.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["_site", "node_modules", "content", "scripts"]);

export async function normalizeSiteTypography(root = ROOT, { check = false } = {}) {
    const changes = [];
    async function walk(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(file);
            } else if (entry.isFile()) {
                const relative = path.relative(root, file).split(path.sep).join("/");
                const isHtml = entry.name.endsWith(".html");
                const isData = entry.name.endsWith(".webmanifest")
                    || (entry.name.endsWith(".json") && /^(?:data|assets\/data)\//.test(relative));
                if (!isHtml && !isData) continue;
                const original = await readFile(file, "utf8");
                const normalized = isHtml ? normalizeHtmlTypography(original) : normalizeJsonTypography(original);
                if (original !== normalized) changes.push({ file, relative, normalized });
            }
        }
    }
    await walk(root);
    if (!check) {
        for (const { file, normalized } of changes) await writeFile(file, normalized, "utf8");
    }
    return changes.map(({ relative }) => relative).sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes("--check");
    const changes = await normalizeSiteTypography(ROOT, { check });
    if (check && changes.length) {
        console.error(`Fix slash spacing or move quotation marks outside links and formatting in:\n${changes.map(file => `  ${file}`).join("\n")}\nRun npm run typography to fix them.`);
        process.exitCode = 1;
    } else {
        console.log(check ? "Site typography is up to date." : `Applied site typography (${changes.length} files updated).`);
    }
}
