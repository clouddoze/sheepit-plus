// ==UserScript==
// @name         SheepIt Plus · 渲染农场界面重制
// @name:en      SheepIt Plus · Renderfarm UI Rebuild
// @namespace    https://github.com/clouddoze
// @version      0.1.7
// @description  把 SheepIt Render Farm 的老旧界面整个换掉：现代化仪表盘、可读的项目列表、精确排行榜，中英双语，明暗双主题。数据全部来自站内页面，不向任何第三方发送。
// @description:en  Rebuild the outdated SheepIt Render Farm UI: a modern dashboard, a readable project list, an accurate ranking. Bilingual (zh/en), dark/light themes. All data is parsed from your own session; nothing is sent anywhere.
// @author       clouddoze
// @match        https://www.sheepit-renderfarm.com/*
// @exclude      https://www.sheepit-renderfarm.com/forum/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://greasyfork.org/scripts/598624
// @supportURL   https://greasyfork.org/scripts/598624/feedback
// @updateURL    https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.user.js
// ==/UserScript==

/* 回填记录（清单见 docs/PUBLISHING.md 的「四」，2026-10-04 首次发布时填妥）：
 *
 *   @namespace   https://github.com/clouddoze —— 首次上传前定死，此后不可再改。
 *                Tampermonkey 与 Violentmonkey 用 @name + @namespace 认脚本身份，
 *                发布后改动会让已装用户收不到更新，并在他们那里变成两个脚本。
 *
 *   @updateURL / @downloadURL 里的中文 slug 是 GreasyFork 给的那一条（脚本页「安装此脚本」
 *                的原样地址）。服务端按 /scripts/<id>/ 取脚本，slug 只影响可读性 ——
 *                实测换成 SheepIt%20Plus.user.js 也能取到，但跟站点保持一致最稳。
 *
 *   以后发新版：改上面的 @version → node build.mjs → 在 GreasyFork 脚本页点「更新」。
 *   已装用户由 @updateURL 拉 .meta.js 比对版本号，所以 @version 必须往上走。
 */

/* sheepit-plus v0.1.7 — 由 build.mjs 生成，请勿直接编辑。源码见 src/ */

/* ===== src/10-core.js ===== */
/* ==========================================================================
 * 10-core.js — 基础设施：命名空间 / 工具函数 / i18n / 主题
 * ========================================================================== */
