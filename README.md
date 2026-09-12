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

The generic `lenso run` flow does not distribute arbitrary native Web Plugins. The
business Host links this Plugin for its authenticated HTTP operations. The Console
Host can additionally admit `lenso.console.workspace.projects`, which owns the
`projects` native Workspace contribution and a fixed-operation business adapter.
Installing this business crate alone does not add Console navigation.

## HTTP behavior

All errors use `application/problem+json`. Missing or invalid credentials produce `401`; a wrong actor kind produces `403`; private-team and missing resources use visibility-safe `404`; revision and idempotency conflicts produce `409`; invalid requests produce `400`. A Runtime Failure from Auth or Projects crosses the Endpoint boundary unchanged so Web Ingress can apply its infrastructure policy.

Static HTML, CSS, and JavaScript are embedded in the crate. The browser uses the App's existing HttpOnly session cookie; no bearer credential
is entered or stored by the page. Hosts must select that cookie as `session`
evidence and forward the Origin header. Configure `origin` to the exact App
origin for session-authenticated mutations; missing or mismatched origins fail
closed. Other credential schemes preserve their existing protocol behavior.
Only the selected organization is remembered locally.

Issue links use `/projects?organization_id=ORG&issue=STABLE_ID`. The page loads
the Issue and its paginated activity through authenticated endpoints. Expired
browser login offers `/login?return_to=...`; the App owns that login route and
must validate the same-origin return path. An explicitly external Console Workspace obtains a separate, short-lived delegated grant through business App consent. A same-process Workspace instead forwards its request-scoped signed assertion through the bound endpoint.

## Verification

```bash
cargo fmt --all -- --check
cargo check --locked --workspace --all-targets
cargo test --locked --workspace
cargo clippy --locked --workspace --all-targets -- -D warnings
./scripts/check-repository-boundary.sh
./scripts/check-public-packages.sh
```

## Shared Lenso UI

`web/` is the React source for this Plugin's browser surface. It consumes the
same `@lenso/ui@0.5.0`, `@lenso/tokens@0.5.0`, and IBM Plex control font as Console.
PageHeader, Breadcrumb, DescriptionList, Disclosure, Button, IconButton,
ContentState, Dialog, TextField, TextArea, and Select are package components.
`web/src/layout.css` owns only the Projects composition and responsive layout;
all colors, radii, spacing primitives and interaction treatments use shared tokens.

```sh
npm ci --prefix web
npm run build --prefix web
npm test --prefix web
```

The build emits the committed standalone `src/assets/app.*` and native `src/workspace/workspace.{js,css}` files. Fonts and runtime
dependencies are bundled, so the browser makes no CDN requests and Rust consumers
need no Node runtime. CI rebuilds and checks these exact assets before testing the
Plugin. Run `npm run check:assets --prefix web` to check freshness locally. Browser
tests use controlled HTTP fixtures; real session/Tool acceptance remains in the
Agent repository's `scripts/projects-acceptance/browser.mjs`.

System appearance is resolved before passing the theme to `ThemeScope`, including
its portal host. In Console, the native module follows the supplied environment and uses Console navigation. Issue
activity and record IDs use shared Disclosure components; pagination, HTTP errors,
session login return, project creation and server authority are preserved.

## Open inside Console

Build this repository, then from the Console checkout run:

```sh
node scripts/import-projects-workspace.mjs /path/to/lenso-projects-web-plugin
LENSO_CONSOLE_PROJECTS_ORIGIN=http://127.0.0.1:55440 cargo run --locked --manifest-path service/Cargo.toml --bin lenso-console-with-agent
```

This source command requires the Agent binaries on PATH (or configured through
`LENSO_AGENT_WEB_BIN` and `LENSO_CONSOLE_AGENT_WEB_BIN`). It does not imply that the
currently published npm package already includes this change.

The native module renders only Projects content in the real Console Shell. The
primary rail, context sidebar, theme, footer and mini agent remain Console-owned.
`createWorkspace(runtime)` uses Console's React singleton and declared service
operations. There is no iframe, additional application shell, CDN, arbitrary proxy,
or credential passed to JavaScript. The minimal `/projects` page remains a business
App login/deep-link fallback without a duplicate sidebar.

The business App must route the existing Projects Web operations and consent to
their exact audiences. Credentials remain generation-local in the Console Workspace
Plugin and expire after at most one hour; restart or expiration requires reconnecting.
The separate Agent business connection is not silently shared with this Workspace.

Real Console, business login, project creation and permission checks are exercised
by the Agent repository's `scripts/projects-acceptance/console-browser.mjs`.

### Workspace discovery (source integration)

The Console entry lists the authenticated user's active memberships through
`/api/projects/workspaces`; one workspace opens automatically, and **Switch
workspace** returns to the selector. Organization IDs are not user input.

This change requires Organization Directory descriptor 1.1.0 and its matching
PostgreSQL provider, currently tested from source. Until that dependency is
published, validate with `lenso-cargo test --config
'patch.crates-io.lenso-capability-organization-directory.path="/absolute/path/to/organization/crates/lenso-capability-organization-directory"'`.
The consuming App must bind the directory Port and allow its Projects Web
instance as a directory caller. No Organization Admin permission is needed.

## Same-process Console invocation

A bound Console Workspace may call this endpoint without a second HTTP hop or
credential. Set `invocation_auth_issuer` and `invocation_auth_public_key` together
to opt into verification of sealed invocation assertions. The assertion must
cover `lenso.http.endpoint@1:handle`, have a valid signature and lifetime, and
represent a user. Missing or invalid assertions fail closed. The Projects
capabilities still independently check their own operation audiences and
business permissions. Browser JSON and headers cannot provide this assertion.

`GET /api/projects/session` returns only the authenticated subject for the
Workspace connection state. It does not create a session or grant access to
records. Normal browser cookie/Bearer authentication retains the existing Auth
binding and exact-Origin behavior.

### Console navigation

The optional `chrome.Sidebar` component supplied by Console renders plugin-owned
navigation inside the existing context sidebar. Projects retains its Transport
provider across that portal; Console owns placement and fallback restoration.
Older hosts continue to use the page-header workspace menu.

Workspace menus list authenticated memberships. Team navigation is scoped to the
selected organization and loads the authorized team catalog. Team issue lists use
`GET /api/teams/{team_id}/issues` with cursor pagination; the endpoint forwards the
original invocation context to Projects and never assembles a partial team list
from project results. The Console service operation is `list_team_issues`.
