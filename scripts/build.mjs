import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { pinyin, customPinyin } from 'pinyin-pro';
import { poems,categories } from '../src/poems.mjs';
customPinyin({'好逑':'hǎo qiú','参差':'cēn cī','燕山':'yān shān','不胜簪':'bù shèng zān','千骑':'qiān jì','纤纤':'xiān xiān','脉脉':'mò mò','重阳':'chóng yáng','人杰':'rén jié','争渡':'zhēng dù','还坚劲':'hái jiān jìng','一重重':'yī chóng chóng','一日还':'yī rì huán','照我还':'zhào wǒ huán','长向':'cháng xiàng','风吹草低见牛羊':'fēng chuī cǎo dī xiàn niú yáng','何似':'hé sì','高处不胜寒':'gāo chù bù shèng hán','花重锦官城':'huā zhòng jǐn guān chéng'});
// Generate one reading per character; punctuation remains literal.
for(const p of poems){p.pinyin=[];for(let i=0;i<p.lines.length;i++){const arr=pinyin(p.lines[i],{type:'array',nonZh:'spaced'});p.pinyin[i]=arr;if(arr.length!==[...p.lines[i]].length)throw Error('Pinyin alignment: '+p.title)}}
const data=JSON.stringify({poems,categories}).replace(/</g,'\\u003c');
const html=(await readFile('src/index.html','utf8')).replace(/<script>.*?<\/script>/s,'');
const js=(await readFile('src/app.js','utf8')).replace('__POETRY_DATA__',data),css=await readFile('src/style.css','utf8');
const assets={'/':{body:html,type:'text/html; charset=utf-8'},'/style.css':{body:css,type:'text/css; charset=utf-8'},'/app.js':{body:js,type:'text/javascript; charset=utf-8'}};
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/assets.generated.mjs','export const assets='+JSON.stringify(assets)+';\n');await writeFile('dist/server/index.js',await readFile('src/worker.mjs','utf8'));console.log(`Built ${poems.length} poems, ${categories.length} categories and ${new Set(poems.map(p=>p.author)).size} authors.`);
