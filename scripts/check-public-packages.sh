#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if ! rg -q '^publish = true$' Cargo.toml; then
  echo "The public Plugin crate must remain publishable." >&2
  exit 1
fi

package_files="$(cargo package --list --allow-dirty)"
printf '%s\n' "$package_files" | rg -q '^Cargo\.toml$'
printf '%s\n' "$package_files" | rg -q '^src/lib\.rs$'
if printf '%s\n' "$package_files" | rg -q '^\.gitkeep$'; then
  echo "Placeholder files must not enter the published crate." >&2
  exit 1
fi

# Verify that the published source builds using registry dependencies alone.
cargo package --locked --allow-dirty
