import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import test from "node:test";
import { contactIsAccessible, emptyContactAccess } from "../lib/team-access.ts";
import { loadAiServer } from "./helpers/ai-server-harness.mjs";
const workspace = "workspace-main", now = new Date().toISOString();
const person = (id, role="member", scope=emptyContactAccess()) => ({ id, workspaceId:workspace, role, status:"active", accessScope:scope, displayName:id, login:id, email:`${id}@example.org`,color:"#123456",createdAt:now,updatedAt:now,lastLoginAt:null });
async function harness() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`,"utf8"));
  sqlite.prepare("INSERT INTO workspaces(id,name,company_name) VALUES(?,?,?)").run(workspace,"Тест","Тест");
  const add = p => sqlite.prepare("INSERT INTO participants(id,workspace_id,display_name,email,login,password_hash,role,access_scope,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(p.id,workspace,p.displayName,p.email,p.login || null,p.login ? "existing-hash" : null,p.role,JSON.stringify(p.accessScope),p.status,p.updatedAt);
  const actors = [person("admin","admin"),person("admin2","admin"),person("member"), {...person("directory"),login:""}]; actors.forEach(add);
  let current = actors[0];
  const d1 = { prepare(sql) { let values=[]; return {
    bind(...args){ values=args; return this; },
    async first(){ return sqlite.prepare(sql).get(...values) ?? null; },
    async all(){ return { results:sqlite.prepare(sql).all(...values) }; },
    async raw(){ const statement=sqlite.prepare(sql); statement.setReturnArrays(true); return statement.all(...values); },
    async run(){ return { meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)} }; },
  }; }, async batch(statements){ sqlite.exec("BEGIN"); try { const results=[]; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; } catch(e){sqlite.exec("ROLLBACK");throw e;} } };
  // D1 batch returns affected-row counts even for SELECT/UPDATE-returning statements.
  let queue=Promise.resolve();
  d1.batch = statements => { const job=queue.then(async () => { sqlite.exec("BEGIN"); try { const results=[]; for (const statement of statements) { const result=await statement.all(); result.meta={changes:Number(sqlite.prepare("SELECT changes() n").get().n)}; results.push(result); } sqlite.exec("COMMIT");return results; } catch(e){sqlite.exec("ROLLBACK");throw e;} }); queue=job.catch(()=>{}); return job; };
  const db = drizzle(d1,{schema});
  const options={overrides:{"@/db":{getD1:()=>d1,getDb:()=>db},"./database-init":{ensureDatabase:async()=>({participant:current}),WORKSPACE_ID:workspace}}};
  const management=await loadAiServer("lib/server/team-management.ts",options);
  const auth=await loadAiServer("lib/server/team-auth.ts",options);
  const access=await loadAiServer("lib/server/team-access.ts",options);
  return {sqlite,db,management,auth,access,as:p=>{current=p;},close:()=>sqlite.close()};
}
const req = () => new Request("https://potok.example/api/team",{method:"POST",headers:{origin:"https://potok.example"}});
const register = (code, login="new-colleague") => ({ team:"ТехнологИИ Права",displayName:"Новый коллега",login,password:"Long-Password-987",inviteCode:code, role:"admin",accessScope:{all:true} });

test("contact access uses union of assigned bases and exact groups, never workspace/status/name fallbacks",()=>{
 const member=person("m","member",{all:false,baseIds:["base-a"],groupTags:["Группа А"]});
 const c={workspaceId:workspace,responsibleParticipantId:"base-a",createdByParticipantId:"m",tags:[]};
 assert.equal(contactIsAccessible(member,c),true);
 assert.equal(contactIsAccessible(member,{...c,responsibleParticipantId:"base-b"}),false);
 assert.equal(contactIsAccessible(member,{...c,responsibleParticipantId:"base-b",tags:["Группа А"]}),true);
 assert.equal(contactIsAccessible(member,{...c,responsibleParticipantId:"base-b",tags:["Группа АА"]}),false);
 assert.equal(contactIsAccessible({...member,status:"disabled"},c),false);
 assert.equal(contactIsAccessible(person("a","admin"),{...c,workspaceId:"another"}),false);
 assert.equal(contactIsAccessible(person("m"),{...c,responsibleParticipantId:"m"}),false);
});

test("production SQL restricts totals, pagination and raw queries consistently",async()=>{
 const h=await harness();try{
  for(const [id,base,tags] of [["a","directory",[]],["b","admin",["Группа"]],["c","admin",[]]]) h.sqlite.prepare("INSERT INTO contacts(id,workspace_id,first_name,last_name,full_name,tags,responsible_participant_id) VALUES(?,?,?,?,?,?,?)").run(id,workspace,id,"",id,JSON.stringify(tags),base);
  const member=person("member","member",{all:false,baseIds:["directory"],groupTags:["Группа"]});
  const rows=await h.db.select({id:schema.contacts.id}).from(schema.contacts).where(and(eq(schema.contacts.workspaceId,workspace),h.access.contactAccessSql(member)));
  assert.deepEqual(rows.map(r=>r.id).sort(),["a","b"]);
  const raw=h.access.rawContactAccess(member);
  assert.equal(h.sqlite.prepare(`SELECT count(*) n FROM contacts WHERE workspace_id=? AND ${raw.condition}`).get(workspace,...raw.params).n,2);
  const none=h.access.rawContactAccess(person("member"));assert.equal(h.sqlite.prepare(`SELECT count(*) n FROM contacts WHERE ${none.condition}`).get(...none.params).n,0);
  assert.throws(()=>h.access.requireCampaignAccess(member,{workspaceId:workspace,participantId:"admin"}),/не найдена/);
 }finally{h.close();}
});

test("invitation binds role and grants, activates only its explicit directory profile, and is single-use",async()=>{
 const h=await harness();try{
  const scope={all:false,baseIds:["directory"],groupTags:["Группа"]};
  const invite=await h.management.manageTeam(req(),{action:"invite",label:"Коллега",targetParticipantId:"directory",role:"member",accessScope:scope});
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM team_invites WHERE code_hash=?").get(invite.code).n,0);
  const result=await h.auth.registerTeamMember(req(),register(invite.code));
  assert.equal(result.participant.id,"directory");assert.equal(result.participant.role,"member");
  assert.deepEqual(JSON.parse(JSON.stringify(result.participant.accessScope)),scope);
  await assert.rejects(h.auth.registerTeamMember(req(),register(invite.code,"second-colleague")),/использовано/);
  assert.equal(h.sqlite.prepare("SELECT use_count FROM team_invites").get().use_count,1);
  assert.ok(result.cookie.includes("HttpOnly"));
 }finally{h.close();}
});

test("revoked, expired and invitations from a demoted administrator fail closed",async()=>{
 const h=await harness();try{
  for(const kind of ["revoked","expired","demoted"]){
   const inv=await h.management.manageTeam(req(),{action:"invite",role:"member",accessScope:emptyContactAccess()});
   if(kind==="revoked") await h.management.manageTeam(req(),{action:"revoke_invite",id:inv.id});
   if(kind==="expired")h.sqlite.prepare("UPDATE team_invites SET expires_at='2000-01-01' WHERE id=?").run(inv.id);
   if(kind==="demoted")h.sqlite.prepare("UPDATE participants SET role='member' WHERE id='admin'").run();
   await assert.rejects(h.auth.registerTeamMember(req(),register(inv.code,`test-${kind}`)),/приглашение|Приглашение|приглашения/);
  }
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM auth_sessions").get().n,0);
 }finally{h.close();}
});

test("permission edits require admin, reject stale/cross-origin updates, preserve last admin and invalidate disabled sessions",async()=>{
 const h=await harness();try{
  h.as(person("member"));await assert.rejects(h.management.manageTeam(req(),{action:"invite",role:"admin",accessScope:emptyContactAccess()}),/администратору/);
  h.as(person("admin","admin"));const payload={action:"update_member",id:"member",role:"member",accessScope:{all:false,baseIds:["directory"],groupTags:[]},status:"active",updatedAt:now};
  await assert.rejects(h.management.manageTeam(new Request("https://potok.example/api/team",{headers:{origin:"https://evil.example"}}),payload),/другого сайта/);
  const changed=await h.management.manageTeam(req(),payload);assert.equal(changed.participant.accessScope.baseIds[0],"directory");
  await assert.rejects(h.management.manageTeam(req(),payload),/уже изменил/);
  h.sqlite.prepare("INSERT INTO auth_sessions(id,participant_id,token_hash,expires_at) VALUES('session','member','test','2099-01-01')").run();
  await h.management.manageTeam(req(),{...payload,status:"disabled",updatedAt:changed.participant.updatedAt});
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM auth_sessions").get().n,0);
  h.sqlite.prepare("UPDATE participants SET role='member' WHERE id='admin2'").run();
  await assert.rejects(h.management.manageTeam(req(),{...payload,id:"admin",role:"member",updatedAt:now}),/хотя бы один/);
 }finally{h.close();}
});

test("parallel registrations consume one invite and cannot take a directory profile by matching a name",async()=>{
 const h=await harness();try{
  const inv=await h.management.manageTeam(req(),{action:"invite",role:"member",accessScope:emptyContactAccess()});
  // D1 serializes atomic batches; password work and reads still overlap.
  const results=await Promise.allSettled([h.auth.registerTeamMember(req(),{...register(inv.code,"one-colleague"),displayName:"directory"}),h.auth.registerTeamMember(req(),register(inv.code,"two-colleague"))]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(h.sqlite.prepare("SELECT login FROM participants WHERE id='directory'").get().login,null);
  assert.equal(h.sqlite.prepare("SELECT use_count FROM team_invites").get().use_count,1);
 }finally{h.close();}
});
