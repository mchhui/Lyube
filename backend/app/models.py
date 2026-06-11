from typing import Optional

from pydantic import BaseModel, Field


class EntryCreate(BaseModel):
    task_name: str = Field(..., min_length=1, max_length=200)
    duration_seconds: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    recorded_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class Entry(BaseModel):
    id: int
    task_name: str
    duration_seconds: Optional[int]
    notes: Optional[str] = None
    recorded_date: str


class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=200)
