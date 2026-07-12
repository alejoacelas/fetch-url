import assert from "node:assert/strict";
import test from "node:test";
import { fetchUrl } from "../src/fetch-url.js";

const html = `<html><head><title>Example</title></head><body><article><h1>Example</h1><p>${"Useful content. ".repeat(12)}</p></article></body></html>`;

test("fetches and extracts a page directly", async () => {
  const fakeFetch: typeof fetch = async () => new Response(html, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
  const result = await fetchUrl("https://example.com", { fetch: fakeFetch, includeMetadata: true });
  assert.equal(result.source, "direct");
  assert.match(result.markdown, /Useful content/);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.metadata?.title, "Example");
});

test("falls back to an archived snapshot", async () => {
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("archive.org/wayback/available")) {
      return Response.json({ archived_snapshots: { closest: { available: true, url: "http://web.archive.org/web/20200101/https://example.com" } } });
    }
    if (url.startsWith("https://web.archive.org/")) return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    return new Response("blocked", { status: 403 });
  };
  const oldKey = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  try {
    const result = await fetchUrl("https://example.com", { fetch: fakeFetch });
    assert.equal(result.source, "archive");
    assert.deepEqual(result.attempts.map((attempt) => attempt.method), ["direct", "firecrawl", "archive"]);
  } finally {
    if (oldKey) process.env.FIRECRAWL_API_KEY = oldKey;
  }
});

test("rejects long identifier lists as unusable content", async () => {
  const identifierShell = `<html><body><main><a href="/">9GAG</a><p>axyX2qY,aVvNWjd,ayNOpx8,a87BbOZ,a9y9MdD,aLnyPRP,aMV3bWV,abA95dX,aBy7KE1,amoEXGd</p></main></body></html>`;
  const fakeFetch: typeof fetch = async () => new Response(identifierShell, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(
    fetchUrl("https://example.com", { fetch: fakeFetch, strategy: "direct" }),
    /content is not usable prose/,
  );
});

test("uses Firecrawl response metadata instead of its main-content fragment", async () => {
  const fakeFetch: typeof fetch = async () => Response.json({
    success: true,
    data: {
      markdown: "A complete article with enough natural language words to satisfy the content quality check.",
      html: "<main><p>A complete article with enough natural language words to satisfy the content quality check.</p></main>",
      metadata: {
        title: "Firecrawl title",
        description: "Firecrawl description",
        sourceURL: "https://example.com/resolved",
        contentType: "text/html; charset=utf-8",
      },
    },
  });
  const oldKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  try {
    const result = await fetchUrl("https://example.com", {
      fetch: fakeFetch,
      strategy: "firecrawl",
      includeMetadata: true,
    });
    assert.equal(result.metadata?.title, "Firecrawl title");
    assert.equal(result.metadata?.excerpt, "Firecrawl description");
    assert.equal(result.resolvedUrl, "https://example.com/resolved");
  } finally {
    if (oldKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = oldKey;
  }
});