(function () {
  'use strict';

  const NS = 'sheepit-plus';
  const SP = (window.__SHEEPIT_PLUS__ = window.__SHEEPIT_PLUS__ || {});
  SP.NS = NS;

  /* ---------------------------------------------------------------- 工具 */

  const Util = {
    /** 界面整体缩放（设置里那个百分比）：#sp 上挂的是 CSS zoom，于是它的
     *  getBoundingClientRect() 给的是**物理**像素，而它内部写 left/top 用的是 CSS 像素 ——
     *  凡是按 rect 量出来的位移，都要除以这个比值才能当长度用。比值从宿主自己量，跟着设置走。 */
    zoomOf(el) {
      if (!el) return 1;
      const w = el.clientWidth;
      const r = el.getBoundingClientRect().width;
      return w > 0 && r > 0 ? r / w : 1;
    },

    /** 数字千分位；非数字原样返回 */
    num(v) {
      if (v === null || v === undefined || v === '') return '—';
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n.toLocaleString('en-US') : String(v);
    },

    /** 站点给的统计值 → 显示文本。带 K/M/G 这类量级后缀的**原样保留**。
     *  站点对别人的积分只给 "342.6 M"（那一长串 title 只是"积分怎么算"的说明，不含精确值），
     *  而 num() 会把非数字字符全剥掉 —— 342.6 M 就成了 342.6，少六个数量级。
     *  所以：站点给什么就显示什么，既不换算、也不假装有它没给的精度。 */
    statNum(v) {
      const s = String(v === null || v === undefined ? '' : v).trim();
      if (!s) return '—';
      const m = s.match(/^([\d.,]+)\s*([KMGTPE])$/i);
      if (m) return `${m[1]} ${m[2].toUpperCase()}`;
      return Util.num(s);
    },

    /** 把秒数渲染成 1y245d21h 这种紧凑格式（整点时不拖一个没意义的 0h） */
    duration(sec) {
      const s = Number(sec);
      if (!Number.isFinite(s) || s <= 0) return '—';
      const d = Math.floor(s / 86400);
      const y = Math.floor(d / 365);
      const rd = d - y * 365;
      const h = Math.floor((s % 86400) / 3600);
      let out = '';
      if (y > 0) out += `${y}y`;
      if (rd > 0 || y > 0) out += `${rd}d`;
      if (h > 0 || !out) out += `${h}h`;
      return out || `${Math.floor((s % 3600) / 60)}m`;
    },

    /** 大数压缩：1339098454 -> 1.3 G */
    compact(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return Util.num(v);
      const abs = Math.abs(n);
      if (abs >= 1e9) return (n / 1e9).toFixed(1) + ' G';
      if (abs >= 1e6) return (n / 1e6).toFixed(1) + ' M';
      if (abs >= 1e3) return (n / 1e3).toFixed(1) + ' K';
      return String(n);
    },

    /** Date → 'YYYY-MM-DD'（统一走 UTC，避免本地时区把日期挪一天） */
    dkey(d) { return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10); },

    /** 日期键平移 n 天 */
    dshift(key, n) {
      const x = new Date(`${key}T00:00:00Z`);
      x.setUTCDate(x.getUTCDate() + n);
      return Util.dkey(x);
    },

    /** 两个日期键之间的天数（b - a） */
    ddiff(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000); },

    /** 'YYYY-MM-DD' → 'YYYY-MM' */
    mkey(key) { return String(key).slice(0, 7); },

    /** 坐标轴上限：把最大值抬到一个「能被 3 整除的好数字」，供 4 条网格线等分。
     *  与样张一致 —— 实测 3.547e8 → 3.6e8，曲线占满 98% 高度，而不是缩在下半截。 */
    niceTop(max) {
      const m = Number(max);
      if (!Number.isFinite(m) || m <= 0) return 1;
      const raw = m / 3;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      const LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
      const step = (LADDER.find((x) => x >= norm - 1e-9) || 10) * mag;
      return step * 3;
    },

    /** 时长文案 → {y,d,h,m}；"1 year, 245 days" / "1y 245d 21h" 都吃得下，解析不出返回 null */
    timeParts(text) {
      const re = /([\d.]+)\s*(years?|yrs?|y|months?|mos?|days?|d|hours?|hrs?|h|minutes?|mins?|m)/gi;
      let y = 0, d = 0, h = 0, m = 0, hit = false, mm;
      while ((mm = re.exec(String(text || '')))) {
        const n = Number(mm[1]);
        if (!Number.isFinite(n)) continue;
        const u = mm[2].toLowerCase();
        hit = true;
        if (/^y/.test(u)) y += n;
        else if (/^mo/.test(u)) d += n * 30;
        else if (/^d/.test(u)) d += n;
        else if (/^h/.test(u)) h += n;
        else m += n;
      }
      return hit ? { y, d, h, m } : null;
    },

    /** 站点时长文案 → 紧凑的 1y245d21h；解析不出返回 null（站点给纯秒数时由调用方走 duration()） */
    compactTime(text) {
      const p = Util.timeParts(text);
      if (!p) return null;
      let { y, d, h, m } = p;
      h += Math.floor(m / 60); m = Math.round(m % 60);
      d += Math.floor(h / 24); h = Math.floor(h % 24);
      y += Math.floor(d / 365); d = Math.floor(d % 365);
      let out = '';
      if (y >= 1) { y = Math.round(y); out += `${y}y`; }
      if (d >= 1 || y >= 1) out += `${Math.round(d)}d`;
      if (h >= 1 || !out) out += `${Math.round(h)}h`;
      return out || `${Math.round(m)}m`;
    },

    /** 把它渲染成人类读的紧凑时长：纯秒数走 duration()，其余走 compactTime() */
    renderTime(raw) {
      const s = String(raw === null || raw === undefined ? '' : raw).trim();
      if (!s) return '—';
      if (/^\d+$/.test(s)) return Util.duration(Number(s));
      return Util.compactTime(s) || s;
    },

    /** 站点时长文案 → 天数（"1y 245d 21h" / "1 year, 245 days"）；解析不出返回 null */
    durDays(text) {
      const p = Util.timeParts(text);
      if (!p) return null;
      return Math.round(p.y * 365 + p.d + p.h / 24 + p.m / 1440);
    },

    /** HTML 转义：站点返回的用户名/项目名是不可信输入 */
    esc(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** 只保留同站路径，避免把脚本注入的绝对 URL 带进来。
     *  空串必须返回 null —— new URL('', origin) 会解析成当前页地址，
     *  若不拦住，懒加载图片（只有 data-src、还没有 src）会被算成 "/"。 */
    safePath(u) {
      const s = String(u === null || u === undefined ? '' : u).trim();
      if (!s) return null;
      if (/^\/(?!\/)/.test(s)) return s;
      try {
        const url = new URL(s, location.origin);
        return url.origin === location.origin ? url.pathname + url.search : null;
      } catch (e) { return null; }
    },

    /** 用 DOMParser 解析一段 HTML（不执行其中的脚本） */
    parse(html) {
      return new DOMParser().parseFromString(html, 'text/html');
    },

    /** 取元素文本，剔除 <script>/<style> 以免把内联数据当成正文 */
    text(el) {
      if (!el) return '';
      const c = el.cloneNode(true);
      c.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
      return c.textContent.replace(/\s+/g, ' ').trim();
    },

    /** 存储（带前缀，避免污染站点自己的 key） */
    store: {
      get(k, d) { try { const v = localStorage.getItem(`${NS}:${k}`); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(`${NS}:${k}`, JSON.stringify(v)); } catch (e) { /* 隐私模式等 */ } },
    },

    /** 简易请求去重：同一 URL 的并发请求合并 */
    once(map, key, fn) {
      if (map[key]) return map[key];
      const p = fn().finally(() => { delete map[key]; });
      map[key] = p;
      return p;
    },
  };

  /* ---------------------------------------------------------------- i18n */

  const DICT = {
    zh: {
      'nav.overview': '总览', 'nav.projects': '项目', 'nav.ranking': '排行榜', 'nav.settings': '设置',
      'nav.account': '账户设置', 'nav.rankingShort': '排行', 'nav.accountShort': '账户',
      'top.refresh': '刷新', 'top.updated': '更新于', 'top.loading': '加载中…',
      'hero.rank': '排名', 'hero.team': '团队', 'hero.joined': '注册于', 'hero.points': '积分',
      'stat.frames': '已渲染帧数', 'stat.points': '积分', 'stat.time': '累计渲染时长',
      'stat.streak': '当前连续', 'stat.days': '天',
      'stat.streakHint': '历史最长 {best} 天 · 近 30 天活跃 {d30} 天',
      'stat.streakFull': '历史最长 {best} 天 · 近 30 天全勤',
      // 站点原文词条：身份条里的徽章与客户端状态。键由原文 slug 化得来（见 50-views.js packLabel）
      'badge.top-10-renderers': 'TOP 10% 渲染者',
      /* 站点原文是 "Waiting to render projects" / "Rendering projects" / "Disconnected"，
         说的是**这个用户自己客户端**的状态（站点把它写在 "Connected as 你" 那个框里），
         不是全站队列 —— 原来译成"等待领取渲染任务"，容易被读成"农场在等活"。 */
      'status.idle': '客户端待命中',
      'status.rendering': '正在渲染',
      'status.renderingFor': '正在为 {user} 渲染',
      'status.disconnected': '客户端未连接',
      'hero.statusRaw': '站点原文：{raw} —— 指你自己客户端的状态，不是全站队列',
      'stat.avgPeak': '日均 {avg} 帧 · 峰值 {peak}',
      'stat.rankWindow': '全站排名 {rank} · 30 天滚动',
      'stat.daysEquiv': '约 {days} 天机时',
      // 发布者身份：只有建过项目的人才有非零值，0 时不占格子
      'stat.created': '建的项目', 'stat.createdHint': '你上传的任务数',
      'stat.ordered': '订的帧', 'stat.orderedHint': '为你自己的项目下单的帧数',
      'site.title': '全站实时', 'site.frames': '待渲染帧', 'site.projects': '进行中项目',
      'site.clients': '在线客户端', 'site.processing': '正在处理帧',
      'chart.points': '积分增长', 'chart.frames': '渲染帧数增长',
      'chart.tipPoints': '积分',
      'chart.pointsSub': '{n} 个采样点 · {from} → {to} · 当前 {now}',
      'chart.framesSub': '{n} 个采样点 · 当前 {now} 帧',
      'months.title': '月度产出', 'months.sub': '按月汇总',
      'months.max': '最高月', 'months.min': '最低月',
      'heat.title': '渲染产出', 'heat.sub': '近 53 周 · 每格一天 · 按当天帧数着色',
      'heat.legendLow': '少', 'heat.legendHigh': '多',
      'heat.note': '{nz} 天有产出 · 峰值 {peak} 帧',
      'heat.total': '合计 {n} 帧', 'heat.frame': '帧',
      // 站点只在自己的主页内联逐日帧数；别人的主页只有"这天有没有渲染"的日历（二值）。
      // 那份数据原站也是拿来画热力图的，所以照样画 —— 但口径必须说清楚。
      'heat.subDays': '近 53 周 · 每格一天 · 亮起 = 那天有渲染',
      'heat.noteDays': '{nz} 天有渲染',
      'heat.totalDays': '合计 {n} 天',
      'heat.legendOff': '没渲染', 'heat.legendOn': '有渲染',
      'heat.none': '站点没有为这个账号提供产出日历',
      'empty.title': '还没有渲染记录',
      'empty.body': 'SheepIt 靠每个人的算力拼起来。装上客户端、挂着它，你的电脑就开始替别人的项目出帧——这里会记下你贡献的每一帧。',
      'empty.s1h': '装客户端', 'empty.s1b': 'Windows / macOS / Linux / Docker，登录你的账号即可。',
      'empty.s2h': '挂着它', 'empty.s2b': '不需要开着 Blender。空闲算力会自动领活。',
      'empty.s3h': '换积分', 'empty.s3b': '渲染别人 38 分/分钟，自己的项目花 10 分/分钟。',
      'empty.cta1': '下载客户端', 'empty.cta2': '了解规则',
      'machines.title': '在线机器', 'machines.sub': '当前连接', 'machines.online': '在线',
      'sessions.title': '最近会话', 'sessions.sub': '共 {n} 条记录',
      'news.title': '最新动态',
      'proj.title': '进行中项目', 'proj.count': '共 {n} 个',
      /* 发布者那一格的渲染优先级开关（端点与账户设置页同一批） */
      'proj.prio.inList': '已在你的渲染优先级名单里',
      /* 发布者那一格的 3 点菜单。三项都是"把这个人放进某份名单"：
           优先 = 渲染优先级；捐赠积分 = 赞助名单（你挣的积分会给 TA）；黑名单 = 不渲染 TA 的项目。
         已在名单里时文案翻成撤回、右边打勾；名字后面另有常驻标记（星 / 心 / 禁止符）。 */
      'proj.menu.open': '更多动作', 'proj.menu.title': '把这个发布者…',
      'proj.menu.prio': '优先渲染 TA 的项目', 'proj.menu.unprio': '移出渲染优先级',
      'proj.menu.gift': '捐赠积分给 TA', 'proj.menu.ungift': '不再捐赠给 TA',
      'proj.menu.block': '加入黑名单（不渲染 TA 的项目）', 'proj.menu.unblock': '移出黑名单',
      'proj.menu.gifted': '已在你的捐赠名单里', 'proj.menu.blocked': '已在你的黑名单里',
      'proj.search': '搜索项目或渲染者…', 'proj.all': '全部',
      'proj.col.project': '项目', 'proj.col.owner': '发布者', 'proj.col.status': '状态',
      'proj.col.progress': '进度', 'proj.col.device': '设备', 'proj.col.memory': '内存',
      'proj.cpu': 'CPU', 'proj.gpu': 'GPU', 'proj.frames': '帧',
      'proj.status.renderingN': '{n} 帧渲染中', 'proj.status.rendering': '渲染中',
      'proj.status.waiting': '等待中', 'proj.status.paused': '已暂停',
      'proj.empty': '没有匹配的项目', 'proj.showing': '显示 {n} / {total}', 'proj.showingN': '显示前 {n} 个',
      'list.more': '显示更多', 'list.shown': '已显示 {n} / {total}',
      /* 界面模式：给习惯旧界面的人一条退路，也给自己留一个"先关掉看看"的开关 */
      'mode.toClassic': '切回原版界面', 'mode.toModern': '切换到现代化界面',
      // 悬浮 pill 上写的是**动作**而不是状态：原来写"原版界面 · 点此切回"，
      // 前半句是状态、后半句是要做的事，读起来像个标签而不像按钮。
      'mode.classicHint': '切回新界面', 'mode.classicTip': '点这里回到 SheepIt Plus 的现代化界面',
      'mode.enter': '进入新界面', 'mode.enterTip': '这一页没有重制版，点此去新界面的总览',
      /* /getstarted 那种**半接管**页：这一页确实有重制过的部分（上传那一段），
         所以不能说"没有重制版" —— 浮窗是去完整界面的入口，不是"这一页没做"。 */
      'mode.partialTip': '这一页只有上传那一段是新界面 —— 点此打开完整的新界面',
      /* 已连接的机器 */
      'machines.title': '已连接的机器', 'machines.count': '共 {n} 台',
      'machines.none': '当前没有连着算力的客户端',
      'machines.open': '查看会话', 'machines.unknown': '未识别机型',
      /* 渲染产出：日期轴 */
      'heat.weekday': '一,三,五', 'heat.tip': '{n} 帧',
      'heat.tipOn': '有渲染', 'heat.tipOff': '没有渲染',
      /* 账户设置 */
      'nav.account': '账户设置',
      'account.title': '账户设置', 'account.sub': '这些表单直接提交到站点自己的接口，和你原来在这个页面上操作是同一件事。',
      /* 账户页选项卡。站点自己那张页面也是分类切换的（Scheduler / Blacklist / Sponsorship / …），
         这里按"一次只想看一件事"分四档 —— 七块面板堆成一列太长了。 */
      'account.tab.sched': '调度与名单',
      'account.tab.sponsor': '捐赠积分', 'account.tab.account': '账户',
      'account.only': '只能管理自己的账户',
      'account.onlyHint': '你正在查看 {user} 的账户设置，但那不是你的账号。',
      'account.scheduler': '调度设置', 'account.schedulerHint': '决定优先渲染谁的项目：优先级由低到高是 其他用户 < 我的团队 < 我自己。',
      'account.sched.mine': '优先渲染我自己的项目',
      'account.sched.mineHint': '默认开启。如果你的机器较旧，交给调度器挑更轻的帧可能更划算。',
      'account.sched.team': '优先渲染我团队的项目',
      'account.sched.heavy': '重负载项目优先',
      'account.sched.heavyHint': '机器很强（> 200%）时开启，可以减少"下载解压"相对于渲染的占比。',
      'account.priority': '渲染优先级', 'account.priorityHint': '这些发布者的项目会被优先领取。',
      // 站点自己那个输入框是按**用户名**自动补全的（source=/user/list_from_term），不是 ID
      'account.priorityAdd': '输入用户名后回车', 'account.add': '添加', 'account.remove': '移除',
      // 捐赠积分（站点叫 Sponsorship）
      'account.sponsor': '捐赠积分', 'account.sponsorSub': '站点叫 Sponsorship',
      'account.sponsorHint': '把你在渲染中挣到的积分送出去：每渲染一帧，这一帧的积分会给名单里随机一位，而不是进你自己的账户。站点那句话说得对 —— SheepIt 靠的是社区。',
      'account.sponsor.give': '开启捐赠', 'account.sponsor.giveHint': '关掉之后，新挣的积分不再送给名单里的人。',
      'account.sponsor.receive': '接收别人的赞助', 'account.sponsor.receiveHint': '关掉之后，别人把你加进名单时你不会收到积分。',
      'account.sponsorList': '受赞助的用户', 'account.sponsorEmpty': '名单还是空的',
      'account.sponsorAdd': '输入用户名后回车',
      'account.avatar': '头像', 'account.avatarHint': '图片会被裁成正方形。',
      'account.avatarPick': '选择图片', 'account.avatarSave': '上传新头像',
      'account.email': '邮箱', 'account.emailNew': '新的邮箱地址', 'account.emailSave': '更换邮箱',
      'account.keys': '渲染密钥', 'account.keysHint': '给每台机器一个独立密钥：只要客户端用密钥登录，就不必把账号密码写进客户端配置。',
      'account.keys.comment': '备注（必填，便于分辨是哪台机器）',
      'account.keys.add': '新建密钥', 'account.keys.inUse': '使用中', 'account.keys.free': '空闲',
      'account.keys.del': '删除', 'account.keys.delConfirm': '删除这个渲染密钥？正在用它登录的客户端会掉线。',
      /* 两个黑名单的原文（站点自己的说明）：
           Blacklist renderer — "These users will not render my projects."
           Blacklist owner    — "I will not render projects of these users."
         之前这两块的中文名与提示**正好反了**（连"发布者/渲染者"两个词都互换了），
         会让人往错的名单里拉人，2026-10-04 按站点原文改正。 */
      'account.block.renderer': '不让他们渲染我的项目', 'account.block.rendererHint': '名单里的人不能领取你的项目 —— 他们的机器不会渲染你的帧。',
      'account.block.owner': '不渲染这些人的项目', 'account.block.ownerHint': '名单里的发布者：他们的项目不会被派给你的机器。',
      'account.block.add': '加入黑名单',
      'account.saving': '提交中…', 'account.ok': '已保存', 'account.failed': '站点返回：{msg}',
      'account.empty': '（空）',
      'rank.title': '渲染者排行榜', 'rank.sub': '按 30 天滚动周期计分',
      'rank.col.rank': '名次', 'rank.col.user': '渲染者', 'rank.col.frames': '已渲染帧数',
      'rank.col.time': '渲染时长', 'rank.col.points': '获得积分',
      'rank.you': '你', 'rank.count': '共 {n} 位渲染者',
      'state.loading': '正在读取站点数据…',
      'state.error': '读取失败', 'state.retry': '重试',
      'state.loggedOut': '未检测到登录状态',
      'state.loggedOutHint': 'SheepIt Plus 依赖你的登录会话读取数据。请先在原站登录，然后刷新本页。',
      'state.loggedOutBtn': '前往原站登录',
      'state.empty': '暂无数据',
      'set.title': '设置', 'set.theme': '主题', 'set.theme.auto': '跟随系统',
      'set.theme.dark': '暗色', 'set.theme.light': '亮色',
      'set.lang': '界面语言', 'set.lang.auto': '跟随浏览器',
      'set.scale': '界面缩放', 'set.scaleHint': '觉得小就调大。整块界面按这个比例缩放 —— 字号、间距、图表一起走，不是只放大字。',
      'set.langHint': '语言包是数据不是代码：新增一门语言只需注册一个词表，界面会自动列出，无需改动任何逻辑。',
      'set.translate': '翻译原站页面', 'set.on': '开启', 'set.off': '关闭',
      'set.translateHint': '未重建的页面（FAQ、服务器、Get started 等）用 {n} 条词条在本地翻译。不联网、不上传任何文本；词典里没有的字符串（项目名、用户名、新闻正文）保持原样，不会被误译。',
      'set.about': '关于', 'set.aboutText':
        'SheepIt Plus 是一个纯前端界面重制脚本。它读取你本已能看到的站点页面，用新界面渲染出来。不调用任何私有接口，不向任何第三方发送数据。仅有的三处会改动服务器状态的地方，都是你自己点下的按钮 —— 「账户设置」里的提交、机器会话页上的暂停/恢复，以及项目列表里发布者那格的「优先 / 移出」—— 它们提交的是站点自己的地址，和你原来在那些页面上操作是同一件事。',
      'set.dangerHint': '如需恢复原版界面，用右上角的「切回原版界面」，或在设置里停用本脚本后刷新。',
      'footer.source': '数据来源：站点自身页面 · 未调用私有接口',
      /* 会话页：一台机器的档案 */
      'sess.owner': '属主', 'sess.client': '客户端', 'sess.unknownHost': '未命名主机',
      'sess.on': '运行中', 'sess.off': '已暂停',
      // 站点那行无标签的状态行把两种暂停分开写了（见 20-api.js 的 info.note）：
      // 服务器端点暂停是 "Paused server side"，客户端自己暂停是 "Paused client side"。
      'sess.pausedServer': '服务器端已暂停', 'sess.pausedClient': '客户端已暂停',
      'sess.statusRaw': '站点原文：{raw}',
      // 身份条上那一句"这台机器此刻在跑什么"。暂停时说"当前作业"而不是"正在渲染"，
      // 否则会和旁边那枚「已暂停」徽章自相矛盾。
      'sess.rendering': '正在渲染', 'sess.currentJob': '当前作业', 'sess.frame': '帧',
      'sess.status.enable': '已启用', 'sess.status.disable': '已停用',
      'sess.noId': '地址里没有会话编号', 'sess.parseFailed': '这一页没读到机器信息',
      'sess.kpi.frames': '已渲染帧数', 'sess.kpi.points': '获得积分',
      'sess.kpi.maxTime': '单帧渲染时长上限',
      'sess.kpi.since': '自 {t} 起', 'sess.kpi.perFrame': '每帧约 {n} 分',
      'sess.kpi.powerLink': '各机型算力榜',
      'sess.facts': '机器信息', 'sess.factsSub': '站点报告的原值，未做换算',
      'sess.f.cpu': '处理器',
      // 算力那一格的标签跟着站点印的是哪一行走（见 50-views.js 的 powerFacts）
      'sess.f.power': 'CPU 性能', 'sess.f.powerGpu': 'GPU 性能',
      'sess.f.gpu': '显卡', 'sess.f.vram': '显存',
      'sess.f.driver': '驱动', 'sess.f.computeDevice': '计算设备',
      'sess.f.ramAllowed': '渲染可用内存', 'sess.f.ramAvailable': '物理内存',
      'sess.f.scheduler': '调度模式', 'sess.f.createdAt': '创建时间',
      'sess.f.lastRequest': '最后请求', 'sess.f.lastRequestJob': '最后请求作业',
      'sess.f.lastValidatedJob': '最后验证作业', 'sess.f.ua': '运行环境',
      'sess.f.renderKey': '渲染密钥', 'sess.f.action': '可用动作',
      'sess.reveal': '显示', 'sess.hide': '隐藏',
      'sess.control': '机器控制', 'sess.pause': '暂停这台机器', 'sess.resume': '恢复渲染',
      'sess.controlHint': '提交到站点自己的地址，和原站那个按钮是同一件事。暂停后客户端会停止领活，恢复要等它下一次连上才生效。',
      'sess.timeline': '时间线', 'sess.tlSub': '共 {n} 条 · {from} → {to} · 本机时区',
      'sess.tlSubEmpty': '站点没有返回记录', 'sess.tlNone': '这台机器还没有事件记录',
      'sess.tlFailed': '时间线没取到（站点接口没有回应），机器信息不受影响',
      /* 活动汇总（默认视图）与完整日志（折叠） */
      'sess.act.day': '日期', 'sess.act.month': '月份', 'sess.act.render': '渲染时长',
      'sess.act.events': '事件', 'sess.act.jobs': '作业', 'sess.act.failed': '失败',
      'sess.act.moreDay': '更早的 {n} 天没有列在这里', 'sess.act.moreMonth': '更早的 {n} 个月没有列在这里',
      'sess.logOpen': '查看完整日志（{n} 条）', 'sess.logClose': '收起完整日志',
      'sess.publisher': '发布者',
      'sess.col.type': '事件', 'sess.col.job': '作业', 'sess.col.start': '开始',
      'sess.col.end': '结束', 'sess.col.span': '时长',
      'sess.projects': '可渲染项目', 'sess.prjSub': '共 {n} 个 · 按当前调度都不会派给这台机器',
      'sess.prjNone': '当前没有能派给这台机器的项目', 'sess.whyNone': '未给出原因',
      'sess.tl.rendering': '渲染', 'sess.tl.request': '领任务', 'sess.tl.validate': '校验',
      'sess.tl.login': '登录', 'sess.tl.senderror': '发送失败', 'sess.tl.send': '发送',
      'sess.tl.error': '错误',

      /* ---- 项目上传页（/getstarted 的「Add your project」那一段） ----
         这一页是「下载客户端」和「上传项目」两件事共用一个地址。我们只接管上传那一段，
         下载指南保持原站 —— 所以下面这段文案是**局部接管**的标题，不是整页标题。 */
      'up.title': '上传项目', 'up.sub': '把 .blend 或 ZIP 交给农场，站点的分析器会先读一遍',
      'up.formTitle': '选择文件',
      'up.estTitle': '渲染用时估算',
      'up.rulesTitle': '交之前先过一遍',
      /* 这一句很重要：说明这块为什么长着原站的样子但数字是真的 */
      'up.origin': '这些数字（体积上限、渲染器、图块数、单帧上限）都是站点这次渲染时当场给的，脚本里没有写死任何一个。',
      'up.noForm': '这一页现在没有可上传的表单 —— 多半是没登录，或者站点暂时关了上传。',
      'up.blocked': '站点当前不允许这个账号上传项目',
      /* 这一句顶掉的是站点原文（"Max: … before ZIP compression"）。它必须由我们来说：
         那句话和文件框在同一个 <td> 里，翻译层一旦整块替换就会把文件框删掉。 */
      'up.maxNote': '单个文件上限 {size}，指的是 ZIP 压缩之前的大小；Blender 自带的压缩受支持，也推荐用。',
      /* ---- 上传后的「正在分析」等待页 ---- */
      'an.title': '正在分析你的项目',
      'an.sub': '站点要先读一遍存档，才知道里面有几个 .blend、帧区间和分辨率是多少',
      'an.waiting': '排队等分析器接手…',
      'an.processing': '分析器正在读：{done} / {total} 个文件',
      'an.reading': '分析器正在读存档…',
      'an.slow': '几分钟是正常的，存档越大越久。这一页可以一直开着；关掉也不会中断分析，回头再打开接着看。',
      'an.failed': '分析接口没回应（{err}）。这不是你的存档出了问题 —— 重新载入这一页就能接着等。',
      'an.noToken': '地址里没有分析编号，这一页打不开。',
      'an.gone': '这个分析编号已经找不到了 —— 多半是分析早就完成、这一页过期了。回「上传项目」重新传一次，或者去项目列表看看。',
      'an.doneTitle': '分析完成',
      'an.doneNote': '接下来这一步（引擎、帧区间、切块、采样、分辨率…）本版还没有重制，用的是站点自己的表单：功能完整，外观是原站的。填完提交就会跳到项目管理页。',

      /* 站点在「可渲染项目」里给的原因（键由原文 slug 化得来，见 50-views.js packLabel） */
      'why.no-big-archive-download-on-this-computer': '本机没有大存档下载',
      /* 站点原文是 "Over user's time limit"。这里的 user 是**机器主人**、time limit 是他在
         客户端里设的「单帧渲染时长上限」—— 不是发布者的时限（早先就译错成"超出发布者的时限"）。
         站点判定：这一帧在参考机上的用时超过本机上限，于是不派给它。 */
      'why.over-user-s-time-limit': '预计超过本机单帧上限',
      // 站点把"能渲染"也写成这一列的一个值（不是留空），而且可渲染的全排在表的最前面 ——
      // 那些行的顺序就是优先级，见 50-views.js 里可渲染项目表的注释。
      'why.renderable': '现在可渲染',
      'why.computer-has-previously-failed-to-render-project': '这台机器之前渲染它失败过',
      'why.requires-gpu': '需要 GPU',
      'why.project-rate-limited-due-to-lack-of-points': '发布者积分不足被限流',
      'why.project-too-heavy-for-this-computer': '这台机器带不动这个项目',
      'why.cannot-render-due-to-criterionprojectisoverfilesize': '项目文件超出体积上限',
      'why.cannot-render-due-to-criterionprojectnearlyfinish': '项目已接近完成',
      'why.project-is-not-fully-synced-on-all-mirrors': '项目还没同步到所有镜像',
    },
    en: {
      'nav.overview': 'Overview', 'nav.projects': 'Projects', 'nav.ranking': 'Ranking', 'nav.settings': 'Settings',
      'nav.account': 'Account', 'nav.rankingShort': 'Ranking', 'nav.accountShort': 'Account',
      'top.refresh': 'Refresh', 'top.updated': 'Updated', 'top.loading': 'Loading…',
      'hero.rank': 'Rank', 'hero.team': 'Team', 'hero.joined': 'Joined', 'hero.points': 'Points',
      'stat.frames': 'Frames rendered', 'stat.points': 'Points', 'stat.time': 'Render time',
      'stat.streak': 'Current streak', 'stat.days': 'days',
      'stat.streakHint': 'Best {best}d · {d30}/30 active days',
      'stat.streakFull': 'Best {best}d · every day of the last 30',
      'badge.top-10-renderers': 'TOP 10% RENDERERS',
      'status.idle': 'Client standing by',
      'status.rendering': 'Rendering',
      'status.renderingFor': 'Rendering for {user}',
      'status.disconnected': 'Client not connected',
      'hero.statusRaw': 'Site wording: {raw} \u2014 this is your own client\u2019s state, not the farm queue',
      'stat.avgPeak': 'Avg {avg} · peak {peak}',
      'stat.rankWindow': 'Site rank {rank} · 30-day rolling',
      'stat.daysEquiv': '≈ {days} machine-days',
      'stat.created': 'Projects created', 'stat.createdHint': 'Tasks you uploaded',
      'stat.ordered': 'Frames ordered', 'stat.orderedHint': 'Frames you ordered for your own projects',
      'site.title': 'Farm status', 'site.frames': 'Frames remaining', 'site.projects': 'Active projects',
      'site.clients': 'Connected clients', 'site.processing': 'Processing frames',
      'chart.points': 'Points growth', 'chart.frames': 'Frames growth',
      'chart.tipPoints': 'points',
      'chart.pointsSub': '{n} samples · {from} → {to} · now {now}',
      'chart.framesSub': '{n} samples · now {now} frames',
      'months.title': 'Monthly output', 'months.sub': 'By calendar month',
      'months.max': 'Best month', 'months.min': 'Lowest month',
      'heat.title': 'Render output', 'heat.sub': 'Last 53 weeks · one cell per day · shaded by frames',
      'heat.legendLow': 'Less', 'heat.legendHigh': 'More',
      'heat.note': '{nz} active days · peak {peak}',
      'heat.total': '{n} frames total', 'heat.frame': 'frames',
      'heat.subDays': 'Last 53 weeks · one cell per day · lit = rendered that day',
      'heat.noteDays': '{nz} days rendered',
      'heat.totalDays': '{n} days total',
      'heat.legendOff': 'none', 'heat.legendOn': 'rendered',
      'heat.none': 'The site provides no activity calendar for this account',
      'empty.title': 'No renders yet',
      'empty.body': 'SheepIt is built out of everyone\u2019s spare compute. Install the client, leave it running, and your machine starts producing frames for other people\u2019s projects \u2014 every frame you contribute is recorded here.',
      'empty.s1h': 'Install the client', 'empty.s1b': 'Windows, macOS, Linux or Docker \u2014 just sign in with your account.',
      'empty.s2h': 'Leave it running', 'empty.s2b': 'No need to have Blender open. Idle cycles pick up work automatically.',
      'empty.s3h': 'Earn points', 'empty.s3b': 'Rendering for others earns 38 points/minute; your own project spends 10.',
      'empty.cta1': 'Download the client', 'empty.cta2': 'How it works',
      'machines.title': 'Online machines', 'machines.sub': 'Currently connected', 'machines.online': 'online',
      'sessions.title': 'Recent sessions', 'sessions.sub': '{n} records',
      'news.title': 'Latest news',
      'proj.title': 'Active projects', 'proj.count': '{n} projects',
      /* Render-priority toggle in the publisher cell (same endpoints as the account page) */
      'proj.prio.inList': 'Already in your render priority',
      'proj.menu.open': 'More actions', 'proj.menu.title': 'This publisher\u2026',
      'proj.menu.prio': 'Prioritise their projects', 'proj.menu.unprio': 'Remove from render priority',
      'proj.menu.gift': 'Donate points to them', 'proj.menu.ungift': 'Stop donating to them',
      'proj.menu.block': 'Blacklist (never render their projects)', 'proj.menu.unblock': 'Remove from blacklist',
      'proj.menu.gifted': 'Already in your donation list', 'proj.menu.blocked': 'Already on your blacklist',
      'proj.search': 'Search project or renderer…', 'proj.all': 'All',
      'proj.col.project': 'Project', 'proj.col.owner': 'Owner', 'proj.col.status': 'Status',
      'proj.col.progress': 'Progress', 'proj.col.device': 'Device', 'proj.col.memory': 'Memory',
      'proj.cpu': 'CPU', 'proj.gpu': 'GPU', 'proj.frames': 'frames',
      'proj.status.renderingN': '{n} Rendering frames', 'proj.status.rendering': 'Rendering',
      'proj.status.waiting': 'Waiting', 'proj.status.paused': 'Paused',
      'proj.empty': 'No matching projects', 'proj.showing': 'Showing {n} / {total}', 'proj.showingN': 'Top {n}',
      'list.more': 'Show more', 'list.shown': 'Showing {n} / {total}',
      'mode.toClassic': 'Switch to the original interface', 'mode.toModern': 'Switch to the modern interface',
      'mode.classicHint': 'Back to the new UI', 'mode.classicTip': 'Return to the SheepIt Plus interface',
      'mode.enter': 'Open the new UI', 'mode.enterTip': 'This page has no rebuilt version; open the modern overview instead',
      'mode.partialTip': 'Only the upload section of this page is rebuilt \u2014 open the full interface instead',
      'machines.title': 'Connected machines', 'machines.count': '{n} machines',
      'machines.none': 'No machine is connected right now',
      'machines.open': 'Open session', 'machines.unknown': 'Unknown machine',
      'heat.weekday': 'Mon,Wed,Fri', 'heat.tip': '{n} frames',
      'heat.tipOn': 'Rendered', 'heat.tipOff': 'No rendering',
      'nav.account': 'Account',
      'account.title': 'Account settings', 'account.sub': 'These forms post to the site\u2019s own endpoints \u2014 exactly what the original page does.',
      'account.tab.sched': 'Scheduler & lists',
      'account.tab.sponsor': 'Donating points', 'account.tab.account': 'Account',
      'account.only': 'Your own account only',
      'account.onlyHint': 'You are looking at {user}\u2019s account settings, which is not your account.',
      'account.scheduler': 'Scheduler', 'account.schedulerHint': 'Who gets rendered first: other users < my team < myself.',
      'account.sched.mine': 'Render my projects first',
      'account.sched.mineHint': 'On by default. On an older machine it may be better to let the scheduler pick an easier frame.',
      'account.sched.team': 'Render my team\u2019s projects first',
      'account.sched.heavy': 'Heavy projects have high priority',
      'account.sched.heavyHint': 'For machines above 200%: reduces the download-and-extract share of each job.',
      'account.priority': 'Render priority', 'account.priorityHint': 'Projects from these owners get picked up first.',
      'account.priorityAdd': 'Type a username and press Enter', 'account.add': 'Add', 'account.remove': 'Remove',
      'account.sponsor': 'Donating points', 'account.sponsorSub': 'the site calls it Sponsorship',
      'account.sponsorHint': 'Give away the points you earn: every frame you render sends that frame\u2019s points to a random person on this list instead of to your own account \u2014 as the site puts it, SheepIt is about community.',
      'account.sponsor.give': 'Enable donating', 'account.sponsor.giveHint': 'Turn this off and newly earned points stop going to your list.',
      'account.sponsor.receive': 'Receive sponsorships', 'account.sponsor.receiveHint': 'Turn this off and you get nothing when someone adds you to their list.',
      'account.sponsorList': 'Sponsored users', 'account.sponsorEmpty': 'The list is empty',
      'account.sponsorAdd': 'Type a username and press Enter',
      'account.avatar': 'Avatar', 'account.avatarHint': 'The image is cropped to a square.',
      'account.avatarPick': 'Choose an image', 'account.avatarSave': 'Upload avatar',
      'account.email': 'Email', 'account.emailNew': 'New email address', 'account.emailSave': 'Change email',
      'account.keys': 'Render keys', 'account.keysHint': 'One key per machine: the client logs in with the key, so your password never sits in a config file.',
      'account.keys.comment': 'Comment (required \u2014 so you can tell the machines apart)',
      'account.keys.add': 'New key', 'account.keys.inUse': 'in use', 'account.keys.free': 'idle',
      'account.keys.del': 'Delete', 'account.keys.delConfirm': 'Delete this render key? Any client using it will be logged out.',
      'account.block.renderer': 'They cannot render my projects', 'account.block.rendererHint': 'Users on this list are not allowed to pick up your projects.',
      'account.block.owner': 'I do not render their projects', 'account.block.ownerHint': 'Projects from these owners are never sent to your machines.',
      'account.block.add': 'Block',
      'account.saving': 'Submitting\u2026', 'account.ok': 'Saved', 'account.failed': 'The site said: {msg}',
      'account.empty': '(empty)',
      'rank.title': 'Renderer ranking', 'rank.sub': 'Scored over a 30-day rolling window',
      'rank.col.rank': 'Rank', 'rank.col.user': 'Renderer', 'rank.col.frames': 'Frames rendered',
      'rank.col.time': 'Render time', 'rank.col.points': 'Points earned',
      'rank.you': 'you', 'rank.count': '{n} renderers',
      'state.loading': 'Reading site data…',
      'state.error': 'Failed to load', 'state.retry': 'Retry',
      'state.loggedOut': 'Not signed in',
      'state.loggedOutHint': 'SheepIt Plus reads data through your existing session. Sign in on the original site, then reload.',
      'state.loggedOutBtn': 'Sign in on the site',
      'state.empty': 'No data',
      'set.title': 'Settings', 'set.theme': 'Theme', 'set.theme.auto': 'System',
      'set.theme.dark': 'Dark', 'set.theme.light': 'Light',
      'set.lang': 'Language', 'set.lang.auto': 'Browser',
      'set.scale': 'Interface scale', 'set.scaleHint': 'Everything scales together \u2014 type, spacing and charts, not just the font size.',
      'set.langHint': 'Language packs are data, not code: register a dictionary and the UI lists it automatically. No logic changes needed.',
      'set.translate': 'Translate original pages', 'set.on': 'On', 'set.off': 'Off',
      'set.translateHint': 'Pages that were not rebuilt (FAQ, Servers, Get started…) are translated locally with {n} entries. No network, nothing uploaded. Strings absent from the dictionary (project names, usernames, news bodies) are left untouched.',
      'set.about': 'About', 'set.aboutText':
        'SheepIt Plus is a pure front-end UI rebuild. It reads the pages you could already see and renders them in a new interface. No private endpoints, nothing sent to a third party. The only three places it changes server state are buttons you press yourself \u2014 the forms in Account settings, the pause/resume control on a machine\u2019s session page, and the priority toggle on a publisher in the project list \u2014 and all of them post to the site\u2019s own endpoints, exactly what the original pages do.',
      'set.dangerHint': 'To get the original interface back, use "Switch to the original interface" in the top bar, or disable this script and reload.',
      'footer.source': 'Data source: the site\u2019s own pages · no private endpoints',
      /* Session page: one machine\u2019s record */
      'sess.owner': 'Owner', 'sess.client': 'Client', 'sess.unknownHost': 'Unnamed machine',
      'sess.on': 'Running', 'sess.off': 'Paused',
      // the site's untitled status row separates the two pauses (see 20-api.js info.note):
      // "Paused server side" when the server paused it, "Paused client side" when the client did
      'sess.pausedServer': 'Paused server-side', 'sess.pausedClient': 'Paused client-side',
      'sess.statusRaw': 'the site writes: {raw}',
      // the identity strip's "what is this machine on right now"; "current job" while paused,
      // so it cannot contradict the Paused chip next to it
      'sess.rendering': 'Rendering', 'sess.currentJob': 'Current job', 'sess.frame': 'frame',
      'sess.status.enable': 'Enabled', 'sess.status.disable': 'Disabled',
      'sess.noId': 'No session id in the address', 'sess.parseFailed': 'No machine information on this page',
      'sess.kpi.frames': 'Frames rendered', 'sess.kpi.points': 'Points earned',
      'sess.kpi.maxTime': 'Per-frame render time limit',
      'sess.kpi.since': 'since {t}', 'sess.kpi.perFrame': '≈ {n} points per frame',
      'sess.kpi.powerLink': 'Power by machine model',
      'sess.facts': 'Machine', 'sess.factsSub': 'the site\u2019s raw values, unconverted',
      'sess.f.cpu': 'Processor',
      // the power cell's label follows whichever row the site printed (see 50-views.js powerFacts)
      'sess.f.power': 'CPU power', 'sess.f.powerGpu': 'GPU power',
      'sess.f.gpu': 'Graphics card', 'sess.f.vram': 'VRAM',
      'sess.f.driver': 'Driver', 'sess.f.computeDevice': 'Compute device',
      'sess.f.ramAllowed': 'RAM allowed for rendering', 'sess.f.ramAvailable': 'RAM installed',
      'sess.f.scheduler': 'Scheduler', 'sess.f.createdAt': 'Created',
      'sess.f.lastRequest': 'Last request', 'sess.f.lastRequestJob': 'Last request job',
      'sess.f.lastValidatedJob': 'Last validated job', 'sess.f.ua': 'Runtime',
      'sess.f.renderKey': 'Render key', 'sess.f.action': 'Action',
      'sess.reveal': 'Show', 'sess.hide': 'Hide',
      'sess.control': 'Machine control', 'sess.pause': 'Pause this machine', 'sess.resume': 'Resume rendering',
      'sess.controlHint': 'Posts to the site\u2019s own address \u2014 the very same button the original page has. A paused client stops taking new work; resuming takes effect the next time it connects.',
      'sess.timeline': 'Timeline', 'sess.tlSub': '{n} events · {from} → {to} · your local time',
      'sess.tlSubEmpty': 'the site returned no events', 'sess.tlNone': 'No events recorded for this machine yet',
      'sess.tlFailed': 'Timeline unavailable (the site\u2019s endpoint did not answer) \u2014 machine information is unaffected',
      /* Activity summary (default) and the full log (folded away) */
      'sess.act.day': 'Date', 'sess.act.month': 'Month', 'sess.act.render': 'Render time',
      'sess.act.events': 'Events', 'sess.act.jobs': 'Jobs', 'sess.act.failed': 'Failed',
      'sess.act.moreDay': '{n} earlier days are not listed here', 'sess.act.moreMonth': '{n} earlier months are not listed here',
      'sess.logOpen': 'Show the full log ({n} events)', 'sess.logClose': 'Hide the full log',
      'sess.publisher': 'Publisher',
      'sess.col.type': 'Event', 'sess.col.job': 'Job', 'sess.col.start': 'Start',
      'sess.col.end': 'End', 'sess.col.span': 'Duration',
      'sess.projects': 'Renderable projects', 'sess.prjSub': '{n} projects · none of them is being sent to this machine right now',
      'sess.prjNone': 'No project can be sent to this machine right now', 'sess.whyNone': 'no reason given',
      'sess.tl.rendering': 'Rendering', 'sess.tl.request': 'Request', 'sess.tl.validate': 'Validate',
      'sess.tl.login': 'Login', 'sess.tl.senderror': 'Send error', 'sess.tl.send': 'Send',
      'sess.tl.error': 'Error',

      /* Project upload (/getstarted) and the "analysing" screen after it.
         /getstarted is two pages in one address — the client download guide and the upload
         form — and only the upload half is rebuilt; see up.origin. */
      'up.title': 'Upload a project', 'up.sub': 'Hand the farm a .blend or a ZIP; the site analyses it first',
      'up.formTitle': 'Choose a file',
      'up.estTitle': 'Render time estimator',
      'up.rulesTitle': 'Check before you upload',
      'up.origin': 'Every number below (size limit, renderers, tile count, per-frame limit) is the one the site gave for this request. None of them is written into the script.',
      'up.noForm': 'There is no upload form on this page right now — usually that means you are signed out, or the site has closed uploads.',
      'up.blocked': 'The site is not letting this account upload a project at the moment',
      'up.maxNote': 'One file, up to {size} \u2014 that is the size before ZIP compression. Blender\u2019s own compression is supported and recommended.',
      'an.title': 'Analysing your project',
      'an.sub': 'The site has to read the archive first to learn how many .blend files it holds, and their frame range and resolution',
      'an.waiting': 'Waiting for an analyser to pick it up…',
      'an.processing': 'Analyser is reading: {done} / {total} files',
      'an.reading': 'Analyser is reading the archive…',
      'an.slow': 'A few minutes is normal, and a big archive takes longer. Leaving the page open is fine; closing it does not stop the analysis — come back and it picks up again.',
      'an.failed': 'The analysis endpoint did not answer ({err}). Nothing is wrong with your archive — reloading this page resumes the wait.',
      'an.noToken': 'There is no analysis id in the address, so this page cannot open.',
      'an.gone': 'That analysis id cannot be found any more \u2014 usually because the analysis finished long ago, or this page is stale. Upload the file again, or look for the project in the project list.',
      'an.doneTitle': 'Analysis finished',
      'an.doneNote': 'The next step (engine, frame range, tiles, samples, resolution…) is not rebuilt in this version, so it is the site\u2019s own form: fully functional, in the site\u2019s own look. Submitting it lands on the project management page.',
    },
  };

  // ── 语言包注册表 ───────────────────────────────────────────────────────
  // 语言是数据，不是代码。加一门语言 = SP.I18n.register('ja', {...}) 一次调用。
  //  en 是基准语言（站点原文即英文），zh 的 UI 词表就在下面。
  const LANG_LABELS = { zh: '中文', en: 'English' };

  // code → { site: {原文:译文}, blocks: {整块原文:译文HTML}, patterns: [[正则, 替换]] }
  // site 负责短词条；blocks 负责被内联标签切碎的句子；patterns 负责带变量的文案。
  const SITE = {};

  const I18n = {
    BASE: 'en',
    lang: 'en',
    pref: 'auto',
    LANGS: DICT,
    SITE,

    /** 注册/补充一门语言。dict 与基准语言合并，缺失键自动回落，所以可以分批补充。 */
    register(code, pack) {
      DICT[code] = Object.assign({}, DICT.en, DICT[code] || {}, pack.dict || {});
      SITE[code] = Object.assign({ site: {}, blocks: {}, patterns: [], blockPatterns: [] }, SITE[code] || {}, {
        site: Object.assign({}, (SITE[code] || {}).site, pack.site || {}),
        blocks: Object.assign({}, (SITE[code] || {}).blocks, pack.blocks || {}),
        patterns: [].concat((SITE[code] || {}).patterns || [], pack.patterns || []),
        blockPatterns: [].concat((SITE[code] || {}).blockPatterns || [], pack.blockPatterns || []),
      });
      if (pack.label) LANG_LABELS[code] = pack.label;
      return code;
    },

    /** 供设置页动态生成语言列表 —— 新增语言后无需改 UI 代码 */
    available() {
      return Object.keys(DICT).map((c) => ({ code: c, label: LANG_LABELS[c] || c }));
    },

    /** 'auto' 解析：先按浏览器语言精确匹配，再按主语言匹配，最后回落基准语言 */
    resolve(pref) {
      if (pref && pref !== 'auto' && DICT[pref]) return pref;
      const nav = (navigator.language || 'en').toLowerCase();
      const two = nav.split('-')[0];
      if (DICT[two]) return two;
      for (const c of Object.keys(DICT)) if (nav.startsWith(c.toLowerCase())) return c;
      return this.BASE;
    },

    init() {
      this.pref = Util.store.get('lang', 'auto');
      this.lang = this.resolve(this.pref);
      return this.lang;
    },

    set(pref) {
      Util.store.set('lang', pref);
      this.init();
    },

    t(key, vars) {
      const table = DICT[this.lang] || DICT.en;
      let s = table[key] !== undefined ? table[key] : (DICT.en[key] !== undefined ? DICT.en[key] : key);
      if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
      return s;
    },

    /** 翻译一段站点文本：精确词条 → 模式规则。返回 null 表示"无对应翻译，保持原样"。 */
    siteText(text) {
      if (this.lang === this.BASE) return null;
      const pack = SITE[this.lang];
      if (!pack) return null;
      const hit = pack.site[text];
      if (hit !== undefined) return hit;
      for (const [re, rep] of pack.patterns) if (re.test(text)) return text.replace(re, rep);
      return null;
    },

    /** 整块翻译：用于被 <a>/<strong> 等内联标签切碎的句子。未命中返回 null。 */
    blockText(text) {
      if (this.lang === this.BASE) return null;
      const pack = SITE[this.lang];
      return pack && pack.blocks[text] !== undefined ? pack.blocks[text] : null;
    },

    /** 当前语言是否需要（并且有能力）翻译站点原文 */
    canTranslateSite() {
      const pack = SITE[this.lang];
      return this.lang !== this.BASE && !!pack
        && (Object.keys(pack.site).length > 0 || Object.keys(pack.blocks).length > 0
            || pack.patterns.length > 0 || pack.blockPatterns.length > 0);
    },

    /** 覆盖度统计，供设置页显示 */
    coverage() {
      const pack = SITE[this.lang];
      if (!pack) return null;
      return {
        entries: Object.keys(pack.site).length,
        blocks: Object.keys(pack.blocks).length + pack.blockPatterns.length,
        patterns: pack.patterns.length,
      };
    },
  };

  /* ---------------------------------------------------------------- 主题 */

  // 两套设计 token —— 与 docs/DESIGN.md 的 "Colour" 一节逐值一致。
  // 品牌橙 #e06d58 只用于三处：可操作元素 / 当前选中 / 数据序列中代表"你"。
  // 亮色刻意不是暗色的简单反转：面更亮、边框更淡、强调色加深以保对比度。
  const TOKENS = {
    dark: {
      '--bg': '#0b0d11', '--surface': '#111419', '--surface-2': '#161a21', '--surface-3': '#1c2129',
      '--border': '#22272f', '--border-strong': '#2f3640',
      '--text': '#e8eaed', '--text-2': '#a8b0bb', '--text-3': '#7c8695',
      '--accent': '#e06d58', '--accent-weak': 'rgba(224,109,88,.14)',
      // 主按钮的文字色。白字压在 #e06d58 上只有 3.2:1，达不到 4.5:1；
      // 品牌橙本身不能动，所以改文字：近黑墨在品牌橙上是 5.7:1。
      '--btn-ink': '#0f1218', '--chart': '#e06d58',
      // 热力图色阶。必须跟着 --chart 走：五档写死成暗色的橙，
      // 亮色主题里就会比其他数据序列明显偏粉，一眼看出不是同一个世界。
      '--heat-1': 'rgba(224,109,88,.16)', '--heat-2': 'rgba(224,109,88,.34)',
      '--heat-3': 'rgba(224,109,88,.55)', '--heat-4': 'rgba(224,109,88,.78)',
      '--heat-5': 'rgba(224,109,88,1)',
      '--shadow': '0 1px 2px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.28)',
      '--r': '10px', '--r-sm': '6px',
    },
    light: {
      '--bg': '#fbfbfc', '--surface': '#ffffff', '--surface-2': '#f5f6f8', '--surface-3': '#eceef1',
      '--border': '#e4e6ea', '--border-strong': '#d0d4da',
      '--text': '#14171c', '--text-2': '#4b5462', '--text-3': '#656d79',
      '--accent': '#b6472f', '--accent-weak': 'rgba(182,71,47,.10)',
      // 亮色下品牌橙要压得更深：白字落在 #b6472f 上是 5.3:1，
      // 顺带把"强调色文字落在浅底上"的对比度也一起提上去。
      '--btn-ink': '#ffffff',
      '--chart': '#b6472f',
      '--heat-1': 'rgba(182,71,47,.16)', '--heat-2': 'rgba(182,71,47,.34)',
      '--heat-3': 'rgba(182,71,47,.55)', '--heat-4': 'rgba(182,71,47,.78)',
      '--heat-5': 'rgba(182,71,47,1)',
      '--shadow': '0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.05)',
      '--r': '10px', '--r-sm': '6px',
    },
  };

  const Theme = {
    pref: 'auto',
    init() {
      this.pref = Util.store.get('theme', 'auto');
      return this.pref;
    },
    set(pref) { Util.store.set('theme', pref); this.pref = pref; },
    /** 把 token 拼成 CSS 文本；manual 覆盖块放在 media query 之后以保证优先级 */
    css(scope) {
      const block = (sel, set) =>
        `${sel}{${Object.entries(set).map(([k, v]) => `${k}:${v}`).join(';')}}`;
      const dark = block(scope, TOKENS.dark);
      const light = block(`${scope}[data-theme="light"]`, TOKENS.light);
      return [
        dark,
        `@media (prefers-color-scheme: light){${block(`${scope}:not([data-theme="dark"])`, TOKENS.light)}}`,
        light,
      ].join('\n');
    },
    /** 解析出当前实际生效的是暗还是亮（用于图表取色） */
    effective(pref) {
      if (pref === 'dark' || pref === 'light') return pref;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    },
  };

  SP.Util = Util;
  SP.I18n = I18n;
  SP.Theme = Theme;
  SP.TOKENS = TOKENS;
  SP.t = (k, v) => I18n.t(k, v);
})();

