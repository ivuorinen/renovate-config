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

`test/check-commit-messages.mjs` closes the same gap on the commit-message surface. The validator types `commitMessagePrefix` as a plain string, so `Chore(Deps): `, `deps: `, or a `!` back on GitHub Actions all validate clean and fail only in consuming repos. The check asserts every prefix is a valid conventional-commit prefix, that no `github-actions`-scoped rule carries a `!`, and that the actions override still sits *after* every unscoped breaking prefix — the array ordering the design depends on and that nothing else enforces.

## How default.json works

- Extends `config:recommended` and several Renovate built-in presets
- Defines `packageRules` for automerge (minor/patch), labeling by update type and datasource, and grouping (devDependencies, eslint, phpstan)
- Includes `customManagers` regex managers for Dockerfile `ENV` version extraction and Makefile tool versions (`FROM` lines use Renovate's built-in dockerfile manager), plus the `customManagers:githubActionsVersions` preset for annotated `*_VERSION` env vars in workflows. The preset's manager is not covered by `test/check-managers.mjs`, which reads regexes out of `default.json`
- **A constant `<field>Template` replaces the capture group of the same name, it does not default it.** Renovate's `createDependency()` compiles the template when one is set and reads the capture only as its `else`. `datasourceTemplate: "docker"` sat on the Dockerfile manager whose comments name their own datasource, so every annotated `ENV` was looked up on the Docker datasource regardless — `# golang-version/go` resolved as the image `go` and never moved, silently. Only a template that interpolates its own group (the Makefile `versioningTemplate`, which falls back to `semver-coerced`) is a legitimate default. `test/check-managers.mjs` fails on a constant template that shadows a capture
- Configures semantic commits (`chore(deps):` scope), squash automerge strategy, and non-office-hours schedule (Europe/Helsinki)
- Sets `postUpdateOptions` for post-update lock file handling: dedupe for npm, pnpm and yarn; conservative resolution for bundler; `--with-all-dependencies` for composer; `go mod tidy` and import-path rewriting for go. These are not interchangeable — do not drop one as "redundant"
- **GitHub Actions updates are never marked breaking.** Major updates globally get `commitMessagePrefix: "chore(deps)!: "`, and that `!` makes semantic-release in a consuming repo cut a major release. A GitHub Actions bump changes CI only, never the consuming package's public API, so a dedicated rule restores `chore(actions): ` for `matchManagers: github-actions` + `matchUpdateTypes: major`. The prefix is spelled out literally because a `packageRule` can only override a value, not unset one — keep it in sync with `semanticCommitType` and the `actions` `semanticCommitScope`. The rule must stay after the global major rule, since later matching rules win
- **Tracks the Go toolchain via the `toolchain` directive, not the `go` directive.** `go` is the language-compatibility floor — bumping it raises the minimum Go version for every importer — while `toolchain` names the version actually used and is meant to move. Renovate proposes `toolchain` updates by default, so this needs no `packageRule`; the preset carries none. A previous rule set `rangeStrategy: "bump"` on the `go` directive and was dropped: mise is deprecating reading `go` in favour of `toolchain`, and Renovate's own gomod docs call the `go` directive "compatible with this version or later" and recommend against routine bumps. A `go.mod` with no `toolchain` line gets no Go updates at all — that is the shape to fix, in the consuming repo, not here
- **The Go toolchain uses the `golang-version` datasource, never `github-releases`.** `golang/go` publishes git tags but no GitHub Releases, so `datasource=github-releases depName=golang/go` resolves zero versions and the pin never moves, with no error and no dashboard entry. `golang-version` reads `go.dev/dl` and supports release timestamps, so it also satisfies the fail-closed `minimumReleaseAge` hold. `test/check-managers.mjs` asserts neither fixture teaches the broken pairing
- Orders `packageRules` least-important-first per Renovate's documented layering. The four `@ivuorinen` fast-track rules must stay **last**: the ecosystem groups use unanchored regexes (`/eslint/`, `/stylelint/`, `/semantic-release/`) that also match several `@ivuorinen/*` packages and would otherwise overwrite their `groupName`
- Splits each `@ivuorinen` fast-track into a grouping rule (all update types) and an automerge rule (minor/patch, plus `digest` for `ivuorinen/actions` as the one trusted digest source). Majors are deliberately excluded from automerge: these rules waive both `minimumReleaseAge` and the schedule, so an automerged first-party major would reach every consuming repo in one Renovate run with no cooldown and no review
- Signs off commits via the `:gitSignOff` preset, not a literal `commitBody`. Renovate's docs route git trailers to `commitTrailers`, which is `mergeable: true`; `commitBody` is a non-mergeable string, so a consuming repo setting its own `commitBody` (Renovate's own documented `[skip ci]` example) would silently drop the DCO sign-off
- **Accepts that commit headers can exceed 100 characters.** `commitMessageExtra` is overridden to ` ({{currentVersion}} → {{newVersion}})`, which costs ~20 characters more than Renovate's default `to v1.2.3`. For dependencies with long names — a Docker image with a full registry path is the realistic case — the header passes `header-max-length: 100`, which `@commitlint/config-conventional` enforces at error level in [ivuorinen/base-configs-commitlint](https://github.com/ivuorinen/base-configs-commitlint). Measured: `chore(deps): update image mcr.microsoft.com/dotnet/aspnet (8.0.10-bookworm-slim → 8.0.11-bookworm-slim)` is 103 characters, 111 once GitHub's squash merge appends ` (#1234)`. The version range is worth more than the lint clean, so this is knowingly accepted rather than fixed. Renovate has no header-truncation option; the only alternatives are dropping the override or raising the limit in the commitlint config. All other generated shapes were verified clean against real commitlint 21.2.2

## Conventions

- 2-space indentation, UTF-8, LF line endings, final newline (per `.editorconfig`)
- JSON keys in `default.json` are sorted alphabetically
- No build system, no tests, no application code
