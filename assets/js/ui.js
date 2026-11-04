/* ==========================================================================
   ui.js - DOM 界面层（主菜单 / 英雄 / 关卡 / 升级 / 装备 / 商店 / 结算 / HUD）
   挂载 CH.UI 与 CH.HUD
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U, R = CH.Render, C = CH.Canvas, D = CH.Data;
  var UI = (CH.UI = {});
  var HUD = (CH.HUD = {});

  var root, toastLayer, currentScreen = null;

  UI.mount = function () {
    root = document.getElementById('ui');
    toastLayer = document.getElementById('toast-layer');
  };

  /* 只清理屏幕与弹窗，保留常驻 HUD */
  UI.clear = function () {
    U.$$('.screen, .modal-mask', root).forEach(function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    currentScreen = null;
  };

  UI.current = function () { return currentScreen; };

  /* 通用：用 HTML 字符串创建并挂载一个 screen */
  function screen(html, cls) {
    UI.clear();
    var el = U.el('div', 'screen ' + (cls || ''), html);
    root.appendChild(el);
    currentScreen = el;
    return el;
  }
  UI.screen = screen;

  /* 查询作用域：优先当前屏幕，其次整个 UI 根节点（避免清屏后 currentScreen 为空时抛错） */
  function scope(el) { return el || currentScreen || root; }
  function q(sel, el) { return scope(el).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call(scope(el).querySelectorAll(sel)); }
  UI.q = q; UI.qa = qa;

  /* --------------------------------------------------------------- Toast */
  UI.toast = function (text, type) {
    var t = U.el('div', 'toast ' + (type || ''), U.escapeHtml(text));
    toastLayer.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 1100);
  };

  /* ---------------------------------------------------- 英雄头像canvas */
  UI.heroIcon = function (heroId, px) {
    var hero = D.HEROES[heroId];
    var cv = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = px * dpr; cv.height = px * dpr;
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var h = px * 0.82;
    R.drawHero(g, hero, px / 2, px * 0.94, h, 1, 0, {});
    return cv;
  };

  UI.ballIconHtml = function () { return '<span class="dot" style="width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#cfd6e6 60%,#97a1bb);display:inline-block"></span>'; };

  /* --------------------------------------------------------- 顶部货币条 */
  function currencyBar(p) {
    return '<div class="currency"><span class="dot coin"></span><span class="ui-num">' + U.fmt(p.coins) + '</span></div>' +
      '<div class="currency"><span class="dot gem"></span><span class="ui-num">' + U.fmt(p.gems) + '</span></div>';
  }
  UI.currencyBar = currencyBar;

  /* --------------------------------------------------------- 底部标签栏 */
  UI.tabbar = function (active, onTab) {
    var tabs = [
      { id: 'play', icon: '🗺️', label: '冒险' },
      { id: 'heroes', icon: '🛡️', label: '英雄' },
      { id: 'upgrades', icon: '⬆️', label: '强化' },
      { id: 'gear', icon: '🎒', label: '装备' }
    ];
    var bar = U.el('div', 'tabbar');
    tabs.forEach(function (t) {
      var b = U.el('button', t.id === active ? 'on' : '', '<span class="ti">' + t.icon + '</span>' + t.label);
      b.addEventListener('click', function () { CH.Audio.play('click'); onTab(t.id); });
      bar.appendChild(b);
    });
    return bar;
  };

  /* =====================================================================
     主菜单 / 冒险（关卡选择）
     ===================================================================== */
  UI.play = function (ctx) {
    var p = ctx.profile;
    var el = screen('', 'sc-play');
    el.appendChild(topbar(ctx));
    var body = U.el('div', 'screen-body');

    var chapter = ctx.chapter || 1;
    var chDef = D.getChapter(chapter);
    var totalStages = D.STAGES_PER_CHAPTER;

    var html = '';
    html += '<div class="card" style="display:flex;align-items:center;gap:12px">';
    html += '  <button class="icon-btn clickable" data-ch="-1" style="font-size:16px"' + (chapter <= 1 ? ' disabled' : '') + '>◀</button>';
    html += '  <div style="flex:1;text-align:center">';
    html += '    <div style="font-size:12px;color:var(--c-text-dim);letter-spacing:2px">第 ' + chapter + ' 章</div>';
    html += '    <div style="font-weight:900;font-size:20px;margin-top:2px">' + U.escapeHtml(chDef.name) + '</div>';
    html += '  </div>';
    html += '  <button class="icon-btn clickable" data-ch="1" style="font-size:16px"' + (chapter >= p.progress.maxChapter ? ' disabled' : '') + '>▶</button>';
    html += '</div>';

    html += '<div class="card"><div class="card-title">🗺️ 关卡</div><div class="stage-grid" id="stageGrid"></div>';
    html += '<div style="margin-top:12px;font-size:11.5px;color:var(--c-text-dim);line-height:1.5">每个关卡包含 <b>3 波敌人</b> 与 <b>1 个 Boss</b>。通关后永久解锁下一关。</div></div>';

    /* 当前英雄 + 进入按钮 */
    var hero = D.HEROES[p.selectedHero];
    html += '<div class="card" style="display:flex;align-items:center;gap:12px">';
    html += '  <div id="curHeroIcon"></div>';
    html += '  <div style="flex:1"><div style="font-weight:900">' + hero.emoji + ' ' + U.escapeHtml(hero.name) + ' <span class="lvtag">Lv.' + p.heroes[p.selectedHero].level + '</span></div>';
    html += '  <div style="font-size:11.5px;color:var(--c-text-dim);margin-top:2px">当前出战英雄</div></div>';
    html += '</div>';

    /* 无尽模式 */
    html += '<div class="card" style="display:flex;align-items:center;gap:12px">';
    html += '  <div style="font-size:30px">♾️</div>';
    html += '  <div style="flex:1"><div style="font-weight:900">无尽波次</div><div style="font-size:11.5px;color:var(--c-text-dim)">最高纪录：' + U.fmt(p.endless.best) + ' 波</div></div>';
    html += '  <button class="btn blue press clickable" data-act="endless" style="padding:10px 16px;font-size:14px">挑战</button>';
    html += '</div>';

    body.innerHTML = html;
    el.appendChild(body);
    el.appendChild(UI.tabbar('play', ctx.onTab));

    /* 英雄图标 */
    q('#curHeroIcon').appendChild(UI.heroIcon(p.selectedHero, 54));

    /* 关卡节点 */
    var grid = q('#stageGrid');
    for (var i = 1; i <= totalStages; i++) {
      (function (stageN) {
        var node = U.el('div', 'stage-node clickable');
        var unlocked = chapter < p.progress.maxChapter || stageN <= p.progress.maxStage;
        var cleared = chapter < p.progress.maxChapter || stageN < p.progress.maxStage;
        var isBoss = stageN === totalStages;
        node.innerHTML = (isBoss ? '<span class="boss-crown">👑</span>' : '') + stageN;
        if (cleared) node.classList.add('cleared');
        if (chapter === p.progress.maxChapter && stageN === p.progress.maxStage && !cleared) node.classList.add('current');
        if (!unlocked) node.classList.add('locked');
        node.addEventListener('click', function () {
          if (!unlocked) { CH.Audio.play('deny'); UI.toast('尚未解锁', 'warn'); return; }
          CH.Audio.play('click');
          ctx.onStart(chapter, stageN);
        });
        grid.appendChild(node);
      })(i);
    }

    qa('[data-ch]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = parseInt(b.getAttribute('data-ch'), 10);
        var nc = chapter + d;
        if (nc < 1 || nc > p.progress.maxChapter) return;
        CH.Audio.play('click');
        ctx.onChapter(nc);
      });
    });
    var end = q('[data-act="endless"]');
    if (end) end.addEventListener('click', function () { CH.Audio.play('click'); ctx.onEndless(); });
  };

  /* =====================================================================
     英雄
     ===================================================================== */
  UI.heroes = function (ctx) {
    var p = ctx.profile;
    var el = screen('', 'sc-heroes');
    el.appendChild(topbar(ctx));
    var body = U.el('div', 'screen-body');
    body.innerHTML = '<div class="card"><div class="card-title">🛡️ 英雄</div>' +
      '<div style="font-size:11.5px;color:var(--c-text-dim);margin-bottom:10px">英雄等级与天赋永久生效。金币升级，宝石解锁新英雄。</div>' +
      '<div id="heroList"></div></div>';
    el.appendChild(body);
    el.appendChild(UI.tabbar('heroes', ctx.onTab));

    var list = q('#heroList');
    D.HERO_ORDER.forEach(function (id) {
      var h = D.HEROES[id], hs = p.heroes[id];
      var card = U.el('div', 'hero-card' + (p.selectedHero === id ? ' sel' : '') + (hs.unlocked ? '' : ' locked'));
      var iconWrap = U.el('div', 'avatar');
      iconWrap.appendChild(UI.heroIcon(id, 46));
      card.appendChild(iconWrap);
      var meta = U.el('div', 'meta');
      meta.innerHTML = '<div class="hname">' + U.escapeHtml(h.name) + ' <span class="lvtag">Lv.' + hs.level + '</span></div>' +
        '<div class="hdesc">' + U.escapeHtml(h.desc) + '<br><span style="color:var(--c-gold)">' + U.escapeHtml(h.talentDesc) + '</span></div>';
      card.appendChild(meta);
      var act = U.el('div', '');
      if (!hs.unlocked) {
        var ub = U.el('button', 'btn gold press clickable', '💎 ' + h.unlock);
        ub.style.padding = '10px 14px'; ub.style.fontSize = '14px';
        ub.addEventListener('click', function (e) { e.stopPropagation(); ctx.onUnlock(id); });
        act.appendChild(ub);
      } else {
        var isSel = p.selectedHero === id;
        if (!isSel) {
          var sb = U.el('button', 'btn green press clickable', '出战');
          sb.style.padding = '10px 14px'; sb.style.fontSize = '14px';
          sb.addEventListener('click', function (e) { e.stopPropagation(); ctx.onSelect(id); });
          act.appendChild(sb);
        }
        var lvBtn = U.el('button', 'btn press clickable', '升级');
        lvBtn.style.padding = '10px 12px'; lvBtn.style.fontSize = '13px'; lvBtn.style.marginTop = '6px';
        var cost = D.heroLevelCost(hs.level);
        var can = hs.level < D.HERO_MAX_LEVEL && p.coins >= cost;
        lvBtn.innerHTML = hs.level >= D.HERO_MAX_LEVEL ? '满级' : ('🪙 ' + U.fmt(cost));
        if (!can) lvBtn.classList.add('disabled');
        lvBtn.addEventListener('click', function (e) { e.stopPropagation(); ctx.onLevelUp(id); });
        act.appendChild(lvBtn);
      }
      act.style.display = 'flex'; act.style.flexDirection = 'column'; act.style.flex = '0 0 auto';
      card.appendChild(act);
      list.appendChild(card);
    });
  };

  /* =====================================================================
     永久强化
     ===================================================================== */
  UI.upgrades = function (ctx) {
    var p = ctx.profile;
    var el = screen('', 'sc-up');
    el.appendChild(topbar(ctx));
    var body = U.el('div', 'screen-body');
    var html = '<div class="card"><div class="card-title">⬆️ 永久强化</div>' +
      '<div style="font-size:11.5px;color:var(--c-text-dim);margin-bottom:10px">使用金币进行永久强化，对所有英雄生效。</div><div id="upList"></div></div>';
    body.innerHTML = html;
    el.appendChild(body);
    el.appendChild(UI.tabbar('upgrades', ctx.onTab));

    var list = q('#upList');
    D.UPGRADES.forEach(function (u) {
      var lv = p.upgrades[u.id];
      var cost = D.upgradeCost(u, lv);
      var maxed = lv >= u.max;
      var row = U.el('div', 'up-row');
      row.innerHTML = '<div class="uico">' + u.emoji + '</div>' +
        '<div class="ui2"><div class="un">' + u.name + ' <span class="lvtag">Lv.' + lv + '/' + u.max + '</span></div>' +
        '<div class="ud">当前 ' + u.label + ' +' + (u.id === 'balls' ? lv : Math.round(u.per * lv * 100) + '%') + '　·　每级 +' + (u.id === 'balls' ? '1 球' : Math.round(u.per * 100) + '%') + '</div></div>';
      var b = U.el('button', 'buy-btn' + (!maxed && p.coins < cost ? ' cant' : ''), maxed ? '满级' : ('🪙 ' + U.fmt(cost)));
      if (maxed) b.classList.add('maxed');
      b.addEventListener('click', function () { ctx.onUpgrade(u.id); });
      row.appendChild(b);
      list.appendChild(row);
    });
  };

  /* =====================================================================
     装备 / 合成
     ===================================================================== */
  UI.gear = function (ctx) {
    var p = ctx.profile;
    var el = screen('', 'sc-gear');
    el.appendChild(topbar(ctx));
    var body = U.el('div', 'screen-body');

    var html = '<div class="card"><div class="card-title">🎒 装备</div>' +
      '<div style="font-size:11.5px;color:var(--c-text-dim);margin-bottom:10px">Boss 会掉落装备。集齐 <b>3 件同栏位同品质</b> 自动合成为更高品质。</div><div id="gearList"></div>' +
      '<button class="btn gold block press clickable" id="btnMerge" style="margin-top:10px">一键合成</button></div>';
    body.innerHTML = html;
    el.appendChild(body);
    el.appendChild(UI.tabbar('gear', ctx.onTab));

    var list = q('#gearList');
    D.GEAR_SLOTS.forEach(function (slot) {
      var item = p.equipped[slot.id];
      var row = U.el('div', 'gear-slot' + (item ? ' rar-border-' + item.rarity : ''));
      var rar = item ? D.RARITY_MAP[item.rarity] : null;
      var bonus = item ? (D.GEAR_SLOT_MAP[slot.id].per * rar.mult) : 0;
      var count = p.bag.filter(function (g) { return g.slot === slot.id && (!item || g.rarity !== item.rarity); }).length;
      row.innerHTML = '<div class="gico">' + slot.emoji + '</div>' +
        '<div style="flex:1"><div class="gn">' + slot.name + '　' +
        (item ? '<span class="rar-' + item.rarity + '">' + rar.name + '</span>' : '<span style="color:#8b83a6">未装备</span>') + '</div>' +
        '<div class="gd">' + (item ? (slot.label + ' +' + (slot.unit === '%' ? Math.round(bonus * 100) + '%' : U.num1(bonus))) : '背包中 ' + count + ' 件同品质材料') + '</div></div>';
      if (item) {
        var off = U.el('button', 'btn ghost press clickable', '卸下');
        off.style.padding = '8px 12px'; off.style.fontSize = '13px';
        off.addEventListener('click', function () { ctx.onUnequip(slot.id); });
        row.appendChild(off);
      } else {
        var eq = U.el('button', 'btn green press clickable', '装备');
        eq.style.padding = '8px 12px'; eq.style.fontSize = '13px';
        var best = ctx.bestFor(slot.id);
        if (!best) { eq.classList.add('disabled'); eq.textContent = '无'; } else {
          eq.textContent = '装备 ' + D.RARITY_MAP[best.rarity].name;
          eq.addEventListener('click', function () { ctx.onEquip(best); });
        }
        row.appendChild(eq);
      }
      list.appendChild(row);
    });

    q('#btnMerge').addEventListener('click', function () { ctx.onMerge(); });

    /* 背包明细 */
    if (p.bag.length) {
      var bagCard = U.el('div', 'card');
      bagCard.innerHTML = '<div class="card-title">📦 背包（' + p.bag.length + '）</div>';
      var wrap = U.el('div', 'grid3');
      p.bag.slice(0, 24).forEach(function (g) {
        var s = D.GEAR_SLOT_MAP[g.slot];
        var cell = U.el('div', 'gear-slot rar-border-' + g.rarity);
        cell.style.padding = '8px'; cell.style.marginBottom = '0';
        cell.innerHTML = '<div class="gico rar-' + g.rarity + '" style="width:34px;height:34px;font-size:18px">' + s.emoji + '</div>';
        cell.addEventListener('click', function () { ctx.onEquip(g); });
        cell.classList.add('clickable');
        wrap.appendChild(cell);
      });
      bagCard.appendChild(wrap);
      body.appendChild(bagCard);
    }
  };

  /* =====================================================================
     局内商店
     ===================================================================== */
  UI.shop = function (ctx) {
    var p = ctx.profile;
    var el = screen('', 'sc-shop');
    el.appendChild(topbar({ profile: p, onBack: ctx.onBack, title: '技能商店', hideCurrency: true }));
    var body = U.el('div', 'screen-body');

    var html = '<div class="shop-head">';
    html += '  <div class="shop-budget">' + UI.ballIconHtml() + '<span id="shopBudget">' + U.fmt(ctx.balls) + '</span></div>';
    html += '  <div style="flex:1"></div>';
    html += '  <div class="chip" style="pointer-events:auto;background:rgba(10,6,22,.7);padding:8px 12px;border-radius:999px;font-weight:900;font-size:13px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12)">第 ' + ctx.stageInfo + '</div>';
    html += '</div>';
    html += '<div style="font-size:11.5px;color:var(--c-text-dim);margin:0 4px 10px">用倒球获得的球数购买技能，仅在本局生效，无法带入下一关。</div>';
    html += '<div id="shopList"></div>';
    body.innerHTML = html;
    el.appendChild(body);

    var footer = U.el('div', 'hud-bottom');
    footer.style.position = 'static';
    footer.style.padding = '10px 14px 16px';
    footer.innerHTML = '<div class="row">' +
      '<button class="btn ghost press clickable" id="btnReroll" style="flex:1;font-size:14px;padding:12px">🔄 刷新 (' + (ctx.rerollCost || 5) + UI.ballIconHtml() + ')</button>' +
      '<button class="btn green press clickable" id="btnNext" style="flex:1.4;font-size:15px">⚔️ 进入战斗</button>' +
      '</div>';
    el.appendChild(footer);

    renderShopList(ctx);

    q('#btnReroll').addEventListener('click', function () { ctx.onReroll(); });
    q('#btnNext').addEventListener('click', function () { ctx.onNext(); });
  };

  function renderShopList(ctx) {
    var list = q('#shopList');
    if (!list) return;
    U.clear(list);
    var p = ctx.profile;
    ctx.offers.forEach(function (off) {
      var skill = D.SKILL_MAP[off.id];
      var lv = ctx.runSkills[off.id] || 0;
      var maxed = lv >= skill.max;
      var cost = off.cost;
      var afford = !maxed && ctx.balls >= cost;
      var card = U.el('div', 'skill-card' + (afford ? ' affordable' : '') + (maxed ? ' maxed' : ''));
      card.innerHTML =
        '<div class="ico">' + skill.emoji + '</div>' +
        '<div class="info"><div class="sname">' + skill.name + ' <span class="lvl">' + (maxed ? '已满级' : ('Lv.' + (lv + 1) + '/' + skill.max)) + '</span></div>' +
        '<div class="sdesc">' + skill.desc(lv + 1) + '</div></div>';
      var b;
      if (maxed) b = U.el('button', 'buy-btn maxed', '已满');
      else {
        b = U.el('button', 'buy-btn' + (afford ? '' : ' cant'), UI.ballIconHtml() + ' ' + U.fmt(cost));
        b.style.flexDirection = 'column';
        b.addEventListener('click', function () { ctx.onBuy(off.id); });
      }
      card.appendChild(b);
      list.appendChild(card);
    });
    var budget = q('#shopBudget');
    if (budget) budget.textContent = U.fmt(ctx.balls);
  }
  UI.renderShopList = renderShopList;

  /* =====================================================================
     结算弹窗
     ===================================================================== */
  UI.result = function (ctx) {
    var mask = U.el('div', 'modal-mask');
    var win = ctx.win;
    var m = U.el('div', 'modal');
    var html = '';
    html += '<div style="font-size:48px;line-height:1">' + (win ? '🏆' : '💀') + '</div>';
    html += '<h2 style="color:' + (win ? 'var(--c-gold)' : 'var(--c-red)') + '">' + (win ? (ctx.isBoss ? 'Boss 已被击败！' : '波次清空！') : '英雄倒下了…') + '</h2>';
    html += '<div class="msub">' + U.escapeHtml(ctx.subtitle || '') + '</div>';
    if (win && ctx.rewards) {
      html += '<div class="reward-row">';
      if (ctx.rewards.coins) html += '<div class="reward-item"><span class="dot coin"></span>+' + U.fmt(ctx.rewards.coins) + '</div>';
      if (ctx.rewards.gems) html += '<div class="reward-item"><span class="dot gem"></span>+' + U.fmt(ctx.rewards.gems) + '</div>';
      if (ctx.rewards.items) html += '<div class="reward-item"><span class="ico">🎁</span>+' + ctx.rewards.items + '</div>';
      html += '</div>';
    }
    m.innerHTML = html;
    var btns = U.el('div', '', '');
    btns.style.display = 'flex'; btns.style.flexDirection = 'column'; btns.style.gap = '8px';
    (ctx.buttons || []).forEach(function (b) {
      var btn = U.el('button', 'btn ' + (b.style || 'gold') + ' block press clickable', b.label);
      btn.addEventListener('click', function () { b.onClick(); });
      btns.appendChild(btn);
    });
    m.appendChild(btns);
    mask.appendChild(m);
    root.appendChild(mask);
    return mask;
  };

  /* =====================================================================
     通用弹窗
     ===================================================================== */
  UI.modal = function (opts) {
    var mask = U.el('div', 'modal-mask');
    var m = U.el('div', 'modal');
    var html = '';
    if (opts.icon) html += '<div style="font-size:44px;line-height:1">' + opts.icon + '</div>';
    if (opts.title) html += '<h2>' + U.escapeHtml(opts.title) + '</h2>';
    if (opts.subtitle) html += '<div class="msub">' + opts.subtitle + '</div>';
    m.innerHTML = html;
    var btns = U.el('div', '');
    btns.style.display = 'flex'; btns.style.flexDirection = 'column'; btns.style.gap = '8px';
    (opts.buttons || [{ label: '确定', style: 'gold' }]).forEach(function (b) {
      var btn = U.el('button', 'btn ' + (b.style || 'gold') + ' block press clickable', b.label);
      btn.addEventListener('click', function () {
        CH.Audio.play('click');
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        if (b.onClick) b.onClick();
      });
      btns.appendChild(btn);
    });
    m.appendChild(btns);
    mask.appendChild(m);
    root.appendChild(mask);
    return mask;
  };

  UI.closeModals = function () {
    U.$$('.modal-mask', root).forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); });
  };

  /* =====================================================================
     顶栏
     ===================================================================== */
  function topbar(ctx) {
    var bar = U.el('div', 'topbar');
    var left = '';
    if (ctx.onBack) left = '<button class="icon-btn press clickable" data-tb="back">◀</button>';
    left += '<div style="font-weight:900;font-size:16px;margin-left:4px">' + U.escapeHtml(ctx.title || 'CUP HEROES') + '</div>';
    bar.innerHTML = left + '<div class="spacer"></div>' + (ctx.hideCurrency ? '' : currencyBar(ctx.profile)) +
      '<button class="icon-btn press clickable" data-tb="settings">⚙️</button>';
    if (ctx.onBack) q('[data-tb="back"]', bar).addEventListener('click', function () { CH.Audio.play('back'); ctx.onBack(); });
    q('[data-tb="settings"]', bar).addEventListener('click', function () { if (ctx.onSettings) ctx.onSettings(); else CH.Game.openSettings(); });
    return bar;
  }
  UI.topbar = topbar;

  /* =====================================================================
     HUD（倒球 / 战斗期间常驻）
     ===================================================================== */
  HUD.build = function () {
    var el = U.el('div', 'hud hidden');
    el.innerHTML =
      '<div class="hud-top">' +
      '  <div class="chip wave" id="hudWave">第 1 章 1-1</div>' +
      '  <div class="chip balls" id="hudBalls">' + UI.ballIconHtml() + '<span>0</span></div>' +
      '  <div style="flex:1"></div>' +
      '  <button class="icon-btn press clickable" id="hudPause" style="pointer-events:auto">⏸️</button>' +
      '</div>' +
      '<div id="hudHpWrap" class="hidden" style="position:absolute;left:12px;right:12px;top:56px">' +
      '  <div class="hp-bar"><i style="width:100%"></i><div class="label">100 / 100</div></div>' +
      '</div>' +
      '<div class="hud-bottom">' +
      '  <div id="hudBossWrap" class="hidden">' +
      '    <div class="hp-bar enemy"><i style="width:100%"></i><div class="label"></div></div>' +
      '  </div>' +
      '  <div class="row" id="hudActions"></div>' +
      '</div>';
    root.appendChild(el);
    HUD.el = el;
    HUD.actions = el.querySelector('#hudActions');
    HUD.hpWrap = el.querySelector('#hudHpWrap');
    HUD.hpBar = el.querySelector('#hudHpWrap .hp-bar > i');
    HUD.hpLabel = el.querySelector('#hudHpWrap .label');
    HUD.bossWrap = el.querySelector('#hudBossWrap');
    HUD.bossBar = el.querySelector('#hudBossWrap .hp-bar > i');
    HUD.bossLabel = el.querySelector('#hudBossWrap .label');
    HUD.waveEl = el.querySelector('#hudWave');
    HUD.ballsEl = el.querySelector('#hudBalls span');
    el.querySelector('#hudPause').addEventListener('click', function () { if (HUD.onPause) HUD.onPause(); });
  };

  HUD.show = function () { if (HUD.el) HUD.el.classList.remove('hidden'); };
  HUD.hide = function () { if (HUD.el) HUD.el.classList.add('hidden'); };
  HUD.setWave = function (t) { if (HUD.waveEl) HUD.waveEl.textContent = t; };
  HUD.setBalls = function (n) { if (HUD.ballsEl) HUD.ballsEl.textContent = U.fmt(n); };
  HUD.setHp = function (cur, max) {
    if (!HUD.hpBar) return;
    HUD.hpWrap.classList.remove('hidden');
    var pct = U.clamp(cur / max, 0, 1);
    HUD.hpBar.style.width = (pct * 100) + '%';
    HUD.hpBar.style.background = pct > 0.5 ? 'linear-gradient(180deg,#96f08f,#35a944)' : (pct > 0.25 ? 'linear-gradient(180deg,#ffd76a,#d99a13)' : 'linear-gradient(180deg,#ff9aa4,#d33544)');
    HUD.hpLabel.textContent = Math.max(0, Math.ceil(cur)) + ' / ' + Math.round(max);
  };
  HUD.hideHp = function () { if (HUD.hpWrap) HUD.hpWrap.classList.add('hidden'); };
  HUD.setBoss = function (pct, name) {
    if (!HUD.bossWrap) return;
    HUD.bossWrap.classList.remove('hidden');
    HUD.bossBar.style.width = (U.clamp(pct, 0, 1) * 100) + '%';
    HUD.bossLabel.textContent = name;
  };
  HUD.hideBoss = function () { if (HUD.bossWrap) HUD.bossWrap.classList.add('hidden'); };

  HUD.setActions = function (list) {
    if (!HUD.actions) return;
    U.clear(HUD.actions);
    list.forEach(function (a) {
      var btn = U.el('button', 'btn ' + (a.style || 'gold') + ' press clickable', a.label);
      btn.style.flex = a.flex || '1';
      btn.style.padding = '13px 14px';
      btn.style.fontSize = a.size || '16px';
      btn.addEventListener('click', function () { CH.Audio.play('click'); a.onClick(); });
      HUD.actions.appendChild(btn);
    });
  };
})();
