'use strict';
/* DARK STARS — المنطق النقي: فيزياء، توليد، اقتصاد، حفظ، شروط فتح.
   لا يعتمد على DOM أو Canvas — يُختبر عبر node مباشرة. */

/* eslint-disable no-unused-vars */
const DATA = (typeof require !== 'undefined')
  ? require('./data.js')
  : { PLANETS: PLANETS, UPGRADES: UPGRADES, ACHIEVEMENTS: ACHIEVEMENTS, SAVE_KEY: SAVE_KEY };
const PLANETS = DATA.PLANETS;
const UPGRADES = DATA.UPGRADES;
const ACHIEVEMENTS = DATA.ACHIEVEMENTS;
const SAVE_KEY = DATA.SAVE_KEY;

// ---------- أدوات ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

function getPlanet(id) {
  return PLANETS.find((p) => p.id === id) || null;
}

// ---------- الحفظ ----------

function createNewSave() {
  return {
    version: 1,
    crystals: 0,
    fuel: 50,
    upgrades: { engine: 1, tank: 1, storage: 1, scanner: 0, shield: 0 },
    discoveredPlanets: [],
    artifacts: [],
    codexCreatures: [],
    achievements: [],
    totalCrystals: 0,
    totalLandings: 0,
    totalFlights: 0,
    totalZaps: 0,
    muted: false,
    currentPlanet: 'home',
  };
}

function serializeSave(save) {
  return JSON.stringify(save);
}

function deserializeSave(json) {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return createNewSave();
    const fresh = createNewSave();
    const save = Object.assign(fresh, parsed);
    save.upgrades = Object.assign(fresh.upgrades, parsed.upgrades || {});
    save.discoveredPlanets = Array.isArray(parsed.discoveredPlanets) ? parsed.discoveredPlanets : [];
    save.artifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
    save.codexCreatures = Array.isArray(parsed.codexCreatures) ? parsed.codexCreatures : [];
    save.achievements = Array.isArray(parsed.achievements) ? parsed.achievements : [];
    save.crystals = clamp(Number(save.crystals) || 0, 0, 100000);
    save.fuel = clamp(Number(save.fuel) || 0, 0, 1000);
    return save;
  } catch (e) {
    return createNewSave();
  }
}

// ---------- الاقتصاد والترقيات ----------

function fuelMaxFor(save) {
  const lvl = clamp(save.upgrades.tank || 1, 1, 3);
  return UPGRADES.tank.fuelMax[lvl - 1];
}

function crystalCapFor(save) {
  const lvl = clamp(save.upgrades.storage || 1, 1, 3);
  return UPGRADES.storage.cap[lvl - 1];
}

function upgradeCost(type, currentLevel) {
  const def = UPGRADES[type];
  if (!def) return null;
  const next = currentLevel + 1;
  if (next > def.max) return null;
  return def.costs[next] ?? null;
}

function canBuyUpgrade(save, type) {
  const def = UPGRADES[type];
  if (!def) return { ok: false, reason: 'ترقية غير معروفة' };
  const cur = save.upgrades[type] || 0;
  if (cur >= def.max) return { ok: false, reason: 'وصلت للحد الأقصى' };
  const cost = upgradeCost(type, cur);
  if (cost === null) return { ok: false, reason: 'لا يوجد مستوى تالٍ' };
  if (save.crystals < cost) return { ok: false, reason: 'بلورات غير كافية' };
  return { ok: true, cost: cost, next: cur + 1 };
}

// يخصم الثمن ويرقّي. يرجع {ok, reason?}.
function buyUpgrade(save, type) {
  const check = canBuyUpgrade(save, type);
  if (!check.ok) return check;
  save.crystals -= check.cost;
  save.upgrades[type] = check.next;
  if (type === 'tank') save.fuel = Math.min(save.fuel, fuelMaxFor(save));
  return { ok: true, cost: check.cost, next: check.next };
}

// شراء وقود: amount وحدة وقود مقابل بلورات (سعر FUEL_PRICE).
function fuelBuyCost(amount) {
  return Math.ceil(amount / 10) * 2;
}

