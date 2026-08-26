#!/usr/bin/env node
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fetchUrl } from "../dist/index.js";

const execFileAsync = promisify(execFile);
const outputPath = process.argv[2];
const targetCount = Number(process.argv[3] ?? 200);
const comparisonCount = Number(process.argv[4] ?? 50);
const previousReportPath = process.argv[5];
const maxPerHost = 4;

if (!outputPath || !Number.isInteger(targetCount) || targetCount < 1) {
  process.stderr.write("usage: node scripts/benchmark-history.mjs <output.json> [URL count] [Firecrawl comparison count] [previous report]\n");
  process.exit(1);
}

const blockedHosts = [
  "accounts.google.", "calendar.google.", "chat.google.", "docs.google.", "drive.google.",
  "mail.google.", "myaccount.google.", "app.asana.com", "app.slack.com", "claude.ai",
  "airtable.com", "calendly.com", "figma.com", "icloud.com", "linear.app", "localhost",
  "notion.so", "slack.com", "vercel.com", "wa.me",
];
const blockedPath = /\/(account|admin|application-authorization|auth|balances|billing|chat|dashboard|inbox|invite|invitees|login|logout|oauth|settings|signin|signup)(\/|$)/i;
const searchHosts = /(^|\.)(bing\.com|duckduckgo\.com|google\.[a-z.]+|search\.brave\.com)$/i;

function allowed(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return false;
    if (blockedHosts.some((blocked) => host === blocked || host.includes(blocked))) return false;
    if (searchHosts.test(host) || blockedPath.test(url.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function historyUrls() {
  const chrome = join(homedir(), "Library/Application Support/Google/Chrome");
  const profiles = ["Default", "Profile 1", "Profile 2"];
  const rows = [];
  for (const profile of profiles) {
    const database = join(chrome, profile, "History");
    let snapshotDirectory;
    try {
      const query = "SELECT url || char(9) || last_visit_time FROM urls WHERE url LIKE 'https://%' ORDER BY last_visit_time DESC";
      let stdout;
      try {
        ({ stdout } = await execFileAsync("sqlite3", ["-readonly", database, query], { maxBuffer: 50 * 1024 * 1024 }));
      } catch {
        snapshotDirectory = await mkdtemp(join(tmpdir(), "fetch-url-history-"));
        const snapshot = join(snapshotDirectory, "History");
        await copyFile(database, snapshot);
        for (const suffix of ["-wal", "-shm"]) {
          try { await copyFile(`${database}${suffix}`, `${snapshot}${suffix}`); } catch {}
        }
        ({ stdout } = await execFileAsync("sqlite3", ["-readonly", snapshot, query], { maxBuffer: 50 * 1024 * 1024 }));
        process.stderr.write(`Read ${profile} from a consistent local snapshot.\n`);
      }
      for (const line of stdout.split("\n")) {
        const split = line.lastIndexOf("\t");
        if (split > 0) rows.push({ url: line.slice(0, split), visited: Number(line.slice(split + 1)) });
      }
    } catch (error) {
      process.stderr.write(`Skipping ${profile}: ${error.message}\n`);
    } finally {
      if (snapshotDirectory) await rm(snapshotDirectory, { recursive: true, force: true });
    }
  }
  const previousUrls = new Set();
  if (previousReportPath) {
    const previous = JSON.parse(await readFile(previousReportPath, "utf8"));
    for (const result of previous.direct ?? []) previousUrls.add(result.url);
  }
  const seen = new Set();
  const perHost = new Map();
  return rows
    .sort((a, b) => b.visited - a.visited)
    .filter(({ url }) => {
      if (seen.has(url) || previousUrls.has(url) || !allowed(url)) return false;
      const host = new URL(url).hostname.toLowerCase();
      const count = perHost.get(host) ?? 0;
      if (count >= maxPerHost) return false;
      seen.add(url);
      perHost.set(host, count + 1);
      return true;
    })
    .slice(0, targetCount)
    .map(({ url }) => url);
}

function wordCount(markdown) {
  return (markdown.match(/\b[\p{L}]{2,}\b/gu) ?? []).length;
}

async function measure(url, strategy) {
  const started = performance.now();
  try {
    const result = await fetchUrl(url, { strategy, includeMetadata: true, timeoutMs: 30_000 });
    return {
      url,
      host: new URL(url).hostname,
      strategy,
      ok: true,
      elapsedMs: Math.round(performance.now() - started),
      source: result.source,
      characters: result.markdown.length,
      words: wordCount(result.markdown),
      title: result.metadata?.title,
      contentType: result.metadata?.contentType,
      attempts: result.attempts,
    };
  } catch (error) {
    return {
      url,
      host: new URL(url).hostname,
      strategy,
      ok: false,
      elapsedMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapConcurrent(items, concurrency, task, label) {
  const results = new Array(items.length);
  let next = 0;
  let finished = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
      finished++;
      if (finished % 10 === 0 || finished === items.length) {
        process.stderr.write(`${label}: ${finished}/${items.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const urls = await historyUrls();
if (urls.length < targetCount) process.stderr.write(`Only ${urls.length} URLs passed the filters.\n`);

const direct = await mapConcurrent(urls, 6, (url) => measure(url, "direct"), "direct");
const failedUrls = direct.filter((result) => !result.ok).map((result) => result.url);
const firecrawlRescues = await mapConcurrent(failedUrls, 4, (url) => measure(url, "firecrawl"), "failure Firecrawl");

const successes = direct.filter((result) => result.ok).sort((a, b) => a.characters - b.characters);
const comparisonUrls = Array.from({ length: Math.min(comparisonCount, successes.length) }, (_, index) => {
  const position = Math.floor(index * successes.length / Math.min(comparisonCount, successes.length));
  return successes[position].url;
});
const firecrawlComparisons = await mapConcurrent(comparisonUrls, 4, (url) => measure(url, "firecrawl"), "comparison Firecrawl");

const report = {
  generatedAt: new Date().toISOString(),
  configuration: {
    targetCount,
    selectedCount: urls.length,
    comparisonCount: comparisonUrls.length,
    maxPerHost,
    timeoutMs: 30_000,
    directConcurrency: 6,
    firecrawlConcurrency: 4,
  },
  direct,
  firecrawlRescues,
  firecrawlComparisons,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stderr.write(`Wrote ${outputPath}\n`);
