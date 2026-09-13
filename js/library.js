/**
 * PS1 Arcade — Game Library
 * Handles ROM upload (single file + multi-bin folder), localStorage persistence,
 * and game card rendering.
 */

const STORAGE_KEY = 'ps1_arcade_library';
const BIOS_KEY    = 'ps1_arcade_bios';

// ── Built-in games (served directly from server) ────────────────
// These are always available — no upload required.
const BUILT_IN_GAMES = [
  {
    id:         'builtin_tekken3',
    name:       'Tekken 3',
    ext:        'chd',
    fileName:   'tekken3.chd',
    size:       459374887,
    addedAt:    0,
    lastPlayed: null,
    isMultiBin: false,
    trackCount: 1,
    isBuiltIn:  true,
    mainUrl:    'games/tekken3.chd',
    additionalFiles: {},
  },
  {
    id:         'builtin_pacman',
    name:       'Pac-Man World',
    ext:        'chd',
    fileName:   'pacman.chd',
    size:       351668581,
    addedAt:    0,
    lastPlayed: null,
    isMultiBin: false,
    trackCount: 1,
    isBuiltIn:  true,
    mainUrl:    'games/pacman.chd',
    additionalFiles: {},
  },
  {
    id:         'builtin_residentevil',
    name:       'Resident Evil',
    ext:        'chd',
    fileName:   'residentevil.chd',
    size:       318837841,
    addedAt:    0,
    lastPlayed: null,
    isMultiBin: false,
    trackCount: 1,
    isBuiltIn:  true,
    mainUrl:    'games/residentevil.chd',
    additionalFiles: {},
  },
  {
    id:         'builtin_tombraider',
    name:       'Tomb Raider',
    ext:        'chd',
    fileName:   'tombraider.chd',
    size:       311639500,
    addedAt:    0,
    lastPlayed: null,
    isMultiBin: false,
    trackCount: 1,
    isBuiltIn:  true,
    mainUrl:    'games/tombraider.chd',
    additionalFiles: {},
  },
];

function resolveBuiltinGameUrl(builtin) {
  if (typeof window.resolveGameUrl === 'function') {
    return window.resolveGameUrl(builtin.fileName || (builtin.id.replace('builtin_', '') + '.chd'));
  }
  return builtin.mainUrl || `games/${builtin.fileName}`;
}

// ── State ────────────────────────────────────────────────────────
let library    = [];
let biosLoaded = false;
let biosBlob   = null;

// ── Helpers ──────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function gameName(filename) {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
}

function gameEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('crash'))       return '🐸';
  if (n.includes('spyro'))       return '🐉';
  if (n.includes('final'))       return '⚔️';
  if (n.includes('metal'))       return '🔫';
  if (n.includes('resident'))    return '🧟';
  if (n.includes('tomb'))        return '🏺';
  if (n.includes('tekken') || n.includes('fight')) return '🥊';
  if (n.includes('race') || n.includes('gran') || n.includes('drive')) return '🏎️';
  if (n.includes('castlevania')) return '🏰';
  if (n.includes('mega'))        return '🤖';
  return '🎮';
}

function generatePastelGradient(index) {
  const gradients = [
    'linear-gradient(135deg, #1a0533 0%, #2d1060 100%)',
    'linear-gradient(135deg, #031a2d 0%, #0c4a6e 100%)',
    'linear-gradient(135deg, #1a1a03 0%, #3d2d00 100%)',
    'linear-gradient(135deg, #0d1a08 0%, #1a3d0c 100%)',
    'linear-gradient(135deg, #1a0808 0%, #3d0c0c 100%)',
    'linear-gradient(135deg, #0d0817 0%, #1d0e38 100%)',
  ];
  return gradients[index % gradients.length];
}

// ── Library Persistence ──────────────────────────────────────────
function saveLibrary() {
  const meta = library.map(({ id, name, size, ext, addedAt, lastPlayed, isMultiBin, trackCount }) =>
    ({ id, name, size, ext, addedAt, lastPlayed, isMultiBin: isMultiBin || false, trackCount: trackCount || 1 })
  );
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch {}
}

function loadLibraryMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Single-File ROM Handling ─────────────────────────────────────
const ALLOWED_EXTS = ['.bin', '.cue', '.iso', '.pbp', '.chd', '.img', '.mdf'];

function isValidROM(filename) {
  return ALLOWED_EXTS.some(ext => filename.toLowerCase().endsWith(ext));
}

function addROMFile(file) {
  if (!isValidROM(file.name)) {
    showToast(`⚠️ Unsupported format: ${file.name}`, 'error');
    return;
  }

  const id    = `rom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name  = gameName(file.name);
  const ext   = file.name.split('.').pop().toLowerCase();
  const entry = {
    id, name, size: file.size, ext,
    addedAt: Date.now(), lastPlayed: null,
    isMultiBin: false, trackCount: 1,
    file, blobUrl: null,
  };

  library.unshift(entry);
  saveLibrary();
  renderLibrary();
  showToast(`✅ Added: ${name}`, 'success');
}

// ── Multi-Bin Folder Handling ────────────────────────────────────

/**
 * Parse a .cue file text and extract all referenced .bin filenames.
 * Returns an array of filenames in track order.
 */
function parseCueFilenames(cueText) {
  const lines    = cueText.split('\n');
  const filenames = [];
  for (const line of lines) {
    const m = line.trim().match(/^FILE\s+"?(.+?)"?\s+BINARY/i);
    if (m) filenames.push(m[1].trim());
  }
  return filenames;
}

/**
 * Given a flat array of File objects from a folder upload,
 * group them into game entries (one per .cue file found).
 * Falls back to treating all .bin files as a single multi-track game
 * if no .cue is present.
 */
async function processFolder(files) {
  const fileArray = Array.from(files);

  // Build a name→File map for quick lookup (case-insensitive)
  const fileMap = {};
  fileArray.forEach(f => {
    fileMap[f.name.toLowerCase()] = f;
  });

  const cueFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.cue'));
  const binFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.bin'));

  if (cueFiles.length === 0 && binFiles.length === 0) {
    // Fall back to single-file treatment for iso/pbp/chd
    fileArray.forEach(f => { if (isValidROM(f.name)) addROMFile(f); });
    return;
  }

  if (cueFiles.length === 0 && binFiles.length > 0) {
    // No .cue — treat first .bin as main, rest as additional
    await addMultiBinGame(binFiles[0], binFiles.slice(1), `${binFiles.length} BIN tracks`);
    return;
  }

  // Process each .cue file found
  for (const cueFile of cueFiles) {
    const cueText = await cueFile.text();
    const referencedNames = parseCueFilenames(cueText);

    // Collect all referenced .bin files
    const additionalFiles = {}; // filename → File
    for (const refName of referencedNames) {
      const key  = refName.toLowerCase();
      const found = fileMap[key];
      if (found) {
        additionalFiles[refName] = found;
      } else {
        // Try partial match (sometimes paths differ in case)
        const fallback = Object.values(fileMap).find(f =>
          f.name.toLowerCase() === key || f.name.toLowerCase().endsWith('/' + key)
        );
        if (fallback) additionalFiles[refName] = fallback;
      }
    }

    // Also include any .bin files not in the .cue but in the same folder
    binFiles.forEach(bf => {
      const key = bf.name.toLowerCase();
      if (!Object.keys(additionalFiles).some(k => k.toLowerCase() === key)) {
        additionalFiles[bf.name] = bf;
      }
    });

    const trackCount = Object.keys(additionalFiles).length;
    const id   = `rom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = gameName(cueFile.name);

    // Total size = cue + all bins
    const totalSize = cueFile.size + Object.values(additionalFiles).reduce((s, f) => s + f.size, 0);

    const entry = {
      id, name,
      size: totalSize,
      ext: 'cue',
      addedAt: Date.now(),
      lastPlayed: null,
      isMultiBin: true,
      trackCount,
      // Session-only file references
      file: cueFile,           // Main entry = .cue
      blobUrl: null,
      additionalFilesMap: additionalFiles, // { "Track 1.bin": File, ... }
    };

    library.unshift(entry);
    showToast(`✅ Added: ${name} (${trackCount} BIN track${trackCount !== 1 ? 's' : ''})`, 'success');
  }

  saveLibrary();
  renderLibrary();
}

