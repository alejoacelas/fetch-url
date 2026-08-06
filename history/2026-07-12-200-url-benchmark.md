<!--ai-->
# 200-URL benchmark — 2026-07-12

## Result

Direct retrieval produced usable-looking prose for 105/200 URLs. Firecrawl rescued 59/95 direct failures, raising reported retrieval to 164/200 (82%). The Wayback fallback rescued 0/36 pages that both methods missed.

“Usable-looking prose” is a mechanical content check, not a human correctness label. Manual review found incomplete direct results and overcaptured Firecrawl results, so 82% measures pipeline acceptance rather than complete, correct extraction.

The machine-readable aggregate is [`2026-07-12-benchmark-stats.json`](2026-07-12-benchmark-stats.json). Raw measurements and 2.2 MB of paired page content remain local and gitignored because the source URLs came from browsing history and some surviving application routes contain third-party context.

## Method

- Sampled 200 recent HTTPS URLs across 117 hosts from three local Chrome profiles.
- Capped each host at four URLs.
- Excluded query strings, fragments, search, email, documents, account pages, and known authenticated applications. Some app, login, payment, and media routes still survived; this is a limitation, not representative public-prose sampling.
- Ran direct retrieval on all 200.
- Ran Firecrawl on every direct failure.
- Systematically sampled 50 direct successes across the output-size distribution and fetched them with Firecrawl for comparison; 48 pairs succeeded.
- Ran Wayback on all 36 pages rejected by both direct and corrected Firecrawl validation.
- Saved all 48 successful Markdown pairs. Two independent reviewers inspected failure classes, extreme ratios, and near-equal pairs.

The corrected rescue run and paired-content run were separate. A subsequent comparison rerun hit HTTP 429 on 45/50 calls, so the paired statistics use the already-saved preceding run with the same 200-URL selection and extractor. The tool now retries Firecrawl 429 and 5xx responses with bounded backoff.

## Retrieval statistics

| Stage | Success | Median latency | p95 latency |
|---|---:|---:|---:|
| Direct | 105/200 (52.5%) | 444 ms | 1,971 ms |
| Firecrawl after direct failure | 59/95 (62.1% rescue) | 654 ms | 2,666 ms |
| Combined direct + Firecrawl | 164/200 (82.0%) | — | — |
| Wayback after both failed | 0/36 | 1,344 ms | — |

Direct failures:

| Cause | Count |
|---|---:|
| Content failed the prose/shell check | 63 |
| HTTP 403 | 11 |
| HTTP 404 | 5 |
| HTTP 400 | 4 |
| Image input | 3 |
| Network failure | 3 |
| LinkedIn HTTP 999 | 3 |
| PDF input | 2 |
| HTTP 401 | 1 |

Firecrawl rescued all 11 direct 403s, all four 400s, both PDFs, and most client-rendered shells. It did not rescue the three PNGs or LinkedIn's three 999 responses. Its 36 corrected failures were 20 unusable shells, eight destination errors reported in metadata, five upstream 500s, and three API 403s.

Wayback found no usable result for the remaining set: 25 had no snapshot, six snapshots failed the content check, and five replay requests failed. This sample does not support Wayback as a reliable automatic last resort, though it can still recover known archived pages.

## Completeness comparison

Among the 48 successful direct/Firecrawl pairs:

| Firecrawl Markdown size relative to direct | Pages |
|---|---:|
| At least 20% longer | 36/48 |
| At least 2× | 25/48 |
| At least 10× | 10/48 |
| Within ±20% | 11/48 |
| At least 20% shorter | 1/48 |

The median ratio was 2.17×; the middle 50% ranged from 1.26× to 6.14×. This does not mean Firecrawl was 2.17× better.

Manual comparison found three kinds of extra content:

- Useful rendered content: search results, post lists, help-category listings, rankings, and most of a landing page that direct HTML omitted.
- Useful content plus chrome: the missing page material arrived with navigation, repeated calls to action, cookie tables, or footers.
- Overcapture: one 122,812-character result repeated hidden inquiry forms; one 892,222-character result included an entire comment thread and accounted for over half of all Firecrawl characters in the paired set.

Near-equal pairs usually contained the same main content. Direct was often cleaner; Firecrawl added formatting controls, calls to action, or minor structural improvements.

## Improvements made from the benchmark

- Remove scripts, styles, templates, and SVG before extraction. A YouTube page fell from ~495,000 characters of player JSON to a correctly rejected footer shell.
- Strip CSS before jsdom parses it. A real article that threw on a complex `@import` now returns 28,832 characters.
- Score visible link labels instead of words inside link destinations.
- Reject short link-heavy navigation, newsletter, JavaScript-disabled, login, redirect, invalid-link, and 404 shells.
- Read Firecrawl's destination status from metadata. An API-level success containing a destination 404 is now a failure with the real status.
- Retry Firecrawl 429 and 5xx responses up to twice with bounded backoff.
- Keep raw browsing-history measurements and full third-party page contents out of Git.
- Added seven regression tests; the suite now has 13 tests.

## Recommended next changes

### 1. Return candidate quality, not one Boolean

Classify each result as `strong`, `weak`, or `unusable`, with recorded reasons and measurements. `auto` should accept strong direct content, try Firecrawl for weak direct content, then retain both candidates when selection is ambiguous.

This is the highest-leverage change. Seventeen accepted direct results were under 500 characters; several were incomplete shells that Firecrawl expanded by 13–78×. Raising one global minimum would also reject legitimate short pages.

### 2. Compare novelty and density, not length

Penalize repeated lines/blocks, high link density, login/legal/cookie vocabulary, comment/reply sections, hidden forms, and repeated navigation. Treat Firecrawl growth above 5× as suspicious until it adds novel prose or headings; above 15× should trigger a warning or cleaning pass.

Expose `--scope main|page|all`. Default `main` should remove comments and chrome. Preserve the raw result for `all` rather than silently discarding it.

### 3. Bound memory and output

Add `maxResponseBytes` while streaming and `maxMarkdownChars` or chunked output. Current direct and Firecrawl responses are buffered without a limit. The benchmark observed 199,000-character rescue results and an 892,000-character comparison result.

### 4. Handle media by type

- Add native PDF extraction; both PDFs were rescued by Firecrawl, but local parsing avoids credits and preserves page structure.
- Return an image result or download manifest for image URLs; all three PNG inputs failed both prose methods.
- Treat video and audio as metadata/transcript tasks rather than generic HTML extraction.

### 5. Route fallbacks by failure class

Use typed outcomes such as `blocked`, `auth_required`, `not_found`, `unsupported_media`, `no_prose`, `network`, and `rate_limited`.

- Firecrawl: blocked pages, client-rendered shells, and weak direct candidates.
- Archive: 404/410/DNS failures or explicit requests, not authentication/media failures.
- Stop: authenticated/private shells unless browser-session retrieval is explicitly requested.

### 6. Harden archive retrieval before relying on it

Query CDX for several successful HTML snapshots, retry replay variants, record capture timestamps, and distinguish archive lookup failure from replay failure. The current nearest-snapshot attempt delivered 0/36 rescues, so this is a reliability project rather than a demonstrated near-term gain.

### 7. Build a human-labeled quality set

Label a stratified sample by page type—article, documentation, directory/search, landing page, SPA, social, PDF, image—with completeness, boilerplate, and correctness scores. Then report false-success rates and direct/Firecrawl win/tie/loss. Character ratios alone cannot answer which output is better.
<!--/ai-->
