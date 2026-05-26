# EventApp

## Run the backend

```bash
cd backend
uv sync
uv run python main.py
```

The API will start on `http://127.0.0.1:8000`.

## Run `test-auth.html`

Start the backend first, then from the project root serve the repo with a simple static server:

```bash
python -m http.server 5500
```

Open this page in your browser:

```text
http://127.0.0.1:5500/test-auth.html
```

Notes:
- `test-auth.html` calls `http://localhost:8000/auth/me`
- if you want real Firebase auth, configure the backend for `EVENT_APP_AUTH_PROVIDER=firebase`
- if you only want backend-side mock-token testing, use the API directly instead of `test-auth.html`
