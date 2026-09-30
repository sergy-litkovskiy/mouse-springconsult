"""check_judge.py - python-асерт Promptfoo: суддя через `claude -p`, тобто на підписці.

Чому не llm-rubric: його грейдер ходить в API. Локально він може взяти OAuth-облікові
дані з keychain (apiKeyRequired: false), але на раннері GitHub є лише змінна
CLAUDE_CODE_OAUTH_TOKEN, яку розуміє claude CLI, а promptfoo - ні. `claude -p` працює
однаково скрізь і не потребує ANTHROPIC_API_KEY.

Рубрика - eval/rubric.md (єдине джерело); поріг 0.7.
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path

RUBRIC = Path(__file__).resolve().parent.parent / "eval" / "rubric.md"
THRESHOLD = 0.7
# Повне ім'я, а не аліас: дешевша за модель за замовчуванням, а виходу - один JSON.
JUDGE_MODEL = "claude-haiku-4-5-20251001"


def get_assert(output, context):
    prompt = (RUBRIC.read_text(encoding="utf-8")
              + "\n\nОціни текст рев'ю нижче. Відповідай ТІЛЬКИ JSON-об'єктом "
                '{"score": <число 0..1>, "reason": "<одне речення>"}.\n\n'
              + output)
    # cwd - порожня тека: суддя не має підхоплювати CLAUDE.md і хуки цього репо.
    run = subprocess.run(["claude", "-p", prompt, "--model", JUDGE_MODEL],
                         cwd=tempfile.mkdtemp(), capture_output=True, text=True,
                         timeout=300)
    m = re.search(r"\{.*\}", run.stdout, re.DOTALL)   # модель може обгорнути в ```json
    try:
        verdict = json.loads(m.group(0)) if m else {}
        score = float(verdict["score"])
    except (ValueError, KeyError, TypeError):
        return {"pass": False, "score": 0.0,
                "reason": f"суддя не повернув JSON зі score: {run.stdout[:200]!r} "
                          f"{run.stderr[:200]!r}"}
    return {"pass": score >= THRESHOLD, "score": score,
            "reason": f"суддя: {score} (поріг {THRESHOLD}) - {verdict.get('reason', '')}"}
