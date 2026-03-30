#!/bin/sh
set -e

: "${PORT:=10000}"
: "${FRONTEND_HOST:=frontend}"
: "${FRONTEND_PORT:=3000}"
: "${BACKEND_HOST:=backend}"
: "${BACKEND_PORT:=3001}"

envsubst '${PORT} ${FRONTEND_HOST} ${FRONTEND_PORT} ${BACKEND_HOST} ${BACKEND_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
