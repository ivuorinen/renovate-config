# Fixture for the Makefile custom manager in default.json.
# Not a real Makefile — test/** is in ignorePaths, so Renovate never updates these.
# Each annotated variable below must be extracted; test/check-managers.mjs asserts it.

# renovate: datasource=go depName=github.com/goreleaser/goreleaser/v2
GORELEASER_VERSION := v2.14.1

# trailing versioning= field — missed by the old depName=(\S+)\n pattern
# renovate: datasource=github-releases depName=golangci/golangci-lint versioning=semver
LINT_VERSION := v1.61.0

# trailing extractVersion= field — also missed by the old pattern
# renovate: datasource=github-releases depName=kubernetes/kubernetes extractVersion=^v(?<version>.*)$
K8S_VERSION := 1.29.0

# two-part version — rejected by the old versioningTemplate "semver".
# datasource is golang-version, NOT github-releases: golang/go publishes tags but
# no GitHub Releases, so github-releases resolves zero versions and never updates.
# renovate: datasource=golang-version depName=go
GO_VERSION := 1.21

# lowercase name and ?= assignment
# renovate: datasource=docker depName=node versioning=node
node_version ?= 22.11.0

# must NOT be extracted (no renovate comment)
UNRELATED := 1.2.3
