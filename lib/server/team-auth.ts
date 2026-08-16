import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { getD1, getDb } from "@/db";
import {
  authSessions,
  contacts,
  participants,
  teamInvites,
} from "@/db/schema";
import type { ParticipantRecord } from "@/types/api";
import { ApiRequestError, asObject, cleanText, newId } from "./api-utils";

export const TEAM_NAME = "ТехнологИИ Права";
export const TEAM_WORKSPACE_ID = "workspace-main";
export const SESSION_COOKIE = "potok_session";

const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 210_000;
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

async function sha256(value: string): Promise<string> {
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
    if (key === name) return decodeURIComponent(rest.join("="));
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

async function applyRateLimit(request: Request, login: string) {
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

async function createSession(participantId: string, request: Request) {
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
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const [row] = await getDb()
    .select({ session: authSessions, participant: participants })
    .from(authSessions)
    .innerJoin(participants, eq(authSessions.participantId, participants.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
    .limit(1);
  if (!row || row.participant.status !== "active") return null;
  if (Date.now() - Date.parse(row.session.lastSeenAt) > 60 * 60_000) {
    await getDb().update(authSessions).set({ lastSeenAt: now }).where(eq(authSessions.id, row.session.id));
  }
  return { participant: toTeamParticipant(row.participant), sessionId: row.session.id };
}

export async function requireTeamSession(request: Request): Promise<TeamSession> {
  const session = await getTeamSession(request);
  if (!session) throw new ApiRequestError("Войдите в команду, чтобы продолжить.", 401);
  return session;
}

export async function getRegistrationStatus() {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(isNotNull(participants.passwordHash));
  return { teamName: TEAM_NAME, firstAccountAvailable: Number(row?.count ?? 0) === 0 };
}

export async function registerTeamMember(request: Request, payload: unknown) {
  const object = asObject(payload);
  const team = cleanText(object.team, "Команда", 100);
  if (team.toLocaleLowerCase("ru-RU") !== TEAM_NAME.toLocaleLowerCase("ru-RU")) {
    throw new ApiRequestError("Команда не найдена. Проверьте название или приглашение.", 404);
  }
  const login = normalizeLogin(object.login);
  const password = validatePassword(object.password);
  await applyRateLimit(request, login);
  const db = getDb();
  const [existingLogin] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.workspaceId, TEAM_WORKSPACE_ID), eq(participants.login, login)))
    .limit(1);
  if (existingLogin) throw new ApiRequestError("Этот логин уже занят.", 409);

  const [{ count: accountCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(isNotNull(participants.passwordHash));
  const isFirst = Number(accountCount) === 0;
  if (!isFirst) {
    const inviteCode = cleanText(object.inviteCode, "Код приглашения", 120);
    const codeHash = await sha256(inviteCode.toLocaleUpperCase("ru-RU"));
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.workspaceId, TEAM_WORKSPACE_ID),
          eq(teamInvites.codeHash, codeHash),
          gt(teamInvites.expiresAt, new Date().toISOString()),
        ),
      )
      .limit(1);
    if (!invite || invite.useCount >= invite.maxUses) {
      throw new ApiRequestError("Приглашение недействительно или уже использовано.", 403);
    }
    const consumed = await db
      .update(teamInvites)
      .set({ useCount: invite.useCount + 1 })
      .where(
        and(
          eq(teamInvites.id, invite.id),
          sql`${teamInvites.useCount} < ${teamInvites.maxUses}`,
        ),
      )
      .returning({ id: teamInvites.id });
    if (consumed.length !== 1) {
      throw new ApiRequestError("Приглашение уже использовано.", 409);
    }
  }

  const salt = randomToken(18);
  const passwordHash = await passwordDigest(password, salt);
  const now = new Date().toISOString();
  const colorIndex = Number(accountCount) % TEAM_COLORS.length;
  let participantId = newId("participant");
  if (isFirst) {
    const [legacy] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, "participant-main"))
      .limit(1);
    if (legacy && !legacy.passwordHash) {
      participantId = legacy.id;
      await db.update(participants).set({
        login,
        passwordHash,
        passwordSalt: salt,
        displayName: login,
        email: `${login}@team.potok.local`,
        color: TEAM_COLORS[colorIndex],
        status: "active",
        lastLoginAt: now,
        updatedAt: now,
      }).where(eq(participants.id, legacy.id));
      await db
        .update(contacts)
        .set({
          createdByParticipantId: participantId,
          updatedByParticipantId: participantId,
        })
        .where(
          and(
            eq(contacts.workspaceId, TEAM_WORKSPACE_ID),
            isNull(contacts.createdByParticipantId),
          ),
        );
    }
  }
  if (participantId !== "participant-main") {
    await db.insert(participants).values({
      id: participantId,
      workspaceId: TEAM_WORKSPACE_ID,
      login,
      passwordHash,
      passwordSalt: salt,
      displayName: login,
      email: `${login}@team.potok.local`,
      color: TEAM_COLORS[colorIndex],
      status: "active",
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
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
    .where(and(eq(participants.workspaceId, TEAM_WORKSPACE_ID), eq(participants.login, login)))
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
    .where(and(eq(participants.workspaceId, TEAM_WORKSPACE_ID), isNotNull(participants.passwordHash)))
    .orderBy(participants.createdAt);
  return rows.map(toTeamParticipant);
}

export async function createTeamInvite(actorId: string) {
  await getDb().delete(teamInvites).where(lt(teamInvites.expiresAt, new Date().toISOString()));
  const code = `POTOK-${randomToken(8).toLocaleUpperCase("ru-RU")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 86400_000).toISOString();
  await getDb().insert(teamInvites).values({
    id: newId("invite"),
    workspaceId: TEAM_WORKSPACE_ID,
    codeHash: await sha256(code.toLocaleUpperCase("ru-RU")),
    createdByParticipantId: actorId,
    expiresAt,
    maxUses: 1,
    useCount: 0,
    createdAt: now.toISOString(),
  });
  return { code, expiresAt };
}
