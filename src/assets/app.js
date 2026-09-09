const $ = (s) => document.querySelector(s);
const state = {
  projects: [],
  projectCursor: null,
  selected: null,
  catalog: { teams: [], projectStatuses: [], cycles: [] },
};
const org = () => $("#organization").value.trim();
const headers = (json = false) =>
  json ? { "Content-Type": "application/json" } : {};
function query(values) {
  const q = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  return q.toString();
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) },
  });
  if (!response.ok) {
    let problem = {};
    try {
      problem = await response.json();
    } catch {}
    const error = new Error(
      response.status === 401
        ? "Sign in to the business App, then return here."
        : problem.detail || `${response.status} ${response.statusText}`
    );
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}
function escape(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ]
  );
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}
async function loadCatalog() {
  const base = { organization_id: org(), limit: 100 };
  const [teams, statuses] = await Promise.all([
    api(`/api/projects/catalog/teams?${query(base)}`),
    api(`/api/projects/catalog/project-statuses?${query(base)}`),
  ]);
  const firstTeam = teams.items?.[0]?.team_id;
  const cycles = firstTeam
    ? await api(
        `/api/projects/catalog/cycles?${query({ ...base, team_id: firstTeam })}`
      )
    : { items: [] };
  state.catalog = {
    teams: teams.items || [],
    projectStatuses: statuses.items || [],
    cycles: cycles.items || [],
  };
  const teamSelect = $("[name=lead_team_id]");
  const statusSelect = $("[name=status_id]");
  teamSelect.innerHTML = state.catalog.teams
    .map(
      (x) =>
        `<option value="${escape(x.team_id)}">${escape(x.name || x.key || x.team_id)}</option>`
    )
    .join("");
  statusSelect.innerHTML = state.catalog.projectStatuses
    .map(
      (x) =>
        `<option value="${escape(x.status_id)}">${escape(x.name || x.status_id)}</option>`
    )
    .join("");
  $("#metric-cycle").textContent = state.catalog.cycles[0]?.name || "None";
}
async function loadProjects(append = false) {
  if (!org()) throw new Error("Organization is required.");
  const params = {
    organization_id: org(),
    include_archived: $("#show-archived").checked,
    limit: 50,
    after: append ? state.projectCursor : null,
  };
  const data = await api(`/api/projects?${query(params)}`);
  state.projects = append ? [...state.projects, ...data.items] : data.items;
  state.projectCursor = data.next_cursor;
  renderProjects();
  $("#metric-projects").textContent = state.projects.filter(
    (x) => !x.archived
  ).length;
  $("#load-more-projects").classList.toggle("hidden", !state.projectCursor);
}
function renderProjects() {
  const list = $("#projects-list");
  if (!state.projects.length) {
    list.innerHTML = '<div class="empty">No projects match this view.</div>';
    return;
  }
  list.innerHTML = state.projects
    .map(
      (p) =>
        `<article class="project-card ${state.selected === p.project_id ? "selected" : ""}" data-id="${escape(p.project_id)}"><span class="status-dot"></span><div><h3>${escape(p.name)}</h3><p>${escape(p.summary || "No summary")}</p></div><time>${escape(p.target_date || "—")}</time></article>`
    )
    .join("");
  list
    .querySelectorAll("[data-id]")
    .forEach((el) =>
      el.addEventListener("click", () => selectProject(el.dataset.id))
    );
}
async function selectProject(id) {
  state.selected = id;
  renderProjects();
  const project = await api(
    `/api/projects/${encodeURIComponent(id)}?${query({ organization_id: org() })}`
  );
  const issues = await api(
    `/api/projects/${encodeURIComponent(id)}/issues?${query({ organization_id: org(), include_archived: false, limit: 50 })}`
  );
  $("#metric-issues").textContent = issues.items.length;
  $("#project-detail").className = "";
  $("#project-detail").innerHTML =
    `<div class="detail-header"><div><span class="badge">${escape(project.status_id)}</span><h2>${escape(project.name)}</h2><p>${escape(project.summary || "No summary")}</p></div><span class="badge">rev ${escape(project.revision)}</span></div><div class="issue-head"><h3>Issues</h3><span class="muted">${issues.items.length} shown</span></div><div>${issues.items.map((i) => `<a class="issue-row" href="/projects?${query({ organization_id: org(), issue: i.issue_id })}"><span class="identifier">${escape(i.identifier)}</span><strong>${escape(i.title)}</strong><span class="priority">${escape(i.priority)}</span></a>`).join("") || '<div class="empty">No issues yet.</div>'}</div>`;
}
async function connect() {
  try {
    $("#connection-state").textContent = "Loading…";
    await Promise.all([loadCatalog(), loadProjects()]);
    $("#connection-state").textContent = "Connected";
    toast("Workspace loaded");
  } catch (error) {
    $("#connection-state").textContent = "Connection failed";
    toast(error.message);
  }
}
async function createProject(form) {
  const values = Object.fromEntries(new FormData(form));
  const id = crypto.randomUUID();
  const body = {
    idempotency_key: crypto.randomUUID(),
    organization_id: org(),
    project_id: id,
    name: values.name,
    summary: values.summary || null,
    lead_team_id: values.lead_team_id,
    team_ids: [values.lead_team_id],
    status_id: values.status_id,
    milestone_id: null,
    start_date: values.start_date || null,
    target_date: values.target_date || null,
  };
  await api("/api/projects", { method: "POST", body: JSON.stringify(body) });
  $("#project-dialog").close();
  form.reset();
  await loadProjects();
  await selectProject(id);
  toast("Project created");
}
$("#connect").addEventListener("click", connect);
$("#refresh").addEventListener("click", () => {
  const id = new URL(location.href).searchParams.get("issue");
  if (id) openIssue(id);
  else connect();
});
$("#show-archived").addEventListener("change", () =>
  loadProjects().catch((e) => toast(e.message))
);
$("#load-more-projects").addEventListener("click", () =>
  loadProjects(true).catch((e) => toast(e.message))
);
$("#new-project").addEventListener("click", () =>
  $("#project-dialog").showModal()
);
document
  .querySelectorAll(".close")
  .forEach((x) =>
    x.addEventListener("click", () => $("#project-dialog").close())
  );
