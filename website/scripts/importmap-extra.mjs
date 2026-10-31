/**
 * Adds the first-party packages that `zerolith importmap` does not vendor to the import map it wrote.
 * The command copies zerolith, @zerolith/router, forms, client, and devtools only, so @zerolith/a11y is
 * copied here the same way: its modules under vendor/, an entry and integrity hashes in vendor/importmap.json
 * and in the page, and a preload link per module. Run it after `zerolith importmap --html index.html`.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = ['@zerolith/a11y'];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');
const MAP_FILE = join(ROOT, 'vendor', 'importmap.json');

/**
 * The SRI value for file contents, as the command writes it.
 * @param {Buffer} bytes
 */
function integrity(bytes)
{
    return `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
}

/**
 * Copies a package's published modules and returns the map entries for it.
 * @param {string} name Package name.
 * @returns {{ specifier: string, url: string, modules: Map<string, Buffer> }}
 */
function vendor(name)
{
    const source = join(ROOT, 'node_modules', name);
    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    const entry = manifest.exports['.'].default.replace(/^\.\//, '');
    const target = join(ROOT, 'vendor', name);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(join(target, 'dist'), { recursive: true });
    const files = new Map();
    for (const file of readdirSync(join(source, 'dist')).filter((f) => f.endsWith('.js')))
    {
        const bytes = readFileSync(join(source, 'dist', file));
        copyFileSync(join(source, 'dist', file), join(target, 'dist', file));
        files.set(`/vendor/${name}/dist/${file}`, bytes);
    }
    writeFileSync(join(target, 'VERSION'), `${manifest.version}\n`);
    const url = `/vendor/${name}/${entry}`;
    const modules = new Map();
    const queue = [url];
    while (queue.length)
    {
        const next = queue.pop();
        if (modules.has(next) || !files.has(next))
        {
            continue;
        }
        modules.set(next, files.get(next));
        for (const [, specifier] of files.get(next).toString('utf8').matchAll(/from\s*["'](\.{1,2}\/[^"']+)["']/g))
        {
            queue.push(posix.join(posix.dirname(next), specifier));
        }
    }
    return { specifier: name, url, modules };
}

/**
 * Sorts an object's keys, as the command's maps are sorted.
 * @param {Record<string, string>} object
 */
function sorted(object)
{
    return Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
for (const { specifier, url, modules } of PACKAGES.map(vendor))
{
    map.imports[specifier] = url;
    for (const [module, bytes] of modules)
    {
        map.integrity[module] = integrity(bytes);
    }
}
map.imports = sorted(map.imports);
map.integrity = sorted(map.integrity);
writeFileSync(MAP_FILE, `${JSON.stringify(map, null, 2)}\n`);

const html = readFileSync(PAGE, 'utf8');
const newline = html.includes('\r\n') ? '\r\n' : '\n';
const lines = html.split(/\r?\n/).filter((line) => !(line.includes('rel="modulepreload"') && line.includes('data-zerolith-preload')));
const at = lines.findIndex((line) => line.includes('<script type="importmap">'));
if (at === -1)
{
    throw new Error('index.html has no import map; run `zerolith importmap --html index.html` first.');
}
lines[at] = lines[at].replace(/<script type="importmap">.*?<\/script>/, `<script type="importmap">${JSON.stringify(map)}</script>`);
const preloads = Object.entries(map.integrity).map(([url, hash]) => `<link rel="modulepreload" href="${url}" integrity="${hash}" data-zerolith-preload>`);
lines.splice(at + 1, 0, ...preloads);
writeFileSync(PAGE, lines.join(newline));
console.log(`vendored ${PACKAGES.join(', ')} into vendor and the import map`);
