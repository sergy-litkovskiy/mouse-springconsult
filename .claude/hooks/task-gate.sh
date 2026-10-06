#!/bin/bash
# .claude/hooks/task-gate.sh — TaskCompleted-гейт для agent teams: задача не закривається, поки
# червоні перевірки її шару. Шар — мітка на початку task_subject. Перевірки фронту звужені до
# каталогу власника: дерево спільне, і повний ng test бачив би напівзроблені файли сусіда.
input=$(cat)
# Без jq або з нерозібраним payload порожній team_name означав би «не команда», і гейт мовчки
# пропускав би все — тому падаємо закрито.
command -v jq >/dev/null || { echo 'task-gate: потрібен jq' >&2; exit 2; }
team=$(jq -r '.team_name // empty' <<<"$input") || { echo 'task-gate: payload не JSON' >&2; exit 2; }
[ -z "$team" ] && exit 0   # звичайна сесія, не команда
subject=$(jq -r '.task_subject' <<<"$input")
cd "$CLAUDE_PROJECT_DIR" || exit 2

web() {
  docker compose run --rm -T --no-deps web sh -c \
    "npx ng lint --lint-file-patterns 'src/app/products/$1/**/*' && npx ng test --watch=false --include 'src/app/products/$1/**/*.spec.ts'"
}

set -o pipefail
case "$subject" in
  '[api]'*) docker compose run --rm -T --no-deps api sh -c 'npm run typecheck && npm run lint && npm run test && npm run deps:check' ;;
  '[web-form]'*) web form ;;
  '[web-catalog]'*) web catalog ;;
  '[docs]'*) for d in docs/features/*/tasks/; do python3 .claude/skills/feature-break-tasks/references/gate-check.py "$d" || exit 1; done ;;
  *) echo "Тема «${subject}» без мітки шару: [api], [web-form], [web-catalog] або [docs]."; false ;;
esac 2>&1 | tail -n 40 >&2 || exit 2
