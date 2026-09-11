import { createContext, useContext } from "react";
import { api, issueHref, workspaceHref, projectHref, type TraceHandoff } from "./api";
export const Transport = createContext({
  api,
  completedAgentTurns: 0,
  setPageContext: (_context: { label: string; text: string } | null) => {},
  openProject: (org: string, id: string) => {
    location.href = projectHref(org, id);
  },
  projectHref,
  issueHref,
  workspaceHref,
  traceHandoff: undefined as TraceHandoff | undefined,
  requestAgentDraft: undefined as ((draft: string) => void) | undefined,
  openWorkspace: (org: string) => {
    location.href = workspaceHref(org);
  },
  openIssue: (org: string, id: string, project?: string) => {
    location.href = issueHref(org, id, project);
  },
});
export const useProjects = () => useContext(Transport);
