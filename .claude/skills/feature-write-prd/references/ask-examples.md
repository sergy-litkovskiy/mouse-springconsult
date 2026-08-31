# `AskUserQuestion` examples — explanatory pattern for write-prd

How step 7 (Socratic batch loop) and step 7.5 (critic resolution) phrase questions and options. The contract from [socratic-loop.md](./socratic-loop.md) and [critic-phase.md](./critic-phase.md) is normative; this file shows the **shape** of the dialogue so options *describe what the skill will do*, not just *what they're labelled*.

## Shape

- **Question**: inline the full item content verbatim (US text, AC GWT, NFR row, KPI line, critic finding) + 1 sentence framing the choice.
- **Each option**:
  - `label` — 1-4 words, action-form: «Approve as-is», «Reword», «Drop», «Save as Open Question», «Add another AC», «Override».
  - `description` — 1 sentence explaining the mechanical next step (no PRD philosophy, no design rationale).

All four item-types (US / AC / NFR / KPI) share the same 4-state machine. AC has one extra optional 5th option (`Add another AC`). `Cancel` and `Reject` are synonyms for `Drop`.

The examples below show the **state machine** — which options exist and what each one does to the draft. The **wording** that actually ships is Ukrainian and follows «Mandatory shape» at the bottom of this file; the terse English labels here are the deprecated form, kept only because they read as a compact map of the transitions.

## User-story validation (step 7)

```
Question:
  US-03 (As a user, I want to see the generated texts next to the photo, so that
  I can fix a wrong wording before copying it to the marketplace).
  Is this story right as written, needs a tweak, should be deferred, or dropped?

Options:
  - label: "Approve as-is"
    description: "Skill keeps US-03 verbatim and moves to the next item."
  - label: "Reword"
    description: "You type the new wording in one go; skill regenerates US-03 with your wording and asks once more (last call — second answer is final)."
  - label: "Save as Open Question"
    description: "Skill removes US-03 from §4 and adds «- [ ] US-03 (text) — чи валідна? — owner: <you-type>, due: <you-type>» to §8. Skill asks owner+due next. Without both, the resolution downgrades to Drop with a warning."
  - label: "Drop"
    description: "Skill deletes US-03, renumbers later stories (US-04 → US-03), and AC tagged with US-03 are reassigned or dropped — skill will ask which."
```

After `Save as Open Question`, the follow-up `AskUserQuestion`:

```
Question:
  US-03 is migrating to §8 Open Questions. Provide owner and due (YYYY-MM-DD or stage trigger like "перед 6.9"). Both are mandatory — without them the migration downgrades to Drop.

Options:
  - label: "Provide owner + due"
    description: "You type «owner: <name>, due: <date or stage>» in one line; skill applies it to the §8 entry. Owner is the person from frontmatter `owner` — there is no PM / Tech Lead / Security Lead in this project to assign it to."
  - label: "Cancel — Drop instead"
    description: "Skill abandons the OQ migration and applies Drop to US-03 (deletes + renumbers)."
```

## Acceptance-criterion validation (step 7)

The skill first renders the full proposed AC list (7a), then issues one question per AC (7b):

```
Question:
  AC-04 (US-03, domain invariant) — Given a user has a product card whose price
  is empty, When the user marks the card as ready, Then the system blocks the
  transition and tells the user that a ready card needs both texts, a price and
  at least one photo.
  Is this criterion right as written, needs a tweak, should be deferred, or
  dropped? You can also request one more AC for this US.

Options:
  - label: "Approve as-is"
    description: "Skill keeps AC-04 verbatim in §5 and moves to the next AC."
  - label: "Reword GWT"
    description: "You type the new Given/When/Then in one go; skill regenerates AC-04 with your wording and asks once more (last call)."
  - label: "Save as Open Question"
    description: "Skill removes AC-04 from §5 and adds «- [ ] AC-04 (text) — чи цей AC валідний? — owner: <you-type>, due: <you-type>» to §8. Skill asks owner+due next. If coverage gate breaks (this was the only domain-invariant AC), skill regenerates a replacement of the same type."
  - label: "Drop"
    description: "Skill deletes AC-04 and renumbers later AC. If AC-04 was the only domain-invariant for US-03, skill regenerates a replacement of the same coverage type and asks about it as an extra item."
  - label: "Add another AC"
    description: "Skill generates one more AC for US-03 in a coverage type not yet present on this US (e.g. cross-context — «the system does not start generating texts while the card has no photo» — if happy + error + invariant are already covered), then asks about the new AC."
```

## NFR-row validation (step 7)

