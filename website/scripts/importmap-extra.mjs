/**
 * Finishes what `zerolith importmap --html index.html` writes; run it after the command.
 * The command copies zerolith, @zerolith/router, forms, client, and devtools only, so @zerolith/a11y is copied here
 * the same way: its modules under vendor/, with an entry and integrity hashes in vendor/importmap.json and in the
 * page. The page's preload links are then rewritten to cover exactly the modules the page loads.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * The modules the page loads: its module scripts and everything they import statically, with bare specifiers resolved
 * through the import map. The command preloads every module of every mapped package instead, server-only entries
 * included, and none of the application's own, which the browser would otherwise find one import at a time.
 * @param {string} html
 * @param {{ imports: Record<string, string> }} importMap
 * @returns {string[]} Root-relative URLs, sorted.
 */
function pageModules(html, importMap)
{
    const base = html.match(/<base href="([^"]*)"/)?.[1] ?? '/';
    const queue = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map(([, src]) => new URL(src, `http://site${base}`).pathname);
    const seen = new Set();
    while (queue.length)
    {
        const url = queue.pop();
        if (seen.has(url) || !existsSync(join(ROOT, url)))
        {
            continue;
        }
        seen.add(url);
        const source = readFileSync(join(ROOT, url), 'utf8');
        for (const [, specifier] of source.matchAll(/^\s*(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?["']([^"']+)["']/gm))
        {
            queue.push(importMap.imports[specifier] ?? new URL(specifier, `http://site${url}`).pathname);
        }
    }
    return [...seen].sort();
}

const html = readFileSync(PAGE, 'utf8');
const newline = html.includes('\r\n') ? '\r\n' : '\n';
const lines = html.split(/\r?\n/).filter((line) => !(line.includes('rel="modulepreload"') && line.includes('data-zerolith-preload')));
const at = lines.findIndex((line) => line.includes('<script type="importmap">'));
if (at === -1)
{
    throw new Error('index.html has no import map; run `zerolith importmap --html index.html` first.');
}
lines[at] = lines[at].replace(/<script type="importmap">.*?<\/script>/, `<script type="importmap">${JSON.stringify(map)}</script>`);
const modules = pageModules(html, map);
const preloads = modules.map((url) => `<link rel="modulepreload" href="${url}"${map.integrity[url] ? ` integrity="${map.integrity[url]}"` : ''} data-zerolith-preload>`);
lines.splice(at + 1, 0, ...preloads);
writeFileSync(PAGE, lines.join(newline));
console.log(`vendored ${PACKAGES.join(', ')} into vendor and preloaded the ${modules.length} modules the page loads`);
