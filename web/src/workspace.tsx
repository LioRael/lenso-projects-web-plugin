import { useProjects } from "./transport";
import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { PageHeader } from "@lenso/ui/page-header";
import { IconButton } from "@lenso/ui/icon-button";
import { TextField } from "@lenso/ui/text-field";
import { TextArea } from "@lenso/ui/text-area";
import { Select } from "@lenso/ui/select";
import { Dialog } from "@lenso/ui/dialog";
import { RefreshCw, Plus, Folder, ChevronDown, Activity } from "lucide-react";
import {
  query,
  type Page,
  type Project,
  type Issue,
  type Team,
  type ProjectStatus,
  type TraceHandoff,
  type WorkflowState,
} from "./api";
import { Empty, Feedback } from "./shared";

export function Workspace({ org }: { org: string }) {
  const { api, openWorkspace, traceHandoff } = useProjects();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    setBusy(true);
    setError(undefined);
    api<Page<Project>>(
      `/api/projects?${query({ organization_id: org, include_archived: archived, limit: 50 })}`,
      { signal: controller.signal },
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        setProjects(page.items);
        setCursor(page.next_cursor);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, org, archived, refresh]);
  const activeProject =
    projects.find((project) => project.project_id === selected)?.project_id ??
    projects[0]?.project_id;
  async function more() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api<Page<Project>>(
        `/api/projects?${query({ organization_id: org, include_archived: archived, limit: 50, after: cursor })}`,
      );
      setProjects((p) => [...p, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoadingMore(false);
    }
  }
  if (!org)
    return (
      <div className="setup">
        <Empty
          title={traceHandoff ? "Choose where to create the trace issue" : "Open your workspace"}
          description={
            traceHandoff
              ? `Trace ${traceHandoff.trace_id.slice(0, 8)} is ready. Enter an organization, then choose a project.`
              : "Use the organization from your business App. Your signed-in account determines access."
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openWorkspace(String(new FormData(e.currentTarget).get("organization")).trim());
          }}
        >
          <TextField.Root style={{ maxWidth: "100%", minWidth: 0 }}>
            <TextField.Label>Organization</TextField.Label>
            <TextField.Control name="organization" required autoComplete="off" />
          </TextField.Root>
          <Button type="submit">Open workspace</Button>
        </form>
      </div>
    );
  return (
    <>
      <PageHeader.Root variant="simple">
        <PageHeader.Row style={{ minHeight: 44 }}>
          <PageHeader.Title style={{ fontSize: 14, fontWeight: 500 }}>Projects</PageHeader.Title>
          <PageHeader.Spacer />
          <PageHeader.Actions>
            <IconButton
              aria-label="Refresh projects"
              disabled={busy || loadingMore}
              variant="ghost"
              size="compact"
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw />
            </IconButton>
            <Button size="compact" onClick={() => setCreating(true)}>
              <Plus size={14} />
              New project
            </Button>
          </PageHeader.Actions>
        </PageHeader.Row>
      </PageHeader.Root>
      <div className="workspace-toolbar">
        <span className="muted">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
        <Button
          variant="ghost"
          size="compact"
          disabled={loadingMore}
          aria-pressed={archived}
          onClick={() => setArchived((v) => !v)}
        >
          Include archived
        </Button>
      </div>
      {error ? (
        <Feedback error={error} retry={() => setRefresh((n) => n + 1)} />
      ) : busy && !projects.length ? (
        <Empty title="Loading projects…" />
      ) : (
        <div className="workspace-columns">
          <section className="project-list" aria-label="Projects">
            {projects.map((p) => (
              <button
                type="button"
                key={p.project_id}
                className="project-row"
                aria-pressed={activeProject === p.project_id}
                onClick={() => setSelected(p.project_id)}
              >
                <Folder size={16} aria-hidden="true" />
                <span>
                  <strong>{p.name}</strong>
                  {p.summary && <span className="muted project-summary">{p.summary}</span>}
                </span>
              </button>
            ))}
            {!projects.length && (
              <Empty
                title="No projects"
                description="Create a project to organize your team's work."
              />
            )}
            {cursor && (
              <Button variant="ghost" loading={loadingMore} onClick={more}>
                Load more projects
              </Button>
            )}
          </section>
          <section className="project-content">
            {activeProject ? (
              <ProjectDetail
                key={`${activeProject}:${refresh}`}
                org={org}
                id={activeProject}
                trace={traceHandoff}
              />
            ) : null}
          </section>
        </div>
      )}
      <CreateProject
        org={org}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          setSelected(id);
          setRefresh((n) => n + 1);
        }}
      />
    </>
  );
}
function ProjectDetail({ org, id, trace }: { org: string; id: string; trace?: TraceHandoff }) {
  const { api, issueHref, openIssue } = useProjects();
  const [data, setData] = useState<{ project: Project; issues: Issue[] }>();
  const [error, setError] = useState<Error>();
  const [creatingIssue, setCreatingIssue] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      api<Project>(`/api/projects/${encodeURIComponent(id)}?${query({ organization_id: org })}`, {
        signal: c.signal,
      }),
      api<Page<Issue>>(
        `/api/projects/${encodeURIComponent(id)}/issues?${query({ organization_id: org, include_archived: false, limit: 50 })}`,
        { signal: c.signal },
      ),
    ])
      .then(([project, issues]) => setData({ project, issues: issues.items }))
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, org, id]);
  if (error) return <Feedback error={error} />;
  if (!data) return <Empty title="Loading project…" />;
  return (
    <>
      <div className="project-heading">
        <div>
          <h1>{data.project.name}</h1>
          {trace ? (
            <p className="trace-ready">
              <Activity size={14} aria-hidden="true" /> Trace {trace.trace_id.slice(0, 8)} ready
            </p>
          ) : null}
        </div>
        <Button size="compact" onClick={() => setCreatingIssue(true)}>
          <Plus size={14} aria-hidden="true" />
          {trace ? "Create issue from trace" : "New issue"}
        </Button>
      </div>
      {data.project.summary && <p className="issue-description">{data.project.summary}</p>}
      <h2 className="queue-title">
        Issues <span className="muted">{data.issues.length}</span>
      </h2>
      {data.issues.length ? (
        data.issues.map((i) => (
          <a key={i.issue_id} href={issueHref(org, i.issue_id)} className="issue-row">
            <span className="muted">{i.identifier}</span>
            <span>{i.title}</span>
          </a>
        ))
      ) : (
        <p className="muted">No issues yet.</p>
      )}
      <CreateIssue
        org={org}
        open={creatingIssue}
        onOpenChange={setCreatingIssue}
        project={data.project}
        trace={trace}
        onCreated={(issue) => openIssue(org, issue.issue_id)}
      />
    </>
  );
}

