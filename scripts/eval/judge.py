#!/usr/bin/env python3
"""judge.py - суддя руками: ще один claude -p читає review.md і ставить бал
за рубрикою. Відповідь - JSON {score, reason}, її вже можна порівняти з порогом.
Запуск з кореня репо (після check.py): python3 scripts/eval/judge.py
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
rubric = (HERE / "rubric.md").read_text(encoding="utf-8")
review = (HERE.parent / "tmp" / "review.md").read_text(encoding="utf-8")

prompt = (rubric
          + "\n\nОціни текст рев'ю нижче. Відповідай ТІЛЬКИ JSON-об'єктом "
            '{"score": <число 0..1>, "reason": "<одне речення>"}.\n\n'
          + review)
print(subprocess.run(["claude", "-p", prompt],
                     capture_output=True, text=True).stdout)
