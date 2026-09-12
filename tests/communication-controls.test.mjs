import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import test from "node:test";
import * as orm from "drizzle-orm";
import { classifyReply, consentState, companyKey, usagePercent } from "../lib/communications/rules.ts";
const now="2026-09-09T10:00:00.000Z";
const contact={id:"contact-a",workspaceId:"workspace-main",fullName:"Иван",firstName:"Иван",lastName:"Тест",email:"ivan@example.org",status:"active",emailConsent:false,companyId:"company-a",companyName:"Компания",customFields:{},responsibleParticipantId:"member-a",createdByParticipantId:"member-a"};
const evidence={id:"grant-a",endpoint:contact.email,channel:"email",purpose:"marketing",kind:"grant",source:"Форма",obtained_at:"2026-09-01T00:00:00.000Z",expires_at:"2026-12-31T00:00:00.000Z",version:"4",statement:"Точный текст",operator:"Оператор",created_at:now,digest:"x"};
test("consent is scoped to address, channel, purpose and validity; legacy checkbox is not proof",()=>{
 assert.equal(consentState(contact,"email","marketing",[evidence],now),"confirmed");
 assert.equal(consentState({...contact,email:"new@example.org"},"email","marketing",[evidence],now),"missing");
 assert.equal(consentState(contact,"email","transactional",[evidence],now),"missing");
 assert.equal(consentState(contact,"email","marketing",[{...evidence,expires_at:now}],now),"expired");
 assert.equal(consentState(contact,"email","marketing",[{...evidence,kind:"revoke"}],now),"revoked");
 assert.equal(consentState(contact,"email","marketing",[evidence,{...evidence,id:"a",kind:"revoke"}],now),"revoked");
 assert.equal(consentState({...contact,emailConsent:true},"email","marketing",[],now),"review");
 assert.equal(usagePercent(7,9),78);assert.equal(companyKey({...contact,companyId:null,companyName:""}),"");
});
test("reply analysis preserves intent and ambiguous dates instead of inventing calls",()=>{
 assert.equal(classifyReply("Свяжитесь после 15 сентября",now).suggestedDate,"2026-09-16");
 assert.equal(classifyReply("Свяжитесь после 15 сентября",now).suggestedAction,"Связаться");
 assert.equal(classifyReply("Позвоните после 15 сентября",now).suggestedAction,"Позвонить");
 assert.equal(classifyReply("Позвоните после 31 сентября",now).suggestedDate,null);
 assert.equal(classifyReply("Не пишите мне",now).category,"unsubscribe");
 assert.equal(classifyReply("Автоответ: я в отпуске",now).category,"automatic");
 assert.equal(classifyReply("Спасибо\n> не присылайте письма",now).category,"review");
});
async function harness(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(await readFile(new URL("../drizzle/0018_open_jack_flag.sql",import.meta.url),"utf8"));
 sqlite.exec(`CREATE TABLE workspaces(id TEXT PRIMARY KEY,company_name TEXT,name TEXT); INSERT INTO workspaces VALUES('workspace-main','ООО Тест','Поток');CREATE TABLE contacts(id TEXT PRIMARY KEY,workspace_id TEXT,email TEXT,status TEXT,email_consent INTEGER,full_name TEXT,company_id TEXT,company_name TEXT);CREATE TABLE campaigns(id TEXT,workspace_id TEXT,sent_at TEXT,participant_id TEXT,name TEXT,contact_ids TEXT,delivery_channels TEXT,audience_type TEXT,status TEXT,scheduled_at TEXT,metrics TEXT);CREATE TABLE participants(id TEXT,workspace_id TEXT,status TEXT,display_name TEXT);CREATE TABLE delivery_outbox(id TEXT,contact_id TEXT,recipient_endpoint TEXT,status TEXT,campaign_id TEXT,channel TEXT);`);
 sqlite.prepare("INSERT INTO contacts VALUES(?,?,?,?,?,?,?,?)").run(contact.id,contact.workspaceId,contact.email,"active",0,contact.fullName,contact.companyId,contact.companyName);
 sqlite.prepare("INSERT INTO participants VALUES(?,?,?,?)").run("member-a","workspace-main","active","Егор");
 const d1={prepare(sql){return {bind(...args){const statement=sqlite.prepare(sql);return {all:async()=>({results:statement.all(...args)}),first:async()=>statement.get(...args)??null,run:async()=>({meta:{changes:Number(statement.run(...args).changes)}})};}}},async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec("COMMIT");return results;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
 class TestDate extends Date { constructor(...args){super(...(args.length?args:["2026-09-09T12:00:00.000Z"]));} static now(){return Date.parse("2026-09-09T12:00:00.000Z");} }
 const context=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Date:TestDate,JSON,Request,Response,AbortSignal,fetch:async()=>{throw Error("External calls forbidden in test")}});
 const synthetic=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});
 const runtimeEnv={};
 const mocks={
  "cloudflare:workers":synthetic({env:runtimeEnv}),
  "drizzle-orm":synthetic(orm),
  "@/db/schema":synthetic({contacts:{id:"id",workspaceId:"workspace_id"}, campaigns:{}}),
  "@/db":synthetic({getD1:()=>d1,getDb:()=>({select:()=>({from:()=>({where:()=>({limit:async()=>[{...contact,status:sqlite.prepare("SELECT status FROM contacts WHERE id=?").get(contact.id).status}]})})})})}),
  "./database-init":synthetic({WORKSPACE_ID:"workspace-main",ensureDatabase:async()=>({participant:{id:"member-a",workspaceId:"workspace-main",role:"admin",status:"active",accessScope:{all:true,baseIds:[],groupTags:[]}}}),ensureSystemDatabase:async()=>{}}),
 };
 const modules=new Map();
 async function moduleFor(path){if(modules.has(path))return modules.get(path);const source=await readFile(new URL(`../${path}`,import.meta.url),"utf8");const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const m=new vm.SourceTextModule(code,{context,identifier:path});modules.set(path,m);await m.link(async(spec)=>mocks[spec]??moduleFor(spec==="./api-utils"?"lib/server/api-utils.ts":spec==="./team-access"?"lib/server/team-access.ts":spec==="@/lib/team-access"?"lib/team-access.ts":"lib/communications/rules.ts"));return m;}
 const loadedModule=await moduleFor("lib/server/communication-store.ts");await loadedModule.evaluate();return {api:loadedModule.namespace,sqlite,runtimeEnv};
}
test("real SQL: evidence is append-only; duplicate reply creates one hold and one task",async()=>{
 const {api,sqlite}=await harness();const request=new Request("https://test/api");
 await api.mutateCommunications(request,{action:"grant",contactId:contact.id,operator:"ООО Тест",source:"Форма",version:"4",statement:"Согласие",obtainedAt:"2026-09-01T00:00:00Z"});
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_consents").get().n,1);
 await api.mutateCommunications(request,{action:"grant",purpose:"data_processing",contactId:contact.id,operator:"ООО Тест",source:"Форма",version:"4",statement:"Основание обработки",obtainedAt:"2026-09-01T00:00:00Z"});
 const p={contactId:contact.id,externalId:"<reply-1>",body:"Свяжитесь после 15 сентября",receivedAt:now};
 await api.ingestReply(p,"member-a");await api.ingestReply(p,"member-a");
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_messages").get().n,1);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_tasks").get().n,1);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_holds").get().n,1);
 assert.equal(sqlite.prepare("SELECT due_date FROM communication_tasks").get().due_date,"2026-09-16");
 const check=await api.assessCommunications([contact],["email"],"marketing");assert.equal(check.blockedIds.length,1);
 await api.mutateCommunications(request,{action:"resume",contactId:contact.id});
 assert.equal((await api.assessCommunications([contact],["email"],"marketing")).blockedIds.length,0);
 await api.mutateCommunications(request,{action:"revoke",contactId:contact.id});
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_consents").get().n,3);
 assert.equal((await api.assessCommunications([contact],["email"],"marketing")).rows[0].consent,"revoked");
 await assert.rejects(api.mutateCommunications(request,{action:"grant",contactId:contact.id,operator:"ООО Тест",source:"Форма",version:"4",statement:"Согласие",obtainedAt:"2026-09-01T00:00:00Z"}));
 sqlite.close();
});
test("real SQL: unsubscribe and manual correction block sending and cannot be resumed",async()=>{
 const {api,sqlite}=await harness();const request=new Request("https://test/api");
 const result=await api.ingestReply({contactId:contact.id,externalId:"<reply-2>",body:"Спасибо"},"member-a");
 await api.mutateCommunications(request,{action:"classify",id:result.id,category:"unsubscribe"});
 await api.mutateCommunications(request,{action:"resume",contactId:contact.id});
 assert.equal(sqlite.prepare("SELECT status FROM contacts").get().status,"unsubscribed");
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_holds WHERE active=1").get().n,1);
 await assert.rejects(api.ingestReply({contactId:contact.id,externalId:"bad",sender:"someone@example.org",body:"Ответ"},"member-a"));
 sqlite.close();
});

