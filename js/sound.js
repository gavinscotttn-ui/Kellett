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
  var VOICES = {
    startup: { root: 523.25, partials: [[0, 0.5, 1.5], [7, 0.32, 1.6], [12, 0.26, 1.8], [19, 0.14, 2.0]], spread: 0.055, type: 'sine' },
    nav:     { root: 880.00, partials: [[0, 0.22, 0.20], [12, 0.10, 0.16]], spread: 0, type: 'sine' },
    toast:   { root: 659.25, partials: [[0, 0.30, 0.62], [7, 0.20, 0.70], [16, 0.12, 0.55]], spread: 0.03, type: 'sine' },
    message: { root: 783.99, partials: [[0, 0.30, 0.50], [5, 0.22, 0.60], [12, 0.14, 0.72]], spread: 0.045, type: 'sine' },
    trade:   { root: 587.33, partials: [[0, 0.34, 0.70], [4, 0.24, 0.78], [11, 0.16, 0.92]], spread: 0.05, type: 'triangle' },
    money:   { root: 1046.50, partials: [[0, 0.26, 0.40], [7, 0.18, 0.52], [12, 0.12, 0.64]], spread: 0.028, type: 'sine' },
    error:   { root: 311.13, partials: [[0, 0.32, 0.42], [1, 0.20, 0.36]], spread: 0.02, type: 'triangle' },
    lock:    { root: 392.00, partials: [[0, 0.30, 0.80], [-5, 0.20, 0.95]], spread: 0.07, type: 'sine' },
    unlock:  { root: 392.00, partials: [[0, 0.28, 0.70], [7, 0.22, 0.80], [12, 0.14, 0.9]], spread: 0.06, type: 'sine' },
    click:   { root: 1318.51, partials: [[0, 0.12, 0.09]], spread: 0, type: 'sine' }
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
      master.gain.value = 0.5;

      /* A short bright tail, so every chime sounds like it is happening
         in a large room with a great deal of glass in it. */
      var convolver = ctx.createConvolver();
      var len = Math.floor(ctx.sampleRate * 1.1);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.5;
        }
      }
      convolver.buffer = buf;

      var wet = ctx.createGain();
      wet.gain.value = 0.26;
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
    voice.partials.forEach(function (p, i) {
      var freq = voice.root * Math.pow(2, p[0] / 12);
      var gain = p[1];
      var dur = p[2];
      var start = t0 + i * voice.spread;

      var osc = a.createOscillator();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(freq, start);

      var env = a.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(env);
      env.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.05);
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
