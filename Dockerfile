FROM node:20-alpine AS frontend-builder
WORKDIR /app/cfms/frontend/cfms_frontend

COPY cfms/frontend/cfms_frontend/package.json cfms/frontend/cfms_frontend/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY cfms/frontend/cfms_frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

COPY cfms/backend/requirements.txt /app/cfms/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/cfms/backend/requirements.txt

COPY cfms/backend /app/cfms/backend
COPY --from=frontend-builder /app/cfms/frontend/cfms_frontend/build /tmp/frontend-build

RUN mkdir -p /app/cfms/backend/static /app/cfms/backend/templates \
    && cp -r /tmp/frontend-build/static /app/cfms/backend/static/frontend \
    && cp /tmp/frontend-build/index.html /app/cfms/backend/templates/index.html \
    && cp /tmp/frontend-build/asset-manifest.json /app/cfms/backend/static/frontend/asset-manifest.json \
    && cp /tmp/frontend-build/manifest.json /app/cfms/backend/static/frontend/manifest.json \
    && cp /tmp/frontend-build/robots.txt /app/cfms/backend/static/frontend/robots.txt

WORKDIR /app/cfms/backend
EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn cfms_backend.wsgi:application --bind 0.0.0.0:${PORT}"]
