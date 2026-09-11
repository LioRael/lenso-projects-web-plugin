import type { ReactNode } from "react";
import { PageHeader } from "@lenso/ui/page-header";
import { WorkspaceSwitch } from "./workspace-picker";

/** Match the Console Agent header: one wrapping row, local navigation left, context right. */
export function WorkspaceHeader({
  org,
  children,
  views,
  actions,
}: {
  org: string;
  children: ReactNode;
  views?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHeader.Root
      aria-label="Projects navigation"
      style={{ height: "auto", position: "relative", zIndex: 4 }}
    >
      <PageHeader.Row style={{ flexWrap: "wrap", height: "auto", minHeight: 44 }}>
        <div className="workspace-header-title">{children}</div>
        {views && (
          <nav className="workspace-header-views" aria-label="Project views">
            {views}
          </nav>
        )}
        <div className="workspace-header-actions">
          <WorkspaceSwitch org={org} />
          {actions}
        </div>
      </PageHeader.Row>
    </PageHeader.Root>
  );
}
