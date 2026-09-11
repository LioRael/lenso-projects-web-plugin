import { canKeepResults } from "./api";
import { useProjects } from "./transport";
import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { WorkspaceHeader } from "./workspace-header";
import { IconButton } from "@lenso/ui/icon-button";
import { TextField } from "@lenso/ui/text-field";
import { TextArea } from "@lenso/ui/text-area";
import { Select } from "@lenso/ui/select";
import { Dialog } from "@lenso/ui/dialog";
import {
  RefreshCw,
  Plus,
  Folder,
  ChevronDown,
  Activity,
  Circle,
  Search,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import {
  allPages,
  query,
  shortDate,
  type Page,
  type Project,
  type Issue,
  type Team,
  type ProjectStatus,
  type TraceHandoff,
  type WorkflowState,
} from "./api";
import { WorkspacePicker } from "./workspace-picker";
import { Empty, Feedback, RefreshNotice } from "./shared";

function savedListView(org: string): { search: string; archived: boolean } {
  try {
    const value = JSON.parse(sessionStorage.getItem(`projects:list:${org}`) || "null");
    return {
      search: typeof value?.search === "string" ? value.search : "",
      archived: value?.archived === true,
    };
  } catch {
    return { search: "", archived: false };
  }
}
export function Workspace({ org }: { org: string }) {
  const { api, openWorkspace, openProject, traceHandoff } = useProjects();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(() => savedListView(org).archived);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(() => savedListView(org).search);
  useEffect(() => {
    if (!org) return;
    try {
      sessionStorage.setItem(`projects:list:${org}`, JSON.stringify({ search, archived }));
    } catch {
      /* Storage is optional; navigation remains usable. */
    }
  }, [org, search, archived]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  useEffect(() => {
    if (!org) return;
    const c = new AbortController();
    api<Page<ProjectStatus>>(
      `/api/projects/catalog/project-statuses?${query({ organization_id: org, limit: 100 })}`,
      { signal: c.signal },
    )
      .then((p) => {
        if (!c.signal.aborted) setStatuses(p.items);
      })
      .catch(() => {});
    return () => c.abort();
  }, [api, org]);
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
  const visibleProjects = projects.filter((p) =>
    `${p.name} ${p.summary || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function more() {
    if (busy || loadingMore || !cursor) return;
    setLoadingMore(true);
    setError(undefined);
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
  if (!org) return <WorkspacePicker autoEnter onChoose={openWorkspace} />;
  return (
    <>
      <WorkspaceHeader
        org={org}
        actions={
          <>
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
          </>
        }
      >
        Projects
      </WorkspaceHeader>
      {traceHandoff ? (
        <p className="trace-ready">
          <Activity size={14} aria-hidden="true" /> Trace {traceHandoff.trace_id.slice(0, 8)} is
          ready. Open a project to create its issue.
        </p>
      ) : null}
      <div className="workspace-toolbar">
        <label className="project-search">
          <Search size={14} />
          <input
            aria-label="Search projects"
            placeholder={cursor ? "Search loaded projects…" : "Search projects…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted">
          {search ? `${visibleProjects.length} of ` : ""}
          {projects.length}
          {cursor ? "+" : ""} {projects.length === 1 ? "project" : "projects"}
        </span>
        <Button
          variant="ghost"
          size="compact"
          disabled={busy || loadingMore}
          aria-pressed={archived}
          onClick={() => setArchived((v) => !v)}
        >
          Include archived
        </Button>
      </div>
      {error && canKeepResults(error) && projects.length > 0 && (
        <RefreshNotice error={error} retry={() => setRefresh((n) => n + 1)} />
      )}
      {error && (!canKeepResults(error) || !projects.length) ? (
        <Feedback error={error} retry={() => setRefresh((n) => n + 1)} />
      ) : busy && !projects.length ? (
        <Empty title="Loading projects…" />
      ) : (
        <ProjectList
          {...{ projects, visibleProjects, statuses, org, cursor, busy, loadingMore, more }}
        />
      )}
      <CreateProject
        org={org}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          openProject(org, id);
        }}
      />
    </>
  );
}
function ProjectList({
  projects,
  visibleProjects,
  statuses,
  org,
  cursor,
  busy,
  loadingMore,
  more,
}: {
  projects: Project[];
  visibleProjects: Project[];
  statuses: ProjectStatus[];
  org: string;
  cursor?: string | null;
  busy: boolean;
  loadingMore: boolean;
  more: () => void;
}) {
  const { projectHref } = useProjects();
  return (
    <section className="projects-table" aria-label="Projects" aria-busy={busy || loadingMore}>
      <div className="projects-table-head">
        <span>Name</span>
        <span>Status</span>
        <span>Target date</span>
      </div>
      {visibleProjects.map((p) => (
        <a key={p.project_id} className="project-table-row" href={projectHref(org, p.project_id)}>
          <span className="project-name">
            <Folder size={15} />
            <strong>{p.name}</strong>
          </span>
          <span className="table-status">
            <Circle size={12} />
            {p.archived
              ? "Archived"
              : statuses.find((s) => s.status_id === p.status_id)?.name || "—"}
          </span>
          <span className="muted">{p.target_date ? shortDate(p.target_date) : "—"}</span>
        </a>
      ))}
      {!projects.length && (
        <Empty title="No projects" description="Create a project to organize your team's work." />
      )}
      {!!projects.length && !visibleProjects.length && (
        <Empty title="No matching projects" description="Try another name or summary." />
      )}
      {cursor && (
        <Button variant="ghost" loading={loadingMore} onClick={more}>
          Load more projects
        </Button>
      )}
    </section>
  );
}
export function ProjectDetail({
  org,
  id,
  view = "overview",
}: {
  org: string;
  id: string;
  view?: string;
}) {
  const { api, workspaceHref, projectHref, openIssue, traceHandoff } = useProjects();
  const [data, setData] = useState<{
    project: Project;
    issues: Issue[];
    next?: string | null;
    statuses: ProjectStatus[];
  }>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [creatingIssue, setCreatingIssue] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setError(undefined);
    setBusy(true);
    Promise.all([
      api<Project>(`/api/projects/${encodeURIComponent(id)}?${query({ organization_id: org })}`, {
        signal: c.signal,
      }),
      api<Page<Issue>>(
        `/api/projects/${encodeURIComponent(id)}/issues?${query({ organization_id: org, include_archived: false, limit: 50 })}`,
        { signal: c.signal },
      ),
      api<Page<ProjectStatus>>(
        `/api/projects/catalog/project-statuses?${query({ organization_id: org, limit: 100 })}`,
        { signal: c.signal },
      ).catch(() => ({ items: [] })),
    ])
      .then(([project, issues, statuses]) => {
        if (!c.signal.aborted) {
          setData({
            project,
            issues: issues.items,
            next: issues.next_cursor,
            statuses: statuses.items,
          });
          document.title = `${project.name} · Projects`;
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [api, org, id, refresh]);
  async function more() {
    if (!data?.next || loadingMore || busy) return;
    setLoadingMore(true);
    setError(undefined);
    try {
      const page = await api<Page<Issue>>(
        `/api/projects/${encodeURIComponent(id)}/issues?${query({ organization_id: org, include_archived: false, limit: 50, after: data.next })}`,
      );
      setData((d) =>
        d ? { ...d, issues: [...d.issues, ...page.items], next: page.next_cursor } : d,
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoadingMore(false);
    }
  }
  return (
    <>
      <WorkspaceHeader
        org={org}
        views={
          <>
            <a href={projectHref(org, id)} aria-current={view === "overview" ? "page" : undefined}>
              Overview
            </a>
            <a
              href={projectHref(org, id, "issues")}
              aria-current={view === "issues" ? "page" : undefined}
            >
              Issues
            </a>
          </>
        }
        actions={
          <>
            {data ? (
              <Button size="compact" onClick={() => setCreatingIssue(true)}>
                <Plus size={14} aria-hidden="true" />
                {traceHandoff ? "Create issue from trace" : "New issue"}
              </Button>
            ) : null}
            <IconButton
              aria-label="Refresh project"
              disabled={busy || loadingMore}
              variant="ghost"
              size="compact"
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw />
            </IconButton>
          </>
        }
      >
        <a href={workspaceHref(org)}>Projects</a>
        <ChevronRight size={12} />
        <span className="workspace-header-name">{data?.project.name || "Project"}</span>
      </WorkspaceHeader>
      {error && canKeepResults(error) && data && (
        <RefreshNotice error={error} retry={() => setRefresh((n) => n + 1)} />
      )}
      {error && (!canKeepResults(error) || !data) ? (
        <Feedback error={error} retry={() => setRefresh((n) => n + 1)} />
      ) : !data ? (
        <Empty title="Loading project…" />
      ) : view === "issues" ? (
        <ProjectIssues {...{ data, org, id, loadingMore, more }} />
      ) : (
        <ProjectOverview org={org} id={id} data={data} />
      )}
      {data ? (
        <CreateIssue
          org={org}
          open={creatingIssue}
          onOpenChange={setCreatingIssue}
          project={data.project}
          trace={traceHandoff}
          onCreated={(issue) => openIssue(org, issue.issue_id, id)}
        />
      ) : null}
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
function ProjectIssues({
  data,
  org,
  id,
  loadingMore,
  more,
}: {
  data: { issues: Issue[]; next?: string | null };
  org: string;
  id: string;
  loadingMore: boolean;
  more: () => void;
}) {
  const { issueHref } = useProjects();
  return (
    <section aria-label="Project issues">
      <div className="issue-group-heading">
        Issues{" "}
        <span className="muted">
          {data.issues.length}
          {data.next ? "+" : ""}
        </span>
      </div>
      {data.issues.map((i) => (
        <a key={i.issue_id} href={issueHref(org, i.issue_id, id)} className="issue-table-row">
          <Circle size={14} />
          <span className="muted">{i.identifier}</span>
          <span>{i.title}</span>
        </a>
      ))}
      {!data.issues.length && <Empty title="No issues yet" />}
      {data.next && (
        <Button loading={loadingMore} variant="ghost" onClick={more}>
          Load more issues
        </Button>
      )}
    </section>
  );
}
function ProjectOverview({
  org,
  id,
  data,
}: {
  org: string;
  id: string;
  data: { project: Project; issues: Issue[]; next?: string | null; statuses: ProjectStatus[] };
}) {
  const { projectHref } = useProjects();
  return (
    <article className="project-overview">
      <Folder className="project-emblem" size={26} />
      <h1>{data.project.name}</h1>
      {data.project.summary && <p className="project-lede">{data.project.summary}</p>}
      <div className="project-metadata">
        <span className="muted">Properties</span>
        <span>
          <Circle size={13} />
          {data.project.archived
            ? "Archived"
            : data.statuses.find((s) => s.status_id === data.project.status_id)?.name ||
              "Status unavailable"}
        </span>
        {data.project.target_date && (
          <span>
            <CalendarDays size={13} />
            {shortDate(data.project.target_date)}
          </span>
        )}
      </div>
      <div className="project-overview-section">
        <h2>Issues</h2>
        <a className="project-issues-link" href={projectHref(org, id, "issues")}>
          <span>View project issues</span>
          <span className="muted">
            {data.issues.length}
            {data.next ? "+" : ""}
          </span>
          <ChevronRight size={14} />
        </a>
      </div>
    </article>
  );
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
  const submitting = useRef(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [catalog, setCatalog] = useState<{ teams: Team[]; statuses: ProjectStatus[] }>();
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    setCatalog(undefined);
    setError(undefined);
    Promise.all([
      allPages<Team>(
        (after) =>
          api<Page<Team>>(
            `/api/projects/catalog/teams?${query({ organization_id: org, limit: 100, after })}`,
            { signal: c.signal },
          ),
        c.signal,
      ),
      allPages<ProjectStatus>(
        (after) =>
          api<Page<ProjectStatus>>(
            `/api/projects/catalog/project-statuses?${query({ organization_id: org, limit: 100, after })}`,
            { signal: c.signal },
          ),
        c.signal,
      ),
    ])
      .then(([teams, statuses]) => {
        if (!c.signal.aborted) setCatalog({ teams, statuses });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, org, open, catalogAttempt]);
  async function submit(form: HTMLFormElement) {
    if (submitting.current) return;
    setError(undefined);
    const values = Object.fromEntries(new FormData(form));
    values.name = String(values.name || "").trim();
    if (!values.name) {
      setError(new Error("Enter a project name."));
      form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
      return;
    }
    if (values.start_date && values.target_date && values.target_date < values.start_date) {
      setError(new Error("Target date must be on or after the start date."));
      form.querySelector<HTMLInputElement>('[name="target_date"]')?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
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
      submitting.current = false;
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
                <fieldset disabled={saving} className="form-fields">
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
                  {error && !catalog && (
                    <Button variant="ghost" onClick={() => setCatalogAttempt((n) => n + 1)}>
                      Retry teams and statuses
                    </Button>
                  )}
                  {catalog && (!catalog.teams.length || !catalog.statuses.length) && (
                    <p role="status">
                      Create a team and project status in your business App first.
                    </p>
                  )}
                </fieldset>
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
