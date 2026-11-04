/* ==========================================================================
   pour.js - 倒球物理关卡引擎（游戏最核心的机制）
   杯子 → 倍率条 / 弹板 / 负分条 / 万能条 → 收集罐
   球体携带"价值"，通过倍率条时数量成倍增长，落底结算为本局球数
   挂载 CH.Pour
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U, R = CH.Render, C = CH.Canvas, D = CH.Data;
  var P = (CH.Pour = {});

  var GRAV = 2300;
  var BALL_R = 5;
  var E_PEG = 0.62;
  var E_WALL = 0.68;
  var E_TRAMP = 0.95;
  var MAX_DT = 1 / 30;
  var SUBSTEPS = 4;
  var MAX_TIME = 14;

  var st = null;           // 当前状态
  P.active = false;

  /* ------------------------------------------------------------ 关卡生成 */
  function genLayout(W, H, seed, diff) {
    var rng = U.mulberry32(seed);
    var top = H * 0.155;
    var potY = H - Math.max(84, H * 0.11);
    var bot = potY - 16;
    var left = 14, right = W - 14;
    var mid = W / 2;

    var gates = [], pegs = [], tramps = [];

    /* 每行类型与数值随难度变化 */
    var d = U.clamp(diff, 0, 1);
    function pickMul(tier) {
      // tier 0 浅层 / 1 中层 / 2 深层
      var sets = [
        [2, 2, 3],
        [2, 3, 3, 4],
        [3, 4, 5, 5, 6]
      ];
      var pool = sets[tier];
      return pool[Math.floor(rng() * pool.length)];
    }

    var rows = 5;
    var rowH = (bot - top - 30) / (rows - 1);
    for (var r = 0; r < rows; r++) {
      var y = top + r * rowH + (rng() - 0.5) * 10;
      var tier = r <= 1 ? 0 : (r <= 3 ? 1 : 2);

      if (r % 2 === 0) {
        /* 倍率行：2~3 个横条 */
        var n = 2 + (rng() < 0.45 ? 1 : 0);
        for (var i = 0; i < n; i++) {
          var seg = (right - left) / n;
          var gx = left + seg * (i + 0.5) + (rng() - 0.5) * seg * 0.2;
          var gw = Math.min(seg * 0.86, 132);
          var roll = rng();
          var gtype, gval;
          if (roll < 0.14 + d * 0.05 && tier > 0) { gtype = 'neg'; gval = 3 + Math.floor(rng() * 4) + Math.floor(d * 4); }
          else if (roll < 0.24 + d * 0.06) { gtype = 'add'; gval = 2 + Math.floor(rng() * 4) + Math.floor(d * 3); }
          else if (roll < 0.32 && tier === 2) { gtype = 'wild'; gval = 0; }
          else { gtype = 'mul'; gval = pickMul(tier); }
          gates.push({ type: gtype, value: gval, x: gx, y: y, w: gw, h: 20, flash: 0, wob: rng() * 6.28 });
        }
      } else {
        /* 弹板 + 钉行 */
        var pegsN = 4 + Math.floor(rng() * 3);
        var seg2 = (right - left) / pegsN;
        var trampIdx = Math.floor(rng() * pegsN);
        for (var j = 0; j < pegsN; j++) {
          var px = left + seg2 * (j + 0.5) + (rng() - 0.5) * 8;
          if (j === trampIdx && rng() < 0.75) {
            tramps.push({ x: px, y: y, w: seg2 * 0.72 });
          } else {
            pegs.push({ x: px, y: y, r: 6 + rng() * 2 });
          }
        }
      }
    }

    /* 侧壁导流板（斜角） */
    var deflectors = [
      { x1: left, y1: top + rowH * 1.35, x2: left + 34, y2: top + rowH * 1.05 },
      { x1: right, y1: top + rowH * 2.4, x2: right - 34, y2: top + rowH * 2.1 }
    ];

    return { gates: gates, pegs: pegs, tramps: tramps, deflectors: deflectors, potY: potY, top: top, left: left, right: right, mid: mid };
  }

  /* --------------------------------------------------------------- 启动 */
  P.start = function (opt) {
    opt = opt || {};
    var W = C.W, H = C.H;
    var diff = opt.difficulty != null ? opt.difficulty : 0.3;
    var layout = genLayout(W, H, opt.seed != null ? opt.seed : Math.floor(Math.random() * 1e9), diff);

    st = {
      W: W, H: H,
      theme: opt.theme || null,
      layout: layout,
      balls: [],
      particles: [],
      popups: [],
      collected: 0,
      startBalls: Math.max(1, Math.round(opt.startBalls || 5)),
      bonus: opt.bonus || 0,
      emitted: 0,
      emitTimer: 0,
      emitInterval: 0,
      pouring: false,
      done: false,
      time: 0,
      t: 0,
      cupX: layout.mid,
      cupTargetX: layout.mid,
      dragging: false,
      dragVX: 0,
      lastPointerX: null,
      flashText: null,
      onDone: opt.onDone || function () { },
      onUpdate: opt.onUpdate || function () { }
    };

    var n = st.startBalls;
    st.emitInterval = U.clamp(0.42 / Math.sqrt(n), 0.012, 0.06);
    st.potPulse = 0;

    P.active = true;
    CH.Audio.play('pourStart');
    return st;
  };

  P.skip = function () {
    if (!st || st.done) return;
    // 快速把剩余球直接结算，避免等待
    st.balls.length = 0;
    finish();
  };

  P.isActive = function () { return P.active; };

  function finish() {
    if (!st || st.done) return;
    st.done = true;
    st.pouring = false;
    var total = Math.floor(st.collected * (1 + st.bonus));
    st.finalTotal = total;
    st.doneAt = st.t;
    // 延迟一小段时间让收尾动画播放
    st.endTimer = 0;
    st.onUpdate(st.collected, false);
  }

  /* --------------------------------------------------------------- 输入 */
  P.pointerDown = function (x, y) {
    if (!st || st.done) return;
    if (st.pouring) return;
    if (y < st.H * 0.30) {
      st.dragging = true;
      st.lastPointerX = x;
      moveCup(x, true);
    }
  };
  P.pointerMove = function (x, y) {
    if (!st || st.done) return;
    if (st.dragging) {
      moveCup(x, false);
      st.lastPointerX = x;
    }
  };
  P.pointerUp = function () {
    if (!st || st.done) return;
    if (st.dragging) {
      st.dragging = false;
      startPour();
    }
  };

  function moveCup(x, instant) {
    var pad = 58;
    st.cupTargetX = U.clamp(x, pad, st.W - pad);
    if (instant) st.cupX = st.cupTargetX;
  }

  function startPour() {
    if (st.pouring || st.done) return;
    st.pouring = true;
    st.emitted = 0;
    st.emitTimer = 0;
    st.dragVX = 0;
    CH.Audio.play('pourStart');
  }

  /* 点击"倒球"按钮（备选操作） */
  P.pourNow = function () { if (st && !st.done && !st.pouring) startPour(); };

  /* --------------------------------------------------------------- 更新 */
  P.update = function (dt) {
    if (!st) return;
    dt = Math.min(dt, MAX_DT);
    st.t += dt;

    // 杯子平滑跟随
    st.cupX += (st.cupTargetX - st.cupX) * Math.min(1, dt * 16);

    if (st.done) {
      st.endTimer = (st.endTimer || 0) + dt;
      updateParticles(dt);
      if (st.endTimer > 0.55 && !st.reported) {
        st.reported = true;
        P.active = false;
        st.onDone(st.finalTotal);
      }
      return;
    }

    // 发射
    if (st.pouring && st.emitted < st.startBalls) {
      st.emitTimer -= dt;
      while (st.emitTimer <= 0 && st.emitted < st.startBalls) {
        emitBall();
        st.emitted++;
        st.emitTimer += st.emitInterval;
      }
      if (st.emitted >= st.startBalls) {
        // 全部发射完毕
        st.finishEmitAt = st.t;
      }
    }

    // 物理积分
    var sub = dt / SUBSTEPS;
    for (var s = 0; s < SUBSTEPS; s++) stepPhysics(sub);

    updateParticles(dt);
    st.time += dt;

    // 结束判定：所有球落底 或 超时
    if (st.pouring && st.emitted >= st.startBalls && st.balls.length === 0) {
      if (st.emptyTimer == null) st.emptyTimer = 0;
      st.emptyTimer += dt;
      if (st.emptyTimer > 0.35) finish();
    }
    if (st.time > MAX_TIME) finish();

    st.onUpdate(st.collected, st.pouring);
  };

  function emitBall() {
    var spread = (Math.random() - 0.5) * 34;
    st.balls.push({
      x: st.cupX + (Math.random() - 0.5) * 22,
      y: st.H * 0.125,
      vx: spread * 0.6,
      vy: 90 + Math.random() * 60,
      r: BALL_R,
      value: 1,
      hitCd: 0
    });
  }

  /* --------------------------------------------------------------- 物理 */
  function stepPhysics(dt) {
    var L = st.layout, W = st.W, H = st.H;
    var potY = L.potY;
    var balls = st.balls;
    var i, b;

    for (i = balls.length - 1; i >= 0; i--) {
      b = balls[i];
      var prevX = b.x, prevY = b.y;

      b.vy += GRAV * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.vx > 1400) b.vx = 1400; else if (b.vx < -1400) b.vx = -1400;
      if (b.hitCd > 0) b.hitCd -= dt;

      // 侧壁
      if (b.x < L.left + b.r) { b.x = L.left + b.r; b.vx = -b.vx * E_WALL; }
      if (b.x > L.right - b.r) { b.x = L.right - b.r; b.vx = -b.vx * E_WALL; }

      // 钉（圆）
      for (var p = 0; p < L.pegs.length; p++) {
        var pg = L.pegs[p];
        var dx = b.x - pg.x, dy = b.y - pg.y;
        var rr = b.r + pg.r;
        var d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.0001) {
          var dist = Math.sqrt(d2);
          var nx = dx / dist, ny = dy / dist;
          b.x = pg.x + nx * rr; b.y = pg.y + ny * rr;
          var vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            b.vx -= (1 + E_PEG) * vn * nx;
            b.vy -= (1 + E_PEG) * vn * ny;
            if (Math.abs(vn) > 180) { CH.Audio.play('ballHit'); spawnSpark(pg.x, pg.y - pg.r, 1); }
          }
          pg.flash = 0.12;
        }
      }

      // 弹板（实心短横段，向上反弹）
      for (var tI = 0; tI < L.tramps.length; tI++) {
        var tr = L.tramps[tI];
        var hw = tr.w / 2;
        if (b.x > tr.x - hw && b.x < tr.x + hw) {
          var topEdge = tr.y - b.r;
          if (b.y > topEdge && prevY <= topEdge + 6 && b.vy > 0) {
            b.y = topEdge;
            b.vy = -Math.abs(b.vy) * E_TRAMP - 160;
            /* 横向踢出，避免球在原地反复弹跳刷倍率 */
            b.vx += (b.x - tr.x) * 2.2 + (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 90);
            tr.flash = 0.2;
            CH.Audio.play('multiply', 1);
            spawnSpark(b.x, tr.y, 5);
          }
        }
      }

      // 斜向导流板
      for (var dI = 0; dI < L.deflectors.length; dI++) {
        segCollide(b, L.deflectors[dI], E_WALL);
      }

      // 倍率条（触发式，穿过即生效）
      for (var gI = 0; gI < L.gates.length; gI++) {
        var gt = L.gates[gI];
        if (gt.flash > 0) gt.flash -= dt;
        var ghw = gt.w / 2;
        if (prevY < gt.y && b.y >= gt.y && b.x > gt.x - ghw && b.x < gt.x + ghw) {
          triggerGate(gt, b, i);
          if (b.dead) break;
        }
      }
      if (b.dead) { balls.splice(i, 1); continue; }

      // 落袋结算
      if (b.y >= potY) {
        st.collected += b.value;
        st.potPulse = 1;
        spawnCollect(b.x, potY);
        CH.Audio.play('collect');
        balls.splice(i, 1);
        continue;
      }
      // 越界保护
      if (b.y > H + 60 || b.x < -40 || b.x > W + 40) { balls.splice(i, 1); }
    }
  }

  function segCollide(b, seg, e) {
    var x1 = seg.x1, y1 = seg.y1, x2 = seg.x2, y2 = seg.y2;
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return;
    var t = ((b.x - x1) * dx + (b.y - y1) * dy) / len2;
    t = U.clamp(t, 0, 1);
    var cx = x1 + dx * t, cy = y1 + dy * t;
    var nx = b.x - cx, ny = b.y - cy;
    var d = Math.sqrt(nx * nx + ny * ny);
    if (d < b.r && d > 0.0001) {
      nx /= d; ny /= d;
      b.x = cx + nx * b.r; b.y = cy + ny * b.r;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    }
  }

  /* 倍率条触发 */
  function triggerGate(gt, b, idx) {
    var label, color;
    if (gt.type === 'mul') {
      var N = gt.value;
      var val = b.value;
      var canSplit = st.balls.length + (N - 1) <= D.BALL_CAP_SPRITES;
      if (canSplit) {
        for (var i = 1; i < N; i++) {
          st.balls.push({
            x: b.x + (Math.random() - 0.5) * 16,
            y: gt.y + 3,
            vx: b.vx * 0.6 + (Math.random() - 0.5) * 130,
            vy: Math.abs(b.vy) * 0.5 + 40,
            r: BALL_R, value: val, hitCd: 0.06
          });
        }
        b.hitCd = 0.06;
      } else {
        b.value = val * N;
      }
      label = 'x' + N; color = '#63e06a';
      gt.flash = 0.28;
      spawnBurst(b.x, gt.y, N, color);
      CH.Audio.play('multiply', Math.min(N, 6));
      pushPopup(gt.x, gt.y - 6, 'x' + N, color);
    } else if (gt.type === 'add') {
      var K = gt.value;
      if (st.balls.length + K <= D.BALL_CAP_SPRITES) {
        for (var j = 0; j < K; j++) {
          st.balls.push({
            x: b.x + (Math.random() - 0.5) * 26,
            y: gt.y + 3,
            vx: (Math.random() - 0.5) * 150,
            vy: Math.abs(b.vy) * 0.5 + 40,
            r: BALL_R, value: 1, hitCd: 0.06
          });
        }
      } else { b.value = b.value + K; }
      label = '+' + K; color = '#57e0ff';
      gt.flash = 0.28;
      spawnBurst(b.x, gt.y, Math.min(K, 8), color);
      CH.Audio.play('buy');
      pushPopup(gt.x, gt.y - 6, '+' + K, color);
    } else if (gt.type === 'neg') {
      b.value = Math.max(0, b.value - gt.value);
      label = '-' + gt.value; color = '#ff5d6c';
      gt.flash = 0.28;
      spawnBurst(b.x, gt.y, 4, color);
      CH.Audio.play('deny');
      pushPopup(gt.x, gt.y - 6, '-' + gt.value, color);
      if (b.value <= 0) { b.dead = true; }
    } else if (gt.type === 'wild') {
      var opts = [{ t: 'mul', v: 2 }, { t: 'mul', v: 3 }, { t: 'mul', v: 5 }, { t: 'add', v: 8 }, { t: 'mul', v: 4 }];
      var pick = opts[Math.floor(Math.random() * opts.length)];
      if (pick.t === 'mul') {
        var M = pick.v;
        if (st.balls.length + (M - 1) <= D.BALL_CAP_SPRITES) {
          for (var m = 1; m < M; m++) st.balls.push({ x: b.x + (Math.random() - 0.5) * 16, y: gt.y + 3, vx: b.vx * 0.6 + (Math.random() - 0.5) * 150, vy: Math.abs(b.vy) * 0.5 + 40, r: BALL_R, value: b.value, hitCd: 0.06 });
          b.hitCd = 0.06;
        } else b.value *= M;
        label = 'x' + M;
      } else {
        var A = pick.v;
        if (st.balls.length + A <= D.BALL_CAP_SPRITES) {
          for (var q = 0; q < A; q++) st.balls.push({ x: b.x + (Math.random() - 0.5) * 26, y: gt.y + 3, vx: (Math.random() - 0.5) * 150, vy: Math.abs(b.vy) * 0.5 + 40, r: BALL_R, value: 1, hitCd: 0.06 });
        } else b.value += A;
        label = '+' + A;
      }
      color = '#ffcd3c';
      gt.flash = 0.32;
      spawnBurst(b.x, gt.y, 10, color);
      CH.Audio.play('levelUp');
      pushPopup(gt.x, gt.y - 6, label, color);
    }
  }

  /* --------------------------------------------------------------- 特效 */
  function spawnSpark(x, y, n) {
    for (var i = 0; i < n; i++) st.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 70, life: 0.35, max: 0.35, r: 1.6, c: '#ffffff', g: 300 });
  }
  function spawnCollect(x, y) {
    for (var i = 0; i < 5; i++) st.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 160 - 40, life: 0.5, max: 0.5, r: 2.2, c: '#ffffff', g: 500 });
  }
  function spawnBurst(x, y, n, color) {
    n = Math.min(n + 2, 16);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
      st.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5, max: 0.5, r: 2.6, c: color, g: 260 });
    }
  }
  function pushPopup(x, y, text, color) {
    st.popups.push({ x: x, y: y, text: text, color: color, life: 0.9, max: 0.9 });
  }
  function updateParticles(dt) {
    var i;
    for (i = st.particles.length - 1; i >= 0; i--) {
      var p = st.particles[i];
      p.life -= dt;
      if (p.life <= 0) { st.particles.splice(i, 1); continue; }
      p.vy += (p.g || 300) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = st.popups.length - 1; i >= 0; i--) {
      var u = st.popups[i];
      u.life -= dt;
      u.y -= 34 * dt;
      if (u.life <= 0) st.popups.splice(i, 1);
    }
    if (st.potPulse > 0) st.potPulse -= dt * 3;
  }

  /* --------------------------------------------------------------- 绘制 */
  P.render = function (g) {
    if (!st) return;
    var W = st.W, H = st.H, L = st.layout;

    R.drawBoardBackground(g, st.theme, W, H, st.t * 1000, st.t * 20);

    /* 顶部提示区纵深暗角 */
    var vg = g.createLinearGradient(0, 0, 0, H * 0.22);
    vg.addColorStop(0, 'rgba(8,4,20,.55)');
    vg.addColorStop(1, 'rgba(8,4,20,0)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H * 0.22);

    /* 收集罐 */
    drawPot(g, W, L.potY, H);

    /* 斜向导流板 */
    g.save();
    for (var dI = 0; dI < L.deflectors.length; dI++) {
      var d = L.deflectors[dI];
      g.strokeStyle = '#8a94ad'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(d.x1, d.y1); g.lineTo(d.x2, d.y2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(d.x1, d.y1 - 2); g.lineTo(d.x2, d.y2 - 2); g.stroke();
    }
    g.restore();

    /* 弹板 */
    for (var tI = 0; tI < L.tramps.length; tI++) {
      var tr = L.tramps[tI];
      var hw = tr.w / 2;
      var fl = Math.max(0, tr.flash || 0);
      R.fillRR(g, tr.x - hw, tr.y - 5, tr.w, 11, 5.5, fl > 0 ? '#ffe27a' : '#ff9a3c');
      R.fillRR(g, tr.x - hw + 2, tr.y - 4, tr.w - 4, 3.5, 2, 'rgba(255,255,255,.55)');
      if (fl > 0) { g.globalAlpha = fl * 2.4; R.fillRR(g, tr.x - hw - 4, tr.y - 8, tr.w + 8, 17, 8, 'rgba(255,205,60,.6)'); g.globalAlpha = 1; }
    }

    /* 钉 */
    for (var pI = 0; pI < L.pegs.length; pI++) {
      var pg = L.pegs[pI];
      var pf = Math.max(0, pg.flash || 0);
      g.beginPath(); g.arc(pg.x, pg.y, pg.r, 0, Math.PI * 2);
      var grd = g.createRadialGradient(pg.x - pg.r * 0.4, pg.y - pg.r * 0.4, 1, pg.x, pg.y, pg.r);
      grd.addColorStop(0, pf > 0 ? '#ffffff' : '#e8edf7');
      grd.addColorStop(1, pf > 0 ? '#ffe27a' : '#8e9ab5');
      g.fillStyle = grd; g.fill();
      g.strokeStyle = 'rgba(60,70,95,.5)'; g.lineWidth = 1.5; g.stroke();
      if (pg.flash > 0) pg.flash -= 0.016;
    }

    /* 倍率条 */
    for (var gI = 0; gI < L.gates.length; gI++) {
      drawGate(g, L.gates[gI]);
    }

    /* 球 */
    for (var bI = 0; bI < st.balls.length; bI++) {
      var b = st.balls[bI];
      R.drawBall(g, b.x, b.y, b.r);
    }

    /* 粒子 */
    for (var paI = 0; paI < st.particles.length; paI++) {
      var pa = st.particles[paI];
      g.globalAlpha = U.clamp(pa.life / pa.max, 0, 1);
      g.fillStyle = pa.c;
      g.beginPath(); g.arc(pa.x, pa.y, pa.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    /* 杯子（最上层） */
    if (!st.done) drawCup(g, st, L);

    /* 浮动文字 */
    for (var uI = 0; uI < st.popups.length; uI++) {
      var u = st.popups[uI];
      g.globalAlpha = U.clamp(u.life / u.max, 0, 1);
      R.text(g, u.text, u.x, u.y, { size: 20, color: u.color, stroke: '#0a0616', strokeW: 4 });
      g.globalAlpha = 1;
    }

    /* 瞄准辅助线 */
    if (!st.pouring && !st.done) {
      g.save();
      g.setLineDash([6, 8]);
      g.strokeStyle = 'rgba(255,255,255,.4)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(st.cupX, H * 0.16); g.lineTo(st.cupX, L.potY - 6); g.stroke();
      g.restore();
      // 杯子左右可拖拽指示箭头
      g.globalAlpha = 0.5 + Math.sin(st.t * 4) * 0.25;
      R.text(g, '◀', st.cupX - 46, H * 0.115, { size: 22, color: '#fff', stroke: '#0a0616', strokeW: 4 });
      R.text(g, '▶', st.cupX + 46, H * 0.115, { size: 22, color: '#fff', stroke: '#0a0616', strokeW: 4 });
      g.globalAlpha = 1;
    }
  };

  function drawGate(g, gt) {
    var x = gt.x - gt.w / 2, y = gt.y - gt.h / 2, w = gt.w, h = gt.h;
    var fl = Math.max(0, gt.flash || 0);
    var label, c1, c2, stroke;
    if (gt.type === 'mul') { label = 'x' + gt.value; c1 = '#8ff09a'; c2 = '#2c9b3a'; stroke = '#156018'; }
    else if (gt.type === 'add') { label = '+' + gt.value; c1 = '#a8ecff'; c2 = '#1e9bc4'; stroke = '#0d5f78'; }
    else if (gt.type === 'neg') { label = '-' + gt.value; c1 = '#ff9aa4'; c2 = '#b8202f'; stroke = '#6e0f18'; }
    else { label = '?'; c1 = '#ffe27a'; c2 = '#c98a12'; stroke = '#7a5306'; }

    var wob = fl > 0 ? (Math.random() - 0.5) * 3 : 0;
    var grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    R.fillRR(g, x + wob, y, w, h, h / 2, grd);
    // 高光
    R.fillRR(g, x + 4 + wob, y + 2.5, w - 8, h * 0.3, h * 0.15, 'rgba(255,255,255,.35)');
    R.strokeRR(g, x + wob, y, w, h, h / 2, stroke, 2.5);

    if (fl > 0) {
      g.globalAlpha = Math.min(1, fl * 3);
      R.fillRR(g, x - 5 + wob, y - 5, w + 10, h + 10, (h + 10) / 2, 'rgba(255,255,255,.35)');
      g.globalAlpha = 1;
    }
    R.text(g, label, gt.x + wob, gt.y + 1, { size: 15, color: '#fff', stroke: stroke, strokeW: 3.5 });
  }

  function drawCup(g, st, L) {
    var cx = st.cupX;
    var cy = st.H * 0.095;
    var w = 74, hgt = 52;
    var tilt = U.clamp((st.cupTargetX - st.cupX) * 0.01, -0.22, 0.22);
    g.save();
    g.translate(cx, cy);
    g.rotate(tilt);
    // 杯身
    g.beginPath();
    g.moveTo(-w / 2, -hgt / 2);
    g.lineTo(w / 2, -hgt / 2);
    g.lineTo(w * 0.36, hgt / 2);
    g.lineTo(-w * 0.36, hgt / 2);
    g.closePath();
    var grd = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    grd.addColorStop(0, '#c9d4e6'); grd.addColorStop(0.3, '#ffffff'); grd.addColorStop(0.7, '#eef2fa'); grd.addColorStop(1, '#a9b6cc');
    g.fillStyle = grd; g.fill();
    g.strokeStyle = '#7d8aa5'; g.lineWidth = 2.5; g.stroke();
    // 杯内白球
    g.save();
    g.beginPath(); g.rect(-w / 2, -hgt / 2, w, hgt * 0.62); g.clip();
    for (var i = 0; i < 7; i++) {
      var bx = -w * 0.32 + (i % 4) * (w * 0.21);
      var by = -hgt * 0.1 + Math.floor(i / 4) * 11 + Math.sin(st.t * 3 + i) * 1.5;
      R.drawBall(g, bx, by, 6);
    }
    g.restore();
    // 杯口
    g.beginPath(); g.ellipse(0, -hgt / 2, w / 2, 6, 0, 0, Math.PI * 2);
    g.fillStyle = '#dfe7f5'; g.fill();
    g.strokeStyle = '#8b98b3'; g.lineWidth = 2; g.stroke();
    // 出球口
    g.beginPath(); g.ellipse(0, hgt / 2, w * 0.36, 5, 0, 0, Math.PI * 2);
    g.fillStyle = '#b9c4d8'; g.fill();
    g.restore();
  }

  function drawPot(g, W, potY, H) {
    var w = W * 0.82, x = (W - w) / 2;
    var pulse = Math.max(0, st.potPulse || 0);
    // 罐体
    g.save();
    var grd = g.createLinearGradient(0, potY, 0, H);
    grd.addColorStop(0, '#5a3d99'); grd.addColorStop(1, '#2c1c4e');
    R.fillRR(g, x, potY, w, 60, 14, grd);
    R.strokeRR(g, x, potY, w, 60, 14, '#8a6bd0', 3);
    // 罐口
    R.fillRR(g, x - 6, potY - 8, w + 12, 16, 8, '#3a2564');
    R.strokeRR(g, x - 6, potY - 8, w + 12, 16, 8, '#8a6bd0', 2.5);
    if (pulse > 0) {
      g.globalAlpha = pulse * 0.6;
      R.fillRR(g, x - 8, potY - 10, w + 16, 20, 10, '#ffcd3c');
      g.globalAlpha = 1;
    }
    // 计数
    var display = Math.floor(st.collected * (1 + st.bonus));
    R.text(g, U.fmt(display), W / 2, potY + 30, { size: 30, color: '#fff', stroke: '#1a1030', strokeW: 5 });
    R.text(g, '本波球数', W / 2, potY + 52, { size: 11, color: 'rgba(255,255,255,.7)' });
    if (st.bonus > 0) {
      R.text(g, '+' + Math.round(st.bonus * 100) + '% 加成', W / 2, potY + 66, { size: 11, color: '#63e06a' });
    }
    g.restore();
  }
})();
