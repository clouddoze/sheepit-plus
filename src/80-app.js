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
    /* 项目管理页 /project/<数字>：站点把那一大块服务端渲染好了，我们**搬活节点**进来
       （见 wireManageDoc）——站点的 id 与内联 onclick 全不动，动作函数照旧可用。 */
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
    b.innerHTML = UI.icon('sheep') + `<span>${Util.esc(classic ? t('mode.classicHint') : t('mode.enter'))}</span>`;
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
    if (!SP.DomI18n) return;

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
    /* 上传项目三态：off 关 / raw 原版（站点自己那页）/ new 新版（源码重写）—— 见 viewForPath 上方 */
    uploadMode: 'new',
    uiScale: 1,            // 界面整体缩放
  };

  const ROUTES = { overview: '#/overview', projects: '#/projects', upload: '#/upload', ranking: '#/ranking', settings: '#/settings', account: '#/account' };

  function syncPrefs() {
    state.themePref = Theme.init();
    state.langPref = Util.store.get('lang', 'auto');
    state.translateSite = Util.store.get('translateSite', true) !== false;
    state.uploadMode = uploadMode();
    const z = Number(Util.store.get('scale', 1));
    state.uiScale = Number.isFinite(z) && z >= 0.5 && z <= 2 ? z : 1;
    I18n.init();
  }

  function applyTheme() {
    const host = document.getElementById('sp');
    if (!host) return;
    host.setAttribute('data-theme', Theme.effective(state.themePref));
    // 缩放用 CSS zoom 而非 transform:scale；rect 量出物理像素，写 left/top 要除以 zoom（Util.zoomOf）。
    host.style.zoom = state.uiScale === 1 ? '' : String(state.uiScale);
    // 图表（SVG var()）也要这份颜色方案
    host.style.colorScheme = Theme.effective(state.themePref);
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
    /* 上传入口：「新版」档走**应用内** #/upload；「原版」档点一下＝新标签页打开站点自己那页
       （见 onClick）；三态里只有「关闭」不出这个入口 */
    if (state.uploadMode !== 'off') nav.push(['upload', t('nav.upload'), t('nav.upload')]);
    nav.push(['ranking', t('nav.ranking'), t('nav.rankingShort')],
      ['account', t('nav.account'), t('nav.accountShort')],
      ['settings', t('nav.settings'), '']);
    /* 第二步（/project/add/<token>）是上传链路的一环，顶栏不该在这里丢掉位置标记 */
    const navHere = state.view === 'analyse' ? 'upload' : state.view;
    const item = ([k, label, short]) =>
      `<button data-nav="${k}" ${navHere === k ? 'aria-current="page"' : ''}>`
      + `<span class="navfull">${Util.esc(label)}</span><span class="navshort">${Util.esc(short || label)}</span></button>`;
    return `<div class="wrap">
      <div class="top">
        <a class="brand" href="#/overview">${UI.icon('sheep', 'sheep')}SheepIt <em>PLUS</em></a>
        <nav>${nav.map(item).join('')}</nav>
        <span class="spacer"></span>
        <span class="metaline num" id="sp-updated"></span>
        <button class="modebtn" data-act="mode-classic" title="${Util.esc(t('mode.toClassic'))}">${UI.icon('sheep')}<span class="txt">${Util.esc(t('mode.toClassic'))}</span></button>
        <button class="iconbtn" data-act="refresh" title="${Util.esc(t('top.refresh'))}" aria-label="${Util.esc(t('top.refresh'))}">${UI.icon('refresh')}</button>
        ${u ? `<span class="who">${UI.avatar(SP.state && SP.state.avatar, u, 'ini')}<b class="uname">${Util.esc(u)}</b></span>` : ''}
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
    else if (state.view === 'project') {
      /* 设置状态**这一载只读一次**：站点那一页是服务端渲染的真相，而读完之后 wireManageDoc 会把
         站点那份重复控件藏掉、整只「操作」页签去掉 —— 再读就读不到了（实测：第二次 render 把
         hasCompute/mp4 读成 false，自绘区跟着塌掉两行）。写操作成功后整页重载，所以不存在
         "页面生命周期内站点状态变了而我们不知道"的情况。 */
      if (!state.mg) state.mg = Api.parseManage(document);
      html = Views.project(state);
    }
    else if (state.view === 'account') html = state.account ? Views.account(state) : UI.state.empty();
    else if (state.view === 'session') html = state.session ? Views.session(state) : UI.state.empty();
    else if (state.view === 'overview') html = state.profile ? Views.overview(state) : UI.state.empty();
    else if (state.view === 'projects') html = state.projects ? Views.projects(state) : UI.state.empty();
    else if (state.view === 'ranking') html = state.ranking ? Views.ranking(state) : UI.state.empty();
    else html = UI.state.empty();

    /* 重画前必须清掉"已接线"标记：#sp-body 常驻，标记活过整个会话 → 守卫误判早退（实测） */
    delete body.dataset.spWired;
    /* 搬/借来的活节点先送回原位，别被下面这行连同旧 host 扔掉 */
    parkManage();   // 管理页那一整块（站点的活节点）
    parkAnalyse();  // 分析页站点那份结果容器（我们把它摘下来了）
    body.innerHTML = html;
    // 错误态不锁，重试要能重画
    if (state.view === 'analyse' && !state.error) host.dataset.spWired = '1';
    host.classList.toggle('sp-anim', animOnce);
    animOnce = false;
    Views.mount(body, state);      // 面积图要按实测像素渲染
    if (state.view === 'project') wireManageDoc(body);
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
    if (r.kind === 'done') { paintAnalyse({ html: r.html }); return; }
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

  /* ---- 3.6 项目管理页 /project/<数字>：把站点那一大块**搬**进我们的壳 ----------------
     站点把这一页服务端渲染好了（#jobs_of_a_project + 右侧图例/页签），动作全是内联 onclick
     调它的全局函数（projectAction / doModifyComputeMethod / doModifyAttributeFromCheckbox /
     doAddACLUserProjectManage）。所以搬**活节点**、不重新 fetch、不重建结构：id 与 onclick 原样
     保留，站点脚本照旧能找到它们；我们只加外观与翻译。 */
  let mgNode = null;    // 站点那一整块 .w-section
  let mgAnchor = null;  // 它在原页里的锚（注释节点）：render() 前先把它送回去

  /** render() 会重写 #sp-body.innerHTML：搬过来的活节点必须先送回原处，否则会被一起扔掉 */
  function parkManage() {
    if (mgNode && mgAnchor && mgNode.parentNode !== mgAnchor.parentNode) {
      mgAnchor.parentNode.insertBefore(mgNode, mgAnchor.nextSibling);
    }
  }

  /* 设置区自绘之后，站点那一份「计算方式 / MP4」就是重复的：先把这两块藏掉（用 style，不用
     [hidden] —— #sp 里已有 display:flex 之类的规则压过 [hidden]，这个坑踩过一次）。
     藏完页签里若只剩管理员工具（block / reset vram / 重生成 token 那些），普通用户看着是空页签，
     就把整只「操作」页签连头一起去掉，并把第一个剩下的页签设为当前 —— 内容区不能没有 active 面板。
     这一段要能重复跑（每次 render 都会回搬再搬进来），判据都写成"找不到就跳过"。 */
  function hideSiteOps() {
    if (!mgNode || !state.mg) return;
    const acts = mgNode.querySelector('#tab_actions');
    if (!acts) return;

    const h4 = [...acts.querySelectorAll('h4')].find((h) => /compute method/i.test(h.textContent || ''));
    if (h4) {
      h4.style.display = 'none';
      const box = h4.nextElementSibling;                   // 紧跟的那只 div 装的是两只 radio
      if (box) box.style.display = 'none';
    }
    /* 藏 MP4 那块要藏**直接子元素**那一层：checkbox 自己埋在 label/form/div 里面，
       藏它只藏掉控件，外层 div 还留着 "Generate MP4 video" 这段文字（实测：于是页签判不出空）。 */
    const mp4 = acts.querySelector('#project_generate_mp4_checkbox_1');
    if (mp4) {
      let wrap = mp4;
      while (wrap && wrap.parentElement && wrap.parentElement !== acts) wrap = wrap.parentElement;
      if (wrap) wrap.style.display = 'none';
    }

    /* 站点那一行图标按钮里的「删除」和自绘的删除是同一个端点（admin.js 的 remove_no_redirect）：
       留一个就够。暂停/继续/部分存档仍归站点那一行，不动。 */
    const rm = mgNode.querySelector('[id$="_div_actions"] [onclick*="remove_no_redirect"]');
    if (rm) rm.style.display = 'none';

    const shown = [...acts.children].some((c) => c.style.display !== 'none' && (c.textContent || '').trim());
    if (shown) return;

    const li = [...mgNode.querySelectorAll('.nav-tabs a')].find((a) => a.getAttribute('href') === '#tab_actions');
    if (li && li.closest('li')) li.closest('li').remove();
    acts.remove();
    const first = mgNode.querySelector('.tab-pane');
    if (first) {
      first.classList.add('active');
      const a = [...mgNode.querySelectorAll('.nav-tabs a')].find((x) => x.getAttribute('href') === `#${first.id}`);
      if (a && a.closest('li')) a.closest('li').classList.add('active');
    }
  }

  function wireManageDoc(body) {
    const host = body && body.querySelector('#sp-mg-host');
    if (!host) return;
    if (!mgNode) {
      const sec = document.getElementById('jobs_of_a_project');
      if (!sec) return;                  // 站点没这一块（boot 里已经 release，正常到不了这）
      mgNode = sec.closest('.w-section') || sec;
      mgAnchor = document.createComment('sp-manage');
      mgNode.parentNode.insertBefore(mgAnchor, mgNode);
    }
    host.appendChild(mgNode);            // 搬进来；id / 内联 onclick / 表单全不动
    mgNode.classList.add('sp-manage-sec');
    hideSiteOps();
    /* 站点这块是英文的：翻译器默认跳过 #sp，这里显式放行（同 analyse 的站点表单那条通道） */
    if (SP.DomI18n) {
      SP.DomI18n.enabled = state.translateSite !== false;
      if (SP.DomI18n.translateSubtree) SP.DomI18n.translateSubtree(mgNode);
    }
    /* 站点这几个动作按钮只有 FA4 的图标类名，而站点装的是 Font Awesome 6 —— ::before 没内容，
       屏幕上就是三个空心圆。title 是唯一的文字来源，直接拿来当按钮文字（图标由 CSS 藏掉）。
       注意 title 有两种：一种本身就是动作名（"删除项目"，上面已被 translateSubtree 翻过）；
       另一种是站点塞进去的**状态 HTML**（"<strong>Generating archive.</strong><br>Current position: 1st…"）
       —— 后者要去标签、只取第一行当按钮文字，整段净化后逐行翻译再放回 title 当悬停提示。
       这一段要能重复跑（render() 会重入、搬回来的活节点还带着上次那个 span）：判据是
       「title 里还有 HTML」而不是「有没有 span」，这样第二次跑是空操作、旧 span 也会被纠正。 */
    const cutLines = s => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
      .split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const zhText = s => (I18n && I18n.siteText ? (I18n.siteText(s) || s) : s);
    for (const a of mgNode.querySelectorAll('[id$="_div_actions"] .btn')) {
      const raw = (a.getAttribute('title') || '').trim();
      const span = a.querySelector('.sp-mg-act');
      let label = null;
      if (raw.indexOf('<') >= 0) {
        const lines = cutLines(raw);
        label = zhText(lines[0] || '');
        if (lines.length) a.setAttribute('title', lines.map(zhText).join('\n'));
      } else if (!span) {
        label = raw;
      }
      if (!label) continue;
      if (span) { span.textContent = label; continue; }
      const el = document.createElement('span');
      el.className = 'sp-mg-act';
      el.textContent = label;
      a.appendChild(el);
    }
    /* 帧缩略图：站点把 <img> 塞在 title 属性里（给它自己的 tooltip 用），方块本身没有背景，
       于是每帧都是一个空白小方块。把 src 抠出来当真正的图放进方块里。 */
    for (const sq of mgNode.querySelectorAll('.tiles .square')) {
      if (sq.querySelector('img')) continue;
      const m = /<img\s+src="([^"]+)"/i.exec(sq.getAttribute('title') || '');
      if (!m) continue;
      const img = document.createElement('img');
      img.setAttribute('src', m[1]);
      img.setAttribute('alt', '');
      sq.appendChild(img);
    }
  }

  /* ---- 4. 数据编排 ---- */

  async function ensureData(view) {
    if (view === 'settings') return;

    if (view === 'account') {
      if (!state.userName) throw new Error(t('account.only'));
      state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`));
      return;
    }

    if (view === 'upload') {
      // /getstarted 就是数据源（由 64-step1.js 解析成自绘界面）：站点没给单独接口
      if (!state.uploadHtml) state.uploadHtml = await Api.fetchPage('/getstarted');
      return;
    }

    if (view === 'analyse') {
      if (!state.analyseToken) throw new Error(t('an.noToken'));
      startAnalysePoll();
      return;
    }

    if (view === 'session') {
      if (!state.sessionId) throw new Error(t('sess.noId'));
      if (!state.session) {
        state.session = Api.parseSession(await Api.fetchPage(`/session/${state.sessionId}`), state.sessionId);
        if (!state.session) throw new Error(t('sess.parseFailed'));
      }
      // 时间线是站点 AJAX JSON：拿不到只让那一块说"没取到"
      if (state.session.timeline === undefined) {
        try { state.session.timeline = Api.parseTimeline(await Api.fetchJson(state.session.timelineUrl)); }
        catch (e) { state.session.timeline = []; state.session.timelineFailed = true; }
      }
      if (!state.projects) {
        try { state.projects = Api.parseProjects(await Api.fetchPage('/home/projects')); }
        catch (e) { state.projects = null; }
      }
      if (!state.account && state.userName) {
        try { state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`)); }
        catch (e) { state.account = null; }
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
        try { state.home = Api.parseHome(await Api.fetchPage('/home')); } catch (e) { state.home = { stats: [], news: [] }; }
      }
      if (!state.projects) {
        try { state.projects = Api.parseProjects(await Api.fetchPage('/home/projects')); } catch (e) { /* 保持 null */ }
      }
    }

    if (view === 'projects' && !state.projects) {
      state.projects = Api.parseProjects(await Api.fetchPage('/home/projects'));
    }

    if (view === 'projects' && !state.account && state.userName) {
      try { state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`)); }
      catch (e) { state.account = null; }
    }

    // 顶部全站实时来自首页：直接落到这页也得取一次
    if (view === 'projects' && !state.home) {
      try { state.home = Api.parseHome(await Api.fetchPage('/home')); } catch (e) { state.home = { stats: [], news: [] }; }
    }

    /* 「我发布的」那档吃的是个人主页那张表（Api.parseMyProjects）。看自己的总览时它已经在
       state.profile 里了，不用再取；只有"在别人主页上点进项目页"才会多这一趟（有 60 秒缓存）。 */
    if (view === 'projects' && Views.projState.scope === 'mine' && !state.myProjects) {
      const own = state.userName && state.profileName === state.userName && state.profile
        ? state.profile
        : (state.userName
          ? Api.parseProfile(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/profile`), state.userName)
          : null);
      state.myProjects = (own && own.myProjects) || [];
    }

    if (view === 'ranking' && !state.ranking) {
      state.ranking = Api.parseRanking(await Api.fetchPage('/ranking/user'));
    }
  }

  async function show(view, opts) {
    const viewChanged = state.view !== view;
    state.view = view;
    state.error = null;

    if (!opts || !opts.silent) {
      const need = (view === 'overview' && !state.profile)
        || (view === 'projects' && !state.projects)
        || (view === 'projects' && Views.projState.scope === 'mine' && !state.myProjects)
        || (view === 'ranking' && !state.ranking)
        || (view === 'upload' && !state.uploadHtml)
        /* 账户页原来漏了这一条：首次进入或点刷新时 state.account 还是 null，会先闪一下「暂无数据」。 */
        || (view === 'account' && !state.account)
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

  /** 写操作统一收口：回 'OK' 就重取重画，否则原样转述错误 */
  async function submit(fn, okMsg) {
    toast(t('account.saving'));
    try {
      const r = await fn();
      if (r && r !== 'OK') { toast(t('account.failed', { msg: r })); return false; }
      Api.invalidate();
      state.account = null;
      state.session = null;
      /* 重取期间必须留下"在加载"的表示：数据已经置空，而 show({silent}) 不设 loading，这段窗口里
         任何一次 render() 都会把整页画成「暂无数据」（实测：移出渲染优先后菜单还开着，随手点一下
         菜单外面就中）。这里**不**立刻 render()：正常路径旧内容留到重取完，只有真发生 stray render
         才显示骨架。 */
      state.loading = true;
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
    // 3 点菜单是浮层：点别处先关掉；不 return，该干的事继续干
    if (Views.projState.menu && !ev.target.closest('.omenu') && !ev.target.closest('[data-act="owner-menu"]')) {
      Views.projState.menu = null;
      render();
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

      if (kind === 'mode-classic') {
        Util.store.set('uiMode', 'classic');
        location.reload();
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
        /* 与 owner-gift / owner-block 一致：动作发出后菜单要收起来。原来只有这两处收，
           prio-set 的菜单会一直敞着，用户随手一点就是一次 render()。 */
        Views.projState.menu = null;
        submit(() => Api.post(url));
        return;
      }
      return;
    }

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

    // 「我发布的」那张表的表头（列少，跟全站那张分开记排序状态）
    const msort = ev.target.closest('th[data-msort]');
    if (msort) {
      const k = msort.dataset.msort;
      if (Views.projState.msort === k) Views.projState.dir = Views.projState.dir === 'asc' ? 'desc' : 'asc';
      else { Views.projState.msort = k; Views.projState.dir = 'desc'; }
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

    /* 范围切换：换的是数据源（全站列表 ↔ 个人主页那张表），第一次进「我发布的」要取一次数 */
    const sScope = ev.target.closest('#sp-scope [data-s]');
    if (sScope) {
      const v = sScope.dataset.s;
      if (Views.projState.scope === v) return;
      Views.projState.scope = v === 'mine' ? 'mine' : 'all';
      Views.projState.filter = 'all';
      Views.projState.limit = 120;
      Views.projState.menu = null;
      if (Views.projState.scope === 'mine' && !state.myProjects) show('projects', { silent: true });
      else render();
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

    // 缩放只改 #sp 自己（applyTheme 写 zoom）
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
    if (sc) { submit(() => Api.post(`/user/update/scheduler/${sc.dataset.sched}/${sc.checked ? '1' : '0'}`)); return; }
    const mg = ev.target.closest('[data-mg]');
    if (mg) { mgSet(mg.dataset.mg, mg.checked ? mg.dataset.on : mg.dataset.off); return; }
  }

  /* ---- 项目设置：动作直发站点端点（无 CSRF 的 POST，回纯文本 OK / 原文原因） --------------
     站点自己的 JS（admin.js:projectAction / showjob.js:doModify*）成功后就是 window.location.reload()：
     真相在服务端渲染的 DOM 里，我们不复制一份状态。这里照做，但先把结果说出来再重载。
     端点在 showjob.js 里逐个核对过：/project/<id>/computemethod/<cpu|gpu>/<0|1>、
     /mp4/<0|1>、/visibility/<0|1>、/remove_no_redirect。 */
  const MG_URL = {
    compute: (id, v) => `/project/${id}/computemethod/${v}/1`,
    mp4: (id, v) => `/project/${id}/mp4/${v}`,
    public: (id, v) => `/project/${id}/visibility/${v}`,
  };

  async function mgSet(kind, value) {
    const id = state.projectId;
    if (!id || !MG_URL[kind]) return;
    if (kind === 'compute' && state.mg && state.mg.compute === value) return;   // 点的是当前那档
    toast(t('account.saving'));
    try {
      const r = await Api.post(MG_URL[kind](id, value));
      if (r && r !== 'OK') { toast(t('account.failed', { msg: r })); render(); return; }
      toast(t('account.ok'));
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      toast(t('account.failed', { msg: (e && e.message) || String(e) }));
      render();   // 失败要把开关拨回站点说的那个状态（模型是现读的）
    }
  }

  async function mgDelete(id) {
    toast(t('account.saving'));
    try {
      const r = await Api.post(`/project/${id}/remove_no_redirect`);
      /* 站点把 'EMPTY'（一个都不剩了）当成功；它自己那套是跳 /user/profile，我们回项目列表 */
      if (r && r !== 'OK' && r !== 'EMPTY') { toast(t('account.failed', { msg: r })); return; }
      location.href = '/home/projects';
    } catch (e) {
      toast(t('account.failed', { msg: (e && e.message) || String(e) }));
    }
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

  // Esc 关 3 点菜单：键盘用户没有"点外面"这个动作
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && Views.projState.menu) { Views.projState.menu = null; render(); }
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
      if (ROUTES[v]) state.view = v;
    }

    /* 项目管理页：站点没给出项目那一块（项目不存在 / 不是自己的 / 站点改了布局）就原样还回去，
       别接管成一屏空壳。 */
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
