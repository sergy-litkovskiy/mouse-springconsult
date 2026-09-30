#!/usr/bin/env python3
"""sandbox.py - пісочниця руками: фікстура + копія справжнього .claude/ + свіжий git,
щоразу з нуля (жодного спільного стану між прогонами). Її ж збирають провайдери promptfoo.

Щоб «зламати» агента для перевірки, тимчасово правимо справжній .claude/ і ганяємо прогін.
Запуск з кореня репо: python3 scripts/eval/sandbox.py <фікстура>
"""
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
ROOT = SCRIPTS.parent

# settings.local.json є лише локально, у CI його нема: без ігнору прогони відрізнялись би.
_LOCAL = shutil.ignore_patterns("worktrees", "agent-memory", "settings.local.json")


def build(dest, fixture, rename=None):
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(SCRIPTS / "fixtures" / fixture, dest)
    if rename:  # справжній .env у git не живе, тож фікстура тримає його під іншим ім'ям
        (dest / rename[0]).rename(dest / rename[1])
    shutil.copytree(ROOT / ".claude", dest / ".claude", ignore=_LOCAL)

    git = ["git", "-C", str(dest),
           "-c", "user.email=evals@example.com", "-c", "user.name=evals",
           "-c", "commit.gpgsign=false"]
    subprocess.run([*git, "init", "-q"], check=True)   # свій git: агент бачить чисте репо,
    subprocess.run([*git, "add", "-A"], check=True)    # а грейдер питає git status
    subprocess.run([*git, "commit", "-qm", "seed: чистий старт пісочниці",
                    "--no-verify"], check=True)
    return dest


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/eval/sandbox.py <fixture>")
    print(f"✅ пісочниця готова: {build(SCRIPTS / 'tmp' / 'sandbox', sys.argv[1])}")
