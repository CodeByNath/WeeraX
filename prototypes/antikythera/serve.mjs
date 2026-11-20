import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ...[
    ['style.css', 'text/css'],
    ['main.js', 'text/javascript'],
    ['mechanism.js', 'text/javascript'],
    ['surface.js', 'text/javascript'],
    ['vendor/three.module.min.js', 'text/javascript'],
    ['vendor/three.core.min.js', 'text/javascript'],
  ].map(([name, type]) => {
    const path = `prototypes/antikythera/${name}`;
    return [`/${path}`, [path, type]];
  }),
]);

const root = new URL('../../', import.meta.url);
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
  const source = new URL(name, root);
  const details = await stat(source).catch(() => null);
  if (!details?.isFile()) {
    response.writeHead(404).end('File unavailable.');
    return;
  }

  response.writeHead(200, { 'Content-Type': type, 'Content-Length': details.size });
  if (request.method === 'HEAD') response.end();
  else createReadStream(source).on('error', () => response.destroy()).pipe(response);
}).listen(port, host, () => console.log(`WeeraX preview: http://${host}:${port}`));
