"""Admin routes — problem CRUD, batch operations, import."""
import json
import re
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from config import PROBLEMS_DIR, SUBMISSIONS_DIR, ROOT
from models import (
    UpdateProblemRequest, UpdateReadmeRequest,
    CreateProblemRequest, BatchUpdateRequest,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Helpers ─────────────────────────────────────────────────

def _parse_markdown_content(md: str, pid: str, difficulty: str, mode: str) -> dict:
    """从 markdown 解析：标题、测试用例、生成 starter_code。"""
    title = pid
    title_match = re.search(r'^#\s+(.+)', md, re.MULTILINE)
    if title_match:
        t = title_match.group(1).strip()
        if t and t not in ('题目描述', '示例', '解题代码', '解题思路'):
            title = t

    cases = []
    pat = re.compile(
        r'(?:###?\s*示例|###?\s*样例|###?\s*Example|###?\s*Case)[^\n]*\s*'
        r'.*?```\s*\n(.*?)```\s*'
        r'.*?```\s*\n(.*?)```',
        re.DOTALL
    )
    for m in pat.finditer(md):
        inp = m.group(1).strip()
        out = m.group(2).strip()
        if inp and out and not inp.startswith('class ') and not inp.startswith('import '):
            cases.append({"input": inp, "expected_output": out})

    if not cases:
        pat2 = re.compile(
            r'(?:输入[：:)]|Input)[^\n]*\n\s*```\s*\n(.*?)```\s*'
            r'.*?(?:输出[：:)]|Output)[^\n]*\n\s*```\s*\n(.*?)```',
            re.DOTALL
        )
        for m in pat2.finditer(md):
            cases.append({"input": m.group(1).strip(), "expected_output": m.group(2).strip()})

    seen = set()
    unique = []
    for c in cases:
        k = (c["input"], c["expected_output"])
        if k not in seen:
            seen.add(k)
            unique.append(c)

    if mode == "core_code":
        starter = "class Solution:\n    def solve(self, *args):\n        pass\n"
    else:
        starter = (
            "import sys\n\n"
            "def solve():\n"
            "    data = sys.stdin.read().split()\n"
            "    # TODO: 实现逻辑\n"
            "    print(...)\n\n"
            'if __name__ == "__main__":\n'
            "    solve()\n"
        )

    return {"title": title, "test_cases": unique, "starter_code": starter}


def _scan_problems() -> list[dict]:
    """Scan all problem configs and return status-enhanced list."""
    problems = []
    if not PROBLEMS_DIR.exists():
        return problems
    for d in sorted(PROBLEMS_DIR.iterdir()):
        cfg = d / "config.json"
        if not d.is_dir() or not cfg.exists():
            continue
        data = json.loads(cfg.read_text(encoding="utf-8"))
        # Get best submission status
        status = "unattempted"
        if SUBMISSIONS_DIR.exists():
            for f in SUBMISSIONS_DIR.glob("*.json"):
                sub = json.loads(f.read_text(encoding="utf-8"))
                if sub.get("problem_id") != data["id"]:
                    continue
                if sub.get("status") == "Accepted":
                    status = "accepted"
                    break
                if sub.get("status") in ("Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Syntax Error"):
                    status = "attempted"

        problems.append({
            "id": data["id"],
            "title": data["title"],
            "difficulty": data.get("difficulty", "medium"),
            "mode": data.get("mode", "stdio"),
            "status": status,
        })
    return problems


# ── CRUD endpoints ──────────────────────────────────────────

@router.get("/problems/{problem_id}")
def get_problem_admin(problem_id: str):
    """管理员接口：返回完整 config + readme，包括 test_cases 答案。"""
    cfg_path = PROBLEMS_DIR / problem_id / "config.json"
    readme_path = PROBLEMS_DIR / problem_id / "README.md"

    if not cfg_path.exists():
        raise HTTPException(status_code=404, detail=f"题目 '{problem_id}' 不存在")

    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    readme = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""

    return {
        "id": config["id"],
        "title": config.get("title", ""),
        "mode": config.get("mode", "stdio"),
        "method": config.get("method", ""),
        "time_limit": config.get("time_limit", 2.0),
        "difficulty": config.get("difficulty", "medium"),
        "starter_code": config.get("starter_code", ""),
        "test_cases": config.get("test_cases", []),
        "readme": readme,
    }


@router.put("/problems/{problem_id}")
def update_problem(problem_id: str, req: UpdateProblemRequest):
    """更新题目 config.json。"""
    cfg_path = PROBLEMS_DIR / problem_id / "config.json"
    if not cfg_path.exists():
        raise HTTPException(status_code=404, detail=f"题目 '{problem_id}' 不存在")

    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    if req.title is not None: config["title"] = req.title
    if req.mode is not None: config["mode"] = req.mode
    if req.method is not None: config["method"] = req.method
    if req.time_limit is not None: config["time_limit"] = req.time_limit
    if req.difficulty is not None: config["difficulty"] = req.difficulty
    if req.starter_code is not None: config["starter_code"] = req.starter_code
    if req.test_cases is not None: config["test_cases"] = req.test_cases

    cfg_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@router.put("/problems/{problem_id}/readme")
def update_readme(problem_id: str, req: UpdateReadmeRequest):
    """更新题目 README.md。"""
    readme_path = PROBLEMS_DIR / problem_id / "README.md"
    readme_path.write_text(req.content, encoding="utf-8")
    return {"ok": True}


@router.post("/problems")
def create_problem(req: CreateProblemRequest):
    """从 markdown 创建新题目。"""
    problem_dir = PROBLEMS_DIR / req.id
    if problem_dir.exists():
        raise HTTPException(status_code=409, detail=f"题目 '{req.id}' 已存在")

    parsed = _parse_markdown_content(req.markdown, req.id, req.difficulty, req.mode)
    problem_dir.mkdir(parents=True)

    config = {
        "id": req.id, "title": parsed["title"],
        "mode": req.mode, "time_limit": 2.0, "difficulty": req.difficulty,
        "description": req.id, "starter_code": parsed["starter_code"],
        "test_cases": parsed["test_cases"],
    }
    (problem_dir / "config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    readme_content = req.markdown.strip() or f"# {parsed['title']}\n\nTODO: 题目描述"
    (problem_dir / "README.md").write_text(readme_content, encoding="utf-8")

    return {"ok": True, "id": req.id, "title": parsed["title"], "test_case_count": len(parsed["test_cases"])}


@router.delete("/problems/{problem_id}")
def delete_problem(problem_id: str):
    """删除题目目录。"""
    problem_dir = PROBLEMS_DIR / problem_id
    if not problem_dir.exists():
        raise HTTPException(status_code=404, detail=f"题目 '{problem_id}' 不存在")
    shutil.rmtree(problem_dir)
    return {"ok": True}


# ── Batch operations ────────────────────────────────────────

@router.post("/problems/batch")
def batch_update(req: BatchUpdateRequest):
    """批量更新题目（难度/标签等）。"""
    updated = 0
    errors = []
    for pid in req.ids:
        cfg_path = PROBLEMS_DIR / pid / "config.json"
        if not cfg_path.exists():
            errors.append(f"'{pid}' 不存在")
            continue
        config = json.loads(cfg_path.read_text(encoding="utf-8"))
        for key, value in req.updates.items():
            if value is not None:
                config[key] = value
        cfg_path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        updated += 1
    return {"ok": True, "updated": updated, "errors": errors}


# ── Stats ───────────────────────────────────────────────────

@router.get("/stats")
def admin_stats():
    """返回题目统计。"""
    problems = _scan_problems()
    total = len(problems)
    easy = sum(1 for p in problems if p["difficulty"] == "easy")
    medium = sum(1 for p in problems if p["difficulty"] == "medium")
    hard = sum(1 for p in problems if p["difficulty"] == "hard")
    accepted = sum(1 for p in problems if p["status"] == "accepted")
    return {
        "total": total,
        "easy": easy,
        "medium": medium,
        "hard": hard,
        "solved": accepted,
        "pass_rate": round(accepted / total * 100, 1) if total > 0 else 0,
    }


# ── Import ──────────────────────────────────────────────────

@router.post("/import")
def trigger_import():
    """触发增量导入题目。"""
    import_script = ROOT / "import_problems.py"
    result = subprocess.run(
        ["python", str(import_script), "--incremental"],
        capture_output=True, text=True, timeout=120,
        cwd=str(ROOT),
    )
    return {
        "ok": result.returncode == 0,
        "stdout": result.stdout[-500:],
        "stderr": result.stderr[-500:],
    }
