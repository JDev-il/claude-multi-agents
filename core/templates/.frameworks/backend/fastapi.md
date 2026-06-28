# FastAPI — Scaffold Instructions

## Critical: Scaffold Location

You are working inside a git worktree. Your root is the **repo root**, not `backend/`.
All FastAPI files MUST live under `backend/`. Do NOT scaffold at the repo root.

FastAPI has no official scaffold CLI — create the structure manually:

```bash
mkdir -p backend/app/api/routes
mkdir -p backend/app/schemas
mkdir -p backend/app/models
mkdir -p backend/app/services
mkdir -p backend/app/core
touch backend/app/__init__.py
touch backend/app/main.py
touch backend/app/api/__init__.py
touch backend/app/api/routes/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/models/__init__.py
touch backend/app/services/__init__.py
touch backend/app/core/__init__.py
touch backend/app/core/config.py
```

## Expected Structure After Scaffold

```
backend/
  app/
    api/
      routes/
        __init__.py
    core/
      config.py
      __init__.py
    models/
      __init__.py
    schemas/
      __init__.py
    services/
      __init__.py
    __init__.py
    main.py
  requirements.txt
  .env.example
```

## main.py Template

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="{{PROJECT_NAME}}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

## requirements.txt

```
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

## Post-Scaffold

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Update .scaffold/.paths.json

After scaffolding, update `current` paths and set `status: verified`:
```json
{
  "backend": {
    "schemasDir": {
      "expected": "backend/app/schemas",
      "current": "backend/app/schemas",
      "status": "verified"
    },
    "modelsDir": {
      "expected": "backend/app/models",
      "current": "backend/app/models",
      "status": "verified"
    }
  }
}
```
