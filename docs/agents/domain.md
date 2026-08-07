# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`AGENTS.md`** at the repo root as well as the `README.md` at root.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repository:

```
/
├── AGENTS.md
├── docs/adr/
├── docs/plans/
├── docs/specs/
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept— in an issue title, refactor proposal, hypothesis, or test name— use the term as defined in the `glossary.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either reconsider whether you're inventing language the project doesn't use or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts an existing ADR — but worth reopening because…_
