<!--ai-->
# fetch-url

Give it a link; get the page as clean Markdown. It tries ordinary HTTP first, can use Firecrawl for blocked pages, and falls back to the Wayback Machine when the live page is unavailable.

```sh
npm install
npm run build
./dist/cli.js https://example.com
```

Return provenance, metadata, and image URLs as JSON:

```sh
./dist/cli.js https://example.com --json --metadata --images
```

Use one retrieval method explicitly:

```sh
./dist/cli.js https://example.com --strategy direct
./dist/cli.js https://example.com --strategy archive
FIRECRAWL_API_KEY=fc-... ./dist/cli.js https://example.com --strategy firecrawl
```

`auto` tries direct HTTP, Firecrawl when `FIRECRAWL_API_KEY` exists, then the nearest Wayback snapshot. Each JSON result records every attempt and whether the returned page is live or archived.

## Limits

- This release extracts HTML and plain text. PDF, video, authenticated pages, and whole-site crawling are designed but not implemented.
- `--images` returns image URLs and alt text; it does not download files.
- Archive fallback can return stale content. Inspect `source`, `resolvedUrl`, and `fetchedAt` before treating it as current.
- Readability extracts the main article. Navigation, comments, and other surrounding text may be omitted.

See [docs/options.md](docs/options.md) for the dependency choices and next implementation slices.

See [the Google History retrieval test](history/2026-07-12-google-history-test.md) for the first live comparison of direct retrieval and Firecrawl.
<!--/ai-->
