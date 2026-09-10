# Projects Web Plugin card

- **Job:** operate a Linear-like project and issue workflow through a removable Web surface.
- **Provides:** `lenso.http.endpoint@1` (`describe`, `handle`).
- **Requires:** exactly one each of `lenso.auth@1`, `lenso.projects@1`, `lenso.projects-collaboration@1`, and `lenso.projects-admin@1`.
- **Owns:** route descriptions, static page assets, typed HTTP decoding, authentication evidence selection, ActorAssertion forwarding, and intentional HTTP error representation.
- **Does not own:** projects, issues, comments, updates, catalogs, membership, authorization policy, visibility, revisions, idempotency, or persistence.
- **Success proof:** a real Kernel composition demonstrates that the target Projects Provider verifies the forwarded actor assertion.
- **Deletion proof:** a resolved Plan without `lenso.projects.web` still starts and invokes `lenso.projects@1` successfully.
- **Host boundary:** a native Host must link this crate and bind it to Web Ingress. It is not automatically installed by generic `lenso run`.
- **Console boundary:** this business Plugin serves authenticated Projects HTTP operations and builds a native UI module. The Console Host explicitly admits the separate Projects Workspace contribution; the business crate does not self-register navigation.

## Browser account and Issue recovery

The browser delegates authentication to Host-selected session evidence. It stores
no credential. Optional `origin` configuration gates session-authenticated writes
with a single exact Origin; missing or mismatched evidence is rejected. Read-only
Issue links carry organization and stable Issue identity, not authority. The
Projects capability supplies activity and workflow facts; this Plugin does not
infer updates or duplicate their storage.

## UI ownership

The browser implementation consumes public Lenso UI packages, not Console
private components. Projects owns the page composition and request state; Lenso UI
owns reusable controls and tokens. Compiled assets remain part of this removable
Plugin. No new capabilities, persistence, Host routes, or authorization policy
are introduced by adopting React. The existing add/remove proof still applies.
