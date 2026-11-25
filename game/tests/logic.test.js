'use strict';
/* اختبارات المنطق النقي — تشغيل: node tests/logic.test.js */
const assert = require('node:assert');
const L = require('../js/logic.js');
const D = require('../js/data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('— فيزياء الطيران —');
test('الدفع يسرّع السفينة ويستهلك وقوداً', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  const fuel0 = f.ship.fuel;
  const ev = L.stepFlight(f, { thrust: true, angle: 0 }, 1);
  assert.ok(f.ship.vx > 50, 'التسارع ضعيف: ' + f.ship.vx);
  assert.ok(f.ship.fuel < fuel0, 'الوقود لم ينقص');
  assert.deepStrictEqual(ev, []);
});
test('السفينة تتباطأ بالقصور (drag) بدون دفع', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  L.stepFlight(f, { thrust: true, angle: 0 }, 1);
  const v1 = Math.hypot(f.ship.vx, f.ship.vy);
  L.stepFlight(f, { thrust: false, angle: 0 }, 1);
  const v2 = Math.hypot(f.ship.vx, f.ship.vy);
  assert.ok(v2 < v1, 'لا يوجد تباطؤ');
});
test('الهبوط ينجح بسرعة منخفضة قرب الهدف', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  f.ship.x = f.target.x - 20; f.ship.y = 0; f.ship.vx = 10; f.ship.vy = 0;
  const ev = L.stepFlight(f, { thrust: false, angle: 0 }, 0.1);
  assert.strictEqual(f.status, 'landed');
  assert.ok(ev.some((e) => e.type === 'landed'));
});
test('السرعة العالية عند الهدف تسبب ارتداداً لا هبوطاً', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  f.ship.x = f.target.x - 20; f.ship.y = 0; f.ship.vx = 300; f.ship.vy = 0;
  const ev = L.stepFlight(f, { thrust: false, angle: 0 }, 0.1);
  assert.strictEqual(f.status, 'flying');
  assert.ok(ev.some((e) => e.type === 'bounce'));
});
test('نفاد الوقود يعيد السفينة تلقائياً', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  f.ship.fuel = 1;
  const ev = L.stepFlight(f, { thrust: true, angle: 0 }, 1);
  assert.strictEqual(f.status, 'returned');
  assert.ok(ev.some((e) => e.type === 'fuel_out'));
});
test('الاصطدام بكويكب يخسر وقوداً حسب الدرع', () => {
  const save = L.createNewSave();
  const f = L.createFlight(D.PLANETS[0], save);
  f.asteroids = [{ x: 5, y: 0, vx: 0, vy: 0, r: 15, rot: 0, vr: 0 }];
  const fuel0 = f.ship.fuel;
  const ev = L.stepFlight(f, { thrust: false, angle: 0 }, 0.1);
  assert.ok(ev.some((e) => e.type === 'hit'));
  assert.strictEqual(fuel0 - f.ship.fuel, L.FLIGHT.hitFuelLoss);
  // مع درع مستوى 2: لا خسارة
  const save2 = L.createNewSave(); save2.upgrades.shield = 2;
  const f2 = L.createFlight(D.PLANETS[0], save2);
  f2.asteroids = [{ x: 5, y: 0, vx: 0, vy: 0, r: 15, rot: 0, vr: 0 }];
  const fuel2 = f2.ship.fuel;
  L.stepFlight(f2, { thrust: false, angle: 0 }, 0.1);
  assert.strictEqual(f2.ship.fuel, fuel2);
});

