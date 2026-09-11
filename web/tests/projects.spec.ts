import { test, expect, type Page as BrowserPage } from "@playwright/test";
import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:55440";
const issue = {
  issue_id: "issue-1",
  organization_id: "org-1",
  team_id: "team-1",
  identifier: "PROJ-24",
  title: "Return to the issue after connecting an account",
  description:
    "Keep the current issue in view when a user signs in to the business App.\n\nAfter authorization, return to the original issue so they can review its status and recent activity without searching again.",
  priority: "medium",
  revision: 2,
  workflow_state_id: "done",
  updated_at: "2026-09-10T07:28:00Z",
};
const project = {
  project_id: "project-1",
  name: "Account connections",
  summary: "Connect once and continue working in your business App.",
  status_id: "active",
  target_date: "2026-09-10",
  revision: 1,
  archived: false,
};
async function fixture(
  page: BrowserPage,
  options: { status?: number; empty?: boolean; activityError?: boolean } = {},
) {
  const errors: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let activityFailed = false;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      if (options.status) return route.fulfill({ status: options.status, json: {} });
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        return route.fulfill({ json: {} });
      }
      if (path.endsWith("/assignee"))
        return route.fulfill({
          json: { assignee_subject: null, revision: String(issue.revision) },
        });
      if (path.endsWith("/assignees"))
        return route.fulfill({
          json: { items: [{ subject: "user-1", name: "You" }], next_cursor: null },
        });
      if (path.endsWith("/activity")) {
        if (options.activityError && !activityFailed) {
          activityFailed = true;
          return route.fulfill({ status: 500, json: { detail: "Activity unavailable" } });
        }
        return route.fulfill({
          json: {
            items: options.empty
              ? []
              : [
                  {
                    activity_id: "activity-1",
                    operation: "create_issue",
                    revision: 1,
                    occurred_at: issue.updated_at,
                    actor_subject: "usr_acceptance",
                  },
                  {
                    activity_id: "activity-2",
                    operation: "update_issue",
                    revision: 2,
                    occurred_at: issue.updated_at,
                    actor_subject: "usr_acceptance",
                  },
                ],
            next_cursor: null,
          },
        });
      }
      if (path === "/api/projects/workspaces")
        return route.fulfill({
          json: {
            items: options.empty
              ? []
              : [
                  { organization_id: "org-1", name: "Product", slug: "product" },
                  { organization_id: "org-2", name: "Design", slug: "design" },
                ],
            next_cursor: null,
          },
        });
      if (path.includes("workflow-states"))
        return route.fulfill({ json: { items: [{ state_id: "done", name: "Done" }] } });
      if (path.includes("project-statuses"))
        return route.fulfill({ json: { items: [{ status_id: "active", name: "Active" }] } });
      if (path.endsWith("/teams"))
        return route.fulfill({ json: { items: [{ team_id: "team-1", name: "Product" }] } });
      if (path === "/api/projects")
        return route.fulfill({
          json: { items: options.empty ? [] : [project], next_cursor: null },
        });
      if (path.startsWith("/api/projects/") && path.endsWith("/issues"))
        return route.fulfill({ json: { items: [issue], next_cursor: null } });
      if (path.startsWith("/api/projects/")) return route.fulfill({ json: project });
      return route.fulfill({ json: issue });
    }
    const file = path.endsWith(".css") ? "app.css" : path.endsWith(".js") ? "app.js" : "app.html";
    return route.fulfill({
      body: await readFile(new URL(`../../src/assets/${file}`, import.meta.url)),
      contentType: file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".js")
          ? "text/javascript"
          : "text/html",
    });
  });
  return { errors, writes };
}
const url = `${origin}/projects?organization_id=org-1&issue=issue-1`;
test("Lenso components, light/dark tokens, disclosure, refresh and mobile layout", async ({
  page,
}) => {
  const { errors } = await fixture(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: issue.title })).toBeVisible();
  await expect(page.locator("#issue-state")).toHaveText("Done");
  await expect(page.locator('[data-slot="theme-scope"]')).toHaveAttribute("data-theme", "light");
  await expect(page.locator('[data-slot="description-list"]').first()).toBeVisible();
  const light = await page
    .locator(".work-surface")
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.screenshot({ animations: "disabled", path: "/tmp/lenso-projects-ui-light.png" });
  await page.getByRole("button", { name: "Issue created" }).click();
  await expect(page.getByText("usr_acceptance", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Issue created" }).click();
  await page.getByRole("button", { name: "Refresh issue", exact: true }).click();
  await expect(page.locator("#issue-state")).toHaveText("Done");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => page.locator(".work-surface").evaluate((e) => getComputedStyle(e).backgroundColor))
    .not.toBe(light);
  await page.screenshot({ animations: "disabled", path: "/tmp/lenso-projects-ui-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: issue.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: "disabled",
    path: "/tmp/lenso-projects-ui-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("workspace navigation, actual shared dialog and select, project creation payload", async ({
  page,
}) => {
  const { errors, writes } = await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("link", { name: /Account connections/ }).click();
  await page.getByRole("link", { name: "Issues", exact: true }).click();
  await expect(page.getByRole("link", { name: /PROJ-24/ })).toHaveAttribute(
    "href",
    "/projects?organization_id=org-1&issue=issue-1&project=project-1",
  );
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("A real project");
  await page.getByRole("combobox", { name: "Lead team" }).click();
  await page.getByRole("option", { name: "Product" }).click();
  await page.screenshot({ animations: "disabled", path: "/tmp/lenso-projects-ui-dialog.png" });
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    organization_id: "org-1",
    name: "A real project",
    lead_team_id: "team-1",
    status_id: "active",
    team_ids: ["team-1"],
  });
  expect(writes[0]).not.toHaveProperty("actor");
  expect(errors).toEqual([]);
});
test("401 preserves return destination; 403 has no sign-in loop", async ({ page }) => {
  await fixture(page, { status: 401 });
  await page.goto(url);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
    "href",
    "/login?return_to=%2Fprojects%3Forganization_id%3Dorg-1%26issue%3Dissue-1",
  );
  await page.unrouteAll();
  await fixture(page, { status: 403 });
  await page.reload();
  await expect(page.getByText("Your account does not have access to this record.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
});
test("activity error recovers and empty workspace remains usable", async ({ page }) => {
  await fixture(page, { activityError: true });
  await page.goto(url);
  await page.getByRole("button", { name: "Retry activity" }).click();
  await expect(page.getByRole("button", { name: "Issue updated" })).toBeVisible();
  await page.unrouteAll();
  await fixture(page, { empty: true });
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await expect(page.getByRole("heading", { name: "No projects", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeEnabled();
});
test("project routes preserve context, search and property visibility", async ({ page }) => {
  const { errors } = await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("textbox", { name: "Search projects" }).fill("missing");
  await expect(page.getByText("No matching projects")).toBeVisible();
  await page.getByRole("textbox", { name: "Search projects" }).fill("connections");
  await page.getByRole("link", { name: /Account connections/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Account connections" })).toBeVisible();
  await page.getByRole("link", { name: "Issues", exact: true }).click();
  await page.getByRole("link", { name: /PROJ-24/ }).click();
  await page.getByRole("button", { name: "Toggle issue properties" }).click();
  await expect(page.getByRole("complementary", { name: "Issue properties" })).toBeHidden();
  await page.getByRole("button", { name: "Toggle issue properties" }).click();
  await expect(page.getByRole("complementary", { name: "Issue properties" })).toBeVisible();
  await page.getByRole("link", { name: "Back to project" }).click();
  await expect(page.getByRole("link", { name: /PROJ-24/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Issues", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("workspace discovery lists memberships and switches without IDs", async ({ page }) => {
  await fixture(page);
  await page.goto(`${origin}/projects`);
  await expect(page.getByRole("heading", { name: "Your workspaces" })).toBeVisible();
  await page.getByRole("link", { name: /Product/ }).click();
  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await page.getByRole("link", { name: /Design/ }).click();
  await expect(page).toHaveURL(/organization_id=org-2/);
  await page.unrouteAll();
  await fixture(page, { empty: true });
  await page.goto(`${origin}/projects`);
  await expect(page.getByText("No workspaces yet")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Organization", exact: true })).toHaveCount(0);
});
test("workspace switcher keeps details and supports keyboard search", async ({ page }) => {
  await fixture(page);
  await page.goto(url);
  await page.getByRole("button", { name: "Switch workspace" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Search workspaces" }).fill("design");
  await expect(dialog.getByRole("link", { name: /Product/ })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: /Design/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: issue.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch workspace" })).toBeFocused();
});
test("refresh failures retain results but permission loss clears them", async ({ page }) => {
  await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await expect(page.getByRole("link", { name: /Account connections/ })).toBeVisible();
  await page.route(`${origin}/api/projects?**`, (r) =>
    r.fulfill({ status: 503, json: { detail: "Temporarily unavailable" } }),
  );
  await page.getByRole("button", { name: "Refresh projects", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Showing the previous results");
  await expect(page.getByRole("link", { name: /Account connections/ })).toBeVisible();
  await page.route(`${origin}/api/projects?**`, (r) => r.fulfill({ status: 403, json: {} }));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("link", { name: /Account connections/ })).toHaveCount(0);
  await expect(page.getByText("Your account does not have access to this record.")).toBeVisible();
});
test("returning to projects keeps the workspace's list filters", async ({ page }) => {
  await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("textbox", { name: "Search projects" }).fill("connections");
  await page.getByRole("link", { name: /Account connections/ }).click();
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search projects" })).toHaveValue("connections");
  await page.goto(`${origin}/projects?organization_id=org-2`);
  await expect(page.getByRole("textbox", { name: "Search projects" })).toHaveValue("");
});

test("new project validates fields and retries the same write", async ({ page }) => {
  await fixture(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route(`${origin}/api/projects`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: payloads.length === 1 ? 503 : 200,
      json: payloads.length === 1 ? { detail: "Temporary failure" } : {},
    });
  });
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const d = page.getByRole("dialog");
  const create = d.getByRole("button", { name: "Create project", exact: true });
  await expect(create).toBeEnabled();
  await d.getByRole("textbox", { name: "Name", exact: true }).fill("   ");
  await create.click();
  await expect(d.getByRole("alert")).toHaveText("Enter a project name.");
  expect(payloads).toHaveLength(0);
  await d.getByRole("textbox", { name: "Name", exact: true }).fill("  Shipping  ");
  await d.getByLabel("Start date").fill("2026-09-11");
  await d.getByLabel("Target date").fill("2026-09-10");
  await create.click();
  await expect(d.getByRole("alert")).toContainText("Target date");
  expect(payloads).toHaveLength(0);
  await d.getByLabel("Target date").fill("2026-09-12");
  await create.click();
  await expect(d.getByRole("alert")).toHaveText("Temporary failure");
  await create.click();
  await expect(d).toBeHidden();
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[0].name).toBe("Shipping");
  await expect(page).toHaveURL(new RegExp(String(payloads[0].project_id)));
});
test("catalog failures recover in place and include subsequent pages", async ({ page }) => {
  await fixture(page);
  let requests = 0;
  await page.route(`${origin}/api/projects/catalog/teams?**`, (route) => {
    requests++;
    if (requests === 1)
      return route.fulfill({ status: 503, json: { detail: "Teams unavailable" } });
    const next = new URL(route.request().url()).searchParams.has("after");
    return route.fulfill({
      json: {
        items: next
          ? [{ team_id: "team-2", name: "Design" }]
          : [{ team_id: "team-1", name: "Product" }],
        next_cursor: next ? null : "page-2",
      },
    });
  });
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("textbox", { name: "Name", exact: true }).fill("Keep my draft");
  await d.getByRole("button", { name: "Retry teams and statuses" }).click();
  await expect(d.getByRole("button", { name: "Create project", exact: true })).toBeEnabled();
  await expect(d.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Keep my draft");
  await d.getByRole("combobox", { name: "Lead team" }).click();
  await expect(page.getByRole("option", { name: "Design" })).toBeVisible();
});
test("date-only target dates do not shift in western timezones", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles", locale: "en-US" });
  const page = await context.newPage();
  await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await expect(page.locator(".project-table-row")).toContainText("Sep 10");
  await context.close();
});
test("pending creation freezes its draft and cannot submit twice", async ({ page }) => {
  await fixture(page);
  let count = 0;
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route(`${origin}/api/projects`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    count++;
    await held;
    await route.fulfill({ json: {} });
  });
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("textbox", { name: "Name", exact: true }).fill("Submit once");
  await d.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(d.getByRole("textbox", { name: "Name", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(d).toBeVisible();
  expect(count).toBe(1);
  finish();
  await expect(d).toBeHidden();
  expect(count).toBe(1);
});

test("workspace pages share the Agent-sized header and right-aligned context", async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/projects?organization_id=org-1`);
  const verify = async () => {
    const header = page.getByLabel("Projects navigation", { exact: true });
    const box = await header.boundingBox();
    const title = await page.locator(".workspace-header-title").boundingBox();
    const actions = await page.locator(".workspace-header-actions").boundingBox();
    expect(box?.height).toBe(44);
    expect(actions!.x).toBeGreaterThan(title!.x + title!.width);
    expect(box!.x + box!.width - actions!.x - actions!.width).toBeLessThanOrEqual(20);
    await expect(header.getByRole("button", { name: "Switch workspace" })).toBeVisible();
  };
  await verify();
  await page.getByRole("link", { name: /Account connections/ }).click();
  await expect(page.getByRole("heading", { name: "Account connections" })).toBeVisible();
  await verify();
  await page.getByRole("link", { name: "Issues", exact: true }).click();
  await page.getByRole("link", { name: /PROJ-24/ }).click();
  await expect(page.locator("#issue-state")).toHaveText("Done");
  await verify();
});

test("issue editing preserves relationships, retries once and updates saved content", async ({
  page,
}) => {
  await fixture(page);
  let record = {
    ...issue,
    label_ids: ["label-1"],
    cycle_id: "cycle-1",
    milestone_id: "milestone-1",
    parent_issue_id: "parent-1",
  };
  const writes: any[] = [];
  await page.route(new RegExp(`${origin}/api/issues/issue-1(?:\\?.*)?$`), async (route) => {
    if (route.request().method() !== "PATCH") return route.fulfill({ json: record });
    const body = route.request().postDataJSON();
    writes.push(body);
    if (writes.length === 1)
      return route.fulfill({ status: 503, json: { detail: "Temporary failure" } });
    record = { ...record, ...body, revision: 3 };
    return route.fulfill({ json: record });
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Edit issue", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Updated issue");
  await page.getByLabel("Description", { exact: true }).fill("Updated description");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary failure");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Updated issue");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Updated issue" })).toBeVisible();
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[1]).toMatchObject({
    expected_revision: "2",
    label_ids: ["label-1"],
    cycle_id: "cycle-1",
    milestone_id: "milestone-1",
    parent_issue_id: "parent-1",
    priority: "high",
  });
});

test("issue conflicts require review and permission failures retain the draft", async ({
  page,
}) => {
  await fixture(page);
  let current = { ...issue };
  let count = 0;
  await page.route(new RegExp(`${origin}/api/issues/issue-1(?:\\?.*)?$`), async (route) => {
    if (route.request().method() !== "PATCH") return route.fulfill({ json: current });
    count++;
    if (count === 1) {
      current = { ...issue, title: "Changed by another user", revision: 3 };
      return route.fulfill({ status: 409, json: {} });
    }
    expect(route.request().postDataJSON().expected_revision).toBe("3");
    return route.fulfill({ status: 403, json: {} });
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Edit issue", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("My draft");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  await page.getByRole("button", { name: "Review latest version" }).click();
  await expect(page.getByText("Changed by another user", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("My draft");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toContainText("does not have access");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("My draft");
});

test("assignee selector persists a member and preserves selection on failure", async ({ page }) => {
  await fixture(page);
  let saved = { assignee_subject: null as string | null, revision: "2" };
  const writes: Record<string, unknown>[] = [];
  await page.route(
    new RegExp(`${origin}/api/issues/issue-1/assignee(?:\\?.*)?$`),
    async (route) => {
      if (route.request().method() !== "PATCH") return route.fulfill({ json: saved });
      writes.push(route.request().postDataJSON());
      if (writes.length === 1) return route.fulfill({ status: 503, json: { detail: "Try again" } });
      saved = { assignee_subject: "user-1", revision: "3" };
      return route.fulfill({ json: saved });
    },
  );
  await page.goto(url);
  await page.getByRole("combobox", { name: "Assignee", exact: true }).click();
  await page.getByRole("option", { name: "You", exact: true }).click();
  await page.getByRole("button", { name: "Save assignee" }).click();
  await expect(page.getByRole("alert")).toContainText("Try again");
  await expect(page.getByRole("combobox", { name: "Assignee", exact: true })).toContainText("You");
  await page.getByRole("button", { name: "Save assignee" }).click();
  await expect(page.getByRole("button", { name: "Save assignee" })).toBeHidden();
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[1]).toMatchObject({ expected_revision: "2", assignee_subject: "user-1" });
});
