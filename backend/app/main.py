from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import get_connection, init_db
from .models import Entry, EntryCreate

app = FastAPI(title="Lyube API", description="柳比歇夫式时间记录", version="0.2.0")

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _row_to_entry(row) -> Entry:
    return Entry(
        id=row["id"],
        task_name=row["task_name"],
        duration_seconds=row["duration_seconds"],
        notes=row["notes"],
        recorded_date=row["recorded_date"],
    )


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Lyube"}


@app.get("/api/entries", response_model=list[Entry])
def list_entries(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
):
    target = date or _today()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM time_entries
            WHERE recorded_date = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (target, limit),
        ).fetchall()
    return [_row_to_entry(r) for r in rows]


@app.post("/api/entries", response_model=Entry, status_code=201)
def create_entry(body: EntryCreate):
    recorded_date = body.recorded_date or _today()
    duration = body.duration_seconds
    if duration is not None and duration == 0:
        duration = None

    notes = body.notes.strip() if body.notes else None
    if notes == "":
        notes = None

    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO time_entries (task_name, duration_seconds, notes, recorded_date)
            VALUES (?, ?, ?, ?)
            """,
            (body.task_name.strip(), duration, notes, recorded_date),
        )
        row = conn.execute("SELECT * FROM time_entries WHERE id = ?", (cur.lastrowid,)).fetchone()

    return _row_to_entry(row)


@app.delete("/api/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int):
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM time_entries WHERE id = ?", (entry_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "记录不存在")


if STATIC_DIR.is_dir():
    index_file = STATIC_DIR / "index.html"
    assets_dir = STATIC_DIR / "assets"

    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_index():
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(404, "前端未构建，请先在 frontend 目录执行 npm run build")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(404)
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(404, "前端未构建，请先在 frontend 目录执行 npm run build")
