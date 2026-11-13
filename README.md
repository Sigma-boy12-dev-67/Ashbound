# ASHBOUND

A fast, brutal roguelite action-platformer. Descend through three biomes, build a loadout from procedurally
generated loot, die, spend your embers at the Forge, and go again. Everything (code, pixel art, music, sound)
is original and generated at runtime — no external assets, fonts or libraries.

## Run it
```
python3 -m http.server 8123      # or: npm run serve
# open http://localhost:8123
```
It is plain HTML5 / JavaScript: no build step, no dependencies. Open `index.html` through any static web server.

## Controls
| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | A / D or arrows | Left stick / D-pad | Left stick |
| Jump (twice in the air) | Space / W | A | JUMP |
| Roll (invulnerable) | Shift | B | ROLL |
| Primary weapon | J | X | ATK |
| Secondary weapon | K | Y | ALT |
| Skills | U / I | RB / RT | S1 / S2 |
| Drink flask | H | LT | FLASK |
| Interact | E | LB | USE |
| Drop through platform | Down + Jump | | |
| Pause | Esc | Start | II |

## Game content
- 3 biomes (Sunken Crypt, Cinder Foundry, Frostspire) with procedurally generated levels, arena ambushes,
  altars, merchants, smiths, wells, chests, secret loot.
- 8 weapons (blade, daggers, axe, spear, hammer, bow, lightning bolt, shield with parry), 6 skills,
  21 boons, 5 weapon tiers, 7 random weapon affixes.
- 6 enemy types with elite variants, 3 multi-phase bosses.
- Meta progression: the Forge (8 permanent upgrades, weapon/skill unlocks), ascension difficulty after victory.
- Keyboard, gamepad and touch controls; synthesized music and sound; offline PWA; saves to local storage.

## Project layout
```
index.html  manifest.webmanifest  sw.js     PWA shell (offline cache; bump VERSION in sw.js on every release)
css/style.css                                touch overlay + layout
js/util save input audio gfx                 foundation (RNG, storage, input, synth audio, pixel font/icons)
js/data                                      weapons, skills, boons, forge upgrades, biomes
js/level render                              procedural level generator, tile + parallax rendering
js/entities playerdraw                       player physics/combat, player sprite
js/enemies bosses                            enemy AI + draw, boss fights
js/world worlddraw                           simulation, loot, interactables, camera, effects
js/hud modals ui game main                   HUD, altar/shop/smith dialogs, menus/scenes, game flow, boot
icons/  store/                               app icons, store screenshots and feature graphic
tools/                                       icon generator, www builder, test scripts (see below)
docs/PUBLISHING.md                           step-by-step Play Store + Microsoft Store guide
```

## Dev tools (need `playwright` + a local server on :8123)
`tools/smoke.js` menus and basic play · `tools/deep.js` every scene, all bosses, victory and death ·
`tools/soak.js` long fast-forward bot run · `tools/levels.js` generator stats over 900 levels ·
`tools/store-shots.js` regenerate store screenshots · `tools/make-icons.js` regenerate icons.

## Store builds
See `docs/PUBLISHING.md`. Short version: Android via Capacitor (`npm run android:add`), Windows via PWABuilder (MSIX).
