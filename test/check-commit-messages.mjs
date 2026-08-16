// Smoke test for the commit-message shape in default.json.
//
// renovate-config-validator types commitMessagePrefix as a plain string: it will
// accept "Chore(Deps): ", "deps: ", or a "!" breaking marker on GitHub Actions
// without complaint. Every one of those reaches consuming repos as a commitlint
// failure or — in the "!" case — a spurious major release across every repo that
// extends this preset. Same gap as the customManagers regexes, same fix: read the
// config and assert what it produces.
//
// Run: node test/check-commit-messages.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, '..', 'default.json'), 'utf8'));

// @commitlint/config-conventional type-enum, which ivuorinen/base-configs-commitlint
// inherits unchanged. A prefix whose type is outside this list fails type-enum at
// error level in every consuming repo.
const TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

// Conventional-commit prefix as Renovate emits it: type, optional lower-case
// scope, optional "!", ": ", trailing space. Renovate collapses interior
// whitespace, so the trailing space is cosmetic but keeps the intent readable.
const PREFIX = new RegExp(`^(${TYPES.join('|')})(\\([a-z][a-z0-9-]*\\))?!?: $`);

const rules = config.packageRules ?? [];
const failures = [];

const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL ${msg}`);
};
const pass = (msg) => console.log(`ok   ${msg}`);

const matchesActions = (rule) => (rule.matchManagers ?? []).includes('github-actions');
const prefixed = rules
  .map((rule, index) => ({ rule, index }))
  .filter(({ rule }) => typeof rule.commitMessagePrefix === 'string');

// 1. Every prefix is a valid conventional-commit prefix.
for (const { rule, index } of prefixed) {
  const prefix = rule.commitMessagePrefix;
  if (PREFIX.test(prefix)) {
    pass(`packageRules[${index}] prefix ${JSON.stringify(prefix)} is a valid conventional prefix`);
  } else {
    fail(
      `packageRules[${index}] prefix ${JSON.stringify(prefix)} is not a valid conventional prefix ` +
        `(expected /${PREFIX.source}/)`,
    );
  }
}

// 2. No rule scoped to the github-actions manager marks its updates breaking.
//    A GitHub Actions bump changes CI only, never the consuming package's public
//    API, so the "!" must never appear on one. See CLAUDE.md.
for (const { rule, index } of prefixed.filter(({ rule }) => matchesActions(rule))) {
  if (rule.commitMessagePrefix.includes('!')) {
    fail(
      `packageRules[${index}] marks github-actions updates breaking with ` +
        `${JSON.stringify(rule.commitMessagePrefix)} — actions bumps are never breaking`,
    );
  } else {
    pass(`packageRules[${index}] github-actions prefix carries no breaking marker`);
  }
}

// 3. Ordering invariant. Renovate applies packageRules in array order and later
//    matches win, so a github-actions prefix only survives if it sits after every
//    unscoped breaking prefix that would also match an actions update. Without
//    this check, moving the rule up silently restores "chore(deps)!:" on actions.
const breakingBefore = prefixed.filter(
  ({ rule }) => rule.commitMessagePrefix.includes('!') && !rule.matchManagers,
);
const actionsPrefixes = prefixed.filter(({ rule }) => matchesActions(rule));

if (breakingBefore.length && !actionsPrefixes.length) {
  fail(
    'a breaking commitMessagePrefix applies to all managers and no github-actions rule ' +
      'overrides it — actions majors would ship as breaking changes',
  );
}
for (const actions of actionsPrefixes) {
  for (const breaking of breakingBefore) {
    if (breaking.index > actions.index) {
      fail(
        `packageRules[${breaking.index}] (${JSON.stringify(breaking.rule.commitMessagePrefix)}) ` +
          `comes after the github-actions override at packageRules[${actions.index}] and ` +
          'overwrites it — later matching rules win',
      );
    } else {
      pass(
        `packageRules[${actions.index}] github-actions override still wins over ` +
          `packageRules[${breaking.index}]`,
      );
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall commit-message checks passed');
