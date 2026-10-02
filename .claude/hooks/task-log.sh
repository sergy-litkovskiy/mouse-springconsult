#!/usr/bin/env bash
# task-log.sh — пасивний інспектор командних подій. Нічого не блокує (завжди exit 0):
# складає сирий stdin-payload хука у .claude/logs/team-events.jsonl, щоб очима
# побачити, що саме несуть TaskCreated / TaskCompleted / TeammateIdle.
EVENT="${1:-unknown}"
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$LOG_DIR"
# jq -c: payload може прийти багаторядковим, а JSONL — один запис на рядок.
jq -c --arg e "$EVENT" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{hook_event: $e, ts: $ts, payload: .}' >> "$LOG_DIR/team-events.jsonl" 2>/dev/null
exit 0