/* ===== src/12-lang-zh.js ===== */
/* ==========================================================================
 * 12-lang-zh.js — 中文语言包
 *
 * 三层结构，对应三类站点文案：
 *   site     短词条，精确匹配单个文本节点（导航、按钮、标题、表头）
 *   blocks   整块替换：被 <a>/<strong>/<em> 切碎的句子。键是整块归一化文本，
 *            值是 HTML（可以保留链接）。纯文本节点替换救不了这类句子，
 *            因为语序会碎掉。
 *   patterns 带变量的文案（"13 Rendering frames"），用捕获组回填。
 *
 * 加一门语言就是照着这个文件再写一个 —— 不需要改任何逻辑代码。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  SP.I18n.register('zh', {
    label: '中文',

    /* ------------------------------------------------ 短词条 */
    site: {
      /* 导航 / 顶栏 */
      'Toggle navigation': '切换导航',
      'Home': '首页',
      'Get started': '开始使用',
      'Projects': '项目',
      'Teams': '团队',
      'Forum': '论坛',
      'FAQ': '常见问题',
      'Servers': '服务器',
      'Donate': '捐赠',
      'Store': '商店',

      /* 用户菜单 */
      'Please sign in': '请登录',
      'Create a new account': '创建新账户',
      'Switch to dark theme': '切换到暗色主题',
      'Switch to light theme': '切换到亮色主题',
      'My account': '我的账户',
      'Edit profile': '编辑资料',
      'Log out': '退出登录',

      /* 页脚 */
      'Latest projects': '最新项目',
      'Social': '社交',
      'Help us': '支持我们',
      'We need you to keep the service alive. Help us now!': '我们需要你的支持才能维持这项服务，现在就帮我们一把！',
      'Top renderers over 30 day rolling period': '近 30 天渲染榜',
      'Terms of use': '使用条款',
      'Privacy policy': '隐私政策',

      /* 首页 */
      'SheepIt is a free distributed renderfarm for Blender. Try it now!': 'SheepIt 是一个面向 Blender 的免费分布式渲染农场，立刻试试！',
      'Free': '免费',
      'No subscription, no credit card.': '无需订阅，无需信用卡。',
      'Free forever — since 2007.': '自 2007 年起永久免费。',
      'User-friendly': '易用',
      'Submit and track your renders from your browser.': '在浏览器中提交并跟踪你的渲染任务。',
      'No Blender installation required to help render.': '帮忙渲染无需安装 Blender。',
      'Collaborative': '协作',
      'Join in and start helping the community.': '加入进来，开始帮助社区。',
      'Always up to date': '始终最新',
      'New Blender versions supported within days.': '新的 Blender 版本数天内即可支持。',
      'Cycles, Eevee, and Workbench included.': '包含 Cycles、Eevee 和 Workbench。',
      'Frames remaining': '待渲染帧',
      'Active projects': '进行中项目',
      'Connected clients': '在线客户端',
      'Processing frames': '正在处理帧',
      'Sheepit power': '羊群算力',
      'computed frames per hour': '帧/小时',
      'to complete all projects': '可完成全部项目',
      'How many months of rendering do we complete every day?': '我们每天完成多少个月的渲染量？',
      'History': '历史',
      'total frames rendered': '累计渲染帧数',
      'computed projects': '已完成项目',
      'Latest news': '最新动态',
      'Read more': '阅读更多',

      /* 开始使用 */
      'Get started!': '开始使用！',
      'The render farm relies on you to live; the more computers that are connected to the system, the better the service will be.':
        '渲染农场靠你而活：接入的机器越多，服务质量就越好。',
      "You don't need to have Blender installed, it will be downloaded for you.": '你不需要安装 Blender，客户端会自动下载。',
      'Your own project will be rendered first, then your computer will help other users.':
        '你自己的项目会优先渲染，之后你的电脑再帮助其他用户。',
      "If you don't want to share your computer, but still help SheepIt, you should consider donating":
        '如果你不想共享电脑，但仍想支持 SheepIt，可以考虑捐赠',
      'Download the client and start rendering now.': '下载客户端，立刻开始渲染。',
      'Minimum client requirements': '客户端最低要求',
      'Add your project': '添加你的项目',
      'Estimator': '估算器',
      'Waiting list': '排队情况',
      'Predicted position in queue:': '预计排队位置：',
      'CPU:': 'CPU：',
      'GPU:': 'GPU：',
      'Render time:': '渲染耗时：',
      'minutes per frame.': '分钟/帧。',
      'Number of frames:': '帧数：',
      'frames.': '帧。',
      'Before adding a file to the render farm you should check if:': '把文件加入渲染农场前，请先确认以下几点：',
      'The render engine is compatible.': '渲染引擎受支持。',
      'Image output size must be under a width of 8,000 px, and a height of 8,000 px.':
        '输出图片的宽和高都必须小于 8,000 px。',
      'Maximum tile file size 50.0 MB': '单个分块文件上限 50.0 MB',
      'Blender compression is recommended and supported.': '推荐并支持 Blender 压缩。',
      'The 20 minute rule is intended to ensure that even small computers can render any project.':
        '「20 分钟规则」是为了保证即使小电脑也能渲染任何项目。',
      'Maximum image resolution 4096x2160 px.': '最大图像分辨率 4096x2160 px。',
      'Maximum image file size 50.0 MB': '最大图像文件大小 50.0 MB',
      'Full frame renders only. No split-layers or checkerboarding.': '仅支持整帧渲染，不支持分层渲染或棋盘式分割。',
      'Only animations are supported, no single image projects.': '仅支持动画项目，不支持单张图片。',
      'Use of compression is required (any of pxr24, zip, piz, rle, zips, dwaa, dwab).':
        '必须使用压缩（pxr24、zip、piz、rle、zips、dwaa、dwab 任选其一）。',
      'Limitation on EXR support:': 'EXR 支持限制：',
      'There is a': '这里有',
      'list of average power per machine': '各机器的平均算力列表',
      'check out the faq for more info': '详见 FAQ',
      'nudity': '色情',
      'racist': '种族主义',
      'content is allowed.': '内容。',
      'Be aware that': '请注意：',
      'scripts are disabled due to security reasons.': '出于安全原因，脚本已被禁用。',
      'Your blend version is': '你的 blend 版本需要是',
      'or higher.': '或更高。',
      'You set the output file to an': '你需要把输出文件设为',
      'image': '图片',
      ', for example jpg or png.': '，例如 jpg 或 png。',
      'The path to external data is': '外部数据的路径必须是',
      'relative': '相对路径',
      'File names': '文件名',
      'must not be locale specific': '不能包含本地化字符',
      ', i.e. do not put any accents in filenames.': '，也就是说文件名里不要出现重音符号。',
      'You should keep the render time per frame (or split) under 20 min (on the reference machine)':
        '每帧（或每个分块）的渲染时间应控制在 20 分钟以内（以基准机器计）',
      '. As an example,': '。例如，',
      'this scene': '这个场景',
      'will be rendered in 20min on the reference machine (i5-9600).': '在基准机器（i5-9600）上需要 20 分钟。',
      'You can add up to': '你最多可以添加',
      'File': '文件',
      'ZIP compression': 'ZIP 压缩',
      ', but make sure to use relative paths for all files in the archive.': '，但要确保压缩包内所有文件都使用相对路径。',
      'You can use a': '你可以使用',
      'single blend file': '单个 blend 文件',
      ', with packed textures.': '，并打包贴图。',
      'Or a': '或者使用',
      'ZIP file': 'ZIP 文件',

      /* 服务器 */
      "SheepIt's servers": 'SheepIt 的服务器',
      'network': '网络',
      "The 'SheepIt network' is handled by four type of servers:": '「SheepIt 网络」由四类服务器组成：',
      'We are always looking for new servers. If you are interested in lending us a server, please contact us through Discord.':
        '我们一直在寻找新的服务器。如果你有兴趣提供服务器，请通过 Discord 联系我们。',
      'Requirements for sharing a server:': '共享服务器的要求：',
      'A dedicated IP and dedicated hardware are required.': '需要独立 IP 和独立硬件。',
      'You can not run a shepherd on your home network.': '不能在你的家庭网络上运行 shepherd。',
      'Requirement': '要求',
      'Shepherd': 'Shepherd 节点',
      'Uptime': '在线率',
      'critical': '关键',
      'Installation': '安装',
      'RAM': '内存',
      'Disk usage': '磁盘占用',
      'Traffic per month': '每月流量',
      'Shepherds status': 'Shepherd 节点状态',
      'Server': '服务器',
      'Processing': '处理中',
      'Storage': '存储',
      'Tasks': '任务',
      'binary mirror': '二进制镜像',
      ": stores Blender binary copy. Traffic is handled by Cloudflare's CDN.": '：存放 Blender 二进制副本，流量由 Cloudflare CDN 承载。',
      'project mirror': '项目镜像',
      ': stores blend file copy. Traffic is handled by Cloudflare\'s CDN.': '：存放 blend 文件副本，流量由 Cloudflare CDN 承载。',
      'shepherd': 'shepherd',
      '(blue): stores the actual render. Creates zip and mp4.': '（蓝色）：存放实际渲染结果，生成 zip 和 mp4。',
      '(yellow), situated in Texas, USA. It handles users, project creation and rendering request.':
        '（黄色），位于美国德州，负责用户、项目创建和渲染请求。',

      /* 错误页 / 通用 */
      'Back to homepage': '返回首页',
      'The page could not be found': '找不到该页面',
      'The Sheep is out there!': '羊就在外面！',
      'Forbidden': '无权限',
      'You are not allowed to manage this project.': '你没有权限管理这个项目。',
      'Loading': '加载中',

      /* 属性文案（title / alt / placeholder） */
      'CPU disabled': 'CPU 已禁用',
      'cpu disabled': 'CPU 已禁用',
      'GPU nvidia enabled': 'GPU（NVIDIA）已启用',
      'gpu enabled': 'GPU 已启用',
      'Login': '用户名',
      'Password': '密码',
      'Email': '邮箱',
      'Search': '搜索',
      'Close': '关闭',
      'Next': '下一页',
      'Previous': '上一页',
      'Send this file': '发送此文件',
      'To Top': '回到顶部',
      'Processor or GPU name': '处理器或 GPU 名称',
      'PayPal - The safer, easier way to pay online!': 'PayPal —— 更安全、更便捷的在线支付方式',
      'Donate with PayPal button': '使用 PayPal 捐赠',
      'Become a Patron': '成为赞助者',
    },

    /* ------------------------------------------------ 整块替换（值是 HTML，可保留链接）
     * 键是「翻译前」的整块归一化文本，必须与页面实际拼接结果一致。
     * 获取真实键的办法：把 translateSite 设为 false 打开页面，控制台执行
     *   __SHEEPIT_PLUS__.DomI18n.reportUnmatched(20)
     */
    blocks: {
      "The render farm relies on you to live; the more computers that are connected to the system, the better the service will be. You don't need to have Blender installed, it will be downloaded for you. Your own project will be rendered first, then your computer will help other users. If you don't want to share your computer, but still help SheepIt, you should consider donating.":
        '渲染农场靠你而活：接入的机器越多，服务质量就越好。<br>你不需要安装 Blender，客户端会自动为你下载。<br>你自己的项目会优先渲染，之后你的电脑再帮助其他用户。<br>如果你不想共享电脑，但仍想支持 SheepIt，可以考虑<a href="/donation">捐赠</a>。',

      'The 20 minute rule is intended to ensure that even small computers can render any project. If a frame of your project can be rendered in under 20 min on the reference machine then you don\'t need to split it, but if you do, this formula can help you determine what the best value is.':
        '「20 分钟规则」是为了保证即使小电脑也能渲染任何项目。如果项目的某一帧在基准机器上能在 20 分钟内渲染完，你就不需要拆分；但如果需要拆分，下面这个公式可以帮你算出最合适的拆分方式。',

      'The render engine is compatible. Cycles, Eevee and Workbench renderer are supported.':
        '渲染引擎需要受支持，目前支持 Cycles、Eevee 和 Workbench 渲染器。',

      'You should keep the render time per frame (or split) under 20 min (on the reference machine). As an example, this scene will be rendered in 20min on the reference machine (i5-9600).There is a list of average power per machine, check out the faq for more info.':
        '每帧（或每个分块）在基准机器上的渲染时间应控制在 20 分钟以内。例如这个场景在基准机器（i5-9600）上需要 20 分钟。这里有一份<a href="/faq">各机器的平均算力列表</a>，详见 FAQ。',

      "You can add up to 12,000 tiles at a time. If you divide it into 8x8, your project can be up to 187 frames; if you don't split frames, you will have 1 tile <=> 1 frame.":
        '一次最多可以添加 12,000 个分块。如果按 8x8 拆分，你的项目最多可以有 187 帧；如果不拆分帧，则 1 个分块对应 1 帧。',

      'No nudity or any racist content is allowed.': '禁止色情内容，也禁止任何种族主义内容。',

      'Be aware that if you have set RGBA as output, the MP4 file will include the alpha layer and will make the file unplayable by some video players. The file could need special treatment in editing software.':
        '请注意：如果输出格式设为 RGBA，生成的 MP4 会带上 alpha 图层，部分播放器将无法播放，可能需要在剪辑软件里做特殊处理。',
    },

    /* ------------------------------------------------ 整块模式规则
     * 段落里含动态数字时没法用静态键，改用正则整块替换。捕获组按 $1…$9 回填。
     */
    blockPatterns: [
      [/^Max:\s*([\d,]+)\s*MB\s*before ZIP compression\s*Blender compression is recommended and supported\.$/i,
        '上限：$1 MB（ZIP 压缩前）<br>推荐并支持 Blender 压缩。'],

      [/^The render order is based on points\..*?You currently have ([\d,]+) points\.\s*Since you are part of a team who generated ([\d,]+) points some of those will give you an extra boost of ([\d,]+) points\.\s*Predicted position in queue:$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前拥有 $1 积分。由于你所在团队累计产生了 $2 积分，其中一部分会给你带来 $3 积分的额外加成。<br>预计排队位置：'],
    ],

    /* ------------------------------------------------ 模式规则（带变量的文案） */
    patterns: [
      [/^Connected as (.+)$/, '已登录：$1'],
      [/^(\d[\d,]*)\s+machines rendering right now\.$/, '当前有 $1 台机器在渲染。'],
      [/^(\d[\d,]*)\s+Rendering frames$/, '$1 帧渲染中'],
      [/^Rendered ([\d,]+) frames$/, '已渲染 $1 帧'],
      [/^Sent (.+) ago$/, '$1前发送'],
      [/^Total projects:\s*([\d,]+)$/, '项目总数：$1'],
      [/^Max:\s*([\d,]+) MB$/, '上限：$1 MB'],
      [/^(\d[\d,]*)\s+computed projects$/, '已完成 $1 个项目'],
      [/^(\d[\d,]*)\s+computed frames per hour$/, '每小时 $1 帧'],
      [/^(\d+[mhd])\s+to complete all projects$/, '$1 可完成全部项目'],
      [/^(\d[\d,]*)\s+frames? remaining$/i, '待渲染 $1 帧'],
      [/^(\d[\d,]*)\s+connected clients?$/i, '在线客户端 $1'],
      [/^(\d[\d,]*)\s+processing frames?$/i, '正在处理 $1 帧'],
      [/^(\d[\d,]*)\s+active projects?$/i, '进行中项目 $1'],
      /* 序数：既用于排行榜名次，也用于排队位置（CPU: 1st） */
      [/^(\d+)(st|nd|rd|th)$/i, '第 $1 位'],
      [/^([\d.]+)\s+or higher\.?$/, '$1 或更高。'],
    ],
  });
})();

/* ===== src/20-api.js ===== */
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

/* ===== src/30-style.js ===== */
/* ==========================================================================
 * 30-style.js — 样式层
 *
 * 视觉来源：docs/DESIGN.md 的 "Insight Metric Band" 与 "Data Table" 两节。
 * 这里把样张里的样式原样搬过来，只做必要改动：
 *  - 选择器统一加 #sp 前缀，把原站 CSS 完全挡在外面
 *    （id + 类 的选择器优先级高于站点绝大多数规则）
 *  - :root / html[data-theme=light] 的 token 块由 Theme.css('#sp') 生成
 *  - 样张底部的 .demo 切换条是样张专用，不带进产品
 *
 * 三个不能丢的东西，写在最前面：
 *  1) 品牌橙 #e06d58 只用于三处：可操作元素 / 当前选中 / 数据序列中代表"你"。
 *  2) 数值一律制表对齐（.num）。
 *  3) 焦点环、选区、光标、滚动条都要带设计 —— 没画的部分也是被建造的。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Theme } = SP;

  SP.CSS = `
${Theme.css('#sp')}

/* ---------------------------------------------------------------- 骨架 */
#sp{
  position:fixed;inset:0;z-index:2147483000;overflow-y:auto;overflow-x:hidden;
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-size:14px;line-height:1.5;letter-spacing:0;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
#sp *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;line-height:inherit}

/* 浏览器表面：选区 / 光标 / 滚动条 / 焦点环 / 下划线偏移 */
#sp{caret-color:var(--accent);scrollbar-color:var(--border-strong) transparent;scrollbar-width:thin}
#sp ::selection{background:var(--accent-weak);color:var(--text)}
#sp ::-webkit-scrollbar{width:10px;height:10px}
#sp ::-webkit-scrollbar-track{background:transparent}
#sp ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px;border:3px solid var(--bg)}
#sp ::-webkit-scrollbar-thumb:hover{background:var(--text-3)}
#sp :focus{outline:none}
#sp :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-sm)}
#sp a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}
#sp ul,#sp ol{list-style:none}
#sp button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
#sp table{border-collapse:collapse;width:100%}
#sp img{display:block;max-width:100%}
#sp svg{display:block}
#sp .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}

#sp .wrap{max-width:1240px;margin:0 auto;padding:0 24px 72px}
@media (max-width:760px){#sp .wrap{padding:0 16px 56px}}

/* ---------------------------------------------------------------- 顶栏 */
#sp .top{
  position:sticky;top:0;z-index:20;min-height:56px;
  display:flex;align-items:center;gap:28px;padding:8px 0;
  border-bottom:1px solid var(--border);
  background:color-mix(in srgb,var(--bg) 86%,transparent);
  backdrop-filter:saturate(1.6) blur(12px);
}
@supports not (background:color-mix(in srgb,var(--bg),transparent)){#sp .top{background:var(--bg)}}
#sp .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.3px;flex:none;text-decoration:none}
#sp .brand .sheep{width:20px;height:20px;flex:none;color:var(--accent)}
#sp .brand em{
  font-style:normal;font-weight:500;font-size:11px;color:var(--text-3);
  border:1px solid var(--border);border-radius:4px;padding:1px 5px;letter-spacing:.4px;
}
#sp nav{display:flex;gap:2px}
#sp nav button{
  padding:6px 11px;border-radius:var(--r-sm);font-size:13.5px;color:var(--text-2);
  transition:background .12s,color .12s;
}
#sp nav button:hover{background:var(--surface-2);color:var(--text)}
#sp nav button[aria-current="page"]{background:var(--surface-2);color:var(--text);font-weight:550}
/* 窄屏用短标签（排行榜→排行、账户设置→账户）。与其把控件藏起来或者让导航横向滚，
   不如让标签本身短一点 —— 五项在 390px 上全都看得见、点得到。 */
#sp nav .navshort{display:none}
#sp .top .spacer{flex:1}
#sp .metaline{font-size:12px;color:var(--text-3);white-space:nowrap}
#sp .who{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);min-width:0}
#sp .who .uname{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .who img{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .who .ini{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;font-size:12px;color:var(--text-3);flex:none}

/* 窄屏顶栏：nav 默认 flex-shrink:1，会被压到 148px 让按钮互相盖住 —— 必须显式禁掉。
   时间戳先让位（刷新按钮已经表达了同一件事），用户名再让位（身份条里有）。 */
@media (max-width:860px){
  #sp .top{gap:12px}
  #sp nav{flex:none}
  #sp .metaline{display:none}
}
@media (max-width:620px){
  #sp .top{gap:8px}
  #sp .brand{font-size:14px}
  #sp .brand .sheep{width:18px;height:18px}
  /* 导航到 5 项之后，390px 上必须让出 PLUS 徽章的位置 —— 标识由羊标 + "SheepIt" 承担 */
  #sp .brand em{display:none}
  #sp nav{gap:0}
  #sp nav button{padding:6px 7px;font-size:13px}
  #sp nav .navfull{display:none}
  #sp nav .navshort{display:inline}
  /* 头像整个撤掉，而不是只藏名字：品牌+导航+刷新已经占满，
     硬塞进来只会把头像挤出视口，在右边缘留下一条 1px 的断边框。
     身份条里有一个 46px 的同款头像，就紧贴在下面。 */
  #sp .who{display:none}
}

/* ---------------------------------------------------------------- 图标按钮 */
#sp .iconbtn{
  width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  transition:border-color .12s,color .12s;
}
#sp .iconbtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .iconbtn .icon{width:14px;height:14px}
#sp .icon{width:15px;height:15px;flex:none}

/* ---------------------------------------------------------------- 按钮 */
#sp .btn{
  display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:8px;font-size:13px;
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  text-decoration:none;transition:border-color .12s,color .12s,background .12s;
}
#sp .btn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .btn.primary:hover{filter:brightness(1.07);color:var(--btn-ink)}
/* 行内维护动作（移除 / 删除）用的小号：它们是次级动作，尺寸上也该退一步，
   否则一列实心同宽的按钮会把列表读成按钮墙。 */
#sp .btn.sm{padding:4px 10px;font-size:12px;border-radius:var(--r-sm)}
#sp .btn .icon{width:14px;height:14px}

/* ---------------------------------------------------------------- 身份条 */
#sp .identity{display:flex;align-items:center;gap:14px;padding:22px 0 18px;flex-wrap:wrap}
#sp .identity .av,#sp .identity img{
  width:46px;height:46px;flex:none;border-radius:12px;overflow:hidden;
  border:1px solid var(--border);background:var(--surface-2);display:block;
}
#sp .identity .av{display:grid;place-items:center;font-size:20px;font-weight:600;color:var(--text-2)}
#sp .identity h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-.3px}
#sp .meta{display:flex;align-items:center;gap:0;flex-wrap:wrap;font-size:12.5px;color:var(--text-2)}
#sp .meta span{padding:0 12px;border-left:1px solid var(--border)}
#sp .meta span:first-child{padding-left:0;border-left:none}
#sp .meta b{font-weight:600;color:var(--text)}

/* ---------------------------------------------------------------- 指标带
   一个整面 + 内部 1px 分隔，不是四张各自为政的卡片 ——
   卡片是最懒的容器，嵌套卡片永远是错的。 */
#sp .kpis{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;box-shadow:var(--shadow);
}
#sp .kpi{padding:18px 20px;border-left:1px solid var(--border);min-width:0}
#sp .kpi:first-child{border-left:none}
#sp .kpi .k{font-size:11.5px;font-weight:500;color:var(--text-3);letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .v{margin-top:8px;font-size:27px;font-weight:600;letter-spacing:-.6px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .d{margin-top:6px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
/* 强调不作上色：这里只是一个更重的数字，不再给第二支色相。
   全页只有一处绿、且没有第二次使用，那不叫语义色，那叫杂色。 */
#sp .kpi .d b{color:var(--text);font-weight:600}
@media (max-width:860px){
  #sp .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpi:nth-child(3){border-left:none}
  #sp .kpi:nth-child(n+3){border-top:1px solid var(--border)}
}
@media (max-width:560px){
  #sp .kpi{padding:15px 14px}
  #sp .kpi .v{font-size:22px;letter-spacing:-.4px}
}
/* 格数不是常数：多数账号 4 格，建过项目的账号 5–6 格（多出来的是"建的项目 / 订的帧"）。
   4 格的带子（含会话页）一个像素都不动；5–6 格按宽度分三档折行，
   每折一次都要重新分配"哪条内边线该画"—— 否则折行处左边缘会多一条竖线、
   或行与行之间少一条横线。 */
#sp .kpis[data-n="5"]{grid-template-columns:repeat(5,minmax(0,1fr))}
#sp .kpis[data-n="6"]{grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:1200px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(3n+1),#sp .kpis[data-n="6"] .kpi:nth-child(3n+1){border-left:none}
  #sp .kpis[data-n="5"] .kpi:nth-child(n+4),#sp .kpis[data-n="6"] .kpi:nth-child(n+4){border-top:1px solid var(--border)}
}
/* ≤860 折成 2 列（和别的带子一致）。上一档"3n+1 不画左边框"在 2 列下会把第 4 格也去掉，
   而 2 列的行首是奇数格（1/3/5）—— 所以这一档整块重算左边线；上边线沿用上面那条 n+3 的规则。 */
@media (max-width:860px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(n),#sp .kpis[data-n="6"] .kpi:nth-child(n){border-left:1px solid var(--border)}
  #sp .kpis[data-n="5"] .kpi:nth-child(odd),#sp .kpis[data-n="6"] .kpi:nth-child(odd){border-left:none}
}

/* ---------------------------------------------------------------- 主区 */
#sp .grid{display:grid;grid-template-columns:8fr 4fr;gap:16px;margin-top:16px}
@media (max-width:1000px){#sp .grid{grid-template-columns:minmax(0,1fr)}}
#sp .panel{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  box-shadow:var(--shadow);min-width:0;
}
#sp .phead{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:16px 20px 0}
#sp .phead h2{margin:0;font-size:13.5px;font-weight:600;color:var(--text);flex:none;white-space:nowrap}
#sp .phead .sub{font-size:12px;color:var(--text-3);min-width:0}
#sp .phead .sub b{color:var(--text-2);font-weight:600}
#sp .phead .spacer{flex:1}

/* ---------------------------------------------------------------- 图表 */
#sp .chart{position:relative;padding:14px 20px 16px}
#sp .chart svg{display:block;width:100%;overflow:visible}
#sp .tip{
  position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-100%);
  background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--r-sm);
  padding:7px 10px;font-size:12px;color:var(--text);white-space:nowrap;
  box-shadow:var(--shadow);transition:opacity .1s;z-index:5;
}
#sp .tip b{font-weight:600}
#sp .tip i{display:block;font-style:normal;color:var(--text-3);font-size:11px;margin-top:2px}

/* ---------------------------------------------------------------- 产出格
   格子随面板宽度等比缩放：53 周永远装得下，不会被 overflow 裁掉。
   窄屏改成定宽 + 横向滚动 —— 7px 的格子只是噪点，读不出的可视化不算可视化。 */
/* position:relative 是必须的：悬停浮层是 .heatwrap 的子元素，
   而 .tip 是 position:absolute。这一格没有定位，包含块就会一路找到 #sp(fixed)，
   于是浮层按"相对 #sp 内容原点"的坐标去放，实际落在离格子一千多像素的地方 —— 等于没有。 */
#sp .heatwrap{display:flex;gap:8px;position:relative}
/* 星期标签固定不动，只有格子横向滚。
   左侧那一列顶部留一个和月份行等高的占位块，两张网格的行高就自动对齐了 ——
   比"猜一个 padding-top"可靠，字体变了也不会错位。 */
#sp .wdcol{display:flex;flex-direction:column;flex:none;font-size:11px;color:var(--text-3)}
#sp .wdcol .pad{height:13px;margin-bottom:6px}
#sp .wd{display:grid;grid-template-rows:repeat(7,minmax(0,1fr));gap:2px;flex:1;line-height:1}
#sp .wd span{align-self:center;white-space:nowrap}
#sp .heatscroll{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
/* 月份标签与格子共用同一套列宽，所以永远对得齐 */
#sp .mlabels{
  display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:2px;
  font-size:11px;color:var(--text-3);height:13px;margin-bottom:6px;line-height:1;
}
#sp .mlabels span{overflow:visible;white-space:nowrap}
#sp .cells{
  --cols:53;
  display:grid;grid-auto-flow:column;
  grid-template-columns:repeat(var(--cols),minmax(0,1fr));
  grid-template-rows:repeat(7,minmax(0,1fr));
  gap:2px;aspect-ratio:var(--cols) / 7;
}
#sp .cells i{border-radius:2px;background:var(--surface-3);display:block;min-width:0;min-height:0}
#sp .cells i:hover{outline:1px solid var(--border-strong);outline-offset:1px}
@media (max-width:760px){
  #sp .heatwrap{gap:6px}
  #sp .mlabels{grid-template-columns:repeat(var(--cols),14px);gap:3px;width:max-content}
  #sp .cells{
    grid-template-columns:repeat(var(--cols),14px);
    grid-template-rows:repeat(7,14px);
    aspect-ratio:auto;gap:3px;width:max-content;
  }
  /* 窄屏上星期标签挤不下就整列撤掉，日期信息由悬停/点按的浮层承担 */
  #sp .wdcol{display:none}
}
#sp .legend{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-3);margin-top:14px;flex-wrap:wrap}
#sp .legend i{width:11px;height:11px;border-radius:2.5px;display:block;flex:none}
#sp .legend .spacer{flex:1}
#sp .legend b{color:var(--text-2);font-weight:600}

