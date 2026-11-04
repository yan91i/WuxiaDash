/* ==========================================================================
   data.js - 游戏静态数据（英雄 / 技能 / 敌人 / 章节 / 装备 / 永久升级）
   挂载到 CH.Data
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var D = (CH.Data = {});

  /* ------------------------------------------------------------------ 英雄 */
  D.HEROES = {
    woodie: {
      id: 'woodie', name: '木灵', en: 'Woodie', emoji: '🌿',
      desc: '持续近战输出，攻击自带吸血，稳健推进流派。',
      base: { hp: 120, dmg: 13, atkMs: 780, ranged: false, proj: 1, cleave: false, projSpeed: 0 },
      growth: { hp: 13, dmg: 1.9, atkMs: -6 },
      talent: { lifesteal: 0.06 },
      talentDesc: '天赋：+6% 吸血',
      colors: { body: '#7ed957', trim: '#2f7a3a', accent: '#e6ffb0', face: '#2a4d22' },
      unlock: 0
    },
    cowboy: {
      id: 'cowboy', name: '牛仔', en: 'Cowboy', emoji: '🤠',
      desc: '远程点射，攻速极快，弹道数量随等级提升。',
      base: { hp: 92, dmg: 5, atkMs: 520, ranged: true, proj: 1, cleave: false, projSpeed: 640 },
      growth: { hp: 9, dmg: 0.95, atkMs: -5 },
      talent: { everyProj: 10 },
      talentDesc: '天赋：每 10 级 +1 弹道',
      colors: { body: '#e0b070', trim: '#8a5a25', accent: '#ffe6b0', face: '#4a2f10' },
      unlock: 0
    },
    barbarian: {
      id: 'barbarian', name: '野蛮人', en: 'Barbarian', emoji: '🪓',
      desc: '重击近战，高伤害范围劈砍，暴击率突出。',
      base: { hp: 155, dmg: 16, atkMs: 1150, ranged: false, proj: 1, cleave: true, projSpeed: 0 },
      growth: { hp: 16, dmg: 2.1, atkMs: -8 },
      talent: { crit: 0.15, critDmg: 1.8 },
      talentDesc: '天赋：+15% 暴击率',
      colors: { body: '#d96b4a', trim: '#7a2f1a', accent: '#ffcf9e', face: '#4a1c0c' },
      unlock: 0
    },
    rogue: {
      id: 'rogue', name: '盗贼', en: 'Rogue', emoji: '🗡️',
      desc: '超高攻速双刃，每击两段，闪避与暴击兼备。',
      base: { hp: 88, dmg: 6, atkMs: 380, ranged: false, proj: 1, cleave: false, multiHit: 2, projSpeed: 0 },
      growth: { hp: 8, dmg: 0.95, atkMs: -4 },
      talent: { dodge: 0.12, crit: 0.1 },
      talentDesc: '天赋：+12% 闪避 / +10% 暴击',
      colors: { body: '#9b8cff', trim: '#4a3a99', accent: '#e0d8ff', face: '#251a4d' },
      unlock: 60
    },
    knight: {
      id: 'knight', name: '骑士杯', en: 'Knight Cup', emoji: '🛡️',
      desc: '厚血坦克，持盾格挡伤害并反弹。',
      base: { hp: 235, dmg: 11, atkMs: 1000, ranged: false, proj: 1, cleave: true, armor: 0.15, projSpeed: 0 },
      growth: { hp: 24, dmg: 1.5, atkMs: -6 },
      talent: { thorns: 0.15 },
      talentDesc: '天赋：格挡并反弹 15% 伤害',
      colors: { body: '#b8c4d4', trim: '#5a6b82', accent: '#eaf2ff', face: '#2a3646' },
      unlock: 150
    },
    ninja: {
      id: 'ninja', name: '忍杯', en: 'Ninja Cup', emoji: '🥷',
      desc: '投掷手里剑，弹道穿透，闪避极高。',
      base: { hp: 96, dmg: 7, atkMs: 440, ranged: true, proj: 1, pierce: 1, projSpeed: 800 },
      growth: { hp: 9, dmg: 1.1, atkMs: -4 },
      talent: { dodge: 0.2 },
      talentDesc: '天赋：+20% 闪避',
      colors: { body: '#5a5f7a', trim: '#22263a', accent: '#c8cfe6', face: '#12141f' },
      unlock: 120
    }
  };
  D.HERO_ORDER = ['woodie', 'cowboy', 'barbarian', 'rogue', 'knight', 'ninja'];

  /* ------------------------------------------------------------ 战斗技能（局内商店） */
  D.SKILLS = [
    { id: 'damage', name: '力量强化', emoji: '💪', max: 8, base: 60, growth: 1.55,
      desc: function (l) { return '英雄伤害 +' + Math.round(22 * l) + '%'; },
      info: '每级伤害 +22%' },
    { id: 'atkspeed', name: '疾风连击', emoji: '⚡', max: 6, base: 70, growth: 1.6,
      desc: function (l) { return '攻击速度 +' + Math.round(14 * l) + '%'; },
      info: '每级攻速 +14%' },
    { id: 'multishot', name: '多重射击', emoji: '🎯', max: 4, base: 120, growth: 1.85,
      desc: function (l) { return '额外攻击目标 +' + l; },
      info: '每级 +1 攻击目标' },
    { id: 'crit', name: '致命一击', emoji: '💥', max: 6, base: 80, growth: 1.6,
      desc: function (l) { return '暴击率 +' + Math.round(8 * l) + '%，暴击伤害 +' + Math.round(25 * l) + '%'; },
      info: '每级 +8% 暴击率 / +25% 暴伤' },
    { id: 'dodge', name: '幻影步', emoji: '💨', max: 5, base: 85, growth: 1.6,
      desc: function (l) { return '闪避率 +' + Math.round(7 * l) + '%'; },
      info: '每级 +7% 闪避' },
    { id: 'lifesteal', name: '嗜血', emoji: '🩸', max: 5, base: 90, growth: 1.65,
      desc: function (l) { return '造成伤害的 ' + Math.round(2.5 * l * 10) / 10 + '% 转为治疗'; },
      info: '每级 +2.5% 吸血' },
    { id: 'maxhp', name: '生命祝福', emoji: '❤️', max: 6, base: 75, growth: 1.5,
      desc: function (l) { return '最大生命 +' + (30 * l) + '，并立即回复同等生命'; },
      info: '每级 +30 最大生命并回复' },
    { id: 'regen', name: '圣光庇护', emoji: '✨', max: 5, base: 80, growth: 1.55,
      desc: function (l) { return '每秒回复 ' + (Math.round(1.2 * l * 10) / 10) + ' 生命'; },
      info: '每级 +1.2 生命/秒' },
    { id: 'pierce', name: '贯穿', emoji: '➡️', max: 3, base: 110, growth: 1.8,
      desc: function (l) { return '投射物可额外穿透 ' + l + ' 个敌人'; },
      info: '每级 +1 穿透' },
    { id: 'ballgain', name: '丰收之球', emoji: '⚪', max: 5, base: 65, growth: 1.55,
      desc: function (l) { return '倒球阶段收益 +' + Math.round(15 * l) + '%'; },
      info: '每级 +15% 倒球收益' },
    { id: 'magnet', name: '战利磁石', emoji: '🧲', max: 4, base: 70, growth: 1.6,
      desc: function (l) { return '击杀掉落的白球 +' + Math.round(25 * l) + '%'; },
      info: '每级 +25% 击杀掉球' },
    { id: 'thorns', name: '反伤甲', emoji: '🌵', max: 4, base: 85, growth: 1.6,
      desc: function (l) { return '受到伤害时反弹 ' + Math.round(12 * l) + '%'; },
      info: '每级 +12% 反伤' }
  ];
  D.SKILL_MAP = {};
  D.SKILLS.forEach(function (s) { D.SKILL_MAP[s.id] = s; });

  /* ------------------------------------------------------------------ 敌人 */
  D.ENEMIES = {
    slime: { id: 'slime', name: '史莱姆', emoji: '🟢', hp: 32, dmg: 6, speed: 26, size: 28, balls: 2, color: '#63e06a', trim: '#2c9b3a' },
    goblin: { id: 'goblin', name: '哥布林', emoji: '👺', hp: 48, dmg: 9, speed: 40, size: 28, balls: 3, color: '#8fce4a', trim: '#4a7720' },
    bat: { id: 'bat', name: '毒蝠', emoji: '🦇', hp: 26, dmg: 7, speed: 56, size: 22, balls: 2, color: '#a26bff', trim: '#5a2f9e', flying: true },
    orc: { id: 'orc', name: '兽人', emoji: '👹', hp: 95, dmg: 14, speed: 32, size: 34, balls: 4, color: '#5fa84c', trim: '#2c5a20' },
    mage: { id: 'mage', name: '暗法师', emoji: '🧙', hp: 62, dmg: 12, speed: 24, size: 30, balls: 5, ranged: true, atkMs: 1800, color: '#6ba8ff', trim: '#2a4f99' },
    archer: { id: 'archer', name: '弓手', emoji: '🏹', hp: 52, dmg: 10, speed: 30, size: 28, balls: 4, ranged: true, atkMs: 1600, color: '#d9a441', trim: '#8a5f16' },
    brute: { id: 'brute', name: '重甲兵', emoji: '🛡️', hp: 160, dmg: 17, speed: 22, size: 38, balls: 6, armor: 0.2, color: '#9aa5b1', trim: '#5a6675' },
    spirit: { id: 'spirit', name: '怨灵', emoji: '👻', hp: 70, dmg: 13, speed: 46, size: 30, balls: 4, flying: true, color: '#c8d8ff', trim: '#6a7fb0' },
    golem: { id: 'golem', name: '石魔', emoji: '🪨', hp: 260, dmg: 22, speed: 18, size: 44, balls: 8, armor: 0.28, color: '#8c8f96', trim: '#4d5057' }
  };
  D.ENEMY_ORDER = ['slime', 'goblin', 'bat', 'orc', 'mage', 'archer', 'brute', 'spirit', 'golem'];

  /* ------------------------------------------------------------------ Boss */
  D.BOSSES = {
    slimeKing: { id: 'slimeKing', name: '史莱姆王', emoji: '👑', hp: 200, dmg: 30, speed: 20, size: 66, balls: 40, color: '#63e06a', trim: '#2c9b3a', ability: 'slam' },
    mineTroll: { id: 'mineTroll', name: '矿洞巨魔', emoji: '🪨', hp: 330, dmg: 36, speed: 18, size: 72, balls: 55, color: '#9aa5b1', trim: '#4d5057', ability: 'slam' },
    flameLord: { id: 'flameLord', name: '烈焰领主', emoji: '🔥', hp: 460, dmg: 42, speed: 22, size: 70, balls: 70, color: '#ff6b3a', trim: '#8a2a10', ability: 'fireballs' },
    frostGiant: { id: 'frostGiant', name: '霜巨人', emoji: '❄️', hp: 620, dmg: 48, speed: 16, size: 78, balls: 85, color: '#8fd8ff', trim: '#2a6a99', ability: 'slam' },
    sandWorm: { id: 'sandWorm', name: '沙虫', emoji: '🐛', hp: 790, dmg: 54, speed: 24, size: 74, balls: 100, color: '#e0b070', trim: '#8a5a25', ability: 'fireballs' },
    wraithQueen: { id: 'wraithQueen', name: '幽魂女王', emoji: '💀', hp: 980, dmg: 60, speed: 26, size: 72, balls: 120, color: '#c8a8ff', trim: '#5a2f9e', ability: 'fireballs' },
    skyDrake: { id: 'skyDrake', name: '苍穹巨龙', emoji: '🐲', hp: 1200, dmg: 66, speed: 28, size: 82, balls: 145, color: '#7ed9ff', trim: '#2a6a99', ability: 'fireballs' },
    chaosDemon: { id: 'chaosDemon', name: '混沌魔王', emoji: '😈', hp: 1450, dmg: 74, speed: 30, size: 86, balls: 180, color: '#ff5d6c', trim: '#7a0f1c', ability: 'slam' }
  };
  D.BOSS_ORDER = ['slimeKing', 'mineTroll', 'flameLord', 'frostGiant', 'sandWorm', 'wraithQueen', 'skyDrake', 'chaosDemon'];

  /* ------------------------------------------------------------------ 章节 */
  D.STAGES_PER_CHAPTER = 5;
  D.WAVES_PER_STAGE = 3;

  D.CHAPTERS = [
    { n: 1, name: '神秘森林', enemies: ['slime', 'goblin', 'bat'],
      theme: { sky: ['#8fe3ff', '#d8f8c8'], hill: '#3f8f4a', hill2: '#2b6b3c', ground: '#3f8f4a', ground2: '#2b6b3c', accent: '#7ed957', fog: 'rgba(120,220,140,.10)' } },
    { n: 2, name: '幽暗矿洞', enemies: ['goblin', 'bat', 'orc'],
      theme: { sky: ['#4a3a7a', '#20143f'], hill: '#3a2a5e', hill2: '#251a42', ground: '#4a3a6e', ground2: '#2a1c48', accent: '#b06bff', fog: 'rgba(150,110,255,.12)' } },
    { n: 3, name: '灼热火山', enemies: ['orc', 'mage', 'brute'],
      theme: { sky: ['#ff8a4a', '#5a1808'], hill: '#7a2a12', hill2: '#4a1608', ground: '#5a2010', ground2: '#38100a', accent: '#ff6b3a', fog: 'rgba(255,110,60,.14)' } },
    { n: 4, name: '冰封雪原', enemies: ['brute', 'mage', 'spirit'],
      theme: { sky: ['#bfeaff', '#e8f8ff'], hill: '#8fc8e0', hill2: '#6aa8c8', ground: '#cfe8f5', ground2: '#9dc4dc', accent: '#8fd8ff', fog: 'rgba(200,240,255,.18)' } },
    { n: 5, name: '遗忘沙漠', enemies: ['archer', 'brute', 'golem'],
      theme: { sky: ['#ffd98a', '#ffb45a'], hill: '#d9a441', hill2: '#a8762a', ground: '#e0b070', ground2: '#a8762a', accent: '#ffcd3c', fog: 'rgba(255,210,120,.14)' } },
    { n: 6, name: '幽灵墓地', enemies: ['spirit', 'mage', 'golem'],
      theme: { sky: ['#5a4a7a', '#181028'], hill: '#3a2f52', hill2: '#241c38', ground: '#3a2f52', ground2: '#221a34', accent: '#c8a8ff', fog: 'rgba(160,130,220,.16)' } },
    { n: 7, name: '天空之城', enemies: ['spirit', 'archer', 'golem'],
      theme: { sky: ['#7ed9ff', '#dff4ff'], hill: '#a8d8f0', hill2: '#7ab0d0', ground: '#d8ecf8', ground2: '#a8c8dc', accent: '#57e0ff', fog: 'rgba(200,240,255,.2)' } },
    { n: 8, name: '混沌深渊', enemies: ['golem', 'brute', 'spirit'],
      theme: { sky: ['#4a1030', '#0a0410'], hill: '#3a0f28', hill2: '#1e0616', ground: '#2a0a1c', ground2: '#150510', accent: '#ff5d6c', fog: 'rgba(255,80,110,.16)' } }
  ];

  /* 根据章节号取章节配置（超过 8 章循环并加强） */
  D.getChapter = function (n) {
    var idx = (n - 1) % D.CHAPTERS.length;
    var loop = Math.floor((n - 1) / D.CHAPTERS.length);
    var base = D.CHAPTERS[idx];
    if (loop === 0) return base;
    // 循环章节：数值增强
    return {
      n: n, name: base.name + ' II'.repeat(loop), enemies: base.enemies, theme: base.theme,
      loopBonus: loop
    };
  };

  /* ------------------------------------------------------------------ 装备 */
  D.GEAR_SLOTS = [
    { id: 'weapon', name: '武器', emoji: '⚔️', stat: 'damage', per: 0.08, unit: '%', label: '伤害' },
    { id: 'helmet', name: '头盔', emoji: '⛑️', stat: 'health', per: 0.09, unit: '%', label: '生命' },
    { id: 'armor', name: '护甲', emoji: '🛡️', stat: 'health', per: 0.12, unit: '%', label: '生命' },
    { id: 'boots', name: '战靴', emoji: '👟', stat: 'dodge', per: 0.03, unit: '%', label: '闪避' },
    { id: 'ring', name: '戒指', emoji: '💍', stat: 'crit', per: 0.04, unit: '%', label: '暴击' },
    { id: 'amulet', name: '护符', emoji: '🔮', stat: 'regen', per: 0.5, unit: '', label: '生命/秒' }
  ];
  D.GEAR_SLOT_MAP = {};
  D.GEAR_SLOTS.forEach(function (s) { D.GEAR_SLOT_MAP[s.id] = s; });

  D.RARITY = [
    { id: 'common', name: '普通', mult: 1.0, color: '#cbd3e0' },
    { id: 'epic', name: '史诗', mult: 2.2, color: '#b06bff' },
    { id: 'legendary', name: '传说', mult: 4.6, color: '#ffcd3c' },
    { id: 'mythic', name: '神话', mult: 9.5, color: '#ff6b8a' }
  ];
  D.RARITY_MAP = {};
  D.RARITY.forEach(function (r, i) { r.index = i; D.RARITY_MAP[r.id] = r; });

  /* 3 件同栏位同稀有度 -> 1 件更高稀有度 */
  D.MERGE_COUNT = 3;

  /* ------------------------------------------------------------ 永久升级 */
  D.UPGRADES = [
    { id: 'damage', name: '攻击训练', emoji: '💪', per: 0.06, max: 25, base: 120, growth: 1.5, label: '伤害' },
    { id: 'health', name: '体质训练', emoji: '❤️', per: 0.08, max: 25, base: 120, growth: 1.5, label: '生命' },
    { id: 'balls', name: '球袋扩容', emoji: '⚪', per: 1, max: 15, base: 200, growth: 1.75, label: '初始球' },
    { id: 'speed', name: '敏捷训练', emoji: '⚡', per: 0.04, max: 15, base: 180, growth: 1.65, label: '攻速' }
  ];
  D.UPGRADE_MAP = {};
  D.UPGRADES.forEach(function (u) { D.UPGRADE_MAP[u.id] = u; });
  D.upgradeCost = function (u, level) { return Math.floor(u.base * Math.pow(u.growth, level)); };

  /* 英雄升级所需金币 */
  D.heroLevelCost = function (level) { return Math.floor(60 * Math.pow(level, 1.32)); };
  D.HERO_MAX_LEVEL = 60;
  /* 升级到下一级所需经验 */
  D.heroXpNeed = function (level) { return Math.floor(40 * Math.pow(level, 1.15)); };

  /* -------------------------------------------------------- 局内初始参数 */
  D.BASE_CUP_BALLS = 6;      // 每波基础球数
  D.RUN_START_COINS = 0;
  D.BALL_CAP_SPRITES = 260;  // 单次倒球最多模拟的球精灵数量
})();
