# Humber Event Hub - Master Build Specification

## 1. Purpose of This File
This is the single source of truth for the Humber Event Hub project.

Any code agent working on this project must:
- read this file first
- analyze this file before writing code
- follow this file as the project specification
- build the project step by step
- avoid making major architecture changes unless explicitly requested

---

## 2. Project Overview
Humber Event Hub is a mobile-first campus event management platform designed to centralize event discovery and improve student engagement.

The platform should allow:
- students to discover and register for campus events
- organizers to create and manage events
- admins to review, approve, and monitor events
- the system to send notifications and track engagement analytics

The goal is to replace fragmented event communication across emails, posters, websites, and social media with one centralized system.

---

## 3. Final Tech Stack (Fixed - Do Not Change)
Use the following stack only:

- Backend: Python + FastAPI
- Database: SQLite
- ORM: SQLAlchemy
- Authentication: Firebase Authentication
- Notifications: Firebase Cloud Messaging
- Student App: React Native
- Admin Dashboard: React

If Firebase integration slows down development, it is acceptable to mock Firebase temporarily during early backend development, but the code structure should be designed for real Firebase integration later.

---

## 4. Development Goal
The immediate goal is to build the backend first, step by step, starting with the MVP.

The backend should support:
- authentication and role-based access
- event creation and approval workflow
- event listing and search/filtering
- event registration with capacity checks
- basic notifications support
- admin analytics endpoints

---

## 5. Main Actors

### Student
A student can:
- browse event feed
- search and filter events
- view approved events
- register for events
- save events
- view personalized recommendations later

### Organizer
An organizer can:
- create event drafts
- upload event-related content or media later
- edit event details
- submit events for approval
- view participant lists

### Admin
An admin can:
- review pending events
- approve or reject events
- manage user roles
- access engagement analytics

### Notification System
The notification system is an external service responsible for:
- sending push notifications
- sending reminders
- notifying students about approved or upcoming events

---

## 6. Core Problem Statement
Campus event information at Humber is currently spread across multiple platforms such as emails, posters, websites, and social media. Because of this, students may miss important events, engagement stays low, and event organizers do not have centralized visibility into participation and performance.

The system should solve this by centralizing event discovery, registration, management, and analytics into one platform.

---

## 7. Project Objectives
The system should:
1. centralize campus event information into one platform
2. improve student engagement through personalization and timely notifications
3. provide administrators with tools to manage events efficiently
4. provide analytics and reporting
5. demonstrate a scalable real-world mobile application structure

---

## 8. MVP Scope (Build First)
Only build the following first:

1. authentication flow foundation
2. role-based access control
3. users model
4. events model
5. categories model
6. registrations model
7. event CRUD for organizers
8. event approval workflow for admins
9. approved event listing for students
10. student registration for events
11. capacity validation
12. basic analytics endpoint
13. notification model / placeholder notification service

### Do Not Build Yet
Do not build these in the first phase:
- recommendation engine
- advanced analytics dashboards
- machine learning
- external Humber system integrations
- media upload system unless explicitly requested
- polished frontend UI
- production deployment

---

## 9. Event Lifecycle Workflow
This is the expected workflow for an event:

1. user logs in
2. organizer creates an event draft
3. organizer submits the event for approval
4. event status becomes `pending`
5. admin reviews the event
6. admin either approves or rejects it
7. if rejected, organizer edits and resubmits
8. if approved, event becomes visible to students
9. system may send notifications to interested students
10. student discovers the event
11. student registers
12. system checks capacity before confirming registration
13. event eventually becomes completed
14. admin can review analytics for engagement and registrations

---

## 10. Roles and Permissions

### Student permissions
- read approved events
- search approved events
- register for approved events
- cancel own registration
- save events later
- view own profile

### Organizer permissions
- create events
- edit own events
- submit own events for approval
- view registrations for own events
- view own organizer-related data

### Admin permissions
- view all events
- view pending events
- approve events
- reject events
- manage roles if needed later
- access analytics

---

## 11. Business Rules
These rules must be enforced:

1. only organizers can create events
2. only admins can approve or reject events
3. students can only view approved events
4. a user cannot register for the same event twice
5. registration must fail if event capacity is already full
6. registration must fail if the event is not approved
7. completed events should not accept new registrations
8. rejected events are not visible to students
9. organizers should only edit their own events unless admin overrides
10. analytics should count registrations and event statuses at minimum

---

## 12. Initial Database Schema

### users
Fields:
- id (integer, primary key)
- firebase_uid (string, unique, nullable during mock auth stage)
- email (string, unique, required)
- name (string, required)
- role (string, required: `student`, `organizer`, `admin`)
- created_at (datetime, required)
- updated_at (datetime, required)

### students
Fields:
- id (integer, primary key)
- user_id (integer, foreign key -> users.id, unique)
- interests_json (text, optional)
- saved_events_json (text, optional)

Note:
This can be normalized later, but for MVP it is acceptable to store interests and saved events simply if needed.

### organizers
Fields:
- id (integer, primary key)
- user_id (integer, foreign key -> users.id, unique)
- department (string, optional)
- rating (float, optional)

