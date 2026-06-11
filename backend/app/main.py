import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import get_connection, init_db
from .models import Entry, EntryCreate, LoginRequest

app = FastAPI(title="Lyube API", description="柳比歇夫式时间记录", version="0.2.0")

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
AUTH_PASSWORD = "mchhui"
SESSION_COOKIE = "lyube_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30
MAX_LOGIN_ATTEMPTS_PER_DAY = 3
sessions: set[str] = set()
login_attempts: dict[tuple[str, str], int] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _require_auth(lyube_session: Optional[str] = Cookie(None)) -> None:
    if not lyube_session or lyube_session not in sessions:
        raise HTTPException(status_code=401, detail="请先登录")


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


@app.get("/api/auth/status")
def auth_status(lyube_session: Optional[str] = Cookie(None)):
    return {"authenticated": bool(lyube_session and lyube_session in sessions)}


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response):
    ip = _client_ip(request)
    key = (ip, _today())
    attempts = login_attempts.get(key, 0)
    if attempts >= MAX_LOGIN_ATTEMPTS_PER_DAY:
        raise HTTPException(status_code=429, detail="今天登录尝试次数已用完")

    if body.password != AUTH_PASSWORD:
        login_attempts[key] = attempts + 1
        remaining = MAX_LOGIN_ATTEMPTS_PER_DAY - login_attempts[key]
        raise HTTPException(status_code=401, detail=f"密码错误，今天还可尝试 {remaining} 次")

    login_attempts.pop(key, None)
    token = secrets.token_urlsafe(32)
    sessions.add(token)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return {"authenticated": True}


@app.post("/api/auth/logout")
def logout(response: Response, lyube_session: Optional[str] = Cookie(None)):
    if lyube_session:
        sessions.discard(lyube_session)
    response.delete_cookie(SESSION_COOKIE)
    return {"authenticated": False}


@app.get("/api/entries", response_model=list[Entry])
def list_entries(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    _: None = Depends(_require_auth),
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
def create_entry(body: EntryCreate, _: None = Depends(_require_auth)):
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
def delete_entry(entry_id: int, _: None = Depends(_require_auth)):
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
