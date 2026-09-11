/**
 * PS1 Arcade — Android Touch Gamepad & Controller Engine
 * Supports:
 * - High-precision 8-way D-Pad with diagonal touch gliding
 * - PlayStation Face Buttons (△, ○, ✕, □) + Multi-button combo macros (1+2, 3+4)
 * - Shoulder bumpers (L1, L2, R1, R2) & System buttons (SELECT, START)
 * - Virtual Analog Thumbstick with spring return
 * - Android Haptic feedback (vibration)
 * - Dual input delivery: EmulatorJS GameManager + DOM KeyboardEvent dispatch
 * - Physical Gamepad API polling
 * - Overlay / Docked layout & Opacity cycling
 */

// ── Configuration & State ─────────────────────────────────────────
let hapticsEnabled  = true;
let analogMode      = false;
let isOverlayLayout = false;
const OPACITY_LEVELS = [0.45, 0.70, 0.85, 1.0];
let opacityIndex    = 2; // default 0.85

// Input mappings
const BTN_CONFIG = {
  'dpad-up':    { ejs: 4,  w3c: 12, key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
  'dpad-down':  { ejs: 5,  w3c: 13, key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
  'dpad-left':  { ejs: 6,  w3c: 14, key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
  'dpad-right': { ejs: 7,  w3c: 15, key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  'cross':      { ejs: 8,  w3c: 0,  key: 'z',          code: 'KeyZ',       keyCode: 90 },
  'square':     { ejs: 0,  w3c: 2,  key: 'x',          code: 'KeyX',       keyCode: 88 },
  'circle':     { ejs: 9,  w3c: 1,  key: 'a',          code: 'KeyA',       keyCode: 65 },
  'triangle':   { ejs: 1,  w3c: 3,  key: 's',          code: 'KeyS',       keyCode: 83 },
  'l1':         { ejs: 10, w3c: 4,  key: 'q',          code: 'KeyQ',       keyCode: 81 },
  'r1':         { ejs: 11, w3c: 5,  key: 'e',          code: 'KeyE',       keyCode: 69 },
  'l2':         { ejs: 12, w3c: 6,  key: 'Tab',        code: 'Tab',        keyCode: 9  },
  'r2':         { ejs: 13, w3c: 7,  key: 'r',          code: 'KeyR',       keyCode: 82 },
  'select':     { ejs: 2,  w3c: 8,  key: 'v',          code: 'KeyV',       keyCode: 86 },
  'start':      { ejs: 3,  w3c: 9,  key: 'Enter',      code: 'Enter',      keyCode: 13 },
};

const activeButtons = new Set();

// ── Dual Input Dispatch ───────────────────────────────────────────
function sendButton(btnKey, pressed) {
  const conf = BTN_CONFIG[btnKey];
  if (!conf) return;

  if (pressed) {
    if (activeButtons.has(btnKey)) return;
    activeButtons.add(btnKey);

    // Haptic vibration
    if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(12); } catch {}
    }
  } else {
    if (!activeButtons.has(btnKey)) return;
    activeButtons.delete(btnKey);
  }

  // Visual element state
  const els = document.querySelectorAll(`[data-btn="${btnKey}"]`);
  els.forEach(el => {
    if (pressed) el.classList.add('pressed');
    else         el.classList.remove('pressed');
  });

  // 1. EmulatorJS GameManager simulateInput (both EJS index and W3C index)
  try {
    if (window.EJS_emulator && window.EJS_emulator.gameManager) {
      const gm = window.EJS_emulator.gameManager;
      gm.simulateInput(0, conf.ejs, pressed ? 1 : 0);
      if (conf.w3c !== conf.ejs) {
        gm.simulateInput(0, conf.w3c, pressed ? 1 : 0);
      }
    }
  } catch {}

  // 2. Synthetic DOM KeyboardEvent dispatch (fallback for EJS event listener)
  try {
    const eventType = pressed ? 'keydown' : 'keyup';
    const evt = new KeyboardEvent(eventType, {
      key:        conf.key,
      code:       conf.code,
      keyCode:    conf.keyCode,
      which:      conf.keyCode,
      bubbles:    true,
      cancelable: true,
    });

    const canvas = document.querySelector('#game-container canvas');
    if (canvas) canvas.dispatchEvent(evt);
    window.dispatchEvent(evt);
  } catch {}
}

// ── Touch Control Wiring ──────────────────────────────────────────
function attachDirectButton(el, btnKey) {
  if (!el) return;

  const handleStart = (e) => {
    e.preventDefault();
    sendButton(btnKey, true);
  };
  const handleEnd = (e) => {
    e.preventDefault();
    sendButton(btnKey, false);
  };

  el.addEventListener('touchstart',  handleStart, { passive: false });
  el.addEventListener('touchend',    handleEnd,   { passive: false });
  el.addEventListener('touchcancel', handleEnd,   { passive: false });

  // Desktop mouse clicks for testing
  el.addEventListener('mousedown', handleStart);
  el.addEventListener('mouseup',   handleEnd);
  el.addEventListener('mouseleave', handleEnd);
}

function attachComboButton(el, comboKeysStr) {
  if (!el) return;
  const keys = comboKeysStr.split(',').map(s => s.trim());

  const handleStart = (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    keys.forEach(k => sendButton(k, true));
  };
  const handleEnd = (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
    keys.forEach(k => sendButton(k, false));
  };

  el.addEventListener('touchstart',  handleStart, { passive: false });
  el.addEventListener('touchend',    handleEnd,   { passive: false });
  el.addEventListener('touchcancel', handleEnd,   { passive: false });
  el.addEventListener('mousedown', handleStart);
  el.addEventListener('mouseup',   handleEnd);
  el.addEventListener('mouseleave', handleEnd);
}

// ── 8-Way D-Pad Touch Engine with Diagonal Gliding ───────────────
function initDpadEngine() {
  const dpadDisc = document.getElementById('dpad-disc');
  if (!dpadDisc) return;

  let dpadTouchId = null;
  let currentDpadKeys = [];

  function updateDpadFromCoords(clientX, clientY) {
    const rect = dpadDisc.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    // Center deadzone
    if (dist < 14) {
      applyDpadDirections([]);
      return;
    }

    // Angle in degrees from -180 to 180 (0 is right, 90 is down, -90 is up)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const newDirs = [];

    // 8-directional sectors
    // Right: [-22.5, 22.5]
    // Down-Right: [22.5, 67.5]
    // Down: [67.5, 112.5]
    // Down-Left: [112.5, 157.5]
    // Left: [157.5, 180] or [-180, -157.5]
    // Up-Left: [-157.5, -112.5]
    // Up: [-112.5, -67.5]
    // Up-Right: [-67.5, -22.5]

    if (angle >= -67.5 && angle <= 67.5) {
      newDirs.push('dpad-right');
    }
    if (angle >= 22.5 && angle <= 157.5) {
      newDirs.push('dpad-down');
    }
    if (angle >= 112.5 || angle <= -112.5) {
      newDirs.push('dpad-left');
    }
    if (angle >= -157.5 && angle <= -22.5) {
      newDirs.push('dpad-up');
    }

    applyDpadDirections(newDirs);
  }

  function applyDpadDirections(dirs) {
    const allDpad = ['dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'];
    allDpad.forEach(k => {
      const shouldBeActive = dirs.includes(k);
      const isActive = currentDpadKeys.includes(k);
      if (shouldBeActive && !isActive) {
        sendButton(k, true);
      } else if (!shouldBeActive && isActive) {
        sendButton(k, false);
      }
    });
    currentDpadKeys = [...dirs];
  }

  // Touch Events
  dpadDisc.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (dpadTouchId !== null) return;
    const touch = e.changedTouches[0];
    dpadTouchId = touch.identifier;
    updateDpadFromCoords(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (dpadTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === dpadTouchId) {
        e.preventDefault();
        updateDpadFromCoords(touch.clientX, touch.clientY);
        break;
      }
    }
  }, { passive: false });

  const endTouch = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchId) {
        dpadTouchId = null;
        applyDpadDirections([]);
        break;
      }
    }
  };
  window.addEventListener('touchend', endTouch, { passive: false });
  window.addEventListener('touchcancel', endTouch, { passive: false });

  // Mouse fallback for testing
  let dpadMouseDown = false;
  dpadDisc.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dpadMouseDown = true;
    updateDpadFromCoords(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dpadMouseDown) return;
    updateDpadFromCoords(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (dpadMouseDown) {
      dpadMouseDown = false;
      applyDpadDirections([]);
    }
  });
}

