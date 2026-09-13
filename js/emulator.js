/**
 * PS1 Arcade — EmulatorJS Initialization
 * Configures and launches EmulatorJS with the ROM passed via sessionStorage.
 */

// ── Load game data from session ──────────────────────────────────
let gameData = null;
try {
  const raw = sessionStorage.getItem('ps1_current_game');
  if (raw) gameData = JSON.parse(raw);
} catch {}

function isPlayableUrl(url) {
  if (!url) return false;
  // Blob URLs from local file selection always work
  if (url.startsWith('blob:')) return true;
  // Local development server: all URLs work
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '' || window.location.protocol === 'file:';
  if (isLocal) return true;
  // GitHub raw/release URLs fail with CORS - always reject
  if (url.includes('github.com') && (url.includes('/releases/') || url.includes('/raw/') || url.includes('raw.githubusercontent.com'))) return false;
  // Any external https URL that is NOT a GitHub raw URL is assumed valid (CDN, Archive, R2, etc.)
  if (url.startsWith('https://') && !url.includes('github.io/') && !url.includes('raw.githubusercontent.com')) return true;
  if (url.startsWith('http://')) return true;
  // Relative paths on GitHub Pages point to 134-byte placeholder stubs - reject
  if (window.location.hostname.endsWith('github.io') && !url.startsWith('http')) return false;
  return false;
}

const canAutoLaunch = Boolean(gameData && isPlayableUrl(gameData.blobUrl));

