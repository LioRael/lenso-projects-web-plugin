import { useProjects } from "./transport";
import { useEffect, useState, type ReactNode } from "react";
import { allPages, query, type Page, type Team } from "./api";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@lenso/ui/page-header";
import { WorkspaceSwitch } from "./workspace-picker";

/** Match the Console Agent header: one wrapping row, local navigation left, context right. */
export function WorkspaceHeader({
  org,
  team,
  children,
  views,
  actions,
}: {
  org: string;
  team?: string;
  children: ReactNode;
  views?: ReactNode;
  actions?: ReactNode;
}) {
  const { sidebarOwned } = useProjects();
  return (
    <PageHeader.Root
      aria-label="Projects navigation"
      style={{ height: "auto", position: "relative", zIndex: 4 }}
    >
      <PageHeader.Row style={{ flexWrap: "wrap", height: "auto", minHeight: 44 }}>
        <div className="workspace-header-title">
          {team && (
            <>
              <TeamLabel org={org} team={team} />
              <ChevronRight size={12} />
            </>
          )}
          {children}
        </div>
        {views && (
          <nav className="workspace-header-views" aria-label="Project views">
            {views}
          </nav>
        )}
        <div className="workspace-header-actions">
          {!sidebarOwned && <WorkspaceSwitch org={org} />}
          {actions}
        </div>
      </PageHeader.Row>
    </PageHeader.Root>
  );
}

function TeamLabel({ org, team }: { org: string; team: string }) {
  const { api } = useProjects();
  const [name, setName] = useState("Team");
  useEffect(() => {
    const c = new AbortController();
    setName("Team");
    allPages<Team>(
      (after) =>
        api<Page<Team>>(
          `/api/projects/catalog/teams?${query({ organization_id: org, after, limit: 100 })}`,
          { signal: c.signal },
        ),
      c.signal,
    )
      .then((items) => {
        if (!c.signal.aborted) setName(items.find((t) => t.team_id === team)?.name || "Team");
      })
      .catch(() => {});
    return () => c.abort();
  }, [api, org, team]);
  return <span className="muted">{name}</span>;
}
