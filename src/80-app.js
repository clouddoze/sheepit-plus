/* ==== 80-app.js：应用层（接管判定 / 路由 / 事件） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.booted) return;
  SP.booted = true;

  const { Util, UI, Api, Theme, I18n, Views, t } = SP;

  /* ---- 1. 接管判定 ---- */

  /** 上传链路三态（用户 2026-10-07 拍板砍掉兼容档后只剩这三档）：
      off = 关：整条链路不接管，顶栏也不出入口
      raw = 原版：顶栏入口在，点一下**新标签页**打开站点自己的 /getstarted（我们完全不接管那一页）
      new = 新版：站点给的三个契约由 62-chain.js 解析、界面自绘、提交自己发 —— 唯一被重制的上传界面
      历史值（'site' 是 0.2.0 中途用过的名字，'compat' 是已砍掉的兼容档）与空值都归到新版：
      它们不该把用户留在一条已经不存在的路径上。 */
  function uploadMode() {
    const v = Util.store.get('uploadMode', 'new');
    if (v === 'off' || v === 'raw' || v === 'new') return v;
    return 'new';
  }

  /** 路径 → 视图；null = **不接管**，原站界面照常显示。 */
  function viewForPath(pathname) {
    const p = pathname.replace(/\/+$/, '') || '/home';
    if (p === '/home' || p === '/' || p === '/index.php') return 'overview';
    if (p === '/home/projects') return 'projects';
    if (p === '/ranking/user' || p === '/ranking') return 'ranking';
    // 主页公开可读 → 任意人都接管
    if (/^\/user\/[^/]+\/profile$/.test(p)) return 'overview';
    // 账户设置只接管自己的（别人的站点自己会拦）
    if (/^\/user\/[^/]+\/edit$/.test(p)) return 'account';
    // 会话页：别人的编号 404（站点只让自己的机器可见）→ 能读到就接管
    if (/^\/session\/\d+$/.test(p)) return 'session';
    /* 上传链路：上传表单只是 /getstarted 的最后一段（HTML.php:2085），整页接手会让"上传项目"
       有两种界面 —— 所以重制只发生在应用内 #/upload（「新版」档）；「原版」档点一下是**新标签页**
       打开站点自己那一页（见 onClick），这里返回 null，那一页照常由站点自己渲染。 */
    const um = uploadMode();
    const takeover = um === 'new';
    if (p === '/getstarted') return takeover ? 'upload' : null;
    // /project/add/<任意串> 同一模板：token 从地址读，只认形状不认值
    if (/^\/project\/add\/[^/]+$/.test(p)) return takeover ? 'analyse' : null;
    if (/^\/project\/\d+$/.test(p)) return 'project';
    // 还没接管：新增项目表单（见 docs/PUBLISHING.md「五」）
    return null;
  }

  const pathView = viewForPath(location.pathname);
  const uiMode = Util.store.get('uiMode', 'modern');

  /* ---- 原版界面 / 现代化 开关 ---- */

  /** 原版界面下左下角的开关（必须活在 #sp 之外）：能接管的页"切回"，没重制版的页"进入" */
  function mountModePill(kind) {
    if (document.getElementById('sp-mode-pill')) return;
    SP.injectModePillStyle();
    const b = document.createElement('button');
    b.id = 'sp-mode-pill';
    b.type = 'button';
    const classic = kind === 'classic';
    b.title = classic ? t('mode.classicTip') : t('mode.enterTip');
    b.setAttribute('aria-label', b.title);
    b.innerHTML = UI.logo() + `<span>${Util.esc(classic ? t('mode.classicHint') : t('mode.enter'))}</span>`;
    b.addEventListener('click', () => {
      Util.store.set('uiMode', 'modern');
      if (classic) location.reload();
      else location.href = '/home';   // 没重制版 → 去总览
    });
    SP.cornerHost().appendChild(b);
  }

  /* ---- 未接管的页面：只补国际化 ---- */

  function startSiteTranslation() {
    I18n.init();
    const on = Util.store.get('translateSite', true) !== false;
    SP.DomI18n.enabled = on;

    const go = () => {
      if (!document.body) return;
      if (on && I18n.canTranslateSite()) {
        document.documentElement.lang = ({ zh: 'zh-CN', en: 'en' })[I18n.lang] || I18n.lang;
        SP.DomI18n.run();
      }
      /* 角落开关**不受 on 影响**，否则关掉翻译就再没有入口开回来（用户实报） */
      if (I18n.canTranslateSite()) SP.DomI18n.mountPill();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  }

  // 不接管 / 原版界面：不注入守卫、不挂 #sp，只补国际化 + 左下角入口
  if (uiMode === 'classic' || !pathView) {
    startSiteTranslation();
    mountModePill(pathView ? 'classic' : 'enter');
    return;
  }

  // 守卫在 document-start 注入（防闪）；能走到这里的都是整页接管
  SP.injectGuard();
  SP.injectStyle();

  /** 守卫已注入、后来发现不该接管：把页面原样还给用户 */
  function release() {
    released = true;
    parkAnalyse();   // 壳下面那份站点结果容器还挂着：先送回页面，再拆 #sp
    const g = document.getElementById('sp-guard');
    if (g) g.remove();
    const s = document.getElementById('sp-style');
    if (s) s.remove();
    const host = document.getElementById('sp');
    if (host) host.remove();   // 界面还没画，通常不存在
    startSiteTranslation();
  }
  let released = false;

  /* ---- 2. 状态 ---- */

  const state = {
    view: pathView,
    userName: null,
    profileName: null,     // 正在查看的档案属主
    profile: null,
    home: null,
    projects: null,
    ranking: null,
    account: null,
    session: null,
    sessionId: null,       // /session/<数字>
    analyseToken: null,    // /project/add/<token>
    projectId: null,       // /project/<数字>
    myAvatar: '',          // 顶栏那张：**自己**的头像（不是正在看的档案）
    loading: false,
    error: null,
    themePref: 'auto',
    langPref: 'auto',
    translateSite: true,
    uploadMode: 'new',
    showRanking: true,     // 导航里是否显示「排行榜」（设置里可关）
    ovRight: 'recent',     // 总览右侧那张卡：'recent' 近 30 天概览 / 'months' 月度产出（用户可随时切回）
    uiScale: 1,            // 界面整体缩放
  };

  const ROUTES = { overview: '#/overview', projects: '#/projects', upload: '#/upload', ranking: '#/ranking', settings: '#/settings', account: '#/account' };

  function syncPrefs() {
    state.themePref = Theme.init();
    state.langPref = Util.store.get('lang', 'auto');
    state.translateSite = Util.store.get('translateSite', true) !== false;
    state.uploadMode = uploadMode();
    state.showRanking = Util.store.get('showRanking', true) !== false;
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

  function shell() {
    const u = state.userName;
    const nav = [['overview', t('nav.overview'), ''], ['projects', t('nav.projects'), '']];
    if (state.uploadMode !== 'off') nav.push(['upload', t('nav.upload'), t('nav.upload')]);
    /* 排行榜可以在「设置」里关掉（用户 2026-10-18）：关掉只是导航项消失，
       直接开 /ranking/user 仍然接管。 */
    if (state.showRanking) nav.push(['ranking', t('nav.ranking'), t('nav.rankingShort')]);
    nav.push(['account', t('nav.account'), t('nav.accountShort')],
      ['settings', t('nav.settings'), '']);
    /* 第二步（/project/add/<token>）是上传链路的一环，顶栏不该在这里丢掉位置标记 */
    const navHere = state.view === 'analyse' ? 'upload' : state.view;
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
          <button class="modebtn" data-act="mode-classic" title="${Util.esc(t('mode.classicTip'))}"><span class="txt">&lt; ${classic}</span><span class="txts">&lt; ${Util.esc(t('mode.toClassicShort'))}</span></button>
          ${u ? `<span class="who">${UI.avatar(SP.state && SP.state.myAvatar, u, 'ini')}<b class="uname" title="${Util.esc(u)}">${Util.esc(u)}</b></span>` : ''}
        </div>
      </div>
      <div id="sp-body"></div>
    </div>`;
  }

  /* 入场动效只在"换视图"和本页首次出内容时播：只改内容的 render() 重放会像整页重载 */
  let animOnce = false;
  let painted = false;

  function render() {
    if (released) return;
    const host = mount();
    applyTheme();
    const scrollY = host.scrollTop;

    /* 分析等待页只画一次：重画会抹掉站点注入 #sp-an-result 的表单 */
    if (state.view === 'analyse' && host.dataset.spWired) return;

    // #sp-body 要等外壳创建之后才查得到
    if (!host.querySelector('.top')) {
      host.innerHTML = shell();
    } else {
      // 只更新高亮与头像：整壳重建会丢滚动位置
      host.querySelectorAll('nav [data-nav]').forEach((b) =>
        b.setAttribute('aria-current', b.dataset.nav === state.view ? 'page' : 'false'));
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

    /* 卡片里是抓回来装好的活节点（含表单）：再画会扔掉用户填的内容 */
    if (state.view === 'upload' && body && body.dataset.spWired) return;

    let html;
    if (state.view === 'settings') html = Views.settings(state);
    // 错误态排在空态前：取不到数据要说原因并给重试
    else if (state.error) html = UI.state.error(state.error, 'sp-retry');
    // 骨架也排在空态前，否则首屏会闪一下"暂无数据"
    else if (state.loading) html = UI.skeleton(5);
    else if (state.view === 'analyse') html = Views.analyse();
    else if (state.view === 'upload') html = Views.upload(state);
    else if (state.view === 'project') html = Views.project(state);
    else if (state.view === 'account') html = state.account ? Views.account(state) : UI.state.empty();
    else if (state.view === 'session') html = state.session ? Views.session(state) : UI.state.empty();
    else if (state.view === 'overview') html = state.profile ? Views.overview(state) : UI.state.empty();
    else if (state.view === 'projects') html = state.projects ? Views.projects(state) : UI.state.empty();
    else if (state.view === 'ranking') html = state.ranking ? Views.ranking(state) : UI.state.empty();
    else html = UI.state.empty();

    /* 重画前必须清掉"已接线"标记：#sp-body 常驻，标记活过整个会话 → 守卫误判早退（实测） */
    delete body.dataset.spWired;
    parkAnalyse();  // 分析页站点那份结果容器（我们把它摘下来了）要先送回原位
    body.innerHTML = html;
    // 错误态不锁，重试要能重画
    if (state.view === 'analyse' && !state.error) host.dataset.spWired = '1';
    host.classList.toggle('sp-anim', animOnce);
    animOnce = false;
    Views.mount(body, state);      // 面积图要按实测像素渲染
    if (state.view === 'project') wireManage(body);   // 名单输入框的自动补全
    host.scrollTop = scrollY;
    paintMeta();
  }

  function paintMeta() {
    const el = document.getElementById('sp-updated');
    if (el) el.textContent = `${t('top.updated')} ${new Date().toLocaleTimeString()}`;
  }

  /* ---- 3.5 「正在分析」轮询：GET /project/add_analyse/<token> → RETRY（等待）/ PROCESSING（分析中，
     带 analysed/total）/ 完成**直接把「新增项目」表单当 HTML 吐回来**；站点那个轮询函数（写死英文）摘掉。 */
  let analyseTimer = null;
  let siteAnalyseNeutralised = false;
  let analyseDone = false;   // 分析完成、第三步表单已经画出来：刷新/重进都不能再重画它（会丢用户填的设置）
  const fmtN = (n) => Number(n).toLocaleString('en-US');

  function stopAnalysePoll() {
    if (analyseTimer) { clearTimeout(analyseTimer); analyseTimer = null; }
  }

  function startAnalysePoll() {
    stopAnalysePoll();
    if (!siteAnalyseNeutralised) {
      siteAnalyseNeutralised = true;
      try { window.doAnalyseUploadedProject = function () { /* 见上 */ }; } catch (e) { /* 站点没定义就算了 */ }
    }
    // 等首屏画完再轮，否则抢掉入场动效
    analyseTimer = setTimeout(analyseTick, 400);
  }

  async function analyseTick() {
    const token = state.analyseToken;
    if (!token) return;
    /* 轮询与判形都在 62-chain.js 里（契约 B）：RETRY / PROCESSING / 完成的碎片 / 编号已失效 */
    let r;
    try {
      r = await SP.Chain.analyse(token);
    } catch (e) {
      // 不自己重试：卡片上的文案已说"重新载入这一页"
      paintAnalyse({ failed: (e && e.message) || String(e) });
      return;
    }
    if (r.kind === 'done') { analyseDone = true; paintAnalyse({ html: r.html }); return; }
    if (r.kind === 'gone') { paintAnalyse({ gone: true }); return; }
    if (r.kind === 'error') { paintAnalyse({ failed: r.message || '' }); return; }
    if (r.kind === 'processing') paintAnalyse({ done: r.done, total: r.total });
    else paintAnalyse({ waiting: true });
    analyseTimer = setTimeout(analyseTick, 5000);
  }

  /* ---- 3.4b 分析完成页那份站点结果容器 ----------------------------------------
     站点渲染 /project/add/<token> 时，它自己的轮询（doAnalyseUploadedProject）会把
     GET /project/add_analyse/<token> 的 HTML 整块塞进页面里的 #project_add_analyse_result。
     我们自己拉的也是同一个地址：如果两边各留一份，全站就有两套同名 id，而 $('#id') 命中的是
     站点那份（在壳后面）—— doAddProject 读它、用户在壳里改的控件白改（0.1.18 修的真缺陷）。
     做法跟管理页的 park 一个套路：把站点那份**摘下来留着**，离开这一页再原样还回去。 */
  let anStale = null;    // 站点那份容器（摘下来后挂在这儿，不删除）
  let anAnchor = null;   // 它在原页里的锚（注释节点）

  /** 把站点那份摘出文档（只摘一次；它空着也摘，反正内容我们自己渲染） */
  function hideStaleAnalyse() {
    if (anStale) return;
    const live = document.getElementById('project_add_analyse_result');
    if (!live || live.closest('#sp')) return;          // 站点没这块 / 已经在我们壳里
    if (!anAnchor || !anAnchor.parentNode || anAnchor.closest('#sp')) {
      anAnchor = document.createComment('sp-analyse');
      live.parentNode.insertBefore(anAnchor, live);
    }
    live.remove();
    anStale = live;
  }

  /** 离开这一页（或整个交还页面）时把它放回去，站点页面保持原样 */
  function parkAnalyse() {
    if (anStale && anAnchor && anAnchor.parentNode) {
      anAnchor.parentNode.insertBefore(anStale, anAnchor.nextSibling);
    }
    anStale = null;
  }

  /** 第三步认不出来时的**交还页面**（砍掉兼容档后这是唯一的降级动作）。
      原则：认不出来就不半新半旧地渲染 —— 老路（把站点碎片塞进我们的卡片、再按站点 id 点名提交）
      随兼容档一起删了。做法是 release() 把页面还给站点，再把站点自己那份碎片放回站点自己的容器：
      站点自己的轮询就是这么写的（addproject.js:204 的 $('#project_add_analyse_result').html(data)），
      而它被我们用空函数顶掉了（见 startAnalysePoll），这一份因此得由我们送回去。
      容器、表单 id、内联 onsubmit 全是站点的原件，提交照旧走站点的 doAddProject。
      为什么不是 release() + location.reload()：重载后脚本照样接管这一页、照样认不出来 ——
      用户会原地转圈；而只 release() 不送碎片的话，站点那一页会停在他自己的「正在分析」上
      （它的轮询已被顶掉，不会再有人往里写）。 */
  function handBackToSite(html) {
    release();   // 拆掉 #sp 与守卫，并把站点那份结果容器放回页面原位
    const host = document.getElementById('project_add_analyse_result');
    if (!host) return;   // 站点连这块都没有（改版了）→ 页面已经在站点自己手里，到此为止
    host.innerHTML = html || '';
    SP.DomI18n.enabled = state.translateSite !== false;
    if (SP.DomI18n && SP.DomI18n.translateSubtree) SP.DomI18n.translateSubtree(host);
  }

  /** 定点改卡片节点，不整页重画（会抹掉站点注入的表单） */
  function paintAnalyse(s) {
    const host = document.getElementById('sp');
    if (!host) return;
    const q = (k) => host.querySelector(`[data-an="${k}"]`);
    const say = (k, text) => { const el = q(k); if (el) el.textContent = text; };

    if (s.failed) {
      stopAnalysePoll();
      const spin = q('spin'); if (spin) spin.remove();
      say('state', t('an.failed', { err: s.failed }));
      say('sub', '');
      const track = q('track'); if (track) track.hidden = true;
      return;
    }
    if (s.gone) {
      stopAnalysePoll();
      const spin = q('spin'); if (spin) spin.remove();
      say('state', t('an.gone'));
      say('sub', '');
      const track = q('track'); if (track) track.hidden = true;
      return;
    }
    if (s.waiting) {
      say('state', t('an.waiting'));
      const track = q('track'); if (track) track.classList.add('indet');
      const bar = q('bar'); if (bar) bar.style.width = '';
      return;
    }
    if (s.html !== undefined) {
      // 站点把第三步（服务端渲染的那块表单）当 HTML 吐回来：它是唯一的数据源，界面我们自己画
      stopAnalysePoll();
      const spin = q('spin'); if (spin) spin.remove();
      say('state', t('an.doneTitle'));
      say('sub', '');
      const track = q('track'); if (track) track.hidden = true;
      /* 页头接过"这是什么页"和"接下来做什么"：标题用步骤名（顶栏那一项也是它），副标题说明
         分析已结束。卡片里那句重复的状态行**必须真的隐藏** —— .an-head 有 display:flex，
         UA 的 [hidden]{display:none} 会被它压掉（这个坑代码里已经记过一次，别再踩）。 */
      const ttl = q('title');
      const tsub = q('titleSub');
      if (ttl) ttl.textContent = t('up3x.title');
      if (tsub) { tsub.textContent = t('an.doneSechead'); tsub.hidden = false; }
      const anHead = host.querySelector('.an-head');
      if (anHead) { anHead.hidden = true; anHead.style.display = 'none'; }
      const box = document.getElementById('sp-an-result');
      if (box) {
        /* 站点自己也会把同一份 HTML 写进 #project_add_analyse_result（doAnalyseUploadedProject）。
           两套同名 id 并存时，站点按 $('#id') 取值命中的是藏在壳后面那份原件 —— 用户在界面上改的
           东西会被整份丢掉（0.1.18 修的真缺陷）：0.1.14 起"值全留默认"的验收看不出来，因为它验的
           就是那份原件。先把站点那份请出文档（留着，离开这一页或交还页面时还回去）。 */
        hideStaleAnalyse();
        /* 站点那份碎片只当**数据源**（DOMParser 解析），界面我们自己画 —— 它永远不进活文档，
           也就不存在"两份同名控件"这一整类问题。 */
        const model = (SP.Chain && SP.Chain.parseStep3) ? SP.Chain.parseStep3(s.html) : null;
        const drawn = (model && SP.Step3x) ? SP.Step3x.render(box, model) : null;
        /* 解析不认识 / 画不出来：不半新半旧地渲染。明说这一版认不出来，并给一个出口 ——
           点一下就把整页还给站点自己（见 handBackToSite）。 */
        if (!(drawn && drawn.ok)) {
          box.textContent = '';
          box.hidden = false;
          const note = document.createElement('div');
          note.className = 'up3-notes up3-bad';
          note.textContent = t('up3x.degrade');
          const foot = document.createElement('div');
          foot.className = 'up3-bfoot';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn up3-submit';
          btn.textContent = t('up3x.degradeGo');
          btn.addEventListener('click', () => handBackToSite(s.html));
          foot.appendChild(btn);
          box.appendChild(note);
          box.appendChild(foot);
          if (tsub) { tsub.textContent = ''; tsub.hidden = true; }
          return;
        }
      }
      return;
    }
    say('state', s.total
      ? t('an.processing', { done: fmtN(s.done), total: fmtN(s.total) })
      : t('an.reading'));
    const track = q('track'); if (track) track.classList.remove('indet');
    const bar = q('bar');
    if (bar) bar.style.width = s.total ? `${Math.min(100, Math.round((s.done / s.total) * 100))}%` : '100%';
  }

  /* ---- 3.6 项目管理页 /project/<数字>：整页自绘，站点 DOM 一个节点都不进我们的壳 ----------------
     数据是**那一页 HTML 的一份副本**（Api.fetchPage → DOMParser → Api.parseManage），
     动作直发站点端点（mgSet / mgAct / mgAcl）。 */

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

    if (view === 'upload') {
      // /getstarted 就是数据源（由 64-step1.js 解析成自绘界面）：站点没给单独接口
      if (!state.uploadHtml) state.uploadHtml = await Api.fetchPage('/getstarted');
      return;
    }

    if (view === 'analyse') {
      if (!state.analyseToken) throw new Error(t('an.noToken'));
      /* 已经画过第三步就别再轮询/重画：表单里是用户填的东西，重画会全部回默认值。 */
      if (analyseDone) return;
      startAnalysePoll();
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

    /* 项目管理页：站点那一页的**副本**当数据源。当前页就是它，所以直接解析活 document；
       解析不出那一页的形状才回退 fetch，仍然认不出就如实报错、不画半张脸。 */
    if (view === 'project') {
      if (!state.projectId) throw new Error(t('mg.noId'));
      if (!state.mg) {
        const path = `/project/${encodeURIComponent(state.projectId)}`;
        const doc = Api.currentDoc(path);
        let mg = doc ? Api.parseManage(doc, state.projectId) : null;
        if (!mg || !mg.found) mg = Api.parseManage(Util.parse(await Api.fetchPage(path)), state.projectId);
        if (!mg.found) throw new Error(t('mg.noData'));
        state.mg = mg;
      }
      return;
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
    const prev = state.view;
    const viewChanged = state.view !== view;
    state.view = view;
    state.error = null;
    /* 离开「分析等待」页：站点轮询还开着的话，它会继续往已摘掉的节点里画（结果静默丢失），
       而且再没有入口回第三步 —— 这里直接停掉。 */
    if (prev === 'analyse' && view !== 'analyse') stopAnalysePoll();
    /* 列表页的 3 点菜单属于上一屏：换视图/重取前先清掉，免得回来时"没人点它却开着"。 */
    Views.projState.menu = null;

    if (!opts || !opts.silent) {
      const need = (view === 'overview' && !state.profile)
        || (view === 'projects' && !state.projects)
        || (view === 'projects' && Views.projState.scope === 'mine' && !state.myProjects)
        || (view === 'ranking' && !state.ranking)
        || (view === 'upload' && !state.uploadHtml)
        /* 账户页原来漏了这一条：首次进入或点刷新时 state.account 还是 null，会先闪一下「暂无数据」。 */
        || (view === 'account' && !state.account)
        || (view === 'session' && !state.session)
        /* 项目管理页同样漏了：缺数据时先画的是「站点没给这一页的项目数据」空态而不是骨架。 */
        || (view === 'project' && !state.mg);
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
      if (nav.dataset.nav === 'upload') {
        /* 「原版」档：站点自己的脚本才在那一页上，干脆开新标签页，我们一点都不碰。
           「新版」档走下面的 go() → 应用内 #/upload。 */
        if (state.uploadMode === 'raw') { window.open('/getstarted', '_blank', 'noopener'); return; }
      }
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
        Util.store.set('uiMode', 'classic');
        location.reload();
        return;
      }

      if (kind === 'refresh') {
        Api.invalidate();
        state.profile = state.home = state.projects = state.ranking = state.account = null;
        state.myProjects = null;
        state.mg = null;
        state.session = null;
        /* 上传页原来刷新是死按钮：uploadHtml 不清 + #sp-body 的"已接线"标记没删，render() 直接早退。
           清掉这两样，让 show() 重新取 /getstarted、重画骨架。 */
        state.uploadHtml = null;
        const sb = document.getElementById('sp-body');
        if (sb) delete sb.dataset.spWired;
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

    // 项目设置：计算方式（站点那只 radio 是"点了就翻"，我们是"点了就是它"，发的是目标值）
    const mc = ev.target.closest('#sp-mg-compute [data-v]');
    if (mc) { mgSet('compute', mc.dataset.v); return; }

    const md = ev.target.closest('[data-mg-del]');
    if (md) {
      if (!window.confirm(t('mg.delConfirm'))) return;
      mgDelete(md.dataset.mgDel);
      return;
    }

    // 项目管理页：暂停 / 继续 / 重置 / 部分存档
    const ma = ev.target.closest('[data-mg-act]');
    if (ma) { mgAct(ma.dataset.mgAct); return; }

    // 名单：加 / 移除（加的时候团队那栏必须是从建议里选过的）
    const aa = ev.target.closest('[data-acl-add]');
    if (aa) {
      const kind = aa.dataset.aclAdd;
      const inp = document.getElementById(aa.dataset.input);
      const typed = inp ? inp.value.trim() : '';
      const msg = document.querySelector(`[data-acl-msg="${kind}"]`);
      const say = (text) => { if (msg) { msg.textContent = text; msg.hidden = !text; } };
      if (!typed) { say(t('mg.acl.needName')); return; }
      if (kind === 'team' && !(inp && inp.dataset.pick)) { say(t('mg.acl.needPick')); return; }
      say('');
      mgAcl(kind, 'add', kind === 'team' ? inp.dataset.pick : typed);
      return;
    }
    const ad = ev.target.closest('[data-acl-del]');
    if (ad) {
      const kind = ad.dataset.aclDel;
      const value = kind === 'team' ? (ad.dataset.id || ad.dataset.name) : ad.dataset.name;
      if (!value) return;
      if (!window.confirm(t('mg.acl.delConfirm', { name: ad.dataset.name }))) return;
      mgAcl(kind, 'del', value);
      return;
    }

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
    if (tf) { Views.sessState.type = tf.dataset.t; Views.sessState.limit = 100; render(); return; }

    const th = ev.target.closest('#sp-theme [data-v]');
    if (th) { Theme.set(th.dataset.v); syncPrefs(); show(state.view, { silent: true }); return; }

    /* 导航里显不显示「排行榜」：外壳要重建（导航项是 shell 的一部分），保留滚动位置 */
    const sr = ev.target.closest('#sp-showranking [data-v]');
    if (sr) {
      const on = sr.dataset.v === 'on';
      Util.store.set('showRanking', on);
      state.showRanking = on;
      const host = document.getElementById('sp');
      const y = host ? host.scrollTop : 0;
      if (host) host.innerHTML = shell();
      render();
      if (host) host.scrollTop = y;
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

    const tr = ev.target.closest('#sp-translate [data-v]');
    if (tr) {
      const on = tr.dataset.v === 'on';
      Util.store.set('translateSite', on);
      state.translateSite = on;
      render();
      return;
    }

    /* 三态决定顶栏有没有那个入口 → **重建整壳**（同语言开关）：render() 不增删导航项 */
    const um = ev.target.closest('#sp-upmode [data-v]');
    if (um) {
      const v = um.dataset.v;
      if (v === state.uploadMode) return;
      Util.store.set('uploadMode', v);
      state.uploadMode = v;
      /* 换档会改变"哪些页接管、入口指向哪"，而这些判定在 boot 时就做完了 —— 老实重载一次 */
      location.reload();
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
    const mg = ev.target.closest('[data-mg]');
    if (mg) { mgSet(mg.dataset.mg, mg.checked ? mg.dataset.on : mg.dataset.off); return; }
  }

  /* ---- 项目设置 / 动作 / 名单：动作直发站点端点（无 CSRF 的 POST，回纯文本 OK / 原文原因） ----
     站点自己的 JS（admin.js:projectAction / showjob.js:doModify*、doAddACL*）成功后就是
     window.location.reload()：真相在服务端，我们不复制一份状态。这里照做，但先把结果说出来再重载。
     端点逐个核对过 showjob.js 与 ProjectController 的 Route 表。 */
  const MG_URL = {
    compute: (id, v) => `/project/${id}/computemethod/${v}/1`,
    mp4: (id, v) => `/project/${id}/mp4/${v}`,
    public: (id, v) => `/project/${id}/visibility/${v}`,
  };
  const MG_ACT_URL = {
    pause: (id) => `/project/${id}/pause`,
    resume: (id) => `/project/${id}/resume`,
    reset: (id) => `/project/${id}/reset`,
  };
  const MG_ACL_URL = {
    /* 团队发**数字 id**（站点那只隐藏域就是它），用户发 **login** —— 见 showjob.js 的 doAddACL* */
    manager: (id, op, name) => `/project/${id}/acl/manager/user/${op}/${encodeURIComponent(name)}`,
    renderer: (id, op, name) => `/project/${id}/acl/renderer/user/${op}/${encodeURIComponent(name)}`,
    team: (id, op, teamId) => `/project/${id}/acl/renderer/team/${op}/${encodeURIComponent(teamId)}`,
  };

  /** 成功后整页重载（站点自己的做法）；失败要把界面拨回服务端那个状态 */
  async function mgDone(url, okMsg) {
    toast(t('account.saving'));
    try {
      const r = await Api.post(url);
      if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); render(); return false; }
      toast(okMsg || t('account.ok'));
      setTimeout(() => location.reload(), 700);
      return true;
    } catch (e) {
      toast(t('account.failed', { msg: errText(e) }));
      render();
      return false;
    }
  }

  function mgSet(kind, value) {
    const id = state.projectId;
    if (!id || !MG_URL[kind]) return;
    if (kind === 'compute' && state.mg && state.mg.compute === value) return;   // 点的是当前那档
    mgDone(MG_URL[kind](id, value));
  }

  function mgAct(kind) {
    const id = state.projectId;
    if (!id) return;
    if (kind === 'partial') {
      /* 站点自己的确认文案（它那句话把后果说全了：会自动暂停、发邮件、恢复时存档销毁），照抄 */
      if (!window.confirm(t('mg.partialConfirm'))) return;
      const a = (state.mg.actions || []).find((x) => x.kind === 'partial');
      if (!a || !a.url) return;
      mgDone(a.url, t('mg.partialOk'));
      return;
    }
    if (!MG_ACT_URL[kind]) return;
    if (kind === 'reset' && !window.confirm(t('mg.resetConfirm'))) return;
    mgDone(MG_ACT_URL[kind](id));
  }

  async function mgAcl(kind, op, value) {
    const id = state.projectId;
    if (!id || !MG_ACL_URL[kind] || !value) return;
    await mgDone(MG_ACL_URL[kind](id, op, value));
  }

  async function mgDelete(id) {
    toast(t('account.saving'));
    try {
      const r = await Api.post(`/project/${id}/remove_no_redirect`);
      /* 站点把 'EMPTY'（一个都不剩了）当成功；它自己那套是跳 /user/profile，我们回项目列表 */
      if (!Api.isOk(r)) { toast(t('account.failed', { msg: r })); return; }
      location.href = '/home/projects';
    } catch (e) {
      toast(t('account.failed', { msg: errText(e) }));
    }
  }

  /* ---- 名单输入框的自动补全：站点的 jQuery UI autocomplete 替代品，走它同一个端点 ----------
     `/user/list_from_term` 回的是一串 **login**，但**不是 JSON 数组而是对象**（`{"0":"alice",…}`）
     —— 站点那边 `natcasesort()` 保留了键，`json_encode` 就把非连续数组编成对象了。所以两种形状都要认。
     `/team/list_from_term` 回 `[{value: 数字 id, label: 团队名}]`。团队加白名单要的是 id，
     所以那一栏必须从建议里选。 */
  const aclSeq = {};
  async function aclSearch(kind, term) {
    const path = kind === 'team' ? '/team/list_from_term' : '/user/list_from_term';
    /* 走带超时的 fetch：名单补全挂住时不会让输入框一直停在"旧建议"状态 */
    const res = await SP.Api.fetchWithTimeout(`${path}?term=${encodeURIComponent(term)}`, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    }, 10000);
    if (!res.ok) return [];
    let json = null;
    try { json = await res.json(); } catch (e) { return []; }
    const raw = Array.isArray(json) ? json
      : (json && typeof json === 'object' ? Object.keys(json).sort((a, b) => a - b).map((k) => json[k]) : []);
    return raw.map((o) => (typeof o === 'string'
      ? { value: o, label: o }
      : { value: String(o && o.value), label: String(o && o.label) }))
      .filter((x) => x.value && x.value !== '#');
  }

  function wireManage(body) {
    const box = body && body.querySelector('.aadd');
    if (!box) return;
    for (const wrap of body.querySelectorAll('.aadd .up1-dev')) {
      const inp = wrap.querySelector('input[data-acl-input]');
      const sug = wrap.querySelector('.up1-sug');
      if (!inp || !sug) continue;
      const kind = inp.dataset.aclInput;
      let timer = null;
      const close = () => { sug.hidden = true; sug.textContent = ''; };
      inp.addEventListener('input', () => {
        delete inp.dataset.pick;                        // 改了字就不再是"选过的那个"
        close();
        clearTimeout(timer);
        /* 每次输入都推进序号（包括删到 <3 个字符）：否则更早发出的请求晚到，会把过期建议弹回来 */
        const my = (aclSeq[kind] = (aclSeq[kind] || 0) + 1);
        const term = inp.value.trim();
        if (term.length < 3) return;
        timer = setTimeout(async () => {
          let list = [];
          try { list = await aclSearch(kind, term); } catch (e) { list = []; }
          if (my !== aclSeq[kind]) return;
          sug.textContent = '';
          if (!list.length) { close(); return; }
          list.slice(0, 12).forEach((o) => {
            const li = document.createElement('div');
            li.className = 'up1-sugitem';
            li.textContent = o.label;
            li.tabIndex = 0;
            li.setAttribute('role', 'option');
            const pickIt = () => {
              inp.value = o.label;
              inp.dataset.pick = o.value;
              close();
            };
            li.addEventListener('click', pickIt);
            li.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIt(); }
            });
            sug.appendChild(li);
          });
          sug.hidden = false;
        }, 250);
      });
      inp.addEventListener('blur', () => setTimeout(close, 180));
    }
  }

  let inputTimer = null;
  function onInput(ev) {
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
         不在主页上（会话页 / 项目管理页 / 上传页…）才回自己的主页。 */
      return onProfile ? location.pathname : `/user/${encodeURIComponent(me)}/profile`;
    }
    if (view === 'upload') return state.uploadMode === 'new' ? '/getstarted' : null;
    return null;
  }

  function go(view) {
    const want = pageFor(view);
    if (want && want !== location.pathname) {
      /* 主页那一族带上 hash（地址里能看出落在哪个视图）；账户设置 / 上传页**不带** ——
         那一页本身就是那个视图，`/user/<me>/edit#/account` 这种多余后缀只会让人以为有两层。 */
      const hash = /^\/user\/[^/]+\/profile$/.test(want) ? (ROUTES[view] || '') : '';
      location.assign(want + hash);
      return;
    }
    if (ROUTES[view]) history.replaceState(null, '', ROUTES[view]);
    show(view);
  }

  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#\/(\w+)$/);
    /* 按浏览器 Back 回到"没有 hash"时，hash 变空 —— 原来直接 return，画面停在旧视图、
       地址栏却已经变了。回到这一页本来的视图（boot 里的 pathView）。 */
    if (!m) {
      /* 分析等待页不能靠 show() 回来：它首屏一画就锁 dataset.spWired（防重画抹掉站点注入的表单），
         show('analyse') 会早退、把上一屏留在 #sp-body 里，视图/地址/轮询三者对不上。
         直接重载这一页最稳（token 重新走一遍）。 */
      if (pathView === 'analyse') { location.reload(); return; }
      if (pathView && state.view !== pathView) show(pathView);
      return;
    }
    if (m[1] === state.view) return;
    /* 同 boot：#/upload 只在「新版」档可达。off/raw 档手打它，不该把站点自己那页顶掉 ——
       留在当前视图，并把地址改回去，别让地址栏和界面对不上。 */
    if (m[1] === 'upload' && state.uploadMode !== 'new') {
      history.replaceState(null, '', ROUTES[state.view] || location.pathname);
      return;
    }
    show(m[1]);
  });

  // Esc 关 3 点菜单：键盘用户没有"点外面"这个动作
  window.addEventListener('keydown', (ev) => {
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

    const an = location.pathname.match(/^\/project\/add\/([^/]+)/);
    state.analyseToken = an ? decodeURIComponent(an[1]) : null;

    // 项目管理页的编号只从地址来（同会话页）
    const pj = location.pathname.match(/^\/project\/(\d+)/);
    state.projectId = pj ? pj[1] : null;

    if (location.hash && /^#\/(\w+)$/.test(location.hash)) {
      const v = location.hash.slice(2);
      /* #/upload 是应用内的上传页 —— 只属于「新版」档。off/raw 档那一页归站点自己，
         手打 hash 不该越档（2026-10-07 实报：raw 档下 #/upload 照样画新版上传页）。 */
      if (ROUTES[v] && (v !== 'upload' || state.uploadMode === 'new')) state.view = v;
    }

    /* 项目管理页：站点没给出项目那一块（项目不存在 / 无权查看 → 站点自己那张 Forbidden 页）
       就原样还回去，别接管成一屏空壳。数据虽然改为从**副本**解析，这道判据仍然要留着：
       它认的是"这一页到底是不是一个能管的项目页"，而不是"我们要不要搬它的节点"。 */
    if (state.view === 'project' && !document.getElementById('jobs_of_a_project')) { release(); return; }

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  SP.app = { state, show, render, go };
})();
