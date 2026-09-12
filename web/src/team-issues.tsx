import { useEffect, useState } from "react";
import { Button } from "@lenso/ui/button";
import { Search, Circle } from "lucide-react";
import { canKeepResults, query, type Page, type Issue } from "./api";
import { useProjects } from "./transport";
import { WorkspaceHeader } from "./workspace-header";
import { Empty, Feedback, RefreshNotice } from "./shared";
export function TeamIssues({ org, team }: { org: string; team: string }) {
  const { api, issueHref } = useProjects();
  const [items, setItems] = useState<Issue[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<Error>();
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError(undefined);
    setItems([]);
    api<Page<Issue>>(
      `/api/teams/${encodeURIComponent(team)}/issues?${query({ organization_id: org, limit: 50 })}`,
      { signal: c.signal },
    )
      .then((page) => {
        if (!c.signal.aborted) {
          setItems(page.items);
          setCursor(page.next_cursor);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [api, org, team, attempt]);
  const visible = items.filter((i) =>
    `${i.identifier} ${i.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const page = await api<Page<Issue>>(
        `/api/teams/${encodeURIComponent(team)}/issues?${query({ organization_id: org, limit: 50, after: cursor })}`,
      );
      setItems((v) => [...v, ...page.items]);
      setCursor(page.next_cursor);
      setError(undefined);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <WorkspaceHeader org={org} team={team}>
        Issues
      </WorkspaceHeader>
      <div className="workspace-toolbar">
        <label className="project-search">
          <Search size={14} />
          <input
            aria-label="Search issues"
            placeholder={cursor ? "Search loaded issues…" : "Search issues…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted">
          {visible.length}
          {cursor ? "+" : ""} issues
        </span>
      </div>
      {error && (!canKeepResults(error) || !items.length) ? (
        <Feedback error={error} retry={() => setAttempt((n) => n + 1)} />
      ) : (
        <>
          {error && <RefreshNotice error={error} retry={() => setAttempt((n) => n + 1)} />}
          <section aria-label="Team issues" aria-busy={busy}>
            {visible.map((i) => (
              <a key={i.issue_id} className="issue-table-row" href={issueHref(org, i.issue_id)}>
                <Circle size={14} />
                <span className="muted">{i.identifier}</span>
                <span>{i.title}</span>
              </a>
            ))}
          </section>
          {!items.length && <Empty title={busy ? "Loading issues…" : "No issues yet"} />}
          {!!items.length && !visible.length && <Empty title="No matching issues" />}
          {cursor && (
            <Button variant="ghost" loading={busy} onClick={more}>
              Load more issues
            </Button>
          )}
        </>
      )}
    </>
  );
}
