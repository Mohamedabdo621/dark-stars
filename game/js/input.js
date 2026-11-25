'use strict';
/* DARK STARS — الإدخال: لوحة مفاتيح + عصا افتراضية (لمس) + أزرار فعل.
   الحالة الناتجة: {mx, my, thrust, angle, interact, zap, thrustHeld} */

function createInput(env) {
  const doc = env.document;
  const win = env.window;
  const keys = {};
  const state = {
    mx: 0, my: 0,           // اتجاه الحركة على السطح (-1..1)
    thrust: false,          // دفع في الطيران
    angle: 0,               // اتجاه الدفع (راديان)
    interact: false,        // زر جمع/تفاعل (يُستهلك عند القراءة)
    zap: false,             // زر الصعق (يُستهلك عند القراءة)
    joyActive: false,
    joyX: 0, joyY: 0,       // إزاحة العصا (-1..1)
  };

  function onKeyDown(e) {
    const k = (e.key || '').toLowerCase();
    keys[k] = true;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      if (e.preventDefault) e.preventDefault();
    }
    if (k === 'e') state.interact = true;
    if (k === ' ') state.zap = true;
  }
  function onKeyUp(e) {
    keys[(e.key || '').toLowerCase()] = false;
  }

  if (win && win.addEventListener) {
    win.addEventListener('keydown', onKeyDown);
    win.addEventListener('keyup', onKeyUp);
  }

  // يقرأ حالة لوحة المفاتيح في كل إطار ويملأ state
  function pollKeyboard() {
    let mx = 0, my = 0;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (mx !== 0 || my !== 0) {
      state.mx = mx; state.my = my;
    } else if (!state.joyActive) {
      state.mx = 0; state.my = 0;
    }
    // الطيران: الأسهم/‏WASD تحدد اتجاه الدفع مباشرة
    if (mx !== 0 || my !== 0) {
      state.thrust = true;
      state.angle = Math.atan2(my, mx);
    } else if (!state.joyActive) {
      state.thrust = false;
    }
  }

  // ربط العصا الافتراضية بعنصر DOM (div) — لمس/ماوس
  function bindJoystick(el) {
    if (!el || !el.addEventListener) return;
    let pid = null;
    function update(e) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      const cl = len > 1 ? 1 / len : 1;
      state.joyX = dx * cl; state.joyY = dy * cl;
      state.joyActive = true;
      state.mx = state.joyX; state.my = state.joyY;
      state.thrust = len > 0.25;
      state.angle = Math.atan2(state.joyY, state.joyX);
      const knob = el.querySelector ? el.querySelector('.joy-knob') : null;
      if (knob && knob.style) {
        knob.style.transform = 'translate(' + (state.joyX * 34) + 'px,' + (state.joyY * 34) + 'px)';
      }
    }
    function end(e) {
      if (pid !== null && e.pointerId !== undefined && e.pointerId !== pid) return;
      pid = null;
      state.joyActive = false;
      state.joyX = 0; state.joyY = 0;
      state.mx = 0; state.my = 0;
      state.thrust = false;
      const knob = el.querySelector ? el.querySelector('.joy-knob') : null;
      if (knob && knob.style) knob.style.transform = 'translate(0,0)';
    }
    el.addEventListener('pointerdown', (e) => {
      pid = e.pointerId;
      if (el.setPointerCapture) { try { el.setPointerCapture(pid); } catch (err) { /* تجاهل */ } }
      update(e);
    });
    el.addEventListener('pointermove', (e) => { if (pid !== null) update(e); });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ربط زر فعل (element) بخاصية في state — يضبطها عند الضغط
  function bindButton(el, prop) {
    if (!el || !el.addEventListener) return;
    const down = (e) => { if (e.preventDefault) e.preventDefault(); state[prop] = true; };
    const up = () => { state[prop] = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  // زر لحظي: يضبط الخاصية true عند الضغط فقط (تُستهلك في الإطار)
  function bindTap(el, prop) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('pointerdown', (e) => {
      if (e.preventDefault) e.preventDefault();
      state[prop] = true;
    });
  }

  return {
    state: state,
    keys: keys,
    pollKeyboard: pollKeyboard,
    bindJoystick: bindJoystick,
    bindButton: bindButton,
    bindTap: bindTap,
    consume: function (prop) {
      const v = !!state[prop];
      state[prop] = false;
      return v;
    },
  };
}

var DS_INPUT = { createInput: createInput };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_INPUT;
}
