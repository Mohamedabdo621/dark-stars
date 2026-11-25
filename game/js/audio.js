'use strict';
/* DARK STARS — الصوت: نغمات مولّدة بـ WebAudio فقط. لا ملفات صوتية. */

function createAudio(env) {
  const AC = env.AudioContext || null;
  let ctx = null;
  let muted = false;
  let engineNodes = null;

  function ensure() {
    if (!AC || muted) return null;
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    setMuted: function (m) {
      muted = !!m;
      if (muted) this.engineStop();
    },
    isMuted: function () { return muted; },
    click: function () { tone(660, 0.07, 'sine', 0.1); },
    collect: function () { tone(880, 0.09, 'sine', 0.14, 0, 1320); },
    fuel: function () { tone(520, 0.12, 'triangle', 0.14, 0, 780); },
    zap: function () { tone(1200, 0.15, 'square', 0.1, 0, 300); },
    hit: function () { tone(180, 0.2, 'sawtooth', 0.16, 0, 90); },
    land: function () { tone(140, 0.25, 'sine', 0.2, 0, 70); tone(420, 0.15, 'sine', 0.1, 0.05); },
    discover: function () {
      tone(523, 0.14, 'sine', 0.14, 0);
      tone(659, 0.14, 'sine', 0.14, 0.12);
      tone(784, 0.22, 'sine', 0.16, 0.24);
    },
    achievement: function () {
      tone(523, 0.12, 'triangle', 0.15, 0);
      tone(659, 0.12, 'triangle', 0.15, 0.11);
      tone(784, 0.12, 'triangle', 0.15, 0.22);
      tone(1047, 0.3, 'triangle', 0.18, 0.33);
    },
    engineStart: function () {
      const ac = ensure();
      if (!ac || engineNodes) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, ac.currentTime);
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      engineNodes = { osc: osc, gain: gain };
    },
    engineStop: function () {
      if (!engineNodes) return;
      try {
        engineNodes.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        engineNodes.osc.stop(ctx.currentTime + 0.15);
      } catch (e) { /* تجاهل */ }
      engineNodes = null;
    },
  };
}

var DS_AUDIO = { createAudio: createAudio };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DS_AUDIO;
}
