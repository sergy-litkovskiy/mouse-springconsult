# write-prd Self-check + Anti-patterns

Used at the end of Protocol step 7. The SKILL.md keeps the 4 hardest-hitting anti-patterns inline; the rest live here.

## Definition of Done

- [ ] All AC testable in Given/When/Then form.
- [ ] NFR has numeric targets (no «fast» / «as fast as possible») and every Measurement column names something the project has (pino logs, pg-boss queue wait and retry count, a manual run) — no k6, Prometheus, SLO window or endpoint metrics, no throughput / availability rows, and no numeric target on a third party's behaviour (AI job duration, cost per card).
- [ ] Non-goals явно перелічені з причиною (≥3 entries, each with reason from idea-brief §5).
- [ ] Open Qs have owner + due date; owner is the person from frontmatter `owner` (PM / Tech Lead / Security Lead do not exist in this project).
- [ ] §5 AC coverage spans all 5 types (happy / error / external failure / domain invariant / cross-context).
- [ ] §5 AC contains **0** forbidden tokens (HTTP verbs, URL paths, status-code numerics, `module.error_name` strings, JSON-schema fragments, SQL/DB constructs, technology and module names as whole words — Claude, R2, sharp, pg-boss, TypeORM, JWT, `products`/`media`/`ai`; «AI» as a business word is allowed). Pre-write regex scan emit-нув 0 hits — або всі hits explicitly overridden у Phase 7.5 з recorded rationale.
- [ ] §6.1 Security has 2-3 abuse cases that are real for a single-operator admin panel; cross-org / draft-leak / SSRF appear only if the feature really accepts external URLs or introduces multi-user.
- [ ] §7 KPIs are measured per card, not per user — no adoption rate / retention / cohort / return-to-feature. Cost per card appears only if the user asked for it, not as a default row.
- [ ] The only actor in §4 US and §5 AC is `user` — no invented roles.
- [ ] Commit message references reference-module patterns (or notes green-field mode).
- [ ] Additional channels question asked via AskUserQuestion (or marked N/A if --reference was passed and user explicitly declined other channels).
- [ ] §1 Context cites the actual sources used (idea-brief sections + any reference module patterns + any docs/RAG quotes).
- [ ] Phase 7 edits-log maintained: every `Edit`/`Drop`/`Add`/`Save as Open Question` resolution appended one entry with `{item_id, action: edit|drop|add|save_as_oq, before, after, user_reason}`.
- [ ] Every `save_as_oq` resolution from step 7 appears in §8 Open Questions with **both** owner AND due filled (no lone owner, no lone due). Missing either → resolution was downgraded to `drop` with a warning surfaced to the user.
- [ ] Phase 7.5 critic sub-agent ran on the post-Socratic draft + edits-log; all findings either resolved via `AskUserQuestion` or overridden with rationale (recorded as a «Decision overrides» bullet in §1 Context paragraph 4).

## Anti-patterns (full list)

In addition to the 4 inline non-negotiables in SKILL.md «Self-check» section:

- **Treating brainstorm or initiatives artifacts as PRD inputs.** They are outside PRD input scope. PRD draws only from CONTEXT + idea-brief (required) plus user-selected additional channels.
- **Propose without reading code** (when `Reference module code` channel was selected). The whole point of write-prd is grounding in real patterns. Skipping step 4 reduces it to a generic PRD draft with extra steps.
- **Accept AC without Given/When/Then.** «feature works» / «happy path» phrasing fails DoD. Regenerate into GWT before AskUserQuestion.
- **Ignore template inline instructions.** `<!-- Skill instruction: ... -->` comments are the per-section contract. Skipping them produces a structurally-correct but content-empty PRD.
- **One AskUserQuestion for «approve all US».** Loses per-item edit affordance. Section is batch-rendered first (7a) so the user sees the big picture, then one question per item (7b).
- **Save-as-Open-Question без owner+due.** Skill MUST ask follow-up `AskUserQuestion` immediately after the user picks this option. If user leaves either field blank, the migration is downgraded to `Drop` with an explicit warning surfaced — never silently shipped with a half-filled §8 entry.
- **Mix HOW into §1 Context** («we'll queue it in pg-boss», «photos go to R2», «Claude with structured outputs»). PRD is WHAT + WHY. HOW lives in stage 04-05 (`sdlc:architecture-design`) and in `docs/adr/`.
- **Invent measurements for §6 NFR** — k6, Prometheus, an SLO window, endpoint metric names. None of them exist here; a row measured by a tool the project does not run is a row nobody will ever check.
- **Per-user KPIs in §7** — adoption rate, retention, cohort, return-to-feature. With one or two admins these are arithmetic on a sample of one. The unit of measurement is the card.
- **Invented owners and roles** — handing a §8 question to a PM / Tech Lead / Security Lead, or writing a US / AC for an `editor` / `manager`. The system has one human (`user`), and the frontmatter names the one owner.
- **HTTP / error-code / schema / DB constructs у §5 AC.** AC is business-observable. Banned tokens у §5 body:
  - HTTP verbs (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`).
  - URL paths (`/<resource>`, `/api/v1/<...>`, `/<resource>/{id}/<sub>`).
  - Status codes as bare numerics inside AC text (`200`/`201`/`400`/`403`/`404`/`409`/`5xx`).
  - Error-code strings matching `[a-z_]+\.[a-z_]+` (e.g. `product.not_found`).
  - JSON-schema fragments / payload bodies (`{title, description?}`).
  - SQL / DB constructs (`UNIQUE(...)`, `FK`, raw SQL, constraint names).
  - Technology and module names as whole words (Claude, Anthropic, R2, sharp, pg-boss, TypeORM, JWT, `products`, `media`, `ai`) — «AI» as a business word is not a hit.

  These belong to stage 10 (`sdlc:api-forge` — HTTP/schema/error-string mapping) and `sdlc:decide-adr` (DB-constraint decisions); in this repository their artifacts are `apps/api/src/contracts/*.contract.ts` and `docs/adr/`. The Phase 7.5 critic F6 probe + pre-write regex scan catch this. If a token absolutely must remain (rare — usually a quoted glossary term), user must Override in Phase 7.5 with a recorded rationale.
- **Skip Phase 7.5 critic.** §7 Socratic loop only catches per-item issues — it cannot see cross-item drift caused by user edits (e.g. US-rejected vs §1 Context still citing the rejected vector). Writing the file without running the critic ships that drift downstream.
- **Resolve critic findings unilaterally** (without `AskUserQuestion`). The whole point of Phase 7.5 is to surface contested decisions to the user. Picking «revert» or «amend» without asking re-introduces the silent-edit failure mode: the author's own reading replaces the user's decision, and the edits-log stops describing the draft.
