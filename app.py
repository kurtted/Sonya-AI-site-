from __future__ import annotations

import base64
import hashlib
import json
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "sonya_ai.db"
MEDIA_ROOT = ROOT / "media"
MEDIA_ROOT.mkdir(exist_ok=True)

PRODUCTS = {
    "basic": {
        "id": "basic",
        "name": "Basic",
        "price": 299,
        "description": "Базовый доступ к Sonya AI для первых сценариев удалённого управления.",
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "price": 890,
        "description": "Расширенный формат для регулярной работы с Sonya AI и более гибкого сценария использования.",
    },
    "ultimate": {
        "id": "ultimate",
        "name": "Ultimate",
        "price": 1499,
        "description": "Максимальный пакет с полным доступом и приоритетным форматом использования Sonya AI.",
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout = 10000")
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                avatar_path TEXT,
                balance INTEGER NOT NULL DEFAULT 0,
                theme TEXT NOT NULL DEFAULT 'dark',
                background_image TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id TEXT NOT NULL,
                product_name TEXT NOT NULL,
                description TEXT NOT NULL,
                price INTEGER NOT NULL,
                purchased_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                discount_percent INTEGER NOT NULL,
                max_activations INTEGER,
                current_activations INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT,
                created_at TEXT NOT NULL
            );
            """
        )

        columns = {row["name"] for row in db.execute("PRAGMA table_info(users)").fetchall()}
        if "role" not in columns:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def make_password(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    return salt, hash_password(password, salt)


def get_user_purchases(user_id: int) -> list[dict[str, object]]:
    with get_db() as db:
        rows = db.execute(
            """
            SELECT id, product_id, product_name, description, price, purchased_at
            FROM purchases
            WHERE user_id = ?
            ORDER BY purchased_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "description": row["description"],
            "price": row["price"],
            "purchased_at": row["purchased_at"],
        }
        for row in rows
    ]


def serialize_user(row: sqlite3.Row | None) -> dict[str, object] | None:
    if row is None:
        return None

    avatar_url = row["avatar_path"] if row["avatar_path"] else None
    background_url = row["background_image"] if row["background_image"] else None
    created_at = datetime.fromisoformat(row["created_at"])
    months = max(1, int((datetime.now(timezone.utc) - created_at).days / 30) + 1)

    return {
        "id": row["id"],
        "login": row["login"],
        "display_name": row["display_name"],
        "role": row["role"] or "user",
        "avatar_url": avatar_url,
        "balance": row["balance"],
        "theme": row["theme"],
        "background_image": background_url,
        "months_with_us": months,
        "purchases": get_user_purchases(row["id"]),
    }


def promo_to_response(row: sqlite3.Row, discounted_price: int) -> dict[str, object]:
    return {
        "code": row["code"],
        "discount_percent": row["discount_percent"],
        "discounted_price": discounted_price,
    }


