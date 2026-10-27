# Renovate Config

Shared [Renovate](https://github.com/renovatebot/renovate) preset configuration
for repositories managed by **ivuorinen**. Other repos consume this preset via
their Renovate config, so changes here propagate automatically to every
repository that extends it.

## Usage

Create `.github/renovate.json` in your repository:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>ivuorinen/renovate-config"]
}
```

See [Renovate Docs: Shareable Config Presets](https://docs.renovatebot.com/config-presets/)
for more on how shared presets work.

## Extends

This preset inherits from the following built-in Renovate presets:

| Preset | Description |
|--------|-------------|
| `config:recommended` | Renovate's recommended base configuration |
| `:enableVulnerabilityAlerts` | Create PRs for known security vulnerabilities |
| `:gitSignOff` | Append `Signed-off-by:` as a git trailer (`commitTrailers`) |
| `:label(dependencies)` | Add `dependencies` label to all PRs |
| `:preserveSemverRanges` | Keep existing semver range syntax when updating |
| `:semanticCommits` | Conventional commit messages. `config:recommended` also pulls in `:semanticPrefixFixDepsChoreOthers`, so runtime dependencies commit as `fix(deps):` and everything else as `chore(deps):` |
| `:timezone(Europe/Helsinki)` | Schedule evaluation in Europe/Helsinki timezone |
| `docker:enableMajor` | Enable major version updates for Docker |
| `helpers:pinGitHubActionDigests` | Pin GitHub Actions to full SHA digests |
| `security:minimumReleaseAgeNpm` | Require a minimum release age for npm packages |
| `schedule:nonOfficeHours` | Run Renovate outside office hours |

## Key settings

| Setting | Value | Description |
|---------|-------|-------------|
| `assigneesFromCodeOwners` | `true` | Assign PRs to CODEOWNERS |
| `automergeStrategy` | `squash` | Squash-merge automerged PRs |
| `commitMessageAction` | `update` | Use "update" as the commit action verb |
| `commitMessageExtra` | `({{currentVersion}} → {{newVersion}})` | Show version range in commits; renders short SHAs (`currentDigestShort → newDigestShort`) for digest updates instead of an empty range |
| `dependencyDashboardLabels` | `["no-stale"]` | Prevent stale-bot from closing the dashboard |
| `dependencyDashboardOSVVulnerabilitySummary` | `unresolved` | Show unresolved OSV vulnerabilities |
| `dependencyDashboardTitle` | `Renovate Dashboard 🤖` | Custom dashboard issue title |
| `minimumReleaseAge` | `3 days` | Hold every ecosystem's updates for 3 days so malware scanners and unpublish windows can catch up. Exempted for `git-submodules` (see below) and for `@ivuorinen/*` |
| `prHourlyLimit` | `5` | Max 5 PRs created per hour |
| `reviewersFromCodeOwners` | `true` | Request reviews from CODEOWNERS |
| `separateMultipleMajor` | `true` | Create separate PRs for each major version bump |

## Custom managers

### Dockerfile

Extracts tool versions from `ENV` variables carrying an inline datasource
comment, using the [regex manager](https://docs.renovatebot.com/modules/manager/regex/).
Standard `FROM` lines are left to Renovate's built-in `dockerfile` manager
(enabled by `config:recommended`), so they are not duplicated here.

**Pattern matched:**

```dockerfile
# ENV with inline datasource comment
ENV TOOL_VERSION=1.2.3 # github-releases/owner/repo

# multi-word and digit-bearing names work too
ENV DOCKER_COMPOSE_VERSION=2.24.0 # github-releases/docker/compose
ENV PHP8_VERSION=8.3.0 # github-releases/php/php-src

# optional versioning override
ENV GO_VERSION=1.21.0 # golang-version/go&versioning=semver
```

Regex (applied with `matchStringsStrategy: "any"`):

```
ENV [A-Z][A-Z0-9_]*_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\&versioning=(?<versioning>.*?))?\s
```

The variable name must start with an uppercase letter and end in `_VERSION`;
underscores and digits in between are allowed. `ARG` is not matched — only `ENV`.

> **The datasource comes from the comment, and the manager carries no
> `datasourceTemplate`.** A constant `<field>Template` does not *default* the capture
> group of the same name, it *replaces* it: Renovate's `createDependency()` compiles the
> template when one is set and reads the capture only as its `else`. A
> `datasourceTemplate: "docker"` used to sit here, so every annotated `ENV` resolved
> against the Docker datasource no matter what its comment said — `# golang-version/go`
> was looked up as the image `go`, matched nothing, and the pin never moved, with no
> error and no dashboard entry. `test/check-managers.mjs` now fails if a constant
> template shadows a capture again. The Makefile `versioningTemplate` below is the
> legitimate shape: it interpolates its own group and only supplies a fallback.

### Makefile

Tracks tool versions in Makefiles via `# renovate:` comments using
[regex manager](https://docs.renovatebot.com/modules/manager/regex/).

Files matched: `Makefile`, `*.mk`

**Pattern matched:**

```makefile
# renovate: datasource=go depName=github.com/goreleaser/goreleaser/v2
GORELEASER_VERSION := v2.14.1

# trailing fields are allowed, in any order
# renovate: datasource=github-releases depName=golangci/golangci-lint versioning=semver
LINT_VERSION := v1.61.0

# two-part versions are supported
# renovate: datasource=golang-version depName=go
GO_VERSION := 1.21
```

> **Use `golang-version` for the Go toolchain, never `github-releases`.**
> `golang/go` publishes git tags but no GitHub Releases, so
> `datasource=github-releases depName=golang/go` resolves zero versions and the pin
> never moves — with no error and no dashboard entry. `golang-version` reads
> `go.dev/dl` and supports release timestamps, so it also clears the 3-day
> `minimumReleaseAge` hold. `test/check-managers.mjs` fails on the wrong pairing.

Regex:

```
#\s*renovate:\s*datasource=(?<datasource>\S+)\s+depName=(?<depName>\S+)(?:[^\n]*?[ \t]versioning=(?<versioning>\S+))?[^\n]*\n[A-Za-z_][A-Za-z0-9_]*\s*[:+?]?=\s*(?<currentValue>v?\d+\.\d+(\.\d+)?\S*)
```

The `datasource`, `depName` and an optional `versioning` are captured from the
comment, and `currentValue` from the variable assignment on the next line. Any
other trailing comment fields (`extractVersion=`, `registryUrl=`, …) are
tolerated and ignored. The assignment may use `=`, `:=`, `?=`, or `+=`, the
variable name may be mixed case, and the version may be two- or three-part
(`1.21` or `1.21.0`, optional leading `v`).

Versioning comes from the comment when given, otherwise `semver-coerced`:

```json
"versioningTemplate": "{{#if versioning}}{{{versioning}}}{{else}}semver-coerced{{/if}}"
```

`semver-coerced` rather than `semver` because strict `semver` rejects two-part
versions outright (`semver.valid("1.21")` is `null`), which would silently drop
every dependency pinned to a `1.21`-style version.

### GitHub Actions workflows

Tool versions pinned inside a workflow are tracked through the
`customManagers:githubActionsVersions` preset in `extends` — the regex lives upstream,
not in this file. Annotate an `env:` entry whose name ends in `_VERSION`:

```yaml
- name: staticcheck
  env:
    # renovate: datasource=github-releases depName=dominikh/go-tools
    STATICCHECK_VERSION: 2026.2.1
  run: go run honnef.co/go/tools/cmd/staticcheck@"$STATICCHECK_VERSION" ./...
```

Files matched: `.github/workflows/*.y[a]ml`, `action.y[a]ml`, and the Gitea/Forgejo and
`workflow-templates` equivalents. This is what keeps a `go run tool@version` pin — the
shape a linter that gates CI should have, since `@latest` changes CI behaviour with no
commit — from freezing at whatever version was typed once.

These deps come from the `custom.regex` manager, not `github-actions`, so the GitHub
Actions package rules do not apply to them: no `renovate/github-action` label and no
`chore(actions):` prefix.

Grouping is narrower than extraction. The **development tools** group matches
`.github/workflows/*.y[a]ml` and `action.y[a]ml` only, so those pins share a PR with the
Makefile ones; a pin in a Gitea/Forgejo workflow or a `workflow-templates/` file is still
extracted and updated, just in its own PR. Add the paths to `matchFileNames` if a repo
ever needs them grouped. A pin of a tool that has a [tool group](#tool-groups), such as
the goreleaser, golangci-lint and staticcheck examples above, goes to that group
instead, so it moves together with the tool's hook, Action and mise pin.

> Not covered by `test/check-managers.mjs`: that check reads regexes out of
> `default.json`, and this one ships inside the preset.

## Package rules

### Automerge and labeling

| Rule | Matches | Effect |
|------|---------|--------|
| Major label | `matchUpdateTypes: ["major"]` | `type/major` label only. No update is marked breaking: a dependency's major is not a major of the package that depends on it, so a runtime-dependency major commits as `fix(deps):` like any other runtime update and releases a patch. When a package cuts a major is its owner's call, made in a commit of their own |
| Tooling releases nothing | `matchManagers: ["nvm", "pre-commit"]`, every update type | `tooling` scope. `.nvmrc` and pre-commit hooks change local tooling and CI only. The `actions` scope is reserved for GitHub Actions |
| Dev dependencies release nothing | `matchDepTypes: ["devDependencies", "require-dev"]`, every update type | `dev-deps` scope. Dev dependencies never reach consumers. `@ivuorinen/semantic-release-config` has a release rule for `deps` only, so neither `dev-deps`, `tooling` nor `lockfile` cuts a release |
| Lock-file-only updates release nothing | `matchJsonata: ["isLockfileUpdate = true"]`, every update type | `lockfile` scope. An update whose new version already satisfies the range changes only the lock file, which no consumer installs. Every vulnerability alert lands this way when it can (`vulnerabilityAlerts` defaults to `rangeStrategy: "update-lockfile"`), so `chore(lockfile): update dependency undici (8.11.2 → 8.12.2) [SECURITY]` no longer cuts an empty patch. Renovate's own `semanticPrefixFixDepsChoreOthers` selects these updates with the same expression; `matchUpdateTypes` cannot, since `updateType` stays major, minor or patch. Sits after the dev-deps rule, so a lock-file-only dev dependency update reads `lockfile` too |
| Automerge non-major | `matchUpdateTypes: ["minor", "patch"]` | Automerge via branch strategy. `digest` is deliberately excluded — see below |
| Minor label | `matchUpdateTypes: ["minor"]` | `type/minor` label |
| Patch label | `matchUpdateTypes: ["patch"]` | `type/patch` label |
| Digest label | `matchUpdateTypes: ["digest"]` | `type/digest` label |

### Datasource labels and commit topics

| Datasource / Manager | Label | Commit topic |
|-----------------------|-------|--------------|
| `docker` | `renovate/container` | `image {{depName}}` |
| `helm` | `renovate/helm` | `chart {{depName}}` |
| `galaxy`, `galaxy-collection` | `renovate/ansible` | - |
| `terraform-provider` | `renovate/terraform` | - |
| `github-releases`, `github-tags` | `renovate/github-release` | - |
| `github-actions` (manager) | `renovate/github-action` | scope: `actions`, for every update type, so an actions bump releases nothing |
| `pypi` | `renovate/pip` | - |

### Dependency groups

Related packages are grouped into single PRs. Every package-name group below
(eslint through @ivuorinen packages) puts its `devDependencies` and `require-dev`
members in a separate `<name> (dev)` group, such as `eslint (dev)`. Dev updates are
titled `chore(dev-deps):` and release nothing, while runtime updates keep
`chore(deps)`. A grouped branch takes one commit prefix from its first member by
name, so a shared group could hide a runtime update behind the dev-deps prefix:

| Group name | Match criteria |
|------------|----------------|
| devDependencies (non-major) | `matchDepTypes: ["devDependencies"]`, minor/patch only |
| development tools | `matchFileNames`: `**/Makefile`, `**/*.mk`, `**/.github/workflows/*.y[a]ml`, `**/action.y[a]ml`; custom.regex manager |
| eslint | Package names matching `/eslint/` |
| illuminate | Package names matching `/illuminate/` |
| phpstan | Package names matching `/phpstan/` or `/larastan/` |
| semantic-release | Package names matching `/semantic-release/` |
| stylelint | Package names matching `/stylelint/` |
| tailwind | Package names matching `/tailwind/` |
| vite | Package names matching `/vite/` |
| vue | Package names matching `/vue/` |
| @ivuorinen packages | Package names matching `@ivuorinen/**`; `prCreation: "immediate"`, no schedule gate, no release-age hold, `prPriority: 10`. Automerged via PR for **minor and patch only** — see below |
| @ivuorinen actions | `ivuorinen/actions` and `ivuorinen/actions/**` (github-actions manager); `prCreation: "immediate"`, no schedule gate, no release-age hold, `prPriority: 10`. Automerged via PR for **minor, patch and digest** — see below |
| GitHub Actions (digest) | `matchManagers: ["github-actions"]`, `matchUpdateTypes: ["digest"]`; re-enables digest updates for **all** GitHub Actions, overriding the global `digest.enabled: false` (needed because `helpers:pinGitHubActionDigests` pins every action to a SHA). Docker and other digests stay disabled |

> **Rule order matters.** The four `@ivuorinen` rules are last in `packageRules`
> on purpose. Renovate applies rules in array order and later matches win, and
> the ecosystem groups above match on unanchored regexes — `/eslint/`,
> `/stylelint/` and `/semantic-release/` also match `@ivuorinen/eslint-config`,
> `@ivuorinen/stylelint-config`, `@ivuorinen/stylelint-a11y` and
> `@ivuorinen/semantic-release-config`. Placed any earlier, the fast-track
> `groupName` is silently overwritten for a third of the scope.

### Tool groups

One tool often reaches a repo through several managers: a mise pin, a pre-commit
hook, an Action plus the version its `with:` input installs, a PyPI, npm or Go
path. Each has its own `depName`, so without a group Renovate opens one PR per
source and the pins drift apart. In ivuorinen/a, `checkov` in `mise.toml` and the
`bridgecrewio/checkov` hook were updated by separate PRs. Each group matches on
`packageName`, listing every name Renovate's managers resolve the tool to. mise
maps short names such as `goreleaser` to the GitHub repo (`goreleaser/goreleaser`),
and the github-actions manager does the same for the versions in known `with:`
inputs (`cosign-release`, `version`):

| Group | packageNames |
|-------|--------------|
| actionlint | `rhysd/actionlint`, `raven-actions/actionlint`, `github.com/rhysd/actionlint/cmd/actionlint` |
| checkov | `bridgecrewio/checkov`, `checkov` |
| cosign | `sigstore/cosign`, `sigstore/cosign-installer` |
| editorconfig-checker | `editorconfig-checker/editorconfig-checker`, `editorconfig-checker/editorconfig-checker.python`, `editorconfig-checker/action-editorconfig-checker`, `editorconfig-checker` |
| gitleaks | `gitleaks/gitleaks`, `gitleaks/gitleaks-action` |
| golangci-lint | `golangci/golangci-lint`, `golangci/golangci-lint-action`, `github.com/golangci/golangci-lint/v*/cmd/golangci-lint` |
| goreleaser | `goreleaser/goreleaser`, `goreleaser/goreleaser-action`, `github.com/goreleaser/goreleaser/v*` |
| gosec | `securego/gosec`, `github.com/securego/gosec/v*/cmd/gosec` |
| markdownlint-cli | `igorshubovych/markdownlint-cli`, `markdownlint-cli` |
| markdownlint-cli2 | `DavidAnson/markdownlint-cli2`, `DavidAnson/markdownlint-cli2-action`, `markdownlint-cli2` |
| ruff | `astral-sh/ruff`, `astral-sh/ruff-pre-commit`, `astral-sh/ruff-action`, `ruff` |
| shellcheck | `koalaman/shellcheck`, `koalaman/shellcheck-precommit`, `shellcheck-py/shellcheck-py`, `shellcheck-py` |
| shfmt | `mvdan/sh`, `scop/pre-commit-shfmt`, `mvdan.cc/sh/v*/cmd/shfmt` |
| staticcheck | `dominikh/go-tools`, `dominikh/go-tools/staticcheck`, `dominikh/staticcheck-action`, `honnef.co/go/tools/cmd/staticcheck` |
| syft | `anchore/syft`, `anchore/sbom-action` |
| trivy | `aquasecurity/trivy`, `aquasecurity/trivy-action`, `aquasecurity/setup-trivy` |
| uv | `astral-sh/uv`, `astral-sh/uv-pre-commit`, `astral-sh/setup-uv`, `uv` |
| yamlfmt | `google/yamlfmt`, `github.com/google/yamlfmt/cmd/yamlfmt` |
| yamllint | `adrienverge/yamllint`, `yamllint` |
| zizmor | `zizmorcore/zizmor`, `zizmorcore/zizmor-pre-commit`, `zizmorcore/zizmor-action`, `zizmor` |

Go paths name the binary's package (`…/cmd/<tool>`), never a bare library module,
so a Go project importing one of these as a library keeps its own `chore(deps)` PR.
goreleaser is the exception: its binary lives at the module root, which is the path
the Makefile example above uses.

Every tool group commits as **`chore(tooling):`**, for every update type and every
member. A grouped branch takes its prefix from the member that sorts first by
`depName`. These groups mix `chore(deps)` (mise), `chore(tooling)` (pre-commit)
and `chore(actions)` members, so without a group-wide prefix the title would follow
the alphabet: cosign would come out as `chore(deps):` and cut a release for a
signing-tool bump. Set on the group, the prefix reaches every member and releases
nothing. This also means an Action in a tool group,
such as `goreleaser/goreleaser-action`, commits as `tooling`, not `actions`. Tool
groups carry no ` (dev)` suffix, because every member already shares one prefix.
The suffix would only split an npm devDependency (`markdownlint-cli2`) from its own
hook.

Titles always show a version. When every member's new version is spelled the same,
the usual ` (current → new)` stays, e.g.
`chore(tooling): update checkov (3.2.500 → 3.3.29)`, where the checkov hook and
mise pin both read `3.3.29`. When the spellings differ, Renovate drops
`commitMessageExtra` from a group, which would leave a bare `update goreleaser`.
That covers an Action at v7 next to its binary at v2, and also a hook tagged
`v1.7.12` next to a mise pin of `1.7.12`. So `group.commitMessageTopic` lists the
distinct target versions instead, normalised with a leading `v`:
`chore(tooling): update actionlint to v1.7.12`,
`chore(tooling): update goreleaser to v2.18.3, v6.4.0`. A tool's Action major stays
in its own `major-N-<group>` branch (`separateMajorMinor`) and keeps the ungrouped
title, such as
`chore(tooling): update goreleaser/goreleaser-action action (v6.0.0 → v7.3.0)`.

The tool groups sit after the ecosystem groups and the **development tools** group
and before the `@ivuorinen` rules. Later matching rules win, so a Makefile or
workflow pin of a grouped tool leaves **development tools**, and no other rule's
prefix overwrites `tooling`. `test/check-commit-messages.mjs` asserts the prefix
ordering.

### Digest updates and automerge

Digest updates are enabled for GitHub Actions but **not** automerged for
third-party actions. Renovate pushes digest updates outside its internal-checks
filter, so `minimumReleaseAge` never applies to them — automerging a digest
would accept a force-moved third-party tag with no cooldown and no review,
which is precisely what `helpers:pinGitHubActionDigests` exists to prevent.

Third-party action digests therefore raise a reviewable PR. Only
`ivuorinen/actions` digests automerge, via the trusted-source rule at the end of
`packageRules`.

### Go toolchain updates need a `toolchain` directive

Renovate updates the `toolchain` directive in `go.mod` by default, and this preset
adds no rule for it. It deliberately does **not** bump the `go` directive: `go` is
the language-compatibility floor, so raising it raises the minimum Go version for
every importer, and Renovate's gomod docs recommend against routine bumps. `mise`
is also moving away from reading `go` in favour of `toolchain`.

The practical consequence: a `go.mod` with no `toolchain` line gets **no** Go
version updates at all. The shape that works is a low, stable floor plus a
tracked toolchain:

```
go 1.25.0

