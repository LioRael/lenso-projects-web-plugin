# Projects Web Plugin card

- **Job:** operate a Linear-like project and issue workflow through a removable Web surface.
- **Provides:** `lenso.http.endpoint@1` (`describe`, `handle`).
- **Requires:** exactly one each of `lenso.auth@1`, `lenso.projects@1`, `lenso.projects-collaboration@1`, `lenso.projects-admin@1`, and `lenso.organization-directory@1`. Assignment additionally uses one optional Host-selected `lenso.organization-membership-admin@1` reader.
- **Owns:** route descriptions, static page assets, typed HTTP decoding, authentication evidence selection, ActorAssertion forwarding, and intentional HTTP error representation.
- **Does not own:** projects, issues, comments, updates, catalogs, membership, authorization policy, visibility, revisions, idempotency, or persistence.
- **Success proof:** a real Kernel composition demonstrates that the target Projects Provider verifies the forwarded actor assertion.
- **Deletion proof:** a resolved Plan without `lenso.projects.web` still starts and invokes `lenso.projects@1` successfully.
- **Host boundary:** a native Host must link this crate and bind it to Web Ingress. It is not automatically installed by generic `lenso run`.
- **Console boundary:** this business Plugin serves authenticated Projects HTTP operations and builds a native UI module. This repository also owns `crates/lenso-projects-workspace-plugin`; the Console Host explicitly admits that separate contribution. The business crate does not self-register navigation. The contribution consumes the business package's embedded Workspace assets without copying them into Console.

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

## Issue editing and Console context

The page edits title, description, workflow state and priority through the existing
`update_issue` operation. The provider remains the authorization and revision
owner. Writes preserve labels and related record IDs, include the original
revision, and reuse an idempotency key only for an identical retry. A conflict
keeps the draft and requires reviewing the latest record before another save.

The optional Console page bridge supplies a visible Issue-reference draft when
opening a new mini Agent chat; it conveys no credential or authority and never
submits automatically. Completed mini Agent turns invalidate the displayed
record; active edits keep their original revision for conflict detection.
Visible pages also refresh on focus and every 15 seconds for external updates.

Assignment uses the additive Projects Collaboration 1.1 operations and the
same Issue revision. The optional Organization Membership Admin reader supplies
active members only after the authenticated actor can read this Issue. No
membership mutation is exposed. The Projects provider verifies the selected
member and private-Team visibility before assignment. Hosts without one bound
member reader keep other Projects functionality and show an explicit directory
unavailable state. Member display names fall back to stable subject identifiers
when the directory does not supply profile names.
