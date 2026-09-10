import { useProjects } from "./transport";
import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { PageHeader } from "@lenso/ui/page-header";
import { IconButton } from "@lenso/ui/icon-button";
import { TextField } from "@lenso/ui/text-field";
import { TextArea } from "@lenso/ui/text-area";
import { Select } from "@lenso/ui/select";
import { Dialog } from "@lenso/ui/dialog";
import { RefreshCw, Plus, Folder, ChevronDown } from "lucide-react";
import { query, type Page, type Project, type Issue, type Team, type ProjectStatus } from "./api";
import { Empty, Feedback } from "./shared";

export function Workspace({ org }: { org: string }) {
  const { api, openWorkspace } = useProjects();
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
          title="Open your workspace"
          description="Use the organization from your business App. Your signed-in account determines access."
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
        <PageHeader.Row>
          <PageHeader.Title>Projects</PageHeader.Title>
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
        <span className="muted">{projects.length} projects</span>
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
                aria-pressed={selected === p.project_id}
                onClick={() => setSelected(p.project_id)}
              >
                <Folder size={16} aria-hidden="true" />
                <span>
                  <strong>{p.name}</strong>
                  <span className="muted project-summary">{p.summary || "No summary"}</span>
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
            {selected ? (
              <ProjectDetail key={`${selected}:${refresh}`} org={org} id={selected} />
            ) : (
              <Empty title="Select a project" description="View its details and issue queue." />
            )}
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
function ProjectDetail({ org, id }: { org: string; id: string }) {
  const { api, issueHref } = useProjects();
  const [data, setData] = useState<{ project: Project; issues: Issue[] }>();
  const [error, setError] = useState<Error>();
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
      <h1>{data.project.name}</h1>
      <p className="issue-description">{data.project.summary || "No summary."}</p>
      <h2 className="queue-title">Issues</h2>
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
    </>
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
