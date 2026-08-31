# Draft generation — per-section contract for write-prd Protocol step 6

How the skill turns required inputs + selected channel outputs + template instructions into a draft for each PRD section. The authoritative format/structure source is the `<!-- Skill instruction: ... -->` comment in [../templates/PRD-template.md](../templates/PRD-template.md) for that section. This file is the operational glue: where the content comes from and what is forbidden.

## Inputs in priority order

1. **`CONTEXT.md` `## Glossary`** (repo root) — canonical for domain terms. If anything contradicts it (idea-brief, reference code, docs), the glossary wins. It defines no roles: `user` is the only human in the system and all users are equal.
2. **`idea-brief.md`** — sections §2 Problem, §3 Users, §4 Why now, §5 Out of scope, §10 Risks, §11 RICE, §13 Recommendation.
3. **Channel outputs from step 4** — reference-module patterns (entity types, error codes, status transitions), project docs, RAG hits.

## Per-section sources

- **§1 Context** — 3-4 paragraphs. ¶1 from idea-brief §2 Problem. ¶2 from idea-brief §4 «Why now» / triggers. ¶3 from idea-brief §13 Recommendation (cite directly). ¶4 (optional) reference patterns + docs/RAG quotes as **traceability context** — and the slot where Phase 7.5 `Override` resolutions emit «Decision overrides» bullets.
- **§2 Goals** — 2-3 strategic outcomes, each a manifestation of idea-brief §13. Cite §13 directly. No numbers (those live in §7 KPIs).
- **§3 Non-goals** — 3-4 entries, each with reason. Source: idea-brief §5 Out of scope.
- **§4 User stories** — ≥5 US (no upper cap) in `As a user / I want / So that` form. The actor is always `user` (the admin) — the glossary defines no other role, so US count is driven by the goals in §2, not by a role matrix. A US that introduces a second role invents domain that does not exist; that belongs in §8 Open questions.
- **§5 Acceptance criteria** — see «§5 AC contract» below.
- **§6 NFR table** — recommended-list rows with numeric targets, **no upper cap**. No «fast»/«reliable»/«high». Measurement = something this project actually has: request duration from pino logs, pg-boss queue wait and retry count from worker logs, a manual run on the stand. **Never** k6, Prometheus, an SLO window or endpoint metrics — they do not exist here, and an invented measurement makes the row unverifiable. No throughput and no availability rows either: one or two users and 50-100 cards a month make capacity a non-issue. The rows that do matter: interactive response time, input limits, and what survives when an external service is down. TBD allowed only with owner + due tied to a row in §8.

  Two rows are deliberately **out** of the floor, and the skill does not propose them unprompted. **AI job duration** is dominated by the model provider's latency: this project puts a numeric target only on its own behaviour, so a «≤ N s per card» row would be a commitment on someone else's service. **Cost per card** needs `usage` accounting and a chosen provider, and both are still open (idea-brief §8). If the user asks for either, measure only the part the system owns — queue wait, retry count, number of calls per card — and say so in the Measurement column.
- **§6.1 Security / privacy** — short. Data classification (internal; no buyer personal data), what the feature changes about access (one session, no roles), whether it adds new secrets, **2-3 abuse cases** that are real for a single-operator admin panel: uncontrolled AI calls (direct money — idea-brief §10), an oversized or non-image file on upload, presigned-URL TTL. Cross-org access, draft-leak and SSRF only if the feature really accepts external URLs or introduces multi-user; otherwise «N/A — no other organisations or roles exist» beats an invented scenario. Verdict defaults to N/A.
- **§7 KPIs** — ≥3 metrics (no upper cap), baseline → target with timeframe. The unit is the **card**, not the user: with one or two admins (idea-brief §3) adoption rate, retention, cohort and return-to-feature do not compute — 100% adoption is reached by the person opening their own tool. Take instead: minutes per card (baseline from idea-brief §2 — 15-20 min of manual work), share of texts shipped without manual editing, share of suggested values accepted unedited, ready cards per month. **Cost per card is not a default KPI** — the glossary defines the term, but measuring it needs `usage` accounting and a provider that is not chosen yet; while that is open it belongs in §8, not in §7. Propose it only if the user asks. baseline=0 OK for a new feature; baseline=TBD requires a measurement plan inline.
- **§8 Open questions** — 2-3 entries, each with owner + due (date or stage trigger). Owner is the person from frontmatter `owner`; PM / Tech Lead / Security Lead do not exist in this project — do not hand them questions.

The authoritative format for each section lives in the template inline comments — read `./templates/PRD-template.md` at step 5 and treat each `<!-- Skill instruction: ... -->` as the per-section generation prompt.