class SonyaHandler(SimpleHTTPRequestHandler):
    server_version = "SonyaAI/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/session":
            self.handle_session()
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/register":
            self.handle_register()
            return
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/logout":
            self.handle_logout()
            return
        if parsed.path == "/api/profile/avatar":
            self.handle_avatar_update()
            return
        if parsed.path == "/api/profile/background":
            self.handle_background_update()
            return
        if parsed.path == "/api/store/promo/validate":
            self.handle_validate_promo()
            return
        if parsed.path == "/api/store/purchase":
            self.handle_purchase()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/profile/name":
            self.handle_name_update()
            return
        if parsed.path == "/api/profile/password":
            self.handle_password_update()
            return
        if parsed.path == "/api/profile/preferences":
            self.handle_preferences_update()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/profile/background":
            self.handle_background_reset()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def parse_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def send_json(self, status: int, payload: dict[str, object], *, cookie: SimpleCookie | None = None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            for morsel in cookie.values():
                self.send_header("Set-Cookie", morsel.OutputString())
        self.end_headers()
        self.wfile.write(body)

    def current_token(self) -> str | None:
        cookies = SimpleCookie(self.headers.get("Cookie"))
        morsel = cookies.get("sonya_session")
        return morsel.value if morsel else None

    def current_user(self) -> sqlite3.Row | None:
        token = self.current_token()
        if not token:
            return None

        with get_db() as db:
            return db.execute(
                """
                SELECT users.*
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ?
                """,
                (token,),
            ).fetchone()

    def require_user(self) -> sqlite3.Row | None:
        user = self.current_user()
        if not user:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "Требуется авторизация."})
            return None
        return user

    def build_session_cookie(self, token: str | None) -> SimpleCookie:
        cookie = SimpleCookie()
        cookie["sonya_session"] = token or ""
        cookie["sonya_session"]["path"] = "/"
        cookie["sonya_session"]["httponly"] = True
        if token is None:
            cookie["sonya_session"]["max-age"] = 0
        return cookie

    def get_valid_promo(self, code: str) -> sqlite3.Row | None:
        with get_db() as db:
            promo = db.execute("SELECT * FROM promo_codes WHERE code = ?", (code.upper(),)).fetchone()

        if not promo:
            return None
        if promo["discount_percent"] <= 0 or promo["discount_percent"] >= 100:
            return None
        if promo["max_activations"] is not None and promo["current_activations"] >= promo["max_activations"]:
            return None
        if promo["expires_at"]:
            try:
                expires_at = datetime.fromisoformat(promo["expires_at"])
            except ValueError:
                return None
            if expires_at <= datetime.now(timezone.utc):
                return None
        return promo

    def handle_session(self):
        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(self.current_user())})

    def handle_register(self):
        payload = self.parse_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", "")).strip()

        if len(login) < 3:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Логин должен быть длиннее 2 символов."})
            return
        if len(password) < 4:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Пароль должен быть длиннее 3 символов."})
            return

        salt, password_hash = make_password(password)
        now = utc_now()
        token = uuid.uuid4().hex

        try:
            with get_db() as db:
                cursor = db.execute(
                    """
                    INSERT INTO users (login, password_hash, password_salt, display_name, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (login, password_hash, salt, login, now, now),
                )
                user_id = cursor.lastrowid
                db.execute(
                    "INSERT INTO sessions (user_id, token, created_at) VALUES (?, ?, ?)",
                    (user_id, token, now),
                )
                user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        except sqlite3.IntegrityError:
            self.send_json(HTTPStatus.CONFLICT, {"ok": False, "error": "Такой логин уже существует."})
            return

        self.send_json(
            HTTPStatus.CREATED,
            {"ok": True, "user": serialize_user(user)},
            cookie=self.build_session_cookie(token),
        )

    def handle_login(self):
        payload = self.parse_json()
        login = str(payload.get("login", "")).strip()
        password = str(payload.get("password", "")).strip()

        with get_db() as db:
            user = db.execute("SELECT * FROM users WHERE login = ?", (login,)).fetchone()
            if not user or hash_password(password, user["password_salt"]) != user["password_hash"]:
                self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Неверный логин или пароль."})
                return

            token = uuid.uuid4().hex
            db.execute("INSERT INTO sessions (user_id, token, created_at) VALUES (?, ?, ?)", (user["id"], token, utc_now()))

        self.send_json(
            HTTPStatus.OK,
            {"ok": True, "user": serialize_user(user)},
            cookie=self.build_session_cookie(token),
        )

    def handle_logout(self):
        token = self.current_token()
        if token:
            with get_db() as db:
                db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        self.send_json(HTTPStatus.OK, {"ok": True}, cookie=self.build_session_cookie(None))

    def handle_name_update(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        display_name = str(payload.get("display_name", "")).strip()
        if len(display_name) < 2:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Имя должно быть длиннее 1 символа."})
            return
        if display_name == user["display_name"]:
            self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(user)})
            return

        with get_db() as db:
            db.execute(
                "UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?",
                (display_name, utc_now(), user["id"]),
            )
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(updated)})

    def handle_password_update(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        current_password = str(payload.get("current_password", "")).strip()
        new_password = str(payload.get("new_password", "")).strip()

        if hash_password(current_password, user["password_salt"]) != user["password_hash"]:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Текущий пароль введён неверно."})
            return
        if len(new_password) < 4:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Новый пароль слишком короткий."})
            return
        if hash_password(new_password, user["password_salt"]) == user["password_hash"]:
            self.send_json(HTTPStatus.OK, {"ok": True, "message": "Пароль уже установлен."})
            return

        salt, password_hash = make_password(new_password)
        with get_db() as db:
            db.execute(
                "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
                (password_hash, salt, utc_now(), user["id"]),
            )

        self.send_json(HTTPStatus.OK, {"ok": True, "message": "Пароль обновлён."})

    def handle_preferences_update(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        theme = str(payload.get("theme", "dark")).strip()
        if theme not in {"dark", "light"}:
            theme = "dark"

        with get_db() as db:
            db.execute("UPDATE users SET theme = ?, updated_at = ? WHERE id = ?", (theme, utc_now(), user["id"]))
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(updated)})

    def handle_avatar_update(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        file_path = self.save_image(str(payload.get("image_data", "")), prefix=f"avatar_{user['id']}")
        if not file_path:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Не удалось сохранить аватар."})
            return

        with get_db() as db:
            db.execute("UPDATE users SET avatar_path = ?, updated_at = ? WHERE id = ?", (file_path, utc_now(), user["id"]))
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(updated)})

    def handle_background_update(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        file_path = self.save_image(str(payload.get("image_data", "")), prefix=f"background_{user['id']}")
        if not file_path:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Не удалось сохранить фон."})
            return

        with get_db() as db:
            db.execute(
                "UPDATE users SET background_image = ?, updated_at = ? WHERE id = ?",
                (file_path, utc_now(), user["id"]),
            )
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(updated)})

    def handle_background_reset(self):
        user = self.require_user()
        if not user:
            return

        with get_db() as db:
            db.execute("UPDATE users SET background_image = NULL, updated_at = ? WHERE id = ?", (utc_now(), user["id"]))
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

        self.send_json(HTTPStatus.OK, {"ok": True, "user": serialize_user(updated)})

    def handle_validate_promo(self):
        payload = self.parse_json()
        code = str(payload.get("code", "")).strip().upper()
        product_id = str(payload.get("product_id", "")).strip().lower()
        product = PRODUCTS.get(product_id)

        if not code or not product:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Промокод не существует или его срок действия истёк."})
            return

        promo = self.get_valid_promo(code)
        if not promo:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Промокод не существует или его срок действия истёк."})
            return

        discounted_price = max(1, round(product["price"] * (100 - promo["discount_percent"]) / 100))
        self.send_json(HTTPStatus.OK, {"ok": True, "promo": promo_to_response(promo, discounted_price)})

    def handle_purchase(self):
        user = self.require_user()
        if not user:
            return

        payload = self.parse_json()
        product_id = str(payload.get("product_id", "")).strip().lower()
        promo_code = str(payload.get("promo_code", "")).strip().upper()
        product = PRODUCTS.get(product_id)

        if not product:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Тариф не найден."})
            return

        promo = None
        final_price = product["price"]
        if promo_code:
            promo = self.get_valid_promo(promo_code)
            if not promo:
                self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Промокод не существует или его срок действия истёк."})
                return
            final_price = max(1, round(product["price"] * (100 - promo["discount_percent"]) / 100))

        with get_db() as db:
            current_user = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            if current_user["balance"] < final_price:
                self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Недостаточно средств на балансе."})
                return

            now = utc_now()
            db.execute(
                """
                INSERT INTO purchases (user_id, product_id, product_name, description, price, purchased_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    current_user["id"],
                    product["id"],
                    product["name"],
                    product["description"],
                    final_price,
                    now,
                ),
            )
            db.execute(
                "UPDATE users SET balance = balance - ?, updated_at = ? WHERE id = ?",
                (final_price, now, current_user["id"]),
            )
            if promo:
                db.execute(
                    "UPDATE promo_codes SET current_activations = current_activations + 1 WHERE id = ?",
                    (promo["id"],),
                )
            updated = db.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()

        self.send_json(
            HTTPStatus.OK,
            {
                "ok": True,
                "user": serialize_user(updated),
                "product": product,
                "final_price": final_price,
                "promo": promo_to_response(promo, final_price) if promo else None,
            },
        )

    def save_image(self, image_data: str, *, prefix: str) -> str | None:
        if not image_data.startswith("data:image/"):
            return None

        try:
            header, encoded = image_data.split(",", 1)
        except ValueError:
            return None

        extension = header.split("/")[1].split(";")[0]
        if extension not in {"png", "jpg", "jpeg", "webp"}:
            extension = "png"

        try:
            raw = base64.b64decode(encoded)
        except ValueError:
            return None

        filename = f"{prefix}_{uuid.uuid4().hex}.{extension}"
        path = MEDIA_ROOT / filename
        path.write_bytes(raw)
        return f"/media/{filename}"
def main():
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), SonyaHandler)
    print("Sonya AI server started at http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
