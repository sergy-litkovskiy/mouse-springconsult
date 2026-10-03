#!/bin/bash
# .claude/hooks/block-env.sh - не даємо додати .env у коміт
command=$(jq -r '.tool_input.command')
# Дивимось лише на аргументи самого git add/commit (до ; & |): `.env` деінде в рядку — це текст
# (grep-перевірка, cp, повідомлення коміту), а не спроба його додати
segments=$(echo "$command" | grep -oE '\bgit( +-C +[^ ]+)? +(add|commit)\b[^;&|]*')

block() {
  echo "Спроба додати .env заблокована" >&2
  exit 2          # exit 2 -> Claude Code блокує виклик інструмента
}

if echo "$segments" | grep -E '^git( +-C +[^ ]+)? +add\b' | sed 's/\.env\.example//g' | grep -q '\.env'; then
  block
fi

# До git commit перевіряємо індекс: hook спрацьовує до команди, тож `add` з цього ж рядка вже не побачив би
if echo "$segments" | grep -Eq '^git( +-C +[^ ]+)? +commit\b' &&
   git diff --cached --name-only 2>/dev/null | grep -Ev '\.env\.example$' | grep -Eq '(^|/)\.env'; then
  block
fi
