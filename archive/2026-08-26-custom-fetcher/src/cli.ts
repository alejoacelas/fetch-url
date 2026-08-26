#!/usr/bin/env node
import { Command } from "commander";
import { fetchUrl } from "./fetch-url.js";
import type { Strategy } from "./types.js";

const program = new Command()
  .name("fetch-url")
  .description("Fetch a web page as clean Markdown, with Firecrawl and archive fallbacks.")
  .argument("<url>", "URL to fetch")
  .option("--strategy <strategy>", "auto, direct, firecrawl, or archive", "auto")
  .option("--images", "include image URLs in JSON output")
  .option("--metadata", "include page metadata in JSON output")
  .option("--json", "print the full structured result")
  .option("--timeout <seconds>", "timeout for each attempt", "30")
  .action(async (url, flags) => {
    if (!["auto", "direct", "firecrawl", "archive"].includes(flags.strategy)) {
      program.error(`Unknown strategy: ${flags.strategy}`);
    }
    const result = await fetchUrl(url, {
      strategy: flags.strategy as Strategy,
      includeImages: flags.images,
      includeMetadata: flags.metadata,
      timeoutMs: Number(flags.timeout) * 1000,
    });
    process.stdout.write(flags.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.markdown}\n`);
  });

program.parseAsync().catch((error: Error) => {
  process.stderr.write(`fetch-url: ${error.message}\n`);
  process.exitCode = 1;
});
