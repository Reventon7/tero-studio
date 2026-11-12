import http from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
const port=Number(process.env.PORT||4175);
http.createServer((req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return}const stat=statSync(file);if(!stat.isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res)}catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`TERO preview: http://127.0.0.1:${port}`));
