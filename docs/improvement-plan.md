<!--ai-->
# Improvement plan

## Recommendation

Treat retrieval as candidate generation, then choose content by coverage and noise—not length.

```text
direct HTML ──► candidate + coverage inventory ─┐
                                                ├─► deterministic quality check
Firecrawl ────► candidate + coverage inventory ┘          │
                                                           ├─ clear winner ─► output
archives ─────► only for unavailable live pages            │
                                                           └─ ambiguous ─► cheap model judge
```

Do not call a model merely because Firecrawl is long. First remove repeated blocks, navigation, comments, forms, and cookie material deterministically. Call a model only when both candidates remain plausible and disagree about coverage.

## What can go wrong

| Failure | Example from the benchmark | Detection |
|---|---|---|
| Direct is short because JavaScript holds the content | 89–470 character direct results became 3,000–17,000 characters through Firecrawl | Few prose blocks/headings; SPA shell; large Firecrawl block novelty |
| Direct is long but still misses rendered sections | Direct contains server-rendered article text but omits results, cards, comments, tables, or lazy content | Compare headings, tables, media, links, JSON-LD, and block hashes—not total characters |
| Firecrawl adds useful rendered content | Search results, post lists, help categories | Novel headings followed by unique prose/data blocks |
| Firecrawl adds chrome | Navigation, cookie tables, repeated calls to action | Link density, repeated lines, boilerplate vocabulary, location before/after main content |
| Firecrawl overcaptures | 892,222 characters containing a full comment thread; 122,812 characters containing repeated hidden forms | Comment/form markers, low unique-line ratio, repeated blocks, extreme candidate ratio |
| Both are technically nonempty but wrong | Login, checkout, invalid-link, or 404 shell | Destination status, title/body shell classifier, content-type routing |

The hard case in the question is real: the longer candidate can still omit an important rendered section. The solution is a coverage inventory plus block comparison; a scalar length score cannot detect this.

## 1. Add a coverage inventory

Produce this before converting either candidate to final Markdown:

```ts
interface CoverageInventory {
  headings: string[];
  proseBlocks: Array<{ hash: string; characters: number; sample: string }>;
  tables: Array<{ rows: number; columns: number; header: string[] }>;
  lists: Array<{ items: number; sample: string[] }>;
  links: Array<{ url: string; text: string; region: "main" | "nav" | "footer" | "unknown" }>;
  images: Array<{ url: string; alt?: string }>;
  embeds: Array<{ type: string; url?: string }>;
  forms: number;
  structuredDataTypes: string[];
  commentMarkers: number;
  repeatedBlockRatio: number;
}
```

Normalize prose into paragraph/list/table blocks and hash whitespace-normalized text. Report what is unique to direct, unique to Firecrawl, and shared. A model can then judge 20–100 block summaries instead of reading an 892,000-character page.

