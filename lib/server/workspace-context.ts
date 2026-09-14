import { AsyncLocalStorage } from "node:async_hooks";
import type { TeamSession } from "./team-auth";

export const LEGACY_WORKSPACE_ID = "workspace-main";
type WorkspaceContext = { workspaceId: string; session?: TeamSession; request?: Request };
const contexts = new AsyncLocalStorage<WorkspaceContext>();

/** Scope is request-local: never mutate a module-level workspace identifier. */
export function withWorkspace<T>(workspaceId: string, operation: () => T, session?: TeamSession, request?: Request): T {
  return contexts.run({ workspaceId, session, request }, operation);
}
export function getWorkspaceId(): string {
  const context = contexts.getStore();
  if (!context) throw new Error("An authenticated workspace context is required");
  return context.workspaceId;
}
export function cachedWorkspaceSession(request: Request): TeamSession | undefined {
  const context = contexts.getStore();
  return context?.request === request ? context.session : undefined;
}
export function isLegacyWorkspace(): boolean {
  return contexts.getStore()?.workspaceId === LEGACY_WORKSPACE_ID;
}
