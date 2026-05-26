# Client Request Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant HTTP as FastAPI HTTP Server
    participant Dep as HTTP Dependencies
    participant AuthAd as Auth Adapter
    participant Repo as User Repository
    participant DB as SQLite Database
    participant Service as UserService
    participant Domain as Domain Entities

    Client->>HTTP: GET /users/me (Bearer token)
    activate HTTP
    HTTP->>Dep: get_current_user() depends on token
    activate Dep
    Dep->>AuthAd: verify_token(token)
    activate AuthAd
    alt Production
        AuthAd->>AuthAd: Call Firebase Admin verify_id_token()
    else Development
        AuthAd->>AuthAd: Lookup in memory dict
    end
    AuthAd-->>Dep: Return VerifiedIdentity(uid, email, displayName)
    deactivate AuthAd
    Dep->>Dep: user_service = UserService(UserRepository(session))
    activate Service
    Service->>Repo: get_by_firebase_uid(identity.external_uid)
    activate Repo
    Repo->>DB: SELECT * FROM users WHERE firebase_uid = ?
    activate DB
    alt User exists
        DB-->>Repo: Return User model
        Repo->>Repo: Convert to domain User entity
    else First login
        DB--xRepo: USER NOT FOUND
        deactivate DB
        Repo--xService: Auto-provision needed
        Service->>Repo: create_user(firebase_uid, email, displayName, STUDENT)
        Repo->>DB: INSERT INTO users (...)
        activate DB
        DB-->>Repo: Return created user
        deactivate DB
    end
    Repo-->>Service: Return User entity
    deactivate Repo
    Service-->>Dep: Return CurrentUserResponse
    deactivate Service
    Dep-->>HTTP: Return 200 + user data
    deactivate Dep
    HTTP-->>Client: Response (user profile)
    deactivate HTTP
    Client->>Client: Render user profile
```

# Alternative: Forbidden Response (wrong role)

```mermaid
sequenceDiagram
    participant Client
    participant HTTP
    participant Dep
    participant AuthAd as Auth Adapter
    participant Dep2 as Dependency Role Check
    participant Policy as Policy Helper

    Client->>HTTP: GET /auth/admin-check (student token)
    activate HTTP
    HTTP->>Dep: get_current_user()
    activate Dep
    Dep->>AuthAd: verify_token(token)
    activate AuthAd
    AuthAd-->>Dep: Return VerifiedIdentity(role=student)
    deactivate AuthAd
    Dep->>Dep2: require_roles("admin")
    activate Dep2
    Dep2->>Policy: require_role(student, ["admin"])
    activate Policy
    Policy--xDep2: Role mismatch! Raise 403
    deactivate Policy
    Dep2--xDep: Raise HTTP 403 Forbidden
    deactivate Dep2
    Dep--xHTTP: Error response
    deactivate Dep
    HTTP-->>Client: Response (403 Forbidden)
    deactivate HTTP
    Client->>Client: Handle 403 error
```

**Legend:**
- **Solid arrow** `->>` → Normal call / request
- **Dashed arrow** `-->>` → Response / return
- **Cross arrow** `--x` → Error / exception path
- **alt** → Alternative path based on condition
- **activate/deactivate** → Show lifecycle of components