/**
 * Helper for the no-.cue case: treat an array of .bin files as a single game.
 */
async function addMultiBinGame(mainFile, extraFiles, trackLabel) {
  const id   = `rom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const name = gameName(mainFile.name);
  const totalSize = [mainFile, ...extraFiles].reduce((s, f) => s + f.size, 0);
  const additionalFilesMap = {};
  extraFiles.forEach(f => { additionalFilesMap[f.name] = f; });

  const entry = {
    id, name,
    size: totalSize,
    ext: 'bin',
    addedAt: Date.now(),
    lastPlayed: null,
    isMultiBin: extraFiles.length > 0,
    trackCount: 1 + extraFiles.length,
    file: mainFile,
    blobUrl: null,
    additionalFilesMap,
  };

  library.unshift(entry);
  saveLibrary();
  renderLibrary();
  showToast(`✅ Added: ${name} (${entry.trackCount} tracks)`, 'success');
}

// ── Remove / Launch ──────────────────────────────────────────────
function removeROM(id) {
  // Built-in games cannot be removed
  if (BUILT_IN_GAMES.find(g => g.id === id)) {
    showToast('🔒 Built-in games cannot be removed.', 'error');
    return;
  }
  library = library.filter(g => g.id !== id);
  saveLibrary();
  renderLibrary();
}

function launchGame(id) {
  // ── Built-in game ──────────────────────────────────────────────
  const builtin = BUILT_IN_GAMES.find(g => g.id === id);
  if (builtin) {
    builtin.lastPlayed = Date.now();
    const resolvedUrl = resolveBuiltinGameUrl(builtin);

    // If URL is resolved (localhost or custom CDN configured), launch immediately
    if (resolvedUrl) {
      sessionStorage.setItem('ps1_current_game', JSON.stringify({
        id:              builtin.id,
        name:            builtin.name,
        blobUrl:         resolvedUrl,
        ext:             builtin.ext,
        isMultiBin:      builtin.isMultiBin,
        additionalFiles: builtin.additionalFiles,
        bios: biosBlob ? URL.createObjectURL(biosBlob) : null,
      }));
      window.location.href = 'play.html';
      return;
    }

    // Online GitHub Pages without external CDN: prompt user to pick local ROM for instant play
    promptOnlineGameLaunch(builtin);
    return;
  }


  // ── User-uploaded game ─────────────────────────────────────────
  const entry = library.find(g => g.id === id);
  if (!entry || !entry.file) {
    showToast('❌ File not available — please re-upload the ROM or folder.', 'error');
    return;
  }

  // Generate blob URL for main file (.cue or .bin)
  if (!entry.blobUrl) {
    entry.blobUrl = URL.createObjectURL(entry.file);
  }

  // Build additionalFiles: { filename → blobUrl } for all extra .bin tracks
  const additionalFiles = {};
  if (entry.additionalFilesMap) {
    for (const [filename, file] of Object.entries(entry.additionalFilesMap)) {
      additionalFiles[filename] = URL.createObjectURL(file);
    }
  }

  entry.lastPlayed = Date.now();
  saveLibrary();

  sessionStorage.setItem('ps1_current_game', JSON.stringify({
    id,
    name:            entry.name,
    blobUrl:         entry.blobUrl,
    ext:             entry.ext,
    isMultiBin:      entry.isMultiBin || false,
    additionalFiles,
    bios: biosBlob ? URL.createObjectURL(biosBlob) : null,
  }));

  window.location.href = 'play.html';
}

// ── Online Game Launch Prompt Modal ──────────────────────────────
function promptOnlineGameLaunch(builtin) {
  // Remove existing modal if any
  const oldModal = document.getElementById('online-launch-modal');
  if (oldModal) oldModal.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'online-modal-backdrop';
  backdrop.id = 'online-launch-modal';

  backdrop.innerHTML = `
    <div class="online-modal jewel-case-card" role="dialog" aria-modal="true" aria-labelledby="modal-game-title">
      <div class="online-modal-header">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:2.2rem">${gameEmoji(builtin.name)}</span>
          <div>
            <h3 id="modal-game-title" style="color:#f8fafc;font-family:'Outfit',sans-serif;font-size:1.3rem;margin:0">${builtin.name}</h3>
            <span style="font-size:0.8rem;color:#c77dff;font-family:'Space Mono',monospace">${formatBytes(builtin.size)} · ${builtin.ext.toUpperCase()}</span>
          </div>
        </div>
        <button class="online-modal-close" id="btn-close-launch-modal" aria-label="Close dialog">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="background:rgba(157,78,221,0.12);border:1px solid rgba(199,125,255,0.3);border-radius:14px;padding:14px">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <span style="font-size:1.4rem">🕹️</span>
            <div style="font-size:0.85rem;color:#cbd5e1;line-height:1.5">
              <strong>Running online on GitHub Pages</strong><br/>
              PlayStation 1 ROMs are 300MB–460MB each and cannot be stored directly in GitHub's repository without quota limits.
              Select your local <code>${builtin.fileName}</code> to start playing right away in your browser at full 60 FPS!
            </div>
          </div>
        </div>

        <button id="btn-modal-pick-rom" class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;justify-content:center;gap:10px">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Select ${builtin.fileName} & Play
        </button>
        <div style="text-align:center;font-size:0.75rem;color:#64748b;margin-top:-8px">
          Located on your PC in: <code>games/${builtin.fileName}</code>
        </div>

        <input type="file" id="modal-file-input" accept=".bin,.cue,.iso,.pbp,.chd,.img,.mdf" style="display:none" />

        <div style="display:flex;align-items:center;gap:10px;margin:2px 0">
          <div style="flex:1;height:1px;background:rgba(255,255,255,0.1)"></div>
          <span style="font-size:0.75rem;color:#64748b;text-transform:uppercase">Other ways to play</span>
          <div style="flex:1;height:1px;background:rgba(255,255,255,0.1)"></div>
        </div>

        <div style="font-size:0.8rem;color:#94a3b8;background:rgba(0,0,0,0.3);padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);line-height:1.5">
          <div style="font-weight:600;color:#e2e8f0;margin-bottom:4px">💻 Play 100% Offline (Included Local Server):</div>
          Run <code>node server.js</code> in your project directory and open <code>http://localhost:3000</code>. All games load automatically.
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Close actions
  const closeBtn = backdrop.querySelector('#btn-close-launch-modal');
  if (closeBtn) closeBtn.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  // Pick file action
  const pickBtn = backdrop.querySelector('#btn-modal-pick-rom');
  const fileInput = backdrop.querySelector('#modal-file-input');

  if (pickBtn && fileInput) {
    pickBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const blobUrl = URL.createObjectURL(file);
      sessionStorage.setItem('ps1_current_game', JSON.stringify({
        id: builtin.id,
        name: builtin.name,
        blobUrl: blobUrl,
        ext: file.name.split('.').pop().toLowerCase(),
        isMultiBin: false,
        additionalFiles: {},
        bios: biosBlob ? URL.createObjectURL(biosBlob) : null,
      }));
      window.location.href = 'play.html';
    });
  }
}

