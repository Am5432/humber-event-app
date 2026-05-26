# Backend

## Run the application

From the project root:

```bash
cd backend
uv sync
uv run python main.py
```

What this does:
- installs backend dependencies into the local `.venv`
- runs Alembic migrations to `head`
- starts the API on `http://127.0.0.1:8000`

## Useful environment variables

- `EVENT_APP_HOST` - defaults to `127.0.0.1`
- `EVENT_APP_PORT` - defaults to `8000`
- `EVENT_APP_RELOAD` - defaults to `true`
- `EVENT_APP_AUTH_PROVIDER` - use `mock` or `firebase`

## Run tests

```bash
cd backend
uv run python -m pytest tests -q
```
