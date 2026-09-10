import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const digest = () =>
  ["assets", "workspace"]
    .flatMap((directory) =>
      readdirSync(`../src/${directory}`).map((file) => `${directory}/${file}`),
    )
    .sort()
    .map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(`../src/${file}`))
        .digest("hex"),
    ]);
const before = JSON.stringify(digest());
execFileSync("npm", ["run", "build"], { stdio: "inherit" });
if (JSON.stringify(digest()) !== before)
  throw new Error(
    "Embedded UI assets are stale. Run npm --prefix web run build and commit src/assets.",
  );
