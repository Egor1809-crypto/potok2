import { privateWorkspaceStatements } from "./workspace-provisioning";
import { cachedWorkspaceSession, getWorkspaceId } from "./workspace-context";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import { getD1, getDb } from "@/db";
import {
  authSessions,
  participants,
  teamInvites,
} from "@/db/schema";
import type { ParticipantRecord } from "@/types/api";
import { ApiRequestError, asObject, cleanText, newId } from "./api-utils";
import { normalizeContactAccess, emptyContactAccess } from "@/lib/team-access";
import { readSession } from "./session-read";

export const TEAM_NAME = "ТехнологИИ Права";
export const TEAM_WORKSPACE_ID = "workspace-main";
export const SESSION_COOKIE = "potok_session";

const SESSION_DAYS = 30;
// Keep password derivation strong while staying within the CPU budget of the
// edge runtime. The former 210k setting caused registration requests to time
// out on the deployed worker before a session could be created.
const PASSWORD_ITERATIONS = 75_000;
const TEAM_COLORS = [
  "#6558E8",
  "#0E7490",
  "#C2410C",
  "#047857",
  "#BE185D",
  "#1D4ED8",
  "#7E22CE",
  "#B45309",
  "#0F766E",
  "#4338CA",
  "#B91C1C",
  "#4D7C0F",
];

type ParticipantRow = typeof participants.$inferSelect;

