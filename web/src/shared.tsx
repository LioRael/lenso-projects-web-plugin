import type { ReactNode } from "react";
import { ContentState } from "@lenso/ui/content-state";
import { Button } from "@lenso/ui/button";
import { DescriptionList } from "@lenso/ui/description-list";
import { Disclosure } from "@lenso/ui/disclosure";
import { ApiError, query } from "./api";

export function Properties({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <DescriptionList.Root>
      {rows.map(([name, value]) => (
        <DescriptionList.Item key={name}>
          <DescriptionList.Term>{name}</DescriptionList.Term>
          <DescriptionList.Description>{value}</DescriptionList.Description>
        </DescriptionList.Item>
      ))}
    </DescriptionList.Root>
  );
}
export function Details({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Disclosure.Root>
      <Disclosure.Item>
        <Disclosure.Header>
          <Disclosure.Trigger>
            {title}
            <Disclosure.Icon />
          </Disclosure.Trigger>
        </Disclosure.Header>
        <Disclosure.Panel>
          <div className="disclosure-content">{children}</div>
        </Disclosure.Panel>
      </Disclosure.Item>
    </Disclosure.Root>
  );
}
export function Feedback({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <ContentState.Root>
      <ContentState.Title as="h2">
        {error instanceof ApiError && error.status === 401
          ? "Sign in to continue"
          : "Unable to load this page"}
      </ContentState.Title>
      <ContentState.Description>{error.message}</ContentState.Description>
      <ContentState.Actions>
        {error instanceof ApiError && error.status === 401 ? (
          <Button
            nativeButton={false}
            role="link"
            render={
              <a href={"/login?" + query({ return_to: location.pathname + location.search })} />
            }
          >
            Sign in
          </Button>
        ) : (
          retry && (
            <Button onClick={retry} variant="secondary">
              Try again
            </Button>
          )
        )}
      </ContentState.Actions>
    </ContentState.Root>
  );
}
export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <ContentState.Root>
      <ContentState.Title as="h2">{title}</ContentState.Title>
      {description && <ContentState.Description>{description}</ContentState.Description>}
    </ContentState.Root>
  );
}
