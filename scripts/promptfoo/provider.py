"""provider.py - кастомний Promptfoo-провайдер для агента ro-reviewer.

Навіщо свій: готовий провайдер anthropic:claude-agent-sdk не запускає
НАЗВАНОГО агента з .claude/agents/ головним потоком. А предмет тесту -
саме конфігурація ro-reviewer. Тож call_api - це наш eval/sandbox.py
плюс claude -p, загорнуті в одну python-функцію.

Контракт провайдера Promptfoo: call_api(prompt, options, context)
повертає {"output": <текст відповіді>}.

Щоб перевірити, що асерти червоніють, тимчасово зламайте справжній
.claude/agents/ro-reviewer.md (напр. допишіть Write у tools): пісочниця копіює його.
"""
import json
import subprocess
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent   # scripts/
sys.path.insert(0, str(PKG / "eval"))
from sandbox import build  # noqa: E402

SANDBOX = PKG / "tmp" / "pf-sandbox"
# Транскрипт лежить поруч з пісочницею, а не в ній: інакше він сам був би
# untracked-файлом і git status по пісочниці завжди був би «брудним».
TRANSCRIPT = PKG / "tmp" / "pf-transcript.jsonl"


def call_api(prompt, options, context):
    # 1) Пісочниця: фікстура з навмисним дефектом + справжній .claude репо.
    build(SANDBOX, "review-planted")

    # 2) Реальний headless-прогін названого агента У пісочниці.
    run = subprocess.run(
        ["claude", "-p", prompt, "--agent", "ro-reviewer",
         "--output-format", "stream-json", "--verbose",
         "--permission-mode", "acceptEdits"],
        cwd=SANDBOX, capture_output=True, text=True)
    TRANSCRIPT.write_text(run.stdout, encoding="utf-8")

    # 3) Відповідь для асертів: лише текстові репліки асистента
    #    (сирий stream-json містить і вміст прочитаних файлів).
    parts = []
    for line in run.stdout.splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "assistant":
            for block in ev.get("message", {}).get("content", []) or []:
                if block.get("type") == "text":
                    parts.append(block["text"])
    return {"output": "\n".join(parts)}