toolchain go1.27.0
```

Fix that in the consuming repo — there is nothing to configure here.

### First-party majors are not automerged

Each `@ivuorinen` fast-track is split into a grouping rule (all update types) and
an automerge rule (minor/patch, plus `digest` for `ivuorinen/actions`). Majors are
excluded on purpose: these rules waive both the 3-day `minimumReleaseAge` and the
non-office-hours schedule, so an automerged first-party major would land in every
consuming repo within one Renovate run with no cooldown and no human in the loop.
That is the same reasoning this repo's own `.github/renovate.json` applies to
`renovatebot/**`. First-party majors still get an immediate, top-priority PR —
they just need a click.

## Post-update options

Lock file maintenance after dependency updates:

| Option | Description |
|--------|-------------|
| `bundlerConservative` | Conservative Bundler updates |
| `composerWithAll` | Run `composer update` with `--with-all-dependencies` |
| `gomodTidy` | Run `go mod tidy` after updates, so `go.mod` and `go.sum` do not keep entries the update dropped |
| `gomodUpdateImportPaths` | Update Go import paths on major updates |
| `npmDedupe` | Run `npm dedupe` after updates |
| `pnpmDedupe` | Run `pnpm dedupe` after updates |
| `yarnDedupeHighest` | Run `yarn dedupe --strategy highest` after updates |

## Other configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `digest.enabled` | `false` | Digest-only updates disabled globally (re-enabled for all GitHub Actions via a package rule) |
| `git-submodules.enabled` | `true` | Track git submodule updates |
| `git-submodules` release-age exemption | `minimumReleaseAge: null` | The `git-refs` datasource returns no `releaseTimestamp`, and `minimumReleaseAgeBehaviour` defaults to `timestamp-required` — without this exemption every submodule update would sit "pending" forever and no branch would ever be created. Every other datasource keeps the fail-closed 3-day hold |
| `pre-commit.enabled` | `true` | Update pre-commit hook versions |
| `ignorePaths` | `config:recommended` defaults (`node_modules`, `vendor`, `test(s)`, `examples`, fixtures) plus `**/*.sops.*`, `**/.archive/**`, `**/testdata/**` | Skip vendored, encrypted, archived, and test fixture files. The standard defaults are re-listed because `ignorePaths` is non-mergeable — a custom value replaces them |

## Validation

Run the hooks to validate `default.json` with either
[`prek`](https://github.com/j178/prek) (a drop-in reimplementation) or
`pre-commit` — both read the same `.pre-commit-config.yaml`:

```sh
prek run --all-files
# or: pre-commit run --all-files
```

This executes:

- **`pretty-format-json`** -- ensures consistent JSON formatting
- **`renovate-config-validator --strict`** -- Renovate's own config validation,
  run against both `default.json` and `.github/renovate.json`
- **`check-custom-managers`** -- runs `test/check-managers.mjs`, which applies the
  `customManagers` regexes from `default.json` to `test/fixtures/` and asserts what
  they extract. `renovate-config-validator` only checks that a match string
  *compiles*, never that it *matches* anything, so this is the only guard against a
  regex that silently stops extracting. Requires `node` on `PATH`
- **`check-commit-messages`** -- runs `test/check-commit-messages.mjs`, which asserts
  every `commitMessagePrefix` in `default.json` is a valid conventional-commit prefix
  and that none carries a `!` breaking marker. It asserts that GitHub Actions,
  `nvm`, `pre-commit`, `devDependencies`, `require-dev` and lock-file-only updates
  each get their own scope (`actions`, `tooling`, `dev-deps`, `lockfile`) for every
  update type, and that only a GitHub Actions rule uses the `actions` scope. It also
  asserts that every group either carries the ` (dev)` suffix or sets its own
  prefix. A [tool group](#tool-groups) prefix must match its `semanticCommitScope`
  and must sit after every other prefixed rule.
  The validator
  types `commitMessagePrefix` as a plain string, so none of those defects fail it —
  they fail commitlint in consuming repos instead. Requires `node` on `PATH`
- Standard checks (trailing whitespace, end-of-file fixer, etc.)

The same hooks run in CI on every push to `main` and every pull request
(`.github/workflows/validate.yml`). This matters because consumers extend
`github>ivuorinen/renovate-config`, which resolves the default branch on every
Renovate run — an unvalidated commit reaches every dependent repo immediately.

## License

[MIT](LICENSE)
