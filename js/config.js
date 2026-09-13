/**
 * NIKH'S STATION PS1 — Global Configuration & Online Game Storage
 *
 * Local Play:
 *   Works directly out of the box with the included server: `node server.js`.
 *   Games load directly from the local 'games/' folder with high performance.
 *
 * Online / GitHub Pages Deployment:
 *   PlayStation 1 CHD disc images are 311MB – 459MB each.
 *   GitHub repository file size limit is 100MB, and GitHub Pages artifact limit is 1GB.
 *
 *   PLAYING ONLINE OPTIONS:
 *   1. Instant Local Selection (Zero Bandwidth, Best Performance):
 *      When clicking any game, you can select the local .chd file from your PC.
 *      The browser loads it directly into memory via URL.createObjectURL at 60 FPS.
 *
 *   2. Custom CORS-Enabled Storage / CDN:
 *      Host your .chd files on any CORS-enabled storage (Cloudflare R2, Hugging Face, Internet Archive)
 *      and set `customBaseUrl` below:
 *      e.g. customBaseUrl: "https://your-bucket.r2.dev/games/"
 */
window.PS1_CONFIG = {
  // (Optional) Custom CORS-enabled CDN or cloud storage URL
  // e.g. "https://my-r2-bucket.example.com/games/"
  customBaseUrl: "",
};

/**
 * Checks if running on localhost, 127.0.0.1, or local file system
 */
window.isLocalHost = function() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '' || window.location.protocol === 'file:';
};

/**
 * Checks if a remote custom CDN/URL is configured
 */
window.hasCustomRomSource = function() {
  const cfg = window.PS1_CONFIG || {};
  return Boolean(cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '');
};

/**
 * Resolves the full URL for a built-in game file.
 */
window.resolveGameUrl = function(filename) {
  const cfg = window.PS1_CONFIG || {};

  // 1. Explicit custom CDN
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '') {
    return cfg.customBaseUrl.replace(/\/+$/, '') + '/' + filename;
  }

  // 2. Local development server: relative games/ folder
  if (window.isLocalHost()) {
    return `games/${filename}`;
  }

  // 3. Online fallback: returns null so the UI can prompt the user to pick local ROM
  return null;
};

