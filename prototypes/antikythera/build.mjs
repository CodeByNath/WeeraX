import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const source = new URL('./', import.meta.url);
const output = new URL('dist/', source);
const vendor = new URL('vendor/', output);
const three = new URL('vendor/', source);

await mkdir(vendor, { recursive: true });

const html = await readFile(new URL('../../index.html', source), 'utf8');

await Promise.all([
  writeFile(new URL('index.html', output), html.replaceAll('./prototypes/antikythera/', './')),
  writeFile(new URL('.nojekyll', output), ''),
  ...['main.js', 'mechanism.js', 'surface.js', 'style.css'].map(file =>
    copyFile(new URL(file, source), new URL(file, output))),
  ...['three.module.min.js', 'three.core.min.js'].map(file =>
    copyFile(new URL(file, three), new URL(file, vendor))),
  copyFile(new URL('LICENSE', three), new URL('LICENSE', vendor)),
]);