export type TeamSession = {
  participant: ParticipantRecord;
  sessionId: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64Url(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function passwordDigest(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function normalizeLogin(value: unknown): string {
  const login = cleanText(value, "Логин", 40).toLocaleLowerCase("ru-RU");
  if (!/^[a-zа-яё0-9][a-zа-яё0-9._-]{2,39}$/iu.test(login)) {
    throw new ApiRequestError(
      "Логин должен содержать от 3 до 40 букв или цифр; можно использовать точку, дефис и подчёркивание.",
    );
  }
  return login;
}

function normalizeDisplayName(value: unknown): string {
  return cleanText(value, "Имя", 100);
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new ApiRequestError("Пароль должен содержать от 10 до 128 символов.");
  }
  if (!/[A-Za-zА-Яа-яЁё]/u.test(value) || !/\d/u.test(value)) {
    throw new ApiRequestError("Добавьте в пароль хотя бы одну букву и одну цифру.");
  }
  return value;
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) { try { return decodeURIComponent(rest.join("=")); } catch { return null; } }
  }
  return null;
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookie(request: Request, token: string): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function toTeamParticipant(row: ParticipantRow): ParticipantRecord {
  return {
    role: row.role,
    accessScope: row.accessScope,
    id: row.id,
    workspaceId: row.workspaceId,
    login: row.login ?? "",
    displayName: row.displayName,
    email: row.email,
    color: row.color,
    status: row.status === "disabled" ? "disabled" : "active",
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function applyRateLimit(request: Request, login: string) {
  const rawIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
  const actor = await sha256(`${rawIp.split(",")[0].trim()}:${login}`);
  const key = `auth:${actor}`;
  const now = Date.now();
  const windowStart = new Date(now - 15 * 60_000).toISOString();
  const current = await getD1()
    .prepare("SELECT window_started_at, request_count FROM ai_request_limits WHERE key = ?")
    .bind(key)
    .first<{ window_started_at: string; request_count: number }>();
  if (current && current.window_started_at > windowStart && current.request_count >= 12) {
    throw new ApiRequestError("Слишком много попыток входа. Повторите через 15 минут.", 429);
  }
  const nextWindow = !current || current.window_started_at <= windowStart;
  await getD1()
    .prepare(`INSERT INTO ai_request_limits (key, workspace_id, scope, window_started_at, request_count, updated_at)
      VALUES (?, ?, 'team-auth', ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        window_started_at = CASE WHEN window_started_at <= ? THEN excluded.window_started_at ELSE window_started_at END,
        request_count = CASE WHEN window_started_at <= ? THEN 1 ELSE request_count + 1 END,
        updated_at = excluded.updated_at`)
    .bind(key, TEAM_WORKSPACE_ID, new Date(now).toISOString(), new Date(now).toISOString(), windowStart, windowStart)
    .run();
  return nextWindow;
}

export async function createSession(participantId: string, request: Request) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400_000).toISOString();
  const id = newId("session");
  await getDb().insert(authSessions).values({
    id,
    participantId,
    tokenHash,
    expiresAt,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
  });
  return { token, id, cookie: sessionCookie(request, token) };
}

export async function getTeamSession(request: Request): Promise<TeamSession | null> {
  const cached = cachedWorkspaceSession(request);
  if (cached) return cached;
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const [row] = await readSession(() => getDb()
    .select({ session: authSessions, participant: participants })
    .from(authSessions)
    .innerJoin(participants, eq(authSessions.participantId, participants.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
    .limit(1), request.signal);
  if (!row || row.participant.status !== "active") return null;
  if (Date.now() - Date.parse(row.session.lastSeenAt) > 60 * 60_000) {
    try { await getDb().update(authSessions).set({ lastSeenAt: now }).where(eq(authSessions.id, row.session.id)); }
    catch { console.warn("Team session activity timestamp was not updated"); }
  }
  return { participant: toTeamParticipant(row.participant), sessionId: row.session.id };
}

export async function requireTeamSession(request: Request): Promise<TeamSession> {
  const session = await getTeamSession(request);
  if (!session) throw new ApiRequestError("Войдите в команду, чтобы продолжить.", 401);
  return session;
}

export async function getRegistrationStatus() {
  return { teamName: TEAM_NAME, firstAccountAvailable: false, publicRegistration: true };
}

export async function registerTeamMember(request: Request, payload: unknown) {
  const object = asObject(payload);
  const team = cleanText(object.team, "Команда", 100);
  if (team.toLocaleLowerCase("ru-RU") !== TEAM_NAME.toLocaleLowerCase("ru-RU")) {
    throw new ApiRequestError("Команда не найдена. Проверьте название или приглашение.", 404);
  }
  const login = normalizeLogin(object.login);
  const displayName = normalizeDisplayName(object.displayName);
  const password = validatePassword(object.password);
  await applyRateLimit(request, login);
  const db = getDb();
  const [existingLogin] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.login, login))
    .limit(1);
  if (existingLogin) throw new ApiRequestError("Этот логин уже занят.", 409);

  const [{ count: accountCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(isNotNull(participants.passwordHash));
  // Public signup always creates a private tenant, including an empty database.
  const isFirst = false;
  if (!isFirst && !String(object.inviteCode ?? "").trim()) {
    const participantId = newId("participant"), salt = randomToken(18);
    const workspace = await privateWorkspaceStatements({participantId, displayName, login, email: `${login}@account.potok.local`, passwordHash: await passwordDigest(password, salt), passwordSalt: salt});
    await getD1().batch(workspace.statements);
    const [participant] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
    const session = await createSession(participantId, request);
    return { participant: toTeamParticipant(participant), cookie: session.cookie, firstAccount: false };
  }
  const now = new Date().toISOString();
  let invite: typeof teamInvites.$inferSelect | undefined;
  if (!isFirst) {
    const code = cleanText(object.inviteCode, "Код приглашения", 120);
    [invite] = await db.select().from(teamInvites).where(and(eq(teamInvites.codeHash, await sha256(code.toLocaleUpperCase("ru-RU"))), gt(teamInvites.expiresAt, now), isNull(teamInvites.revokedAt))).limit(1);
    if (!invite || invite.useCount >= invite.maxUses) throw new ApiRequestError("Приглашение истекло, отменено или уже использовано. Попросите администратора создать новое.", 403);
  }
  const workspaceId = invite?.workspaceId ?? TEAM_WORKSPACE_ID;
  const salt = randomToken(18);
  const passwordHash = await passwordDigest(password, salt);
  const targetId = invite?.targetParticipantId || (isFirst ? "participant-main" : null);
  const [target] = targetId ? await db.select().from(participants).where(and(eq(participants.id, targetId), eq(participants.workspaceId, workspaceId))).limit(1) : [];
  if (target && (target.login || target.passwordHash)) throw new ApiRequestError("Для этого участника уже создан аккаунт. Войдите по логину и паролю.", 409);
  const participantId = target?.id || newId("participant");
  const nonce = randomToken(24);
  const role = isFirst ? "admin" : invite?.role === "admin" ? "admin" : "member";
  const scope = JSON.stringify(role === "admin" ? { ...emptyContactAccess(), all: true } : normalizeContactAccess(invite?.accessScope));
  const d1 = getD1();
  const statements: D1PreparedStatement[] = [];
  if (invite) statements.push(d1.prepare(`UPDATE team_invites SET use_count=use_count+1,claim_nonce=?,accepted_participant_id=? WHERE id=? AND workspace_id=? AND (target_participant_id IS NULL OR EXISTS (SELECT 1 FROM participants target WHERE target.id=team_invites.target_participant_id AND target.workspace_id=team_invites.workspace_id AND target.login IS NULL AND target.password_hash IS NULL)) AND use_count<max_uses AND revoked_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM participants p WHERE p.id=team_invites.created_by_participant_id AND p.role='admin' AND p.status='active')`).bind(nonce, participantId, invite.id, workspaceId, now));
  const guard = invite ? "EXISTS (SELECT 1 FROM team_invites WHERE id=? AND claim_nonce=?)" : "NOT EXISTS (SELECT 1 FROM participants WHERE password_hash IS NOT NULL)";
  const guardArgs = invite ? [invite.id, nonce] : [];
  if (target) {
    statements.push(d1.prepare(`UPDATE participants SET login=?,password_hash=?,password_salt=?,display_name=?,email=?,status='active',role=?,access_scope=?,last_login_at=?,updated_at=? WHERE id=? AND login IS NULL AND password_hash IS NULL AND ${guard}`).bind(login,passwordHash,salt,target.displayName || displayName,`${login}@team.potok.local`,role,scope,now,now,participantId,...guardArgs));
  } else {
    statements.push(d1.prepare(`INSERT INTO participants (id,workspace_id,login,password_hash,password_salt,display_name,email,color,status,role,access_scope,last_login_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,'active',?,?,?,?,? WHERE ${guard}`).bind(participantId,workspaceId,login,passwordHash,salt,displayName,`${login}@team.potok.local`,TEAM_COLORS[Number(accountCount)%TEAM_COLORS.length],role,scope,now,now,now,...guardArgs));
  }
  const results = await d1.batch(statements);
  if (Number(results[results.length-1]?.meta.changes || 0) !== 1) throw new ApiRequestError("Приглашение уже использовано или отменено. Попросите администратора проверить доступ.", 409);
  const session = await createSession(participantId, request);
  const [participant] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  return { participant: toTeamParticipant(participant), cookie: session.cookie, firstAccount: isFirst };
}

export async function loginTeamMember(request: Request, payload: unknown) {
  const object = asObject(payload);
  const login = normalizeLogin(object.login);
  const password = validatePassword(object.password);
  await applyRateLimit(request, login);
  const [participant] = await getDb()
    .select()
    .from(participants)
    .where(eq(participants.login, login))
    .limit(1);
  if (!participant?.passwordHash || !participant.passwordSalt) {
    throw new ApiRequestError("Неверный логин или пароль.", 401);
  }
  const digest = await passwordDigest(password, participant.passwordSalt);
  if (!safeEqual(digest, participant.passwordHash) || participant.status !== "active") {
    throw new ApiRequestError("Неверный логин или пароль.", 401);
  }
  const now = new Date().toISOString();
  await getDb().update(participants).set({ lastLoginAt: now, updatedAt: now }).where(eq(participants.id, participant.id));
  const session = await createSession(participant.id, request);
  return { participant: toTeamParticipant({ ...participant, lastLoginAt: now }), cookie: session.cookie };
}

export async function changeTeamPassword(request: Request, payload: unknown) {
  const session = await requireTeamSession(request);
  const object = asObject(payload);
  const currentPassword = validatePassword(object.currentPassword);
  const nextPassword = validatePassword(object.nextPassword);
  if (currentPassword === nextPassword) {
    throw new ApiRequestError("Новый пароль должен отличаться от текущего.");
  }

  const [participant] = await getDb()
    .select()
    .from(participants)
    .where(eq(participants.id, session.participant.id))
    .limit(1);
  if (!participant?.passwordHash || !participant.passwordSalt) {
    throw new ApiRequestError("Для этого аккаунта пароль ещё не настроен.", 409);
  }
  const currentHash = await passwordDigest(currentPassword, participant.passwordSalt);
  if (!safeEqual(currentHash, participant.passwordHash)) {
    throw new ApiRequestError("Текущий пароль указан неверно.", 401);
  }

  const passwordSalt = randomToken(18);
  const passwordHash = await passwordDigest(nextPassword, passwordSalt);
  await getDb().update(participants).set({
    passwordHash,
    passwordSalt,
    updatedAt: new Date().toISOString(),
  }).where(eq(participants.id, participant.id));
  return { ok: true };
}

export async function logoutTeamMember(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256(token);
    await getDb().delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
  }
  return { cookie: clearSessionCookie(request) };
}

export async function listTeamMembers() {
  const rows = await getDb()
    .select()
    .from(participants)
    .where(eq(participants.workspaceId, getWorkspaceId()))
    .orderBy(participants.createdAt);
  return rows.map(toTeamParticipant);
}
