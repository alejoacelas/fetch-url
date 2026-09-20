# URL fetching decisions

## Core decisions

### Active solution

- [Keep llms-fetch-mcp as the selected fetching route](#decision-1).

### Retained work

- [Keep the custom fetcher archived for its distinct evidence](#decision-2).

## Details

<a id="decision-1"></a>

### Keep llms-fetch-mcp as the selected fetching route

This repository is the retained pointer to the selected plugin, not a second maintained fetch implementation. Its documented preference is llms-full.txt, llms.txt and Markdown before HTML conversion; check actual installation when resuming use. See [README.md](README.md).

<a id="decision-2"></a>

### Keep the custom fetcher archived for its distinct evidence

The earlier TypeScript implementation remains in the shared archive for its Firecrawl/Wayback fallbacks, provenance model and 200-URL benchmark. Reusing that material is different from reinstating it as the active tool; its final pre-archive state is db9f9f7. See [README.md](README.md). History inspected: [2f5c22d](https://github.com/alejoacelas/fetch-url/commit/2f5c22d), [6570735](https://github.com/alejoacelas/fetch-url/commit/6570735).
