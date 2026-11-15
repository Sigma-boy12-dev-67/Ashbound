/* ============================================================================
   Stages 4-9: the deeper descent, ending in HELL.
   Appends to AB.BIOMES (index = stage), AB.PALS (enemy colours per stage) and adds music tracks.
   Load order: after enemies.js (PALS) and audio.js; the bosses for these stages live in js/bosses2.js.
   ========================================================================== */
(function () {
'use strict';
var AB = window.AB;

AB.BIOMES.push(
  { id: 'mire', name: 'The Drowned Mire', sub: 'Where the swamp swallows the unwary', music: 'mire', boss: 'bogmother',
    len: 340, arenas: 3, hpMul: 3.0, dmgMul: 1.9, style: 'mire', mossy: true, pitCol: '#7aff4a',
    bg1: '#08140c', bg2: '#14301c', tile: '#3a4a34', tile2: '#243020', top: '#5a7a3a', moss: '#6a9a3a',
    accent: '#8aff5a', fog: '#2a5a30', torch: '#b8ff6a', ash: '#c8e8a0', ambient: 0.34,
    pool: { husk: 4, archer: 2, bat: 3, brute: 2, hexer: 2 } },
  { id: 'ossuary', name: 'The Bone Cathedral', sub: 'A choir of the faithless sings on', music: 'ossuary', boss: 'archbishop',
    len: 350, arenas: 3, hpMul: 3.7, dmgMul: 2.15, style: 'ossuary', arenaW: 50,
    bg1: '#12100e', bg2: '#2e2820', tile: '#6a6256', tile2: '#3e382e', top: '#a89a7e', moss: '#8a7a50',
    accent: '#ffd88a', fog: '#5a4a30', torch: '#ffe0a0', ash: '#e8dcc0', ambient: 0.3,
    pool: { husk: 3, archer: 4, hexer: 3, brute: 2, bomber: 1 } },
  { id: 'crystal', name: 'The Crystal Depths', sub: 'The gems sing a hungry song', music: 'crystal', boss: 'colossus',
    len: 350, arenas: 3, hpMul: 4.4, dmgMul: 2.4, style: 'crystal', frost: true, arenaW: 52,
    bg1: '#100a24', bg2: '#2a1a52', tile: '#5a4a8a', tile2: '#34285a', top: '#9a82e0', moss: '#c08aff',
    accent: '#d08aff', fog: '#5a3a9a', torch: '#e0a8ff', ash: '#e8d0ff', ambient: 0.3,
    pool: { bat: 3, bomber: 3, hexer: 4, brute: 3, husk: 1, archer: 2 } },
  { id: 'storm', name: 'The Thunder Bastion', sub: 'Where lightning keeps its throne', music: 'storm', boss: 'stormlord',
    len: 360, arenas: 3, hpMul: 5.2, dmgMul: 2.7, style: 'storm', frost: true, arenaW: 54,
    bg1: '#0a1020', bg2: '#1e3050', tile: '#566a86', tile2: '#2e3c52', top: '#9ab4d8', moss: '#ffe85a',
    accent: '#ffe85a', fog: '#3a5080', torch: '#fff08a', ash: '#d8e8ff', ambient: 0.3,
    pool: { archer: 4, hexer: 3, bomber: 3, bat: 3, brute: 3, husk: 1 } },
  { id: 'void', name: 'The Abyssal Void', sub: 'The edge of everything, and it is watching', music: 'void', boss: 'voidwatcher',
    len: 370, arenas: 3, hpMul: 6.0, dmgMul: 3.0, style: 'void', frost: true, pitCol: '#a04aff', arenaW: 56,
    bg1: '#04020c', bg2: '#14082e', tile: '#3a2a5a', tile2: '#1e1236', top: '#6a4aa8', moss: '#ff5aff',
    accent: '#ff5aff', fog: '#3a1a6a', torch: '#ff8aff', ash: '#c8a0ff', ambient: 0.22,
    pool: { bat: 4, hexer: 4, bomber: 3, brute: 2, archer: 3, husk: 1 } },
  { id: 'hell', name: 'HELL', sub: 'Abandon all hope, ye who enter here', music: 'hell', bossMusic: 'hellboss', boss: 'hellsovereign',
    len: 400, arenas: 4, hpMul: 7.0, dmgMul: 3.4, style: 'hell', glowLayers: true, cracks: true, pitLava: true, pitCol: '#ff3a10', arenaW: 70, arenaH: 25,
    bg1: '#1a0204', bg2: '#4a0a08', tile: '#5a2420', tile2: '#2e100e', top: '#a8442a', moss: '#ff4a1a',
    accent: '#ff3a1a', fog: '#8a1608', torch: '#ff6a2a', ash: '#ff7a3a', ambient: 0.26,
    pool: { brute: 4, bomber: 4, hexer: 3, archer: 3, bat: 3, husk: 2 } }
);

AB.PALS.push(
  { skin: '#7a9a4a', cloth: '#3a5a2a', dark: '#101a0c', glow: '#b8ff4a', bone: '#c8d0a0', blood: '#5a9a2a' },
  { skin: '#d8cfb0', cloth: '#4a3a2a', dark: '#1a1410', glow: '#ffe08a', bone: '#f0e8d0', blood: '#c8b890' },
  { skin: '#a08ac8', cloth: '#3a2a6a', dark: '#140e28', glow: '#e08aff', bone: '#dccaf0', blood: '#c070ff' },
  { skin: '#b0a888', cloth: '#3a4a6a', dark: '#101624', glow: '#ffe85a', bone: '#e0e8f4', blood: '#ffe070' },
  { skin: '#5a4a7a', cloth: '#2a1a4a', dark: '#0a0618', glow: '#ff5aff', bone: '#b8a0d8', blood: '#ff5aff' },
  { skin: '#a83a2a', cloth: '#5a1410', dark: '#1a0606', glow: '#ff4a2a', bone: '#d8b8a0', blood: '#ff3a10' }
);

AB.addTrack('mire',      { bpm: 88,  root: 41, scale: [0, 2, 3, 5, 7, 8, 10],  prog: [0, 3, 0, 6] });
AB.addTrack('ossuary',   { bpm: 92,  root: 43, scale: [0, 2, 3, 5, 7, 8, 11],  prog: [0, 5, 3, 4] });
AB.addTrack('crystal',   { bpm: 104, root: 46, scale: [0, 2, 3, 7, 8, 10, 12], prog: [0, 2, 5, 3] });
AB.addTrack('storm',     { bpm: 118, root: 40, scale: [0, 2, 3, 5, 7, 8, 10],  prog: [0, 6, 3, 5] });
AB.addTrack('void',      { bpm: 84,  root: 38, scale: [0, 1, 3, 6, 7, 8, 11],  prog: [0, 1, 0, 4] });
AB.addTrack('hell',      { bpm: 126, root: 36, scale: [0, 1, 4, 5, 7, 8, 10],  prog: [0, 1, 5, 1] });
AB.addTrack('hellboss',  { bpm: 158, root: 35, scale: [0, 1, 3, 5, 6, 8, 9],   prog: [0, 1, 0, 6] });
})();