// ── Prompt for ROM if game URL is not playable online or missing ─
if (!canAutoLaunch) {
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('emu-loading');
    if (overlay) overlay.style.display = 'none';

    const container = document.getElementById('game-container');
    if (container) {
      const name = gameData ? gameData.name : 'PlayStation Game';
      const fileName = gameData ? (gameData.fileName || (gameData.id || '').replace('builtin_', '') + '.chd') : null;

      // Check if there's a CDN download hint for this game
      let downloadHint = null;
      if (fileName && typeof window.getGameDownloadHint === 'function') {
        downloadHint = window.getGameDownloadHint(fileName);
      }

      const downloadSection = downloadHint ? `
        <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:14px 18px;max-width:460px;text-align:left;font-size:0.8rem;color:#cbd5e1;line-height:1.7">
          <strong style="color:#38bdf8">☁️ Cloud Download Available</strong><br/>
          This game is hosted online. Click below to download it, then use "Play from PC" to load it.<br/>
          <a href="${downloadHint}" download style="display:inline-block;margin-top:8px;padding:6px 14px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.4);border-radius:8px;color:#7dd3fc;text-decoration:none;font-size:0.8rem">
            ⬇️ Download ${name} (.chd)
          </a>
        </div>` : '';

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;font-family:'Outfit',sans-serif;color:#94a3b8;text-align:center;padding:24px;overflow-y:auto">
          <div style="font-size:3rem">🕹️</div>
          <div>
            <h2 style="color:#f1f5f9;font-size:1.4rem;margin-bottom:4px">${name}</h2>
            <p style="font-size:0.82rem;color:#c77dff;font-family:'Space Mono',monospace">PlayStation 1 · 32-Bit</p>
          </div>

          <div style="background:rgba(157,78,221,0.12);border:1px solid rgba(199,125,255,0.28);border-radius:14px;padding:14px 18px;max-width:460px;text-align:left;font-size:0.82rem;color:#cbd5e1;line-height:1.7">
            <strong style="color:#c77dff">📦 How to Play Online</strong><br/>
            PS1 ROMs are 300–460 MB — too large to store on GitHub.<br/>
            <strong>Step 1:</strong> Download or locate your <strong>${name} .chd</strong> file<br/>
            <strong>Step 2:</strong> Click "📁 Play from PC" and select that file<br/>
            <strong>Step 3:</strong> Game loads instantly in your browser at 60 FPS!
          </div>

          ${downloadSection}

          <button id="btn-play-select-rom" style="padding:13px 26px;font-size:0.95rem;border-radius:14px;cursor:pointer;background:linear-gradient(135deg,#9d4edd,#7b2cbf);color:white;border:none;display:inline-flex;align-items:center;gap:10px;font-weight:600;box-shadow:0 8px 24px rgba(157,78,221,0.4)">
            📁 Play from PC — Select ${name} file
          </button>
          <input type="file" id="play-rom-input" accept=".bin,.cue,.iso,.pbp,.chd,.img,.mdf" style="display:none" />

          <div style="margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            <a href="index.html" style="padding:7px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;border-radius:10px;font-size:0.82rem;text-decoration:none">← Back to Arcade</a>
            <a href="https://archive.org" target="_blank" rel="noopener" style="padding:7px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);color:#94a3b8;border-radius:10px;font-size:0.82rem;text-decoration:none">🌐 Internet Archive</a>
          </div>
        </div>`;

      const btn = container.querySelector('#btn-play-select-rom');
      const input = container.querySelector('#play-rom-input');
      if (btn && input) {
        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const blobUrl = URL.createObjectURL(file);
          sessionStorage.setItem('ps1_current_game', JSON.stringify({
            ...(gameData || {}),
            name: (gameData && gameData.name) || file.name.replace(/\.[^/.]+$/, ''),
            blobUrl: blobUrl,
            ext: file.name.split('.').pop().toLowerCase(),
            isMultiBin: false,
            additionalFiles: {}
          }));
          window.location.reload();
        });
      }
    }
  });
}

// ── EmulatorJS Config ────────────────────────────────────────────
if (canAutoLaunch) {
  function toAbsoluteUrl(url) {
    if (!url) return url;
    if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return window.location.origin + (url.startsWith('/') ? url : '/' + url);
    }
  }

  const absoluteGameUrl = toAbsoluteUrl(gameData.blobUrl);

  // Set global vars BEFORE loading the EmulatorJS script
  window.EJS_player           = '#game-container';
  window.EJS_gameName         = gameData.name;
  window.EJS_gameUrl          = absoluteGameUrl;
  window.EJS_core             = 'psx';          // PS1 core (pcsx_rearmed)
  window.EJS_pathtodata       = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded    = true;
  window.EJS_color            = '#8b5cf6';
  window.EJS_backgroundColor  = '#06060f';
  window.EJS_controlScheme    = 'psx';

  // BIOS (if user provided one)
  if (gameData.bios) {
    window.EJS_biosUrl = toAbsoluteUrl(gameData.bios);
  }

  // Multi-bin / multi-track support
  // EJS_AdditionalFiles maps .bin filenames (as written in the .cue) → absolute fetch URLs.
  // Without absolute URLs here the core cannot find the track files and falls back to BIOS shell.
  if (gameData.isMultiBin && gameData.additionalFiles) {
    const absAdditional = {};
    for (const [filename, url] of Object.entries(gameData.additionalFiles)) {
      absAdditional[filename] = toAbsoluteUrl(url);
    }
    if (Object.keys(absAdditional).length > 0) {
      window.EJS_AdditionalFiles = absAdditional;
      console.log('[PS1 Arcade] Multi-bin game — tracks:', Object.keys(absAdditional));
    }
  }

  // Save states support
  window.EJS_saveStateOnClose = true;
  window.EJS_loadStateOnStart = true;

  // Callbacks
  window.EJS_onGameStart = function() {
    console.log('[PS1 Arcade] Game started:', gameData.name);
    hideLoadingOverlay();
  };

  // Update loading text to show track info for multi-bin games
  document.addEventListener('DOMContentLoaded', () => {
    if (gameData.isMultiBin) {
      const loadingText = document.querySelector('.emu-loading-text');
      const loadingSub  = document.querySelector('.emu-loading .emu-loading-sub');
      if (loadingText) loadingText.textContent = `Loading ${gameData.name}…`;
      if (loadingSub)  loadingSub.textContent  =
        `Multi-track game — ${Object.keys(gameData.additionalFiles || {}).length + 1} BIN files`;
    }
  });

  window.EJS_onLoadError = function(err) {
    console.error('[PS1 Arcade] Load error:', err);
    showErrorState(err);
  };
}

// ── Loading Overlay ──────────────────────────────────────────────
function hideLoadingOverlay() {
  const overlay = document.getElementById('emu-loading');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 400);
  }
}

function showErrorState(err) {
  const overlay = document.getElementById('emu-loading');
  if (!overlay) return;

  const errStr = String(err || '').toLowerCase();
  const isNetwork = !err || errStr.includes('network') || errStr.includes('fetch') || errStr.includes('404') || errStr.includes('cors');
  const title = isNetwork ? 'ROM File Not Reachable Online' : 'Failed to load game';
  const subtitle = isNetwork
    ? 'GitHub Pages cannot host 400MB+ PS1 ROMs directly in the repo. Select your local game file to play instantly!'
    : (err || 'Unknown error. Some games require a BIOS file.');

  overlay.innerHTML = `
    <div style="text-align:center;padding:24px;font-family:'Inter',sans-serif;max-width:460px;margin:0 auto">
      <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
      <h3 style="color:#f1f5f9;margin-bottom:8px;font-family:'Outfit',sans-serif;font-size:1.2rem">${title}</h3>
      <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:18px;line-height:1.5">${subtitle}</p>

      <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
        <button id="btn-recovery-pick-rom" class="btn btn-primary" style="padding:12px 20px;font-size:0.9rem;border-radius:12px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:linear-gradient(135deg,#9d4edd,#7b2cbf);color:white;border:none">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Select ${gameData?.name || 'ROM'} file from PC & Play
        </button>
        <input type="file" id="recovery-file-input" accept=".bin,.cue,.iso,.pbp,.chd,.img,.mdf" style="display:none" />
        <a href="index.html" style="margin-top:6px;padding:8px 20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;border-radius:10px;font-size:0.85rem;text-decoration:none">← Back to Library</a>
      </div>
    </div>`;

  const pickBtn = overlay.querySelector('#btn-recovery-pick-rom');
  const fileInput = overlay.querySelector('#recovery-file-input');
  if (pickBtn && fileInput) {
    pickBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const blobUrl = URL.createObjectURL(file);
      sessionStorage.setItem('ps1_current_game', JSON.stringify({
        ...(gameData || {}),
        name: gameData?.name || file.name.replace(/\.[^/.]+$/, ''),
        blobUrl: blobUrl,
        ext: file.name.split('.').pop().toLowerCase(),
      }));
      window.location.reload();
    });
  }
}

// ── Toolbar Actions ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Update title
  const titleEl = document.getElementById('game-title');
  if (titleEl && gameData) titleEl.textContent = gameData.name;

  // Save state
  const saveBtn = document.getElementById('btn-save-state');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      try {
        const slot = parseInt(document.getElementById('state-slot')?.value || '1');
        window.EJS_emulator.gameManager.saveSaveState(slot);
        showToast('💾 State saved!', 'success');
      } catch { showToast('⚠️ Save failed — game may still be loading.', 'error'); }
    });
  }

  // Load state
  const loadBtn = document.getElementById('btn-load-state');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      try {
        const slot = parseInt(document.getElementById('state-slot')?.value || '1');
        window.EJS_emulator.gameManager.loadSaveState(slot);
        showToast('📂 State loaded!', 'success');
      } catch { showToast('⚠️ Load failed.', 'error'); }
    });
  }

  // Pause / Resume
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    let paused = false;
    pauseBtn.addEventListener('click', () => {
      try {
        if (!paused) {
          window.EJS_emulator.gameManager.pause();
          pauseBtn.classList.add('active');
          pauseBtn.querySelector('span').textContent = 'Resume';
        } else {
          window.EJS_emulator.gameManager.resume();
          pauseBtn.classList.remove('active');
          pauseBtn.querySelector('span').textContent = 'Pause';
        }
        paused = !paused;
      } catch {}
    });
  }

  // Screenshot
  const screenshotBtn = document.getElementById('btn-screenshot');
  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', () => {
      try {
        const canvas = document.querySelector('#game-container canvas');
        if (!canvas) { showToast('⚠️ Canvas not ready', 'error'); return; }
        const link = document.createElement('a');
        link.download = `${gameData?.name || 'screenshot'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('📸 Screenshot saved!', 'success');
      } catch { showToast('⚠️ Screenshot failed', 'error'); }
    });
  }

  // Full Window Mode (expands game to fill 100% of browser window)
  const fullWinBtn = document.getElementById('btn-full-window');
  const controlsEl = document.getElementById('onscreen-controls');

  if (fullWinBtn) {
    fullWinBtn.addEventListener('click', () => {
      const isFullWin = document.body.classList.toggle('full-window-active');
      fullWinBtn.classList.toggle('active', isFullWin);
      const span = fullWinBtn.querySelector('span');
      if (span) span.textContent = isFullWin ? 'Exit Window' : 'Full Window';

      // Always activate and overlay touch controls in full window
      if (isFullWin && controlsEl) {
        controlsEl.classList.add('visible', 'overlay-mode');
        document.getElementById('toggle-controls-btn')?.classList.add('active');
      }
    });
  }

  // OS Fullscreen Mode (fullscreen on .emu-wrapper so controls are included)
  const fsBtn = document.getElementById('btn-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const wrapper = document.querySelector('.emu-wrapper') || document.documentElement;
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

      if (!isFs) {
        const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen;
        if (req) {
          req.call(wrapper).catch(() => {
            document.documentElement.requestFullscreen().catch(() => {
              fullWinBtn?.click();
            });
          });
        } else {
          fullWinBtn?.click();
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    });
  }

  function onFsChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    document.body.classList.toggle('fullscreen-active', isFs);
    if (fsBtn) {
      fsBtn.classList.toggle('active', isFs);
      const span = fsBtn.querySelector('span');
      if (span) span.textContent = isFs ? 'Exit Screen' : 'Fullscreen';
    }
    if (isFs && controlsEl) {
      controlsEl.classList.add('visible', 'overlay-mode');
      document.getElementById('toggle-controls-btn')?.classList.add('active');
    }
  }

  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // Settings panel
  const settingsBtn = document.getElementById('btn-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const settingsClose = document.getElementById('settings-close');

  function openSettings() {
    settingsPanel?.classList.add('open');
    settingsBackdrop?.classList.add('open');
  }
  function closeSettings() {
    settingsPanel?.classList.remove('open');
    settingsBackdrop?.classList.remove('open');
  }

  settingsBtn?.addEventListener('click', openSettings);
  settingsClose?.addEventListener('click', closeSettings);
  settingsBackdrop?.addEventListener('click', closeSettings);

  // Settings toggles
  document.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => sw.classList.toggle('on'));
  });

  // Inject EmulatorJS script dynamically ONLY when the ROM URL is valid and playable
  if (canAutoLaunch) {
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.crossOrigin = 'anonymous';
    script.onerror = () => showErrorState('Failed to load EmulatorJS from CDN. Check your internet connection.');
    document.body.appendChild(script);

    // Watch for EmulatorJS internal "Network Error" or load failures at runtime
    const runtimeWatcher = setInterval(() => {
      const errEl = document.querySelector('.ejs_error_text, #game-container .ejs_error_text');
      if (errEl) {
        const text = (errEl.innerText || errEl.textContent || '').toLowerCase();
        if (text.includes('network error') || text.includes('failed to start') || text.includes('error')) {
          clearInterval(runtimeWatcher);
          showErrorState('Network Error: ROM file could not be downloaded over the network.');
        }
      }
    }, 500);

    setTimeout(() => clearInterval(runtimeWatcher), 60000);
  }
});

// ── Toast (reuse from library if available, or local) ────────────
function showToast(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type || ''}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
