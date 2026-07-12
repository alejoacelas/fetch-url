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
