# ⚔️ NIKH,S STATION PS1 🎮
> Retro Lofi 32-Bit PlayStation Lounge with On-Screen Android Touch Controls, Full Gamepad Support, and 4 Built-In Classics.

---

## 📁 Local Website File Location
Your complete project files are located on your computer at:
```text
C:\Users\BEAST-NIKH\.gemini\antigravity-ide\scratch\ps1-arcade
```

To quickly open this folder in Windows File Explorer:
Press `Win + R`, paste the path above, and press **Enter**.

---

## 🕹️ Built-In Games
1. **Tekken 3** (`games/tekken3.chd`) — 459 MB
2. **Pac-Man World (20th Anniversary)** (`games/pacman.chd`) — 351 MB
3. **Resident Evil (Director's Cut)** (`games/residentevil.chd`) — 318 MB
4. **Tomb Raider** (`games/tombraider.chd`) — 311 MB

---

## 🚀 Running Locally
To run and play on your local computer:
```bash
node server.js
```
Then open your browser at:
```text
http://localhost:3000
```
- Built-in games load instantly with byte-range streaming.
- Cross-Origin Isolation (`SharedArrayBuffer`) is configured via `COOP`/`COEP` headers.

---

## 🌐 Deploying to GitHub & Running 100% Online Without Errors

When publishing to GitHub Pages, two key browser & platform rules must be followed:

### 1. Cross-Origin Isolation (`SharedArrayBuffer`)
- The PS1 emulator WebAssembly core (`pcsx_rearmed`) requires `SharedArrayBuffer`.
- GitHub Pages static hosting does not support custom server headers.
- **Solution:** We included [`coi-serviceworker.min.js`](coi-serviceworker.min.js) in both `index.html` and `play.html`. It automatically registers a Service Worker that injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, making the emulator run without crashes on GitHub Pages!

### 2. GitHub 100MB File Size Limit
GitHub strictly blocks standard `git push` for any single file over 100 MB (our 4 `.chd` games are ~311MB–459MB each).

Follow either **Method A (Recommended)** or **Method B** below:

---

### ⭐ Method A: Free GitHub Releases (Recommended — Zero Bandwidth Limits)

GitHub Releases allows you to attach files up to **2 GB each** with direct high-speed CDN delivery and CORS support!

#### Step 1: Push the Website Code to GitHub
1. Create a new repository on GitHub (e.g., `nikhs-station-ps1`).
2. In your terminal inside `C:\Users\BEAST-NIKH\.gemini\antigravity-ide\scratch\ps1-arcade`:
   ```bash
   git init
   git add . -x "games/*.chd"   # stages website code without the huge ROMs
   git commit -m "Initial commit of NIKH,S STATION PS1"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

#### Step 2: Enable GitHub Pages
1. Go to your repository **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions** (or select **Deploy from a branch** → `main` / root).

#### Step 3: Create a Release & Upload the 4 Games
1. On your GitHub repository page, click **Releases** → **Draft a new release**.
2. In **Choose a tag**, type `v1.0.0` and click **Create new tag**.
3. Set the release title to `PS1 Games v1.0.0`.
4. In the binary attachment area ("Attach binaries by dropping them here"), drag and drop the 4 `.chd` files from your local `games/` folder:
   - `tekken3.chd`
   - `pacman.chd`
   - `residentevil.chd`
   - `tombraider.chd`
5. Click **Publish release**.

#### Step 4: That's It!
The website automatically detects GitHub Pages (`username.github.io/repo/`) and resolves all 4 game files directly from your release download links (`v1.0.0`)!

*(Optional: You can also specify your username and repository in `js/config.js` if you prefer explicit configuration).*

---

### Method B: Git LFS (Large File Storage)

If you have Git LFS installed on your system:
```bash
git lfs install
git add .
git commit -m "Add PS1 station with Git LFS games"
git push origin main
```
Our `.github/workflows/deploy.yml` workflow is pre-configured with `lfs: true` to automatically fetch and deploy LFS files directly to GitHub Pages.

---

## 📱 Features & Controls
- **Android Touch Gamepad:** 8-way directional pad with diagonal touch gliding, PlayStation buttons (`△`, `○`, `✕`, `□`), shoulder bumpers (`L1`, `R1`, `L2`, `R2`), `SELECT`, `START`, and tactile vibration feedback.
- **Physical Gamepad:** Plug in any USB/Bluetooth PS4, PS5, Xbox, or generic controller. Automatically detected.
- **Keyboard Controls:**
  - D-Pad: Arrow Keys
  - △ (Triangle): `I`
  - ○ (Circle): `L`
  - ✕ (Cross): `K`
  - □ (Square): `J`
  - L1 / R1: `Q` / `E`
  - L2 / R2: `1` / `3`
  - Select: `Shift`
  - Start: `Enter`
- **Ambient Lofi Radio:** In-browser mellow chord synthesizer powered by the Web Audio API.
- **CRT Scanlines:** Toggle nostalgic retro CRT scanline overlay anytime.
