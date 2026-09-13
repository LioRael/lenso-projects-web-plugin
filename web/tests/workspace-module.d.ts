declare module "*workspace/workspace.js" {
  import type { ComponentType, ReactNode, createElement } from "react";
  import type * as React from "react";
  export const apiMajor: 1;
  export function createWorkspace(runtime: {
    react: typeof React;
    createElement: typeof createElement;
    services: {
      invoke<T, R>(
        service: string,
        operation: string,
        request: T,
        options?: { signal?: AbortSignal },
      ): Promise<R>;
    };
  }): {
    Page: ComponentType<{
      agent?: {
        completedTurns: number;
        setPageContext(context: { label: string; text: string } | null): void;
      };
      chrome?: { Sidebar: ComponentType<{ children: ReactNode }> };
      environment: { locale: string; theme: string };
      location: { segments: readonly string[] };
      navigation: {
        go(segments: readonly string[]): void;
        href(segments: readonly string[]): string;
      };
      signal: AbortSignal;
    }>;
  };
}
