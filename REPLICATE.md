# REPLICATE

## Finish the workspace migration

The human wanted the remaining folder reorganization finished and authorized interrupting conflicting sessions.

- Preserved this repository and its instruction wording, declared the tools group, and made CLAUDE.md import AGENTS.md. Its current path is /Users/alejo/best/tools/stable/fetch-url. Moved the retired archive into ~/best/archive/ while leaving the active implementation unchanged.

Agent session 01a072fe-84d6-73f3-b37e-3bb912088c38 · Commits fetch-url: 8ea84cc

## Repair installed and recorded paths

The human wanted the reorganization finished without breaking existing tools.

- Repaired the construction record link to the custom fetcher in the shared archive.

Agent session 01a072fe-84d6-73f3-b37e-3bb912088c38 · Commits fetch-url: 892403f

## Agent instructions cleanup — 2026-09-19

Alejo asked to refresh project instructions and remove redundant Claude instruction files where native AGENTS.md loading is available.

- Updated the applicable instructions and removed redundant local Claude copies; distinct content and preserved snapshots remain.
- Checked instruction references and shared-context freshness; native Claude loading requires 2.1.277+ with the built-in feature enabled.

Agent session 01a0b915-3eb2-78b2-9add-6ba48ad9a3b1 · Commits cc33d935b08a9d148f7ddd38faf7520456d490ca

## Explicit startup instructions

Alejo wanted shared instructions selected deliberately at startup, without copied text or automatic parent inheritance.

- Removed agent-context YAML and generated shared text; retained project-specific instructions locally.
- Shared groups: tools. Selection now lives in the machine's context registry; startup does not rewrite this file.

Agent session 01a0b915-3eb2-78b2-9add-6ba48ad9a3b1 · Commits 908f27d

<a id="construction-records"></a>

## Construction records

Preserved records from the former construction-notes folder.

<a id="record-active-solution"></a>

### Active fetch solution

On 2026-08-26 I replaced the custom fetcher with `llms-fetch-mcp` as my active solution and kept the old implementation as a past attempt.

#### Install

The `alignment-hive` marketplace was already configured globally. I installed its MCP plugin with:

```sh
claude plugin install llms-fetch-mcp@alignment-hive --scope user --yes
```

Claude recorded the enabled plugin in `~/best/ai/dotfiles/claude/settings.json`. Restart Claude Code or run `/reload-plugins` to load it in an existing session.

The plugin runs `npx -y llms-fetch-mcp`. Given a URL, it tries `llms-full.txt`, `llms.txt`, Markdown variants, then HTML-to-Markdown conversion, and caches the result locally.

#### Previous attempt

Commit `db9f9f7` was the last pre-archive state of the custom TypeScript implementation. The whole implementation, its setup, tests, plans, and benchmark results now live in [`archive/2026-08-26-custom-fetcher/`](../../../archive/2026-08-26-custom-fetcher).

#### Checks

- `claude plugin details llms-fetch-mcp@alignment-hive` reports one MCP server named `llms-fetch`.
- The archived tests run from the archive directory with `npm test`.
- The archived build runs there with `npm run build`.
