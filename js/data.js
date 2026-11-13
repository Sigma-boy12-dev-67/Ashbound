(function () {
'use strict';
var AB = window.AB;

/* ===================== WEAPONS =====================
   type: melee | ranged | shield. rate = frames per attack. combo = number of chained swings.
   Flags read by the combat code: thrust, cleave, slam, stun, crit, backstab, leech, ignite, freeze, shock, pierce, speed. */
AB.WEAPONS = {
  ashblade:  { name: 'Ashblade', icon: 'sword', color: '#f0c878', type: 'melee', dmg: 14, rate: 22, combo: 3, reach: 30, kb: 1.6, cost: 0,
    desc: 'A balanced blade. The third strike of the combo hits hard.' },
  twinfang:  { name: 'Twin Fangs', icon: 'dagger', color: '#8ff0c8', type: 'melee', dmg: 8, rate: 13, combo: 4, reach: 22, kb: 0.8, crit: 0.15, backstab: 1.6, cost: 150,
    desc: 'Blindingly fast. Critical hits are common, and attacking from behind hurts.' },
  emberaxe:  { name: 'Ember Axe', icon: 'axe', color: '#ff8040', type: 'melee', dmg: 24, rate: 36, combo: 2, reach: 34, kb: 3.2, cleave: true, ignite: 0.3, cost: 120,
    desc: 'A slow, wide arc that often sets enemies ablaze.' },
  duskspear: { name: 'Duskspear', icon: 'spear', color: '#b0a0ff', type: 'melee', dmg: 13, rate: 26, combo: 2, reach: 52, kb: 1.4, thrust: true, cost: 100,
    desc: 'Long thrusts keep enemies at the tip of the blade.' },
  warhammer: { name: 'Warhammer', icon: 'hammer', color: '#c8c0d8', type: 'melee', dmg: 36, rate: 56, combo: 1, reach: 34, kb: 4, slam: true, stun: 50, cost: 260,
    desc: 'Crushing slam that sends a shockwave along the ground and stuns.' },
  hunterbow: { name: 'Hunter Bow', icon: 'bow', color: '#d8b880', type: 'ranged', dmg: 14, rate: 30, speed: 7, kb: 1.5, pierce: 0, cost: 0,
    desc: 'Reliable arrows with a slight arc. Hold up or down to aim.' },
  stormbolt: { name: 'Stormbolt', icon: 'bolt', color: '#7ad8ff', type: 'ranged', dmg: 10, rate: 20, speed: 6.5, kb: 0.8, shock: 0.35, pierce: 1, cost: 200,
    desc: 'Rapid bolts that pierce and arc lightning between foes.' },
  bulwark:   { name: 'Bulwark', icon: 'shield', color: '#9ac8ff', type: 'shield', dmg: 12, rate: 0, kb: 0, cost: 140,
    desc: 'Hold to block. Block right as a blow lands to parry and counter.' }
};
AB.WEAPON_ORDER = ['ashblade', 'twinfang', 'emberaxe', 'duskspear', 'warhammer', 'hunterbow', 'stormbolt', 'bulwark'];
AB.TIER_NAMES = ['Worn', 'Fine', 'Superior', 'Exquisite', 'Mythic'];
AB.TIER_COLORS = ['#b8b8c4', '#6ad86a', '#5ab0ff', '#c070ff', '#ffb040'];

AB.AFFIXES = [
  { id: 'fiery', name: 'Fiery', color: '#ff7a30', desc: '+25% chance to ignite', fx: function (w) { w.ignite = (w.ignite || 0) + 0.25; } },
  { id: 'frosted', name: 'Frosted', color: '#8ae0ff', desc: '+20% chance to freeze', fx: function (w) { w.freeze = (w.freeze || 0) + 0.2; } },
  { id: 'storming', name: 'Storming', color: '#ffe84a', desc: '+20% chance of lightning', fx: function (w) { w.shock = (w.shock || 0) + 0.2; } },
  { id: 'vampiric', name: 'Vampiric', color: '#e03050', desc: 'Heal 2 per hit', fx: function (w) { w.leech = (w.leech || 0) + 2; } },
  { id: 'keen', name: 'Keen', color: '#ffe060', desc: '+12% critical chance', fx: function (w) { w.crit = (w.crit || 0) + 0.12; } },
  { id: 'swift', name: 'Swift', color: '#8fffd0', desc: '18% faster attacks', fx: function (w) { if (w.rate) w.rate = Math.max(6, Math.round(w.rate * 0.82)); else w.dmg = Math.round(w.dmg * 1.1); } },
  { id: 'brutal', name: 'Brutal', color: '#ff5a5a', desc: '+20% damage, more knockback', fx: function (w) { w.dmg = Math.round(w.dmg * 1.2); w.kb = (w.kb || 0) * 1.3; } }
];
AB.affixById = {};
AB.AFFIXES.forEach(function (a) { AB.affixById[a.id] = a; });

// Builds a concrete weapon instance (a copy) at the given tier with an optional affix
AB.makeWeapon = function (id, tier, affixId) {
  var b = AB.WEAPONS[id], w = {}, k;
  for (k in b) w[k] = b[k];
  w.id = id; w.tier = tier || 0; w.baseName = b.name;
  w.dmg = Math.round(b.dmg * (1 + 0.25 * w.tier));
  w.affix = null;
  if (affixId && AB.affixById[affixId]) {
    var a = AB.affixById[affixId]; a.fx(w); w.affix = affixId; w.name = a.name + ' ' + b.name;
  }
  return w;
};
AB.upgradeWeapon = function (w) { return AB.makeWeapon(w.id, Math.min(4, w.tier + 1), w.affix); };

/* ===================== SKILLS ===================== */
AB.SKILLS = {
  firebomb:   { name: 'Firebomb', icon: 'bomb', color: '#ff8a3a', cd: 360, dmg: 34, cost: 0, desc: 'Lob a bomb that explodes in flames.' },
  frostnova:  { name: 'Frost Nova', icon: 'nova', color: '#8ae0ff', cd: 540, dmg: 22, cost: 120, desc: 'Freeze and damage everything around you.' },
  turret:     { name: 'Ember Turret', icon: 'turret', color: '#9aff9a', cd: 720, dmg: 9, cost: 180, desc: 'Deploy a turret that shoots nearby foes.' },
  chainbolt:  { name: 'Chain Bolt', icon: 'chain', color: '#ffe84a', cd: 480, dmg: 30, cost: 200, desc: 'Lightning that leaps between up to five enemies.' },
  warcry:     { name: 'War Cry', icon: 'warcry', color: '#ff5a5a', cd: 900, dmg: 14, cost: 150, desc: 'Stagger nearby foes and gain bonus damage and speed.' },
  shadowstep: { name: 'Shadowstep', icon: 'shadow', color: '#b08aff', cd: 300, dmg: 28, cost: 140, desc: 'Dash forward, slicing everything in your path.' }
};
AB.SKILL_ORDER = ['firebomb', 'frostnova', 'turret', 'chainbolt', 'warcry', 'shadowstep'];

/* ===================== BOONS =====================
   fx(stats, player, run) is called when a boon is taken. rarity 1 common .. 3 legendary */
AB.BOONS = [
  { id: 'searing', name: 'Searing Edge', icon: 'sword', color: '#ff9050', rarity: 1, desc: '+15% damage.', fx: function (s) { s.dmg += 0.15; } },
  { id: 'keen', name: 'Keen Eye', icon: 'star', color: '#ffe060', rarity: 1, desc: '+8% critical chance.', fx: function (s) { s.crit += 0.08; } },
  { id: 'exec', name: 'Executioner', icon: 'skull', color: '#ff4040', rarity: 2, desc: 'Critical hits deal +40% damage.', fx: function (s) { s.critDmg += 0.4; } },
  { id: 'swiftsole', name: 'Swiftsole', icon: 'boot', color: '#80e0ff', rarity: 1, desc: '+10% movement speed.', fx: function (s) { s.spd += 0.1; } },
  { id: 'ironheart', name: 'Iron Heart', icon: 'heart', color: '#ff6070', rarity: 1, desc: '+20 max health and heal 20.', fx: function (s, p) { s.maxHp += 20; if (p) p.hp = Math.min(s.maxHp, p.hp + 20); } },
  { id: 'crimson', name: 'Crimson Thirst', icon: 'drop', color: '#e03050', rarity: 2, desc: 'Heal 2 health for every kill.', fx: function (s) { s.killHeal += 2; } },
  { id: 'quick', name: 'Quick Hands', icon: 'fist', color: '#f0f0a0', rarity: 1, desc: '+12% attack speed.', fx: function (s) { s.atkSpd += 0.12; } },
  { id: 'echo', name: 'Skill Echo', icon: 'warcry', color: '#c090ff', rarity: 2, desc: 'Skills recharge 20% faster.', fx: function (s) { s.cdr += 0.2; } },
  { id: 'thorns', name: 'Thornmail', icon: 'shield', color: '#a0c060', rarity: 2, desc: 'Being hit lashes out at nearby enemies.', fx: function (s) { s.thorns += 1; } },
  { id: 'flask', name: 'Deep Flask', icon: 'flask', color: '#ff8080', rarity: 2, desc: '+1 flask charge, refilled now.', fx: function (s, p, run) { s.flasks += 1; if (run) run.flasks += 1; } },
  { id: 'draught', name: 'Rich Draught', icon: 'flask', color: '#7affb0', rarity: 1, desc: 'Flasks heal 15% more.', fx: function (s) { s.flaskHeal += 0.15; } },
  { id: 'ghost', name: 'Ghostroll', icon: 'shadow', color: '#b0b0ff', rarity: 1, desc: 'Rolling grants longer invulnerability.', fx: function (s) { s.rollI += 6; } },
  { id: 'skyborne', name: 'Skyborne', icon: 'wing', color: '#e0f0ff', rarity: 3, desc: 'Gain an additional mid-air jump.', fx: function (s, p) { s.jumps += 1; if (p) p.jumpsLeft = s.jumps; } },
  { id: 'phoenix', name: 'Phoenix Ash', icon: 'ember', color: '#ff7030', rarity: 3, desc: 'Rise once from death with half health.', fx: function (s) { s.revive += 1; } },
  { id: 'burning', name: 'Burning Touch', icon: 'bomb', color: '#ff6020', rarity: 2, desc: '+15% chance to ignite on hit.', fx: function (s) { s.procBurn += 0.15; } },
  { id: 'frostbite', name: 'Frostbite', icon: 'nova', color: '#8fe0ff', rarity: 2, desc: '+15% chance to freeze on hit.', fx: function (s) { s.procFreeze += 0.15; } },
  { id: 'storm', name: 'Stormcaller', icon: 'chain', color: '#70d0ff', rarity: 2, desc: '+15% chance for hits to arc lightning.', fx: function (s) { s.procShock += 0.15; } },
  { id: 'laststand', name: 'Last Stand', icon: 'skull', color: '#ff3030', rarity: 2, desc: '+60% damage while below 35% health.', fx: function (s) { s.lastStand += 0.6; } },
  { id: 'gilded', name: 'Gilded Palm', icon: 'coin', color: '#ffd040', rarity: 1, desc: '+40% gold from all sources.', fx: function (s) { s.goldMul += 0.4; } },
  { id: 'embertide', name: 'Ember Tide', icon: 'ember', color: '#ff9040', rarity: 1, desc: '+30% embers earned.', fx: function (s) { s.emberMul += 0.3; } },
  { id: 'ironskin', name: 'Ironskin', icon: 'shield', color: '#c0c8d8', rarity: 1, desc: 'Take 10% less damage.', fx: function (s) { s.armor += 0.1; } }
];
AB.boonById = {};
AB.BOONS.forEach(function (b) { AB.boonById[b.id] = b; });
AB.applyBoon = function (run, b, player) {
  b.fx(run.stats, player, run);
  run.boonIds = run.boonIds || {};
  run.boonIds[b.id] = (run.boonIds[b.id] || 0) + 1;
};

/* ===================== FORGE (meta upgrades, paid in embers) ===================== */
AB.FORGE = [
  { id: 'vit', name: 'Vitality', icon: 'heart', color: '#ff6070', max: 6, cost: function (l) { return 30 + l * 35; }, desc: '+12 starting health per level.' },
  { id: 'might', name: 'Might', icon: 'sword', color: '#ff9050', max: 6, cost: function (l) { return 40 + l * 45; }, desc: '+5% damage per level.' },
  { id: 'flask', name: 'Ember Flask', icon: 'flask', color: '#ff8080', max: 3, cost: function (l) { return 60 + l * 90; }, desc: '+1 flask charge per level.' },
  { id: 'fortune', name: 'Fortune', icon: 'coin', color: '#ffd040', max: 5, cost: function (l) { return 25 + l * 30; }, desc: 'Begin each run with +60 gold per level.' },
  { id: 'lore', name: 'Ember Lore', icon: 'ember', color: '#ff9040', max: 5, cost: function (l) { return 50 + l * 60; }, desc: '+10% embers from every run.' },
  { id: 'nimble', name: 'Nimble', icon: 'boot', color: '#80e0ff', max: 3, cost: function (l) { return 70 + l * 80; }, desc: '+4% movement speed per level.' },
  { id: 'temper', name: 'Tempering', icon: 'axe', color: '#ffc070', max: 3, cost: function (l) { return 120 + l * 160; }, desc: 'Starting weapons are one tier higher per level.' },
  { id: 'ash', name: 'Ash Rebirth', icon: 'ember', color: '#ff7030', max: 1, cost: function () { return 600; }, desc: 'Once per run, rise from death with half health.' }
];

/* ===================== BIOMES (index = stage) ===================== */
AB.BIOMES = [
  { id: 'crypt', name: 'The Sunken Crypt', sub: 'Where the drowned dead keep their watch', music: 'crypt', boss: 'gravewarden',
    len: 260, arenas: 2, hpMul: 1, dmgMul: 1,
    bg1: '#0c1620', bg2: '#1a2e40', tile: '#46586a', tile2: '#2c3a48', top: '#5a7a8a', moss: '#3d8a64',
    accent: '#59d6c0', fog: '#2a5a6a', torch: '#6af0d8', ash: '#bcd8e8', ambient: 0.4,
    pool: { husk: 5, archer: 3, bat: 3, brute: 1 } },
  { id: 'foundry', name: 'Cinder Foundry', sub: 'The forges never went cold', music: 'foundry', boss: 'smelter',
    len: 300, arenas: 3, hpMul: 1.6, dmgMul: 1.3,
    bg1: '#1a0a06', bg2: '#3a1a0c', tile: '#6a4a3a', tile2: '#3a261c', top: '#8a6a4a', moss: '#8a3a14',
    accent: '#ff8a30', fog: '#7a2c10', torch: '#ffa040', ash: '#ff9a4a', ambient: 0.32,
    pool: { husk: 2, bomber: 4, archer: 2, brute: 3, bat: 2, hexer: 1 } },
  { id: 'spire', name: 'The Frostspire', sub: 'The last throne above the clouds', music: 'spire', boss: 'sovereign',
    len: 340, arenas: 3, hpMul: 2.3, dmgMul: 1.65,
    bg1: '#0c1830', bg2: '#2a4a78', tile: '#6a88aa', tile2: '#3a5272', top: '#cfe8ff', moss: '#a0d8f0',
    accent: '#a0e8ff', fog: '#5080b0', torch: '#bfe8ff', ash: '#e8f4ff', ambient: 0.28,
    pool: { hexer: 4, bat: 3, brute: 3, archer: 3, bomber: 2, husk: 1 } }
];

AB.ASCENSIONS = [
  'Standard', 'Foes have more health', 'Foes strike harder', 'Foes are more numerous', 'Elites are fiercer', 'Bosses gain new fury'
];
AB.TIPS = [
  'Rolling grants a brief moment of invulnerability.', 'Parry with the Bulwark just as an attack lands.',
  'Hold DOWN and press JUMP to drop through thin platforms.', 'Altars let you shape your build with boons.',
  'Embers carry over between runs. Spend them at the Forge.', 'Elite foes drop more loot.',
  'The merchant sells weapons, skills, boons and flasks.', 'Fire and ice stack with weapon effects.',
  'Ironhides are only vulnerable while they swing.', 'You can carry two weapons and two skills.',
  'Smash urns and crates for gold.', 'Ambushes end with a treasure chest.'
];
})();
