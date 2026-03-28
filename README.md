# Super Mario Clone (Production-Ready Vanilla JS)

A polished browser-based Mario-style platformer built with HTML5 Canvas and modern JavaScript.

## Features

- Side-scrolling physics platformer with smooth camera follow.
- Responsive keyboard controls and optional touch controls.
- Enemies (Goomba + Koopa behavior), stomp defeat logic, player damage/invulnerability windows.
- Multiple collectible systems:
  - Coins (with extra life rewards)
  - Question blocks (coin and power-up variants)
  - Free-roaming power-ups (Mushroom + Fire Flower)
- Power states:
  - Small Mario
  - Big Mario
  - Fire Mario with projectile attack
- Fireball combat with bouncing physics and enemy collision handling.
- Dynamic scoring, timer, lives, and persistent high score (via `localStorage`).
- Win/lose states, pause/resume, level restart, and stateful HUD.
- Particle FX toggle and generated chiptune-like audio/SFX with mute/music toggles.
- Production-ready structure with clean separation between UI, game state, entities, systems, and rendering.

## Run locally

Because this is an ES module app, run through a local web server:

```bash
python3 -m http.server 5173
```

Then open:

- `http://localhost:5173`

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the site automatically.

### One-time GitHub setup

1. Push this repository to GitHub.
2. Ensure your default branch is `main` (or update the workflow trigger branch).
3. In GitHub: **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
4. Commit and push any change to `main` to trigger deployment.

### Live URL format

After the workflow succeeds, your site will be served at:

- `https://<your-username>.github.io/<your-repo-name>/`

## Controls

- Move: `A / D` or `← / →`
- Jump: `Space / W / ↑`
- Run / Fireball: `Shift`
- Pause: `P`
- Mute toggle: `M`
- Restart level: `R`
- Start / new run: `Enter`

## Project structure

- `index.html`: HUD, canvas mount, settings panel, and touch controls.
- `styles.css`: responsive layout and visual theme.
- `src/main.js`: game engine, entities, level generation, input, update loop, and rendering.
- `.github/workflows/deploy-pages.yml`: CI workflow for GitHub Pages deployment.

## Notes

- Game state is deterministic enough for expansion into handcrafted multi-level worlds.
- Easy extensions: sprite sheets, tile maps, boss AI, progressive worlds, and save slots.
