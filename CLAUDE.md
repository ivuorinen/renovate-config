# CLAUDE.md

## Project overview

Shared [Renovate](https://github.com/renovatebot/renovate) preset configuration for repositories managed by ivuorinen. Other repos consume this preset via `"extends": ["github>ivuorinen/renovate-config"]` in their Renovate config.

## Repository structure

```
default.json                 # The shared Renovate preset (this is the main artifact)
.github/renovate.json        # This repo's own Renovate config (self-referencing)
.github/workflows/validate.yml # CI gate: runs the pre-commit hooks on push and PR
.pre-commit-config.yaml      # Pre-commit hooks including config validation
test/check-managers.mjs      # Asserts the customManagers regexes still extract
test/fixtures/               # Dockerfile + Makefile inputs for that check
.editorconfig                # Editor conventions
LICENSE                      # MIT
README.md                    # Usage instructions
```

## Validation

Run the hooks to validate `default.json` with either [`prek`](https://github.com/j178/prek) (a drop-in reimplementation) or `pre-commit` — both read the same `.pre-commit-config.yaml`:

```sh
prek run --all-files
# or: pre-commit run --all-files
```

This runs two validators against `default.json`: `renovate-config-validator --strict` (Renovate's own validator, also run separately against `.github/renovate.json`) and `check-renovate-preset` (JSON Schema validation via [check-jsonschema](https://github.com/python-jsonschema/check-jsonschema)). A third hook, `check-custom-managers`, runs `node test/check-managers.mjs`. The hooks also enforce JSON formatting (`pretty-format-json --autofix --no-ensure-ascii`), trailing whitespace removal, and other checks.

The same hooks run in CI via `.github/workflows/validate.yml`. Do not rely on local hooks alone: consumers extend `github>ivuorinen/renovate-config`, which resolves the default branch HEAD on every Renovate run, so an unvalidated commit on `main` reaches every dependent repository immediately.

`renovate-config-validator` only checks that a `matchStrings` regex *compiles* — never that it *matches*. `test/check-managers.mjs` reads the regexes straight out of `default.json` and asserts what they extract from `test/fixtures/`. Any change to `customManagers` needs a fixture line, or the change ships unverified.

## How default.json works

- Extends `config:recommended` and several Renovate built-in presets
- Defines `packageRules` for automerge (minor/patch), labeling by update type and datasource, and grouping (devDependencies, eslint, phpstan)
- Includes `customManagers` regex managers for Dockerfile `ENV` version extraction and Makefile tool versions (`FROM` lines use Renovate's built-in dockerfile manager)
- Configures semantic commits (`chore(deps):` scope), squash automerge strategy, and non-office-hours schedule (Europe/Helsinki)
- Sets `postUpdateOptions` for post-update lock file handling: dedupe for npm, pnpm and yarn; conservative resolution for bundler; `--with-all-dependencies` for composer; import-path rewriting for go. These are not interchangeable — do not drop one as "redundant"
- Orders `packageRules` least-important-first per Renovate's documented layering. The two `@ivuorinen` fast-track rules must stay **last**: the ecosystem groups use unanchored regexes (`/eslint/`, `/stylelint/`, `/semantic-release/`) that also match several `@ivuorinen/*` packages and would otherwise overwrite their `groupName`

## Conventions

- 2-space indentation, UTF-8, LF line endings, final newline (per `.editorconfig`)
- JSON keys in `default.json` are sorted alphabetically
- No build system, no tests, no application code
