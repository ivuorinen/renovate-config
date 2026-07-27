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
| `:label(dependencies)` | Add `dependencies` label to all PRs |
| `:preserveSemverRanges` | Keep existing semver range syntax when updating |
| `:semanticCommits` | Use conventional commit messages (`chore(deps):`) |
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
| `commitBody` | `Signed-off-by: {{{gitAuthor}}}` | DCO sign-off in commit body |
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
# renovate: datasource=github-releases depName=golang/go
GO_VERSION := 1.21
```

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

## Package rules

### Automerge and labeling

| Rule | Matches | Effect |
|------|---------|--------|
| Major commit prefix | `matchUpdateTypes: ["major"]` | `chore(deps)!:` prefix, `type/major` label |
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
| `github-actions` (manager) | `renovate/github-action` | scope: `actions` (non-major; major bumps use `chore(deps)!:`) |
| `pypi` | `renovate/pip` | - |

### Dependency groups

Related packages are grouped into single PRs:

| Group name | Match criteria |
|------------|----------------|
| devDependencies (non-major) | `matchDepTypes: ["devDependencies"]`, minor/patch only |
| development tools | `matchFileNames: ["**/Makefile", "**/*.mk"]`, custom.regex manager |
| eslint | Package names matching `/eslint/` |
| illuminate | Package names matching `/illuminate/` |
| phpstan | Package names matching `/phpstan/` or `/larastan/` |
| semantic-release | Package names matching `/semantic-release/` |
| stylelint | Package names matching `/stylelint/` |
| tailwind | Package names matching `/tailwind/` |
| vite | Package names matching `/vite/` |
| vue | Package names matching `/vue/` |
| @ivuorinen packages | Package names matching `@ivuorinen/**`; `prCreation: "immediate"`, no schedule gate, no release-age hold, automerged via PR (all update types), `prPriority: 10` |
| @ivuorinen actions | `ivuorinen/actions` and `ivuorinen/actions/**` (github-actions manager); `prCreation: "immediate"`, no schedule gate, no release-age hold, automerged via PR (all update types), `prPriority: 10` |
| GitHub Actions (digest) | `matchManagers: ["github-actions"]`, `matchUpdateTypes: ["digest"]`; re-enables digest updates for **all** GitHub Actions, overriding the global `digest.enabled: false` (needed because `helpers:pinGitHubActionDigests` pins every action to a SHA). Docker and other digests stay disabled |

> **Rule order matters.** The two `@ivuorinen` rules are last in `packageRules`
> on purpose. Renovate applies rules in array order and later matches win, and
> the ecosystem groups above match on unanchored regexes — `/eslint/`,
> `/stylelint/` and `/semantic-release/` also match `@ivuorinen/eslint-config`,
> `@ivuorinen/stylelint-config`, `@ivuorinen/stylelint-a11y` and
> `@ivuorinen/semantic-release-config`. Placed any earlier, the fast-track
> `groupName` is silently overwritten for a third of the scope.

### Digest updates and automerge

Digest updates are enabled for GitHub Actions but **not** automerged for
third-party actions. Renovate pushes digest updates outside its internal-checks
filter, so `minimumReleaseAge` never applies to them — automerging a digest
would accept a force-moved third-party tag with no cooldown and no review,
which is precisely what `helpers:pinGitHubActionDigests` exists to prevent.

Third-party action digests therefore raise a reviewable PR. Only
`ivuorinen/actions` digests automerge, via the trusted-source rule at the end of
`packageRules`.

## Post-update options

Lock file maintenance after dependency updates:

| Option | Description |
|--------|-------------|
| `bundlerConservative` | Conservative Bundler updates |
| `composerWithAll` | Run `composer update` with `--with-all-dependencies` |
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
- **`check-renovate-preset`** -- JSON Schema validation against `renovate-schema.json`
- **`check-custom-managers`** -- runs `test/check-managers.mjs`, which applies the
  `customManagers` regexes from `default.json` to `test/fixtures/` and asserts what
  they extract. `renovate-config-validator` only checks that a match string
  *compiles*, never that it *matches* anything, so this is the only guard against a
  regex that silently stops extracting. Requires `node` on `PATH`
- Standard checks (trailing whitespace, end-of-file fixer, etc.)

The same hooks run in CI on every push to `main` and every pull request
(`.github/workflows/validate.yml`). This matters because consumers extend
`github>ivuorinen/renovate-config`, which resolves the default branch on every
Renovate run — an unvalidated commit reaches every dependent repo immediately.

## License

[MIT](LICENSE)
