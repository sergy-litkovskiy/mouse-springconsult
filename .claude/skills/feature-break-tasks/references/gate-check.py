#!/usr/bin/env python3
"""Перевірка story на вісім структурних gate + цілісність графа, проєкцій і лінків.

    python3 gate-check.py docs/features/<slug>/tasks/

Виходить з кодом 1, якщо хоч одна перевірка не пройшла — придатне для CI.
Скіл: .claude/skills/feature-break-tasks
"""
import collections
import glob
import math
import os
import re
import sys

FRONTMATTER_KEYS = {
    "id", "title", "status", "delivery", "gate_profile",
    "owner", "estimate", "context_budget", "blocked_by", "blocks", "updated_at",
}
BUDGET_CEILING = 5000
CHARS_PER_TOKEN = 2.6  # кирилиця токенізується гірше за латиницю

GATES = {
    "1 sequence":    (lambda t: len(re.findall(r"sad\.md#6-runtime-view", t)), 1),
    "2 data-delta":  (lambda t: 1 if re.search(r"^## Data delta", t, re.M) else 0, 1),
    "3 api-excerpt": (lambda t: len(re.findall(r"```yaml", t)), 1),
    "4 AC-GWT":      (lambda t: len(re.findall(r"^\*\*Given\*\*", t, re.M)), 2),
    "5 checklist":   (lambda t: len(re.findall(r"^\d+\. ", t, re.M)), 3),
    "6 budget":      (lambda t: 1 if _budget(t) <= BUDGET_CEILING else 0, 1),
    "7 graph-keys":  (lambda t: len(re.findall(r"^(blocks|blocked_by): \[", t, re.M)), 2),
    "8 frontmatter": (lambda t: len(FRONTMATTER_KEYS & _keys(t)), len(FRONTMATTER_KEYS)),
}


def _fm(text):
    m = re.search(r"^---\n(.*?)\n---", text, re.S)
    return m.group(1) if m else ""


def _keys(text):
    return {l.split(":")[0] for l in _fm(text).splitlines() if re.match(r"^\w+:", l)}


def _budget(text):
    m = re.search(r"^context_budget: (\d+)$", text, re.M)
    return int(m.group(1)) if m else 10 ** 6


def _list(text, key):
    m = re.search(r"^%s: \[(.*)\]$" % key, text, re.M)
    return [x.strip() for x in m.group(1).split(",") if x.strip()] if m else []


def measure(text):
    """Виміряний, а не вигаданий бюджет: округлення вгору до сотні."""
    return math.ceil(len(text) / CHARS_PER_TOKEN / 100) * 100


def _source_lines(path):
    """Непорожні рядки джерела, обрізані з боків — база для звірки цитат."""
    if not os.path.exists(path):
        return None
    return {l.strip() for l in open(path) if l.strip()}


def check_quotations(stories):
    """Кожен рядок yaml-excerpt має існувати в openapi.yaml, кожен крок — у sad.md §6.

    Без цієї перевірки gate 1 і gate 3 змушують копіювати текст із чужого файлу й
    ніяк не стежать за копією: лінк лишається валідним, доки цитата поруч гниє.
    """
    problems = []
    oapi = _source_lines("../contracts/openapi.yaml")
    sad = _source_lines("../sad.md")
    for sid, (path, text) in sorted(stories.items(), key=lambda kv: int(kv[0][1:])):
        if oapi is not None:
            for block in re.findall(r"```yaml\n(.*?)```", text, re.S):
                for line in block.splitlines():
                    s = line.strip()
                    if s and s not in oapi:
                        problems.append(f"{sid}: yaml-рядок не є дослівним у openapi.yaml — {s[:70]}")
        if sad is not None:
            for step in re.findall(r"^> `(.+?)`\s*(?:←.*)?$", text, re.M):
                if step.strip() not in sad:
                    problems.append(f"{sid}: крок sequence не є дослівним у sad.md — {step[:70]}")
    return problems


