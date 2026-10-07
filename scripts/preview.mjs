import { Miniflare } from 'miniflare';
import { readdir, readFile } from 'node:fs/promises';
// A fixed public origin keeps the existing same-origin auth checks valid behind HTTPS tunnels.
const publicOrigin=process.env.POETRY_PUBLIC_ORIGIN;
if(publicOrigin && new URL(publicOrigin).protocol!=='https:')throw new Error('POETRY_PUBLIC_ORIGIN must use HTTPS');
const mf=new Miniflare({upstream:publicOrigin,modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2025-07-12',d1Databases:{DB:'poetry-local'},d1Persist:'.dev-data',port:4387,host:'0.0.0.0'});
const db=await mf.getD1Database('DB');const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();if(!tables.results.length){for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+f,'utf8');for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run()}}
console.log('Local: http://localhost:4387');await mf.ready;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await mf.dispose();process.exit(0)});
