# Changelog

All notable changes to MinAgent are documented in this file.
Categories follow the Keep a Changelog convention: Added, Changed, Fixed, Security.

## [Unreleased]

### Added

- `/status` command: session mode, model, context usage, workspace, MCP, terminal and skills state in one panel.
- `/context` command: estimated context breakdown (system prompt, conversation, tools, compacted summary, reserved output) against the model window.
- `/doctor` command: environment health checks (Node version, configuration, workspace access, MCP, skills, terminal mode) with a pass/warn/error summary.
- `/help` command and the missing `/mcp` entry in the command autocomplete list.
- `npm run doctor` (`src/doctor.mjs`): the same health checks without the interactive UI; exits non-zero on errors.
- `scripts/lint.mjs`: dependency-free lint (syntax check over `src`, `tests`, `scripts` plus `debugger`/`var` rules) wired to `npm run lint`.
- `scripts/format.mjs`: dependency-free format check for trailing whitespace and final newlines, with `--write` to fix; wired to `npm run format`.
- Unit tests for the diagnostics module and a CLI test covering `/status`, `/context`, `/doctor` and `/help`.

### Fixed

- `src/logger.mjs` failed to load (`DEFAULT_LEVEL` declared twice); `error()` now respects the `silent` level.
- The doctor Node.js check parsed `process.version` (`v24…`) as `NaN` and always reported failure; it now uses `process.versions.node`.
- The doctor MCP check read a non-existent `clients` property; it now reports per-server connected/failed status and exposed tool counts from the real connection shape.
- `getStatusReport` clamps the usage bar for values above 100%.
- Formatting across `src` (trailing whitespace, missing final newlines).

### Changed

- README documents `/mcp`, `/status`, `/context`, `/doctor` and `/help`.

## [1.0.0]

- Initial version: CLI/TUI coding agent on Node.js (zero runtime dependencies), OpenAI-compatible provider with SSE streaming, workspace tools with evidence-before-edit, permission modes (auto/ask/off) for terminal, skills and MCP, MCP stdio/HTTP support with tool filters and quotas, context compaction, Plan/Build modes, and the automated test suite (`node --test`).