/* ---------------------------------------------------------------- 产出面板与月份条 */
#sp .produce{padding:16px 20px 18px}
#sp .months{display:flex;align-items:flex-end;gap:3px;height:132px}
#sp .months i{flex:1;background:var(--accent);opacity:.34;border-radius:2px 2px 0 0;min-height:2px;transition:opacity .12s}
#sp .months i:hover{opacity:1}
#sp .mlabel{display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:8px;font-variant-numeric:tabular-nums}
#sp .mstat{display:flex;gap:20px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
#sp .mstat div{flex:1;min-width:0}
#sp .mstat .k{font-size:11.5px;color:var(--text-3)}
#sp .mstat .v{font-size:16px;font-weight:600;margin-top:4px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:560px){
  #sp .months{height:96px}
  #sp .mstat{gap:12px}
  #sp .mstat .v{font-size:14px}
}

/* ---------------------------------------------------------------- 全站实时 */
#sp .farm{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;margin-top:16px;box-shadow:var(--shadow);
}
/* 直系子元素选择器是必须的：写成 .farm div 会把内边距加到 .k 和 .row 上，
   一个标签自己就撑成 43px、数值行撑成 83px，整格 159px —— 看着空，其实是内耗。
   注意要用 > 而不是后代选择器。 */
#sp .farm > div{padding:13px 18px;border-left:1px solid var(--border);min-width:0}
#sp .farm > div:first-child{border-left:none}
#sp .farm .k{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
#sp .farm .row{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:7px}
#sp .farm .v{font-size:18px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;line-height:1.1}
/* 走势给一个上限宽度。让它 flex:1 撑满整格，一条 300px 宽、20px 高的线会被拉成
   一道 12:1 的划痕 —— 那是纹理不是趋势。160px / 24px 才看得出起伏。 */
#sp .farm svg{display:block;height:24px;width:100%;max-width:160px;opacity:.85;flex:none}
@media (max-width:860px){
  #sp .farm{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .farm div:nth-child(3){border-left:none}
  #sp .farm div:nth-child(n+3){border-top:1px solid var(--border)}
}
@media (max-width:560px){
  #sp .farm div{padding:12px 13px}
  #sp .farm .v{font-size:16px}
}

/* ---------------------------------------------------------------- 表格 */
#sp .tablewrap{overflow-x:auto}
#sp .tbl{width:100%;border-collapse:collapse;font-size:13px}
#sp .tbl th{
  text-align:left;font-size:11.5px;font-weight:500;color:var(--text-3);
  padding:0 14px 10px;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .tbl th.r,#sp .tbl td.r{text-align:right}
/* 数值列收紧到内容宽度：留白交给名称列，而不是把三个数字摊到半个屏幕上。
   th 和 td 都要 nowrap —— 只给 th 加，列会被压到"32.6"就换行，"GB"掉到第二行。 */
#sp .tbl th.r{width:1%;white-space:nowrap}
#sp .tbl th.r,#sp .tbl td.r{white-space:nowrap}
#sp .tbl th.tight{width:1%;white-space:nowrap}
#sp .tbl th.sortable{cursor:pointer;user-select:none}
#sp .tbl th.sortable:hover{color:var(--text-2)}
#sp .tbl th .arw{opacity:.5;margin-left:4px;display:inline-flex;vertical-align:middle}
#sp .tbl th .arw .icon{width:10px;height:10px}
#sp .tbl td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
#sp .tbl tbody tr:last-child td{border-bottom:none}
#sp .tbl tbody tr{transition:background .1s}
#sp .tbl tbody tr:hover{background:var(--surface-2)}
#sp .tbl tbody tr.me{background:var(--accent-weak)}
#sp .pn{font-weight:550;color:var(--text);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 项目名后面挂标签（会话页的「正在渲染」）时的排法：名字负责截断，标签不参与收缩 */
#sp .pnwrap{display:flex;align-items:center;gap:7px;min-width:0}
#sp .pnwrap .pn{flex:0 1 auto;min-width:0}
#sp .ow{display:flex;align-items:center;gap:8px;color:var(--text-2)}
#sp .ow img{width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ow .ini{
  width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);
  display:grid;place-items:center;font-size:11.5px;color:var(--text-3);flex:none;
}
#sp .ow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 名字进主页：项目页的发布者与排行榜的用户名都是链接。读数沿用原来那一格，
   只在悬停时给品牌橙 + 下划线 —— 一整列名字都染成链接色，这页就成了链接墙。 */
#sp .ow a.nm{color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#sp .ow a.nm:hover{color:var(--accent);text-decoration:underline}
#sp .ow em{font-style:normal;color:var(--accent);font-weight:600}
/* 发布者那一格：名字 + 「已在优先级名单里」的星 + 一个行内动作。
   星是常驻的（这件事不该等鼠标移上来才知道）；动作按钮默认藏着，
   鼠标移到这一行、或键盘焦点落进这一行时才现身 —— 让整张表在静止时是安静的。
   min-width:0 让发布者名字继续能被截断，而不是把这一列越撑越宽。 */
#sp .ow span{min-width:0}
/* 名字后面那排状态标记：星 = 在渲染优先级名单，心 = 在捐赠名单，禁止符 = 在黑名单。
   常驻显示 —— "我是不是已经把他放进某份名单了"不该等鼠标移上来才知道。 */
#sp .ow .mk{flex:none;display:inline-flex;margin-left:4px;color:var(--accent)}
#sp .ow .mk .icon{width:13px;height:13px}
#sp .ow .btn{margin-left:6px;flex:none}
/* 3 点按钮：「优先 / 移出」怎么藏它就怎么藏（同一套 hover/:focus-within 规则）。
   菜单开着的时候必须一直看得见 —— 鼠标移到浮层上时这一行已经不是 hover 状态了。 */
#sp .ow .kebab{padding:4px 7px}
#sp .ow .kebab .icon{width:13px;height:13px}
#sp .ow .kebab[aria-expanded="true"]{opacity:1;border-color:var(--border-strong);color:var(--text)}

/* 3 点菜单的浮层。它挂在 #sp 里而不是表格里 —— .tablewrap 是 overflow:auto，
   绝对定位的子元素会被它裁掉（最后几行尤其明显）；坐标由 Views.mount() 量一次。
   外观沿用其它浮层：surface 底 + 发丝边 + 环境阴影 + 小圆角。 */
#sp .omenu{
  position:absolute;z-index:30;min-width:224px;padding:5px;
  background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--r-sm);
  box-shadow:var(--shadow);
}
#sp .omenu .mh{padding:6px 10px 7px;font-size:11.5px;color:var(--text-3);border-bottom:1px solid var(--border);margin-bottom:5px}
#sp .omenu .mi{display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;color:var(--text-2);text-align:left}
#sp .omenu .mi:hover{background:var(--surface-3);color:var(--text)}
#sp .omenu .mi .mi-ic{flex:none;color:var(--text-3)}
#sp .omenu .mi:hover .mi-ic{color:var(--accent)}
#sp .omenu .mi .mi-ic .icon{width:15px;height:15px}
#sp .omenu .mi .mi-tx{flex:1;min-width:0}
/* 勾放最右边：左边那格留给"这是什么动作"的图标，两个含义不要挤在一个槽里 */
#sp .omenu .mi .mi-ck{width:15px;height:15px;flex:none;color:var(--accent)}
#sp .omenu .mi .mi-ck .icon{width:15px;height:15px}
@media (hover:hover) and (pointer:fine){
  /* 藏的是透明度而不是 display：display:none 会把这个按钮从 Tab 顺序里摘掉。
     触屏（没有 hover）上一直显示，否则这个动作永远点不到。 */
  #sp .ow .btn{opacity:0;transition:opacity .12s}
  #sp .tbl tbody tr:hover .ow .btn,#sp .tbl tbody tr:focus-within .ow .btn{opacity:1}
}
/* 进度条。分数在**自己的列**里（td.frac），不挂在条子后面 —— 挂上去会让每行的轨道长度
   随数字宽度变来变去，一整列参差不齐；进了列，表格布局保证每行轨道等长，分数也右对齐成线。
   .bar 仍被活动汇总表的表头当弹性占位用（见 .acthead .bar），所以这里不给它定 display。 */
#sp .bar{min-width:180px}
#sp .bar .t{position:relative;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .bar .f{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
#sp .tbl td.frac{width:1%;font-size:11.5px;color:var(--text-3)}
#sp .dev{display:inline-flex;gap:4px}
#sp .dev span{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-3)}
#sp .dev span.on{border-color:transparent;background:var(--accent-weak);color:var(--accent);font-weight:600}
/* 状态文案保持中性 —— 品牌橙只留给可操作元素、当前选中、以及数据序列里代表"你"的那条。
   给"渲染中"上橙色会把它变成一堵橙墙，也会稀释橙色本身的意义。 */
#sp .st{font-size:12.5px;color:var(--text-2);white-space:nowrap}
#sp .rankcell{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap}
@media (max-width:760px){
  #sp .tbl{min-width:660px}
  #sp .tbl th,#sp .tbl td{padding-left:12px;padding-right:12px}
}

/* ---------------------------------------------------------------- 工具条 */
#sp .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
#sp .more{display:flex;justify-content:center;padding:14px 0 6px}
#sp .more .btn{gap:9px}
#sp .more .num{color:var(--text-3);font-size:12px}
#sp .input{
  display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:var(--r-sm);background:var(--surface);
  border:1px solid var(--border);min-width:220px;flex:1;max-width:340px;color:var(--text-3);
}
#sp .input input{flex:1;min-width:0;border:none;background:none;color:var(--text);font-size:13px}
/* 焦点环画在整只控件上，而不是里面的输入框上。
   注意：这里绝不能给 input 写 outline:none —— 它的优先级(#sp .input input)
   高过全局的 #sp :focus-visible，会把键盘焦点环整个吃掉，输入框就成了
   键盘用户找不到的控件。改成 :focus-within 让容器亮起来。 */
#sp .input:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
#sp .input input:focus-visible{outline:none}
#sp .input input::placeholder{color:var(--text-3)}
#sp .seg{display:inline-flex;gap:2px;padding:3px;border-radius:8px;background:var(--surface);border:1px solid var(--border);flex-wrap:wrap}
#sp .seg button{padding:5px 11px;border-radius:var(--r-sm);font-size:12.5px;color:var(--text-2)}
#sp .seg button:hover{color:var(--text)}
#sp .seg button[aria-pressed="true"]{background:var(--accent-weak);color:var(--accent);font-weight:600}
#sp .sechead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:26px 0 12px}
#sp .sechead h2{font-size:15px;color:var(--text)}
#sp .sechead .sub{font-size:12px;color:var(--text-3)}
#sp .sechead .spacer{flex:1}

/* ---------------------------------------------------------------- 空状态
   不是"暂无数据"。是"你还没开始，这是怎么开始"。 */
#sp .empty{margin-top:16px}
#sp .empty .inner{
  padding:40px 28px;text-align:center;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);
}
#sp .empty h2{margin:0 0 8px;font-size:16px;font-weight:600}
#sp .empty p{margin:0 auto;max-width:560px;font-size:13.5px;color:var(--text-2);line-height:1.7;text-wrap:pretty}
#sp .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:760px;margin:26px auto 0;text-align:left}
@media (max-width:760px){#sp .steps{grid-template-columns:minmax(0,1fr)}}
#sp .step{display:flex;gap:11px;align-items:flex-start}
#sp .step .n{
  flex:none;width:20px;height:20px;border-radius:50%;border:1px solid var(--border-strong);
  display:grid;place-items:center;font-size:11px;color:var(--text-3);font-variant-numeric:tabular-nums;
}
#sp .step .h{font-size:13px;font-weight:600;margin-bottom:3px}
#sp .step .b{font-size:12.5px;color:var(--text-3);line-height:1.55}
#sp .empty .cta{margin-top:26px;display:inline-flex;gap:9px;flex-wrap:wrap;justify-content:center}
@media (max-width:560px){#sp .empty .inner{padding:32px 18px}}

/* ---------------------------------------------------------------- 已连接的机器
   一台机器一行：客户端名做成徽章，机型是安静的灰，出口在右边。
   不做成一排卡片 —— 机器数量会变，卡片网格一多就成了"仪表盘壁纸"。 */
#sp .machines{display:flex;flex-direction:column}
#sp .machine{display:flex;align-items:center;gap:12px;padding:11px 20px;border-bottom:1px solid var(--border)}
#sp .machine:last-child{border-bottom:none}
#sp .machine .tag{
  flex:none;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:4px;
  background:var(--accent-weak);color:var(--accent);
}
#sp .machine .spec{flex:1;min-width:0;font-size:13px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .machine a.open{font-size:12px;color:var(--text-3);white-space:nowrap;text-decoration:none}
#sp .machine a.open:hover{color:var(--accent);text-decoration:underline}
#sp .machines .none{padding:16px 20px;font-size:13px;color:var(--text-3)}
@media (max-width:560px){#sp .machine{flex-wrap:wrap;gap:6px 10px;padding:11px 16px}}

/* ---------------------------------------------------------------- 顶栏模式开关 */
#sp .modebtn{
  height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;
  border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);
  color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color .12s,color .12s;white-space:nowrap;
}
#sp .modebtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .modebtn .icon{width:13px;height:13px}
@media (max-width:1000px){#sp .modebtn .txt{display:none}#sp .modebtn{padding:0 7px}}

/* ---------------------------------------------------------------- 账户设置 */
#sp .acct{max-width:820px}
#sp .acct .panel{padding:0}
#sp .acct .phead{padding:16px 20px 0}
/* pbody / hint 是账户设置和会话页共用的两个块，不做两份。
   .settings 里的 .hint 有自己的一条规则，优先级更高，不受这里影响。 */
#sp .pbody{padding:14px 20px 18px}
#sp .hint{font-size:12px;color:var(--text-3);line-height:1.65;margin:0 0 12px}
#sp .sw{display:flex;align-items:flex-start;gap:11px;padding:9px 0;cursor:pointer}
#sp .sw input{position:absolute;opacity:0;width:0;height:0}
#sp .sw .track{
  flex:none;width:34px;height:20px;margin-top:1px;border-radius:10px;background:var(--surface-3);
  border:1px solid var(--border);position:relative;transition:background .14s,border-color .14s;
}
#sp .sw .knob{
  position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--text-3);
  transition:transform .14s,background .14s;
}
#sp .sw input:checked + .track{background:var(--accent);border-color:var(--accent)}
#sp .sw input:checked + .track .knob{transform:translateX(14px);background:var(--btn-ink)}
#sp .sw input:focus-visible + .track{outline:2px solid var(--accent);outline-offset:2px}
#sp .sw .txt{font-size:13px;color:var(--text-2);line-height:1.45}
#sp .sw .txt b{display:block;font-weight:550;color:var(--text)}
#sp .sw .txt small{display:block;font-size:12px;color:var(--text-3);margin-top:2px;line-height:1.55}
#sp .sw:hover .track{border-color:var(--border-strong)}

#sp .ulist{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden}
#sp .ulist .u{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid var(--border)}
#sp .ulist .u:last-child{border-bottom:none}
#sp .ulist .u img,#sp .ulist .u .ini{width:22px;height:22px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ulist .u .ini{display:grid;place-items:center;font-size:11.5px;color:var(--text-3);background:var(--surface-2)}
#sp .ulist .u .n{flex:1;min-width:0;font-size:13px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .ulist .u .n a{color:inherit}
#sp .ulist .u .n a:hover{color:var(--accent);text-decoration:underline}
#sp .ulist .none{padding:11px 12px;font-size:12.5px;color:var(--text-3)}
#sp .addrow{display:flex;gap:8px;margin-top:11px;flex-wrap:wrap}
#sp .addrow .input{flex:1;min-width:180px;max-width:none}
#sp .keyrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border)}
#sp .keyrow:last-child{border-bottom:none}
#sp .keyrow .k{
  flex:1;min-width:0;font-size:12.5px;color:var(--text-2);letter-spacing:.3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
#sp .keyrow .c{flex:none;font-size:12px;color:var(--text-3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 渲染密钥的状态徽章。「空闲」这一档原来用三级墨色压在下沉层上 —— 实测 4.39:1，
   差 0.11 没到 AA 的 4.5:1（机检在账户页产物上检出来的）。徽章本来也不属于三级墨色
   的用法（那是轴标签/表头/说明的地方），提到二级墨色，约 7.4:1。 */
#sp .keyrow .use{flex:none;font-size:11px;padding:1px 6px;border-radius:4px;background:var(--surface-3);color:var(--text-2)}
#sp .keyrow .use.on{background:var(--accent-weak);color:var(--accent)}
#sp .avatarline{display:flex;align-items:center;gap:14px}
#sp .avatarline img,#sp .avatarline .ini{
  width:64px;height:64px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface-2);flex:none;
}
#sp .avatarline .ini{display:grid;place-items:center;font-size:22px;color:var(--text-3)}
#sp .filepick{
  display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;
}
#sp .filepick:hover{border-color:var(--border-strong);color:var(--text)}
/* 原生的 file input 没法打扮成细边框控件，所以让 label 当按钮。
   但这里绝不能用 display:none —— 那会把它从 Tab 顺序里摘掉，整个产品就多出一个
   键盘够不到、也读屏不到的控件。改成"看不见但还在"：1px、透明、绝对定位。 */
#sp .filepick input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
#sp .filepick:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
#sp .toast.ok{border-color:var(--border-strong);color:var(--text)}

#sp .state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:88px 20px;text-align:center}
#sp .state .big{font-size:15px;color:var(--text-2);font-weight:600}
#sp .state .small{font-size:13px;color:var(--text-3);max-width:460px;line-height:1.65}
#sp .spin{width:26px;height:26px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:sp-spin .8s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
#sp .sk{background:linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 37%,var(--surface) 63%);background-size:400% 100%;animation:sp-sk 1.3s ease infinite;border-radius:8px}
@keyframes sp-sk{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* ---------------------------------------------------------------- 会话页
   一台机器的一屏：身份条 → 指标带 → 机器信息 → 机器控制 → 时间线 → 可渲染项目。
   新类名都以 .sess / .fact / .tl / .w 打头，避开 .row 那种撞名（设置页正用着 .row）。 */
#sp .sesshead .chip{
  flex:none;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:4px;
  background:var(--surface-3);color:var(--text-2);white-space:nowrap;
}
/* 会话页的状态徽章：运行中 / 已暂停**要一眼分出来**，所以两者都上色。
   用户 2026-10-04 拍板。这破了本系统原来那条"状态一律中性、橙只留给动作"的规矩
   （DESIGN.md 的 Don't 里已记为一次具名例外），但没破"只用一个色相"：
   两个状态在同一个橙色上靠强度分——实心说"开着"，浅底说"要你处理"。
   运行中用实心橙 + 近黑墨，与主按钮同一套（白字压不住品牌橙，见 --btn-ink）。 */
#sp .sesshead .chip.on{background:var(--accent);color:var(--btn-ink);border:1px solid var(--accent)}
#sp .sesshead .chip.off{background:var(--accent-weak);color:var(--accent);border:1px solid transparent}

#sp .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
#sp .fact{
  display:flex;align-items:baseline;gap:12px;padding:12px 20px;min-width:0;
  border-top:1px solid var(--border);
}
#sp .fact:nth-child(-n+2){border-top:none}
#sp .fact:nth-child(even){border-left:1px solid var(--border)}
#sp .fact .k{flex:none;font-size:12px;color:var(--text-3);min-width:88px}
#sp .fact .v{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-width:0;font-size:13px;color:var(--text)}
#sp .fact .v a:hover{color:var(--accent)}
#sp .fact .sec{letter-spacing:1px;color:var(--text-3)}
@media (max-width:720px){
  #sp .facts{grid-template-columns:minmax(0,1fr)}
  #sp .fact:nth-child(even){border-left:none}
  #sp .fact:nth-child(-n+2){border-top:1px solid var(--border)}
  #sp .fact:first-child{border-top:none}
  #sp .fact .k{min-width:76px}
}

/* 时间线：761 条事件是日志不是表格，行距收紧到能扫读的密度 */
#sp .tlbar{padding:12px 20px 0}
#sp .tlwrap{padding:12px 6px 6px}
/* 时间线：761 条事件是日志，不是页面正文。给它自己的滚动区，表头才不会跟着滚没
   （两个日期列一旦失去表头就分不清谁是开始谁是结束）；页面也从 5000px 落回 1800px，
   底下的「可渲染项目」才够得着。tabindex 让键盘也能滚这段。 */
#sp .tablewrap.log{max-height:min(58vh,560px);overflow:auto}
#sp .tablewrap.log th{position:sticky;top:0;z-index:1;background:var(--surface)}
#sp .tablewrap.log:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#sp .tbl.dense{font-size:12.5px}
#sp .tbl.dense th{padding:0 14px 8px}
#sp .tbl.dense td{padding:7px 14px}
#sp .tbl.dense .job{color:var(--text-2)}
@media (max-width:720px){#sp .tbl.dense{min-width:560px}}

/* 可渲染项目：与项目页同构的表（项目 / 发布者 / 状态）。
   早先这里是按原因分组的 chip 墙（.wgroup/.wname）—— 站点把同一句原因重复 27 遍，
   当时认为原因本身才是能读的那层信息。用户反馈那一坨不直观，改成表之后原因进了
   「状态」列：同因的行按排序天然相邻，不必再印分组标题，那一列自己就是那层信息。 */
/* 「正在渲染」标记：可渲染项目那张表里，这是唯一"此刻正在进行"的一行，
   所以用 accent 的浅底 + 强调字色点出来 —— 与设置页按下分段、账户页在用的键
   是同一套词汇（accent-weak 底 + accent 字），不是新色相。 */
#sp .now{flex:none;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--accent-weak);color:var(--accent);white-space:nowrap}
#sp .dash{color:var(--text-3)}
#sp .sess .none{padding:4px 0;font-size:13px;color:var(--text-3)}

/* 活动汇总：时间线的默认视图。一段一行、四个数、一条按渲染时长画的条。
   761 条事件不该占满一屏，它只该回答"这台机器哪天在干活"。
   用 flex 而不是 grid：末尾那列（发送失败）有没有是看数据决定的。 */
#sp .acts{padding:2px 0 0}
#sp .acthead,#sp .actrow{display:flex;align-items:center;gap:12px;padding:0 20px}
#sp .acthead{font-size:11.5px;color:var(--text-3);padding-bottom:8px;border-bottom:1px solid var(--border)}
#sp .actrow{padding-top:9px;padding-bottom:9px;border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-2)}
#sp .actrow .ad{flex:none;width:64px;color:var(--text)}
#sp .actrow .ab{flex:1;min-width:28px;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .actrow .ab i{display:block;height:100%;background:var(--accent);opacity:.55;border-radius:3px}
#sp .actrow .av{flex:none;width:62px;text-align:right;color:var(--text)}
#sp .actrow .an{flex:none;width:44px;text-align:right}
#sp .actrow .aj,#sp .actrow .af{flex:none;width:44px;text-align:right;color:var(--text-3)}
#sp .actrow .af.on{color:var(--text-2)}
#sp .acthead .ad{flex:none;width:64px}
#sp .acthead .bar{flex:1;min-width:28px}
#sp .acthead .h{flex:none;width:62px;text-align:right}
#sp .acthead .h.s{width:44px}
#sp .tlfoot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px 18px}
#sp .tlfoot .sub{font-size:12px;color:var(--text-3)}
@media (max-width:560px){
  #sp .acthead,#sp .actrow{gap:8px;padding-left:14px;padding-right:14px}
  #sp .actrow .ad{width:52px}
  #sp .actrow .av,#sp .acthead .h{width:52px}
  #sp .actrow .an,#sp .actrow .aj,#sp .actrow .af,#sp .acthead .h.s{width:34px}
}

/* ---------------------------------------------------------------- 设置 */
#sp .settings{max-width:680px;padding:4px 20px}
/* 注意：这些必须限定在 .settings 里。row 这个名字同时被全站实时那条带子
   （.farm .row，数值 + 走势的一行）用着，不加限定的话设置页的 padding:16px 0
   会套到那条带子上，把 24px 的一行撑成 56px。 */
#sp .settings .row{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
#sp .settings .row:last-child{border-bottom:none}
#sp .settings .row .lbl{font-size:13px;font-weight:550;color:var(--text);min-width:104px}
#sp .settings .row.block{display:block}
#sp .settings .row.block .lbl{margin-bottom:10px}
#sp .settings .row .hint{font-size:12px;color:var(--text-3);margin-top:9px;line-height:1.65;max-width:520px}
#sp .foot{font-size:12px;color:var(--text-3);margin-top:26px;text-align:center}
#sp .toast{
  position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
  background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text-2);
  padding:9px 15px;border-radius:var(--r-sm);font-size:12.5px;box-shadow:var(--shadow);z-index:10;
}

/* --------------------------------------------- 上传页 / 分析等待页（第三类页面）
   前两类是"整页重建"和"只补翻译"。这两页是**局部换装**：
     · /getstarted 同时是「下载客户端」指南页，所以只有「Add your project」那一段归我们，
       页面的其余部分（介绍、四个下载入口、页脚）保持原站不动；
     · /project/add/<token> 是上传后的纯等待页，整页归我们。
   共同点：**能干活的东西原样搬过来，不重写**。上传表单、估算器、进度条都是站点自己
   渲染的节点，站点挂的 addproject.js 认的是 id 而不是外观 —— 把节点搬进我们的卡片，
   onsubmit/onclick 属性和已经绑定好的处理器都还在，所以我们不重实现上传逻辑。
   下面先抹掉原站 Bootstrap 给这些节点的外观，再按我们的规矩重画。 */

/* 局部接管：#sp 不再铺满视口，只占它替换掉的那一段。
   **自带底色**是必须的，不是装饰：站点那一页有自己的主题（实测站点在浅色主题下、
   而我们的主题跟随系统是深色），文字色是从我们的 token 里来的 —— 不自带底色就会
   出现"浅色文字落在站点白色背景上"的隐形标题。接管的那一段自己成一块，两边都不靠。 */
#sp.sp-inline{position:static;inset:auto;z-index:auto;overflow:visible;background:var(--bg);padding:24px 0 26px}
#sp.sp-inline .wrap{max-width:1240px;padding:0 24px}

/* 版式：第一行两张卡（选文件 / 估算器）等高，须知整行跨两列。
   之前是"左列两张卡 vs 右列须知"的两栏，而须知有 19 条 —— 左边必然空出半屏。
   现在由 grid 直接排三张卡：.up-col 用 display:contents 让它的两个孩子成为 grid 项，
   不再需要"列"这一层。 */
#sp .up-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:stretch;margin-top:16px}
#sp .up-col{display:contents}
#sp .up-grid .panel{min-width:0}
#sp .up-rules{grid-column:1 / -1}
@media (max-width:900px){#sp .up-grid{grid-template-columns:minmax(0,1fr)}}
#sp .up .panel{padding:0}
#sp .up-body{padding:14px 20px 18px}
#sp .up-body > :last-child{margin-bottom:0}
#sp .up-src{font-size:12px;color:var(--text-3);line-height:1.65;margin:12px 20px 18px;padding-top:12px;border-top:1px solid var(--border)}

/* 须知那一块是**从站点搬来的散文**：结构是站点的，观感必须是我们的。
   实测它原来的样子：三个句子连成一大段、数字埋在句子里、CPU/GPU 在一个 <ul> 里而
   「项目总数」是个裸文本节点、三个分组的小标题跟面板标题同级 —— 一坨，读不出层次。
   这里按"分组的参考条目"重新立规矩：组标题降一级、组间发丝线、正文限宽、数据排成一行。
   文字一个字都没改，数字仍旧是站点当场渲染的值。 */
#sp .up-rules .up-body h4{
  font-size:12px;font-weight:600;color:var(--text-3);letter-spacing:.02em;
  margin:22px 0 10px;padding-top:18px;border-top:1px solid var(--border);
}
#sp .up-rules .up-body h4:first-child{margin-top:0;padding-top:0;border-top:none}
#sp .up-rules .up-body p{margin:0 0 14px;max-width:76ch;font-size:12.5px;color:var(--text-2);line-height:1.75}
/* 排队那一行：两个 <li> 本质是两个数，不该画成项目符号 */
#sp .up-rules .up-body .qpos{display:flex;flex-wrap:wrap;gap:6px 30px;margin:0 0 8px}
#sp .up-rules .up-body .qpos li{padding-left:0;font-size:12.5px;color:var(--text-3)}
#sp .up-rules .up-body .qpos li::before{display:none}
#sp .up-rules .up-body .qpos li strong{
  margin-left:4px;font-size:15px;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;
}
#sp .up-rules .up-body .qtotal{display:block;margin-bottom:4px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}

