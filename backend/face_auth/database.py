import json
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "users.json")


def _load():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(db):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def register_user(user_id: int, username: str):
    db = _load()
    db[str(user_id)] = {"username": username}
    _save(db)


def get_username(user_id: int) -> Optional[str]:
    db = _load()
    entry = db.get(str(user_id))
    return entry["username"] if entry else None


def list_users():
    db = _load()
    return {int(k): v["username"] for k, v in db.items()}


def delete_user(user_id: int):
    db = _load()
    db.pop(str(user_id), None)
    _save(db)


def next_user_id() -> int:
    db = _load()
    if not db:
        return 1
    return max(int(k) for k in db.keys()) + 1
