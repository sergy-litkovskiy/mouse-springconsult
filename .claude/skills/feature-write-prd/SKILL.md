---
name: feature-write-prd
description: >
  Use when drafting a PRD for SDLC stage 03 with idea-brief.md + CONTEXT.md present.
  Reads required inputs, asks via AskUserQuestion which optional channels to use
  (--reference module code, RAG, docs), drafts from ./templates/PRD-template.md,
  Socratically validates per item, then runs a clean-context critic on the edits-log,
  then writes the file. Hard refuse if idea-brief.md or CONTEXT.md missing.
  Triggers: "/feature-write-prd {slug}", "write PRD for {slug}", "draft PRD for {slug}",
  "PRD для {slug}", "write spec for {slug}", "product requirements for {slug}".
  Output: docs/features/{slug}/PRD.md.
triggers:
  - /feature-write-prd
  - "write PRD for"
  - "draft PRD for"
  - "PRD для"
  - "write spec for"
  - "product requirements for"
stage: "03"
---

# Skill: feature-write-prd (SDLC stage 03 — code-aware PRD drafter)

Generates a stage-03 PRD draft from upstream idea-phase artifacts + optional reference code patterns, validates each proposed item Socratically, then runs a clean-context critic before writing. Less typing, more reviewing. Detail per Protocol step lives in `references/`; this file is the backbone.

## Owner

The person in the idea-brief frontmatter `owner` — a single-operator project (CONTEXT: `user` is the only human in the system). There is no PM, Tech Lead, Security Lead or Data Owner to hand a section to: whoever runs the skill authors every section and signs it off.

## When to use

- `/feature-write-prd {slug}` invocation, with `idea-brief.md` + `CONTEXT.md` already present.
- If `docs/features/<slug>/PRD.md` already exists, run the `## Self-check` non-negotiables against it before anything else. All pass → suggest a targeted edit, not a regenerate. Any fail → an older version of this skill (or the course original) wrote it, and the failing checks name exactly what is wrong → regenerate over the file; git history keeps the previous version. «The file exists» is not by itself a reason to skip.
- Green-field projects: pick «Skip — green-field» in step 3 channel question.

## Inputs

**Hard required** (skill stops without them):

- `<slug>` — kebab-case feature slug.
- `docs/features/<slug>/idea-brief.md` — problem, RICE, Recommendation (§13), Out of scope (§5).
- `CONTEXT.md` — **repo root**, not the feature folder. Canonical glossary of domain terms. It defines no roles: `user` is the only human in the system and all users are equal.

**Optional**: `--reference <path-to-module>` — passed at invocation; pre-selects the «Reference module code» channel in step 3.

## Protocol

1. **Prereq check (hard refuse).** `test -f docs/features/<slug>/idea-brief.md` and `test -f CONTEXT.md` (repo root). Missing idea-brief → «run `feature-interview <slug>` first»; missing CONTEXT → «run `sdlc:prep-context <slug>` first» — while that skill does not exist yet, stop and ask the user instead. No silent fallback.
2. **Read required inputs.** `CONTEXT.md` `## Glossary` first (canonical domain terms — overrides anything that contradicts it; note it defines no roles); then idea-brief.md (§2 / §3 / §4 / §5 / §10 / §11 / §13).
3. **Ask user which additional channels to use** via `AskUserQuestion` (multi-select). Options: `Reference module code` / `Project documentation` / `Projects knowledge / RAG` / `Skip — green-field`. For each picked channel, ask the **specific** path / query / topic — no silent broad scans. If `--reference` was passed, pre-select `Reference module code`.
4. **Read selected channels.** Reference module → extract entity types, error sentinels, status constants, boundary checks (zod validation, session). Docs / RAG → only the paths/topics the user named.
5. **Read own template.** `./templates/PRD-template.md` — each section has `<!-- Skill instruction: ... -->` comments that are the per-section generation contract.
6. **Propose drafts** for §1-§8. Per-section sources, the 5 AC coverage types (happy / error / external failure / domain invariant / cross-context), and the §5 forbidden-tokens list → see [./references/draft-generation.md](./references/draft-generation.md).
7. **Socratic validation — batch propose-all-then-validate, per-section.** For each of §4 US → §5 AC → §6 NFR → §7 KPI: (a) render the full proposed list in one message so the user sees the big picture; (b) walk per-item resolutions via `AskUserQuestion` — 4-state machine `Approve as-is` / `Edit` / `Save as Open Question` / `Drop` (AC has a 5th option `Add another AC`); (c) apply transitions in-memory; (d) for §5 only — enforce coverage gate ≥1 AC of each of the 5 types via regen-fallback if a `Drop`/`Save as OQ` broke a type. Maintain an edits-log with action enum `edit|drop|add|save_as_oq`. State transitions + log format → see [./references/socratic-loop.md](./references/socratic-loop.md). Question shape + option `description` field → see [./references/ask-examples.md](./references/ask-examples.md).
8. **Critic stress-test + write + commit.** Single `Agent` call (`subagent_type: "general-purpose"`, clean context) with the draft + edits-log + paths to CONTEXT/idea-brief; resolve findings via `AskUserQuestion` (Accept revert / Accept amendment / Override — overrides emit a §1 ¶4 bullet); run pre-write regex scan as F6 backup; run Self-check (below); on pass write `docs/features/<slug>/PRD.md` and propose commit `03: PRD for <slug> (auto-drafted from <reference-module> patterns, Socratically validated)` (or `green-field, Socratically validated` if no reference). Dispatch + resolution loop → see [./references/critic-phase.md](./references/critic-phase.md); agent prompt body → see [./references/critic-prompt.md](./references/critic-prompt.md). Next step: the owner signs the PRD, then stage 04-05 — `sdlc:architecture-design <slug>`. The file-level plan for the vertical slice is `mouse-trading:feature-plan`.

