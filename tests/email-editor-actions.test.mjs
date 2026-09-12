import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

const compiler = await loadAiServer('lib/server/email-document.ts');
const builder = await loadAiServer('components/email-builder/builder-types.ts');
const rules = await loadAiServer('lib/email-ai/review.ts');
const defaults = await loadAiServer('lib/email-ai/defaults.ts');
const intent = await loadAiServer('lib/email-ai/edit-intent.ts');
const adapter = await loadAiServer('lib/server/provider-adapters.ts');
const json = value => JSON.parse(JSON.stringify(value));
const document = () => ({ ...builder.createBlankDocument(), subject:'Приглашение абитуриентам', previewText:'Познакомьтесь с институтом', blocks:[{...builder.createBlock('text'),content:'С теплом и надеждой на встречу.',textColor:'#AbCdEf'}] });

test('a fresh review matches a manually edited client document before and after save', async () => {
  const doc=document(),brief={...defaults.emptyAiEmailBrief(),description:'Приглашение абитуриентам'};
  const server=await loadAiServer('lib/server/email-ai-studio.ts');
  const result=await server.emailAiStudio(new Request('https://example.org'),'review',{document:doc,brief});
  assert.equal(result.review.fingerprint,rules.emailReviewFingerprint(doc,brief));
  doc.aiMetadata={brief,generationId:'test',generatedAt:'2026-09-12',model:'review',review:result.review};
  const reopened=builder.builderDocumentFromInput(compiler.parseEmailBuilderDocument(json(doc)));
  assert.equal(rules.emailReviewFingerprint(reopened,reopened.aiMetadata.brief),result.review.fingerprint);
  reopened.blocks[0].textColor='#123456';
  assert.notEqual(rules.emailReviewFingerprint(reopened,brief),result.review.fingerprint);
});

test('test send uses real compilation and merge handling, including provider unsubscribe and personal defaults', async () => {
  const calls=[];
  const server=await loadAiServer('lib/server/email-test-send.ts',{overrides:{
    './mailflow-store':{listIntegrations:async()=>({integrations:[{providerId:'unisender',publicConfig:{senderEmail:'sender@example.org',listId:'test-list'}}]})},
    './provider-checks':{automaticProviderSecrets:()=>({apiKey:'test-only'})},
    './runtime-integrations':{isIntegrationReadyForChannel:()=>true},
    './provider-adapters':{...adapter,sendUniSenderTransactionalEmail:async value=>{calls.push(value);return {status:'accepted'};}},
  }});
  const doc=document();doc.blocks.push({...builder.createBlock('footer'),aiRole:'footer',variant:'footer-minimal',content:'Организаторы'});
  doc.subject='Приглашение для {{first_name|абитуриента}}';
  doc.blocks[0].content='Здравствуйте, {{first_name|друзья}}! {{company}}';
  await server.sendEmailBuilderTest(new Request('https://example.org'),{document:doc,email:'recipient@example.org'});
  assert.equal(calls.length,1);assert.equal(calls[0].subject,'[Тест] Приглашение для абитуриента');
  assert.match(calls[0].htmlBody,/Здравствуйте, друзья!/);assert.match(calls[0].htmlBody,/\{\{UnsubscribeUrl\}\}/);
  assert.doesNotMatch(calls[0].htmlBody,/\{\{(?:first_name|company)/);
  doc.blocks[0].content='До встречи {{event_date}}';
  await assert.rejects(()=>server.sendEmailBuilderTest(new Request('https://example.org'),{document:doc,email:'recipient@example.org'}),error=>error.status===422&&/event_date/.test(error.message));
  assert.equal(calls.length,1);
});

test('subject/preheader selection feeds compiled HTML, persistence and undo without changing content', () => {
  const original=document();let history=builder.createHistory(original);
  for(const variant of [{subject:'Приходите знакомиться',preheader:'Встреча для абитуриентов'},{subject:'Знакомство с институтом',preheader:'Приглашаем на первое собрание'}]) {
    history=builder.historyReducer(history,{type:'update',update:doc=>({...doc,subject:variant.subject,previewText:variant.preheader})});
    const saved=compiler.parseEmailBuilderDocument(json(history.present));
    assert.equal(saved.subject,variant.subject);assert.equal(saved.previewText,variant.preheader);
    assert.match(compiler.compileEmailDocument(saved),new RegExp(variant.preheader));
    assert.deepEqual(json(history.present.blocks),json(original.blocks));
    assert.equal(builder.documentFromApiTemplate({builderDocument:saved}).subject,variant.subject);
  }
  history=builder.historyReducer(history,{type:'undo'});assert.equal(history.present.subject,'Приходите знакомиться');
});

test('photo intent does not regenerate for text, size, negation or pattern commands', () => {
  const doc=document();doc.blocks.push({...builder.createBlock('image'),href:'https://example.org/photo.png'});
  for(const command of ['Измени размер картинки','Не меняй фото, сократи текст','Пересоздай выбранный узор без фона','Сделать короче'])assert.equal(intent.emailImageReplacement(doc,command).requested,false,command);
  assert.equal(intent.emailImageReplacement(doc,'Измени картинку в письме',doc.blocks[0].id).blockId,doc.blocks[1].id);
});

test('session lookup retries only a transient read, preserves empty results and fails closed', async () => {
  const auth=await loadAiServer('lib/server/session-read.ts');const signal=new AbortController().signal;let reads=0;
  const rows=await auth.readSession(async()=>{if(++reads===1)throw new Error('Failed query',{cause:new Error('D1_ERROR: Network connection lost.')});return ['session'];},signal);
  assert.deepEqual(rows,['session']);assert.equal(reads,2);
  assert.deepEqual(await auth.readSession(async()=>[],signal),[]);
  reads=0;await assert.rejects(()=>auth.readSession(async()=>{reads++;throw new Error('no such table');},signal),error=>error.status===503);assert.equal(reads,1);
  reads=0;await assert.rejects(()=>auth.readSession(async()=>{reads++;throw new Error('SQLITE_BUSY');},signal),error=>error.status===503);assert.equal(reads,2);
});

test('a failed activity timestamp does not reject a valid login, while absent sessions remain unauthorized',async()=>{
  let rows=[{session:{id:'session',lastSeenAt:'2026-01-01'},participant:{id:'person',name:'Test',email:'test@example.org',status:'active',color:'#000000'}}];let updates=0;
  const chain={from(){return this;},innerJoin(){return this;},where(){return this;},limit:async()=>rows};
  const database={select:()=>chain,update:()=>({set:()=>({where:async()=>{updates++;throw new Error('D1 write unavailable');}})})};
  const tables={authSessions:{participantId:'participant',id:'id',tokenHash:'hash',expiresAt:'expires'},participants:{id:'id'},contacts:{},teamInvites:{}};
  const sql=(...args)=>args;
  const auth=await loadAiServer('lib/server/team-auth.ts',{overrides:{'@/db':{getDb:()=>database,getD1:()=>({})},'@/db/schema':tables,'drizzle-orm':{and:sql,eq:sql,gt:sql,isNotNull:sql,isNull:sql,lt:sql,sql}}});
  const req=()=>new Request('https://example.org',{headers:{cookie:'potok_session=test-session-token'}});
  assert.equal((await auth.requireTeamSession(req())).sessionId,'session');assert.equal(updates,1);
  rows=[];await assert.rejects(()=>auth.requireTeamSession(req()),error=>error.status===401);
  assert.equal(await auth.getTeamSession(new Request('https://example.org')),null);
});
