"""
从 华为社招OD题库2026/ 导入题目到 problems/ 目录。
按文件名(stem)去重：同名文件只保留一个最优版本（.md > .html, 2025 > 2024）。

用法: python import_problems.py
"""
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent
BANK_DIR = ROOT / "华为社招OD题库2026"
PROBLEMS_DIR = ROOT / "problems"


# ── Encoding helper ────────────────────────────────────────

def _read_file(filepath: Path) -> str:
    for enc in ['utf-8', 'gbk', 'gb2312', 'utf-16', 'latin-1']:
        try:
            return filepath.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return filepath.read_text(encoding='utf-8', errors='replace')


# ── HTML → plain text ─────────────────────────────────────

def _html_to_text(html: str) -> str:
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<pre[^>]*><code[^>]*>(.*?)</code></pre>',
                  r'\n```\n\1\n```\n', text, flags=re.DOTALL)
    for tag in ['h1', 'h2', 'h3', 'h4', 'p', 'div', 'li', 'br', 'tr']:
        text = re.sub(rf'<\s*{tag}\b[^>]*>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(rf'</\s*{tag}\s*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&amp;', '&').replace('&quot;', '"')
    text = re.sub(r'\n[ \t]+\n', '\n\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


# ── Test case extraction ────────────────────────────────────

def extract_test_cases(text: str) -> list[dict]:
    cases = []

    # 策略1: 示例N 后跟两个代码块
    pat = re.compile(
        r'(?:###?\s*示例|###?\s*样例|###?\s*Example|###?\s*Case)[^\n]*\s*'
        r'.*?```\s*\n(.*?)```\s*'
        r'.*?```\s*\n(.*?)```',
        re.DOTALL
    )
    for m in pat.finditer(text):
        inp = m.group(1).strip()
        out = m.group(2).strip()
        if inp and out and not inp.startswith('class ') and not inp.startswith('import '):
            cases.append({"input": inp, "expected_output": out})

    if cases:
        return _deduplicate_cases(cases)

    # 策略2: 输入：代码块 + 输出：代码块
    pat2 = re.compile(
        r'(?:输入[：:)]|Input)[^\n]*\n\s*```\s*\n(.*?)```\s*'
        r'.*?(?:输出[：:)]|Output)[^\n]*\n\s*```\s*\n(.*?)```',
        re.DOTALL
    )
    for m in pat2.finditer(text):
        inp = m.group(1).strip()
        out = m.group(2).strip()
        if inp and out:
            cases.append({"input": inp, "expected_output": out})

    return _deduplicate_cases(cases)


def _deduplicate_cases(cases: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for c in cases:
        key = (c["input"], c["expected_output"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


# ── Problem parsing ─────────────────────────────────────────

def parse_file(filepath: Path) -> dict | None:
    text = _read_file(filepath)
    if not text.strip():
        return None

    if filepath.suffix.lower() in ('.html', '.htm'):
        text = _html_to_text(text)

    # 标题: 第一个有意义的 # 行
    title = ""
    for m in re.finditer(r'^#{1,2}\s+(.+)', text, re.MULTILINE):
        t = m.group(1).strip()
        if t and t not in ('题目描述', '示例', '解题代码', '解题思路',
                           '输入描述', '输出描述', '输入格式', '输出格式',
                           '备注', '说明', '最新华为OD机试', '华为OD机试', 'OD机试'):
            title = t
            break
    if not title:
        return None

    test_cases = extract_test_cases(text)

    fname = filepath.stem
    difficulty = "hard" if ("200" in fname or "200分" in fname) else "medium"

    # ID 生成
    pid = re.sub(r'[()（）、，\s]+', '-', fname)
    pid = re.sub(r'[-]+', '-', pid).strip('-')
    pid = re.sub(
        r'-(Java|Python|JS|C\+\+|C|C语言)[-&]*(Java|Python|JS|C\+\+|C|C语言)*.*$',
        '', pid
    )
    if len(pid) > 60:
        pid = pid[:60]
    pid = pid.strip('-') or "problem"

    starter_code = (
        "import sys\n\n"
        "def solve():\n"
        "    data = sys.stdin.read().split()\n"
        "    # TODO: 实现逻辑\n"
        "    print(...)\n\n"
        'if __name__ == "__main__":\n'
        "    solve()\n"
    )

    return {
        "id": pid,
        "title": title,
        "mode": "stdio",
        "time_limit": 2.0,
        "difficulty": difficulty,
        "starter_code": starter_code,
        "test_cases": test_cases,
        "description_raw": text,
    }


# ── File dedup (by stem) ───────────────────────────────────

def select_best_file(files: list[Path]) -> Path:
    """从同名文件(stem相同)中选择最优版本。.md > .html, 优先有内容的文件。"""
    # 优先 .md
    md_files = [f for f in files if f.suffix == '.md']
    if md_files:
        # 优先 2025-2026 目录（较新）
        newer = [f for f in md_files if '2025' in str(f)]
        if newer:
            return newer[0]
        return md_files[0]
    # 其次 .htm
    htm_files = [f for f in files if f.suffix == '.htm']
    if htm_files:
        return htm_files[0]
    # 最后 .html
    return files[0]


# ── Main ────────────────────────────────────────────────────

def main(incremental: bool = False, source: str | None = None):
    PROBLEMS_DIR.mkdir(parents=True, exist_ok=True)

    # 可选择自定义数据源
    bank_dir = Path(source) if source else BANK_DIR

    # 收集所有文件
    all_files = [
        f for f in bank_dir.rglob("*")
        if f.suffix.lower() in ('.md', '.html', '.htm') and f.name != "TODO.md"
    ]

    # 按 stem 分组
    by_stem: dict[str, list[Path]] = defaultdict(list)
    for fp in all_files:
        by_stem[fp.stem].append(fp)

    # 跳过 "copy" 文件
    filtered = {}
    for stem, files in by_stem.items():
        clean = [f for f in files if "copy" not in f.name.lower()]
        if clean:
            filtered[stem] = clean

    print(f"Unique stems: {len(filtered)}")
    print(f"Total files: {len(all_files)} (dedup to {len(filtered)} stems)")

    created = 0
    skipped = 0
    no_cases = 0

    # 统计已有目录
    existing_ids = {d.name for d in PROBLEMS_DIR.iterdir() if d.is_dir()}

    if incremental:
        print(f"Incremental mode: skipping {len(existing_ids)} existing problems")

    for stem, files in sorted(filtered.items()):
        fp = select_best_file(files)
        info = parse_file(fp)
        if info is None:
            skipped += 1
            continue

        if not info["test_cases"]:
            no_cases += 1

        pid = info["id"]
        if incremental and pid in existing_ids:
            skipped += 1
            continue

        if pid in existing_ids:
            skipped += 1
            continue

        out_dir = PROBLEMS_DIR / pid
        out_dir.mkdir(parents=True, exist_ok=True)

        config = {
            "id": pid,
            "title": info["title"],
            "mode": info["mode"],
            "time_limit": info["time_limit"],
            "difficulty": info["difficulty"],
            "description": pid,
            "starter_code": info["starter_code"],
            "test_cases": info["test_cases"],
        }
        (out_dir / "config.json").write_text(
            json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "README.md").write_text(
            info.get("description_raw") or info["id"], encoding="utf-8"
        )
        created += 1

    print(f"\nCreated: {created}, Skipped: {skipped}")
    print(f"Without test cases: {no_cases}")

    # 最终统计
    total = len([d for d in PROBLEMS_DIR.iterdir() if d.is_dir()])
    print(f"Total problems: {total}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="导入 OD 题目到 problems/ 目录")
    parser.add_argument("--incremental", action="store_true", help="增量模式：跳过已存在的题目")
    parser.add_argument("--source", type=str, default=None, help="数据源目录路径（默认: 华为社招OD题库2026/）")
    args = parser.parse_args()
    main(incremental=args.incremental, source=args.source)
