from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class UserRole(str, Enum):
    STUDENT = "student"
    ORGANIZER = "organizer"
    ADMIN = "admin"
    REGULAR = "regular"


@dataclass(frozen=True, slots=True)
class User:
    id: int
    email: str
    display_name: str
    role: UserRole