function buyFuel(save, amount) {
  const cost = fuelBuyCost(amount);
  if (save.crystals < cost) return { ok: false, reason: 'بلورات غير كافية' };
  const room = fuelMaxFor(save) - save.fuel;
  if (room <= 0) return { ok: false, reason: 'الخزان ممتلئ' };
  const actual = Math.min(amount, room);
  save.crystals -= Math.ceil(actual / 10) * 2;
  save.fuel += actual;
  return { ok: true, fuel: actual, cost: Math.ceil(actual / 10) * 2 };
}

// جمع بلورات مع احترام سعة المخزن. يرجع الكمية المضافة فعلاً.
function addCrystals(save, amount) {
  const room = crystalCapFor(save) - save.crystals;
  const added = Math.max(0, Math.min(amount, room));
  save.crystals += added;
  save.totalCrystals += added;
  return added;
}

// ---------- شروط الفتح ----------

function isPlanetUnlocked(save, planet) {
  if (!planet) return false;
  if (planet.id === 'darkstar') return isDarkStarUnlocked(save);
  return (save.upgrades.engine || 1) >= planet.zone;
}

function isDarkStarUnlocked(save) {
  if ((save.upgrades.engine || 1) < 3) return false;
  if ((save.upgrades.scanner || 0) < 2) return false;
  // جمع القطع الأثرية الثمانية الأولى (كل الكواكب ما عدا النجم المظلم)
  const firstEight = PLANETS.filter((p) => p.id !== 'darkstar').map((p) => p.artifact.id);
  return firstEight.every((id) => save.artifacts.includes(id));
}

function darkStarMissing(save) {
  const missing = [];
  if ((save.upgrades.engine || 1) < 3) missing.push('محرك مستوى 3');
  if ((save.upgrades.scanner || 0) < 2) missing.push('ماسح مستوى 2');
  const firstEight = PLANETS.filter((p) => p.id !== 'darkstar').map((p) => p.artifact.id);
  const got = firstEight.filter((id) => save.artifacts.includes(id)).length;
  if (got < 8) missing.push('جمع القطع الأثرية الثماني الأولى (' + got + '/8)');
  return missing;
}

function fuelNeeded(planet) {
  return Math.ceil(planet.flightDist * 0.04) + 8;
}

function canTravelTo(save, planet) {
  if (!isPlanetUnlocked(save, planet)) return { ok: false, reason: 'الكوكب مقفل — راجع المتطلبات' };
  if (save.fuel < fuelNeeded(planet)) return { ok: false, reason: 'وقود غير كافٍ (تحتاج ' + fuelNeeded(planet) + ')' };
  return { ok: true, fuel: fuelNeeded(planet) };
}

// تلميح الماسح عن سر الكوكب (حسب مستوى الماسح).
function scannerHint(save, planet) {
  const lvl = save.upgrades.scanner || 0;
  if (lvl < 1) return null;
  if (save.artifacts.includes(planet.artifact.id)) return null; // السر اتكشف خلاص
  if (lvl === 1) return 'يوجد سر هنا';
  // مستوى 2: تلميح نصي لمكان الكهف حسب الكوكب
  const hints = {
    ramman: 'تحت أكبر كثيب رملي في الشمال.',
    jaledon: 'داخل الكهف الجليدي شرق البحيرة المتجمدة.',
    ghabon: 'خلف الشجرة العملاقة في قلب الغابة.',
    lahib: 'في كهف خلف شلال الحمم الغربي.',
    ghayum: 'على الجزيرة العائمة الأعلى في السحب.',
    kahfon: 'في أعمق غرفة بالكهف، خلف الصخور المتساقطة.',
    ballor: 'داخل أكبر بلورة في السهل المتلألئ.',
    zilal: 'في الضباب الكثيف قرب الحجر الأسود.',
    darkstar: 'في قلب النجم نفسه — حيث ينبض النور البنفسجي.',
  };
  return hints[planet.id] || 'ابحث في أعمق مكان بالكوكب.';
}

// ---------- فيزياء الطيران ----------

const FLIGHT = {
  thrustAccel: 150,
  fuelBurn: 6,      // وقود/ثانية أثناء الدفع
  drag: 0.12,       // مقاومة
  maxSpeed: 340,
  landSpeed: 95,    // أقصى سرعة للهبوط الآمن
  landRadius: 48,
  shipRadius: 12,
  hitFuelLoss: 15,  // خسارة الوقود عند الاصطدام بكويكب بدون درع
  hitFuelLossShield1: 5,
};

