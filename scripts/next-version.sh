#!/usr/bin/env bash
# Prints the next release version from the Conventional Commits since the last v* tag:
# a breaking change bumps MAJOR, feat bumps MINOR, fix or perf bumps PATCH. With nothing
# to release it prints the current version. Commits outside the convention are ignored.
set -euo pipefail

tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null) || {
  echo "no v* tag yet: the first release is tagged by release.yml from CHANGELOG.md" >&2
  exit 1
}
IFS=. read -r major minor patch <<<"${tag#v}"

breaking_subject='^[a-z]+(\([^)]*\))?!:'
breaking_footer=$'(^|\n)BREAKING[ -]CHANGE:'
bump='none'
while IFS= read -r -d '' message; do
  subject=${message%%$'\n'*}
  if [[ $subject =~ $breaking_subject || $message =~ $breaking_footer ]]; then
    bump='major'
    break
  elif [[ $subject =~ ^feat(\([^\)]*\))?: ]]; then
    bump='minor'
  elif [[ $subject =~ ^(fix|perf)(\([^\)]*\))?: && $bump == none ]]; then
    bump='patch'
  fi
done < <(git log -z --no-merges --format=%B "$tag..HEAD")

case $bump in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "$major.$((minor + 1)).0" ;;
  patch) echo "$major.$minor.$((patch + 1))" ;;
  none) echo "$major.$minor.$patch" ;;
esac
