/* ==== 20-api.js：抓取 + 解析器（页面 → 结构化数据） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, parse, text } = { Util: SP.Util, parse: SP.Util.parse, text: SP.Util.text };
  const inflight = {};

  /* 站点把「未登录」做成 302 → /user/signin（**不是** 401），而 fetch 会跟随跳转拿到 200 的登录页。
     只看 res.ok 会把过期登录当成功：写操作假保存、读操作静默空数据。所以认最终 URL。 */
  function redirectedToSignin(res) {
    if (!res || !res.redirected || !res.url) return false;
    try {
      /* 只看路径，别在整串 URL 上匹配：`/home?next=/user/signin` 这类查询参数会误伤。 */
      const p = new URL(res.url, location.href).pathname.replace(/\/+$/, '');
      return p === '/user/signin' || p.startsWith('/user/signin/');
    } catch (e) { return false; }
  }
  function signedOutError(path) {
    const e = new Error(`${path} → signin`);
    e.code = 'SIGNED_OUT';
    return e;
  }

  /** 解析器既吃 fetch 回来的 HTML 字符串，也吃当前页的活 document（省一次整页抓取）。 */
  const asDoc = (src) => (typeof src === 'string' ? parse(src) : src);

  /** 活 document 里的「原文」：站点内联 <script> 文本拼接。
      排除脚本自己那一个 —— grant:none 的管理器可能把产物作为内联 <script> 塞进文档，
      里面的注释/字符串会污染 `url: '/session/…/timeline'`、`var data` 这类锚点。 */
  function scriptsSource(doc) {
    return [...doc.scripts]
      .filter((s) => !String(s.textContent || '').includes('__SHEEPIT_PLUS__'))
      .map((s) => s.textContent || '')
      .join('\n');
  }

  /* 活 document 只允许**每页消费一次**：首屏省掉重抓；之后（写操作 submit、刷新按钮、
     暂停/恢复）必须回服务器拿新 DOM —— 否则会把写之前的旧 DOM 再解析一遍，
     界面看起来"回弹"，还会 toast「已保存」。invalidate 不需要重置它：invalidate 的语义
     就是"下一次必须走网络"。整页 reload 会重置模块状态，标志自然失效。 */
  let liveDocUsed = '';
  function currentDoc(path) {
    const norm = (p) => String(p || '').replace(/\/+$/, '') || '/';
    if (norm(location.pathname) !== norm(path)) return null;
    if (liveDocUsed === norm(path)) return null;
    liveDocUsed = norm(path);
    return document;
  }

  /* 站点写操作的「成功」不止 'OK'（上游 UserController.php）：调度开关回 `Settings changed`、
     邮箱回一整句 "An email have been sent…"、密码回 `Password successfully changed`。
     只认 OK 会把成功误报成失败，而且 submit 不重取 → 开关状态回弹。 */
  const OK_RE = /^(?:ok|empty|settings changed|notification level changed|password successfully changed|an email have been sent\b[^\n]*)$/i;
  function isOk(r) { return !r || OK_RE.test(String(r).trim()); }

  /** 同源抓取（带凭据）+ 缓存 + 并发去重 */
  const cache = new Map();

  /* 请求超时：站点偶发不回包时，没有 abort 就是"骨架永久 + inflight 去重一直复用同一个
     永不 settle 的 Promise"，刷新页面才能救。15s 够慢网；超时按失败走错误态/降级。 */
  const FETCH_TIMEOUT = 15000;
  async function fetchWithTimeout(path, opts, ms = FETCH_TIMEOUT) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      return await fetch(path, { ...opts, signal: c.signal });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        const err = new Error(`${path} → 超时（${Math.round(ms / 1000)}s）`);
        err.code = 'TIMEOUT';
        throw err;
      }
      throw e;
    } finally { clearTimeout(t); }
  }

  async function fetchPage(path, { ttl = 60000, force = false } = {}) {
    const now = Date.now();
    const hit = cache.get(path);
    if (!force && hit && now - hit.at < ttl) return hit.html;
    return Util.once(inflight, path, async () => {
      const res = await fetchWithTimeout(path, { credentials: 'include', headers: { 'X-Requested-With': 'fetch' } });
      if (redirectedToSignin(res)) throw signedOutError(path);
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
      const html = await res.text();
      cache.set(path, { at: Date.now(), html });
      return html;
    });
  }
  function invalidate() { cache.clear(); }

  /** 会话时间线不在 HTML 里，走站点自己的 AJAX 端点；失败抛错，调用方降级 */
  async function fetchJson(path) {
    const res = await fetchWithTimeout(path, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' },
    });
    if (redirectedToSignin(res)) throw signedOutError(path);
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.json();
  }

  /** 写操作：POST 到原站按钮同一地址，站点回什么就原样转述 */
  async function post(path, data, formData) {
    const opts = { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'fetch' } };
    if (formData) {
      opts.body = formData;
    } else {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.body = new URLSearchParams(data || {}).toString();
    }
    const res = await fetchWithTimeout(path, opts);
    /* 登录过期时站点把动作也 302 到登录页：跟随之后是 200 + 整页 HTML，
       下面「>400 字节按成功算」会把它当成功。先认这条。 */
    if (redirectedToSignin(res)) throw signedOutError(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = (await res.text()).trim();
    return txt.length > 400 ? 'OK' : txt;   // 头像接口回的是整页 HTML，按成功算
  }


  function extractArray(html, anchors, keyed) {
    const list = Array.isArray(anchors) ? anchors : [anchors];
    for (const name of list) {
      const vi = html.indexOf(`var ${name}`);
      if (vi < 0) continue;
      const s = html.indexOf('[', vi);
      const e = html.indexOf('];', s);
      if (s < 0 || e < 0) continue;
      let body = html.slice(s, e + 1).replace(/,\s*\]$/, ']');   // 去尾逗号
      if (keyed) body = body.replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":'); // 键加引号
      try { return JSON.parse(body.replace(/'/g, '"')); } catch (err) { /* 落到下一个锚点 */ }
    }
    return null;
  }

  /** 站点把图表数据写在单个内联 <script> 里。活 document 下不能按「热力图 div 的 id」定位：
      那个 id 不在 script 文本里，锚点会落到插件初始化之后、把数据数组整段切掉。
      所以按内容认 —— 同脚本里含 `date:` 的 `var data`，且带 CalendarHeatmap / heatmap id。 */
  function heatmapData(doc) {
    for (const s of doc.scripts) {
      const t = s.textContent || '';
      if (t.includes('__SHEEPIT_PLUS__')) continue;   // 别扫到我们自己的脚本
      if (!/var\s+data\s*=/.test(t) || !/date\s*:/.test(t)) continue;
      /* 同脚本还得是热力图那一份：站点以后再加别的含 date: 的图表数组时，
         只靠 "var data + date:" 会先到先得拿错。 */
      if (!/CalendarHeatmap|consecutive-render-heatmap/i.test(t)) continue;
      const raw = extractArray(t, ['data'], true);
      if (Array.isArray(raw)) return raw;
    }
    return null;
  }

  function smallestBoxByTitle(doc, re) {
    return [...doc.querySelectorAll('div')]
      .filter((d) => { const h = d.querySelector('h1,h2,h3,h4,h5'); return h && re.test(h.textContent); })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
  }

  const SITE_LABEL_KEYS = [
    [/frames?\s*remaining/i, 'site.frames'],
    [/active\s*projects?/i, 'site.projects'],
    [/connected\s*clients?/i, 'site.clients'],
    [/processing\s*frames?/i, 'site.processing'],
  ];

  function parseStatBoxes(doc) {
    const out = [];
    for (const box of doc.querySelectorAll('.w-box.stat-box, .stat-box')) {
      const h2 = box.querySelector('h2');
      if (!h2) continue;
      const value = text(h2);

      const content = box.querySelector('.content') || box;
      const clone = content.cloneNode(true);
      clone.querySelectorAll('h2,h1,h3,.sparkline').forEach((n) => n.remove());
      const label = clone.textContent.replace(/\s+/g, ' ').trim();

      const spark = (box.querySelector('.sparkline')?.textContent || '')
        .split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
      const href = Util.safePath(box.closest('a')?.getAttribute('href'));
      const hit = SITE_LABEL_KEYS.find(([re]) => re.test(label));

      out.push({ label, key: hit ? hit[1] : null, value, spark, href });
      if (out.length >= 6) break;
    }
    return out;
  }

  /* ------------------------------------------------------------ 解析器 */
  /** 已连接的机器：每行一个 /session/<id> 链接，文字形状 "(客户端名) CPU 型号 @ 频率 x核数" */
  function parseMachines(doc) {
    const box = smallestBoxByTitle(doc, /connected machine/i);
    if (!box) return { count: 0, list: [] };
    const head = text(box.querySelector('h1,h2,h3,h4,h5'));
    const n = Number((head.match(/(\d+)/) || [])[0]);
    const list = [];
    for (const a of box.querySelectorAll('a[href*="/session/"]')) {
      const raw = text(a);
      if (!raw) continue;
      const m = raw.match(/^\(([^)]+)\)\s*(.*)$/);
      list.push({
        url: Util.safePath(a.getAttribute('href')),
        client: m ? m[1] : '',
        spec: (m ? m[2] : raw).trim(),
      });
    }
    return { count: Number.isFinite(n) && n > 0 ? n : list.length, list };
  }

  /* 这一页的英文标签 → 内部键。**对不上的行不丢**：照样进 facts、只是 key 为 null ——
     站点哪天加新数据，界面原样显示，而不是默默吞掉。 */
  const SESSION_LABELS = [
    [/^owner$/i, 'owner'],
    [/^hostname$/i, 'hostname'],
    [/^os$/i, 'os'],
    [/^render\s*key$/i, 'renderKey'],
    [/^cpu$/i, 'cpu'],
    [/^gpu$/i, 'gpu'],
    [/^vram$/i, 'vram'],
    [/^driver$/i, 'driver'],
    [/^compute\s*device$/i, 'computeDevice'],
    [/^ram\s*allowed$/i, 'ramAllowed'],
    [/^ram\s*available$/i, 'ramAvailable'],
    [/^max\s*render\s*time\s*per\s*frame$/i, 'maxTime'],
    [/^power\s*cpu$/i, 'power'],
    [/^power\s*gpu$/i, 'powerGpu'],
    [/^scheduler$/i, 'scheduler'],
    [/^creation\s*time$/i, 'createdAt'],
    [/^rendered\s*frames$/i, 'frames'],
    [/^points\s*earned$/i, 'points'],
    [/^last\s*request$/i, 'lastRequest'],
    [/^last\s*request\s*job$/i, 'lastRequestJob'],
    [/^last\s*validated\s*job$/i, 'lastValidatedJob'],
    [/^version$/i, 'version'],
    [/^user\s*agent$/i, 'ua'],
    [/^status$/i, 'status'],
    [/^action$/i, 'action'],
    // 此刻在跑哪一帧（空闲时不印）；它是活的，提到身份条上而不留在静态原值表里
    [/^current\s*frames$/i, 'currentFrames'],
  ];

  function tableAfter(heading) {
    if (!heading) return null;
    for (let n = heading.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-6]$/.test(n.tagName)) return null;
      if (n.tagName === 'TABLE') return n;
      if (n.tagName !== 'SCRIPT' && n.querySelector && n.querySelector('table')) return n.querySelector('table');
    }
    return null;
  }

  const headingByText = (doc, re) => [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].find((h) => re.test(text(h)));

  /** 会话页 → 机器档案。Session information 按 <th> 标签逐行读、不认位置；站点的颜色无语义。
   *  没有 th 的状态行是 **server side** / **client side** 两种暂停，不是一回事 —— 而且**两个可以同时有**
   *  （站点是两条独立的 {% if %}，各写一行），所以这里把两行都收下来（见下面 info.note 的拼接），
   *  由 40-ui.js 的 pauseKeys() 判成 0/1/2 个状态。 */
  function parseSession(html, id) {
    const doc = asDoc(html);
    const facts = [];
    const info = {};

    const table = tableAfter(headingByText(doc, /^session\s*information$/i));
    if (table) {
      for (const tr of table.querySelectorAll('tr')) {
        /* 只认这张表**自己的**行。站点把 `Current frames` 画成「td 里再嵌一张表」
           （running.html.twig:381-400），那种内层 tr 没有 th，会被下面"没有 th = 状态行"的判据
           误吃成 note —— 机器明明在渲染，界面上却把 `project: … frame: …` 当成一种状态
           （会话页的状态 chip 与在线机器那一格都会显示这段作业文本）。 */
        if (tr.closest('table') !== table) continue;
        const th = tr.querySelector('th');
        const tds = [...tr.querySelectorAll('td')];
        if (!tds.length) continue;
        const label = th ? text(th) : '';
        if (!label) {
          /* **server side** 与 **client side** 是两种暂停。早先是 `if (!label) continue`，整行丢掉后
             两种暂停界面上长得一样，且 Status 那格都写 Enable，本地暂停被误报成「运行中」。它是状态
             而非机器规格，故收进 info；认不出的值照样留着（不吞数据）。
             ⚠ 这一行**没有 `<th>`**，而且是「空 td + 有字 td」两格（2026-10-07 真机原文：
             `<tr><td style="…"></td><td><span style="color:red">Paused client side</span></td></tr>`）。
             所以判据不能要求 th 存在、也不能只看第一个 td —— 这里取所有 td 里非空的那些。 */
          const note = tds.map(text).filter(Boolean).join(' ');
          if (note) {
            /* 两种暂停在站点那边是**两行**（running.html.twig:296-314：session.paused() 客户端侧、
               session.running()==false 服务端侧，两个条件独立 → 可以同时成立），所以这里会连着进两次。
               早先是直接赋值，后一行把前一行顶掉 —— 两端都暂停时"客户端侧"那条就凭空消失了。
               这张表里没有 `<th>` 的行**只有这两行暂停**（逐行核对过 twig），所以拼接是安全的。 */
            const prev = info.note ? info.note.value : '';
            info.note = { value: prev ? `${prev} · ${note}` : note, key: 'note', href: '' };
          }
          continue;
        }
        const td = tds[0];
        const hit = SESSION_LABELS.find(([re]) => re.test(label));
        const key = hit ? hit[1] : null;
        const a = td.querySelector('a[href]');
        const fact = { label, key, value: text(td), href: Util.safePath(a && a.getAttribute('href')) };

        if (key === 'renderKey') {
          const btn = td.querySelector('[onclick]');
          const m = btn ? String(btn.getAttribute('onclick')).match(/html\(\s*'([^']+)'\s*\)/) : null;
          fact.secret = m ? m[1] : (/^[A-Za-z0-9_-]{16,}$/.test(fact.value) ? fact.value : '');
          if (fact.secret) fact.value = '';
        }
        if (key === 'status') {
          fact.on = /enable|enabled|running|active/i.test(fact.value);
          fact.off = /disab|pause|stop|off/i.test(fact.value);
        }
        if (key === 'action') {
          // 动作地址写在 onclick 里，**读不到就不给按钮**（状态不明的地方不给动作）
          const btn = td.querySelector('input[type=button],input[type=submit],button');
          const m = btn ? String(btn.getAttribute('onclick') || '').match(/'([^']+)'/) : null;
          fact.value = btn ? String(btn.getAttribute('value') || text(btn)) : fact.value;
          fact.action = m ? Util.safePath(m[1]) : null;
          const st = fact.action && fact.action.match(/\/running\/(\d+)/);
          fact.target = st ? st[1] : null;
        }
        if (key === 'owner' && fact.href) {
          const m = fact.href.match(/\/user\/([^/]+)\//);
          fact.user = m ? decodeURIComponent(m[1]) : fact.value;
        }
        facts.push(fact);
        if (key && info[key] === undefined) info[key] = fact;
      }
    }

    /* 时间线地址写在站点内联 JS 里（`url: '/session/…/timeline'`）。传进来的是活 document 时，
       把站点各 <script> 的文本拼起来搜 —— 站点脚本改 DOM 也不会改 script 文本。 */
    const source = typeof html === 'string' ? html : scriptsSource(doc);
    const um = source.match(/url\s*:\s*['"]([^'"]*\/timeline[^'"]*)['"]/);
    const timelineUrl = Util.safePath(um ? um[1] : `/session/${id || ''}/timeline`);

    const projects = [];
    const pTable = tableAfter(headingByText(doc, /^renderable\s*projects$/i));
    if (pTable) {
      for (const tr of pTable.querySelectorAll('tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (!tds.length) continue;
        const name = text(tds[0]);
        if (!name) continue;
        projects.push({ name, reason: tds[1] ? text(tds[1]) : '' });
      }
    }

    // running 取反 Action（写的是点下去会变成什么），没那一格退回 Status 文案；都没有 = 不猜
    const target = info.action && info.action.target;
    const running = target === '0' ? true : target === '1' ? false
      : info.status ? (/enable|running|active/i.test(info.status.value) ? true
        : (/disab|pause|stop|off/i.test(info.status.value) ? false : null)) : null;

    if (!facts.length) return null;   // 一条都读不到 = 解析失败，交给界面如实说
    return { id: String(id || ''), facts, info, projects, hasProjects: !!pTable, timelineUrl, running };
  }

  /** 时间线 JSON → 事件数组。站点给的是 [type, job, startMs, endMs] 四元组；倒序在这一层定死。
   *  时间戳 null / 空串不能当 0（会变成 1970 年），非正数、非有限值一律丢掉。 */
  function parseTimeline(json) {
    const at = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
    return (Array.isArray(json) ? json : [])
      .map((r) => ({
        type: String((r && r[0]) || ''),
        job: String((r && r[1]) || ''),
        start: at(r && r[2]),
        end: at(r && r[3]),
      }))
      .filter((x) => Number.isFinite(x.start) && x.start > 0)
      .map((x) => ({ ...x, end: Number.isFinite(x.end) ? x.end : x.start }))
      .sort((a, b) => b.start - a.start);
  }

  /* 「我的项目」= 个人主页上那张 <h2>Latest projects</h2> 表（**不是**页脚侧栏那个同名 <h4> 块，
     后者是全站最新项目）。站点实况（2026-10-07 抓的真 HTML，`.tmp/recon/raw/profile-self.html`）：

       <div class="w-box blog-post"><h2>Latest projects</h2><div class="padding-15">
         <table class="table table-bordered table-striped table-comparision table-responsive">
           <tr><td><a href="/project/1224469">sptest</a></td><td class="msg_finished">Rendered</td></tr>

     三条站点行为决定了解析形状（都是上游源码 HTML.php:2551 printProjects 干的）：
     ① 行里**没有项目 id**，id 只能从名字链上取；别人的主页不给链（canManageProject 为假），
        所以那一侧解析出来 id 为空 —— 调用方据此判断"能不能进管理页"。
     ② 状态是第二个 td 的 class `msg_<词>`（processing/finished/waiting/paused/unknown），
        文案里另带百分比：「Rendering (88%)」。**用 class 判状态，不认英文文案**。
     ③ 被封的项目整行 `class="danger"`；一个项目都没有时站点整块不渲染 → 返回空数组。 */
  const MY_STATUS = { processing: 'rendering', waiting: 'waiting', paused: 'paused', finished: 'finished', unknown: 'other' };

  function parseMyProjects(doc) {
    // 页脚那个同名块是 <h4>，主页这块是 <h2>，且站的 h2 就是 w-box 的第一个孩子
    const head = [...doc.querySelectorAll('h2')].find((h) => /latest projects/i.test(text(h)));
    const table = head && head.parentElement ? head.parentElement.querySelector('table') : null;
    if (!table) return [];

    const out = [];
    for (const tr of table.querySelectorAll('tr')) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 2) continue;
      const link = tds[0].querySelector('a[href*="/project/"]');
      const id = link ? ((String(link.getAttribute('href')).match(/\/project\/(\d+)/) || [])[1] || '') : '';
      const cell = tds[1];
      const cls = (String(cell.getAttribute('class') || '').match(/\bmsg_([a-z]+)/i) || [])[1] || '';
      const raw = text(cell);
      const pct = Number((raw.match(/\((\d+)\s*%\)/) || [])[1]);
      out.push({
        id,
        name: text(tds[0]),
        statusKind: MY_STATUS[cls.toLowerCase()] || 'other',
        status: raw.replace(/\s*\(\d+\s*%\)\s*$/, ''),
        pct: Number.isFinite(pct) ? pct : null,
        blocked: tr.classList.contains('danger'),
      });
    }
    /* 站点自己那份顺序是插入序（实测：Wiza 主页里正在渲染的两个排在最后），拿"前 N 条"会挑到最老的。
       id 是 IDENTITY 自增（上游 Project.php:63），按 id 倒序 ≈ 新建在前；没有 id 的行保持原序排在后面。 */
    return out
      .map((x, i) => ({ x, i }))
      .sort((a, b) => ((Number(b.x.id) || 0) - (Number(a.x.id) || 0)) || (a.i - b.i))
      .map((p) => p.x);
  }

  /* 项目管理页 /project/<id> 的**全量模型**：只读站点那一页（**传进来的是一份 HTML 副本**，
     不是活文档 —— 和上传链路同一条路子），产出一份数据模型，视图层只吃模型、动作直发端点。
     站点来源：templates/project/manage.html.twig:133-274 + src/UI/HTML.php 的 printBlend()，
     2026-10-07 抓的真机 HTML 存在 `.tmp/recon/raw/manage-1224469-2.html`。

     三处设置各有各的形态（坑写在下面），其余都是"照着站点自己的 id 读文本"：
       ① 计算方式 = `input[name="compute_method"]` 两只 radio，onclick 里写死 'cpu'/'gpu'
          （`doModifyComputeMethod(id, 'cpu', checked_cpu ? '0' : '1')` —— 那个值是**翻转后的目标值**，
          所以判"当前是什么"只能看哪只 checked，不能看 onclick 里的数字）。站点还有一只 site bug：
          GPU 那只 radio 的外层判据写的是 canUseCPU()，别照抄。
       ② 生成 MP4 = `#project_generate_mp4_checkbox_1`（display_generate_mp4 为假时站点不渲染它）。
       ③ 公开渲染**两种形态**：公开时是可见 checkbox `#project_public_render_checkbox_1`（checked）
          + 一只同名 hidden `#project_public_render_checkbox_value`；私有时 `..._value` 自己就是那只
          可见 checkbox。站点的 onclick 永远读 `..._value`，所以判据看 type 不看 id。 */
  const MG_ACTION_TITLES = {
    'see frames': 'frames', 'download frames': 'zip', 'download video': 'video',
    'resume': 'resume', 'pause': 'pause', 'reset': 'reset', 'remove': 'delete',
  };

  function parseManage(doc, projectId) {
    const on = (el) => !!(el && (el.checked === true || el.hasAttribute('checked')));
    const typeOf = (el) => String((el && el.getAttribute('type')) || '').toLowerCase();
    const id = String(projectId || '');

    const nameEl = id ? doc.getElementById(`project_job_${id}_path`) : null;
    const progEl = id ? doc.getElementById(`project_job_${id}_progression`) : null;
    const stEl = id ? doc.querySelector(`#jobs_of_a_project li[class^="msg_"]`) : null;
    const stCls = stEl ? ((String(stEl.getAttribute('class') || '').match(/msg_([a-z]+)/i) || [])[1] || '') : '';

    /* ---- 概要 Summary：一串 <li>，最后一条红字是"自动删除日期"（站点给的是整句）。
       形状两种：`Storage used: 134.8 kB` 是纯文本，`On reference per frame rendertime: <span>0m00s</span>`
       的是「标签 + span」。拆成 label/value 两段，视图那边才能分别套语言包（见 50-views 的 mgLine）。 ---- */
    const sumHead = [...doc.querySelectorAll('h2')].find((h) => /^summary$/i.test(text(h).trim()));
    const sumBox = sumHead ? sumHead.closest('.w-box') || sumHead.parentElement : null;
    const summary = [];
    let warn = { label: '', value: '' };
    const pairOf = (li) => {
      const span = li.querySelector('span');
      if (span) {
        const clone = li.cloneNode(true);
        const dead = clone.querySelector('span');
        if (dead) dead.remove();
        return { label: text(clone).trim(), value: text(span).trim() };
      }
      const s = text(li);
      const m = s.match(/^([^:]+):\s*(.+)$/);
      return m ? { label: `${m[1]}:`, value: m[2].trim() } : { label: s, value: '' };
    };
    if (sumBox) {
      for (const li of sumBox.querySelectorAll('li')) {
        const p = pairOf(li);
        if (!p.label && !p.value) continue;
        if (li.querySelector('span[style*="red"]') || /automatically deleted/i.test(p.label + p.value)) warn = p;
        else summary.push(p);
      }
    }

    /* ---- 动作行：站点用 title 当唯一文字（图标按钮），按 title 归一成 kind ----
       `resume` 在"活跃项目太多"时是 disabled 的 <a>（没有 onclick）→ 读出来但标记 disabled。 */
    const box = id ? doc.getElementById(`project_job_${id}_div_actions`) : null;
    const actions = [];
    let canManage = false;
    for (const a of box ? box.querySelectorAll('a') : []) {
      const onclick = String(a.getAttribute('onclick') || '');
      const href = String(a.getAttribute('href') || '');
      const disabled = a.hasAttribute('disabled') || /\bdisabled\b/.test(String(a.getAttribute('class') || ''));
      const title = String(a.getAttribute('title') || '').trim();
      if (/remove_no_redirect/.test(onclick)) { canManage = true; continue; }
      const partial = onclick.match(/doAskForProjectPartialArchiveFrame\('([^']+)'\)/);
      if (partial) { actions.push({ kind: 'partial', url: partial[1], title, disabled }); continue; }
      const act = onclick.match(/projectAction\('[^']*',\s*'([a-z_]+)'\)/);
      if (act) {
        const kind = MG_ACTION_TITLES[act[1]] || act[1];
        actions.push({ kind, title, disabled });
        continue;
      }
      if (!href || href === '#') {
        /* 站点在"活跃项目太多"时渲染的是一只**没有 onclick、没有链接**的灰按钮，标题里写着原因：
           `href="#"` + title="Resume is disabled because you have too many active projects"。
           按 title 认回它并标 disabled —— 否则用户看到的是"这一栏什么都没有"，不知道为什么。 */
        const low = title.toLowerCase();
        const key = Object.keys(MG_ACTION_TITLES).find((k) => low.indexOf(k) === 0);
        if (key) actions.push({ kind: MG_ACTION_TITLES[key], title, disabled: true });
        continue;
      }
      const kind = MG_ACTION_TITLES[title.toLowerCase()] || (/\/frames\//.test(href) ? 'frames' : '');
      if (kind === 'frames') { actions.push({ kind, url: href, title, disabled }); continue; }
      /* 下载帧 / 下载视频是 shepherd 上的**绝对 URL**（主机名随项目变），原样留着 */
      if (/\/zip$/.test(href) || /\/mp4\/final$/.test(href)) actions.push({ kind, url: href, title, disabled });
    }

    /* ---- 帧方块 + 视频预览：站点把 <img>/<video> 塞在 title 属性或 <source> 里 ---- */
    const tiles = [];
    for (const sq of doc.querySelectorAll('.tiles .square')) {
      const raw = String(sq.getAttribute('title') || '');
      const src = (/<img\s+src="([^"]+)"/i.exec(raw) || [])[1] || '';
      if (!src) continue;
      const cls = String(sq.getAttribute('class') || '');
      const num = (re) => { const m = raw.match(re); return m ? m[1].trim() : ''; };
      tiles.push({
        src,
        frame: num(/frame:\s*([^<]+)/i),
        cost: num(/cost:\s*([^<]+)/i),
        time: num(/rendertime:\s*([^<]+)/i),
        state: /btn-warning/.test(cls) ? 'progress' : (/btn-neutral/.test(cls) ? 'done' : 'waiting'),
      });
    }
    const videoEl = doc.querySelector('.tiles video source[src]');
    const video = videoEl ? String(videoEl.getAttribute('src') || '') : '';

    /* ---- 权限 / 渲染者：站点把名单渲染成 <ul><li><a>名字</a></li> ----
       `#project_acl_team_current` 的链接是 /team/<数字 id>，名字在链接文字里（id 要从 href 抠，
       加团队时站点发的就是那个数字 id）。公开渲染时站点**不渲染**这两份名单（只有那只 checkbox），
       所以名单为空 ≠ 没人，视图要按 publicRender 说清。 */
    const namesOf = (rootId) => {
      const root = doc.getElementById(rootId);
      if (!root) return [];
      return [...root.querySelectorAll('li a')]
        .map((a) => ({ name: text(a), url: Util.safePath(a.getAttribute('href')), id: (String(a.getAttribute('href')).match(/\/team\/(\d+)/) || [])[1] || '' }))
        .filter((x) => x.name);
    };
    const acl = {
      managers: namesOf('project_acl_manager_current'),
      renderers: namesOf('project_acl_renderer_current'),
      teams: namesOf('project_acl_team_current'),
      hasManagerPanel: !!doc.getElementById('project_acl_manager_add_form_user'),
      hasRendererPanel: !!doc.getElementById('project_acl_renderer_add_form_user'),
      hasTeamPanel: !!doc.getElementById('project_acl_team_add_form_user'),
    };

    let compute = '';
    for (const r of doc.querySelectorAll('input[name="compute_method"]')) {
      if (!on(r)) continue;
      const m = String(r.getAttribute('onclick') || '').match(/doModifyComputeMethod\([^)]*?'(cpu|gpu)'/);
      if (m) compute = m[1];
    }
    const mp4Box = doc.getElementById('project_generate_mp4_checkbox_1');
    const pubA = doc.getElementById('project_public_render_checkbox_1');
    const pubB = doc.getElementById('project_public_render_checkbox_value');
    const pubEl = typeOf(pubA) === 'checkbox' ? pubA : (typeOf(pubB) === 'checkbox' ? pubB : null);

    return {
      found: !!(nameEl || box || acl.hasManagerPanel),
      id,
      name: nameEl ? text(nameEl) : '',
      statusText: stEl ? text(stEl) : '',
      statusCls: stCls.toLowerCase(),
      progression: progEl ? text(progEl) : '',
      summary, warn, actions, tiles, video, acl, canManage,
      compute,
      mp4: mp4Box ? on(mp4Box) : null,
      publicRender: pubEl ? on(pubEl) : null,
      hasCompute: !!compute || !!doc.querySelector('input[name="compute_method"]'),
      hasMp4: !!mp4Box,
      hasPublic: !!pubEl,
    };
  }

  function parseProfile(html, userName) {
    const doc = asDoc(html);
    /* 时间线数组与热力图数据写在站点内联 <script> 里。传进来的是活 document 时，
       用站点脚本的文本当原文扫（站点脚本改 DOM 不改 script 文本）。 */
    const source = typeof html === 'string' ? html : scriptsSource(doc);

    const stats = {};
    const dl = doc.querySelector('dl.dl-horizontal');
    if (dl) {
      const kids = [...dl.children];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName === 'DT' && kids[i + 1] && kids[i + 1].tagName === 'DD') {
          stats[text(kids[i])] = text(kids[i + 1]);
        }
      }
    }

    // 用户名读 <title>：导航栏 logo <h1>SheepIt</h1> 会污染 querySelector('h1')
    const name = (text(doc.querySelector('title')) || userName || '').trim();

    const points = (extractArray(source, 'line_points_timeline') || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    const frames = (extractArray(source, ['line_frames_timeline', 'line_frames_timeline_2']) || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    let activity = [];
    /* 热力图数组按内容认（含 `date:` 且同脚本有 CalendarHeatmap 的那个 `var data`）。
       活 document 下不能按 div id 的位置锚点切分（那个 id 不在 script 文本里，锚点会落在
       数据数组之后）；字符串模式保留原来的锚点回退，站点把数据与初始化拆到两个脚本时还有退路。 */
    let raw = heatmapData(doc);
    if (!Array.isArray(raw) && typeof html === 'string') {
      const anchor = source.indexOf('consecutive-render-heatmap');
      raw = extractArray(source.slice(Math.max(0, anchor)), ['data'], true);
    }
    if (Array.isArray(raw)) {
      activity = raw.filter((x) => x && x.date)
        .map((x) => ({ d: String(x.date).slice(0, 10), c: Number(x.count) || 0 }))
        .sort((a, b) => (a.d < b.d ? -1 : 1));
    }

    const machines = parseMachines(doc);

    const sBox = smallestBoxByTitle(doc, /last sessions/i);
    const sessions = sBox ? [...sBox.querySelectorAll('li')].map(text).filter(Boolean) : [];

    const badge = text(doc.querySelector('.label-success'));
    const avatar = Util.safePath((doc.querySelector('.polaroid img')?.getAttribute('src') || '').replace(/^\.\.\/\.\.\//, '/'));
    let status = text(doc.querySelector('.col-md-4.login'));
    for (const s of [name, badge, 'Edit profile', 'top 10% renderers']) status = status.split(s).join('');
    status = status.trim();

    const derived = computeDerived(activity);

    // 主页那张表：自己的主页每行带 id 可进 /project/<id>，别人的主页只有名字（见 parseMyProjects）
    const myProjects = parseMyProjects(doc);

    return { name, avatar, badge, status, stats, points, frames, activity, machines, sessions, derived, myProjects };
  }

  /** 派生：口径与原站 dl 的 "Consecutive render days" 对齐（不含今天） */
  function computeDerived(activity) {
    const key = (dt) => dt.toISOString().slice(0, 10);
    const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return key(x); };
    const set = new Set(activity.map((x) => x.d));
    /* "今天"必须按**本地日期**取：站点给的活动日期是本地日历日；用 toISOString() 在
       东八区 00:00–08:00 会算出前一天，连续天数会差一天。 */
    const today = Util.dkeyLocal();
    const run = (from) => { let n = 0, c = from; while (set.has(c) && n < 5000) { n++; c = shift(c, -1); } return n; };

    let best = 0, cur = 0, prev = null;
    for (const x of activity) { cur = (prev && shift(prev, 1) === x.d) ? cur + 1 : 1; best = Math.max(best, cur); prev = x.d; }

    return {
      streakExclToday: set.has(today) ? run(shift(today, -1)) : run(today),
      best,
      active30: [...Array(30)].filter((_, i) => set.has(shift(today, -i))).length,
    };
  }

  function parseHome(html) {
    const doc = parse(html);
    return {
      stats: parseStatBoxes(doc),
      power: text([...doc.querySelectorAll('.w-box,div')].find((d) => /Sheepit power/i.test(text(d)) && d.querySelectorAll('*').length < 30)),
      news: [...doc.querySelectorAll('a[href^="/news/"]')]
        .map((a) => ({ href: Util.safePath(a.getAttribute('href')), text: text(a) }))
        .filter((n, i, arr) => n.href && arr.findIndex((x) => x.href === n.href) === i)
        .slice(0, 6),
    };
  }

  /** 把站点状态文案（"13 Rendering frames" / "Waiting"）拆成可本地化的结构 */
  function parseStatus(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^([\d,]+)\s+(.*)$/);
    const count = m ? Number(m[1].replace(/,/g, '')) : null;
    const phrase = (m ? m[2] : s).toLowerCase();
    let kind = 'other';
    if (/render/.test(phrase)) kind = 'rendering';
    else if (/wait/.test(phrase)) kind = 'waiting';
    else if (/paus/.test(phrase)) kind = 'paused';
    return { kind, count, raw: s };
  }

  function parseProjects(html) {
    const doc = parse(html);
    const out = [];

    /* 列位置别写死：站点给版主账号会多出 creation_time 等 extras 列（HomeController.php:726-734），
       硬编码 tds[5] 会把「内存」读成别的列。优先按表头定位，认不出才回退老下标。 */
    const firstRow = doc.querySelector('tr[data-project_id]');
    const table = firstRow ? firstRow.closest('table') : doc;
    const heads = [...(table || doc).querySelectorAll('thead th')].map((th) => text(th).toLowerCase());
    const col = (re, fallback) => { const i = heads.findIndex((h) => re.test(h)); return i >= 0 ? i : fallback; };
    const I_NAME = col(/^project$/, 0);
    const I_OWNER = col(/^owner$/, 1);
    const I_STATUS = col(/^status$/, 2);
    const I_DEV = col(/^device/, 4);
    const I_MEM = col(/^memory/, 5);

    for (const tr of doc.querySelectorAll('tr[data-project_id]')) {
      const tds = [...tr.querySelectorAll('td')];
      const id = tr.getAttribute('data-project_id');
      const name = text(tr.querySelector('.project_link')) || text(tds[I_NAME]);

      // 发布者：第一个有文字的 <a> 才是名字（前一个只有 <img> 头像）
      const links = [...tr.querySelectorAll('td a[href*="/user/"]')];
      const ownerAnchor = links.find((a) => text(a)) || null;
      const owner = ownerAnchor ? text(ownerAnchor) : (tds[I_OWNER]?.getAttribute('data-sort') || '');
      // URL 里的用户名才是稳定的键
      const ownerId = (ownerAnchor && (ownerAnchor.getAttribute('href').match(/\/user\/([^/]+)\//) || [])[1]) || '';
      const avatarImg = tr.querySelector('td .avatar-small img') || tr.querySelector('td img.avatar');
      const ownerAvatar = Util.safePath(avatarImg?.getAttribute('data-src') || avatarImg?.getAttribute('src') || '');

      const status = parseStatus(text(tr.querySelector('.status')) || text(tds[I_STATUS]));

      // 进度：aria-valuenow 是百分比，分数在 .sr-only 里
      const bar = tr.querySelector('.progress-bar');
      const rawPct = bar?.getAttribute('aria-valuenow');
      let pct = rawPct == null || rawPct === '' ? NaN : Number(rawPct);
      if (!Number.isFinite(pct)) {
        const w = bar?.getAttribute('style')?.match(/width:\s*([\d.]+)%/);
        pct = w ? Number(w[1]) : 0;
      }
      const frac = text(tr.querySelector('.progressbar-width')).match(/([\d,]+)\s*\/\s*([\d,]+)/);
      const done = frac ? Number(frac[1].replace(/,/g, '')) : null;
      const total = frac ? Number(frac[2].replace(/,/g, '')) : null;

      // 设备：data-sort 是位掩码 CPU=1 / GPU=8（站点 addproject.js 的算法），掩码缺失才回退读 img
      const devCell = tds[I_DEV];
      const rawMask = devCell?.getAttribute('data-sort');
      const mask = rawMask == null || rawMask === '' ? NaN : Number(rawMask);
      let cpu = false, gpu = false;
      if (Number.isFinite(mask)) {
        cpu = (mask & 1) === 1;
        gpu = (mask & 8) === 8;
      } else if (devCell) {
        const srcs = [...devCell.querySelectorAll('img')].map((i) =>
          `${i.getAttribute('src') || ''} ${i.getAttribute('title') || ''}`.toLowerCase());
        cpu = srcs.some((s) => /cpu_?enabled|nvidia|intel/.test(s));
        gpu = srcs.some((s) => /gpu_?enabled/.test(s));
      }

      // 内存：显示文本保留，同时留 KB 原值供排序（文本是 "1.3 G" 这类字面量）
      const memCell = tds[I_MEM];
      const memText = text(memCell);
      const rawKb = memCell?.getAttribute('data-sort');
      const memKb = rawKb == null || rawKb === '' ? null : Number(rawKb);
      const mem = (memText.match(/([\d.]+\s*[KMGT]?B)/i) || [memText])[0];

      out.push({
        id, name, owner, ownerId, ownerAvatar,
        status: status.raw, statusKind: status.kind, statusCount: status.count,
        pct, done, total,
        cpu, gpu,
        memory: mem,
        memKb: Number.isFinite(memKb) ? memKb : 0,
      });
    }
    return out;
  }

  /** 排行榜：用站点自带的 data-sort 原始数值（排行榜按站点原始值排、不按 "1.3 G" 字面量） */
  function parseRanking(html) {
    const doc = asDoc(html);
    const rows = [...doc.querySelectorAll('table tr')].filter((tr) => tr.querySelector('td'));
    const out = [];
    for (const tr of rows) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 5) continue;
      const link = tr.querySelector('a[href*="/user/"]');
      const av = tr.querySelector('td .avatar-small img') || tr.querySelector('td img.avatar') || link?.querySelector('img');
      const numOf = (td) => {
        const raw = td.getAttribute('data-sort');
        if (raw != null && raw !== '') {
          const v = Number(raw);
          if (Number.isFinite(v)) return v;
        }
        /* 没有 data-sort 才退到显示文本。注意 "2y244d43m" 这类缩写会被抠成 224443 ——
           只当排序兜底；榜单每列都带 data-sort 原值（夹具 1658 行 × 4 个），正常走不到这里。 */
        const txt = text(td).trim();
        if (!txt || !/\d/.test(txt)) return null;
        const n = Number(txt.replace(/[^\d.]/g, ''));
        return Number.isFinite(n) ? n : null;
      };
      out.push({
        rank: text(tds[0]),
        user: link ? text(link) : text(tds[1]),
        // URL 里的用户名才是可靠身份（显示名可能与 URL 不同，只有 URL 那个能打开对的人）
        userId: link ? decodeURIComponent((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
        avatar: Util.safePath(av?.getAttribute('data-src') || av?.getAttribute('src') || ''),
        frames: numOf(tds[2]),
        seconds: numOf(tds[3]),
        points: numOf(tds[4]),
      });
    }
    return out;
  }

  /** 账户设置页（/user/<u>/edit）：整页 11 个分区都在 DOM 里（站点用 display 切换），一次抓取够用 */
  function parseAccount(html) {
    const doc = asDoc(html);

    const checked = (id) => {
      const el = doc.getElementById(id);
      return el ? el.hasAttribute('checked') : null;
    };

    const emailBox = doc.getElementById('profile_edit_category_email');
    const email = emailBox
      ? ([...emailBox.querySelectorAll('p')].map(text).find((s) => /@/.test(s)) || '')
      : '';

    const bigImg = doc.querySelector('img[src*="/avatar/big/"], img[data-src*="/avatar/big/"]');
    const avatar = Util.safePath(
      ((bigImg && (bigImg.getAttribute('src') || bigImg.getAttribute('data-src'))) || '').replace(/^\.\.\/\.\.\//, '/'),
    );

    /** 用户列表：按钮 onclick 里带动作 URL */
    function userList(rootId, action) {
      const root = doc.getElementById(rootId);
      if (!root) return [];
      const out = [];
      for (const input of root.querySelectorAll('input[onclick]')) {
        // 认不出动作 URL 的按钮跳过（读不到就不给按钮）
        const m = String(input.getAttribute('onclick')).match(new RegExp(`'(/user/[^']*/${action}/[^']*)'`));
        if (!m) continue;
        const name = decodeURIComponent(m[1].split('/').pop() || '');
        if (!name) continue;
        const row = input.closest('tr');
        const anchor = row ? [...row.querySelectorAll('a[href*="/user/"]')].find((a) => text(a) === name) : null;
        const img = row ? row.querySelector('img') : null;
        out.push({
          name,
          action: m[1],
          avatar: Util.safePath((img && (img.getAttribute('data-src') || img.getAttribute('src'))) || ''),
        });
      }
      return out.filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i);
    }

    const renderKeys = [];
    const keyBox = doc.getElementById('profile_shared_keys');
    if (keyBox) {
      for (const tr of keyBox.querySelectorAll('tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (tds.length < 3) continue;
        const key = text(tds[0]);
        if (!/^[A-Za-z0-9_-]{16,}$/.test(key)) continue;
        const del = tr.querySelector('input[onclick]');
        const dm = del ? String(del.getAttribute('onclick')).match(/'(\/user\/renderkey\/del\/[^']*)'/) : null;
        renderKeys.push({ key, comment: text(tds[1]) || '—', inUse: /yes/i.test(text(tds[2])), action: dm ? dm[1] : '' });
      }
    }

    /* 赞助（捐赠积分）：两个开关的 name/id 与各自 label 是**错位**的，所以只认 onclick 里的
       /user/sponsor/give|receive/enable/<0|1>：状态读 checked，动作读 onclick。 */
    function sponsorSwitch(kind) {
      const re = new RegExp(`/user/sponsor/${kind}/enable/\\d`);
      const el = [...doc.querySelectorAll('input[onclick]')]
        .find((i) => re.test(String(i.getAttribute('onclick'))));
      if (!el) return null;
      const m = String(el.getAttribute('onclick')).match(re);
      return { on: el.hasAttribute('checked'), action: m ? m[0] : '' };
    }

    // 赞助名单：名单为空时站点不渲染这些行，按「行里有 /user/<名字>/profile 链接」认；
    // 读不到移除动作时那一行只显示、不给按钮（状态不明的地方不给动作）。
    const sponsored = [];
    const addInput = doc.getElementById('account_add_sponsor');
    /* 「添加」的动作前缀一律从 onclick 读，绝不自己拼一串 */
    const addPrefix = (re) => {
      const el = [...doc.querySelectorAll('[onclick]')].find((e) => re.test(String(e.getAttribute('onclick'))));
      const m = el ? String(el.getAttribute('onclick')).match(re) : null;
      return m ? m[1] : '';
    };
    const add = {
      priority: addPrefix(/'(\/user\/priority\/add\/)'/),
      blockRenderer: addPrefix(/'(\/user\/block\/renderer\/add\/)'/),
      blockOwner: addPrefix(/'(\/user\/block\/owner\/add\/)'/),
      sponsor: addPrefix(/'(\/user\/sponsor\/add\/)'/),
    };
    const sponsorTable = addInput ? addInput.closest('table') : null;
    if (sponsorTable) {
      for (const tr of sponsorTable.querySelectorAll('tr')) {
        const a = [...tr.querySelectorAll('a[href*="/user/"]')]
          .find((x) => /\/user\/[^/]+\/profile/.test(String(x.getAttribute('href'))));
        if (!a) continue;
        const name = decodeURIComponent((String(a.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '');
        if (!name || sponsored.some((s) => s.name === name)) continue;
        const act = [...tr.querySelectorAll('[onclick]')]
          .map((el) => (String(el.getAttribute('onclick')).match(/'(\/user\/sponsor\/remove\/[^']*)'/) || [])[1])
          .find(Boolean) || '';
        const img = tr.querySelector('img');
        sponsored.push({
          name,
          action: act,
          avatar: Util.safePath((img && (img.getAttribute('data-src') || img.getAttribute('src'))) || ''),
        });
      }
    }

    return {
      scheduler: {
        mineFirst: checked('scheduler_rendermyprojectfirst'),
        teamFirst: checked('scheduler_rendermyteamsprojectsfirst'),
        heavyFirst: checked('scheduler_heavy_project'),
      },
      sponsor: {
        give: sponsorSwitch('give'),
        receive: sponsorSwitch('receive'),
        addUrl: add.sponsor,
        list: sponsored,
      },
      add,
      priority: userList('profile_high_priority_users', 'remove').map((x) => ({ name: x.name, action: x.action, avatar: x.avatar })),
      blockedRenderers: userList('profile_blacklist_renderer', 'remove'),
      blockedOwners: userList('profile_blacklist_owner', 'remove'),
      renderKeys,
      email,
      avatar,
    };
  }

  function detectUser(doc) {
    const menu = doc.querySelector('.navbar-user');
    const link = menu?.querySelector('a[href*="/user/"]');
    const m = link?.getAttribute('href')?.match(/\/user\/([^/]+)\//);
    const signedIn = !!m && !menu.textContent.includes('Please sign in');
    // 顶栏头像必须用导航栏那张（永远是当前登录者），否则看别人主页会串脸
    const img = menu?.querySelector('img');
    const avatar = Util.safePath(((img && (img.getAttribute('data-src') || img.getAttribute('src'))) || '').replace(/^\.\.\/\.\.\//, '/'));
    return { signedIn, userName: m ? decodeURIComponent(m[1]) : null, avatar };
  }

  SP.Api = {
    fetchPage, fetchJson, fetchWithTimeout, invalidate, cache, post,
    currentDoc, isOk,
    parseProfile, parseHome, parseProjects, parseRanking, parseStatBoxes, detectUser,
    parseMyProjects, parseManage,
    parseAccount, parseMachines, parseSession, parseTimeline,
    extractArray, computeDerived,
  };
})();
