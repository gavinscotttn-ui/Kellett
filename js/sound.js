/* ============================================================
   The noises.

   Synthesised on the fly with Web Audio — no audio files, so
   nothing to load and nothing to fetch. Glassy bell partials
   with a fast attack and a long exponential tail: the sound a
   very expensive piece of software makes when it agrees with you.
   ============================================================ */

(function (KH) {
  'use strict';

  var ctx = null;
  var master = null;
  var unlocked = false;

  /* Each voice is a stack of partials over a root note, in semitones,
     with a relative gain and a length. Major intervals throughout —
     nothing in here is allowed to sound like bad news except 'error'. */
  /* Warm, low and unhurried. Sine partials an octave below where a
     notification usually sits, a soft attack rather than a click, and a
     low-pass that takes the glassy edge off the top. Nothing pings. */
  var VOICES = {
    startup:  { root: 174.61, partials: [[0, 0.30, 2.6], [7, 0.20, 2.8], [12, 0.14, 3.0], [16, 0.08, 3.2]], spread: 0.13, attack: 0.09, cut: 1600 },
    nav:      { root: 261.63, partials: [[0, 0.11, 0.42], [12, 0.045, 0.34]], spread: 0.012, attack: 0.018, cut: 1100 },
    click:    { root: 392.00, partials: [[0, 0.055, 0.16]], spread: 0, attack: 0.01, cut: 900 },
    toast:    { root: 220.00, partials: [[0, 0.16, 1.1], [7, 0.10, 1.25]], spread: 0.07, attack: 0.03, cut: 1300 },
    message:  { root: 246.94, partials: [[0, 0.15, 0.95], [5, 0.10, 1.15], [12, 0.05, 1.3]], spread: 0.08, attack: 0.028, cut: 1500 },
    trade:    { root: 196.00, partials: [[0, 0.20, 1.35], [4, 0.13, 1.5], [7, 0.09, 1.7]], spread: 0.09, attack: 0.035, cut: 1200 },
    money:    { root: 329.63, partials: [[0, 0.15, 0.9], [7, 0.10, 1.1], [12, 0.06, 1.3]], spread: 0.055, attack: 0.022, cut: 1800 },
    week:     { root: 155.56, partials: [[0, 0.17, 1.6], [7, 0.10, 1.8], [10, 0.06, 2.0]], spread: 0.10, attack: 0.045, cut: 1000 },
    alert:    { root: 164.81, partials: [[0, 0.20, 1.5], [3, 0.14, 1.7]], spread: 0.11, attack: 0.05, cut: 900 },
    error:    { root: 138.59, partials: [[0, 0.19, 0.9], [1, 0.11, 0.8]], spread: 0.04, attack: 0.03, cut: 760 },
    lock:     { root: 196.00, partials: [[0, 0.17, 1.5], [-5, 0.11, 1.8]], spread: 0.14, attack: 0.05, cut: 950 },
    unlock:   { root: 196.00, partials: [[0, 0.16, 1.3], [7, 0.11, 1.5], [12, 0.06, 1.7]], spread: 0.12, attack: 0.04, cut: 1400 }
  };

  function enabled() {
    try { return !!KH.store.get('workspace').sounds; } catch (err) { return false; }
  }

  function audio() {
    if (ctx) return ctx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.42;

      /* A short bright tail, so every chime sounds like it is happening
         in a large room with a great deal of glass in it. */
      var convolver = ctx.createConvolver();
      var len = Math.floor(ctx.sampleRate * 1.9);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * 0.42;
        }
      }
      convolver.buffer = buf;

      var wet = ctx.createGain();
      wet.gain.value = 0.34;
      master.connect(ctx.destination);
      master.connect(convolver);
      convolver.connect(wet);
      wet.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function play(name) {
    if (!enabled()) return;
    var voice = VOICES[name];
    if (!voice) return;
    var a = audio();
    if (!a) return;
    if (a.state === 'suspended') { a.resume().catch(function () {}); }

    var t0 = a.currentTime + 0.001;
    var attack = voice.attack || 0.03;

    voice.partials.forEach(function (p, i) {
      var freq = voice.root * Math.pow(2, p[0] / 12);
      var gain = p[1];
      var dur = p[2];
      var start = t0 + i * voice.spread;

      var osc = a.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // A shelf of harmonic warmth, so a sine is not clinical.
      var body = a.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(freq * 2, start);
      var bodyGain = a.createGain();
      bodyGain.gain.value = 0.10;

      var env = a.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(gain, start + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      var lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(voice.cut || 1200, start);
      lp.Q.value = 0.55;

      osc.connect(env);
      body.connect(bodyGain);
      bodyGain.connect(env);
      env.connect(lp);
      lp.connect(master);

      osc.start(start); body.start(start);
      osc.stop(start + dur + 0.08); body.stop(start + dur + 0.08);
    });
  }

  /* A browser will not make a sound until the person has interacted
     with the page, so the context is opened on the first gesture and
     the start-up chime waits for it if it has to. */
  var pending = null;

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    var a = audio();
    if (a && a.state === 'suspended') a.resume().catch(function () {});
    if (pending) { var p = pending; pending = null; play(p); }
  }

  function playWhenAllowed(name) {
    if (unlocked) { play(name); return; }
    pending = name;
  }

  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: false, passive: true });
  });

  KH.sound = { play: play, playWhenAllowed: playWhenAllowed, enabled: enabled };
})(window.KH);
