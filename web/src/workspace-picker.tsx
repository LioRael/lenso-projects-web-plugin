import { canKeepResults } from "./api";
import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { Dialog } from "@lenso/ui/dialog";
import { ChevronRight, ChevronDown, Search, Check } from "lucide-react";
import { useProjects } from "./transport";
import { query, type Page } from "./api";
import { Empty, Feedback, RefreshNotice } from "./shared";
type MemberWorkspace = { organization_id: string; name: string; slug: string };
export function WorkspacePicker({
  autoEnter,
  compact = false,
  currentOrg,
  onChoose,
  onBack,
}: {
  autoEnter: boolean;
  compact?: boolean;
  currentOrg?: string;
  onChoose: (id: string) => void;
  onBack?: () => void;
}) {
  const { api, workspaceHref } = useProjects();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MemberWorkspace[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<Error>();
  const [refresh, setRefresh] = useState(0);
  const choose = useRef(onChoose);
  useEffect(() => {
    choose.current = onChoose;
  }, [onChoose]);
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError(undefined);
    api<Page<MemberWorkspace>>("/api/projects/workspaces?limit=50", { signal: c.signal })
      .then((page) => {
        if (c.signal.aborted) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        if (autoEnter && page.items.length === 1 && !page.next_cursor)
          choose.current(page.items[0]!.organization_id);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [api, autoEnter, refresh]);
  async function more() {
    if (busy || !cursor) return;
    setBusy(true);
    setError(undefined);
    try {
      const page = await api<Page<MemberWorkspace>>(
        `/api/projects/workspaces?${query({ limit: 50, after: cursor })}`,
      );
      setItems((old) => [...old, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`workspace-picker${compact ? " workspace-picker-compact" : ""}`}>
      {!compact && (
        <header>
          <h1>Your workspaces</h1>
          <p className="muted">Choose a workspace to open its projects.</p>
        </header>
      )}
      {!!items.length && (
        <label className="project-search workspace-search">
          <Search size={14} />
          <input
            aria-label="Search workspaces"
            placeholder={cursor ? "Search loaded workspaces…" : "Search workspaces…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      {error && canKeepResults(error) && items.length > 0 && (
        <RefreshNotice error={error} retry={() => setRefresh((n) => n + 1)} />
      )}
      {error && (!canKeepResults(error) || !items.length) ? (
        <Feedback error={error} retry={() => setRefresh((n) => n + 1)} />
      ) : busy && !items.length ? (
        <Empty title="Loading workspaces…" />
      ) : !items.length ? (
        <Empty
          title="No workspaces yet"
          description="Ask a workspace owner to invite this account, then refresh."
        />
      ) : (
        <div className="workspace-options">
          {items
            .filter((w) => `${w.name} ${w.slug}`.toLowerCase().includes(search.toLowerCase()))
            .map((w) => (
              <a
                href={workspaceHref(w.organization_id)}
                className="workspace-option"
                key={w.organization_id}
                aria-current={w.organization_id === currentOrg ? "true" : undefined}
                onClick={(e) => {
                  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  onChoose(w.organization_id);
                }}
              >
                <span className="workspace-avatar">{w.name.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{w.name}</strong>
                  <small className="muted">{w.slug}</small>
                </span>
                {w.organization_id === currentOrg ? (
                  <Check size={14} aria-label="Current workspace" />
                ) : (
                  <ChevronRight size={14} />
                )}
              </a>
            ))}
        </div>
      )}
      {items.length > 0 &&
        !items.some((w) => `${w.name} ${w.slug}`.toLowerCase().includes(search.toLowerCase())) && (
          <Empty
            title="No matching workspaces"
            description={cursor ? "Load more workspaces or try another name." : "Try another name."}
          />
        )}
      <div className="workspace-picker-actions">
        {cursor && (
          <Button variant="ghost" loading={busy} onClick={more}>
            Load more workspaces
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </Button>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back to projects
          </Button>
        )}
      </div>
    </section>
  );
}

export function WorkspaceSwitch({ org }: { org: string }) {
  const { api, openWorkspace } = useProjects();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Workspace");
  useEffect(() => {
    const c = new AbortController();
    setName("Workspace");
    async function find() {
      let after: string | null | undefined;
      do {
        const page = await api<Page<MemberWorkspace>>(
          `/api/projects/workspaces?${query({ limit: 100, after })}`,
          { signal: c.signal },
        );
        if (c.signal.aborted) return;
        const current = page.items.find((w) => w.organization_id === org);
        if (current) {
          setName(current.name);
          return;
        }
        after = page.next_cursor;
      } while (after);
    }
    void find().catch(() => {});
    return () => c.abort();
  }, [api, org]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={<Button variant="ghost" size="compact" />}
        aria-label="Switch workspace"
      >
        <span className="workspace-switch-name">{name}</span>
        <ChevronDown size={12} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Switch workspace</Dialog.Title>
              <Dialog.Close aria-label="Close workspace switcher" />
            </Dialog.Header>
            <Dialog.Body>
              <div className="projects-workspace">
                <WorkspacePicker
                  compact
                  currentOrg={org}
                  autoEnter={false}
                  onChoose={(id) => {
                    setOpen(false);
                    if (id !== org) openWorkspace(id);
                  }}
                />
              </div>
            </Dialog.Body>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