```
Question:
  NFR row — Interactive response when the card list is opened (20 cards),
  p95: target ≤ 400 ms, measured as the request duration in the pino log over
  20 runs on the stand.
  Is this row right as written, needs a tweak, should be deferred, or dropped?

Options:
  - label: "Approve as-is"
    description: "Skill keeps the row verbatim and moves to the next NFR row."
  - label: "Edit target"
    description: "You type the new numeric target (e.g. ≤ 600 ms); skill updates the row and asks once more (last call). The Measurement column must keep naming something the project actually has — pino logs, pg-boss queue wait and retry count, a manual run on the stand — never k6, Prometheus or an SLO window. And the target must stay on the system's own behaviour: a number that includes the model provider's latency is a promise about someone else's service."
  - label: "Save as Open Question"
    description: "Skill removes the row from §6 and adds «- [ ] NFR row «<aspect>» — чи цей таргет валідний? — owner: <you-type>, due: <you-type>» to §8. Skill asks owner+due next. Without both, the resolution downgrades to Drop."
  - label: "Drop"
    description: "Skill deletes the row from §6. No replacement (NFR is recommended-list, not coverage-gated)."
```

## KPI validation (step 7)

```
Question:
  KPI — Minutes spent preparing one card: baseline 15-20 min of manual work
  (idea-brief §2), target ≤ 5 min per card by the end of the first month of use.
  Is this KPI right as written, needs a tweak, should be deferred, or dropped?

Options:
  - label: "Approve as-is"
    description: "Skill keeps the KPI verbatim and moves to the next KPI."
  - label: "Edit baseline/target"
    description: "You type new baseline / target / timeframe; skill regenerates the KPI line and asks once more (last call). Keep the unit a card, not a user — with one or two admins adoption / retention / cohort metrics measure nothing."
  - label: "Save as Open Question"
    description: "Skill removes the KPI from §7 and adds «- [ ] KPI «<name>» — чи цей KPI валідний? — owner: <you-type>, due: <you-type>» to §8. Skill asks owner+due next. Without both, the resolution downgrades to Drop."
  - label: "Drop"
    description: "Skill deletes the KPI from §7. No replacement (KPIs are recommended-list with a ≥3 floor; if drop takes count under 3, skill regenerates one extra KPI from a remaining RICE driver)."
```

## Critic-finding resolution (step 7.5)

```
Question:
  [F1] Approach A drift after US-06 drop — §1 Context ¶3 still cites
  «Approach A — one card, one screen», but US-06 (price suggestion on the same
  screen) was dropped during Socratic.
  idea-brief §13 names Approach A as the Recommendation.
  Suggested: amend §1 ¶3 to drop the single-screen claim, OR add US-06 back.
  How do you want to resolve it?

Options:
  - label: "Accept revert"
    description: "Skill applies the critic's suggested amendment verbatim — §1 ¶3 rewritten to drop the single-screen claim. US-06 stays dropped."
  - label: "Accept amendment (different wording)"
    description: "You type the alternative wording for §1 ¶3; skill applies your wording, US-06 stays dropped."
  - label: "Override"
    description: "Skill keeps §1 ¶3 unchanged and emits a bullet in §1 ¶4: «Approach A drift after US-06 drop — overridden by author, rationale: <your reason>», so downstream skills (`sdlc:architecture-design`, `sdlc:api-forge`) see the deliberate choice. You provide the rationale next."
```

```
Question:
  [F6] AC-02 contains forbidden tokens — line: «When the user calls POST
  /products/{id}/generate, Then the API returns 409 with code
  product.no_photos».
  Hits: `POST`, `/products/{id}/generate`, `409`, `product.no_photos`.
  Suggested: rewrite into business form (actor-observable outcome) — the
  HTTP/error/schema detail moves to stage 10 `sdlc:api-forge` (`apps/api/src/contracts/`).
  How do you want to resolve it?

Options:
  - label: "Rewrite into business form"
    description: "Skill rewrites AC-02 as «When the user starts preparing the texts, Then the system blocks the run and tells the user that the card needs at least one photo first», then asks once more on the new wording (last call)."
  - label: "Override"
    description: "Skill keeps AC-02 unchanged and emits a bullet in §1 ¶4: «AC-02 implementation-leak — overridden by author, rationale: <your reason>». Use this only for a quoted glossary term; the technical mapping belongs in stage 10 `sdlc:api-forge` (`apps/api/src/contracts/`) and `sdlc:decide-adr` (`docs/adr/`)."
```

## Anti-pattern: terse option labels

```
# DON'T — option label = next mechanical step is opaque
Options:
  - Approve
  - Edit
  - Reject

# DO — option label is action-form, description names the next concrete step
Options:
  - label: "Approve as-is"
    description: "Skill keeps the item verbatim and moves on."
  - label: "Reword"
    description: "You type the new wording; skill regenerates and asks once more."
  - label: "Save as Open Question"
    description: "Skill removes the item, adds it to §8 with owner+due (asked next)."
  - label: "Drop"
    description: "Skill deletes the item and renumbers later items."
```

