# Astro Miner

Astro Miner is a polished offline HTML/CSS/JS PWA game you can upload directly to GitHub Pages.

## Files

- `index.html` — app structure
- `style.css` — full responsive UI
- `script.js` — game logic, upgrades, saves, mobile controls
- `manifest.json` — installable PWA manifest
- `sw.js` — service worker for offline caching
- `icon-512.png` — 512×512 app icon

## How to upload to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder into the repository root.
3. Go to Settings → Pages.
4. Set source to `Deploy from a branch`.
5. Choose `main` branch and `/root`.
6. Open the GitHub Pages URL.
7. After the first visit, the game should work offline because of `sw.js`.

## Controls

- PC: WASD / arrows to move, Space to boost, P or Escape to pause.
- Mobile: drag the joystick, hold BOOST.
