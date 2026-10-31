/**
 * The Lighthouse budget. Serves the website as a static host would, answers the release API from a fixture on the port
 * the site calls when it runs on localhost, runs Lighthouse against each page in budget.json, and exits with 1 when a
 * page scores below a category minimum or transfers more JavaScript than the budget allows. A page's own entry in
 * budget.json overrides the minimums. Each page runs several times and the run with the median performance score
 * counts. Reports go to lighthouse-reports/.
 *
 * The server speaks HTTP/1.1, which queues the site's modules on six connections, so performance here runs below what
 * the live host, which serves HTTP/2, delivers. releases.json is the release list website-api served on 2026-10-30,
 * trimmed to the fields the site reads.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'lighthouse-reports');
const CLI = fileURLToPath(import.meta.resolve('lighthouse/cli/index.js'));
const API_PORT = 3610;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff2': 'font/woff2',
};
const budget = JSON.parse(readFileSync(join(HERE, 'budget.json'), 'utf8'));
const releases = readFileSync(join(HERE, 'releases.json'));

/**
 * Answers a request for the site: the file, gzipped when it is text; index.html for a path that names no file; or 404
 * for a missing file with an extension.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function serveSite(req, res)
{
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT) || file.split(sep).includes('node_modules'))
    {
        res.writeHead(404).end();
        return;
    }
    if (!existsSync(file) || statSync(file).isDirectory())
    {
        if (extname(path))
        {
            res.writeHead(404).end();
            return;
        }
        file = join(ROOT, 'index.html');
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    let body = readFileSync(file);
    const headers = { 'content-type': type, 'cache-control': 'no-cache' };
    if (/^(text\/|application\/json|image\/svg)/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? ''))
    {
        body = gzipSync(body);
        headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers).end(body);
}

/**
 * Answers the release API from the fixture.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function serveApi(req, res)
{
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type' };
    if (req.method === 'OPTIONS')
    {
        res.writeHead(204, cors).end();
        return;
    }
    if (new URL(req.url, 'http://localhost').pathname !== '/releases')
    {
        res.writeHead(404, cors).end();
        return;
    }
    res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(releases);
}

/**
 * Starts a server on a loopback address and resolves with it.
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} handler
 * @param {number} port 0 for any free port.
 * @param {string} host
 * @returns {Promise<import('node:http').Server>}
 */
function listen(handler, port, host)
{
    return new Promise((resolve, reject) =>
    {
        const server = createServer(handler);
        server.once('error', reject);
        server.listen(port, host, () => resolve(server));
    });
}

/**
 * Runs the Lighthouse command line against a URL and resolves with the report.
 * @param {string} url
 * @param {string} file Where the JSON report goes.
 * @returns {Promise<object>}
 */
function lighthouse(url, file)
{
    const args = [
        CLI, url, '--output=json', `--output-path=${file}`, `--only-categories=${CATEGORIES.join(',')}`,
        '--chrome-flags=--headless=new --no-sandbox', '--quiet',
    ];
    return new Promise((resolve, reject) =>
    {
        const child = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
        child.on('error', reject);
        child.on('exit', (code) => (code === 0
            ? resolve(JSON.parse(readFileSync(file, 'utf8')))
            : reject(new Error(`Lighthouse exited with ${code} for ${url}`))));
    });
}

/**
 * The numbers the budget checks, and the metrics behind the performance score, from one report.
 * @param {object} report
 */
function summarize(report)
{
    const audit = (id) => report.audits[id]?.numericValue ?? 0;
    const script = report.audits['resource-summary'].details.items.find((item) => item.resourceType === 'script');
    return {
        scores: Object.fromEntries(CATEGORIES.map((id) => [id, report.categories[id].score])),
        scriptKB: (script?.transferSize ?? 0) / 1024,
        scriptRequests: script?.requestCount ?? 0,
        fcp: audit('first-contentful-paint'),
        lcp: audit('largest-contentful-paint'),
        tbt: audit('total-blocking-time'),
        cls: audit('cumulative-layout-shift'),
    };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const site = await listen(serveSite, 0, '127.0.0.1');
const apis = [
    await listen(serveApi, API_PORT, '127.0.0.1'),
    await listen(serveApi, API_PORT, '::1').catch(() => null),
].filter(Boolean);
const origin = `http://127.0.0.1:${site.address().port}`;
const failures = [];
const runs = budget.runs ?? 1;
try
{
    for (const [page, overrides] of Object.entries(budget.pages))
    {
        const results = [];
        for (let run = 1; run <= runs; run++)
        {
            const name = `${page === '/' ? 'home' : page.slice(1).replaceAll('/', '-')}-${run}.json`;
            results.push(summarize(await lighthouse(origin + page, join(OUT, name))));
        }
        results.sort((a, b) => a.scores.performance - b.scores.performance);
        const median = results[Math.floor(results.length / 2)];
        const scores = CATEGORIES.map((id) => `${id} ${Math.round(median.scores[id] * 100)}`).join(', ');
        console.log(`${page}: ${scores}; JavaScript ${median.scriptKB.toFixed(1)} KB in ${median.scriptRequests} requests; FCP ${Math.round(median.fcp)} ms, LCP ${Math.round(median.lcp)} ms, TBT ${Math.round(median.tbt)} ms, CLS ${median.cls.toFixed(3)}`);
        for (const id of CATEGORIES)
        {
            const min = { ...budget.minScores, ...overrides }[id];
            if (min !== undefined && median.scores[id] < min)
            {
                failures.push(`${page}: ${id} ${Math.round(median.scores[id] * 100)} is below ${Math.round(min * 100)}`);
            }
        }
        if (median.scriptKB > budget.maxScriptKB)
        {
            failures.push(`${page}: ${median.scriptKB.toFixed(1)} KB of JavaScript is over the ${budget.maxScriptKB} KB budget`);
        }
    }
}
finally
{
    site.close();
    for (const api of apis)
    {
        api.close();
    }
}
if (failures.length)
{
    console.error(`\nOver budget:\n${failures.map((f) => `  ${f}`).join('\n')}`);
    process.exit(1);
}
console.log('\nEvery page is within the budget.');
