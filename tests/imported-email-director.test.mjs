import assert from 'node:assert/strict';
import test from 'node:test';
import { importedSource, addImportViewport } from '../lib/email-import/director.ts';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
const env = { NAVYAI_API_KEY: 'test-key', NAVYAI_EMAIL_MODEL: 'gpt-5.6-sol' };
const request = () => new Request('https://potok.example/api/email-import/director', { method: 'POST' });
const output = (extra = {}) => JSON.stringify({ imagesReadable: true, summary: 'Заголовок читается лучше.', findings: [], notes: [], patches: [], html: '', crops: [], ...extra });
const reply = value => Response.json({ choices: [{ message: { content: value } }] });
const asset = '/api/assets/email-asset-test';
const png = 'data:image/png;base64,iVBORw0KGgo=';
const imageLetter = `<html><body><img src="${asset}" alt="letter.png"></body></html>`;
const original = '<!doctype html><html><head><style>@media(max-width:500px){td{padding:12px}}</style></head><body><!--[if mso]><table><![endif]--><h1 style="color:#123456">До встречи 16 сентября</h1><p>Цена: 500 ₽. Точный текст приглашения и {{first_name}}.</p><a href="https://example.org/?a=1&amp;b=2">Записаться</a><!--[if mso]></table><![endif]--></body></html>';
const load = options => loadAiServer('lib/server/imported-email-director.ts', { env, assetStore: { getEmailAssetDataUrl: async () => png }, ...options });

