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
| `:labels(dependencies)` | Add `dependencies` label to all PRs |
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
| `commitMessageExtra` | `({{currentVersion}} -> {{newVersion}})` | Show version range in commits |
| `dependencyDashboardLabels` | `["no-stale"]` | Prevent stale-bot from closing the dashboard |
| `dependencyDashboardOSVVulnerabilitySummary` | `unresolved` | Show unresolved OSV vulnerabilities |
| `dependencyDashboardTitle` | `Renovate Dashboard` | Custom dashboard issue title |
| `onboardingConfigFileName` | `.github/renovate.json` | Default onboarding config path |
| `prHourlyLimit` | `5` | Max 5 PRs created per hour |
| `reviewersFromCodeOwners` | `true` | Request reviews from CODEOWNERS |
| `separateMultipleMajor` | `true` | Create separate PRs for each major version bump |

## Custom managers

### Dockerfile

Extracts versions from `ENV` variables and `FROM` lines in Dockerfiles using
[regex manager](https://docs.renovatebot.com/modules/manager/regex/).

**Patterns matched:**

```dockerfile
# ENV with inline datasource comment
ENV TOOL_VERSION=1.2.3 # github-releases/owner/repo

# Standard FROM line
FROM node:20-alpine
```

Regex (applied with `matchStringsStrategy: "any"`):

```
ENV [A-Z]+_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\&versioning=(?<versioning>.*))?\s
FROM (?<depName>\S*):(?<currentValue>\S*)
```

### Makefile

Tracks tool versions in Makefiles via `# renovate:` comments using
[regex manager](https://docs.renovatebot.com/modules/manager/regex/).

Files matched: `Makefile`, `*.mk`

**Pattern matched:**

```makefile
# renovate: datasource=go depName=github.com/goreleaser/goreleaser/v2
GORELEASER_VERSION := v2.14.1
```

Regex:

```
#\s*renovate:\s*datasource=(?<datasource>\S+)\s+depName=(?<depName>\S+)\n[A-Z_]+\s*:?=\s*(?<currentValue>v?\d+\.\d+\.\d+\S*)
```

The `datasource` and `depName` are captured from the comment, and
`currentValue` from the variable assignment. Uses `semver` versioning.

## Package rules

### Automerge and labeling

| Rule | Matches | Effect |
|------|---------|--------|
| Major commit prefix | `matchUpdateTypes: ["major"]` | `chore(deps)!:` prefix, `type/major` label |
| Automerge non-major | `matchUpdateTypes: ["minor", "patch", "digest"]` | Automerge via branch strategy |
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
| `github-actions` (manager) | `renovate/github-action` | scope: `actions` |
| `pypi` | `renovate/pip` | - |

### Dependency groups

Related packages are grouped into single PRs:

| Group name | Match criteria |
|------------|----------------|
| devDependencies (non-major) | `matchDepTypes: ["devDependencies"]`, minor/patch only |
| development tools | `matchFileNames: ["Makefile", "**/*.mk"]`, custom.regex manager |
| eslint | Package names matching `/eslint/` |
| illuminate | Package names matching `/illuminate/` |
| phpstan | Package names matching `/phpstan/` or `/larastan/` |
| semantic-release | Package names matching `/semantic-release/` |
| stylelint | Package names matching `/stylelint/` |
| tailwind | Package names matching `/tailwind/` |
| vite | Package names matching `/vite/` |
| vue | Package names matching `/vue/` |
| @ivuorinen packages | Package names matching `@ivuorinen/**`; no schedule gate, no release-age hold, `prPriority: 10` |

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
| `digest.enabled` | `false` | Digest-only updates disabled |
| `git-submodules.enabled` | `true` | Track git submodule updates |
| `pre-commit.enabled` | `true` | Update pre-commit hook versions |
| `ignorePaths` | `**/*.sops.*`, `**/.archive/**`, `**/testdata/**` | Skip encrypted, archived, and test fixture files |

## Validation

Run the pre-commit hooks to validate `default.json`:

```sh
pre-commit run --all-files
```

This executes:

- **`pretty-format-json`** -- ensures consistent JSON formatting
- **`renovate-config-validator --strict`** -- Renovate's own config validation
- **`check-renovate`** -- JSON Schema validation against `renovate-global-schema.json`
- Standard checks (trailing whitespace, end-of-file fixer, etc.)

## License

[MIT](LICENSE)