function createFlight(planet, save) {
  const rng = mulberry32(hashString(planet.id + ':flight'));
  const target = { x: planet.flightDist, y: 0 };
  const asteroids = [];
  const count = 6 + planet.zone * 3;
  for (let i = 0; i < count; i++) {
    const t = 0.15 + rng() * 0.75; // موزعة على طول المسار
    asteroids.push({
      x: target.x * t + (rng() - 0.5) * 300,
      y: (rng() - 0.5) * 500,
      vx: (rng() - 0.5) * 20,
      vy: (rng() - 0.5) * 20,
      r: 12 + rng() * 18,
      rot: rng() * Math.PI * 2,
      vr: (rng() - 0.5) * 1.5,
    });
  }
  return {
    planetId: planet.id,
    ship: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: save.fuel },
    target: target,
    asteroids: asteroids,
    time: 0,
    status: 'flying', // flying | landed | returned
    shield: save.upgrades.shield || 0,
  };
}

// input: {thrust:boolean, angle:number} — angle اتجاه الدفع (راديان).
// يرجع أحداث: [{type:'landed'|'bounce'|'hit'|'fuel_out'|'returned', ...}]
function stepFlight(f, input, dt) {
  const events = [];
  if (f.status !== 'flying') return events;
  const s = f.ship;
  f.time += dt;

  if (input.thrust && s.fuel > 0) {
    s.vx += Math.cos(input.angle) * FLIGHT.thrustAccel * dt;
    s.vy += Math.sin(input.angle) * FLIGHT.thrustAccel * dt;
    s.fuel = Math.max(0, s.fuel - FLIGHT.fuelBurn * dt);
    s.angle = input.angle;
  }
  const dragF = Math.max(0, 1 - FLIGHT.drag * dt);
  s.vx *= dragF;
  s.vy *= dragF;
  const speed = Math.hypot(s.vx, s.vy);
  if (speed > FLIGHT.maxSpeed) {
    s.vx = (s.vx / speed) * FLIGHT.maxSpeed;
    s.vy = (s.vy / speed) * FLIGHT.maxSpeed;
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // حد ناعم للمساحة: سحب خفيف نحو المركز لو ابتعدت كثيراً
  const dc = Math.hypot(s.x - f.target.x / 2, s.y);
  if (dc > 1500) {
    s.vx += ((f.target.x / 2) - s.x) / dc * 30 * dt;
    s.vy += (0 - s.y) / dc * 30 * dt;
  }

  // الكويكبات تتحرك وتدور
  for (const a of f.asteroids) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.vr * dt;
  }

  // اصطدام بالكويكبات
  for (let i = f.asteroids.length - 1; i >= 0; i--) {
    const a = f.asteroids[i];
    const d = dist(s.x, s.y, a.x, a.y);
    if (d < a.r + FLIGHT.shipRadius) {
      const loss = f.shield >= 2 ? 0 : (f.shield === 1 ? FLIGHT.hitFuelLossShield1 : FLIGHT.hitFuelLoss);
      s.fuel = Math.max(0, s.fuel - loss);
      // ارتداد بعيداً عن الكويكب
      const nx = (s.x - a.x) / (d || 1), ny = (s.y - a.y) / (d || 1);
      s.vx = nx * 160; s.vy = ny * 160;
      f.asteroids.splice(i, 1);
      events.push({ type: 'hit', loss: loss });
    }
  }

  // الوصول للهدف
  const dt2 = dist(s.x, s.y, f.target.x, f.target.y);
  const curSpeed = Math.hypot(s.vx, s.vy);
  if (dt2 < FLIGHT.landRadius) {
    if (curSpeed <= FLIGHT.landSpeed) {
      f.status = 'landed';
      events.push({ type: 'landed' });
      return events;
    }
    // سرعة عالية: ارتداد
    const nx = (s.x - f.target.x) / (dt2 || 1), ny = (s.y - f.target.y) / (dt2 || 1);
    s.vx = nx * 120; s.vy = ny * 120;
    s.fuel = Math.max(0, s.fuel - 5);
    events.push({ type: 'bounce' });
  }

  // نفاد الوقود قبل الوصول = رجوع تلقائي للوطن
  if (s.fuel <= 0) {
    f.status = 'returned';
    events.push({ type: 'fuel_out' });
  }
  return events;
}

// ---------- سطح الكوكب ----------

