# Cricket 07 in the browser — web build

Live site: **https://saadharis.github.io/cricket07-web/**

EA Sports Cricket 07 (2006) running in a browser tab via WebAssembly + WebGPU, with the
graphics and quality-of-life enhancements from the Cricket 07 desktop wrapper.

## You must bring your own copy of the game

This site ships the **engine only** (~31 MB, MIT-licensed recompiled code). It contains **no
EA game files**. On first run the page asks you to pick the folder of your own Cricket 07
installation and copies it into the browser's private storage (OPFS).

Your folder must contain:
- `Data/data.gob`
- the unprotected executable — `Cricket07.cracked.exe` or `Crack/cricket07.exe`

`Cricket 07` and `EA Sports` are trademarks of Electronic Arts. EA is not involved with this
project and does not authorize redistribution of the game files, which is why they are not
hosted here.

## Requirements

- A current **Chrome, Edge or Safari** (needs **WebGPU**). Firefox WebGPU support is newer and
  less tested for this build.
- A desktop/laptop GPU. This is a 2006 game recompiled from x86 — it is not light.
- HTTPS (required for the cross-origin-isolation service worker).

## What this build adds over the plain port

| Feature | Source |
|---|---|
| Widescreen / no black bars, FXAA, MSAA, anisotropic filtering, mip sharpening, vivid colour, HD upscale | `enhance.js` (from the desktop wrapper) |
| 394 real player names patched into `Data/data.gob` | `names-web.js` (ported from `names.js`) |
| Skip the EA intro | wrapper behaviour |
| COOP/COEP headers on GitHub Pages | `coi-serviceworker` (the engine uses pthreads, which need cross-origin isolation) |

Settings are controlled by URL query parameters, exactly as the desktop app passes them:

```
?fxaa=0   ?aniso=0   ?mips=0   ?sharpen=0   ?vivid=1   ?wide=1   ?msaa=1   ?upscale=1   ?mute
```

Example — widescreen, vivid colours, HD upscale:
`https://saadharis.github.io/cricket07-web/?wide=1&vivid=1&upscale=1`

## Controls

Game controller, or keyboard: arrow keys to move, **S** to select, mouse for the cursor.

## How it was built

`python src/build_web.py` regenerates `index.html`, `c07.js` and `names-web.js` from the
pristine sources in `src/engine/` and `src/wrapper/`. `BUILD-PROOF.md` records the sha256 of
the deployed `index.html` and `cricket07.wasm` so a clone can confirm it reproduces the
deployed site byte-for-byte.

## Credits and licensing

- Game engine: [Dhaiwat10/cricket07-browser](https://github.com/Dhaiwat10/cricket07-browser) — MIT.
  31,547 functions statically recompiled from x86 to C to WebAssembly; Direct3D 8 rebuilt on WebGPU.
- Enhancement layer: [udeshvirk/cricket07-mac](https://github.com/udeshvirk/cricket07-mac) — MIT.
- Cross-origin isolation shim: [coi-serviceworker](https://www.npmjs.com/package/coi-serviceworker) 0.1.7 — see `COI-LICENSE.txt`.
- This assembly: Lami for Saadi, October 2026.
