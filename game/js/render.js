'use strict';
/* DARK STARS — الرسم على Canvas. كل الرسومات بالكود، لا صور إطلاقاً.
   تحسينات الجرافيك: parallax بثلاث طبقات، جزيئات، توهج بدون shadowBlur،
   كاميرا ناعمة + اهتزاز، تدرجات مخزّنة (لا تُبنى كل إطار)، نجوم وامضة،
   تفاصيل أكثر للسفينة والكواكب والمخلوقات. يعمل في المتصفح وفي node (stubs). */

const R = (typeof require !== 'undefined')
  ? require('./data.js')
  : { PLANETS: PLANETS, COLORS: COLORS };
const R_PLANETS = R.PLANETS;
const R_COLORS = R.COLORS;

// ---------- أدوات ----------

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgba(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// ---------- الكاميرا ----------

function createCamera() {
  return { x: 0, y: 0, shake: 0 };
}

// تقريب ناعم مستقل عن معدل الإطارات (exponential smoothing)
function smoothCamera(cam, tx, ty, dt, snap) {
  if (snap || dt <= 0) { cam.x = tx; cam.y = ty; return; }
  const k = 1 - Math.exp(-dt * 5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

// ---------- الجزيئات ----------

function createParticles() { return []; }

// opts: {count, colors[], speed, life, size, gravity, drag, dir, spread}
function spawnBurst(p, x, y, opts) {
  const o = opts || {};
  const count = o.count || 8;
  for (let i = 0; i < count; i++) {
    if (p.length > 240) return;
    const ang = (o.dir !== undefined)
      ? o.dir + (Math.random() - 0.5) * 2 * (o.spread !== undefined ? o.spread : 0.6)
      : Math.random() * Math.PI * 2;
    const sp = (o.speed || 70) * (0.3 + Math.random() * 0.7);
    const cols = o.colors || ['#e879f9', '#fbbf24'];
    p.push({
      x: x, y: y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0,
      max: (o.life || 0.6) * (0.6 + Math.random() * 0.8),
      size: (o.size || 3) * (0.6 + Math.random() * 0.8),
      color: cols[Math.floor(Math.random() * cols.length)],
      grav: o.gravity || 0,
      drag: (o.drag === undefined ? 0.94 : o.drag),
    });
  }
}

function updateParticles(p, dt) {
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    pt.life += dt;
    if (pt.life >= pt.max) { p.splice(i, 1); continue; }
    pt.vy += pt.grav * dt;
    const d = Math.pow(pt.drag, dt * 60);
    pt.vx *= d; pt.vy *= d;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
}

function drawParticles(ctx, p, toScreen) {
  for (const pt of p) {
    const s = toScreen(pt.x, pt.y);
    const a = 1 - pt.life / pt.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(0.5, pt.size * a + 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- نجوم الخلفية (3 طبقات parallax) ----------

const LAYER_PAR = [0.08, 0.22, 0.5];

function makeStars(count, seed) {
  const rng = mulberry(seed || 42);
  const stars = [];
  for (let i = 0; i < count; i++) {
    const lr = rng();
    const layer = lr < 0.45 ? 0 : (lr < 0.8 ? 1 : 2);
    stars.push({
      x: rng(), y: rng(),
      r: layer === 0 ? 0.5 + rng() * 0.9 : (layer === 1 ? 0.8 + rng() * 1.1 : 1.2 + rng() * 1.5),
      tw: rng() * Math.PI * 2,
      twSpeed: 0.4 + rng() * 1.8,
      c: rng() < 0.7 ? '#f5efff' : (rng() < 0.55 ? '#e879f9' : (rng() < 0.6 ? '#fbbf24' : '#a78bfa')),
      layer: layer,
      bright: layer === 2 && rng() < 0.28,
    });
  }
  return stars;
}

// تدرج خلفية مخزّن حسب المقاس (لا يُبنى كل إطار)
let bgGradCache = { key: '', g: null };
function bgGradient(ctx, w, h) {
  const key = w + 'x' + h;
  if (bgGradCache.key === key && bgGradCache.g) return bgGradCache.g;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#150530');
  g.addColorStop(0.5, '#07010d');
  g.addColorStop(1, '#020108');
  bgGradCache = { key: key, g: g };
  return g;
}

// سدم مخزّنة حسب المقاس
let nebCache = { key: '', blobs: [] };
function nebulaBlobs(w, h) {
  const key = w + 'x' + h;
  if (nebCache.key === key) return nebCache.blobs;
  const rng = mulberry(777);
  const cols = ['168,85,247', '232,121,249', '56,189,248', '251,191,36'];
  const blobs = [];
  for (let i = 0; i < 4; i++) {
    blobs.push({
      x: rng() * w, y: rng() * h,
      r: (0.28 + rng() * 0.3) * Math.max(w, h),
      c: cols[i % cols.length],
      a: 0.05 + rng() * 0.05,
    });
  }
  nebCache = { key: key, blobs: blobs };
  return blobs;
}

function drawStarfield(ctx, w, h, t, stars, camX, camY, noBg) {
  if (!noBg) {
    ctx.fillStyle = bgGradient(ctx, w, h);
    ctx.fillRect(0, 0, w, h);
  }
  // سدم بعيدة تتحرك ببطء شديد (عمق)
  const ncx = (camX || 0) * 0.03, ncy = (camY || 0) * 0.03;
  for (const b of nebulaBlobs(w, h)) {
    const nx = b.x - ncx, ny = b.y - ncy;
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, b.r);
    g.addColorStop(0, 'rgba(' + b.c + ',' + b.a + ')');
    g.addColorStop(1, 'rgba(' + b.c + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(nx - b.r, ny - b.r, b.r * 2, b.r * 2);
  }
  // 3 طبقات نجوم بسرعات parallax مختلفة
  for (let layer = 0; layer < 3; layer++) {
    const par = LAYER_PAR[layer];
    const px = (camX || 0) * par, py = (camY || 0) * par;
    for (const s of stars) {
      if (s.layer !== layer) continue;
      let sx = ((s.x * w - px) % w + w) % w;
      let sy = ((s.y * h - py) % h + h) % h;
      const base = layer === 0 ? 0.35 : (layer === 1 ? 0.5 : 0.65);
      const a = base + (1 - base) * Math.abs(Math.sin(t * s.twSpeed + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      if (s.r < 1.3) {
        ctx.fillRect(sx - s.r / 2, sy - s.r / 2, s.r, s.r);
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // نجوم لامعة: وميض متقاطع
      if (s.bright) {
        const fl = s.r * 4.5;
        ctx.globalAlpha = a * 0.55;
        ctx.strokeStyle = s.c;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - fl, sy); ctx.lineTo(sx + fl, sy);
        ctx.moveTo(sx, sy - fl); ctx.lineTo(sx, sy + fl);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// تظليل حواف (vignette) مخزّن حسب المقاس — يضيف عمقاً
let vigCache = { key: '', g: null };
function drawVignette(ctx, w, h) {
  const key = w + 'x' + h;
  if (vigCache.key !== key || !vigCache.g) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.32)');
    vigCache = { key: key, g: g };
  }
  ctx.fillStyle = vigCache.g;
  ctx.fillRect(0, 0, w, h);
}

// ---------- مواضع الخريطة ----------

function mapPositions(w, h) {
  // الوطن في المركز، المناطق حلقات حوله
  const cx = w / 2, cy = h / 2;
  const pos = { home: { x: cx, y: cy } };
  const ring = { 1: Math.min(w, h) * 0.22, 2: Math.min(w, h) * 0.36, 3: Math.min(w, h) * 0.47 };
  const angles = {
    ramman: -0.5, jaledon: 1.1, ghabon: 2.6,
    lahib: -1.2, ghayum: 0.4, kahfon: 2.0,
    ballor: -0.9, zilal: 0.9, darkstar: 2.4,
  };
  for (const p of R_PLANETS) {
    const a = angles[p.id] || 0;
    const r = ring[p.zone];
    pos[p.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.85 };
  }
  return pos;
}

// تدرجات الكواكب مخزّنة (تُبنى مرة واحدة لكل كوكب ونصف قطر)
const gradCache = new Map();
function planetGradient(ctx, planet, r) {
  const key = planet.id + ':' + r;
  let g = gradCache.get(key);
  if (!g) {
    g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, planet.color);
    g.addColorStop(1, planet.color2);
    gradCache.set(key, g);
  }
  return g;
}

function drawPlanetBody(ctx, x, y, r, planet, t) {
  ctx.save();
  ctx.translate(x, y);
  // توهج خارجي خفيف (بدون shadowBlur)
  ctx.fillStyle = hexToRgba(planet.color, 0.10);
  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.fill();
  // الجسم
  ctx.fillStyle = planetGradient(ctx, planet, r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // حفر وتفاصيل سطحية حتمية (نفس الكوكب = نفس التفاصيل دائماً)
  const rng = mulberry(hashStr(planet.id));
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.55;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.09 + rng() * 0.13), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.07 + rng() * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  // حزام يدور ببطء حول الكوكب
  ctx.save();
  ctx.rotate(Math.sin(t * 0.15 + planet.id.length) * 0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 0.3, 0, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.restore();
  // حلقة لكوكب غيوم (كوكب محاط بحلقة)
  if (planet.id === 'ghayum') {
    ctx.strokeStyle = 'rgba(251,191,36,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.5, r * 0.42, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  // غلاف جوي
  ctx.strokeStyle = hexToRgba(planet.color, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  if (planet.id === 'darkstar') {
    // هالة بنفسجية نابضة + دوامة داخلية
    ctx.strokeStyle = 'rgba(168,85,247,' + (0.4 + 0.3 * Math.sin(t * 2)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,121,249,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const a0 = t * 0.8 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, a0, a0 + Math.PI * 0.7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMap(ctx, w, h, save, selectedId, stars, t, isUnlocked) {
  drawStarfield(ctx, w, h, t, stars, 0, 0);
  const pos = mapPositions(w, h);
  // حلقات المناطق
  ctx.strokeStyle = 'rgba(168,85,247,0.25)';
  ctx.lineWidth = 1;
  for (const rr of [0.22, 0.36, 0.47]) {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, Math.min(w, h) * rr, Math.min(w, h) * rr * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // خطوط السفر من الوطن للكواكب المكتشفة (شرطات متحركة)
  ctx.strokeStyle = 'rgba(232,121,249,0.35)';
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = -t * 14;
  for (const p of R_PLANETS) {
    if (save.discoveredPlanets.includes(p.id)) {
      ctx.beginPath();
      ctx.moveTo(pos.home.x, pos.home.y);
      ctx.lineTo(pos[p.id].x, pos[p.id].y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  // الوطن + قمر صغير يدور حوله
  drawPlanetBody(ctx, pos.home.x, pos.home.y, 22, { id: 'home', color: '#38bdf8', color2: '#0369a1' }, t);
  const moonA = t * 0.5;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(pos.home.x + Math.cos(moonA) * 34, pos.home.y + Math.sin(moonA) * 34, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = R_COLORS.text;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('الوطن', pos.home.x, pos.home.y + 38);
  // الكواكب (طفو خفيف)
  for (let i = 0; i < R_PLANETS.length; i++) {
    const p = R_PLANETS[i];
    const pp = pos[p.id];
    const bob = Math.sin(t * 0.8 + i * 1.3) * 2.5;
    const py = pp.y + bob;
    const unlocked = isUnlocked(save, p);
    const discovered = save.discoveredPlanets.includes(p.id);
    if (p.secret && !unlocked) {
      // النجم المظلم مخفي تماماً قبل فتحه — يظهر كنجمة باهتة
      ctx.fillStyle = 'rgba(167,143,199,0.5)';
      ctx.beginPath();
      ctx.arc(pp.x, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = R_COLORS.muted;
      ctx.font = '12px sans-serif';
      ctx.fillText('؟؟؟', pp.x, py + 24);
      continue;
    }
    // توهج خلف الكوكب المحدد
    if (selectedId === p.id) {
      const pulse = 0.18 + 0.1 * Math.sin(t * 3);
      ctx.fillStyle = 'rgba(251,191,36,' + pulse + ')';
      ctx.beginPath();
      ctx.arc(pp.x, py, 32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = unlocked ? 1 : 0.45;
    drawPlanetBody(ctx, pp.x, py, 17, p, t);
    ctx.globalAlpha = 1;
    if (selectedId === p.id) {
      ctx.strokeStyle = R_COLORS.gold;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pp.x, py, 24 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = unlocked ? R_COLORS.text : R_COLORS.muted;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(discovered ? p.name : '؟؟؟', pp.x, py + 32);
    if (!unlocked) {
      ctx.fillStyle = R_COLORS.muted;
      ctx.font = '11px sans-serif';
      ctx.fillText('🔒 محرك ' + p.zone, pp.x, py + 46);
    }
  }
}

// ---------- الطيران ----------

function drawShip(ctx, x, y, angle, thrusting, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (thrusting) {
    // لهب متوهج متذبذب بالزمن (لا Math.random كل إطار)
    const fl = 16 + 6 * Math.sin(t * 47) + 3 * Math.sin(t * 31);
    ctx.fillStyle = 'rgba(251,146,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-12 - fl, 0);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(253,230,138,0.95)';
    ctx.beginPath();
    ctx.moveTo(-12, -3.5);
    ctx.lineTo(-12 - fl * 0.55, 0);
    ctx.lineTo(-12, 3.5);
    ctx.closePath();
    ctx.fill();
    // توهج الفوهة
    ctx.fillStyle = 'rgba(251,146,60,0.35)';
    ctx.beginPath();
    ctx.arc(-13, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  // أجنحة خلفية
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-14, -13);
  ctx.lineTo(-12, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.lineTo(-14, 13);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
  // جسم السفينة
  ctx.fillStyle = R_COLORS.accent;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  // قمرة القيادة + لمعة
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(5.5, -1.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // فوهة المحرك
  ctx.fillStyle = '#4c1d95';
  ctx.fillRect(-14, -4, 3, 8);
  ctx.restore();
}

function drawFlight(ctx, w, h, flight, stars, t, cam, particles) {
  const s = flight.ship;
  const camX = cam.x, camY = cam.y;
  drawStarfield(ctx, w, h, t, stars, camX, camY);
  const toScreen = (x, y) => ({ x: x - camX, y: y - camY });

  // مسار منقط نحو الهدف (شرطات متحركة)
  const tp = toScreen(flight.target.x, flight.target.y);
  ctx.strokeStyle = 'rgba(232,121,249,0.4)';
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -t * 22;
  ctx.beginPath();
  ctx.moveTo(toScreen(s.x, s.y).x, toScreen(s.x, s.y).y);
  ctx.lineTo(tp.x, tp.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // الكوكب الهدف
  const planet = R_PLANETS.find((p) => p.id === flight.planetId);
  drawPlanetBody(ctx, tp.x, tp.y, 34, planet, t);
  ctx.fillStyle = R_COLORS.text;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(planet.name, tp.x, tp.y + 52);
  // حلقة الهبوط النابضة
  ctx.strokeStyle = 'rgba(251,191,36,' + (0.55 + 0.3 * Math.sin(t * 3)) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, 48 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
  ctx.stroke();

  // الكويكبات (حفر + حافة مضيئة)
  for (const a of flight.asteroids) {
    const p = toScreen(a.x, a.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = '#78716c';
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rr = a.r * (0.8 + 0.25 * Math.sin(i * 2.7));
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // حفر
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(-a.r * 0.25, -a.r * 0.15, a.r * 0.22, 0, Math.PI * 2);
    ctx.arc(a.r * 0.3, a.r * 0.25, a.r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // حافة مضيئة من الأعلى
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, a.r * 0.92, -Math.PI * 0.8, -Math.PI * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  // خطوط سرعة عند الطيران السريع
  const speed = Math.hypot(s.vx, s.vy);
  if (speed > 170) {
    const sp = toScreen(s.x, s.y);
    const dx = s.vx / speed, dy = s.vy / speed;
    const pxn = -dy, pyn = dx;
    ctx.strokeStyle = 'rgba(245,239,255,0.28)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const back = 34 + i * 26;
      const jit = Math.sin(t * 9 + i * 2.4) * 16;
      const x0 = sp.x - dx * back + pxn * jit;
      const y0 = sp.y - dy * back + pyn * jit;
      const len = speed * 0.09;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + dx * len, y0 + dy * len);
      ctx.stroke();
    }
  }

  // السفينة
  const sp = toScreen(s.x, s.y);
  drawShip(ctx, sp.x, sp.y, s.angle, flight.thrusting, t);

  // الوطن (نقطة البداية)
  const hp = toScreen(0, 0);
  drawPlanetBody(ctx, hp.x, hp.y, 14, { id: 'home', color: '#38bdf8', color2: '#0369a1' }, t);
  ctx.fillStyle = R_COLORS.text;
  ctx.font = '11px sans-serif';
  ctx.fillText('الوطن', hp.x, hp.y + 28);

  // الجزيئات
  drawParticles(ctx, particles, toScreen);
}

// ---------- سطح الكوكب ----------

// تدرج سماء الكوكب مخزّن
const skyCache = new Map();
function skyGradient(ctx, planet, h) {
  const key = planet.id + ':' + h;
  let g = skyCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0114');
    g.addColorStop(0.55, planet.color2);
    g.addColorStop(1, '#05010a');
    skyCache.set(key, g);
  }
  return g;
}

// تتبع خطوات اللاعب لدورة المشي (بدون تغيير منطق اللعبة)
let surfWalk = { x: 0, y: 0, phase: 0, lastT: 0 };

function drawSurface(ctx, w, h, surf, planet, stars, t, cam, particles) {
  const p = surf.player;
  const camX = cam.x, camY = cam.y;
  // سماء الكوكب
  ctx.fillStyle = skyGradient(ctx, planet, h);
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, t * 0.3, stars, camX * 0.3, camY * 0.3, true);
  const toScreen = (x, y) => ({ x: x - camX, y: y - camY });

  // دورة المشي: تتقدم فقط عند الحركة
  const moved = Math.hypot(p.x - surfWalk.x, p.y - surfWalk.y);
  if (moved > 0.5) {
    surfWalk.phase += (t - surfWalk.lastT) * 11;
    surfWalk.x = p.x; surfWalk.y = p.y;
  }
  surfWalk.lastT = t;
  const walkSwing = Math.sin(surfWalk.phase);

  // سلسلة جبال بعيدة (parallax أبطأ)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 24) {
    const wx = x + camX * 0.5;
    const y = h * 0.52 + Math.sin(wx * 0.006 + 1) * 26 + Math.sin(wx * 0.017) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // أرضية بتضاريس متموجة (طبقتان)
  ctx.fillStyle = planet.color2;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) {
    const wx = x + camX;
    const y = h * 0.62 + Math.sin(wx * 0.01) * 18 + Math.sin(wx * 0.023) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = planet.color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) {
    const wx = x + camX;
    const y = h * 0.78 + Math.sin(wx * 0.013 + 2) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // حصى صغيرة على الأرض (مواضع حتمية)
  const pebRng = mulberry(hashStr(planet.id + ':pebbles'));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 14; i++) {
    const wx = pebRng() * surf.worldW;
    const q = toScreen(wx, 0);
    if (q.x < -20 || q.x > w + 20) continue;
    const gy = h * 0.62 + Math.sin(wx * 0.01) * 18 + Math.sin(wx * 0.023) * 10;
    ctx.beginPath();
    ctx.arc(q.x, gy + 8, 3 + pebRng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // منصة الهبوط (توهج + ضوء نابض)
  const pad = toScreen(surf.worldW / 2, surf.worldH / 2 + 200);
  ctx.fillStyle = 'rgba(251,191,36,0.18)';
  ctx.beginPath();
  ctx.arc(pad.x, pad.y, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(pad.x - 30, pad.y - 4, 60, 8);
  ctx.fillStyle = 'rgba(251,191,36,' + (0.5 + 0.5 * Math.sin(t * 4)) + ')';
  ctx.beginPath();
  ctx.arc(pad.x, pad.y - 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = R_COLORS.text;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('منصة الهبوط — عُد هنا للرجوع', pad.x, pad.y + 22);

  // الكهف السري (توهج + شرارات عند عدم اكتشافه)
  const cave = toScreen(surf.cave.x, surf.cave.y);
  const caveGlow = surf.cave.found ? '251,191,36' : '232,121,249';
  ctx.fillStyle = 'rgba(' + caveGlow + ',0.16)';
  ctx.beginPath();
  ctx.arc(cave.x, cave.y, 36 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(cave.x, cave.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = surf.cave.found ? R_COLORS.gold : R_COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cave.x, cave.y, 26, 0, Math.PI * 2);
  ctx.stroke();
  if (!surf.cave.found) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + i * 2.1;
      ctx.fillStyle = 'rgba(232,121,249,' + (0.4 + 0.4 * Math.sin(t * 3 + i)) + ')';
      ctx.beginPath();
      ctx.arc(cave.x + Math.cos(a) * 32, cave.y + Math.sin(a) * 32, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = surf.cave.found ? R_COLORS.gold : R_COLORS.accent;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(surf.cave.found ? '✓' : '؟', cave.x, cave.y + 5);

  // بلورات (توهج + لمعة + دوران خفيف)
  for (const n of surf.crystals) {
    if (n.taken) continue;
    const q = toScreen(n.x, n.y);
    const bob = Math.sin(t * 2 + n.x) * 3;
    ctx.fillStyle = 'rgba(232,121,249,0.22)';
    ctx.beginPath();
    ctx.arc(q.x, q.y + bob, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(q.x, q.y + bob);
    ctx.rotate(Math.sin(t * 1.5 + n.x * 0.01) * 0.18);
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // وميض متقاطع
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(t * 4 + n.x)) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q.x - 12, q.y + bob); ctx.lineTo(q.x + 12, q.y + bob);
    ctx.stroke();
  }
  // عقد الوقود (توهج + حلقة نابضة)
  for (const n of surf.fuelNodes) {
    if (n.taken) continue;
    const q = toScreen(n.x, n.y);
    ctx.fillStyle = 'rgba(251,146,60,0.25)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, 16 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(q.x, q.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253,230,138,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 13 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('و', q.x, q.y + 3);
  }

  // المخلوق النادر (هالة ذهبية + شرارات مدارية)
  if (!surf.rare.fled) {
    const q = toScreen(surf.rare.x, surf.rare.y);
    const pulse = 1 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = 'rgba(251,191,36,0.15)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,' + (0.5 + 0.3 * Math.sin(t * 3)) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 18 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = surf.rare.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 12 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(q.x - 3, q.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(q.x - 4, q.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(q.x + 4, q.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1;
      ctx.fillStyle = 'rgba(251,191,36,0.9)';
      ctx.beginPath();
      ctx.arc(q.x + Math.cos(a) * 20, q.y + Math.sin(a) * 20, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = R_COLORS.gold;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('✦ نادر', q.x, q.y - 24);
  }

  // المخلوقات (ظل + جسم متدرج + قرون + عيون تتبع اللاعب + أقدام تمشي)
  for (const c of surf.creatures) {
    const q = toScreen(c.x, c.y);
    // ظل
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(q.x, q.y + 15, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = c.stunned > 0 ? 0.55 : 1;
    // أقدام تمشي (تتبادل مع الزمن عند المطاردة)
    const chasing = Math.hypot(p.x - c.x, p.y - c.y) < 240;
    const step = chasing ? Math.sin(t * 10 + c.x) * 3 : 0;
    ctx.fillStyle = hexToRgba(c.color, 0.7);
    ctx.beginPath();
    ctx.ellipse(q.x - 6, q.y + 13 + step, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(q.x + 6, q.y + 13 - step, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // قرنان صغيران
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(q.x - 9, q.y - 10); ctx.lineTo(q.x - 5, q.y - 19); ctx.lineTo(q.x - 2, q.y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(q.x + 2, q.y - 10); ctx.lineTo(q.x + 5, q.y - 19); ctx.lineTo(q.x + 9, q.y - 10);
    ctx.closePath();
    ctx.fill();
    // الجسم
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(q.x, q.y + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    // عيون تتبع اللاعب
    const lookDx = (p.x - c.x) / (Math.hypot(p.x - c.x, p.y - c.y) || 1);
    const lookDy = (p.y - c.y) / (Math.hypot(p.x - c.x, p.y - c.y) || 1);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(q.x - 5, q.y - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(q.x + 5, q.y - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(q.x - 5 + lookDx * 1.4, q.y - 4 + lookDy * 1.4, 1.6, 0, Math.PI * 2);
    ctx.arc(q.x + 5 + lookDx * 1.4, q.y - 4 + lookDy * 1.4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    if (c.stunned > 0) {
      // نجوم دوّارة فوق الرأس بدل الإيموجي
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2.1;
        ctx.fillStyle = R_COLORS.gold;
        ctx.beginPath();
        ctx.arc(q.x + Math.cos(a) * 16, q.y - 20 + Math.sin(a) * 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // اللاعب (رائد فضاء: ظل + أرجل تمشي + بدلة + حقيبة + خوذة + قناع)
  const pp = toScreen(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(pp.x, pp.y + 15, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (surf.invuln <= 0 || Math.floor(t * 10) % 2 === 0) {
    // أرجل
    ctx.fillStyle = '#c4b5fd';
    ctx.fillRect(pp.x - 8, pp.y + 6 + walkSwing * 2, 5, 9 - Math.abs(walkSwing));
    ctx.fillRect(pp.x + 3, pp.y + 6 - walkSwing * 2, 5, 9 - Math.abs(walkSwing));
    // حقيبة ظهر
    ctx.fillStyle = '#6d28d9';
    ctx.fillRect(pp.x - 15, pp.y - 6, 6, 12);
    // جسم البدلة
    ctx.fillStyle = '#f5efff';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = R_COLORS.primary;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 13, Math.PI * 0.15, Math.PI * 0.85);
    ctx.fill();
    // خوذة + قناع زجاجي بلمعة
    ctx.fillStyle = '#f5efff';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y - 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.ellipse(pp.x + 1, pp.y - 3, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pp.x - 2, pp.y - 6);
    ctx.lineTo(pp.x + 3, pp.y - 5);
    ctx.stroke();
  }

  // الجزيئات فوق كل شيء
  drawParticles(ctx, particles, toScreen);
}

// ---------- شاشة العنوان ----------

function drawTitle(ctx, w, h, stars, t) {
  drawStarfield(ctx, w, h, t, stars, t * 3, t * 1.5);
  // نجم مركزي متوهج
  const cx = w / 2, cy = h * 0.32;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90);
  g.addColorStop(0, 'rgba(232,121,249,0.9)');
  g.addColorStop(0.4, 'rgba(168,85,247,0.35)');
  g.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 90, 0, Math.PI * 2);
  ctx.fill();
  // كوكبان صغيران يدوران حول النجم
  for (let i = 0; i < 2; i++) {
    const a = t * (i === 0 ? 0.35 : -0.22) + i * 2.4;
    const rr = 58 + i * 34;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.5;
    ctx.fillStyle = i === 0 ? '#38bdf8' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // نجمة مرسومة (تدور ببطء)
  ctx.fillStyle = R_COLORS.gold;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.5) * 0.1);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 26 : 11;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

var DS_RENDER = {
  makeStars: makeStars, drawStarfield: drawStarfield, drawVignette: drawVignette,
  mapPositions: mapPositions, drawPlanetBody: drawPlanetBody, drawMap: drawMap,
  drawFlight: drawFlight, drawSurface: drawSurface, drawTitle: drawTitle,
  createCamera: createCamera, smoothCamera: smoothCamera,
  createParticles: createParticles, spawnBurst: spawnBurst,
  updateParticles: updateParticles, drawParticles: drawParticles,
  hexToRgba: hexToRgba,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_RENDER;
}
