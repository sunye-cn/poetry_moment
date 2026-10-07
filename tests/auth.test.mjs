import test from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';import {readdir,readFile} from 'node:fs/promises';import {poems,categories} from '../src/poems.mjs';
test('Every category has real poems with complete reading content',()=>{for(const c of categories)assert.ok(poems.some(p=>p.dynasty===c||p.tags.includes(c)),c);for(const p of poems){assert.ok(p.translation&&p.analysis&&p.lines.length);assert.ok(p.id)}});
test('Registration, session persistence, authentication protections and logout',async()=>{const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2025-07-12',d1Databases:{DB:'test-poetry'}});try{const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run()}
const call=(path,body,extra={})=>mf.dispatchFetch('https://poetry.test/api/'+path,{method:body===undefined?'GET':'POST',headers:{origin:'https://poetry.test','content-type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
const account={email:'reader@example.test',password:'Test-Poetry-2026!',agreement:true};
assert.equal((await call('register',{...account,agreement:false})).status,400);
assert.equal((await call('register',account,{origin:'https://other.test'})).status,403);
const registration=await call('register',account);assert.equal(registration.status,200);const cookie=registration.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.equal((await registration.json()).user.email,account.email);
const me=await call('me',undefined,{cookie});assert.equal((await me.json()).user.email,account.email);
const saved=await db.prepare('SELECT * FROM users').first();assert.notEqual(saved.password_hash,account.password);assert.equal(saved.agreement_version,'2026-09-30');assert.equal(saved.password_hash.length,64);
assert.equal((await call('register',account)).status,409);
assert.equal((await call('login',{...account,password:'incorrect-password'})).status,401);
const login=await call('login',{...account,email:'READER@EXAMPLE.TEST'});assert.equal(login.status,200);const loginCookie=login.headers.get('set-cookie');
assert.equal((await call('logout',{}, {cookie:loginCookie})).status,200);assert.equal((await(await call('me',undefined,{cookie:loginCookie})).json()).user,null);
await db.prepare('UPDATE sessions SET expires_at = 0').run();assert.equal((await(await call('me',undefined,{cookie})).json()).user,null);
let limited;for(let i=0;i<13;i++)limited=await call('login',{...account,password:'incorrect-password'});assert.equal(limited.status,429);
}finally{await mf.dispose()}});
