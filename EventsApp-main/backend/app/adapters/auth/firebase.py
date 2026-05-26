# ARCHIVED — Phase 1000
# This adapter is preserved for reference and future re-enablement.
# It is NOT imported at module level. Only loaded when auth_provider="firebase" is set in config.
# firebase-admin has been removed from pyproject.toml; install separately if re-enabling:
#   uv add firebase-admin==7.3.0
#
import json

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from app.adapters.auth.interfaces import AuthProvider, VerifiedIdentity


class FirebaseAuthProvider(AuthProvider):
    """Firebase Admin SDK auth adapter.

    Verifies Firebase ID tokens (email/password and Microsoft SSO share
    the same token format — no diverging code paths).

    Account linking is Firebase-managed: when a user authenticates via
    both email/password and Microsoft SSO with the same email, Firebase
    merges them under one UID. This adapter always sees a single firebase_uid.
    """

    def __init__(
        self,
        project_id: str | None = None,
        service_account_json: str | None = None,
    ) -> None:
        self._project_id = project_id
        self._service_account_json = service_account_json

    def _initialize_app(self) -> None:
        try:
            firebase_admin.get_app()
            return
        except ValueError:
            pass

        if self._service_account_json:
            cert_dict = json.loads(self._service_account_json)
            cred = credentials.Certificate(cert_dict)
        else:
            cred = credentials.ApplicationDefault()

        options = {"projectId": self._project_id} if self._project_id else None
        firebase_admin.initialize_app(credential=cred, options=options)

    def verify_token(self, token: str) -> VerifiedIdentity:
        self._initialize_app()
        try:
            decoded = firebase_auth.verify_id_token(token)
        except firebase_auth.ExpiredIdTokenError as exc:
            raise ValueError("Firebase ID token has expired.") from exc
        except firebase_auth.RevokedIdTokenError as exc:
            raise ValueError("Firebase ID token has been revoked.") from exc
        except firebase_auth.InvalidIdTokenError as exc:
            raise ValueError("Firebase ID token is invalid.") from exc
        except Exception as exc:
            raise ValueError(f"Token verification failed: {exc}") from exc

        external_uid = decoded.get("uid")
        email = decoded.get("email")
        if not external_uid or not email:
            raise ValueError("Verified Firebase token missing uid or email.")

        return VerifiedIdentity(
            provider="firebase",
            external_uid=external_uid,
            email=email,
            display_name=decoded.get("name"),
            role=decoded.get("role"),
        )
