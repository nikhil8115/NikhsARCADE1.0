/**
 * NIKH'S STATION PS1 — Global Configuration & Online Game Storage
 *
 * Local Play:
 *   Works directly out of the box with the included server: `node server.js`.
 *   Games load directly from the local 'games/' folder.
 *
 * GitHub Pages Deployment:
 *   GitHub rejects git pushes containing files over 100 MB.
 *   The 4 built-in PS1 CHD ROM files are 311MB – 459MB each.
 *
 *   METHOD 1 (Recommended & Free — GitHub Releases):
 *     1. Push the website files to your GitHub repository.
 *     2. Go to Releases -> Draft a new release -> Tag: v1.0.0.
 *     3. Drag & drop the 4 .chd files from your local 'games/' folder as release assets.
 *     4. When published, release assets have direct CDN links with CORS & byte-range streaming enabled!
 *     5. Set `githubUser` and `githubRepo` below, or let auto-detection resolve it on GitHub Pages.
 *
 *   METHOD 2 (Git LFS / GitHub Actions):
 *     If using Git LFS with GitHub Actions, leave this empty.
 *     The games will load from the relative 'games/' directory.
 */
window.PS1_CONFIG = {
  // (Optional) Your GitHub username and repository name for Release downloads
  githubUser: "",
  githubRepo: "",
  releaseTag: "v1.0.0",

  // (Optional) Explicit full URL to release or external CDN
  // e.g. "https://github.com/USERNAME/REPO/releases/download/v1.0.0/"
  releaseBaseUrl: "",

  // (Optional) Custom CDN or mirror URL
  customBaseUrl: "",
};

/**
 * Resolves the full URL for a built-in game file.
 * Automatically handles:
 * 1. Explicit CDN / release URL in window.PS1_CONFIG
 * 2. GitHub Pages auto-detection (https://<user>.github.io/<repo>/ -> GitHub Releases)
 * 3. Localhost and standard relative path ('games/<file>')
 */
window.resolveGameUrl = function(filename) {
  const cfg = window.PS1_CONFIG || {};

  // 1. Explicit custom CDN
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim() !== '') {
    return cfg.customBaseUrl.replace(/\/+$/, '') + '/' + filename;
  }

  // 2. Explicit release base URL
  if (cfg.releaseBaseUrl && cfg.releaseBaseUrl.trim() !== '') {
    return cfg.releaseBaseUrl.replace(/\/+$/, '') + '/' + filename;
  }

  // 3. GitHub User & Repo specified
  if (cfg.githubUser && cfg.githubRepo) {
    const tag = cfg.releaseTag || 'v1.0.0';
    return `https://github.com/${cfg.githubUser}/${cfg.githubRepo}/releases/download/${tag}/${filename}`;
  }

  // 4. If hosted on GitHub Pages (e.g. https://username.github.io/reponame/)
  // Automatically detect if running online on GitHub Pages
  if (window.location.hostname.endsWith('github.io')) {
    const user = window.location.hostname.split('.')[0];
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const repo = pathParts.length > 0 ? pathParts[0] : '';
    if (user && repo) {
      const tag = cfg.releaseTag || 'v1.0.0';
      // GitHub release download URL
      return `https://github.com/${user}/${repo}/releases/download/${tag}/${filename}`;
    }
  }

  // 5. Default / Localhost: relative games/ folder
  return `games/${filename}`;
};
