import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCookiePreferences, COOKIE_PREFERENCE_VERSION, COOKIE_PREFERENCE_TTL } from '../lib/cookie-preferences.ts';
const now=Date.now();
const stored=(overrides={})=>JSON.stringify({version:COOKIE_PREFERENCE_VERSION,choice:'rejected',savedAt:now,...overrides});
test('cookie preference preserves either explicit choice and expires after 180 days',()=>{
 for(const choice of ['accepted','rejected'])assert.equal(parseCookiePreferences(stored({choice}),now).choice,choice);
 assert.equal(parseCookiePreferences(stored({savedAt:now-COOKIE_PREFERENCE_TTL}),now),null);
 assert.equal(parseCookiePreferences(stored({savedAt:now+1}),now),null);
});
test('unknown revisions and corrupt cookie preferences never imply permission',()=>{
 for(const raw of [null,'{','{}','true','[]',stored({version:'old'}),stored({choice:true}),stored({savedAt:'yesterday'}),stored({choice:'all'})])assert.equal(parseCookiePreferences(raw,now),null);
});
