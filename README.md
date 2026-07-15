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
secretspec run -- ./dist/cli.js https://example.com --strategy firecrawl
```

`auto` tries direct HTTP, Firecrawl when `FIRECRAWL_API_KEY` exists, then the nearest Wayback snapshot. Each JSON result records every attempt and whether the returned page is live or archived.

## Firecrawl credential

The Firecrawl key lives in the `Developer-Credentials` 1Password vault. `secretspec.toml` declares the key without storing its value. Keep 1Password unlocked, then prefix any command that needs Firecrawl with `secretspec run --`.

Coding agents must record why they need the key:

```sh
secretspec run --reason "Fetch the requested blocked page" -- \
  ./dist/cli.js https://example.com --strategy firecrawl
```

Install the prerequisites with `brew install --cask 1password 1password-cli` and `cargo install secretspec --locked`, then enable **1Password → Settings → Developer → Integrate with 1Password CLI**.

To roll back, copy `.env.example` to `.env`, add the key, and use the original command without the `secretspec run --` prefix. `.env` remains gitignored.

## Limits

- This release extracts HTML and plain text. PDF, video, authenticated pages, and whole-site crawling are designed but not implemented.
- `--images` returns image URLs and alt text; it does not download files.
- Archive fallback can return stale content. Inspect `source`, `resolvedUrl`, and `fetchedAt` before treating it as current.
- Readability extracts the main article. Navigation, comments, and other surrounding text may be omitted.

See [docs/options.md](docs/options.md) for the dependency choices and next implementation slices.

See [the Google History retrieval test](history/2026-07-12-google-history-test.md) for the first live comparison of direct retrieval and Firecrawl.

See [the 200-URL benchmark](history/2026-07-12-200-url-benchmark.md) for retrieval rates, latency percentiles, paired-content review, and the improvement backlog.

See [the improvement plan](docs/improvement-plan.md) for candidate selection, Firecrawl cleaning, an optional OpenRouter judge, output limits, and additional archive providers.
<!--/ai-->