// ── Virtual Analog Stick Engine ───────────────────────────────────
function initAnalogStickEngine() {
  const base = document.getElementById('analog-base');
  const knob = document.getElementById('analog-knob');
  if (!base || !knob) return;

  let analogTouchId = null;
  const MAX_RADIUS  = 38; // px
  let currentAnalogDirs = [];

  function updateKnob(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_RADIUS) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * MAX_RADIUS;
      dy = Math.sin(angle) * MAX_RADIUS;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    // Convert to directional inputs if beyond deadzone
    const newDirs = [];
    if (dist > 12) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle >= -67.5 && angle <= 67.5)   newDirs.push('dpad-right');
      if (angle >= 22.5 && angle <= 157.5)   newDirs.push('dpad-down');
      if (angle >= 112.5 || angle <= -112.5) newDirs.push('dpad-left');
      if (angle >= -157.5 && angle <= -22.5) newDirs.push('dpad-up');
    }

    const all = ['dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'];
    all.forEach(k => {
      const active = newDirs.includes(k);
      const was    = currentAnalogDirs.includes(k);
      if (active && !was) sendButton(k, true);
      else if (!active && was) sendButton(k, false);
    });
    currentAnalogDirs = [...newDirs];
  }

  function resetKnob() {
    knob.style.transform = 'translate(0px, 0px)';
    currentAnalogDirs.forEach(k => sendButton(k, false));
    currentAnalogDirs = [];
  }

  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (analogTouchId !== null) return;
    const touch = e.changedTouches[0];
    analogTouchId = touch.identifier;
    updateKnob(touch.clientX, touch.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (analogTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === analogTouchId) {
        e.preventDefault();
        updateKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  }, { passive: false });

  const endAnalog = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === analogTouchId) {
        analogTouchId = null;
        resetKnob();
        break;
      }
    }
  };
  window.addEventListener('touchend', endAnalog, { passive: false });
  window.addEventListener('touchcancel', endAnalog, { passive: false });

  // Mouse fallback
  let mouseActive = false;
  base.addEventListener('mousedown', (e) => {
    e.preventDefault();
    mouseActive = true;
    updateKnob(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (mouseActive) updateKnob(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (mouseActive) {
      mouseActive = false;
      resetKnob();
    }
  });
}

// ── Android Gamepad Quick Bar Controls ────────────────────────────
function initQuickBar() {
  // 1. Analog Toggle
  const analogBtn = document.getElementById('btn-toggle-analog');
  const analogLed = document.getElementById('analog-led');
  const dpadWrap  = document.getElementById('dpad-wrapper');
  const stickWrap = document.getElementById('analog-stick-wrapper');

  if (analogBtn) {
    analogBtn.addEventListener('click', () => {
      analogMode = !analogMode;
      if (analogLed) analogLed.classList.toggle('active', analogMode);
      if (dpadWrap)  dpadWrap.style.display  = analogMode ? 'none' : 'block';
      if (stickWrap) stickWrap.style.display = analogMode ? 'block' : 'none';
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate(20);
    });
  }

  // 2. Overlay / Docked Layout Toggle
  const layoutBtn  = document.getElementById('btn-toggle-layout');
  const layoutText = document.getElementById('layout-mode-text');
  const controls   = document.getElementById('onscreen-controls');

  if (layoutBtn && controls) {
    layoutBtn.addEventListener('click', () => {
      isOverlayLayout = !isOverlayLayout;
      controls.classList.toggle('overlay-mode', isOverlayLayout);
      if (layoutText) layoutText.textContent = isOverlayLayout ? 'Docked' : 'Overlay';
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate(15);
    });
  }

  // 3. Haptics Toggle
  const hapticsBtn  = document.getElementById('btn-toggle-haptics');
  const hapticsText = document.getElementById('haptics-text');
  if (hapticsBtn) {
    hapticsBtn.addEventListener('click', () => {
      hapticsEnabled = !hapticsEnabled;
      if (hapticsText) hapticsText.textContent = hapticsEnabled ? 'Haptics: ON' : 'Haptics: OFF';
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([20, 50, 20]);
    });
  }

  // 4. Opacity Cycling
  const opacityBtn  = document.getElementById('btn-cycle-opacity');
  const opacityText = document.getElementById('opacity-text');
  if (opacityBtn && controls) {
    opacityBtn.addEventListener('click', () => {
      opacityIndex = (opacityIndex + 1) % OPACITY_LEVELS.length;
      const op = OPACITY_LEVELS[opacityIndex];
      controls.style.opacity = op;
      if (opacityText) opacityText.textContent = `Opacity: ${Math.round(op * 100)}%`;
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate(12);
    });
  }
}

// ── Physical Gamepad Polling ──────────────────────────────────────
const DEADZONE = 0.15;
const prevButtons = {};

function applyDeadzone(val) {
  return Math.abs(val) < DEADZONE ? 0 : val;
}

function pollGamepads() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < gamepads.length; i++) {
    const gp = gamepads[i];
    if (!gp) continue;

    if (!prevButtons[i]) prevButtons[i] = new Array(gp.buttons.length).fill(false);

    gp.buttons.forEach((btn, idx) => {
      const pressed = btn.pressed || btn.value > 0.5;
      const wasPressed = prevButtons[i][idx];

      if (pressed !== wasPressed) {
        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
          try {
            window.EJS_emulator.gameManager.simulateInput(0, idx, pressed ? 1 : 0);
          } catch {}
        }
        prevButtons[i][idx] = pressed;
      }
    });
  }
  requestAnimationFrame(pollGamepads);
}

