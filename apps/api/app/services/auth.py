from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import generate_session_token, hash_password, verify_password
from app.models import User, hash_token_value
from app.repositories.users import AuthTokensRepository, UsersRepository


class AuthService:
    def __init__(self, db: Session):
        self.users = UsersRepository(db)
        self.tokens = AuthTokensRepository(db)

    def register(self, *, email: str, display_name: str, password: str) -> tuple[User, str]:
        email_normalized = email.strip().lower()
        if self.users.get_by_email(email_normalized):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = self.users.create(
            email=email_normalized,
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        raw_token = generate_session_token()
        self.tokens.create(user_id=user.id, token_hash=hash_token_value(raw_token))
        return user, raw_token

    def login(self, *, email: str, password: str) -> tuple[User, str]:
        email_normalized = email.strip().lower()
        user = self.users.get_by_email(email_normalized)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        raw_token = generate_session_token()
        self.tokens.create(user_id=user.id, token_hash=hash_token_value(raw_token))
        return user, raw_token

    def resolve_user(self, token: str) -> User:
        token_record = self.tokens.get_active(token_hash=hash_token_value(token))
        if token_record is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        user = self.users.get_by_id(token_record.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