$("#project-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("#form-error").textContent = "";
  createProject(e.currentTarget).catch(
    (error) => ($("#form-error").textContent = error.message)
  );
});
["organization"].forEach((id) => {
  const saved = localStorage.getItem(`lenso.projects.${id}`);
  if (saved) $(`#${id}`).value = saved;
  $(`#${id}`).addEventListener("change", (e) =>
    localStorage.setItem(`lenso.projects.${id}`, e.target.value)
  );
});
// Deep links use stable IDs. The App's session ingress authenticates every read.
let issueRequest = 0;
async function openIssue(id) {
  document.body.classList.add("issue-view");
  const request = ++issueRequest;
  const detail = $("#project-detail");
  detail.className = "";
  detail.textContent = "Loading issue…";
  try {
    const issue = await api(
      `/api/issues/${encodeURIComponent(id)}?${query({ organization_id: org() })}`
    );
    if (request !== issueRequest) return;
    $("#connection-state").textContent = "Signed in";
    const url = new URL(location.href);
    url.searchParams.set("organization_id", org());
    url.searchParams.set("issue", issue.issue_id);
    history.replaceState(null, "", url);
    detail.innerHTML = `<div class="detail-header"><div><span class="badge">${escape(issue.identifier)}</span><h2>${escape(issue.title)}</h2><p>${escape(issue.description || "")}</p></div><span class="badge">Revision ${escape(issue.revision)}</span></div><dl><dt>Status</dt><dd id="issue-state">Loading…</dd><dt>Priority</dt><dd>${escape(issue.priority)}</dd><dt>Last updated</dt><dd>${escape(new Date(issue.updated_at).toLocaleString())}</dd></dl><button id="refresh-issue" class="secondary">Refresh issue</button><h3>Activity</h3><div id="issue-activity" role="status">Loading activity…</div><button id="more-activity" class="ghost hidden">Load more activity</button>`;
    $("#refresh-issue").onclick = () => openIssue(id);
    api(
      `/api/projects/catalog/workflow-states?${query({ organization_id: org(), team_id: issue.team_id, limit: 100 })}`
    )
      .then((states) => {
        if (request === issueRequest)
          $("#issue-state").textContent =
            states.items.find(
              (item) => item.state_id === issue.workflow_state_id
            )?.name || "Unavailable";
      })
      .catch(() => {
        if (request === issueRequest)
          $("#issue-state").textContent = "Unavailable";
      });
    let cursor = null;
    let loading = false;
    const loadActivity = async () => {
      if (loading) return;
      loading = true;
      try {
        const activity = await api(
          `/api/issues/${encodeURIComponent(issue.issue_id)}/activity?${query({ organization_id: org(), after: cursor, limit: 50 })}`
        );
        if (request !== issueRequest) return;
        if (cursor === null) $("#issue-activity").textContent = "";
        for (const item of activity.items) {
          const row = document.createElement("p");
          row.textContent = `${{ create_issue: "Issue created", update_issue: "Issue updated", move_issue: "Issue moved", archive_issue: "Issue archived" }[item.operation] || item.operation} · Revision ${item.revision ?? "—"} · ${new Date(item.occurred_at).toLocaleString()} · ${item.actor_subject}`;
          $("#issue-activity").append(row);
        }
        if (!$("#issue-activity").textContent)
          $("#issue-activity").textContent = "No activity.";
        cursor = activity.next_cursor;
        $("#more-activity").classList.toggle(
          "hidden",
          activity.items.length < 50
        );
      } catch (error) {
        if (request === issueRequest)
          $("#issue-activity").textContent = error.message;
      } finally {
        loading = false;
      }
    };
    $("#more-activity").onclick = loadActivity;
    await loadActivity();
  } catch (error) {
    if (request === issueRequest) {
      detail.textContent = error.message;
      if (error.status === 401) {
        const link = document.createElement("a");
        link.textContent = "Sign in";
        link.href =
          "/login?" + query({ return_to: location.pathname + location.search });
        detail.append(document.createElement("br"), link);
      }
    }
  }
}
const initial = new URL(location.href);
const initialOrg = initial.searchParams.get("organization_id");
if (initialOrg) $("#organization").value = initialOrg;
localStorage.removeItem("lenso.projects.token");
if (initial.searchParams.get("issue") && org())
  openIssue(initial.searchParams.get("issue"));
