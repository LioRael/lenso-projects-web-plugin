export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const query = (values: Record<string, string | number | boolean | null | undefined>) => {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value != null && value !== "") result.set(key, String(value));
  return result.toString();
};
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      response.status === 401
        ? "Sign in to your business App to continue."
        : response.status === 403
          ? "Your account does not have access to this record."
          : problem.detail || `Request failed (${response.status}).`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export interface Page<T> {
  items: T[];
  next_cursor?: string | null;
}
export interface Issue {
  issue_id: string;
  organization_id: string;
  team_id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority: string;
  workflow_state_id: string;
  revision: string | number;
  updated_at: string;
}
export interface Activity {
  activity_id?: string;
  operation: string;
  revision?: string | number;
  occurred_at: string;
  actor_subject: string;
}
export interface WorkflowState {
  state_id: string;
  name: string;
}
export interface Project {
  project_id: string;
  name: string;
  summary?: string | null;
  status_id: string;
  revision: string | number;
  target_date?: string | null;
  archived: boolean;
}
export interface Team {
  team_id: string;
  name: string;
}
export interface ProjectStatus {
  status_id: string;
  name: string;
}
export const issueHref = (org: string, id: string) =>
  `/projects?${query({ organization_id: org, issue: id })}`;
export const workspaceHref = (org: string) => `/projects?${query({ organization_id: org })}`;
export const shortDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const displayName = (name: string) =>
  name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
