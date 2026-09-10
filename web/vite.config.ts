import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { renameSync } from "node:fs";
export default defineConfig({
  base: "/projects/assets/",
  plugins: [
    react(),
    {
      name: "rust-page-asset",
      closeBundle() {
        renameSync("../src/assets/index.html", "../src/assets/app.html");
      },
    },
  ],
  build: {
    outDir: "../src/assets",
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rolldownOptions: {
      output: { entryFileNames: "app.js", assetFileNames: "app.[ext]", codeSplitting: false },
    },
  },
});
