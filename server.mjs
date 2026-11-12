import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json'
};
const port = Number(process.env.PORT || 4175);

http.createServer((request, response) => {
  let file;
  let size;
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(path.resolve(root) + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('Not a file');
    size = stat.size;
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }

  const headers = {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': 'no-cache'
  };
  let range;
  if (path.extname(file) === '.mp4') {
    headers['Accept-Ranges'] = 'bytes';
    if (request.headers.range) {
      range = readRange(request.headers.range, size);
      if (!range) {
        response.writeHead(416, { 'Content-Range': 'bytes */' + size }).end();
        return;
      }
      headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + size;
      headers['Content-Length'] = range.end - range.start + 1;
    }
  }

  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD') response.end();
  else createReadStream(file, range).on('error', error => response.destroy(error)).pipe(response);
}).listen(port, '127.0.0.1', () => console.log('TERO preview: http://127.0.0.1:' + port));

function readRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start > end) return null;
  return { start, end };
}
