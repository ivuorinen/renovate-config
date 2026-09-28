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

// Updates that never touch a consuming package's public API, so a major bump of one
// must never carry the "!" that makes semantic-release cut a major. Each target
// names how a packageRule selects it and the one scope its override must use:
// 'actions' is reserved for GitHub Actions, so a dev-dependency or .nvmrc bump is
// never mislabelled as a workflow change.
const NON_BREAKING = [
  { name: 'github-actions', field: 'matchManagers', scope: 'actions' },
  { name: 'nvm', field: 'matchManagers', scope: 'tooling' },
  { name: 'pre-commit', field: 'matchManagers', scope: 'tooling' },
  { name: 'devDependencies', field: 'matchDepTypes', scope: 'dev-deps' },
  { name: 'require-dev', field: 'matchDepTypes', scope: 'dev-deps' },
];

const targetsOf = (rule) => NON_BREAKING.filter((t) => (rule[t.field] ?? []).includes(t.name));
const matchesNonBreaking = (rule) => targetsOf(rule).length > 0;
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

// 2. No rule selecting a non-breaking target marks its updates breaking, and its
//    prefix uses that target's scope. See CLAUDE.md.
for (const { rule, index } of prefixed.filter(({ rule }) => matchesNonBreaking(rule))) {
  const names = targetsOf(rule).map((t) => t.name).join(', ');
  if (rule.commitMessagePrefix.includes('!')) {
    fail(
      `packageRules[${index}] marks ${names} updates breaking with ` +
        `${JSON.stringify(rule.commitMessagePrefix)} — these bumps are never breaking`,
    );
  } else {
    pass(`packageRules[${index}] ${names} prefix carries no breaking marker`);
  }
  for (const target of targetsOf(rule)) {
    if (!rule.commitMessagePrefix.startsWith(`chore(${target.scope}): `)) {
      fail(
        `packageRules[${index}] gives ${target.name} ${JSON.stringify(rule.commitMessagePrefix)}; ` +
          `expected "chore(${target.scope}): "`,
      );
    }
  }
}

// 3. Coverage and ordering. Renovate applies packageRules in array order and later
//    matches win, so each target's non-breaking prefix only survives if it sits
//    after every unscoped breaking prefix. Without this check, moving a rule up —
//    or dropping one — silently restores "chore(deps)!:" on that target's majors.
const breakingBefore = prefixed.filter(
  ({ rule }) =>
    rule.commitMessagePrefix.includes('!') && !rule.matchManagers && !rule.matchDepTypes,
);

for (const target of NON_BREAKING) {
  const overrides = prefixed.filter(({ rule }) => targetsOf(rule).includes(target));
  if (breakingBefore.length && !overrides.length) {
    fail(
      `a breaking commitMessagePrefix applies to every update and no ${target.name} rule ` +
        `overrides it — ${target.name} majors would ship as breaking changes`,
    );
  }
  for (const override of overrides) {
    for (const breaking of breakingBefore) {
      if (breaking.index > override.index) {
        fail(
          `packageRules[${breaking.index}] (${JSON.stringify(breaking.rule.commitMessagePrefix)}) ` +
            `comes after the ${target.name} override at packageRules[${override.index}] and ` +
            'overwrites it — later matching rules win',
        );
      } else {
        pass(
          `packageRules[${override.index}] ${target.name} override still wins over ` +
            `packageRules[${breaking.index}]`,
        );
      }
    }
  }
}

// 4. The 'actions' scope belongs to GitHub Actions alone. Any other rule setting it
//    — as a semanticCommitScope or inside a literal prefix — labels a non-workflow
//    bump as a workflow change in every consuming repo's history and release notes.
rules.forEach((rule, index) => {
  const usesActions =
    rule.semanticCommitScope === 'actions' ||
    (typeof rule.commitMessagePrefix === 'string' && rule.commitMessagePrefix.includes('(actions)'));
  if (!usesActions) return;
  const managers = rule.matchManagers ?? [];
  if (managers.length === 1 && managers[0] === 'github-actions') {
    pass(`packageRules[${index}] uses the actions scope for github-actions only`);
  } else {
    fail(
      `packageRules[${index}] uses the actions scope for ${JSON.stringify(managers)} — ` +
        'only a rule matching exactly ["github-actions"] may',
    );
  }
});

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall commit-message checks passed');
