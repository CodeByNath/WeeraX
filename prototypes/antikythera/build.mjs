import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const source = new URL('./', import.meta.url);
const output = new URL('dist/', source);
const vendor = new URL('vendor/', output);
const three = new URL('node_modules/three/', source);

await mkdir(vendor, { recursive: true });

const html = await readFile(new URL('index.html', source), 'utf8');
const localImport = './node_modules/three/build/three.module.js';
if (!html.includes(localImport)) throw new Error('The Three.js import map has changed.');

await Promise.all([
  writeFile(new URL('index.html', output), html.replace(localImport, './vendor/three.module.min.js')),
  writeFile(new URL('.nojekyll', output), ''),
  ...['main.js', 'mechanism.js', 'surface.js', 'style.css'].map(file =>
    copyFile(new URL(file, source), new URL(file, output))),
  ...['three.module.min.js', 'three.core.min.js'].map(file =>
    copyFile(new URL(`build/${file}`, three), new URL(file, vendor))),
  copyFile(new URL('LICENSE', three), new URL('LICENSE', vendor)),
]);
