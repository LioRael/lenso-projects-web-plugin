import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
export default defineConfig({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [
    react(),
    {
      name: "console-runtime-wrapper",
      closeBundle() {
        const path = "../src/workspace/workspace.js";
        const bundle = readFileSync(path, "utf8");
        writeFileSync(
          path,
          `export const apiMajor = 1;\nexport function createWorkspace(runtime) {\nconst React = runtime.react;
const require = (name) => { if (name === "react") return React; throw new Error("Unsupported workspace dependency: " + name); };\nconst JSX = { Fragment: React.Fragment, jsx: (type, props, key) => runtime.createElement(type, key === undefined ? props : {...props,key}), jsxs: (type, props, key) => runtime.createElement(type, key === undefined ? props : {...props,key}) };\n${bundle}\nreturn ProjectsModule.create(runtime);\n}\n`,
        );
      },
    },
  ],
  build: {
    outDir: "../src/workspace",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: "src/workspace-entry.tsx",
      name: "ProjectsModule",
      formats: ["iife"],
      fileName: () => "workspace.js",
      cssFileName: "workspace",
    },
    rolldownOptions: {
      external: ["react", "react/jsx-runtime"],
      output: { globals: { react: "React", "react/jsx-runtime": "JSX" } },
    },
  },
});
