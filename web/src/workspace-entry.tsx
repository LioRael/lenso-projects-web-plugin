import type { ComponentType, ReactNode } from "react";
import { ProjectsNavigation } from "./projects-navigation";
import { TeamIssues } from "./team-issues";
import { useEffect, useMemo, useState } from "react";
import { ThemeScope } from "@lenso/ui/theme-scope";
import { Button } from "@lenso/ui/button";
import { ContentState } from "@lenso/ui/content-state";
import { IssuePage } from "./issue";
import { Workspace, ProjectDetail } from "./workspace";
import { Transport } from "./transport";
import { ApiError, type TraceHandoff } from "./api";
import "./workspace.css";
type Runtime = {
  services: {
    invoke<T, R>(
      service: string,
      operation: string,
      request: T,
      options?: { signal?: AbortSignal },
    ): Promise<R>;
  };
};
type Props = {
  chrome?: { Sidebar: ComponentType<{ children: ReactNode }> };
  agent?: {
    completedTurns: number;
    setPageContext: (context: { label: string; text: string } | null) => void;
    requestDraft?: (draft: string) => void;
  };
  environment: { locale: string; theme: string };
  location: { segments: readonly string[]; handoff?: { kind: string; payload: unknown } };
  navigation: {
    go: (segments: readonly string[]) => void;
    href: (segments: readonly string[]) => string;
  };
  signal: AbortSignal;
};
type Connection = {
  mode?: "console" | "external";
  connected: boolean;
  label: string;
  subject?: string;
};
const operations = [
  [/^\/api\/teams\/([^/]+)\/issues$/, "list_team_issues", "GET", "team_id"],
  [/^\/api\/issues\/([^/]+)\/assignee$/, "get_assignee", "GET", "issue_id"],
  [/^\/api\/issues\/([^/]+)\/assignee$/, "set_assignee", "PATCH", "issue_id"],
  [/^\/api\/issues\/([^/]+)\/assignees$/, "list_assignees", "GET", "issue_id"],
  [/^\/api\/issues\/([^/]+)$/, "update_issue", "PATCH", "issue_id"],
  [/^\/api\/projects\/workspaces$/, "list_workspaces", "GET"],
  [/^\/api\/projects$/, "list_projects", "GET"],
  [/^\/api\/projects$/, "create_project", "POST"],
  [/^\/api\/projects\/catalog\/teams$/, "list_teams", "GET"],
  [/^\/api\/projects\/catalog\/project-statuses$/, "list_project_statuses", "GET"],
  [/^\/api\/projects\/catalog\/workflow-states$/, "list_workflow_states", "GET"],
  [/^\/api\/projects\/([^/]+)\/issues$/, "list_issues", "GET", "project_id"],
  [/^\/api\/projects\/([^/]+)\/issues$/, "create_issue", "POST", "project_id"],
  [/^\/api\/projects\/([^/]+)$/, "get_project", "GET", "project_id"],
  [/^\/api\/issues\/([^/]+)\/activity$/, "list_activity", "GET", "issue_id"],
  [/^\/api\/issues\/([^/]+)$/, "get_issue", "GET", "issue_id"],
] as const;
export function create(runtime: Runtime) {
  function Page(props: Props) {
    const [createRequest, setCreateRequest] = useState(0);
    const [connection, setConnection] = useState<Connection>();
    const [error, setError] = useState<string>();
    const [authorization, setAuthorization] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState<string>();
    const service = runtime.services;
    useEffect(() => {
      let active = true;
      service
        .invoke<object, Connection>("projects", "connection_status", {}, { signal: props.signal })
        .then((value) => {
          if (active) setConnection(value);
        })
        .catch((e) => {
          if (active && !props.signal.aborted) setError(e.message);
        });
      return () => {
        active = false;
      };
    }, [service, props.signal]);
    useEffect(() => {
      if (!attempt) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout>;
      const poll = async () => {
        try {
          const result = await service.invoke<object, Connection>(
            "projects",
            "poll_connection",
            { attempt_id: attempt },
            { signal: props.signal },
          );
          if (cancelled) return;
          if (result.connected) {
            setConnection(result);
            setAttempt(undefined);
            setAuthorization(undefined);
            setBusy(false);
          } else timer = setTimeout(poll, 1500);
        } catch (e) {
          if (!cancelled) {
            setError((e as Error).message);
            setBusy(false);
            setAttempt(undefined);
            setAuthorization(undefined);
          }
        }
      };
      void poll();
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [service, attempt, props.signal]);
    const transport = useMemo(
      () => ({
        sidebarOwned: !!props.chrome?.Sidebar,
        completedAgentTurns: props.agent?.completedTurns || 0,
        setPageContext: (context: { label: string; text: string } | null) =>
          props.agent?.setPageContext(context),
        api: async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
          const url = new URL(path, "http://workspace.invalid");
          const method = options.method || "GET";
          const rule = operations.find(
            ([pattern, , verb]) => verb === method && pattern.test(url.pathname),
          );
          if (!rule) throw new Error("This workspace operation is not supported.");
          const body = options.body
            ? JSON.parse(String(options.body))
            : Object.fromEntries(url.searchParams);
          if (rule.length === 4) {
            const id = url.pathname.match(rule[0])?.[1];
            if (!id) throw new Error("The workspace record URL is invalid.");
            body[rule[3]] = decodeURIComponent(id);
          }
          const result = await service.invoke<object, { status: number; body: T }>(
            "projects",
            rule[1],
            body,
            { signal: options.signal || props.signal },
          );
          if (result.status === 401) {
            setConnection((c) => (c ? { ...c, connected: false } : undefined));
            throw new ApiError(
              401,
              connection?.mode === "console"
                ? "Projects could not verify your Console session."
                : "Reconnect your business App to continue.",
            );
          }
          if (result.status >= 400)
            throw new ApiError(
              result.status,
              result.status === 403
                ? "Your account does not have access to this record."
                : "Projects could not complete this request. Refresh the record before trying again.",
            );
          return result.body;
        },
        openProject: (org: string, id: string) =>
          props.navigation.go(["org", org, "projects", id, "overview"]),
        openWorkspace: (org: string) => props.navigation.go(["org", org]),
        openIssue: (org: string, id: string, project?: string) =>
          props.navigation.go(
            project ? ["org", org, "projects", project, "issues", id] : ["org", org, "issues", id],
          ),
        workspaceHref: (org: string) => props.navigation.href(["org", org]),
        projectHref: (org: string, id: string, view = "overview") =>
          props.navigation.href(["org", org, "projects", id, view]),
        issueHref: (org: string, id: string, project?: string) =>
          props.navigation.href(
            project ? ["org", org, "projects", project, "issues", id] : ["org", org, "issues", id],
          ),
        requestAgentDraft: props.agent?.requestDraft,
        traceHandoff: traceHandoff(props.location.handoff),
      }),
      [
        service,
        props.signal,
        props.navigation,
        props.agent,
        props.location.handoff,
        props.chrome?.Sidebar,
      ],
    );
    async function begin() {
      setBusy(true);
      setError(undefined);
      try {
        const result = await service.invoke<
          object,
          { attempt_id: string; authorization_url: string }
        >("projects", "begin_connection", {}, { signal: props.signal });
        setAttempt(result.attempt_id);
        setAuthorization(result.authorization_url);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
    const segments = props.location.segments;
    const org = segments[0] === "org" ? segments[1] || "" : "";
    const team = segments[2] === "teams" ? segments[3] : undefined;
    const teamIssues = !!team && segments[4] === "issues";
    const project = segments[2] === "projects" ? segments[3] : undefined;
    const issue =
      segments[2] === "issues"
        ? segments[3]
        : project && segments[4] === "issues"
          ? segments[5]
          : undefined;
    return (
      <ThemeScope theme={props.environment.theme === "dark" ? "dark" : "light"}>
        <div
          className="projects-workspace"
          onClick={(event) => {
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const anchor = (event.target as HTMLElement).closest("a");
            if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
            const target = new URL(anchor.href);
            const base = new URL(props.navigation.href([]), location.origin).pathname.replace(
              /\/$/,
              "",
            );
            if (target.origin !== location.origin || !target.pathname.startsWith(base + "/"))
              return;
            event.preventDefault();
            props.navigation.go(
              target.pathname
                .slice(base.length + 1)
                .split("/")
                .map(decodeURIComponent),
            );
          }}
        >
          {!connection?.connected ? (
            <ContentState.Root>
              <ContentState.Title as="h1">
                {connection?.mode === "console"
                  ? "Projects is unavailable"
                  : error
                    ? "Unable to connect Projects"
                    : connection
                      ? "Connect Projects"
                      : "Loading Projects…"}
              </ContentState.Title>
              <ContentState.Description>
                {connection?.mode === "console"
                  ? "Projects could not verify your Console session. Contact your administrator if retrying does not help."
                  : error ||
                    (connection
                      ? `Sign in to ${connection.label} to open your projects and issues.`
                      : "Checking your business account.")}
              </ContentState.Description>
              <ContentState.Actions>
                {connection?.mode === "console" ? (
                  <Button
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setConnection(
                          await service.invoke<object, Connection>(
                            "projects",
                            "connection_status",
                            {},
                            { signal: props.signal },
                          ),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Retry
                  </Button>
                ) : authorization ? (
                  <Button
                    nativeButton={false}
                    role="link"
                    render={<a href={authorization} target="_blank" rel="noreferrer" />}
                  >
                    Continue in browser
                  </Button>
                ) : (
                  (connection || error) && (
                    <Button loading={busy} onClick={begin}>
                      Connect account
                    </Button>
                  )
                )}
              </ContentState.Actions>
            </ContentState.Root>
          ) : (
            <Transport.Provider value={transport}>
              {props.chrome?.Sidebar && (
                <props.chrome.Sidebar>
                  <ProjectsNavigation
                    org={org}
                    team={team}
                    issues={teamIssues}
                    locale={props.environment.locale}
                    go={(team, issues) =>
                      props.navigation.go(
                        team
                          ? ["org", org, "teams", team, issues ? "issues" : "projects"]
                          : org
                            ? ["org", org]
                            : [],
                      )
                    }
                    create={() => {
                      props.navigation.go(["org", org]);
                      setCreateRequest((n) => n + 1);
                    }}
                  />
                </props.chrome.Sidebar>
              )}
              {teamIssues ? (
                <TeamIssues key={`${org}:${team}`} org={org} team={team!} />
              ) : issue ? (
                <IssuePage key={`${org}:${issue}`} org={org} id={issue} project={project} />
              ) : project ? (
                <ProjectDetail
                  key={`${org}:${project}`}
                  org={org}
                  id={project}
                  view={segments[4]}
                />
              ) : (
                <Workspace
                  key={`${org}:${team || ""}`}
                  org={org}
                  team={team}
                  createRequest={createRequest}
                  onCreateHandled={() => setCreateRequest(0)}
                />
              )}
            </Transport.Provider>
          )}
        </div>
      </ThemeScope>
    );
  }
  return { Page };
}

function traceHandoff(value: Props["location"]["handoff"]): TraceHandoff | undefined {
  if (
    value?.kind !== "lenso.observe.trace@1" ||
    !value.payload ||
    typeof value.payload !== "object"
  )
    return undefined;
  const payload = value.payload as Partial<TraceHandoff>;
  if (
    payload.kind !== value.kind ||
    typeof payload.source_id !== "string" ||
    typeof payload.trace_id !== "string"
  )
    return undefined;
  return payload as TraceHandoff;
}
