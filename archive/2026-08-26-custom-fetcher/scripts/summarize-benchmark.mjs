#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, archivePath, outputPath, comparisonReportPath] = process.argv.slice(2);
if (!inputPath || !archivePath || !outputPath) {
  process.stderr.write("usage: node scripts/summarize-benchmark.mjs <benchmark raw.json> <archive results.json> <stats.json> [comparison raw.json]\n");
  process.exit(1);
}

const report = JSON.parse(await readFile(inputPath, "utf8"));
const archive = JSON.parse(await readFile(archivePath, "utf8"));
const comparisonReport = comparisonReportPath
  ? JSON.parse(await readFile(comparisonReportPath, "utf8"))
  : report;
const ok = (items) => items.filter((item) => item.ok);
const failed = (items) => items.filter((item) => !item.ok);
const percentile = (values, fraction) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};
const group = (values) => Object.entries(values.reduce((counts, value) => {
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {})).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
const reason = (item, strategy) => item.error?.split(`: ${strategy}: `).at(-1) ?? "unknown";
const maximum = (values) => values.length === 0 ? null : Math.max(...values);
const rate = (numerator, denominator) => denominator === 0 ? null : numerator / denominator;

const directByUrl = new Map(ok(comparisonReport.direct).map((item) => [item.url, item]));
const comparisons = ok(comparisonReport.firecrawlComparisons).map((item) => ({
  direct: directByUrl.get(item.url).characters,
  firecrawl: item.characters,
  ratio: item.characters / directByUrl.get(item.url).characters,
}));
const ratios = comparisons.map((item) => item.ratio);
const combinedSuccesses = ok(report.direct).length + ok(report.firecrawlRescues).length;

const statistics = {
  generatedAt: new Date().toISOString(),
  sample: {
    urls: report.direct.length,
    distinctHosts: new Set(report.direct.map((item) => item.host)).size,
    maxUrlsPerHost: report.configuration.maxPerHost,
    firecrawlCalls: report.firecrawlRescues.length + comparisonReport.firecrawlComparisons.length,
  },
  direct: {
    successes: ok(report.direct).length,
    failures: failed(report.direct).length,
    successRate: rate(ok(report.direct).length, report.direct.length),
    latencyMs: {
      median: percentile(report.direct.map((item) => item.elapsedMs), 0.5),
      p95: percentile(report.direct.map((item) => item.elapsedMs), 0.95),
    },
    characters: {
      median: percentile(ok(report.direct).map((item) => item.characters), 0.5),
      p95: percentile(ok(report.direct).map((item) => item.characters), 0.95),
      maximum: maximum(ok(report.direct).map((item) => item.characters)),
    },
    failureClasses: group(failed(report.direct).map((item) => reason(item, "direct"))),
  },
  firecrawlRescue: {
    attempts: report.firecrawlRescues.length,
    successes: ok(report.firecrawlRescues).length,
    failures: failed(report.firecrawlRescues).length,
    rescueRate: rate(ok(report.firecrawlRescues).length, report.firecrawlRescues.length),
    combinedSuccesses,
    combinedSuccessRate: rate(combinedSuccesses, report.direct.length),
    latencyMs: {
      median: percentile(report.firecrawlRescues.map((item) => item.elapsedMs), 0.5),
      p95: percentile(report.firecrawlRescues.map((item) => item.elapsedMs), 0.95),
    },
    characters: {
      median: percentile(ok(report.firecrawlRescues).map((item) => item.characters), 0.5),
      maximum: maximum(ok(report.firecrawlRescues).map((item) => item.characters)),
      over100000: ok(report.firecrawlRescues).filter((item) => item.characters > 100_000).length,
    },
    failureClasses: group(failed(report.firecrawlRescues).map((item) => reason(item, "firecrawl"))),
  },
  firecrawlComparison: {
    attempts: comparisonReport.firecrawlComparisons.length,
    pairedSuccesses: comparisons.length,
    failures: failed(comparisonReport.firecrawlComparisons).length,
    markdownSizeRatio: {
      p25: percentile(ratios, 0.25),
      median: percentile(ratios, 0.5),
      p75: percentile(ratios, 0.75),
    },
    firecrawlAtLeast20PercentLonger: comparisons.filter((item) => item.ratio > 1.2).length,
    firecrawlAtLeast2x: comparisons.filter((item) => item.ratio >= 2).length,
    firecrawlAtLeast10x: comparisons.filter((item) => item.ratio >= 10).length,
    within20Percent: comparisons.filter((item) => item.ratio >= 0.8 && item.ratio <= 1.2).length,
    firecrawlAtLeast20PercentShorter: comparisons.filter((item) => item.ratio < 0.8).length,
    maximumCharacters: maximum(comparisons.map((item) => item.firecrawl)),
    over100000Characters: comparisons.filter((item) => item.firecrawl > 100_000).length,
  },
  archiveAfterBothFailed: {
    attempts: archive.length,
    successes: ok(archive).length,
    failures: failed(archive).length,
    latencyMs: { median: percentile(archive.map((item) => item.elapsedMs), 0.5) },
    failureClasses: group(failed(archive).map((item) => reason(item, "archive"))),
  },
};

await writeFile(outputPath, `${JSON.stringify(statistics, null, 2)}\n`);