## Junior-friendly Ukrainian explanations (mandatory from 2026-05-23)

Every `AskUserQuestion` у цьому skill-у формулюється так, щоб **junior-розробник або PM без технічного background** міг зрозуміти суть кожного PRD-item (US / AC / NFR / KPI), різницю між опціями і наслідки вибору — без помічника поряд. Старий шаблон («1-sentence framing», 4-word labels) deprecated.

### Mandatory shape

1. **Українська мова всюди** — labels + descriptions. Технічні ідентифікатори (US-NN, AC-NN, NFR, KPI, GWT, AsyncAPI, OpenAPI) залишаються англійською — це назви; але «дії» опцій — українською («Прийняти як є», «Переписати», «Перенести у §8 OQ», «Видалити», «Додати ще один AC»).

2. **`question` поле — 3-4 речення** з трьох блоків:
   - **ПОВНИЙ ТЕКСТ item-у** verbatim (US text, AC GWT, NFR row, KPI line, critic finding) — як було
   - **КОНТЕКСТ + ЧОМУ ВАЖЛИВО** — звідки взявся цей item (з якого джерела idea-brief / interview / NFR), який user-сценарій або quality-vector він покриває, що зривається якщо item неправильний
   - **ЯКА КОНКРЕТНА ДУМКА ПОТРІБНА** — на що дивитися перед вибором (формулювання? коректність GWT? число у NFR? owner у KPI?)

3. **Option `description` — 3-5 речень** із трьох обов'язкових елементів:
   - **Що технічно станеться у PRD**: конкретно — який рядок зміниться, які later items постраждають (renumbering, AC-теги переприсвоються, KPI без owner downgrade-иться)
   - **Що ця опція реально означає** простими словами, без жаргону:
     - Не «GWT-form» → «формат Given/When/Then: «Дано: у картки є завантажене фото; Коли: user запускає підготовку текстів; Тоді: система зберігає обидва тексти в картці й показує їх для правки». У Then немає ні кодів відповіді, ні назв технологій — тільки те, що бачить людина»
     - Не «AC tagged with US-03 are reassigned or dropped» → «всі AC, які зараз посилаються на US-03 (можна побачити у `AC-NN | US: US-03 | ...` рядках), або переходять на інший US, або видаляються разом — skill спитає тебе про кожен окремо»
     - Не «cursor pagination» → «передача останнього бачаного ID клієнту»
     - Не «idempotent operation» → «можна викликати ту саму дію кілька разів і результат буде той самий — повторний запуск генерації на картці, де тексти вже є, не створює другий комплект»
   - **Hidden trade-off** — якщо опція має наслідок, який неочевидний (напр. «Drop on US-03 видалить ще 4 AC; всі вони пов'язані з core-flow», або «цей KPI — єдиний, що міряє час на картку, а саме ці 15-20 хвилин idea-brief §2 називає всією проблемою фічі») — згадати це **прямо у description**

### Заборонено

- Стислі англомовні labels («Approve as-is», «Reword», «Drop»)
- Однорядкові descriptions
- Технічні терміни без розшифровки (GWT, cursor, idempotent, NFR, SLA, RPO/RTO, etc.)
- Trade-off-и, заховані у follow-up

### Контр-приклад (deprecated shape)

```
- label: "Approve as-is"
  description: "Skill keeps US-03 verbatim and moves to the next item."
```

### Правильно (mandatory shape)

```
- label: "Прийняти US-03 як є"
  description: "Skill зберігає US-03 verbatim у §4 PRD і переходить до US-04 без додаткових follow-up-ів. Це означає, що намір (побачити згенеровані тексти поруч із фото) і outcome (виправити формулювання до копіювання на майданчик) фіксуються як baseline — пізніше зміни тільки через перезапуск skill-у або ручне редагування файлу. AC, які будуть пов'язані з US-03 (через тег `US: US-03` у AC-таблиці), залишаються валідними. Якщо ця US розійдеться з вектором idea-brief §13 Recommendation — це підніме Phase 7.5 critic як strategic-vector drift."
```

### Why

PRD пише та сама людина, що й код, але у PRD-фазі вона мислить продуктом, а не файлами: стислий англомовний ярлик змушує зупинятись і згадувати, що саме зробить skill після вибору. Це зриває Socratic-cadence і подвоює час на PRD. Дослівна цитата фідбеку 2026-05-23: «Треба щоб пояснення були ще більш зрозумілими для людей котрі буквально джуни в розробці» (контекст — sdlc:architecture-design, з вимогою «закласти не тільки в архітектуру а і в бриф ідею і в врайт прд»).
