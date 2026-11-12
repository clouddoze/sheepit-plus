/* ==== 80-app.js：应用层（接管判定 / 路由 / 事件） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  /* 同一页只装一次。现代化界面可以被藏起来再放出来（见 toClassic / toModern），
     但这份脚本不重新执行 —— 它已经是页面的一部分了。 */
  if (!SP || SP.appStarted) return;
  SP.appStarted = true;

  const { Util, UI, Api, Theme, I18n, Views, t } = SP;

  /* ---- 1. 接管判定 ---- */

  /** 路径 → 视图；null = **不接管**，原站界面照常显示。 */
  function viewForPath(pathname) {
    const p = pathname.replace(/\/+$/, '') || '/home';
    if (p === '/home' || p === '/' || p === '/index.php') return 'overview';
    if (p === '/home/projects') return 'projects';
    if (p === '/ranking/user' || p === '/ranking' || p === '/ranking/machine') return 'ranking';
    /* 团队榜是公开页；/team/<id> 详情要登录，那一页放行给站点 */
    if (p === '/team') return 'teams';
    /* 团队详情要登录；读到成员就接管，读不到（未登录）站点自己会显示登录提示 */
    /* 全站实况（/home/frames + /home/machines）：公开页，只读，两个来源合成一页 */
    if (p === '/home/frames' || p === '/home/machines') return 'live';
    if (/^\/team\/\d+$/.test(p)) return 'team';
    // 主页公开可读 → 任意人都接管
    if (/^\/user\/[^/]+\/profile$/.test(p)) return 'overview';
    // 账户设置只接管自己的（别人的站点自己会拦）
    if (/^\/user\/[^/]+\/edit$/.test(p)) return 'account';
    // 会话页：别人的编号 404（站点只让自己的机器可见）→ 能读到就接管
    if (/^\/session\/\d+$/.test(p)) return 'session';
    /* 上传三步一律放行：/getstarted 是站点自己的上传表单，/project/add/<token> 是分析等待页，
       /project/<id> 是站点自己的项目 manage 页 —— 我们不再接管这三页，站点照常渲染。
       导航里的「上传项目」直接开 /getstarted（见 onClick）。 */
    return null;
  }

  const pathView = viewForPath(location.pathname);
  const uiMode = Util.store.get('uiMode', 'modern');

  /* ---- 原版界面 / 现代化 开关 ---- */

  /** 原版界面下左下角的开关（必须活在 #sp 之外）：能接管的页"切回"，没重制版的页"进入"。
      "切回"是**就地启动**（toModern），不刷新 —— 这一页的 DOM 我们一样读得到。 */
  let modePillKind = '';

  function paintModePill(b, kind) {
    const classic = kind === 'classic';
    b.title = classic ? t('mode.classicTip') : t('mode.enterTip');
    b.setAttribute('aria-label', b.title);
    b.innerHTML = UI.logo() + `<span>${Util.esc(classic ? t('mode.classicHint') : t('mode.enter'))}</span>`;
  }

  function mountModePill(kind) {
    /* document-start 时 body 可能还没影：等它落地再挂（原版页面上这次调用发生在首屏） */
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => mountModePill(kind), { once: true });
      return;
    }
    SP.injectModePillStyle();
    let b = document.getElementById('sp-mode-pill');
    if (!b) {
      b = document.createElement('button');
      b.id = 'sp-mode-pill';
      b.type = 'button';
      b.addEventListener('click', () => {
        /* 能接管 → 就地启动/唤回新版；没重制版 → 只能去总览（入口文案本来也是这么写的） */
        if (modePillKind === 'classic') { toModern(b); return; }
        Util.store.set('uiMode', 'modern');
        SP.Sweep.veilThen('/home', t('mode.opening'), modernBg());
      });
      SP.cornerHost().appendChild(b);
    }
    modePillKind = kind;
    paintModePill(b, kind);
  }


  /* 原版界面 / 这一页没有重制版：不注入守卫、不挂 #sp —— 但**也不能 return**：
     下面那些函数得先建好，用户点左下角入口时（toModern）才能就地启动。 */
  const deferredModern = uiMode === 'classic' || !pathView;

  /** 启动现代化界面：守卫 → 样式 → 骨架 → 取数。
      document-start 的首屏走这里（防闪）；原版页面上点「进入新界面」也走这里（免刷新）。 */
  function startModern(opts) {
    if (SP.modernStarted) { if (!revealModern()) location.reload(); return; }
    SP.modernStarted = true;
    SP.booted = true;
    /* 从原版界面进来时这一页已经加载完，而且很可能已经被翻译过：解析活 document 会读到译文
       （状态词、按钮文字全是解析判据），宁可多抓一次页面也要拿到站点原文。 */
    if (opts && opts.fromClassic && Api.disableLiveDoc) Api.disableLiveDoc();
    // 守卫在 document-start 注入（防闪）；能走到这里的都是整页接管
    SP.injectGuard();
    SP.injectStyle();
    document.documentElement.dataset.spMode = 'modern';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  /** 守卫已注入、后来发现不该接管：把页面原样还给用户 */
  function release() {
    released = true;
    const g = document.getElementById('sp-guard');
    if (g) g.remove();
    const s = document.getElementById('sp-style');
    if (s) s.remove();
    const host = document.getElementById('sp');
    if (host) host.remove();   // 界面还没画，通常不存在
  }
  let released = false;

  /* ---- 原版 ↔ 新版：同一页里换过去，不刷新 --------------------------------------------
     两套界面本来就住在一个文档里：原站的 DOM 一直在（被 #sp-guard 压住），我们的 #sp 是覆盖层。
     所以"切回原版" = 拆守卫 + 藏 #sp + 把页面自己的 JS 叫醒；"切回新版" = 反过来。
     整个过程就是一次扫光（SP.Sweep），没有导航、没有重载、数据也不丢。 */
  let swapping = false;   // 动画中途的连点不叠加
  let siteTitle = '';     // 接管前站点自己的标题（切回原版时还原）

  function modernBg() {
    return Theme.effective(Theme.init()) === 'light' ? '#fbfbfc' : '#0b0d11';
  }

  /** 原站页面的底色：幕布盖上去时要跟它要露出来的那一片同色，接缝才看不见。
      新版模式下 body 的背景被守卫写成 transparent，量不到就退到站点自己的浅灰。 */
  function siteBg() {
    try {
      if (!document.getElementById('sp-guard')) {
        const c = getComputedStyle(document.body).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      }
    } catch (e) { /* 量不到就用兜底色 */ }
    return '#f4f5f7';
  }

  /** 当前视图是不是就长在这一页上（= 原版界面露出来就是它）。
      主页那一族（总览/项目/排行榜/账户/设置）吃的是同一份 /user/<me>/profile、共用一页，
      所以互相都算对齐；其余视图必须一一对应。 */
  function classicAligned() {
    const v = state.view;
    if (v === pathView) return true;
    const fam = (x) => x === 'overview' || x === 'projects' || x === 'ranking' || x === 'account' || x === 'settings';
    return fam(v) && (pathView === 'overview' || pathView === 'account');
  }

  /** 把新版藏起来，把页面还给站点自己 */
  function hideModern() {
    const host = document.getElementById('sp');
    if (host) host.hidden = true;      // 只是藏：DOM、状态、滚动位置都留着，切回来就是原样
    const g = document.getElementById('sp-guard');
    if (g) g.remove();
    if (siteTitle) document.title = siteTitle;
    document.documentElement.dataset.spMode = 'classic';
    /* 原站自己的 JS 是在 display:none 下加载的：量出来的尺寸全是 0（轮播、地图、瀑布流会被压扁）。
       露出来之后按真实视口再喊一次，让还活着的那部分重新量。 */
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
  }

  /** 把新版放出来；#sp 已经不在了（被 release 交还页面）就返回 false，让调用方重载 */
  function revealModern() {
    const host = document.getElementById('sp');
    if (!host) return false;
    host.hidden = false;
    SP.injectGuard();
    SP.injectStyle();
    applyTheme();
    document.documentElement.dataset.spMode = 'modern';
    return true;
  }

  /* 切换不做任何过渡（用户 2026-11-13：扫光和圆形揭示都不要了）。
     同页互换本来就是零加载，直接换层最干净。 */
  function toClassic() {
    if (swapping) return;
    Util.store.set('uiMode', 'classic');
    if (!classicAligned()) {
      /* 应用内换过页（视图不属于这份文档）：原版界面只能去它自己那一页拿。 */
      SP.Sweep.veilThen(pageFor(state.view) || location.pathname, t('mode.opening'), siteBg());
      return;
    }
    hideModern();
    mountModePill('classic');
  }

  function toModern() {
    if (swapping) return;
    Util.store.set('uiMode', 'modern');
    if (SP.modernStarted) {
      if (!revealModern()) location.reload();   // #sp 已经被交还过：只能重载重来
      return;
    }
    startModern({ fromClassic: true });
  }

  /* ---- 2. 状态 ---- */

  const state = {
    view: pathView,
    userName: null,
    profileName: null,     // 正在查看的档案属主
    profile: null,
    home: null,
    projects: null,
    ranking: null,
    teams: null,
    live: null,           // /home/frames + /home/machines 合成
    team: null,           // /team/<id>
    teamId: null,
    myTeam: null,         // 我加入的团队（从个人页解析一次后缓存）
    account: null,
    session: null,
    sessionId: null,       // /session/<数字>
    myAvatar: '',          // 顶栏那张：**自己**的头像（不是正在看的档案）
    loading: false,
    error: null,
    themePref: 'auto',
    langPref: 'auto',
    navHidden: [],         // 导航里被隐藏的项（总览/设置常开，不可隐藏）
    ovRight: 'recent',     // 总览右侧那张卡：'recent' 近 30 天概览 / 'months' 月度产出（用户可随时切回）
    uiScale: 1,            // 界面整体缩放
  };

  const ROUTES = { overview: '#/overview', projects: '#/projects', ranking: '#/ranking', teams: '#/teams', settings: '#/settings', account: '#/account' };

  function syncPrefs() {
    state.themePref = Theme.init();
    state.langPref = Util.store.get('lang', 'auto');
    /* 导航可见性：新配置 navHidden（数组）；旧版只有一个 showRanking 开关，迁移过来。 */
    const saved = Util.store.get('navHidden', null);
    if (Array.isArray(saved)) state.navHidden = saved.filter((x) => typeof x === 'string');
    else state.navHidden = Util.store.get('showRanking', true) === false ? ['ranking'] : [];
    /* 旧值 'eff'（早期试做的估算卡）一并归到 'recent'，别让老偏好把卡片留在已删的模式上 */
    state.ovRight = Util.store.get('ovRight', 'recent') === 'months' ? 'months' : 'recent';
    const z = Number(Util.store.get('scale', 1));
    state.uiScale = Number.isFinite(z) && z >= 0.5 && z <= 2 ? z : 1;
    I18n.init();
  }

  /* 顶栏主题按钮：图标跟**实际生效**的主题走（auto 时看系统），title 说当前档位；
     点击按 auto → light → dark 循环。设置在「设置」页，这里只管快速切换。 */
  const THEME_ORDER = ['auto', 'light', 'dark'];
  const themeQuickIcon = (pref) => UI.icon(Theme.effective(pref) === 'dark' ? 'moon' : 'sun');
  const themeQuickTitle = (pref) => t('top.themeCycle', { cur: t(`set.theme.${pref}`) });

  function applyTheme() {
    const host = document.getElementById('sp');
    if (!host) return;
    host.setAttribute('data-theme', Theme.effective(state.themePref));
    // 缩放用 CSS zoom 而非 transform:scale；rect 量出物理像素，写 left/top 要除以 zoom（Util.zoomOf）。
    host.style.zoom = state.uiScale === 1 ? '' : String(state.uiScale);
    // 图表（SVG var()）也要这份颜色方案
    host.style.colorScheme = Theme.effective(state.themePref);
    const tb = document.getElementById('sp-theme-quick');
    if (tb) {
      tb.title = themeQuickTitle(state.themePref);
      tb.setAttribute('aria-label', tb.title);
      tb.innerHTML = themeQuickIcon(state.themePref);
    }
  }

  /* ---- 3. 挂载 ---- */

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

  const NAV_ITEMS = SP.VK.NAV_ITEMS;   // 清单在 45-view-kit，设置页读的是同一份

  function shell() {
    const u = state.userName;
    /* 导航可见性由设置页控制（用户 2026-11-13）：总览与设置常开，其余可隐藏。
       隐藏只是入口消失，直接打开那个地址仍然接管。 */
    const nav = NAV_ITEMS
      .filter(([k, locked]) => locked || !state.navHidden.includes(k))
      .map(([k, locked]) => [k, t('nav.' + k), t('nav.' + k + 'Short') !== 'nav.' + k + 'Short' ? t('nav.' + k + 'Short') : '', locked]);
    /* 团队详情在导航里算「团队」这一项 */
    const navHere = state.view === 'team' ? 'teams' : state.view;
    const item = ([k, label, short]) =>
      `<button data-nav="${k}" ${navHere === k ? 'aria-current="page"' : ''}>`
      + `<span class="navfull">${Util.esc(label)}</span><span class="navshort">${Util.esc(short || label)}</span></button>`;
    /* 右侧顺序（用户 2026-10-18 定）：刷新时间 → 主题快速切换 → 刷新 → 原版界面 → 头像 */
    const classic = Util.esc(t('mode.toClassic'));
    return `<div class="wrap">
      <div class="top">
        <a class="brand" href="#/overview">${UI.logo('sheep')}SheepIt <em>PLUS</em></a>
        <nav>${nav.map(item).join('')}</nav>
        <span class="spacer"></span>
        <div class="topright">
          <span class="metaline num" id="sp-updated"></span>
          <button class="iconbtn" id="sp-theme-quick" data-act="theme-cycle" title="${Util.esc(themeQuickTitle(state.themePref))}" aria-label="${Util.esc(themeQuickTitle(state.themePref))}">${themeQuickIcon(state.themePref)}</button>
          <button class="iconbtn" data-act="refresh" title="${Util.esc(t('top.refresh'))}" aria-label="${Util.esc(t('top.refresh'))}">${UI.icon('refresh')}</button>
          <button class="modebtn" data-act="mode-classic" title="${Util.esc(t('mode.toClassicTip'))}"><span class="txt">&lt; ${classic}</span><span class="txts">&lt; ${Util.esc(t('mode.toClassicShort'))}</span></button>
                    ${u ? `<span class="who" title="${Util.esc(u)}">${UI.avatar(SP.state && SP.state.myAvatar, u, 'ini')}</span>` : ''}
        </div>
      </div>
      <div id="sp-body"></div>
    </div>`;
  }

  /** 重建外壳（导航项变了）+ 重画内容，保留滚动位置。 */
  function rebuildShell() {
    const host = document.getElementById('sp');
    const y = host ? host.scrollTop : 0;
    if (host) host.innerHTML = shell();
    render();
    if (host) host.scrollTop = y;
  }

  /* 入场动效只在"换视图"和本页首次出内容时播：只改内容的 render() 重放会像整页重载 */
  let animOnce = false;
  let painted = false;

  function render() {
    if (released) return;
    const host = mount();
    applyTheme();
    const scrollY = host.scrollTop;

    // #sp-body 要等外壳创建之后才查得到
    if (!host.querySelector('.top')) {
      host.innerHTML = shell();
    } else {
      // 只更新高亮与头像：整壳重建会丢滚动位置
      host.querySelectorAll('nav [data-nav]').forEach((b) =>
        b.setAttribute('aria-current', b.dataset.nav === (state.view === 'team' ? 'teams' : state.view) ? 'page' : 'false'));
      const who = host.querySelector('.who');
      if (who && state.userName) {
        // 退路只在看自己时才用档案头像，否则顶栏会变成别人的脸（用户实报）
        const src = state.myAvatar
          || (state.profileName === state.userName && state.profile ? state.profile.avatar : '');
        const cur = who.querySelector('img') || who.querySelector('span');
        // 这里可能还是字母占位 span，拿到头像后换成 img
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
    // 错误态排在空态前：取不到数据要说原因并给重试
    else if (state.error) html = UI.state.error(state.error, 'sp-retry');
    // 骨架也排在空态前，否则首屏会闪一下"暂无数据"
    else if (state.loading) html = UI.skeleton(5);
    else if (state.view === 'account') html = state.account ? Views.account(state) : UI.state.empty();
    else if (state.view === 'session') html = state.session ? Views.session(state) : UI.state.empty();
    else if (state.view === 'overview') html = state.profile ? Views.overview(state) : UI.state.empty();
    else if (state.view === 'projects') html = state.projects ? Views.projects(state) : UI.state.empty();
    else if (state.view === 'ranking') html = state.ranking ? Views.ranking(state) : UI.state.empty();
    else if (state.view === 'live') html = state.live ? Views.live(state) : UI.state.empty();
    else if (state.view === 'teams') html = state.teams ? Views.teams(state) : UI.state.empty();
    else if (state.view === 'team') html = state.team ? Views.teamDetail(state) : UI.state.empty();
    else html = UI.state.empty();

    body.innerHTML = html;
    host.classList.toggle('sp-anim', animOnce);
    animOnce = false;
    Views.mount(body, state);      // 面积图要按实测像素渲染
    host.scrollTop = scrollY;
    paintMeta();
  }

  function paintMeta() {
    const el = document.getElementById('sp-updated');
    if (el) el.textContent = `${t('top.updated')} ${new Date().toLocaleTimeString()}`;
  }

  /* ---- 4. 数据编排 ---- */

  /* 在线机器：主页那块只给「客户端 + 规格」，而运行状态 / 渲染方式 / 性能 / 帧数 / 积分
     都在**每一台自己的会话页**上 —— 逐台取一次（最多 3 台，走 Api 的 60 秒缓存），
     解析结果挂回机器对象给视图用。取不到就留 null，视图照旧只显示规格，不编数据。
     `detail !== undefined` 是防重复：这一轮取过（哪怕失败）就不再打第二次。 */
  async function machineDetails(profile) {
    const list = ((profile && profile.machines && profile.machines.list) || [])
      .slice(0, 3)
      .filter((m) => m.detail === undefined && m.url);
    /* 每台机器互相独立：并行取。原来是 `for + await`，三台就把三个 RTT 串成一条。 */
    await Promise.all(list.map(async (m) => {
      m.detail = null;
      try { m.detail = Api.parseSession(await Api.fetchPage(m.url), ''); } catch (e) { /* 保持 null */ }
    }));
  }

  async function ensureData(view) {
    if (view === 'settings') return;

    if (view === 'account') {
      if (!state.userName) throw new Error(t('account.only'));
      /* 账户设置页常常就是当前页：解析活 document，省一次 53KB 重抓；认不出邮箱才回退。 */
      const path = `/user/${encodeURIComponent(state.userName)}/edit`;
      const doc = Api.currentDoc(path);
      let acc = doc ? Api.parseAccount(doc) : null;
      if (!acc || !acc.email) acc = Api.parseAccount(await Api.fetchPage(path));
      state.account = acc;
      return;
    }

    if (view === 'session') {
      if (!state.sessionId) throw new Error(t('sess.noId'));
      if (!state.session) {
        /* 会话页常常就是"当前页"：直接解析活 document，省一次 43KB 的整页重抓；
           站点 JS 改过 DOM 导致解析不出东西时（parseSession 回 null）再回退 fetch。 */
        const path = `/session/${state.sessionId}`;
        const doc = Api.currentDoc(path);
        let sess = doc ? Api.parseSession(doc, state.sessionId) : null;
        if (!sess) sess = Api.parseSession(await Api.fetchPage(path), state.sessionId);
        if (!sess) throw new Error(t('sess.parseFailed'));
        state.session = sess;
      }
      /* 时间线 / 项目表 / 名单互不依赖：并行发。时间线地址已从本页解析出来，不用等第二趟。 */
      await Promise.all([
        state.session.timeline === undefined && state.session.timelineUrl
          ? Api.fetchJson(state.session.timelineUrl)
            .then((j) => { state.session.timeline = Api.parseTimeline(j); })
            .catch(() => { state.session.timeline = []; state.session.timelineFailed = true; })
          : null,
        !state.projects
          ? Api.fetchPage('/home/projects').then((h) => { state.projects = Api.parseProjects(h); }).catch(() => { state.projects = null; })
          : null,
        !state.account && state.userName
          ? Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`).then((h) => { state.account = Api.parseAccount(h); }).catch(() => { state.account = null; })
          : null,
      ].filter(Boolean));
      return;
    }

    if (view === 'overview') {
      const target = state.profileName || state.userName;
      if (!target) throw new Error(t('state.loggedOut'));
      if (!state.profile) {
        /* 主页常常就是当前页：直接解析活 document，省一次 166KB 重抓；
           站点 JS 改过 DOM 导致读不出统计（dl 没了）时再回退 fetch。 */
        const path = `/user/${encodeURIComponent(target)}/profile`;
        const doc = Api.currentDoc(path);
        let prof = doc ? Api.parseProfile(doc, target) : null;
        if (!prof || !Object.keys(prof.stats || {}).length) prof = Api.parseProfile(await Api.fetchPage(path), target);
        state.profile = prof;
        SP.state = state;   // 供 shell 里取头像
      }
      await machineDetails(state.profile);
      /* 这里原来还取 /home 与 /home/projects：但总览视图一个都不消费
         （state.home 只有项目视图用，state.projects 只有项目/会话视图用），
         等于白等 2 个 RTT + 约 78KB。项目视图进来时自己会取。 */
      return;
    }

    if (view === 'projects') {
      if (!state.projects) state.projects = Api.parseProjects(await Api.fetchPage('/home/projects'));
      /* 顶部全站实时、账户名单（发布者那格）、「我发布的」三件事互不依赖：一次并行发完。
         「我发布的」吃的是个人主页那张表——看自己总览时它已在 state.profile 里，不用再取。 */
      await Promise.all([
        !state.account && state.userName
          ? Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`)
            .then((h) => { state.account = Api.parseAccount(h); })
            .catch(() => { state.account = null; })
          : null,
        !state.home
          ? Api.fetchPage('/home')
            .then((h) => { state.home = Api.parseHome(h); })
            .catch(() => { state.home = { stats: [], news: [] }; })
          : null,
        Views.projState.scope === 'mine' && !state.myProjects
          ? (async () => {
            const own = state.userName && state.profileName === state.userName && state.profile
              ? state.profile
              : (state.userName
                ? Api.parseProfile(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/profile`), state.userName)
                : null);
            state.myProjects = (own && own.myProjects) || [];
          })()
          : null,
      ].filter(Boolean));
      return;
    }

    if (view === 'team' && !state.team) {
      const doc = Api.currentDoc(location.pathname);
      let d = doc ? Api.parseTeamPage(doc) : null;
      if (!d || !d.members.length) d = Api.parseTeamPage(await Api.fetchPage(location.pathname));
      state.team = d;
    }

    /* 实况要两份页面：frames（跑什么）+ machines（谁在跑）。
       当前文档就是其中一页时省掉那一份下载；charts 只能从源码字符串抠，所以两页都拿原文。 */
    if (view === 'live' && !state.live) {
      const fdoc = Api.currentDoc('/home/frames');
      const mdoc = Api.currentDoc('/home/machines');
      const fhtml = fdoc ? fdoc.documentElement.outerHTML : await Api.fetchPage('/home/frames');
      const mhtml = mdoc ? mdoc.documentElement.outerHTML : await Api.fetchPage('/home/machines');
      state.live = {
        frames: Api.parseProcessingFrames(fhtml) || [],
        machines: Api.parseMachineSessions(mhtml),
        /* 两页各有一半图表变量：合并时**跳过空数组**，否则 machines 页上不存在的
           framesByDay 会用空数组把 frames 页的 90 个点覆盖掉。 */
        charts: (() => {
          const a = Api.parseChartArrays(fhtml);
          const b = Api.parseChartArrays(mhtml);
          const out = Object.assign({}, a);
          Object.keys(b).forEach((k) => { if (b[k] && b[k].length) out[k] = b[k]; });
          return out;
        })(),
      };
    }

    if (view === 'teams' && !state.teams) {
      /* /team 是公开页：当前文档就是它时直接解析，省一次下载；否则抓取 */
      const doc = Api.currentDoc('/team');
      let list = doc ? Api.parseTeams(doc) : null;
      if (!list || !list.length) list = Api.parseTeams(await Api.fetchPage('/team'));
      state.teams = list || [];
    }

    /* 「我的团队」：榜单页自己不写这个信息。先看已加载的总览/账户数据，没有再抓一次个人页。 */
    if (view === 'teams' && !state.myTeam) {
      const known = (state.profile && state.profile.team) || (state.account && state.account.team);
      if (known) state.myTeam = known;
      else if (state.userName) {
        try {
          const p = Api.parseProfile(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/profile`), state.userName);
          if (p && p.team) state.myTeam = p.team;
        } catch (e) { /* 拿不到就不高亮，不把登录问题变成整页错误 */ }
      }
    }

    /* 团队详情要显示「团队榜第 N 名」，名次只在榜单里：异步补一次，不拖住首屏 */
    if (view === 'team' && !state.teams) {
      Api.fetchPage('/team').then((html) => {
        const list = Api.parseTeams(html);
        if (list && list.length) {
          state.teams = list;
          if (state.view === 'team') render();
        }
      }).catch(() => { /* 名次拿不到就不显示，不改其它东西 */ });
    }

    if (view === 'ranking' && !state.ranking) {
      /* 排行榜整页 1.76MB：当前页就是数据源，API 却把刚下载的整页再 fetch 一遍。
         直接解析活 document；解析不出（站点改版）才回退抓取。 */
      const path = '/ranking/user';
      const doc = Api.currentDoc(path);
      let list = doc ? Api.parseRanking(doc) : null;
      if (!list || !list.length) list = Api.parseRanking(await Api.fetchPage(path));
      state.ranking = list;
    }
  }

  /* show() 是异步的：慢请求还没回来时用户可能已经切到别的视图。导航序号保证只有**最新**一次
     能写 error/loading 并 render —— 否则旧视图的失败会把当前视图盖成「读取失败」，旧视图的
     成功会把当前视图的骨架提前清掉、闪一下「暂无数据」。 */
  let navSeq = 0;
  async function show(view, opts) {
    const seq = ++navSeq;
    const viewChanged = state.view !== view;
    state.view = view;
    state.error = null;
    /* 列表页的 3 点菜单属于上一屏：换视图/重取前先清掉，免得回来时"没人点它却开着"。 */
    Views.projState.menu = null;

    if (!opts || !opts.silent) {
      const need = (view === 'overview' && !state.profile)
        || (view === 'projects' && !state.projects)
        || (view === 'projects' && Views.projState.scope === 'mine' && !state.myProjects)
        || (view === 'ranking' && !state.ranking)
        /* 账户页原来漏了这一条：首次进入或点刷新时 state.account 还是 null，会先闪一下「暂无数据」。 */
        || (view === 'account' && !state.account)
        || (view === 'session' && !state.session);
      state.loading = need;
      render();
    }

    try {
      await ensureData(view);
      if (seq === navSeq) state.error = null;
    } catch (e) {
      if (seq !== navSeq) return;
      /* 站点把「未登录」做成 302 → /user/signin（fetch 跟随后是 200 登录页）：Api 抛 SIGNED_OUT。
         另外 401/403 与老消息也按未登录处理。 */
      if (e && e.code === 'SIGNED_OUT') state.error = t('state.loggedOut');
      else {
        state.error = (e && e.message) || String(e);
        if (/401|403|signin/i.test(state.error)) state.error = t('state.loggedOut');
      }
    } finally {
      if (seq !== navSeq) return;
      state.loading = false;
      animOnce = viewChanged || !painted;
      render();
      painted = true;
      /* 地址栏只归**最后一次**导航写：show() 异步，慢的收尾会落在更新的导航之后，按自己的视图写
         URL 就会改掉用户在看的那页（实测：地址 #/overview 而界面是上传页）。 */
      if (state.view === view) history.replaceState(null, '', ROUTES[view] || location.pathname);
    }
  }

  /* ---- 5. 事件 ---- */

  /** 一次性提示：写操作的结果必须说出来，不能默默成功/失败 */
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

  /** 写操作失败统一的文案：登录过期（SIGNED_OUT）别把内部错误串直接摆给用户 */
  const errText = (e) => (e && e.code === 'SIGNED_OUT' ? t('state.loggedOut') : ((e && e.message) || String(e)));

  /** 写操作统一收口：回 'OK' 就重取重画，否则原样转述错误 */
  let submitting = false;   // 防重入：双击「新建密钥」会建出两把
  async function submit(fn, okMsg) {
    if (submitting) { toast(t('account.saving')); return false; }
    submitting = true;
    toast(t('account.saving'));
    try {
      const r = await fn();
      /* 站点写操作的成功体不止 'OK'（见 20-api.js 的 isOk）：只认 OK 会把调度开关/改邮箱的
         成功当失败，而且这里 return false 后不 invalidate、不重取 → 勾选状态会回弹。 */
      if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); return false; }
      Api.invalidate();
      state.account = null;
      state.session = null;
      /* 重取期间必须留下"在加载"的表示：数据已经置空，而 show({silent}) 不设 loading，这段窗口里
         任何一次 render() 都会把整页画成「暂无数据」（实测：移出渲染优先后菜单还开着，随手点一下
         菜单外面就中）。这里**不**立刻 render()：正常路径旧内容留到重取完，只有真发生 stray render
         才显示骨架。 */
      state.loading = true;
      await show(state.view, { silent: true });
      /* 换头像后顶栏那张也要跟着换（否则账户面板是新图、顶栏还是旧的）。
         show() 已经画完这一轮了，这里补一次 render。 */
      if (state.account && state.account.avatar && state.account.avatar !== state.myAvatar) {
        state.myAvatar = state.account.avatar;
        render();
      }
      toast(okMsg || t('account.ok'));
      return true;
    } catch (e) {
      toast(t('account.failed', { msg: errText(e) }));
      return false;
    } finally {
      submitting = false;
    }
  }

  const valOf = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  };

  /** 关 3 点菜单：只做定向 DOM 更新，**不整页重画** —— 菜单开着时点搜索框/筛选/表格任意一处，
      整页重画会把刚点到的节点换掉（焦点丢、要再点一次、输入和滚动被打断）。 */
  function closeProjMenu() {
    if (!Views.projState.menu) return;
    Views.projState.menu = null;
    const host = document.getElementById('sp');
    if (!host) return;
    host.querySelectorAll('.omenu').forEach((n) => n.remove());
    host.querySelectorAll('[data-act="owner-menu"][aria-expanded="true"]')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function onClick(ev) {
    // 3 点菜单是浮层：点别处先关掉；不 return，该干的事继续干
    if (Views.projState.menu && !ev.target.closest('.omenu') && !ev.target.closest('[data-act="owner-menu"]')) {
      closeProjMenu();
    }

    const nav = ev.target.closest('[data-nav]');
    if (nav) {
      /* 上传三步交还站点：入口就是新标签页打开站点自己的 /getstarted，我们不接管那一页。 */
      if (nav.dataset.nav === 'upload') { window.open('/getstarted', '_blank', 'noopener'); return; }
      go(nav.dataset.nav); return;
    }

    const act = ev.target.closest('[data-act]');
    if (act) {
      const kind = act.dataset.act;

      if (kind === 'ov-right') {
        /* 总览右侧卡片在「近 30 天概览 / 月度产出」之间切换；选择落盘，随时可以切回来 */
        const v = act.dataset.v === 'months' ? 'months' : 'recent';
        Util.store.set('ovRight', v);
        state.ovRight = v;
        render();
        return;
      }

      if (kind === 'theme-cycle') {
        /* auto → light → dark 循环；不动设置页的持久化逻辑（Theme.set 就是它用的那个） */
        const next = THEME_ORDER[(THEME_ORDER.indexOf(state.themePref) + 1) % THEME_ORDER.length] || 'auto';
        Theme.set(next);
        syncPrefs();
        render();
        return;
      }

      if (kind === 'mode-classic') {
        /* 就地换过去（不刷新）：原站那份 DOM 一直在，只是被守卫压着 */
        toClassic(act);
        return;
      }

      if (kind === 'refresh') {
        Api.invalidate();
        state.profile = state.home = state.projects = state.ranking = state.account = null;
        state.myProjects = null;
        state.session = null;
        // 骨架让内容变短、scrollTop 被夹到 0：画完放回去
        const host = document.getElementById('sp');
        const keepY = host ? host.scrollTop : 0;
        show(state.view).then(() => {
          const h2 = document.getElementById('sp');
          if (h2 && keepY) h2.scrollTop = keepY;
        });
        return;
      }

      // ---- 账户设置 ----
      if (kind === 'prio-add') {
        const name = valOf(act.dataset.input);
        if (!name) return;
        // 前缀来自账户页解析（站点 onclick）；读不到才按形状兜底
        const base = (state.account && state.account.add && state.account.add.priority) || '/user/priority/add/';
        submit(() => Api.post(base + encodeURIComponent(name)));
        return;
      }
      if (kind === 'sponsor-add') {
        const name = valOf(act.dataset.input);
        const base = act.dataset.url;
        if (!name || !base) return;
        submit(() => Api.post(base + encodeURIComponent(name)));
        return;
      }
      if (kind === 'sponsor-set') {
        // onclick 带的就是"这一下要打的地址"（含目标状态）；失败要拉回真实状态
        const url = act.dataset.url;
        if (!url) return;
        submit(() => Api.post(url)).then((ok) => { if (!ok) show(state.view, { silent: true }); });
        return;
      }
      /* 团队动作：站点用 POST + 'OK'（common.js 的 requestReloadOnSuccess）。
         退出/申请加入都会改变团队归属 → 成功后整页重取最稳，不在应用内猜。 */
      if (kind === 'team-act') {
        const url = act.dataset.url;
        if (!url) return;
        /* 二级确认：第一次点只把按钮变成「再点一次确认」，4 秒内不点自动复原。
           退出/解散都是不可逆或半不可逆的动作，一次误触代价太高。 */
        if (act.dataset.armed !== '1') {
          act.dataset.armed = '1';
          act.dataset.label = act.textContent;
          act.textContent = t('team.armConfirm');
          act.style.color = 'var(--accent)';
          setTimeout(() => {
            if (!act.isConnected || act.dataset.armed !== '1') return;
            act.dataset.armed = '0';
            act.textContent = act.dataset.label || '';
            act.style.color = '';
          }, 4000);
          return;
        }
        act.dataset.armed = '0';
        act.disabled = true;
        Api.post(url).then((r) => {
          if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); act.disabled = false; return; }
          toast(t('team.ok'));
          Api.invalidate();
          setTimeout(() => location.reload(), 500);
        }).catch((e) => {
          toast(t('account.failed', { msg: (e && e.message) || String(e) }));
          act.disabled = false;
        });
        return;
      }

      /* 团队改名/改描述：站点 /team/<id>/update，字段 team_update_name / team_update_description */
      if (kind === 'team-update') {
        const url = act.dataset.url;
        const name = valOf('sp-tname');
        const desc = valOf('sp-tdesc');
        if (!url) return;
        if (!name) { toast(t('team.updateName')); return; }
        act.disabled = true;
        Api.post(url, { team_update_name: name, team_update_description: desc })
          .then((r) => {
            if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); act.disabled = false; return; }
            toast(t('team.updated'));
            Api.invalidate();
            setTimeout(() => location.reload(), 500);
          })
          .catch((e) => { toast(t('account.failed', { msg: (e && e.message) || String(e) })); act.disabled = false; });
        return;
      }

      /* 创建团队：站点 /team/add，字段 team_create_name / team_create_description / action */
      if (kind === 'team-create') {
        const name = valOf(act.dataset.input);
        if (!name) { toast(t('team.createName')); return; }
        act.disabled = true;
        Api.post('/team/add', { team_create_name: name, team_create_description: '', action: 'add' })
          .then((r) => {
            if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); act.disabled = false; return; }
            toast(t('team.created'));
            Api.invalidate();
            setTimeout(() => location.reload(), 500);
          })
          .catch((e) => { toast(t('account.failed', { msg: (e && e.message) || String(e) })); act.disabled = false; });
        return;
      }
      // ---- 发布者 3 点菜单 ----
      if (kind === 'owner-menu') {
        const id = act.dataset.id;
        Views.projState.menu = Views.projState.menu === id ? null : id;
        render();
        return;
      }
      if (kind === 'owner-gift' || kind === 'owner-block') {
        const url = act.dataset.url;   // add 前缀，或名单行 onclick 里的撤回地址
        if (!url) return;
        Views.projState.menu = null;   // 提交成功后整屏重取
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

      // ---- 会话页：暂停 / 恢复（地址读自原站 onclick） ----
      if (kind === 'sess-run') {
        const url = act.dataset.url;
        if (!url) return;
        // 不加确认：原站也不确认，且暂停可逆
        submit(() => Api.post(url));
        return;
      }

      // 密钥显隐纯本地：只把页上已有的文字翻出来
      if (kind === 'reveal-key') {
        const box = act.parentNode && act.parentNode.querySelector('.sec');
        if (!box) return;
        const shown = act.getAttribute('aria-pressed') === 'true';
        box.textContent = shown ? '••••••••••••' : (box.dataset.key || '••••••••••••');
        act.setAttribute('aria-pressed', shown ? 'false' : 'true');
        act.textContent = shown ? t('sess.reveal') : t('sess.hide');
        return;
      }

      // 日志默认折叠：先给按天/按月汇总
      if (kind === 'sess-log') { Views.sessState.open = !Views.sessState.open; render(); return; }

      // 地址由视图算好（移出那条读自 onclick），这里只 POST
      if (kind === 'prio-set') {
        const url = act.dataset.url;
        if (!url) return;
        /* 与 owner-gift / owner-block 一致：动作发出后菜单要收起来。 */
        Views.projState.menu = null;
        submit(() => Api.post(url));
        return;
      }
      return;
    }

    const del = ev.target.closest('[data-del]');
    if (del) {
      if (del.dataset.confirm && !window.confirm(del.dataset.confirm)) return;
      if (!del.dataset.del) return;   // 站点给不出动作地址时不发空 POST（会打到当前页）
      submit(() => Api.post(del.dataset.del));
      return;
    }

    if (ev.target.closest('#sp-retry')) { show(state.view); return; }

    const more = ev.target.closest('#sp-more');
    if (more) {
      const step = Number(more.dataset.step) || 100;
      if (state.view === 'ranking') Views.rankState.limit += step;
      else if (state.view === 'session') Views.sessState.limit += step;
      else if (state.view === 'team') Views.teamState.limit += step;
      else if (state.view === 'live') Views.liveState.limit += step;
      else Views.projState.limit += step;
      render();
      return;
    }

    const sort = ev.target.closest('th[data-sort]');
    if (sort) {
      const k = sort.dataset.sort;
      if (Views.projState.sort === k) Views.projState.dir = Views.projState.dir === 'asc' ? 'desc' : 'asc';
      else { Views.projState.sort = k; Views.projState.dir = 'desc'; }
      Views.saveSort();   // 点表头 = 记住这个默认（用户自定义排序）
      render();
      return;
    }

    // 「我发布的」那张表的表头（列少，跟全站那张分开记排序状态）
    const msort = ev.target.closest('th[data-msort]');
    if (msort) {
      const k = msort.dataset.msort;
      if (Views.projState.msort === k) Views.projState.dir = Views.projState.dir === 'asc' ? 'desc' : 'asc';
      else { Views.projState.msort = k; Views.projState.dir = 'desc'; }
      Views.saveSort();
      render();
      return;
    }

    const f = ev.target.closest('#sp-filter [data-f]');
    if (f) { Views.projState.filter = f.dataset.f; render(); return; }

    /* 范围切换：换的是数据源（全站列表 ↔ 个人主页那张表），第一次进「我发布的」要取一次数 */
    const sScope = ev.target.closest('#sp-scope [data-s]');
    if (sScope) {
      const v = sScope.dataset.s;
      if (Views.projState.scope === v) return;
      Views.projState.scope = v === 'mine' ? 'mine' : 'all';
      Views.projState.filter = 'all';
      Views.projState.limit = 120;
      Views.projState.menu = null;
      state.error = null;
      if (Views.projState.scope === 'mine' && !state.myProjects) {
        /* silent show 不设 loading；这里先画骨架，取数失败时错误态也能顶上来（原来失败会卡在空白/旧错误） */
        state.loading = true;
        render();
        show('projects', { silent: true });
      } else {
        state.loading = false;
        render();
      }
      return;
    }

    // 总览区块的「看全部」：先定好档位，再让 #/projects 这个链接照常跳
    const jump = ev.target.closest('[data-scope]');
    if (jump) { Views.projState.scope = jump.dataset.scope === 'mine' ? 'mine' : 'all'; Views.projState.filter = 'all'; }

    // 账户选项卡：只换面板，不重新取数
    const tb = ev.target.closest('#sp-acct-tabs [data-tab]');
    if (tb) { Views.acctState.tab = tb.dataset.tab; render(); return; }

    // 换时间线类型要把分页收回第一屏，否则会是一片空白
    const tf = ev.target.closest('#sp-tl-types [data-t]');
    if (tf) { /* 点类型＝想看这一类全部：直接把窗口放到 1000（761 条全画约 0.2s），不让人再点一次「显示更多」。超过 1000 的老机器再走分页。 */
      Views.sessState.type = tf.dataset.t; Views.sessState.limit = 1000; render(); return; }

    const th = ev.target.closest('#sp-theme [data-v]');
    if (th) { Theme.set(th.dataset.v); syncPrefs(); show(state.view, { silent: true }); return; }

    /* 每页条数：存下来，并把各列表的 limit 重置成新值（当前页立刻生效） */
    const pz = ev.target.closest('#sp-pagesize [data-v]');
    if (pz) {
      const n = Number(pz.dataset.v) || 100;
      Util.store.set('pageSize', n);
      ['projState', 'rankState', 'teamsState', 'teamState', 'sessState', 'framesState'].forEach((k) => {
        if (Views[k]) Views[k].limit = n;
      });
      render();
      return;
    }

    /* 导航显隐：点一下翻转一项。外壳要重建（导航项是 shell 的一部分），保留滚动位置。 */
    const nt = ev.target.closest('[data-nav-toggle]');
    if (nt) {
      const k = nt.dataset.navToggle;
      if (!k) return;
      const hidden = new Set(state.navHidden);
      if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
      state.navHidden = [...hidden];
      Util.store.set('navHidden', state.navHidden);
      rebuildShell();
      return;
    }

    const nr = ev.target.closest('[data-nav-reset]');
    if (nr) {
      state.navHidden = [];
      Util.store.set('navHidden', []);
      rebuildShell();
      return;
    }

    // 缩放只改 #sp 自己（applyTheme 写 zoom）
    const sc = ev.target.closest('#sp-scale [data-v]');
    if (sc) {
      state.uiScale = Number(sc.dataset.v) || 1;
      Util.store.set('scale', state.uiScale);
      render();
      return;
    }

    /* 默认排序：改完落盘（两个列表下次打开都用它）。认不出的值、或点的就是当前那档，
       set*Pref 会返回 false —— 那就没什么可画的，不白重画一次。 */
    const ps = ev.target.closest('#sp-psort [data-v]');
    if (ps) { if (Views.setSortPref(ps.dataset.v)) render(); return; }

    const pd = ev.target.closest('#sp-pdir [data-v]');
    if (pd) { if (Views.setDirPref(pd.dataset.v)) render(); return; }

    // 总览区块的开关：点一下翻一个
    const ob = ev.target.closest('[data-ov-toggle]');
    if (ob) { if (Views.setOvHidden(ob.dataset.ovToggle)) render(); return; }

    // 总览区块的上/下移：到头了 moveOv 返回 false，什么都不用画
    const om = ev.target.closest('[data-ov-move]');
    if (om) { if (Views.moveOv(om.dataset.ovMove, Number(om.dataset.ovDir))) render(); return; }

    const lg = ev.target.closest('#sp-lang [data-v]');
    if (lg) {
      I18n.set(lg.dataset.v);
      syncPrefs();
      const host = document.getElementById('sp');
      if (host) host.innerHTML = shell();
      show(state.view, { silent: true });
      return;
    }

  }

  /** 复选框只走 change：语义是"状态变了"，不是"被点了一下" */
  function onChange(ev) {
    const sc = ev.target.closest('[data-sched]');
    if (sc) {
      /* 失败要把勾选拨回服务端那个状态（sponsor-set 早就是这么做的，调度开关漏了） */
      submit(() => Api.post(`/user/update/scheduler/${sc.dataset.sched}/${sc.checked ? '1' : '0'}`))
        .then((ok) => { if (!ok) show(state.view, { silent: true }); });
      return;
    }
  }

  let inputTimer = null;
  function onInput(ev) {
    if (ev.target.id === 'sp-tq') {
      Views.teamsState.q = ev.target.value;
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => {
        const pos = ev.target.selectionStart;
        render();
        const again = document.getElementById('sp-tq');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
      }, 180);
      return;
    }
    if (ev.target.id !== 'sp-q') return;
    /* 中文输入法组合期间不要重画：整页重画会换掉输入框，候选/拼音被打断（组合结束时还会再来一次 input） */
    if (ev.isComposing) return;
    Views.projState.q = ev.target.value;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      const pos = ev.target.selectionStart;
      render();
      const again = document.getElementById('sp-q');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
    }, 180);
  }

  /** 视图"该在"的那一页（pathname）。地址栏必须和内容对得上：
      从会话页点「总览」以前只改 hash → 停在 `/session/<id>#/overview`，地址和内容对不上
      （用户 2026-10-07 实报）。所以跨页的视图切换改成**整页导航**到它自己那一页，
      站点那一页照旧由我们接管，hash 决定落在哪个视图（boot 里读）。
      同一页内的视图切换（总览 ↔ 项目 ↔ 排行榜 ↔ 设置）仍走 replaceState，不重载。 */
  function pageFor(view) {
    const me = state.userName;
    if (!me) return null;
    const onProfile = /^\/user\/[^/]+\/profile$/.test(location.pathname);
    /* 账户设置与主页那一族一样**留在主页地址上**（用户 2026-10-07：账户设置也别改地址，地址还是
       那个 profile 的）——它的数据本来就走 fetchPage('/user/<me>/edit')，不需要换页。
       已经在自己的 edit 页上（站点自己的链接进来的）也不动。 */
    if (view === 'account') {
      if (onProfile || /^\/user\/[^/]+\/edit$/.test(location.pathname)) return location.pathname;
      return `/user/${encodeURIComponent(me)}/profile`;
    }
    if (view === 'overview' || view === 'projects' || view === 'ranking' || view === 'settings') {
      /* 主页那一族：**任何人的**主页都算（在别人主页上看总览/项目是既有能力，别跳回自己主页）。
         不在主页上（会话页 / 站点自己的上传页与管理页…）才回自己的主页。 */
      return onProfile ? location.pathname : `/user/${encodeURIComponent(me)}/profile`;
    }
    return null;
  }

  function go(view) {
    const want = pageFor(view);
    if (want && want !== location.pathname) {
      /* 主页那一族带上 hash（地址里能看出落在哪个视图）；账户设置**不带** ——
         那一页本身就是那个视图，`/user/<me>/edit#/account` 这种多余后缀只会让人以为有两层。 */
      const hash = /^\/user\/[^/]+\/profile$/.test(want) ? (ROUTES[view] || '') : '';
      /* 真要换一页（那一页由站点自己渲染，我们不在应用内伪造它）：先盖一层再走。
         等的那一下看起来才是有意的 —— 连点报错也是因为没有这层"已经在走了"的表示。 */
      SP.Sweep.veilThen(want + hash, t('mode.opening'), modernBg());
      return;
    }
    if (ROUTES[view]) history.replaceState(null, '', ROUTES[view]);
    show(view);
  }

  window.addEventListener('hashchange', () => {
    /* 原版界面下这一页也可能有 hash 链接：没启动就什么都别接管 */
    if (!SP.modernStarted) return;
    const m = location.hash.match(/^#\/(\w+)$/);
    /* 按浏览器 Back 回到"没有 hash"时，hash 变空 —— 原来直接 return，画面停在旧视图、
       地址栏却已经变了。回到这一页本来的视图（boot 里的 pathView）。 */
    if (!m) {
      if (pathView && state.view !== pathView) show(pathView);
      return;
    }
    if (m[1] === state.view) return;
    show(m[1]);
  });

  // Esc 关 3 点菜单：键盘用户没有"点外面"这个动作
  window.addEventListener('keydown', (ev) => {
    if (!SP.modernStarted) return;
    if (ev.key === 'Escape' && Views.projState.menu) closeProjMenu();
  });

  /* ---- 6. 启动 ---- */

  function boot() {
    syncPrefs();

    // 登录态与用户名从原站导航栏读（还在 DOM 里，只是被 CSS 隐藏）
    const who = Api.detectUser(document);
    state.userName = who.signedIn ? who.userName : null;
    state.myAvatar = who.avatar || '';

    // 账户设置只接管自己的：守卫已在 document-start 注入（防闪），路径指向别人就还回页面
    const acct = location.pathname.match(/^\/user\/([^/]+)\/edit$/);
    if (acct && (!state.userName || decodeURIComponent(acct[1]) !== state.userName)) {
      release();
      return;
    }

    const m = location.pathname.match(/^\/user\/([^/]+)\/profile/);
    state.profileName = m ? decodeURIComponent(m[1]) : (location.pathname === '/home' || location.pathname === '/' ? who.userName : null);

    // 会话页编号只从地址来：地址就是这一页的身份，不从 DOM 里认
    const se = location.pathname.match(/^\/session\/(\d+)/);
    state.sessionId = se ? se[1] : null;

    const tm = location.pathname.match(/^\/team\/(\d+)/);
    state.teamId = tm ? tm[1] : null;

    if (location.hash && /^#\/(\w+)$/.test(location.hash)) {
      const v = location.hash.slice(2);
      if (ROUTES[v]) state.view = v;
    }

    siteTitle = document.title;   // 切回原版时还原站点自己的标题
    document.title = document.title.replace(/^\s*SheepIt\s*$/, 'SheepIt Plus');

    if (!state.userName && !state.profileName) {
      // 未接管的页面上面已 return：这一屏只在"该接管但读不到登录态"时出现
      mount().innerHTML = `<div class="wrap">${UI.state.loggedOut()}</div>`;
      return;
    }
    if (!state.profileName) state.profileName = state.userName;

    render();
    show(state.view);
  }

  if (deferredModern) {
    /* 原版界面 / 没有重制版的页：先只挂入口，现代化部分等用户点了再启动 */
    mountModePill(pathView ? 'classic' : 'enter');
  } else {
    startModern();
  }

  SP.app = { state, show, render, go, toClassic, toModern, toast };
})();
