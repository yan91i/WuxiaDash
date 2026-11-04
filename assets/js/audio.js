/* ==========================================================================
   audio.js - WebAudio 合成音效与背景音乐（零外部资源）
   所有音色均由振荡器/噪声实时合成，可离线工作
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var A = (CH.Audio = {});

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var enabled = true, musicOn = true;
  var musicTimer = null, musicStep = 0;

  A.init = function (settings) {
    if (settings) { enabled = settings.sound !== false; musicOn = settings.music !== false; }
    if (ctx) { A.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    try { ctx = new AC(); } catch (e) { enabled = false; return; }
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  };

  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  A.setSound = function (on) { enabled = !!on; if (!enabled) return; };
  A.setMusic = function (on) { musicOn = !!on; if (musicOn) A.startMusic(); else A.stopMusic(); };
  A.isSound = function () { return enabled; };

  /* ---------- 基础发声单元 ---------- */
  function tone(freq, dur, type, vol, delay, glideTo) {
    if (!ctx || !enabled) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, delay) {
    if (!ctx || !enabled) return;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1600;
    var g = ctx.createGain(); g.gain.value = vol || 0.2;
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0); src.stop(t0 + dur);
  }

  /* ---------- 具体音效 ---------- */
  var SFX = {
    click: function () { tone(660, 0.07, 'square', 0.12); },
    back: function () { tone(400, 0.09, 'square', 0.12, 0, 260); },
    buy: function () { tone(720, 0.08, 'triangle', 0.16); tone(1080, 0.12, 'triangle', 0.14, 0.06); },
    coin: function () { tone(1180, 0.07, 'square', 0.12); tone(1560, 0.1, 'square', 0.1, 0.05); },
    deny: function () { tone(200, 0.16, 'sawtooth', 0.14, 0, 130); },
    pourStart: function () { noise(0.5, 0.16, 900); },
    ballHit: function () { tone(900 + Math.random() * 500, 0.035, 'sine', 0.05); },
    multiply: function (p) { tone(520 + (p || 0) * 120, 0.08, 'triangle', 0.13); },
    collect: function () { tone(880, 0.05, 'sine', 0.08); },
    hit: function () { noise(0.06, 0.14, 2600); },
    crit: function () { tone(1400, 0.1, 'square', 0.16, 0, 700); noise(0.08, 0.12, 3200); },
    enemyDie: function () { tone(300, 0.14, 'square', 0.14, 0, 140); noise(0.1, 0.12, 1200); },
    heroHurt: function () { tone(240, 0.13, 'sawtooth', 0.16, 0, 150); },
    levelUp: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.16, i * 0.075); }); },
    unlock: function () { [440, 587, 740, 880, 1175].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.15, i * 0.09); }); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.17, i * 0.1); }); },
    lose: function () { [440, 392, 330, 262].forEach(function (f, i) { tone(f, 0.26, 'sawtooth', 0.14, i * 0.13); }); },
    boss: function () { [110, 110, 146, 110].forEach(function (f, i) { tone(f, 0.3, 'sawtooth', 0.2, i * 0.16); }); },
    merge: function () { tone(600, 0.09, 'triangle', 0.14); tone(900, 0.12, 'triangle', 0.12, 0.07); tone(1250, 0.16, 'triangle', 0.1, 0.14); }
  };

  A.play = function (name, arg) {
    if (!ctx || !enabled) return;
    var fn = SFX[name];
    if (fn) { try { fn(arg); } catch (e) { } }
  };

  /* ---------- 背景音乐（简易循环和弦 + 琶音） ---------- */
  var PROG = [
    [220.0, 261.6, 329.6],  // Am
    [174.6, 220.0, 261.6],  // F
    [196.0, 246.9, 293.7],  // G
    [261.6, 329.6, 392.0]   // C
  ];
  function musicTick() {
    if (!ctx || !musicOn) return;
    var t0 = ctx.currentTime;
    var chord = PROG[musicStep % PROG.length];
    for (var i = 0; i < chord.length; i++) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = chord[i] / 2;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
      osc.connect(g); g.connect(musicGain);
      osc.start(t0); osc.stop(t0 + 1.45);
    }
    // 高音琶音点缀
    var arp = chord[musicStep % 3] * 2;
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = arp;
    g2.gain.setValueAtTime(0.0001, t0 + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.035, t0 + 0.28);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    o2.connect(g2); g2.connect(musicGain);
    o2.start(t0 + 0.2); o2.stop(t0 + 1.0);
    musicStep++;
  }

  A.startMusic = function () {
    if (!ctx || !musicOn) return;
    if (musicTimer) return;
    musicGain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.5);
    musicTick();
    musicTimer = setInterval(musicTick, 1400);
  };
  A.stopMusic = function () {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicGain) musicGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.3);
  };
})();
