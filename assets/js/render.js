/* ==========================================================================
   render.js - Canvas 上下文管理 + 通用绘制（背景 / 杯子角色 / 敌人 / 特效）
   挂载 CH.Canvas 与 CH.Render
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U;
  var R = (CH.Render = {});

  /* --------------------------------------------------------------- Canvas */
  var C = (CH.Canvas = {});
  C.canvas = null; C.ctx = null; C.W = 480; C.H = 854; C.dpr = 1;

  C.setup = function () {
    C.canvas = document.getElementById('stage');
    C.ctx = C.canvas.getContext('2d');
    C.resize();
    window.addEventListener('resize', C.resize);
    window.addEventListener('orientationchange', function () { setTimeout(C.resize, 120); });
  };

  C.resize = function () {
    var frame = document.getElementById('frame');
    if (!frame || !C.canvas) return;
    var rect = frame.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    C.W = w; C.H = h; C.dpr = dpr;
    C.canvas.width = Math.round(w * dpr);
    C.canvas.height = Math.round(h * dpr);
    C.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    C.ctx.imageSmoothingEnabled = true;
  };

  C.clear = function (color) {
    var g = C.ctx;
    if (color) { g.fillStyle = color; g.fillRect(0, 0, C.W, C.H); }
    else g.clearRect(0, 0, C.W, C.H);
  };

  /* --------------------------------------------------------------- 基础图元 */
  R.roundRect = function (g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  };

  R.fillRR = function (g, x, y, w, h, r, fill) { R.roundRect(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); };
  R.strokeRR = function (g, x, y, w, h, r, color, lw) {
    R.roundRect(g, x, y, w, h, r); g.strokeStyle = color; g.lineWidth = lw || 2; g.stroke();
  };

  R.text = function (g, str, x, y, opt) {
    opt = opt || {};
    g.save();
    g.font = (opt.weight || '800') + ' ' + (opt.size || 16) + 'px ' + (opt.font || '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif');
    g.textAlign = opt.align || 'center';
    g.textBaseline = opt.baseline || 'middle';
    if (opt.stroke) {
      g.lineWidth = opt.strokeW || 4;
      g.strokeStyle = opt.stroke;
      g.lineJoin = 'round';
      g.strokeText(str, x, y);
    }
    g.fillStyle = opt.color || '#fff';
    if (opt.shadow) { g.shadowColor = opt.shadow; g.shadowBlur = opt.shadowBlur || 6; g.shadowOffsetY = opt.shadowY || 2; }
    g.fillText(str, x, y);
    g.restore();
  };

  /* 带描边的圆角标签（倍率条 / 数值） */
  R.pill = function (g, x, y, w, h, fill, stroke, r) {
    R.fillRR(g, x, y, w, h, r == null ? h / 2 : r, fill);
    if (stroke) R.strokeRR(g, x, y, w, h, r == null ? h / 2 : r, stroke, 2);
  };

  /* --------------------------------------------------------------- 背景 */
  /* 视差滚动奇幻背景：渐变天空 + 云/星 + 双层山丘 + 地面 */
  R.drawBackground = function (g, theme, W, H, time, scroll, opt) {
    opt = opt || {};
    var th = theme || { sky: ['#8fe3ff', '#d8f8c8'], hill: '#3f8f4a', hill2: '#2b6b3c', ground: '#3f8f4a', ground2: '#2b6b3c', accent: '#7ed957', fog: 'rgba(120,220,140,.10)' };
    var s = scroll || 0;

    var sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    /* 太阳/月亮光晕 */
    var sunX = W * 0.76 - (s * 0.05) % (W * 1.4);
    var sunY = H * 0.16;
    var glow = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, H * 0.22);
    glow.addColorStop(0, 'rgba(255,255,220,.85)');
    glow.addColorStop(0.35, 'rgba(255,245,190,.28)');
    glow.addColorStop(1, 'rgba(255,245,190,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H * 0.5);

    /* 云朵 */
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#ffffff';
    for (var i = 0; i < 5; i++) {
      var cw = 70 + i * 18;
      var cx = ((i * 137 - s * 0.12) % (W + 200)) - 100;
      var cy = H * (0.06 + (i % 3) * 0.055);
      R.roundRect(g, cx, cy, cw, 20, 10); g.fill();
      R.roundRect(g, cx + 16, cy - 10, cw * 0.55, 20, 10); g.fill();
    }
    g.restore();

    /* 两层山丘 */
    function hills(color, amp, base, speed, freq) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(-10, H);
      var step = 24;
      for (var x = -10; x <= W + 10; x += step) {
        var y = base + Math.sin((x + s * speed) * freq) * amp + Math.sin((x + s * speed) * freq * 2.3) * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(W + 10, H);
      g.closePath();
      g.fill();
    }
    hills(th.hill2, H * 0.035, H * 0.44, 0.06, 0.011);
    hills(th.hill, H * 0.028, H * 0.52, 0.14, 0.017);

    /* 地面 */
    var groundY = opt.groundY != null ? opt.groundY : H * 0.72;
    var gg = g.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, th.ground);
    gg.addColorStop(1, th.ground2);
    g.fillStyle = gg;
    g.fillRect(0, groundY, W, H - groundY);

    /* 地面纹理条纹 */
    g.save();
    g.globalAlpha = 0.14;
    g.fillStyle = '#ffffff';
    for (var k = 0; k < 26; k++) {
      var gx = ((k * 53 - s * 0.5) % (W + 120)) - 60;
      R.roundRect(g, gx, groundY + 8 + (k % 3) * 14, 22, 5, 3);
      g.fill();
    }
    g.restore();

    /* 前景雾/氛围 */
    if (th.fog) {
      var fg = g.createLinearGradient(0, H * 0.5, 0, H);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, th.fog);
      g.fillStyle = fg;
      g.fillRect(0, 0, W, H);
    }
    return groundY;
  };

  /* 竖向版背景（倒球关卡用，地面更靠下） */
  R.drawBoardBackground = function (g, theme, W, H, time, scroll) {
    return R.drawBackground(g, theme, W, H, time, scroll, { groundY: H * 0.94 });
  };

  /* --------------------------------------------------------------- 白球 */
  R.drawBall = function (g, x, y, r) {
    var rg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.6, '#eef2fa');
    rg.addColorStop(1, '#b9c2d6');
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = rg; g.fill();
    g.strokeStyle = 'rgba(120,130,160,.55)'; g.lineWidth = Math.max(1, r * 0.16); g.stroke();
    g.beginPath(); g.arc(x - r * 0.32, y - r * 0.36, r * 0.26, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
  };

  /* --------------------------------------------------------------- 杯子角色 */
  /* 通用杯身：上宽下窄的梯形 + 杯口 */
  function cupBody(g, cx, topY, w, h, colors) {
    var topW = w, botW = w * 0.66;
    g.beginPath();
    g.moveTo(cx - topW / 2, topY);
    g.lineTo(cx + topW / 2, topY);
    g.lineTo(cx + botW / 2, topY + h);
    g.lineTo(cx - botW / 2, topY + h);
    g.closePath();
    var grd = g.createLinearGradient(cx - topW / 2, 0, cx + topW / 2, 0);
    grd.addColorStop(0, colors.trim);
    grd.addColorStop(0.35, colors.body);
    grd.addColorStop(0.75, colors.body);
    grd.addColorStop(1, colors.trim);
    g.fillStyle = grd;
    g.fill();
    // 杯口高光
    g.beginPath();
    g.ellipse(cx, topY, topW / 2, w * 0.09, 0, 0, Math.PI * 2);
    g.fillStyle = colors.accent;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; g.stroke();
    // 底部阴影
    g.beginPath();
    g.ellipse(cx, topY + h, botW / 2, w * 0.05, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fill();
  }

  function cupFace(g, cx, cy, w, colors, blink) {
    var ex = w * 0.19, ey = 0;
    g.fillStyle = '#fff';
    ellipse(g, cx - ex, cy, w * 0.13, w * 0.15);
    ellipse(g, cx + ex, cy, w * 0.13, w * 0.15);
    if (blink) {
      g.fillStyle = colors.face;
      g.beginPath(); g.moveTo(cx - ex - w * 0.11, cy); g.lineTo(cx - ex + w * 0.11, cy); g.lineWidth = 2.5; g.strokeStyle = colors.face; g.stroke();
      g.beginPath(); g.moveTo(cx + ex - w * 0.11, cy); g.lineTo(cx + ex + w * 0.11, cy); g.stroke();
    } else {
      g.fillStyle = colors.face;
      ellipse(g, cx - ex, cy + 1, w * 0.065, w * 0.085);
      ellipse(g, cx + ex, cy + 1, w * 0.065, w * 0.085);
      g.fillStyle = '#fff';
      ellipse(g, cx - ex + w * 0.02, cy - w * 0.02, w * 0.024, w * 0.028);
      ellipse(g, cx + ex + w * 0.02, cy - w * 0.02, w * 0.024, w * 0.028);
    }
    // 腮红
    g.fillStyle = 'rgba(255,120,120,.35)';
    ellipse(g, cx - w * 0.30, cy + w * 0.13, w * 0.08, w * 0.05);
    ellipse(g, cx + w * 0.30, cy + w * 0.13, w * 0.08, w * 0.05);
  }

  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

  /* 武器绘制 */
  function drawWeapon(g, heroId, cx, cy, s, dir, swing) {
    g.save();
    g.translate(cx, cy);
    g.scale(dir, 1);
    g.rotate(swing || 0);
    if (heroId === 'cowboy') {
      R.fillRR(g, 6 * s, -4 * s, 20 * s, 7 * s, 2 * s, '#4a4a52');
      R.fillRR(g, 24 * s, -2.5 * s, 5 * s, 4 * s, 1.5 * s, '#2e2e34');
      R.fillRR(g, 4 * s, -6 * s, 8 * s, 11 * s, 2 * s, '#8a5a25');
    } else if (heroId === 'barbarian') {
      R.fillRR(g, 8 * s, -3 * s, 20 * s, 5 * s, 2 * s, '#7a4a20');
      g.beginPath();
      g.moveTo(25 * s, -14 * s); g.lineTo(38 * s, -10 * s); g.lineTo(34 * s, 0); g.lineTo(38 * s, 10 * s); g.lineTo(25 * s, 14 * s);
      g.closePath(); g.fillStyle = '#cfd6e0'; g.fill();
      g.strokeStyle = '#8a929e'; g.lineWidth = 1.5 * s; g.stroke();
    } else if (heroId === 'rogue') {
      for (var i = 0; i < 2; i++) {
        g.save(); g.rotate(i * 0.35 - 0.17);
        R.fillRR(g, 8 * s, -2 * s, 14 * s, 4 * s, 1.6 * s, '#8a8f9e');
        g.beginPath(); g.moveTo(22 * s, -3 * s); g.lineTo(30 * s, 0); g.lineTo(22 * s, 3 * s); g.closePath();
        g.fillStyle = '#e6ecf5'; g.fill();
        g.restore();
      }
    } else if (heroId === 'knight') {
      // 盾牌
      g.beginPath();
      g.moveTo(6 * s, -14 * s); g.lineTo(22 * s, -12 * s); g.lineTo(24 * s, 2 * s);
      g.lineTo(14 * s, 14 * s); g.lineTo(4 * s, 2 * s); g.closePath();
      g.fillStyle = '#dfe8f5'; g.fill();
      g.strokeStyle = '#8a97ab'; g.lineWidth = 2 * s; g.stroke();
      g.fillStyle = '#ffcd3c';
      g.beginPath(); g.arc(14 * s, -1 * s, 4 * s, 0, Math.PI * 2); g.fill();
      // 剑
      R.fillRR(g, 16 * s, -24 * s, 4 * s, 22 * s, 1.5 * s, '#e6ecf5');
    } else if (heroId === 'ninja') {
      g.beginPath();
      for (var k = 0; k < 4; k++) {
        var a = k * Math.PI / 2 + Math.PI / 4;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s);
      }
      g.strokeStyle = '#cfd6e0'; g.lineWidth = 3.5 * s; g.lineCap = 'round'; g.stroke();
      g.beginPath(); g.arc(0, 0, 3.5 * s, 0, Math.PI * 2); g.fillStyle = '#5a5f7a'; g.fill();
    } else {
      // woodie 藤条
      R.fillRR(g, 6 * s, -3 * s, 20 * s, 5 * s, 2 * s, '#6ab04c');
      g.beginPath();
      g.ellipse(26 * s, 0, 6 * s, 9 * s, 0.4, 0, Math.PI * 2);
      g.fillStyle = '#8ed860'; g.fill();
    }
    g.restore();
  }

  /* 绘制英雄：x,y 为脚底中心 */
  R.drawHero = function (g, hero, x, y, h, dir, t, anim) {
    anim = anim || {};
    var colors = hero.colors;
    var bob = Math.sin(t * 0.006) * (h * 0.015);
    var cupH = h * 0.60;
    var cupW = h * 0.62;
    var topY = y - h + bob;
    var cx = x;

    g.save();
    // 影子
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath(); g.ellipse(x, y + 2, h * 0.26, h * 0.06, 0, 0, Math.PI * 2); g.fill();

    // 腿
    var legSwing = anim.walk ? Math.sin(t * 0.02) * h * 0.06 : 0;
    g.fillStyle = colors.trim;
    R.fillRR(g, cx - cupW * 0.26, y - h * 0.30 + bob, cupW * 0.16, h * 0.30, h * 0.05);
    R.fillRR(g, cx + cupW * 0.10, y - h * 0.30 + bob, cupW * 0.16, h * 0.30, h * 0.05);

    // 后置手臂
    var armBob = anim.attack ? Math.sin(anim.attack * Math.PI) * 0.9 : 0;
    // 杯身
    cupBody(g, cx, topY, cupW, cupH, colors);
    // 表情
    cupFace(g, cx, topY + cupH * 0.34, cupW, colors, anim.blink);
    // 武器（在朝向侧）
    var swing = anim.attack ? (-0.9 + anim.attack * 1.8) : Math.sin(t * 0.004) * 0.08;
    drawWeapon(g, hero.id, cx + dir * cupW * 0.42, topY + cupH * 0.55, h / 46, dir, swing);
    g.restore();
    return { cx: cx, topY: topY, cupH: cupH, cupW: cupW, cy: topY + cupH * 0.4 };
  };

  /* 绘制敌人：x,y 为脚底中心 */
  R.drawEnemy = function (g, def, x, y, h, dir, t, anim) {
    anim = anim || {};
    var isBoss = !!(anim.boss || def.boss);
    var cx = x;
    var bodyH = h * (def.flying ? 0.7 : 0.82);
    var bodyW = h * (isBoss ? 0.85 : 0.78);
    var cyBase = def.flying ? y - h * 0.75 + Math.sin(t * 0.005) * h * 0.06 : y - bodyH * 0.5;

    g.save();
    // 影子
    if (!def.flying) {
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.beginPath(); g.ellipse(x, y + 2, h * 0.30, h * 0.07, 0, 0, Math.PI * 2); g.fill();
    }

    var hitFlash = anim.hitFlash > 0;
    var body = def.color, trim = def.trim || '#333';
    if (hitFlash) { body = '#ffffff'; trim = '#ffd0d0'; }

    var squash = anim.hitFlash > 0 ? 1.12 : (1 + Math.sin(t * 0.008) * 0.03);

    // 身体（圆润方块 / 团子）
    g.save();
    g.translate(cx, cyBase);
    g.scale(1 / squash, squash);
    R.fillRR(g, -bodyW / 2, -bodyH / 2, bodyW, bodyH, Math.min(bodyW, bodyH) * 0.38, body);
    // 底部阴影
    var sh = g.createLinearGradient(0, -bodyH / 2, 0, bodyH / 2);
    sh.addColorStop(0, 'rgba(255,255,255,.22)');
    sh.addColorStop(1, 'rgba(0,0,0,.25)');
    R.fillRR(g, -bodyW / 2, -bodyH / 2, bodyW, bodyH, Math.min(bodyW, bodyH) * 0.38, sh);
    g.restore();

    // 眼睛
    var ex = bodyW * 0.19, ey = cyBase - bodyH * 0.08;
    g.fillStyle = '#fff';
    ellipse(g, cx - ex, ey, bodyW * 0.15, bodyW * 0.17);
    ellipse(g, cx + ex, ey, bodyW * 0.15, bodyW * 0.17);
    g.fillStyle = '#1a1030';
    ellipse(g, cx - ex + dir * bodyW * 0.03, ey, bodyW * 0.075, bodyW * 0.10);
    ellipse(g, cx + ex + dir * bodyW * 0.03, ey, bodyW * 0.075, bodyW * 0.10);

    // 嘴（愤怒）
    g.strokeStyle = trim; g.lineWidth = Math.max(1.5, bodyW * 0.05); g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - bodyW * 0.12, cyBase + bodyH * 0.14);
    g.quadraticCurveTo(cx, cyBase + bodyH * 0.06, cx + bodyW * 0.12, cyBase + bodyH * 0.14);
    g.stroke();

    // 角 / 造型
    if (def.id === 'goblin' || def.id === 'orc') {
      g.fillStyle = trim;
      g.beginPath(); g.moveTo(cx - bodyW * 0.44, cyBase - bodyH * 0.30);
      g.lineTo(cx - bodyW * 0.62, cyBase - bodyH * 0.52); g.lineTo(cx - bodyW * 0.30, cyBase - bodyH * 0.42); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + bodyW * 0.44, cyBase - bodyH * 0.30);
      g.lineTo(cx + bodyW * 0.62, cyBase - bodyH * 0.52); g.lineTo(cx + bodyW * 0.30, cyBase - bodyH * 0.42); g.closePath(); g.fill();
    }
    if (def.id === 'bat' || def.flying) {
      var flap = Math.sin(t * 0.02) * 0.4;
      g.fillStyle = body;
      g.save(); g.translate(cx - bodyW * 0.5, cyBase); g.rotate(-0.3 - flap);
      R.roundRect(g, -bodyW * 0.7, -h * 0.14, bodyW * 0.7, h * 0.3, 6); g.fill(); g.restore();
      g.save(); g.translate(cx + bodyW * 0.5, cyBase); g.rotate(0.3 + flap);
      R.roundRect(g, 0, -h * 0.14, bodyW * 0.7, h * 0.3, 6); g.fill(); g.restore();
    }
    if (def.id === 'mage') {
      g.fillStyle = trim;
      g.beginPath(); g.moveTo(cx, cyBase - bodyH * 0.9); g.lineTo(cx - bodyW * 0.5, cyBase - bodyH * 0.4);
      g.lineTo(cx + bodyW * 0.5, cyBase - bodyH * 0.4); g.closePath(); g.fill();
      g.fillStyle = '#ffcd3c'; g.beginPath(); g.arc(cx, cyBase - bodyH * 0.95, bodyW * 0.9, 0, Math.PI * 2); g.fill();
    }
    if (def.id === 'archer') {
      g.strokeStyle = '#8a5f16'; g.lineWidth = 3; g.beginPath();
      g.arc(cx + dir * bodyW * 0.45, cyBase, bodyH * 0.3, -1.1, 1.1); g.stroke();
    }
    if (def.id === 'brute' || def.id === 'golem') {
      g.strokeStyle = trim; g.lineWidth = Math.max(2, bodyW * 0.06);
      g.beginPath(); g.moveTo(cx - bodyW * 0.3, cyBase - bodyH * 0.2); g.lineTo(cx + bodyW * 0.3, cyBase + bodyH * 0.1); g.stroke();
    }
    if (def.id === 'spirit') {
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.beginPath(); g.arc(cx, cyBase, bodyW * 0.75, 0, Math.PI * 2); g.fill();
    }
    // Boss 皇冠
    if (isBoss) {
      g.fillStyle = '#ffcd3c';
      var cy2 = cyBase - bodyH * 0.62;
      g.beginPath();
      g.moveTo(cx - bodyW * 0.34, cy2 + 12); g.lineTo(cx - bodyW * 0.34, cy2);
      g.lineTo(cx - bodyW * 0.17, cy2 + 8); g.lineTo(cx, cy2 - 6);
      g.lineTo(cx + bodyW * 0.17, cy2 + 8); g.lineTo(cx + bodyW * 0.34, cy2);
      g.lineTo(cx + bodyW * 0.34, cy2 + 12); g.closePath(); g.fill();
      g.strokeStyle = '#c98a12'; g.lineWidth = 2; g.stroke();
    }
    g.restore();
    return { cx: cx, cy: cyBase, w: bodyW, h: bodyH };
  };

  /* 血条 */
  R.hpBar = function (g, x, y, w, h, pct, fill, bg) {
    pct = U.clamp(pct, 0, 1);
    R.fillRR(g, x, y, w, h, h / 2, bg || 'rgba(0,0,0,.55)');
    if (pct > 0) R.fillRR(g, x + 1.5, y + 1.5, (w - 3) * pct, h - 3, (h - 3) / 2, fill || '#63e06a');
  };
})();
