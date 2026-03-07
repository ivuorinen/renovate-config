# CLAUDE.md

## Project overview

Shared [Renovate](https://github.com/renovatebot/renovate) preset configuration for repositories managed by ivuorinen. Other repos consume this preset via `"extends": ["github>ivuorinen/renovate-config"]` in their Renovate config.

## Repository structure

```
default.json                 # The shared Renovate preset (this is the main artifact)
.github/renovate.json        # This repo's own Renovate config (self-referencing)
.pre-commit-config.yaml      # Pre-commit hooks including config validation
.editorconfig                # Editor conventions
LICENSE                      # MIT
README.md                    # Usage instructions
```

## Validation

Run the pre-commit hook to validate `default.json`:

```sh
pre-commit run --all-files
```

This runs two validators against `default.json`: `renovate-config-validator --strict` (Renovate's own validator) and `check-renovate` (JSON Schema validation via [check-jsonschema](https://github.com/python-jsonschema/check-jsonschema)). The hooks also enforce JSON formatting (`pretty-format-json --autofix --no-ensure-ascii`), trailing whitespace removal, and other checks.

## How default.json works

- Extends `config:recommended` and several Renovate built-in presets
- Defines `packageRules` for automerge (minor/patch), labeling by update type and datasource, and grouping (devDependencies, eslint, phpstan)
- Includes a `customManagers` regex manager for Dockerfile ENV/FROM version extraction
- Configures semantic commits (`chore(deps):` scope), squash automerge strategy, and non-office-hours schedule (Europe/Helsinki)
- Sets `postUpdateOptions` for lock file deduplication across bundler, composer, go, npm, pnpm, and yarn

## Conventions

- 2-space indentation, UTF-8, LF line endings, final newline (per `.editorconfig`)
- JSON keys in `default.json` are sorted alphabetically
- No build system, no tests, no application code
