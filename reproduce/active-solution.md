# Active fetch solution

On 2026-08-26 I replaced the custom fetcher with `llms-fetch-mcp` as my active solution and kept the old implementation as a past attempt.

## Install

The `alignment-hive` marketplace was already configured globally. I installed its MCP plugin with:

```sh
claude plugin install llms-fetch-mcp@alignment-hive --scope user --yes
```

Claude recorded the enabled plugin in `~/best/ai/dotfiles/claude/settings.json`. Restart Claude Code or run `/reload-plugins` to load it in an existing session.

The plugin runs `npx -y llms-fetch-mcp`. Given a URL, it tries `llms-full.txt`, `llms.txt`, Markdown variants, then HTML-to-Markdown conversion, and caches the result locally.

## Previous attempt

Commit `db9f9f7` was the last pre-archive state of the custom TypeScript implementation. The whole implementation, its setup, tests, plans, and benchmark results now live in [`archive/2026-08-26-custom-fetcher/`](../../../../archive/2026-08-26-custom-fetcher/).

## Checks

- `claude plugin details llms-fetch-mcp@alignment-hive` reports one MCP server named `llms-fetch`.
- The archived tests run from the archive directory with `npm test`.
- The archived build runs there with `npm run build`.
