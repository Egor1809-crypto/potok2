import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

const schema = await loadAiServer('lib/email-ai/schema.ts');
const mapper = await loadAiServer('lib/email-ai/mapping.ts');
const compiler = await loadAiServer('lib/server/email-document.ts');
const facts = await loadAiServer('lib/email-ai/facts.ts');
const variants = await loadAiServer('lib/email-ai/variants.ts');
const brief = () => schema.parseAiEmailBrief({ description: 'Продать билеты на конференцию юристов по ИИ. Реальные практические кейсы, 30+ спикеров.', goal: 'sale', cta: { text: 'Получить билет', url: 'https://example.org/tickets' }, requiredFacts: ['30+ спикеров'], visuals: 'none' });
const block = (type, patch = {}) => ({ id: type, type, variant: variants.emailBlockVariants[type][0], title: '', text: '', badge: '', items: [], button: null, image: null, backgroundColor: null, textColor: null, ...patch });
const draft = (blocks = [block('hero', { title: 'ИИ в юридической практике', text: 'Реальные кейсы и 30+ спикеров', button: brief().cta }), block('footer', {text: 'Организатор конференции'})]) => ({ version: '1.0', subject: 'ИИ для юристов: практические кейсы', preheader: '30+ спикеров на конференции', meta: { goal: 'sale', language: 'ru', tone: 'expert', length: 'medium' }, theme: { emailWidth: 640, backgroundColor: '#F1F4F6', contentBackgroundColor: '#FFFFFF', textColor: '#18212D', mutedTextColor: '#637080', primaryColor: '#087F73', accentColor: '#C06532', borderColor: '#DCE5E7', borderRadius: 12, fontFamily: 'Arial' }, blocks });
const review = () => ({ findings: [] });
const req = signal => new Request('https://evaluation.example/api/email-ai/generate', {signal});
const json = value => JSON.parse(JSON.stringify(value));
async function service(replies, options = {}) {
  const calls = []; let images = 0;
  const api = await loadAiServer('lib/server/email-ai-studio.ts', { env: {NAVYAI_API_KEY:'test-only'}, assetStore: {storeGeneratedEmailAssetBytes: async () => ({url:`https://evaluation.example/api/assets/image-${++images}`}), getEmailAssetRecord: async (_req,id) => { if (id !== 'uploaded-photo') throw Error('Asset not found'); return {url:'https://evaluation.example/api/assets/uploaded-photo'}; }}, fetch: async (url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    if (options.cancel) { options.cancel.abort(); throw Error('aborted'); }
    if (body.response_format?.json_schema?.name === 'email_pattern') return Response.json({choices:[{message:{content:JSON.stringify({strokes:[{type:'polyline',points:[{x:20,y:60},{x:1180,y:60}],radius:0,width:2,color:'#AA8844'},{type:'polyline',points:[{x:20,y:100},{x:1180,y:100}],radius:0,width:2,color:'#AA8844'},{type:'circle',points:[{x:600,y:80}],radius:12,width:2,color:'#AA8844'}]})}}]});
    if (String(url).endsWith('/images/generations')) return Response.json({data:[{b64_json:btoa('test-png-bytes'.repeat(20))}]});
    assert.ok(replies.length, 'No unbounded AI retry'); const value = replies.shift();
    if (value instanceof Error) throw value;
    return Response.json({choices:[{message:{content:typeof value === 'string' ? value : JSON.stringify(value)}}]});
  }});
  return {api,calls,get images(){return images;}};
}

