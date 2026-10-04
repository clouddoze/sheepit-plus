/* ==========================================================================
 * 70-i18n-dom.js — 原站页面的翻译层
 *
 * 为什么需要单独一层：重建过的视图里文案是我写的，天然多语言；但未接管的页面
 * （/faq、/servers、/team、/project/*…）是 PHP 服务端渲染的英文，
 * 只能在客户端翻译。
 *
 * 三层匹配，对应站点文案的三种形态：
 *   1) 精确词条  —— 单个文本节点就是一个完整词条（"Frames remaining"）
 *   2) 属性文案  —— title / placeholder / alt（"CPU disabled"）
 *   3) 整块替换  —— 被 <a>/<strong> 切碎的句子。纯文本节点逐段替换会把语序打碎，
 *                   所以这里对段落级元素做整体匹配，值可以是 HTML（保留链接）
 * 另有模式规则处理带变量的文案（"13 Rendering frames"）。
 *
 * 安全边界（很重要）：
 *   · 只替换"词典里有对应译文"的字符串 —— 项目名、用户名、新闻正文天然不会被
 *     误译，因为它们不在词典里。这是 exact-match 带来的天然保护。
 *   · 不进入 #sp（我自己的界面）、script/style/noscript/code/pre/svg/textarea。
 *   · 不做机器翻译，不向任何服务器发送文本。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  const { I18n, Util } = SP;
  const SKIP_TAGS = /^(script|style|noscript|code|pre|svg|textarea|iframe|canvas)$/i;
  const BLOCK_SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,blockquote,figcaption,div,span';
  const ATTRS = ['title', 'placeholder', 'alt'];

  /** 整块文本归一化：连续空白折叠、nbsp 归一、标点前空格去掉。
   *  页面文本与词典键都过同一个函数，所以键写成自然写法也能对上。 */
  function normalizeBlock(s) {
    return String(s)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+([,.;:!?%)])/g, '$1')
      .replace(/([(])\s+/g, '$1');
  }

  const DomI18n = {
    enabled: true,
    observer: null,
    timer: null,
    _blockIndex: null,
    _blockIndexFor: null,
    stats: { text: 0, attr: 0, block: 0 },

    /* ---------------------------------------------------------- 索引 */

    blockIndex() {
      const pack = I18n.SITE[I18n.lang];
      if (!pack) return null;
      if (this._blockIndexFor === pack) return this._blockIndex;
      const m = new Map();
      for (const [k, v] of Object.entries(pack.blocks || {})) m.set(normalizeBlock(k), v);
      this._blockIndex = m;
      this._blockIndexFor = pack;
      return m;
    },

    /* ---------------------------------------------------------- 翻译单点 */

    /** 短词条：保留首尾空白（原文里常有缩进与 &nbsp;） */
    textNodeValue(node) {
      const raw = node.nodeValue;
      if (!raw) return null;
      if (!/[A-Za-z]/.test(raw)) return null;
      const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!m) return null;
      const [, lead, core, trail] = m;
      if (core.length < 2) return null;
      const hit = I18n.siteText(normalizeBlock(core));
      return hit === null ? null : lead + hit + trail;
    },

    attrValue(v) {
      if (!v || v.length < 2 || !/[A-Za-z]/.test(v)) return null;
      return I18n.siteText(normalizeBlock(v));
    },

    /* ---------------------------------------------------------- 批量处理 */

    patchTextNodes(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = n.parentElement;
          if (!p || SKIP_TAGS.test(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.closest('#sp')) return NodeFilter.FILTER_REJECT;
          if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let n;
      while ((n = walker.nextNode())) {
        const out = this.textNodeValue(n);
        if (out !== null) { n.nodeValue = out; this.stats.text++; }
      }
    },

    patchAttributes(root) {
      const els = root.querySelectorAll ? root.querySelectorAll(`[${ATTRS.join('],[')}]`) : [];
      for (const el of els) {
        if (el.closest('#sp')) continue;
        for (const a of ATTRS) {
          const v = el.getAttribute(a);
          if (!v) continue;
          const out = this.attrValue(v);
          if (out !== null) { el.setAttribute(a, out); this.stats.attr++; }
        }
      }
      // 提交按钮的 value 也是界面文案
      for (const el of (root.querySelectorAll ? root.querySelectorAll('input[type="submit"],input[type="button"]') : [])) {
        const v = el.getAttribute('value');
        const out = this.attrValue(v);
        if (out !== null) { el.setAttribute('value', out); this.stats.attr++; }
      }
    },

    /**
     * 整块替换。只对「像一段话」的元素动手：文本 40–600 字符、后代元素 ≤ 14 个，
     * 避免误伤包裹整页的容器。先查静态键，再走正则规则（段落里含动态数字时用）。
     */
    patchBlocks(root) {
      const idx = this.blockIndex();
      const pack = I18n.SITE[I18n.lang];
      const bp = (pack && pack.blockPatterns) || [];
      if ((!idx || !idx.size) && !bp.length) return;

      const cands = [];
      for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
        if (el.closest('#sp') || el.closest('[data-sp-block]')) continue;
        /* 整块替换 = `el.innerHTML = 译文`，这个容器里的东西**全部**没了。
           所以只要子树里有一件"能干活或能画"的东西就必须放手 —— 实测踩过：
           /getstarted 的上传表单里，站点那句 "Max: 2,048 MB before ZIP compression…"
           和 `<input type="file">` 同在一个 <td> 里，整块替换把文件框直接删掉了，
           而开着翻译的正好就是中文用户 —— 一翻译就不能上传。链接（<a>）不算：
           整块译文本就是为"被 <a>/<strong> 切碎的句子"写的，译文里带着链接。 */
        if (el.querySelector('input,select,textarea,button,label,form,svg,canvas,video,iframe')) continue;
        const kidCount = el.querySelectorAll('*').length;
        if (kidCount > 14) continue;                     // 太大了，是容器不是段落
        const norm = normalizeBlock(el.textContent);
        if (norm.length < 40 || norm.length > 600) continue;
        let html = idx ? idx.get(norm) : undefined;
        if (html === undefined) {
          for (const [re, rep] of bp) { if (re.test(norm)) { html = norm.replace(re, rep); break; } }
        }
        if (html === undefined) continue;
        cands.push([el, norm, html]);
      }
      // 从外到内会互相覆盖，先处理最长的（最具体），处理过的子树打标记跳过
      cands.sort((a, b) => b[1].length - a[1].length);
      for (const [el, , html] of cands) {
        if (!el.isConnected || el.closest('[data-sp-block]')) continue;
        el.innerHTML = html;
        el.setAttribute('data-sp-block', '1');
        this.stats.block++;
      }
    },

    /* ---------------------------------------------------------- 入口 */

    run() {
      if (!this.enabled || !I18n.canTranslateSite()) return;
      if (!document.body) return;
      this.disconnect();
      try {
        this.patchBlocks(document.body);
        this.patchTextNodes(document.body);
        this.patchAttributes(document.body);
      } finally {
        this.observe();
      }
    },

    schedule() {
      if (this.timer) return;
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
      this.timer = idle(() => { this.timer = null; this.run(); }, { timeout: 600 });
    },

    observe() {
      if (this.observer || !document.body) return;
      this.observer = new MutationObserver((records) => {
        // 只关心"新增了节点"或"属性变了"，纯 characterData 多数是我自己改的
        const relevant = records.some((r) =>
          r.type === 'childList' || (r.type === 'attributes' && ATTRS.includes(r.attributeName)));
        if (relevant) this.schedule();
      });
      this.observer.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ATTRS.concat(['value']),
      });
    },

    disconnect() {
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
    },

    /* ---------------------------------------------------------- 开关 */

    setEnabled(on) {
      this.enabled = !!on;
      Util.store.set('translateSite', this.enabled);
      if (on) { this.run(); document.documentElement.lang = htmlLang(); }
      else { location.reload(); }   // 关掉最干净的方式是重载，避免半译状态
    },

    /* ---------------------------------------------------------- 角落开关 */

    mountPill() {
      if (document.getElementById('sp-lang-pill') || document.querySelector('#sp')) return;
      const s = document.createElement('style');
      s.textContent = `
        #sp-lang-pill{position:fixed;right:14px;bottom:14px;z-index:2147482000;
          display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;
          font:500 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;
          background:rgba(20,24,32,.82);color:#e6e9ef;border:1px solid rgba(255,255,255,.14);
          cursor:pointer;opacity:.42;transition:opacity .15s;backdrop-filter:blur(6px)}
        #sp-lang-pill:hover{opacity:1}`;
      document.head.appendChild(s);

      const b = document.createElement('button');
      b.id = 'sp-lang-pill';
      b.type = 'button';
      /* 这个开关**必须一直在，而且必须能双向拨**。
         踩过的坑（0.1.6，用户实报）：它原来只在"翻译开着"时挂载，点一下写
         translateSite=false 再重载 —— 重载后它自己不会被挂载，于是页面上再没有任何
         入口能把翻译开回来；标题里那句"再次开启需刷新"是假的，刷新恰恰会让它消失。
         角落这颗是这一层的唯一出口，出口自己消失就不叫出口。 */
      const isOn = () => Util.store.get('translateSite', true) !== false;
      const paint = () => {
        const lit = isOn();
        b.textContent = `译 ${I18n.lang.toUpperCase()}` + (lit ? '' : ' 关');
        b.title = lit
          ? '本页文案已译成当前语言 —— 点击关闭翻译（随时可以再开）'
          : '本页翻译已关闭 —— 点击重新开启';
        b.setAttribute('aria-pressed', lit ? 'true' : 'false');
      };
      paint();
      b.addEventListener('click', () => {
        Util.store.set('translateSite', !isOn());
        location.reload();
      });
      document.body.appendChild(b);
    },

    /* ---------------------------------------------------------- 诊断 */

    /** 排查用：列出页面上"看起来是段落但词典里没有"的整块文本 */
    reportUnmatched(limit) {
      const idx = this.blockIndex() || new Map();
      const out = [];
      for (const el of document.querySelectorAll('p,li,td,dd,blockquote')) {
        if (el.closest('#sp') || el.closest('[data-sp-block]')) continue;
        const norm = normalizeBlock(el.textContent);
        if (norm.length < 40 || norm.length > 600) continue;
        if (idx.has(norm)) continue;
        if (!/[A-Za-z]{3,}/.test(norm)) continue;
        out.push(norm);
        if (out.length >= (limit || 20)) break;
      }
      return out;
    },
  };

  function htmlLang() {
    return ({ zh: 'zh-CN', en: 'en' })[I18n.lang] || I18n.lang;
  }

  SP.DomI18n = DomI18n;
})();
