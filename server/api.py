"""
FalJudge API — 本地判题系统后端
提供题目查询、代码提交、判题历史功能
"""
import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import ROOT, PROBLEMS_DIR, SUBMISSIONS_DIR
from judge import judge, format_result
from routes.admin import router as admin_router
from routes.stats import router as stats_router

app = FastAPI(title="FalJudge API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(stats_router)


# ── Schema ──────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    problem_id: str
    code: str


# ── Problem endpoints ───────────────────────────────────────

@app.get("/api/problems")
def list_problems():
    """返回所有题目列表（id、标题、模式、难度、描述摘要）。"""
    problems = []
    if PROBLEMS_DIR.exists():
        for d in sorted(PROBLEMS_DIR.iterdir()):
            cfg = d / "config.json"
            if not d.is_dir() or not cfg.exists():
                continue
            data = json.loads(cfg.read_text(encoding="utf-8"))
            desc = ""
            readme = d / "README.md"
            if readme.exists():
                desc = readme.read_text(encoding="utf-8")[:120]
            status = _get_best_status(data["id"])
            problems.append({
                "id": data["id"],
                "title": data["title"],
                "mode": data.get("mode", "stdio"),
                "difficulty": data.get("difficulty", "medium"),
                "desc_preview": desc,
                "status": status,
            })
    return problems


@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    """返回题目完整详情（描述 markdown、配置 JSON）。"""
    cfg_path = PROBLEMS_DIR / problem_id / "config.json"
    readme_path = PROBLEMS_DIR / problem_id / "README.md"

    if not cfg_path.exists():
        raise HTTPException(status_code=404, detail=f"题目 '{problem_id}' 不存在")

    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    description = ""
    if readme_path.exists():
        description = readme_path.read_text(encoding="utf-8")

    public_cases = []
    for tc in config.get("test_cases", []):
        if not tc.get("is_hidden"):
            public_cases.append({"input": tc["input"]})

    return {
        "id": config["id"],
        "title": config["title"],
        "mode": config.get("mode", "stdio"),
        "method": config.get("method", ""),
        "time_limit": config.get("time_limit", 2.0),
        "difficulty": config.get("difficulty", "medium"),
        "description": description,
        "starter_code": config.get("starter_code", ""),
        "public_test_cases": public_cases,
    }


# ── Submit endpoint ─────────────────────────────────────────

@app.post("/api/submit")
def submit_code(req: SubmitRequest):
    """提交代码并判题。"""
    cfg_path = PROBLEMS_DIR / req.problem_id / "config.json"
    if not cfg_path.exists():
        raise HTTPException(status_code=404, detail=f"题目 '{req.problem_id}' 不存在")

    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    result = judge(req.code, config)

    # 保存提交记录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    submission = {
        "id": f"{timestamp}_{req.problem_id}",
        "problem_id": req.problem_id,
        "time": datetime.now().isoformat(),
        "code": req.code,
        "status": result.status.value,
        "passed": result.passed,
        "total": result.total,
        "max_runtime_ms": result.max_runtime_ms,
        "cases": [
            {
                "id": c.case_id,
                "passed": c.passed,
                "runtime_ms": c.runtime_ms,
                "input": c.input_display,
                "expected": c.expected,
                "actual": c.actual,
                "error": c.error,
            }
            for c in result.cases
        ],
        "error": result.error,
    }
    SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    (SUBMISSIONS_DIR / f"{submission['id']}.json").write_text(
        json.dumps(submission, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return submission


# ── Submission history ──────────────────────────────────────

@app.get("/api/submissions")
def list_submissions(problem_id: str = None):
    """返回提交历史，可按 problem_id 过滤。"""
    if not SUBMISSIONS_DIR.exists():
        return []

    subs = []
    for f in sorted(SUBMISSIONS_DIR.glob("*.json"), reverse=True):
        data = json.loads(f.read_text(encoding="utf-8"))
        if problem_id and data.get("problem_id") != problem_id:
            continue
        subs.append({
            "id": data.get("id"),
            "problem_id": data.get("problem_id"),
            "time": data.get("time"),
            "status": data.get("status"),
            "passed": data.get("passed"),
            "total": data.get("total"),
            "max_runtime_ms": data.get("max_runtime_ms"),
        })
    return subs[:50]


# ── Helpers ─────────────────────────────────────────────────

def _get_best_status(problem_id: str) -> str:
    """获取某道题的最佳通过状态。"""
    if not SUBMISSIONS_DIR.exists():
        return "unattempted"
    best = "unattempted"
    for f in SUBMISSIONS_DIR.glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        if data.get("problem_id") != problem_id:
            continue
        if data.get("status") == "Accepted":
            return "accepted"
        if data.get("status") in ("Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Syntax Error"):
            best = "attempted"
    return best
