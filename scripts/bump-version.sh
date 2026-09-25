#!/usr/bin/env bash
# Sets the version of both apps: package.json and the two matching fields at the top of
# package-lock.json (the root one and packages[""]). awk instead of npm, because nothing
# runs on the host (CLAUDE.md, «Чого НЕ робимо»).
set -euo pipefail

version=${1:-}
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "usage: $0 X.Y.Z" >&2
  exit 1
}
cd "$(git rev-parse --show-toplevel)"

# Rewrites the first $2 "version" fields of $1; dependency versions further down stay put.
set_version() {
  awk -v version="$version" -v left="$2" '
    left > 0 && /^ *"version": "/ {
      sub(/"version": "[^"]*"/, "\"version\": \"" version "\"")
      left--
    }
    { print }
  ' "$1" >"$1.tmp"
  mv "$1.tmp" "$1"
}

for app in api web; do
  set_version "apps/$app/package.json" 1
  set_version "apps/$app/package-lock.json" 2
done
