from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class VerifiedIdentity:
    provider: str
    external_uid: str
    email: str
    display_name: str | None = None
    role: str | None = None


class AuthProvider(Protocol):
    def verify_token(self, token: str) -> VerifiedIdentity:
        ...
