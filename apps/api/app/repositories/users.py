from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthToken, User


class UsersRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)

    def create(self, *, email: str, display_name: str, password_hash: str) -> User:
        user = User(email=email, display_name=display_name, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user


class AuthTokensRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, user_id: str, token_hash: str) -> AuthToken:
        token = AuthToken(user_id=user_id, token_hash=token_hash)
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_active(self, *, token_hash: str) -> AuthToken | None:
        return self.db.scalar(
            select(AuthToken).where(AuthToken.token_hash == token_hash, AuthToken.active.is_(True))
        )
