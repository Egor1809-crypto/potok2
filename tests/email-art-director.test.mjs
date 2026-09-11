import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
const codec = await loadAiServer('lib/email-ai/pattern-png.ts');
const rules = await loadAiServer('lib/email-ai/review.ts');
const compiler = await loadAiServer('lib/server/email-document.ts');
const schema = await loadAiServer('lib/email-ai/schema.ts');
const builder = await loadAiServer('components/email-builder/builder-types.ts');
const brief = schema.parseAiEmailBrief({description:'Приглашение юристов на конференцию',visuals:'auto'});
const raw=Buffer.alloc(120*40*4);
for(let x=5;x<115;x++) for(const y of [16,23]) raw.set([190,150,70,255],(y*120+x)*4);
// Intentional WHITE details must survive; no chroma-key/background guessing.
raw.set([255,255,255,255],(20*120+60)*4);
const validPng=await sharp(raw,{raw:{width:120,height:40,channels:4}}).png().toBuffer();
const opaque=await sharp({create:{width:120,height:40,channels:4,background:'#ffffff'}}).png().toBuffer();
const block=(patch={})=>({id:'body',type:'text',content:'Познакомьтесь с практикой применения ИИ в юридической работе.',paddingTop:20,paddingBottom:20,paddingLeft:36,paddingRight:36,backgroundColor:'#FFFFFF',textColor:'#202632',fontSize:16,borderRadius:0,...patch});
const document=()=>compiler.parseEmailBuilderDocument({templateId:'saved',subject:'ИИ для юридической команды',previewText:'Приглашаем обсудить практические задачи',contentWidth:640,accentColor:'#18334A',bodyBackground:'#FFFFFF',workspaceBackground:'#F5F5F5',blocks:[block()]});
const json=v=>JSON.parse(JSON.stringify(v));

