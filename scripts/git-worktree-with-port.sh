#!/bin/sh
# A worktree with its own docker compose stack, under .claude/worktrees/<branch>.
#
#   scripts/git-worktree-with-port.sh add feat-t54-price-search [base]
#   scripts/git-worktree-with-port.sh rm  feat-t54-price-search
#
# docker-compose.yml pins `name: mouse`; COMPOSE_PROJECT_NAME in the worktree's .env
# overrides it, so containers and volumes (database included) are not shared with the
# main stack. Host ports move by one slot N; compose takes the last duplicate key in .env,
# so appending is enough.
set -eu

cmd="${1:?usage: $0 add|rm <branch> [base]}"
branch="${2:?usage: $0 add|rm <branch> [base]}"
root="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
dir="$root/.claude/worktrees/$branch"

# A port claimed by a stopped worktree is not listening but will be once it comes back up.
taken() {
  grep -qsx "[A-Z_]*_HOST_PORT=$1" "$root"/.env "$root"/.claude/worktrees/*/.env ||
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null
}

case "$cmd" in
  add)
    n=1
    while taken $((5432 + n)) || taken $((3000 + n)) || taken $((4200 + n)); do
      n=$((n + 1))
    done

    git -C "$root" worktree add -b "$branch" "$dir" "${3:-main}"
    cp "$root/.env" "$dir/.env"
    printf 'COMPOSE_PROJECT_NAME=mouse-%s\nPOSTGRES_HOST_PORT=%s\nAPI_HOST_PORT=%s\nWEB_HOST_PORT=%s\n' \
      "$branch" $((5432 + n)) $((3000 + n)) $((4200 + n)) >> "$dir/.env"

    echo "cd $dir && docker compose up --build   # http://localhost:$((4200 + n))"
    ;;
  rm)
    # Volumes first: without the worktree's .env nothing knows their project name.
    (cd "$dir" && docker compose down -v)
    git -C "$root" worktree remove "$dir"
    echo "branch kept: git branch -d $branch"
    ;;
  *)
    echo "usage: $0 add|rm <branch> [base]" >&2
    exit 1
    ;;
esac
