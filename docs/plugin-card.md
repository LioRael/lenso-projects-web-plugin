# Projects Web Plugin card

- **Job:** operate a Linear-like project and issue workflow through a removable Web surface.
- **Provides:** `lenso.http.endpoint@1` (`describe`, `handle`).
- **Requires:** exactly one each of `lenso.auth@1`, `lenso.projects@1`, `lenso.projects-collaboration@1`, and `lenso.projects-admin@1`.
- **Owns:** route descriptions, static page assets, typed HTTP decoding, authentication evidence selection, ActorAssertion forwarding, and intentional HTTP error representation.
- **Does not own:** projects, issues, comments, updates, catalogs, membership, authorization policy, visibility, revisions, idempotency, or persistence.
- **Success proof:** a real Kernel composition demonstrates that the target Projects Provider verifies the forwarded actor assertion.
- **Deletion proof:** a resolved Plan without `lenso.projects.web` still starts and invokes `lenso.projects@1` successfully.
- **Host boundary:** a native Host must link this crate and bind it to Web Ingress. It is not automatically installed by generic `lenso run`.
- **Console boundary:** the current Console has no UI-contribution contract; this Plugin therefore serves `/projects` but cannot truthfully self-register Console navigation.
