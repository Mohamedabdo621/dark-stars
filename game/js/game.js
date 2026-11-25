'use strict';
/* DARK STARS — اللعبة: آلة الحالات، حلقة اللعب، الربط بين المنطق والرسم.
   تعمل في المتصفح وفي node (مع stubs) عبر createGame(env). */

const DS = (typeof require !== 'undefined')
  ? {
      data: require('./data.js'),
      logic: require('./logic.js'),
      audio: require('./audio.js'),
      input: require('./input.js'),
      render: require('./render.js'),
    }
  : { data: DS_DATA, logic: DS_LOGIC, audio: DS_AUDIO, input: DS_INPUT, render: DS_RENDER };

function createGame(env) {
  const doc = env.document;
  const win = env.window;
  const storage = env.localStorage;
  const raf = env.requestAnimationFrame || function () { return 0; };
  const D = DS.data;
  const L = DS.logic;
  const R = DS.render;

  const audio = DS.audio.createAudio(env);
  const input = DS.input.createInput(env);

  const SAVE_KEY = D.SAVE_KEY;

  const game = {
    save: null,
    state: 'title', // title | map | flight | surface | upgrades | codex | achievements | settings | howto
    returnTo: 'map',
    selectedPlanetId: null,
    flight: null,
    surface: null,
    surfacePlanet: null,
    stars: R.makeStars(140, 42),
    cam: R.createCamera(),
    particles: R.createParticles(),
    fade: 0,
    emitAcc: 0,
    dustAcc: 0,
    viewW: 800,
    viewH: 600,
    canvas: null,
    ctx: null,
    time: 0,
    paused: false,
    rafId: 0,
    lastTs: 0,
    lastHud: { crystals: -1, fuel: -1 },
    toastCount: 0,
    confirmClearArmed: false,
  };

  // ---------- أدوات DOM ----------

  function $(id) {
    try { return doc.getElementById(id); } catch (e) { return null; }
  }
  function on(id, evt, fn) {
    const el = $(id);
    if (el && el.addEventListener) el.addEventListener(evt, fn);
  }
  function show(el, visible) {
    if (el && el.style) el.style.display = visible ? '' : 'none';
  }
  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  // ---------- الحفظ ----------

  function saveGame() {
    try {
      if (storage && storage.setItem) storage.setItem(SAVE_KEY, L.serializeSave(game.save));
    } catch (e) { /* تجاهل أخطاء التخزين */ }
  }
  function loadGame() {
    try {
      const raw = storage && storage.getItem ? storage.getItem(SAVE_KEY) : null;
      game.save = raw ? L.deserializeSave(raw) : L.createNewSave();
    } catch (e) {
      game.save = L.createNewSave();
    }
    audio.setMuted(!!game.save.muted);
  }
  function clearSave() {
    try { if (storage && storage.removeItem) storage.removeItem(SAVE_KEY); } catch (e) { /* تجاهل */ }
    game.save = L.createNewSave();
    audio.setMuted(false);
    saveGame();
  }

  // ---------- التنبيهات والإنجازات ----------

  function showToast(msg, kind) {
    const box = $('toasts');
    if (!box || !doc.createElement) return;
    const div = doc.createElement('div');
    div.className = 'toast' + (kind === 'achievement' ? ' toast-ach' : '');
    div.textContent = msg;
    if (box.appendChild) box.appendChild(div);
    game.toastCount++;
    setTimeout(function () {
      if (div.remove) div.remove();
      else if (div.parentNode) div.parentNode.removeChild(div);
    }, 3800);
  }

  function grantAchievements() {
    const fresh = L.checkAchievements(game.save);
    for (const id of fresh) {
      const def = D.ACHIEVEMENTS.find((a) => a.id === id);
      if (def) {
        audio.achievement();
        showToast('🏆 إنجاز جديد: ' + def.name + ' — ' + def.desc, 'achievement');
      }
    }
    if (fresh.length) saveGame();
    return fresh;
  }

  // ---------- الشاشات ----------

  const SCREEN_IDS = {
    title: 'screen-title', map: 'screen-map', flight: 'screen-flight',
    surface: 'screen-surface', upgrades: 'screen-upgrades', codex: 'screen-codex',
    achievements: 'screen-achievements', settings: 'screen-settings', howto: 'screen-howto',
  };

  function goTo(state, returnTo) {
    game.state = state;
    if (returnTo) game.returnTo = returnTo;
    // انتقال ناعم: تعتيم قصير + مسح الجزيئات + تثبيت الكاميرا على الهدف الجديد
    game.particles.length = 0;
    game.fade = 0.55;
    if (state === 'flight' && game.flight) {
      R.smoothCamera(game.cam, game.flight.ship.x - game.viewW / 2 + 120, game.flight.ship.y - game.viewH / 2, 0, true);
    } else if (state === 'surface' && game.surface) {
      R.smoothCamera(game.cam,
        L.clamp(game.surface.player.x - game.viewW / 2, 0, Math.max(0, L.SURFACE.worldW - game.viewW)),
        L.clamp(game.surface.player.y - game.viewH / 2, 0, Math.max(0, L.SURFACE.worldH - game.viewH)), 0, true);
    }
    for (const key in SCREEN_IDS) {
      show($(SCREEN_IDS[key]), key === state);
    }
    // شريط المعلومات العلوي يظهر في كل الشاشات ما عدا العنوان
    show($('hud'), state !== 'title');
    // أزرار التنقل تظهر في الخريطة فقط
    show($('hud-nav'), state === 'map');
    // أدوات اللمس: الطيران والسطح فقط
    const touch = $('touch');
    show(touch, state === 'flight' || state === 'surface');
    show($('btn-thrust'), state === 'flight');
    show($('btn-interact'), state === 'surface');
    show($('btn-zap'), state === 'surface');
    show($('btn-return'), state === 'surface');
    if (state === 'map') renderPlanetList();
    if (state === 'upgrades') renderUpgrades();
    if (state === 'codex') renderCodex();
    if (state === 'achievements') renderAchievements();
    if (state === 'settings') renderSettings();
    updateHUD(true);
  }

  // ---------- الخريطة ----------

  function renderPlanetList() {
    const list = $('planet-list');
    if (!list) return;
    list.innerHTML = '';
    for (const zone of D.ZONES) {
      const zdiv = doc.createElement('div');
      zdiv.className = 'zone-block';
      const zh = doc.createElement('h3');
      zh.textContent = zone.name + ' (محرك ' + zone.engineReq + ')';
      zdiv.appendChild(zh);
      for (const p of D.PLANETS.filter((x) => x.zone === zone.id)) {
        const unlocked = L.isPlanetUnlocked(game.save, p);
        const discovered = game.save.discoveredPlanets.includes(p.id);
        const btn = doc.createElement('button');
        btn.className = 'planet-btn' + (game.selectedPlanetId === p.id ? ' selected' : '') + (unlocked ? '' : ' locked');
        const label = p.secret && !unlocked ? '؟؟؟ (كوكب سري)' : (discovered ? p.name : '؟؟؟');
        btn.textContent = (unlocked ? '' : '🔒 ') + label + (discovered ? ' ✓' : '');
        btn.addEventListener('click', function () { selectPlanet(p.id); });
        zdiv.appendChild(btn);
      }
      list.appendChild(zdiv);
    }
  }

  function selectPlanet(id) {
    const planet = L.getPlanet(id);
    if (!planet) return;
    game.selectedPlanetId = id;
    renderPlanetList();
    const info = $('planet-info');
    const unlocked = L.isPlanetUnlocked(game.save, planet);
    const discovered = game.save.discoveredPlanets.includes(id);
    const travelBtn = $('btn-travel');
    if (!info) return;
    if (!unlocked) {
      let reason = 'مقفل — تحتاج محرك مستوى ' + planet.zone + '.';
      if (planet.id === 'darkstar') {
        reason = 'كوكب سري مقفل. ينقصك: ' + L.darkStarMissing(game.save).join('، ') + '.';
      }
      info.innerHTML = '<h3>' + (planet.secret ? '؟؟؟' : planet.name) + '</h3><p>' + reason + '</p>';
      if (travelBtn) travelBtn.disabled = true;
      return;
    }
    const need = L.fuelNeeded(planet);
    const hint = L.scannerHint(game.save, planet);
    info.innerHTML =
      '<h3>' + (discovered ? planet.name : '؟؟؟') + '</h3>' +
      '<p>' + planet.desc + '</p>' +
      '<p>التضاريس: ' + planet.terrain + ' | المورد: ' + planet.resource + '</p>' +
      '<p>المخلوق: ' + planet.creature.name + ' | الخطر: ' + planet.hazard.name + '</p>' +
      '<p>الوقود المطلوب للرحلة: ' + need + ' (معك ' + Math.floor(game.save.fuel) + ')</p>' +
      (hint ? '<p class="hint">🔍 الماسح: ' + hint + '</p>' : '') +
      (discovered ? '<p>✓ تم اكتشافه — قطعة أثرية: ' + (game.save.artifacts.includes(planet.artifact.id) ? planet.artifact.name + ' ✓' : 'لم تُكتشف بعد') + '</p>' : '');
    if (travelBtn) travelBtn.disabled = game.save.fuel < need;
  }

  function startFlight() {
    const planet = L.getPlanet(game.selectedPlanetId);
    if (!planet) { showToast('اختر كوكباً أولاً'); return; }
    const check = L.canTravelTo(game.save, planet);
    if (!check.ok) { showToast(check.reason); audio.hit(); return; }
    game.flight = L.createFlight(planet, game.save);
    game.save.totalFlights++;
    saveGame();
    goTo('flight');
    audio.click();
  }

  function burstAtShip(x, y, opts) {
    if (!game.flight) return;
    R.spawnBurst(game.particles, x, y, opts);
  }
  function burstAtPlayer(opts) {
    if (!game.surface) return;
    R.spawnBurst(game.particles, game.surface.player.x, game.surface.player.y, opts);
  }
  function shake(amount) {
    game.cam.shake = Math.max(game.cam.shake, amount);
  }

  function handleFlightEvents(events) {
    for (const ev of events) {
      if (ev.type === 'hit') {
        audio.hit();
        burstAtShip(game.flight.ship.x, game.flight.ship.y,
          { count: 14, colors: ['#fb923c', '#f97316', '#78716c', '#f5efff'], speed: 130, life: 0.7, size: 3.5 });
        shake(9);
        showToast(ev.loss > 0 ? 'اصطدمت بكويكب! خسرت ' + ev.loss + ' وقود' : 'الدرع امتص الاصطدام!');
      } else if (ev.type === 'bounce') {
        audio.hit();
        shake(5);
        showToast('سرعة عالية! اقترب ببطء للهبوط');
      } else if (ev.type === 'landed') {
        audio.land();
        burstAtShip(game.flight.ship.x, game.flight.ship.y,
          { count: 12, colors: ['#d6d3d1', '#a78bfa', '#fbbf24'], speed: 70, life: 0.6, size: 3 });
        shake(3);
        game.save.fuel = Math.max(0, Math.floor(game.flight.ship.fuel));
        game.save.totalLandings++;
        const pid = game.flight.planetId;
        if (!game.save.discoveredPlanets.includes(pid)) game.save.discoveredPlanets.push(pid);
        game.save.currentPlanet = pid;
        game.surfacePlanet = L.getPlanet(pid);
        game.surface = L.createSurface(game.surfacePlanet, game.save);
        saveGame();
        grantAchievements();
        showToast('🛬 هبطت على ' + game.surfacePlanet.name + ' بنجاح!');
        goTo('surface');
      } else if (ev.type === 'fuel_out') {
        const lost = Math.floor(game.save.crystals * 0.15);
        game.save.crystals -= lost;
        game.save.fuel = 20; // وقود طوارئ حتى لا تتعطل اللعبة
        game.save.currentPlanet = 'home';
        saveGame();
        audio.hit();
        showToast('نفد الوقود! عدت للوطن تلقائياً' + (lost > 0 ? ' وخسرت ' + lost + ' بلورة' : '') + ' — حصلت على 20 وقود طوارئ');
        goTo('map');
      }
    }
  }

  function handleSurfaceEvents(events) {
    for (const ev of events) {
      if (ev.type === 'collect' && ev.kind === 'crystal') {
        audio.collect();
        burstAtPlayer({ count: 8, colors: ['#e879f9', '#fbbf24', '#ffffff'], speed: 80, life: 0.5, size: 3 });
        if (ev.amount < ev.requested) showToast('المخزن ممتلئ! رقِّ مخزن البلورات');
      } else if (ev.type === 'collect' && ev.kind === 'fuel') {
        audio.fuel();
        burstAtPlayer({ count: 8, colors: ['#fb923c', '#fde68a', '#ffffff'], speed: 70, life: 0.5, size: 3 });
      } else if (ev.type === 'hit') {
        audio.hit();
        burstAtPlayer({ count: 10, colors: ['#ef4444', '#f5efff', '#fbbf24'], speed: 110, life: 0.5, size: 3 });
        shake(6);
        showToast(ev.stolen > 0 ? 'المخلوق سرق منك ' + ev.stolen + ' بلورات!' : 'المخلوق هاجمك!');
      } else if (ev.type === 'zap') {
        audio.zap();
        burstAtPlayer({ count: 12, colors: ['#22d3ee', '#a5f3fc', '#ffffff'], speed: 150, life: 0.4, size: 3 });
        shake(2);
        if (ev.count > 0) {
          game.save.totalZaps += ev.count;
          grantAchievements();
        }
      } else if (ev.type === 'artifact') {
        audio.discover();
        burstAtPlayer({ count: 18, colors: ['#fbbf24', '#e879f9', '#ffffff'], speed: 120, life: 0.9, size: 3.5 });
        shake(2);
        showToast('✨ اكتشفت قطعة أثرية: ' + ev.name + '! راجع الموسوعة', 'achievement');
        grantAchievements();
        saveGame();
      } else if (ev.type === 'rare') {
        audio.discover();
        burstAtPlayer({ count: 16, colors: ['#fbbf24', '#ffffff', '#e879f9'], speed: 130, life: 0.8, size: 3.5 });
        showToast('🌟 مخلوق نادر: ' + ev.name + '! سُجل في الموسوعة (+' + ev.bonus + ' بلورة)', 'achievement');
        saveGame();
      } else if (ev.type === 'creature_seen') {
        showToast('👁 مخلوق جديد سُجل في الموسوعة: ' + ev.name);
        saveGame();
      }
    }
  }

  // زر الجمع: يجمع أقرب عقدة في نطاق 90 فوراً
  function interactPulse() {
    const s = game.surface;
    if (!s) return;
    const p = s.player;
    let best = null, bestD = 90, bestKind = null;
    for (const n of s.crystals) {
      if (n.taken) continue;
      const d = L.dist(p.x, p.y, n.x, n.y);
      if (d < bestD) { bestD = d; best = n; bestKind = 'crystal'; }
    }
    for (const n of s.fuelNodes) {
      if (n.taken) continue;
      const d = L.dist(p.x, p.y, n.x, n.y);
      if (d < bestD) { bestD = d; best = n; bestKind = 'fuel'; }
    }
    if (!best) return;
    if (bestKind === 'crystal') {
      best.taken = true;
      const added = L.addCrystals(game.save, best.amount);
      audio.collect();
      if (added < best.amount) showToast('المخزن ممتلئ! رقِّ مخزن البلورات');
    } else {
      best.taken = true;
      const room = L.fuelMaxFor(game.save) - game.save.fuel;
      const added = Math.max(0, Math.min(best.amount, room));
      game.save.fuel += added;
      audio.fuel();
    }
    updateHUD(true);
  }

  function returnToShip() {
    game.save.currentPlanet = 'home';
    saveGame();
    grantAchievements();
    goTo('map');
    showToast('عدت إلى السفينة — البلورات محفوظة');
  }

  // ---------- الترقيات ----------

  function renderUpgrades() {
    const box = $('upgrade-list');
    if (!box) return;
    box.innerHTML = '';
    setText('up-crystals', 'بلوراتك: ' + game.save.crystals);
    for (const key of Object.keys(D.UPGRADES)) {
      const def = D.UPGRADES[key];
      const cur = game.save.upgrades[key] || 0;
      const cost = L.upgradeCost(key, cur);
      const row = doc.createElement('div');
      row.className = 'up-row';
      const pips = '●'.repeat(cur) + '○'.repeat(def.max - cur);
      row.innerHTML =
        '<div class="up-info"><strong>' + def.name + '</strong> <span class="pips">' + pips + '</span>' +
        '<div class="up-desc">' + def.desc + '</div></div>';
      const btn = doc.createElement('button');
      btn.className = 'btn small';
      if (cost === null) {
        btn.textContent = 'الحد الأقصى ✓';
        btn.disabled = true;
      } else {
        btn.textContent = 'ترقية — ' + cost + ' 💎';
        btn.disabled = game.save.crystals < cost;
        btn.addEventListener('click', function () {
          const r = L.buyUpgrade(game.save, key);
          if (r.ok) {
            audio.discover();
            showToast('تمت ترقية ' + def.name + ' إلى المستوى ' + r.next + '!');
            saveGame();
            renderUpgrades();
            updateHUD(true);
          } else {
            showToast(r.reason);
          }
        });
      }
      row.appendChild(btn);
      box.appendChild(row);
    }
    // شراء وقود
    const fuelRow = doc.createElement('div');
    fuelRow.className = 'up-row';
    fuelRow.innerHTML = '<div class="up-info"><strong>وقود</strong><div class="up-desc">الوقود الحالي: ' + Math.floor(game.save.fuel) + ' / ' + L.fuelMaxFor(game.save) + ' — 10 وقود مقابل 2 بلورة.</div></div>';
    const fbtn = doc.createElement('button');
    fbtn.className = 'btn small';
    fbtn.textContent = 'اشترِ 10 وقود (2 💎)';
    fbtn.disabled = game.save.crystals < 2 || game.save.fuel >= L.fuelMaxFor(game.save);
    fbtn.addEventListener('click', function () {
      const r = L.buyFuel(game.save, 10);
      if (r.ok) {
        audio.fuel();
        showToast('اشتريت ' + r.fuel + ' وقود');
        saveGame();
        renderUpgrades();
        updateHUD(true);
      } else {
        showToast(r.reason);
      }
    });
    fuelRow.appendChild(fbtn);
    box.appendChild(fuelRow);
  }

  // ---------- الموسوعة ----------

  function renderCodex() {
    const box = $('codex-list');
    if (!box) return;
    box.innerHTML = '';
    const h1 = doc.createElement('h3');
    h1.textContent = 'القطع الأثرية (' + game.save.artifacts.length + '/9)';
    box.appendChild(h1);
    for (const p of D.PLANETS) {
      const found = game.save.artifacts.includes(p.artifact.id);
      const div = doc.createElement('div');
      div.className = 'codex-row' + (found ? '' : ' locked');
      div.innerHTML = found
        ? '<strong>' + p.artifact.name + '</strong> <span class="muted">— ' + p.name + '</span><div>' + p.artifact.story + '</div>'
        : '<strong>؟؟؟</strong> <span class="muted">— قطعة مجهولة في كوكب ' + (game.save.discoveredPlanets.includes(p.id) ? p.name : '؟؟؟') + '</span>';
      box.appendChild(div);
    }
    const h2 = doc.createElement('h3');
    h2.textContent = 'المخلوقات (' + game.save.codexCreatures.length + '/18)';
    box.appendChild(h2);
    for (const p of D.PLANETS) {
      for (const kind of ['creature', 'rare']) {
        const c = p[kind];
        const seen = game.save.codexCreatures.includes(c.id);
        const div = doc.createElement('div');
        div.className = 'codex-row' + (seen ? '' : ' locked');
        div.innerHTML = seen
          ? '<strong>' + c.name + '</strong> <span class="muted">— ' + p.name + (kind === 'rare' ? ' (نادر ✦)' : '') + '</span>'
          : '<strong>؟؟؟</strong> <span class="muted">— مخلوق مجهول في ' + (game.save.discoveredPlanets.includes(p.id) ? p.name : 'كوكب مجهول') + '</span>';
        box.appendChild(div);
      }
    }
  }

  // ---------- الإنجازات ----------

  function renderAchievements() {
    const box = $('ach-list');
    if (!box) return;
    box.innerHTML = '';
    setText('ach-count', 'فتحت ' + game.save.achievements.length + ' من ' + D.ACHIEVEMENTS.length);
    for (const a of D.ACHIEVEMENTS) {
      const got = game.save.achievements.includes(a.id);
      const div = doc.createElement('div');
      div.className = 'ach-row' + (got ? '' : ' locked');
      div.innerHTML = (got ? '🏆 ' : '🔒 ') + '<strong>' + a.name + '</strong> — ' + a.desc;
      box.appendChild(div);
    }
  }

  // ---------- الإعدادات ----------

  function renderSettings() {
    setText('set-stats',
      'الرحلات: ' + game.save.totalFlights +
      ' | الهبوط: ' + game.save.totalLandings +
      ' | إجمالي البلورات: ' + game.save.totalCrystals +
      ' | القطع الأثرية: ' + game.save.artifacts.length + '/9');
    const muteBtn = $('btn-mute-set');
    if (muteBtn) muteBtn.textContent = game.save.muted ? '🔇 الصوت مكتوم — اضغط للتشغيل' : '🔊 الصوت يعمل — اضغط للكتم';
    const clearBtn = $('btn-clear-save');
    if (clearBtn) clearBtn.textContent = game.confirmClearArmed ? '⚠️ اضغط مرة أخرى للتأكيد!' : '🗑 مسح الحفظ والبدء من جديد';
  }

  // ---------- HUD ----------

  function updateHUD(force) {
    const c = game.save ? game.save.crystals : 0;
    const f = game.save ? Math.floor(game.save.fuel) : 0;
    if (!force && game.lastHud.crystals === c && game.lastHud.fuel === f) return;
    game.lastHud = { crystals: c, fuel: f };
    setText('hud-crystals', '💎 ' + c);
    setText('hud-fuel', '⛽ ' + f + '/' + (game.save ? L.fuelMaxFor(game.save) : 100));
    const bar = $('hud-fuel-bar');
    if (bar && bar.style && game.save) {
      bar.style.width = Math.round((game.save.fuel / L.fuelMaxFor(game.save)) * 100) + '%';
    }
    if (game.state === 'flight' && game.flight) {
      const d = Math.round(L.dist(game.flight.ship.x, game.flight.ship.y, game.flight.target.x, game.flight.target.y));
      setText('flight-info', 'المسافة للهدف: ' + d + 'م | السرعة: ' + Math.round(Math.hypot(game.flight.ship.vx, game.flight.ship.vy)));
    }
    if (game.state === 'surface' && game.surfacePlanet) {
      const hint = L.scannerHint(game.save, game.surfacePlanet);
      setText('surface-info', game.surfacePlanet.name + ' — ' + game.surfacePlanet.hazard.name + (hint ? ' | 🔍 ' + hint : ''));
    }
  }

  // ---------- الحلقة ----------

  function frame(dt) {
    if (game.paused) return;
    game.time += dt;
    input.pollKeyboard();

    // الجزيئات + اضمحلال الاهتزاز والتعتيم (كلها مبنية على dt)
    R.updateParticles(game.particles, dt);
    if (game.cam.shake > 0) game.cam.shake *= Math.exp(-dt * 5);
    if (game.fade > 0) game.fade = Math.max(0, game.fade - dt * 2.4);

    if (game.state === 'flight' && game.flight) {
      const st = input.state;
      const f = game.flight;
      let thrusting = false;
      let angle = f.ship.angle;
      if (st.joyActive && Math.hypot(st.joyX, st.joyY) > 0.25) {
        thrusting = true;
        angle = Math.atan2(st.joyY, st.joyX);
      } else if (st.thrust) {
        thrusting = true;
        angle = st.angle;
      } else if (st.thrustBtn) {
        thrusting = true;
        angle = f.ship.angle;
      }
      f.thrusting = thrusting;
      if (thrusting) audio.engineStart(); else audio.engineStop();
      // جزيئات عادم المحرك (معدل ثابت مستقل عن الإطارات)
      if (thrusting) {
        game.emitAcc += dt;
        while (game.emitAcc >= 0.025) {
          game.emitAcc -= 0.025;
          const bx = f.ship.x - Math.cos(f.ship.angle) * 16 + (Math.random() - 0.5) * 6;
          const by = f.ship.y - Math.sin(f.ship.angle) * 16 + (Math.random() - 0.5) * 6;
          R.spawnBurst(game.particles, bx, by,
            { count: 1, colors: ['#fb923c', '#fbbf24', '#fde68a'], speed: 55, life: 0.35, size: 3, dir: f.ship.angle + Math.PI, spread: 0.45 });
        }
      }
      const events = L.stepFlight(f, { thrust: thrusting, angle: angle }, dt);
      handleFlightEvents(events);
      // كاميرا ناعمة تتبع السفينة
      R.smoothCamera(game.cam, f.ship.x - game.viewW / 2 + 120, f.ship.y - game.viewH / 2, dt, false);
    } else {
      audio.engineStop();
    }

    if (game.state === 'surface' && game.surface && game.surfacePlanet) {
      const st = input.state;
      const interact = input.consume('interact');
      const zap = input.consume('zap');
      const events = L.stepSurface(game.surface, game.surfacePlanet, game.save,
        { mx: st.mx, my: st.my, interact: interact, zap: zap }, dt);
      if (interact) interactPulse();
      handleSurfaceEvents(events);
      // غبار خفيف عند المشي
      if (Math.hypot(st.mx, st.my) > 0.1) {
        game.dustAcc += dt;
        if (game.dustAcc > 0.14) {
          game.dustAcc = 0;
          R.spawnBurst(game.particles, game.surface.player.x + (Math.random() - 0.5) * 10, game.surface.player.y + 12,
            { count: 1, colors: ['#a78bfa', '#78716c'], speed: 12, life: 0.5, size: 2.5, gravity: -12 });
        }
      }
      if (events.length) updateHUD(true);
      // كاميرا ناعمة تتبع اللاعب (مقيّدة بحدود العالم)
      R.smoothCamera(game.cam,
        L.clamp(game.surface.player.x - game.viewW / 2, 0, Math.max(0, L.SURFACE.worldW - game.viewW)),
        L.clamp(game.surface.player.y - game.viewH / 2, 0, Math.max(0, L.SURFACE.worldH - game.viewH)), dt, false);
    }

    updateHUD(false);
    render();
  }

  function render() {
    const ctx = game.ctx;
    if (!ctx) return;
    const w = game.canvas.width / (game.dpr || 1);
    const h = game.canvas.height / (game.dpr || 1);
    ctx.save();
    ctx.scale(game.dpr || 1, game.dpr || 1);
    ctx.direction = 'rtl';
    // كاميرا العرض = الكاميرا الناعمة + إزاحة الاهتزاز
    const viewCam = {
      x: game.cam.x + (Math.random() * 2 - 1) * game.cam.shake,
      y: game.cam.y + (Math.random() * 2 - 1) * game.cam.shake,
    };
    if (game.state === 'title') {
      R.drawTitle(ctx, w, h, game.stars, game.time);
    } else if (game.state === 'map') {
      R.drawMap(ctx, w, h, game.save, game.selectedPlanetId, game.stars, game.time, function (s, p) { return L.isPlanetUnlocked(s, p); });
    } else if (game.state === 'flight' && game.flight) {
      R.drawFlight(ctx, w, h, game.flight, game.stars, game.time, viewCam, game.particles);
    } else if (game.state === 'surface' && game.surface && game.surfacePlanet) {
      R.drawSurface(ctx, w, h, game.surface, game.surfacePlanet, game.stars, game.time, viewCam, game.particles);
    } else {
      R.drawStarfield(ctx, w, h, game.time, game.stars, 0, 0);
    }
    // تظليل حواف + تعتيم الانتقال
    R.drawVignette(ctx, w, h);
    if (game.fade > 0) {
      ctx.fillStyle = 'rgba(7,1,13,' + game.fade.toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function loop(ts) {
    if (game.paused) { game.rafId = raf(function (t) { loop(t); }); return; }
    const dt = Math.min(0.05, (ts - (game.lastTs || ts)) / 1000 || 0.016);
    game.lastTs = ts;
    frame(dt);
    game.rafId = raf(function (t) { loop(t); });
  }

  function resize() {
    const c = game.canvas;
    if (!c) return;
    const dpr = Math.min(2, (win && win.devicePixelRatio) || 1);
    game.dpr = dpr;
    const w = c.clientWidth || 800;
    const h = c.clientHeight || 600;
    game.viewW = w;
    game.viewH = h;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }

  // ---------- الربط والبدء ----------

  function wire() {
    game.canvas = $('game-canvas');
    if (game.canvas) {
      try { game.ctx = game.canvas.getContext('2d'); } catch (e) { game.ctx = null; }
    }
    // أزرار العنوان
    on('btn-start', 'click', function () { audio.click(); goTo('map'); });
    on('btn-howto', 'click', function () { audio.click(); goTo('howto', 'title'); });
    on('btn-ach-title', 'click', function () { audio.click(); goTo('achievements', 'title'); });
    on('btn-codex-title', 'click', function () { audio.click(); goTo('codex', 'title'); });
    on('btn-mute-title', 'click', function () {
      game.save.muted = !game.save.muted;
      audio.setMuted(game.save.muted);
      saveGame();
      renderSettings();
      const b = $('btn-mute-title');
      if (b) b.textContent = game.save.muted ? '🔇 كتم الصوت' : '🔊 الصوت';
    });
    // الخريطة
    on('btn-travel', 'click', startFlight);
    on('btn-upgrades', 'click', function () { audio.click(); goTo('upgrades', 'map'); });
    on('btn-codex', 'click', function () { audio.click(); goTo('codex', 'map'); });
    on('btn-ach', 'click', function () { audio.click(); goTo('achievements', 'map'); });
    on('btn-settings', 'click', function () { audio.click(); goTo('settings', 'map'); });
    // أزرار الرجوع
    const backIds = ['btn-back-upgrades', 'btn-back-codex', 'btn-back-ach', 'btn-back-settings', 'btn-back-howto'];
    for (const id of backIds) {
      on(id, 'click', function () { audio.click(); goTo(game.returnTo === 'title' ? 'title' : 'map'); });
    }
    // السطح
    on('btn-return', 'click', function () { audio.click(); returnToShip(); });
    // الإعدادات
    on('btn-save-now', 'click', function () { saveGame(); showToast('تم الحفظ ✓'); });
    on('btn-load-save', 'click', function () {
      loadGame();
      showToast('تم تحميل الحفظ');
      updateHUD(true);
      renderSettings();
    });
    on('btn-clear-save', 'click', function () {
      if (!game.confirmClearArmed) {
        game.confirmClearArmed = true;
        renderSettings();
        setTimeout(function () { game.confirmClearArmed = false; renderSettings(); }, 4000);
        return;
      }
      game.confirmClearArmed = false;
      clearSave();
      showToast('تم مسح الحفظ والبدء من جديد');
      goTo('title');
    });
    on('btn-mute-set', 'click', function () {
      game.save.muted = !game.save.muted;
      audio.setMuted(game.save.muted);
      saveGame();
      renderSettings();
    });
    // لمس: العصا والأزرار
    input.bindJoystick($('joy'));
    input.bindButton($('btn-thrust'), 'thrustBtn');
    input.bindTap($('btn-interact'), 'interact');
    input.bindTap($('btn-zap'), 'zap');
    // نقر على الخريطة لاختيار كوكب
    if (game.canvas && game.canvas.addEventListener) {
      game.canvas.addEventListener('click', function (e) {
        if (game.state !== 'map') return;
        const rect = game.canvas.getBoundingClientRect ? game.canvas.getBoundingClientRect() : { left: 0, top: 0 };
        const x = (e.clientX || 0) - rect.left;
        const y = (e.clientY || 0) - rect.top;
        const pos = R.mapPositions(game.canvas.clientWidth || 800, game.canvas.clientHeight || 600);
        for (const p of D.PLANETS) {
          const pp = pos[p.id];
          if (Math.hypot(x - pp.x, y - pp.y) < 30) { selectPlanet(p.id); audio.click(); return; }
        }
        const hp = pos.home;
        if (Math.hypot(x - hp.x, y - hp.y) < 30) {
          showToast('الوطن — كوكبك الأم، نقطة الانطلاق والعودة');
        }
      });
    }
    // إيقاف الحلقة عند إخفاء الصفحة
    if (doc.addEventListener) {
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) {
          game.paused = true;
          audio.engineStop();
        } else {
          game.paused = false;
          game.lastTs = 0;
        }
      });
    }
    if (win && win.addEventListener) {
      win.addEventListener('resize', resize);
      win.addEventListener('keydown', function (e) {
        if ((e.key || '') === 'Escape') {
          if (['upgrades', 'codex', 'achievements', 'settings', 'howto'].includes(game.state)) {
            goTo(game.returnTo === 'title' ? 'title' : 'map');
          }
        }
      });
    }
  }

  function start() {
    loadGame();
    wire();
    resize();
    const muteBtn = $('btn-mute-title');
    if (muteBtn) muteBtn.textContent = game.save.muted ? '🔇 كتم الصوت' : '🔊 الصوت';
    const startBtn = $('btn-start');
    if (startBtn) {
      startBtn.textContent = (game.save.totalFlights > 0 || game.save.discoveredPlanets.length > 0)
        ? '▶ أكمل الرحلة' : '🚀 ابدأ الرحلة';
    }
    goTo('title');
    game.lastTs = 0;
    game.rafId = raf(function (t) { loop(t); });
  }

  // واجهة برمجية للاختبار
  game.start = start;
  game.frame = frame;
  game.goTo = goTo;
  game.selectPlanet = selectPlanet;
  game.startFlight = startFlight;
  game.returnToShip = returnToShip;
  game.buyUpgrade = function (type) { return L.buyUpgrade(game.save, type); };
  game.buyFuel = function (amount) { return L.buyFuel(game.save, amount); };
  game.saveGame = saveGame;
  game.loadGame = loadGame;
  game.clearSave = clearSave;
  game.input = input;
  game.audio = audio;
  game.updateHUD = updateHUD;

  return game;
}

var DS_GAME = { createGame: createGame };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_GAME;
}

// تشغيل تلقائي في المتصفح فقط
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof module === 'undefined') {
  window.addEventListener('DOMContentLoaded', function () {
    const game = createGame({
      document: document,
      window: window,
      localStorage: window.localStorage,
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      AudioContext: window.AudioContext || window.webkitAudioContext,
    });
    game.start();
    window.__darkStars = game;
  });
}
