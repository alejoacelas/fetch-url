#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchUrl } from "../dist/index.js";

const [reportPath, outputDirectory] = process.argv.slice(2);
if (!reportPath || !outputDirectory) {
  process.stderr.write("usage: node scripts/save-comparison-pages.mjs <benchmark raw.json> <output directory>\n");
  process.exit(1);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const urls = report.firecrawlComparisons.map((item) => item.url);
await mkdir(outputDirectory, { recursive: true });
const manifest = [];
let next = 0;
let done = 0;

async function worker() {
  while (true) {
    const index = next++;
    if (index >= urls.length) return;
    const url = urls[index];
    const id = String(index + 1).padStart(3, "0");
    const entry = { id, url, host: new URL(url).hostname };
    for (const strategy of ["direct", "firecrawl"]) {
      try {
        const result = await fetchUrl(url, { strategy, includeMetadata: true, timeoutMs: 30_000 });
        const filename = `${id}-${strategy}.md`;
        await writeFile(join(outputDirectory, filename), `${result.markdown}\n`);
        entry[strategy] = {
          ok: true,
          filename,
          characters: result.markdown.length,
          title: result.metadata?.title,
        };
      } catch (error) {
        entry[strategy] = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    manifest[index] = entry;
    done++;
    if (done % 10 === 0 || done === urls.length) process.stderr.write(`saved: ${done}/${urls.length}\n`);
  }
}

await Promise.all(Array.from({ length: 3 }, worker));
await writeFile(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
