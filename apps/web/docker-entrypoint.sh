#!/bin/sh
# The same reasoning as in apps/api: node_modules live in a named volume, because a
# bind mount of the code would hide them, and installing them on the host is forbidden.
set -e

cd /app/apps/web

needs_install=0
if [ ! -x node_modules/.bin/ng ]; then
  needs_install=1
elif [ package.json -nt node_modules/.install-stamp ]; then
  needs_install=1
fi

if [ "$needs_install" = "1" ]; then
  echo "[web] installing dependencies…"
  npm install
  touch node_modules/.install-stamp
fi

# angular.json swaps environment.ts for environment.development.ts through fileReplacements,
# and that file is not committed — without it ng serve fails on a fresh clone. The stub is
# created here; it can be edited by hand afterwards.
if [ ! -f src/environments/environment.development.ts ]; then
  echo "[web] src/environments/environment.development.ts is missing — creating a stub"
  sed 's/production: true/production: false/' src/environments/environment.ts \
    > src/environments/environment.development.ts
fi

exec "$@"
