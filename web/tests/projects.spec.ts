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
  lead_team_id: "team-1",
  team_ids: ["team-1"],
  name: "Account connections",
  summary: "Connect once and continue working in your business App.",
  status_id: "active",
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
        return route.fulfill({
          json: path.endsWith("/issues") ? issue : {},
        });
      }
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
  await page.getByRole("button", { name: /Account connections/ }).click();
  await expect(page.getByRole("link", { name: /PROJ-24/ })).toHaveAttribute(
    "href",
    "/projects?organization_id=org-1&issue=issue-1",
  );
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
test("creates an issue with the owner contract and opens the created record", async ({ page }) => {
  const { errors, writes } = await fixture(page);
  await page.goto(`${origin}/projects?organization_id=org-1`);
  await page.getByRole("button", { name: "New issue", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Investigate trace");
  await page.getByRole("textbox", { name: "Description" }).fill("Trace ID: trace-1");
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(page.getByRole("heading", { name: issue.title })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    organization_id: "org-1",
    project_id: "project-1",
    team_id: "team-1",
    title: "Investigate trace",
    description: "Trace ID: trace-1",
    priority: "none",
    workflow_state_id: "done",
    label_ids: [],
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
