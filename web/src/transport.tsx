import { createContext, useContext } from "react";
import { api, issueHref, workspaceHref } from "./api";
export const Transport = createContext({
  api,
  issueHref,
  workspaceHref,
  openWorkspace: (org: string) => {
    location.href = workspaceHref(org);
  },
});
export const useProjects = () => useContext(Transport);
