---
name: release-notes
description: >-
  Переписує release notes чернетки GitHub Release mouse-springconsult для вже поставленого
  тегу vX.Y.Z — коли крок notes у release.yml упав або текст треба переписати. Бере секцію
  CHANGELOG.md, пише notes за правилами .github/prompts/release-notes.md, показує в чаті й
  лише після явного «так» оновлює реліз через gh release edit. Реліз не публікує. Лише за
  явним "/release-notes".
argument-hint: "[X.Y.Z, за замовчуванням верхня версія CHANGELOG.md]"
disable-model-invocation: true
---

# /release-notes — notes для наявного релізу

Правила тексту — **лише** в `.github/prompts/release-notes.md`: прочитай його першим і не
додавай своїх.

## 1. Реліз

Версія — з аргументу, інакше перша `## [X.Y.Z]` у `CHANGELOG.md` на `origin/main`.

```bash
git fetch origin --tags
gh release view vX.Y.Z --json isDraft,body
```

Немає релізу → **стоп**: його створює `release.yml` після мерджу Release-PR; якщо тег є, а
чернетки немає — перезапусти в Actions останній прогін `Release`.

## 2. Текст

Візьми тіло секції `## [X.Y.Z]` з `CHANGELOG.md` і напиши notes за правилами промпту.

Тіло релізу збери так само, як `release.yml`:

```markdown
<notes>

## Зміни

<секція CHANGELOG без заголовка версії>

**Повний diff:** https://github.com/<owner>/<repo>/compare/vPREV...vX.Y.Z
```

Рядок diff — лише коли є попередня версія в `CHANGELOG.md`.

## 3. Запис

Покажи тіло в чаті й **зупинись**. Лише після явного «так»:

```bash
gh release edit vX.Y.Z --notes-file <файл у scratchpad>
```

Прапорці `--draft` чи `--latest` не чіпай: опублікований реліз лишається опублікованим,
чернетка — чернеткою. Публікує людина.
