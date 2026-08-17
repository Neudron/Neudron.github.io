import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('..'); const OUT = process.argv[2]; fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
 const p=path.join(ROOT,rel); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.ogg':'audio/ogg','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif'}[path.extname(p)]||'application/octet-stream';
 r.writeHead(200,{'content-type':t}); fs.createReadStream(p).pipe(r);});
await new Promise(r=>srv.listen(0,r));
const base='http://127.0.0.1:'+srv.address().port+'/';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:720},deviceScaleFactor:1});
await pg.goto(base,{waitUntil:'load'});
await pg.waitForFunction(()=>window.NEU,null,{timeout:15000});
await pg.evaluate(()=>{const el=document.querySelector('.boot'); if(el) el.hidden=true;});
for (const m of ['quiz','rhythm','craft','crack','deck']) {
  const ok = await pg.evaluate(k=>{ if(!window.NEU[k]||!NEU[k].open) return false; NEU[k].open(); return true; }, m);
  if(!ok){ console.log('  !! no open() for '+m); continue; }
  await pg.waitForTimeout(900);
  for (let i=0;i<3;i++){ await pg.keyboard.press('z'); await pg.waitForTimeout(500); }
  await pg.screenshot({path:path.join(OUT,m+'.png')}); console.log('  '+m+'.png');
  await pg.evaluate(k=>{ if(NEU[k]&&NEU[k].close) NEU[k].close(); }, m);
  await pg.waitForTimeout(300);
}
await b.close(); srv.close();
