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

// Updates that never reach a consuming package, so they must release nothing. Each
// target names how a packageRule selects it and the one scope that rule must give
// it: 'actions' is reserved for GitHub Actions, so a dev-dependency or .nvmrc bump
// is never mislabelled as a workflow change.
const NO_RELEASE = [
  { name: 'github-actions', field: 'matchManagers', scope: 'actions' },
  { name: 'nvm', field: 'matchManagers', scope: 'tooling' },
  { name: 'pre-commit', field: 'matchManagers', scope: 'tooling' },
  { name: 'devDependencies', field: 'matchDepTypes', scope: 'dev-deps' },
  { name: 'require-dev', field: 'matchDepTypes', scope: 'dev-deps' },
];

const targetsOf = (rule) => NO_RELEASE.filter((t) => (rule[t.field] ?? []).includes(t.name));
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

// 2. No prefix marks an update breaking. A dependency's major is not a major of the
//    package that depends on it, and a "!" lets semantic-release cut a major nobody
//    chose; when a package cuts a major is its owner's call.
for (const { rule, index } of prefixed) {
  if (rule.commitMessagePrefix.includes('!')) {
    fail(`packageRules[${index}] prefix ${JSON.stringify(rule.commitMessagePrefix)} marks updates breaking`);
  } else {
    pass(`packageRules[${index}] prefix carries no breaking marker`);
  }
}

// 3. Every no-release target gets its own scope for every update type. Renovate
//    builds the prefix from semanticCommitType + semanticCommitScope whenever no
//    literal prefix applies, so a scope-only rule such as the github-actions label
//    rule decides every commit for its target. A 'deps' scope or prefix on one of
//    these rules would make its updates release again.
for (const target of NO_RELEASE) {
  const selecting = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => targetsOf(rule).includes(target));
  for (const { rule, index } of selecting) {
    if (rule.semanticCommitScope !== undefined && rule.semanticCommitScope !== target.scope) {
      fail(
        `packageRules[${index}] gives ${target.name} semanticCommitScope ` +
          `${JSON.stringify(rule.semanticCommitScope)}; expected "${target.scope}"`,
      );
    }
    if (
      typeof rule.commitMessagePrefix === 'string' &&
      !rule.commitMessagePrefix.startsWith(`chore(${target.scope}): `)
    ) {
      fail(
        `packageRules[${index}] gives ${target.name} ${JSON.stringify(rule.commitMessagePrefix)}; ` +
          `expected "chore(${target.scope}): "`,
      );
    }
  }
  const coversAllUpdates = selecting.some(
    ({ rule }) =>
      !rule.matchUpdateTypes &&
      (rule.semanticCommitScope === target.scope ||
        rule.commitMessagePrefix?.startsWith(`chore(${target.scope}): `)),
  );
  if (coversAllUpdates) {
    pass(`${target.name} gets the "${target.scope}" scope for every update type`);
  } else {
    fail(
      `no rule gives ${target.name} the "${target.scope}" scope for every update type — ` +
        'its updates fall back to "deps" and release',
    );
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

// 5. Groups that can mix runtime and dev dependencies split the dev half out. A
//    grouped branch takes its prefix from the first upgrade sorted by depName, so a
//    group holding both would title a runtime bump 'chore(dev-deps)' and it would
//    never release. A group scoped by matchDepTypes or matchManagers (the dev-only
//    group, custom.regex tool pins, first-party actions) cannot mix, so it is exempt.
//    So is a group with its own literal prefix (the tool groups): every member
//    carries that prefix, so no member's prefix can leak onto another. Check 6
//    holds those groups to it.
const DEV_SUFFIX =
  "{{#if (or (equals depType 'devDependencies') (equals depType 'require-dev'))}} (dev){{/if}}";
const isPrefixedGroup = (rule) =>
  typeof rule.groupName === 'string' && typeof rule.commitMessagePrefix === 'string';
rules.forEach((rule, index) => {
  if (typeof rule.groupName !== 'string' || rule.matchDepTypes || rule.matchManagers) return;
  if (isPrefixedGroup(rule)) return;
  if (rule.groupName.endsWith(DEV_SUFFIX)) {
    pass(`packageRules[${index}] group splits dev dependencies out`);
  } else {
    fail(
      `packageRules[${index}] groupName ${JSON.stringify(rule.groupName)} can mix runtime and ` +
        'dev dependencies — append the (dev) suffix template',
    );
  }
});

// 6. A group that sets its own prefix only stops the first-member leak in check 5
//    if the prefix survives to every member: it must agree with its
//    semanticCommitScope and sit after every other prefixed rule. A prefixed rule
//    placed after it would overwrite it for the members both match, and the group
//    title would follow the alphabet again. Check 2 already rejects a "!".
const lastOtherPrefix = Math.max(
  -1,
  ...prefixed.filter(({ rule }) => !isPrefixedGroup(rule)).map(({ index }) => index),
);
rules.forEach((rule, index) => {
  if (!isPrefixedGroup(rule)) return;
  const name = JSON.stringify(rule.groupName);
  if (rule.commitMessagePrefix !== `chore(${rule.semanticCommitScope}): `) {
    fail(
      `packageRules[${index}] group ${name} prefix ${JSON.stringify(rule.commitMessagePrefix)} ` +
        `disagrees with semanticCommitScope ${JSON.stringify(rule.semanticCommitScope)}`,
    );
  } else if (index < lastOtherPrefix) {
    fail(
      `packageRules[${index}] group ${name} comes before packageRules[${lastOtherPrefix}], ` +
        'whose prefix overwrites it — later matching rules win',
    );
  } else {
    pass(`packageRules[${index}] group ${name} prefix reaches every member`);
  }
});

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall commit-message checks passed');
