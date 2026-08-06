<!--ai-->
# Implementation options

## Recommendation

Build a staged local CLI, not a Firecrawl-only wrapper:

1. Native `fetch` for the common case: no API key, low latency, no usage cost.
2. Firecrawl when direct retrieval is blocked or returns unusable content.
3. Internet Archive when the live page cannot be retrieved.
4. Add a local browser only if testing shows a meaningful gap between direct HTTP and Firecrawl.

The current release implements 1–3 for single HTML pages. It keeps retrieval separate from extraction so PDF, browser, and site-crawl adapters can be added without changing the output shape.

## Retrieval choices

| Option | Handles JavaScript | Handles anti-bot measures | Account/cost | Local weight | Use here |
|---|---:|---:|---|---:|---|
| Node `fetch` | No | Rarely | None | None | First attempt |
| [Firecrawl scrape API](https://docs.firecrawl.dev/features/scrape) | Yes | Yes | API key; usage-based | None | Hosted fallback |
| [Playwright](https://playwright.dev/docs/browsers) | Yes | Sometimes | None per request | Chromium is hundreds of MB | Optional local fallback |
| [Wayback availability API](https://archive.org/help/wayback_api.php) | Snapshot only | Avoids the live host | None; rate-limit politely | None | Dead/broken-page fallback |
| Browserless / Browserbase | Yes | Varies | Account; usage-based | None | Alternative to Firecrawl when browser control matters more than clean extraction |

Firecrawl is the best hosted default because one scrape request can return Markdown, HTML, links, screenshots, and structured data. Calling its HTTP API directly avoids coupling the project to an SDK.

Playwright should not be installed by default. Its browser gives control over waits, clicks, cookies, and screenshots, but each Playwright version requires matching browser binaries. Add `--strategy browser` when authenticated pages or client-rendered pages routinely fail both direct retrieval and Firecrawl.

Archive lookup should remain a fallback, not a transparent replacement. Archived content may be old, incomplete, or rewritten by the replay layer. The result must expose the snapshot URL and source.

## Extraction choices

| Dependency | Job | Decision |
|---|---|---|
| [Mozilla Readability](https://github.com/mozilla/readability) | Main article, title, byline, excerpt | Use. It is Firefox Reader View's standalone extractor. |
| [jsdom](https://github.com/jsdom/jsdom) | Parse HTML for Readability in Node | Use with scripts/resources disabled. |
| [Turndown](https://github.com/mixmark-io/turndown) | Convert selected HTML to Markdown | Use. Small and configurable. |
| Cheerio | Fast DOM selection | Skip initially; jsdom already supplies the DOM. |
| `@extractus/article-extractor` | Bundled fetching and extraction | Skip; its fetching policy would overlap the staged pipeline. |
| `html-to-text` | Plain-text output | Add only when `--format text` is requested. |

Readability intentionally removes surrounding page chrome. A future `--scope full` should convert the full body instead of the Readability article; `--scope main` should remain the default.

## Output contract

Markdown goes to stdout by default so the command composes with shell tools. `--json` returns:

```json
{
  "requestedUrl": "https://example.com/post",
  "resolvedUrl": "https://example.com/post",
  "source": "direct",
  "fetchedAt": "2026-07-12T12:00:00.000Z",
  "markdown": "# Title\n\nContent",
  "metadata": { "title": "Title" },
  "images": [{ "url": "https://example.com/image.jpg", "alt": "Description" }],
  "attempts": [{ "method": "direct", "ok": true, "status": 200 }]
}
```

Keep provenance fields mandatory. Metadata and images are opt-in because large image lists waste context when an LLM only needs prose.

## Next slices

1. `--scope main|full` and `--format markdown|text|html|json`.
2. PDF extraction using `pdfjs-dist`; route by response `Content-Type`.
3. Image downloads with a byte cap, MIME validation, deduplication, and a manifest. Keep URL listing as the default.
4. Optional Playwright adapter with configurable wait conditions and screenshot output.
5. `--crawl` for same-origin pages with depth/page/concurrency limits. Use Firecrawl's crawl endpoint for hosted mode; implement a bounded local queue only if local crawling is needed.
6. Cache responses by normalized URL plus retrieval settings; record capture time and HTTP validators.
7. Private-network blocking for any server/daemon mode. A local CLI may intentionally fetch localhost, but exposing the same function as an HTTP service creates SSRF risk.

## Decisions to revisit with measurements

- Add Playwright if more than roughly 5–10% of target pages fail direct extraction and Firecrawl cost or privacy is material.
- Add Firecrawl before archive in `auto` only when a key exists; absence of a key is a recorded skipped attempt today and could instead be omitted from the attempt list.
- The current 80-character usability threshold is a guard against block pages and empty shells. Replace it with fixtures from actual failures before making it more elaborate.
- Decide whether archive selection means nearest snapshot, latest successful snapshot, or snapshot before a requested date. The availability API supplies the closest snapshot; CDX is needed for explicit date/status selection.
<!--/ai-->
