from app.adapters.auth.interfaces import AuthProvider, VerifiedIdentity


DEFAULT_MOCK_IDENTITIES = {
    "dev-student-token": VerifiedIdentity(
        provider="mock",
        external_uid="mock-student-001",
        email="student@humber.ca",
        display_name="Dev Student",
        role="student",
    ),
    "dev-organizer-token": VerifiedIdentity(
        provider="mock",
        external_uid="mock-organizer-001",
        email="organizer@humber.ca",
        display_name="Dev Organizer",
        role="organizer",
    ),
    "dev-admin-token": VerifiedIdentity(
        provider="mock",
        external_uid="mock-admin-001",
        email="admin@humber.ca",
        display_name="Dev Admin",
        role="admin",
    ),
}


class MockAuthProvider(AuthProvider):
    def __init__(
        self,
        identities: dict[str, VerifiedIdentity] | None = None,
    ) -> None:
        self._identities = dict(identities or DEFAULT_MOCK_IDENTITIES)

    def seed_token(self, token: str, identity: VerifiedIdentity) -> None:
        self._identities[token] = identity

    def verify_token(self, token: str) -> VerifiedIdentity:
        try:
            return self._identities[token]
        except KeyError as error:
            raise ValueError("Unsupported development bearer token.") from error