### admins
Fields:
- id (integer, primary key)
- user_id (integer, foreign key -> users.id, unique)
- admin_level (integer, default 1)
- permissions_json (text, optional)

### events
Fields:
- id (integer, primary key)
- title (string, required)
- description (text, required)
- date_time (datetime, required)
- location (string, required)
- capacity (integer, required)
- organizer_id (integer, foreign key -> users.id, required)
- status (string, required: `draft`, `pending`, `approved`, `rejected`, `completed`)
- created_at (datetime, required)
- updated_at (datetime, required)

### categories
Fields:
- id (integer, primary key)
- name (string, unique, required)
- description (text, optional)

### event_categories
Fields:
- id (integer, primary key)
- event_id (integer, foreign key -> events.id)
- category_id (integer, foreign key -> categories.id)

### registrations
Fields:
- id (integer, primary key)
- user_id (integer, foreign key -> users.id, required)
- event_id (integer, foreign key -> events.id, required)
- timestamp (datetime, required)

Constraint:
- unique(user_id, event_id)

### notifications
Fields:
- id (integer, primary key)
- user_id (integer, foreign key -> users.id, required)
- type (string, required)
- content (text, required)
- is_read (boolean, default false)
- created_at (datetime, required)

---

## 13. Core Domain Model

### User
Common base user model.

Attributes:
- id
- firebase_uid
- email
- name
- role

Methods / behavior:
- login
- logout
- update profile

### Student
Derived from user behavior.

Attributes:
- interests
- saved events

Methods / behavior:
- register for event
- save event

### Organizer
Derived from user behavior.

Attributes:
- department
- rating

Methods / behavior:
- create event
- update event
- manage event registrations

### Admin
Derived from user behavior.

Attributes:
- admin level
- permissions

Methods / behavior:
- approve event
- reject event
- view analytics

### Event
Attributes:
- title
- description
- date_time
- location
- capacity
- status
- organizer_id

Methods / behavior:
- update status
- check capacity

### Category
Attributes:
- name
- description

Methods / behavior:
- get events by category

### Registration
Attributes:
- user_id
- event_id
- timestamp

Methods / behavior:
- cancel registration
- validate entry

### Notification
Attributes:
- type
- content
- is_read

Methods / behavior:
- send push
- schedule reminder

### AnalyticsReport
This may begin as a service instead of a database table in MVP.

Should support:
- total events
- approved vs rejected counts
- total registrations
- simple trends

---

## 14. Relationships
Use these relationships:

- Student, Organizer, and Admin are role-based user variants
- one organizer can create many events
- one event can belong to many categories
- one category can belong to many events
- one student can register for many events
- one event can have many student registrations
- registrations act as the linking entity between users and events

---

## 15. API Specification (MVP)

### Health
- GET `/health`

Response:
- basic status response

### Auth
- POST `/auth/login`
- GET `/auth/me`

Notes:
- For initial development, `/auth/login` can accept a mocked identity if Firebase is not fully wired yet
- final structure should support Firebase token validation

### Users
- GET `/users/me`
- PATCH `/users/me`

### Events - Public / Student
- GET `/events`
- GET `/events/{event_id}`

Rules:
- students should only receive approved events
- filtering by category, date, keyword, and location can be added progressively

### Events - Organizer
- POST `/organizer/events`
- GET `/organizer/events`
- GET `/organizer/events/{event_id}`
- PATCH `/organizer/events/{event_id}`
- POST `/organizer/events/{event_id}/submit`

Rules:
- organizer can only manage own events

### Events - Admin
- GET `/admin/events/pending`
- POST `/admin/events/{event_id}/approve`
- POST `/admin/events/{event_id}/reject`

### Registrations
- POST `/events/{event_id}/register`
- DELETE `/events/{event_id}/register`
- GET `/organizer/events/{event_id}/registrations`

### Analytics
- GET `/admin/analytics`

Minimum analytics response should include:
- total events
- pending events count
- approved events count
- rejected events count
- completed events count
- total registrations

### Notifications
- GET `/notifications`
- PATCH `/notifications/{notification_id}/read`

---

## 16. Suggested Request/Response Behavior

### Create event
Organizer submits:
- title
- description
- date_time
- location
- capacity
- category ids

System creates event with status `draft`

### Submit event
Organizer submits draft for review

System changes status from `draft` to `pending`

### Approve event
Admin approves event

System changes status from `pending` to `approved`

### Reject event
Admin rejects event

System changes status from `pending` to `rejected`

### Register for event
Student registers for approved event

System must:
- verify event exists
- verify event status is approved
- verify event is not full
- verify student is not already registered
- create registration record

---

## 17. Validation Rules

### Event validation
- title must not be empty
- description must not be empty
- date_time must be in valid datetime format
- capacity must be greater than 0
- location must not be empty

### Registration validation
- user must exist
- event must exist
- event must be approved
- event must not be full
- duplicate registration must be blocked

### Role validation
- role must be one of: `student`, `organizer`, `admin`

---

## 18. Suggested Backend Project Structure
As per our professor's recommendation, we should try Hexagonal architecture for the backend. Here is a suggested structure.