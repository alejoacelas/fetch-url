import assert from "node:assert/strict";
import test from "node:test";
import { extractHtml } from "../src/extract.js";

test("extracts readable Markdown, metadata, and absolute image URLs", () => {
  const html = `<!doctype html><html lang="en"><head><title>A useful page</title>
    <meta name="author" content="Ada"><meta name="description" content="A summary"></head>
    <body><main><h1>A useful page</h1><p>This is a substantial paragraph with enough text for article extraction and testing.</p>
    <img src="/photo.jpg" alt="Photo"></main></body></html>`;
  const result = extractHtml(html, "https://example.com/post", "text/html");
  assert.match(result.markdown, /substantial paragraph/);
  assert.equal(result.metadata.title, "A useful page");
  assert.equal(result.metadata.language, "en");
  assert.deepEqual(result.images, [{ url: "https://example.com/photo.jpg", alt: "Photo" }]);
});
