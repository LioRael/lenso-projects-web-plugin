import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "@lenso/ui/sidebar";
import { IconButton } from "@lenso/ui/icon-button";
import { Box, Layers, ChevronRight, Plus } from "lucide-react";
import { allPages, query, type Page, type Team } from "./api";
import { useProjects } from "./transport";
import { WorkspaceSwitch } from "./workspace-picker";

export function ProjectsNavigation({
  org,
  team,
  issues,
  go,
  create,
  locale,
}: {
  org: string;
  team?: string;
  issues: boolean;
  go: (team?: string, issues?: boolean) => void;
  create: () => void;
  locale: string;
}) {
  const { api } = useProjects();
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const zh = locale === "zh-CN";
  useEffect(() => {
    setTeams([]);
    setError(false);
    if (!org) return;
    const c = new AbortController();
    setLoading(true);
    allPages<Team>(
      (after) =>
        api<Page<Team>>(
          `/api/projects/catalog/teams?${query({ organization_id: org, after, limit: 100 })}`,
          { signal: c.signal },
        ),
      c.signal,
    )
      .then((items) => {
        if (!c.signal.aborted) setTeams(items);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [api, org, attempt]);
  function item(label: string, selected: boolean, icon: ReactNode, onClick: () => void) {
    return (
      <Sidebar.Item
        selected={selected}
        icon={icon}
        onClick={onClick}
        style={{
          fontSize: 12,
          fontWeight: 400,
          borderRadius: "var(--radius-rounded)",
          boxShadow: selected ? "inset 0 0 0 0.5px var(--color-border-translucent)" : "none",
        }}
      >
        {label}
      </Sidebar.Item>
    );
  }
  return (
    <div className="projects-workspace projects-context-navigation">
      <div className="projects-navigation-header">
        <WorkspaceSwitch org={org} />
        {org && (
          <IconButton aria-label={zh ? "新建项目" : "New project"} variant="ghost" onClick={create}>
            <Plus size={14} />
          </IconButton>
        )}
      </div>
      <Sidebar.Content style={{ padding: "0 var(--projects-navigation-inset) 16px", gap: 6 }}>
        <section className="projects-navigation-section">
          <div className="projects-navigation-label">{zh ? "工作区" : "Workspace"}</div>
          {item(zh ? "项目" : "Projects", !team, <Box size={14} />, () => go())}
        </section>
        {org && (
          <section className="projects-navigation-section">
            <div className="projects-navigation-label">{zh ? "你的团队" : "Your teams"}</div>
            {loading && (
              <p className="navigation-note" role="status">
                {zh ? "正在加载团队…" : "Loading teams…"}
              </p>
            )}
            {error && (
              <button className="navigation-note" onClick={() => setAttempt((n) => n + 1)}>
                {zh ? "无法加载团队，重试" : "Could not load teams. Retry"}
              </button>
            )}
            {!loading && !error && !teams.length && (
              <p className="navigation-note">{zh ? "暂无可访问的团队" : "No accessible teams"}</p>
            )}
            {teams.map((t) => (
              <TeamNavigation
                key={`${org}:${t.team_id}`}
                team={t}
                active={team === t.team_id}
                issues={issues}
                zh={zh}
                item={item}
                go={go}
              />
            ))}
          </section>
        )}
      </Sidebar.Content>
    </div>
  );
}
function TeamNavigation({
  team,
  active,
  issues,
  zh,
  item,
  go,
}: {
  team: Team;
  active: boolean;
  issues: boolean;
  zh: boolean;
  item: (label: string, selected: boolean, icon: ReactNode, onClick: () => void) => ReactNode;
  go: (team?: string, issues?: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  return (
    <div className="projects-team">
      <button
        className="projects-team-trigger"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="projects-team-mark" aria-hidden="true">
          {team.name.slice(0, 1)}
        </span>
        <span>{team.name}</span>
        <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : undefined }} />
      </button>
      {expanded && (
        <div className="projects-team-children">
          {item(zh ? "事项" : "Issues", active && issues, <Layers size={14} />, () =>
            go(team.team_id, true),
          )}
          {item(zh ? "项目" : "Projects", active && !issues, <Box size={14} />, () =>
            go(team.team_id),
          )}
        </div>
      )}
    </div>
  );
}
