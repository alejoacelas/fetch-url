import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import type { ImageInfo, PageMetadata } from "./types.js";

export interface Extraction {
  markdown: string;
  metadata: PageMetadata;
  images: ImageInfo[];
}

function meta(document: Document, ...selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content")?.trim();
    if (value) return value;
  }
}

export function extractHtml(html: string, url: string, contentType?: string): Extraction {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const images = [...document.querySelectorAll("img[src]")]
    .map((image) => ({
      url: new URL(image.getAttribute("src")!, url).href,
      alt: image.getAttribute("alt")?.trim() || undefined,
    }))
    .filter((image, index, all) => all.findIndex((item) => item.url === image.url) === index);

  const article = new Readability(document.cloneNode(true) as Document).parse();
  const content = article?.content ?? document.body?.innerHTML ?? html;
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  const markdown = turndown.turndown(content).trim();
  const metadata: PageMetadata = {
    title: article?.title || document.title || meta(document, 'meta[property="og:title"]'),
    byline: article?.byline || meta(document, 'meta[name="author"]'),
    excerpt: article?.excerpt || meta(document, 'meta[name="description"]', 'meta[property="og:description"]'),
    siteName: article?.siteName || meta(document, 'meta[property="og:site_name"]'),
    publishedTime: article?.publishedTime || meta(document, 'meta[property="article:published_time"]'),
    language: document.documentElement.lang || undefined,
    contentType,
  };

  return { markdown, metadata, images };
}