/* 须知整行宽了，十几条横排会拉出很长的行 —— 分两栏，读到哪儿跟到哪儿。
   注意 ul 在别处是 flex 列（见下），多栏排版只对块级容器生效，所以这里要还原成 block；
   排队那一行（.qpos）是数据不是条目，排除在外。 */
@media (min-width:820px){
  #sp .up-rules .up-body ul:not(.qpos){display:block;columns:2;column-gap:36px}
  #sp .up-rules .up-body ul:not(.qpos) li{break-inside:avoid;margin-bottom:8px}
}

/* ---- 抹掉原站外观：搬过来的每个容器都不再是"一块原站的盒子" ---- */
#sp .up-body .w-section,#sp .up-body .w-box,#sp .up-body .container,
#sp .up-body .sign-in-wr,#sp .up-body .blog-post{
  padding:0;margin:0;background:none;border:none;box-shadow:none;border-radius:0;max-width:none;width:auto;
}
#sp .up-body .row{margin:0}
#sp .up-body h4{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--text)}
#sp .up-body p{margin:0 0 14px;font-size:13px;color:var(--text-2);line-height:1.75}
#sp .up-body ul{margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#sp .up-body ul li{position:relative;padding-left:15px;font-size:12.5px;color:var(--text-2);line-height:1.7}
#sp .up-body ul li::before{content:"";position:absolute;left:0;top:.66em;width:4px;height:4px;border-radius:50%;background:var(--text-3)}
#sp .up-body strong{color:var(--text);font-weight:600}
#sp .up-body a{color:var(--accent)}
#sp .up-body #addproject_warning_zero_frame{font-size:13px}

/* 上传表单：原站是 <table> 三行（标签 / 文件框+进度 / 提交）。
   表格在这里没有语义，摊平成一格一行。 */
#sp .up-body form table,
#sp .up-body form tbody,
#sp .up-body form tr,
#sp .up-body form td{display:block;width:auto;padding:0}
#sp .up-body form td{text-align:left !important;vertical-align:baseline !important}
#sp .up-body form td:first-child{font-size:12px;color:var(--text-3);margin-bottom:8px}
#sp .up-body form td + td{margin-bottom:16px}
#sp .up-body form td:last-child{margin-bottom:0}
#sp .up-body form br + strong{color:var(--text-2)}

/* 文件框：原生 file input 只有 ::file-selector-button 是可塑的 */
#sp .up-body input[type=file]{
  display:block;width:100%;padding:11px 12px;margin:0 0 10px;
  background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:var(--r-sm);
  color:var(--text-3);font-size:12.5px;cursor:pointer;transition:border-color .12s,color .12s;
}
#sp .up-body input[type=file]:hover{border-color:var(--accent);color:var(--text-2)}
#sp .up-body input[type=file]::file-selector-button{
  font:inherit;font-weight:600;margin:0 12px 0 0;padding:6px 12px;border-radius:var(--r-sm);
  border:1px solid var(--border-strong);background:var(--surface-3);color:var(--text);cursor:pointer;
}
#sp .up-body input[type=file]::file-selector-button:hover{border-color:var(--accent);color:var(--accent)}
#sp .up-body .note{display:block;margin-top:1px;font-size:12px;color:var(--text-3);line-height:1.65}

#sp .up-body input[type=submit],#sp .up-body button.btn,#sp .up-body input.btn{
  font:inherit;font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--r-sm);
  background:var(--accent);border:1px solid var(--accent);color:var(--btn-ink);cursor:pointer;
  transition:filter .12s;
}
#sp .up-body input[type=submit]:hover,#sp .up-body button.btn:hover,#sp .up-body input.btn:hover{filter:brightness(1.07)}

/* 上传进度：站点用 jQuery UI progressbar，并且**内联**写死了 #EEB0A0 的底色 ——
   内联样式只能在样式表里用 !important 压过去，这是必要的例外。 */
#sp .up-body #upload_progress_bar{
  height:7px !important;margin:2px 0 8px !important;border-radius:4px;
  background:var(--surface-2) !important;border:1px solid var(--border) !important;
}
#sp .up-body #upload_progress_bar .ui-progressbar-value{
  background:var(--accent) !important;border:none !important;border-radius:3px;margin:0;height:100%;
}
#sp .up-body #upload_progress_label{
  position:static !important;text-shadow:none !important;text-align:right;
  display:block;font-size:11.5px;color:var(--text-3);padding:0 0 6px;
}

/* 估算器：两个数字输入 + 一个设备名搜索框。
   设备名是"找一个名字"，不该占满整行 —— 而且站点这一行用的是 2013 版 Bootstrap 的
   .input-group（table-cell + float），我们没管住它，实测等效宽度 949px 时 OK 的右缘
   超出视口 5px、整页横向溢出。所以这一行**整行重新声明**成普通 flex，并给输入封顶：
   OK 永远跟在框后面，再窄也挤不出去。 */
#sp .up-body input[type=text],#sp .up-body input.form-control{
  font:inherit;font-size:13px;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface-2);border:1px solid var(--border);color:var(--text);
}
#sp .up-body table input[type=text]{width:92px}
/* 估算器那两个数字是"标签 + 值"两列，但站点用的是内容自适应的 <table>，实测列间空出
   一大截。只对这一块把 tbody/tr 摊平（display:contents），让那一行变成规整的两列网格。
   标签列必须用 max-content：auto 轨道会把容器剩余空间吸进去，标签照样离输入框老远。
   范围限定在 [data-up="est"]：上传表单里那张 table 有 colspan，不能一起摊。 */
#sp [data-up="est"] table{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:10px 14px;align-items:center;width:auto;margin:0 0 16px}
#sp [data-up="est"] table tbody,#sp [data-up="est"] table tr{display:contents}
#sp [data-up="est"] table td{display:block;padding:0;text-align:left !important;white-space:nowrap}
#sp .up-body input[type=text]:focus,#sp .up-body input.form-control:focus{outline:none;border-color:var(--accent)}
#sp .up-body form.form-inline{display:block;margin:0 0 14px}
#sp .up-body .input-group{display:flex;flex-wrap:nowrap;align-items:stretch;gap:8px;width:100%}
#sp .up-body .input-group .form-control{flex:1 1 auto;min-width:0;width:auto;max-width:320px}
#sp .up-body .input-group-btn{display:flex;flex:0 0 auto;width:auto;white-space:nowrap}
#sp .up-body .input-group-btn > *{flex:0 0 auto}
#sp .up-body #addproject_estimator_result{
  font-size:12.5px;color:var(--text-2);line-height:1.7;
  padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2);
}
#sp .up-body #addproject_estimator_result:empty{display:none}

/* ---- 分析等待页 ---- */
#sp .an-card{padding:0}
#sp .an-head{display:flex;gap:15px;align-items:flex-start;padding:24px 20px 0}
#sp .an-head .spin{flex:none;margin-top:2px}
#sp .an-state{font-size:15px;font-weight:600;color:var(--text)}
#sp .an-sub{font-size:12.5px;color:var(--text-3);line-height:1.75;margin-top:7px;max-width:640px}
#sp .an-track{height:6px;margin:18px 20px 0;border-radius:3px;background:var(--surface-2);overflow:hidden}
#sp .an-track i{display:block;height:100%;width:0;background:var(--accent);border-radius:3px;transition:width .35s ease}
#sp .an-track.indet i{width:32%;animation:sp-indet 1.15s ease-in-out infinite}
@keyframes sp-indet{from{margin-left:-32%}to{margin-left:100%}}
#sp .an-done{padding:20px 20px 0}
#sp .an-done .an-sub{margin-bottom:14px}
#sp .an-foot{padding:0 20px 20px}

/* 分析完成后，站点把它自己那套「新增项目」表单塞进 #sp-an-result。
   这一步本版没有重制（卡片里已经写明），所以这里只做**可读性兜底**：
   不让 2013 版 Bootstrap 的栅格和表单控件在我们的卡片里散架。不求好看，求能用。 */
#sp .sp-siteform{padding:18px 20px 20px;border-top:1px solid var(--border)}
#sp .sp-siteform section,#sp .sp-siteform .slice,
#sp .sp-siteform .container,#sp .sp-siteform .w-section,#sp .sp-siteform .w-box,
#sp .sp-siteform .form-light,#sp .sp-siteform .padding-15{
  padding:0;margin:0;background:none;border:none;box-shadow:none;border-radius:0;max-width:none;width:auto;
}
#sp .sp-siteform .row{margin:0}
#sp .sp-siteform [class*="col-md-"],#sp .sp-siteform [class*="col-sm-"]{float:none;width:auto;padding:0}
#sp .sp-siteform h4{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--text)}
#sp .sp-siteform hr{margin:18px 0;border:none;border-top:1px solid var(--border)}
#sp .sp-siteform label{font-size:12.5px;color:var(--text-2)}
#sp .sp-siteform .form-group{margin-bottom:14px}
#sp .sp-siteform input[type=text],#sp .sp-siteform input[type=number],#sp .sp-siteform input.form-control,
#sp .sp-siteform select,#sp .sp-siteform textarea{
  font:inherit;font-size:13px;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface-2);border:1px solid var(--border);color:var(--text);max-width:100%;
}
#sp .sp-siteform input[type=checkbox],#sp .sp-siteform input[type=radio]{accent-color:var(--accent);margin-right:7px}
#sp .sp-siteform input[type=submit],#sp .sp-siteform button{
  font:inherit;font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--r-sm);
  background:var(--accent);border:1px solid var(--accent);color:var(--btn-ink);cursor:pointer;
}
#sp .sp-siteform .checkbox,#sp .sp-siteform .persistent{display:block;margin:0 0 12px}
#sp .sp-siteform .error,#sp .sp-siteform div[style*="color:red"]{color:var(--accent) !important;font-size:12.5px}

/* ---------------------------------------------------------------- 一次编排的动效
   曲线的绘制由 JS 用 getTotalLength() 精确驱动，这里只管其余块的一次性入场。
   "一次性"是字面意思：只有换视图（或刷新）才播。筛选项、排序、显示更多这些只改列表的
   render() 不再重放 —— 加一个筛选条件却让上面那条实时状态带重新淡入一次，
   看起来就像整页在重载（用户报的就是这个）。开关是 #sp 上的 .sp-anim，由 render() 决定。 */
@keyframes sp-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  #sp .chart .area{animation:sp-rise .7s cubic-bezier(.16,1,.3,1) .15s both}
  #sp.sp-anim .kpis,#sp.sp-anim .grid,#sp.sp-anim .farm{animation:sp-rise .5s cubic-bezier(.16,1,.3,1) both}
  #sp.sp-anim .grid{animation-delay:.06s}
  #sp.sp-anim .farm{animation-delay:.1s}
}
`;

  /**
   * 原版界面模式下的"切回现代化"小开关的样式。
   * 单独注入，因为那种模式下整套 SP.CSS 是故意不加载的 —— 它是给 #sp 用的，
   * 而 #sp 在原版模式下根本不存在。这条只有 30 行，也只作用于自己的 id。
   */
  SP.injectModePillStyle = function injectModePillStyle() {
    if (document.getElementById('sp-mode-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-mode-style';
    s.textContent = `
      #sp-mode-pill{
        position:fixed;left:14px;bottom:14px;z-index:2147482000;
        display:inline-flex;align-items:center;gap:8px;
        padding:10px 15px;border-radius:9px;cursor:pointer;
        background:#e06d58;color:#fff;border:1px solid rgba(0,0,0,.2);
        font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        box-shadow:0 2px 6px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.3);
        transition:transform .12s, box-shadow .12s;
      }
      /* 原版模式下整页都是站点自己的样式，这个按钮是唯一属于我们的东西 ——
         它必须一眼看得见：之前是 opacity:.62 的深色小条，实测等于隐形。
         品牌橙在这里用得正当：它是可操作元素。 */
      #sp-mode-pill:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.34)}
      #sp-mode-pill:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #sp-mode-pill svg{width:15px;height:15px;flex:none;fill:#fff}
    `;
    (document.head || document.documentElement).appendChild(s);
  };

  /** 注入样式（幂等） */
  SP.injectStyle = function injectStyle() {
    if (document.getElementById('sp-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-style';
    s.textContent = SP.CSS;
    (document.head || document.documentElement).appendChild(s);
  };

  /**
   * 页面一开始就压住原站 UI，避免闪烁。
   * 用 display:none 而不是 visibility —— 原站的 2013 版 Bootstrap 表头是 fixed 的，
   * 只藏可见性仍会挡住我们。背景色与 token 里的 --bg 一致，避免接管瞬间闪白。
   */
  SP.injectGuard = function injectGuard() {
    if (document.getElementById('sp-guard')) return;
    const s = document.createElement('style');
    s.id = 'sp-guard';
    s.textContent = `
      html{background:#0b0d11}
      @media (prefers-color-scheme:light){html{background:#fbfbfc}}
      body > *:not(#sp){display:none !important}
      body{overflow:hidden !important;background:transparent !important}
    `;
    (document.head || document.documentElement).appendChild(s);
  };
})();

/* ===== src/40-ui.js ===== */
/* ==========================================================================
 * 40-ui.js — 组件层
 *
 * 大部分是纯函数：输入数据，输出 HTML 字符串。
 * 只有最后一段（图表）是命令式的 —— 面积图要按实测像素渲染、要挂悬停十字线，
 * 没法用字符串表达。它同样只依赖传进来的数据，不读全局状态。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, t } = { Util: SP.Util, t: SP.t };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  /** 分位色阶的五个档位。按绝对值分档会让集中在 500–2000 的日常
   *  全挤进最低两档、整片糊成一个红块；按分位数分档才看得见分布。
   *  颜色走 token（--heat-1..5），这样暗/亮两套主题各自取自己的橙。 */
  const SHADE = ['--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5'];
  const HEAT = (i) => `var(${SHADE[i]})`;

  /* ------------------------------------------------------------ 图标 */

  const ICONS = {
    refresh: '<path d="M13.65 2.35A7.96 7.96 0 0 0 8 0C3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"/>',
    search: '<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/>',
    user: '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.34 0-10 1.67-10 5v3h20v-3c0-3.33-6.66-5-10-5z"/>',
    gear: '<path d="M19.14 12.94a7.5 7.5 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.86a.5.5 0 0 0 .12.62l2.03 1.58a7.5 7.5 0 0 0 0 1.88L2.82 14.52a.5.5 0 0 0-.12.62l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.39 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.55 1.62-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.6 3.6 0 0 1 12 15.6z"/>',
    sheep: '<path d="M17 4a3 3 0 0 0-2.82 2H9.82A3 3 0 1 0 4 8.83V15a4 4 0 0 0 4 4h8a2 2 0 0 0 2-2v-2.2A3 3 0 0 0 17 4zm0 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/>',
    // 排序箭头是画出来的，不是 ▲▼ 两个字符 —— 字符的磅重、基线和字号都不归我们管
    caretUp: '<path d="M12 8.5l5.5 7h-11z"/>',
    caretDown: '<path d="M12 15.5l-5.5-7h11z"/>',
    // 实心星：标记"这个发布者已经在你的渲染优先级名单里了"
    star: '<path d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96z"/>',
    // 三个点：发布者那一格的动作菜单。字符"⋯"的磅重与基线不归我们管，所以画出来
    more: '<path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    // 勾：菜单里"已经在名单里"的那一项。有它才看得出这一项是状态而不是动作
    check: '<path d="M9.55 17.6l-4.6-4.6 1.7-1.7 2.9 2.9 7.8-7.8 1.7 1.7z"/>',
    // 捐赠积分：一颗心。与禁止符的轮廓差得够远，两个图标不会看混
    heart: '<path d="M12 20.3l-1.4-1.3C5.4 14.4 2 11.3 2 7.5 2 4.4 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.4 22 7.5c0 3.8-3.4 6.9-8.6 11.5L12 20.3z"/>',
    // 黑名单：禁止符。这里用描边画 —— 填充式"挖空"路径在小尺寸下容易糊成一团
    ban: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2"/>',
  };
  const icon = (name, cls) =>
    `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ------------------------------------------------------------ 基础块 */

  const initial = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();

  /** 头像：取不到图（跨域、懒加载未完成）就退回首字母，不留破图。
   *  站点自己的头像 URL 是 /media/image/avatar/... 的同源路径，不需要额外处理。 */
  const avatar = (src, name, cls) => (src
    ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls || ''}">${esc(initial(name))}</span>`);

  /* ------------------------------------------------------------ 指标带 */

  /** 指标带。默认 4 格；账号有发布者身份时会到 5–6 格，所以把格数写进 data-n 交给
   *  CSS（见 30-style.js 的 .kpis[data-n]）去重排栅格与内边线，别在这里写死列数。 */
  const kpis = (items) => `<div class="kpis" data-n="${items.length}">${items.map((it) => `
    <div class="kpi">
      <div class="k">${esc(it.k)}</div>
      <div class="v num">${esc(it.v)}</div>
      ${it.d ? `<div class="d">${it.d}</div>` : ''}
    </div>`).join('')}</div>`;

  /* ------------------------------------------------------------ 产出格 */

  /**
   * 日历热力图（近 53 周 × 7），带月份与星期轴。
   * @param {Array<{d:string,v:number}>} daily 逐日产出
   * @param {number} weeks 周数
   * @param {string} lang 当前界面语言，决定月份怎么写（10月 / Oct）
   * @param {{unit?:'frames'|'days'}} [opts] 数据口径。站点只在自己的主页内联逐日帧数；
   *   别人的主页只有"这天有没有渲染"的日历，那份数据只能按二值画，计数文案也得跟着换口径。
   */
  function heatmap(daily, weeks, lang, opts) {
    const byDays = !!(opts && opts.unit === 'days');
    const WEEKS = weeks || 53;
    const span = WEEKS * 7;
    const byDate = new Map((daily || []).map((x) => [x.d, x.v]));
    const today = Util.dkey(new Date());
    const start = Util.dshift(today, -(span - 1));

    const cells = [];
    for (let i = 0; i < span; i++) {
      const d = Util.dshift(start, i);
      cells.push({ d, v: d > today ? 0 : (byDate.get(d) || 0) });
    }

    const nz = cells.map((x) => x.v).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => (nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * p))] : 0);
    const T = [q(0.2), q(0.4), q(0.6), q(0.8)];
    // 退化保护：非零值全都一样大时（站点只记"有没有渲染"），分位档会全部落进最低档，
    // 整片糊成一个颜色。此时统一用中间档，至少把"有没有"读出来。
    const flat = nz.length > 0 && T[0] === T[3];
    const shade = (v) => {
      if (!v) return 'var(--surface-3)';
      if (flat) return HEAT(2);
      const i = v <= T[0] ? 0 : v <= T[1] ? 1 : v <= T[2] ? 2 : v <= T[3] ? 3 : 4;
      return HEAT(i);
    };

    // 首日对齐到真实的星期列，否则整片格子错行
    const pad = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cols = Math.ceil((pad + span) / 7);

    // 星期轴：只标一/三/五，七行全标会挤成一团
    const wdNames = String(t('heat.weekday')).split(',');
    const wd = [0, 1, 2, 3, 4, 5, 6]
      .map((r) => `<span>${r % 2 === 0 && wdNames[Math.floor(r / 2)] ? esc(wdNames[Math.floor(r / 2)]) : ''}</span>`).join('');

    // 月份轴：每个自然月在第一列出现的地方落一个标签，跨列显示。
    // 两条规则来自实际排版：一列宽的残月不标（它会和隔壁撞在一起），
    // 年号只在第一个标签和跨年那一格出现（十三个"九月"分不清是哪个九月）。
    const monthFmt = (d, withYear) => {
      try {
        const opt = { month: lang === 'zh' ? 'long' : 'short', timeZone: 'UTC' };
        if (withYear) opt.year = 'numeric';
        return new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', opt);
      } catch (e) { return withYear ? d.slice(0, 7) : d.slice(5, 7); }
    };
    const flatCells = [...Array(pad).fill(null), ...cells];
    const monthLabels = [];
    let lastMonth = null, lastEnd = -99, lastYear = null;
    for (let c = 0; c < cols; c++) {
      const first = flatCells[c * 7];
      if (!first) continue;
      const m = Util.mkey(first.d);
      if (m === lastMonth) continue;
      lastMonth = m;
      // 这个月从本列开始，占到它最后一次出现为止
      let end = c;
      while (end + 1 < cols && flatCells[(end + 1) * 7] && Util.mkey(flatCells[(end + 1) * 7].d) === m) end++;
      const w = end - c + 1;
      if (w < 2 || c - lastEnd < 2) continue;   // 残月 / 与上一个标签挨太近，跳过
      const year = first.d.slice(0, 4);
      const withYear = lastYear === null || year !== lastYear;
      monthLabels.push(`<span style="grid-column:${c + 1} / span ${w}">${esc(monthFmt(first.d, withYear))}</span>`);
      lastEnd = end;
      lastYear = year;
    }

    const body = flatCells.map((c) => (c === null
      ? '<i style="background:transparent"></i>'
      : `<i data-d="${esc(c.d)}" data-v="${c.v}" style="background:${shade(c.v)}"></i>`)).join('');

    const total = cells.reduce((a, b) => a + b.v, 0);
    const peak = nz.length ? nz[nz.length - 1] : 0;
    // 图例必须和数据用同一套档位：空 + 五档，多一个少一个都是在骗人。
    // 二值时档位本身退化成单档（见上面的 flat 保护），图例也跟着退成"没渲染 / 有渲染"。
    // 顺带修掉一处老问题：这两个词以前是写死的中文，英文界面下也照印"少 / 多"。
    const legend = byDays
      ? `${esc(t('heat.legendOff'))} <i style="background:var(--surface-3)"></i><i style="background:${HEAT(2)}"></i> ${esc(t('heat.legendOn'))}`
      : `${esc(t('heat.legendLow'))} <i style="background:var(--surface-3)"></i>${SHADE.map((_, i) => `<i style="background:${HEAT(i)}"></i>`).join('')} ${esc(t('heat.legendHigh'))}`;
    const totalText = byDays ? t('heat.totalDays', { n: fmt(nz.length) }) : t('heat.total', { n: fmt(total) });

    return {
      html: `<div class="heatwrap" data-unit="${byDays ? 'days' : 'frames'}">
          <div class="wdcol"><div class="pad"></div><div class="wd" aria-hidden="true">${wd}</div></div>
          <div class="heatscroll">
            <div class="mlabels" style="--cols:${cols}">${monthLabels.join('')}</div>
            <div class="cells" style="--cols:${cols}">${body}</div>
          </div>
        </div>
        <div class="legend">${legend}<span class="spacer"></span><span class="num">${esc(totalText)}</span></div>`,
      note: byDays ? t('heat.noteDays', { nz: nz.length }) : t('heat.note', { nz: nz.length, peak: fmt(peak) }),
    };
  }

  /**
   * 热力图的悬停提示。原生 title 又慢又不可控，而"这个格子是哪一天"正是
   * 这张图最该回答的问题，值得一个真正的浮层 —— 和积分曲线共用同一套外观。
   */
  function bindHeatTips(wrap, lang) {
    if (!wrap || wrap.dataset.tips === 'on') return;
    wrap.dataset.tips = 'on';
    // 二值热力图（别人的主页）每格只有"有没有渲染"，不能说成"几帧"
    const byDays = wrap.dataset.unit === 'days';
    const tip = document.createElement('div');
    tip.className = 'tip';
    wrap.appendChild(tip);
    const onMove = (ev) => {
      const cell = ev.target.closest('.cells i[data-d]');
      if (!cell) { tip.style.opacity = '0'; return; }
      const box = wrap.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      const d = cell.dataset.d;
      const v = Number(cell.dataset.v) || 0;
      const pretty = (() => {
        try {
          return new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC',
          });
        } catch (e) { return d; }
      })();
      tip.innerHTML = byDays
        ? `<b>${esc(v ? t('heat.tipOn') : t('heat.tipOff'))}</b><i>${esc(pretty)}</i>`
        : `<b class="num">${esc(t('heat.tip', { n: fmt(v) }))}</b><i>${esc(pretty)}</i>`;
      // 界面缩放不为 100% 时，rect 给的是物理像素，而 left/top 要 CSS 像素 —— 除一下
      const z = Util.zoomOf(wrap);
      tip.style.left = `${(r.left - box.left) / z + r.width / z / 2}px`;
      tip.style.top = `${(r.top - box.top) / z - 6}px`;
      tip.style.opacity = '1';
    };
    wrap.addEventListener('pointerover', onMove);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });
  }

  /* ------------------------------------------------------------ 月度产出 */

  /** 逐日产出 → 按月汇总的柱状图（含最高月 / 最低月） */
  function months(daily) {
    const buckets = new Map();
    for (const x of daily || []) {
      const k = Util.mkey(x.d);
      buckets.set(k, (buckets.get(k) || 0) + x.v);
    }
    const keys = [...buckets.keys()].sort();
    if (!keys.length) return { html: '', first: '', mid: '', last: '' };

    const vals = keys.map((k) => buckets.get(k));
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const label = (k) => k;
    const bars = vals.map((v, i) =>
      `<i style="height:${Math.max(2, Math.round((v / Math.max(1, mx)) * 132))}px" title="${esc(label(keys[i]))} · ${fmt(v)} ${esc(t('heat.frame'))}"></i>`).join('');

    return {
      html: `<div class="months">${bars}</div>
        <div class="mlabel"><span>${esc(keys[0])}</span><span>${esc(keys[Math.floor(keys.length / 2)])}</span><span>${esc(keys[keys.length - 1])}</span></div>
        <div class="mstat">
          <div><div class="k">${esc(t('months.max'))}</div><div class="v num">${esc(keys[vals.indexOf(mx)])} · ${fmt(mx)}</div></div>
          <div><div class="k">${esc(t('months.min'))}</div><div class="v num">${esc(keys[vals.indexOf(mn)])} · ${fmt(mn)}</div></div>
        </div>`,
    };
  }

  /* ------------------------------------------------------------ 全站实时 */

  /** 首页的 4 张站点统计 → 一条通栏（一个整面 + 内部 1px 分隔）。
   *  flush：当它是一屏的第一个元素时去掉上外边距。 */
  function farm(stats, opts) {
    if (!stats || !stats.length) return '';
    const flush = opts && opts.flush;
    return `<div class="farm"${flush ? ' style="margin-top:0"' : ''}>${stats.slice(0, 4).map((s) => {
      const series = (s.spark || []).filter((x) => Number.isFinite(x));
      let spark = '';
      if (series.length > 1) {
        const mx = Math.max(...series), mn = Math.min(...series);
        const d = series.map((v, i) =>
          `${i ? 'L' : 'M'}${(i * 100 / (series.length - 1)).toFixed(1)},${(20 - ((v - mn) / Math.max(1, mx - mn)) * 18).toFixed(1)}`).join('');
        spark = `<svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".75"/></svg>`;
      }
      return `<div>
        <div class="k">${esc(s.key ? t(s.key) : s.label || '—')}</div>
        <div class="row"><span class="v num">${esc(s.value === undefined || s.value === null || s.value === '' ? '—' : s.value)}</span>${spark}</div>
      </div>`;
    }).join('')}</div>`;
  }

  /* ------------------------------------------------------------ 已连接的机器 */

  /** 已连接机器的总览：一行一台，客户端名做徽章，机型安静地跟在后面 */
  function machines(m) {
    const list = (m && m.list) || [];
    if (!list.length) return `<div class="machines"><div class="none">${esc(t('machines.none'))}</div></div>`;
    return `<div class="machines">${list.map((x) => `<div class="machine">
        <span class="tag">${esc(x.client || t('machines.unknown'))}</span>
        <span class="spec" title="${esc(x.spec)}">${esc(x.spec || '—')}</span>
        ${x.url ? `<a class="open" href="${esc(x.url)}" target="_self">${esc(t('machines.open'))}</a>` : ''}
      </div>`).join('')}</div>`;
  }

  /* ------------------------------------------------------------ 进度条 / 设备 */

  /**
   * 进度分数文案。原站把「1216 / 12000」直接压在半填充的条子上，白字横跨橙/灰两色，
   * 还容易被截断；这里把数字移到条子外面，回落时用百分比。
   */
  function progressText(pct, done, total) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return Number.isFinite(done) && Number.isFinite(total) && total > 0
      ? `${fmt(done)} / ${fmt(total)}`
      : `${p.toFixed(0)}%`;
  }

  /**
   * 6px 轨道 + 强调色填充。
   *
   * 分数**不在这里**：它作为独立的一列跟在这个格子后面（见 50-views.js 的项目表）。
   * 早先把 `<span class="n">` 挂在条子后面，`flex:1` 的轨道就被每行不同的数字宽度挤得
   * 长短不一 —— 一张表里十条进度条十个长度，整列看着参差不齐。数字一旦进了自己的列，
   * 表格布局保证每行的轨道宽度完全一致，顺带让分数右对齐成一条线。
   */
  function progress(pct, label) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="bar"${label ? ` title="${esc(label)}"` : ''}><div class="t"><div class="f" style="width:${p}%"></div></div></div>`;
  }

  function devices(cpu, gpu) {
    if (!cpu && !gpu) return '<span class="st">—</span>';
    return `<span class="dev">
      <span class="${cpu ? 'on' : ''}">${esc(t('proj.cpu'))}</span>
      <span class="${gpu ? 'on' : ''}">${esc(t('proj.gpu'))}</span>
    </span>`;
  }

  /* ------------------------------------------------------------ 状态页 */

  const state = {
    loading: (msg) => `<div class="state"><div class="spin"></div><div class="small">${esc(msg || t('state.loading'))}</div></div>`,
    error: (msg, retryId) => `<div class="state">
        <div class="big">${esc(t('state.error'))}</div>
        <div class="small">${esc(msg || '')}</div>
        <button class="btn primary" id="${retryId || 'sp-retry'}">${icon('refresh')}${esc(t('state.retry'))}</button>
      </div>`,
    empty: (msg) => `<div class="state"><div class="small">${esc(msg || t('state.empty'))}</div></div>`,
    loggedOut: () => `<div class="state">
        <div class="big">${esc(t('state.loggedOut'))}</div>
        <div class="small">${esc(t('state.loggedOutHint'))}</div>
        <a class="btn primary" href="/user/signin/%2Fhome">${esc(t('state.loggedOutBtn'))}</a>
      </div>`,
  };

  /**
   * 新用户空状态。
   * 不是"暂无数据"，是"你还没开始，这是怎么开始"：一句为什么 + 三步怎么开始 + 两个出口。
   */
  const newUser = () => `<div class="empty"><div class="inner">
      <h2>${esc(t('empty.title'))}</h2>
      <p>${esc(t('empty.body'))}</p>
      <div class="steps">
        ${[1, 2, 3].map((i) => `<div class="step"><span class="n">${i}</span><div>
          <div class="h">${esc(t(`empty.s${i}h`))}</div>
          <div class="b">${esc(t(`empty.s${i}b`))}</div>
        </div></div>`).join('')}
      </div>
      <div class="cta">
        <a class="btn primary" href="/getstarted">${esc(t('empty.cta1'))}</a>
        <a class="btn" href="/faq">${esc(t('empty.cta2'))}</a>
      </div>
    </div></div>`;

  /* ------------------------------------------------------------ 骨架屏 */

  const skeleton = (rows) => `<div class="state" style="padding:40px 20px">
      ${[...Array(rows || 4)].map((_, i) => `<div class="sk" style="width:100%;height:${i === 0 ? 22 : 46}px"></div>`).join('')}
    </div>`;

  /* ============================================================ 图表（命令式）
     面积图按实测像素渲染。绝不用 preserveAspectRatio="none" ——
     它会把 SVG 里的轴标签一起非等比拉伸，字会糊掉。 */

  let chartObs = null;   // 模块级单例：重渲染时必须先断开旧的，否则观察器会挂在已摘除的节点上

  function pointsChart(box, series) {
    if (!box || !series || series.length < 2) return;
    const vals = series.map((p) => p.v);
    const n = vals.length;
    const top = Util.niceTop(Math.max(...vals));
    const H = 216, L = 46, R = 10, T = 12, B = 24;
    const tip = box.querySelector('.tip');
    let geom = null, first = true;

    function draw() {
      const W = Math.max(280, Math.round(box.clientWidth - 40));
      const x = (i) => L + i * (W - L - R) / (n - 1);
      const y = (v) => T + (1 - v / top) * (H - T - B);
      geom = { W, x, y };

      const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      const area = `${line}L${x(n - 1).toFixed(1)},${H - B}L${x(0).toFixed(1)},${H - B}Z`;
      const grid = [0, top / 3, (top * 2) / 3, top].map((tv) =>
        `<line x1="${L}" x2="${W - R}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="var(--border)" stroke-width="1"></line>` +
        `<text x="${L - 9}" y="${(y(tv) + 3.6).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--text-3)" style="font-variant-numeric:tabular-nums">${compact(tv)}</text>`).join('');
      const at = [0, Math.floor((n - 1) / 2), n - 1];
      const xl = at.map((i, k) =>
        `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}" font-size="11" fill="var(--text-3)">${esc(series[i].d)}</text>`).join('');

      const old = box.querySelector('svg');
      if (old) old.remove();
      box.insertAdjacentHTML('afterbegin',
        `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('chart.points'))}">
          ${grid}
          <defs><linearGradient id="sp-ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart)" stop-opacity=".26"></stop>
            <stop offset="100%" stop-color="var(--chart)" stop-opacity="0"></stop>
          </linearGradient></defs>
          <path class="area" d="${area}" fill="url(#sp-ag)"></path>
          <path class="line" d="${line}" fill="none" stroke="var(--chart)" stroke-width="1.8" stroke-linejoin="round"></path>
          <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--border-strong)" stroke-width="1" opacity="0"></line>
          <circle class="dot" r="3.5" fill="var(--chart)" stroke="var(--surface)" stroke-width="2" opacity="0"></circle>
          ${xl}
        </svg>`);

      const p = box.querySelector('.line');
      if (p && first && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        const len = p.getTotalLength();
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        void p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset .9s cubic-bezier(.16,1,.3,1) .05s';
        p.style.strokeDashoffset = '0';
      }
      first = false;
    }

    box.addEventListener('pointermove', (ev) => {
      const svg = box.querySelector('svg');
      if (!svg || !geom) return;
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / Math.max(1, r.width) * geom.W;
      const step = (geom.W - L - R) / (n - 1);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / step)));
      const vx = geom.x(i), vy = geom.y(vals[i]);
      const cross = svg.querySelector('.cross'), dot = svg.querySelector('.dot');
      cross.setAttribute('x1', vx); cross.setAttribute('x2', vx); cross.setAttribute('opacity', '.55');
      dot.setAttribute('cx', vx); dot.setAttribute('cy', vy); dot.setAttribute('opacity', '1');
      if (tip) {
        tip.innerHTML = `<b class="num">${fmt(vals[i])}</b> ${esc(t('chart.tipPoints'))}<i>${esc(series[i].d)}</i>`;
        tip.style.left = (vx / geom.W * 100) + '%';
        tip.style.top = (vy - 10) + 'px';
        tip.style.opacity = '1';
      }
    });
    box.addEventListener('pointerleave', () => {
      const svg = box.querySelector('svg');
      if (svg) {
        svg.querySelector('.cross').setAttribute('opacity', '0');
        svg.querySelector('.dot').setAttribute('opacity', '0');
      }
      if (tip) tip.style.opacity = '0';
    });

    draw();
    if (chartObs) chartObs.disconnect();
    if (window.ResizeObserver) {
      chartObs = new ResizeObserver(() => window.requestAnimationFrame(draw));
      chartObs.observe(box);
    } else {
      window.addEventListener('resize', draw);
    }
  }

  /** 轴上大数：3.6e8 → 360M（与样张一致，不带空格） */
  const compact = (v) => {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(Math.round(n));
  };

  SP.UI = { icon, ICONS, avatar, kpis, heatmap, bindHeatTips, months, farm, machines, progress, progressText, devices, state, newUser, skeleton, compact };
  SP.Charts = { points: pointsChart };
})();

