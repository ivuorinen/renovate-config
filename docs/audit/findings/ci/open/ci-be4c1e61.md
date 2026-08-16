---
id: ci-be4c1e61
auditor: ci
severity: advisory
category: reliability
area: .pre-commit-config.yaml (check-renovate-preset schemafile URL)
status: open
found: 2026-08-16
---

# check-renovate-preset validates against a live remote schema

## Problem

The `check-renovate-preset` hook passes `--schemafile https://docs.renovatebot.com/renovate-schema.json`, so the schema is fetched over the network at check time and is not pinned to anything. The validation result for an unchanged commit depends on what upstream published that day and on `docs.renovatebot.com` being reachable.

## Evidence

`.pre-commit-config.yaml`:
```yaml
  - repo: https://github.com/python-jsonschema/check-jsonschema
    rev: 0.38.0
    hooks:
      - id: check-jsonschema
        name: check-renovate-preset
        files: default.json
        args:
          - --schemafile
          - https://docs.renovatebot.com/renovate-schema.json
```
The sibling `renovate-config-validator` hook is pinned at `rev: 44.30.4`, so the two validators can disagree: the pinned validator checks against Renovate 44.30.4's rules while the schema check uses whatever is current. A schema tightening upstream turns CI red with no repository change; an outage fails the job outright.

## Impact

Occasional unexplained CI failures on unchanged commits. No correctness risk to the preset itself — the live schema is stricter and more current than any vendored copy, which is the reason to use it — so this is informational.

## Fix

No action required; the live schema is the right trade for a config repo whose whole job is to track Renovate. If reproducibility becomes worth more than currency, vendor the schema under `test/` and let the `pip_requirements`-style pinning story cover it, accepting the drift that follows. Recorded so a future red CI run on an unchanged commit is diagnosed in seconds rather than investigated.
