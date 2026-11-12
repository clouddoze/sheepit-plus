/* ==== 72-sweep.js：两套界面之间的扫光切换 ==== */
/* 这个模块只做两件事，都跟"换界面"有关，都不依赖 SP.CSS（原版界面下那份样式是故意不加载的）：

   1) play()：一块整屏幕布扫过，**盖满的那一刻**执行 mid()（真正换界面），再朝同方向退场。
      换的是界面不是页面 —— 没有导航、没有白屏，600ms 上下。
   2) veil()：真要导航到另一页时先盖上这层，让"等"看起来是有意的，而不是点了没反应。

   动效只用 transform/opacity；prefers-reduced-motion 下不演，直接换。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;

  const STYLE_ID = 'sp-sweep-style';
  const Z = 2147483500;   // #sp 是 2147483000，幕布必须压在它上面
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #sp-sweep{position:fixed;inset:0;z-index:${Z};pointer-events:none;overflow:hidden}
      /* 幕布：整屏一块，靠 transform 平移。颜色 = 目标界面的底色（见调用处），
         盖满时屏幕已经是"要露出来的那一层"的颜色，所以接缝看不见。 */
      #sp-sweep .curtain{position:absolute;inset:0;background:var(--sp-sweep-bg,#0b0d11);
        transform:translateX(-101%);will-change:transform}
      /* 前沿那道光：品牌橙，跟着幕布的前缘走 —— 这是"扫光"真正被看见的地方。 */
      #sp-sweep .lead{position:absolute;top:0;bottom:0;right:0;width:2px;
        background:linear-gradient(180deg,rgba(224,109,88,0),#e06d58 22%,#ffd9c9 50%,#e06d58 78%,rgba(224,109,88,0));
        box-shadow:0 0 22px 6px rgba(224,109,88,.45)}
      #sp-sweep.rtl .lead{right:auto;left:0}
      /* 横着扫过整屏的一道柔光：比幕布快半拍，读起来像光掠过而不是又一块板 */
      /* 浅色幕布上白光是看不见的：暖橙必须占主调，白芯只负责在暗色主题下发光 */
      #sp-sweep .beam{position:absolute;top:-30%;bottom:-30%;left:0;width:42%;
        background:linear-gradient(100deg,rgba(224,109,88,0) 0%,rgba(224,109,88,.10) 28%,
          rgba(224,109,88,.30) 44%,rgba(255,255,255,.55) 50%,rgba(224,109,88,.30) 56%,
          rgba(224,109,88,.10) 72%,rgba(224,109,88,0) 100%);
        filter:blur(6px);opacity:.9;will-change:transform}

      #sp-veil{position:fixed;inset:0;z-index:${Z};display:grid;place-items:center;
        background:var(--sp-veil-bg,#0b0d11);color:var(--sp-veil-ink,rgba(232,234,237,.72));
        font:500 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        opacity:0;transition:opacity .16s ease;cursor:progress}
      #sp-veil.on{opacity:1}
      #sp-veil .box{display:flex;align-items:center;gap:9px}
      #sp-veil .dot{width:7px;height:7px;border-radius:50%;background:#e06d58;
        animation:sp-veil-pulse 1.1s ease-in-out infinite}
      @keyframes sp-veil-pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
      @media (prefers-reduced-motion:reduce){
        #sp-veil .dot{animation:none;opacity:.8}
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  /** 导航前的遮罩：只是"正在打开"，点不穿、不闪白 */
  function veil(text, bg, ink) {
    if (!document.body || document.getElementById('sp-veil')) return;
    ensureStyle();
    const host = document.createElement('div');
    host.id = 'sp-veil';
    /* 这一层是状态不是装饰：告诉读屏软件"正在打开"，别让它以为页面卡住了 */
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.style.setProperty('--sp-veil-bg', bg || '#0b0d11');
    host.style.setProperty('--sp-veil-ink', ink || 'rgba(232,234,237,.72)');
    const box = document.createElement('div');
    box.className = 'box';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = text || '';
    box.appendChild(dot);
    box.appendChild(txt);
    host.appendChild(box);
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add('on'));
    /* 兜底：跳转没发生（被拦下/失败）时别把页面永久盖住 */
    setTimeout(() => {
      host.classList.remove('on');
      setTimeout(() => host.remove(), 220);
    }, 7000);
  }

  /** 盖一层幕布，然后离开这一页。先让幕布真的画上一帧，否则浏览器可能直接开始导航、它一次都没出现过。 */
  function veilThen(url, text, bg) {
    if (document.getElementById('sp-veil')) return;   // 已经在走了：连点不该再排一次导航
    veil(text, bg);
    setTimeout(() => { location.assign(url); }, 140);
  }

  SP.Sweep = { veil, veilThen };
})();
