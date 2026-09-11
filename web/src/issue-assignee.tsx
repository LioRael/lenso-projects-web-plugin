import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { Select } from "@lenso/ui/select";
import { allPages, ApiError, query, type Issue, type Page } from "./api";
import { useProjects } from "./transport";
type Assignment = { assignee_subject: string | null; revision: string };
type Member = { subject: string; name: string };
export function IssueAssignee({
  issue,
  disabled,
  onSaved,
}: {
  issue: Issue;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { api } = useProjects();
  const [current, setCurrent] = useState<Assignment>();
  const [members, setMembers] = useState<Member[]>([]);
  const [selection, setSelection] = useState("");
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const dirty = useRef(false);
  const pending = useRef<{ fingerprint: string; body: string } | undefined>(undefined);
  const path = `/api/issues/${encodeURIComponent(issue.issue_id)}`;
  useEffect(() => {
    if (dirty.current) {
      if (current && String(current.revision) !== String(issue.revision))
        setError(new ApiError(409, "This issue changed."));
      return;
    }
    const c = new AbortController();
    setError(undefined);
    Promise.all([
      api<Assignment>(`${path}/assignee?${query({ organization_id: issue.organization_id })}`, {
        signal: c.signal,
      }),
      allPages(
        (after) =>
          api<Page<Member>>(
            `${path}/assignees?${query({ organization_id: issue.organization_id, after, limit: 100 })}`,
            { signal: c.signal },
          ),
        c.signal,
      ),
    ])
      .then(([value, list]) => {
        if (!c.signal.aborted) {
          setCurrent(value);
          setSelection(value.assignee_subject || "");
          setMembers(list);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, path, issue.organization_id, issue.revision, attempt]);
  const conflict = error instanceof ApiError && error.status === 409;
  async function save() {
    if (!current || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    const body = {
      organization_id: issue.organization_id,
      issue_id: issue.issue_id,
      assignee_subject: selection || null,
      expected_revision: current.revision,
    };
    const fingerprint = JSON.stringify(body);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = {
        fingerprint,
        body: JSON.stringify({ ...body, idempotency_key: crypto.randomUUID() }),
      };
    try {
      const result = await api<Assignment>(`${path}/assignee`, {
        method: "PATCH",
        body: pending.current.body,
      });
      dirty.current = false;
      setCurrent(result);
      onSaved();
    } catch (e) {
      setError(e as Error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const items = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({ value: m.subject, label: m.name })),
  ];
  if (current?.assignee_subject && !items.some((i) => i.value === current.assignee_subject))
    items.push({ value: current.assignee_subject, label: "Previous member" });
  return (
    <div className="issue-assignee">
      <label id="assignee-label">Assignee</label>
      {current && (
        <Select.Root
          items={items}
          value={selection}
          onValueChange={(v) => {
            dirty.current = (v || "") !== (current.assignee_subject || "");
            setSelection(v || "");
          }}
          disabled={disabled || busy || conflict}
        >
          <Select.Trigger aria-labelledby="assignee-label">
            <Select.Value />
            <Select.Icon />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List>
                  {items.map((i) => (
                    <Select.Item key={i.value} value={i.value}>
                      <Select.ItemText>{i.label}</Select.ItemText>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      )}
      {current && selection !== (current.assignee_subject || "") && (
        <Button
          size="compact"
          disabled={disabled || conflict}
          loading={busy}
          onClick={() => void save()}
        >
          Save assignee
        </Button>
      )}
      {error && (
        <p role="alert">
          {conflict
            ? "This issue changed. Reload the assignee before choosing again."
            : error.message}
        </p>
      )}
      {error && (
        <Button
          size="compact"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            dirty.current = false;
            setAttempt((n) => n + 1);
          }}
        >
          Reload assignee
        </Button>
      )}
    </div>
  );
}
