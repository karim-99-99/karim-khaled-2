#!/usr/bin/env bash
# Render start script — migrate, optional seed, then serve.
set -e
python manage.py migrate --noinput
python manage.py seed --only-if-empty
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
