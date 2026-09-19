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
