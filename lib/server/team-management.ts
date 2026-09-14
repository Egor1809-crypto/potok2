import { getWorkspaceId } from "./workspace-context";
import { getD1 } from "@/db";
import type { ContactAccessScope, ParticipantRecord, TeamRole } from "@/types/api";
import { emptyContactAccess, isTeamAdmin, normalizeContactAccess } from "@/lib/team-access";
import { ApiRequestError, asObject, cleanText, newId } from "./api-utils";
import {ensureDatabase } from "./database-init";
import { listTeamMembers, sha256, TEAM_NAME } from "./team-auth";
import { accessParticipant, requireTeamAdmin } from "./team-access";

function accessInput(value: unknown): { role: TeamRole; accessScope: ContactAccessScope } {
  const input = asObject(value);
  if (input.role !== "admin" && input.role !== "member") throw new ApiRequestError("Выберите роль администратора или сотрудника.");
  const raw = asObject(input.accessScope ?? emptyContactAccess());
  if (typeof raw.all !== "boolean" || !Array.isArray(raw.baseIds) || !Array.isArray(raw.groupTags) || [...raw.baseIds, ...raw.groupTags].some(v => typeof v !== "string" || v.length > 200) || raw.baseIds.length > 200 || raw.groupTags.length > 200) throw new ApiRequestError("Проверьте выбранные базы и группы.");
  return { role: input.role, accessScope: input.role === "admin" ? { ...emptyContactAccess(), all: true } : normalizeContactAccess(raw) };
}
async function validateBases(scope: ContactAccessScope) {
  if (!scope.baseIds.length) return;
  const rows = await getD1().prepare("SELECT id FROM participants WHERE workspace_id=? AND id IN (SELECT value FROM json_each(?))").bind(getWorkspaceId(), JSON.stringify(scope.baseIds)).all();
  if (rows.results.length !== scope.baseIds.length) throw new ApiRequestError("Одна из баз больше не существует. Обновите список.", 409);
}
function audit(actorId: string, targetId: string, action: string, details: Record<string, unknown>) {
  return getD1().prepare("INSERT INTO team_access_events (id,workspace_id,actor_id,target_id,action,details,created_at) VALUES (?,?,?,?,?,?,?)").bind(newId("team-event"),getWorkspaceId(),actorId,targetId,action,JSON.stringify(details),new Date().toISOString());
}
export async function teamOverview(request: Request) {
  const { participant } = await ensureDatabase(request);
  const canManage = isTeamAdmin(participant);
  const members = canManage ? await listTeamMembers() : [participant];
  if (!canManage) {
    const assigned = await getD1().prepare("SELECT id,display_name AS label,0 AS count FROM participants WHERE workspace_id=? AND id IN (SELECT value FROM json_each(?))").bind(getWorkspaceId(), JSON.stringify(participant.accessScope.baseIds)).all();
    return { teamName: TEAM_NAME, participant, canManage, members, bases: assigned.results, groups: [], invites: [], events: [] };
  }
  const db = getD1();
  const [bases, groups, invites, events] = await Promise.all([
    db.prepare("SELECT coalesce(responsible_participant_id,created_by_participant_id) AS id,count(*) AS count FROM contacts WHERE workspace_id=? GROUP BY coalesce(responsible_participant_id,created_by_participant_id)").bind(getWorkspaceId()).all<{id:string;count:number}>(),
    db.prepare("SELECT j.value AS label,count(*) AS count FROM contacts,json_each(contacts.tags) j WHERE contacts.workspace_id=? AND j.type='text' GROUP BY j.value ORDER BY j.value LIMIT 2000").bind(getWorkspaceId()).all(),
    db.prepare("SELECT id,label,role,access_scope,target_participant_id,expires_at,use_count,revoked_at,accepted_participant_id,created_at FROM team_invites WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50").bind(getWorkspaceId()).all(),
    db.prepare("SELECT e.*,p.display_name AS actor_name FROM team_access_events e LEFT JOIN participants p ON p.id=e.actor_id WHERE e.workspace_id=? ORDER BY e.created_at DESC LIMIT 30").bind(getWorkspaceId()).all(),
  ]);
  const counts = new Map(bases.results.map(b => [b.id,Number(b.count)]));
  return { teamName: TEAM_NAME, participant, canManage, members, bases: members.map(member => ({ id:member.id,label:member.displayName,count:counts.get(member.id)||0 })), groups:groups.results, invites:invites.results, events:events.results };
}
export function accessIsReduced(previous: ParticipantRecord, next: { role: TeamRole; accessScope: ContactAccessScope; status: string }) {
  if (next.status === "disabled") return previous.status !== "disabled";
  if (next.role === "admin") return false;
  if (previous.role === "admin") return true;
  if (next.accessScope.all) return false;
  const before=normalizeContactAccess(previous.accessScope);
  return before.all || before.baseIds.some(id=>!next.accessScope.baseIds.includes(id)) || before.groupTags.some(tag=>!next.accessScope.groupTags.includes(tag));
}
export async function manageTeam(request: Request, payload: unknown) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiRequestError("Нельзя изменить доступ с другого сайта.",403);
  const { participant: actor } = await ensureDatabase(request);
  requireTeamAdmin(actor);
  const input=asObject(payload), db=getD1(), now=new Date().toISOString();
  const action=input.action || "invite";
  if (action === "revoke_invite") {
    const id=cleanText(input.id,"Приглашение",120);
    await db.batch([db.prepare("UPDATE team_invites SET revoked_at=? WHERE id=? AND workspace_id=? AND use_count=0").bind(now,id,getWorkspaceId()),audit(actor.id,id,"invite_revoked",{})]);
    return { message:"Приглашение отменено." };
  }
  const access=accessInput(input);
  await validateBases(access.accessScope);
  if (action === "invite") {
    const targetId=input.targetParticipantId ? cleanText(input.targetParticipantId,"Участник",120) : null;
    if (targetId) { const target=await accessParticipant(targetId); if (target.workspaceId !== getWorkspaceId() || target.login) throw new ApiRequestError("У участника уже есть аккаунт. Измените его доступ в списке команды.",409); }
    const label=typeof input.label === "string" ? cleanText(input.label,"Имя коллеги",150) : "";
    const code=`POTOK-${crypto.randomUUID().replaceAll("-","").toUpperCase()}`;
    const id=newId("invite"), expiresAt=new Date(Date.now()+7*86400000).toISOString();
    await db.batch([db.prepare("INSERT INTO team_invites (id,workspace_id,code_hash,created_by_participant_id,expires_at,max_uses,use_count,role,access_scope,label,target_participant_id,created_at) VALUES (?,?,?,?,?,1,0,?,?,?,?,?)").bind(id,getWorkspaceId(),await sha256(code),actor.id,expiresAt,access.role,JSON.stringify(access.accessScope),label,targetId,now),audit(actor.id,id,"invite_created",{label,...access})]);
    return { id,code,expiresAt,label,...access,path:`/register?invite=${encodeURIComponent(code)}`,message:"Приглашение готово. Скопируйте ссылку и передайте коллеге." };
  }
  if (action !== "update_member") throw new ApiRequestError("Неизвестное действие команды.");
  const id=cleanText(input.id,"Участник",120), previous=await accessParticipant(id);
  if (previous.workspaceId!==getWorkspaceId()) throw new ApiRequestError("Участник не найден.",404);
  const status=input.status === "disabled" ? "disabled" : input.status === "active" ? "active" : null;
  if (!status) throw new ApiRequestError("Выберите статус участника.");
  if (id===actor.id && status==='disabled') throw new ApiRequestError("Нельзя отключить собственный аккаунт.",409);
  const expected=cleanText(input.updatedAt,"Версия настроек",100);
  if (expected!==previous.updatedAt) throw new ApiRequestError("Настройки уже изменил другой администратор. Обновите список.",409);
  if (previous.role === "admin" && (access.role !== "admin" || status !== "active")) {
    const other = await db.prepare("SELECT id FROM participants WHERE workspace_id=? AND id<>? AND role='admin' AND status='active' AND password_hash IS NOT NULL LIMIT 1").bind(getWorkspaceId(),id).first();
    if (!other) throw new ApiRequestError("В команде должен остаться хотя бы один активный администратор.",409);
  }
  const reduced=accessIsReduced(previous,{...access,status});
  if (reduced) {
    const scheduled=await db.prepare("SELECT id FROM campaigns WHERE workspace_id=? AND participant_id=? AND status='scheduled'").bind(getWorkspaceId(),id).all<{id:string}>();
    if (scheduled.results.length) {
      const { updateCampaign }=await import("./mailflow-store");
      for (const campaign of scheduled.results) {
        try { await updateCampaign(request,{id:campaign.id,action:"cancel"}); }
        catch { throw new ApiRequestError("Не удалось подтвердить отмену запланированной рассылки. Доступ пока не изменён. Отмените её в календаре и повторите действие.",409); }
      }
    }
  }
  // A single conditional UPDATE prevents two administrators from disabling or
  // demoting each other concurrently and leaving the team without an admin.
  const lastAdminGuard="(role<>'admin' OR (?='admin' AND ?='active') OR EXISTS (SELECT 1 FROM participants other WHERE other.workspace_id=participants.workspace_id AND other.id<>participants.id AND other.role='admin' AND other.status='active' AND other.password_hash IS NOT NULL))";
  const update=db.prepare(`UPDATE participants SET role=?,access_scope=?,status=?,updated_at=? WHERE id=? AND workspace_id=? AND updated_at=? AND ${lastAdminGuard} AND EXISTS (SELECT 1 FROM participants executor WHERE executor.id=? AND executor.role='admin' AND executor.status='active')`).bind(access.role,JSON.stringify(access.accessScope),status,now,id,getWorkspaceId(),expected,access.role,status,actor.id);
  const statements=[update];
  if (access.role !== "admin" || status === "disabled") statements.push(db.prepare("UPDATE team_invites SET revoked_at=? WHERE workspace_id=? AND created_by_participant_id=? AND use_count=0 AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM participants WHERE id=? AND updated_at=?)").bind(now,getWorkspaceId(),id,id,now));
  if (status==='disabled') statements.push(db.prepare("DELETE FROM auth_sessions WHERE participant_id=? AND EXISTS (SELECT 1 FROM participants WHERE id=? AND status='disabled')").bind(id,id));
  statements.push(db.prepare("INSERT INTO team_access_events (id,workspace_id,actor_id,target_id,action,details,created_at) SELECT ?,?,?,?,'member_updated',?,? WHERE EXISTS (SELECT 1 FROM participants WHERE id=? AND updated_at=?)").bind(newId("team-event"),getWorkspaceId(),actor.id,id,JSON.stringify({before:{role:previous.role,accessScope:previous.accessScope,status:previous.status},after:{...access,status}}),now,id,now));
  const results=await db.batch(statements);
  if (Number(results[0].meta.changes)!==1) throw new ApiRequestError("Изменение не применено. В команде должен оставаться хотя бы один активный администратор; проверьте также, не изменились ли настройки параллельно.",409);
  return { message:status==='disabled'?"Доступ отключён, активные сессии завершены.":"Роль и доступ сохранены.", participant:await accessParticipant(id) };
}