console.log('— توليد الكواكب —');
test('9 كواكب في 3 مناطق، وكل كوكب له قطعة أثرية ومخلوق نادر', () => {
  assert.strictEqual(D.PLANETS.length, 9);
  for (const p of D.PLANETS) {
    assert.ok(p.artifact && p.artifact.id && p.artifact.name && p.artifact.story, p.id);
    assert.ok(p.rare && p.rare.id && p.rare.name, p.id);
    assert.ok(p.creature && p.creature.id, p.id);
    assert.ok([1, 2, 3].includes(p.zone), p.id);
  }
  assert.strictEqual(D.PLANETS.filter((p) => p.zone === 1).length, 3);
  assert.strictEqual(D.PLANETS.filter((p) => p.zone === 2).length, 3);
  assert.strictEqual(D.PLANETS.filter((p) => p.zone === 3).length, 3);
});
test('توليد السطح حتمي: نفس الكوكب يعطي نفس التخطيط', () => {
  const save = L.createNewSave();
  const a = L.createSurface(D.PLANETS[3], save);
  const b = L.createSurface(D.PLANETS[3], save);
  assert.deepStrictEqual(a.crystals, b.crystals);
  assert.deepStrictEqual(a.cave, b.cave);
  assert.strictEqual(a.crystals.length, 7);
  assert.strictEqual(a.fuelNodes.length, 3);
  assert.strictEqual(a.creatures.length, 3);
});
test('المشي فوق بلورة يجمعها', () => {
  const save = L.createNewSave();
  const planet = D.PLANETS[0];
  const s = L.createSurface(planet, save);
  const node = s.crystals[0];
  s.player.x = node.x; s.player.y = node.y;
  const ev = L.stepSurface(s, planet, save, { mx: 0, my: 0, interact: false, zap: false }, 0.1);
  assert.ok(ev.some((e) => e.type === 'collect' && e.kind === 'crystal'));
  assert.ok(save.crystals > 0);
});
test('دخول الكهف يكشف القطعة الأثرية', () => {
  const save = L.createNewSave();
  const planet = D.PLANETS[0];
  const s = L.createSurface(planet, save);
  s.player.x = s.cave.x; s.player.y = s.cave.y;
  const ev = L.stepSurface(s, planet, save, { mx: 0, my: 0, interact: true, zap: false }, 0.1);
  assert.ok(ev.some((e) => e.type === 'artifact' && e.id === planet.artifact.id));
  assert.ok(save.artifacts.includes(planet.artifact.id));
});
test('المخلوق يطارد اللاعب ويسرق بلورات عند اللمس', () => {
  const save = L.createNewSave();
  save.crystals = 20;
  const planet = D.PLANETS[0];
  const s = L.createSurface(planet, save);
  const c = s.creatures[0];
  c.x = s.player.x + 100; c.y = s.player.y;
  let hit = false;
  for (let i = 0; i < 200 && !hit; i++) {
    const ev = L.stepSurface(s, planet, save, { mx: 0, my: 0, interact: false, zap: false }, 0.1);
    if (ev.some((e) => e.type === 'hit')) hit = true;
  }
  assert.ok(hit, 'المخلوق لم يصل للاعب');
  assert.strictEqual(save.crystals, 15);
});
test('الصعق يشل المخلوقات القريبة', () => {
  const save = L.createNewSave();
  const planet = D.PLANETS[0];
  const s = L.createSurface(planet, save);
  const c = s.creatures[0];
  c.x = s.player.x + 50; c.y = s.player.y;
  const ev = L.stepSurface(s, planet, save, { mx: 0, my: 0, interact: false, zap: true }, 0.1);
  assert.ok(ev.some((e) => e.type === 'zap' && e.count >= 1));
  assert.ok(c.stunned > 0);
});

console.log('— الاقتصاد والترقيات —');
test('أسعار الترقيات تتصاعد، والشراء يخصم ويرقّي', () => {
  const save = L.createNewSave();
  save.crystals = 500;
  assert.strictEqual(L.upgradeCost('engine', 1), 100);
  assert.strictEqual(L.upgradeCost('engine', 2), 300);
  assert.strictEqual(L.upgradeCost('engine', 3), null);
  const r = L.buyUpgrade(save, 'engine');
  assert.ok(r.ok && save.upgrades.engine === 2 && save.crystals === 400);
});
test('لا يمكن الشراء بدون بلورات كافية', () => {
  const save = L.createNewSave();
  const r = L.buyUpgrade(save, 'engine');
  assert.ok(!r.ok);
  assert.strictEqual(save.upgrades.engine, 1);
});
test('سعة المخزن تحدّ من الجمع', () => {
  const save = L.createNewSave(); // سعة 300
  save.crystals = 295;
  const added = L.addCrystals(save, 20);
  assert.strictEqual(added, 5);
  assert.strictEqual(save.crystals, 300);
});
test('شراء الوقود بالبلورات وبحد الخزان', () => {
  const save = L.createNewSave();
  save.crystals = 10; save.fuel = 95;
  const r = L.buyFuel(save, 10);
  assert.ok(r.ok);
  assert.strictEqual(save.fuel, 100); // الخزان 100
  assert.strictEqual(r.fuel, 5);
});

