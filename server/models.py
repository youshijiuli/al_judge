"""Shared Pydantic models for request/response schemas."""
from pydantic import BaseModel


class SubmitRequest(BaseModel):
    problem_id: str
    code: str


class UpdateProblemRequest(BaseModel):
    title: str | None = None
    mode: str | None = None
    method: str | None = None
    time_limit: float | None = None
    difficulty: str | None = None
    starter_code: str | None = None
    test_cases: list[dict] | None = None


class UpdateReadmeRequest(BaseModel):
    content: str


class CreateProblemRequest(BaseModel):
    id: str
    difficulty: str = "medium"
    mode: str = "stdio"
    markdown: str = ""


class BatchUpdateRequest(BaseModel):
    ids: list[str]
    updates: dict  # {"difficulty": "easy", "tags": ["array"]} — only set non-None fields


class ImportRequest(BaseModel):
    source_path: str | None = None  # override default data source
