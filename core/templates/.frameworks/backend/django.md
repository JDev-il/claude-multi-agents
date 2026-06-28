# Django — Scaffold Instructions

## Critical: Use the Dot Argument

Django creates a subfolder by default. Use `.` as the project name to scaffold in place:

```bash
cd backend
django-admin startproject config .
```

The `.` argument tells Django to scaffold in the current directory.

## Expected Structure After Scaffold

```
backend/
  config/
    __init__.py
    asgi.py
    settings.py
    urls.py
    wsgi.py
  manage.py
  requirements.txt
```

## Post-Scaffold

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install django djangorestframework python-dotenv
pip freeze > requirements.txt
```

## Update .scaffold/.paths.json

```json
{
  "backend": {
    "schemasDir": {
      "expected": "backend/api/serializers",
      "current": "backend/api/serializers",
      "status": "verified"
    },
    "modelsDir": {
      "expected": "backend/api/models",
      "current": "backend/api/models",
      "status": "verified"
    }
  }
}
```
