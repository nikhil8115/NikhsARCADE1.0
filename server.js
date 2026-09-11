/**
 * PS1 Arcade — Local Dev Server
 *
 * Headers:
 *   COOP  : same-origin        (required for SharedArrayBuffer)
 *   COEP  : credentialless     (allows CDN assets like EmulatorJS without CORP header)
 *   CORP  : cross-origin       (our own files are shareable)
 * Pac-Man World is served from its download location via /games/pacman/* route.
 *
 * Run: node server.js
 * Open: http://localhost:3000
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;

// ── Game source files ───────────────────────────────────────
const TEKKEN3_CHD      = path.join(__dirname, 'games', 'tekken3.chd');
const PACMAN_CHD       = path.join(__dirname, 'games', 'pacman.chd');
const RESIDENTEVIL_CHD = path.join(__dirname, 'games', 'residentevil.chd');
const TOMBRAIDER_CHD   = path.join(__dirname, 'games', 'tombraider.chd');

// ── MIME Types ───────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.bin':  'application/octet-stream',
  '.cue':  'text/plain',
  '.iso':  'application/octet-stream',
  '.pbp':  'application/octet-stream',
  '.chd':  'application/octet-stream',
};

// ── Common response headers ──────────────────────────────────────
function setSecurityHeaders(res) {
  // COOP: required to enable SharedArrayBuffer (needed by Emscripten WASM)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // COEP credentialless: allows cross-origin CDN resources (EmulatorJS cores, WASM)
  // without needing each CDN asset to serve Cross-Origin-Resource-Policy headers.
  // Supported in Chrome 96+, Firefox 119+, Edge 96+.
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  // Allow our own files to be embedded cross-origin if needed
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Allow range requests (needed for streaming large .bin files)
  res.setHeader('Accept-Ranges', 'bytes');
}

// ── Serve a file with optional Range support ─────────────────────
function serveFile(filePath, req, res) {
  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext      = path.extname(filePath).toLowerCase();
    const mimeType = MIME[ext] || 'application/octet-stream';
    const total    = stat.size;
    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
      // Handle HTTP Range requests (needed for large .bin streaming)
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end   = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${total}`,
        'Content-Length': chunkSize,
        'Content-Type':   mimeType,
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type':   mimeType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// ── Request Handler ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setSecurityHeaders(res);

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // ── Route: /games/tekken3/game.chd → Tekken 3 CHD ─────────────
  if (urlPath === '/games/tekken3/game.chd' || urlPath === '/games/tekken3.chd') {
    serveFile(TEKKEN3_CHD, req, res);
    return;
  }

  // ── Route: /games/pacman/game.chd → Pac-Man World CHD ───────────
  if (urlPath === '/games/pacman/game.chd' || urlPath === '/games/pacman.chd') {
    serveFile(PACMAN_CHD, req, res);
    return;
  }

  // ── Route: /games/residentevil/game.chd → Resident Evil CHD ────
  if (urlPath === '/games/residentevil/game.chd' || urlPath === '/games/residentevil.chd') {
    serveFile(RESIDENTEVIL_CHD, req, res);
    return;
  }

  // ── Route: /games/tombraider/game.chd → Tomb Raider CHD ─────────
  if (urlPath === '/games/tombraider/game.chd' || urlPath === '/games/tombraider.chd') {
    serveFile(TOMBRAIDER_CHD, req, res);
    return;
  }

  // ── Default: serve from project directory ───────────────────
  const filePath = path.join(__dirname, urlPath);
  // Security: block path traversal outside project dir
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  serveFile(filePath, req, res);
});

server.listen(PORT, () => {
  console.log(`\n🎮  PS1 Arcade is running!\n`);
  console.log(`   ➜  Local:   http://localhost:${PORT}`);
  console.log(`   ➜  Pac-Man: http://localhost:${PORT}/games/pacman/game.chd\n`);
  console.log(`   ✅  COEP: credentialless  (EmulatorJS CDN network fix)`);
  console.log(`   ✅  Range requests enabled (large ROM streaming)\n`);
  console.log(`   Press Ctrl+C to stop.\n`);
});
