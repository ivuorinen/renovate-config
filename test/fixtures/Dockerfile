# Fixture for the Dockerfile ENV custom manager in default.json.
# Not a buildable image — test/** is in ignorePaths, so Renovate never updates these.
# Each ENV below must be extracted by the manager; test/check-managers.mjs asserts it.

FROM alpine:3.21

# single-word name
ENV HELM_VERSION=3.14.0 # github-releases/helm/helm
# multi-word name — missed by the old [A-Z]+_VERSION pattern
ENV DOCKER_COMPOSE_VERSION=2.24.0 # github-releases/docker/compose
ENV NODE_EXPORTER_VERSION=1.7.0 # github-releases/prometheus/node_exporter
# digit in the name — also missed by the old pattern
ENV PHP8_VERSION=8.3.0 # github-releases/php/php-src
# explicit versioning override
ENV GO_VERSION=1.21.0 # golang-version/go&versioning=semver

# must NOT be extracted (no datasource comment)
ENV UNRELATED=bar