// ── Render ───────────────────────────────────────────────────────
function renderLibrary() {
  const grid    = document.getElementById('games-grid');
  const countEl = document.getElementById('game-count');

  // Combined list: user uploads first, then built-ins
  const allGames = [...library, ...BUILT_IN_GAMES];
  if (countEl) countEl.textContent = allGames.length;

  if (!allGames.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🕹️</div>
        <h3>No games yet</h3>
        <p>Upload a PS1 ROM or folder above to start playing</p>
      </div>`;
    return;
  }

  grid.innerHTML = allGames.map((game, idx) => {
    const trackBadge = game.isMultiBin
      ? `<span class="multi-bin-badge">📀 ${game.trackCount} tracks</span>`
      : `<span class="multi-bin-badge" style="background:rgba(157,78,221,0.25);border-color:rgba(199,125,255,0.4);color:#c77dff">💿 SINGLE DISC</span>`;
    const builtinBadge = game.isBuiltIn
      ? `<span class="builtin-badge">⭐ BUILT-IN</span>`
      : '';
    const removeBtnHtml = game.isBuiltIn
      ? `<span class="game-card-size">${formatBytes(game.size)}</span>`
      : `<span class="game-card-size">${formatBytes(game.size)}</span>
         <button class="game-card-remove" onclick="event.stopPropagation(); removeROM('${game.id}')"
           title="Remove game" aria-label="Remove ${game.name}">✕</button>`;

    return `
    <div class="game-card jewel-case-card" id="card-${game.id}" role="article" aria-label="Game: ${game.name}">
      <div class="ps-jewel-spine">
        <span class="ps-spine-logo">PS</span>
        <span class="ps-spine-text">PlayStation</span>
      </div>
      <div class="jewel-case-content">
        <div class="game-card-art" style="background:${generatePastelGradient(idx)}" onclick="launchGame('${game.id}')">
          <div class="jewel-gloss-glare"></div>
          <span style="font-size:2.8rem;position:relative;z-index:2">${gameEmoji(game.name)}</span>
          ${trackBadge}
          ${builtinBadge}
          <span class="mem-badge">💾 1 BLOCK</span>
          <span class="art-label">${game.ext.toUpperCase()}</span>
          <div class="game-play-overlay" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7L8 5z"/>
            </svg>
          </div>
        </div>
        <div class="game-card-info">
          <div class="game-card-title" title="${game.name}">${game.name}</div>
          <div class="game-card-meta">
            ${removeBtnHtml}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Upload Zone Wiring ───────────────────────────────────────────
function initUploadZone() {
  const zone       = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('rom-file-input');
  const folderInput = document.getElementById('rom-folder-input');

  if (!zone || !fileInput) return;

  // Single file click
  zone.addEventListener('click', (e) => {
    if (e.target.closest('.format-tag')) return;
    if (e.target.closest('#folder-upload-btn')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(addROMFile);
    fileInput.value = '';
  });

  // Folder upload
  folderInput?.addEventListener('change', async () => {
    if (folderInput.files.length === 0) return;
    showToast('📂 Processing folder...', '');
    await processFolder(folderInput.files);
    folderInput.value = '';
  });

  // Drag & drop — detect if items contain a directory
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');

    // Collect all files from DataTransferItemList (supports folder drag)
    const files = await collectDroppedFiles(e.dataTransfer);
    if (!files.length) return;

    const hasCueOrMultiBin =
      files.some(f => f.name.toLowerCase().endsWith('.cue')) ||
      files.filter(f => f.name.toLowerCase().endsWith('.bin')).length > 1;

    if (hasCueOrMultiBin) {
      showToast('📂 Processing multi-track game...', '');
      await processFolder(files);
    } else {
      files.forEach(f => { if (isValidROM(f.name)) addROMFile(f); });
    }
  });
}

/**
 * Recursively collect all File objects from a DataTransfer drop,
 * including files inside dropped folders (using FileSystemEntry API).
 */
async function collectDroppedFiles(dataTransfer) {
  const files = [];

  async function readEntry(entry) {
    if (entry.isFile) {
      await new Promise(resolve => {
        entry.file(f => { files.push(f); resolve(); }, resolve);
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      await new Promise(resolve => {
        reader.readEntries(async (entries) => {
          for (const e of entries) await readEntry(e);
          resolve();
        }, resolve);
      });
    }
  }

  if (dataTransfer.items) {
    for (const item of dataTransfer.items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        await readEntry(entry);
      } else if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  } else {
    // Fallback
    Array.from(dataTransfer.files).forEach(f => files.push(f));
  }

  return files;
}

// ── BIOS Panel ───────────────────────────────────────────────────
function initBIOSPanel() {
  const toggle  = document.getElementById('bios-toggle');
  const content = document.getElementById('bios-content');
  const input   = document.getElementById('bios-input');
  const status  = document.getElementById('bios-status');

  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const open = toggle.classList.toggle('open');
    content.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  input?.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    biosBlob = file;
    biosLoaded = true;
    if (status) {
      status.className = 'bios-status loaded';
      status.innerHTML = `<span>✓</span> <span>${file.name}</span>`;
    }
    showToast(`✅ BIOS loaded: ${file.name}`, 'success');
    input.value = '';
  });
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Only show built-in games — clear any previously uploaded entries
  localStorage.removeItem(STORAGE_KEY);
  library = [];

  renderLibrary();
  initUploadZone();
  initBIOSPanel();
});
