# KALACHAKRA — TEDxDYPDPU Endless Runner

A 1-bit monochrome pixel-art endless runner game built for the **TEDxDYPDPU** event. Attendees scan venue QR codes to immediately play on their mobile or desktop browser without registration or onboarding.

---

## 🌟 Game Highlights

- **Thematic Narrative**: Play as the sacred rolling *Kalachakra* (Wheel of Time).
- **Shifting Eras & Dynasties**: Seamless background transitions across **Past** (ancient temples), **Present** (modern industrial arches), and **Future** (sci-fi spires & energy rings).
- **Day / Night Cycles**: Dynamic sunset dithering and midnight star fields that shift independently based on score.
- **Micro-Engine**:
  - 120Hz fixed-timestep simulation accumulator.
  - Zero external image or audio files (100% procedurally rasterized sprite atlas and synthesized Web Audio).
  - Variable jump height, jump buffering (100ms), and coyote time (60ms).
  - Deterministic PRNG obstacle spawner guaranteeing all jumps are physically clearable.
- **Ultra-lightweight**: ~18KB total gzipped bundle size (loads in <300ms on 3G networks).
- **Live Leaderboard**: Supabase PostgreSQL backend with Edge Function validation and offline queue fallback.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Run Test Suite
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```
The output will be built into the `dist/` directory, ready to deploy to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

---

## 🎮 Controls

| Action | Keyboard | Touch / Mobile |
| :--- | :--- | :--- |
| **Jump** | `Space` / `Arrow Up` | Tap screen |
| **High Jump** | Hold `Space` | Long press screen |
| **Mute / Unmute** | HUD / Audio button | Tap Mute icon |
| **Restart** | `Space` / Click Button | Tap 'Run Again' |

---

## 🗄️ Supabase Setup (Optional)

If enabling the live global leaderboard:

1. Create a Supabase project.
2. Run the migration script in `supabase/migrations/001_init.sql` in the Supabase SQL editor.
3. Deploy the Edge function:
   ```bash
   supabase functions deploy submit-score --no-verify-jwt
   ```
4. Copy `.env.example` to `.env` and set:
   ```env
   VITE_LEADERBOARD_ENABLED=true
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 📱 QR Code Generation for Venue Posters

Generate custom SVG QR codes for venue print assets:
```bash
npx tsx scripts/generate-qr.ts https://your-game-domain.com
```

---

## 🏗️ Architecture

```
src/
├── config.ts              # Single source of truth for physics, speeds, thresholds
├── main.ts                # App boot, sanity checks & error boundary
├── style.css              # 1-bit monochrome CRT styling & layout
├── core/
│   ├── Game.ts            # State machine (READY, PLAYING, DYING, GAME_OVER, PAUSED)
│   ├── Loop.ts            # 120Hz fixed timestep accumulator
│   ├── Viewport.ts        # Integer scaling & DPR handling
│   ├── Input.ts           # Unified keyboard, touch, and pointer events
│   └── Rng.ts             # Mulberry32 seeded PRNG
├── entities/
│   ├── Player.ts          # Kalachakra wheel physics, hitbox, dust
│   ├── Ground.ts          # Scrolling line + era-dependent detail glyphs
│   ├── Obstacle.ts        # Obstacle definitions & object pooling
│   ├── ObstacleSpawner.ts # Spawn logic with clearability guarantees
│   └── Backdrop.ts        # Two-layer parallax silhouettes & sun/moon
├── render/
│   ├── Sprites.ts         # Procedural wheel roll atlas & obstacle generator
│   ├── palette.ts         # Day/night ink & paper color definitions
│   ├── PixelFont.ts       # Zero-dependency 5x7 canvas bitmap font
│   └── Renderer.ts        # Canvas 2D draw coordinator & HUD
├── systems/
│   ├── Audio.ts           # Web Audio procedural synth (jump, hit, milestone, etc.)
│   ├── Score.ts           # Distance to score, high score, milestones
│   ├── Difficulty.ts      # Score-to-speed curve & theoretical bounds
│   ├── Theme.ts           # Era + day/night transition interpolation
│   └── storage.ts         # Safe localStorage wrapper
├── ui/
│   ├── screens.ts         # Screen DOM overlay manager
│   ├── SubmitForm.ts      # Name sanitization & submission form
│   └── Leaderboard.ts     # Live polling leaderboard table
└── net/
    ├── api.ts             # Supabase client with offline queue
    └── runToken.ts        # Anti-cheat run telemetry & validation token
```

---

## 🧪 Testing

13 unit tests covering physics apex calculations, collision accuracy, difficulty curves, and validation signatures:
```bash
npm test
```
