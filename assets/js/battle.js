/* ==========================================================================
   battle.js - 自动战斗引擎（波次 / Boss / 投射物 / 伤害数字 / 特效）
   英雄自动攻击，玩家在战斗外进行倒球与技能购买
   挂载 CH.Battle
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U, R = CH.Render, C = CH.Canvas;
  var B = (CH.Battle = {});

  var GRAV = 900;
  var st = null;
  B.active = false;

  /* --------------------------------------------------------------- 启动 */
  B.start = function (opt) {
    var W = C.W, H = C.H;
    st = {
      W: W, H: H,
      theme: opt.theme || null,
      stats: opt.stats,
      wave: opt.wave,          // {isBoss, bossId, spawn:{type:count}}
      chapter: opt.chapter || 1,
      stage: opt.stage || 1,
      waveIndex: opt.waveIndex || 0,
      groundY: H * 0.72,
      hero: {
        x: W * 0.17, hp: opt.stats.maxHp, maxHp: opt.stats.maxHp,
        atkTimer: 0.6, anim: { attack: 0, blink: false }, hurt: 0, walk: false
      },
      enemies: [],
      proj: [],
      eProj: [],
      parts: [],
      floats: [],
      ballDrops: 0,
      kills: 0,
      spawnQueue: [],
      spawnTimer: 0,
      t: 0,
      time: 0,
      banner: opt.banner || null,
      bannerT: 1.6,
      over: false,
      result: null,
      onEnd: opt.onEnd || function () { },
      onUpdate: opt.onUpdate || function () { }
    };

    if (!opt.heroHp || opt.heroHp <= 0) st.hero.hp = st.stats.maxHp; else st.hero.hp = opt.heroHp;

    buildSpawns();
    B.active = true;
    if (st.wave.isBoss) CH.Audio.play('boss');
    return st;
  };

  function buildSpawns() {
    var w = st.wave;
    if (w.isBoss) {
      st.spawnQueue.push({ bossId: w.bossId, boss: true, delay: 0.4 });
    } else {
      var q = [];
      for (var key in w.spawn) {
        if (!Object.prototype.hasOwnProperty.call(w.spawn, key)) continue;
        for (var i = 0; i < w.spawn[key]; i++) q.push(key);
      }
      q = U.shuffle(q);
      for (var j = 0; j < q.length; j++) st.spawnQueue.push({ key: q[j], delay: j * 1.0 + 0.2 });
    }
  }

  B.isActive = function () { return B.active; };
  B.getHeroHp = function () { return st ? st.hero.hp : 0; };
  B.getState = function () { return st; };

  /* --------------------------------------------------------------- 更新 */
  B.update = function (dt) {
    if (!st || st.over) {
      if (st && st.over) {
        st.t += dt;
        st.endT = (st.endT || 0) + dt;
        updateFx(dt);
        if (st.endT > 1.0 && !st.reported) { st.reported = true; B.active = false; st.onEnd(st.result); }
      }
      return;
    }
    dt = Math.min(dt, 1 / 30);
    st.t += dt;
    st.time += dt;
    if (st.bannerT > 0) st.bannerT -= dt;

    /* 出场 */
    st.spawnTimer += dt;
    while (st.spawnQueue.length && st.spawnQueue[0].delay <= st.spawnTimer) {
      spawnEnemy(st.spawnQueue.shift());
    }

    var hero = st.hero, s = st.stats;

    /* 生命回复 */
    if (s.regen > 0 && hero.hp > 0) hero.hp = Math.min(hero.maxHp, hero.hp + s.regen * dt);

    /* 英雄攻击动画衰减 */
    if (hero.anim.attack > 0) hero.anim.attack = Math.max(0, hero.anim.attack - dt / 0.22);
    if (hero.hurt > 0) hero.hurt -= dt;
    if (Math.random() < dt * 0.3) { hero.anim.blink = true; setTimeout(function () { if (st) st.hero.anim.blink = false; }, 130); }

    /* 英雄攻击 */
    hero.atkTimer -= dt;
    if (hero.atkTimer <= 0 && hero.hp > 0) {
      var did = heroAttack();
      if (did) { hero.atkTimer = (s.atkMs / 1000); hero.anim.attack = 1; }
      else hero.atkTimer = 0.12;
    }

    /* 敌人行为 */
    for (var i = st.enemies.length - 1; i >= 0; i--) {
      var e = st.enemies[i];
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.dead) continue;

      /* 远程敌人停在英雄近战射程之内，避免近战英雄被"放风筝"卡死 */
      var standoff = e.ranged ? Math.min(st.W * 0.44, hero.x + 78) : (hero.x + 44);
      var targetX = standoff;
      if (e.x > targetX + 2) {
        e.x -= e.speed * dt;
        e.walking = true;
      } else { e.walking = false; }

      // 攻击
      e.atkTimer -= dt;
      if (e.atkTimer <= 0 && e.x <= targetX + 20) {
        if (e.ranged) {
          shootEnemyProj(e);
          e.atkTimer = (e.atkMs || 1800) / 1000;
        } else {
          heroTakeDamage(e.dmg, e);
          e.atkTimer = e.attackCd || 1.0;
          e.attackAnim = 1;
        }
      }
      if (e.attackAnim > 0) e.attackAnim = Math.max(0, e.attackAnim - dt / 0.25);

      // Boss 技能
      if (e.boss) {
        e.abilityTimer = (e.abilityTimer || 3) - dt;
        if (e.abilityTimer <= 0) {
          e.abilityTimer = e.ability === 'slam' ? 5.0 : 4.2;
          if (e.ability === 'slam') {
            if (e.x - hero.x < 220) { heroTakeDamage(e.dmg * 1.2, e, true); screenShake(9); spawnRing(hero.x, st.groundY, '#ff6b3a'); }
          } else {
            for (var fb = 0; fb < 4; fb++) {
              st.eProj.push({ x: e.x, y: e.cy - 10, vx: -260 - Math.random() * 80, vy: -180 + fb * 90 - 60, dmg: e.dmg * 0.7, r: 8, color: '#ff8a3c', from: 'boss' });
            }
          }
          CH.Audio.play('boss');
        }
      }
    }

    /* 英雄投射物 */
    for (var p = st.proj.length - 1; p >= 0; p--) {
      var pr = st.proj[p];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      var removed = false;
      for (var ei = 0; ei < st.enemies.length; ei++) {
        var en = st.enemies[ei];
        if (en.dead) continue;
        if (U.dist(pr.x, pr.y, en.x, en.cy) < en.w / 2 + pr.r) {
          if (pr.hits.indexOf(en) >= 0) continue;
          pr.hits.push(en);
          damageEnemy(en, pr.dmg, pr.crit);
          if (pr.pierce > 0) pr.pierce--; else { removed = true; }
          spawnImpact(pr.x, pr.y, pr.color);
          break;
        }
      }
      if (pr.x > st.W + 40 || pr.x < -40 || pr.y > st.H + 40 || pr.y < -60) removed = true;
      if (removed) st.proj.splice(p, 1);
    }

    /* 敌方投射物 */
    for (var ep = st.eProj.length - 1; ep >= 0; ep--) {
      var epr = st.eProj[ep];
      epr.vy += GRAV * 0.5 * dt;
      epr.x += epr.vx * dt; epr.y += epr.vy * dt;
      if (U.dist(epr.x, epr.y, hero.x, st.groundY - 40) < 34) {
        heroTakeDamage(epr.dmg, null);
        spawnImpact(epr.x, epr.y, epr.color);
        st.eProj.splice(ep, 1); continue;
      }
      if (epr.x < -40 || epr.x > st.W + 40 || epr.y > st.H + 40) st.eProj.splice(ep, 1);
    }

    updateFx(dt);

    /* 胜负 */
    if (hero.hp <= 0 && !st.over) endBattle(false);
    else if (st.enemies.length === 0 && st.spawnQueue.length === 0 && !st.over) endBattle(true);

    st.onUpdate();
  };

  /* --------------------------------------------------------------- 攻击 */
  function heroAttack() {
    var hero = st.hero, s = st.stats;
    var targets = pickTargets(s.ranged ? 99999 : 82, s.proj + (s.multiHit ? 0 : 0));
    if (!targets.length) return false;

    var n = s.proj;
    for (var i = 0; i < n; i++) {
      var tgt = targets[Math.min(i, targets.length - 1)];
      if (s.ranged) {
        var dx = tgt.x - hero.x, dy = tgt.cy - (st.groundY - 44);
        var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        var speed = s.projSpeed || 640;
        st.proj.push({
          x: hero.x + 22, y: st.groundY - 44,
          vx: dx / d * speed + (i - (n - 1) / 2) * 30,
          vy: dy / d * speed * 0.4,
          r: s.heroId === 'ninja' ? 6 : 5,
          dmg: s.damage, crit: false, pierce: s.pierce || 0, hits: [],
          color: s.heroId === 'ninja' ? '#c8cfe6' : '#ffe27a'
        });
      } else {
        var times = s.multiHit || 1;
        for (var m = 0; m < times; m++) {
          if (s.cleave && m > 0) break;
          strikeMelee(tgt);
        }
      }
    }
    CH.Audio.play('hit');
    return true;
  }

  function strikeMelee(tgt) {
    var s = st.stats;
    var crit = Math.random() < s.crit;
    var dmg = s.damage * (crit ? s.critDmg : 1);
    damageEnemy(tgt, dmg, crit);
    // 劈砍特效
    spawnSlash(st.hero.x + 30, st.groundY - 46);
    if (crit) CH.Audio.play('crit');
  }

  function pickTargets(range, count) {
    var list = st.enemies.filter(function (e) { return !e.dead && e.x >= st.hero.x - 20 && (e.x - st.hero.x) <= range; });
    list.sort(function (a, b) { return a.x - b.x; });
    return list.slice(0, Math.max(1, count));
  }

  /* --------------------------------------------------------------- 伤害 */
  function damageEnemy(e, dmg, crit) {
    if (e.dead) return;
    var real = dmg * (1 - (e.armor || 0));
    e.hp -= real;
    e.hitFlash = 0.12;
    pushFloat(e.x, e.cy - e.h * 0.5, Math.round(real), crit ? '#ffcd3c' : '#ffffff', crit);
    var s = st.stats;
    if (s.lifesteal > 0) { st.hero.hp = Math.min(st.hero.maxHp, st.hero.hp + real * s.lifesteal); }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    st.kills++;
    st.ballDrops += e.balls;
    CH.Audio.play('enemyDie');
    spawnBurst(e.x, e.cy, e.color, e.boss ? 40 : 12);
    pushFloat(e.x, e.cy - e.h * 0.4, '+' + e.balls + '⚪', '#ffffff', false, 0.9);
    if (e.boss) screenShake(14);
    var idx = st.enemies.indexOf(e);
    if (idx >= 0) st.enemies.splice(idx, 1);
    if (st.onKill) st.onKill(e);
  }

  function heroTakeDamage(dmg, src, unblockable) {
    var hero = st.hero, s = st.stats;
    if (hero.hp <= 0) return;
    if (!unblockable && Math.random() < (s.dodge || 0)) {
      pushFloat(hero.x, st.groundY - 90, 'MISS', '#8fe6ff', false);
      return;
    }
    var real = dmg * (1 - (s.armor || 0));
    hero.hp -= real;
    hero.hurt = 0.25;
    screenShake(4);
    pushFloat(hero.x, st.groundY - 100, '-' + Math.round(real), '#ff5d6c', false);
    CH.Audio.play('heroHurt');
    if (s.thorns > 0 && src) damageEnemy(src, real * s.thorns, false);
    if (hero.hp <= 0) { hero.hp = 0; }
  }

  function shootEnemyProj(e) {
    var hero = st.hero;
    var dx = hero.x - e.x, dy = (st.groundY - 44) - e.cy;
    var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var speed = 330;
    st.eProj.push({ x: e.x, y: e.cy, vx: dx / d * speed, vy: dy / d * speed, dmg: e.dmg, r: 7, color: e.color });
  }

  /* --------------------------------------------------------------- 生成敌人 */
  function spawnEnemy(sp) {
    var def;
    var isBoss = !!sp.boss;
    if (isBoss) def = CH.Data.BOSSES[sp.bossId];
    else def = CH.Data.ENEMIES[sp.key];
    if (!def) return;
    var scale = st.wave.scale || 1;
    var h = isBoss ? Math.min(st.H * 0.24, 150) : Math.min(st.H * (0.075 + def.size / 700), 62);
    var e = {
      def: def, key: def.id, boss: isBoss,
      x: st.W + 40 + Math.random() * 40,
      cy: st.groundY - h * (def.flying ? 0.85 : 0.5),
      h: h, w: h * 0.78,
      hp: def.hp * scale, maxHp: def.hp * scale,
      dmg: def.dmg * Math.sqrt(scale) * (isBoss ? 0.25 : 0.55),
      speed: def.speed * (isBoss ? 1.7 : 1.3),
      balls: Math.round(def.balls * (isBoss ? 1 : scale * 0.8 + 0.3)),
      armor: def.armor || 0,
      ranged: !!def.ranged, atkMs: def.atkMs || 1600,
      attackCd: isBoss ? 2.1 : 1.6,
      flying: !!def.flying, color: def.color, trim: def.trim,
      hitFlash: 0, attackAnim: 0, atkTimer: 1.2 + Math.random() * 0.6, t: Math.random() * 3, walking: true,
      ability: def.ability, abilityTimer: 4, dead: false
    };
    if (isBoss) { st.banner = '★ ' + def.name + ' ★'; st.bannerT = 2.2; screenShake(8); }
    st.enemies.push(e);
    spawnRing(st.W - 20, e.cy, def.color);
  }

  /* --------------------------------------------------------------- 结束 */
  function endBattle(win) {
    st.over = true;
    st.endT = 0;
    st.result = {
      win: win,
      heroHp: st.hero.hp,
      maxHp: st.hero.maxHp,
      ballDrops: st.ballDrops,
      kills: st.kills,
      isBoss: !!st.wave.isBoss
    };
    CH.Audio.play(win ? 'win' : 'lose');
  }

  /* --------------------------------------------------------------- 特效 */
  function pushFloat(x, y, text, color, big, scale) {
    st.floats.push({ x: x, y: y, text: '' + text, color: color, life: 0.8, max: 0.8, big: big, scale: scale || (big ? 1.5 : 1) });
  }
  function spawnSlash(x, y) {
    st.parts.push({ type: 'slash', x: x, y: y, life: 0.18, max: 0.18, a: Math.random() * 0.5 - 0.25 });
  }
  function spawnImpact(x, y, color) {
    for (var i = 0; i < 4; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
      st.parts.push({ type: 'p', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28, max: 0.28, r: 2.4, c: color || '#fff', g: 300 });
    }
  }
  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
      st.parts.push({ type: 'p', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.6, max: 0.6, r: 3, c: color || '#fff', g: 400 });
    }
  }
  function spawnRing(x, y, color) { st.parts.push({ type: 'ring', x: x, y: y, life: 0.4, max: 0.4, c: color || '#fff', r0: 8, r1: 70 }); }

  var shake = 0;
  function screenShake(v) { shake = Math.max(shake, v); }

  function updateFx(dt) {
    for (var i = st.parts.length - 1; i >= 0; i--) {
      var p = st.parts[i];
      p.life -= dt;
      if (p.life <= 0) { st.parts.splice(i, 1); continue; }
      if (p.type === 'p') { p.vy += (p.g || 300) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    for (var f = st.floats.length - 1; f >= 0; f--) {
      var fl = st.floats[f];
      fl.life -= dt; fl.y -= 42 * dt;
      if (fl.life <= 0) st.floats.splice(f, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
  }

  /* --------------------------------------------------------------- 绘制 */
  B.render = function (g) {
    if (!st) return;
    var W = st.W, H = st.H;
    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    R.drawBackground(g, st.theme, W, H, st.t * 1000, st.time * 26, { groundY: st.groundY });

    /* 敌人 */
    for (var i = 0; i < st.enemies.length; i++) {
      var e = st.enemies[i];
      var info = R.drawEnemy(g, e.def, e.x, st.groundY + (e.flying ? 0 : 0), e.h, -1, st.t * 1000, { hitFlash: e.hitFlash, boss: e.boss });
      // 血条
      var bw = Math.max(30, e.w * 0.9);
      R.hpBar(g, e.x - bw / 2, info.cy - e.h * 0.62 - 12, bw, 6, e.hp / e.maxHp, '#ff7a86');
      if (e.boss) R.text(g, e.def.name, e.x, info.cy - e.h * 0.62 - 26, { size: 13, color: '#fff', stroke: '#1a1030', strokeW: 3 });
    }

    /* 英雄 */
    var hero = st.hero;
    var heroDef = CH.Data.HEROES[st.stats.heroId];
    var hh = Math.min(H * 0.17, 108);
    R.drawHero(g, heroDef, hero.x, st.groundY + 2, hh, 1, st.t * 1000, { attack: hero.anim.attack, blink: hero.anim.blink, walk: false });

    /* 投射物 */
    for (var p = 0; p < st.proj.length; p++) {
      var pr = st.proj[p];
      g.save();
      g.shadowColor = pr.color; g.shadowBlur = 10;
      if (heroDef.id === 'ninja') {
        g.translate(pr.x, pr.y); g.rotate(st.t * 20);
        var sz = pr.r * 1.4;
        g.strokeStyle = pr.color; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath();
        for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * sz, Math.sin(a) * sz); }
        g.stroke();
      } else {
        g.fillStyle = pr.color;
        g.beginPath(); g.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    for (var ep = 0; ep < st.eProj.length; ep++) {
      var epr = st.eProj[ep];
      g.save(); g.shadowColor = epr.color; g.shadowBlur = 12;
      g.fillStyle = epr.color;
      g.beginPath(); g.arc(epr.x, epr.y, epr.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.beginPath(); g.arc(epr.x - 2, epr.y - 2, epr.r * 0.4, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    /* 粒子 */
    for (var pa = 0; pa < st.parts.length; pa++) {
      var pt = st.parts[pa];
      var al = U.clamp(pt.life / pt.max, 0, 1);
      g.globalAlpha = al;
      if (pt.type === 'p') {
        g.fillStyle = pt.c;
        g.beginPath(); g.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); g.fill();
      } else if (pt.type === 'ring') {
        var rr = U.lerp(pt.r0, pt.r1, 1 - al);
        g.strokeStyle = pt.c; g.lineWidth = 3.5 * al;
        g.beginPath(); g.arc(pt.x, pt.y, rr, 0, Math.PI * 2); g.stroke();
      } else if (pt.type === 'slash') {
        g.save(); g.translate(pt.x, pt.y); g.rotate(pt.a);
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5 * al; g.lineCap = 'round';
        g.beginPath(); g.arc(0, 0, 26, -0.9, 0.9); g.stroke();
        g.restore();
      }
    }
    g.globalAlpha = 1;

    /* 英雄受伤红闪 */
    if (hero.hurt > 0) {
      g.globalAlpha = hero.hurt * 1.6;
      g.fillStyle = 'rgba(255,60,60,.28)';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }

    /* 伤害数字 */
    for (var f = 0; f < st.floats.length; f++) {
      var fl = st.floats[f];
      var a = U.clamp(fl.life / fl.max, 0, 1);
      g.globalAlpha = a;
      R.text(g, fl.text, fl.x, fl.y, { size: (fl.big ? 24 : 15) * fl.scale, color: fl.color, stroke: '#160b28', strokeW: fl.big ? 5 : 3.5 });
      g.globalAlpha = 1;
    }

    /* Boss 横幅 */
    if (st.bannerT > 0 && st.banner) {
      var ba = U.clamp(st.bannerT / 2.2, 0, 1);
      g.globalAlpha = Math.min(1, ba * 2);
      R.fillRR(g, 0, H * 0.3, W, 54, 0, 'rgba(10,5,22,.62)');
      R.text(g, st.banner, W / 2, H * 0.3 + 27, { size: 26, color: '#ffcd3c', stroke: '#5a1200', strokeW: 6 });
      g.globalAlpha = 1;
    }

    g.restore();
  };
})();
