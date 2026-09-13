import {readFile, writeFile, mkdir, copyFile, readdir} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {crc32} from 'node:zlib';
import sharp from 'sharp';

// Read trusted static artwork only: no upstream package scripts or code execute.
const upstream = process.argv[2];
if (!upstream) throw Error('Pass the local Runeicons checkout');
const revision = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourceRoot = join(upstream, 'public/pixelated');
const license = await readFile(join(upstream, 'LICENSE'), 'utf8');
if (!license.includes('Apache License') || !license.includes('Version 2.0')) throw Error('Review the changed upstream license before importing');
const changes = 'Rune Icons by Nexvyn and contributors. Source: https://github.com/Nexvyn/runeicons at '+revision+'. Modified by Potok: glyph color changed to #7c35f2 and SVG rasterized as a transparent PNG. Original paths retained. Licensed under Apache License 2.0.';
async function files(dir) { const list=[]; for(const item of await readdir(dir,{withFileTypes:true})){if(item.isDirectory())list.push(...await files(join(dir,item.name)));else if(item.name.endsWith('.svg'))list.push(join(dir,item.name));}return list.sort(); }
function textChunk(name, value) {
 const data=Buffer.from(name+'\0'+value,'latin1'), type=Buffer.from('tEXt'), size=Buffer.alloc(4), checksum=Buffer.alloc(4);
 size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([type,data])));
 return Buffer.concat([size,type,data,checksum]);
}
const catalog=[];
await mkdir('public/email-icons',{recursive:true});
for(const path of await files(sourceRoot)){
 const source=await readFile(path,'utf8'), rel=relative(sourceRoot,path), [folder,file]=rel.split('/'), basename=file.slice(0,-4), id=`rune-${folder}-${basename}`;
 if(!/^[a-z0-9-]+$/.test(id)||/<(?!\/?(?:svg|path)\b)[a-z]/i.test(source)||/\b(?:href|style|on\w+)\s*=/i.test(source))throw Error('Unexpected SVG markup: '+rel);
 const originalPath=join('vendor/runeicons/pixelated',rel);await mkdir(join('vendor/runeicons/pixelated',folder),{recursive:true});await copyFile(path,originalPath);
 const png=await sharp(Buffer.from(source.replaceAll('fill="black"','fill="#7c35f2"'))).resize(192,192,{fit:'contain',background:'#00000000'}).png().toBuffer();
 // Carry the full license and a modification notice in every distributed PNG.
 await writeFile(`public/email-icons/${id}.png`,Buffer.concat([png.subarray(0,-12),textChunk('Copyright',changes),textChunk('License',license),png.subarray(-12)]));
 catalog.push({id,folder,basename,path:`/email-icons/${id}.png`});
}
await writeFile('vendor/runeicons/source.json',JSON.stringify({repository:'https://github.com/Nexvyn/runeicons',revision,collection:'public/pixelated',count:catalog.length,changes},null,2)+'\n');
await copyFile(join(upstream,'LICENSE'),'vendor/runeicons/LICENSE');
await writeFile('public/email-icons/Runeicons-LICENSE.txt',license);
await writeFile('public/email-icons/Runeicons-NOTICE.txt',changes+'\n');
await writeFile('lib/runeicons.generated.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`Imported ${catalog.length} pixel icons from ${revision}`);
