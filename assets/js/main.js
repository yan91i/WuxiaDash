/* ==========================================================================
   main.js - 启动引导与主循环（requestAnimationFrame）
   ========================================================================== */
(function () {
  'use strict';
  var CH = window.CH;
  var last = 0;

  function frame(now) {
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    try { CH.Game.tick(dt); } catch (e) { /* 防止单帧异常中断循环 */ console && console.error && console.error(e); }
    requestAnimationFrame(frame);
  }

  function onFirstInteract() {
    CH.Audio.init();
    CH.Audio.resume();
    if (CH.Storage.p().settings.music) CH.Audio.startMusic();
    window.removeEventListener('pointerdown', onFirstInteract);
    window.removeEventListener('touchstart', onFirstInteract);
    window.removeEventListener('keydown', onFirstInteract);
  }

  function boot() {
    try {
      CH.Game.boot();
    } catch (e) {
      console && console.error && console.error('启动失败', e);
      var ui = document.getElementById('ui');
      if (ui) ui.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#fff;font-family:sans-serif">' +
        '<div><h2>启动失败</h2><p style="opacity:.8;font-size:13px">' + String(e && e.message || e) + '</p></div></div>';
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointerdown', onFirstInteract, { once: false });
  window.addEventListener('touchstart', onFirstInteract, { once: false });
  window.addEventListener('keydown', onFirstInteract, { once: false });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