test('transparent PNG keeps alpha and white artwork, trims margins and stays portable',async()=>{
  const result=codec.transparentPatternPng(validPng);assert.ok(result.width/result.height>3);assert.ok(result.height<40);
  const {data,info}=await sharp(result.bytes).raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);
  assert.ok(Array.from(data).some((v,i)=>i%4===3&&v===0));
  let white=false;for(let i=0;i<data.length;i+=4)if(data[i]===255&&data[i+1]===255&&data[i+2]===255&&data[i+3]===255)white=true;assert.ok(white);
});
test('opaque files, fake transparent panels, corrupted PNGs and empty canvases are rejected',async()=>{
  assert.throws(()=>codec.transparentPatternPng(opaque));
  const panel=Buffer.alloc(120*40*4);for(let y=15;y<25;y++)for(let x=5;x<115;x++)panel.set([255,255,255,255],(y*120+x)*4);
  assert.throws(()=>codec.transparentPatternPng(codec.encodeRgbaPng(120,40,panel)));
  const corrupted=Buffer.from(validPng);corrupted[corrupted.length-5]^=1;assert.throws(()=>codec.transparentPatternPng(corrupted));
  assert.throws(()=>codec.transparentPatternPng(codec.encodeRgbaPng(120,40,new Uint8Array(120*40*4))));
});
const drawing={strokes:[{type:'polyline',points:[{x:20,y:60},{x:1180,y:60}],radius:0,width:2,color:'#AA8844'},{type:'polyline',points:[{x:20,y:100},{x:1180,y:100}],radius:0,width:2,color:'#AA8844'},{type:'circle',points:[{x:600,y:80}],radius:12,width:2,color:'#AA8844'}]};
const patternProvider={key:'test-only',provider:'navyai',model:'test',endpoint:'https://provider.example'};
test('pattern provider creates original geometry with alpha guaranteed by the renderer, repairing one invalid drawing',async()=>{
  const calls=[];let stored=0;
  const service=await loadAiServer('lib/server/email-pattern-generation.ts',{fetch:async(_url,init)=>{calls.push(JSON.parse(init.body));return Response.json({choices:[{message:{content:JSON.stringify(calls.length===1?{strokes:[]}:drawing)}}]});},assetStore:{storeGeneratedEmailAssetBytes:async(_req,bytes,mime)=>{stored++;assert.equal(mime,'image/png');codec.transparentPatternPng(bytes);return {url:'https://example.org/pattern.png'};}}});
  await service.generateTransparentEmailPattern(new Request('https://example.org'),patternProvider,'Gold line ornament','#362751');
  assert.equal(calls.length,2);assert.equal(stored,1);assert.equal(calls[0].response_format.json_schema.name,'email_pattern');assert.match(calls[0].messages[0].content,/#362751/);
});
test('two invalid pattern responses fail without storing an opaque fallback',async()=>{
  let calls=0;const service=await loadAiServer('lib/server/email-pattern-generation.ts',{fetch:async()=>{calls++;return Response.json({choices:[{message:{content:'{"strokes":[]}'}}]});},assetStore:{storeGeneratedEmailAssetBytes:async()=>assert.fail('must not persist')}});
  await assert.rejects(()=>service.generateTransparentEmailPattern(new Request('https://example.org'),patternProvider,'Pattern','#FFFFFF'));assert.equal(calls,2);
});
test('same document receives the same transparent calculation regardless of editorial opinion',()=>{
  const doc=document();const good=rules.reviewEmailDocument(doc,brief,{findings:[]});
  const advice=rules.reviewEmailDocument(doc,brief,{findings:[{category:'clarity',blockId:'body',evidence:'Познакомьтесь с практикой',message:'Общий призыв',suggestion:'Начните с конкретной задачи читателя.'}]});
  assert.equal(good.score,advice.score);assert.equal(good.score,100);assert.equal(good.checks.reduce((n,c)=>n+c.maximum,0),100);assert.equal(advice.issues.filter(i=>i.source==='editor').length,1);
  assert.equal(good.checks.find(c=>c.id==='visual').status,'not_checked');
});
test('contrast uses actual foreground and background, deductions and block location are explicit',()=>{
  const doc=document();doc.blocks[0].textColor='#FFFFFF';const report=rules.reviewEmailDocument(doc,brief,{findings:[]});
  assert.equal(report.score,75);assert.equal(report.checks.find(c=>c.id==='contrast').points,0);assert.match(report.issues[0].message,/1.00:1/);assert.equal(report.issues[0].blockId,'body');
});
test('invented citations and nonexistent blocks cannot enter editorial advice',()=>{
  const findings=['missing','body'].map(blockId=>({category:'clarity',blockId,evidence:'Текст, которого здесь нет',message:'Замечание',suggestion:'Исправить'}));
  assert.equal(rules.reviewEmailDocument(document(),brief,{findings}).issues.length,0);
});
test('report and fingerprint survive persistence and client adapter, but expire after text or style edits',()=>{
  const doc=document();const report=rules.reviewEmailDocument(doc,brief,{findings:[]});doc.aiMetadata={brief,generationId:'id',generatedAt:'2026-09-11',model:'test',review:report};
  const saved=compiler.parseEmailBuilderDocument(json(doc));assert.equal(saved.aiMetadata.review.fingerprint,report.fingerprint);
  assert.equal(rules.emailReviewFingerprint(builder.builderDocumentFromInput(saved),brief),report.fingerprint);
  saved.blocks[0].fontSize=18;assert.notEqual(rules.emailReviewFingerprint(saved,brief),report.fingerprint);
  const changed=document();changed.blocks[0].content+=' Новая строка.';assert.notEqual(rules.emailReviewFingerprint(changed,brief),report.fingerprint);
});
test('unchanged persisted review is reused; changed document gets a new grounded review',async()=>{
  const doc=document();const report=rules.reviewEmailDocument(doc,brief,{findings:[]});doc.aiMetadata={brief,generationId:'id',generatedAt:'2026-09-11',model:'test',review:report};let calls=0;
  const service=await loadAiServer('lib/server/email-ai-studio.ts',{env:{NAVYAI_API_KEY:'test-only'},fetch:async(_url,init)=>{calls++;const input=JSON.parse(JSON.parse(init.body).messages[1].content).task;assert.ok(input.document.blocks);assert.ok(input.checks);return Response.json({choices:[{message:{content:JSON.stringify({findings:[]})}}]});}});
  const req=()=>new Request('https://example.org/api/email-ai/review');
  assert.equal((await service.emailAiStudio(req(),'review',{document:doc,brief})).review.fingerprint,report.fingerprint);assert.equal(calls,0);
  doc.blocks[0].textColor='#FFFFFF';assert.equal((await service.emailAiStudio(req(),'review',{document:doc,brief})).review.score,75);assert.equal(calls,1);
});
test('automatic review remains available without an AI key',async()=>{
  const service=await loadAiServer('lib/server/email-ai-studio.ts');const result=await service.emailAiStudio(new Request('https://example.org'),'review',{document:document(),brief});assert.equal(result.review.score,100);assert.equal(result.review.unavailable,true);
});
test('transparent ornaments render at their own proportions without forced crop or painted underlay',()=>{
  const doc=document();doc.blocks=[block({type:'pattern',aiRole:'pattern',variant:'pattern-strip',content:'',href:'https://example.org/pattern.png',backgroundColor:'#362751'})];
  const html=compiler.compileEmailDocument(doc);assert.match(html,/height:auto/);assert.doesNotMatch(html,/object-fit:cover|height="72"|height="88"/);
});
