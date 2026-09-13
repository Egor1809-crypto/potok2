import test from 'node:test';import assert from 'node:assert/strict';import * as parse5 from 'parse5';
import { loadAiServer } from './helpers/ai-server-harness.mjs';
import { dragImageCrop, imageCropPixels } from '../lib/email-import/crop-geometry.ts';
const editor=await loadAiServer('lib/email-import/visual-editor.ts',{overrides:{parse5}});
const layout=await loadAiServer('lib/email-import/image-layout.ts',{overrides:{parse5}});
const html='<html><body><table width="640"><tr><td style="width:300px;height:100px;overflow:hidden"><a href="https://example.org/start" style="display:inline-block"><img src="https://example.org/full.png" width="280" height="100" style="width:280px;height:100px;object-fit:cover;transform:translateX(-30px);border-radius:12px"></a></td><td><p>Не изменять этот текст</p></td></tr></table></body></html>';
test('changing a crop keeps the original and removes the second CSS crop without altering adjacent content or links',()=>{
 const image=editor.letterElements(html).find(item=>item.kind==='image');
 const next=layout.cropLetterImage(html,image.index,'https://example.org/crop.png',JSON.stringify({x:10,y:20,width:60,height:40}));
 const result=editor.letterElements(next).find(item=>item.kind==='image');
 assert.equal(result.attributes['data-potok-original-src'],'https://example.org/full.png');
 assert.equal(result.attributes.height,undefined);assert.match(result.attributes.style,/height:auto !important/);
 assert.match(result.attributes.style,/object-fit:contain/);assert.match(result.attributes.style,/transform:none/);
 assert.match(next,/overflow:visible !important/);assert.match(next,/<td><p>Не изменять этот текст<\/p><\/td>/);
 assert.equal(editor.letterLink(result),'https://example.org/start');
 const restored=layout.restoreLetterImage(next,result.index);const original=editor.letterElements(restored).find(item=>item.kind==='image');assert.equal(original.attributes.src,'https://example.org/full.png');assert.equal(original.attributes['data-potok-crop'],undefined);
});
test('replacement and resizing preserve proportions; centering works even inside an image link',()=>{
 const index=editor.letterElements(html).find(item=>item.kind==='image').index;
 let next=layout.replaceLetterImage(html,index,'https://example.org/portrait.png','Портрет');next=layout.sizeLetterImage(next,index,160);next=layout.alignLetterImage(next,index,'center');
 const image=editor.letterElements(next).find(item=>item.kind==='image');assert.equal(image.attributes.width,'160');assert.equal(image.attributes.height,undefined);assert.match(image.attributes.style,/margin-left:auto/);assert.match(image.attributes.style,/margin-right:auto/);assert.match(next,/<a[^>]+display:block;width:100%/);
});
test('dragging and resizing stay within the original image and pixel extraction uses the exact same edges as the preview',()=>{
 const initial={x:25,y:20,width:50,height:40};
 assert.deepEqual(dragImageCrop(initial,'move',90,-80),{x:50,y:0,width:50,height:40});
 assert.deepEqual(dragImageCrop(initial,'se',30,50),{x:25,y:20,width:75,height:80});
 assert.deepEqual(imageCropPixels(initial,800,1000),{x:200,y:200,width:400,height:400});
 const edge=dragImageCrop(initial,'nw',-100,-100);assert.deepEqual(edge,{x:0,y:0,width:75,height:60});
 const precise={x:8.3,y:11.7,width:36.4,height:52.6};const p=imageCropPixels(precise,999,1333);assert.equal(p.x+p.width,Math.round(999*.447));assert.equal(p.y+p.height,Math.round(1333*.643));
});
