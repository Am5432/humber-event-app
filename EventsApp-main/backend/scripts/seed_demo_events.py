from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.adapters.persistence.models import CategoryModel, EventModel, UserModel
from app.bootstrap.db import get_session_factory


DEMO_ORGANIZER = {
    "email": "n01210458@gmail.com",
    "display_name": "N01210458",
}


DEMO_EVENTS: list[dict[str, object]] = [
    {
        "id": "demo-evt-001",
        "title": "Humber Launch Lab Demo Day",
        "description": "Student founders pitch startup ideas to peers, mentors, and visiting alumni judges.",
        "date_time": datetime(2026, 5, 2, 17, 30, tzinfo=timezone.utc),
        "location": "North Campus, LRC Concourse",
        "capacity": 120,
        "registrations_count": 74,
        "organizer_key": "org-01",
        "category_names": ["Technology", "Career & Professional"],
    },
    {
        "id": "demo-evt-002",
        "title": "Spring Wellness Reset",
        "description": "Guided breathing, journaling, and short mobility sessions for students before finals.",
        "date_time": datetime(2026, 5, 4, 15, 0, tzinfo=timezone.utc),
        "location": "Lakeshore Campus, Wellness Studio",
        "capacity": 45,
        "registrations_count": 31,
        "organizer_key": "org-02",
        "category_names": ["Health & Wellness"],
    },
    {
        "id": "demo-evt-003",
        "title": "Creative Industry Portfolio Night",
        "description": "Design, media, and UX students present polished portfolio work to local hiring managers.",
        "date_time": datetime(2026, 5, 6, 22, 0, tzinfo=timezone.utc),
        "location": "Downtown Campus, Studio Gallery",
        "capacity": 90,
        "registrations_count": 58,
        "organizer_key": "org-03",
        "category_names": ["Arts & Culture", "Career & Professional"],
    },
    {
        "id": "demo-evt-004",
        "title": "Campus Cleanup & Community Care",
        "description": "Volunteer crews refresh shared green spaces and collect supplies for neighbourhood outreach partners.",
        "date_time": datetime(2026, 5, 9, 14, 0, tzinfo=timezone.utc),
        "location": "North Campus, Front Lawn",
        "capacity": 70,
        "registrations_count": 33,
        "organizer_key": "org-04",
        "category_names": ["Community Service"],
    },
    {
        "id": "demo-evt-005",
        "title": "AI Study Sprint",
        "description": "A focused evening of collaborative exam prep, prompt design, and peer tutoring for tech courses.",
        "date_time": datetime(2026, 5, 12, 23, 0, tzinfo=timezone.utc),
        "location": "North Campus, Library Lab 2",
        "capacity": 60,
        "registrations_count": 46,
        "organizer_key": "org-01",
        "category_names": ["Academic", "Technology"],
    },
    {
        "id": "demo-evt-006",
        "title": "Lakeshore Sunset Social",
        "description": "Low-pressure student mixer with music, lawn games, and club introductions by the waterfront.",
        "date_time": datetime(2026, 5, 14, 23, 30, tzinfo=timezone.utc),
        "location": "Lakeshore Campus, Quad",
        "capacity": 160,
        "registrations_count": 119,
        "organizer_key": "org-05",
        "category_names": ["Social"],
    },
    {
        "id": "demo-evt-007",
        "title": "Women in Tech Fireside Chat",
        "description": "Industry guests share career stories, mentorship advice, and practical ways to grow a network.",
        "date_time": datetime(2026, 5, 16, 20, 0, tzinfo=timezone.utc),
        "location": "North Campus, Auditorium B",
        "capacity": 110,
        "registrations_count": 84,
        "organizer_key": "org-06",
        "category_names": ["Technology", "Career & Professional"],
    },
    {
        "id": "demo-evt-008",
        "title": "Intramural Finals Watch Party",
        "description": "Students gather for the final campus intramural matchup with food stations and giveaways.",
        "date_time": datetime(2026, 5, 18, 23, 0, tzinfo=timezone.utc),
        "location": "Athletics Centre",
        "capacity": 180,
        "registrations_count": 132,
        "organizer_key": "org-07",
        "category_names": ["Sports & Recreation", "Social"],
    },
    {
        "id": "demo-evt-009",
        "title": "Resume Rescue Clinic",
        "description": "Career advisors provide line-by-line resume feedback and mock recruiter screen tips.",
        "date_time": datetime(2026, 5, 21, 18, 0, tzinfo=timezone.utc),
        "location": "North Campus, Career Hub",
        "capacity": 55,
        "registrations_count": 42,
        "organizer_key": "org-03",
        "category_names": ["Career & Professional"],
    },
    {
        "id": "demo-evt-010",
        "title": "Student Film Showcase",
        "description": "Short films produced by Humber students with creator Q&A between screening blocks.",
        "date_time": datetime(2026, 5, 23, 23, 30, tzinfo=timezone.utc),
        "location": "Lakeshore Campus, Black Box Theatre",
        "capacity": 95,
        "registrations_count": 61,
        "organizer_key": "org-08",
        "category_names": ["Arts & Culture"],
    },
    {
        "id": "demo-evt-011",
        "title": "Hack the Campus Mini Jam",
        "description": "Fast-paced build night where small teams prototype ideas that improve student life on campus.",
        "date_time": datetime(2026, 5, 27, 22, 30, tzinfo=timezone.utc),
        "location": "North Campus, Innovation Garage",
        "capacity": 75,
        "registrations_count": 54,
        "organizer_key": "org-01",
        "category_names": ["Technology", "Academic"],
    },
    {
        "id": "demo-evt-012",
        "title": "Mindful Morning Yoga",
        "description": "Beginner-friendly flow session designed for students who want a calm start before classes.",
        "date_time": datetime(2026, 5, 29, 11, 0, tzinfo=timezone.utc),
        "location": "North Campus, Student Commons",
        "capacity": 35,
        "registrations_count": 19,
        "organizer_key": "org-02",
        "category_names": ["Health & Wellness"],
    },
    {
        "id": "demo-evt-013",
        "title": "Public Speaking Bootcamp",
        "description": "Hands-on speaking drills and feedback loops for presentations, pitches, and interviews.",
        "date_time": datetime(2026, 6, 3, 21, 0, tzinfo=timezone.utc),
        "location": "Downtown Campus, Seminar Room 4",
        "capacity": 48,
        "registrations_count": 29,
        "organizer_key": "org-06",
        "category_names": ["Academic", "Career & Professional"],
    },
    {
        "id": "demo-evt-014",
        "title": "Summer Club Fair",
        "description": "Student-led clubs recruit new members and preview their plans for the upcoming semester.",
        "date_time": datetime(2026, 6, 6, 17, 0, tzinfo=timezone.utc),
        "location": "North Campus, Main Atrium",
        "capacity": 220,
        "registrations_count": 147,
        "organizer_key": "org-05",
        "category_names": ["Social", "Community Service"],
    },
    {
        "id": "demo-evt-015",
        "title": "Street Photography Walk",
        "description": "A guided urban photography session with prompts, peer critique, and editing tips.",
        "date_time": datetime(2026, 6, 10, 22, 0, tzinfo=timezone.utc),
        "location": "Downtown Campus, Front Entrance",
        "capacity": 28,
        "registrations_count": 17,
        "organizer_key": "org-08",
        "category_names": ["Arts & Culture"],
    },
    {
        "id": "demo-evt-016",
        "title": "Exam Recharge Rec Room Night",
        "description": "Students decompress with board games, music, snacks, and quiet recharge corners after exams.",
        "date_time": datetime(2026, 6, 13, 22, 30, tzinfo=timezone.utc),
        "location": "Lakeshore Campus, Student Lounge",
        "capacity": 130,
        "registrations_count": 76,
        "organizer_key": "org-04",
        "category_names": ["Social", "Health & Wellness"],
    },
]


