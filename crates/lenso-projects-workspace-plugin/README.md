# Projects Workspace

This removable linked Plugin is owned by Projects Web. Its package name is
`lenso-projects-workspace-plugin`; its stable Plugin ID remains
`lenso.console.workspace.projects`. It contributes the Projects UI and the
owner-scoped `projects` Workspace service.

Native mode binds exactly one Projects Web endpoint and omits `origin`. External
mode configures an explicit `origin` and binds no native endpoint. Console App
owns the choice and default activation; this package does not start a Host.

The configured origin is frozen into the resolved Plugin configuration. Only HTTPS
or loopback HTTP origins are accepted, without credentials, query, path or fragment.
The browser cannot choose another destination. Removing this Plugin removes its UI
and service together; a new Generation starts with no business grant.

## Business authority

`begin_connection` starts the existing business App consent flow. A local opaque
attempt ID and same-origin authorization URL can reach the browser; the polling
secret cannot. `poll_connection` acquires an expiring, Account-owned delegated grant
and keeps it in memory. Account changes are serialized with requests. `disconnect`
drops local authority. Parent session revocation is enforced by the business App;
a 401 drops the cached grant. No automatic mutation retry is performed.

Business requests use a fixed operation/endpoint mapping, bounded bodies and replies,
a 20-second timeout and no redirects. JSON writes include the configured App Origin,
so Hosts mapping bearer evidence to the session scheme retain the existing origin
check. The Console Workspace endpoint requires JSON and does not enable CORS.

The business App must explicitly consent to the exact operations consumed here:
`lenso.projects@1` list/get/create project, list/get/create issue and list activity;
`lenso.projects-admin@1` list teams, project statuses and workflow states.
App membership and record authorization remain authoritative. This connection is
separate from the Agent's business connection; it does not reuse browser cookies or
copy another Agent's credentials. Console is a local, single-user Host.

## Local service protocol

The Console-local domain metadata is `lenso.projects.workspace@1`, descriptor
`1.0.0`. It is a fixed adapter protocol, not a new implementation of the public
Projects or Auth Capabilities. All operations are request/response JSON:

| Operation | Request | Response |
| --- | --- | --- |
| `connection_status`, `disconnect` | `{}` | `{connected, label, subject}` |
| `begin_connection` | `{}` | `{attempt_id, authorization_url}` |
| `poll_connection` | `{attempt_id}` | `{connected, label, subject}` |
| `list_projects` | organization and pagination | `{status, body}` |
| `get_project`, `list_issues` | organization, project ID, pagination where applicable | `{status, body}` |
| `get_issue`, `list_activity` | organization, issue ID, pagination where applicable | `{status, body}` |
| `list_teams`, `list_project_statuses`, `list_workflow_states` | organization, team filter where applicable, pagination | `{status, body}` |
| `create_project` | Existing Projects `CreateProjectRequest` | `{status, body}` |
| `create_issue` | Existing Projects `CreateIssueRequest` | `{status, body}` |

Requests reject destination/credential/actor overrides. Bodies retain existing
business contract field names. The browser does not send capability IDs, provider
instance keys, arbitrary URLs, headers or methods. The service export and UI
requirement lists are derived from one operation table.

## UI provenance

The React source lives in this repository's `web` directory. Build it with
`npm run build --prefix web`. `lenso-projects-web-plugin::workspace_assets`
exports the committed module and styles; the contribution uses those constants
directly. There is no second asset directory or Console-side copy script.
The module receives the Host's React runtime, theme and optional sidebar slot.
It does not create another React root or application Shell.

The public business Web crate remains registry-publishable. This adapter stays
`publish = false` while Contribution and Workspace Service contracts are pinned
Git dependencies. Those dependencies select only contract crates, never the
Console implementation. Registry publication requires publishing the shared
contracts first.

Validation includes Plugin unit tests, Host admission, compiled Workspace browser tests in
Projects Web, and real Auth/Projects/Console acceptance in the Agent repository's
`scripts/projects-acceptance/console-browser.mjs`. The live acceptance uses disposable
accounts and Postgres, no intercepted business responses and no model calls.


## Plugin card

- **Owns:** contribution metadata, native/external service adaptation, and external
  delegated connection state. Business assets have one owner in Projects Web.
- **Provides:** `lenso.ui.contribution@1` and `lenso.ui.workspace-service@1`.
- **Requires:** zero or one Plan-bound `lenso.http.endpoint@1`; lifecycle admission
  requires exactly one in native mode and none in external mode.
- **Configuration:** optional fixed `origin`; no browser-selected provider.
- **Lifecycle:** fresh connection state per Generation, bounded operations and
  cancellation inherited from InvocationContext. No persistent business store.
- **Authorization:** native calls retain InvocationContext; the bound Web and
  business providers authenticate and authorize. External grants remain in memory.
- **Removal:** removes its page and mount-scoped services; business records remain
  with Projects. No Shell or Kernel changes are needed to remove the instance.
- **Implementation:** linked Rust only; portable implementations are not claimed.
- **Proof:** owner tests preserve fixed destinations and credential handling;
  Console integration serves these exact bytes, invokes the owner service, removes
  the Plugin, and restarts successfully.