function updateControllerBadge(connected) {
  const badge = document.getElementById('controller-badge');
  if (!badge) return;
  badge.className = 'controller-badge' + (connected ? ' connected' : '');
  badge.innerHTML = `
    <span class="dot"></span>
    <span>${connected ? '🎮 Controller Connected' : '🎮 No Controller'}</span>
  `;
}

window.addEventListener('gamepadconnected', (e) => {
  updateControllerBadge(true);
});
window.addEventListener('gamepaddisconnected', () => {
  const still = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).some(g => g);
  updateControllerBadge(still);
});
requestAnimationFrame(pollGamepads);

// ── Toggle On-Screen Controls (Toolbar) ───────────────────────────
function toggleOnscreenControls() {
  const controls = document.getElementById('onscreen-controls');
  const btn = document.getElementById('toggle-controls-btn');
  if (!controls) return;
  const visible = controls.classList.toggle('visible');
  if (btn) btn.classList.toggle('active', visible);
}

// ── Setup & Initialization ────────────────────────────────────────
function initAllControls() {
  const controls = document.getElementById('onscreen-controls');
  if (!controls) return;

  // 1. Direct buttons (Shoulders, Face, Select, Start)
  const buttons = controls.querySelectorAll('[data-btn]');
  buttons.forEach(el => {
    const key = el.getAttribute('data-btn');
    if (!key.startsWith('dpad-')) {
      attachDirectButton(el, key);
    }
  });

  // 2. Combo buttons
  const combos = controls.querySelectorAll('[data-combo]');
  combos.forEach(el => {
    attachComboButton(el, el.getAttribute('data-combo'));
  });

  // 3. D-Pad & Analog Engines
  initDpadEngine();
  initAnalogStickEngine();
  initQuickBar();

  // 4. Auto-detect mobile / Android & show gamepad by default
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isTouchDevice || isAndroid) {
    controls.classList.add('visible');
    const toggleBtn = document.getElementById('toggle-controls-btn');
    if (toggleBtn) toggleBtn.classList.add('active');
  }

  // 5. Connect Toolbar Toggle button
  const toggleBtn = document.getElementById('toggle-controls-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleOnscreenControls);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAllControls();
});
