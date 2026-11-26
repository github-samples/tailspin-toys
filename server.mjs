import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDesignAdvice, getProviderStatus, parseAdviceRequest } from './src/lib/intero-ai.mjs';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const contentTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
]);

function sendJson(response, status, value) {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify(value));
}

function sameOriginRequest(request) {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (typeof origin !== 'string' || typeof host !== 'string') return false;
    try {
        return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
        return false;
    }
}

async function readJsonBody(request) {
    const contentLength = Number(request.headers['content-length'] ?? 0);
    if (contentLength > 4096) throw Object.assign(new Error('Request body is too large.'), { status: 413 });

    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 4096) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
        chunks.push(chunk);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
    }
}

async function serveStatic(request, response, pathname) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
    }

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        sendJson(response, 400, { error: 'Invalid URL path.' });
        return;
    }
    if (decodedPath.includes('\\')) {
        sendJson(response, 400, { error: 'Invalid URL path.' });
        return;
    }

    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    let filePath = resolve(root, relativePath);
    if (!filePath.startsWith(`${root}${sep}`) && filePath !== root) {
        sendJson(response, 400, { error: 'Invalid URL path.' });
        return;
    }

    let content;
    try {
        if ((await stat(filePath)).isDirectory()) filePath = resolve(filePath, 'index.html');
        content = await readFile(filePath);
    } catch {
        try {
            filePath = resolve(root, '404.html');
            content = await readFile(filePath);
            response.statusCode = 404;
        } catch {
            sendJson(response, 404, { error: 'Page not found.' });
            return;
        }
    }

    response.writeHead(response.statusCode || 200, {
        'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
        'Content-Length': content.length,
        'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
}

async function handleRequest(request, response) {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.pathname === '/api/providers' && request.method === 'GET') {
        sendJson(response, 200, getProviderStatus());
        return;
    }

    if (requestUrl.pathname === '/api/design-advice' && request.method === 'POST') {
        if (!sameOriginRequest(request)) {
            sendJson(response, 403, { error: 'This request must come from the same origin.' });
            return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
            sendJson(response, 415, { error: 'Send a JSON request.' });
            return;
        }

        try {
            const adviceRequest = parseAdviceRequest(await readJsonBody(request));
            const advice = await generateDesignAdvice(adviceRequest);
            sendJson(response, 200, {
                provider: adviceRequest.provider,
                advice,
                limitation: 'Text suggestions only; no geometry or render was generated.',
            });
        } catch (error) {
            const status = error?.status ?? 400;
            const message = status === 503
                ? error.message
                : status === 502
                    ? 'The AI provider request could not be completed.'
                    : error?.message ?? 'The request could not be completed.';
            sendJson(response, status, { error: message });
        }
        return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'API route not found.' });
        return;
    }
    await serveStatic(request, response, requestUrl.pathname);
}

const server = createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
        if (!response.headersSent) sendJson(response, 500, { error: 'The request could not be completed.' });
        else response.destroy();
    });
});

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

const port = Number(argumentValue('--port') ?? process.env.PORT ?? 4321);
const host = argumentValue('--host') ?? process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
}

server.listen(port, host, () => {
    console.log(`Intero is listening on http://${host}:${port}`);
});
