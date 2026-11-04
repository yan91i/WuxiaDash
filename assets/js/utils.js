/* ==========================================================================
   utils.js - 通用工具函数（数学 / 随机 / 格式化 / DOM 助手）
   挂载到全局命名空间 CH.U
   ========================================================================== */
(function () {
  'use strict';
  var CH = (window.CH = window.CH || {});
  var U = (CH.U = {});

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.choice = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.chance = function (p) { return Math.random() < p; };
  U.dist = function (x1, y1, x2, y2) { return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)); };
  U.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };

  U.shuffle = function (arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.easeOutQuad = function (t) { return 1 - (1 - t) * (1 - t); };

  /* 数字缩写：1234 -> 1.2K */
  U.fmt = function (n) {
    n = Math.floor(n);
    var neg = n < 0; if (neg) n = -n;
    var s;
    if (n < 1000) s = '' + n;
    else if (n < 1e6) s = (n / 1000).toFixed(n < 1e4 ? 1 : 0) + 'K';
    else if (n < 1e9) s = (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + 'M';
    else if (n < 1e12) s = (n / 1e9).toFixed(1) + 'B';
    else s = (n / 1e12).toFixed(1) + 'T';
    return (neg ? '-' : '') + s;
  };

  /* 保留一位小数，去掉多余的 .0 */
  U.num1 = function (n) { var r = Math.round(n * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); };

  /* 三维/二维距离快捷 */
  U.rectsOverlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  /* 带种子的伪随机（用于关卡生成，保证同一关可复现） */
  U.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- DOM 助手 ---------- */
  U.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  /* 轻量事件委托 */
  U.on = function (root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target;
      while (t && t !== root) {
        if (t.matches && t.matches(sel)) { fn(e, t); return; }
        t = t.parentNode;
      }
    });
  };

  U.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  U.now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

  /* localStorage 安全包装（隐私模式下可能抛错） */
  U.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
})();
