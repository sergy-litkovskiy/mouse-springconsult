#!/bin/bash
# .claude/hooks/block-env.sh - не даємо додати .env у коміт
command=$(jq -r '.tool_input.command')
# Лише git add/commit: інакше блокуються й read-only команди, де `.env` — просто текст (jq-вираз, grep)
if echo "$command" | grep -Eq '\bgit\b.*\b(add|commit)\b' &&
   echo "$command" | sed 's/\.env\.example//g' | grep -q '\.env'; then
  echo "Спроба додати .env заблокована" >&2
  exit 2          # exit 2 -> Claude Code блокує виклик інструмента
fi
