import { canKeepResults } from "./api";
import { useEffect, useRef, useState } from "react";
import { Button } from "@lenso/ui/button";
import { PageHeader } from "@lenso/ui/page-header";
import { Menu } from "@lenso/ui/menu";
import { ChevronRight, ChevronDown, Search, Check } from "lucide-react";
import { useProjects } from "./transport";
import { allPages, query, type Page } from "./api";
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
    <>
      {!compact && (
        <PageHeader.Root
          aria-label="Projects navigation"
          style={{ height: "auto", position: "relative" }}
        >
          <PageHeader.Row style={{ minHeight: 44, height: "auto" }}>
            <h1 className="workspace-header-title" style={{ margin: 0 }}>
              Workspaces
            </h1>
          </PageHeader.Row>
        </PageHeader.Root>
      )}
      <section
        aria-label="Your workspaces"
        className={`workspace-picker${compact ? " workspace-picker-compact" : ""}`}
      >
        {!compact && items.length > 0 && (
          <p className="workspace-picker-intro muted">
            Choose a workspace to view its projects and issues.
          </p>
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
            description="You haven’t joined a workspace. Ask its owner for an invitation, then check again."
            actions={
              <Button
                size="compact"
                variant="secondary"
                disabled={busy}
                onClick={() => setRefresh((n) => n + 1)}
              >
                Check again
              </Button>
            }
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
          !items.some((w) =>
            `${w.name} ${w.slug}`.toLowerCase().includes(search.toLowerCase()),
          ) && (
            <Empty
              title="No matching workspaces"
              description={
                cursor ? "Load more workspaces or try another name." : "Try another name."
              }
            />
          )}
        {(items.length > 0 || onBack) && (
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
        )}
      </section>
    </>
  );
}

export function WorkspaceSwitch({ org }: { org: string }) {
  const { api, openWorkspace } = useProjects();
  const [items, setItems] = useState<MemberWorkspace[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!org && !open) {
      setBusy(false);
      return;
    }
    const c = new AbortController();
    setBusy(true);
    setError(false);
    allPages<MemberWorkspace>(
      (after) =>
        api<Page<MemberWorkspace>>(`/api/projects/workspaces?${query({ limit: 100, after })}`, {
          signal: c.signal,
        }),
      c.signal,
    )
      .then((value) => {
        if (!c.signal.aborted) setItems(value);
      })
      .catch(() => {
        if (!c.signal.aborted) {
          setError(true);
          setItems([]);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [api, org, attempt, open]);
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        render={<Button variant="ghost" />}
        aria-label="Switch workspace"
        style={{
          width: "fit-content",
          minWidth: 0,
          fontSize: 13,
          fontWeight: 600,
          paddingInline: 6,
        }}
      >
        <span className="workspace-switch-name">
          {items.find((w) => w.organization_id === org)?.name || "Workspaces"}
        </span>
        <ChevronDown size={12} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6}>
          <Menu.Popup style={{ minWidth: 220, maxWidth: 300, maxHeight: 360, overflowY: "auto" }}>
            {busy && !items.length && <Menu.Item disabled>Loading workspaces…</Menu.Item>}
            {error && (
              <Menu.Item closeOnClick={false} onClick={() => setAttempt((n) => n + 1)}>
                Could not load workspaces. Retry
              </Menu.Item>
            )}
            {!busy && !error && !items.length && <Menu.Item disabled>No workspaces yet</Menu.Item>}
            {items.map((w) => (
              <Menu.Item
                key={w.organization_id}
                onClick={() => {
                  setOpen(false);
                  if (w.organization_id !== org) openWorkspace(w.organization_id);
                }}
              >
                <Menu.Label>{w.name}</Menu.Label>
                {w.organization_id === org && (
                  <Menu.Trailing>
                    <Check size={14} aria-label="Current workspace" />
                  </Menu.Trailing>
                )}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
