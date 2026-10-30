import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let path = resolve(root, `.${pathname}`);
  if (!path.startsWith(`${root}${sep}`) && path !== root) {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  let status = 200;
  if (!existsSync(path) || !statSync(path).isFile()) {
    path = resolve(root, '404.html');
    status = 404;
  }
  response.writeHead(status, {
    'Content-Type': types[extname(path)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(path).pipe(response);
}).listen(port, host, () => {
  console.log(`Judicial preview: http://${host}:${port}/`);
});
