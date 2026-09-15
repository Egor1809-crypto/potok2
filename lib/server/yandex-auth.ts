import { registrationConsent } from "@/config/legal";
import { registrationConsentInsert } from "./registration-consent";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getD1, getDb } from "@/db";
import { participants } from "@/db/schema";
import { newId } from "./api-utils";
import { ensureSystemDatabase } from "./database-init";
import { applyRateLimit, createSession, getTeamSession, sha256 } from "./team-auth";
import { privateWorkspaceStatements } from "./workspace-provisioning";

const COOKIE = "potok_yandex_flow";
const ORIGINS = new Set(["https://mailflow-outreach.isakovegor820.chatgpt.site", "https://potok.slava-hunter.ru"]);
type Flow = { state_hash: string; browser_hash: string; verifier: string; intent: string; next_path: string; origin: string; participant_id: string | null; session_id: string | null; expires_at: string; consent_version: string | null; consent_accepted_at: string | null };
export function yandexClientId() { return (env as unknown as Record<string,string>).YANDEX_CLIENT_ID?.trim() || ""; }
function random() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,"0")).join(""); }
export function safeAuthNext(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  const target = new URL(value, "https://potok.invalid");
  if (target.origin !== "https://potok.invalid" || /^\/(?:api|login|register)(?:\/|$)/.test(target.pathname)) return "/dashboard";
  return target.pathname + target.search + target.hash;
}
function flowCookie(value: string, maxAge: number) { return `${COOKIE}=${value}; Path=/api/auth/yandex; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function cookie(request: Request) { return request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1) || ""; }
function redirect(path: string, request: Request, cookies: string[] = []) {
  const headers = new Headers({Location: new URL(path,request.url).toString(), "Cache-Control":"no-store", "Referrer-Policy":"no-referrer"});
  for (const value of cookies) headers.append("Set-Cookie",value);
  return new Response(null,{status:303,headers});
}
export async function startYandex(request: Request) {
  const url = new URL(request.url);
  if (request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return redirect("/register?auth_error=consent", request);
    const form = await request.formData();
    url.search = "";
    for (const key of ["intent", "next", "invite", "consentVersion", "dataConsent"]) {
      const value = form.get(key);
      if (typeof value === "string") url.searchParams.set(key, value);
    }
  }
  const registering = url.searchParams.get("intent") === "register";
  if (registering && (request.method !== "POST" || url.searchParams.get("dataConsent") !== "true" || url.searchParams.get("consentVersion") !== registrationConsent.version)) return redirect("/register?auth_error=consent", request);
  if (!yandexClientId() || !ORIGINS.has(url.origin)) return redirect("/login?auth_error=unavailable",request);
  await ensureSystemDatabase();
  await applyRateLimit(request,"yandex-start");
  const intent = url.searchParams.get("intent") === "register" ? "register" : url.searchParams.get("intent") === "link" ? "link" : "login";
  if (intent === "register" && url.searchParams.get("invite")) return redirect(`/register?auth_error=invite&invite=${encodeURIComponent(url.searchParams.get("invite")!)}`,request);
  const session = intent === "link" ? await getTeamSession(request) : null;
  if (intent === "link" && !session) return redirect("/login?next=%2Fsettings",request);
  const state = random(), browser = random(), verifier = random(), db = getD1();
  await db.batch([
    db.prepare("DELETE FROM oauth_flows WHERE expires_at <= ?").bind(new Date().toISOString()),
    db.prepare("INSERT INTO oauth_flows (state_hash,browser_hash,verifier,intent,next_path,origin,participant_id,session_id,expires_at,consent_version,consent_accepted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(await sha256(state),await sha256(browser),verifier,intent,safeAuthNext(url.searchParams.get("next")),url.origin,session?.participant.id ?? null,session?.sessionId ?? null,new Date(Date.now()+600000).toISOString(),registering ? registrationConsent.version : null,registering ? new Date().toISOString() : null),
  ]);
  const target = new URL("https://oauth.yandex.ru/authorize");
  target.search = new URLSearchParams({response_type:"code",client_id:yandexClientId(),redirect_uri:`${url.origin}/api/auth/yandex/callback`,scope:"login:info login:email",state,code_challenge:await sha256(verifier),code_challenge_method:"S256",force_confirm:"yes"}).toString();
  return redirect(target.toString(),request,[flowCookie(browser,600)]);
}

export async function finishYandex(request: Request) {
  const url = new URL(request.url), clear = flowCookie("",0);
  let flow: Flow | null = null;
  try {
    if (!ORIGINS.has(url.origin) || !yandexClientId()) throw new Error("unavailable");
    const state = url.searchParams.get("state") || "", browser = cookie(request);
    if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(browser)) throw new Error("expired");
    await ensureSystemDatabase();
    // DELETE RETURNING consumes the browser-bound flow once, before exchanging
    // the code. Replay, wrong-browser and stale callbacks cannot create sessions.
    flow = await getD1().prepare("DELETE FROM oauth_flows WHERE state_hash=? AND browser_hash=? AND origin=? AND expires_at>? RETURNING *")
      .bind(await sha256(state),await sha256(browser),url.origin,new Date().toISOString()).first<Flow>();
    if (!flow) throw new Error("expired");
    if (url.searchParams.get("error")) throw new Error("cancelled");
    const code = url.searchParams.get("code");
    if (!code || code.length>2048) throw new Error("provider");
    const tokenResponse = await fetch("https://oauth.yandex.ru/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",code,client_id:yandexClientId(),code_verifier:flow.verifier,redirect_uri:`${flow.origin}/api/auth/yandex/callback`}),signal:AbortSignal.timeout(15000)});
    if (!tokenResponse.ok) throw new Error("provider");
    const token = await tokenResponse.json() as {access_token?: string};
    if (!token.access_token) throw new Error("provider");
    const profileResponse = await fetch("https://login.yandex.ru/info?format=json",{headers:{Authorization:`OAuth ${token.access_token}`},signal:AbortSignal.timeout(15000)});
    if (!profileResponse.ok) throw new Error("provider");
    const profile = await profileResponse.json() as {id?: string; client_id?: string; default_email?: string; display_name?: string; real_name?: string; login?: string};
    if (!profile.id || !/^\d{1,30}$/.test(profile.id) || profile.client_id !== yandexClientId()) throw new Error("provider");
    const identity = await getD1().prepare("SELECT participant_id FROM oauth_identities WHERE provider='yandex' AND subject=?").bind(profile.id).first<{participant_id:string}>();
    let participantId = identity?.participant_id;
    if (flow.intent === "link") {
      const session = await getTeamSession(request);
      if (!session || session.sessionId !== flow.session_id || session.participant.id !== flow.participant_id) throw new Error("expired");
      if (participantId && participantId !== session.participant.id) throw new Error("linked");
      if (!participantId) await getD1().prepare("INSERT INTO oauth_identities (provider,subject,participant_id,created_at) VALUES ('yandex',?,?,?)").bind(profile.id,session.participant.id,new Date().toISOString()).run();
      return redirect("/settings?yandex=linked",request,[clear]);
    }
    if (!participantId) {
      if (flow.intent !== "register") throw new Error("not_registered");
      if (flow.consent_version !== registrationConsent.version || !flow.consent_accepted_at) throw new Error("consent");
      const email = profile.default_email?.trim().toLowerCase() || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>320) throw new Error("email");
      participantId = newId("participant");
      const displayName = (profile.real_name || profile.display_name || profile.login || "Моё пространство").trim().slice(0,100);
      const workspace = await privateWorkspaceStatements({participantId,displayName,email});
      // A unique provider subject makes concurrent sign-ups atomic. Email is
      // contact information only; it never links an existing account implicitly.
      await getD1().batch([...workspace.statements,getD1().prepare("INSERT INTO oauth_identities (provider,subject,participant_id,created_at) VALUES ('yandex',?,?,?)").bind(profile.id,participantId,new Date().toISOString()),registrationConsentInsert(participantId,"yandex",flow.consent_accepted_at)]);
    }
    const [participant] = await getDb().select().from(participants).where(eq(participants.id,participantId)).limit(1);
    if (!participant || participant.status !== "active") throw new Error("disabled");
    const session = await createSession(participantId,request);
    return redirect(safeAuthNext(flow.next_path),request,[clear,session.cookie]);
  } catch (error) {
    const code = error instanceof Error && ["consent","unavailable","expired","cancelled","provider","linked","not_registered","email","disabled"].includes(error.message) ? error.message : "provider";
    const destination = flow?.intent === "link" ? "/settings" : flow?.intent === "register" ? "/register" : "/login";
    return redirect(`${destination}?auth_error=${code}`,request,[clear]);
  }
}
