import { createContext, useContext } from "react";
import { api, issueHref, workspaceHref, type TraceHandoff } from "./api";
export const Transport = createContext({
  api,
  issueHref,
  workspaceHref,
  traceHandoff: undefined as TraceHandoff | undefined,
  requestAgentDraft: undefined as ((draft: string) => void) | undefined,
  openWorkspace: (org: string) => {
    location.href = workspaceHref(org);
  },
  openIssue: (org: string, id: string) => {
    location.href = issueHref(org, id);
  },
});
export const useProjects = () => useContext(Transport);
