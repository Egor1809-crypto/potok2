import { sql } from "drizzle-orm";
import { getD1 } from "@/db";
import { contacts, campaigns } from "@/db/schema";
import type { ParticipantRecord, ContactRecord } from "@/types/api";
import { contactIsAccessible, hasAllContactAccess, isTeamAdmin, normalizeContactAccess } from "@/lib/team-access";
import { ApiRequestError } from "./api-utils";

export function requireTeamAdmin(actor: ParticipantRecord) {
  if (!isTeamAdmin(actor)) throw new ApiRequestError("Это действие доступно администратору команды.", 403);
}
export function requireContactAccess(actor: ParticipantRecord, contact: Pick<ContactRecord, "workspaceId" | "responsibleParticipantId" | "createdByParticipantId" | "tags">) {
  if (!contactIsAccessible(actor, contact)) throw new ApiRequestError("Контакт не найден в доступных вам базах и группах.", 404);
}
export function contactAccessSql(actor: ParticipantRecord) {
  if (actor.status !== "active") return sql`0`;
  if (hasAllContactAccess(actor)) return sql`1`;
  const scope = normalizeContactAccess(actor.accessScope);
  return sql`(coalesce(${contacts.responsibleParticipantId}, ${contacts.createdByParticipantId}) IN (SELECT value FROM json_each(${JSON.stringify(scope.baseIds)})) OR EXISTS (SELECT 1 FROM json_each(${contacts.tags}) AS granted_tag WHERE granted_tag.value IN (SELECT value FROM json_each(${JSON.stringify(scope.groupTags)}))))`;
}
export function rawContactAccess(actor: ParticipantRecord) {
  if (actor.status !== "active") return { condition: "0", params: [] as string[] };
  if (hasAllContactAccess(actor)) return { condition: "1", params: [] as string[] };
  const scope = normalizeContactAccess(actor.accessScope);
  return { condition: "(coalesce(contacts.responsible_participant_id, contacts.created_by_participant_id) IN (SELECT value FROM json_each(?)) OR EXISTS (SELECT 1 FROM json_each(contacts.tags) AS granted_tag WHERE granted_tag.value IN (SELECT value FROM json_each(?))))", params: [JSON.stringify(scope.baseIds), JSON.stringify(scope.groupTags)] };
}
export function campaignAccessSql(actor: ParticipantRecord) {
  return isTeamAdmin(actor) ? sql`1` : sql`${campaigns.participantId} = ${actor.id}`;
}
export function requireCampaignAccess(actor: ParticipantRecord, campaign: { workspaceId: string; participantId: string }) {
  if (actor.status !== "active" || actor.workspaceId !== campaign.workspaceId || !isTeamAdmin(actor) && actor.id !== campaign.participantId) throw new ApiRequestError("Рассылка не найдена среди доступных вам кампаний.", 404);
}
export async function accessParticipant(id: string): Promise<ParticipantRecord> {
  const row = await getD1().prepare("SELECT id, workspace_id, display_name, login, email, color, status, role, access_scope, last_login_at, created_at, updated_at FROM participants WHERE id = ?").bind(id).first<Record<string, string>>();
  if (!row) throw new ApiRequestError("Участник команды не найден.", 404);
  return { id: row.id, workspaceId: row.workspace_id, displayName: row.display_name, login: row.login || "", email: row.email, color: row.color, status: row.status === "active" ? "active" : "disabled", role: row.role === "admin" ? "admin" : "member", accessScope: normalizeContactAccess(JSON.parse(row.access_scope || "{}")), lastLoginAt: row.last_login_at || null, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function requireAudienceAccess(participantId: string, audience: ContactRecord[]) {
  const actor = await accessParticipant(participantId);
  if (actor.status !== "active" || audience.some(contact => !contactIsAccessible(actor, contact))) throw new ApiRequestError("Отправка остановлена: у автора рассылки больше нет доступа ко всем получателям. Администратор должен проверить назначения в команде.", 403);
}
