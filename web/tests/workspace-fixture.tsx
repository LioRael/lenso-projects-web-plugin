import "@lenso/tokens/styles.css";
import "@lenso/ui/styles.css";
import "../../src/workspace/workspace.css";
import * as React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { createWorkspace } from "../../src/workspace/workspace.js";

const evidence = {
  active: 0,
  peak: 0,
  calls: [] as { operation: string; body: Record<string, unknown> }[],
};
Object.assign(window, { workspaceEvidence: evidence });
const invoke = async (_service: string, operation: string, body: Record<string, unknown>) => {
  evidence.calls.push({ operation, body });
  evidence.active += 1;
  evidence.peak = Math.max(evidence.peak, evidence.active);
  await new Promise((resolve) => setTimeout(resolve, 5));
  evidence.active -= 1;
  if (operation === "connection_status")
    return { connected: true, mode: "console", label: "Console" };
  if (operation === "get_issue")
    return {
      status: 200,
      body: {
        issue_id: "issue-1",
        organization_id: "org-1",
        identifier: "TEA-1",
        title: "Team issue",
        team_id: "team-1",
        priority: "medium",
        workflow_state_id: "open",
        revision: 1,
        updated_at: "2026-09-12T00:00:00Z",
      },
    };
  const items =
    operation === "list_workspaces"
      ? [{ organization_id: "org-1", name: "Tea", slug: "tea" }]
      : operation === "list_teams"
        ? [{ team_id: "team-1", name: "Product" }]
        : operation === "list_team_issues"
          ? [
              {
                issue_id: "issue-1",
                identifier: "TEA-1",
                title: "Team issue",
                team_id: body.team_id,
              },
            ]
          : [];
  return { status: 200, body: { items, next_cursor: null } };
};
const workspace = createWorkspace({
  react: React,
  createElement: React.createElement,
  services: { invoke: invoke as Parameters<typeof createWorkspace>[0]["services"]["invoke"] },
});
const controller = new AbortController();
const SidebarTarget = React.createContext<HTMLElement | null>(null);
function Sidebar({ children }: { children: React.ReactNode }) {
  const target = React.useContext(SidebarTarget);
  return target ? createPortal(children, target) : null;
}
function App() {
  const [sidebar, setSidebar] = React.useState<HTMLElement | null>(null);
  const [context, setContext] = React.useState<{ label: string; text: string } | null>(null);
  const [segments, setSegments] = React.useState<readonly string[]>(["org", "org-1"]);
  const navigation = React.useMemo(
    () => ({
      go: setSegments,
      href: (parts: readonly string[]) => `/workspaces/projects/${parts.join("/")}`,
    }),
    [],
  );
  return (
    <SidebarTarget.Provider value={sidebar}>
      <aside aria-label="Host sidebar" ref={setSidebar} />
      <main>
        <output aria-label="Agent context">{context?.label}</output>
        <workspace.Page
          agent={{ completedTurns: 0, setPageContext: setContext }}
          chrome={{ Sidebar }}
          environment={{ locale: "en", theme: "light" }}
          location={{ segments }}
          navigation={navigation}
          signal={controller.signal}
        />
      </main>
    </SidebarTarget.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
window.addEventListener("pagehide", () => controller.abort());
