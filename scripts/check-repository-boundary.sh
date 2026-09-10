#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

test -f Cargo.toml
test -f src/lib.rs
test -f docs/plugin-card.md
test ! -e .gitkeep

if rg -n 'lenso-http-auth|lenso_http_auth|sqlx|axum' Cargo.toml src tests; then
  echo "Projects Web must use direct Auth extraction and must not own transport or persistence." >&2
  exit 1
fi

rg -q 'lenso-capability-http-endpoint.*0\.3\.0' Cargo.toml
rg -q 'lenso-auth-sdk.*0\.2\.3' Cargo.toml
rg -q 'list_projects_with_context' src/lib.rs
rg -q 'create_project_update_with_context' src/lib.rs
rg -q 'list_workflow_states_with_context' src/lib.rs
rg -q 'business crate does not self-register navigation' docs/plugin-card.md
rg -q 'createWorkspace\(runtime\)' README.md src/workspace/workspace.js