const SURFACE = {
  worldW: 1400,
  worldH: 900,
  playerSpeed: 150,
  playerRadius: 14,
  collectRadius: 30,
  creatureRadius: 16,
  zapRadius: 150,
  zapCooldown: 4,
  zapStun: 3,
  stealAmount: 5,
};

function createSurface(planet, save) {
  const rng = mulberry32(hashString(planet.id + ':surface'));
  const W = SURFACE.worldW, H = SURFACE.worldH;
  function spot(minDistFromPad) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 80 + rng() * (W - 160);
      const y = 80 + rng() * (H - 160);
      if (Math.hypot(x - W / 2, y - H / 2) > minDistFromPad) return { x: x, y: y };
    }
    return { x: 120 + rng() * (W - 240), y: 120 + rng() * (H - 240) };
  }
  const crystals = [];
  for (let i = 0; i < 7; i++) {
    const p = spot(150);
    crystals.push({ x: p.x, y: p.y, amount: 8 + Math.floor(rng() * 7), taken: false });
  }
  const fuelNodes = [];
  for (let i = 0; i < 3; i++) {
    const p = spot(150);
    fuelNodes.push({ x: p.x, y: p.y, amount: 15, taken: false });
  }
  const cave = spot(300);
  const rareSpot = spot(250);
  const creatures = [];
  for (let i = 0; i < 3; i++) {
    const p = spot(200);
    creatures.push({
      x: p.x, y: p.y, vx: 0, vy: 0,
      speed: planet.creature.speed,
      stunned: 0, id: planet.creature.id, name: planet.creature.name, color: planet.creature.color,
    });
  }
  return {
    planetId: planet.id,
    player: { x: W / 2, y: H / 2 + 200, vx: 0, vy: 0 },
    crystals: crystals,
    fuelNodes: fuelNodes,
    cave: { x: cave.x, y: cave.y, found: save.artifacts.includes(planet.artifact.id) },
    rare: { x: rareSpot.x, y: rareSpot.y, found: save.codexCreatures.includes(planet.rare.id), id: planet.rare.id, name: planet.rare.name, color: planet.rare.color, fled: false },
    creatures: creatures,
    invuln: 0,
    zapCooldown: 0,
    time: 0,
  };
}

