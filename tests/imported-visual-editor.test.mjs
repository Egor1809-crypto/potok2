import test from 'node:test';
import assert from 'node:assert/strict';
import * as parse5 from 'parse5';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
const editor = await loadAiServer('lib/email-import/visual-editor.ts', {overrides:{parse5}});
const compiler = await loadAiServer('lib/server/email-document.ts');
const mapper = await loadAiServer('lib/email-ai/mapping.ts');
const schema = await loadAiServer('lib/email-ai/schema.ts');
const icons = await loadAiServer('lib/email-icons.ts');
const source = `<!doctype html><html><head><style>@media(max-width:600px){.column{width:100%!important}}</style></head><body><!--[if mso]><table><tr><td><![endif]--><table><tr><td><h1>Сделайте <span style="color:#123ABC">больше.</span></h1><p>Текст &amp; детали</p><img src="https://example.org/hero.png" alt="Иллюстрация" width="600" style="border-radius:12px;mso-border-alt:none;width:600px;"><a style="padding:16px;background:#3655ef"><strong>Попробовать бесплатно</strong></a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></body></html>`;
const find = (html, kind) => editor.letterElements(html).find(e=>e.kind === kind);
test('manual text edits preserve inline formatting, Outlook comments and all untouched source bytes',()=>{
 const element=find(source,'text');
 const text=element.texts[1];
 const next=editor.editLetterText(source,element.index,1,'точнее & лучше.');
 assert.equal(next,source.slice(0,text.start)+'точнее &amp; лучше.'+source.slice(text.end));
 assert.match(next,/<span style="color:#123ABC">точнее &amp; лучше\.<\/span>/);
 assert.equal(source.includes('точнее'),false);
});
test('image width and alignment edit exactly the selected tag; preview selection markers never enter source',()=>{
 const image=find(source,'image');
 let next=editor.editLetterAttribute(source,image.index,'width','320');
 next=editor.editLetterStyle(next,image.index,{'width':'320px','height':'auto','margin-left':'auto','margin-right':'auto'});
 assert.match(next,/mso-border-alt:none/);assert.match(next,/width:320px/);assert.doesNotMatch(find(next,'image').attributes.style,/width:600px/);
 assert.equal(next.split('<img')[0],source.split('<img')[0]);
 assert.equal(next.split('</a>')[1],source.split('</a>')[1]);
 assert.match(editor.selectableLetterHtml(next),/data-potok-edit=/);assert.doesNotMatch(next,/data-potok-edit=/);
});
test('setting button, text and image links preserves styling and escapes unsafe attribute characters',()=>{
 const button=find(source,'link');
 const next=editor.setLetterLink(source,button.index,'https://example.org/start?from=mail&plan=pro');
 assert.equal(find(next,'link').attributes.href,'https://example.org/start?from=mail&plan=pro');
 assert.match(next,/<strong>Попробовать бесплатно<\/strong>/);
 assert.equal(find(next,'link').attributes.style,button.attributes.style);
 const withImageLink=editor.setLetterLink(source,find(source,'image').index,'mailto:team@example.org');
 assert.equal(editor.letterLink(find(withImageLink,'image')),'mailto:team@example.org');
 const changed=editor.setLetterLink(withImageLink,find(withImageLink,'image').index,'https://example.org/new');
 assert.equal((changed.match(/<a\b/g)||[]).length,2,'no nested anchors');
 assert.equal(editor.letterLink(find(changed,'image')),'https://example.org/new');
 for(const bad of ['javascript:alert(1)','data:text/html,hello','https://user:secret@example.org','https://example.org/" onclick="x']) assert.throws(()=>editor.setLetterLink(source,button.index,bad));
});
test('implicit table nodes, quoted > attributes, entities and repeated text keep accurate source locations',()=>{
 const html='<!doctype html><html><body><table><tr><td><p title="a > b">Same &amp; same</p><p>Same &amp; same</p><img src="https://example.org/a.png" /></td></tr></table></body></html>';
 const all=editor.letterElements(html); assert.equal(all.length,3);
 const changed=editor.editLetterText(html,1,0,'Changed');
 assert.match(changed,/<p title="a > b">Same &amp; same<\/p><p>Changed<\/p>/);
 assert.match(editor.editLetterAttribute(changed,2,'width','40'),/width="40"\s*\/>/);
});
test('a corrected crop retains original asset and crop coordinates through saving and compilation',()=>{
 const index=find(source,'image').index;
 let html=editor.editLetterAttribute(source,index,'data-potok-original-src','https://example.org/hero.png');
 html=editor.editLetterAttribute(html,index,'data-potok-crop',JSON.stringify({x:10,y:20,width:70,height:60}));
 html=editor.editLetterAttribute(html,index,'src','https://example.org/cropped.png');
 const doc=compiler.parseEmailBuilderDocument({templateId:'',subject:'Письмо',previewText:'',rawHtml:html,accentColor:'#123456',bodyBackground:'#ffffff',workspaceBackground:'#ffffff',contentWidth:640,blocks:[{id:'import',type:'text',content:'',paddingTop:0,paddingBottom:0,backgroundColor:'#ffffff',textColor:'#111111',fontSize:16,borderRadius:0}]});
 assert.equal(compiler.compileEmailDocument(doc),html);
 assert.equal(find(html,'image').attributes['data-potok-original-src'],'https://example.org/hero.png');
});
test('all 18 library icons are real transparent PNGs with visible artwork',async()=>{
 assert.equal(icons.colorEmailIcons.length,18);
 for(const icon of icons.colorEmailIcons){
  const file=await readFile('public'+icon.path);const {data,info}=await sharp(file).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,192);assert.equal(info.height,192);assert.equal(info.channels,4);assert.equal(data[3],0);
  let drawn=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)drawn++;assert.ok(drawn>500 && drawn<192*192*.85,icon.id);
 }
});
for (const selectedIcons of [['lock','people','chart'],['rune-identity-lock','rune-identity-users','rune-layouts-grid-2x2']]) test('AI card icons stay editable, survive save/load and compile: '+selectedIcons[0],()=>{
 const brief=schema.parseAiEmailBrief({description:'Безопасность, команда и аналитика',visuals:'auto'});
 const ai={version:'1.0',subject:'Инструменты команды',preheader:'Удобно работать вместе',meta:{goal:'announcement',language:'ru',tone:'tech',length:'short'},theme:{emailWidth:640,backgroundColor:'#080D15',contentBackgroundColor:'#111725',textColor:'#F2F4FF',mutedTextColor:'#AAB3C7',primaryColor:'#547DFA',accentColor:'#8F63EB',borderColor:'#354256',borderRadius:12,fontFamily:'Arial'},blocks:[{id:'features',type:'benefits',variant:'benefits-3-column',title:'Возможности',text:'',badge:'',items:selectedIcons.map((iconId,i)=>({title:['Защита','Команда','Аналитика'][i],text:'Для вашей работы',value:'',label:'',iconId})),button:null,image:null,backgroundColor:null,textColor:null}]};
 const parsed=schema.parseAiEmailDocument(ai);const mapped=mapper.mapAiEmailToBuilderDocument(parsed,brief,new Map());
 const persisted=compiler.parseEmailBuilderDocument(JSON.parse(JSON.stringify(mapped)));
 const rendered=compiler.compileEmailDocument(persisted);
 for(const id of selectedIcons)assert.match(rendered,new RegExp('/email-icons/'+id+'\\.png'));
 const context=mapper.builderToAiEmail(persisted,brief);
 assert.deepEqual(JSON.parse(JSON.stringify(context.email.blocks.find(b=>b.id==='features').items.map(i=>i.iconId))),selectedIcons);
 const without=mapper.mapAiEmailToBuilderDocument(parsed,{...brief,visuals:'none'},new Map());assert.doesNotMatch(compiler.compileEmailDocument(without),/email-icons/);
 const bad=structuredClone(ai);bad.blocks[0].items[0].iconId='https://tracker.example/pixel';assert.throws(()=>schema.parseAiEmailDocument(bad));
});

test('small standalone icons remain small after saving and compiling, with bounded image widths',()=>{
 const document={templateId:'',subject:'Значок',previewText:'',accentColor:'#123456',bodyBackground:'#ffffff',workspaceBackground:'#ffffff',contentWidth:640,blocks:[{id:'pixel-icon',type:'image',content:'Замок',href:icons.emailIconUrl('rune-identity-lock'),widthPercent:10,paddingTop:8,paddingBottom:8,backgroundColor:'#ffffff',textColor:'#111111',fontSize:16,borderRadius:0}]};
 const parsed=compiler.parseEmailBuilderDocument(document);
 assert.equal(parsed.blocks[0].widthPercent,10);
 assert.match(compiler.compileEmailDocument(parsed),/width:10%/);
 for(const widthPercent of [0,4,101]) assert.throws(()=>compiler.parseEmailBuilderDocument({...document,blocks:[{...document.blocks[0],widthPercent}]}));
});
