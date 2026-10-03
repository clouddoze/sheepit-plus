/* ==========================================================================
 * 80-app.js — 应用层：接管判定 / 挂载 / 路由 / 数据编排 / 事件
 *
 * 接管策略（重要）：
 *   1) 重建过的 4 个视图所对应的路径 → 整个界面换成新的；
 *   2) 其余路径 → 界面保持原站不动，只把 UI 文案在本地翻成当前语言
 *      （官方没有做国际化，这一层是替它补的）；
 *   3) 两层互相独立：换界面不等于翻译，翻译也不依赖换界面。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.booted) return;
  SP.booted = true;

  const { Util, UI, Api, Theme, I18n, Views, t } = SP;

  /* ------------------------------------------------------- 1. 接管判定 */

  /** 路径 → 视图。返回 null 表示不接管，原站界面照常显示。 */
  function viewForPath(pathname) {
    const p = pathname.replace(/\/+$/, '') || '/home';
    if (p === '/home' || p === '/' || p === '/index.php') return 'overview';
    if (p === '/home/projects') return 'projects';
    if (p === '/ranking/user' || p === '/ranking') return 'ranking';
    // 任意用户主页都接管：页面本身是公开可读的
    if (/^\/user\/[^/]+\/profile$/.test(p)) return 'overview';
    // 账户设置页只接管自己的：别人的设置页站点自己会拦，我们放行
    if (/^\/user\/[^/]+\/edit$/.test(p)) return 'account';
    // 会话页（一台机器的档案）。实测别人的会话编号直接 404 —— 站点只让自己的机器可见。
    // 这里仍然按"能读到就接管"处理：接手的是站点已经给了我们的那一份页面。
    if (/^\/session\/\d+$/.test(p)) return 'session';
    return null;
  }

  const pathView = viewForPath(location.pathname);
  const uiMode = Util.store.get('uiMode', 'modern');

  /* ------------------------------------------------- 原版界面 / 现代化 开关
     用户要一条退路：习惯旧界面的人、以及脚本还没覆盖到的功能，都能一键回去。
     选了原版就一颗守卫都不注入 —— 页面必须是用户记忆里那个样子。 */

  /** 原版界面下挂在左下角的小开关。必须活在 #sp 之外：那种模式下 #sp 根本不存在。
   *  two jobs：在能接管的页面上是"切回现代化"；在没有重制版的页面上（FAQ、服务器…）
   *  是"进入现代化界面" —— 那些页面本身没有新版本，所以带去总览。 */
  function mountModePill(kind) {
    if (document.getElementById('sp-mode-pill')) return;
    SP.injectModePillStyle();
    const b = document.createElement('button');
    b.id = 'sp-mode-pill';
    b.type = 'button';
    const classic = kind === 'classic';
    b.title = classic ? t('mode.classicTip') : t('mode.enterTip');
    b.setAttribute('aria-label', b.title);
    b.innerHTML = UI.icon('sheep') + `<span>${Util.esc(classic ? t('mode.classicHint') : t('mode.enter'))}</span>`;
    b.addEventListener('click', () => {
      Util.store.set('uiMode', 'modern');
      if (classic) location.reload();
      else location.href = '/home';   // 这一页没有重制版，去总览
    });
    (document.body || document.documentElement).appendChild(b);
  }

  /* -------------------------------------------- 未接管的页面：只补国际化 */

  /**
   * 未重建的页面（/getstarted、/faq、/servers、/project/*…）保持原站界面，
   * 只在本地把 UI 文案翻成当前语言。与"重做界面"是两件独立的事。
   */
  function startSiteTranslation() {
    I18n.init();
    const on = Util.store.get('translateSite', true) !== false;
    SP.DomI18n.enabled = on;
    if (!on || !I18n.canTranslateSite() || !SP.DomI18n) return;

    const go = () => {
      if (!document.body) return;
      document.documentElement.lang = ({ zh: 'zh-CN', en: 'en' })[I18n.lang] || I18n.lang;
      SP.DomI18n.run();
      SP.DomI18n.mountPill();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }

  // 原版界面模式，或本来就不接管的页面：不注入守卫、不挂 #sp，只补国际化。
  // 两种情况下都给一个左下角入口：原版模式是"切回"，没重制版的页面是"进入"。
  if (uiMode === 'classic' || !pathView) {
    startSiteTranslation();
    mountModePill(pathView ? 'classic' : 'enter');
    return;
  }

  SP.injectGuard();
  SP.injectStyle();

  /** 提前注入了守卫、但后来发现不该接管时，把页面原样还给用户 */
  function release() {
    const g = document.getElementById('sp-guard');
    if (g) g.remove();
    const s = document.getElementById('sp-style');
    if (s) s.remove();
    startSiteTranslation();
  }

  /* ------------------------------------------------------- 2. 状态 */

  const state = {
    view: pathView,
    userName: null,        // 当前登录用户
    profileName: null,     // 正在查看的主页属主
    profile: null,
    home: null,
    projects: null,
    ranking: null,
    account: null,
    session: null,
    sessionId: null,       // /session/<数字>，从地址里读
    myAvatar: '',          // 顶栏那张：**自己**的头像，从站点导航栏读（不是正在看的档案）
    loading: false,
    error: null,
    themePref: 'auto',
    langPref: 'auto',
    translateSite: true,
    uiScale: 1,            // 界面整体缩放（设置里那个百分比）
  };

  const ROUTES = { overview: '#/overview', projects: '#/projects', ranking: '#/ranking', settings: '#/settings', account: '#/account' };

  function syncPrefs() {
    state.themePref = Theme.init();
    state.langPref = Util.store.get('lang', 'auto');
    state.translateSite = Util.store.get('translateSite', true) !== false;
    const z = Number(Util.store.get('scale', 1));
    state.uiScale = Number.isFinite(z) && z >= 0.5 && z <= 2 ? z : 1;
    I18n.init();
  }

  function applyTheme() {
    const host = document.getElementById('sp');
    if (!host) return;
    host.setAttribute('data-theme', Theme.effective(state.themePref));
    // 界面整体缩放。用 CSS zoom 而不是 transform:scale —— 实测它在"视口铺满"这件事上
    // 不用收尾：物理宽仍是视口宽，clientWidth 变成 1/zoom，里面照旧按视口排版。
    // 代价是 rect 量出来的是物理像素，凡是拿它写 left/top 的地方都要除以 zoom（Util.zoomOf）。
    host.style.zoom = state.uiScale === 1 ? '' : String(state.uiScale);
    // 图表用 CSS 变量取色，这里同步一份给 SVG 里的 var() 生效
    host.style.colorScheme = Theme.effective(state.themePref);
  }

  /* ------------------------------------------------------- 3. 挂载 */

  function mount() {
    if (document.getElementById('sp')) return document.getElementById('sp');
    const host = document.createElement('div');
    host.id = 'sp';
    (document.body || document.documentElement).appendChild(host);
    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onChange);
    return host;
  }

  function shell() {
    const u = state.userName;
    const nav = [['overview', t('nav.overview'), ''], ['projects', t('nav.projects'), ''],
      ['ranking', t('nav.ranking'), t('nav.rankingShort')],
      ['account', t('nav.account'), t('nav.accountShort')],
      ['settings', t('nav.settings'), '']];
    return `<div class="wrap">
      <div class="top">
        <a class="brand" href="#/overview">${UI.icon('sheep', 'sheep')}SheepIt <em>PLUS</em></a>
        <nav>${nav.map(([k, label, short]) =>
          `<button data-nav="${k}" ${state.view === k ? 'aria-current="page"' : ''}>` +
          `<span class="navfull">${Util.esc(label)}</span><span class="navshort">${Util.esc(short || label)}</span></button>`).join('')}</nav>
        <span class="spacer"></span>
        <span class="metaline num" id="sp-updated"></span>
        <button class="modebtn" data-act="mode-classic" title="${Util.esc(t('mode.toClassic'))}">${UI.icon('sheep')}<span class="txt">${Util.esc(t('mode.toClassic'))}</span></button>
        <button class="iconbtn" data-act="refresh" title="${Util.esc(t('top.refresh'))}" aria-label="${Util.esc(t('top.refresh'))}">${UI.icon('refresh')}</button>
        ${u ? `<span class="who">${UI.avatar(SP.state && SP.state.avatar, u, 'ini')}<b class="uname">${Util.esc(u)}</b></span>` : ''}
      </div>
      <div id="sp-body"></div>
    </div>`;
  }

  /* 入场动效只在"换视图"时播一次（外加本页第一次真正出内容）。筛选项、排序、显示更多、
     开关 3 点菜单、提交后重取 —— 这些只改内容的 render() 都不该让上面的块重新淡入，
     那看起来就像整页在重载（用户为此报过两次：筛选按钮、3 点菜单）。 */
  let animOnce = false;
  let painted = false;

  function render() {
    const host = mount();
    applyTheme();
    const scrollY = host.scrollTop;

    // 注意：#sp-body 必须在外壳创建之后才查，否则首次渲染拿到 null
    if (!host.querySelector('.top')) {
      host.innerHTML = shell();
    } else {
      // 只更新导航高亮与登录者头像，避免整壳重建导致滚动位置丢失
      host.querySelectorAll('nav [data-nav]').forEach((b) =>
        b.setAttribute('aria-current', b.dataset.nav === state.view ? 'page' : 'false'));
      const who = host.querySelector('.who');
      if (who && state.userName) {
        // 顶栏那张必须是**你自己**的头像：从站点导航栏读（boot 时拿的）。
        // 退路也只在"看的就是自己"时才用档案头像 —— 用正在看的那份档案，
        // 去看别人主页时顶栏就会变成别人的脸（用户报的就是这个）。
        const src = state.myAvatar
          || (state.profileName === state.userName && state.profile ? state.profile.avatar : '');
        const cur = who.querySelector('img') || who.querySelector('span');
        // 外壳先于数据渲染，所以这里可能是个字母占位 span，拿到头像后要换成 img
        if (src && cur && cur.tagName !== 'IMG') {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          cur.replaceWith(img);
        } else if (src && cur && cur.getAttribute('src') !== src) {
          cur.setAttribute('src', src);
        }
      }
    }
    const body = host.querySelector('#sp-body');

    let html;
    if (state.view === 'settings') html = Views.settings(state);
    // 错误态必须排在空态前面：取不到数据时说清楚原因并给一个重试，
    // 而不是拿"暂无数据"糊弄 —— 那两种情况的含义完全不同。
    else if (state.error) html = UI.state.error(state.error, 'sp-retry');
    // 骨架排在"有没有数据"之前：否则会话页/账户页首屏会闪一下"暂无数据"
    else if (state.loading) html = UI.skeleton(5);
    else if (state.view === 'account') html = state.account ? Views.account(state) : UI.state.empty();
    else if (state.view === 'session') html = state.session ? Views.session(state) : UI.state.empty();
    else if (state.view === 'overview') html = state.profile ? Views.overview(state) : UI.state.empty();
    else if (state.view === 'projects') html = state.projects ? Views.projects(state) : UI.state.empty();
    else if (state.view === 'ranking') html = state.ranking ? Views.ranking(state) : UI.state.empty();
    else html = UI.state.empty();

    body.innerHTML = html;
    host.classList.toggle('sp-anim', animOnce);
    animOnce = false;
    Views.mount(body, state);      // 面积图要按实测像素渲染，字符串表达不了
    host.scrollTop = scrollY;
    paintMeta();
  }

  function paintMeta() {
    const el = document.getElementById('sp-updated');
    if (el) el.textContent = `${t('top.updated')} ${new Date().toLocaleTimeString()}`;
  }

  /* ------------------------------------------------------- 4. 数据编排 */

  async function ensureData(view) {
    if (view === 'settings') return;

    if (view === 'account') {
      if (!state.userName) throw new Error(t('account.only'));
      state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`));
      return;
    }

    if (view === 'session') {
      if (!state.sessionId) throw new Error(t('sess.noId'));
      if (!state.session) {
        state.session = Api.parseSession(await Api.fetchPage(`/session/${state.sessionId}`), state.sessionId);
        if (!state.session) throw new Error(t('sess.parseFailed'));
      }
      // 时间线是站点自己的 AJAX JSON。它拿不到不该拖垮整屏 —— 机器信息照常显示，
      // 只有时间线那一块说"没取到"。
      if (state.session.timeline === undefined) {
        try { state.session.timeline = Api.parseTimeline(await Api.fetchJson(state.session.timelineUrl)); }
        catch (e) { state.session.timeline = []; state.session.timelineFailed = true; }
      }
      // 「可渲染项目」那张表只有项目名，发布者要用项目列表页按名字对（实测 34/34 对得上）。
      // 对不上就只显示项目名，整张列表拿不到也不影响这一屏。
      if (!state.projects) {
        try { state.projects = Api.parseProjects(await Api.fetchPage('/home/projects')); }
        catch (e) { state.projects = null; }
      }
      return;
    }

    if (view === 'overview') {
      const target = state.profileName || state.userName;
      if (!target) throw new Error(t('state.loggedOut'));
      if (!state.profile) {
        const html = await Api.fetchPage(`/user/${encodeURIComponent(target)}/profile`);
        state.profile = Api.parseProfile(html, target);
        SP.state = state;   // 供 shell 里取头像
      }
      if (!state.home) {
        // 首页失败不该让整个总览挂掉
        try { state.home = Api.parseHome(await Api.fetchPage('/home')); } catch (e) { state.home = { stats: [], news: [] }; }
      }
      if (!state.projects) {
        // 总览底部的「进行中的项目」是附加信息：拿不到就整块不显示，绝不拖垮这一屏
        try { state.projects = Api.parseProjects(await Api.fetchPage('/home/projects')); } catch (e) { /* 保持 null */ }
      }
    }

    if (view === 'projects' && !state.projects) {
      state.projects = Api.parseProjects(await Api.fetchPage('/home/projects'));
    }

    // 项目页发布者那格的「优先 / 移出」要看我自己的渲染优先级名单（账户设置页里那份）。
    // 拿不到就整列不给按钮 —— 不猜状态。
    if (view === 'projects' && !state.account && state.userName) {
      try { state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`)); }
      catch (e) { state.account = null; }
    }

    // 项目页顶部那条全站实时来自首页；直接落到这一页时也得取一次，失败就不显示那条
    if (view === 'projects' && !state.home) {
      try { state.home = Api.parseHome(await Api.fetchPage('/home')); } catch (e) { state.home = { stats: [], news: [] }; }
    }

    if (view === 'ranking' && !state.ranking) {
      state.ranking = Api.parseRanking(await Api.fetchPage('/ranking/user'));
    }
  }

  async function show(view, opts) {
    const viewChanged = state.view !== view;
    state.view = view;
    state.error = null;

    // 先渲染骨架，让交互立刻有反馈
    if (!opts || !opts.silent) {
      const need = (view === 'overview' && !state.profile)
        || (view === 'projects' && !state.projects)
        || (view === 'ranking' && !state.ranking)
        || (view === 'session' && !state.session);
      state.loading = need;
      render();
    }

    try {
      await ensureData(view);
      state.error = null;
    } catch (e) {
      state.error = (e && e.message) || String(e);
      if (/401|403|signin/i.test(state.error)) state.error = t('state.loggedOut');
    } finally {
      state.loading = false;
      // 只有"换了视图"或"本页第一次真正出内容"才播入场；刷新、提交后重取都不播
      animOnce = viewChanged || !painted;
      render();
      painted = true;
      history.replaceState(null, '', ROUTES[view] || location.pathname);
    }
  }

  /* ------------------------------------------------------- 5. 事件 */

  /** 一次性提示。写操作的结果必须说出来，不能默默成功也不能默默失败。 */
  let toastTimer = null;
  function toast(msg) {
    const host = document.getElementById('sp');
    if (!host) return;
    let el = host.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      host.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (el.parentNode) el.remove(); }, 2600);
  }

  /**
   * 写操作的统一收口：提交 → 站点回 'OK' 就重取数据并重画，否则原样转述它的错误。
   * 全部由用户点击触发，打的都是站点自己的端点。
   * 重画的是"当前这一屏"：账户设置页的开关和会话页的暂停都走这里。
   */
  async function submit(fn, okMsg) {
    toast(t('account.saving'));
    try {
      const r = await fn();
      if (r && r !== 'OK') { toast(t('account.failed', { msg: r })); return false; }
      Api.invalidate();
      state.account = null;
      state.session = null;
      await show(state.view, { silent: true });
      toast(okMsg || t('account.ok'));
      return true;
    } catch (e) {
      toast(t('account.failed', { msg: (e && e.message) || String(e) }));
      return false;
    }
  }

  const valOf = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };

  function onClick(ev) {
    // 3 点菜单是浮层：点在任何别处都先把它关掉。这里不 return —— 这一次点击该干的事继续干
    // （比如顺手切了筛选），listener 在宿主上，重画也不影响这次事件继续派发。
    if (Views.projState.menu && !ev.target.closest('.omenu') && !ev.target.closest('[data-act="owner-menu"]')) {
      Views.projState.menu = null;
      render();
    }

    const nav = ev.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }

    const act = ev.target.closest('[data-act]');
    if (act) {
      const kind = act.dataset.act;

      if (kind === 'mode-classic') {
        Util.store.set('uiMode', 'classic');
        location.reload();
        return;
      }

      if (kind === 'refresh') {
        Api.invalidate();
        state.profile = state.home = state.projects = state.ranking = state.account = null;
        state.session = null;
        // 刷新时骨架会让内容瞬间变短、浏览器把 scrollTop 夹到 0，
        // 长的页面（会话页 1800px+）刷新完就弹回顶部了。记一下，画完再放回去。
        const host = document.getElementById('sp');
        const keepY = host ? host.scrollTop : 0;
        show(state.view).then(() => {
          const h2 = document.getElementById('sp');
          if (h2 && keepY) h2.scrollTop = keepY;
        });
        return;
      }

      // ---- 账户设置：以下都是真实写操作 ----
      if (kind === 'prio-add') {
        const name = valOf(act.dataset.input);
        if (!name) return;
        // 动作前缀来自账户页解析结果（站点 onclick 里读的）；读不到才按形状兜底
        const base = (state.account && state.account.add && state.account.add.priority) || '/user/priority/add/';
        submit(() => Api.post(base + encodeURIComponent(name)));
        return;
      }
      if (kind === 'sponsor-add') {
        const name = valOf(act.dataset.input);
        const base = act.dataset.url;   // /user/sponsor/add/ —— 从站点自己的 onclick 里读出来的
        if (!name || !base) return;
        submit(() => Api.post(base + encodeURIComponent(name)));
        return;
      }
      if (kind === 'sponsor-set') {
        // 站点那个 checkbox 的 onclick 带的就是"这一下要打的地址"（含目标状态 0/1），照打即可。
        // 失败时把界面重新拉回服务器上的真实状态 —— 勾选框不能停在一个没生效的位置上。
        const url = act.dataset.url;
        if (!url) return;
        submit(() => Api.post(url)).then((ok) => { if (!ok) show(state.view, { silent: true }); });
        return;
      }
      // ---- 项目页发布者那格的 3 点菜单 ----
      if (kind === 'owner-menu') {
        const id = act.dataset.id;
        Views.projState.menu = Views.projState.menu === id ? null : id;
        render();
        return;
      }
      if (kind === 'owner-gift' || kind === 'owner-block') {
        const url = act.dataset.url;   // 站点的 add 前缀，或名单行 onclick 里的撤回地址
        if (!url) return;
        Views.projState.menu = null;   // 先收起菜单；提交成功后整屏重取
        submit(() => Api.post(url));
        return;
      }
      if (kind === 'block-add') {
        const name = valOf(act.dataset.input);
        if (!name) return;
        const a = (state.account && state.account.add) || {};
        const base = (act.dataset.kind === 'owner' ? a.blockOwner : a.blockRenderer)
          || `/user/block/${act.dataset.kind}/add/`;
        submit(() => Api.post(base + encodeURIComponent(name)));
        return;
      }
      if (kind === 'key-add') {
        const comment = valOf(act.dataset.input);
        if (!comment) { toast(t('account.keys.comment')); return; }
        submit(() => Api.post(`/user/renderkey/add/${encodeURIComponent(comment)}`));
        return;
      }
      if (kind === 'email-save') {
        const email = valOf(act.dataset.input);
        if (!email) return;
        submit(() => Api.post('/user/update/email', { email }));
        return;
      }
      if (kind === 'avatar-save') {
        const input = document.getElementById('sp-avatar');
        const file = input && input.files && input.files[0];
        if (!file) { toast(t('account.avatarPick')); return; }
        const fd = new FormData();
        fd.append('new_avatar', file);
        submit(() => Api.post('/user/update/avatar', null, fd), t('account.ok'));
        return;
      }

      // ---- 会话页：暂停 / 恢复这台机器。动作地址是解析器从原站按钮的 onclick 里读出来的 ----
      if (kind === 'sess-run') {
        const url = act.dataset.url;
        if (!url) return;
        // 不加确认框：原站那个按钮也不确认，而且暂停是可逆的（再点一下就是恢复）
        submit(() => Api.post(url));
        return;
      }

      // 密钥的显示/隐藏是纯本地动作：不写信、不联网，只是把已经在这页上的文字翻出来
      if (kind === 'reveal-key') {
        const box = act.parentNode && act.parentNode.querySelector('.sec');
        if (!box) return;
        const shown = act.getAttribute('aria-pressed') === 'true';
        box.textContent = shown ? '••••••••••••' : (box.dataset.key || '••••••••••••');
        act.setAttribute('aria-pressed', shown ? 'false' : 'true');
        act.textContent = shown ? t('sess.reveal') : t('sess.hide');
        return;
      }

      // 完整日志默认折叠：默认只给按天/按月的活动汇总，要逐条事件才展开
      if (kind === 'sess-log') { Views.sessState.open = !Views.sessState.open; render(); return; }

      // 会话页项目 chip 上的「优先 / 移出」：地址由视图算好（移出用站点 onclick 里读出来的那条），
      // 这里只负责 POST —— 和账户设置页那个渲染优先级是同一批端点
      if (kind === 'prio-set') {
        const url = act.dataset.url;
        if (!url) return;
        submit(() => Api.post(url));
        return;
      }
      return;
    }

    // 移除类操作：动作地址是解析器从站点自己的 onclick 里读出来的
    const del = ev.target.closest('[data-del]');
    if (del) {
      if (del.dataset.confirm && !window.confirm(del.dataset.confirm)) return;
      submit(() => Api.post(del.dataset.del));
      return;
    }

    if (ev.target.closest('#sp-retry')) { show(state.view); return; }

    const more = ev.target.closest('#sp-more');
    if (more) {
      const step = Number(more.dataset.step) || 100;
      if (state.view === 'ranking') Views.rankState.limit += step;
      else if (state.view === 'session') Views.sessState.limit += step;
      else Views.projState.limit += step;
      render();
      return;
    }

    const sort = ev.target.closest('th[data-sort]');
    if (sort) {
      const k = sort.dataset.sort;
      if (Views.projState.sort === k) Views.projState.dir = Views.projState.dir === 'asc' ? 'desc' : 'asc';
      else { Views.projState.sort = k; Views.projState.dir = 'desc'; }
      render();
      return;
    }

    const f = ev.target.closest('#sp-filter [data-f]');
    if (f) { Views.projState.filter = f.dataset.f; render(); return; }

    // 账户页选项卡：只换显示哪几块面板，不重新取数（也不该重放上面那排块的入场动画）
    const tb = ev.target.closest('#sp-acct-tabs [data-tab]');
    if (tb) { Views.acctState.tab = tb.dataset.tab; render(); return; }

    // 会话页时间线的类型筛选。换了筛选项就把分页收回第一屏 ——
    // 否则从"全部"看完 500 条再切到只剩 9 条的"发送失败"，会看到一片空白。
    const tf = ev.target.closest('#sp-tl-types [data-t]');
    if (tf) { Views.sessState.type = tf.dataset.t; Views.sessState.limit = 100; render(); return; }

    const th = ev.target.closest('#sp-theme [data-v]');
    if (th) { Theme.set(th.dataset.v); syncPrefs(); show(state.view, { silent: true }); return; }

    // 界面缩放：只改 #sp 自己（applyTheme 里写 zoom），不重取数据、也不播入场动画
    const sc = ev.target.closest('#sp-scale [data-v]');
    if (sc) {
      state.uiScale = Number(sc.dataset.v) || 1;
      Util.store.set('scale', state.uiScale);
      render();
      return;
    }

    const lg = ev.target.closest('#sp-lang [data-v]');
    if (lg) {
      I18n.set(lg.dataset.v);
      syncPrefs();
      // 语言影响所有文案，整壳重建最省事
      const host = document.getElementById('sp');
      if (host) host.innerHTML = shell();
      show(state.view, { silent: true });
      return;
    }

    const tr = ev.target.closest('#sp-translate [data-v]');
    if (tr) {
      const on = tr.dataset.v === 'on';
      Util.store.set('translateSite', on);
      state.translateSite = on;
      render();
      return;
    }
  }

  /** 复选框只走 change：开关的语义是"状态变了"，不是"被点了一下" */
  function onChange(ev) {
    const sc = ev.target.closest('[data-sched]');
    if (sc) submit(() => Api.post(`/user/update/scheduler/${sc.dataset.sched}/${sc.checked ? '1' : '0'}`));
  }

  let inputTimer = null;
  function onInput(ev) {
    if (ev.target.id !== 'sp-q') return;
    Views.projState.q = ev.target.value;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      const host = document.getElementById('sp');
      const pos = ev.target.selectionStart;
      render();
      const again = document.getElementById('sp-q');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
      void host;
    }, 180);
  }

  function go(view) {
    if (ROUTES[view]) history.replaceState(null, '', ROUTES[view]);
    show(view);
  }

  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#\/(\w+)$/);
    if (m && m[1] !== state.view) show(m[1]);
  });

  // Esc 关掉 3 点菜单。浮层不能只靠"点外面"来关 —— 键盘用户没有"点外面"这个动作。
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && Views.projState.menu) { Views.projState.menu = null; render(); }
  });

  /* ------------------------------------------------------- 6. 启动 */

  function boot() {
    syncPrefs();

    // 登录态与用户名：从原站导航栏读（此时它还在 DOM 里，只是被 CSS 隐藏了）
    const who = Api.detectUser(document);
    state.userName = who.signedIn ? who.userName : null;
    state.myAvatar = who.avatar || '';   // 顶栏那张是自己的脸，跟正在看的档案无关

    // 账户设置只接管自己的。守卫在 document-start 就注入了（为了不闪原站界面），
    // 走到这里发现路径指向别人的账户，就把页面原样还回去。
    // 注意只看路径：从应用内导航过来时 URL 还是 #/account，那种情况下账号必然是自己。
    const acct = location.pathname.match(/^\/user\/([^/]+)\/edit$/);
    if (acct && (!state.userName || decodeURIComponent(acct[1]) !== state.userName)) {
      release();
      return;
    }

    const m = location.pathname.match(/^\/user\/([^/]+)\/profile/);
    state.profileName = m ? decodeURIComponent(m[1]) : (location.pathname === '/home' || location.pathname === '/' ? who.userName : null);

    // 会话页的编号只从地址里来。地址就是这一页的身份，不从 DOM 里认。
    const se = location.pathname.match(/^\/session\/(\d+)/);
    state.sessionId = se ? se[1] : null;

    if (location.hash && /^#\/(\w+)$/.test(location.hash)) {
      const v = location.hash.slice(2);
      if (ROUTES[v]) state.view = v;
    }

    document.title = document.title.replace(/^\s*SheepIt\s*$/, 'SheepIt Plus');

    if (!state.userName && !state.profileName) {
      mount().innerHTML = `<div class="wrap">${UI.state.loggedOut()}</div>`;
      return;
    }
    if (!state.profileName) state.profileName = state.userName;

    render();
    show(state.view);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  SP.app = { state, show, render, go };
})();
