import test from 'node:test';
import assert from 'node:assert/strict';
import { inlinePreviewResources } from '../lib/email-import/preview.ts';
test('import preview embeds the original bytes and preserves all image references without changing upload resources', async () => {
 const bytes = new Uint8Array([137,80,78,71,0,1,255,0]);
 const resource = {url:'blob:http://localhost:3000/preview-test',blob:new Blob([bytes],{type:'image/png'}),name:'letter.png'};
 const html = `<body style="background-image:url('${resource.url}')"><img src="${resource.url}" alt="Приглашение"><a href="https://example.org">Подробнее</a></body>`;
 const result=await inlinePreviewResources(html,[resource]);
 assert.equal((result.match(/data:image\/png;base64,/g)||[]).length,2);
 const encoded=result.match(/data:image\/png;base64,([^']+)/)[1];
 assert.deepEqual(new Uint8Array(Buffer.from(encoded,'base64')),bytes);
 assert.match(result, /href="https:\/\/example.org"/);
 assert.equal(resource.url,'blob:http://localhost:3000/preview-test');
 assert.equal(resource.uploadedUrl,undefined);
 assert.match(html,/blob:http/);
});
test('preview leaves remote images and raw HTML unchanged when no local resources need embedding',async()=>{
 const html='<table><tr><td bgcolor="#ff0000"><img src="https://example.org/photo.png"></td></tr></table>';
 assert.equal(await inlinePreviewResources(html,[]),html);
});