test('import inspection distinguishes image pages from HTML and retains the original for safe quick fixes', () => {
  assert.equal(importedSource(imageLetter).imageOnly, true);
  assert.equal(importedSource(original).imageOnly, false);
  assert.equal(importedSource('<head><title>long title that is not body text</title></head>'+imageLetter).imageOnly, true);
  const viewport = addImportViewport(original);
  assert.equal(viewport.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',''), original);
  assert.equal(addImportViewport(viewport), viewport);
});

test('HTML patches preserve text, URLs, media queries, placeholders and Outlook comments byte for byte', async () => {
  const api = await load();
  const result = api.parseImportDirection(output({patches:[{before:'color:#123456',after:'color:#456789'}]}),original,'revise','Сделай заголовок синим',[]);
  assert.equal(result.html, original.replace('color:#123456','color:#456789'));
  assert.equal(api.applyImportPatches('  exact  ',[{before:'  exact  ',after:' $& $$ '}]),' $& $$ ');
  assert.throws(()=>api.applyImportPatches('same same',[{before:'same',after:'new'}]),/уникальному/);
  assert.throws(()=>api.applyImportPatches('abcdef',[{before:'abc',after:'new'},{before:'bcd',after:'overlap'}]),/пересекаются/);
});

test('actual workspace image bytes are sent to vision, not just filename or HTML', async () => {
  let payload, writes=0;
  const api=await load({assetStore:{getEmailAssetDataUrl:async(req,id)=>{assert.equal(id,'email-asset-test');return png;},storeGeneratedEmailAsset:async()=>writes++},fetch:async(url,init)=>{payload=JSON.parse(init.body);return reply(output({summary:'На изображении видна иллюстрация.'}));}});
  const result=await api.directImportedEmail(request(),{html:imageLetter,action:'review'});
  assert.equal(payload.model,'gemini-3.8-flash');
  assert.equal(payload.messages[1].content[1].type,'image_url');
  assert.equal(payload.messages[1].content[1].image_url.url,png);
  assert.equal(result.imagesSeen,1);assert.equal(result.imagesTotal,1);
  assert.equal(result.html,'');assert.equal(writes,0);
});

test('OpenAI uses Responses image input and disables storage', async () => {
  let payload;
  const api=await load({env:{OPENAI_API_KEY:'test'},fetch:async(url,init)=>{payload=JSON.parse(init.body);return Response.json({output_text:output()});}});
  await api.directImportedEmail(request(),{html:imageLetter,action:'review'});
  assert.equal(payload.store,false);assert.equal(payload.input[0].content[1].type,'input_image');assert.equal(payload.input[0].content[1].image_url,png);
});

test('image reconstruction returns editable HTML and validated source crops without writes', async () => {
  const html='<html><body><h1>Приглашаем на первое ознакомительное собрание</h1><img src="{{crop:hero}}"><p>Встреча 16 сентября. До встречи!</p></body></html>';
  const api=await load({fetch:async()=>reply(output({html,crops:[{id:'hero',source:asset,x:0.5,y:0,width:0.5,height:0.5}]}))});
  const result=await api.directImportedEmail(request(),{html:imageLetter,action:'rebuild',command:'Восстанови текст и оформление'});
  assert.equal(result.html,html);assert.equal(result.crops.length,1);
  assert.throws(()=>api.parseImportDirection(output({html,crops:[{id:'hero',source:asset,x:0.9,y:0,width:0.5,height:0.5}]}),imageLetter,'rebuild','',[asset]),/пределы/);
});

test('model cannot add tracking URLs, execute scripts, invent crop sources, or claim an unchanged revision', async () => {
  const api=await load();
  for(const after of ['color:red" onclick="alert(1)','color:red"><img src="https://tracker.invalid/pixel"><p style="','color:red;background:url(https://tracker.invalid/pixel)']) {
    assert.throws(()=>api.parseImportDirection(output({patches:[{before:'color:#123456',after}]}),original,'revise','Цвет',[]));
  }
  assert.throws(()=>api.parseImportDirection(output(),original,'revise','Цвет',[]), error=>error.status===422);
  assert.throws(()=>api.parseImportDirection(output({html:imageLetter,crops:[{id:'hero',source:'https://private.invalid',x:0,y:0,width:1,height:1}]}),imageLetter,'rebuild','',[asset]),/исходник/);
});

test('remote image URLs never trigger server fetching; incomplete visual coverage is explicit',async()=>{
  const calls=[];
  const api=await load({fetch:async(url)=>{calls.push(url);return reply(output());}});
  await assert.rejects(api.directImportedEmail(request(),{html:'<img src="http://127.0.0.1/secrets">',action:'review'}),error=>error.status===422);
  assert.equal(calls.length,0);
  const result=await api.directImportedEmail(request(),{html:original.replace('</body>','<img src="http://127.0.0.1/secrets"></body>'),action:'review'});
  assert.equal(result.imagesSeen,0);assert.equal(result.imagesTotal,1);assert.equal(calls.length,1);
});

test('all PDF/Word image pages are passed to vision; missing pages stop reconstruction',async()=>{
  const pages='<body><img src="/api/assets/page-1"><img src="/api/assets/page-2"></body>';
  let count;
  const api=await load({fetch:async(url,init)=>{count=JSON.parse(init.body).messages[1].content.filter(item=>item.type==='image_url').length;return reply(output());}});
  await api.directImportedEmail(request(),{html:pages,action:'review'});assert.equal(count,2);
  const broken=await load({assetStore:{getEmailAssetDataUrl:async(req,id)=>{if(id==='page-2')throw new Error('missing');return png;}},fetch:()=>assert.fail('incomplete document must not be sent')});
  await assert.rejects(broken.directImportedEmail(request(),{html:pages,action:'review'}));
});

test('authentication, rate limits, missing provider and bounded body prevent model calls',async()=>{
  const fetch=()=>assert.fail('No provider calls');
  const absent=await load({env:{},fetch});
  await assert.rejects(absent.directImportedEmail(request(),{html:original,action:'review'}),error=>error.status===503);
  const unauthorized=await load({fetch,overrides:{'./database-init':{ensureDatabase:async()=>{throw new Error('Unauthorized');},WORKSPACE_ID:'workspace'}}});
  await assert.rejects(unauthorized.directImportedEmail(request(),{html:original,action:'review'}),/Unauthorized/);
  const limited=await load({fetch,overrides:{'@/db':{getD1:()=>({prepare:()=>({bind(){return this;},first:async()=>null})})}}});
  await assert.rejects(limited.directImportedEmail(request(),{html:original,action:'review'}),error=>error.status===429);
  const route=await loadAiServer('app/api/email-import/director/route.ts',{fetch,assetStore:{getEmailAssetDataUrl:async()=>png}});
  assert.equal((await route.POST(new Request(request(),{body:'x'.repeat(2_100_001)}))).status,413);
});

test('unreadable images never become a successful visual audit or silently switch to a text model',async()=>{
  let calls=0;
  const api=await load({fetch:async()=>{calls++;return reply(output({imagesReadable:false,summary:'Не вижу картинку'}));}});
  await assert.rejects(api.directImportedEmail(request(),{html:imageLetter,action:'review'}),error=>error.status===422&&/прочитать/.test(error.message));
  assert.equal(calls,1);
});

test('reconstruction rejects an entire source page pasted behind duplicated live text',async()=>{
 const api=await load();
 const repeated='<html><body><h1>Приглашаем на ознакомительное собрание</h1><img src="'+asset+'"></body></html>';
 assert.throws(()=>api.parseImportDirection(output({html:repeated}),imageLetter,'rebuild','Сделай редактируемое письмо',[asset]),/целую страницу/);
 assert.throws(()=>api.parseImportDirection(output({html:repeated.replace(asset,'{{crop:hero}}'),crops:[{id:'hero',source:asset,x:0,y:0,width:1,height:1}]}),imageLetter,'rebuild','Сделай редактируемое письмо',[asset]),/целую страницу/);
});