test("signed inbound mail rejects tampering and deduplicates a replay",async()=>{
 const {api,sqlite,runtimeEnv}=await harness();runtimeEnv.COMMUNICATION_WEBHOOK_SECRET="integration-test-secret";
 const payload=JSON.stringify({contactId:contact.id,externalId:"signed-1",sender:contact.email,body:"Пришлите подробности"});
 const timestamp=String(Date.parse("2026-09-09T12:00:00.000Z")/1000);
 const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(runtimeEnv.COMMUNICATION_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature="sha256="+[...new Uint8Array(await webcrypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${timestamp}.${payload}`)))].map(v=>v.toString(16).padStart(2,"0")).join("");
 const request=(body)=>new Request("https://test/api/communications/inbound",{method:"POST",headers:{"x-potok-timestamp":timestamp,"x-potok-signature":signature},body});
 await assert.rejects(api.ingestWebhook(request(payload+" ")));
 await api.ingestWebhook(request(payload));await api.ingestWebhook(request(payload));
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_messages").get().n,1);sqlite.close();
});

test("correcting an automatic reply pauses the chain; grants require actual evidence",async()=>{
 const {api,sqlite}=await harness();const request=new Request("https://test/api");
 const reply=await api.ingestReply({contactId:contact.id,externalId:"auto-correct",body:"Автоответ: я в отпуске"},"member-a");
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_holds").get().n,0);
 await api.mutateCommunications(request,{action:"classify",id:reply.id,category:"call"});
 assert.equal(sqlite.prepare("SELECT count(*) n FROM communication_holds WHERE active=1").get().n,1);
 await assert.rejects(api.mutateCommunications(request,{action:"grant",contactId:contact.id,operator:"ООО Тест",version:"4",obtainedAt:now}));
 sqlite.close();
});

test("pressure counts real sends, forecasts scheduled messages and groups explicit companies",async()=>{
 const {api,sqlite}=await harness();
 for(let i=0;i<7;i++) sqlite.prepare("INSERT INTO communication_touches VALUES(?,?,?,?,?,?,?,?,?)").run(`touch-${i}`,contact.workspaceId,contact.id,contact.email,companyKey(contact),"email","old-campaign","member-a",now);
 sqlite.prepare("INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("scheduled-a",contact.workspaceId,null,"member-a","Очередь",JSON.stringify([contact.id]),JSON.stringify(["email","telegram"]),"contacts","scheduled",now,"{}");
 const audience=Array.from({length:14},(_,i)=>i===0?contact:{...contact,id:`other-${i}`,email:`other-${i}@example.org`});
 const check=await api.assessCommunications(audience,["email"],"marketing");
 assert.equal(check.rows[0].sent,7);assert.equal(check.rows[0].percentage,78);assert.equal(check.rows[0].projected,10);
 assert.equal(check.rows[0].companySelected,14);assert.equal(check.rows[0].warnings.length,2);
 assert.equal(check.warningIds.length,14);
 sqlite.close();
});
