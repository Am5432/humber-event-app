"""Shared fixture data for organizer event integration tests."""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Sample organizer and user data
# ---------------------------------------------------------------------------

ORGANIZER_TOKEN = "org-fixture-token"
OTHER_ORGANIZER_TOKEN = "org-fixture-other-token"
STUDENT_TOKEN = "student-fixture-token"

ORGANIZER_UID = "fixture-organizer-001"
OTHER_ORGANIZER_UID = "fixture-organizer-002"
STUDENT_UID = "fixture-student-001"

ORGANIZER_EMAIL = "organizer@humber.ca"
OTHER_ORGANIZER_EMAIL = "organizer2@humber.ca"
STUDENT_EMAIL = "student@humber.ca"

# Category IDs seeded in tests
CAT_ACADEMIC = "cat-academic"
CAT_SPORTS = "cat-sports"
CAT_ARTS = "cat-arts"

# ---------------------------------------------------------------------------
# Event payload factory helpers
# ---------------------------------------------------------------------------


def draft_event_payload(
    title: str = "Campus Workshop",
    category_ids: list[str] | None = None,
    capacity: int = 30,
    **overrides: Any,
) -> dict[str, Any]:
    """Return a valid draft-event creation payload."""
    payload: dict[str, Any] = {
        "title": title,
        "description": "A detailed description of the campus event for students.",
        "date_time": "2027-09-01T09:00:00Z",
        "location": "Building A, Room 210",
        "capacity": capacity,
        "category_ids": category_ids if category_ids is not None else [CAT_ACADEMIC],
    }
    payload.update(overrides)
    return payload


def submittable_event_payload(
    title: str = "Submit-Ready Event",
    category_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Return a valid payload that passes all submission validation rules."""
    return draft_event_payload(
        title=title,
        description="Full description for a submit-ready event.",
        location="Main Hall",
        capacity=100,
        category_ids=category_ids if category_ids is not None else [CAT_ACADEMIC],
    )


# ---------------------------------------------------------------------------
# Sample events (static reference data for documentation / seeding)
# ---------------------------------------------------------------------------

SAMPLE_EVENTS: list[dict[str, Any]] = [
    {
        "title": "Python for Beginners",
        "description": "An introductory workshop on Python programming.",
        "date_time": "2027-10-10T10:00:00Z",
        "location": "ICT Building, Lab 3",
        "capacity": 40,
        "category_ids": [CAT_ACADEMIC],
    },
    {
        "title": "Fall Sports Day",
        "description": "Annual inter-college sports competition.",
        "date_time": "2027-11-05T08:00:00Z",
        "location": "Athletics Field",
        "capacity": 200,
        "category_ids": [CAT_SPORTS],
    },
    {
        "title": "Art Exhibition Opening",
        "description": "End-of-semester showcase of student artwork.",
        "date_time": "2027-12-01T14:00:00Z",
        "location": "Gallery Hall",
        "capacity": 80,
        "category_ids": [CAT_ARTS],
    },
]
