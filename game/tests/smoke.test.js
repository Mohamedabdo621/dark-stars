'use strict';
/* اختبار دخان: تشغيل حلقة اللعبة في node مع stubs للـ Canvas/DOM،
   والتأكد من الانتقالات: عنوان ← خريطة ← طيران ← هبوط ← جمع ← ترقية ← حفظ.
   تشغيل: node tests/smoke.test.js */
const assert = require('node:assert');

// ---------- stub لسياق Canvas ثنائي الأبعاد ----------
function makeCtxStub() {
  const fn = new Proxy(function () {}, {
    get: function (t, prop) {
      if (prop === Symbol.toPrimitive) return undefined;
      return fn;
    },
    set: function () { return true; },
    apply: function () { return fn; },
  });
  return fn;
}

// ---------- stub لعنصر DOM ----------
function makeElStub() {
  const el = {
    style: {},
    dataset: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    textContent: '',
    innerHTML: '',
    disabled: false,
    value: '',
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild: function () {},
    removeChild: function () {},
    remove: function () {},
    setAttribute: function () {},
    getAttribute: function () { return null; },
    querySelector: function () { return makeElStub(); },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 100, height: 100 }; },
    setPointerCapture: function () {},
    getContext: function () { return makeCtxStub(); },
    width: 800,
    height: 600,
  };
  return el;
}

function makeEnv() {
  const store = new Map();
  const els = new Map();
  const doc = {
    getElementById: function (id) {
      if (!els.has(id)) els.set(id, makeElStub());
      return els.get(id);
    },
    createElement: function () { return makeElStub(); },
    addEventListener: function () {},
    body: makeElStub(),
    hidden: false,
  };
  const win = {
    addEventListener: function () {},
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
  };
  return {
    document: doc,
    window: win,
    localStorage: {
      getItem: function (k) { return store.has(k) ? store.get(k) : null; },
      setItem: function (k, v) { store.set(k, String(v)); },
      removeItem: function (k) { store.delete(k); },
    },
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {},
    AudioContext: undefined,
    _store: store,
  };
}

const { createGame } = require('../js/game.js');
const L = require('../js/logic.js');

let frames = 0;
function runFrames(game, n, dt) {
  for (let i = 0; i < n; i++) { game.frame(dt || 1 / 60); frames++; }
}

function autopilot(game) {
  const f = game.flight;
  if (!f) return;
  const dx = f.target.x - f.ship.x, dy = f.target.y - f.ship.y;
  const d = Math.hypot(dx, dy) || 1;
  const desSpeed = Math.min(200, d * 1.5);
  const dvx = (dx / d) * desSpeed - f.ship.vx;
  const dvy = (dy / d) * desSpeed - f.ship.vy;
  const err = Math.hypot(dvx, dvy);
  const st = game.input.state;
  if (err > 25) {
    st.joyActive = true;
    st.joyX = dvx / err; st.joyY = dvy / err;
  } else {
    st.joyActive = false;
  }
}

console.log('— اختبار دخان حلقة اللعبة —');

const env = makeEnv();
const game = createGame(env);
game.start();
assert.strictEqual(game.state, 'title', 'يجب أن تبدأ بشاشة العنوان');
runFrames(game, 120);
console.log('  ✓ العنوان: 120 إطار بدون أخطاء');

// عنوان ← خريطة
game.goTo('map');
assert.strictEqual(game.state, 'map');
runFrames(game, 30);
console.log('  ✓ الخريطة: 30 إطار بدون أخطاء');

// اختيار كوكب والطيران
game.selectPlanet('ramman');
assert.strictEqual(game.selectedPlanetId, 'ramman');
game.save.fuel = 100; // وقود كافٍ للاختبار
game.startFlight();
assert.strictEqual(game.state, 'flight', 'يجب الانتقال للطيران');
assert.ok(game.flight, 'يجب إنشاء حالة طيران');
console.log('  ✓ بدء الطيران إلى رمّال');

