import "./layers.css";
import { StrictMode, useState, useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { ThemeScope } from "@lenso/ui/theme-scope";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@lenso/tokens/styles.css";
import "@lenso/ui/preflight.css";
import "@lenso/ui/styles.css";
import "./layout.css";
import { IssuePage } from "./issue";
import { Workspace } from "./workspace";

const params = new URLSearchParams(location.search);
const org = params.get("organization_id") || "";
const issue = params.get("issue");
function App() {
  const [theme] = useState<"light" | "dark" | "system">("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);
  return (
    <ThemeScope theme={theme === "system" ? systemTheme : theme}>
      <main className="work-surface projects-workspace">
        {issue && org ? <IssuePage org={org} id={issue} /> : <Workspace org={org} />}
      </main>
    </ThemeScope>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