This inventory also makes missing non-text elements visible. Firecrawl can return separate `links`, `images`, and `screenshot` formats, and supports PDFs and other documents; request those formats only when the corresponding CLI toggles need them. [Firecrawl scrape formats and document behavior](https://docs.firecrawl.dev/features/scrape)

## 2. Replace `usable` with candidate quality

Return `strong`, `weak`, or `unusable`, plus reasons:

```json
{
  "quality": "weak",
  "reasons": ["short_prose", "rendered_sections_possible"],
  "metrics": {
    "characters": 470,
    "uniqueBlockRatio": 0.91,
    "linkDensity": 0.22,
    "headings": 1
  }
}
```

Initial rules to validate against the saved page pairs:

- `unusable`: error/auth shell, unsupported type, destination status ≥400, no natural prose, or short link-heavy navigation.
- `weak`: under 1,500 characters; low heading/block count; SPA signals; suspiciously high link density; or metadata promises content absent from the body.
- `strong`: coherent main prose with no shell or repetition signals. Length alone cannot make a candidate strong.
- Firecrawl-specific warning: over 5× direct length plus low unique-block ratio, comment/form density, or boilerplate growth.
- Firecrawl-specific warning: over 100,000 characters. Preserve it, but do not print it to stdout without an explicit `--all` or output path.

`auto` should accept strong direct content. For weak direct content it should try Firecrawl, compare both, and retain the weak direct candidate if every fallback fails.

## 3. Test Firecrawl's cleaner before adding another model

The tool currently sends `onlyMainContent: true`. Firecrawl describes that as a deterministic HTML-level filter. Its beta `onlyCleanContent: true` adds an LLM cleaning pass for residual cookie banners, ads, breadcrumbs, newsletter forms, comment sections, and related articles while preserving headings, lists, tables, code, images, and links. It can be skipped when output exceeds its model limit, so the response warning must be checked. [Firecrawl API fields](https://docs.firecrawl.dev/api-reference/endpoint/scrape#body-only-clean-content)

Run an A/B test on the saved 48 pairs:

1. Existing `onlyMainContent` result.
2. `onlyMainContent + onlyCleanContent`.
3. Human labels for completeness, boilerplate, and correctness.

Ship it behind `--firecrawl-clean` if it removes at least 80% of the identified comment/form/cookie overcapture without losing important blocks on more than 2% of the labeled pages. Do not make it default until the beta cleaner passes this test.

Also use Firecrawl's deterministic controls where a site pattern is known:

- `excludeTags` for comments, footers, dialogs, and known form containers.
- `includeTags` when a stable main container exists.
- `blockAds: true` and `removeBase64Images: true`—both current defaults.
- Request `html` only when local structural comparison needs it; otherwise request Markdown plus explicit `images` or `links` formats.
- Keep the default two-day cache unless freshness matters; `maxAge: 0` is slower and more failure-prone, while cached requests still cost one credit. [Firecrawl caching](https://docs.firecrawl.dev/features/scrape#caching-and-maxage)

## 4. Add an OpenRouter judge only for ambiguity

### Job

The model does not fetch or summarize the page. It receives:

- metadata and destination status;
- both coverage inventories;
- shared and candidate-unique block samples;
- repetition/link/comment/form metrics;
- at most a bounded amount of candidate text.

It returns strict JSON:

```json
{
  "choice": "direct",
  "confidence": 0.91,
  "directMissing": ["rendered pricing table"],
  "firecrawlNoise": ["full comment thread", "repeated navigation"],
  "keepFirecrawlBlocks": ["fc:12", "fc:13"],
  "reasonCodes": ["DIRECT_CLEANER", "FIRECRAWL_OVERCAPTURE"]
}
```

Allowed decisions should be `direct`, `firecrawl`, `merge`, or `uncertain`. `merge` keeps direct's main content plus named novel Firecrawl blocks. `uncertain` returns both file paths and a warning instead of silently guessing.

OpenRouter supports JSON Schema structured outputs for compatible models, and its Models API exposes current context length, pricing, and supported parameters. [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [Models API](https://openrouter.ai/docs/guides/overview/models)

### Model choices as of 2026-07-12

Query the Models API at install/test time rather than permanently calling “the cheapest model”; availability and prices change.

| Model | Context | Input / output per million tokens | Proposed use |
|---|---:|---:|---|
| `inclusionai/ling-2.6-flash` | 262k | $0.01 / $0.03 | First judge candidate; benchmark before trusting it |
| `qwen/qwen3.5-flash-02-23` | 1M | $0.065 / $0.26 | Long coverage manifests or fallback judge |
| `deepseek/deepseek-v4-flash` | ~1.05M | $0.077 / $0.154 | Alternative long-context judge |

At posted rates, 100,000 input tokens cost about $0.001 with Ling or $0.0065 with Qwen, plus a small structured response. Those prices came from OpenRouter's live Models API and should be recorded in each run, not copied into code. OpenRouter passes through model prices and charges a 5.5% fee when buying credits. [OpenRouter pricing](https://openrouter.ai/pricing)

Start with Ling on the human-labeled set. Promote it only if it agrees with human `direct|firecrawl|merge|uncertain` labels at least 95% on clear cases and sends ambiguous cases to `uncertain`. A cheap wrong judge is worse than returning both candidates.

### Invocation threshold

Call the model only when deterministic selection cannot decide, for example:

- both candidates are strong but each has meaningful unique blocks;
- Firecrawl adds >20% novel blocks but also trips an overcapture warning;
- Firecrawl is >5× longer and the unique additions are not clearly navigation/comments/forms;
- direct is longer, but Firecrawl contains novel tables, images, headings, or structured records.

This should keep model calls below roughly 10–25% of URLs. Measure the actual rate; that threshold changes if model latency or privacy matters more than credits.

### Privacy

An OpenRouter call sends page content to OpenRouter and the selected provider. Make it opt-in through `OPENROUTER_API_KEY`, record the model/provider and content hashes, cap transmitted text, and support a deterministic-only mode. OpenRouter exposes data-policy routing, budgets, and separate keys; use a dedicated key with a hard cap. [OpenRouter model and provider routing](https://openrouter.ai/docs/api/reference/overview)

## 5. Preserve full content without flooding stdout

Separate capture from presentation:

- Always save raw candidates when `--save` is set.
- Default stdout: selected main Markdown with an explicit character/token budget.
- When over budget: write the full result to disk and return a manifest plus outline; do not silently truncate.
- Add `--max-chars`, `--max-response-bytes`, `--scope main|page|all`, and `--output <dir>`.
- Chunk by headings/blocks, never arbitrary character boundaries.
- Include `truncated`, `fullContentPath`, `chunks`, and candidate hashes in JSON.

This controls Firecrawl's unnecessary length without losing information. “Use direct when Firecrawl is too long” becomes one possible judged outcome, not a hard rule.

## 6. Use multiple archive resolvers

### Wayback Machine

Replace the single availability lookup with CDX enumeration:

1. Query several recent `200 text/html` captures.
2. Try the closest three unique digests, newest first.
3. Fetch replay with an original-content replay form where supported.
4. Record capture timestamp, original status, replay status, and archive provider.
5. Use archives automatically for 404/410/DNS failures; do not waste archive calls on auth shells or image inputs.

The benchmark's nearest-snapshot implementation rescued 0/36 final failures. Multiple captures may improve replay reliability, but the expected gain is unknown until measured.

### Archive.today / Archive.ph

Archive.today is worth an experimental resolver because it stores both a text and graphical copy and disables active scripts in saved pages. [Archive.today service description](https://archive.ph/)

Use it as best-effort, not as a production dependency:

- Lookup form: `https://archive.today/newest/<original-url>` currently redirects to a saved snapshot when one exists.
- A live probe on 2026-07-12 returned a redirect through `archive.today`, but the equivalent `archive.ph` and `archive.is` probes returned HTTP 429 pages.
- There is no stable, documented JSON API or service guarantee to depend on; CAPTCHA/rate limiting and domain aliases must be expected.
- Never submit a new capture automatically. Capture creation is an external write and may publish a previously obscure URL. Limit this adapter to lookup unless the user explicitly requests archival.

Implement behind `--archive-provider archive-today` and exclude it from default `auto` until a 100-URL archived-page test shows a useful hit rate and acceptable 429/CAPTCHA rate.

### Arquivo.pt and Memento

Add Arquivo.pt before relying on Archive.today automation. It provides a documented JSON URL-history API and replay URLs, although its collection emphasizes Portuguese sites. [Arquivo.pt API](https://arquivo.pt/api), [official service description](https://sobre.arquivo.pt/en/)

Use the Memento protocol as the provider interface: original URL, desired datetime, returned snapshot URL, snapshot datetime, and provider. Memento TimeGates negotiate archived versions with `Accept-Datetime`; this lets other archives plug in without changing the retrieval pipeline. [Memento protocol overview](https://mementoweb.org/guide/quick-intro/)

Recommended provider order for dead public HTML:

1. Wayback CDX, three captures.
2. Arquivo.pt URL history.
3. Archive.today lookup, opt-in while reliability is unproven.
4. Return a structured `not_archived` result with every lookup attempt.

## 7. Route by content and failure type

| Input/outcome | Next action |
|---|---|
| Strong direct HTML | Return direct |
| Weak/direct SPA shell | Firecrawl |
| Direct 403/429/999 | Firecrawl with bounded retry/proxy policy |
| Direct 404/410/DNS | Archive providers, then Firecrawl only if a live rendering may still exist |
| PDF | Native PDF parser first; Firecrawl document parser fallback |
| Image | Image result/download manifest; do not demand prose |
| Video/audio | Metadata/transcript adapter |
| Auth/login shell | Stop with `auth_required`; use browser-session retrieval only when explicitly requested |
| Both candidates strong but different | Coverage comparison, then optional OpenRouter judge |

## Implementation order

| Priority | Change | Expected outcome | Validation |
|---:|---|---|---|
| 1 | Coverage inventory + block hashes | Detect missing sections independent of length | Human labels on 48 saved pairs |
| 2 | `strong|weak|unusable` candidates | Firecrawl incomplete direct successes without losing fallback content | False-success/false-failure rates |
| 3 | Firecrawl `onlyCleanContent` A/B | Remove comments/forms/cookie chrome using an existing feature | Completeness/noise labels |
| 4 | Output limits + saved raw candidates | No terminal/context floods; no lost full content | 892k-character fixture |
| 5 | Typed PDF/image/video handling | Correct results for non-HTML inputs | Existing five media URLs plus fixtures |
| 6 | OpenRouter judge on ambiguous cases | Choose or merge candidates when deterministic evidence conflicts | ≥95% agreement on clear labeled cases |
| 7 | Wayback CDX + Arquivo.pt | More and better-diagnosed archive attempts | Known archived set plus previous 36 failures |
| 8 | Archive.today lookup experiment | Additional archive coverage if operationally reliable | 100 known snapshots; measure hits/429s/CAPTCHAs |

## Success metrics

The next benchmark should report:

- retrieval success by content type, not one aggregate;
- human completeness, boilerplate, and correctness scores;
- false-success rate for auth/error shells;
- direct/Firecrawl/merged win–tie–loss;
- percentage of URLs invoking Firecrawl and OpenRouter;
- input/output tokens, dollars, and latency per successful URL;
- percentage of results over output budget and whether the full content remained recoverable;
- archive lookup hit, replay success, and freshness by provider.

The target is not maximum Markdown length. It is the smallest result that preserves every content block relevant to the requested scope, with the full capture still inspectable.
<!--/ai-->
