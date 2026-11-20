#!/usr/bin/env bash
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
preview="${repo}-workshop-preview"
branch=test/start-live-workshop
remote_ref=refs/remotes/origin/$branch
server_pid=

stop_server() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    server_pid=
  fi
}
trap stop_server EXIT
trap 'exit 0' INT TERM

fetch_preview() {
  git -C "$repo" fetch --no-tags origin "refs/heads/$branch:$remote_ref" || return 1
  git -C "$repo" rev-parse "$remote_ref"
}

revision=$(fetch_preview)
if [[ ! -e "$preview" ]]; then
  git -C "$repo" worktree add --detach "$preview" "$revision"
fi
[[ "$(git -C "$preview" rev-parse --show-toplevel)" == "$preview" ]]
if git -C "$preview" symbolic-ref --quiet HEAD >/dev/null; then
  echo "Expected a detached preview worktree: $preview" >&2
  exit 1
fi
cd "$preview"

if [[ -f "$repo/.env.local" && ! -e .env.local ]] && git check-ignore -q .env.local; then
  ln -s "$repo/.env.local" .env.local
fi

sync_preview() {
  if [[ -n "$(git status --porcelain)" ]] || ! git merge-base --is-ancestor HEAD "$1"; then
    echo "Preview sync paused: local changes or rewritten history in $preview" >&2
    return 1
  fi
  git merge --ff-only "$1"
}

start_server() {
  node node_modules/vite/bin/vite.js --host localhost --port 5175 --strictPort &
  server_pid=$!
}

sync_preview "$revision"
npm ci
start_server

while kill -0 "$server_pid" 2>/dev/null; do
  sleep 30
  if ! revision=$(fetch_preview) || [[ "$revision" == "$(git rev-parse HEAD)" ]]; then
    continue
  fi
  if git diff --quiet HEAD "$revision" -- package.json package-lock.json; then
    sync_preview "$revision" || true
  elif sync_preview "$revision"; then
    stop_server
    npm ci
    start_server
  fi
done

wait "$server_pid"