def _table_column(path, header):
    """Значення колонки <header> по ID story з markdown-таблиць файлу."""
    if not os.path.exists(path):
        return None
    rows, idx = {}, None
    for line in open(path):
        if not line.lstrip().startswith("|"):
            idx = None                      # таблиця скінчилась — шукаємо наступну шапку
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header in cells:
            idx = cells.index(header)
            continue
        if idx is None or idx >= len(cells):
            continue
        m = re.match(r"\[?(T\d+)\]?", cells[0])
        if m:
            rows[m.group(1)] = cells[idx]
    return rows


def _ids(cell, known):
    """ID у клітинці; діапазон `T14-T22` розгортається в наявні story."""
    out = []
    for a, b in re.findall(r"T(\d+)\s*[-\u2013\u2014]\s*T(\d+)", cell):
        out += [s for s in known if int(a) <= int(s[1:]) <= int(b)]
    out += re.findall(r"T\d+", re.sub(r"T\d+\s*[-\u2013\u2014]\s*T\d+", "", cell))
    return sorted(set(out), key=lambda s: int(s[1:]))


def _levels(blocked_by):
    """Топологічні рівні: рівень N іде після повного мержу рівня N-1."""
    levels, rest = {}, {s: set(d) & set(blocked_by) for s, d in blocked_by.items()}
    while rest:
        ready = {s for s, d in rest.items() if not d}
        if not ready:
            break                           # цикл; про нього скаже перевірка графа
        levels[len(levels)] = ready
        for s in ready:
            del rest[s]
        for d in rest.values():
            d -= ready
    return levels


def check_projections(stories, blocked_by):
    """Граф у `_epic.md` і `tracker.md` збігається з frontmatter story.

    Mermaid, ASCII-рівні й колонки `blocked_by` двох таблиць — похідні від frontmatter,
    але лежать в іншому файлі й правляться руками. Симетрія `blocks`/`blocked_by` їх не
    покриває: пара буває цілою, а проєкція — відсталою на одне ребро, і рівні при цьому
    не зсуваються, тож око розбіжності не бачить.
    """
    problems, checked = [], []
    edges = {(dep, sid) for sid, deps in blocked_by.items() for dep in deps}
    epic = open("_epic.md").read() if os.path.exists("_epic.md") else None
    if epic is None:
        return ["_epic.md не знайдено — проєкції графа нема з чим звіряти"], checked

    mermaid = re.search(r"```mermaid\n(.*?)```", epic, re.S)
    if mermaid:
        checked.append("mermaid")
        drawn = set(re.findall(r"(T\d+)\s*-->\s*(T\d+)", mermaid.group(1)))
        for a, b in sorted(edges - drawn):
            problems.append(f"_epic.md: mermaid не показує ребра {a} -> {b} з frontmatter")
        for a, b in sorted(drawn - edges):
            problems.append(f"_epic.md: mermaid показує ребро {a} -> {b}, якого немає у frontmatter")

    declared = collections.defaultdict(set)
    for num, rest in re.findall(r"\u0440\u0456\u0432\u0435\u043d\u044c\s+(\d+)\s*\u2502((?:(?!\u0440\u0456\u0432\u0435\u043d\u044c)[^\n])*)", epic):
        declared[int(num)] |= set(re.findall(r"T\d+", rest))
    if declared:
        checked.append("ASCII-рівні")
        actual = _levels(blocked_by)
        for i in sorted(set(actual) | set(declared)):
            if actual.get(i, set()) != declared.get(i, set()):
                fmt = lambda s: " ".join(sorted(s, key=lambda x: int(x[1:]))) or "—"
                problems.append(
                    f"_epic.md: рівень {i} в ASCII «{fmt(declared.get(i, set()))}», "
                    f"а сортування дає «{fmt(actual.get(i, set()))}»"
                )

    for path in ("_epic.md", "tracker.md"):
        rows = _table_column(path, "blocked_by")
        if rows is None:
            problems.append(f"{path} не знайдено")
            continue
        checked.append(f"таблиця {path}")
        for sid in sorted(stories, key=lambda s: int(s[1:])):
            if sid not in rows:
                problems.append(f"{path}: немає рядка для {sid}")
                continue
            want = sorted(blocked_by[sid], key=lambda s: int(s[1:]))
            have = _ids(rows[sid], stories)
            if want != have:
                problems.append(
                    f"{path}: {sid} має blocked_by {have or '[]'}, а frontmatter — {want or '[]'}"
                )
    return problems, checked