function CreateIssue({
  org,
  open,
  onOpenChange,
  onCreated,
  project,
  trace,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (issue: Issue) => void;
  project: Project;
  trace?: TraceHandoff;
}) {
  const { api } = useProjects();
  const pendingWrite = useRef<{ fields: string; payload: Record<string, unknown> } | null>(null);
  const [states, setStates] = useState<WorkflowState[]>();
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);
  const teamId = project.lead_team_id || project.team_ids?.[0] || "";
  useEffect(() => {
    if (!open || !teamId) return;
    const controller = new AbortController();
    setStates(undefined);
    setError(undefined);
    api<Page<WorkflowState>>(
      `/api/projects/catalog/workflow-states?${query({ organization_id: org, team_id: teamId, limit: 100 })}`,
      { signal: controller.signal },
    )
      .then((page) => {
        if (!controller.signal.aborted) setStates(page.items);
      })
      .catch((value) => {
        if (!controller.signal.aborted) setError(value as Error);
      });
    return () => controller.abort();
  }, [api, open, org, teamId]);
  async function submit(form: HTMLFormElement) {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    const values = Object.fromEntries(new FormData(form));
    const fields = JSON.stringify(values);
    if (!pendingWrite.current || pendingWrite.current.fields !== fields)
      pendingWrite.current = {
        fields,
        payload: {
          idempotency_key: crypto.randomUUID(),
          organization_id: org,
          issue_id: crypto.randomUUID(),
          project_id: project.project_id,
          team_id: teamId,
          title: values.title,
          description: values.description || null,
          priority: values.priority,
          workflow_state_id: values.workflow_state_id || null,
          cycle_id: null,
          milestone_id: null,
          parent_issue_id: null,
          label_ids: [],
        },
      };
    try {
      const issue = await api<Issue>(
        `/api/projects/${encodeURIComponent(project.project_id)}/issues`,
        { method: "POST", body: JSON.stringify(pendingWrite.current.payload) },
      );
      pendingWrite.current = null;
      onCreated(issue);
    } catch (value) {
      setError(value as Error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Dialog.Popup>
            <Dialog.Header>
              <div>
                <Dialog.Title>{trace ? "Create issue from trace" : "New issue"}</Dialog.Title>
                <Dialog.Description>
                  {trace
                    ? `Review the safe context from trace ${trace.trace_id.slice(0, 8)} before creating the issue.`
                    : `Add an issue to ${project.name}.`}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" disabled={saving} />
            </Dialog.Header>
            <form
              className="projects-workspace"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
            >
              <Dialog.Body>
                <div className="form-fields">
                  <TextField.Root style={{ maxWidth: "100%", minWidth: 0 }}>
                    <TextField.Label>Title</TextField.Label>
                    <TextField.Control
                      name="title"
                      required
                      maxLength={240}
                      defaultValue={traceTitle(trace)}
                    />
                  </TextField.Root>
                  <TextArea.Root>
                    <TextArea.Label>Description</TextArea.Label>
                    <TextArea.Control
                      name="description"
                      rows={8}
                      maxLength={16_000}
                      defaultValue={traceDescription(trace)}
                    />
                  </TextArea.Root>
                  <Choice
                    label="Priority"
                    name="priority"
                    items={["none", "urgent", "high", "medium", "low"].map((value) => ({
                      value,
                      label: value[0].toUpperCase() + value.slice(1),
                    }))}
                  />
                  {states ? (
                    <Choice
                      label="Workflow state"
                      name="workflow_state_id"
                      items={states.map((state) => ({ value: state.state_id, label: state.name }))}
                    />
                  ) : !error ? (
                    <p className="muted">Loading workflow states…</p>
                  ) : null}
                  {error ? <p role="alert">{error.message}</p> : null}
                  {!teamId ? <p role="status">This project has no lead team.</p> : null}
                  {states && !states.length ? (
                    <p role="status">Create a workflow state for this team first.</p>
                  ) : null}
                </div>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={!teamId || !states?.length}>
                  Create issue
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function traceTitle(trace?: TraceHandoff) {
  if (!trace) return "";
  const request = [trace.method, trace.route].filter(Boolean).join(" ");
  return `${trace.status_code && trace.status_code >= 500 ? "Investigate failed" : "Investigate"} ${request || "request"}`;
}

function traceDescription(trace?: TraceHandoff) {
  if (!trace) return "";
  return [
    "Created from an Observe trace.",
    "",
    `Source App: ${trace.source_id}`,
    `Trace ID: ${trace.trace_id}`,
    trace.method ? `Method: ${trace.method}` : null,
    trace.route ? `Route: ${trace.route}` : null,
    trace.status_code ? `Status: ${trace.status_code}` : null,
    trace.duration_nano ? `Duration: ${trace.duration_nano} ns` : null,
    trace.selected_span ? `Selected span: ${trace.selected_span}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
function Choice({
  label,
  name,
  items,
}: {
  label: string;
  name: string;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="field">
      <span id={`${name}-label`}>{label}</span>
      <Select.Root name={name} items={items} defaultValue={items[0]?.value} required>
        <Select.Trigger aria-labelledby={`${name}-label`}>
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={14} />
          </Select.Icon>
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
    </div>
  );
}
function CreateProject({
  org,
  open,
  onOpenChange,
  onCreated,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { api } = useProjects();
  const pendingWrite = useRef<{ fields: string; payload: Record<string, unknown> } | null>(null);
  const [catalog, setCatalog] = useState<{ teams: Team[]; statuses: ProjectStatus[] }>();
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    setCatalog(undefined);
    setError(undefined);
    Promise.all([
      api<Page<Team>>(
        `/api/projects/catalog/teams?${query({ organization_id: org, limit: 100 })}`,
        { signal: c.signal },
      ),
      api<Page<ProjectStatus>>(
        `/api/projects/catalog/project-statuses?${query({ organization_id: org, limit: 100 })}`,
        { signal: c.signal },
      ),
    ])
      .then(([teams, statuses]) => setCatalog({ teams: teams.items, statuses: statuses.items }))
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, org, open]);
  async function submit(form: HTMLFormElement) {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    const values = Object.fromEntries(new FormData(form));
    const id = crypto.randomUUID();
    const fields = JSON.stringify(values);
    if (!pendingWrite.current || pendingWrite.current.fields !== fields)
      pendingWrite.current = {
        fields,
        payload: {
          idempotency_key: crypto.randomUUID(),
          organization_id: org,
          project_id: id,
          name: values.name,
          summary: values.summary || null,
          lead_team_id: values.lead_team_id,
          team_ids: [values.lead_team_id],
          status_id: values.status_id,
          milestone_id: null,
          start_date: values.start_date || null,
          target_date: values.target_date || null,
        },
      };
    const payload = pendingWrite.current.payload;
    try {
      await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
      pendingWrite.current = null;
      onCreated(String(payload.project_id));
    } catch (e) {
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Dialog.Popup>
            <Dialog.Header>
              <div>
                <Dialog.Title>New project</Dialog.Title>
                <Dialog.Description>Organize issues around a shared outcome.</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" disabled={saving} />
            </Dialog.Header>
            <form
              className="projects-workspace"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget);
              }}
            >
              <Dialog.Body>
                <div className="form-fields">
                  <TextField.Root style={{ maxWidth: "100%", minWidth: 0 }}>
                    <TextField.Label>Name</TextField.Label>
                    <TextField.Control name="name" required maxLength={160} />
                  </TextField.Root>
                  <TextArea.Root>
                    <TextArea.Label>Summary</TextArea.Label>
                    <TextArea.Control name="summary" rows={3} maxLength={2000} />
                  </TextArea.Root>
                  {catalog ? (
                    <>
                      <Choice
                        label="Lead team"
                        name="lead_team_id"
                        items={catalog.teams.map((t) => ({ value: t.team_id, label: t.name }))}
                      />
                      <Choice
                        label="Status"
                        name="status_id"
                        items={catalog.statuses.map((t) => ({ value: t.status_id, label: t.name }))}
                      />
                    </>
                  ) : (
                    !error && <p className="muted">Loading teams and statuses…</p>
                  )}
                  <div className="date-fields">
                    <TextField.Root style={{ maxWidth: "100%", minWidth: 0 }}>
                      <TextField.Label>Start date</TextField.Label>
                      <TextField.Control name="start_date" type="date" />
                    </TextField.Root>
                    <TextField.Root style={{ maxWidth: "100%", minWidth: 0 }}>
                      <TextField.Label>Target date</TextField.Label>
                      <TextField.Control name="target_date" type="date" />
                    </TextField.Root>
                  </div>
                  {error && <p role="alert">{error.message}</p>}
                  {catalog && (!catalog.teams.length || !catalog.statuses.length) && (
                    <p role="status">
                      Create a team and project status in your business App first.
                    </p>
                  )}
                </div>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!catalog?.teams.length || !catalog.statuses.length}
                >
                  Create project
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
