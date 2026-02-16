# food-management-system

Full-stack food inventory app with Django backend and React frontend.

## Deploy on Render (Docker)

This repo includes:
- `Dockerfile` at project root
- `.dockerignore` at project root
- `render.yaml` at project root

### 1. Create a new Web Service on Render
- Connect your GitHub repo: `Surya-k-bot/food-management-system`
- Render will detect `render.yaml` and use the root `Dockerfile`

### 2. Set environment variables in Render
Use your Supabase Postgres values:
- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS=.onrender.com`
- `DB_ENGINE=postgres`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT` (usually `5432` or the port from Supabase)
- `DB_SSLMODE=require`

### 3. Deploy
The container startup command automatically runs:
- `python manage.py migrate`
- `python manage.py collectstatic --noinput`
- `gunicorn cfms_backend.wsgi:application --bind 0.0.0.0:$PORT`

After deploy:
- API: `https://<your-service>.onrender.com/api/food-items/`
- Frontend: `https://<your-service>.onrender.com/`
