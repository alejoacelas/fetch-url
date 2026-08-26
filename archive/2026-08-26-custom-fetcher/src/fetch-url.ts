import { extractHtml } from "./extract.js";
import type { Attempt, FetchOptions, FetchResult, PageMetadata, Strategy } from "./types.js";

const USER_AGENT = "fetch-url/0.1 (+https://github.com/alejoacelas/fetch-url)";

class FetchFailure extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function validateUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }
  return url;
}

async function direct(url: string, fetcher: typeof fetch, timeoutMs: number) {
  const response = await fetcher(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
  });
  if (!response.ok) throw new FetchFailure(`HTTP ${response.status}`, response.status);
  const contentType = response.headers.get("content-type") ?? undefined;
  if (contentType && !contentType.includes("html") && !contentType.startsWith("text/")) {
    throw new FetchFailure(`Unsupported content type: ${contentType}`, response.status);
  }
  const body = await response.text();
  if (!body.trim()) throw new FetchFailure("Empty response", response.status);
  return { body, resolvedUrl: response.url || url, contentType, status: response.status };
}

async function firecrawl(url: string, fetcher: typeof fetch, timeoutMs: number) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new FetchFailure("FIRECRAWL_API_KEY is not configured");
  const base = process.env.FIRECRAWL_API_URL ?? "https://api.firecrawl.dev";
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetcher(`${base.replace(/\/$/, "")}/v2/scrape`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: true }),
    });
    if (response.status !== 429 && response.status < 500) break;
    if (attempt === 2) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5_000)));
  }
  if (!response) throw new FetchFailure("Firecrawl returned no response");
  if (!response.ok) throw new FetchFailure(`Firecrawl HTTP ${response.status}`, response.status);
  const payload = (await response.json()) as {
    success?: boolean;
    data?: { markdown?: string; html?: string; metadata?: Record<string, unknown> };
  };
  if (!payload.success || !payload.data) throw new FetchFailure("Firecrawl returned no content");
  return payload.data;
}

function firecrawlMetadata(raw: Record<string, unknown> | undefined): PageMetadata {
  const value = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      if (typeof raw?.[key] === "string" && raw[key]) return raw[key] as string;
    }
  };
  return {
    title: value("title", "ogTitle", "og:title"),
    byline: value("author", "article:author"),
    excerpt: value("description", "ogDescription", "og:description"),
    siteName: value("ogSiteName", "og:site_name"),
    publishedTime: value("publishedTime", "article:published_time"),
    language: value("language"),
    contentType: value("contentType"),
  };
}

function firecrawlStatus(raw: Record<string, unknown> | undefined): number | undefined {
  return typeof raw?.statusCode === "number" ? raw.statusCode : undefined;
}

async function archivedUrl(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<string> {
  const endpoint = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const response = await fetcher(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new FetchFailure(`Archive lookup HTTP ${response.status}`, response.status);
  const payload = (await response.json()) as {
    archived_snapshots?: { closest?: { available?: boolean; url?: string; status?: string } };
  };
  const closest = payload.archived_snapshots?.closest;
  if (!closest?.available || !closest.url) throw new FetchFailure("No archived snapshot found");
  return closest.url.replace(/^http:/, "https:");
}

function usable(markdown: string): boolean {
  const normalized = markdown.replace(/\s+/g, " ").trim();
  const visibleText = normalized
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
  const naturalWords = visibleText.match(/\b[\p{L}]{2,}\b/gu) ?? [];
  const linkCharacters = [...normalized.matchAll(/!?\[[^\]]*\]\([^)]*\)/g)]
    .reduce((total, match) => total + match[0].length, 0);
  const linkHeavyShell = normalized.length < 1_500 && linkCharacters / normalized.length > 0.65;
  const shortShell = normalized.length < 1_000 && /(subscribe to (our|the) newsletter|enable javascript|javascript (is|appears to be) disabled|sign in( to continue)?|log in( to continue)?|invalid link|error 404|page not found|redirecting you)/i.test(visibleText);
  return normalized.length >= 80 && naturalWords.length >= 8 && !linkHeavyShell && !shortShell;
}

export async function fetchUrl(input: string, options: FetchOptions = {}): Promise<FetchResult> {
  const requestedUrl = validateUrl(input).href;
  const strategy: Strategy = options.strategy ?? "auto";
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const attempts: Attempt[] = [];
  const methods = strategy === "auto" ? (["direct", "firecrawl", "archive"] as const) : [strategy];

  for (const method of methods) {
    try {
      if (method === "firecrawl") {
        const data = await firecrawl(requestedUrl, fetcher, timeoutMs);
        const status = firecrawlStatus(data.metadata);
        if (status !== undefined && status >= 400) throw new FetchFailure(`Firecrawl destination HTTP ${status}`, status);
        const extraction = data.html ? extractHtml(data.html, requestedUrl, "text/html") : undefined;
        const markdown = data.markdown?.trim() || extraction?.markdown || "";
        if (!usable(markdown)) throw new FetchFailure("Extracted content is not usable prose");
        const apiMetadata = firecrawlMetadata(data.metadata);
        const metadata = Object.fromEntries(
          Object.entries({ ...extraction?.metadata, ...apiMetadata }).filter(([, value]) => value !== undefined),
        ) as PageMetadata;
        const resolvedUrl = typeof data.metadata?.sourceURL === "string"
          ? data.metadata.sourceURL
          : typeof data.metadata?.url === "string" ? data.metadata.url : requestedUrl;
        attempts.push({ method, ok: true, url: requestedUrl, status: status ?? 200 });
        return {
          requestedUrl,
          resolvedUrl,
          source: method,
          fetchedAt: new Date().toISOString(),
          markdown,
          metadata: options.includeMetadata ? metadata : undefined,
          images: options.includeImages ? extraction?.images : undefined,
          attempts,
        };
      }

      const target = method === "archive" ? await archivedUrl(requestedUrl, fetcher, timeoutMs) : requestedUrl;
      const response = await direct(target, fetcher, timeoutMs);
      const extraction = extractHtml(response.body, response.resolvedUrl, response.contentType);
      if (!usable(extraction.markdown)) throw new FetchFailure("Extracted content is not usable prose", response.status);
      attempts.push({ method, ok: true, url: target, status: response.status });
      return {
        requestedUrl,
        resolvedUrl: response.resolvedUrl,
        source: method,
        fetchedAt: new Date().toISOString(),
        markdown: extraction.markdown,
        metadata: options.includeMetadata ? extraction.metadata : undefined,
        images: options.includeImages ? extraction.images : undefined,
        attempts,
      };
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      attempts.push({
        method,
        ok: false,
        url: requestedUrl,
        status: failure instanceof FetchFailure ? failure.status : undefined,
        reason: failure.message,
      });
    }
  }

  throw new Error(`Could not fetch ${requestedUrl}: ${attempts.map((a) => `${a.method}: ${a.reason}`).join("; ")}`);
}