## §5 AC contract

AC describes a **business-observable outcome from the actor's perspective**. Format: Given / When / Then.

**No upper cap on the AC count.** Skill proposes as many as needed to cover all US ≥1 AC + all 5 coverage types represented. If a `Drop` (or `Save as Open Question`) during Socratic step 7 leaves a coverage type with zero ACs, skill regenerates a replacement AC of the same coverage type and runs a mini-batch on it.

Five coverage types are mandatory — at least 1 AC of each:

1. **happy** — actor performs main flow → system records the outcome and confirms.
2. **error** — actor submits invalid input → system blocks the action and explains the reason to the actor (no HTTP code, no error-string — phrase as «system shows the actor that <field> must be <constraint>»).
3. **external failure** — an external service the feature depends on is unavailable or answers with an error (the model, the file storage, a price source) → the system keeps what it had already saved, tells the actor plainly that the step did not go through, and leaves the card in a state the actor can retry from. Name what survives and what the actor sees; no retry counts, no timeouts, no service names — the numbers live in §6 NFR, the technology in §4-05 SAD.

   This slot used to be **access** (no session → sign-in). It was dropped on purpose: the system has one human and no permission model (CONTEXT: `user` is the only human, all equal), so an authentication AC comes out word-for-word identical in every feature and is already owned by the `auth` module. Write one only if the feature really adds a new entry point. Cross-org / cross-role / not-owner scenarios do not exist here at all; if a feature needs a permission model, that is a §8 question, not an AC.
4. **domain invariant** — actor violates a named invariant («a ready card needs both texts, a price and a gallery», «up to 10 photos per card», «published-prom and published-olx are counted separately») → system blocks the action and names the invariant in plain language (no error-code-string, no `409`).
5. **cross-context** — the action depends on state in another context along the chain photo → recognition → texts → price («the system does not start generating texts while the card has no photo», «the system does not suggest a price until recognition has finished»). Phrase it with glossary words, not module names.

Each AC tagged with its US-NN. The single actor `user` and domain-invariant **names** as natural-language phrases are allowed — they are business terms.

### Forbidden tokens in §5 AC text

Zero tolerance — checked by Phase 7.5 critic F6 and pre-write regex scan (see [critic-phase.md](./critic-phase.md)):

- HTTP verbs / methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- URL paths: `/api/v1/...`, `/products/{id}/photos` (anything starting with `/` followed by a lowercase identifier).
- HTTP status codes as bare numerics in AC body: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `5xx`, `500`, `503`.
- Error-code strings matching `[a-z_]+\.[a-z_]+` (e.g. `product.not_found`, `validation.description_too_long`).
- JSON-schema fragments / payload bodies: `{title, description}`, `{id, status: "draft"}`.
- SQL / DB constructs: `UNIQUE(...)`, `UNIQUE INDEX`, `FK`, raw `INSERT`/`SELECT`/`UPDATE`, constraint names (`uniq_product_slug`).
- Technology and module names as **whole words**: Claude, Anthropic, R2, sharp, pg-boss, TypeORM, JWT, and the module identifiers `products`, `media`, `ai`. An AC has «the system», not its internals. «AI» as a business word — «допомога AI», «AI-підказка» — is allowed and is not the module `ai`; anchor the module names on word boundaries so that «AI-задача» or English «remains» / «explains» / «domain» are not counted as hits.
- Invented roles: anything other than `user` (admin, editor, manager, owner-of-another-team).

The technical mapping for these (endpoint/payload, status codes, error-code strings, schemas, DB constraints) belongs to stage 10 (`sdlc:api-forge`) and to `sdlc:decide-adr`. In this repository their artifacts are `apps/api/src/contracts/*.contract.ts` and `docs/adr/`. PRD AC is WHAT a user can observe, not HOW the system encodes it.

### Race conditions / edges

If an AC needs a concurrent edge variant, add it as `AC-NNb` (subletter) — still in business language.

## Pre-write hygiene

Before handing the draft to step 7 (Socratic), the skill must:

- Confirm CONTEXT.md glossary terms are used verbatim, and that `user` is the only actor in §4 US and §5 AC.
- Confirm §3 Non-goals quote idea-brief §5 reasons (no inventing).
- Confirm §1 ¶3 cites idea-brief §13 Recommendation verbatim or paraphrases without losing the vector.
- Confirm §5 AC contains ≥1 of each coverage type and 0 forbidden tokens (a self-scan; the Phase 7.5 critic + regex scan are the second backstop).
