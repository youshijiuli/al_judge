"""Shared path constants for server modules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROBLEMS_DIR = ROOT / "problems"
SUBMISSIONS_DIR = ROOT / "submissions"
