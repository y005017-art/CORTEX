from __future__ import annotations

from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_bytes, token_urlsafe


PBKDF2_ROUNDS = 120_000


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or token_bytes(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    salt_hex, digest_hex = encoded.split(":", 1)
    salt = bytes.fromhex(salt_hex)
    recalculated = hash_password(password, salt)
    return compare_digest(recalculated, encoded)


def generate_session_token() -> str:
    return token_urlsafe(32)