## Self-check

Full DoD + anti-patterns → [./references/checklist.md](./references/checklist.md). Inline non-negotiables:

- Step 3 `AskUserQuestion` ran before reading any additional channel.
- Step 7 edits-log maintained: each Edit / Drop / Add / Save-as-OQ has one entry with verbatim before / after / user_reason (action enum `edit|drop|add|save_as_oq`).
- Step 7 §5 coverage gate closed: ≥1 AC of each of the 5 coverage types remains AFTER drops + OQ-migrations; if broken, skill regenerated a replacement of the missing type and ran a mini-batch on it.
- §8 Open Questions contains every `save_as_oq`-migrated item from step 7 with owner + due filled (no lone owner, no lone due — missing either downgrades the migration to `Drop`).
- Step 7.5 critic ran on the post-Socratic draft + edits-log; every finding resolved via `AskUserQuestion` or Override (with §1 ¶4 bullet).
- §5 AC contains **0** forbidden tokens (HTTP verbs / URL paths / status-code numerics / `module.error_name` strings / JSON fragments / SQL constructs / technology and module names — Claude, R2, sharp, pg-boss, TypeORM, JWT, `products`, `media`, `ai`). Module names match as whole words only: «AI» as a business word («допомога AI») is allowed, the module identifier `ai` is not.
- §5 AC invents no roles: the only actor is `user` from the glossary.
- §6 NFR names no measurement the project does not have (no k6, Prometheus, SLO window, endpoint metrics), no throughput / availability rows, and no numeric target on a third party's behaviour — AI job duration and cost per card are not floor rows here (see draft-generation.md §6).
- §7 KPIs are measured per **card**, not per user — no adoption rate / retention / cohort metrics.
- §8 Open Questions each have owner + due (not lone «TBD»); owner is the person from frontmatter `owner`, never an invented role.

Any check fails → re-open the relevant `AskUserQuestion`, then re-check.

## References

- [./references/draft-generation.md](./references/draft-generation.md) — step 6: per-section sources, 5 AC coverage types, forbidden-tokens list.
- [./references/socratic-loop.md](./references/socratic-loop.md) — step 7: per-item options, state transitions, edits-log format.
- [./references/critic-phase.md](./references/critic-phase.md) — step 7.5: critic dispatch, resolution loop, regex backup, failure modes.
- [./references/critic-prompt.md](./references/critic-prompt.md) — agent prompt body for the step 7.5 sub-agent (canonical, unchanged).
- [./references/ask-examples.md](./references/ask-examples.md) — explanatory `AskUserQuestion` shape for US / AC / NFR / KPI + critic-finding examples.
- [./references/checklist.md](./references/checklist.md) — Definition of Done + full anti-patterns.

## Template

→ [./templates/PRD-template.md](./templates/PRD-template.md) — read at step 5. Inline `<!-- Skill instruction: ... -->` comments are the per-section generation contract.
