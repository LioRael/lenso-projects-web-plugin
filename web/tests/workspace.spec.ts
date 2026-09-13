import { test, expect } from "@playwright/test";

test("compiled Workspace contributes one sidebar, serializes requests and retains team and Agent context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:55441/tests/workspace-fixture.html");
  const sidebar = page.getByRole("complementary", { name: "Host sidebar" });
  await expect(sidebar.getByRole("button", { name: "Switch workspace" })).toBeVisible();
  await sidebar.getByRole("button", { name: "Product", exact: true }).click();
  await sidebar.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("link", { name: /Team issue/ }).click();
  await expect(page.getByRole("heading", { name: "Team issue", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Agent context" })).toContainText("TEA-1");
  const evidence = await page.evaluate(
    () =>
      (
        window as unknown as {
          workspaceEvidence: {
            peak: number;
            calls: { operation: string; body: Record<string, unknown> }[];
          };
        }
      ).workspaceEvidence,
  );
  expect(
    evidence.calls.some(
      ({ operation, body }) =>
        operation === "list_team_issues" &&
        body.organization_id === "org-1" &&
        body.team_id === "team-1",
    ),
  ).toBe(true);
  expect(evidence.peak).toBe(1);
  await expect(sidebar.getByRole("button", { name: "Switch workspace" })).toHaveCount(1);
  const alignment = await page.evaluate(() => {
    const left = (selector: string) => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(selector)!);
      return range.getBoundingClientRect().left;
    };
    return Math.abs(left(".workspace-switch-name") - left(".projects-navigation-label"));
  });
  expect(alignment).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
