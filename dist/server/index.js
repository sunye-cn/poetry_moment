import { assets } from './assets.generated.mjs';
const encoder=new TextEncoder(),SESSION='__Host-poetry_session';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function derive(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
const cookie=(value,maxAge)=>`${SESSION}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
function tokenFrom(request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION+'='))?.slice(SESSION.length+1)||''}
async function currentUser(request,db){const token=tokenFrom(request);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').bind(await digest(token),Date.now()).first()}
async function limited(db,key,limit){const now=Date.now(),reset=now+15*60*1000;const row=await db.prepare('INSERT INTO auth_attempts (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset_at < ? THEN 1 ELSE count + 1 END, reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING count').bind(key,reset,now,now,reset).first();return row.count>limit}
async function issueSession(db,user){const token=random();await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token),user.id,Date.now()+7*86400000).run();return json({user:{id:user.id,email:user.email}},200,{'set-cookie':cookie(token,604800)})}
async function auth(request,env){const path=new URL(request.url).pathname;if(!env.DB)return json({error:'账号服务尚未连接，请稍后重试。'},503);const db=env.DB;
if(request.method==='GET'&&path==='/api/me')return json({user:await currentUser(request,db)});
if(request.method!=='POST')return json({error:'不支持的请求。'},405);
if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'请求来源无效。'},403);
if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请求格式不正确。'},415);
if(!['/api/register','/api/login','/api/logout'].includes(path))return json({error:'未找到。'},404);
if(path==='/api/logout'){const token=tokenFrom(request);if(token)await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();return json({ok:true},200,{'set-cookie':cookie('',0)})}
const body=await request.text();if(body.length>4096)return json({error:'提交的内容过长。'},413);let data;try{data=JSON.parse(body)}catch{return json({error:'请求格式不正确。'},400)}
const email=typeof data?.email==='string'?data.email.trim().toLowerCase():'',password=typeof data?.password==='string'?data.password:'';
if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'请输入有效的邮箱地址。'},400);
if(password.length<10||password.length>128)return json({error:'密码需要 10 至 128 位字符。'},400);
if(path==='/api/register'&&data.agreement!==true)return json({error:'请阅读并同意用户协议。'},400);
await db.batch([db.prepare('DELETE FROM auth_attempts WHERE reset_at < ?').bind(Date.now()),db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now())]);
const ip=request.headers.get('cf-connecting-ip')||'unknown';
if(await limited(db,'ip:'+await digest(ip),40)||await limited(db,'email:'+await digest(email),12))return json({error:'尝试次数较多，请 15 分钟后再试。'},429,{'retry-after':'900'});
if(path==='/api/register'){const id=crypto.randomUUID(),salt=random(),hash=await derive(password,salt);try{await db.prepare('INSERT INTO users (id, email, password_hash, salt, agreement_version, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id,email,hash,salt,'2026-09-30',Date.now()).run()}catch(e){if(String(e).includes('UNIQUE'))return json({error:'此邮箱已注册，请直接登录。'},409);throw e}return issueSession(db,{id,email})}
const user=await db.prepare('SELECT id, email, password_hash, salt FROM users WHERE email = ?').bind(email).first();const hash=await derive(password,user?.salt||'fixed-dummy-salt-for-unknown-accounts');if(!user||!equal(hash,user.password_hash))return json({error:'邮箱或密码不正确。'},401);return issueSession(db,user)
}
export default {async fetch(request,env){try{const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return await auth(request,env);if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});const asset=assets[url.pathname];if(!asset)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"}})}catch(e){console.error('Poetry service request failed',e instanceof Error?e.message:'unknown');return json({error:'服务暂时不可用，请稍后重试。'},503)}}};