test('strict contract rejects HTML, extra fields, invalid version, duplicate IDs and mismatched variants', () => {
  assert.equal(schema.parseAiEmailDocument(draft()).version,'1.0');
  for (const value of [{...draft(),html:'<b>x</b>'},{...draft(),version:'2.0'},draft([block('text',{text:'x'}),block('text',{text:'y'})]),draft([block('text',{text:'x',variant:'hero-dark'})])]) assert.throws(()=>schema.parseAiEmailDocument(value));
});
test('brief and blocks reject script, data, local and credential URLs; empty optional settings work',()=>{
  assert.equal(brief().brand.name,'');
  for(const url of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.org','http://localhost:3000/test','https://example.org/\nfoo']) assert.throws(()=>schema.parseAiEmailBrief({...brief(),cta:{text:'Go',url}}));
  assert.throws(()=>schema.parseAiEmailBlock(block('image',{image:{assetId:null,alt:'',prompt:null}})));
});
test('fact checks retain 30+ and reject invented metrics, urgency, reviews, URLs and forbidden visuals',()=>{
  assert.equal(facts.emailFactIssues(draft(),brief()).length,0);
  const bad=draft([block('stats',{items:[{title:'',text:'',value:'40%',label:'экономия'}]}),block('urgency',{text:'Сегодня'}),block('review',{text:'Лучшая конференция'}),block('cta',{button:{text:'Купить',url:'https://invented.example'}}),block('image',{image:{assetId:'x',alt:'',prompt:null}})]);
  assert.ok(facts.emailFactIssues(bad,brief()).length>=5);
  assert.equal(facts.emailFactIssues(draft([block('text',{text:'Будет 31 спикер'})]),brief(),'Пользователь исправил факт: 31 спикер').length,0);
});
test('adapter preserves every card and stat, captions, order and stable collision-free IDs',()=>{
  const items=Array.from({length:4},(_,i)=>({title:`Заголовок ${i}`,text:`Пояснение ${i}`,value:`${i}`,label:`Метка ${i}`}));
  const email=draft([block('cards',{title:'Карточки',text:'Введение',items}),block('text',{id:'cards-heading',text:'Соседний блок'}),block('stats',{title:'Числа',text:'Пояснение чисел',items})]);
  const doc=mapper.mapAiEmailToBuilderDocument(email,brief(),new Map()); const content=doc.blocks.map(b=>b.content).join('\n');
  assert.equal(new Set(doc.blocks.map(b=>b.id)).size,doc.blocks.length); assert.ok(content.includes('Введение')); assert.ok(content.includes('Пояснение чисел'));
  for(const item of items) for(const value of Object.values(item)) assert.ok(content.includes(value));
  assert.deepEqual(json(mapper.mapAiEmailToBuilderDocument(email,brief(),new Map())),json(doc));
});
test('all semantic blocks map to regular editable builder types and compile',()=>{
  const email=draft(Object.keys(variants.emailBlockVariants).map(type=>block(type,{text:'Содержимое',title:'Заголовок',...(type==='image'||type==='pattern'||type==='header'?{image:{assetId:'photo',alt:'Описание',prompt:null}}:{}),...(['benefits','cards','stats','speakers','products'].includes(type)?{items:[{title:'Пункт',text:'Детали',value:'30+',label:'спикеров'}]}:{}),...(type==='cta'?{button:brief().cta}:{})})));
  const document=mapper.mapAiEmailToBuilderDocument(email,brief(),new Map([['photo','https://example.org/image.png']]));
  const valid=compiler.parseEmailBuilderDocument(document); assert.ok(valid.blocks.every(b=>b.content||['divider','spacer','pattern'].includes(b.type)));
  assert.ok(compiler.compileEmailDocument(valid).endsWith('</html>'));
});
test('metadata, uploaded images, quote attribution and hero layout survive persistence and edit context',()=>{
  const b=brief(); b.brand={...b.brand,name:'Команда',website:'https://example.org',socialLinks:[{label:'Telegram',url:'https://t.me/example'}]};
  const email=draft([block('hero',{variant:'hero-image-left',title:'Заголовок',text:'Содержание',image:{assetId:'photo',alt:'Тематическое фото',prompt:null},button:b.cta}),block('quote',{title:'Автор',text:'Подлинная цитата'}),block('footer',{text:'Команда'})]);
  const metadata={brief:b,generationId:'generation-id',generatedAt:new Date().toISOString(),model:'configured-model',review:{score:90,issues:[{severity:'low',message:'Проверьте текст'}],suggestions:[]}};
  const doc=compiler.parseEmailBuilderDocument(mapper.mapAiEmailToBuilderDocument(email,b,new Map([['photo','https://example.org/photo.png']]),metadata));
  assert.equal(doc.aiMetadata.generationId,metadata.generationId);assert.equal(doc.blocks[0].imageHref,'https://example.org/photo.png');
  const context=mapper.builderToAiEmail(doc,b);const quote=context.email.blocks.find(b=>b.type==='quote');assert.equal(quote.title,'Автор');assert.equal(quote.text,'Подлинная цитата');
  assert.match(compiler.compileEmailDocument(doc),/https:\/\/t.me\/example/);assert.equal(doc.blocks.find(b=>b.type==='footer').content,'Команда');
});
test('renderer produces deterministic portable email HTML with escaped text, mobile tables and unsubscribe',()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft([block('hero',{title:'<script>alert(1)</script>',text:'Текст & детали',variant:'hero-image-right',image:{assetId:'x',alt:'<Фото>',prompt:null},button:brief().cta}),block('footer',{text:'Подвал'})]),brief(),new Map([['x','https://example.org/photo.png']]));
  const html=compiler.compileEmailDocument(doc);assert.ok(html.startsWith('<!DOCTYPE html>'));assert.ok(html.endsWith('</html>'));assert.doesNotMatch(html,/<script\b|javascript:|blob:|localhost/);assert.match(html,/&lt;script&gt;/);assert.match(html,/role="presentation"/);assert.match(html,/email-column/);assert.match(html,/\{\{UnsubscribeUrl\}\}/);assert.equal(html,compiler.compileEmailDocument(doc));
});
test('switching variants preserves content, URL, image, ID and applies a contrasting dark theme',()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());const before=doc.blocks[0];const after=variants.applyEmailVariant(before,'hero-dark',doc);
  for(const key of ['id','content','href','imageHref']) assert.equal(after[key],before[key]);assert.equal(after.textColor,'#FFFFFF');assert.notEqual(after.backgroundColor,before.backgroundColor);
});
test('generation maps validated JSON and review to the existing builder document',async()=>{
  const {api,calls}=await service([draft(),review()]);const result=await api.emailAiStudio(req(),'generate',{brief:brief()});assert.equal(result.review.score,100);assert.equal(result.review.rubricVersion,'rules-v1');assert.equal(result.review.unavailable,undefined);assert.equal(result.document.blocks[0].type,'hero');assert.equal(calls.length,2);assert.equal(calls[0].response_format.type,'json_schema');
});
test('one repair fixes malformed JSON; repeated invalid output stops after two calls',async()=>{
  const repaired=await service(['not JSON',draft(),review()]);assert.ok((await repaired.api.emailAiStudio(req(),'generate',{brief:brief()})).document);assert.equal(repaired.calls.length,3);
  const invalid=await service(['not JSON','still not JSON']);await assert.rejects(()=>invalid.api.emailAiStudio(req(),'generate',{brief:brief()}));assert.equal(invalid.calls.length,2);
});
test('numeric inventions are repaired before render, with a single repair budget shared with review',async()=>{
  const bad=draft();bad.blocks[0].text='Экономия 40%';const s=await service([bad,draft(),{findings:[{category:'clarity',blockId:'hero',evidence:'Реальные кейсы',message:'Уточните пользу',suggestion:'Свяжите кейсы с задачами аудитории'}]}]);
  const r=await s.api.emailAiStudio(req(),'generate',{brief:brief()});assert.doesNotMatch(r.document.blocks[0].content,/40%/);assert.equal(s.calls.length,3);
});
test('review outages return a usable editable document and honest advisory status',async()=>{
  const {api}=await service([draft(),new Error('Review outage')]);const r=await api.emailAiStudio(req(),'generate',{brief:brief()});assert.ok(r.document);assert.equal(r.review.score,100);assert.equal(r.review.unavailable,true);
});
test('block rewrite changes only the selected block and keeps subject, siblings, layout settings and template ID',async()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());doc.templateId='saved-template';doc.blocks[0].paddingLeft=44;
  const replacement=block('hero',{title:'Кейсы ИИ для юристов',text:'30+ спикеров',button:brief().cta});
  const {api}=await service([replacement,review()]);const r=await api.emailAiStudio(req(),'rewrite-block',{brief:brief(),document:doc,blockId:'hero',instruction:'Сделать короче'});
  assert.equal(r.document.templateId,doc.templateId);assert.equal(r.document.subject,doc.subject);assert.deepEqual(json(r.document.blocks[1]),json(compiler.parseEmailBuilderDocument(doc).blocks[1]));assert.equal(r.document.blocks[0].paddingLeft,44);assert.match(r.document.blocks[0].content,/Кейсы ИИ/);
});
test('full rewrite uses current content and preserves IDs; regeneration does not mutate the supplied document',async()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());const original=JSON.stringify(doc);const next=draft();next.blocks[0].title='Новый заголовок';
  const {api,calls}=await service([next,review()]);const r=await api.emailAiStudio(req(),'rewrite',{brief:brief(),document:doc,instruction:'Другой заголовок'});assert.equal(JSON.stringify(doc),original);assert.equal(r.document.blocks[0].id,doc.blocks[0].id);assert.ok(JSON.parse(calls[0].messages[1].content).task.email.blocks.length);
});
test('subject suggestions return three independent pairs without changing blocks',async()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());const original=JSON.stringify(doc);const pairs=Array.from({length:3},(_,i)=>({subject:['Практика ИИ','Конференция юристов','Кейсы для юридической команды'][i],preheader:'30+ спикеров'}));
  const {api,calls}=await service([{variants:pairs}]);const r=await api.emailAiStudio(req(),'subject-variants',{brief:brief(),document:doc});assert.deepEqual(json(r.variants),pairs);assert.equal(JSON.stringify(doc),original);assert.equal(calls.length,1);
});
test('images become stored HTTPS assets; uploaded originals are resolved through the workspace store',async()=>{
  const b=brief();b.visuals='auto';const email=draft([block('hero',{title:'Приглашение',image:{assetId:null,alt:'Конференция',prompt:'Editorial conference illustration, teal and amber'}}),block('pattern',{image:{assetId:null,alt:'',prompt:'Subtle teal geometric ornament'}})]);
  const s=await service([email,review()]);const r=await s.api.emailAiStudio(req(),'generate',{brief:b});assert.equal(s.images,2);assert.match(r.document.blocks[0].imageHref,/https:\/\/evaluation.example\/api\/assets/);
  b.assets=[{id:'uploaded-photo',url:'https://untrusted.example/photo.png',filename:'Фото.png',kind:'photo'}];const uploaded=draft([block('image',{image:{assetId:'uploaded-photo',alt:'Фото',prompt:null}})]);const u=await service([uploaded,review()]);const kept=await u.api.emailAiStudio(req(),'generate',{brief:b});assert.equal(u.images,0);assert.equal(kept.document.blocks[0].href,'https://evaluation.example/api/assets/uploaded-photo');
});
test('cancellation stops without fallback, and raw imported HTML is never silently rewritten',async()=>{
  const controller=new AbortController();const s=await service([],{cancel:controller});await assert.rejects(()=>s.api.emailAiStudio(req(controller.signal),'generate',{brief:brief()}),e=>e.status===499);assert.equal(s.calls.length,1);
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());doc.rawHtml='<!DOCTYPE html><html><body>Оригинал</body></html>';
  const h=await service([]);await assert.rejects(()=>h.api.emailAiStudio(req(),'rewrite',{brief:brief(),document:doc,instruction:'Сократи'}));assert.equal(h.calls.length,0);
});
test('AI updates, manual variants, Undo and Redo share the existing history; saved drafts reopen identically',async()=>{
  const builder=await loadAiServer('components/email-builder/builder-types.ts');
  const original=builder.builderDocumentFromInput(mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map()));
  const changed={...original,subject:'Изменённая тема',blocks:original.blocks.map(b=>b.id==='hero'?{...b,content:'Короче|30+ спикеров'}:b)};
  let history=builder.createHistory(original);history=builder.historyReducer(history,{type:'update',update:()=>changed});assert.equal(history.present,changed);
  history=builder.historyReducer(history,{type:'undo'});assert.equal(history.present,original);history=builder.historyReducer(history,{type:'redo'});assert.equal(history.present,changed);
  const saved=compiler.parseEmailBuilderDocument(json(changed));const reopened=builder.documentFromApiTemplate({builderDocument:saved});assert.equal(reopened.subject,changed.subject);assert.deepEqual(json(reopened.blocks),json(saved.blocks));
});
test('copy-only whole edits retain manual frame, spacing and typography',async()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());doc.frameStyle='double';doc.blocks[0].fontSize=28;doc.blocks[0].paddingLeft=24;
  const next=draft();next.blocks[0].text='30+ спикеров';const s=await service([next,review()]);const r=await s.api.emailAiStudio(req(),'rewrite',{brief:brief(),document:doc,instruction:'Сделай текст короче'});
  assert.equal(r.document.frameStyle,'double');assert.equal(r.document.blocks[0].fontSize,28);assert.equal(r.document.blocks[0].paddingLeft,24);
});
test('repair receives the invalid JSON document instead of regenerating without its design',async()=>{
  const invalid=draft();invalid.theme.fontFamily='Arial, sans-serif';const s=await service([invalid,draft(),review()]);await s.api.emailAiStudio(req(),'generate',{brief:brief()});
  const repair=JSON.parse(s.calls[1].messages[1].content).task;assert.equal(repair.previousDraft.theme.fontFamily,'Arial, sans-serif');assert.match(repair.repairIssues[0],/fontFamily/);
});
test('review-unavailable status survives save and reopening',()=>{
  const doc=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map(),{brief:brief(),generationId:'id',generatedAt:new Date().toISOString(),model:'model',review:{score:null,issues:[],suggestions:[],unavailable:true}});
  assert.equal(compiler.parseEmailBuilderDocument(json(doc)).aiMetadata.review.unavailable,true);
});
test('test delivery authenticates, sends to one explicit address, and never retries an uncertain provider result',async()=>{
  const sends=[];let authenticated=0;let accepted=true;
  const server=await loadAiServer('lib/server/email-test-send.ts',{overrides:{
    './mailflow-store':{listIntegrations:async()=>{authenticated++;return {integrations:[{providerId:'unisender',publicConfig:{senderEmail:'sender@example.org',listId:'test-list'}}]};}},
    './provider-checks':{automaticProviderSecrets:()=>({apiKey:'test-only'})},
    './runtime-integrations':{isIntegrationReadyForChannel:()=>true},
    './provider-adapters':{renderMergeTemplate:html=>html,sendUniSenderTransactionalEmail:async input=>{sends.push(input);return {status:accepted?'accepted':'unknown'};}},
  }});
  const document=mapper.mapAiEmailToBuilderDocument(draft(),brief(),new Map());
  await assert.rejects(()=>server.sendEmailBuilderTest(req(),{email:'invalid',document}));assert.equal(sends.length,0);
  const result=await server.sendEmailBuilderTest(req(),{email:'recipient@example.org',document});assert.match(result.message,/принял/);assert.equal(sends.length,1);assert.equal(sends[0].recipientEmail,'recipient@example.org');assert.ok(sends[0].htmlBody.startsWith('<!DOCTYPE html>'));assert.equal(authenticated,2);
  accepted=false;await assert.rejects(()=>server.sendEmailBuilderTest(req(),{email:'recipient@example.org',document}));assert.equal(sends.length,2);
  document.blocks[0].imageHref='http://localhost:3000/api/assets/test';await assert.rejects(()=>server.sendEmailBuilderTest(req(),{email:'recipient@example.org',document}));assert.equal(sends.length,2);
});
