import assert from 'node:assert/strict';
import test from 'node:test';
import { runSlideReviews, abortable } from '../lib/presentation-import/review-queue.ts';
import { applySlideDirection, normalizeDirectionPatches } from '../lib/presentation-import/direction.ts';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const slide = { id:'slide-1', title:'Итоги', layout:'statement', body:'42 участника', eyebrow:'Обзор', bullets:[], speakerNotes:'' };
const request = () => new Request('https://example.test/api/ai/presentations/director');
const screenshot = 'data:image/jpeg;base64,/9j/';
const context = {number:1,outline:[{title:'Итоги',excerpt:'42 участника'}],theme:{accentColor:'#6633cc'}};
function options(overrides = {}) {return {items:[1,2,3,4,5,6],signal:new AbortController().signal,capture:async n=>n,review:async n=>n,onActive:()=>{},onResult:()=>{},onError:()=>{},isFatal:()=>false,...overrides};}

test('review pipeline overlaps three requests but serializes captures and publishes out-of-order results',async()=>{
 let renders=0,maxRenders=0,requests=0,maxRequests=0;const completed=[];
 await runSlideReviews(options({
  capture:async n=>{renders++;maxRenders=Math.max(maxRenders,renders);await delay(2);renders--;return `image-${n}`;},
  review:async(n,image)=>{assert.equal(image,`image-${n}`);requests++;maxRequests=Math.max(maxRequests,requests);await delay(n===1?70:20);requests--;return n;},
  onResult:(n,result)=>{assert.equal(n,result);completed.push(n);},
 }));
 assert.equal(maxRenders,1);assert.equal(maxRequests,3);assert.notEqual(completed[0],1);assert.deepEqual([...completed].sort(),[1,2,3,4,5,6]);assert.equal(requests,0);
});
test('individual failures preserve successful reviews; retry queue can contain only failed slides',async()=>{
 const completed=[],failures=[];
 await runSlideReviews(options({review:async n=>{if(n===2)throw Error('bad slide');return n;},onResult:n=>completed.push(n),onError:n=>failures.push(n)}));
 assert.deepEqual(failures,[2]);assert.equal(completed.length,5);
 await runSlideReviews(options({items:failures,onResult:n=>completed.push(n)}));assert.equal(new Set(completed).size,6);
});
test('fatal provider errors abort peers and drain workers before retry is allowed',async()=>{
 const seen=[],completed=[],errors=[];let running=0;
 await assert.rejects(runSlideReviews(options({review:async(n,image,signal)=>{seen.push(n);running++;try{if(n===2){await delay(5);throw Error('rate limit');}await abortable(delay(100),signal);return n;}finally{running--;}},onResult:n=>completed.push(n),onError:n=>errors.push(n),isFatal:()=>true})),/rate limit/);
 assert.equal(running,0);assert.deepEqual(completed,[]);assert.deepEqual(errors,[2]);assert.ok(seen.length<=3);
});
test('cancellation rejects promptly even while a font or image never finishes loading',async()=>{
 const abort=new AbortController();let calls=0;
 const work=runSlideReviews(options({signal:abort.signal,capture:async(n,signal)=>{calls++;return abortable(new Promise(()=>{}),signal);}}));
 await delay(2);abort.abort();await assert.rejects(work);assert.equal(calls,1);
});
test('geometry safety rejects newly clipped elements and distorted images without mutating slides',()=>{
 const imported={...slide,canvas:{width:960,height:540,source:'pptx',elements:[{id:'image',kind:'image',x:20,y:20,width:400,height:200,imageUrl:'/api/assets/photo'},{id:'text',kind:'text',x:500,y:40,width:400,height:80,fontSize:30,text:'42 участника'}]}};
 const direction=patches=>({summary:'Правки',findings:[],patches});
 for(const patches of [[{target:'image',field:'width',value:'600'}],[{target:'text',field:'x',value:'900'}],[{target:'text',field:'fontSize',value:'90'}],[{target:'image',field:'fontSize',value:'40'}]])assert.throws(()=>applySlideDirection(imported,direction(patches)));
 const after=applySlideDirection(imported,direction([{target:'image',field:'width',value:'300'},{target:'image',field:'height',value:'150'},{target:'text',field:'fontSize',value:'36'}]));
 assert.equal(after.canvas.elements[0].width,300);assert.equal(imported.canvas.elements[0].width,400);assert.equal(after.canvas.elements[1].text,'42 участника');
});
async function server(response, provider='navyai') {
 const payloads=[];
 const api=await loadAiServer('lib/server/presentation-director.ts',{overrides:{'@/db':{getDb:()=>{throw Error('Unexpected DB access');},getD1:()=>({prepare:()=>({bind(){return this;},first:async()=>({request_count:1})})})},'./email-ai':{aiProvider:()=>({provider,visionModel:'test-vision',model:'test-text',key:'test',endpoint:'https://test.invalid'}),parseAiJson:JSON.parse}},fetch:async(url,init)=>{payloads.push(JSON.parse(init.body));return Response.json(provider==='navyai'?{choices:[{message:{content:JSON.stringify(response)}}]}:{output_text:JSON.stringify(response)});}});
 return {api,payloads};
}
test('review accepts compact JPEG, keeps image high-detail and never asks for editable patches',async()=>{
 for(const provider of ['navyai','openai']){
  const {api,payloads}=await server({summary:'Заголовок читается.',findings:['В тексте «42 участника» уточните период.']},provider);
  const result=await api.directPresentation(request(),{action:'review',slide,screenshot,context});
  assert.equal(result.direction.findings.length,1);assert.equal(result.direction.patches.length,0);assert.equal(result.proposed,undefined);
  const raw=JSON.stringify(payloads[0]);assert.match(raw,/image\/jpeg/);assert.match(raw,/"detail":"high"/);assert.match(raw,/42 участника/);
  const schema=provider==='navyai'?payloads[0].response_format.json_schema.schema:payloads[0].text.format.schema;
  assert.deepEqual(schema.required,['summary','findings']);
 }
});
test('revision gets previous findings and deck context and validates the actual proposal',async()=>{
 const {api,payloads}=await server({summary:'Уточнён заголовок',findings:[],patches:[{target:'slide',field:'title',value:'Итоги встречи'}]});
 const result=await api.directPresentation(request(),{action:'revise',slide,screenshot,context,command:'Уточни заголовок',previousReview:{summary:'Заголовок общий.',findings:['Назовите событие в заголовке.']}});
 assert.equal(result.proposed.title,'Итоги встречи');assert.equal(result.proposed.body,'42 участника');assert.match(JSON.stringify(payloads[0]),/Назовите событие/);assert.match(JSON.stringify(payloads[0]),/#6633cc/);
});
test('malformed reviews and unsafe proposals are rejected, never shown as successful edits',async()=>{
 const invalid=await server({summary:'',findings:[]});await assert.rejects(invalid.api.directPresentation(request(),{action:'review',slide,screenshot,context}),/неполный разбор/);
 const unsafe=await server({summary:'Готово',findings:[],patches:[{target:'slide',field:'imageUrl',value:'/api/assets/other'}]});await assert.rejects(unsafe.api.directPresentation(request(),{action:'revise',slide,screenshot,context}),/Правки не прошли/);
});

test('instant deck overview groups repeated findings with correct slide references without a model call',async()=>{
 const {buildDeckOverview}=await import('../lib/presentation-import/review.ts');
 const overview=buildDeckOverview([{summary:'Первый',findings:['Увеличьте основной текст.','Уточните заголовок.'],patches:[]},{summary:'Второй',findings:['Увеличьте основной текст.','Повысьте контраст.'],patches:[]}]);
 assert.equal(overview.recommendations.length,3);assert.deepEqual(overview.recommendations[0].slides,[1,2]);assert.match(overview.summary,/2/);
 assert.equal(buildDeckOverview([{summary:'Хорошо',findings:[],patches:[]}]).recommendations.length,0);
});

test('fixing known findings uses the text model and does not repeat visual analysis',async()=>{
 const {api,payloads}=await server({summary:'Исправлено',findings:[],patches:[{target:'slide',field:'title',value:'Итоги встречи'}]});
 await api.directPresentation(request(),{action:'revise',slide,screenshot,context,useReview:true,previousReview:{summary:'Заголовок общий',findings:['Уточните заголовок']}});
 assert.equal(payloads[0].model,'test-text');assert.equal(payloads[0].messages[1].content.length,1);assert.match(JSON.stringify(payloads[0]),/Уточните заголовок/);
});
test('optional deck analysis uses complete verified reports and the text model',async()=>{
 const {api,payloads}=await server({summary:'Связный рассказ',recommendations:[]});
 const result=await api.directPresentation(request(),{action:'summary',context,reports:[{number:1,summary:'Готово',findings:[]}]});
 assert.equal(result.overview.summary,'Связный рассказ');assert.equal(payloads[0].model,'test-text');assert.equal(payloads[0].messages[1].content.length,1);
 await assert.rejects(api.directPresentation(request(),{action:'summary',context,reports:[]}),/каждого слайда/);
});

test('compatible-provider grouped patches are expanded losslessly and unknown operations still fail closed',()=>{
 assert.deepEqual(normalizeDirectionPatches([{target:'body',fontSize:32,color:'#222222'}]),[{target:'body',field:'fontSize',value:'32'},{target:'body',field:'color',value:'#222222'}]);
 for(const patches of [[{target:'body',imageUrl:'https://bad.test'}],[{target:'body',field:'fontSize',value:'32',color:'#000000'}],[{target:'body'}]])assert.throws(()=>normalizeDirectionPatches(patches));
});

test('11-slide live queue accepts a priority retry while other slides are running and rejects double clicks',async()=>{
 const {createSlideReviewQueue}=await import('../lib/presentation-import/review-queue.ts');
 const started=[],completed=[],active=new Set();let attempts=0,max=0,queue,retryAccepted;
 let release;const blocked=new Promise(resolve=>{release=resolve;});
 const failed=new Promise(resolve=>{
  queue=createSlideReviewQueue(options({items:Array.from({length:11},(_,i)=>i+1),concurrency:4,
   review:async n=>{started.push(n);active.add(n);max=Math.max(max,active.size);try{if(n===1&&attempts++===0)throw Error('temporary');if(n>=2&&n<=5)await blocked;return n;}finally{active.delete(n);}},
   onError:()=>setTimeout(resolve,0),onResult:n=>completed.push(n),
  }));
 });
 await failed;
 assert.ok(active.size>0,'other slides are still in flight');
 retryAccepted=queue.enqueue(1);assert.equal(retryAccepted,true);assert.equal(queue.enqueue(1),false);
 release();await queue.done;
 assert.equal(max,4);assert.equal(completed.length,11);assert.equal(new Set(completed).size,11);
 assert.ok(started.lastIndexOf(1)<started.indexOf(6),'retry precedes untouched slides');
 assert.equal(queue.enqueue(1),false,'closed queues cannot accept stale retries');
});

test('cancelled live queue drains active requests and drops queued retries',async()=>{
 const {createSlideReviewQueue}=await import('../lib/presentation-import/review-queue.ts');
 const abort=new AbortController();let calls=0;
 const queue=createSlideReviewQueue(options({items:[1,2,3,4,5],signal:abort.signal,review:async(n,image,signal)=>{calls++;await abortable(new Promise(()=>{}),signal);return n;}}));
 await delay(2);assert.equal(queue.enqueue(9),true);abort.abort();await assert.rejects(queue.done);
 assert.equal(calls,3);assert.equal(queue.enqueue(10),false);
});

test('slow or invalid review gets exactly one bounded recovery; cancellation never retries',async()=>{
 const {reviewWithFallback}=await import('../lib/server/presentation-review-attempts.ts');
 const {ApiRequestError}=await import('../lib/server/api-utils.ts');
 for(const mode of ['timeout','invalid']){
  const calls=[];
  const result=await reviewWithFallback({signal:new AbortController().signal,models:['vision','fallback'],timeouts:[5,30],run:async(model,signal)=>{calls.push(model);if(model==='vision'){if(mode==='invalid')throw new ApiRequestError('invalid',422);await abortable(new Promise(()=>{}),signal);}return 'validated';}});
  assert.equal(result,'validated');assert.deepEqual(calls,['vision','fallback']);
 }
 const abort=new AbortController();let attempts=0;
 const pending=reviewWithFallback({signal:abort.signal,models:['vision','fallback'],run:async(model,signal)=>{attempts++;return abortable(new Promise(()=>{}),signal);}});
 abort.abort();await assert.rejects(pending);assert.equal(attempts,1);
 let exhausted=0;
 await assert.rejects(reviewWithFallback({signal:new AbortController().signal,models:['vision','fallback'],timeouts:[2,2],run:async(model,signal)=>{exhausted++;return abortable(new Promise(()=>{}),signal);}}),e=>e.status===504);
 assert.equal(exhausted,2);
});

test('known structured findings are preserved as readable text, unknown or partial findings are rejected',async()=>{
 const valid=await server({summary:'Есть проблема с чтением.',findings:[{priority:'Обязательно',location:'42 участника',problem:'Низкий контраст.',fix:'Затемните текст.'}]});
 const result=await valid.api.directPresentation(request(),{action:'review',slide,screenshot,context});
 assert.match(result.direction.findings[0],/42 участника.*Низкий контраст.*Затемните/);
 const invalid=await server({summary:'Проверено.',findings:[{location:'42 участника',fix:'Затемните'}]});
 await assert.rejects(invalid.api.directPresentation(request(),{action:'review',slide,screenshot,context}),/неполный разбор/);
 assert.equal(invalid.payloads.length,2);
});

test('default review uses the faster visual route and a recovery keeps the same image and context',async()=>{
 const payloads=[];
 const api=await loadAiServer('lib/server/presentation-director.ts',{overrides:{'@/db':{getDb:()=>{throw Error('Unexpected DB access');},getD1:()=>({prepare:()=>({bind(){return this;},first:async()=>({request_count:1})})})},'./email-ai':{aiProvider:()=>({provider:'navyai',visionModel:'gemini-3.8-flash',model:'gpt-5.6-sol',key:'test',endpoint:'https://test.invalid'}),parseAiJson:JSON.parse}},fetch:async(url,init)=>{
  payloads.push(JSON.parse(init.body));
  return payloads.length===1?Response.json({error:'busy'},{status:429}):Response.json({choices:[{message:{content:JSON.stringify({summary:'Читаемый слайд.',findings:[]})}}]});
 }});
 const result=await api.directPresentation(request(),{action:'review',slide,screenshot,context});
 assert.equal(result.direction.summary,'Читаемый слайд.');assert.deepEqual(payloads.map(p=>p.model),['gpt-5.6-sol','gemini-3.8-flash']);
 assert.deepEqual(payloads[0].messages,payloads[1].messages);
 assert.equal(payloads[1].messages[1].content[1].image_url.url,screenshot);
});

test('structured findings link only real slide objects and preserve numbered ordering and priorities',async()=>{
 const {parseSlideFindings,findingRegions}=await import('../lib/presentation-import/review-findings.ts');
 const canvas={...slide,canvas:{width:1000,height:500,source:'pptx',elements:[{id:'body',kind:'text',text:'42 участника',x:100,y:200,width:400,height:50}]}};
 const findings=parseSlideFindings([{priority:'required',title:'Низкий контраст',problem:'Текст «42 участника» сливается с фоном.',suggestion:'Сделайте текст темнее.',elementIds:['body'],region:null},{priority:'suggestion',title:'Повтор слайда',problem:'Содержание повторяется.',suggestion:'Уберите повтор.',elementIds:[],region:null}],canvas);
 assert.equal(findings[0].priority,'required');assert.deepEqual(findingRegions(findings[0],canvas),[{x:10,y:40,width:40,height:10}]);assert.deepEqual(findingRegions(findings[1],canvas),[]);
 const quoted=parseSlideFindings(['Обязательно: «42 участника» — низкий контраст — затемните текст.'],canvas);assert.deepEqual(quoted[0].elementIds,['body']);
 const unknown=parseSlideFindings([{priority:'required',title:'Текст',problem:'Мелкий.',suggestion:'Увеличьте.',elementIds:['invented'],region:{x:99,y:5,width:40,height:20}}],canvas);assert.deepEqual(findingRegions(unknown[0],canvas),[]);
 const pdf=parseSlideFindings([{priority:'required',title:'Текст',problem:'Мелкий.',suggestion:'Увеличьте.',elementIds:[],region:{x:10,y:20,width:50,height:30}}],slide);assert.deepEqual(findingRegions(pdf[0],slide),[{x:10,y:20,width:50,height:30}]);
});

test('fixing a verified finding needs no screenshot and excludes asset data from model input',async()=>{
 const {api,payloads}=await server({summary:'Заголовок уточнён.',findings:[],patches:[{target:'slide',field:'title',value:'Итоги встречи'}]});
 const result=await api.directPresentation(request(),{action:'revise',slide:{...slide,imageUrl:'/api/assets/unused-image'},context,useReview:true,previousReview:{summary:'Заголовок общий.',findings:['Уточните заголовок.']}});
 assert.equal(result.proposed.title,'Итоги встречи');assert.equal(payloads[0].messages[1].content.length,1);assert.doesNotMatch(JSON.stringify(payloads[0]),/unused-image/);
 await assert.rejects(api.directPresentation(request(),{action:'revise',slide,context,useReview:true,previousReview:{summary:'Нет замечаний.',findings:[]}}),/Изображение слайда/);
});

test('revision verifier rejects invisible canvas colors, drops no-ops, supports actual text emphasis and protects numbers',async()=>{
 const {finalizeRevision}=await import('../lib/presentation-import/revision.ts');
 const canvas={...slide,canvas:{width:1000,height:500,source:'pptx',elements:[{id:'body',kind:'text',text:'42 участника',x:100,y:200,width:400,height:80,color:'#bbbbbb',fontSize:18}]}};
 const d=patches=>({summary:'Всё исправлено!',findings:[],patches});
 assert.throws(()=>finalizeRevision(canvas,d([{target:'slide',field:'textColor',value:'#222222'}])),/общий цвет/);
 const noop=finalizeRevision(canvas,d([{target:'body',field:'color',value:'#BBBBBB'}]));assert.equal(noop.changes.length,0);assert.equal(noop.direction.patches.length,0);assert.match(noop.direction.summary,/не изменён/);
 const bold=finalizeRevision(canvas,d([{target:'body',field:'bold',value:'true'},{target:'body',field:'align',value:'center'}]),true);assert.equal(bold.proposed.canvas.elements[0].bold,true);assert.equal(bold.proposed.canvas.elements[0].align,'center');assert.equal(bold.changes.length,2);
 assert.throws(()=>finalizeRevision(canvas,d([{target:'body',field:'text',value:'84 участника'}]),true),/числа/);
 assert.equal(canvas.canvas.elements[0].text,'42 участника');
});

test('contrast script changes only explicitly identified readable text on a known solid background',async()=>{
 const {mechanicalCorrections,finalizeRevision}=await import('../lib/presentation-import/revision.ts');
 const canvas={...slide,canvas:{width:1000,height:500,source:'pptx',elements:[{id:'body',kind:'text',text:'42 участника',x:100,y:200,width:400,height:80,color:'#bbbbbb',fontSize:18}]}};
 const issues=[{priority:'required',title:'Низкий контраст',problem:'Текст сливается с белым фоном.',suggestion:'Сделайте цвет темнее.',elementIds:['body'],region:null}];
 const fix=mechanicalCorrections(canvas,issues);assert.deepEqual(fix.patches,[{target:'body',field:'color',value:'#222222'}]);assert.deepEqual(fix.remaining,[]);
 const result=finalizeRevision(canvas,{summary:'',findings:[],patches:fix.patches},true);assert.equal(result.changes[0].before,'#bbbbbb');assert.equal(result.changes[0].after,'#222222');
 const image={id:'photo',kind:'image',x:0,y:0,width:1000,height:500,imageUrl:'/api/assets/image'};
 assert.equal(mechanicalCorrections({...canvas,canvas:{...canvas.canvas,elements:[image,...canvas.canvas.elements]}},issues).patches.length,0);
 assert.equal(mechanicalCorrections({...canvas,canvas:{...canvas.canvas,elements:[{...canvas.canvas.elements[0],locked:true}]}},issues).patches.length,0);
});

test('11-slide correction batch preserves partial success and retries only failed slides',async()=>{
 const {correctPresentation}=await import('../lib/presentation-import/deck-corrections.ts');const {slideFingerprint}=await import('../lib/presentation-import/review.ts');
 const project={id:'deck',themeId:'paper',backgroundColor:'#ffffff',textColor:'#222222',accentColor:'#6633cc',slides:Array.from({length:11},(_,i)=>({...slide,id:`slide-${i+1}`}))};
 const reviews=Object.fromEntries(project.slides.map(s=>[s.id,{fingerprint:slideFingerprint(project,s),direction:{summary:'Проверено',findings:['Уточните заголовок'],patches:[]}}]));
 const seen=[],results=new Map(),failures=[];let active=0,max=0;
 const base={project,reviews,signal:new AbortController().signal,capture:()=>{throw Error('No screenshot expected');},review:()=>{throw Error('No second review expected');},onReviewed:()=>{},onActive:()=>{},isFatal:()=>false,onResult:(s,r)=>results.set(s.id,r),onError:(s)=>failures.push(s.id)};
 await correctPresentation({...base,revise:async(s)=>{seen.push(s.id);active++;max=Math.max(max,active);await delay(2);active--;if(s.id==='slide-3')throw Error('temporary');return {summary:'Готово',findings:[],patches:s.id==='slide-4'?[]:[{target:'slide',field:'title',value:'Итоги встречи'}]};}});
 assert.equal(max,3);assert.equal(results.size,10);assert.deepEqual(failures,['slide-3']);assert.equal(results.get('slide-4').status,'manual');assert.equal(results.get('slide-1').status,'changed');assert.equal(project.slides[0].title,'Итоги');
 await correctPresentation({...base,ids:failures,revise:async(s)=>{seen.push(s.id);return {summary:'Готово',findings:[],patches:[{target:'slide',field:'title',value:'Итоги встречи'}]};}});
 assert.equal(results.size,11);assert.equal(seen.filter(id=>id==='slide-1').length,1);assert.equal(seen.filter(id=>id==='slide-3').length,2);
});

test('cancelling a correction batch keeps applied results and never applies late responses',async()=>{
 const {correctPresentation}=await import('../lib/presentation-import/deck-corrections.ts');const {slideFingerprint}=await import('../lib/presentation-import/review.ts');
 const project={id:'cancel',themeId:'paper',slides:[{...slide,id:'ready'},{...slide,id:'waiting'},{...slide,id:'queued'}]};const reviews=Object.fromEntries(project.slides.map(s=>[s.id,{fingerprint:slideFingerprint(project,s),direction:{summary:'Проверено',findings:['Уточните заголовок'],patches:[]}}]));
 const abort=new AbortController(),applied=[];
 await assert.rejects(correctPresentation({project,reviews,signal:abort.signal,capture:()=>{throw Error('Unexpected capture');},review:()=>{throw Error('Unexpected review');},revise:async(s,r,n,signal)=>{if(s.id!=='ready')await abortable(new Promise(()=>{}),signal);return {summary:'Готово',findings:[],patches:[{target:'slide',field:'title',value:'Итоги встречи'}]};},onReviewed:()=>{},onActive:()=>{},onError:()=>{},isFatal:()=>false,onResult:(s)=>{applied.push(s.id);abort.abort();}}));
 assert.deepEqual(applied,['ready']);assert.equal(project.slides[0].title,'Итоги');
});
