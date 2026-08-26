#!/bin/sh
# node_modules live in a named volume rather than in the image: otherwise the bind-mounted
# code would hide them, and native modules (argon2) from the host would not run on Linux.
# The volume outlives an image rebuild, so freshness is checked here.
set -e

cd /app/apps/api

needs_install=0
if [ ! -x node_modules/.bin/eslint ]; then
  needs_install=1
elif [ package.json -nt node_modules/.install-stamp ]; then
  needs_install=1
fi

if [ "$needs_install" = "1" ]; then
  echo "[api] installing dependencies…"
  npm install
  touch node_modules/.install-stamp
fi

exec "$@"