// input: {mx,my} اتجاه الحركة (-1..1)، {interact, zap} أزرار.
// يرجع أحداثاً: collect / fuel / hit / zap / artifact / rare
function stepSurface(s, planet, save, input, dt) {
  const events = [];
  s.time += dt;
  if (s.invuln > 0) s.invuln -= dt;
  if (s.zapCooldown > 0) s.zapCooldown -= dt;

  // حركة اللاعب
  const len = Math.hypot(input.mx, input.my);
  let nx = 0, ny = 0;
  if (len > 0.01) { nx = input.mx / len; ny = input.my / len; }
  s.player.x = clamp(s.player.x + nx * SURFACE.playerSpeed * dt, 20, SURFACE.worldW - 20);
  s.player.y = clamp(s.player.y + ny * SURFACE.playerSpeed * dt, 20, SURFACE.worldH - 20);

  // الصعق
  if (input.zap && s.zapCooldown <= 0) {
    s.zapCooldown = SURFACE.zapCooldown;
    let zapped = 0;
    for (const c of s.creatures) {
      if (dist(s.player.x, s.player.y, c.x, c.y) < SURFACE.zapRadius) {
        c.stunned = SURFACE.zapStun;
        zapped++;
      }
    }
    events.push({ type: 'zap', count: zapped });
  }

  // المخلوقات: تطارد اللاعب أو تتجول
  for (const c of s.creatures) {
    if (c.stunned > 0) { c.stunned -= dt; continue; }
    const d = dist(s.player.x, s.player.y, c.x, c.y);
    if (d < 240 && d > 1) {
      c.x += ((s.player.x - c.x) / d) * c.speed * dt;
      c.y += ((s.player.y - c.y) / d) * c.speed * dt;
    } else {
      c.x += Math.sin(s.time * 0.7 + c.y) * 12 * dt;
      c.y += Math.cos(s.time * 0.5 + c.x) * 12 * dt;
    }
    c.x = clamp(c.x, 20, SURFACE.worldW - 20);
    c.y = clamp(c.y, 20, SURFACE.worldH - 20);
    // لمس اللاعب: سرقة بلورات + دفع
    if (d < SURFACE.playerRadius + SURFACE.creatureRadius && s.invuln <= 0) {
      const stolen = Math.min(SURFACE.stealAmount, save.crystals);
      save.crystals -= stolen;
      s.invuln = 1.5;
      const kxn = (s.player.x - c.x) / (d || 1), kyn = (s.player.y - c.y) / (d || 1);
      s.player.x = clamp(s.player.x + kxn * 60, 20, SURFACE.worldW - 20);
      s.player.y = clamp(s.player.y + kyn * 60, 20, SURFACE.worldH - 20);
      events.push({ type: 'hit', stolen: stolen });
    }
  }

  // جمع البلورات (بالمرور فوقها)
  for (const n of s.crystals) {
    if (!n.taken && dist(s.player.x, s.player.y, n.x, n.y) < SURFACE.collectRadius) {
      n.taken = true;
      const added = addCrystals(save, n.amount);
      events.push({ type: 'collect', kind: 'crystal', amount: added, requested: n.amount });
    }
  }
  // جمع الوقود
  for (const n of s.fuelNodes) {
    if (!n.taken && dist(s.player.x, s.player.y, n.x, n.y) < SURFACE.collectRadius) {
      n.taken = true;
      const room = fuelMaxFor(save) - save.fuel;
      const added = Math.max(0, Math.min(n.amount, room));
      save.fuel += added;
      events.push({ type: 'collect', kind: 'fuel', amount: added, requested: n.amount });
    }
  }

  // الكهف السري: ادخل إليه (بالقرب + زر التفاعل، أو بالمرور فوقه)
  if (!s.cave.found && dist(s.player.x, s.player.y, s.cave.x, s.cave.y) < 46) {
    s.cave.found = true;
    save.artifacts.push(planet.artifact.id);
    events.push({ type: 'artifact', id: planet.artifact.id, name: planet.artifact.name });
  }

  // المخلوق النادر: الاقتراب منه يسجله في الموسوعة ويعطي مكافأة
  if (!s.rare.found && !s.rare.fled && dist(s.player.x, s.player.y, s.rare.x, s.rare.y) < 90) {
    s.rare.found = true;
    s.rare.fled = true;
    save.codexCreatures.push(planet.rare.id);
    const bonus = addCrystals(save, 20);
    events.push({ type: 'rare', id: planet.rare.id, name: planet.rare.name, bonus: bonus });
  }

  // تسجيل المخلوق العادي في الموسوعة عند أول اقتراب
  if (!save.codexCreatures.includes(planet.creature.id)) {
    for (const c of s.creatures) {
      if (dist(s.player.x, s.player.y, c.x, c.y) < 160) {
        save.codexCreatures.push(planet.creature.id);
        events.push({ type: 'creature_seen', id: planet.creature.id, name: planet.creature.name });
        break;
      }
    }
  }

  return events;
}

// ---------- الإنجازات ----------

function checkAchievements(save) {
  const unlocked = [];
  const has = (id) => save.achievements.includes(id);
  function grant(id) {
    if (!has(id)) { save.achievements.push(id); unlocked.push(id); }
  }
  if (save.totalLandings >= 1) grant('first_landing');
  if (save.discoveredPlanets.length >= 3) grant('explorer_3');
  if (save.discoveredPlanets.length >= 9) grant('explorer_all');
  if (save.artifacts.length >= 5) grant('artifacts_5');
  if (save.artifacts.length >= 9) grant('artifacts_all');
  if (save.totalCrystals >= 1000) grant('crystals_1000');
  if (save.crystals >= 500) grant('rich_500');
  if (save.totalZaps >= 10) grant('zapper_10');
  if (save.discoveredPlanets.includes('darkstar')) grant('dark_star');
  if (save.totalFlights >= 10) grant('traveler_10');
  return unlocked;
}

var DS_LOGIC = {
  mulberry32, hashString, clamp, dist, getPlanet,
  createNewSave, serializeSave, deserializeSave,
  fuelMaxFor, crystalCapFor, upgradeCost, canBuyUpgrade, buyUpgrade,
  fuelBuyCost, buyFuel, addCrystals,
  isPlanetUnlocked, isDarkStarUnlocked, darkStarMissing,
  fuelNeeded, canTravelTo, scannerHint,
  FLIGHT, createFlight, stepFlight,
  SURFACE, createSurface, stepSurface,
  checkAchievements,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_LOGIC;
}
