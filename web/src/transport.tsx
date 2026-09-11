import { createContext, useContext } from "react";
import { api, issueHref, workspaceHref, projectHref } from "./api";
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
  openWorkspace: (org: string) => {
    location.href = workspaceHref(org);
  },
});
export const useProjects = () => useContext(Transport);