/* ===== src/50-views.js ===== */
/* ==========================================================================
 * 50-views.js — 视图层：总览 / 项目 / 排行榜 / 设置
 *
 * 视觉与 DOM 结构照 docs/DESIGN.md 落地；数据全部来自解析器
 * 已经给出的真实字段，没有任何占位符。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  /** 页脚：数据来源声明。每一屏都要有 —— 这是本产品对用户的承诺。 */
  const foot = () => `<div class="foot">${esc(t('footer.source'))}</div>`;

  /* ======================================================== 逐日真实产出
     站点内联的 line_frames_timeline 是**累积**帧数曲线。把它当阶梯函数做逐日差分，
     得到"每天到底渲染了多少帧"——原站那张热力图只记"当天有没有渲染"（count 恒为 1），
     对全勤用户是整块纯色、零信息量。
     保守起见先判单调：万一站点哪天改成逐日值，就直接用它，绝不硬差分出负数。 */
  function dailySeries(cum) {
    const rows = (cum || []).filter((p) => p && p.d && Number.isFinite(p.v)).slice()
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    if (rows.length < 2) return [];

    const monotonic = rows.every((p, i) => i === 0 || p.v >= rows[i - 1].v);
    if (!monotonic) return rows.map((p) => ({ d: p.d, v: Math.max(0, p.v) }));

    const at = new Map(rows.map((p) => [p.d, p.v]));
    const out = [];
    let prev = null;
    for (let d = rows[0].d, guard = 0; d <= rows[rows.length - 1].d && guard < 20000; d = Util.dshift(d, 1), guard++) {
      const v = at.has(d) ? at.get(d) : prev;   // 阶梯函数：没有采样点的日子沿用上一次的值
      if (prev !== null) out.push({ d, v: Math.max(0, v - prev) });
      prev = v;
    }
    return out;
  }

  function statOf(st, names) {
    for (const n of names) if (st[n] !== undefined && st[n] !== '') return st[n];
    return '';
  }

  const rankOf = (st) => {
    const raw = statOf(st, ['Rank']);
    const digits = String(raw).replace(/[^\d]/g, '');
    return digits || '';
  };

  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

  /** 站点把注册日期写成 "January 31st, 2024"。中文界面里要的是 2024-01-31。
   *  认不出来的形状原样返回 —— 宁可显示站点原文，也不要猜错日期。 */
  function isoDate(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    let m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
    if (m) {
      const mo = MONTHS[m[1].toLowerCase()];
      if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
    }
    m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    if (/^\d{4}$/.test(s)) return s;
    return s;
  }

  /** 站点原文 → 当前语言。词表里没有的一律回落站点原文，绝不显示半个键名。 */
  function packLabel(prefix, raw, upper) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const key = `${prefix}.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const hit = t(key);
    if (hit !== key) return hit;
    return upper ? s.toUpperCase() : s;
  }

  /** 客户端状态是站点给的英文句子。能对上模式的翻成中文，对不上的原样保留。 */
  const STATUS_RULES = [
    [/^waiting to render/i, () => t('status.idle')],
    [/^rendering for\s+(.+)$/i, (m) => t('status.renderingFor', { user: m[1] })],
    [/^rendering\b/i, () => t('status.rendering')],
    // 站点在这行还会说 "Disconnected"（客户端离线）。不认识的原样显示等于在中文界面里
    // 露一句英文，所以补上；以后站点再添新词也仍然只回落原文，不会瞎猜。
    [/^(disconnected|not connected|offline)/i, () => t('status.disconnected')],
  ];
  function statusText(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    for (const [re, fn] of STATUS_RULES) {
      const m = s.match(re);
      if (m) return fn(m);
    }
    return s;
  }

  /* ============================================================== 总览 */

  function identity(p, st) {
    const rank = rankOf(st);
    const badge = packLabel('badge', p.badge, true);
    const team = statOf(st, ['Team']).trim().toUpperCase();
    const joined = isoDate(statOf(st, ['Registration']));
    const status = statusText(p.status);
    const bits = [];
    if (rank) bits.push(`<span><b class="num">#${esc(rank)}</b> ${esc(t('hero.rank'))}</span>`);
    if (badge) bits.push(`<span><b>${esc(badge)}</b></span>`);
    if (team) bits.push(`<span><b>${esc(team)}</b> ${esc(t('hero.team'))}</span>`);
    if (joined) bits.push(`<span>${esc(t('hero.joined'))} <b class="num">${esc(joined)}</b></span>`);
    // 站点原文挂 title：这句说的是"你自己客户端"的状态，不是全站队列，
    // 想查证的人一眼能看到站点的原话。
    if (status) bits.push(`<span title="${esc(t('hero.statusRaw', { raw: p.status }))}">${esc(status)}</span>`);

    return `<div class="identity">
      ${UI.avatar(p.avatar, p.name, 'av')}
      <h1>${esc(p.name)}</h1>
      ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
    </div>`;
  }

  function overview(state) {
    const p = state.profile;
    const home = state.home;
    if (!p) return UI.state.error('profile parse failed');

    const st = p.stats || {};
    const d = p.derived || {};
    const daily = dailySeries(p.frames);
    const hasData = (p.points && p.points.length > 1) || daily.length > 0 || (p.activity && p.activity.length > 0);

    if (!hasData) {
      // 页面确实读到了（dl 里的统计在），只是还没有任何渲染记录 → 上新用户空状态：
      // 不摆一排 0，直接告诉他这里会发生什么、怎么开始。
      // 连统计都读不到，说明是解析失败，不能拿"你还没开始"糊弄人，如实说无数据。
      const parsed = Object.keys(st).length > 0;
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty()) + foot();
    }

    /* ---- 指标带：一个整面 + 内部 1px 分隔 ---- */
    const total = daily.reduce((a, b) => a + b.v, 0);
    const avg = daily.length ? Math.round(total / daily.length) : null;
    const peak = daily.length ? daily.reduce((a, b) => Math.max(a, b.v), 0) : null;
    const rank = rankOf(st);
    const rawTime = statOf(st, ['Time rendered']);
    const days = Util.durDays(rawTime);
    const frames = statOf(st, ['Frames rendered']);
    const points = statOf(st, ['Points']);
    // 发布者身份的两项：站点统计里本来就有，只是没建过项目的人一直是 0
    const created = statOf(st, ['Projects created']);
    const ordered = statOf(st, ['Frames ordered']);
    const asCount = (v) => Number(String(v === null || v === undefined ? '' : v).replace(/[^\d.]/g, ''));

    const kpiItems = [
      {
        k: t('stat.frames'),
        v: frames ? Util.statNum(frames) : '—',
        d: avg !== null && peak !== null
          ? t('stat.avgPeak', { avg: `<b class="num">${fmt(avg)}</b>`, peak: `<span class="num">${fmt(peak)}</span>` })
          : '',
      },
      {
        k: t('stat.points'),
        v: points ? Util.statNum(points) : '—',
        d: rank ? t('stat.rankWindow', { rank: `<span class="num">${esc(rank)}</span>` }) : '',
      },
      { k: t('stat.time'), v: Util.renderTime(rawTime), d: days ? t('stat.daysEquiv', { days: fmt(days) }) : '' },
      {
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        // 近 30 天满勤时直说"全勤"——"近 30 天活跃 30 天"是把同一个数字念了两遍
        d: d.best !== undefined
          ? t(d.active30 === 30 ? 'stat.streakFull' : 'stat.streakHint', { best: fmt(d.best), d30: fmt(d.active30 || 0) })
          : '',
      },
      // 发布者身份的两格，只在非零时出现：没建过项目的人看到的仍是原来那四格。
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，栅格与分隔线要跟着重排（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       站点只在**自己的主页**内联积分曲线与逐日帧数；别人的主页上这两块根本没有数据源。
       那就不画（用户拍板：宁可少两块面板，也不摆两个"暂无数据"）。只剩一块时铺满整行。 */
    const hasPoints = !!(p.points && p.points.length > 1);
    const first = p.points[0], last = p.points[p.points.length - 1];
    const chartSub = t('chart.pointsSub', {
      n: p.points.length, from: first ? first.d : '—', to: last ? last.d : '—',
      now: last ? Util.num(last.v) : '—',
    });
    const mo = UI.months(daily);
    const pointsPanel = !hasPoints ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('chart.points'))}</h2><span class="sub num">${esc(chartSub)}</span></div>
        <div class="chart" id="sp-chart"><div class="tip" id="sp-tip"></div></div>
      </div>`;
    const monthsPanel = !mo.html ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('months.title'))}</h2><span class="sub">${esc(t('months.sub'))}</span></div>
        <div class="produce">${mo.html}</div>
      </div>`;
    const main = pointsPanel && monthsPanel
      ? `<div class="grid">${pointsPanel}${monthsPanel}</div>`
      : pointsPanel + monthsPanel;

    /* ---- 通栏：渲染产出 ----
       逐日帧数只有自己的主页有；别人的主页站点给的是"这天有没有渲染"的日历，
       而原站也正是拿那份数据画这张图的 —— 所以照样画，但口径与计数文案全部换成天。 */
    const actDaily = (p.activity || []).map((x) => ({ d: x.d, v: Number(x.c) || 1 }));
    const byFrames = daily.length > 0;
    const heatDaily = byFrames ? daily : actDaily;
    const hm = UI.heatmap(heatDaily, 53, I18n.lang, { unit: byFrames ? 'frames' : 'days' });
    const heat = `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:16px">
        <h2>${esc(t('heat.title'))}</h2>
        <span class="sub">${esc(byFrames ? t('heat.sub') : t('heat.subDays'))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(hm.note)}</span>
      </div>
      ${heatDaily.length
        ? `<div class="produce" style="padding-top:0">${hm.html}</div>`
        : `<div class="produce" style="padding-top:0">${UI.state.empty(t('heat.none'))}</div>`}
    </div>`;

    /* ---- 已连接的机器 ----
       这里放自己的机器，不放"进行中的项目"：项目有它自己的视图，
       在总览再铺一遍只是把同一个列表说了两遍。
       全站实时（别人的机器、全站队列）也不在这里 —— 那是农场的事不是我的事，
       在项目页顶部更合身。 */
    const mc = p.machines || { count: 0, list: [] };
    const machinesPanel = `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('machines.title'))}</h2>
        <span class="sub num">${esc(t('machines.count', { n: mc.count || 0 }))}</span>
      </div>
      ${UI.machines(mc)}
    </div>`;

    return identity(p, st)
      + kpiBand
      + main
      + heat
      + machinesPanel
      + foot();
  }

  /* ============================================================== 项目 */

  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null };
  const rankState = { limit: 100 };
  // 账户页选项卡。不写进地址 —— 与项目页的筛选、排行榜的分页一致，刷新回到第一档。
  const acctState = { tab: 'sched' };

  /** 「显示更多」：500 行排行榜如果一次性铺进 DOM，滚动会卡。分次渲染，
   *  并且如实写出"已显示 n / 总数"，不做静默截断。 */
  function moreRow(shown, total, step) {
    if (shown >= total) return '';
    return `<div class="more">
      <button class="btn" id="sp-more" data-step="${step}">${esc(t('list.more'))}
        <span class="num">${esc(t('list.shown', { n: shown, total }))}</span></button>
    </div>`;
  }

  /** 站点状态文案 → 本地化文案 */
  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
    return p.status || '—';
  }

  /** 三项名单动作各自要打的地址。加进去用站点的 add 前缀；已经在名单里就用名单行 onclick
   *  里的撤回地址。优先级那条读不到时按形状兜底（历史行为，实测可用），
   *  捐赠与黑名单没有样本就不猜 —— 读不到那一项直接不给。 */
  function ownerActions(p, maps) {
    const id = p.ownerId || p.owner;
    if (!maps || !id) return null;
    const prio = maps.prio.get(id) || null;
    const spon = maps.sponsor.get(id) || null;
    const blocked = maps.blocked.get(id) || null;
    return {
      prio: {
        on: !!prio,
        // 注意：maps.add.* 是**前缀**（站点 onclick 里读到的那一段），后面还要接用户名
        url: prio ? (prio.action || `/user/priority/remove/${encodeURIComponent(id)}`)
          : (maps.add.priority ? maps.add.priority + encodeURIComponent(id) : `/user/priority/add/${encodeURIComponent(id)}`),
      },
      gift: { on: !!spon, url: spon ? spon.action : (maps.add.sponsor ? maps.add.sponsor + encodeURIComponent(id) : '') },
      block: { on: !!blocked, url: blocked ? blocked.action : (maps.add.blockOwner ? maps.add.blockOwner + encodeURIComponent(id) : '') },
    };
  }

  /** 发布者那一格：头像 + 名字（可点进主页）+ 常驻的状态标记 + 一个 3 点菜单。
   *  标记说的是"你把他放进了哪份名单"—— 这件事不该等鼠标移上来才知道，所以它常驻；
   *  三个动作（优先 / 捐赠 / 黑名单）全收进菜单，格子本身只有一个按钮。 */
  function ownerCell(p, me, maps) {
    const isMe = me && p.owner === me;
    const id = p.ownerId || p.owner;
    const act = isMe ? null : ownerActions(p, maps);
    const mark = (kind, icon, label) =>
      `<span class="mk mk-${kind}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${UI.icon(icon)}</span>`;
    const marks = !act ? '' : (act.prio.on ? mark('prio', 'star', t('proj.prio.inList')) : '')
      + (act.gift.on ? mark('gift', 'heart', t('proj.menu.gifted')) : '')
      + (act.block.on ? mark('block', 'ban', t('proj.menu.blocked')) : '');
    // 名字进主页。地址里的用户名优先（parseProjects 从站点 <a> 的 href 里读出来的），
    // 读不到才回落显示名 —— 两者不一致时，只有 URL 里那个能打开对的人。
    const href = id ? `/user/${encodeURIComponent(id)}/profile` : '';
    // 菜单至少要有一项能打才出现（与别处同一条规矩：状态不明的地方不给动作）
    const canMenu = !!(act && (act.prio.url || act.gift.url || act.block.url));
    const open = canMenu && projState.menu === p.id;
    return `<div class="ow">${UI.avatar(p.ownerAvatar, p.owner, 'ini')}
      ${href
        ? `<a class="nm" href="${esc(href)}" target="_self" title="${esc(p.owner)}">${esc(p.owner)}</a>`
        : `<span title="${esc(p.owner)}">${esc(p.owner)}</span>`}${isMe ? ` <em>${esc(t('rank.you'))}</em>` : ''}${marks}${canMenu
      ? `<button class="btn sm kebab" data-act="owner-menu" data-id="${esc(p.id)}" ` +
        `aria-haspopup="menu" aria-expanded="${open ? 'true' : 'false'}" ` +
        `title="${esc(t('proj.menu.open'))}" aria-label="${esc(t('proj.menu.open'))}">${UI.icon('more')}</button>`
      : ''}</div>`;
  }

  /** 3 点菜单的内容（浮层，挂在 #sp 里由 mount() 定位，不能放进表格 —— 会被 .tablewrap 裁掉）。
   *  三项都是"把这个人放进某份名单"：前面一个图标说明这是什么动作，右边的勾说明你现在的状态，
   *  已在名单里时文案翻成撤回。地址一律来自解析结果，读不到就不给那一项。 */
  function ownerMenu(p, me, maps) {
    const act = me && p.owner === me ? null : ownerActions(p, maps);
    if (!act) return '';
    const item = (kind, url, on, onLabel, offLabel, icon) => (!url ? '' : `<button class="mi" role="menuitem" data-act="${kind}" data-url="${esc(url)}">
        <span class="mi-ic">${UI.icon(icon)}</span><span class="mi-tx">${esc(on ? onLabel : offLabel)}</span>
        <span class="mi-ck">${on ? UI.icon('check') : ''}</span>
      </button>`);
    const rows = [
      item('prio-set', act.prio.url, act.prio.on, t('proj.menu.unprio'), t('proj.menu.prio'), 'star'),
      item('owner-gift', act.gift.url, act.gift.on, t('proj.menu.ungift'), t('proj.menu.gift'), 'heart'),
      item('owner-block', act.block.url, act.block.on, t('proj.menu.unblock'), t('proj.menu.block'), 'ban'),
    ].filter(Boolean);
    if (!rows.length) return '';
    return `<div class="omenu" id="sp-omenu" role="menu" aria-label="${esc(t('proj.menu.title'))}">
      <div class="mh">${esc(t('proj.menu.title'))}</div>
      ${rows.join('')}
    </div>`;
  }

  /** 三份名单（都是我自己的那份，来自账户设置页）：优先级决定「优先 / 移出」，
   *  赞助名单与黑名单喂给发布者那格的 3 点菜单。任何一份读不到就整格不给按钮 ——
   *  不猜状态，也不摆一个按下去必然出错的按钮。项目页与会话页共用同一份构造。 */
  function listsOf(state) {
    return state.account
      ? {
        prio: new Map((state.account.priority || []).map((x) => [x.name, x])),
        sponsor: new Map(((state.account.sponsor && state.account.sponsor.list) || []).map((x) => [x.name, x])),
        blocked: new Map((state.account.blockedOwners || []).map((x) => [x.name, x])),
        add: state.account.add || {},
      }
      : null;
  }

  function projectRow(p, me, maps) {
    // 分数单占一列：跟在条子后面会让每条轨道的长度随数字宽度变来变去（见 40-ui.js 的 progress）。
    const frac = UI.progressText(p.pct, p.done, p.total);
    return `<tr data-project="${esc(p.id)}">
      <td><div class="pn" title="${esc(p.name)}">${esc(p.name)}</div></td>
      <td>${ownerCell(p, me, maps)}</td>
      <td><span class="st ${p.statusKind}">${esc(statusLabel(p))}</span></td>
      <td>${UI.progress(p.pct, frac)}</td>
      <td class="r num frac">${esc(frac)}</td>
      <td>${UI.devices(p.cpu, p.gpu)}</td>
      <td class="r num">${esc(p.memory || '—')}</td>
    </tr>`;
  }

  function projects(state) {
    const all = state.projects || [];
    if (!all.length) return UI.state.empty();

    const q = projState.q.trim().toLowerCase();
    let rows = all.filter((p) => {
      if (q && !(`${p.name} ${p.owner}`.toLowerCase().includes(q))) return false;
      if (projState.filter === 'all') return true;
      if (projState.filter === 'cpu') return p.cpu;
      if (projState.filter === 'gpu') return p.gpu;
      return p.statusKind === projState.filter;
    });

    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      owner: (a, b) => a.owner.localeCompare(b.owner),
      progress: (a, b) => (a.pct || 0) - (b.pct || 0),
      memory: (a, b) => (a.memKb || 0) - (b.memKb || 0),
    }[projState.sort] || ((a, b) => (a.pct || 0) - (b.pct || 0));
    rows = rows.slice().sort((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));

    const th = (key, label, span) => {
      const on = projState.sort === key;
      return `<th class="sortable"${span ? ` colspan="${span}"` : ''} data-sort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(label)}${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</th>`;
    };

    // 三份名单（都是我自己那份，来自账户设置页）：优先级决定「优先 / 移出」，
    // 赞助名单与黑名单喂给发布者那格的 3 点菜单。任何一份读不到就整格不给按钮 ——
    // 不猜状态，也不摆一个按下去必然出错的按钮。
    const maps = listsOf(state);
    const prio = maps ? maps.prio : null;

    const filters = [
      ['all', t('proj.all')],
      ['rendering', t('proj.status.rendering')],
      ['waiting', t('proj.status.waiting')],
      ['gpu', t('proj.gpu')],
      ['cpu', t('proj.cpu')],
    ];

    // 全站实时放在这一页的顶上：它是"农场现在在干什么"，不是"我在干什么"。
    // 总览是个人仪表盘，把这四个数字塞进去会喧宾夺主。
    const farmRow = state.home && state.home.stats && state.home.stats.length ? UI.farm(state.home.stats, { flush: true }) : '';

    // 打开的 3 点菜单：浮层是 #sp 的直接定位子元素，**不能**放进表格里 ——
    // .tablewrap 是 overflow:auto，绝对定位的浮层会被它裁掉（最后几行尤其明显）。
    // 坐标由 Views.mount() 量一次触发按钮的位置再写进去。
    const openP = projState.menu ? all.find((p) => p.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

    return farmRow + `<div class="sechead"><h2>${esc(t('proj.title'))}</h2>
        <span class="sub">${esc(t('proj.count', { n: all.length }))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(t('proj.showing', { n: rows.length, total: all.length }))}</span></div>
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.search'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${filters.map(([k, label]) =>
          `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            ${th('owner', t('proj.col.owner'))}
            <th>${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'), 2)}
            <th>${esc(t('proj.col.device'))}</th>
            ${th('memory', t('proj.col.memory'))}
          </tr></thead>
          <tbody>${rows.slice(0, projState.limit).map((p) => projectRow(p, state.userName, maps)).join('')
            || `<tr><td colspan="7"><div class="state" style="padding:40px 12px"><div class="small">${esc(t('proj.empty'))}</div></div></td></tr>`}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>
      ${menuHtml}`;
  }

  /* ============================================================== 排行榜 */

  function ranking(state) {
    const rows = state.ranking || [];
    if (!rows.length) return UI.state.empty();
    const me = state.userName;
    const body = rows.slice(0, rankState.limit).map((r) => {
      const isMe = me && r.user === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight">${esc(r.rank)}</td>
        <td><div class="ow">${UI.avatar(r.avatar, r.user, 'ini')}
          ${r.user || r.userId
            ? `<a class="nm" href="/user/${encodeURIComponent(r.userId || r.user)}/profile" target="_self" title="${esc(r.user)}">${esc(r.user || r.userId)}</a>`
            : ''}${isMe ? ` <em>${esc(t('rank.you'))}</em>` : ''}</div></td>
        <td class="r num">${esc(Util.num(r.frames))}</td>
        <td class="r num">${esc(Util.duration(r.seconds))}</td>
        <td class="r num">${esc(Util.num(Math.round(r.points)))}</td>
      </tr>`;
    }).join('');

    return `<div class="sechead"><h2>${esc(t('rank.title'))}</h2>
        <span class="sub">${esc(t('rank.sub'))}</span>
        <span class="spacer"></span>
        <span class="sub num">${esc(t('rank.count', { n: rows.length }))}</span></div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr>
            <th class="tight">${esc(t('rank.col.rank'))}</th><th>${esc(t('rank.col.user'))}</th>
            <th class="r">${esc(t('rank.col.frames'))}</th><th class="r">${esc(t('rank.col.time'))}</th>
            <th class="r">${esc(t('rank.col.points'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, rankState.limit), rows.length, 100)}
      </div>`;
  }

  /* ============================================================== 设置 */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

    // 语言列表由注册表动态生成 —— 新增一门语言不需要改这里
    const langOpts = [['auto', t('set.lang.auto')]]
      .concat(I18n.available().map((l) => [l.code, l.label]));
    const cov = I18n.coverage();
    const covTotal = cov ? cov.entries + cov.blocks + cov.patterns : 0;

    return `<div class="sechead"><h2>${esc(t('set.title'))}</h2></div>
      <div class="panel settings">
        <div class="row"><div class="lbl">${esc(t('set.theme'))}</div>
          ${seg('sp-theme', state.themePref, [['auto', t('set.theme.auto')], ['dark', t('set.theme.dark')], ['light', t('set.theme.light')]])}</div>

        <div class="row block">
          <div class="lbl">${esc(t('set.scale'))}</div>
          ${seg('sp-scale', String(state.uiScale), [['0.9', '90%'], ['1', '100%'], ['1.1', '110%'], ['1.25', '125%'], ['1.4', '140%']])}
          <div class="hint">${esc(t('set.scaleHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.lang'))}</div>
          ${seg('sp-lang', state.langPref, langOpts)}
          <div class="hint">${esc(t('set.langHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.translate'))}</div>
          ${seg('sp-translate', state.translateSite ? 'on' : 'off', [['on', t('set.on')], ['off', t('set.off')]])}
          <div class="hint">${esc(t('set.translateHint', { n: covTotal }))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.about'))}</div>
          <div class="hint" style="margin-top:0">${esc(t('set.aboutText'))}</div>
          <div class="hint">${esc(t('set.dangerHint'))}</div>
        </div>
      </div>`;
  }

  /* ============================================================== 账户设置 */

  /** 用户列表：头像 + 用户名 + 移除。动作地址是解析器从站点 onclick 里读出来的，不自己拼。
   *  移除是维护动作，用次级按钮 —— 实心主按钮留给每个面板里那个真正的"提交"。
   *  opts.requiresAction：动作读不到时**不画按钮**。赞助名单就是这样 —— 我们自己的名单是空的、
   *  站点不渲染这些行，没有样本可抄；宁可不给动作，也不猜一个 URL。 */
  function userList(items, emptyText, opts) {
    if (!items || !items.length) return `<div class="ulist"><div class="none">${esc(emptyText)}</div></div>`;
    const needAction = !!(opts && opts.requiresAction);
    return `<div class="ulist">${items.map((u) => `<div class="u">
        ${UI.avatar(u.avatar, u.name, 'ini')}
        <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
        ${u.action || !needAction ? `<button class="btn sm" data-del="${esc(u.action)}">${esc(t('account.remove'))}</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function account(state) {
    const a = state.account;
    if (!a) return UI.state.empty();

    const sw = (mask, on, title, hint) => `<label class="sw">
      <input type="checkbox" data-sched="${esc(mask)}" ${on ? 'checked' : ''}>
      <span class="track"><span class="knob"></span></span>
      <span class="txt"><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    </label>`;

    /* 赞助开关：状态与动作都来自站点（checked + onclick 里的 URL）。点了就 POST 到那个地址、
       成功后整页重取 —— 与账户页别的开关走同一条收口，动作地址不自己拼。 */
    const swAction = (o, title, hint) => (!o ? '' : `<label class="sw">
      <input type="checkbox" data-act="sponsor-set" data-url="${esc(o.action)}" ${o.on ? 'checked' : ''}>
      <span class="track"><span class="knob"></span></span>
      <span class="txt"><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    </label>`);

    const panel = (title, sub, body) => `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:0"><h2>${esc(title)}</h2>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>
      <div class="pbody">${body}</div>
    </div>`;

    const sched = panel(t('account.scheduler'), '', `
      <p class="hint">${esc(t('account.schedulerHint'))}</p>
      ${sw('render_my_project_first', a.scheduler.mineFirst !== false, t('account.sched.mine'), t('account.sched.mineHint'))}
      ${sw('render_my_team_projects_first', a.scheduler.teamFirst === true, t('account.sched.team'), '')}
      ${sw('render_heavy_project', a.scheduler.heavyFirst === true, t('account.sched.heavy'), t('account.sched.heavyHint'))}`);

    const priority = panel(t('account.priority'), '', `
      <p class="hint">${esc(t('account.priorityHint'))}</p>
      ${userList(a.priority, t('account.empty'))}
      <div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-prio" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.priorityAdd'))}">
        </label>
        <button class="btn primary" data-act="prio-add" data-input="sp-prio">${esc(t('account.add'))}</button>
      </div>`);

    /* 捐赠积分（站点叫 Sponsorship）：你渲染挣到的积分会给名单里的随机一位。
       两个开关的地址、名单的增删地址全部来自解析结果；拿不到就不画那一块 ——
       状态不明的地方不给动作，这条规矩和项目页的优先级开关是同一条。 */
    const spon = a.sponsor || { give: null, receive: null, addUrl: '', list: [] };
    const sponsor = panel(t('account.sponsor'), t('account.sponsorSub'), `
      <p class="hint">${esc(t('account.sponsorHint'))}</p>
      ${spon.give || spon.receive
        ? swAction(spon.give, t('account.sponsor.give'), t('account.sponsor.giveHint'))
          + swAction(spon.receive, t('account.sponsor.receive'), t('account.sponsor.receiveHint'))
        : ''}
      <div class="phead" style="padding:18px 0 0"><h2>${esc(t('account.sponsorList'))}</h2></div>
      ${userList(spon.list, t('account.sponsorEmpty'), { requiresAction: true })}
      ${spon.addUrl ? `<div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-sponsor" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.sponsorAdd'))}">
        </label>
        <button class="btn primary" data-act="sponsor-add" data-input="sp-sponsor" data-url="${esc(spon.addUrl)}">${esc(t('account.add'))}</button>
      </div>` : ''}`);

    const avatarBox = panel(t('account.avatar'), '', `
      <p class="hint">${esc(t('account.avatarHint'))}</p>
      <div class="avatarline">
        ${UI.avatar(a.avatar, state.userName || '', 'ini')}
        <div>
          <label class="filepick">${esc(t('account.avatarPick'))}<input type="file" id="sp-avatar" accept="image/*"></label>
          <div class="addrow"><button class="btn primary" data-act="avatar-save">${esc(t('account.avatarSave'))}</button></div>
        </div>
      </div>`);

    const emailBox = panel(t('account.email'), '', `
      <p class="hint">${esc(a.email || '—')}</p>
      <div class="addrow">
        <label class="input"><input id="sp-email" type="email" autocomplete="off" placeholder="${esc(t('account.emailNew'))}"></label>
        <button class="btn primary" data-act="email-save" data-input="sp-email">${esc(t('account.emailSave'))}</button>
      </div>`);

    const keys = panel(t('account.keys'), '', `
      <p class="hint">${esc(t('account.keysHint'))}</p>
      ${a.renderKeys.length ? `<div class="ulist">${a.renderKeys.map((k) => `<div class="keyrow">
          <span class="k num" title="${esc(k.key)}">${esc(k.key)}</span>
          <span class="c" title="${esc(k.comment)}">${esc(k.comment)}</span>
          <span class="use ${k.inUse ? 'on' : ''}">${esc(k.inUse ? t('account.keys.inUse') : t('account.keys.free'))}</span>
          <button class="btn sm" data-del="${esc(k.action)}" data-confirm="${esc(t('account.keys.delConfirm'))}">${esc(t('account.keys.del'))}</button>
        </div>`).join('')}</div>` : `<div class="ulist"><div class="none">${esc(t('account.empty'))}</div></div>`}
      <div class="addrow">
        <label class="input"><input id="sp-keycomment" type="text" autocomplete="off" placeholder="${esc(t('account.keys.comment'))}"></label>
        <button class="btn primary" data-act="key-add" data-input="sp-keycomment">${esc(t('account.keys.add'))}</button>
      </div>`);

    const blacklist = panel(t('account.block.renderer'), '', `
      <p class="hint">${esc(t('account.block.rendererHint'))}</p>
      ${userList(a.blockedRenderers, t('account.empty'))}
      <div class="addrow">
        <label class="input"><input id="sp-block-renderer" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="renderer" data-input="sp-block-renderer">${esc(t('account.add'))}</button>
      </div>
      <div class="phead" style="padding:20px 0 0"><h2>${esc(t('account.block.owner'))}</h2></div>
      <p class="hint" style="margin-top:8px">${esc(t('account.block.ownerHint'))}</p>
      ${userList(a.blockedOwners, t('account.empty'))}
      <div class="addrow">
        <label class="input"><input id="sp-block-owner" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="owner" data-input="sp-block-owner">${esc(t('account.add'))}</button>
      </div>`);

    // 七块面板堆成一列太长，按"一次只想看一件事"分三档。复用设置页那套分段控件（.seg）——
    // 它本来就是"同一件事的不同视图"的控件，不必再造一个 tab 组件。调度与名单合并成一档：
    // 用户反馈"调度那块太空"，而"谁的项目我渲染 / 谁的项目我不渲染"本来就是一件事。
    const acctTabs = [['sched', t('account.tab.sched')],
      ['sponsor', t('account.tab.sponsor')], ['account', t('account.tab.account')]];
    const acctPanels = {
      sched: sched + priority + blacklist,
      sponsor,
      account: avatarBox + emailBox + keys,
    };
    const tab = acctPanels[acctState.tab] ? acctState.tab : 'sched';

    return `<div class="sechead"><h2>${esc(t('account.title'))}</h2>
        <span class="sub">${esc(t('account.sub'))}</span></div>
      <div class="seg" id="sp-acct-tabs" role="tablist">${acctTabs.map(([k, label]) =>
        `<button data-tab="${k}" role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}">${esc(label)}</button>`).join('')}</div>
      <div class="acct">${acctPanels[tab]}</div>
      ${foot()}`;
  }

  /* ====================================================== 会话页（一台机器）
     入口：总览「已连接的机器」→「查看会话」。
     三块数据各自独立：机器信息与可渲染项目在同一份 HTML 里，时间线是站点自己的
     AJAX JSON。任何一块拿不到，只让那一块说"没有数据"，其余照常显示。 */
  const sessState = { type: 'all', limit: 100 };

  // 已经在身份条/指标带里说过的项，不再进事实清单 —— 同一件事在一屏里说两遍就是噪音
  const sessElsewhere = new Set(['hostname', 'os', 'owner', 'version', 'frames', 'points', 'power', 'powerGpu', 'maxTime', 'status', 'action', 'currentFrames']);

  /** 事实清单的标签：站点原文 → 当前语言；站点新加的行不认识也照样显示，不吞数据 */
  function sessLabel(f) {
    if (!f.key) return f.label;
    const k = `sess.f.${f.key}`;
    const hit = t(k);
    return hit === k ? f.label : hit;
  }

  /** 站点的事件类型词 → 本地化文案；认不出来的原样显示，绝不露出半个键名 */
  function typeLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '—';
    const k = `sess.tl.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const hit = t(k);
    return hit === k ? s : hit;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** 毫秒时间戳 → 本地 MM-DD HH:mm。不走 toLocaleString：时间线是一列要对齐的
   *  数字，形状必须可预期（中文环境下 "10月3日 21:32" 会让整列参差不齐）。
   *  withYear：区间跨年时才带上年份 —— 不跨年时年份是噪音。 */
  function stamp(ms, withYear) {
    const d = new Date(Number(ms));
    if (!Number.isFinite(d.getTime())) return '—';
    const y = withYear ? `${d.getFullYear()}-` : '';
    return `${y}${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  /** 事件时长。Util.duration 是给"机时"设计的，几秒的事件会被它读成 0m，这里单独写。 */
  function spanText(ms) {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${pad2(m % 60)}m`;
    return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
  }

  /** 站点数字文案 → 数值（"21,544" / "271" / "22 %"）。没有数字返回 null。
   *  真实的 0 要如实返回 0 —— 新机器就是 0 帧，那和"读不到"是两回事。 */
  const numOf = (s) => {
    const raw = String(s === undefined || s === null ? '' : s);
    if (!/\d/.test(raw)) return null;
    const n = Number(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  /** 毫秒 → 本地日期键。汇总按"这台机器本地的天"分桶，和行里的时间戳用同一套时区。 */
  function lkey(ms) {
    const d = new Date(Number(ms));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /**
   * 事件流 → 活动汇总：跨度超过 31 天按月，否则按天，最近的在前。
   * 每条只留能回答"这台机器在不在干活"的四个数：真正用于渲染的时长、事件数、
   * 涉及作业数、发送失败数。原始的 761 条事件不是不要，是不默认铺出来（见下面的完整日志）。
   */
  function activity(list) {
    // 自己先排一遍倒序：这个方法只该依赖"事件数组"，不该依赖调用方已经排好
    const ev = (list || []).filter((e) => Number.isFinite(e.start)).slice().sort((a, b) => b.start - a.start);
    if (!ev.length) return { rows: [], byMonth: false, anyRender: false, anyFail: false, crossYear: false };
    const byMonth = Util.ddiff(lkey(ev[ev.length - 1].start), lkey(ev[0].start)) + 1 > 31;
    // 跨年时日期键要带年份：一屏 "12-28 → 02-10" 谁也说不清是哪一年
    const crossYear = new Date(ev[0].start).getFullYear() !== new Date(ev[ev.length - 1].start).getFullYear();
    const map = new Map();
    for (const e of ev) {
      const day = lkey(e.start);
      const key = byMonth ? day.slice(0, 7) : (crossYear ? day : day.slice(5));
      let b = map.get(key);
      if (!b) { b = { key, events: 0, jobs: new Set(), render: 0, failed: 0 }; map.set(key, b); }
      b.events++;
      if (e.job) b.jobs.add(e.job);
      if (e.type === 'rendering') b.render += Math.max(0, e.end - e.start);
      if (/error/.test(e.type)) b.failed++;
    }
    const rows = [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
    // 条的分子只有一个：渲染时长。一条渲染事件都没有时**不换口径**（不拿事件数冒充），
    // 只把填充留空 —— 一排空轨道读出来就是"这台机器没在渲染"。见视图里的 showBar。
    const anyRender = rows.some((b) => b.render > 0);
    const scale = Math.max(...rows.map((b) => b.render)) || 1;
    return {
      rows: rows.map((b) => ({ ...b, jobs: b.jobs.size, bar: b.render / scale })),
      byMonth, anyRender, anyFail: rows.some((b) => b.failed > 0), crossYear,
    };
  }

  function session(state) {
    const s = state.session;
    if (!s) return UI.state.empty();
    const val = (k) => (s.info[k] ? s.info[k].value : '');
    const owner = s.info.owner || null;

    /* ---- 身份条：状态徽章 + 主机名 + OS / 属主 / 客户端版本 ----
       状态徽章先说站点那行没有标签的状态行：**两种暂停是不同的两件事**。
       服务器端点暂停 → "Paused server side"；客户端自己暂停 → "Paused client side"。
       它才是权威说法 —— Action 那格只说明"服务器认不认它在跑"，而客户端本地暂停时
       服务器仍然认为它在跑（Status 也照样写着 Enable），只看 Action 会把本地暂停
       报成「运行中」。认得出的译成中文，认不出的原样显示，站点原文一律挂 title 备查。 */
    const status = val('status');
    const note = s.info.note ? s.info.note.value : '';
    const noteKey = /paused\s+server\s+side/i.test(note) ? 'sess.pausedServer'
      : /paused\s+client\s+side/i.test(note) ? 'sess.pausedClient' : '';
    const noteTitle = note ? ` title="${esc(t('sess.statusRaw', { raw: note }))}"` : '';
    const chip = note
      ? `<span class="chip off"${noteTitle}>${esc(noteKey ? t(noteKey) : note)}</span>`
      : s.running === false ? `<span class="chip off">${esc(t('sess.off'))}</span>`
        : s.running === true ? `<span class="chip on">${esc(t('sess.on'))}</span>`
          : (status ? `<span class="chip">${esc(packLabel('sess.status', status))}</span>` : '');

    const bits = [];
    /* 这台机器此刻在跑什么。站点写在 "Current frames"，形如
       "project: 1002.blend frame: 194 Request time: 1m"（空闲时它不印这一行）。
       它是**活的** —— 几分钟就变 —— 所以放在身份条上，不留在「机器信息」那张表里：
       那张表的副标题正是"站点报告的原值，未做换算"，把一个马上过期的数字混进静态
       原值里，读者会拿它当档案看。暂停时说"当前作业"而不是"正在渲染"，
       否则会和旁边那枚「已暂停」徽章自相矛盾。 */
    const cur = val('currentFrames');
    const cm = cur.match(/^project:\s*(.+?)\s+frame:\s*(\S+)\s+Request time:/i);
    // 正在跑哪个项目的哪一帧。项目名后面还要用一次 —— 可渲染项目表里给那一行挂「正在渲染」。
    // 站点在「Current frames」里写的是**文件名**（1002.blend），可渲染项目表里写的是
    // **项目名**（1002），所以比对时把 .blend 后缀剥掉。
    const curProject = cm ? cm[1] : '';
    const curProjectBase = curProject.replace(/\.blend\d*$/i, '');
    if (cm) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cm[1])}</b> · ${esc(t('sess.frame'))} <b class="num">${esc(cm[2])}</b></span>`);
    } else if (cur) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cur)}</b></span>`);
    }
    if (val('os')) bits.push(`<span>${esc(val('os'))}</span>`);
    if (owner) {
      const href = owner.href || (owner.user ? `/user/${encodeURIComponent(owner.user)}/profile` : '');
      bits.push(`<span>${esc(t('sess.owner'))} ${href
        ? `<a href="${esc(href)}" target="_self"><b>${esc(owner.value)}</b></a>`
        : `<b>${esc(owner.value)}</b>`}</span>`);
    }
    if (val('version')) bits.push(`<span>${esc(t('sess.client'))} <b class="num">${esc(val('version'))}</b></span>`);

    const head = `<div class="identity sesshead">
      ${chip}
      <h1>${esc(val('hostname') || t('sess.unknownHost'))}</h1>
      ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
    </div>`;

    /* 时间线先算出来：指标带要用它取"起算时刻"，下面那块还要用它的汇总 */
    const tl = s.timeline || [];
    const acts = activity(tl);

    /* ---- 指标带：这台机器干了多少活 ----
       起算时间用日志里最早那一条的**本地**时刻，不用站点原文：站点把 Creation Time 写在自己的
       时钟上（实测 UTC+2），而下面时间线是我们的本地时区 —— 同一个瞬间在一屏里差 6 小时
       会读成"创建 6 小时后才干活"。站点原文照旧留在机器信息里（那里标了"未做换算"）。 */
    const framesN = numOf(val('frames'));
    const pointsN = numOf(val('points'));
    const perFrame = framesN && pointsN ? Math.round(pointsN / framesN) : null;
    const since = tl.length ? stamp(tl[tl.length - 1].start) : val('createdAt');

    /* 算力那一格跟着站点印了哪一行走：这台机器启用了哪个计算设备，站点就印哪一行 ——
       CPU 机器给 "Power CPU"，GPU 机器给 "Power GPU"，两个都开就两行都在，于是这一带
       从 4 格变 5 格（.kpis[data-n="5"] 在 5 / 3 / 2 三档宽度下都验过，见 30-style.js）。
       这里**不写死 CPU 或 GPU**，只遍历站点真的印了哪几行：站点哪天再添第三种设备，
       多出来的那行会照既有规矩落进「机器信息」（标签原样显示），不会被吞。
       早先写死读 Power CPU，于是纯 GPU 机器（只开 GPU 渲染）上那格永远是"—" ——
       那不是"没数据"，是这台机器根本不用 CPU 渲染，摆一格空的会被读成"CPU 有问题"。
       一行都没给就整格不画：站点没给的不摆空壳。 */
    const powerFacts = s.facts.filter((f) => f.key === 'power' || f.key === 'powerGpu');

    const kpiItems = [
      {
        k: t('sess.kpi.frames'), v: framesN === null ? '—' : Util.num(framesN),
        d: since ? t('sess.kpi.since', { t: since }) : '',
      },
      {
        k: t('sess.kpi.points'), v: pointsN === null ? '—' : Util.num(pointsN),
        d: perFrame ? t('sess.kpi.perFrame', { n: fmt(perFrame) }) : '',
      },
      ...powerFacts.map((f) => ({
        k: sessLabel(f),
        v: f.value || '—',
        d: f.href ? `<a href="${esc(f.href)}" target="_self">${esc(t('sess.kpi.powerLink'))}</a>` : '',
      })),
      {
        // 只说上限。早先这里还挂一句"实测最长一帧"，但两者本就不可比（一个是参考机上的
        // 预估上限，一个是本机实际耗时），摆在一起只会让人以为哪个数不对，已按用户要求去掉。
        k: t('sess.kpi.maxTime'), v: val('maxTime') || '—', d: '',
      },
    ];

    /* ---- 机器控制：站点自己的那个按钮，同一批地址、同一套会话 ----
       只在看自己的机器时出现。实测别人的会话页站点直接 404，所以这一条实际是兜底：
       万一哪天站点放开了可见性，我们也不会摆一个按下去必然报错的按钮 —— 那时 Action
       这一行会退回事实清单里按原文显示，而不是沉默地消失。 */
    const act = s.info.action;
    const mine = !!(owner && owner.user && state.userName && owner.user === state.userName);
    const showControl = !!(act && act.action && mine);
    const control = showControl ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:0"><h2>${esc(t('sess.control'))}</h2></div>
      <div class="pbody">
        <p class="hint">${esc(t('sess.controlHint'))}</p>
        <button class="btn primary" data-act="sess-run" data-url="${esc(act.action)}">
          ${esc(s.running === true ? t('sess.pause') : t('sess.resume'))}</button>
      </div>
    </div>` : '';

    /* ---- 事实清单：两列键值，一格一件事。密钥排最后：它是偶尔来查一次的东西 ---- */
    const rest = s.facts.filter((f) => !sessElsewhere.has(f.key) || (f.key === 'action' && !showControl))
      .sort((a, b) => (a.key === 'renderKey' ? 1 : 0) - (b.key === 'renderKey' ? 1 : 0));
    const factsPanel = rest.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.facts'))}</h2><span class="sub">${esc(t('sess.factsSub'))}</span>
      </div>
      <div class="facts">${rest.map((f) => {
        let v;
        if (f.key === 'renderKey' && f.secret) {
          // 密钥：站点本来也是"点一下才显示"，照做。只落在属性里，不进可见文本。
          v = `<span class="num sec" data-key="${esc(f.secret)}">••••••••••••</span>` +
            `<button class="btn sm" data-act="reveal-key" aria-pressed="false">${esc(t('sess.reveal'))}</button>`;
        } else {
          // 每个值都带 tabular：这里的量有单位（9.8 GB / 8h27m / 06:40 Sep 29），
          // 按"能读成量"的规则走，别用启发式去猜哪个像数字
          const raw = f.value || '—';
          const txt = f.href ? `<a href="${esc(f.href)}" target="_self">${esc(raw)}</a>` : esc(raw);
          v = `<span class="num">${txt}</span>`;
        }
        return `<div class="fact"><span class="k">${esc(sessLabel(f))}</span><span class="v">${v}</span></div>`;
      }).join('')}</div>
    </div>` : '';

    /* ---- 时间线：默认给活动汇总，完整日志折叠在后面 ----
       把 761 条事件铺成表格是"把日志当正文"：占掉整屏，每行却只有四个短字段，
       五列还摊在整页宽上。默认给的是按天（跨度长时按月）的四个数——真正用于渲染的
       时长、事件数、作业数、发送失败数——一眼看出这台机器哪天在干活；
       要逐条看事件，再展开下面的完整日志。 */
    const openLog = !!sessState.open;
    const MAXB = 14;
    const buckets = acts.rows.slice(0, MAXB);
    const hiddenB = acts.rows.length - buckets.length;

    const counts = new Map();
    for (const e of tl) counts.set(e.type, (counts.get(e.type) || 0) + 1);
    if (sessState.type !== 'all' && !counts.has(sessState.type)) sessState.type = 'all';   // 换了机器，旧筛选要清掉
    const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
    const rows = tl.filter((e) => sessState.type === 'all' || e.type === sessState.type);

    const tlHead = tl.length
      ? t('sess.tlSub', {
        n: fmt(tl.length),
        from: stamp(tl[tl.length - 1].start, acts.crossYear),
        to: stamp(tl[0].start, acts.crossYear),
      })
      // 接口没回应时不在这里说"站点没有返回记录"—— 正文已经说了"没取到"，
      // 两句话在同一格里互相打脸（"没回"和"回了空"是两件事）
      : (s.timelineFailed ? '' : t('sess.tlSubEmpty'));

    /* 条只画"渲染时长"这一件事。一台机器从来没有渲染事件时（比如一直只领到校验），
       渲染时长整列都是「—」—— 那时候按事件数画一条会把图形的含义偷偷换掉，列名却还是
       "渲染时长"。这种情况不画填充（轨道照旧留着：一排空轨道读出来就是"零"），
       但**条这一列必须留着占位** —— 它是这行的弹簧，抽掉它表头和数值列会各自靠左排。 */
    const showBar = acts.anyRender;
    const pct = (b) => Math.round(b.bar * 100);
    const actTable = buckets.length ? `<div class="acts" role="table">
      <div class="acthead" role="row">
        <span class="ad" role="columnheader">${esc(acts.byMonth ? t('sess.act.month') : t('sess.act.day'))}</span>
        <span class="bar" role="columnheader" aria-label="${esc(t('sess.act.render'))}"></span>
        <span class="h" role="columnheader">${esc(t('sess.act.render'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.events'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.jobs'))}</span>
        ${acts.anyFail ? `<span class="h s" role="columnheader">${esc(t('sess.act.failed'))}</span>` : ''}
      </div>
      ${buckets.map((b) => `<div class="actrow" role="row">
        <span class="ad num" role="cell">${esc(b.key)}</span>
        <span class="ab" role="cell" aria-hidden="true">${showBar && b.bar > 0 ? `<i style="width:max(3px, ${pct(b)}%)"></i>` : ''}</span>
        <span class="av num" role="cell">${b.render ? esc(spanText(b.render)) : '—'}</span>
        <span class="an num" role="cell">${fmt(b.events)}</span>
        <span class="aj num" role="cell">${fmt(b.jobs)}</span>
        ${acts.anyFail ? `<span class="af num${b.failed ? ' on' : ''}" role="cell">${b.failed ? fmt(b.failed) : '—'}</span>` : ''}
      </div>`).join('')}
    </div>` : '';

    const detail = openLog ? `
      <div class="tlbar"><div class="seg" id="sp-tl-types">
        <button data-t="all" aria-pressed="${sessState.type === 'all'}">${esc(t('proj.all'))} <span class="num">${tl.length}</span></button>
        ${types.map((x) => `<button data-t="${esc(x)}" aria-pressed="${sessState.type === x}">${esc(typeLabel(x))} <span class="num">${counts.get(x)}</span></button>`).join('')}
      </div></div>
      <div class="tlwrap"><div class="tablewrap log" tabindex="0" role="region" aria-label="${esc(t('sess.timeline'))}"><table class="tbl dense">
        <thead><tr><th>${esc(t('sess.col.type'))}</th><th class="r">${esc(t('sess.col.start'))}</th>
          <th class="r">${esc(t('sess.col.span'))}</th><th class="r">${esc(t('sess.col.end'))}</th>
          <th>${esc(t('sess.col.job'))}</th></tr></thead>
        <tbody>${rows.slice(0, sessState.limit).map((e) => `<tr>
          <td><span class="st">${esc(typeLabel(e.type))}</span></td>
          <td class="r num">${esc(stamp(e.start, acts.crossYear))}</td>
          <td class="r num">${esc(spanText(e.end - e.start))}</td>
          <td class="r num">${esc(stamp(e.end, acts.crossYear))}</td>
          <td class="job num">${esc(e.job || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${moreRow(Math.min(rows.length, sessState.limit), rows.length, 100)}</div>` : '';

    const timelinePanel = tl.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.timeline'))}</h2><span class="sub num">${esc(tlHead)}</span>
        <span class="spacer"></span>
        ${openLog ? `<span class="sub num">${esc(t('list.shown', { n: Math.min(rows.length, sessState.limit), total: rows.length }))}</span>` : ''}
      </div>
      ${actTable}
      <div class="tlfoot">
        <button class="btn" data-act="sess-log" aria-expanded="${openLog}">${esc(openLog
          ? t('sess.logClose') : t('sess.logOpen', { n: fmt(tl.length) }))}</button>
        ${hiddenB ? `<span class="sub">${esc(t(acts.byMonth ? 'sess.act.moreMonth' : 'sess.act.moreDay', { n: hiddenB }))}</span>` : ''}
      </div>
      ${detail}
    </div>` : `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.timeline'))}</h2><span class="sub num">${esc(tlHead)}</span>
      </div>
      <div class="pbody"><div class="none">${esc(s.timelineFailed ? t('sess.tlFailed') : t('sess.tlNone'))}</div></div>
    </div>`;

    /* ---- 可渲染项目：按"为什么现在不派给它"分组。
       站点给的是 27 行平铺、原因重复 27 遍；原因本身才是能读的那一层信息。 */
    // 发布者：站点这张表只给项目名，发布者要去项目列表页按名字对（实测真站点 33/33 对得上）。
    // 重名项目一律不挂 —— 两个同名的项目挂谁都可能是错的，宁可留空。
    const own = new Map();
    const dup = new Set();
    for (const p of state.projects || []) {
      if (!p.name) continue;
      if (own.has(p.name)) dup.add(p.name);
      else own.set(p.name, p);
    }
    for (const n of dup) own.delete(n);

    /* ---- 可渲染项目。
    
       **站点的行序就是优先级，必须原样保留。** 实测一台机器：前 12 行写的是
       "Renderable"（此刻真能渲染的），之后才是 "Over user's time limit"、
       "Computer has previously failed to render project" 这些；而且第 1 行往往
       就是这台机器此刻正在渲染的那个项目（实测 1. 1002 对 "project: 1002.blend"）。
       换句话说，"越靠前越可能先渲染"这层信息只存在于顺序里，站点没用别的列表达它。
       所以这里只做一次映射，不排序、不分组、不去重。

       早先按原因分组、组内重排，等于把这层信息抹掉了 —— 表面更好看，代价是丢事实。 */
    const prjRows = s.projects.map((p) => ({
      n: p.name,
      label: p.reason ? packLabel('why', p.reason) : t('sess.whyNone'),
      p: own.get(p.name) || null,
    }));

    // 发布者那一格用与项目页同一个 ownerCell：头像 + 名字 + 常驻名单标记 + 3 点菜单。
    // 三份名单来自账户设置页 —— ensureData 为会话页也取一次，否则整格不给动作。
    const maps = listsOf(state);
    // 打开的 3 点菜单：和项目页一样，浮层放在视图最外层（.tablewrap 是 overflow:auto，
    // 放进去会被裁掉），坐标由 Views.mount() 量触发按钮的位置再写进去。
    const openP = projState.menu ? [...own.values()].find((x) => x.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

    /* 列与项目页对齐：项目 / 发布者 / 状态 / 进度（条 + 分数两列）/ 设备 / 内存。
       进度那两列是分开的 —— 分数挂在条子后面会让每行的轨道长度随数字宽度变来变去，
       这条规矩见 docs/DESIGN.md 的 Progress Bar 一节。 */
    const prjPanel = s.hasProjects !== false ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.projects'))}</h2>
        <span class="sub">${esc(t('sess.prjSub', { n: fmt(s.projects.length) }))}</span>
      </div>
      ${prjRows.length ? `<div class="tablewrap" style="margin:0 6px 6px"><table class="tbl dense">
        <thead><tr>
          <th>${esc(t('proj.col.project'))}</th>
          <th>${esc(t('proj.col.owner'))}</th>
          <th>${esc(t('proj.col.status'))}</th>
          <th colspan="2">${esc(t('proj.col.progress'))}</th>
          <th>${esc(t('proj.col.device'))}</th>
          <th class="r">${esc(t('proj.col.memory'))}</th>
        </tr></thead>
        <tbody>${prjRows.map(({ n, label, p }) => {
          // 关联得到就用项目页那一格；关联不到留一个破折号 —— 缺一个事实就让它缺着，不猜。
          const who = p && (p.ownerId || p.owner) ? ownerCell(p, state.userName, maps) : '<span class="dash">—</span>';
          // 这台机器此刻正在跑的那一行：站点在「Current frames」里给的是文件名，
          // 表里是项目名，所以连剥掉 .blend 后的名字一起比。
          const isCur = !!curProject && (curProject === n || curProjectBase === n);
          const frac = p ? UI.progressText(p.pct, p.done, p.total) : '';
          return `<tr>
            <td><div class="pnwrap"><div class="pn" title="${esc(n)}">${esc(n)}</div>${
              isCur ? `<span class="now">${esc(t('sess.rendering'))}</span>` : ''}</div></td>
            <td>${who}</td>
            <td><span class="st">${esc(label)}</span></td>
            <td>${p ? UI.progress(p.pct, frac) : '<span class="dash">—</span>'}</td>
            <td class="r num frac">${p ? esc(frac) : '<span class="dash">—</span>'}</td>
            <td>${p ? UI.devices(p.cpu, p.gpu) : '<span class="dash">—</span>'}</td>
            <td class="r num">${p ? esc(p.memory || '—') : '<span class="dash">—</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="pbody"><div class="none">${esc(t('sess.prjNone'))}</div></div>`}
    </div>` : '';

    return head + UI.kpis(kpiItems) + factsPanel + control + timelinePanel + prjPanel + foot() + menuHtml;
  }

  /* ======================================================== 挂载后补丁
     视图本身是纯字符串；只有总览的积分曲线需要拿到真实像素宽度才能画。 */
  /* ================================================== 项目上传页 / 分析等待页
     这两页与前面六个视图不是一回事，写清楚免得后来人改错：

     前六个是"整页重建" —— 数据从站点页面解析出来，界面由字符串模板画出来。
     这两页是**局部换装**：卡片骨架我们画，但**能干活的节点从原站搬过来**。

     为什么搬而不是重画：上传表单靠 `onsubmit="addproject_upload_progress_fct(uid)"`
     触发站点自己的 addproject.js，估算器靠一段内联 `jQuery(...).autocomplete()` 绑定
     设备名搜索，进度条由站点的轮询喂。这些绑的都是 **id 和事件属性**，不是外观 ——
     节点搬进我们的卡片，处理器全都还在；重画就等于把上传、进度轮询、设备自动补全
     在客户端再实现一遍，而且站点一改就得跟着改。

     搬运的另一个前提：文案已经翻译过了。DomI18n 明确**不进 #sp**，所以搬运必须发生在
     它跑完之后 —— 顺序是"先让站点页面在原地翻好，再把节点搬进来"，见 80-app.js 的 boot。

     验证状态（2026-10-04，别当成"已在真实安装路径下验过"）：
     这两页是对着**真实页面**验的，但验法是「先清掉已安装脚本的节点、再把 dist 产物注入
     已加载的页面」。所以 `@run-at document-start` 那一段 —— 防闪、以及守卫在原站界面画出来
     之前注入的时机 —— **没有走完整安装路径**。补它只能靠用户更新到新版后直接看。
     详见 docs/PUBLISHING.md 的「五、验证状态」。 */

  /** 卡片骨架。真正的内容由 wireUpload() 从原站搬进来，所以这里只有空的插槽。 */
  function upload() {
    return `<div class="wrap up">
      <div class="sechead">
        <h2>${esc(t('up.title'))}</h2>
        <span class="sub">${esc(t('up.sub'))}</span>
      </div>
      <div class="up-grid">
        <div class="up-col">
          <div class="panel">
            <div class="phead"><h2>${esc(t('up.formTitle'))}</h2></div>
            <div class="up-body" data-up="form"></div>
          </div>
          <div class="panel" data-up="estPanel">
            <div class="phead"><h2>${esc(t('up.estTitle'))}</h2></div>
            <div class="up-body" data-up="est"></div>
          </div>
        </div>
        <div class="panel up-rules">
          <div class="phead"><h2>${esc(t('up.rulesTitle'))}</h2></div>
          <div class="up-body" data-up="rules"></div>
        </div>
      </div>
      <div class="up-src">${esc(t('up.origin'))}</div>
    </div>`;
  }

  /**
   * 站点那句「Max: 2,048 MB before ZIP compression / Blender compression is recommended
   * and supported.」和 `<input type="file">` 挤在同一个 `<td>` 里。
   *
   * 这一格正是「翻译层不能整块替换」那条安全规则被踩出来的地方（见 70-i18n-dom.js）：
   * 整块替换会把文件框一起删掉。但那一格被 `<br>`/`<strong>` 切成了好几个文本节点，
   * 逐节点翻译也拼不回一句中文 —— 所以这句话由卡片自己说，**大小从站点原文里读**
   * （上限是站点配置，不写死）。认不出站点那句话就原样留着，不猜。
   */
  function rewordFileLimit(scope) {
    const file = scope.querySelector('input[type=file]');
    if (!file) return;
    const cell = file.closest('td') || file.parentElement;
    if (!cell) return;
    const txt = cell.textContent || '';
    const m = txt.match(/Max:\s*([\d.,]+\s*[KMGT]?B)/i) || txt.match(/上限：\s*([\d.,]+\s*[KMGT]?B)/);
    if (!m) return;
    [...cell.childNodes].forEach((n) => { if (n !== file) n.remove(); });
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = t('up.maxNote', { size: m[1] });
    file.after(note);
  }

  /**
   * 须知那一块的收尾。**只贴标签、只去掉一个多余字符，不改写任何文字** ——
   * 排版该由 CSS 干，这里只处理 CSS 够不着的两件事：
   *
   *   1. 站点把「项目总数: 29」写成一个**裸文本节点**直接挂在容器里（不是元素）。
   *      裸文本节点没法给类名、没法排版，所以给它包一个 span。
   *   2. CPU/GPU 那一行是 `<ul>`，但它的语义是"两个数"，给它 `.qpos` 让它排成一行数据。
   *   3. 站点那句 `…<strong>3.0 or higher</strong>.` 的句号在 `<strong>` **外面**；
   *      中文译文自带句号，于是渲染成「…或更高。.」这种双句号。孤立的一个 "." 去掉 ——
   *      只在**前面已经以句末标点收尾**时才去，所以英文界面（不翻译）原样保留。
   */
  function tidyRules(scope) {
    const col = scope.firstElementChild;
    if (!col) return;
    for (const n of [...col.childNodes]) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const span = document.createElement('span');
      span.className = 'qtotal';
      span.textContent = n.nodeValue.trim();
      n.replaceWith(span);
    }
    const firstUl = col.querySelector('ul');
    if (firstUl) firstUl.classList.add('qpos');
    for (const li of scope.querySelectorAll('li')) {
      const last = li.lastChild;
      if (!last || last.nodeType !== 3) continue;
      const tail = last.nodeValue.trim();
      if (!/^[.．。]+$/.test(tail)) continue;
      const before = li.textContent.slice(0, li.textContent.length - tail.length).trimEnd();
      if (/[。．.！!？?]$/.test(before)) last.remove();
    }
  }

  /**
   * 把 /getstarted 上「Add your project」那一段的节点搬进卡片，然后用 #sp 顶掉原站那一段。
   *
   * 三个可能的现场，都要认：
   *   1. 站点给了上传表单（正常）；
   *   2. 站点给了 `#addproject_warning_zero_frame`（渲染帧数不够，站点自己拦住不让传）；
   *   3. 两个都没有 —— 站点渲染的是 printError（未登录 / 维护中 / 管理员关了上传）。
   * 第 3 种**原样还给用户**：这一页本来就不是我们能接管的，退回"只补翻译"。
   *
   * 返回 false 表示什么都没动过（调用方据此退回原站界面）。
   */
  function wireUpload(root) {
    const slotForm = root.querySelector('[data-up="form"]');
    const slotEst = root.querySelector('[data-up="est"]');
    const slotRules = root.querySelector('[data-up="rules"]');
    const estPanel = root.querySelector('[data-up="estPanel"]');
    const main = document.querySelector('#addproject_main_div');
    const blocked = document.querySelector('#addproject_warning_zero_frame');
    // 先判定、再动手：走第 3 条路时不能留下半搬的状态
    if (!main && !blocked) return false;

    if (main) {
      // 结构：#addproject_main_div > .row > [.col-md-5（表单块 + 估算器块）, .col-md-6（须知）]
      const left = main.querySelector(':scope > .row > .col-md-5');
      const right = main.querySelector(':scope > .row > .col-md-6');
      const blocks = left ? [...left.children] : [];
      const formBlock = blocks.find((b) => b.querySelector('form[action*="/project/internal/upload"]')) || blocks[0];
      const estBlock = blocks.find((b) => b !== formBlock) || null;
      if (formBlock && slotForm) { slotForm.appendChild(formBlock); rewordFileLimit(formBlock); }
      if (estBlock && slotEst) slotEst.appendChild(estBlock);
      else if (estPanel) estPanel.remove();
      if (right && slotRules) { slotRules.appendChild(right); tidyRules(slotRules); }
    } else if (slotForm) {
      // 站点自己写明了为什么不能传，把那一段原样搬过来 —— 理由由站点负责，我们只换外观
      slotForm.appendChild(blocked);
      if (estPanel) estPanel.remove();
    }

    // 站点那个 <h3>Add your project</h3> 连同它那一节一起让位：现在这一段的标题在我们的卡片上
    const section = (main || blocked).closest('section');
    if (section && section.parentElement) section.replaceWith(root);
    else (document.body || document.documentElement).appendChild(root);
    return true;
  }

  /* ------------------------------------------------------------ 分析等待页 */

  /** 上传后的等待页。整页归我们：站点那一版就是一个转圈圈加一句英文。
   *  真正在跑的是 80-app.js 里的轮询 —— 它认的是 `#sp-an-*` 这几个钩子。 */
  function analyse() {
    return `<div class="wrap">
      <div class="sechead">
        <h2>${esc(t('an.title'))}</h2>
        <span class="sub">${esc(t('an.sub'))}</span>
      </div>
      <div class="panel an-card">
        <div class="an-head">
          <div class="spin" data-an="spin"></div>
          <div>
            <div class="an-state" data-an="state">${esc(t('an.waiting'))}</div>
            <div class="an-sub" data-an="sub">${esc(t('an.slow'))}</div>
          </div>
        </div>
        <div class="an-track" data-an="track"><i data-an="bar"></i></div>
        <div class="an-done" data-an="done" hidden>
          <div class="an-sub">${esc(t('an.doneNote'))}</div>
          <button class="btn" data-act="mode-classic">${esc(t('mode.toClassic'))}</button>
        </div>
        <div id="sp-an-result" class="sp-siteform" hidden></div>
      </div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }

  function mount(root, state) {
    // 上传页的搬运放在这里，是因为它要等 #sp 已经进了 DOM、卡片骨架已经在里面。
    // 搬不动（这一页站点渲染的是 printError，没有表单）就回 false，让调用方把页面还回去。
    if (state && state.view === 'upload' && root && !root.dataset.spWired) {
      root.dataset.spWired = '1';
      if (!wireUpload(root)) return false;
    }
    const box = root && root.querySelector('#sp-chart');
    const pts = state && state.profile && state.profile.points;
    if (box && pts && pts.length > 1) SP.Charts.points(box, pts);
    // 热力图格子要能回答"这是哪一天"，原生 title 太慢，挂一个真正的浮层
    if (root) SP.UI.bindHeatTips(root.querySelector('.heatwrap'), I18n.lang);
    // 3 点菜单的坐标：它挂在 #sp 里（表格容器是 overflow:auto，放表格里会被裁掉），
    // 所以只能量一次触发按钮的位置再写进去。右对齐到按钮，靠视口下沿时向上翻。
    const menu = root && root.querySelector('#sp-omenu');
    const trigger = root && root.querySelector('[data-act="owner-menu"][aria-expanded="true"]');
    if (menu && trigger) {
      const host = document.getElementById('sp');
      const b = trigger.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const z = Util.zoomOf(host);   // 界面缩放的补偿：rect 是物理像素，left/top 是 CSS 像素
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      // 左缘对齐到**菜单按钮**（用户拍板）：菜单从按钮的左缘往右铺，而不是往左倒挂。
      // 顶到视口右边界时整体左移，别溢出去。
      let left = (b.left - hr.left) / z;
      left = Math.max(8, Math.min(left, host.clientWidth - mw - 8));
      const below = b.bottom + (6 + mh) * z <= window.innerHeight;
      const top = below
        ? (b.bottom - hr.top) / z + host.scrollTop + 6
        : (b.top - hr.top) / z + host.scrollTop - mh - 6;
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
    }
  }

  SP.Views = { overview, projects, ranking, settings, account, session, upload, analyse, projState, rankState, acctState, sessState, dailySeries, mount };
})();

/* ===== src/70-i18n-dom.js ===== */
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

/* ===== src/80-app.js ===== */
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
    // 项目上传页。**注意 /getstarted 同时是「下载客户端」指南页** —— 上传表单只是它三段里
    // 的最后一段，所以这一页只做局部接管（见 INLINE_VIEWS）。
    if (p === '/getstarted') return 'upload';
    // 上传之后的「正在分析」等待页，token 就是这一页的身份，从地址里读。
    // 站点把 /project/add/<任意串> 都指向同一个模板，所以这里也只认形状不认值。
    if (/^\/project\/add\/[^/]+$/.test(p)) return 'analyse';
    /* 还没接管的两页，写在这里免得下次重新摸一遍：
       · 分析完成后的「新增项目」设置表单（官方 formAddProject()，约 490 行 PHP）——
         它是 /project/add_analyse/<token> 的响应片段，由上面那一页的轮询接住再注入；
       · 项目管理页 /project/<数字>（官方 manage.html.twig，六个功能区 + ACL 名单）。
       两页都只对项目所有者开放，手上没有真实样本 —— 要做只能照官方源码写，
       成品必须标注「未对真实页面验证」，并优先请有项目的人复核。 */
    return null;
  }

  /** 局部接管的视图：#sp 不铺满视口，只顶掉站点的那一段，页面其余部分保持原站。 */
  const INLINE_VIEWS = new Set(['upload']);

  const pathView = viewForPath(location.pathname);
  const uiMode = Util.store.get('uiMode', 'modern');
  const inlineView = pathView ? INLINE_VIEWS.has(pathView) : false;

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
    b.title = classic ? t('mode.classicTip') : (kind === 'partial' ? t('mode.partialTip') : t('mode.enterTip'));
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
   * 未重建的页面（/faq、/servers、/project/*…）保持原站界面，
   * 只在本地把 UI 文案翻成当前语言。与"重做界面"是两件独立的事。
   */
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
      /* 角落开关**不受 on 影响**，照挂 —— 关掉翻译之后如果连按钮一起没了，
         页面上就再没有入口能把它开回来（0.1.6 用户实报的坑）。
         只在"这门语言本来就有词表"时挂：英文是基准语言、翻译层不介入，挂了也没意义。 */
      if (I18n.canTranslateSite()) SP.DomI18n.mountPill();
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

  // 局部接管的页面**不能**压住整页 —— 它要的是"页面其余部分照常显示，只有那一段换成我们的"，
  // 所以守卫只在整页接管时注入。
  if (!inlineView) SP.injectGuard();
  SP.injectStyle();

  /** 提前注入了守卫、但后来发现不该接管时，把页面原样还给用户 */
  function release() {
    released = true;
    const g = document.getElementById('sp-guard');
    if (g) g.remove();
    const s = document.getElementById('sp-style');
    if (s) s.remove();
    const host = document.getElementById('sp');
    if (host) host.remove();   // 局部接管时它只是个还没派上用场的空壳
    startSiteTranslation();
  }
  let released = false;

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
    analyseToken: null,    // /project/add/<token>，同样是地址的一部分
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
    if (released) return;
    const host = mount();
    applyTheme();
    const scrollY = host.scrollTop;

    /* 局部接管的页面（目前只有 /getstarted 的上传段）：没有顶栏、没有 #sp-body，
       卡片本身就是 #sp 的内容，而且**画一次就不再重画** —— 里面装着从站点搬过来的
       活节点（上传表单、估算器），重画一次就连它们的处理器一起扔了。 */
    if (inlineView) {
      host.classList.add('sp-inline');
      if (host.dataset.spWired) return;
      host.innerHTML = Views.upload(state);
      if (Views.mount(host, state) === false) { release(); return; }
      host.classList.add('sp-anim');
      return;
    }

    /* 分析等待页同理只画一次，但它是**整页接管**，所以照常给外壳 ——
       站点那一版的导航被守卫藏了，用户得有顶栏和出口。
       只能画一次是因为 #sp-an-result 里会被站点注入下一步的表单，
       重画就把站点刚塞进来的东西抹掉了；状态更新走 paintAnalyse() 的定点改。 */
    if (state.view === 'analyse' && host.dataset.spWired) return;

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
    else if (state.view === 'analyse') html = Views.analyse();
    else if (state.view === 'account') html = state.account ? Views.account(state) : UI.state.empty();
    else if (state.view === 'session') html = state.session ? Views.session(state) : UI.state.empty();
    else if (state.view === 'overview') html = state.profile ? Views.overview(state) : UI.state.empty();
    else if (state.view === 'projects') html = state.projects ? Views.projects(state) : UI.state.empty();
    else if (state.view === 'ranking') html = state.ranking ? Views.ranking(state) : UI.state.empty();
    else html = UI.state.empty();

    body.innerHTML = html;
    // 画完这一次就不再画：见上面分析等待页那一段。（错误态不锁，重试要能重画）
    if (state.view === 'analyse' && !state.error) host.dataset.spWired = '1';
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

  /* ------------------------------------- 3.5 上传后的「正在分析」轮询

     站点自己的 addproject.js 就是这么轮的：GET /project/add_analyse/<token>，
     等待中回 {"status":"RETRY"}，分析中回 {"status":"PROCESSING","analysed":n,"total":m}，
     分析完成则**直接把「新增项目」表单当 HTML 吐回来**（那个片段没有布局，本来就是给
     JS 塞进容器用的）。

     我们自己轮一次、而不是调站点的 doAnalyseUploadedProject()：它的状态文案是写死的英文，
     而且它把结果写进站点那个容器 —— 那一屏已经被我们接管了。接口和状态机照抄站点，
     没有自己发明协议；多出来的一次 GET 也不算浪费：站点自己那一版也是一样的频率。

     为了让**只有一个**轮询器在打这个接口，站点的那个函数在这里摘掉 —— 它挂在
     google.charts 的 onLoadCallback 上，什么时候跑不确定，留着就是两个轮询器。 */
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
      try { window.doAnalyseUploadedProject = function () { /* 见上：这一页的轮询归我们 */ }; } catch (e) { /* 站点没定义就算了 */ }
    }
    // 先让首屏画出来再开始轮（render() 刚写完卡片，马上 repaint 会抢掉入场动效）
    analyseTimer = setTimeout(analyseTick, 400);
  }

  async function analyseTick() {
    const token = state.analyseToken;
    if (!token) return;
    let raw;
    try {
      // ttl 0：这一页轮的就是"现在"，缓存下来等于永远停在第一次的结果
      raw = await Api.fetchPage(`/project/add_analyse/${encodeURIComponent(token)}`, { ttl: 0 });
    } catch (e) {
      // 接口没回应就停下，不再自己重试 —— 卡片上那句文案已经说了"重新载入这一页"
      paintAnalyse({ failed: (e && e.message) || String(e) });
      return;
    }
    let json = null;
    try { json = JSON.parse(raw); } catch (e) { /* 不是 JSON，那就看形状 */ }
    if (json === null) {
      /* 分析完成时站点吐的是**一段没有布局的片段**（给 JS 塞进容器用的）；
         而"这个编号找不到"它吐的是整页 error.html.twig。用形状把两者分开 ——
         否则会把一整页错误当成"填表去吧"塞进卡片里。 */
      if (/^\s*<(!doctype|html)/i.test(raw)) { paintAnalyse({ gone: true }); return; }
      paintAnalyse({ html: raw });
      return;
    }
    if (json && json.status === 'PROCESSING') {
      paintAnalyse({ done: Number(json.analysed) || 0, total: Number(json.total) || 0 });
    } else {
      paintAnalyse({ waiting: true });
    }
    analyseTimer = setTimeout(analyseTick, 5000);
  }

  /** 只改卡片里那几个节点，不整页重画 —— 重画会把站点注入的下一步表单一起抹掉。 */
  function paintAnalyse(s) {
    const host = document.getElementById('sp');
    if (!host) return;
    const q = (k) => host.querySelector(`[data-an="${k}"]`);
    const say = (k, text) => { const el = q(k); if (el) el.textContent = text; };

    if (s.failed) {
      stopAnalysePoll();
      const spin = q('spin'); if (spin) spin.remove();
      say('state', t('an.failed', { err: s.failed }));
      say('sub', '');   // "几分钟是正常的"是等待中的话，收尾了就不该再挂着
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
      // 分析完成了：站点那份「新增项目」表单进来。本版没有重制它（卡片上已经写明），
      // 所以只把它放进来做可读性兜底，功能原样可用 —— 提交走站点自己的 doAddProject。
      stopAnalysePoll();
      const spin = q('spin'); if (spin) spin.remove();
      say('state', t('an.doneTitle'));
      say('sub', '');
      const track = q('track'); if (track) track.hidden = true;
      const done = q('done'); if (done) done.hidden = false;
      const box = document.getElementById('sp-an-result');
      if (box) { box.innerHTML = s.html; box.hidden = false; }
      return;
    }
    // PROCESSING
    say('state', s.total
      ? t('an.processing', { done: fmtN(s.done), total: fmtN(s.total) })
      : t('an.reading'));
    const track = q('track'); if (track) track.classList.remove('indet');
    const bar = q('bar');
    if (bar) bar.style.width = s.total ? `${Math.min(100, Math.round((s.done / s.total) * 100))}%` : '100%';
  }

  /* ------------------------------------------------------- 4. 数据编排 */

  async function ensureData(view) {
    if (view === 'settings') return;

    if (view === 'account') {
      if (!state.userName) throw new Error(t('account.only'));
      state.account = Api.parseAccount(await Api.fetchPage(`/user/${encodeURIComponent(state.userName)}/edit`));
      return;
    }

    if (view === 'upload') {
      // 上传页没有要取的东西：表单、上限、须知都在站点那一页的 DOM 上，我们只是把它搬进卡片。
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
      // 发布者那格的名单标记与 3 点菜单要看我自己那三份名单（账户设置页里那份）。
      // 读不到就整格不给动作 —— 与项目页同一条规矩：状态不明的地方不给按钮。
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

    // 分析等待页的 token 同理：地址就是身份。
    const an = location.pathname.match(/^\/project\/add\/([^/]+)/);
    state.analyseToken = an ? decodeURIComponent(an[1]) : null;

    /* 上传页要先确认这一页**真的有**可接管的东西。站点在这一段上有四种现场：
     有表单 / 用"渲染帧数不够"拦住 / 未登录 / 维护中。后三种它渲染的是 printError 或
     一句提示，那种页面原样还回去 —— 不接管，也不留半搬的状态。 */
    if (pathView === 'upload') {
      if (!document.querySelector('#addproject_main_div, #addproject_warning_zero_frame')) {
        startSiteTranslation();
        mountModePill('enter');
        return;
      }
      /* 站点那一段的文案必须**先原地翻好**，再搬进我们的卡片 ——
         DomI18n 明确不进 #sp（那是我们自己的界面），搬完再翻就翻不到了。
         mountPill() 自己会跳过已经有 #sp 的情况，这里 #sp 还没建，所以照常给出口。 */
      startSiteTranslation();
      /* 局部接管的页面**必须**留着角落这颗「进入新界面」：卡片是刻意没有顶栏的
         （这一页的其余部分还是原站的，不该再叠一层我们自己的导航），所以这一页上
         属于我们的入口只有它。0.1.6 漏了这一步 —— /getstarted 从"未接管"变成
         "半接管"之后就走了另一条分支，原来那颗按钮随之消失（用户实报）。 */
      mountModePill('partial');
    }

    if (location.hash && /^#\/(\w+)$/.test(location.hash)) {
      const v = location.hash.slice(2);
      if (ROUTES[v]) state.view = v;
    }

    document.title = document.title.replace(/^\s*SheepIt\s*$/, 'SheepIt Plus');

    if (!state.userName && !state.profileName) {
      // 局部接管的页面上不摆"请先登录"这一屏：站点自己的页面还在，它自己会说这句话
      // （/getstarted 未登录时就写着 "You need to be logged in to add a project."）。
      if (inlineView) { startSiteTranslation(); mountModePill('enter'); return; }
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
