/* ==========================================================================
 * 20-api.js — 数据层：抓取站点页面并解析成结构化数据
 *
 * 设计原则：
 *  1) 只用站点自己的公开页面（同源 fetch + DOMParser），不碰任何私有接口。
 *  2) 所有解析都对结构变化保持钝感：优先用语义属性（dt/dd、data-sort），
 *     其次才用 class，最后才用正则兜底。
 *  3) 解析失败返回 null / 空数组，由 UI 层显示"无数据"，绝不抛到顶层。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, parse, text } = { Util: SP.Util, parse: SP.Util.parse, text: SP.Util.text };
  const inflight = {};

  /** 同源抓取（带凭据），带内存缓存与并发去重 */
  const cache = new Map();
  async function fetchPage(path, { ttl = 60000, force = false } = {}) {
    const now = Date.now();
    const hit = cache.get(path);
    if (!force && hit && now - hit.at < ttl) return hit.html;
    return Util.once(inflight, path, async () => {
      const res = await fetch(path, { credentials: 'include', headers: { 'X-Requested-With': 'fetch' } });
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
      const html = await res.text();
      cache.set(path, { at: Date.now(), html });
      return html;
    });
  }
  function invalidate() { cache.clear(); }

  /** 同源抓 JSON。会话页的时间线不在 HTML 里，站点自己也是用 AJAX 拉一个 JSON 数组。
   *  失败照旧抛错，由调用方降级成"这一块没有数据"，绝不外溢到界面之外。 */
  async function fetchJson(path) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.json();
  }

  /**
   * 写操作：POST 到站点自己的端点 —— 和原站页面上的按钮打的是同一个地址，
   * 只是换了层界面。这是整个产品唯一会改变服务器状态的地方，且全部由用户点击触发。
   * 成功时站点回 'OK'，否则回一句给人看的错误文案，我们原样转述。
   */
  async function post(path, data, formData) {
    const opts = { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'fetch' } };
    if (formData) {
      opts.body = formData;
    } else {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.body = new URLSearchParams(data || {}).toString();
    }
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = (await res.text()).trim();
    return txt.length > 400 ? 'OK' : txt;   // 头像接口回的是整页 HTML，按成功算
  }

  /* ------------------------------------------------------------ 内联数组 */

  /**
   * 从 HTML 里抽出 `var NAME = [...]` 形式的数组字面量。
   * 站点用的是 JS 字面量而不是 JSON：单引号字符串 + 可能带尾逗号 + 可能不带引号的键，
   * 所以不能直接 JSON.parse，需要三步归一化。
   */
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

  /* ------------------------------------------------------------ 通用小件 */

  /** 找「含指定标题的、最小的那个容器」——比写死 class 稳，也不会被内联 script 撑爆 */
  function smallestBoxByTitle(doc, re) {
    return [...doc.querySelectorAll('div')]
      .filter((d) => { const h = d.querySelector('h1,h2,h3,h4,h5'); return h && re.test(h.textContent); })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
  }

  // 站点统计卡的英文标签 → i18n key。原站文案写死在 PHP 里，这里做映射以保持全站中文一致。
  const SITE_LABEL_KEYS = [
    [/frames?\s*remaining/i, 'site.frames'],
    [/active\s*projects?/i, 'site.projects'],
    [/connected\s*clients?/i, 'site.clients'],
    [/processing\s*frames?/i, 'site.processing'],
  ];

  /** 解析首页统计卡：.w-box.stat-box 里 .sparkline 是逗号分隔的走势，.content 里 h2 是数值 */
  function parseStatBoxes(doc) {
    const out = [];
    for (const box of doc.querySelectorAll('.w-box.stat-box, .stat-box')) {
      const h2 = box.querySelector('h2');
      if (!h2) continue;
      const value = text(h2);

      // 标签必须把 h2（数值）和 sparkline（数据）剔掉，否则会变成 "FRAMES REMAINING 37,906"
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

  /**
   * 已连接的机器。
   * 原站把每台机器写成 `<h2>N connected machine(s)</h2>` 下面一张表，每行一个
   * `/session/<id>` 链接，文字形状是 "(客户端名) CPU 型号 @ 频率 x核数"。
   * 旧版这里是一串"看起来像机器描述"的字符串，做总览不够用，改成结构化。
   */
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

  /* ------------------------------------------------------- 会话页 /session/<id> */

  /* 站点在这一页写的英文标签 → 内部键。**对不上的标签不丢**：照样进 facts，
   * 只是没有键 —— 站点哪天加一行新数据，界面会原样显示出来，而不是默默吞掉。 */
  const SESSION_LABELS = [
    [/^owner$/i, 'owner'],
    [/^hostname$/i, 'hostname'],
    [/^os$/i, 'os'],
    [/^render\s*key$/i, 'renderKey'],
    [/^cpu$/i, 'cpu'],
    // GPU 机器上站点多印这几行（CPU 机器上根本没有），原先都没有键 —— 于是中文界面里
    // 它们原样露英文标签。Power 那两行是**二选一**的：站点按这台机器启用的计算设备印。
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
    // 这台机器此刻在跑哪一帧（空闲时站点不印这一行）。它是**活的**，所以界面不把它留在
    // 「机器信息」那张静态原值表里，而是提到身份条上（见 50-views.js 的 sess.rendering）。
    [/^current\s*frames$/i, 'currentFrames'],
  ];

  /** 某个标题之后、下一个标题之前的第一个表格。
   *  必须卡在下一个标题处收手：Timeline 后面的那张表属于 Renderable projects，
   *  一路找下去会把两张表搞混。 */
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

  /**
   * 会话页 → 一台机器的结构化档案。
   *
   * 三块内容：
   *   1) Session information —— 20 项键值，按 <th> 标签逐行读，不认位置（站点会按状态增减行）；
   *   2) Timeline —— 不在 HTML 里，是站点自己的 AJAX 端点拉的 JSON（地址从内联脚本里读出来）；
   *   3) Renderable projects —— 项目名 + 一句"为什么现在不派给它"。
   *
   * 站点的颜色（CPU / 版本 / Enable 上的绿色）没有语义，一律丢掉，只留文字与状态词。
   */
  function parseSession(html, id) {
    const doc = parse(html);
    const facts = [];
    const info = {};

    const table = tableAfter(headingByText(doc, /^session\s*information$/i));
    if (table) {
      for (const tr of table.querySelectorAll('tr')) {
        const th = tr.querySelector('th');
        const td = tr.querySelector('td');
        if (!th || !td) continue;
        const label = text(th);
        if (!label) {
          /* 站点用它写**没有标签的状态行**：实测服务器端暂停时写 "Paused server side"，
             客户端自己暂停时写 "Paused client side"。两种暂停站点各有各的说法，
             而它们都长这样 —— 一行没有 th 文字、只有值的行。
             它是状态而不是机器规格，所以收进 info，不进「机器信息」那张静态原值表。
             早先这里是 `if (!label) continue`，把整行丢了：于是两种暂停在界面上长得
             一模一样，更糟的是 Status 那格在两种情况下都还写着 Enable，
             本地暂停会被我们误报成「运行中」。
             认不出的值照样留着 —— 与别处同一条规矩：不吞数据，界面按原文显示。 */
          const note = text(td);
          if (note) info.note = { value: note, key: 'note', href: '' };
          continue;
        }
        const hit = SESSION_LABELS.find(([re]) => re.test(label));
        const key = hit ? hit[1] : null;
        const a = td.querySelector('a[href]');
        const fact = { label, key, value: text(td), href: Util.safePath(a && a.getAttribute('href')) };

        if (key === 'renderKey') {
          // 密钥：站点本来也是"点一下才显示"。照做 —— 密钥只落在属性里，不进可见文本。
          // 万一把 onclick 的写法读丢了，而这一格恰好是明文的密钥，也照样遮起来：
          // 界面重做的价值之一就是别把秘密摊在首屏上。
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
          // Action 那格是个按钮：点下去会把机器设成哪个状态，写在动作地址的最后一段里
          const btn = td.querySelector('input[type=button],input[type=submit],button');
          const m = btn ? String(btn.getAttribute('onclick') || '').match(/'([^']+)'/) : null;
          fact.value = btn ? String(btn.getAttribute('value') || text(btn)) : fact.value;
          fact.action = m ? Util.safePath(m[1]) : null;
          const st = fact.action && fact.action.match(/\/running\/(\d+)/);
          fact.target = st ? st[1] : null;
        }
        if (key === 'hostname') {
          const img = td.querySelector('img');
          const src = img ? String(img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
          const m = src.match(/flag\/([A-Za-z]{2})\./);
          fact.flag = m ? m[1].toUpperCase() : '';
        }
        if (key === 'owner' && fact.href) {
          const m = fact.href.match(/\/user\/([^/]+)\//);
          fact.user = m ? decodeURIComponent(m[1]) : fact.value;
        }
        facts.push(fact);
        if (key && info[key] === undefined) info[key] = fact;
      }
    }

    // 时间线的地址：从页面自己的内联脚本里读（站点也是这么调的），读不到才按形状兜底
    const um = html.match(/url\s*:\s*['"]([^'"]*\/timeline[^'"]*)['"]/);
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

    // 这台机器现在跑不跑：Action 写的是"点下去会变成什么"，取反就是当前状态；
    // 没有那一格时退回 Status 文案。两处都没有就是不知道，不猜。
    const target = info.action && info.action.target;
    const running = target === '0' ? true : target === '1' ? false
      : info.status ? (/enable|running|active/i.test(info.status.value) ? true
        : (/disab|pause|stop|off/i.test(info.status.value) ? false : null)) : null;

    if (!facts.length) return null;   // 一条都读不到 = 解析失败，交给界面如实说
    return { id: String(id || ''), facts, info, projects, hasProjects: !!pTable, timelineUrl, running };
  }

  /**
   * 时间线 JSON → 事件数组。站点给的是 [type, job, startMs, endMs] 的四元组。
   * 倒序（最近的在前）在解析层就定死，省得每个调用方各自再排一遍。
   * 时间戳讲究一点：null / 空串 **不能**当 0 收下（Number(null) === 0 会变成 1970 年的一行），
   * 非正数、非有限值一律丢掉。
   */
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

  /** 账户页 → 用户档案（统计 / 积分曲线 / 帧数曲线 / 活跃日历 / 机器 / 会话） */
  function parseProfile(html, userName) {
    const doc = parse(html);

    // 统计项：<dl class="dl-horizontal"><dt>k</dt><dd>v</dd>
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

    // 用户名：<title> 才是可靠的，导航栏里有个 logo <h1>SheepIt</h1> 会污染 querySelector('h1')
    const name = (text(doc.querySelector('title')) || userName || '').trim();

    const points = (extractArray(html, 'line_points_timeline') || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    const frames = (extractArray(html, ['line_frames_timeline', 'line_frames_timeline_2']) || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    // 活跃日历：锚定在热力图容器之后，避免撞上别处同名的 `var data`
    let activity = [];
    const anchor = html.indexOf('consecutive-render-heatmap');
    const raw = extractArray(html.slice(Math.max(0, anchor)), ['data'], true);
    if (Array.isArray(raw)) {
      activity = raw.filter((x) => x && x.date)
        .map((x) => ({ d: String(x.date).slice(0, 10), c: Number(x.count) || 0 }))
        .sort((a, b) => (a.d < b.d ? -1 : 1));
    }

    // 在线机器：结构化（客户端名 / CPU 型号 / 会话链接）
    const machines = parseMachines(doc);

    const sBox = smallestBoxByTitle(doc, /last sessions/i);
    const sessions = sBox ? [...sBox.querySelectorAll('li')].map(text).filter(Boolean) : [];

    const badge = text(doc.querySelector('.label-success'));
    const avatar = Util.safePath((doc.querySelector('.polaroid img')?.getAttribute('src') || '').replace(/^\.\.\/\.\.\//, '/'));
    let status = text(doc.querySelector('.col-md-4.login'));
    for (const s of [name, badge, 'Edit profile', 'top 10% renderers']) status = status.split(s).join('');
    status = status.trim();

    // 派生指标：原站没有的
    const derived = computeDerived(activity);

    return { name, avatar, badge, status, stats, points, frames, activity, machines, sessions, derived };
  }

  /** 由活跃日历算出连续天数等指标。口径与原站 dl 的 "Consecutive render days" 对齐（不含今天）。 */
  function computeDerived(activity) {
    const key = (dt) => dt.toISOString().slice(0, 10);
    const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return key(x); };
    const set = new Set(activity.map((x) => x.d));
    const today = key(new Date());
    const run = (from) => { let n = 0, c = from; while (set.has(c) && n < 5000) { n++; c = shift(c, -1); } return n; };

    let best = 0, cur = 0, prev = null;
    for (const x of activity) { cur = (prev && shift(prev, 1) === x.d) ? cur + 1 : 1; best = Math.max(best, cur); prev = x.d; }

    return {
      streakExclToday: set.has(today) ? run(shift(today, -1)) : run(today),
      streakInclToday: run(today),
      best,
      active30: [...Array(30)].filter((_, i) => set.has(shift(today, -i))).length,
      totalDays: activity.length,
    };
  }

  /** 首页 → 全站统计 + 新闻 */
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

  /** 项目列表 → 结构化项目数组 */
  function parseProjects(html) {
    const doc = parse(html);
    const out = [];

    for (const tr of doc.querySelectorAll('tr[data-project_id]')) {
      const tds = [...tr.querySelectorAll('td')];
      const id = tr.getAttribute('data-project_id');
      const name = text(tr.querySelector('.project_link')) || text(tds[0]);

      // 发布者：单元格里有 2~3 个 <a>，只有「有文字的那个」才是名字，
      // 第一个是头像链接（内容只有 <img>，textContent 为空）。
      const links = [...tr.querySelectorAll('td a[href*="/user/"]')];
      const ownerAnchor = links.find((a) => text(a)) || null;
      const owner = ownerAnchor ? text(ownerAnchor) : (tds[1]?.getAttribute('data-sort') || '');
      // 名字是给人看的，URL 里的用户名才是稳定的键（站点哪天渲染成显示名，文本就不等于用户名了）
      const ownerId = (ownerAnchor && (ownerAnchor.getAttribute('href').match(/\/user\/([^/]+)\//) || [])[1]) || '';
      const avatarImg = tr.querySelector('td .avatar-small img') || tr.querySelector('td img.avatar');
      const ownerAvatar = Util.safePath(avatarImg?.getAttribute('data-src') || avatarImg?.getAttribute('src') || '');

      const status = parseStatus(text(tr.querySelector('.status')) || text(tds[2]));

      // 进度：主条的 aria-valuenow 是百分比，分数在 .sr-only 里（原站把它压在条子上导致串色）
      const bar = tr.querySelector('.progress-bar');
      let pct = Number(bar?.getAttribute('aria-valuenow'));
      if (!Number.isFinite(pct)) {
        const w = bar?.getAttribute('style')?.match(/width:\s*([\d.]+)%/);
        pct = w ? Number(w[1]) : 0;
      }
      const frac = text(tr.querySelector('.progressbar-width')).match(/([\d,]+)\s*\/\s*([\d,]+)/);
      const done = frac ? Number(frac[1].replace(/,/g, '')) : null;
      const total = frac ? Number(frac[2].replace(/,/g, '')) : null;

      // 设备：单元格 data-sort 是位掩码（CPU=1 / GPU=8，见站点 addproject.js 的算法），
      // 比按图标文件名判定稳得多；掩码缺失时才回退到读 img。
      const devCell = tds[4];
      const mask = Number(devCell?.getAttribute('data-sort'));
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

      // 内存：显示文本保留，同时留一份 KB 原值供排序
      const memCell = tds[5];
      const memText = text(memCell);
      const memKb = Number(memCell?.getAttribute('data-sort'));
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

  /** 排行榜 → 结构化数组（利用站点自带的 data-sort 原始数值，精度最高） */
  function parseRanking(html) {
    const doc = parse(html);
    const rows = [...doc.querySelectorAll('table tr')].filter((tr) => tr.querySelector('td'));
    const out = [];
    for (const tr of rows) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 5) continue;
      const link = tr.querySelector('a[href*="/user/"]');
      // 排行榜页的头像在 <a> 的兄弟节点里（<span class="avatar-small"><img></span> <a>名字</a>），
      // 与项目页（img 在 a 内部）结构不同，两种都要兜住。
      const av = tr.querySelector('td .avatar-small img') || tr.querySelector('td img.avatar') || link?.querySelector('img');
      const numOf = (td) => {
        const raw = td.getAttribute('data-sort');
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
        return Number(text(td).replace(/[^\d.]/g, '')) || null;
      };
      out.push({
        rank: text(tds[0]),
        rankNum: numOf(tds[0]),
        user: link ? text(link) : text(tds[1]),
        // 链接地址里的用户名才是可靠的身份：显示名可能和 URL 里的不一样，
        // 只有 URL 里那个能打开对的人（项目页的 ownerId 同理）。
        userId: link ? decodeURIComponent((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
        avatar: Util.safePath(av?.getAttribute('data-src') || av?.getAttribute('src') || ''),
        frames: numOf(tds[2]),
        seconds: numOf(tds[3]),
        points: numOf(tds[4]),
      });
      if (out.length >= 500) break;
    }
    return out;
  }

  /**
   * 账户设置页（/user/<u>/edit）→ 结构化设置。
   *
   * 两个原则：
   *  1) 动作地址从 onclick 里读出来，不自己拼路径 —— 站点改了前缀我们也不会失准；
   *  2) 整页的 11 个分区其实都在 DOM 里（站点用 display 切换），所以一次抓取就够。
   */
  function parseAccount(html) {
    const doc = parse(html);

    const checked = (id) => {
      const el = doc.getElementById(id);
      return el ? el.hasAttribute('checked') : null;
    };

    // 当前邮箱：分区里那句带 @ 的说明文字
    const emailBox = doc.getElementById('profile_edit_category_email');
    const email = emailBox
      ? ([...emailBox.querySelectorAll('p')].map(text).find((s) => /@/.test(s)) || '')
      : '';

    // 当前头像：这一页只有一张 big 头像
    const bigImg = doc.querySelector('img[src*="/avatar/big/"], img[data-src*="/avatar/big/"]');
    const avatar = Util.safePath(
      ((bigImg && (bigImg.getAttribute('src') || bigImg.getAttribute('data-src'))) || '').replace(/^\.\.\/\.\.\//, '/'),
    );

    /** 用户列表：每行一个头像 + 用户名 + "移除"按钮，按钮的 onclick 里带动作 URL */
    function userList(rootId, action) {
      const root = doc.getElementById(rootId);
      if (!root) return [];
      const out = [];
      for (const input of root.querySelectorAll('input[onclick]')) {
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

    // 渲染密钥：表里前三列是 密钥 / 备注 / 是否在用
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

    /* 赞助（捐赠积分）：你渲染挣到的积分会给名单里的随机一位。
       两个开关的 name/id 与各自的 label 是**错位**的（id 叫 sponsor_receive_enable 的那格
       写的却是 "Enable Sponsoring"），所以只认 onclick 里的
       /user/sponsor/give|receive/enable/<0|1>：状态读 checked，动作读 onclick。
       与优先级开关同一套路 —— 不自己拼 URL。 */
    function sponsorSwitch(kind) {
      const re = new RegExp(`/user/sponsor/${kind}/enable/\\d`);
      const el = [...doc.querySelectorAll('input[onclick]')]
        .find((i) => re.test(String(i.getAttribute('onclick'))));
      if (!el) return null;
      const m = String(el.getAttribute('onclick')).match(re);
      return { on: el.hasAttribute('checked'), action: m ? m[0] : '' };
    }

    /* 赞助名单：名单为空时站点根本不渲染这些行，所以按"行里有 /user/<名字>/profile 链接"认；
       移除按钮的动作同样从 onclick 里读。我们自己的名单是空的，没有样本可抄 —— 就不猜 URL，
       读不到动作时那一行只显示、不给按钮（与优先级那格同一条规矩：状态不明的地方不给动作）。 */
    const sponsored = [];
    const addInput = doc.getElementById('account_add_sponsor');
    /* 「添加」按钮的动作前缀：站点的 onclick 一律长这样 ——
         requestActionThemShowOnId('/user/xxx/add/' + $('#输入框').val(), …)
       从 DOM 里读出来，绝不自己拼一串。优先级 / 两个黑名单 / 捐赠 四处都走这里。 */
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
      // 四处「添加」的动作前缀，全部从站点 onclick 里读出来的（不自己拼 URL）
      add,
      priority: userList('profile_high_priority_users', 'remove').map((x) => ({ name: x.name, action: x.action, avatar: x.avatar })),
      blockedRenderers: userList('profile_blacklist_renderer', 'remove'),
      blockedOwners: userList('profile_blacklist_owner', 'remove'),
      renderKeys,
      email,
      avatar,
    };
  }

  /** 从任意页面判断登录态与当前用户名 */
  function detectUser(doc) {
    const menu = doc.querySelector('.navbar-user');
    const link = menu?.querySelector('a[href*="/user/"]');
    const m = link?.getAttribute('href')?.match(/\/user\/([^/]+)\//);
    const signedIn = !!m && !menu.textContent.includes('Please sign in');
    // 导航栏里那张小头像永远是**当前登录者**的（站点自己写的）。
    // 顶栏必须用它 —— 拿"正在看的这份档案"的头像，去看别人主页时就会串成别人的脸。
    const img = menu?.querySelector('img');
    const avatar = Util.safePath(((img && (img.getAttribute('data-src') || img.getAttribute('src'))) || '').replace(/^\.\.\/\.\.\//, '/'));
    return { signedIn, userName: m ? decodeURIComponent(m[1]) : null, avatar };
  }

  SP.Api = {
    fetchPage, fetchJson, invalidate, cache, post,
    parseProfile, parseHome, parseProjects, parseRanking, parseStatBoxes, detectUser,
    parseAccount, parseMachines, parseSession, parseTimeline,
    extractArray, computeDerived,
  };
})();
