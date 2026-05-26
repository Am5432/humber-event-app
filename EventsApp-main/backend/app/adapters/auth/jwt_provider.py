from __future__ import annotations

import jwt

from app.adapters.auth.interfaces import AuthProvider, VerifiedIdentity


class JWTAuthProvider(AuthProvider):
    """Auth provider that validates backend-issued JWT access tokens."""

    def __init__(self, jwt_secret: str, jwt_algorithm: str = "HS256") -> None:
        self._jwt_secret = jwt_secret
        self._jwt_algorithm = jwt_algorithm

    def verify_token(self, token: str) -> VerifiedIdentity:
        """Decode a JWT and normalize failures to ValueError for HTTP dependencies."""
        try:
            payload = jwt.decode(
                token,
                self._jwt_secret,
                algorithms=[self._jwt_algorithm],
                options={"require": ["sub", "role", "exp", "iat"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise ValueError("Access token has expired.") from exc
        except jwt.InvalidTokenError as exc:
            raise ValueError(f"Invalid access token: {exc}") from exc

        email = payload["sub"]
        role = payload["role"]

        return VerifiedIdentity(
            provider="jwt",
            external_uid=email,
            email=email,
            display_name=None,
            role=role,
        )
