import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema.ts';
import * as context from '../lib/server/workspace-context.ts';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
const ORIGIN='https://mailflow-outreach.isakovegor820.chatgpt.site';
async function harness() {
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${file}`,'utf8'));
 sqlite.prepare('INSERT INTO workspaces(id,name,company_name) VALUES(?,?,?)').run('workspace-main','Private team','Private');
 sqlite.prepare("INSERT INTO participants(id,workspace_id,display_name,email,login,password_hash,role,access_scope,status) VALUES('owner','workspace-main','Owner','owner@example.org','owner','existing','admin','{\"all\":true}','active')").run();
 const d1={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const s=sqlite.prepare(sql);s.setReturnArrays(true);return s.all(...args);},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements){const r=await s.all();r.meta={changes:Number(sqlite.prepare('SELECT changes() n').get().n)};result.push(r);}sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const db=drizzle(d1,{schema}); let subject='123456789', clientId='test-client', requests=[];
 const options={env:{YANDEX_CLIENT_ID:'test-client',UNISENDER_API_KEY:'PRIVATE-KEY'},overrides:{'@/db':{getDb:()=>db,getD1:()=>d1},'./workspace-context':context,'./starter-template-library':{starterEmailTemplateValues:()=>[]},'./database-init':{ensureSystemDatabase:async()=>{},ensureDatabase:async request=>{const session=await auth.getTeamSession(request);if(!session)throw Error('unauthenticated');return session;}}},fetch:async(url,init)=>{requests.push({url:String(url),init});if(String(url).includes('/token'))return Response.json({access_token:'fake-token'});return Response.json({id:subject,client_id:clientId,default_email:'new@example.org',real_name:'New client'});}};
 const auth=await loadAiServer('lib/server/team-auth.ts',options);
 const yandex=await loadAiServer('lib/server/yandex-auth.ts',options);
 const integrations=await loadAiServer('lib/server/runtime-integrations.ts',options);
 const management=await loadAiServer('lib/server/team-management.ts',options);

 return {sqlite,d1,db,auth,yandex,integrations,management,requests,subject:v=>subject=v,clientId:v=>clientId=v,close:()=>sqlite.close()};
}
async function start(h,intent='register') {const response=await h.yandex.startYandex(new Request(`${ORIGIN}/api/auth/yandex/start?intent=${intent}&next=%2Fdashboard`));assert.equal(response.status,303);const target=new URL(response.headers.get('location'));return {state:target.searchParams.get('state'),browser:response.headers.get('set-cookie').split(';')[0],target};}
async function finish(h,flow,cookie=flow.browser) {return h.yandex.finishYandex(new Request(`${ORIGIN}/api/auth/yandex/callback?code=fake-code&state=${flow.state}`,{headers:{cookie}}));}
function sessionCookie(response){return response.headers.getSetCookie().find(v=>v.startsWith('potok_session=')).split(';')[0];}

test('workspace contexts stay isolated across interleaved async work and fail closed outside a request',async()=>{
 assert.throws(()=>context.getWorkspaceId(),/context/);
 const actual=await Promise.all(['one','two'].map((id,index)=>context.withWorkspace(id,async()=>{await new Promise(r=>setTimeout(r,index?2:10));return context.getWorkspaceId();})));
 assert.deepEqual(actual,['one','two']);assert.throws(()=>context.getWorkspaceId());
});
test('Yandex sign-up creates one private workspace atomically and login reuses it without inheriting team credentials',async()=>{
 const h=await harness();try{
  h.sqlite.exec("UPDATE participants SET email='new@example.org' WHERE id='owner'");
  const flow=await start(h);assert.equal(flow.target.searchParams.get('code_challenge_method'),'S256');assert.equal(flow.target.origin,'https://oauth.yandex.ru');
  const response=await finish(h,flow);assert.equal(new URL(response.headers.get('location')).pathname,'/dashboard');
  const session=await h.auth.getTeamSession(new Request(`${ORIGIN}/api/workspace`,{headers:{cookie:sessionCookie(response)}}));
  assert.ok(session);assert.notEqual(session.participant.workspaceId,'workspace-main');assert.equal(session.participant.role,'admin');
  const tenant=session.participant.workspaceId;
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM contacts WHERE workspace_id=?').get(tenant).n,0);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM integrations WHERE workspace_id=? AND enabled=0').get(tenant).n,4);
  assert.equal(context.withWorkspace(tenant,()=>h.integrations.runtimeSecret('UNISENDER_API_KEY')),'');
  assert.equal(context.withWorkspace('workspace-main',()=>h.integrations.runtimeSecret('UNISENDER_API_KEY')),'PRIVATE-KEY');
  assert.equal(h.requests[1].init.headers.Authorization,'OAuth fake-token');
  assert.ok(h.requests[0].init.body.get('code_verifier'));assert.equal(h.requests[0].init.body.get('client_secret'),null);
  const login=await finish(h,await start(h,'login'));assert.ok(login.headers.getSetCookie().some(v=>v.startsWith('potok_session=')));
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM workspaces').get().n,2);
 }finally{h.close();}
});
test('callbacks reject wrong browser, replay, expiration and cancellation without creating an account',async()=>{
 const h=await harness();try{
  const flow=await start(h);
  assert.match((await finish(h,flow,'potok_yandex_flow='+'a'.repeat(64))).headers.get('location'),/expired/);
  const valid=await finish(h,flow);assert.ok(valid.headers.getSetCookie().some(v=>v.startsWith('potok_session=')));
  assert.match((await finish(h,flow)).headers.get('location'),/expired/);
  h.subject('456');const expired=await start(h);h.sqlite.exec("UPDATE oauth_flows SET expires_at='2000-01-01'");assert.match((await finish(h,expired)).headers.get('location'),/expired/);
  const cancelled=await start(h);const response=await h.yandex.finishYandex(new Request(`${ORIGIN}/api/auth/yandex/callback?state=${cancelled.state}&error=access_denied`,{headers:{cookie:cancelled.browser}}));assert.match(response.headers.get('location'),/cancelled/);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM oauth_identities').get().n,1);
 }finally{h.close();}
});
test('unregistered login, mismatched client and external next never grant team access',async()=>{
 const h=await harness();try{
  assert.match((await finish(h,await start(h,'login'))).headers.get('location'),/not_registered/);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM auth_sessions').get().n,0);
  for(const path of ['//attacker.test','/\\attacker.test','/api/auth/logout','https://evil.example','/login'])assert.equal(h.yandex.safeAuthNext(path),'/dashboard');
  assert.equal(h.yandex.safeAuthNext('/presentations?tab=mine'),'/presentations?tab=mine');
 }finally{h.close();}
});
test('password signup creates a new workspace and globally unique login; credentials remain usable',async()=>{
 const h=await harness();try{
 const request=new Request(`${ORIGIN}/api/auth/register`);
 const payload={team:'ТехнологИИ Права',displayName:'Client Two',login:'new-client',password:'Password12345'};
 const result=await h.auth.registerTeamMember(request,payload);
 assert.notEqual(result.participant.workspaceId,'workspace-main');
 const login=await h.auth.loginTeamMember(request,payload);assert.equal(login.participant.id,result.participant.id);
 await assert.rejects(h.auth.registerTeamMember(request,payload),/занят/);
 assert.equal(h.sqlite.prepare('SELECT count(*) n FROM workspaces').get().n,2);
 }finally{h.close();}
});

test('provider client mismatch and disabled identities cannot create sessions',async()=>{
 const h=await harness();try{
  h.clientId('another-client');assert.match((await finish(h,await start(h))).headers.get('location'),/provider/);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM oauth_identities').get().n,0);
  h.clientId('test-client');await finish(h,await start(h));
  h.sqlite.exec("UPDATE participants SET status='disabled' WHERE id IN (SELECT participant_id FROM oauth_identities)");
  const before=h.sqlite.prepare('SELECT count(*) n FROM auth_sessions').get().n;
  assert.match((await finish(h,await start(h,'login'))).headers.get('location'),/disabled/);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM auth_sessions').get().n,before);
 }finally{h.close();}
});
test('linking requires the same signed-in session at callback and never reassigns another identity',async()=>{
 const h=await harness();try{
  const ownerSession=await h.auth.createSession('owner',new Request(ORIGIN));const ownerCookie=ownerSession.cookie.split(';')[0];
  const begin=async()=>{const response=await h.yandex.startYandex(new Request(`${ORIGIN}/api/auth/yandex/start?intent=link`,{headers:{cookie:ownerCookie}}));return {state:new URL(response.headers.get('location')).searchParams.get('state'),browser:response.headers.get('set-cookie').split(';')[0]};};
  const missing=await begin();assert.match((await finish(h,missing)).headers.get('location'),/expired/);
  assert.equal(h.sqlite.prepare('SELECT count(*) n FROM oauth_identities').get().n,0);
  const proper=await begin();assert.match((await finish(h,proper,proper.browser+'; '+ownerCookie)).headers.get('location'),/settings.*linked/);
  assert.equal(h.sqlite.prepare('SELECT participant_id FROM oauth_identities').get().participant_id,'owner');
 }finally{h.close();}
});
