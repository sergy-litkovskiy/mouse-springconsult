"""provider.py (suite) - узагальнення провайдера головного кейса.

Той самий адаптер «наш спосіб запускати агента -> Promptfoo», тільки
середовище кожного тесту описане у vars конфіга:
  case    - ім'я пісочниці: tmp/suite-<case>
  fixture - папка з scripts/fixtures/, з якої збирається проєкт
  rename  - (опц.) "старе:нове", напр. env.fixture:.env
            (справжній .env у репозиторії не живе)
.claude під тестом - завжди справжній .claude репо (див. ../../eval/sandbox.py).
"""
import json
import subprocess
import sys
from pathlib import Path

SUITE = Path(__file__).resolve().parent
PKG = SUITE.parent.parent                      # scripts/
sys.path.insert(0, str(PKG / "eval"))
from sandbox import build  # noqa: E402


def call_api(prompt, options, context):
    v = context.get("vars", {})
    name = f"suite-{v['case']}"
    sb = PKG / "tmp" / name

    # 1) Пісочниця: fixture + rename + справжній .claude, щоразу з нуля.
    build(sb, v["fixture"],
          rename=v["rename"].split(":") if v.get("rename") else None)

    # 2) Реальний headless-прогін у пісочниці.
    run = subprocess.run(
        ["claude", "-p", prompt,
         "--output-format", "stream-json", "--verbose",
         "--permission-mode", "acceptEdits"],
        cwd=sb, capture_output=True, text=True)
    # Поза пісочницею - з тієї ж причини, що в ../provider.py.
    (PKG / "tmp" / f"{name}.transcript.jsonl").write_text(run.stdout, encoding="utf-8")

    # 3) Відповідь для асертів: лише текстові репліки асистента.
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
