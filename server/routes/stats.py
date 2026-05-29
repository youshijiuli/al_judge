"""Stats routes — heatmap, difficulty stats, submission trends."""
import json
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter
from config import PROBLEMS_DIR, SUBMISSIONS_DIR

router = APIRouter(prefix="/api", tags=["stats"])


# ── Heatmap ─────────────────────────────────────────────────

@router.get("/submissions/heatmap")
def submission_heatmap():
    """返回过去365天每天的提交计数（GitHub 风格热力图数据）。"""
    if not SUBMISSIONS_DIR.exists():
        return []

    today = datetime.now().date()
    start_date = today - timedelta(days=364)
    counts: dict[str, int] = defaultdict(int)

    for f in SUBMISSIONS_DIR.glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        try:
            t = datetime.fromisoformat(data["time"]).date()
            if start_date <= t <= today:
                counts[t.isoformat()] += 1
        except (KeyError, ValueError):
            continue

    # Build 365-day array
    result = []
    for i in range(365):
        d = start_date + timedelta(days=i)
        result.append({"date": d.isoformat(), "count": counts.get(d.isoformat(), 0)})

    return result


# ── Difficulty stats ───────────────────────────────────────

@router.get("/stats/difficulty")
def difficulty_stats():
    """返回按难度的完成统计。"""
    stats = {"easy": {"total": 0, "solved": 0}, "medium": {"total": 0, "solved": 0}, "hard": {"total": 0, "solved": 0}}

    # Build submission status map
    status_map: dict[str, str] = {}
    if SUBMISSIONS_DIR.exists():
        for f in SUBMISSIONS_DIR.glob("*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            pid = data.get("problem_id", "")
            if data.get("status") == "Accepted":
                status_map[pid] = "accepted"
            elif pid not in status_map:
                status_map[pid] = "attempted"

    if PROBLEMS_DIR.exists():
        for d in PROBLEMS_DIR.iterdir():
            cfg = d / "config.json"
            if not d.is_dir() or not cfg.exists():
                continue
            config = json.loads(cfg.read_text(encoding="utf-8"))
            diff = config.get("difficulty", "medium")
            pid = config["id"]

            if diff in stats:
                stats[diff]["total"] += 1
                if status_map.get(pid) == "accepted":
                    stats[diff]["solved"] += 1

    # Add totals
    total_problems = sum(s["total"] for s in stats.values())
    total_solved = sum(s["solved"] for s in stats.values())
    stats["overall"] = {"total": total_problems, "solved": total_solved}

    return stats


# ── Trend ───────────────────────────────────────────────────

@router.get("/stats/trend")
def submission_trend():
    """返回按周的提交通过率趋势。"""
    if not SUBMISSIONS_DIR.exists():
        return []

    # Group submissions by ISO week
    weeks: dict[str, list[dict]] = defaultdict(list)
    for f in SUBMISSIONS_DIR.glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        try:
            t = datetime.fromisoformat(data["time"])
            week_key = t.strftime("%Y-W%W")
            weeks[week_key].append(data)
        except (KeyError, ValueError):
            continue

    result = []
    for week_key in sorted(weeks.keys())[-26:]:  # last 26 weeks
        subs = weeks[week_key]
        total = len(subs)
        passed = sum(1 for s in subs if s.get("status") == "Accepted")
        result.append({
            "week": week_key,
            "total_submissions": total,
            "pass_rate": round(passed / total * 100, 1) if total > 0 else 0,
        })

    return result