console.log('— الحفظ —');
test('حفظ/تحميل round-trip يحافظ على كل البيانات', () => {
  const save = L.createNewSave();
  save.crystals = 123; save.fuel = 77;
  save.upgrades.engine = 2; save.upgrades.scanner = 1;
  save.discoveredPlanets = ['ramman', 'jaledon'];
  save.artifacts = ['heart_sand'];
  save.achievements = ['first_landing'];
  const back = L.deserializeSave(L.serializeSave(save));
  assert.strictEqual(back.crystals, 123);
  assert.strictEqual(back.fuel, 77);
  assert.strictEqual(back.upgrades.engine, 2);
  assert.deepStrictEqual(back.discoveredPlanets, ['ramman', 'jaledon']);
  assert.deepStrictEqual(back.artifacts, ['heart_sand']);
  assert.deepStrictEqual(back.achievements, ['first_landing']);
});
test('بيانات فاسدة تعيد حفظاً جديداً بدلاً من الانهيار', () => {
  const back = L.deserializeSave('{{{ليس json');
  assert.strictEqual(back.crystals, 0);
  assert.strictEqual(back.upgrades.engine, 1);
  const back2 = L.deserializeSave('{"version":99}');
  assert.strictEqual(back2.upgrades.engine, 1);
});

console.log('— شروط الفتح —');
test('المنطقة 2 تحتاج محرك 2، والمنطقة 3 تحتاج محرك 3', () => {
  const save = L.createNewSave();
  assert.ok(L.isPlanetUnlocked(save, D.PLANETS[0])); // منطقة 1
  assert.ok(!L.isPlanetUnlocked(save, D.PLANETS[3])); // منطقة 2
  save.upgrades.engine = 2;
  assert.ok(L.isPlanetUnlocked(save, D.PLANETS[3]));
  assert.ok(!L.isPlanetUnlocked(save, D.PLANETS[6])); // منطقة 3
  save.upgrades.engine = 3;
  assert.ok(L.isPlanetUnlocked(save, D.PLANETS[6]));
});
test('النجم المظلم يحتاج محرك 3 + ماسح 2 + القطع الثماني', () => {
  const save = L.createNewSave();
  save.upgrades.engine = 3; save.upgrades.scanner = 2;
  assert.ok(!L.isDarkStarUnlocked(save));
  const missing = L.darkStarMissing(save);
  assert.ok(missing.join(' ').includes('8/8') || missing.join(' ').includes('الثماني'));
  for (const p of D.PLANETS) {
    if (p.id !== 'darkstar') save.artifacts.push(p.artifact.id);
  }
  assert.ok(L.isDarkStarUnlocked(save));
  assert.deepStrictEqual(L.darkStarMissing(save), []);
});
test('السفر يحتاج وقوداً كافياً', () => {
  const save = L.createNewSave();
  const p = D.PLANETS[0];
  const need = L.fuelNeeded(p);
  assert.ok(need > 0 && need <= 100);
  save.fuel = need - 1;
  assert.ok(!L.canTravelTo(save, p).ok);
  save.fuel = need;
  assert.ok(L.canTravelTo(save, p).ok);
});
test('الماسح: مستوى 1 يظهر وجود السر، ومستوى 2 يعطي تلميحاً نصياً', () => {
  const save = L.createNewSave();
  const p = D.PLANETS[0];
  assert.strictEqual(L.scannerHint(save, p), null);
  save.upgrades.scanner = 1;
  assert.strictEqual(L.scannerHint(save, p), 'يوجد سر هنا');
  save.upgrades.scanner = 2;
  assert.ok(L.scannerHint(save, p).length > 10);
  save.artifacts.push(p.artifact.id);
  assert.strictEqual(L.scannerHint(save, p), null); // بعد الاكتشاف لا تلميح
});

console.log('— الإنجازات —');
test('الإنجازات تُمنح مرة واحدة فقط', () => {
  const save = L.createNewSave();
  save.totalLandings = 1;
  save.totalCrystals = 1000;
  save.crystals = 500;
  const first = L.checkAchievements(save);
  assert.ok(first.includes('first_landing'));
  assert.ok(first.includes('crystals_1000'));
  assert.ok(first.includes('rich_500'));
  const second = L.checkAchievements(save);
  assert.deepStrictEqual(second, []);
});

console.log('\n' + passed + ' اختبار منطق ناجح.');