def _ensure_demo_organizer(session) -> UserModel:
    organizer = session.execute(
        select(UserModel).where(UserModel.email == DEMO_ORGANIZER["email"])
    ).scalar_one_or_none()
    if organizer is None:
        organizer = UserModel(
            email=DEMO_ORGANIZER["email"],
            display_name=DEMO_ORGANIZER["display_name"],
            role="organizer",
        )
        session.add(organizer)
        session.flush()
    else:
        organizer.display_name = DEMO_ORGANIZER["display_name"]
        organizer.role = "organizer"
    return organizer


def main() -> None:
    session = get_session_factory()()
    try:
        categories = session.execute(select(CategoryModel)).scalars().all()
        category_by_name = {category.name: category for category in categories}
        organizer = _ensure_demo_organizer(session)

        missing_categories = sorted(
            {
                category_name
                for event in DEMO_EVENTS
                for category_name in event["category_names"]
                if category_name not in category_by_name
            }
        )
        if missing_categories:
            raise RuntimeError(
                "Missing categories required for demo seed: "
                + ", ".join(missing_categories)
            )

        inserted = 0
        for event_payload in DEMO_EVENTS:
            existing = session.get(EventModel, event_payload["id"])
            if existing is None:
                event = EventModel(
                    id=event_payload["id"],
                    title=event_payload["title"],
                    description=event_payload["description"],
                    date_time=event_payload["date_time"],
                    location=event_payload["location"],
                    capacity=event_payload["capacity"],
                    registrations_count=event_payload["registrations_count"],
                    organizer_id=str(organizer.id),
                    status="approved",
                    submitted_at=datetime.now(timezone.utc),
                )
                session.add(event)
                inserted += 1
            else:
                event = existing
                event.title = event_payload["title"]
                event.description = event_payload["description"]
                event.date_time = event_payload["date_time"]
                event.location = event_payload["location"]
                event.capacity = event_payload["capacity"]
                event.registrations_count = event_payload["registrations_count"]
                event.organizer_id = str(organizer.id)
                event.status = "approved"
                if event.submitted_at is None:
                    event.submitted_at = datetime.now(timezone.utc)

            event.categories = [
                category_by_name[name]
                for name in event_payload["category_names"]
            ]

        session.commit()
        print(f"Seeded {inserted} demo events.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
