import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "lyube.db"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        cols = {
            row[1]
            for row in conn.execute("PRAGMA table_info(time_entries)").fetchall()
        }
        if cols and "recorded_date" not in cols:
            conn.execute("DROP TABLE time_entries")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS time_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_name TEXT NOT NULL,
                duration_seconds INTEGER,
                notes TEXT,
                recorded_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        if cols and "notes" not in cols:
            conn.execute("ALTER TABLE time_entries ADD COLUMN notes TEXT")
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_time_entries_recorded_date
            ON time_entries(recorded_date DESC, id DESC)
        """)


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
