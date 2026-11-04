/* ==========================================================================
   game.js - 流程控制器与养成系统
   编排 倒球 → 商店 → 战斗 → Boss 的循环，并管理金币/宝石/英雄/装备/进度
   挂载 CH.Game
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U, D = CH.Data, S = CH.Storage, UI = CH.UI, HUD = CH.HUD, C = CH.Canvas, R = CH.Render;
  var G = (CH.Game = {});

  G.state = 'menu';         // menu | pour | shop | battle
  G.run = null;
  G.paused = false;
  G.uiChapter = 1;
  G.menuT = 0;

  function p() { return S.p(); }
  function stats() { return G.run ? G.run.stats : computeStats(); }

  /* =====================================================================
     初始化
     ===================================================================== */
  G.boot = function () {
    S.load();
    C.setup();
    UI.mount();
    HUD.build();
    HUD.onPause = G.pause;
    CH.Audio.init(p().settings);
    bindCanvas();
    G.uiChapter = p().progress.chapter;
    Q.syncAudio();
    if (p().settings.music) { /* 首次交互后再启动 */ }
    G.goPlay();
  };

  /* 全局设置/静音同步 */
  var Q = {
    syncAudio: function () {
      var st = p().settings;
      CH.Audio.setSound(st.sound);
      CH.Audio.setMusic(st.music);
    }
  };
  G.Settings = Q;

  /* --------------------------------------------------------- 画布指针事件 */
  function bindCanvas() {
    var cv = C.canvas;
    function pos(e) {
      var r = cv.getBoundingClientRect();
      var t = (e.touches && e.touches[0]) || e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    var dragging = false;
    function down(e) {
      if (G.state !== 'pour') return;
      e.preventDefault();
      dragging = true;
      var pt = pos(e);
      CH.Pour.pointerDown(pt.x, pt.y);
    }
    function move(e) {
      if (!dragging || G.state !== 'pour') return;
      e.preventDefault();
      var pt = pos(e);
      CH.Pour.pointerMove(pt.x, pt.y);
    }
    function up(e) {
      if (!dragging) return;
      dragging = false;
      if (G.state === 'pour') CH.Pour.pointerUp();
    }
    cv.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
  }

  /* =====================================================================
     数值计算
     ===================================================================== */
  function computeStats() {
    var pr = p();
    var heroDef = D.HEROES[pr.selectedHero];
    var hs = pr.heroes[pr.selectedHero];
    var lv = hs.level;
    var b = heroDef.base, gr = heroDef.growth;

    var s = {
      heroId: heroDef.id,
      name: heroDef.name,
      maxHp: b.hp + gr.hp * (lv - 1),
      damage: b.dmg + gr.dmg * (lv - 1),
      atkMs: Math.max(200, b.atkMs + (gr.atkMs || 0) * (lv - 1)),
      ranged: !!b.ranged,
      proj: b.proj || 1,
      projSpeed: b.projSpeed || 640,
      pierce: b.pierce || 0,
      cleave: !!b.cleave,
      multiHit: b.multiHit || 1,
      armor: b.armor || 0,
      crit: 0.05, critDmg: 1.5,
      dodge: 0, lifesteal: 0, regen: 0, thorns: 0,
      ballBonus: 0, magnet: 1
    };

    var t = heroDef.talent || {};
    if (t.lifesteal) s.lifesteal += t.lifesteal;
    if (t.crit) s.crit += t.crit;
    if (t.critDmg) s.critDmg = Math.max(s.critDmg, t.critDmg);
    if (t.dodge) s.dodge += t.dodge;
    if (t.thorns) s.thorns += t.thorns;
    if (t.everyProj) s.proj += Math.floor(lv / t.everyProj);

    /* 装备 */
    var hpMul = 1, dmgMul = 1, atkDiv = 1;
    D.GEAR_SLOTS.forEach(function (slot) {
      var it = pr.equipped[slot.id];
      if (!it) return;
      var mult = D.RARITY_MAP[it.rarity].mult;
      var v = slot.per * mult;
      if (slot.stat === 'damage') dmgMul += v;
      else if (slot.stat === 'health') hpMul += v;
      else if (slot.stat === 'dodge') s.dodge += v;
      else if (slot.stat === 'crit') s.crit += v;
      else if (slot.stat === 'regen') s.regen += v;
    });

    /* 永久升级 */
    var up = pr.upgrades;
    dmgMul *= 1 + D.UPGRADE_MAP.damage.per * up.damage;
    hpMul *= 1 + D.UPGRADE_MAP.health.per * up.health;
    atkDiv *= 1 + D.UPGRADE_MAP.speed.per * up.speed;

    s.damage *= dmgMul;
    s.maxHp *= hpMul;
    s.atkMs /= atkDiv;

    /* 局内技能 */
    if (G.run) {
      var sk = G.run.skills;
      s.damage *= 1 + 0.22 * (sk.damage || 0);
      s.atkMs /= 1 + 0.14 * (sk.atkspeed || 0);
      s.proj += (sk.multishot || 0);
      s.crit += 0.08 * (sk.crit || 0);
      s.critDmg += 0.25 * (sk.crit || 0);
      s.dodge += 0.07 * (sk.dodge || 0);
      s.lifesteal += 0.025 * (sk.lifesteal || 0);
      s.maxHp += 30 * (sk.maxhp || 0);
      s.regen += 1.2 * (sk.regen || 0);
      s.pierce += (sk.pierce || 0);
      s.thorns += 0.12 * (sk.thorns || 0);
      s.ballBonus += 0.15 * (sk.ballgain || 0);
      s.magnet = 1 + 0.25 * (sk.magnet || 0);
    }

    s.crit = U.clamp(s.crit, 0, 0.9);
    s.dodge = U.clamp(s.dodge, 0, 0.75);
    s.atkMs = Math.max(150, s.atkMs);
    return s;
  }
  G.computeStats = computeStats;

  /* =====================================================================
     屏幕导航
     ===================================================================== */
  G.goPlay = function () {
    G.state = 'menu';
    HUD.hide();
    UI.clear();
    UI.play({
      profile: p(), chapter: G.uiChapter,
      onTab: G.onTab, onStart: G.startStage,
      onChapter: function (c) { G.uiChapter = c; G.goPlay(); },
      onEndless: G.startEndless,
      onSettings: G.openSettings
    });
  };

  G.onTab = function (tab) {
    if (tab === 'play') return G.goPlay();
    if (tab === 'heroes') return G.goHeroes();
    if (tab === 'upgrades') return G.goUpgrades();
    if (tab === 'gear') return G.goGear();
  };

  G.goHeroes = function () {
    G.state = 'menu'; HUD.hide(); UI.clear();
    UI.heroes({
      profile: p(), onTab: G.onTab, onSettings: G.openSettings, onBack: G.goPlay,
      onSelect: function (id) { p().selectedHero = id; S.save(); CH.Audio.play('click'); G.goHeroes(); },
      onUnlock: function (id) { G.unlockHero(id); },
      onLevelUp: function (id) { G.levelHero(id); }
    });
  };

  G.goUpgrades = function () {
    G.state = 'menu'; HUD.hide(); UI.clear();
    UI.upgrades({
      profile: p(), onTab: G.onTab, onSettings: G.openSettings, onBack: G.goPlay,
      onUpgrade: function (id) { G.buyUpgrade(id); }
    });
  };

  G.goGear = function () {
    G.state = 'menu'; HUD.hide(); UI.clear();
    UI.gear({
      profile: p(), onTab: G.onTab, onSettings: G.openSettings, onBack: G.goPlay,
      bestFor: G.bestFor, onEquip: G.equipItem, onUnequip: G.unequip, onMerge: G.mergeAll
    });
  };

  /* =====================================================================
     英雄 / 升级 / 装备
     ===================================================================== */
  G.unlockHero = function (id) {
    var pr = p(), h = D.HEROES[id];
    if (pr.heroes[id].unlocked) return;
    if (pr.coins < 0) return;
    if (pr.gems < h.unlock) { CH.Audio.play('deny'); UI.toast('宝石不足', 'warn'); return; }
    pr.gems -= h.unlock;
    pr.heroes[id].unlocked = true;
    CH.Audio.play('unlock');
    UI.toast('解锁 ' + h.name + '！', 'good');
    S.save();
    G.goHeroes();
  };

  G.levelHero = function (id) {
    var pr = p(), hs = pr.heroes[id];
    if (!hs.unlocked || hs.level >= D.HERO_MAX_LEVEL) return;
    var cost = D.heroLevelCost(hs.level);
    if (pr.coins < cost) { CH.Audio.play('deny'); UI.toast('金币不足', 'warn'); return; }
    pr.coins -= cost;
    hs.level++;
    CH.Audio.play('levelUp');
    S.save();
    G.goHeroes();
  };

  G.buyUpgrade = function (id) {
    var pr = p(), u = D.UPGRADE_MAP[id];
    var lv = pr.upgrades[id];
    if (lv >= u.max) return;
    var cost = D.upgradeCost(u, lv);
    if (pr.coins < cost) { CH.Audio.play('deny'); UI.toast('金币不足', 'warn'); return; }
    pr.coins -= cost;
    pr.upgrades[id]++;
    CH.Audio.play('upgrade' in CH.Audio ? 'upgrade' : 'levelUp');
    S.save();
    G.goUpgrades();
  };

  G.bestFor = function (slotId) {
    var pr = p();
    var list = pr.bag.filter(function (g) { return g.slot === slotId; });
    if (!list.length) return null;
    list.sort(function (a, b) { return D.RARITY_MAP[b.rarity].index - D.RARITY_MAP[a.rarity].index; });
    return list[0];
  };

  G.equipItem = function (item) {
    var pr = p();
    var idx = pr.bag.indexOf(item);
    if (idx < 0) return;
    pr.bag.splice(idx, 1);
    var old = pr.equipped[item.slot];
    pr.equipped[item.slot] = item;
    if (old) pr.bag.push(old);
    CH.Audio.play('buy');
    S.save();
    if (G.state === 'menu') G.goGear();
  };

  G.unequip = function (slotId) {
    var pr = p();
    var it = pr.equipped[slotId];
    if (!it) return;
    pr.equipped[slotId] = null;
    pr.bag.push(it);
    CH.Audio.play('back');
    S.save();
    G.goGear();
  };

  G.mergeAll = function () {
    var pr = p();
    var merged = 0;
    var changed = true;
    while (changed) {
      changed = false;
      var counts = {};
      pr.bag.forEach(function (g) {
        var k = g.slot + '|' + g.rarity;
        (counts[k] = counts[k] || []).push(g);
      });
      for (var k in counts) {
        if (!Object.prototype.hasOwnProperty.call(counts, k)) continue;
        var arr = counts[k];
        var rar = D.RARITY_MAP[arr[0].rarity];
        if (arr.length >= D.MERGE_COUNT && rar.index < D.RARITY.length - 1) {
          for (var i = 0; i < D.MERGE_COUNT; i++) {
            var ix = pr.bag.indexOf(arr[i]);
            if (ix >= 0) pr.bag.splice(ix, 1);
          }
          pr.bag.push({ slot: arr[0].slot, rarity: D.RARITY[rar.index + 1].id });
          merged++;
          changed = true;
          break;
        }
      }
    }
    if (merged > 0) { CH.Audio.play('merge'); UI.toast('合成成功 ×' + merged, 'good'); }
    else { CH.Audio.play('deny'); UI.toast('暂无可合成的装备', 'warn'); }
    S.save();
    G.goGear();
  };

  /* =====================================================================
     开局
     ===================================================================== */
  G.startStage = function (chapter, stage) {
    closeAll();
    G.run = {
      mode: 'campaign',
      chapter: chapter, stage: stage,
      waveIndex: 1,
      waves: D.WAVES_PER_STAGE,
      isBoss: false,
      balls: 0,
      skills: {},
      rerolls: 0,
      heroHp: 0, maxHp: 0,
      earned: { coins: 0, gems: 0, items: 0 },
      stats: null,
      globalStage: (chapter - 1) * D.STAGES_PER_CHAPTER + stage,
      difficulty: 0
    };
    G.run.stats = computeStats();
    G.run.maxHp = G.run.stats.maxHp;
    G.run.heroHp = G.run.stats.maxHp;
    G.run.difficulty = U.clamp((G.run.globalStage - 1) / 26, 0, 1);
    p().stats.runs++;
    S.save();
    G.beginWave();
  };

  G.startEndless = function () {
    closeAll();
    G.run = {
      mode: 'endless',
      chapter: p().progress.maxChapter,
      stage: 0,
      waveIndex: 1,
      waves: 0,
      isBoss: false,
      balls: 0,
      skills: {},
      rerolls: 0,
      heroHp: 0, maxHp: 0,
      earned: { coins: 0, gems: 0, items: 0 },
      stats: null,
      globalStage: 0,
      difficulty: 0
    };
    G.run.stats = computeStats();
    G.run.maxHp = G.run.stats.maxHp;
    G.run.heroHp = G.run.stats.maxHp;
    p().stats.runs++;
    S.save();
    G.beginWave();
  };

  /* =====================================================================
     循环：倒球 → 商店 → 战斗
     ===================================================================== */
  /* 根据当前 waveIndex 重新判定是否 Boss 波，并同步无尽模式的难度/章节 */
  function computeWaveFlags() {
    var run = G.run;
    if (run.mode === 'endless') {
      run.isBoss = (run.waveIndex % 5 === 0);
      /* 无尽每 3 波 ≈ 关卡模式 1 个关卡，数值爬升速度与关卡模式接近 */
      run.globalStage = 1 + (run.waveIndex - 1) / 3;
      run.difficulty = U.clamp((run.waveIndex - 1) / 22, 0, 1);
      run.chapter = Math.min(1 + Math.floor((run.waveIndex - 1) / 5), D.CHAPTERS.length);
    } else {
      run.isBoss = run.waveIndex > run.waves;
    }
  }

  G.beginWave = function () {
    computeWaveFlags();
    G.startPour();
  };

  G.startPour = function () {
    var run = G.run;
    var pr = p();
    G.state = 'pour';
    closeAll();
    HUD.show();
    HUD.setWave(G.waveLabel());
    var chDef = D.getChapter(run.chapter);
    var startBalls = D.BASE_CUP_BALLS + pr.upgrades.balls + Math.min(6, (run.waveIndex - 1));
    if (run.mode === 'endless') startBalls += Math.floor(run.waveIndex / 2);

    HUD.hideHp(); HUD.hideBoss();
    HUD.setActions([
      { label: '⬇️ 倒球', style: 'gold', onClick: function () { CH.Pour.pourNow(); } },
      { label: '⏭️ 跳过', style: 'ghost', flex: '0.7', onClick: function () { CH.Pour.skip(); } }
    ]);

    run.pourBase = startBalls;
    CH.Pour.start({
      theme: chDef.theme,
      startBalls: startBalls,
      bonus: run.stats.ballBonus,
      difficulty: run.difficulty,
      seed: (run.globalStage * 7919 + run.waveIndex * 131 + (run.mode === 'endless' ? 977 : 0)) | 0,
      onUpdate: function (collected) { HUD.setBalls(run.balls + collected); },
      onDone: function (total) {
        run.balls += total;
        run.lastPour = total;
        if (run.mode === 'campaign') { var g = p().stats; g.totalBalls += total; }
        S.save();
        G.openShop();
      }
    });
    HUD.setBalls(run.balls);
    CH.UI && CH.UI.clear();
  };

  G.waveLabel = function () {
    var run = G.run;
    if (run.mode === 'endless') return '无尽 ' + run.waveIndex + ' 波' + (run.isBoss ? ' · BOSS' : '');
    var n = run.isBoss ? ('Boss') : ('第 ' + run.waveIndex + '/' + run.waves + ' 波');
    return '第 ' + run.chapter + ' 章 ' + run.chapter + '-' + run.stage + ' · ' + n;
  };

  /* --------------------------------------------------------------- 商店 */
  G.openShop = function () {
    var run = G.run;
    G.state = 'shop';
    HUD.hide();
    UI.clear();
    run.offers = G.rollOffers();
    run.rerollCost = 5;
    UI.shop({
      profile: p(),
      balls: run.balls,
      runSkills: run.skills,
      offers: run.offers,
      stageInfo: G.waveLabel(),
      rerollCost: run.rerollCost,
      onBack: G.confirmQuit,
      onReroll: G.rerollShop,
      onBuy: G.buySkill,
      onNext: G.beginBattle,
      onSettings: G.openSettings
    });
  };

  G.rollOffers = function () {
    var run = G.run;
    var avail = D.SKILLS.filter(function (sk) { return (run.skills[sk.id] || 0) < sk.max; });
    var picked = U.shuffle(avail).slice(0, 3);
    if (picked.length === 0) picked = U.shuffle(D.SKILLS).slice(0, 3);
    return picked.map(function (sk) {
      var lv = run.skills[sk.id] || 0;
      return { id: sk.id, cost: Math.floor(sk.base * Math.pow(sk.growth, lv)) };
    });
  };

  G.rerollShop = function () {
    var run = G.run;
    var cost = run.rerollCost;
    if (run.balls < cost) { CH.Audio.play('deny'); UI.toast('球数不足', 'warn'); return; }
    run.balls -= cost;
    run.rerollCost = Math.ceil(cost * 1.6);
    CH.Audio.play('click');
    run.offers = G.rollOffers();
    G.refreshShop();
  };

  G.buySkill = function (id) {
    var run = G.run;
    var off = run.offers.filter(function (o) { return o.id === id; })[0];
    if (!off) return;
    var sk = D.SKILL_MAP[id];
    var lv = run.skills[id] || 0;
    if (lv >= sk.max) return;
    if (run.balls < off.cost) { CH.Audio.play('deny'); UI.toast('球数不足', 'warn'); return; }
    run.balls -= off.cost;
    run.skills[id] = lv + 1;
    var prevMax = run.stats.maxHp;
    run.stats = computeStats();
    // 生命上限变化时补偿
    if (run.stats.maxHp > prevMax) run.heroHp += (run.stats.maxHp - prevMax);
    run.maxHp = run.stats.maxHp;
    run.heroHp = Math.min(run.heroHp, run.maxHp);
    CH.Audio.play('buy');
    var newOff = run.offers.map(function (o) {
      if (o.id !== id) return o;
      return { id: id, cost: Math.floor(sk.base * Math.pow(sk.growth, lv + 1)) };
    });
    run.offers = newOff;
    G.refreshShop();
  };

  G.refreshShop = function () {
    var run = G.run;
    UI.renderShopList({
      profile: p(), balls: run.balls, runSkills: run.skills, offers: run.offers,
      onBuy: G.buySkill
    });
    // 预算文本
    var b = UI.q('#shopBudget');
    if (b) b.textContent = U.fmt(run.balls);
    var rb = UI.q('#btnReroll');
    if (rb) rb.innerHTML = '🔄 刷新 (' + run.rerollCost + UI.ballIconHtml() + ')';
  };

  /* --------------------------------------------------------------- 战斗 */
  G.beginBattle = function () {
    var run = G.run;
    G.state = 'battle';
    closeAll();
    HUD.show();
    HUD.setWave(G.waveLabel());
    /* Boss 战前回满生命，让 Boss 成为唯一的一次性考验 */
    if (run.isBoss) run.heroHp = run.maxHp;
    HUD.setBalls(run.balls);
    HUD.setHp(run.heroHp, run.maxHp);
    HUD.setActions([
      { label: '⏸️ 暂停', style: 'ghost', flex: '1', onClick: G.pause }
    ]);

    var chDef = D.getChapter(run.chapter);
    var wave = G.buildWave();
    CH.Battle.start({
      theme: chDef.theme,
      stats: run.stats,
      wave: wave,
      chapter: run.chapter,
      stage: run.stage,
      waveIndex: run.waveIndex,
      heroHp: run.heroHp,
      onUpdate: function () { G.updateBattleHud(); },
      onEnd: G.onBattleEnd
    });
  };

  G.buildWave = function () {
    var run = G.run;
    var gs = run.globalStage;
    /* 指数底数从 1.15 降到 1.11：英雄战力是线性成长（等级/永久强化/装备），
       敌人若按 1.15 指数膨胀，第 3 章起会形成无法逾越的墙 */
    var scale = Math.pow(1.11, gs - 1) * (1 + (run.waveIndex - 1) * 0.06);
    if (run.mode === 'campaign') {
      var chDef = D.getChapter(run.chapter);
      if (chDef.loopBonus) scale *= Math.pow(1.6, chDef.loopBonus);
    }

    if (run.isBoss) {
      var bossIdx = (Math.floor((gs - 1) / D.STAGES_PER_CHAPTER)) % D.BOSS_ORDER.length;
      if (run.mode === 'endless') bossIdx = Math.floor((run.waveIndex - 1) / 5) % D.BOSS_ORDER.length;
      return { isBoss: true, bossId: D.BOSS_ORDER[bossIdx], scale: scale * 0.95, spawn: {} };
    }

    var chDef2 = D.getChapter(run.chapter);
    var pool = chDef2.enemies;
    var count = 2 + Math.floor(gs * 0.18) + (run.waveIndex - 1);
    count = Math.min(count, 8);
    var spawn = {};
    var typesN = U.clamp(1 + Math.floor(gs / 6), 1, pool.length);
    var chosen = U.shuffle(pool).slice(0, typesN);
    for (var i = 0; i < count; i++) {
      var key = chosen[i % chosen.length];
      spawn[key] = (spawn[key] || 0) + 1;
    }
    return { isBoss: false, spawn: spawn, scale: scale };
  };

  G.updateBattleHud = function () {
    var b = CH.Battle.getState();
    if (!b) return;
    var run = G.run;
    HUD.setBalls(run.balls + Math.floor(b.ballDrops * run.stats.magnet));
    HUD.setHp(b.hero.hp, b.hero.maxHp);
    var boss = null;
    for (var i = 0; i < b.enemies.length; i++) if (b.enemies[i].boss) { boss = b.enemies[i]; break; }
    if (boss) HUD.setBoss(boss.hp / boss.maxHp, boss.def.name + '  ' + Math.max(0, Math.ceil(boss.hp)) + ' / ' + Math.round(boss.maxHp));
    else HUD.hideBoss();
  };

  G.onBattleEnd = function (res) {
    var run = G.run;
    run.balls += Math.floor(res.ballDrops * run.stats.magnet);
    run.heroHp = res.heroHp;
    var st = p().stats;
    st.kills += res.kills;
    if (res.isBoss && res.win) st.bossKills++;
    st.bestWave = Math.max(st.bestWave, run.mode === 'endless' ? run.waveIndex : run.globalStage);

    if (!res.win) {
      S.save();
      G.onDefeat();
      return;
    }
    CH.Audio.play('win');
    /* 每波清场后回复部分生命，避免血量只能一路下坡 */
    run.heroHp = Math.min(run.maxHp, res.heroHp + run.maxHp * 0.42);
    if (run.isBoss) {
      if (run.mode === 'endless') { run.waveIndex++; S.save(); computeWaveFlags(); G.startPour(); }
      else G.stageClear();
    } else {
      run.waveIndex++;
      S.save();
      computeWaveFlags();
      G.startPour();
    }
  };

  G.onDefeat = function () {
    G.state = 'menu';
    HUD.hide();
    UI.clear();
    var run = G.run;
    var pr = p();
    var coinReward = 0;
    if (run.mode === 'endless') {
      coinReward = Math.floor(20 + run.waveIndex * 6);
      pr.coins += coinReward;
      pr.endless.best = Math.max(pr.endless.best, run.waveIndex - 1);
      S.save();
    }
    UI.result({
      win: false,
      subtitle: run.mode === 'endless'
        ? ('坚持到第 ' + (run.waveIndex - 1) + ' 波，最高纪录 ' + pr.endless.best + ' 波')
        : ('在第 ' + run.chapter + '-' + run.stage + ' 关倒下了，升级英雄与装备后再来挑战！'),
      rewards: coinReward ? { coins: coinReward } : null,
      buttons: [
        run.mode === 'endless'
          ? { label: '再来一局', style: 'gold', onClick: function () { closeAll(); G.startEndless(); } }
          : { label: '重试本关', style: 'gold', onClick: function () { closeAll(); G.startStage(run.chapter, run.stage); } },
        { label: '提升英雄', style: 'green', onClick: function () { closeAll(); G.goHeroes(); } },
        { label: '返回主菜单', style: 'ghost', onClick: function () { closeAll(); G.goPlay(); } }
      ]
    });
  };

  G.stageClear = function () {
    var run = G.run;
    var gs = run.globalStage;
    var isChapterBoss = run.stage === D.STAGES_PER_CHAPTER;
    var pr = p();

    var coins = Math.floor((22 + gs * 9) * (run.isBoss ? 2.2 : 1));
    var gems = isChapterBoss ? 8 : 2;
    var items = 0;
    if (run.isBoss) {
      items = 1 + (U.chance(0.35) ? 1 : 0);
      for (var i = 0; i < items; i++) pr.bag.push(G.rollGear());
    }
    pr.coins += coins;
    pr.gems += gems;
    run.earned.coins += coins; run.earned.gems += gems; run.earned.items += items;

    /* 进度推进 */
    if (isChapterBoss) {
      pr.progress.chapter = run.chapter + 1;
      pr.progress.maxChapter = Math.max(pr.progress.maxChapter, run.chapter + 1);
      pr.progress.stage = 1;
      pr.progress.maxStage = 1;
      G.uiChapter = pr.progress.chapter;
    } else {
      pr.progress.stage = run.stage + 1;
      pr.progress.maxStage = Math.max(pr.progress.maxStage, run.stage + 1);
      G.uiChapter = run.chapter;
    }
    S.save();

    G.state = 'menu';
    HUD.hide();
    UI.clear();
    UI.result({
      win: true,
      isBoss: run.isBoss,
      subtitle: isChapterBoss ? ('第 ' + run.chapter + ' 章通关！解锁第 ' + (run.chapter + 1) + ' 章') : ('第 ' + run.chapter + '-' + run.stage + ' 关完成'),
      rewards: { coins: coins, gems: gems, items: items },
      buttons: [
        isChapterBoss
          ? { label: '继续下一章', style: 'gold', onClick: function () { closeAll(); G.startStage(pr.progress.chapter, 1); } }
          : { label: '继续下一关', style: 'gold', onClick: function () { closeAll(); G.startStage(run.chapter, run.stage + 1); } },
        { label: '查看装备', style: 'green', onClick: function () { closeAll(); G.goGear(); } },
        { label: '返回主菜单', style: 'ghost', onClick: function () { closeAll(); G.goPlay(); } }
      ]
    });
  };

  G.rollGear = function () {
    var pr = p();
    var gs = G.run ? G.run.globalStage : 1;
    var roll = Math.random() - Math.min(0.28, gs * 0.006);
    var rarity = 'common';
    if (roll < 0.015 + gs * 0.0018) rarity = 'mythic';
    else if (roll < 0.09 + gs * 0.004) rarity = 'legendary';
    else if (roll < 0.32) rarity = 'epic';
    var slot = U.choice(D.GEAR_SLOTS).id;
    return { slot: slot, rarity: rarity };
  };

  /* =====================================================================
     暂停 / 设置 / 退出
     ===================================================================== */
  function closeAll() { G.paused = false; UI.closeModals(); }

  G.pause = function () {
    if (G.state !== 'battle' && G.state !== 'pour') return;
    G.paused = true;
    UI.modal({
      icon: '⏸️',
      title: '暂停',
      subtitle: G.waveLabel(),
      buttons: [
        { label: '继续游戏', style: 'gold', onClick: function () { G.paused = false; } },
        { label: '重新开始本关', style: 'green', onClick: function () { G.paused = false; if (G.run.mode === 'endless') G.startEndless(); else G.startStage(G.run.chapter, G.run.stage); } },
        { label: '设置', style: 'blue', onClick: G.openSettings },
        { label: '退出关卡', style: 'red', onClick: function () { G.paused = false; G.confirmQuit(); } }
      ]
    });
  };

  G.confirmQuit = function () {
    G.state = 'menu';
    G.paused = false;
    CH.Pour.active = false; CH.Battle.active = false;
    HUD.hide();
    G.goPlay();
  };

  G.openSettings = function () {
    var pr = p();
    function toggleRow(label, key, icon) {
      var on = pr.settings[key];
      return { label: icon + ' ' + label + '：' + (on ? '开' : '关'), style: on ? 'green' : 'ghost', onClick: function () { pr.settings[key] = !on; S.save(); Q.syncAudio(); G.openSettings(); } };
    }
    UI.modal({
      icon: '⚙️',
      title: '设置',
      subtitle: '音效与音乐由浏览器实时合成，无需外部资源',
      buttons: [
        toggleRow('音效', 'sound', '🔊'),
        toggleRow('音乐', 'music', '🎵'),
        toggleRow('震动', 'haptics', '📳'),
        { label: '🗑️ 重置存档', style: 'red', onClick: function () { G.confirmReset(); } },
        { label: '关闭', style: 'gold', onClick: function () { } }
      ]
    });
  };

  G.confirmReset = function () {
    UI.modal({
      icon: '⚠️',
      title: '重置存档？',
      subtitle: '所有金币、宝石、英雄等级与装备将被清空，且不可恢复。',
      buttons: [
        { label: '确认重置', style: 'red', onClick: function () { S.reset(); G.uiChapter = 1; UI.toast('存档已重置', 'warn'); G.goPlay(); } },
        { label: '取消', style: 'ghost', onClick: function () { } }
      ]
    });
  };

  /* =====================================================================
     主循环
     ===================================================================== */
  G.tick = function (dt) {
    var g = C.ctx;
    if (G.state === 'pour') {
      if (!G.paused) CH.Pour.update(dt);
      CH.Pour.render(g);
    } else if (G.state === 'battle') {
      if (!G.paused) CH.Battle.update(dt);
      CH.Battle.render(g);
    } else {
      // 菜单背景：当前章节景致缓慢滚动
      G.menuT += dt;
      var chDef = D.getChapter(G.uiChapter || 1);
      R.drawBackground(g, chDef.theme, C.W, C.H, G.menuT * 1000, G.menuT * 14, { groundY: C.H * 0.8 });
    }
  };
})();
