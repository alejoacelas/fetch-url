<!--ai-->
# Google History retrieval test — 2026-07-12

## Method

I sampled eight recently visited public pages from the local Chrome history database. I excluded URLs with query strings or fragments and filtered out search, email, documents, account pages, localhost, and authenticated application pages. No cookies or logged-in browser state were sent to either retrieval method.

Each URL was fetched once with `direct` and once with `firecrawl`. Character counts refer to extracted Markdown, not response bytes. The reusable runner is [`scripts/compare-strategies.mjs`](../scripts/compare-strategies.mjs).

```sh
set -a; source .env; set +a
npm run build
node scripts/compare-strategies.mjs <url> [url ...]
```

## Results

| Page | Direct | Firecrawl | Finding |
|---|---:|---:|---|
| 9GAG home | 106 chars | 5,563 chars | Direct returned internal-looking IDs, not page content. |
| AltTab Pro | 1,747 | 3,193 | Both usable; Firecrawl retained more landing-page sections. |
| AI Wow journal post | Failed quality gate | 19,412 | Client-rendered content required Firecrawl. |
| Adam Jones AI tools post | 8,167 | 8,333 | Near-equivalent article extraction. |
| Claude in Slack help article | 7,097 | 12,900 | Both usable; Firecrawl included substantially more surrounding help content. |
| Hölderlin poem | 2,535 | 2,475 | Near-equivalent document extraction. |
| Finout pricing article | 15,851 | 22,638 | Both usable; Firecrawl retained more page content. |
| Anthropic enterprise | 16,782 | 49,379 | Both usable; direct emitted two jsdom CSS diagnostics before the fix. |

The comparison took about 23 seconds for 16 retrievals on this machine and network. Firecrawl calls typically took 1–3 seconds. Direct calls typically took 0–2 seconds, except Anthropic at about 4 seconds.

## Changes caused by the test

- Replaced the 80-character-only quality gate with a combined length and natural-language-word check. This rejects 9GAG's comma-separated identifier shell while preserving short prose pages such as `example.com`.
- Disabled jsdom's page parser diagnostics. Invalid third-party CSS no longer writes warnings to stderr or contaminates captured JSON output.
- Added regression tests for identifier shells, malformed CSS, and Firecrawl metadata. The suite now has six tests.
- Live `auto` retest on 9GAG now records the rejected direct attempt and returns the 5,563-character Firecrawl result.
- Mapped Firecrawl's response metadata directly. Main-content HTML fragments often omit the document head, which previously left fields such as title empty.

## Remaining gap

Successful direct extraction can still contain less content than Firecrawl. `auto` cannot know that without paying for both calls. Keep direct-first as the default; use `--strategy firecrawl` when completeness matters more than latency and credits. A future `--prefer-complete` mode could run both and select by extraction score.
<!--/ai-->
