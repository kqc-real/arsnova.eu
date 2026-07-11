#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createGzip, constants as zlibConstants } from 'node:zlib';

const root = path.resolve(process.argv[2] || 'apps/frontend/dist/browser');
const port = Number.parseInt(process.argv[3] || process.env.PORT || '4173', 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Ungültiger Port: ${String(process.argv[3] || process.env.PORT)}`);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.woff2', 'font/woff2'],
]);
const compressibleExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://localhost').pathname);
  const relativePath = pathname.replace(/^\/+/, '');
  const requestedPath = path.resolve(root, relativePath);
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return requestedPath;
}

async function resolveFile(requestUrl) {
  let requestedPath = resolveRequestPath(requestUrl);
  if (!requestedPath) return null;

  try {
    const requestedStat = await stat(requestedPath);
    if (requestedStat.isDirectory()) {
      requestedPath = path.join(requestedPath, 'index.html');
    }
    const fileStat = await stat(requestedPath);
    return fileStat.isFile() ? { filePath: requestedPath, fileStat } : null;
  } catch {
    const pathname = new URL(requestUrl || '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/assets/')) {
      return null;
    }
    const localeAsset = path.resolve(root, 'de', pathname.slice(1));
    if (!localeAsset.startsWith(`${root}${path.sep}`)) {
      return null;
    }
    try {
      const fileStat = await stat(localeAsset);
      return fileStat.isFile() ? { filePath: localeAsset, fileStat } : null;
    } catch {
      return null;
    }
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const resolved = await resolveFile(request.url);
  if (!resolved) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = path.extname(resolved.filePath).toLowerCase();
  const acceptsGzip = /\bgzip\b/.test(request.headers['accept-encoding'] || '');
  const useGzip = acceptsGzip && compressibleExtensions.has(extension);
  const headers = {
    'Cache-Control':
      extension === '.html' ? 'public, max-age=0' : 'public, max-age=31536000, immutable',
    'Content-Type': contentTypes.get(extension) || 'application/octet-stream',
    Vary: 'Accept-Encoding',
    ...(useGzip
      ? { 'Content-Encoding': 'gzip' }
      : { 'Content-Length': String(resolved.fileStat.size) }),
  };
  response.writeHead(200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const source = createReadStream(resolved.filePath);
  source.on('error', () => response.destroy());
  if (useGzip) {
    const gzip = createGzip({
      level: 6,
      flush: zlibConstants.Z_SYNC_FLUSH,
    });
    gzip.on('error', () => response.destroy());
    source.pipe(gzip).pipe(response);
  } else {
    source.pipe(response);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Komprimierter Static-Server: http://localhost:${port} (${root})`);
});
