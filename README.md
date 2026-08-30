# Lenso Projects Web Plugin

`lenso.projects.web` is a removable, linked native Web Plugin for the Linear-like Lenso Projects workflow. It provides `lenso.http.endpoint@1` and delegates every project, issue, comment, update, and catalog fact to the bound Projects capabilities.

## Product workflow

The page at `/projects` gives a product team a roadmap list, project detail, issue queue, current cycle, and project creation flow. Its typed JSON endpoints also cover the complete V1 editing surface:

- projects: list, create, read, update, archive;
- issues: list, create, read, update, move, archive;
- comments: list, add, update, delete;
- project updates: list and create;
- read-only catalogs: teams, project statuses, workflow states, cycles, milestones, and labels.

The Web Plugin does not persist, reconstruct, cache, or independently authorize these facts. It authenticates ingress evidence through exactly one `lenso.auth@1`, attaches the returned `ActorAssertion`, and invokes the target capability with `_with_context`. The Projects Provider remains responsible for membership, permission, private-team visibility, revision checks, and idempotency.

## Host linking and ingress

This crate is a linked native Plugin, not a portable Bundle and not a standalone HTTP server. A Host must:

1. link the crate (calling `lenso_projects_web_plugin::link()` is a convenient retention reference);
2. build its registry with `NativePluginRegistry::with_linked_factories()`;
3. place `lenso.projects.web` in the resolved App Plan;
4. bind its one Auth, Projects, Projects Collaboration, and Projects Admin requirements;
5. bind the Host's Web Ingress `many lenso.http.endpoint@1` requirement to this Plugin.

The generic `lenso run` flow does not distribute or link arbitrary native Web Plugins. The current Console also has no `lenso.ui.contribution@1` or `lenso.web.shell@1` contract, so installing this crate does **not** add a Console navigation item. It serves an honest standalone `/projects` surface when a Host links and routes it. Console embedding remains a separate platform prerequisite.

## HTTP behavior

All errors use `application/problem+json`. Missing or invalid credentials produce `401`; a wrong actor kind produces `403`; private-team and missing resources use visibility-safe `404`; revision and idempotency conflicts produce `409`; invalid requests produce `400`. A Runtime Failure from Auth or Projects crosses the Endpoint boundary unchanged so Web Ingress can apply its infrastructure policy.

Static HTML, CSS, and JavaScript are embedded in the crate. The browser stores the organization and bearer credential only in its local storage; production Hosts should normally supply credentials through their own secure session ingress policy.

## Verification

```bash
/Users/leosouthey/Projects/framework/.lenso-tools/bin/lenso-cargo fmt --all -- --check
/Users/leosouthey/Projects/framework/.lenso-tools/bin/lenso-cargo check --locked --workspace --all-targets
/Users/leosouthey/Projects/framework/.lenso-tools/bin/lenso-cargo test --locked --workspace
/Users/leosouthey/Projects/framework/.lenso-tools/bin/lenso-cargo clippy --locked --workspace --all-targets -- -D warnings
./scripts/check-repository-boundary.sh
./scripts/check-public-packages.sh
```
