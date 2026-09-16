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
