import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { TextField } from "@lenso/ui/text-field";
import { TextArea } from "@lenso/ui/text-area";
import {
  ApiError,
  allPages,
  displayName,
  query,
  type Issue,
  type Page,
  type WorkflowState,
} from "./api";
import { useProjects } from "./transport";

export function IssueEditor({
  issue,
  onSaved,
  onCancel,
}: {
  issue: Issue;
  onSaved: (issue: Issue) => void;
  onCancel: () => void;
}) {
  const { api } = useProjects();
  const [base, setBase] = useState(issue);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description || "");
  const [priority, setPriority] = useState(issue.priority);
  const [state, setState] = useState(issue.workflow_state_id);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [catalogError, setCatalogError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const lock = useRef(false);
  const retry = useRef<{ body: string; key: string } | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(undefined);
    allPages(
      (after) =>
        api<Page<WorkflowState>>(
          `/api/projects/catalog/workflow-states?${query({ organization_id: issue.organization_id, team_id: issue.team_id, limit: 100, after })}`,
          { signal: controller.signal },
        ),
      controller.signal,
    )
      .then((values) =>
        setStates(
          values.filter((value) => !value.archived || value.state_id === issue.workflow_state_id),
        ),
      )
      .catch((e) => {
        if (!controller.signal.aborted) setCatalogError(e.message);
      });
    return () => controller.abort();
  }, [api, issue.organization_id, issue.team_id, attempt]);
  async function save() {
    if (lock.current) return;
    if (!title.trim()) {
      setError(new Error("Enter an issue title."));
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(undefined);
    const body = JSON.stringify({
      organization_id: base.organization_id,
      issue_id: base.issue_id,
      expected_revision: String(base.revision),
      title: title.trim(),
      description: description || null,
      priority,
      workflow_state_id: state,
      label_ids: base.label_ids || [],
      cycle_id: base.cycle_id ?? null,
      milestone_id: base.milestone_id ?? null,
      parent_issue_id: base.parent_issue_id ?? null,
    });
    if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
    try {
      const result = await api<Issue>(`/api/issues/${encodeURIComponent(base.issue_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...JSON.parse(body), idempotency_key: retry.current.key }),
      });
      onSaved(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const conflict = error instanceof ApiError && error.status === 409;
  async function reviewLatest() {
    setReviewing(true);
    try {
      const latest = await api<Issue>(
        `/api/issues/${encodeURIComponent(base.issue_id)}?${query({ organization_id: base.organization_id })}`,
      );
      setBase(latest);
      retry.current = undefined;
      setError(
        new Error(
          "Latest version loaded below. Your draft is unchanged. Review it before saving again.",
        ),
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setReviewing(false);
    }
  }
  return (
    <form
      className="issue-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={saving || reviewing}>
        <TextField.Root>
          <TextField.Label>Title</TextField.Label>
          <TextField.Control
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </TextField.Root>
        <TextArea.Root>
          <TextArea.Label>Description</TextArea.Label>
          <TextArea.Control
            rows={7}
            maxLength={20000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </TextArea.Root>
        <div className="issue-edit-properties">
          <label>
            Status
            <select aria-label="Status" value={state} onChange={(e) => setState(e.target.value)}>
              <option value={base.workflow_state_id}>
                {states.find((s) => s.state_id === base.workflow_state_id)?.name ||
                  "Current status"}
              </option>
              {states
                .filter((s) => s.state_id !== base.workflow_state_id)
                .map((s) => (
                  <option key={s.state_id} value={s.state_id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {["none", "urgent", "high", "medium", "low"].map((p) => (
                <option key={p} value={p}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {catalogError && (
          <p role="alert">
            {catalogError}{" "}
            <Button variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
              Retry statuses
            </Button>
          </p>
        )}
        {error && (
          <p role="alert">
            {conflict
              ? "This issue changed since you started editing. Your draft has been kept."
              : error.message}
          </p>
        )}
        {conflict && (
          <Button variant="secondary" onClick={() => void reviewLatest()}>
            Review latest version
          </Button>
        )}
        {base.revision !== issue.revision && (
          <details open>
            <summary>Latest saved version</summary>
            <p>{base.title}</p>
            <p>{base.description || "No description."}</p>
            <p>
              {displayName(base.priority)} ·{" "}
              {states.find((s) => s.state_id === base.workflow_state_id)?.name ||
                base.workflow_state_id}
            </p>
          </details>
        )}
        <div className="issue-edit-actions">
          <Button type="submit" size="compact" disabled={conflict} loading={saving}>
            Save changes
          </Button>
          <Button size="compact" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
