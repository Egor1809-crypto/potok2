import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import cp from 'node:child_process';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import * as icons from '../components/ui/icons.tsx';
test('pixel SVGs preserve Runeicons geometry, inherit control colors and keep accessible names',()=>{
 for(const [name,Icon] of Object.entries(icons)){
  const html=renderToStaticMarkup(React.createElement(Icon,{size:20,'aria-label':name,role:'img'}));
  assert.match(html,/data-rune-icon=/);assert.match(html,/fill="currentColor"/);assert.match(html,/shape-rendering="crispEdges"/);assert.doesNotMatch(html,/aria-hidden="true"/);
  const source=/data-rune-icon="([^"]+)"/.exec(html)[1],svg=fs.readFileSync('vendor/runeicons/pixelated/'+source+'.svg','utf8');
  const paths=[...svg.matchAll(/\bd="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(paths.length);for(const d of paths)assert.ok(html.includes('d="'+d+'"'),name);
 }
 const decorative=renderToStaticMarkup(React.createElement(icons.Search));assert.match(decorative,/aria-hidden="true"/);assert.match(decorative,/focusable="false"/);
});
test('all platform components use the shared pixel icon layer',()=>{
 const files=cp.execFileSync('rg',['--files','app','components','lib'],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(ts|tsx)$/.test(p));
 for(const file of files)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/from ["']lucide-react["']/,file);
});