def main(tasks_dir):
    os.chdir(tasks_dir)
    stories, problems = {}, []

    for path in sorted(glob.glob("*.md")):
        if path in ("_epic.md", "tracker.md"):
            continue
        text = open(path).read()
        m = re.search(r"^id: (T\d+)$", text, re.M)
        if not m:
            problems.append(f"{path}: немає `id:` у frontmatter")
            continue
        stories[m.group(1)] = (path, text)

    if not stories:
        problems.append("жодної story не знайдено")

    # вісім gate
    for sid, (path, text) in sorted(stories.items(), key=lambda kv: int(kv[0][1:])):
        for name, (fn, minimum) in GATES.items():
            got = fn(text)
            if got < minimum:
                problems.append(f"{sid} ({path}): gate «{name}» — {got}, треба ≥ {minimum}")
        stated, actual = _budget(text), measure(text)
        if abs(stated - actual) > 200:
            problems.append(
                f"{sid}: context_budget {stated} розійшовся з виміряним {actual} — "
                f"проставлений на око не є проходженням gate 6"
            )

    problems += check_quotations(stories)

    # граф: симетрія, висячі ID, цикли
    blocked_by = {s: _list(t, "blocked_by") for s, (p, t) in stories.items()}
    blocks = {s: _list(t, "blocks") for s, (p, t) in stories.items()}
    expected = collections.defaultdict(list)
    for sid, deps in blocked_by.items():
        for dep in deps:
            if dep not in stories:
                problems.append(f"{sid}: blocked_by посилається на неіснуючу {dep}")
            expected[dep].append(sid)
    for sid in stories:
        want = sorted(expected.get(sid, []), key=lambda x: int(x[1:]))
        have = sorted(blocks[sid], key=lambda x: int(x[1:]))
        for dep in blocks[sid]:
            if dep not in stories:
                problems.append(f"{sid}: blocks посилається на неіснуючу {dep}")
        if want != have:
            problems.append(f"{sid}: blocks={have}, а обернення blocked_by дає {want}")

    resolved, guard = set(), 0
    while guard <= len(stories):
        guard += 1
        ready = [s for s, d in blocked_by.items() if s not in resolved and all(x in resolved for x in d)]
        if not ready:
            break
        resolved.update(ready)
    if len(resolved) != len(stories):
        problems.append(f"цикл у графі серед: {sorted(set(stories) - resolved)}")

    projection_problems, projected = check_projections(stories, blocked_by)
    problems += projection_problems

    # лінки
    for sid, (path, text) in stories.items():
        for link in re.findall(r"\]\(([^)#]+)(?:#[^)]*)?\)", text):
            if link.startswith("http"):
                continue
            if not os.path.exists(link):
                problems.append(f"{sid}: висячий лінк {link}")

    print(f"story: {len(stories)} · gate: {len(GATES)} · перевірок: {len(stories) * len(GATES)}")
    if problems:
        print(f"\nПРОБЛЕМИ ({len(problems)}):")
        for p in problems:
            print(f"  {p}")
        return 1
    budgets = [_budget(t) for _, t in stories.values()]
    print(f"context_budget: min={min(budgets)} max={max(budgets)} "
          f"avg={sum(budgets) // len(budgets)} (стеля {BUDGET_CEILING})")
    print("граф ациклічний, blocks/blocked_by симетричні, висячих лінків немає")
    print("цитати excerpt-ів дослівні: yaml ↔ openapi.yaml, sequence ↔ sad.md")
    print("проєкції графа збігаються з frontmatter: " + ", ".join(projected))
    print("усі story проходять усі вісім gate")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
