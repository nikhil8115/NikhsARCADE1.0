/**
 * NIKH'S STATION PS1 — Global Configuration & Online Game Storage
 *
 * ──────────────────────────────────────────────────────────────────
 * HOW TO ENABLE ONLINE PLAY (GitHub Pages / Cloud Hosting):
 * ──────────────────────────────────────────────────────────────────
 *
 * PS1 game files (.chd) are 300MB–460MB — too large for GitHub.
 * You need to host them on a CORS-enabled cloud storage.
 *
 * OPTION A — Internet Archive (FREE, No Signup for Download):
 *   1. Upload your .chd files to https://archive.org (free account needed to upload)
 *   2. Set: customBaseUrl: "https://archive.org/download/YOUR-ITEM-ID/"
 *   OR set per-game URLs in the GAME_URLS map below.
 *
 * OPTION B — Cloudflare R2 (FREE up to 10GB):
 *   1. Create a bucket at https://dash.cloudflare.com/r2
 *   2. Enable "Public Access" and set CORS to allow all origins
 *   3. Set: customBaseUrl: "https://pub-XXXXX.r2.dev/games/"
 *
 * OPTION C — Hugging Face Dataset (FREE, large files OK):
 *   1. Create a dataset at https://huggingface.co/datasets
 *   2. Upload your .chd files
 *   3. Set: customBaseUrl: "https://huggingface.co/datasets/YOUR-USER/YOUR-REPO/resolve/main/"
 *
 * OPTION D — Any CORS-Enabled CDN / Storage:
 *   The URL just needs to respond with: Access-Control-Allow-Origin: *
 *
 * ──────────────────────────────────────────────────────────────────
 * LOCAL PLAY: `node server.js` — games/ folder is used directly.
 * ──────────────────────────────────────────────────────────────────
 */

window.PS1_CONFIG = {
  /**
   * (Option A/B/C/D) Your CORS-enabled CDN base URL.
   * Leave empty "" to use per-game URLs below, or to use "Play from PC" mode.
   * Example: "https://pub-abc123.r2.dev/games/"
   */
  customBaseUrl: "",

  /**
   * Per-game direct download URLs (overrides customBaseUrl for that game).
   * Set these to Internet Archive / R2 / HuggingFace direct links.
   * These are used BOTH for auto-loading AND for showing download links in the UI.
   *
   * How to get an Internet Archive URL:
   *   1. Go to https://archive.org/upload — upload your .chd file
   *   2. After upload, open the item page, right-click the .chd → "Copy link"
   *   3. Paste that URL here for the matching game
   */
  gameUrls: {
    // 'tekken3.chd':        'https://archive.org/download/YOUR-ITEM/tekken3.chd',
    // 'pacman.chd':         'https://archive.org/download/YOUR-ITEM/pacman.chd',
    // 'residentevil.chd':   'https://archive.org/download/YOUR-ITEM/residentevil.chd',
    // 'tombraider.chd':     'https://archive.org/download/YOUR-ITEM/tombraider.chd',
  },
};

/**
 * Checks if running on localhost, 127.0.0.1, or local file system
 */
window.isLocalHost = function() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '' || window.location.protocol === 'file:';
};

/**
 * Checks if a remote custom CDN/URL is configured (either base or per-game)
 */
window.hasCustomRomSource = function() {
  const cfg = window.PS1_CONFIG || {};
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '') return true;
  if (cfg.gameUrls && Object.keys(cfg.gameUrls).length > 0) return true;
  return false;
};

/**
 * Resolves the full URL for a built-in game file.
 * Returns null if not configured (triggers "Play from PC" prompt).
 */
window.resolveGameUrl = function(filename) {
  const cfg = window.PS1_CONFIG || {};

  // 1. Per-game explicit URL (highest priority)
  if (cfg.gameUrls && cfg.gameUrls[filename]) {
    return cfg.gameUrls[filename];
  }

  // 2. Custom CDN base URL
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '') {
    return cfg.customBaseUrl.replace(/\/+$/, '') + '/' + filename;
  }

  // 3. Local development server: relative games/ folder
  if (window.isLocalHost()) {
    return `games/${filename}`;
  }

  // 4. Online fallback: returns null so the UI shows "Play from PC" + download links
  return null;
};

/**
 * Gets the download link hint for a game (for showing in the UI).
 * Returns the CDN URL if configured, otherwise returns a help URL.
 */
window.getGameDownloadHint = function(filename) {
  const cfg = window.PS1_CONFIG || {};
  if (cfg.gameUrls && cfg.gameUrls[filename]) return cfg.gameUrls[filename];
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '') {
    return cfg.customBaseUrl.replace(/\/+$/, '') + '/' + filename;
  }
  return null;
};
