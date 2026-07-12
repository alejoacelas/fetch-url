#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const urls = process.argv.slice(2);

if (urls.length === 0) {
  process.stderr.write("usage: node scripts/compare-strategies.mjs <url> [url ...]\n");
  process.exit(1);
}

process.stdout.write("strategy\turl\tresult\tcharacters\tseconds\ttitle\n");
for (const url of urls) {
  for (const strategy of ["direct", "firecrawl"]) {
    const start = performance.now();
    try {
      const { stdout } = await execFileAsync("./dist/cli.js", [url, "--strategy", strategy, "--json", "--metadata"]);
      const result = JSON.parse(stdout);
      const seconds = ((performance.now() - start) / 1000).toFixed(1);
      const title = (result.metadata?.title ?? "").replaceAll(/[\t\r\n]/g, " ");
      process.stdout.write(`${strategy}\t${url}\tok\t${result.markdown.length}\t${seconds}\t${title}\n`);
    } catch (error) {
      const seconds = ((performance.now() - start) / 1000).toFixed(1);
      const message = String(error.stderr ?? error.message).replaceAll(/[\t\r\n]/g, " ").slice(0, 240);
      process.stdout.write(`${strategy}\t${url}\tfail: ${message}\t0\t${seconds}\t\n`);
    }
  }
}