// طيران بالطيار الآلي حتى الهبوط
let landed = false;
for (let i = 0; i < 3600; i++) {
  autopilot(game);
  game.frame(1 / 60);
  frames++;
  if (game.state === 'surface') { landed = true; break; }
  if (game.state === 'map') throw new Error('الرحلة فشلت وعادت للخريطة (نفاد وقود؟)');
}
assert.ok(landed, 'لم تهبط السفينة خلال 3600 إطار');
assert.ok(game.save.discoveredPlanets.includes('ramman'), 'الكوكب لم يُسجل كمكتشف');
assert.strictEqual(game.save.totalLandings, 1);
assert.ok(game.save.achievements.includes('first_landing'), 'إنجاز أول هبوط لم يُمنح');
console.log('  ✓ الطيران والهبوط: وصلت وهبطت على رمّال');

// جمع بلورة على السطح
const before = game.save.crystals;
const node = game.surface.crystals.find((n) => !n.taken);
game.surface.player.x = node.x;
game.surface.player.y = node.y;
runFrames(game, 6, 0.1);
assert.ok(game.save.crystals > before, 'لم تُجمع البلورة');
console.log('  ✓ الجمع على السطح: +' + (game.save.crystals - before) + ' بلورة');

// اكتشاف القطعة الأثرية في الكهف
game.surface.player.x = game.surface.cave.x;
game.surface.player.y = game.surface.cave.y;
runFrames(game, 6, 0.1);
assert.ok(game.save.artifacts.includes('heart_sand'), 'القطعة الأثرية لم تُكتشف');
console.log('  ✓ اكتشاف القطعة الأثرية: قلب الرمال');

// العودة للسفينة ← الخريطة
game.returnToShip();
assert.strictEqual(game.state, 'map');
runFrames(game, 10);
console.log('  ✓ العودة للخريطة');

// ترقية + شراء وقود
game.save.crystals = 500;
const up = game.buyUpgrade('scanner');
assert.ok(up.ok, 'فشل شراء الماسح: ' + (up.reason || ''));
assert.strictEqual(game.save.upgrades.scanner, 1);
const fb = game.buyFuel(10);
assert.ok(fb.ok, 'فشل شراء الوقود');
console.log('  ✓ ترقية الماسح للمستوى 1 + شراء وقود');

// حفظ وتحميل في نسخة جديدة
game.saveGame();
assert.ok(env._store.size > 0, 'لم يُحفظ شيء في التخزين');
const game2 = createGame(env);
game2.loadGame();
assert.strictEqual(game2.save.crystals, game.save.crystals, 'البلورات لم تنتقل بعد التحميل');
assert.strictEqual(game2.save.upgrades.scanner, 1, 'الماسح لم ينتقل بعد التحميل');
assert.ok(game2.save.artifacts.includes('heart_sand'), 'القطعة الأثرية لم تنتقل بعد التحميل');
console.log('  ✓ حفظ/تحميل round-trip عبر نسخة لعبة جديدة');

// زيارة باقي الشاشات
for (const s of ['upgrades', 'codex', 'achievements', 'settings', 'howto']) {
  game.goTo(s, 'map');
  assert.strictEqual(game.state, s);
  runFrames(game, 5);
}
game.goTo('map');
console.log('  ✓ كل الشاشات (ترقيات/موسوعة/إنجازات/إعدادات/كيفية اللعب) تعمل');

// شروط النجم المظلم عبر اللعبة الحية
game.save.upgrades.engine = 3;
game.save.upgrades.scanner = 2;
assert.ok(!L.isDarkStarUnlocked(game.save), 'يجب أن يبقى النجم المظلم مقفلاً بدون القطع');
for (const p of require('../js/data.js').PLANETS) {
  if (p.id !== 'darkstar' && !game.save.artifacts.includes(p.artifact.id)) {
    game.save.artifacts.push(p.artifact.id);
  }
}
assert.ok(L.isDarkStarUnlocked(game.save), 'يجب فتح النجم المظلم بعد جمع القطع الثماني');
console.log('  ✓ شروط فتح النجم المظلم تعمل في اللعبة الحية');

console.log('\nاختبار الدخان ناجح — ' + frames + ' إطار بدون أخطاء.');
