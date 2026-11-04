/* ==========================================================================
   storage.js - 存档（localStorage 持久化）
   管理玩家档案：货币、英雄、永久升级、装备、关卡进度、设置
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = CH.U;
  var KEY = 'cupheroes.save.v1';
  var S = (CH.Storage = {});

  function heroDefault(id, unlocked) {
    return { id: id, level: 1, xp: 0, unlocked: !!unlocked, shards: 0 };
  }

  S.defaultProfile = function () {
    return {
      v: 1,
      coins: 320,
      gems: 40,
      tokens: 0,
      selectedHero: 'woodie',
      heroes: {
        woodie: heroDefault('woodie', true),
        cowboy: heroDefault('cowboy', true),
        barbarian: heroDefault('barbarian', true),
        rogue: heroDefault('rogue', false),
        knight: heroDefault('knight', false),
        ninja: heroDefault('ninja', false)
      },
      /* 永久升级等级 */
      upgrades: { damage: 0, health: 0, balls: 0, speed: 0 },
      /* 已装备栏位 -> {slot,rarity,plus} | null */
      equipped: { weapon: null, helmet: null, armor: null, boots: null, ring: null, amulet: null },
      /* 背包（用于合成） */
      bag: [],
      progress: { chapter: 1, stage: 1, maxChapter: 1, maxStage: 1 },
      endless: { best: 0 },
      stats: { runs: 0, kills: 0, bossKills: 0, bestWave: 0, totalBalls: 0 },
      settings: { sound: true, music: true, haptics: true },
      seen: {}
    };
  };

  S.data = null;

  S.load = function () {
    var raw = U.store.get(KEY);
    var def = S.defaultProfile();
    if (!raw) { S.data = def; return S.data; }
    try {
      var parsed = JSON.parse(raw);
      S.data = S.merge(def, parsed);
    } catch (e) {
      S.data = def;
    }
    return S.data;
  };

  /* 深度合并，保证新增字段在旧存档上也能存在 */
  S.merge = function (def, src) {
    if (src == null || typeof src !== 'object') return def;
    if (Array.isArray(def)) return Array.isArray(src) ? src : def;
    var out = {}, k;
    for (k in def) {
      if (!Object.prototype.hasOwnProperty.call(def, k)) continue;
      if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) {
        out[k] = S.merge(def[k], src[k]);
      } else {
        out[k] = (k in src && src[k] !== undefined) ? src[k] : def[k];
      }
    }
    return out;
  };

  var saveTimer = null;
  S.save = function (immediate) {
    if (!S.data) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (immediate) { U.store.set(KEY, JSON.stringify(S.data)); return; }
    saveTimer = setTimeout(function () { U.store.set(KEY, JSON.stringify(S.data)); saveTimer = null; }, 250);
  };

  S.reset = function () {
    U.store.del(KEY);
    S.data = S.defaultProfile();
    S.save(true);
  };

  /* 便捷访问 */
  S.p = function () { return S.data || S.load(); };
})();
