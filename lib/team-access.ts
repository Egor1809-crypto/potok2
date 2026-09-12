import type { ContactAccessScope, ParticipantRecord } from "@/types/api";

export const emptyContactAccess = (): ContactAccessScope => ({ all: false, baseIds: [], groupTags: [] });
export function normalizeContactAccess(value: unknown): ContactAccessScope {
  const source = value && typeof value === "object" ? value as Partial<ContactAccessScope> : {};
  const list = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((v): v is string => typeof v === "string" && Boolean(v.trim())).map(v => v.trim()))].slice(0, 200) : [];
  return { all: source.all === true, baseIds: list(source.baseIds), groupTags: list(source.groupTags) };
}
export const isTeamAdmin = (actor: Pick<ParticipantRecord, "role" | "status">) => actor.status === "active" && actor.role === "admin";
export const hasAllContactAccess = (actor: ParticipantRecord) => actor.status === "active" && (isTeamAdmin(actor) || actor.accessScope?.all === true);
export function contactIsAccessible(actor: ParticipantRecord, contact: { workspaceId: string; responsibleParticipantId?: string | null; createdByParticipantId?: string | null; tags: string[] }) {
  if (actor.status !== "active" || actor.workspaceId !== contact.workspaceId) return false;
  if (hasAllContactAccess(actor)) return true;
  const scope = normalizeContactAccess(actor.accessScope);
  const base = contact.responsibleParticipantId || contact.createdByParticipantId;
  return Boolean(base && scope.baseIds.includes(base)) || contact.tags.some(tag => scope.groupTags.includes(tag));
}
