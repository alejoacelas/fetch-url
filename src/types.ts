export type Strategy = "auto" | "direct" | "firecrawl" | "archive";

export interface FetchOptions {
  strategy?: Strategy;
  includeImages?: boolean;
  includeMetadata?: boolean;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface Attempt {
  method: Exclude<Strategy, "auto">;
  ok: boolean;
  url: string;
  status?: number;
  reason?: string;
}

export interface ImageInfo {
  url: string;
  alt?: string;
}

export interface PageMetadata {
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  publishedTime?: string;
  language?: string;
  contentType?: string;
}

export interface FetchResult {
  requestedUrl: string;
  resolvedUrl: string;
  source: Exclude<Strategy, "auto">;
  fetchedAt: string;
  markdown: string;
  metadata?: PageMetadata;
  images?: ImageInfo[];
  attempts: Attempt[];
}
