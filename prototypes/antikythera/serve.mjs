import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/main.js', ['main.js', 'text/javascript']],
  ['/mechanism.js', ['mechanism.js', 'text/javascript']],
  ['/surface.js', ['surface.js', 'text/javascript']],
  ['/node_modules/three/build/three.module.js', ['node_modules/three/build/three.module.js', 'text/javascript']],
  ['/node_modules/three/build/three.core.js', ['node_modules/three/build/three.core.js', 'text/javascript']],
]);

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 4173);

createServer(async (request, response) => {
  const route = request.url.split('?')[0];
  const file = files.get(route);
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }

  const [name, type] = file;
  const source = new URL(name, import.meta.url);
  const details = await stat(source).catch(() => null);
  if (!details?.isFile()) {
    response.writeHead(404).end('File unavailable. Run npm ci before starting the preview.');
    return;
  }

  response.writeHead(200, { 'Content-Type': type, 'Content-Length': details.size });
  if (request.method === 'HEAD') response.end();
  else createReadStream(source).on('error', () => response.destroy()).pipe(response);
}).listen(port, host, () => console.log(`WeeraX preview: http://${host}:${port}`));
