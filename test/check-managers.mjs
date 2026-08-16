// Smoke test for the customManagers in default.json.
//
// renovate-config-validator only checks that a matchString *compiles*; it never
// checks that it *matches*. Three silent extraction bugs shipped past it. This
// reads the regexes straight out of default.json (so it can never drift from the
// config) and runs them against test/fixtures/.
//
// Run: node test/check-managers.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, '..', 'default.json'), 'utf8'));

const failures = [];

/** Apply every matchString of a manager over a file, return the captured groups. */
function extract(manager, file) {
  const text = readFileSync(join(here, 'fixtures', file), 'utf8');
  const found = [];
  for (const source of manager.matchStrings) {
    for (const m of text.matchAll(new RegExp(source, 'g'))) {
      found.push(m.groups);
    }
  }
  return found;
}

function check(label, actual, expected) {
  const got = [...actual].sort();
  const want = [...expected].sort();
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`ok   ${label} (${got.length})`);
    return;
  }
  failures.push(label);
  console.log(`FAIL ${label}`);
  console.log(`       expected: ${JSON.stringify(want)}`);
  console.log(`       actual:   ${JSON.stringify(got)}`);
}

const dockerfile = config.customManagers.find((m) =>
  m.managerFilePatterns.some((p) => p.includes('Dockerfile')),
);
const makefile = config.customManagers.find((m) =>
  m.managerFilePatterns.some((p) => p.includes('Makefile')),
);

if (!dockerfile || !makefile) {
  console.error('FAIL could not locate both custom managers in default.json');
  process.exit(1);
}

const docker = extract(dockerfile, 'Dockerfile');
check(
  'Dockerfile ENV manager extracts every annotated variable',
  docker.map((g) => g.depName),
  ['helm/helm', 'docker/compose', 'prometheus/node_exporter', 'php/php-src', 'go'],
);
check(
  'Dockerfile ENV manager captures the &versioning= override',
  docker.filter((g) => g.versioning).map((g) => `${g.depName}=${g.versioning}`),
  ['go=semver'],
);

const make = extract(makefile, 'Makefile');
check(
  'Makefile manager extracts every annotated variable',
  make.map((g) => g.depName),
  [
    'github.com/goreleaser/goreleaser/v2',
    'golangci/golangci-lint',
    'kubernetes/kubernetes',
    'go',
    'node',
  ],
);
check(
  'Makefile manager captures trailing versioning= fields',
  make.filter((g) => g.versioning).map((g) => `${g.depName}=${g.versioning}`),
  ['golangci/golangci-lint=semver', 'node=node'],
);
check(
  'Makefile manager accepts two-part versions',
  make.filter((g) => g.depName === 'go').map((g) => g.currentValue),
  ['1.21'],
);

// golang/go has zero GitHub Releases, so `datasource=github-releases depName=golang/go`
// resolves nothing and the pin never moves — silently, with no error. The fixtures are
// what consumers copy, so neither may teach that pairing. Asserted against the groups the
// manager actually extracts, not the file text, so prose about the trap cannot trip it.
for (const [file, groups] of [
  ['Dockerfile', docker],
  ['Makefile', make],
]) {
  const bad = groups.filter((g) => g.datasource === 'github-releases' && g.depName === 'golang/go');
  if (bad.length) {
    failures.push(`${file} pairs golang/go with github-releases`);
    console.log(`FAIL ${file} annotates golang/go with github-releases — use golang-version/go`);
  } else {
    console.log(`ok   ${file} does not pair golang/go with github-releases`);
  }
}

// A two-part currentValue is only usable if the versioning tolerates it.
// "semver" rejects 1.21 outright, which is what versioningTemplate used to pin.
if (config.customManagers.some((m) => m.versioningTemplate === 'semver')) {
  failures.push('versioningTemplate pins strict semver');
  console.log('FAIL versioningTemplate must not pin strict "semver" — it rejects two-part versions');
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall manager checks passed');
