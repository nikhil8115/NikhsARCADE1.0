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

// ── Redirect if no game ──────────────────────────────────────────
if (!gameData || !gameData.blobUrl) {
  // Show a friendly message instead of crashing
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;font-family:'Outfit',sans-serif;color:#94a3b8;text-align:center;padding:20px">
          <div style="font-size:3rem">🕹️</div>
          <div>
            <h2 style="color:#f1f5f9;margin-bottom:8px">No game loaded</h2>
            <p style="font-size:0.9rem">Go back to the library and select a game to play.</p>
          </div>
          <a href="index.html" style="padding:10px 24px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:white;border-radius:12px;font-weight:600;text-decoration:none">← Back to Library</a>
        </div>`;
    }
  });
}

// ── EmulatorJS Config ────────────────────────────────────────────
if (gameData) {

  /**
   * Build an absolute URL from a given url string.
   * - blob: URLs → returned as-is (already absolute)
   * - http/https URLs → returned as-is
   * - /relative paths → prepend window.location.origin (e.g. http://localhost:3000)
   *
   * EmulatorJS CDN script resolves .bin files relative to EJS_gameUrl.
   * If EJS_gameUrl is relative, the CDN script resolves it from cdn.emulatorjs.org
   * instead of localhost, so the .bin fetches 404 and only the BIOS shell opens.
   */
  function toAbsoluteUrl(url) {
    if (!url) return url;
    if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    // Resolve relative URL against current page location
    // This correctly resolves both on localhost and inside GitHub Pages repository subpaths
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

  // Inject EmulatorJS script dynamically after config vars are set
  if (gameData) {
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.crossOrigin = 'anonymous';
    script.onerror = () => showErrorState('Failed to load EmulatorJS from CDN. Check your internet connection.');
    document.body.appendChild(script);
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
