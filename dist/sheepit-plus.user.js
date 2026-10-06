// ==UserScript==
// @name         SheepIt Plus · 渲染农场界面重制
// @name:en      SheepIt Plus · Renderfarm UI Rebuild
// @namespace    https://github.com/clouddoze
// @version      0.2.2
// @description  给 SheepIt Render Farm 换一套新前端：仪表盘、项目列表、排行榜、会话页、账户设置；中英双语、明暗双主题。数据读自站点自己的页面，不向第三方发送。
// @description:en  A new front end for SheepIt Render Farm: dashboard, project list, ranking, session page, account settings. Bilingual (zh/en), dark and light. All data is read from the site's own pages.
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

/* @namespace 定死后不可再改；@version 只能往上走；回填与发版流程见 docs/PUBLISHING.md「四」。 */

/* sheepit-plus v0.2.2 — 由 build.mjs 生成，请勿直接编辑。源码见 src/ */

/* ===== src/10-core.js ===== */
/* ==== 10-core.js：工具 / 语言包注册表 / 主题 token ==== */
(function () {
  'use strict';

  const NS = 'sheepit-plus';
  const SP = (window.__SHEEPIT_PLUS__ = window.__SHEEPIT_PLUS__ || {});
  SP.NS = NS;

  /* ==== 工具 ==== */

  const Util = {
    /** zoomOf：rect 是物理像素、内部 left/top 是 CSS 像素，按 rect 量的位移要除以它。 */
    zoomOf(el) {
      if (!el) return 1;
      const w = el.clientWidth;
      const r = el.getBoundingClientRect().width;
      return w > 0 && r > 0 ? r / w : 1;
    },

    num(v) {
      if (v === null || v === undefined || v === '') return '—';
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n.toLocaleString('en-US') : String(v);
    },

    /** statNum：带 K/M/G 后缀的原样保留、不归一 —— num() 会把 "342.6 M" 剥成 342.6（差六个数量级）。 */
    statNum(v) {
      const s = String(v === null || v === undefined ? '' : v).trim();
      if (!s) return '—';
      const m = s.match(/^([\d.,]+)\s*([KMGTPE])$/i);
      if (m) return `${m[1]} ${m[2].toUpperCase()}`;
      return Util.num(s);
    },

    /** 秒数 → 1y245d21h 紧凑格式 */
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

    /** Date → 'YYYY-MM-DD'；走 UTC，免得时区把日期挪一天 */
    dkey(d) { return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10); },

    dshift(key, n) {
      const x = new Date(`${key}T00:00:00Z`);
      x.setUTCDate(x.getUTCDate() + n);
      return Util.dkey(x);
    },

    ddiff(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000); },

    mkey(key) { return String(key).slice(0, 7); },

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

    /** 时长文案 → 1y245d21h；解析不出返回 null */
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

    renderTime(raw) {
      const s = String(raw === null || raw === undefined ? '' : raw).trim();
      if (!s) return '—';
      if (/^\d+$/.test(s)) return Util.duration(Number(s));
      return Util.compactTime(s) || s;
    },

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

    /** safePath：只留同站路径；空串必须返回 null —— new URL('', origin) 会解析成当前页，懒加载图会算成 "/"。 */
    safePath(u) {
      const s = String(u === null || u === undefined ? '' : u).trim();
      if (!s) return null;
      if (/^\/(?!\/)/.test(s)) return s;
      try {
        const url = new URL(s, location.origin);
        return url.origin === location.origin ? url.pathname + url.search : null;
      } catch (e) { return null; }
    },

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

    /** store：键带前缀避免污染站点 key；值走 JSON 读写 */
    store: {
      get(k, d) { try { const v = localStorage.getItem(`${NS}:${k}`); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(`${NS}:${k}`, JSON.stringify(v)); } catch (e) { /* 隐私模式等 */ } },
    },

    once(map, key, fn) {
      if (map[key]) return map[key];
      const p = fn().finally(() => { delete map[key]; });
      map[key] = p;
      return p;
    },
  };

  /* ==== 语言包注册表 ==== */

  const DICT = {
    zh: {
      'nav.overview': '总览', 'nav.projects': '项目', 'nav.ranking': '排行榜', 'nav.settings': '设置',
      'nav.rankingShort': '排行', 'nav.accountShort': '账户',
      'top.refresh': '刷新', 'top.updated': '更新于',
      'hero.rank': '排名', 'hero.team': '团队', 'hero.joined': '注册于',
      'stat.frames': '已渲染帧数', 'stat.points': '积分', 'stat.time': '累计渲染时长',
      'stat.streak': '当前连续', 'stat.days': '天',
      'stat.streakHint': '历史最长 {best} 天 · 近 30 天活跃 {d30} 天',
      'stat.streakFull': '历史最长 {best} 天 · 近 30 天全勤',
      // 键由原文 slug 化（见 50-views.js packLabel）
      'badge.top-10-renderers': 'TOP 10% 渲染者',
      /* 这几条说的是**这个用户自己客户端**的状态（"Connected as 你" 框里），不是全站队列。 */
      'status.idle': '客户端待命中',
      'status.rendering': '正在渲染',
      'status.renderingFor': '正在为 {user} 渲染',
      'status.disconnected': '客户端未连接',
      'hero.statusRaw': '站点原文：{raw} —— 指你自己客户端的状态，不是全站队列',
      'stat.avgPeak': '日均 {avg} 帧 · 峰值 {peak}',
      'stat.rankWindow': '全站排名 {rank} · 30 天滚动',
      'stat.daysEquiv': '约 {days} 天机时',
      'stat.created': '建的项目', 'stat.createdHint': '你上传的任务数',
      'stat.ordered': '订的帧', 'stat.orderedHint': '为你自己的项目下单的帧数',
      'site.frames': '待渲染帧', 'site.projects': '进行中项目',
      'site.clients': '在线客户端', 'site.processing': '正在处理帧',
      'chart.points': '积分增长',
      'chart.tipPoints': '积分',
      'chart.pointsSub': '{n} 个采样点 · {from} → {to} · 当前 {now}',
      'months.title': '月度产出', 'months.sub': '按月汇总',
      'months.max': '最高月', 'months.min': '最低月',
      'heat.title': '渲染产出', 'heat.sub': '近 53 周 · 每格一天 · 按当天帧数着色',
      'heat.legendLow': '少', 'heat.legendHigh': '多',
      'heat.note': '{nz} 天有产出 · 峰值 {peak} 帧',
      'heat.total': '合计 {n} 帧', 'heat.frame': '帧',
      // 别人的主页只有二值日历，原站也拿它画热力图 —— 照样画，但口径必须说清。
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
      'proj.title': '进行中项目', 'proj.count': '共 {n} 个',
      'proj.prio.inList': '已在你的渲染优先级名单里',
      /* 3 点菜单 = 放进某份名单：优先 / 捐赠积分（你挣的给 TA）/ 黑名单（不渲染 TA 的项目）。 */
      'proj.menu.open': '更多动作', 'proj.menu.title': '把这个发布者…',
      'proj.menu.prio': '优先渲染 TA 的项目', 'proj.menu.unprio': '移出渲染优先级',
      'proj.menu.gift': '捐赠积分给 TA', 'proj.menu.ungift': '不再捐赠给 TA',
      'proj.menu.block': '加入黑名单（不渲染 TA 的项目）', 'proj.menu.unblock': '移出黑名单',
      'proj.menu.gifted': '已在你的捐赠名单里', 'proj.menu.blocked': '已在你的黑名单里',
      'proj.search': '搜索项目或渲染者…', 'proj.all': '全部',
      'proj.col.project': '项目', 'proj.col.owner': '发布者', 'proj.col.status': '状态',
      'proj.col.progress': '进度', 'proj.col.device': '设备', 'proj.col.memory': '内存',
      'proj.cpu': 'CPU', 'proj.gpu': 'GPU',
      'proj.status.renderingN': '{n} 帧渲染中', 'proj.status.rendering': '渲染中',
      'proj.status.waiting': '等待中', 'proj.status.paused': '已暂停',
      'proj.empty': '没有匹配的项目', 'proj.showing': '显示 {n} / {total}',
      'list.more': '显示更多', 'list.shown': '已显示 {n} / {total}',
      'mode.toClassic': '切回原版界面',
      // pill 上写**动作**不是状态：写状态读起来像标签不像按钮。
      'mode.classicHint': '切回新界面', 'mode.classicTip': '点这里回到 SheepIt Plus 的现代化界面',
      'mode.enter': '进入新界面', 'mode.enterTip': '这一页没有重制版，点此去新界面的总览',
      /* 已连接的机器 */
      'machines.title': '在线机器', 'machines.count': '共 {n} 台',
      'machines.none': '当前没有连着算力的客户端',
      'machines.open': '查看会话', 'machines.unknown': '未识别机型',
      /* 渲染产出：日期轴 */
      'heat.weekday': '一,三,五', 'heat.tip': '{n} 帧',
      'heat.tipOn': '有渲染', 'heat.tipOff': '没有渲染',
      /* 账户设置 */
      'nav.account': '账户设置',
      'account.title': '账户设置', 'account.sub': '这些表单直接提交到站点自己的接口，和你原来在这个页面上操作是同一件事。',
      'account.tab.sched': '调度与名单',
      'account.tab.sponsor': '捐赠积分', 'account.tab.account': '账户',
      'account.only': '只能管理自己的账户',
      'account.scheduler': '调度设置', 'account.schedulerHint': '决定优先渲染谁的项目：优先级由低到高是 其他用户 < 我的团队 < 我自己。',
      'account.sched.mine': '优先渲染我自己的项目',
      'account.sched.mineHint': '默认开启。如果你的机器较旧，交给调度器挑更轻的帧可能更划算。',
      'account.sched.team': '优先渲染我团队的项目',
      'account.sched.heavy': '重负载项目优先',
      'account.sched.heavyHint': '机器很强（> 200%）时开启，可以减少"下载解压"相对于渲染的占比。',
      'account.priority': '渲染优先级', 'account.priorityHint': '这些发布者的项目会被优先领取。',
      // 自动补全是按**用户名**、不是 ID（source=/user/list_from_term）
      'account.priorityAdd': '输入用户名后回车', 'account.add': '添加', 'account.remove': '移除',
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
      /* 两个黑名单的原文曾经**正好反了**（发布者/渲染者互换），会让人往错的名单拉人：
         renderer = "These users will not render my projects."，owner 是反过来那句。 */
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
      /* 文案要说清：哪一档做了什么、新版未经验证。 */
      'set.exp': '实验性',
      'set.upmode': '上传项目',
      'set.upmodeHint': '三档：关闭（顶栏不出现入口，整条链路不接管）；'
        + '原版（顶栏入口点一下＝新标签页打开站点自己的上传页，我们完全不接管那一页）；'
        + '新版（默认这一档：上传 / 等待 / 设置全部自绘 —— 解析站点的分析结果、自己发提交，不依赖站点的页面结构）。',
      'set.upmode.off': '关闭', 'set.upmode.raw': '原版', 'set.upmode.new': '新版',
      'set.fp.title': '上游指纹',
      'set.fp.one': '{v} · 已核对 {n}/{n}',
      'set.fp.oneNew': '{v} · 还没走过第三步',
      'set.fp.now': '站点资源版本 {v} —— 就是线上 www 仓库的 commit 短 id',
      'set.fp.unknown': '这一页读不到站点资源版本。',
      'set.fp.same': '与本脚本验证过的版本一致：{v}。',
      'set.fp.diff': '站点已经更新：现在是 {now}，本脚本验证过的是 {known} —— 新版上传可能已经对不上；真认不出来时它会明说，并把那一页交回站点自己。',
      'set.fp.enter': '上次进入第三步：{time} · 服务端给了 {n} 个控件，全部搬进新界面。',
      'set.fp.ok': '上次提交前点名：{time} · {n} 个控件全部在位。',
      'set.fp.never': '还没走过第三步，所以没有点名记录。',
      'nav.upload': '上传项目',
      'set.about': '关于', 'set.aboutText':
        'SheepIt Plus 是一个纯前端的界面重制脚本。它读取你本来就能看到的站点页面，用新界面渲染出来；不调用未公开的接口，也不向第三方发送数据。会改动服务器状态的只有三处，都是你自己点下的按钮：账户设置里的提交、机器会话页上的暂停/恢复、以及项目列表里发布者那格的「优先 / 移出」。它们提交的是站点自己的地址，和你原来在那些页面上操作是同一件事。',
      'set.dangerHint': '如需恢复原版界面，用右上角的「切回原版界面」，或在设置里停用本脚本后刷新。',
      'footer.source': '数据来源：站点自身页面 · 未调用私有接口',
      /* 会话页：一台机器的档案 */
      'sess.owner': '属主', 'sess.client': '客户端', 'sess.unknownHost': '未命名主机',
      'sess.on': '运行中', 'sess.off': '已暂停',
      'sess.pausedServer': '服务器端已暂停', 'sess.pausedClient': '客户端已暂停',
      'sess.statusRaw': '站点原文：{raw}',
      // 暂停时说"当前作业"，否则和旁边的「已暂停」徽章自相矛盾。
      'sess.rendering': '正在渲染', 'sess.currentJob': '当前作业', 'sess.frame': '帧',
      'sess.status.enable': '已启用', 'sess.status.disable': '已停用',
      'sess.noId': '地址里没有会话编号', 'sess.parseFailed': '这一页没读到机器信息',
      'sess.kpi.frames': '已渲染帧数', 'sess.kpi.points': '获得积分',
      'sess.kpi.maxTime': '单帧渲染时长上限',
      'sess.kpi.since': '自 {t} 起', 'sess.kpi.perFrame': '每帧约 {n} 分',
      'sess.kpi.powerLink': '各机型算力榜',
      'sess.facts': '机器信息', 'sess.factsSub': '站点报告的原值，未做换算；内部枚举翻成了人话，原文在悬停提示里',
      'sess.never': '从未', 'sess.rawTip': '站点内部值：{raw}',
      'sess.class.verySlow': '极慢档', 'sess.class.slow': '偏慢档', 'sess.class.medium': '中等档',
      'sess.class.fast': '偏快档', 'sess.class.veryFast': '极快档',
      'sess.act.pause': '暂停', 'sess.act.resume': '继续',
      'sess.f.cpu': '处理器',
      'sess.f.power': 'CPU 性能', 'sess.f.powerGpu': 'GPU 性能',
      'sess.f.gpu': '显卡', 'sess.f.vram': '显存',
      'sess.f.driver': '驱动', 'sess.f.computeDevice': '计算设备',
      'sess.f.ramAllowed': '渲染可用内存', 'sess.f.ramAvailable': '物理内存',
      'sess.f.scheduler': '速度档位', 'sess.f.createdAt': '创建时间',
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
      'sess.col.type': '事件', 'sess.col.job': '作业', 'sess.col.start': '开始',
      'sess.col.end': '结束', 'sess.col.span': '时长',
      'sess.projects': '可渲染项目', 'sess.prjSub': '共 {n} 个',
      'sess.prjNone': '当前没有能派给这台机器的项目', 'sess.whyNone': '未给出原因',
      'sess.tl.rendering': '渲染', 'sess.tl.request': '领任务', 'sess.tl.validate': '校验',
      'sess.tl.login': '登录', 'sess.tl.senderror': '发送失败', 'sess.tl.send': '发送',
      'sess.tl.error': '错误',

      /* 三块搬自 /getstarted，但那页本身不接管（见 80-app.js viewForPath）。 */
      'mg.title': '项目管理', 'mg.unknown': '项目',
      'mg.note': '这一页沿用站点自己的控件与动作（只统一了外观与文案）：改计算方式、生成 MP4、删除项目、加管理员，都直接作用在这个项目上。',
      'up.title': '上传项目', 'up.sub': '把 .blend 或 ZIP 交给农场，站点的分析器会先读一遍',
      'up.formTitle': '选择文件',
      'up.estTitle': '渲染用时估算',
      'up.rulesTitle': '交之前先过一遍',
      'up.origin': '这些数字（体积上限、渲染器、图块数、单帧上限）都是站点这次渲染时当场给的，脚本里没有写死任何一个。',
      /* 这句顶掉站点原文（"Max: … before ZIP compression"），必须由我们来说：它和文件框在同一个
         <td> 里，翻译层整块替换会把文件框一起删掉。 */
      /* 上传后的分析等待页 */
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
      'an.doneSechead': '分析完成 —— 接下来只需确认设置',

      /* 新版上传 · 第三步（68-step3.js 自绘那一块用的标签） */
      'up3.vis': '可见性',
      'up3.cpu': '计算方式',

      /* 0.2.0 源码重写 · 第三步（62-chain.js 解析 + 68-step3.js 自绘） */
      'up3x.title': '项目设置',
      'up3x.type': '类型',
      'up3x.frames': '帧范围',
      'up3x.split': '切块',
      'up3x.mEngine': '引擎 {v}',
      'up3x.mBlender': 'Blender {v}',
      'up3x.mRes': '{w}×{h}',
      'up3x.mFps': '{v} fps',
      'up3x.mSamples': '采样 {v}',
      'up3x.mPerPixel': '{v}/像素',
      'up3x.mDenoise': '降噪',
      'up3x.mAdaptive': '自适应采样',
      'up3x.mHeadless': '无头渲染',
      'up3x.mColorMgmt': '自定义色彩管理',
      'up3x.mOutput': '输出「{v}」',
      'up3x.render': '所有成员都可渲染',
      'up3x.renderTip': '默认所有成员都能渲染你的项目；不想开放就别勾。之后在项目管理页还能改，也可以单独指定谁能渲染。',
      'up3x.mp4': '生成 MP4 视频',
      'up3x.mp4Tip': '给项目生成 MP4 视频。对服务器很吃资源，确实需要才勾。',
      'up3x.thumb': '缩略图对所有成员可见',
      'up3x.thumbTip': '默认所有成员都能看到你项目的缩略图；不想公开就别勾。之后在项目管理页还能改。',
      'up3x.forcedTip': '这个开关站点没开放：界面上的样子只是"站点最终会怎么处理"，提交时按站点的规则走（不会照你勾的发）。最终结果：{state}。',
      'up3x.ramAuto': '默认不指定：站点在渲染第一帧时自动探测。项目很吃内存（比如超过 20GB）再手动填。',
      'up3x.ramManual': '手动指定',
      'up3x.picture': '画面设置',
      'up3x.splitFixedTip': '站点分析这个文件后认定它不能切块（EXR 或降噪项目），所以只能整帧渲染 —— 这里没有可选项。',
      'up3x.yes': '是',
      'up3x.no': '否',
      'up3x.cpu': 'CPU',
      'up3x.gpu': 'GPU',
      'up3x.queue': '预计排队第 {v} 位',
      'up3x.total': '项目总数 {n}',
      'up3x.anim': '动画',
      'up3x.single': '单帧',
      'up3x.start': '起始帧',
      'up3x.end': '结束帧',
      'up3x.step': '步长',
      'up3x.frame': '帧',
      'up3x.splitEach': '每帧切成几份',
      /* 管着这两行的硬约束，长在决策行上 —— 以前只在上一步的须知里出现过（记忆桥） */
      'up3x.rule20': '基准机上单帧（或每块）超过 20 分钟就该切块 —— 站点按它那台基准机算。',
      'up3x.ruleTiles': '一次最多 12,000 个分块：8×8 切法下大约到 187 帧就到顶了。',
      'up3x.nTiles': '{n} 份',
      'up3x.fullFrame': '整帧',
      'up3x.ram': '内存占用',
      'up3x.ramTip': '可选。项目很吃内存（比如超过 20GB）时填上，服务器会把帧派给内存够的机器；不填就在渲染第一帧时自动探测。',
      'up3x.ramPh': '单位 MB',
      'up3x.submit': '添加这个文件',
      'up3x.sending': '正在提交…',
      'up3x.done': '已提交，正在跳转…',
      'up3x.multi': '这份存档里有多个 .blend：站点的分析编号在第一次成功提交后就会被删掉，想接着加下一个要重新上传一次。',
      'up3x.rejectedBlend': '站点不给这个文件建表单（缺相机 / 有活动的输出节点 / 分析报错）。',
      'up3x.rejected': '站点没有接受这次提交。',
      'up3x.netFail': '提交没有送到（网络或登录状态）。',
      'up3x.httpFail': '站点回了 HTTP {code}。',
      'up3x.uploadOdd': '上传没有被接受，但站点没给原因。',
      'up3x.analyseOdd': '分析接口回了个看不懂的响应。',
      'up3x.needCompute': '先选一个计算方式（CPU 或 GPU）再提交。',
      'up3x.badFrame': '{name}：帧必须是整数（站点那边收到空值会直接报错）。',
      'up3x.badRange': '{name}：结束帧不能小于起始帧。',
      'up3x.badStep': '{name}：步长至少为 1。',
      'up3x.badRam': '{name}：内存只能填数字（单位 MB）。',
      'up3x.degrade': '这份表单的结构与脚本核对过的上游版本不一样，脚本不认它 —— 这一页不自己画，点下面的按钮交回站点自己的界面（站点的表单与提交照旧可用）。设置里能看到两边的版本号。',
      'up3x.degradeGo': '用站点自己的界面打开这一页',
      /* 0.2.0 源码重写 · 第一步（64-step1.js 自绘的上传页） */
      'up1.pick': '把 .blend / .zip 拖到这里，或',
      'up1.pickBtn': '选择文件',
      'up1.pickSub': '单个文件上限 {size}（ZIP 压缩之前）；Blender 自带的压缩受支持，也推荐用。',
      'up1.anySize': '以站点这次给的上限为准',
      'up1.picked': '已选择 {name}（{size}）',
      'up1.noFile': '先选一个文件。',
      'up1.go': '开始上传',
      'up1.goBusy': '正在上传…',
      'up1.tooBig': '{name} 有 {size}，超过站点这次的 {max} 上限 —— 先用 Blender 自带的压缩，或把项目拆小。',
      'up1.badType': '{name} 不是 .blend 或 .zip，站点不收。',
      'up1.after': '传完之后站点要先读一遍存档（几分钟是正常的），再让你确认项目设置。',
      'up1.uploading': '正在上传 {pct}%',
      'up1.progressNoEta': '已传 {done} / {total}',
      'up1.progress': '已传 {done} / {total} · 约剩 {eta}',
      'up1.sending': '文件传完了，等站点接手…',
      'up1.jumping': '上传完成，正在跳到分析页…',
      'up1.fail': '上传没有被接受，站点没给原因。',
      'up1.gate': '站点这次没有给出上传表单（通常是没有渲染够帧数，或者正在维护）。',
      'up1.estTip': '填这两项、再选一台设备，站点会算出大概花多少积分、切多少块比较合适。',
      'up1.devPh': '处理器或显卡型号（至少 3 个字）',
      'up1.devPick': '先从建议列表里选一台设备 —— 站点认不出自由输入的名字。',
      'up1.time': '单帧渲染时间（分钟）',
      'up1.count': '帧数',
      'up1.estGo': '估算',
      'up1.estimating': '估算中…',
      'up1.estNeed': '渲染时间和帧数都要填正数。',
      'up1.estFail': '站点没有给出估算结果。',
      'up1.cost': '大概要花 {pts} 积分。',
      'up1.tiles': '切块数',
      'up1.perTile': '每块预计用时',
      'up1.noSplit': '不切块',
      'up1.noRules': '站点这一页没给须知清单。',
      /* 站点结构变了：不许沉默 —— 说清 + 给出切档办法 */
      'up.shapeNew': '站点这一版的页面结构变了，新版认不出要用的那几块。',
      'up.shapeHow': '可以到「设置 → 上传项目」切到「原版」，用站点自己的上传页（换档会重新载入这一页）。',
      'up3x.unknown': '站点这一版多了 {n} 个脚本没画过的元素（{list}…）—— 它们会按站点给的默认值提交。',
      'set.fp.unknownEls': '站点多了 {n} 个新控件（{list}…）—— 新版还没跟上，它们会按默认值提交。',

      'why.no-big-archive-download-on-this-computer': '本机没有大存档下载',
      /* user 是**机器主人**，time limit 指他设的单帧上限，不是发布者时限（早先译错过）。 */
      'why.over-user-s-time-limit': '预计超过本机单帧上限',
      'why.renderable': '现在可渲染',
      'why.computer-has-previously-failed-to-render-project': '这台机器之前渲染它失败过',
      'why.requires-gpu': '需要 GPU',
      /* 站点另有 requires-cpu（2026-10-06 实测在这台机器的会话页上有 5 行），之前只有 gpu 那条。 */
      'why.requires-cpu': '需要 CPU',
      /* 带数字，slug 查不到，所以由 50-views.js 的 WHY_RULES 按规则填这两个占位。 */
      'why.notEnoughMemory': '可用内存不足：需要 {need}，现有 {have}',
      'why.project-rate-limited-due-to-lack-of-points': '发布者积分不足被限流',
      'why.project-too-heavy-for-this-computer': '这台机器带不动这个项目',
      'why.cannot-render-due-to-criterionprojectisoverfilesize': '项目文件超出体积上限',
      'why.cannot-render-due-to-criterionprojectnearlyfinish': '项目已接近完成',
      'why.project-is-not-fully-synced-on-all-mirrors': '项目还没同步到所有镜像',
    },
    en: {
      'nav.overview': 'Overview', 'nav.projects': 'Projects', 'nav.ranking': 'Ranking', 'nav.settings': 'Settings',
      'nav.rankingShort': 'Ranking', 'nav.accountShort': 'Account',
      'top.refresh': 'Refresh', 'top.updated': 'Updated',
      'hero.rank': 'Rank', 'hero.team': 'Team', 'hero.joined': 'Joined',
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
      'site.frames': 'Frames remaining', 'site.projects': 'Active projects',
      'site.clients': 'Connected clients', 'site.processing': 'Processing frames',
      'chart.points': 'Points growth',
      'chart.tipPoints': 'points',
      'chart.pointsSub': '{n} samples · {from} → {to} · now {now}',
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
      'proj.title': 'Active projects', 'proj.count': '{n} projects',
      'proj.prio.inList': 'Already in your render priority',
      'proj.menu.open': 'More actions', 'proj.menu.title': 'This publisher\u2026',
      'proj.menu.prio': 'Prioritise their projects', 'proj.menu.unprio': 'Remove from render priority',
      'proj.menu.gift': 'Donate points to them', 'proj.menu.ungift': 'Stop donating to them',
      'proj.menu.block': 'Blacklist (never render their projects)', 'proj.menu.unblock': 'Remove from blacklist',
      'proj.menu.gifted': 'Already in your donation list', 'proj.menu.blocked': 'Already on your blacklist',
      'proj.search': 'Search project or renderer…', 'proj.all': 'All',
      'proj.col.project': 'Project', 'proj.col.owner': 'Owner', 'proj.col.status': 'Status',
      'proj.col.progress': 'Progress', 'proj.col.device': 'Device', 'proj.col.memory': 'Memory',
      'proj.cpu': 'CPU', 'proj.gpu': 'GPU',
      'proj.status.renderingN': '{n} Rendering frames', 'proj.status.rendering': 'Rendering',
      'proj.status.waiting': 'Waiting', 'proj.status.paused': 'Paused',
      'proj.empty': 'No matching projects', 'proj.showing': 'Showing {n} / {total}',
      'list.more': 'Show more', 'list.shown': 'Showing {n} / {total}',
      'mode.toClassic': 'Switch to the original interface',
      'mode.classicHint': 'Back to the new UI', 'mode.classicTip': 'Return to the SheepIt Plus interface',
      'mode.enter': 'Open the new UI', 'mode.enterTip': 'This page has no rebuilt version; open the modern overview instead',
      'machines.title': 'Online machines', 'machines.count': '{n} machines',
      'machines.none': 'No machine is connected right now',
      'machines.open': 'Open session', 'machines.unknown': 'Unknown machine',
      'heat.weekday': 'Mon,Wed,Fri', 'heat.tip': '{n} frames',
      'heat.tipOn': 'Rendered', 'heat.tipOff': 'No rendering',
      'nav.account': 'Account',
      'account.title': 'Account settings', 'account.sub': 'These forms post to the site\u2019s own endpoints \u2014 exactly what the original page does.',
      'account.tab.sched': 'Scheduler & lists',
      'account.tab.sponsor': 'Donating points', 'account.tab.account': 'Account',
      'account.only': 'Your own account only',
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
      'set.exp': 'Experimental',
      'set.upmode': 'Project upload',
      'set.upmodeHint': 'Three settings: Off (no entry in the top bar, the whole chain is left alone); '
        + 'Original (the top-bar entry opens the site\u2019s own upload page in a new tab; this script does not touch that page); '
        + 'New (the default: this script draws upload, wait and settings itself and sends the submit, independent of the site\u2019s page structure).',
      'set.upmode.off': 'Off', 'set.upmode.raw': 'Original', 'set.upmode.new': 'New',
      'set.fp.title': 'Upstream fingerprint',
      'set.fp.one': '{v} \u00b7 {n}/{n} controls checked',
      'set.fp.oneNew': '{v} \u00b7 the third step has not been opened yet',
      'set.fp.now': 'Site asset version {v} \u2014 the commit short id of the live www repository',
      'set.fp.unknown': 'This page does not expose a site asset version.',
      'set.fp.same': 'Same version this script was verified against: {v}.',
      'set.fp.diff': 'The site has moved on: it is now {now}, this script was verified against {known} \u2014 the new upload may no longer match; when it cannot read the page it says so and hands that page back to the site.',
      'set.fp.enter': 'Last time the third step opened: {time} \u00b7 the server rendered {n} controls, all of them moved into the new layout.',
      'set.fp.ok': 'Last pre-submit check: {time} \u00b7 all {n} controls were in place.',
      'set.fp.never': 'The third step has not been opened yet, so there is no pre-submit check on record.',
      'nav.upload': 'Upload a project',
      'set.about': 'About', 'set.aboutText':
        'SheepIt Plus is a pure front-end UI rebuild. It reads the pages you could already see and renders them in a new interface; it calls no undocumented endpoints and sends nothing to a third party. Three things can change server state, all of them buttons you press yourself: the forms in Account settings, pause/resume on a machine\u2019s session page, and the priority toggle on a publisher in the project list. They post to the site\u2019s own endpoints, the same ones those pages use.',
      'set.dangerHint': 'To get the original interface back, use "Switch to the original interface" in the top bar, or disable this script and reload.',
      'footer.source': 'Data source: the site\u2019s own pages · no private endpoints',
      'sess.owner': 'Owner', 'sess.client': 'Client', 'sess.unknownHost': 'Unnamed machine',
      'sess.on': 'Running', 'sess.off': 'Paused',
      'sess.pausedServer': 'Paused server-side', 'sess.pausedClient': 'Paused client-side',
      'sess.statusRaw': 'the site writes: {raw}',
      'sess.rendering': 'Rendering', 'sess.currentJob': 'Current job', 'sess.frame': 'frame',
      'sess.status.enable': 'Enabled', 'sess.status.disable': 'Disabled',
      'sess.noId': 'No session id in the address', 'sess.parseFailed': 'No machine information on this page',
      'sess.kpi.frames': 'Frames rendered', 'sess.kpi.points': 'Points earned',
      'sess.kpi.maxTime': 'Per-frame render time limit',
      'sess.kpi.since': 'since {t}', 'sess.kpi.perFrame': '≈ {n} points per frame',
      'sess.kpi.powerLink': 'Power by machine model',
      'sess.facts': 'Machine', 'sess.factsSub': 'the site\u2019s raw values, unconverted; internal enums are glossed \u2014 hover for the original',
      'sess.never': 'Never', 'sess.rawTip': 'the site calls this {raw}',
      'sess.class.verySlow': 'very slow', 'sess.class.slow': 'slow', 'sess.class.medium': 'medium',
      'sess.class.fast': 'fast', 'sess.class.veryFast': 'very fast',
      'sess.act.pause': 'Pause', 'sess.act.resume': 'Resume',
      'sess.f.cpu': 'Processor',
      'sess.f.power': 'CPU power', 'sess.f.powerGpu': 'GPU power',
      'sess.f.gpu': 'Graphics card', 'sess.f.vram': 'VRAM',
      'sess.f.driver': 'Driver', 'sess.f.computeDevice': 'Compute device',
      'sess.f.ramAllowed': 'RAM allowed for rendering', 'sess.f.ramAvailable': 'RAM installed',
      'sess.f.scheduler': 'Speed class', 'sess.f.createdAt': 'Created',
      'sess.f.lastRequest': 'Last request', 'sess.f.lastRequestJob': 'Last request job',
      'sess.f.lastValidatedJob': 'Last validated job', 'sess.f.ua': 'Runtime',
      'sess.f.renderKey': 'Render key', 'sess.f.action': 'Action',
      'sess.reveal': 'Show', 'sess.hide': 'Hide',
      'sess.control': 'Machine control', 'sess.pause': 'Pause this machine', 'sess.resume': 'Resume rendering',
      'sess.controlHint': 'Posts to the site\u2019s own address \u2014 the very same button the original page has. A paused client stops taking new work; resuming takes effect the next time it connects.',
      'sess.timeline': 'Timeline', 'sess.tlSub': '{n} events · {from} → {to} · your local time',
      'sess.tlSubEmpty': 'the site returned no events', 'sess.tlNone': 'No events recorded for this machine yet',
      'sess.tlFailed': 'Timeline unavailable (the site\u2019s endpoint did not answer) \u2014 machine information is unaffected',
      'sess.act.day': 'Date', 'sess.act.month': 'Month', 'sess.act.render': 'Render time',
      'sess.act.events': 'Events', 'sess.act.jobs': 'Jobs', 'sess.act.failed': 'Failed',
      'sess.act.moreDay': '{n} earlier days are not listed here', 'sess.act.moreMonth': '{n} earlier months are not listed here',
      'sess.logOpen': 'Show the full log ({n} events)', 'sess.logClose': 'Hide the full log',
      'sess.col.type': 'Event', 'sess.col.job': 'Job', 'sess.col.start': 'Start',
      'sess.col.end': 'End', 'sess.col.span': 'Duration',
      'sess.projects': 'Renderable projects', 'sess.prjSub': '{n} projects',
      'sess.prjNone': 'No project can be sent to this machine right now', 'sess.whyNone': 'no reason given',
      'sess.tl.rendering': 'Rendering', 'sess.tl.request': 'Request', 'sess.tl.validate': 'Validate',
      'sess.tl.login': 'Login', 'sess.tl.senderror': 'Send error', 'sess.tl.send': 'Send',
      'sess.tl.error': 'Error',

      'mg.title': 'Project', 'mg.unknown': 'Project',
      'mg.note': 'This page keeps the site\u2019s own controls and actions (only the look and the wording are unified): compute method, MP4, remove and managers all act on this project directly.',
      'up.title': 'Upload a project', 'up.sub': 'Hand the farm a .blend or a ZIP; the site analyses it first',
      'up.formTitle': 'Choose a file',
      'up.estTitle': 'Render time estimator',
      'up.rulesTitle': 'Check before you upload',
      'up.origin': 'Every number below (size limit, renderers, tile count, per-frame limit) is the one the site gave for this request. None of them is written into the script.',
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
      'an.doneSechead': 'Analysis finished \u2014 all that is left is to confirm the settings',
      'up3.vis': 'Visibility',
      'up3.cpu': 'Compute method',
      'up3x.title': 'Project settings',
      'up3x.type': 'Type',
      'up3x.frames': 'Frame range',
      'up3x.split': 'Split',
      'up3x.mEngine': 'Engine {v}',
      'up3x.mBlender': 'Blender {v}',
      'up3x.mRes': '{w}\u00d7{h}',
      'up3x.mFps': '{v} fps',
      'up3x.mSamples': 'Samples {v}',
      'up3x.mPerPixel': '{v}/px',
      'up3x.mDenoise': 'Denoising',
      'up3x.mAdaptive': 'Adaptive sampling',
      'up3x.mHeadless': 'Headless',
      'up3x.mColorMgmt': 'Custom colour management',
      'up3x.mOutput': 'Output \u201c{v}\u201d',
      'up3x.render': 'Renderable by all members',
      'up3x.renderTip': 'By default every member can render your project. Clear this to restrict access; you can change it later on the project page and allow specific members.',
      'up3x.mp4': 'Generate MP4 video',
      'up3x.mp4Tip': 'Generates an MP4 video of the project. It is really resource intensive for the server, so only check it if you need it.',
      'up3x.thumb': 'Thumbnail viewable by all members',
      'up3x.thumbTip': 'By default every member can see a thumbnail of your project. Clear this to restrict access; you can change it later on the project page.',
      'up3x.forcedTip': 'The site does not offer this switch here: what you see is what the site will do, not what will be sent. Final result: {state}.',
      'up3x.ramAuto': 'Not set by default: the site detects the memory need on the first rendered frame. Set it manually only for very heavy projects (over 20GB).',
      'up3x.ramManual': 'Set manually',
      'up3x.picture': 'Image settings',
      'up3x.splitFixedTip': 'The analysis says this file cannot be split (EXR or denoising project), so it is rendered as full frames \u2014 there is nothing to choose here.',
      'up3x.yes': 'yes',
      'up3x.no': 'no',
      'up3x.cpu': 'CPU',
      'up3x.gpu': 'GPU',
      'up3x.queue': 'Est. queue position {v}',
      'up3x.total': 'Total projects {n}',
      'up3x.anim': 'Animation',
      'up3x.single': 'Single frame',
      'up3x.start': 'Start frame',
      'up3x.end': 'End frame',
      'up3x.step': 'Step',
      'up3x.frame': 'Frame',
      'up3x.splitEach': 'Divide each frame into',
      'up3x.rule20': 'If one frame (or tile) takes over 20 minutes on the reference machine, split it \u2014 that is the site\u2019s rule.',
      'up3x.ruleTiles': 'At most 12,000 tiles per submission: with an 8\u00d78 split that is about 187 frames.',
      'up3x.nTiles': '{n} tiles',
      'up3x.fullFrame': 'Full frame',
      'up3x.ram': 'Memory used',
      'up3x.ramTip': 'Optional. If the project needs a lot of RAM (more than 20GB), fill this in so the server can hand the frame to a machine with enough memory. Otherwise it is detected on the first rendered frame.',
      'up3x.ramPh': 'Mbytes',
      'up3x.submit': 'Add this file',
      'up3x.sending': 'Submitting\u2026',
      'up3x.done': 'Submitted, navigating\u2026',
      'up3x.multi': 'This archive holds several .blend files: the site deletes the analysis id after the first **successful** submit, so adding the next one needs a fresh upload.',
      'up3x.rejectedBlend': 'The site does not offer a form for this file (no camera / active output node / analysis error).',
      'up3x.rejected': 'The site did not accept this submission.',
      'up3x.netFail': 'The submission did not go through (network or session).',
      'up3x.httpFail': 'The site answered HTTP {code}.',
      'up3x.uploadOdd': 'The upload was not accepted and the site gave no reason.',
      'up3x.analyseOdd': 'The analysis endpoint answered something unreadable.',
      'up3x.needCompute': 'Pick a compute method (CPU or GPU) before submitting.',
      'up3x.badFrame': '{name}: frames must be integers (the site errors out on an empty value).',
      'up3x.badRange': '{name}: the end frame cannot be lower than the start frame.',
      'up3x.badStep': '{name}: the step must be at least 1.',
      'up3x.badRam': '{name}: memory must be a number (Mbytes).',
      'up3x.degrade': 'This form does not match the upstream version this script was verified against, so the script will not draw it \u2014 the button below hands this page back to the site\u2019s own interface (its form and submit still work). Settings shows both versions.',
      'up3x.degradeGo': 'Open this page in the site\u2019s own interface',
      'up1.pick': 'Drop a .blend / .zip here, or',
      'up1.pickBtn': 'choose a file',
      'up1.pickSub': 'One file, up to {size} (before ZIP compression). Blender\u2019s own compression is supported and recommended.',
      'up1.anySize': 'whatever limit the site gave this time',
      'up1.picked': 'Selected {name} ({size})',
      'up1.noFile': 'Choose a file first.',
      'up1.go': 'Start upload',
      'up1.goBusy': 'Uploading\u2026',
      'up1.tooBig': '{name} is {size}, over the site\u2019s {max} limit right now \u2014 try Blender\u2019s own compression, or split the project.',
      'up1.badType': '{name} is not a .blend or .zip; the site will not take it.',
      'up1.after': 'After the upload the site reads the archive first (a few minutes is normal), then you confirm the project settings.',
      'up1.uploading': 'Uploading {pct}%',
      'up1.progressNoEta': '{done} / {total} sent',
      'up1.progress': '{done} / {total} sent \u00b7 about {eta} left',
      'up1.sending': 'File sent; waiting for the site\u2026',
      'up1.jumping': 'Upload done, going to the analysis page\u2026',
      'up1.fail': 'The upload was not accepted and the site gave no reason.',
      'up1.gate': 'The site did not offer an upload form this time (usually not enough rendered frames, or maintenance).',
      'up1.estTip': 'Give these two numbers and pick a device: the site computes the point cost and a sensible split.',
      'up1.devPh': 'Processor or GPU name (3 characters or more)',
      'up1.devPick': 'Pick a device from the suggestion list \u2014 the site cannot resolve a free-typed name.',
      'up1.time': 'Render time per frame (minutes)',
      'up1.count': 'Frames',
      'up1.estGo': 'Estimate',
      'up1.estimating': 'Estimating\u2026',
      'up1.estNeed': 'Render time and frame count must both be positive numbers.',
      'up1.estFail': 'The site returned no estimate.',
      'up1.cost': 'This will cost you about {pts} points.',
      'up1.tiles': 'Tiles',
      'up1.perTile': 'Expected time per tile',
      'up1.noSplit': 'No split',
      'up1.noRules': 'The site did not list any checks on this page.',
      'up.shapeNew': 'The page structure changed on this version, so New mode cannot find the blocks it needs.',
      'up.shapeHow': 'Switch to \u201cOriginal\u201d under Settings \u2192 Upload to use the site\u2019s own upload page (switching reloads this page).',
      'up3x.unknown': 'This version adds {n} element(s) this script does not draw ({list}\u2026) \u2014 they will be submitted with the site\u2019s defaults.',
      'set.fp.unknownEls': 'The site added {n} new control(s) ({list}\u2026) \u2014 New mode has not caught up, so they go out with their defaults.',
    },
  };

  // 加一门语言 = SP.I18n.register('ja', {...})；en 是基准语言。
  const LANG_LABELS = { zh: '中文', en: 'English' };

  // SITE[code]：{原文:译文} / {整块原文:译文HTML} / [[正则, 替换]]
  const SITE = {};

  const I18n = {
    BASE: 'en',
    lang: 'en',
    pref: 'auto',
    LANGS: DICT,
    SITE,

    register(code, pack) {
      DICT[code] = Object.assign({}, DICT.en, DICT[code] || {}, pack.dict || {});
      SITE[code] = Object.assign({ site: {}, blocks: {}, patterns: [], blockPatterns: [] }, SITE[code] || {}, {
        site: Object.assign({}, (SITE[code] || {}).site, pack.site || {}),
        blocks: Object.assign({}, (SITE[code] || {}).blocks, pack.blocks || {}),
        patterns: [].concat((SITE[code] || {}).patterns || [], pack.patterns || []),
        blockPatterns: [].concat((SITE[code] || {}).blockPatterns || [], pack.blockPatterns || []),
        dateText: pack.dateText || (SITE[code] || {}).dateText,
      });
      if (pack.label) LANG_LABELS[code] = pack.label;
      return code;
    },

    available() {
      return Object.keys(DICT).map((c) => ({ code: c, label: LANG_LABELS[c] || c }));
    },

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

    /** 未命中返回 null = 原文保持原样 */
    siteText(text) {
      if (this.lang === this.BASE) return null;
      const pack = SITE[this.lang];
      if (!pack) return null;
      const hit = pack.site[text];
      if (hit !== undefined) return hit;
      for (const [re, rep] of pack.patterns) if (re.test(text)) return text.replace(re, rep);
      return null;
    },

    /**
     * 语言包可选的日期本地化：站点把日期写成「20th Oct 06:10」或「06:40 Sep 29」两种形状，
     * 语言包用 pack.dateText 提供转换；没有（en 就是这种情况）就原样返回。
     * 只处理这两种形状、认不出的原样返回 —— 站点换格式时界面不会变空。
     */
    date(s) {
      const pack = SITE[this.lang];
      const raw = String(s == null ? '' : s);
      return pack && pack.dateText ? pack.dateText(raw) : raw;
    },

    /** 整块替换：被内联标签切碎的句子；未命中返回 null */
    blockText(text) {
      if (this.lang === this.BASE) return null;
      const pack = SITE[this.lang];
      return pack && pack.blocks[text] !== undefined ? pack.blocks[text] : null;
    },

    canTranslateSite() {
      const pack = SITE[this.lang];
      return this.lang !== this.BASE && !!pack
        && (Object.keys(pack.site).length > 0 || Object.keys(pack.blocks).length > 0
            || pack.patterns.length > 0 || pack.blockPatterns.length > 0);
    },

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

  /* ==== 主题 token ==== */

  // 品牌橙 #e06d58 只用于三处：可操作元素 / 当前选中 / 代表"你"的序列。
  const TOKENS = {
    dark: {
      '--bg': '#0b0d11', '--surface': '#111419', '--surface-2': '#161a21', '--surface-3': '#1c2129',
      '--border': '#22272f', '--border-strong': '#2f3640',
      '--text': '#e8eaed', '--text-2': '#a8b0bb', '--text-3': '#7c8695',
      '--accent': '#e06d58', '--accent-weak': 'rgba(224,109,88,.14)',
      // 白字压在品牌橙上只有 3.2:1（要 4.5:1），故按钮文字改用近黑墨（5.7:1）。
      '--btn-ink': '#0f1218', '--chart': '#e06d58',
      // 热力图五档跟着 --chart 走：写死暗色的橙，亮色主题下会偏粉。
      '--heat-1': 'rgba(224,109,88,.16)', '--heat-2': 'rgba(224,109,88,.34)',
      '--heat-3': 'rgba(224,109,88,.55)', '--heat-4': 'rgba(224,109,88,.78)',
      '--heat-5': 'rgba(224,109,88,1)',
      '--shadow': '0 1px 2px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.28)',
      '--r': '10px', '--r-sm': '6px',
      // DESIGN.md 里一直有 positive，但从来没接进 token 表：用处第一次出现是上传页的"可以传"读数点
      '--positive': '#3fb950',
    },
    light: {
      '--bg': '#fbfbfc', '--surface': '#ffffff', '--surface-2': '#f5f6f8', '--surface-3': '#eceef1',
      '--border': '#e4e6ea', '--border-strong': '#d0d4da',
      '--text': '#14171c', '--text-2': '#4b5462', '--text-3': '#656d79',
      '--accent': '#b6472f', '--accent-weak': 'rgba(182,71,47,.10)',
      // 亮色下品牌橙压深：白字落在 #b6472f 上是 5.3:1。
      '--btn-ink': '#ffffff',
      '--chart': '#b6472f',
      '--heat-1': 'rgba(182,71,47,.16)', '--heat-2': 'rgba(182,71,47,.34)',
      '--heat-3': 'rgba(182,71,47,.55)', '--heat-4': 'rgba(182,71,47,.78)',
      '--heat-5': 'rgba(182,71,47,1)',
      '--shadow': '0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.05)',
      '--r': '10px', '--r-sm': '6px',
      '--positive': '#1a7f37',
    },
  };

  const Theme = {
    pref: 'auto',
    init() {
      this.pref = Util.store.get('theme', 'auto');
      return this.pref;
    },
    set(pref) { Util.store.set('theme', pref); this.pref = pref; },
    /** 拼 token 成 CSS 文本；覆盖块放 media query 之后保证优先级。
     *  scope **不能传选择器列表** —— 生成的 :not 只绑最后一项，#sp 会无条件拿到亮色 token。 */
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
/* ==== 12-lang-zh.js：中文语言包 ====
   site = 短词条精确匹配；blocks = 整块替换（值可含链接）；patterns = 带变量，捕获组回填 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  /* 站点把日期写成「20th Oct 06:10」（项目管理页）或「06:40 Sep 29」（会话页）两种形状，
     照抄进中文句子太刺眼：只本地化这两种。作为 pack.dateText 注册，视图层可以直接用
     I18n.date() 要本地化结果（10-core.js 的 I18n.date）。
     （patterns 的替换值可以是函数——10-core.js 用的是 String.replace(re, rep)。） */
  const MONTH_ZH = { Jan: '1月', Feb: '2月', Mar: '3月', Apr: '4月', May: '5月', Jun: '6月',
    Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月' };
  const monthOf = (mon) => MONTH_ZH[String(mon).slice(0, 3).charAt(0).toUpperCase() + String(mon).slice(1, 3).toLowerCase()];
  const farmDate = (s) => String(s == null ? '' : s)
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}:\d{2})\b/g,
      (m, d, mon, time) => {
        const z = monthOf(mon);
        return z ? z + d + '日 ' + time : m;
      })
    .replace(/\b(\d{1,2}:\d{2})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2})\b/g,
      (m, time, mon, d) => {
        const z = monthOf(mon);
        return z ? z + d + '日 ' + time : m;
      });

  SP.I18n.register('zh', {
    label: '中文',
    dateText: farmDate,

    /* 短词条 */
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
      /* 估算器返回的英文片段落在卡片里，用 DomI18n.translateSubtree() 翻。 */
      'How much your project will cost you': '你的项目会花掉多少积分',
      'How you could split your project': '可以怎么拆分',
      'Your project will cost you up to': '你的项目最多会花掉',
      'Having a very low render time is not necessarily a good thing. Please keep the render time over 1 minute.':
        '渲染时间太短未必是好事 —— 请把单块渲染时间保持在 1 分钟以上。',
      'Number of tiles': '分块数',
      'Expected render time': '预计耗时',
      'No split': '不拆分',

      /* 分析完成后的站点「新增项目」表单：站点把它整块塞进 #sp-an-result，我们只翻文案、
         不动结构（站点 JS 按 id 拼参数）。键必须与站点 DOM 归一化后的文本逐字一致——
         原文快照见 .tmp/upload-test/step3-outer.html。 */
      'Renderable by all members': '所有成员均可渲染',
      'By default every member can render your project. If you want to restrict the access to your project do not check this box. On the project administration page you will be able to modify this setting and add specific members to renderers.':
        '默认每个成员都能渲染你的项目。想限制访问就别勾这一项；之后可以在项目管理页改这个设置，并把指定成员加进渲染者名单。',
      'Generate MP4 video': '生成 MP4 视频',
      'Generates an MP4 video of the projects, it is really resource intensive for the server so only check it if you really need it.':
        '为项目生成一段 MP4 视频。这非常吃服务器资源，确实需要时才勾。',
      'Compute method:': '计算方式：',
      'Denoising detected: Splits (multiple smaller frames with reduced samples) are not supported.':
        '检测到降噪：本项目不支持拆分（把帧切成小块、再降低每块的采样）。',
      'It does not make sense to denoise separate splits and recombine them together.':
        '把拆分后的各块分别降噪、再拼回一起，是没有意义的。',
      'Start frame': '起始帧',
      'End frame': '结束帧',
      'Step': '步长',
      'Advanced options': '高级选项',
      'Memory used': '内存占用',
      'You can specify the memory used your project. If you think your project will take a lot of ram (more than 20GB), please fill the amount. You can find this value on the top right of Blender. It will help the renderfarm, by allowing the server to give a frame to a small configuration. It is an optional attribute, this value will be detected on the first frame rendered.':
        '可以在这里指定项目要用的内存。预计占用很大（超过 20GB）就填上——这个值显示在 Blender 界面右上角。填了能帮农场把帧派给小机器。可选项，不填会在渲染第一帧时自动探测。',
      'Memory used in Mbytes': '内存占用（MB）',
      'Add this blend': '添加这个 blend',

      /* 项目管理页 /project/<数字>：站点把整块服务端渲染好，我们搬进壳里再翻（见 80-app.js 的 wireManageDoc）。
         动作与 id 都不动，这里只翻文案。 */
      'Administration': '项目管理',
      'Summary': '概要', 'Legend': '图例',
      'Finished': '已完成', 'In progress': '进行中', 'Waiting': '等待中',
      'Rendered': '已渲染', 'Processing': '渲染中', 'Failed': '失败', 'Expired': '已过期',
      'Permissions': '权限', 'Renderers': '渲染者', 'Actions': '操作',
      'Managers': '管理员', 'Users': '用户',
      'Compute method': '计算方式',
      'Add a user to manager list': '输入用户名，加入管理员名单',
      'Add': '添加',
      'See frames': '查看帧图像', 'Download frames': '下载帧图像', 'Remove': '删除项目',
      'CPU enabled': 'CPU 已启用', 'CPU disabled': 'CPU 已禁用',
      'GPU enabled': 'GPU 已启用', 'GPU disabled': 'GPU 已禁用',
      /* 站点把这句话拆成 <strong>Caution!</strong> + 文本节点，整句当键永远匹配不上 */
      'Caution!': '注意！',
      'not all the rendering features are supported by GPUs': 'GPU 并不支持站点全部的渲染特性。',
      'You might have different results depending on the rendering technology.': '换一种渲染技术，结果可能有差异。',

      /* 项目管理页：调度器那一段（只在项目「等待中 / 渲染中」时渲染）。
         注意 site 表是**短词条精确匹配**，值放在子 <b> 里的整句要用下面的 patterns。 */
      'Scheduler': '调度器',
      /* 站点在「从没活动过」的机器上印红色小字 never（账户页三行、旧版会话页）。 */
      'never': '从未',
      'How many machines can actually render the project?': '有多少台机器能真正渲染这个项目？',
      'Connected machines:': '已连接机器：',
      'Connected machines for CPU:': 'CPU 已连接机器：',
      'Potential rendering machines:': '潜在渲染机器：',
      'Pause': '暂停',
      'Resume': '继续',

      /* 项目管理页：项目「已渲染」状态下的提示块与动作按钮
         （站点把两句话直接拼在一起，中间**没有空格**，所以带空格的变体也留一份） */
      'Your project has finished rendering, the frames are being packed.The server hosting your project will soon create a zip with your frames.':
        '项目已经渲染完成，正在打包帧文件。托管你项目的服务器很快会生成一个包含所有帧的 zip。',
      'Your project has finished rendering, the frames are being packed. The server hosting your project will soon create a zip with your frames.':
        '项目已经渲染完成，正在打包帧文件。托管你项目的服务器很快会生成一个包含所有帧的 zip。',
      'Generating archive.': '正在打包存档。',
      'More information about SheepIt network on the servers page': '关于 SheepIt 网络的更多信息见「服务器」页面。',

      /* 项目管理页：其它状态（渲染中／暂停／私有／封禁／限速／服务器不可用）
         注意 site 表是短词条精确匹配：被 <strong> 拆开的整句（如 "Your project is <strong>private</strong>, …"）
         site 表盖不住（单词 "private" 又太泛、全站误伤面太大），所以那句走下面的 blockPatterns ——
         patchBlocks 是按**整块 textContent** 匹配的，正则只吃英文前半句、替换值里带 <strong>，
         后半句（另一句，已有 site 词条）原样留着给 patchTextNodes 翻（0.1.18）。 */
      'Rendering': '渲染中',
      'Paused': '已暂停',
      'Current renderers:': '正在渲染的成员：',
      'Resume is disabled because you have too many active projects': '继续已被禁用：你的进行中项目太多',
      'Ask for a partial Archive Frame': '申请部分帧压缩包',
      'Your project has finished rendering, the frames are being packed.': '项目已经渲染完成，正在打包帧文件。',
      'Download video': '下载视频',
      'Statistics about the render': '渲染统计',
      'Note: this is not the final image. It is a thumbnail of the on going render.': '注意：这不是最终画面，而是渲染中的缩略图。',
      'Note: this is not the final video. It is a reduced thumbnail.': '注意：这不是最终视频，而是降质缩略图。',
      "To make it renderable by everyone, check 'Renderable by all members' on the renderers options.": '想让所有人都能渲染，请在渲染者选项里勾选「所有成员均可渲染」。',
      'Your project has been blocked.': '你的项目已被封禁。',
      'Members can not render your project BUT you still can.': '其他成员无法渲染你的项目，但你仍然可以。',
      'Members (including you) can not render your project.': '包括你在内的成员都无法渲染你的项目。',
      'You can remove this limitation by connecting your machine to the farm.': '把你的机器接入农场即可解除这个限制。',
      'As long as you are rendering, your project will be unthrottled.': '只要你在参与渲染，你的项目就不会被限速。',
      'The server hosting your project is currently not available.': '托管你项目的服务器当前不可用。',
      'No download or rendering is possible.': '无法下载，也无法渲染。',
      'Add a user to renderer list': '输入用户名，加入渲染者名单',
      'Add a team to renderer list': '输入团队名，加入渲染者名单',
      'If you are using Eevee, CPU rendering is not available.': '使用 Eevee 时无法使用 CPU 渲染。',
      'MP4 generation disabled': 'MP4 生成已禁用',
    },

    /* 整块替换（值是 HTML，可保留链接）：键 = 翻译前的整块归一化文本，必须与页面拼接结果一致。
       取键：把 translateSite 设为 false 打开页面，控制台跑 DomI18n.reportUnmatched(20)。 */
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

    /* 整块模式规则：段落含动态数字 → 用正则整块替换，捕获组按 $1…$9 回填。 */
    blockPatterns: [
      [/^Max:\s*([\d,]+)\s*MB\s*before ZIP compression\s*Blender compression is recommended and supported\.$/i,
        '上限：$1 MB（ZIP 压缩前）<br>推荐并支持 Blender 压缩。'],

      [/^The render order is based on points\..*?You currently have ([\d,]+) points\.\s*Since you are part of a team who generated ([\d,]+) points some of those will give you an extra boost of ([\d,]+) points\.\s*Predicted position in queue:$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前拥有 $1 积分。由于你所在团队累计产生了 $2 积分，其中一部分会给你带来 $3 积分的额外加成。<br>预计排队位置：'],

      /* 项目是私有的时候那句提醒：站点写成 "Your project is <strong>private</strong>, not every worker…"，
         <strong> 把句子切成三个文本节点、site 表配不上整句 —— 这里整块吃英文前半句、替换值自带 <strong>，
         后面那句（"To make it renderable by everyone…"）有 site 词条，交给 patchTextNodes 翻。 */
      [/^Your project is private, not every worker will be able to participate in your project\./,
        '你的项目是<strong>私有的</strong>，不是所有 worker 都能参与你的项目。'],
    ],

    /* 模式规则（带变量的文案） */
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
      /* 序数：排行榜名次与排队位置（CPU: 1st）共用 */
      [/^(\d+)(st|nd|rd|th)$/i, '第 $1 位'],
      [/^([\d.]+)\s+or higher\.?$/, '$1 或更高。'],
      /* 估算器结果 */
      [/^([\d,]+)\s+points$/, '$1 积分'],
      [/^If you could try to pick a render time of about (\d+) minutes, you can keep a margin of error for the max render time\.$/,
        '如果把单块渲染时间定在 $1 分钟左右，就能给「单帧上限」留出余量。'],
      /* 上传页「排队情况」：站点看有没有团队加成会输出两个变体，上面 blockPatterns 只盖住长的那条 */
      [/^The render order is based on points\. The more points you have, the higher priority you get\. You currently have ([\d,]+) points\.$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前有 $1 积分。'],
      /* 分析完成后第三步表单的排队位置 */
      [/^Est\. queue position:\s*([\d,]+)(st|nd|rd|th)$/i, '预计排队：第 $1 位'],
      /* 项目管理页 /project/<数字> 的概要行（数字每次不同，逐行规则） */
      [/^The project will be done in\s*(.+)$/i, '预计完成：$1'],
      [/^Storage used:\s*(.+)$/i, '已用存储：$1'],
      [/^Real duration of render:\s*(.+)$/i, '实际渲染用时：$1'],
      [/^On reference per frame rendertime:?$/i, '基准机单帧用时：'],
      [/^RAM usage:\s*(.+)$/i, '内存占用：$1'],
      [/^Project will be automatically deleted on\s*(.+)$/i,
        (m, rest) => '项目将于 ' + farmDate(rest) + ' 自动删除'],
      [/^Connected machines:\s*(.+)$/i, '已连接机器：$1'],
      /* 项目管理页：调度器那一段（值常被站点放在子 <b> 里，纯标签的走 site 表） */
      [/^Connected machines for CPU:\s*(.+)$/i, 'CPU 已连接机器：$1'],
      [/^Potential rendering machines:\s*(.+)$/i, '潜在渲染机器：$1'],
      /* 版本号会随站点升级变（Blender 4.5+），带值的写法必须排在纯标签那行之前 */
      [/^Machines who can use ([^:]+):\s*(.+)$/i, '能用 $1 的机器：$2'],
      [/^Machines who can use ([^:]+):\s*$/i, '能用 $1 的机器：'],
      /* 项目管理页：项目「已渲染」时状态块里被 <br> 分行的几行 */
      [/^Current position:\s*(\d+)(st|nd|rd|th)$/i, '当前排位：第 $1 位'],
      [/^Tasks for this project:\s*([\d,]+)$/i, '本项目任务数：$1'],
      [/^Total tasks on Shepherd:\s*([\d,]+)$/i, 'Shepherd 上的任务总数：$1'],
      [/^Cumulated time of render:\s*(.+)$/i, '累计渲染用时：$1'],
      [/^Points spent:\s*([\d,]+) points$/i, '已消耗积分：$1'],
      [/^(\d+)\/([\d,]+) \(remaining (.+)\)$/, '$1/$2（剩余 $3）'],
      /* 齿轮按钮的 title 属性：站点把整段状态 HTML 塞在里面（attr 只查 site + patterns） */
      [/^<strong>Generating archive\.<\/strong>$/, '<strong>正在打包存档。</strong>'],
      [/^<strong>Generating archive\.<\/strong><br>Current position: (\d+)(?:st|nd|rd|th)<br>Tasks for this project: ([\d,]+)<br>Total tasks on Shepherd: ([\d,]+)$/,
        '<strong>正在打包存档。</strong><br>当前排位：第 $1 位<br>本项目任务数：$2<br>Shepherd 上的任务总数：$3'],
      /* 封禁 / 限速（点位不够的账号） */
      [/^Your project has been blocked because '(.+)'\.$/, '你的项目已被封禁，原因：「$1」。'],
      [/^You are currently rated? limited to ([\d,]+) machines? because you have 0 points\.$/i, '你因为 0 积分被限速到 $1 台机器。'],
      /* 帧缩略图的 tooltip：站点把整段 HTML 塞进了 title 属性（frame / cost / rendertime） */
      [/^<center>frame:\s*([^<]+)<br\s*\/?>cost:\s*([^<]*)<br\s*\/?>rendertime:\s*([^<]*)<br\s*\/?><\/center>/i,
        '<center>第 $1 帧<br>积分：$2<br>用时：$3<br></center>'],
      /* 第三步「设置」里站点给每个 .blend 的说明/拒绝理由（68-step3.js 直接把它们当文本渲染，
         走 siteText：先查 site 精确匹配，再走这里）。 */
      [/^No camera in scene, cannot render\.$/, '场景里没有相机，无法渲染。'],
      [/^Since active "output file" nodes result in files being written to arbitrary locations on the renderer's system we do not allow it\.$/, '活动的「输出文件」节点会把文件写到渲染机上的任意位置，所以站点不允许。'],
      [/^We will accept your \.blend if you mute the node\.$/, '把这个节点静音（mute）后就可以重新上传。'],
      [/^EXR output detected$/, '检测到 EXR 输出'],
      [/^Limitation on EXR {2}support:$/, 'EXR 的限制：'],
      [/^Full frame renders only\. No split-layers or checkerboarding\.$/, '只能整帧渲染，不支持拆分图层或棋盘格切块。'],
      [/^Only animations are supported, no single image projects\.$/, '只支持动画项目，不支持单张图片项目。'],
      [/^Maximum image resolution (\d+)x(\d+)y px\.$/, '最大分辨率 $1x$2 像素。'],
      [/^Maximum image file size (.+)B$/, '单张图片最大 $1B。'],
      [/^Use of compression is required \(any of (.+)\)\.$/, '必须使用压缩（$1 之一）。'],
      [/^Denoising detected: Splits \(multiple smaller frames with reduced samples\) are not supported\.$/, '检测到降噪：不支持拆分（把帧切成小块、降低采样再拼回去）。'],
      [/^It does not make sense to denoise separate splits and recombine them together\.$/, '把拆分后的各块分别降噪、再拼回一起没有意义。'],
      [/^Drivers will not work$/i, '驱动器（Driver）不会生效'],
      [/^because scripts are disabled for security reasons\.$/, '出于安全考虑站点禁用了脚本。'],
      [/^Warning, files not found:$/, '警告：这些文件找不到：'],
      [/^You can add project up to ([\d,]+) tiles, this project is over this limit, with your current tile setup you can go up to ([\d,]+) frames\.$/, '项目上限是 $1 块；按现在的切块设置，最多能做 $2 帧。'],
      [/^You can add project up to ([\d,]+) frames, this project is over this limit\.$/, '项目上限是 $1 帧，这个项目超了。'],
    ],
  });
})();

/* ===== src/20-api.js ===== */
/* ==== 20-api.js：抓取 + 解析器（页面 → 结构化数据） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, parse, text } = { Util: SP.Util, parse: SP.Util.parse, text: SP.Util.text };
  const inflight = {};

  /** 同源抓取（带凭据）+ 缓存 + 并发去重 */
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

  /** 会话时间线不在 HTML 里，走站点自己的 AJAX 端点；失败抛错，调用方降级 */
  async function fetchJson(path) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' },
    });
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
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = (await res.text()).trim();
    return txt.length > 400 ? 'OK' : txt;   // 头像接口回的是整页 HTML，按成功算
  }

  /* ------------------------------------------------------------ 内联数组 */

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
   *  没有 th 的状态行是 **server side** / **client side** 两种暂停，不是一回事。 */
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
          /* **server side** 与 **client side** 是两种暂停。早先是 `if (!label) continue`，整行丢掉后
             两种暂停界面上长得一样，且 Status 那格都写 Enable，本地暂停被误报成「运行中」。它是状态
             而非机器规格，故收进 info；认不出的值照样留着（不吞数据）。 */
          const note = text(td);
          if (note) info.note = { value: note, key: 'note', href: '' };
          continue;
        }
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

  function parseProfile(html, userName) {
    const doc = parse(html);

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

    const points = (extractArray(html, 'line_points_timeline') || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    const frames = (extractArray(html, ['line_frames_timeline', 'line_frames_timeline_2']) || [])
      .slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) })).filter((p) => Number.isFinite(p.v));

    let activity = [];
    const anchor = html.indexOf('consecutive-render-heatmap');
    const raw = extractArray(html.slice(Math.max(0, anchor)), ['data'], true);
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

    return { name, avatar, badge, status, stats, points, frames, activity, machines, sessions, derived };
  }

  /** 派生：口径与原站 dl 的 "Consecutive render days" 对齐（不含今天） */
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

    for (const tr of doc.querySelectorAll('tr[data-project_id]')) {
      const tds = [...tr.querySelectorAll('td')];
      const id = tr.getAttribute('data-project_id');
      const name = text(tr.querySelector('.project_link')) || text(tds[0]);

      // 发布者：第一个有文字的 <a> 才是名字（前一个只有 <img> 头像）
      const links = [...tr.querySelectorAll('td a[href*="/user/"]')];
      const ownerAnchor = links.find((a) => text(a)) || null;
      const owner = ownerAnchor ? text(ownerAnchor) : (tds[1]?.getAttribute('data-sort') || '');
      // URL 里的用户名才是稳定的键
      const ownerId = (ownerAnchor && (ownerAnchor.getAttribute('href').match(/\/user\/([^/]+)\//) || [])[1]) || '';
      const avatarImg = tr.querySelector('td .avatar-small img') || tr.querySelector('td img.avatar');
      const ownerAvatar = Util.safePath(avatarImg?.getAttribute('data-src') || avatarImg?.getAttribute('src') || '');

      const status = parseStatus(text(tr.querySelector('.status')) || text(tds[2]));

      // 进度：aria-valuenow 是百分比，分数在 .sr-only 里
      const bar = tr.querySelector('.progress-bar');
      let pct = Number(bar?.getAttribute('aria-valuenow'));
      if (!Number.isFinite(pct)) {
        const w = bar?.getAttribute('style')?.match(/width:\s*([\d.]+)%/);
        pct = w ? Number(w[1]) : 0;
      }
      const frac = text(tr.querySelector('.progressbar-width')).match(/([\d,]+)\s*\/\s*([\d,]+)/);
      const done = frac ? Number(frac[1].replace(/,/g, '')) : null;
      const total = frac ? Number(frac[2].replace(/,/g, '')) : null;

      // 设备：data-sort 是位掩码 CPU=1 / GPU=8（站点 addproject.js 的算法），掩码缺失才回退读 img
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

      // 内存：显示文本保留，同时留 KB 原值供排序（文本是 "1.3 G" 这类字面量）
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

  /** 排行榜：用站点自带的 data-sort 原始数值（排行榜按站点原始值排、不按 "1.3 G" 字面量） */
  function parseRanking(html) {
    const doc = parse(html);
    const rows = [...doc.querySelectorAll('table tr')].filter((tr) => tr.querySelector('td'));
    const out = [];
    for (const tr of rows) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 5) continue;
      const link = tr.querySelector('a[href*="/user/"]');
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
        // URL 里的用户名才是可靠身份（显示名可能与 URL 不同，只有 URL 那个能打开对的人）
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

  /** 账户设置页（/user/<u>/edit）：整页 11 个分区都在 DOM 里（站点用 display 切换），一次抓取够用 */
  function parseAccount(html) {
    const doc = parse(html);

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
    fetchPage, fetchJson, invalidate, cache, post,
    parseProfile, parseHome, parseProjects, parseRanking, parseStatBoxes, detectUser,
    parseAccount, parseMachines, parseSession, parseTimeline,
    extractArray, computeDerived,
  };
})();

/* ===== src/30-style.js ===== */
/* ==== 30-style.js：整份 CSS ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Theme } = SP;

  SP.CSS = `
${Theme.css('#sp')}

/* ==== 骨架 ==== */
#sp{
  position:fixed;inset:0;z-index:2147483000;overflow-y:auto;overflow-x:hidden;
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-size:14px;line-height:1.5;letter-spacing:0;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
#sp *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;line-height:inherit}

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

/* ==== 顶栏 ==== */
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
#sp nav .navshort{display:none}
#sp .top .spacer{flex:1}
#sp .metaline{font-size:12px;color:var(--text-3);white-space:nowrap}
#sp .who{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);min-width:0}
#sp .who .uname{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .who img{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .who .ini{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;font-size:12px;color:var(--text-3);flex:none}

/* nav 默认 flex-shrink:1，窄屏被压到 148px、按钮互相盖住 —— 必须显式 flex:none。 */
@media (max-width:860px){
  #sp .top{gap:12px}
  #sp nav{flex:none}
  #sp .metaline{display:none}
}
@media (max-width:620px){
  #sp .top{gap:8px}
  #sp .brand{font-size:14px}
  #sp .brand .sheep{width:18px;height:18px}
  #sp .brand em{display:none}
  #sp nav{gap:0}
  #sp nav button{padding:6px 7px;font-size:13px}
  #sp nav .navfull{display:none}
  #sp nav .navshort{display:inline}
  /* 头像整个撤掉而不是只藏名字：硬塞会被挤出视口，在右缘留下一条 1px 断边框。 */
  #sp .who{display:none}
}

/* ==== 图标按钮 ==== */
#sp .iconbtn{
  width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  transition:border-color .12s,color .12s;
}
#sp .iconbtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .iconbtn .icon{width:14px;height:14px}
#sp .icon{width:15px;height:15px;flex:none}

/* ==== 按钮 ==== */
#sp .btn{
  display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:8px;font-size:13px;
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  text-decoration:none;transition:border-color .12s,color .12s,background .12s;
}
#sp .btn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .btn.primary:hover{filter:brightness(1.07);color:var(--btn-ink)}
/* 不可用必须看得出来：主色按钮在"还没就绪"时长得和就绪时一模一样，用户点下去只会挨一句责备。
   .up3-submit 早就有这条规则，通用 .btn 一直没有。 */
#sp .btn:disabled{opacity:.5;cursor:not-allowed}
#sp .btn.primary:disabled{filter:none}
#sp .btn.sm{padding:4px 10px;font-size:12px;border-radius:var(--r-sm)}
#sp .btn .icon{width:14px;height:14px}

/* ==== 身份条 ==== */
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

/* ==== 指标带 ==== */
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
/* 格数不是常数：多数账号 4 格，建过项目的 5–6 格（data-n）。
   每折一次都要重算该画哪条内边线，否则折行处多一条竖线、或少一条横线。 */
#sp .kpis[data-n="5"]{grid-template-columns:repeat(5,minmax(0,1fr))}
#sp .kpis[data-n="6"]{grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:1200px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(3n+1),#sp .kpis[data-n="6"] .kpi:nth-child(3n+1){border-left:none}
  #sp .kpis[data-n="5"] .kpi:nth-child(n+4),#sp .kpis[data-n="6"] .kpi:nth-child(n+4){border-top:1px solid var(--border)}
}
/* ≤860 折 2 列：上一档 3n+1 会连第 4 格一起去掉，所以整块重算左边线。 */
@media (max-width:860px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(n),#sp .kpis[data-n="6"] .kpi:nth-child(n){border-left:1px solid var(--border)}
  #sp .kpis[data-n="5"] .kpi:nth-child(odd),#sp .kpis[data-n="6"] .kpi:nth-child(odd){border-left:none}
}

/* ==== 主区 ==== */
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

/* ==== 图表 ==== */
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

/* ==== 产出格 ==== */
/* .tip 是 .heatwrap 的绝对定位子元素：这一格不定位，包含块会一路找到 #sp(fixed)，
   浮层实测落在离格子一千多像素的地方。 */
#sp .heatwrap{display:flex;gap:8px;position:relative}
/* 左列顶部留一个与月份行等高的占位块（.pad），两张网格的行高就自动对齐。 */
#sp .wdcol{display:flex;flex-direction:column;flex:none;font-size:11px;color:var(--text-3)}
#sp .wdcol .pad{height:13px;margin-bottom:6px}
#sp .wd{display:grid;grid-template-rows:repeat(7,minmax(0,1fr));gap:2px;flex:1;line-height:1}
#sp .wd span{align-self:center;white-space:nowrap}
#sp .heatscroll{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
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
  #sp .wdcol{display:none}
}
#sp .legend{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-3);margin-top:14px;flex-wrap:wrap}
#sp .legend i{width:11px;height:11px;border-radius:2.5px;display:block;flex:none}
#sp .legend .spacer{flex:1}
#sp .legend b{color:var(--text-2);font-weight:600}

/* ==== 产出面板与月份条 ==== */
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

/* ==== 全站实时 ==== */
#sp .farm{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;margin-top:16px;box-shadow:var(--shadow);
}
/* 必须用 > 而不是后代选择器：.farm div 会把内边距加到 .k / .row 上，整格撑到 159px。 */
#sp .farm > div{padding:13px 18px;border-left:1px solid var(--border);min-width:0}
#sp .farm > div:first-child{border-left:none}
#sp .farm .k{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
#sp .farm .row{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:7px}
#sp .farm .v{font-size:18px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;line-height:1.1}
/* 走势给一个上限宽度：flex:1 撑满整格，会把线拉成一道 12:1 的划痕。 */
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

/* ==== 表格 ==== */
#sp .tablewrap{overflow-x:auto}
#sp .tbl{width:100%;border-collapse:collapse;font-size:13px}
#sp .tbl th{
  text-align:left;font-size:11.5px;font-weight:500;color:var(--text-3);
  padding:0 14px 10px;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .tbl th.r,#sp .tbl td.r{text-align:right}
/* 数值列收紧到内容宽度：th 和 td 都要 nowrap —— 只给 th 加，列会被压窄换行、单位掉到第二行。 */
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
#sp .pnwrap{display:flex;align-items:center;gap:7px;min-width:0}
#sp .pnwrap .pn{flex:0 1 auto;min-width:0}
#sp .ow{display:flex;align-items:center;gap:8px;color:var(--text-2)}
#sp .ow img{width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ow .ini{
  width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);
  display:grid;place-items:center;font-size:11.5px;color:var(--text-3);flex:none;
}
#sp .ow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .ow a.nm{color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#sp .ow a.nm:hover{color:var(--accent);text-decoration:underline}
#sp .ow em{font-style:normal;color:var(--accent);font-weight:600}
#sp .ow span{min-width:0}
/* .mk 常驻显示：星 = 在渲染优先级名单，心 = 在捐赠名单，禁止符 = 在黑名单。 */
#sp .ow .mk{flex:none;display:inline-flex;margin-left:4px;color:var(--accent)}
#sp .ow .mk .icon{width:13px;height:13px}
#sp .ow .btn{margin-left:6px;flex:none}
#sp .ow .kebab{padding:4px 7px}
#sp .ow .kebab .icon{width:13px;height:13px}
#sp .ow .kebab[aria-expanded="true"]{opacity:1;border-color:var(--border-strong);color:var(--text)}

/* .omenu 挂在 #sp 里而不是表格里：.tablewrap 是 overflow:auto，绝对定位子元素会被它裁掉。 */
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

#sp .omenu .mi .mi-ck{width:15px;height:15px;flex:none;color:var(--accent)}
#sp .omenu .mi .mi-ck .icon{width:15px;height:15px}
@media (hover:hover) and (pointer:fine){
  /* 藏的是 opacity 不是 display：display:none 会把按钮从 Tab 顺序里摘掉；触屏没有 hover，一直显示。 */
  #sp .ow .btn{opacity:0;transition:opacity .12s}
  #sp .tbl tbody tr:hover .ow .btn,#sp .tbl tbody tr:focus-within .ow .btn{opacity:1}
}
/* 分数放自己的列（td.frac）：挂在条子后面，轨道长度会随数字宽度变化、整列参差不齐。 */
#sp .bar{min-width:180px}
#sp .bar .t{position:relative;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .bar .f{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
#sp .tbl td.frac{width:1%;font-size:11.5px;color:var(--text-3)}
#sp .dev{display:inline-flex;gap:4px}
#sp .dev span{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-3)}
#sp .dev span.on{border-color:transparent;background:var(--accent-weak);color:var(--accent);font-weight:600}
/* 状态列在会话页放的是站点给的一整句原因（"Not enough free memory, requiring: …"），
   而 .st 原来既 nowrap 又没有上限 → 整列被最长那句撑到 376px，表格溢出容器出横向滚条
   （实测差 129px）。给个上限 + 省略号，完整原因走 title。 */
#sp .st{font-size:12.5px;color:var(--text-2);white-space:nowrap;display:inline-block;max-width:210px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
#sp .rankcell{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap}
@media (max-width:760px){
  #sp .tbl{min-width:660px}
  #sp .tbl th,#sp .tbl td{padding-left:12px;padding-right:12px}
}

/* ==== 工具条 ==== */
#sp .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
#sp .more{display:flex;justify-content:center;padding:14px 0 6px}
#sp .more .btn{gap:9px}
#sp .more .num{color:var(--text-3);font-size:12px}
#sp .input{
  display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:var(--r-sm);background:var(--surface);
  border:1px solid var(--border);min-width:220px;flex:1;max-width:340px;color:var(--text-3);
}
#sp .input input{flex:1;min-width:0;border:none;background:none;color:var(--text);font-size:13px}
/* 焦点环画在整只控件上，绝不能给 input 写 outline:none —— #sp .input input 优先级高过
   全局的 #sp :focus-visible，会把键盘焦点环整个吃掉；改用 :focus-within 让容器亮起来。 */
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

/* ==== 空状态 ==== */
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

/* ==== 已连接的机器 ==== */
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

/* ==== 顶栏模式开关 ==== */
#sp .modebtn{
  height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;
  border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);
  color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color .12s,color .12s;white-space:nowrap;
}
#sp .modebtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .modebtn .icon{width:13px;height:13px}
@media (max-width:1000px){#sp .modebtn .txt{display:none}#sp .modebtn{padding:0 7px}}

/* ==== 账户设置 ==== */
#sp .acct{max-width:820px}
#sp .acct .panel{padding:0}
#sp .acct .phead{padding:16px 20px 0}
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
/* 状态徽章的墨色：三级墨实测 4.39:1、差 0.11 没到 AA，提到二级墨约 7.4:1。 */
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
/* file input 让 label 当按钮，但绝不能 display:none —— 那会把它从 Tab 顺序里摘掉；改成 1px 透明。 */
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

/* ==== 会话页 ==== */
#sp .sesshead .chip{
  flex:none;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:4px;
  background:var(--surface-3);color:var(--text-2);white-space:nowrap;
}
/* 会话页的状态徽章两者都上色（用户 2026-10-04 拍板，DESIGN.md 里记为一次具名例外）：
   实心说「开着」、浅底说「要你处理」，没破「只用一个色相」—— 靠强度分。 */
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


#sp .tlbar{padding:12px 20px 0}
#sp .tlwrap{padding:12px 6px 6px}
/* 事件表给独立滚动区：表头 sticky 才不跟着滚没，页面高度从 5000px 落回 1800px。 */
#sp .tablewrap.log{max-height:min(58vh,560px);overflow:auto}
#sp .tablewrap.log th{position:sticky;top:0;z-index:1;background:var(--surface)}
#sp .tablewrap.log:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#sp .tbl.dense{font-size:12.5px}
#sp .tbl.dense th{padding:0 14px 8px}
#sp .tbl.dense td{padding:7px 14px}
#sp .tbl.dense .job{color:var(--text-2)}
@media (max-width:720px){#sp .tbl.dense{min-width:560px}}

#sp .now{flex:none;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--accent-weak);color:var(--accent);white-space:nowrap}
#sp .dash{color:var(--text-3)}
#sp .sess .none{padding:4px 0;font-size:13px;color:var(--text-3)}

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

/* ==== 设置 ==== */
#sp .settings{max-width:680px;padding:4px 20px}
/* 必须限定在 .settings 里：.farm .row 也叫 row，不加限定设置页的 padding 会套过去、把一行撑成 56px。 */
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

/* ==== 上传页 / 分析等待页：骨架与控件都是我们自绘的（64-step1.js / 68-step3.js）====
   这一版没有兼容档了：站点那份 HTML 只当数据源，页面上没有搬过来的站点节点。
   下面 .up-body 那几组规则是给它里面的槽位兜底的（自绘控件落在同一个槽位里）。 */

/* 必须 align-items:start 而不是 stretch：估算结果撑高右卡时，stretch 会把左卡一起拉长（用户实报）。 */
#sp .up-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start;margin-top:16px}
#sp .up-col{display:contents}
#sp .up-grid .panel{min-width:0}
#sp .up-rules{grid-column:1 / -1}
@media (max-width:900px){#sp .up-grid{grid-template-columns:minmax(0,1fr)}}
#sp .up .panel{padding:0}
#sp .up-body{padding:14px 20px 18px}
#sp .up-body > :last-child{margin-bottom:0}
#sp .up-src{font-size:12px;color:var(--text-3);line-height:1.65;margin:12px 20px 18px;padding-top:12px;border-top:1px solid var(--border)}

/* 须知那一列：站点原文的 <li> 被原样克隆进我们的 ul.up1-rules（64-step1.js），这里只管排版。
   多栏只对块级容器生效：ul 在别处是 flex 列（见下面 .up-body ul），这里要还原成 block。 */
@media (min-width:820px){
  #sp .up-rules .up-body ul{display:block;columns:2;column-gap:36px}
  #sp .up-rules .up-body ul li{break-inside:avoid;margin-bottom:9px}
}
@media (min-width:1200px){
  #sp .up-rules .up-body ul{columns:3}
}

/* ==== 抹掉原站外观 ==== */
#sp .up-body .w-section,#sp .up-body .w-box,#sp .up-body .container,
#sp .up-body .sign-in-wr,#sp .up-body .blog-post{
  padding:0;margin:0;background:none;border:none;box-shadow:none;border-radius:0;max-width:none;width:auto;
}
#sp .up-body .row{margin:0}
/* 站点那套栅格也要一起抹掉：搬来的「须知」列是 col-md-6，Bootstrap 给它 float:left +
   width:50%，内容只占卡片左半边（实测那列 744px，卡片正文 1488px）。.input-group 同类坑已
   踩三次。（本文件整段 CSS 是一个模板字符串，注释里不能出现反引号。） */
#sp .up-body [class*="col-md-"],#sp .up-body [class*="col-sm-"],
#sp .up-body [class*="col-xs-"],#sp .up-body [class*="col-lg-"]{float:none;width:auto;max-width:none;padding:0;margin:0}
#sp .up-body h4{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--text)}
#sp .up-body p{margin:0 0 14px;font-size:13px;color:var(--text-2);line-height:1.75}
#sp .up-body ul{margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#sp .up-body ul li{position:relative;padding-left:15px;font-size:12.5px;color:var(--text-2);line-height:1.7}
#sp .up-body ul li::before{content:"";position:absolute;left:0;top:.66em;width:4px;height:4px;border-radius:50%;background:var(--text-3)}
#sp .up-body strong{color:var(--text);font-weight:600}
#sp .up-body a{color:var(--accent)}
#sp .up-body #addproject_warning_zero_frame{font-size:13px}

#sp .up-body form table,
#sp .up-body form tbody,
#sp .up-body form tr,
#sp .up-body form td{display:block;width:auto;padding:0}
#sp .up-body form td{text-align:left !important;vertical-align:baseline !important}
#sp .up-body form td:first-child{font-size:12px;color:var(--text-3);margin-bottom:8px}
#sp .up-body form td + td{margin-bottom:16px}
#sp .up-body form td:last-child{margin-bottom:0}
#sp .up-body form br + strong{color:var(--text-2)}


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

/* 站点内联写死了 #EEB0A0 的底色，只能用 !important 压过去 —— 必要的例外。 */
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

/* 这一行用的是 2013 版 Bootstrap 的 .input-group（table-cell + float），没管住时等效宽度
   949px、OK 的右缘超出视口 5px；整行重声明成普通 flex 并给输入封顶。 */
#sp .up-body input[type=text],#sp .up-body input.form-control{
  font:inherit;font-size:13px;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface-2);border:1px solid var(--border);color:var(--text);
}
#sp .up-body table input[type=text]{width:92px}
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
/* 站点返回的结果表带 Bootstrap 的 .table，在深色卡片里白底白字（用户实报），整段按我们的表格重画。 */
#sp .up-body #addproject_estimator_result table{
  width:100%;border-collapse:collapse;background:none;color:var(--text-2);font-size:12.5px;margin:0;
  border:none !important;   /* .table-bordered 表格本身也画了一圈边框 */
}
#sp .up-body #addproject_estimator_result thead th,
#sp .up-body #addproject_estimator_result th{
  background:none;color:var(--text-3);font-weight:600;font-size:11.5px;
  text-align:left;padding:0 14px 8px 0;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .up-body #addproject_estimator_result td{
  background:none;padding:9px 14px 9px 0;border-bottom:1px solid var(--border);
  color:var(--text-2);vertical-align:baseline;
}
#sp .up-body #addproject_estimator_result tr:last-child td{border-bottom:none}
#sp .up-body #addproject_estimator_result td:last-child,
#sp .up-body #addproject_estimator_result th:last-child{padding-right:0}
#sp .up-body #addproject_estimator_result strong,#sp .up-body #addproject_estimator_result b{color:var(--text);font-weight:600}
#sp .up-body #addproject_estimator_result .num,#sp .up-body #addproject_estimator_result td strong{
  font-variant-numeric:tabular-nums;
}
#sp .up-body #addproject_estimator_result h4{margin:16px 0 8px;font-size:13px;font-weight:600;color:var(--text)}
#sp .up-body #addproject_estimator_result h4:first-of-type{margin-top:2px}
#sp .up-body #addproject_estimator_result > br:first-child{display:none}
/* 站点给耗时套了 Bootstrap 绿色小标签。调色板里没有绿色，2026-10-04 用户确认保持中性、
   不恢复红 / 绿语义，别再翻回去。 */
#sp .up-body #addproject_estimator_result .label{
  background:none !important;border:none !important;color:var(--text) !important;
  font-size:12.5px !important;font-weight:600;padding:0 !important;
  text-shadow:none;border-radius:0;
}
/* 只要一条下边发丝线；Bootstrap 的 .table-bordered 是四边框，整段拆掉 */
#sp .up-body #addproject_estimator_result .table-bordered > thead > tr > th,
#sp .up-body #addproject_estimator_result .table-bordered > tbody > tr > td{
  border:none;border-bottom:1px solid var(--border);
}
/* 斑马纹画在 <tr> 上（奇数行 #f9f9f9），只清 td 的底色是盖不住的 */
#sp .up-body #addproject_estimator_result tbody tr{background-color:transparent !important}
/* 站点给这些单元格写了内联的 text-align:center，只能用 !important 压过去（同类例外） */
#sp .up-body #addproject_estimator_result th,
#sp .up-body #addproject_estimator_result td{text-align:left !important}

/* ==== 分析等待页 ==== */
#sp .an-card{padding:0}
#sp .an-head{display:flex;gap:15px;align-items:flex-start;padding:24px 20px 0}
#sp .an-head .spin{flex:none;margin-top:2px}
#sp .an-state{font-size:15px;font-weight:600;color:var(--text)}
#sp .an-sub{font-size:12.5px;color:var(--text-3);line-height:1.75;margin-top:7px;max-width:640px}
#sp .an-track{height:6px;margin:18px 20px 0;border-radius:3px;background:var(--surface-2);overflow:hidden}
#sp .an-track i{display:block;height:100%;width:0;background:var(--accent);border-radius:3px;transition:width .35s ease}
#sp .an-track.indet i{width:32%;animation:sp-indet 1.15s ease-in-out infinite}
@keyframes sp-indet{from{margin-left:-32%}to{margin-left:100%}}
/* 分析完成那张卡片：结果直接接在状态行下面 —— 「新版」自绘进 #sp-an-result（即 .sp-up3，自带内边距）；
   认不出来时那里放的是一句明说 + 一个「交回站点自己界面」的按钮（见 80-app.js 的 handBackToSite）。 */

/* ---- 控件皮肤：全自绘（0.1.18 起；0.2.0 只有 .sp-up3 这一套）------------------------
   勾选框、单选框、输入框、下拉箭头一律 appearance:none + 我们自己的画法，颜色走主题变量 ⇒
   暗色、亮色自动跟随。作用域只剩 #sp .sp-up3：兼容档（把站点表单搬进卡片）已砍掉，
   站点那些控件不再出现在我们的壳里。 */
#sp .sp-up3 input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=file]):not([type=range]),
#sp .sp-up3 select{
  font:inherit;font-size:13px;line-height:1.4;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface);border:1px solid var(--border);color:var(--text);max-width:100%;
  appearance:none;-webkit-appearance:none;
}
#sp .sp-up3 select{
  padding-right:30px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.4l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 9px center;background-size:11px 11px;
}
#sp .sp-up3 input:not([type=checkbox]):not([type=radio]):hover,
#sp .sp-up3 select:hover{border-color:var(--border-strong)}
#sp .sp-up3 input:not([type=checkbox]):not([type=radio]):focus,
#sp .sp-up3 select:focus{border-color:var(--accent)}
#sp .sp-up3 input:disabled,
#sp .sp-up3 select:disabled{background:var(--surface-2);color:var(--text-3);cursor:not-allowed}
#sp .sp-up3 input::placeholder{color:var(--text-3)}

#sp .sp-up3 input[type=checkbox]{
  appearance:none;-webkit-appearance:none;width:16px;height:16px;flex:0 0 auto;margin:1px 7px 0 0;
  border:1.5px solid var(--border-strong);border-radius:5px;background:var(--surface);cursor:pointer;
  transition:background .12s,border-color .12s;
}
#sp .sp-up3 input[type=checkbox]:hover{border-color:var(--accent)}
#sp .sp-up3 input[type=checkbox]:checked{
  border-color:var(--accent);
  background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.4l3 3 6-6.4' fill='none' stroke='%23fff' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/13px 13px no-repeat;
}
#sp .sp-up3 input[type=radio]{
  appearance:none;-webkit-appearance:none;width:15px;height:15px;flex:0 0 auto;margin:1px 7px 0 0;
  border:1.5px solid var(--border-strong);border-radius:50%;background:var(--surface);cursor:pointer;
  transition:border-color .12s,border-width .12s;
}
#sp .sp-up3 input[type=radio]:hover{border-color:var(--accent)}
#sp .sp-up3 input[type=radio]:checked{border:4.5px solid var(--accent)}
#sp .sp-up3 input[type=checkbox]:disabled,
#sp .sp-up3 input[type=radio]:disabled{opacity:.45;cursor:not-allowed}

/* ==== 新版上传 · 第三步的容器（68-step3.js 自绘那一块）====
   2026-10-07 用户拍板砍掉兼容档之后，这一版不再有"把站点表单搬进来重排"那条路：只服务它的
   那一整组 up3-* 规则（面板、隐藏项、图标、提示行、提交行的壳）连同类名一起删了 ——
   清单见 docs/REWRITE-0.2.0.md 的第 8 节。这里只留自绘那一套要用的。 */
#sp .sp-up3{padding:18px 20px 20px;border-top:1px solid var(--border)}

/* ==== 新版上传 · 第一步（0.2.0 起是 64-step1.js **自绘**的那一块）====
   拖放区、进度、估算器、须知：页面上没有一个站点节点，站点那份 /getstarted 只当数据源。 */
#sp .up1-drop{border:1px dashed var(--border-strong);border-radius:var(--r);padding:20px 16px;text-align:center;
  cursor:pointer;transition:border-color .12s,background .12s}
#sp .up1-drop:hover,#sp .up1-drop.over{border-color:var(--accent);background:var(--surface-2)}
#sp .up1-droptitle{font-size:13px;color:var(--text)}
#sp .up1-dropsub{margin-top:6px;font-size:12px;color:var(--text-3);line-height:1.7}
/* 上传页的文件框：槽位里本来就有一条 #sp .up-body input[type=file]{display:block;…}（见上）。
   我们的框在同一个槽位里，所以用更高特异性把它按回"1px 透明"，外观交给 label.filepick。 */
#sp .up-body .up1-drop input[type=file]{
  position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;padding:0;margin:0;border:none;background:none;
}
/* 文件名现在长在虚线框里，是这一屏的主要反馈对象：用正文墨，别再压成三级墨 */
#sp .up1-name{margin-top:10px;font-size:12.5px;color:var(--text)}
#sp .up1-bar{margin-top:12px;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden}
#sp .up1-bar i{display:block;height:100%;width:0;background:var(--accent);border-radius:3px;transition:width .25s ease}
#sp .up1-pct{margin-top:6px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}
#sp .up1-msg{margin-top:12px;padding:9px 12px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface-2);font-size:12.5px;color:var(--text-2);line-height:1.7}
#sp .up1-msg.bad{border-color:var(--accent);color:var(--accent)}
/* 投递前的预期管理：紧跟在文件框下面，不藏在下一个页面 */
#sp .up1-after{margin-top:10px;font-size:12px;color:var(--text-3);line-height:1.65}
#sp .up1-foot{margin-top:14px;display:flex;justify-content:flex-end;gap:10px}
#sp .up1-tip{font-size:12px;color:var(--text-3);line-height:1.65;margin:0 0 10px}
#sp .up1-dev{position:relative}
#sp .up1-devin{display:block;width:100%}
#sp .up1-sug{position:absolute;z-index:6;left:0;right:0;top:100%;margin-top:4px;max-height:230px;overflow:auto;
  background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--r-sm);box-shadow:var(--shadow)}
#sp .up1-sugitem{padding:7px 10px;font-size:12.5px;color:var(--text-2);cursor:pointer}
#sp .up1-sugitem:hover{background:var(--surface-2);color:var(--text)}
#sp .up1-estfields{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}
#sp .up1-fld{flex:1 1 140px;min-width:0}
#sp .up1-fld > label{display:block;margin:0 0 5px;font-size:12.5px;color:var(--text-2)}
#sp .up1-fld > input{width:100%}
#sp .up1-estout{margin-top:14px}
#sp .up1-cost{font-size:13px;color:var(--text);line-height:1.7}
#sp .up1-cost b{color:var(--accent);font-weight:600}
#sp .up1-tbl{margin-top:10px}
#sp .up1-tbl td.bad{color:var(--accent)}
/* 站点的推荐行（label-success → 我们记成 .ok）以前没有任何样式：估算器全部的产出
   "推荐这么切" 与普通行长得一模一样，等于白算。 */
#sp .up1-tbl td.ok{color:var(--accent);font-weight:600}
#sp .up1-tbl tr:has(td.ok) td{background:var(--accent-weak)}
#sp .up1-rules{margin:0;padding-left:18px;font-size:12.5px;color:var(--text-2);line-height:1.8}
#sp .up1-rules li + li{margin-top:6px}
/* 站内自绘的文本输入框（以前只有站点控件，没有通用样式） */
#sp .up1-devin,#sp .up1-fld > input{
  font:inherit;font-size:13px;line-height:1.4;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface);border:1px solid var(--border);color:var(--text);max-width:100%;
}
#sp .up1-devin:hover,#sp .up1-fld > input:hover{border-color:var(--border-strong)}
#sp .up1-devin:focus,#sp .up1-fld > input:focus{border-color:var(--accent);outline:none}
#sp .up1-devin::placeholder,#sp .up1-fld > input::placeholder{color:var(--text-3)}

/* 设置面板里的「上游指纹」小卡（68-step3.js 的 fpRows 画） */
#sp .fp{margin:14px 0 0;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2)}
#sp .fp .lbl2{font-size:12px;font-weight:600;color:var(--text-2);margin:0 0 8px}
#sp .fp .hint{margin:0 0 6px}
#sp .fp .hint:last-child{margin-bottom:0}
#sp .hint.bad{color:var(--accent)}

/* 项目管理页 /project/<数字>：站点那一整块（.w-section，含 #jobs_of_a_project 与右侧图例/页签）由
   80-app.js 的 wireManageDoc **搬**进 #sp-mg-host。结构、id、内联 onclick 全没动，这里只把它从原站
   的深色底改成我们的卡片外观；两列仍用站点自己的 bootstrap 栅格（那套 CSS 本来就在这一页里加载）。 */
#sp .sp-manage{padding:18px 20px 20px;color:var(--text-2)}
#sp .sp-manage .w-section,#sp .sp-manage .container,#sp .sp-manage .w-box,
#sp .sp-manage .padding-15,#sp .sp-manage [class*="col-md-"]{padding:0;margin:0;background:none;border:none;box-shadow:none;max-width:none}
/* 别改 .row 的布局方式：站点用 bootstrap 的 float 栅格，8/4 栏加起来正好 100%，
   一旦给 .row 加 display:flex + gap，多出来的 gap 会把右栏挤到下一行（实测两栏会竖着叠）。 */
#sp .sp-manage .row{margin:0}
#sp .sp-manage .row::after{content:'';display:block;clear:both}
#sp .sp-manage h2{margin:0 0 8px;font-size:14.5px;font-weight:600;color:var(--text)}
#sp .sp-manage h4{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text)}
#sp .sp-manage a{color:var(--accent);text-decoration:none}
#sp .sp-manage a:hover{text-decoration:underline}
#sp .sp-manage ul{padding:0;margin:0;list-style:none}
#sp .sp-manage .meta-list{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 0}
#sp .sp-manage li{font-size:12.5px;color:var(--text-3);line-height:1.95}
#sp .sp-manage .meta-list li[class^="msg_"]{font-weight:600;color:var(--text-2)}
#sp .sp-manage .breadcrumb{display:none}
/* 站点那几个方块本来就是「卡片」：它们的底色/边框被上面统一掉了，这里按我们的样式还回来，
   免得整页糊成一片（Summary 与项目卡是 .w-box，右栏图例/页签是 .widget）。 */
#sp .sp-manage .w-box,#sp .sp-manage .widget{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:14px}
#sp .sp-manage .widget-heading{margin:0 0 10px}
/* 图例：站点用三个 .square 当色块，色是 bootstrap 的 btn-neutral/warning/default */
#sp .sp-manage .legend{display:flex;gap:16px;flex-wrap:wrap}
#sp .sp-manage .legend a{display:flex;align-items:center;gap:7px;color:var(--text-2);font-size:12.5px;text-decoration:none}
#sp .sp-manage .legend i{display:none}
#sp .sp-manage .legend .square{width:14px !important;height:14px !important;margin:0 !important;border-radius:3px;border:none}
#sp .sp-manage .legend .btn-neutral{background:var(--text-3)}
#sp .sp-manage .legend .btn-warning{background:#e0a13a}
#sp .sp-manage .legend .btn-default{background:var(--surface-3);border:1px solid var(--border-strong)}
#sp .sp-manage div[style*="color:red"]{color:var(--accent) !important}
#sp .sp-manage .nav-tabs{display:flex;gap:4px;margin:16px 0 12px;border-bottom:1px solid var(--border)}
#sp .sp-manage .nav-tabs > li{margin:0}
#sp .sp-manage .nav-tabs > li > a{display:block;padding:7px 12px;font-size:12.5px;border:1px solid transparent;border-bottom:none;border-radius:var(--r-sm) var(--r-sm) 0 0;text-decoration:none;color:var(--text-2)}
#sp .sp-manage .nav-tabs > li > a:hover{text-decoration:none;color:var(--text)}
#sp .sp-manage .nav-tabs > li.active > a{background:var(--surface-2);border-color:var(--border);color:var(--text)}
#sp .sp-manage .btn:not(.square){font:inherit;font-size:12.5px;padding:7px 12px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);cursor:pointer;box-shadow:none;text-shadow:none;text-decoration:none}
#sp .sp-manage .btn:not(.square):hover{border-color:var(--border-strong);color:var(--text);text-decoration:none}
#sp .sp-manage .btn-primary:not(.square){background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .sp-manage .btn:not(.square).btn-danger{color:var(--accent);border-color:var(--accent-weak)}
#sp .sp-manage .btn-round i{display:none}   /* 图标是 FA4 类名、站点只装了 FA6：::before 根本没内容，留着就是空心圆 */
/* 站点把 .btn-round 钉成 34×34 的圆（配一个根本画不出来的图标），字写进去就被裁掉 */
#sp .sp-manage .btn-round{width:auto !important;height:auto !important;border-radius:var(--r-sm) !important;padding:6px 10px !important}
/* 站点给 .btn.square 上了 !important 的 16×16：帧缩略图与图例色块必须跟着用 !important 才拨得动 */
#sp .sp-manage .square{display:inline-block;width:22px !important;height:22px !important;margin:0 6px 0 0 !important;padding:0 !important;border-radius:4px;border:1px solid var(--border);vertical-align:middle;text-align:center;overflow:hidden}
#sp .sp-manage .square img{display:block;width:100% !important;height:100% !important;object-fit:cover;border-radius:3px}
#sp .sp-manage input[type=text],#sp .sp-manage input.form-control{font:inherit;font-size:12.5px;padding:7px 9px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text);max-width:100%}
#sp .sp-manage input[type=text]::placeholder{color:var(--text-3)}
#sp .sp-manage input[type=checkbox],#sp .sp-manage input[type=radio]{accent-color:var(--accent);margin-right:7px;vertical-align:middle}
#sp .sp-manage label{font-size:12.5px;color:var(--text-2);margin:0}
#sp .sp-manage .form-inline,#sp .sp-manage .checkbox{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#sp .sp-manage .tiles{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#sp .sp-manage .tiles .square{width:80px !important;height:60px !important;margin:0 !important}
/* 站点给 .tab-content 铺了白底 + 边框，在暗色主题下是一块亮斑 */
#sp .sp-manage .tab-content{background:none;border:none;padding:0;box-shadow:none}
#sp .sp-manage .tab-pane{padding:0}
#sp .sp-manage .tab-pane img{display:inline-block;vertical-align:middle;height:16px;margin:0 3px}
#sp .sp-manage .tab-pane input[type=radio]{margin:0 2px 0 10px}
#sp .sp-manage .text-right{text-align:right}
#sp .sp-manage .sp-mg-badge{font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;background:var(--accent-weak);color:var(--accent)}

/* 只有换视图（或刷新）才播：筛选 / 排序 / 显示更多的 render() 不再重放，否则实时状态带
   重新淡入，看起来像整页在重载。开关是 #sp 的 .sp-anim。 */
@keyframes sp-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  #sp .chart .area{animation:sp-rise .7s cubic-bezier(.16,1,.3,1) .15s both}
  #sp.sp-anim .kpis,#sp.sp-anim .grid,#sp.sp-anim .farm{animation:sp-rise .5s cubic-bezier(.16,1,.3,1) both}
  #sp.sp-anim .grid{animation-delay:.06s}
  #sp.sp-anim .farm{animation-delay:.1s}
}

/* ==== 新版上传 · 第三步（0.2.0 起是 68-step3.js **自绘**的那一块）====
   这一块里没有一个站点节点：控件、id、提交全是我们自己的。服务端只认 POST 键，
   所以自绘不违反契约。版式按站内那套来（标题 13.5 / 正文 13 / 次要 12.5 / 提示 12）：
   上半 = 硬件需求（一个块三行），下半 = 画面设置（每个 .blend 一块，块间只隔发丝线）。 */
/* hidden 属性必须真的隐藏：作者样式里的 display:flex 会压过 UA 的 [hidden]{display:none}（实测踩过：
   折叠的内存框、未选中的"帧范围"那一行都还在显示） */
#sp .sp-up3 [hidden]{display:none !important}
/* 硬件需求：一个块，三行，行间发丝线 */
#sp .sp-up3 .up3-group{border:1px solid var(--border);border-radius:var(--r);background:var(--surface-2);overflow:hidden}
#sp .sp-up3 .up3-line{display:flex;gap:14px;padding:11px 14px;align-items:flex-start}
#sp .sp-up3 .up3-line + .up3-line{border-top:1px solid var(--border)}
#sp .sp-up3 .up3-k{flex:0 0 68px;font-size:12.5px;color:var(--text-3);padding-top:1px}
#sp .sp-up3 .up3-c{flex:1 1 auto;min-width:0}
#sp .sp-up3 .up3-tip{font-size:12px;color:var(--text-3);line-height:1.65}
#sp .sp-up3 .up3-tiprow{flex:1 1 100%;margin-top:2px}
#sp .sp-up3 .up3-opts{display:flex;flex-wrap:wrap;gap:8px 18px}
#sp .sp-up3 .up3-opt{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text);cursor:pointer;margin:0}
#sp .sp-up3 .up3-opt input{margin:0}
#sp .sp-up3 .up3-opt[title]{cursor:help}
#sp .sp-up3 .up3-opt[title] > span{border-bottom:1px dotted var(--border-strong)}
#sp .sp-up3 .up3-cmps{display:flex;flex-wrap:wrap;gap:8px 22px}
#sp .sp-up3 .up3-cmpbox{flex:0 1 auto}
#sp .sp-up3 .up3-cmp{font-weight:600}
#sp .sp-up3 .up3-rams{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
#sp .sp-up3 .up3-ramck{margin:0}
#sp .sp-up3 .up3-ramck > span{border-bottom:1px dotted var(--border-strong)}
#sp .sp-up3 .up3-ramfields{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:2px}
#sp .sp-up3 .up3-ram{display:flex;align-items:center;gap:6px}
#sp .sp-up3 .up3-ram > label{font-size:12.5px;color:var(--text-2);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .sp-up3 .up3-ram > input{width:130px}
/* 画面设置：小标题 + 每个文件一块（只有一条上边线，不套框） */
#sp .sp-up3 .up3-subhead{margin:20px 0 0;font-size:12.5px;color:var(--text-3);letter-spacing:.03em}
#sp .sp-up3 .up3-blend{margin-top:10px;padding-top:14px;border-top:1px solid var(--border)}
#sp .sp-up3 .up3-bhead h4{margin:0;font-size:14px;font-weight:600;color:var(--text)}
#sp .sp-up3 .up3-bmeta{margin-top:3px;font-size:12px;color:var(--text-3);line-height:1.7}
#sp .sp-up3 .up3-frames .up3-fields + .up3-fields{margin-top:10px}
#sp .sp-up3 .up3-fields{display:flex;flex-wrap:wrap;gap:12px}
#sp .sp-up3 .up3-fld{flex:1 1 118px;min-width:0}
#sp .sp-up3 .up3-fld > label{display:block;margin:0 0 5px;font-size:12.5px;color:var(--text-2)}
#sp .sp-up3 .up3-fld > input,#sp .sp-up3 .up3-fld > select{width:100%}
/* 切块：三种形态都摆成"名字: 值" */
#sp .sp-up3 .up3-split{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
#sp .sp-up3 .up3-split > select{min-width:150px;width:auto}
#sp .sp-up3 .up3-static{display:inline-block;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface);font-size:13px;color:var(--text-2);cursor:help}
#sp .sp-up3 .up3-slider{display:flex;flex-wrap:wrap;align-items:center;gap:10px;flex:1 1 auto}
#sp .sp-up3 .up3-slider > label{font-size:12.5px;color:var(--text-2);flex:0 0 auto}
#sp .sp-up3 .up3-read{font-size:12.5px;color:var(--accent);font-variant-numeric:tabular-nums}
/* 切块这一行为什么没得选：理由长在这一行上，主题色 + 警示图标，别让人看漏 */
#sp .sp-up3 .up3-why{display:flex;align-items:flex-start;gap:6px;flex:1 1 100%;margin-top:4px;
  font-size:12.5px;color:var(--accent);line-height:1.7}
#sp .sp-up3 .up3-whyico{flex:none;display:block;margin-top:2px}
#sp .sp-up3 .up3-whyico .icon{width:13px;height:13px}
/* 其余说明（EXR 清单、缺文件、驱动警告…）：与 .up3-slot / .up3-msg 同一套消息块 */
#sp .sp-up3 .up3-notes{margin-top:12px;padding:9px 12px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface-2);font-size:12.5px;color:var(--text-2);line-height:1.75}
#sp .sp-up3 .up3-notes > div + div{margin-top:3px}
#sp .sp-up3 .up3-notes.up3-bad{border-color:var(--accent);color:var(--accent)}
#sp .sp-up3 .up3-bfoot{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:flex-end;gap:12px;margin-top:14px}
#sp .sp-up3 .up3-slot{margin-top:12px;padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--border);
  background:var(--surface-2);font-size:12.5px;color:var(--text-2);line-height:1.7}
#sp .sp-up3 .up3-slot.up3-bad{border-color:var(--accent);color:var(--accent)}
#sp .sp-up3 .up3-msg{margin:14px 0 0;padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--border);
  background:var(--surface-2);color:var(--text-2);font-size:12.5px;line-height:1.75}
#sp .sp-up3 .up3-msg.bad{border-color:var(--accent);color:var(--accent)}
#sp .sp-up3 button.up3-submit{
  font:inherit;font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--r-sm);
  background:var(--accent);border:1px solid var(--accent);color:var(--btn-ink);cursor:pointer;
}
#sp .sp-up3 button.up3-submit:disabled{opacity:.5;cursor:progress}
/* 滑条：原生画法各浏览器差异太大，自绘一条轨道 + 一个圆点（亮暗主题都走变量） */
#sp .sp-up3 input[type=range]{
  appearance:none;-webkit-appearance:none;flex:1 1 200px;max-width:320px;height:18px;
  background:transparent;cursor:pointer;padding:0;border:none;margin:0;
}
#sp .sp-up3 input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--border-strong)}
#sp .sp-up3 input[type=range]::-webkit-slider-thumb{
  appearance:none;-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;
  background:var(--accent);border:2px solid var(--surface);
}
#sp .sp-up3 input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--border-strong)}
#sp .sp-up3 input[type=range]::-moz-range-thumb{width:12px;height:12px;border:2px solid var(--surface);border-radius:50%;background:var(--accent)}
#sp .sp-up3 input[type=submit]{padding:9px 18px;width:auto;float:none}
/* 站点自己的错误框：正常情况下我们接住内容、换成自己的话，它保持空；万一脚本没接住，它仍能显示原文 */
#sp .sp-up3 [id^="addproject_error_box_"]{font-size:12.5px;color:var(--accent);margin:0 0 10px}
#sp .sp-up3 [id^="addproject_error_box_"]:empty{display:none}

/* 设置面板里的「上游指纹」小卡（68-step3.js 的 fpRows 画） */
#sp .fp{margin:14px 0 0;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2)}
#sp .fp .lbl2{font-size:12px;font-weight:600;color:var(--text-2);margin:0 0 8px}
#sp .fp .hint{margin:0 0 6px}
#sp .fp .hint:last-child{margin-bottom:0}
#sp .hint.bad{color:var(--accent)}

/* 项目管理页 /project/<数字>：站点那一整块（.w-section，含 #jobs_of_a_project 与右侧图例/页签）由
   80-app.js 的 wireManageDoc **搬**进 #sp-mg-host。结构、id、内联 onclick 全没动，这里只把它从原站
   的深色底改成我们的卡片外观；两列仍用站点自己的 bootstrap 栅格（那套 CSS 本来就在这一页里加载）。 */
#sp .sp-manage{padding:18px 20px 20px;color:var(--text-2)}
#sp .sp-manage .w-section,#sp .sp-manage .container,#sp .sp-manage .w-box,
#sp .sp-manage .padding-15,#sp .sp-manage [class*="col-md-"]{padding:0;margin:0;background:none;border:none;box-shadow:none;max-width:none}
/* 别改 .row 的布局方式：站点用 bootstrap 的 float 栅格，8/4 栏加起来正好 100%，
   一旦给 .row 加 display:flex + gap，多出来的 gap 会把右栏挤到下一行（实测两栏会竖着叠）。 */
#sp .sp-manage .row{margin:0}
#sp .sp-manage .row::after{content:'';display:block;clear:both}
#sp .sp-manage h2{margin:0 0 8px;font-size:14.5px;font-weight:600;color:var(--text)}
#sp .sp-manage h4{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text)}
#sp .sp-manage a{color:var(--accent);text-decoration:none}
#sp .sp-manage a:hover{text-decoration:underline}
#sp .sp-manage ul{padding:0;margin:0;list-style:none}
#sp .sp-manage .meta-list{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 0}
#sp .sp-manage li{font-size:12.5px;color:var(--text-3);line-height:1.95}
#sp .sp-manage .meta-list li[class^="msg_"]{font-weight:600;color:var(--text-2)}
#sp .sp-manage .breadcrumb{display:none}
/* 站点那几个方块本来就是「卡片」：它们的底色/边框被上面统一掉了，这里按我们的样式还回来，
   免得整页糊成一片（Summary 与项目卡是 .w-box，右栏图例/页签是 .widget）。 */
#sp .sp-manage .w-box,#sp .sp-manage .widget{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:14px}
#sp .sp-manage .widget-heading{margin:0 0 10px}
/* 图例：站点用三个 .square 当色块，色是 bootstrap 的 btn-neutral/warning/default */
#sp .sp-manage .legend{display:flex;gap:16px;flex-wrap:wrap}
#sp .sp-manage .legend a{display:flex;align-items:center;gap:7px;color:var(--text-2);font-size:12.5px;text-decoration:none}
#sp .sp-manage .legend i{display:none}
#sp .sp-manage .legend .square{width:14px !important;height:14px !important;margin:0 !important;border-radius:3px;border:none}
#sp .sp-manage .legend .btn-neutral{background:var(--text-3)}
#sp .sp-manage .legend .btn-warning{background:#e0a13a}
#sp .sp-manage .legend .btn-default{background:var(--surface-3);border:1px solid var(--border-strong)}
#sp .sp-manage div[style*="color:red"]{color:var(--accent) !important}
#sp .sp-manage .nav-tabs{display:flex;gap:4px;margin:16px 0 12px;border-bottom:1px solid var(--border)}
#sp .sp-manage .nav-tabs > li{margin:0}
#sp .sp-manage .nav-tabs > li > a{display:block;padding:7px 12px;font-size:12.5px;border:1px solid transparent;border-bottom:none;border-radius:var(--r-sm) var(--r-sm) 0 0;text-decoration:none;color:var(--text-2)}
#sp .sp-manage .nav-tabs > li > a:hover{text-decoration:none;color:var(--text)}
#sp .sp-manage .nav-tabs > li.active > a{background:var(--surface-2);border-color:var(--border);color:var(--text)}
#sp .sp-manage .btn:not(.square){font:inherit;font-size:12.5px;padding:7px 12px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);cursor:pointer;box-shadow:none;text-shadow:none;text-decoration:none}
#sp .sp-manage .btn:not(.square):hover{border-color:var(--border-strong);color:var(--text);text-decoration:none}
#sp .sp-manage .btn-primary:not(.square){background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .sp-manage .btn:not(.square).btn-danger{color:var(--accent);border-color:var(--accent-weak)}
#sp .sp-manage .btn-round i{display:none}   /* 图标是 FA4 类名、站点只装了 FA6：::before 根本没内容，留着就是空心圆 */
/* 站点把 .btn-round 钉成 34×34 的圆（配一个根本画不出来的图标），字写进去就被裁掉 */
#sp .sp-manage .btn-round{width:auto !important;height:auto !important;border-radius:var(--r-sm) !important;padding:6px 10px !important}
/* 站点给 .btn.square 上了 !important 的 16×16：帧缩略图与图例色块必须跟着用 !important 才拨得动 */
#sp .sp-manage .square{display:inline-block;width:22px !important;height:22px !important;margin:0 6px 0 0 !important;padding:0 !important;border-radius:4px;border:1px solid var(--border);vertical-align:middle;text-align:center;overflow:hidden}
#sp .sp-manage .square img{display:block;width:100% !important;height:100% !important;object-fit:cover;border-radius:3px}
#sp .sp-manage input[type=text],#sp .sp-manage input.form-control{font:inherit;font-size:12.5px;padding:7px 9px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text);max-width:100%}
#sp .sp-manage input[type=text]::placeholder{color:var(--text-3)}
#sp .sp-manage input[type=checkbox],#sp .sp-manage input[type=radio]{accent-color:var(--accent);margin-right:7px;vertical-align:middle}
#sp .sp-manage label{font-size:12.5px;color:var(--text-2);margin:0}
#sp .sp-manage .form-inline,#sp .sp-manage .checkbox{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#sp .sp-manage .tiles{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#sp .sp-manage .tiles .square{width:80px !important;height:60px !important;margin:0 !important}
/* 站点给 .tab-content 铺了白底 + 边框，在暗色主题下是一块亮斑 */
#sp .sp-manage .tab-content{background:none;border:none;padding:0;box-shadow:none}
#sp .sp-manage .tab-pane{padding:0}
#sp .sp-manage .tab-pane img{display:inline-block;vertical-align:middle;height:16px;margin:0 3px}
#sp .sp-manage .tab-pane input[type=radio]{margin:0 2px 0 10px}
#sp .sp-manage .text-right{text-align:right}
#sp .sp-manage .sp-mg-badge{font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;background:var(--accent-weak);color:var(--accent)}

/* 只有换视图（或刷新）才播：筛选 / 排序 / 显示更多的 render() 不再重放，否则实时状态带
   重新淡入，看起来像整页在重载。开关是 #sp 的 .sp-anim。 */
@keyframes sp-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  #sp .chart .area{animation:sp-rise .7s cubic-bezier(.16,1,.3,1) .15s both}
  #sp.sp-anim .kpis,#sp.sp-anim .grid,#sp.sp-anim .farm{animation:sp-rise .5s cubic-bezier(.16,1,.3,1) both}
  #sp.sp-anim .grid{animation-delay:.06s}
  #sp.sp-anim .farm{animation-delay:.1s}
}
`;

  /* 原版界面模式下「切回现代化」小开关的样式：那种模式下整套 SP.CSS 故意不加载（它给 #sp 用）。 */
  /* 左下角两个开关（「进入 / 切回新界面」与「译 ZH」）共用一个竖排容器，上下顺序由 CSS 的 order 决定 —— 两者由不同代码路径挂载，靠插入顺序排是赌运气。 */
  SP.cornerHost = function cornerHost() {
    const host = document.getElementById('sp-corner');
    if (host) return host;
    const s = document.createElement('style');
    s.id = 'sp-corner-style';
    s.textContent = `
      #sp-corner{position:fixed;left:14px;bottom:14px;z-index:2147482000;
        display:flex;flex-direction:column;align-items:flex-start;gap:8px}
    `;
    (document.head || document.documentElement).appendChild(s);
    const box = document.createElement('div');
    box.id = 'sp-corner';
    (document.body || document.documentElement).appendChild(box);
    return box;
  };

  SP.injectModePillStyle = function injectModePillStyle() {
    if (document.getElementById('sp-mode-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-mode-style';
    s.textContent = `
      #sp-mode-pill{
        order:2;position:static;
        display:inline-flex;align-items:center;gap:8px;
        padding:10px 15px;border-radius:9px;cursor:pointer;
        background:#e06d58;color:#fff;border:1px solid rgba(0,0,0,.2);
        font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        box-shadow:0 2px 6px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.3);
        transition:transform .12s, box-shadow .12s;
      }
      /* 原版模式下这个按钮是唯一属于我们的东西，必须一眼看得见：之前 opacity:.62 的深色小条实测等于隐形。 */
      #sp-mode-pill:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.34)}
      #sp-mode-pill:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #sp-mode-pill svg{width:15px;height:15px;flex:none;fill:#fff}
    `;
    (document.head || document.documentElement).appendChild(s);
  };

  SP.injectStyle = function injectStyle() {
    if (document.getElementById('sp-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-style';
    s.textContent = SP.CSS;
    (document.head || document.documentElement).appendChild(s);
  };

  /* 一开始压住原站 UI 防闪烁：用 display:none 而非 visibility —— 原站 2013 版 Bootstrap 表头是 fixed 的，只藏可见性仍会挡住我们。 */
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
/* ==== 40-ui.js：组件层（数据 → HTML 字符串）+ 命令式图表 ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, t } = { Util: SP.Util, t: SP.t };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  /** 分位色阶五档：绝对值分档会把日常帧数挤进最低两档、整片一色；颜色走 token --heat-1..5 */
  const SHADE = ['--heat-1', '--heat-2', '--heat-3', '--heat-4', '--heat-5'];
  const HEAT = (i) => `var(${SHADE[i]})`;

  const ICONS = {
    refresh: '<path d="M13.65 2.35A7.96 7.96 0 0 0 8 0C3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"/>',
    search: '<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/>',
    user: '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.34 0-10 1.67-10 5v3h20v-3c0-3.33-6.66-5-10-5z"/>',
    gear: '<path d="M19.14 12.94a7.5 7.5 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.86a.5.5 0 0 0 .12.62l2.03 1.58a7.5 7.5 0 0 0 0 1.88L2.82 14.52a.5.5 0 0 0-.12.62l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.39 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.55 1.62-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.6 3.6 0 0 1 12 15.6z"/>',
    sheep: '<path d="M17 4a3 3 0 0 0-2.82 2H9.82A3 3 0 1 0 4 8.83V15a4 4 0 0 0 4 4h8a2 2 0 0 0 2-2v-2.2A3 3 0 0 0 17 4zm0 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/>',
    caretUp: '<path d="M12 8.5l5.5 7h-11z"/>',
    caretDown: '<path d="M12 15.5l-5.5-7h11z"/>',
    star: '<path d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96z"/>',
    more: '<path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    check: '<path d="M9.55 17.6l-4.6-4.6 1.7-1.7 2.9 2.9 7.8-7.8 1.7 1.7z"/>',
    /* 警示（三角 + 感叹号）：给"检测到降噪"这类"这一项为什么没得选"用 */
    warn: '<path d="M12 2.4c.56 0 1.08.3 1.36.78l8.2 14.2A1.57 1.57 0 0 1 20.2 19.8H3.8a1.57 1.57 0 0 1-1.36-2.42l8.2-14.2A1.57 1.57 0 0 1 12 2.4zm0 2.4L5.06 17.4h13.88L12 4.8zm-1 3.1h2v4.9h-2zm0 6.1h2v2h-2z"/>',
    heart: '<path d="M12 20.3l-1.4-1.3C5.4 14.4 2 11.3 2 7.5 2 4.4 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.4 22 7.5c0 3.8-3.4 6.9-8.6 11.5L12 20.3z"/>',
    ban: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2"/>',
    /* 上传第三步的 CPU/GPU 图标：站点挂的是两张 PNG（UI__HTML.php:1109/1122），
       换我们自己的矢量图标（同一条路径，两格外形一眼能分辨）。 */
    cpu: '<path d="M9 2h2v2H9zm4 0h2v2h-2zM9 19h2v2H9zm4 0h2v2h-2zM2 9h2v2H2zm0 4h2v2H2zm18-4h2v2h-2zm0 4h2v2h-2z"/><path d="M5.5 5.5h13v13h-13zm2 2v9h9v-9z"/>',
    gpu: '<path d="M3 5.5h18a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 17V7A1.5 1.5 0 0 1 3 5.5zm.5 2v9h17v-9z"/><path d="M12 8.6a3.4 3.4 0 1 1-3.4 3.4A3.4 3.4 0 0 1 12 8.6zm0 1.8a1.6 1.6 0 1 0 1.6 1.6A1.6 1.6 0 0 0 12 10.4z"/><path d="M4.5 8.8h3v1.4h-3z"/>',
  };
  const icon = (name, cls) =>
    `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const initial = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();

  /** 头像：取不到图（懒加载未完成）就退回首字母，不留破图 */
  const avatar = (src, name, cls) => (src
    ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls || ''}">${esc(initial(name))}</span>`);

  /** 指标带：格数写进 data-n 交给 CSS（30-style.js 的 .kpis[data-n]），别在这里写死列数 */
  const kpis = (items) => `<div class="kpis" data-n="${items.length}">${items.map((it) => `
    <div class="kpi">
      <div class="k">${esc(it.k)}</div>
      <div class="v num">${esc(it.v)}</div>
      ${it.d ? `<div class="d">${it.d}</div>` : ''}
    </div>`).join('')}</div>`;

  /** 日历热力图（近 53 周 × 7）。lang 决定月份怎么写；opts.unit='days' 时只能按二值画
   *  （别人的主页只有「这天有没有渲染」），计数文案也跟着换口径。 */
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
    // 退化保护：非零值全一样大时分位档会全落进最低档、整片一色，统一用中间档
    const flat = nz.length > 0 && T[0] === T[3];
    const shade = (v) => {
      if (!v) return 'var(--surface-3)';
      if (flat) return HEAT(2);
      const i = v <= T[0] ? 0 : v <= T[1] ? 1 : v <= T[2] ? 2 : v <= T[3] ? 3 : 4;
      return HEAT(i);
    };

    // 首日对齐真实星期列，否则整片错行
    const pad = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cols = Math.ceil((pad + span) / 7);

    // 星期轴只标一/三/五
    const wdNames = String(t('heat.weekday')).split(',');
    const wd = [0, 1, 2, 3, 4, 5, 6]
      .map((r) => `<span>${r % 2 === 0 && wdNames[Math.floor(r / 2)] ? esc(wdNames[Math.floor(r / 2)]) : ''}</span>`).join('');

    // 月份轴：每个自然月在第一列出现处落标签、跨列显示；一列宽的残月与挨太近的都跳过
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
    // 图例必须和数据用同一套档位（多一档少一档都是在骗人）；二值时退成没渲染 / 有渲染
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

  /** 热力图悬停提示：原生 title 又慢又不可控；「这格是哪一天」正是这张图该回答的问题 */
  function bindHeatTips(wrap, lang) {
    if (!wrap || wrap.dataset.tips === 'on') return;
    wrap.dataset.tips = 'on';
    // 二值热力图每格只有「有没有渲染」，不能说成「几帧」
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
      // 界面缩放不为 100% 时 rect 是物理像素、left/top 要 CSS 像素，要除一下
      const z = Util.zoomOf(wrap);
      tip.style.left = `${(r.left - box.left) / z + r.width / z / 2}px`;
      tip.style.top = `${(r.top - box.top) / z - 6}px`;
      tip.style.opacity = '1';
    };
    wrap.addEventListener('pointerover', onMove);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', () => { tip.style.opacity = '0'; });
  }

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

  /** 首页 4 张站点统计 → 一条通栏；flush 去掉上外边距 */
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

  function machines(m) {
    const list = (m && m.list) || [];
    if (!list.length) return `<div class="machines"><div class="none">${esc(t('machines.none'))}</div></div>`;
    return `<div class="machines">${list.map((x) => `<div class="machine">
        <span class="tag">${esc(x.client || t('machines.unknown'))}</span>
        <span class="spec" title="${esc(x.spec)}">${esc(x.spec || '—')}</span>
        ${x.url ? `<a class="open" href="${esc(x.url)}" target="_self">${esc(t('machines.open'))}</a>` : ''}
      </div>`).join('')}</div>`;
  }

  /** 进度分数文案：原站把「1216 / 12000」压在条子上（白字横跨橙/灰、易截断），故移到条外；
   *  取不到分数时回落成百分比。 */
  function progressText(pct, done, total) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return Number.isFinite(done) && Number.isFinite(total) && total > 0
      ? `${fmt(done)} / ${fmt(total)}`
      : `${p.toFixed(0)}%`;
  }

  /** 6px 轨道 + 强调色填充。分数**不在这里**（见 50-views.js 的项目表）：挂在条子后面时
   *  `flex:1` 的轨道会被每行不同的数字宽度挤成长短不一，独立成列才对得齐。 */
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

  /** 新用户空状态：一句为什么 + 三步怎么开始 + 两个出口（不是「暂无数据」） */
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

  const skeleton = (rows) => `<div class="state" style="padding:40px 20px">
      ${[...Array(rows || 4)].map((_, i) => `<div class="sk" style="width:100%;height:${i === 0 ? 22 : 46}px"></div>`).join('')}
    </div>`;

  /* ============================================================ 图表（命令式）
     **按实测像素**渲染。绝不用 preserveAspectRatio="none"：它会把轴标签一起**非等比拉伸**。 */

  let chartObs = null;   // 模块级单例：重渲染必须先断开旧的，否则观察器挂在已摘除的节点上

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

  /** 轴上大数：3.6e8 → 360M */
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
/* ==== 50-views.js：视图层（六个视图 + 上传卡片 + 分析等待页） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');

  const foot = () => `<div class="foot">${esc(t('footer.source'))}</div>`;

  /* line_frames_timeline 是站点内联的**累积**帧数曲线，按阶梯函数差分才是逐日帧数（原站热力图只记
     "当天有没有渲染"，count 恒为 1）；先判单调，站点改成逐日值就直接用，绝不硬差出负数。 */
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
      const v = at.has(d) ? at.get(d) : prev;   // 阶梯函数：没采样点的日子沿用上一次的值
      if (prev !== null) out.push({ d, v: Math.max(0, v - prev) });
      prev = v;
    }
    return out;
  }

  function statOf(st, names) {
    for (const n of names) if (st[n] !== undefined && st[n] !== '') return st[n];
    return '';
  }

  /* "42" / "20,062" / "1h 20m" → 数字；空/认不出 → 0。只用来判断"有没有真实数字"。 */
  const asCount = (v) => Number(String(v === null || v === undefined ? '' : v).replace(/[^\d.]/g, '')) || 0;

  const rankOf = (st) => {
    const raw = statOf(st, ['Rank']);
    const digits = String(raw).replace(/[^\d]/g, '');
    return digits || '';
  };

  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

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

  function packLabel(prefix, raw, upper) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const key = `${prefix}.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const hit = t(key);
    if (hit !== key) return hit;
    return upper ? s.toUpperCase() : s;
  }

  /* 站点给的原因里有的带数字（内存那句每次都不一样），slug 查不到 → 先用规则匹配。
     与下面的 STATUS_RULES 同一套做法；英文词典里没有 why.* 条目，所以没命中要回落原句。 */
  const WHY_RULES = [
    [/^not enough free memory,\s*requiring:\s*(.+?),\s*available:\s*(.+)$/i, (m) => {
      const key = 'why.notEnoughMemory';
      const hit = t(key, { need: m[1].trim(), have: m[2].trim() });
      return hit === key ? m[0] : hit;
    }],
  ];
  function whyLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    for (const [re, fn] of WHY_RULES) { const m = s.match(re); if (m) return fn(m); }
    return packLabel('why', s);
  }

  const STATUS_RULES = [
    [/^waiting to render/i, () => t('status.idle')],
    [/^rendering for\s+(.+)$/i, (m) => t('status.renderingFor', { user: m[1] })],
    [/^rendering\b/i, () => t('status.rendering')],
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

  /* ==== 总览 ==== */

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
    const hasCalendar = daily.length > 0 || !!(p.activity && p.activity.length > 0);
    /* 新账号站点常常"只给统计表、不给图表数组"（line_*_timeline 与热力图整段不渲染）。
       数字是真的（Frames rendered 148 / Points 20,062），所以判据不能只看图表：
       统计表里任何一个数 > 0、或者有在线机器/历史会话，都算"有记录"（用户实报：总览说"还没有渲染记录"）。 */
    const hasStat = asCount(statOf(st, ['Frames rendered'])) > 0
      || asCount(statOf(st, ['Points'])) > 0
      || asCount(statOf(st, ['Time rendered'])) > 0;
    const hasData = (p.points && p.points.length > 1) || hasCalendar || hasStat
      || (p.machines && p.machines.count > 0) || (p.sessions && p.sessions.length > 0);

    if (!hasData) {
      // 统计读到了但确实一帧都没有 → 新用户空状态，不摆一排 0；连统计都读不到是解析失败，如实说无数据。
      const parsed = Object.keys(st).length > 0;
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty()) + foot();
    }

    /* ---- 指标带 ---- */
    const total = daily.reduce((a, b) => a + b.v, 0);
    const avg = daily.length ? Math.round(total / daily.length) : null;
    const peak = daily.length ? daily.reduce((a, b) => Math.max(a, b.v), 0) : null;
    const rank = rankOf(st);
    const rawTime = statOf(st, ['Time rendered']);
    const days = Util.durDays(rawTime);
    const frames = statOf(st, ['Frames rendered']);
    const points = statOf(st, ['Points']);
    const created = statOf(st, ['Projects created']);
    const ordered = statOf(st, ['Frames ordered']);

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
      /* 连续天数是从产出日历算出来的：站点没给日历就整格不画（否则会给新账号摆一个"连续 0 天"） */
      ...(hasCalendar ? [{
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        d: d.best !== undefined
          ? t(d.active30 === 30 ? 'stat.streakFull' : 'stat.streakHint', { best: fmt(d.best), d30: fmt(d.active30 || 0) })
          : '',
      }] : []),
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，栅格与分隔线要跟着重排（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       只有**自己的主页**内联这两块；没有数据源就整块不画（不摆"暂无数据"），只剩一块时铺满整行。 */
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

    /* ---- 已连接的机器（只放自己的机器；全站实时在项目页顶部） ---- */
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

  /* ==== 项目 ==== */

  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null };
  const rankState = { limit: 100 };
  const acctState = { tab: 'sched' };

  function moreRow(shown, total, step) {
    if (shown >= total) return '';
    return `<div class="more">
      <button class="btn" id="sp-more" data-step="${step}">${esc(t('list.more'))}
        <span class="num">${esc(t('list.shown', { n: shown, total }))}</span></button>
    </div>`;
  }

  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
    return p.status || '—';
  }

  function ownerActions(p, maps) {
    const id = p.ownerId || p.owner;
    if (!maps || !id) return null;
    const prio = maps.prio.get(id) || null;
    const spon = maps.sponsor.get(id) || null;
    const blocked = maps.blocked.get(id) || null;
    return {
      prio: {
        on: !!prio,
        url: prio ? (prio.action || `/user/priority/remove/${encodeURIComponent(id)}`)
          : (maps.add.priority ? maps.add.priority + encodeURIComponent(id) : `/user/priority/add/${encodeURIComponent(id)}`),
      },
      gift: { on: !!spon, url: spon ? spon.action : (maps.add.sponsor ? maps.add.sponsor + encodeURIComponent(id) : '') },
      block: { on: !!blocked, url: blocked ? blocked.action : (maps.add.blockOwner ? maps.add.blockOwner + encodeURIComponent(id) : '') },
    };
  }

  function ownerCell(p, me, maps) {
    const isMe = me && p.owner === me;
    const id = p.ownerId || p.owner;
    const act = isMe ? null : ownerActions(p, maps);
    const mark = (kind, icon, label) =>
      `<span class="mk mk-${kind}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${UI.icon(icon)}</span>`;
    const marks = !act ? '' : (act.prio.on ? mark('prio', 'star', t('proj.prio.inList')) : '')
      + (act.gift.on ? mark('gift', 'heart', t('proj.menu.gifted')) : '')
      + (act.block.on ? mark('block', 'ban', t('proj.menu.blocked')) : '');
    // 主页地址优先用 URL 里的用户名（parseProjects 从 <a> href 读的），读不到才回落显示名。
    const href = id ? `/user/${encodeURIComponent(id)}/profile` : '';
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

    const maps = listsOf(state);
    const prio = maps ? maps.prio : null;

    const filters = [
      ['all', t('proj.all')],
      ['rendering', t('proj.status.rendering')],
      ['waiting', t('proj.status.waiting')],
      ['gpu', t('proj.gpu')],
      ['cpu', t('proj.cpu')],
    ];

    const farmRow = state.home && state.home.stats && state.home.stats.length ? UI.farm(state.home.stats, { flush: true }) : '';

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

  /* ==== 排行榜 ==== */

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

  /* ==== 设置 ==== */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

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
          <div class="lbl">${esc(t('set.exp'))}</div>
          <div class="hint" style="margin-top:0"><b>${esc(t('set.upmode'))}</b></div>
          ${seg('sp-upmode', state.uploadMode, [['off', t('set.upmode.off')], ['raw', t('set.upmode.raw')], ['new', t('set.upmode.new')]])}
          <div class="hint">${esc(t('set.upmodeHint'))}</div>
          ${SP.Step3x ? SP.Step3x.fpRows() : ''}
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.about'))}</div>
          <div class="hint" style="margin-top:0">${esc(t('set.aboutText'))}</div>
          <div class="hint">${esc(t('set.dangerHint'))}</div>
        </div>
      </div>`;
  }

  /* ==== 账户设置 ==== */

  /** 动作地址一律从站点 onclick 读出、不自己拼；requiresAction 时读不到就**不画按钮**（不猜 URL）。 */
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

    /* 捐赠积分（站点叫 Sponsorship）：积分会给名单里的随机一位；地址全来自解析结果，拿不到就不画。 */
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

  /* ==== 会话页（一台机器）：机器信息 + 可渲染项目在同一份 HTML 里，时间线是站点自己的 AJAX JSON；
     任何一块拿不到，只让那一块说"没有数据"，其余照常显示。 */
  const sessState = { type: 'all', limit: 100 };

  const sessElsewhere = new Set(['hostname', 'os', 'owner', 'version', 'frames', 'points', 'power', 'powerGpu', 'maxTime', 'status', 'action', 'currentFrames']);

  function sessLabel(f) {
    if (!f.key) return f.label;
    const k = `sess.f.${f.key}`;
    const hit = t(k);
    return hit === k ? f.label : hit;
  }

  /* 站点在「机器信息」里塞的有些值是**内部枚举**，不是给人看的字：OS 那格印 `linux`，
     Scheduler 那格印 `very_slow_computer`（它说的是这台机器跑多快，跟"调度模式"没关系），
     从没活动过的机器几格印 `Never`。这些翻成人话、原文进悬停提示；
     **认不出的值一律原样显示** —— 站点哪天加新档，界面上照样看得见。 */
  const OS_NAME = {
    linux: 'Linux', windows: 'Windows', win32: 'Windows',
    'mac os x': 'macOS', macos: 'macOS', darwin: 'macOS', freebsd: 'FreeBSD',
  };
  const MACHINE_CLASS = [
    [/^very[_\s-]*slow[_\s-]*computer$/i, 'verySlow'],
    [/^(slow|low)[_\s-]*computer$/i, 'slow'],
    [/^(medium|average|normal)[_\s-]*computer$/i, 'medium'],
    [/^(fast|high)[_\s-]*computer$/i, 'fast'],
    [/^very[_\s-]*fast[_\s-]*computer$/i, 'veryFast'],
  ];
  /* Action 那格站点放的是 `<input type="button" value="Pause">`（值是英文按钮字，
     实测只有 Pause / Resume 两种），只在没显示我们自己的控制面板时才走到这里。 */
  const ACTION_NAME = { pause: 'sess.act.pause', resume: 'sess.act.resume' };
  function valueHuman(key, raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (/^never$/i.test(s)) return { text: t('sess.never'), title: t('sess.rawTip', { raw: s }) };
    if (key === 'os') {
      const n = OS_NAME[s.toLowerCase()];
      if (n) return { text: n, title: t('sess.rawTip', { raw: s }) };
    }
    if (key === 'scheduler') {
      const hit = MACHINE_CLASS.find(([re]) => re.test(s));
      if (hit) return { text: t(`sess.class.${hit[1]}`), title: t('sess.rawTip', { raw: s }) };
    }
    if (key === 'action' && ACTION_NAME[s.toLowerCase()]) {
      return { text: t(ACTION_NAME[s.toLowerCase()]), title: t('sess.rawTip', { raw: s }) };
    }
    /* 值里带站点日期形状（`20th Oct 06:10` / `06:40 Sep 29`）就按语言包本地化；
       转换没变化说明不是日期，交给后面原样显示。 */
    const loc = I18n.date(s);
    if (loc !== s) return { text: loc, title: '' };
    return null;
  }

  function typeLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '—';
    const k = `sess.tl.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const hit = t(k);
    return hit === k ? s : hit;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** 毫秒 → 本地 MM-DD HH:mm。不走 toLocaleString：整列要对齐，中文环境会把它撑得参差不齐。 */
  function stamp(ms, withYear) {
    const d = new Date(Number(ms));
    if (!Number.isFinite(d.getTime())) return '—';
    const y = withYear ? `${d.getFullYear()}-` : '';
    return `${y}${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  /** 事件时长单独写：Util.duration 是给"机时"设计的，几秒的事件会被它读成 0m。 */
  function spanText(ms) {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h${pad2(m % 60)}m`;
    return `${Math.floor(h / 24)}d${pad2(h % 24)}h`;
  }

  /** 站点数字文案 → 数值，没有数字返回 null；真实的 0 要如实返回 0（与"读不到"是两回事）。 */
  const numOf = (s) => {
    const raw = String(s === undefined || s === null ? '' : s);
    if (!/\d/.test(raw)) return null;
    const n = Number(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  function lkey(ms) {
    const d = new Date(Number(ms));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  /** 事件流 → 活动汇总：跨度 >31 天按月、否则按天，最近的在前。 */
  function activity(list) {
    const ev = (list || []).filter((e) => Number.isFinite(e.start)).slice().sort((a, b) => b.start - a.start);
    if (!ev.length) return { rows: [], byMonth: false, anyRender: false, anyFail: false, crossYear: false };
    const byMonth = Util.ddiff(lkey(ev[ev.length - 1].start), lkey(ev[0].start)) + 1 > 31;
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

    /* **两种暂停是两件事**："Paused server side" 与客户端自己的 "Paused client side" 以站点那行为准；
       Action 只说"服务器认不认它在跑"（本地暂停时 Status 照样 Enable），只看 Action 会报成「运行中」。 */
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
    /* "Current frames"：这台机器此刻在跑什么（空闲不印）。它是**活的**，留身份条、不进「机器信息」表；
       暂停时文案说"当前作业"，免得和「已暂停」徽章自相矛盾。 */
    const cur = val('currentFrames');
    const cm = cur.match(/^project:\s*(.+?)\s+frame:\s*(\S+)\s+Request time:/i);
    // 「Current frames」写**文件名**（1002.blend）、项目表写**项目名**（1002），比对时剥后缀。
    const curProject = cm ? cm[1] : '';
    const curProjectBase = curProject.replace(/\.blend\d*$/i, '');
    if (cm) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cm[1])}</b> · ${esc(t('sess.frame'))} <b class="num">${esc(cm[2])}</b></span>`);
    } else if (cur) {
      bits.push(`<span>${esc(s.running === false ? t('sess.currentJob') : t('sess.rendering'))} <b>${esc(cur)}</b></span>`);
    }
    if (val('os')) {
      const os = valueHuman('os', val('os'));
      bits.push(`<span${os ? ` title="${esc(os.title)}"` : ''}>${esc(os ? os.text : val('os'))}</span>`);
    }
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

    const tl = s.timeline || [];
    const acts = activity(tl);

    /* ---- 指标带 ----
       起算时间取日志最早那条的**本地**时刻：**时区**不同（Creation Time 实测站点 UTC+2），与本地时间线
       同屏差 6 小时，会读成"创建 6 小时后才干活"。 */
    const framesN = numOf(val('frames'));
    const pointsN = numOf(val('points'));
    const perFrame = framesN && pointsN ? Math.round(pointsN / framesN) : null;
    const since = I18n.date(tl.length ? stamp(tl[tl.length - 1].start) : val('createdAt'));

    /* 算力那格跟着站点印了哪一行走（"Power CPU" / "Power GPU" 都开就两行都在）；**不写死** —— 早先写死读
       Power CPU，纯 GPU 机器上那格永远是"—"，被读成"CPU 有问题"。 */
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
        k: t('sess.kpi.maxTime'), v: val('maxTime') || '—', d: '',
      },
    ];

    /* ---- 机器控制：站点自己的按钮、同一批地址；只在看自己的机器时出现（实测别人的会话页直接 404），
       否则 Action 退回事实清单按原文显示。 */
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

    /* ---- 事实清单 ---- */
    const rest = s.facts.filter((f) => !sessElsewhere.has(f.key) || (f.key === 'action' && !showControl))
      .sort((a, b) => (a.key === 'renderKey' ? 1 : 0) - (b.key === 'renderKey' ? 1 : 0));
    const factsPanel = rest.length ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.facts'))}</h2><span class="sub">${esc(t('sess.factsSub'))}</span>
      </div>
      <div class="facts">${rest.map((f) => {
        let v;
        if (f.key === 'renderKey' && f.secret) {
          v = `<span class="num sec" data-key="${esc(f.secret)}">••••••••••••</span>` +
            `<button class="btn sm" data-act="reveal-key" aria-pressed="false">${esc(t('sess.reveal'))}</button>`;
        } else {
          const raw = f.value || '—';
          const human = f.href ? null : valueHuman(f.key, f.value);
          const txt = f.href
            ? `<a href="${esc(f.href)}" target="_self">${esc(raw)}</a>`
            : esc(human ? human.text : raw);
          v = `<span class="num"${human ? ` title="${esc(human.title)}"` : ''}>${txt}</span>`;
        }
        return `<div class="fact"><span class="k">${esc(sessLabel(f))}</span><span class="v">${v}</span></div>`;
      }).join('')}</div>
    </div>` : '';

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
      // 接口没回应时不在这里说"站点没返回记录"：正文已说"没取到"，两句会互相打脸。
      : (s.timelineFailed ? '' : t('sess.tlSubEmpty'));

    /* 条只画"渲染时长"：没有渲染事件时不换口径（不拿事件数冒充），只把填充留空 —— 但**这一列必须留着
       占位**，它是这行的弹簧，抽掉表头与数值列会各自靠左排。 */
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

    /* ---- 可渲染项目 ---- */
    const own = new Map();
    const dup = new Set();
    for (const p of state.projects || []) {
      if (!p.name) continue;
      if (own.has(p.name)) dup.add(p.name);
      else own.set(p.name, p);
    }
    for (const n of dup) own.delete(n);

    /* **站点的行序就是优先级，必须原样保留**：实测前 12 行是 "Renderable"，之后才是 "Over user's
       time limit"、"Computer has previously failed to render project" —— 只做一次映射：不排序、不分组、不去重。 */
    const prjRows = s.projects.map((p) => ({
      n: p.name,
      label: p.reason ? whyLabel(p.reason) : t('sess.whyNone'),
      p: own.get(p.name) || null,
    }));

    const maps = listsOf(state);
    const openP = projState.menu ? [...own.values()].find((x) => x.id === projState.menu) : null;
    const menuHtml = openP ? ownerMenu(openP, state.userName, maps) : '';

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
          const who = p && (p.ownerId || p.owner) ? ownerCell(p, state.userName, maps) : '<span class="dash">—</span>';
          const isCur = !!curProject && (curProject === n || curProjectBase === n);
          const frac = p ? UI.progressText(p.pct, p.done, p.total) : '';
          return `<tr>
            <td><div class="pnwrap"><div class="pn" title="${esc(n)}">${esc(n)}</div>${
              isCur ? `<span class="now">${esc(t('sess.rendering'))}</span>` : ''}</div></td>
            <td>${who}</td>
            <td><span class="st" title="${esc(label)}">${esc(label)}</span></td>
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

  /* ==== 挂载后补丁：只有总览的积分曲线需要真实像素宽度 ==== */
  /* ==== 项目上传页 / 分析等待页：骨架与内容都我们画。上传页把抓回来的 /getstarted 只当**数据源**
     （64-step1.js 解析后自绘三个槽位），等待页同理由 62-chain/68-step3 接手。 */

  function upload(state) {
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

  /** 上传卡片接线失败（站点这一版认不出要用的那几块）时，别给用户一张空白卡片：
      说清楚 + 给出切档办法。 */
  function shapeNotice(root) {
    const box = document.createElement('div');
    box.className = 'wrap';
    box.innerHTML = `<div class="sechead"><h2>${esc(t('up.title'))}</h2></div>
      <div class="panel" style="padding:16px 20px">
        <div class="hint bad">${esc(t('up.shapeNew'))}</div>
        <div class="hint" style="margin-top:8px">${esc(t('up.shapeHow'))}</div>
      </div>`;
    root.textContent = '';
    root.appendChild(box);
  }

  /* ---- 分析等待页 ---- */

  /** 上传后的等待页整页归我们；真正在跑的是 80-app.js 的轮询，它认 `#sp-an-*` 这几个钩子。 */
  function analyse() {
    return `<div class="wrap">
      <div class="sechead">
        <h2 data-an="title">${esc(t('an.title'))}</h2>
        <span class="sub" data-an="titleSub">${esc(t('an.sub'))}</span>
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
        <div id="sp-an-result" class="sp-up3" hidden></div>
      </div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }

  /** 项目管理页 /project/<数字>：站点那一大块由 80-app.js 的 wireManageDoc **搬**进来（活节点）。
   *  这里只画外壳；名字 / 进度 / 状态从站点 DOM 里读，拿不到就少显示几个字，不编数据。 */
  function project(state) {
    const id = state.projectId || '';
    const sec = document.getElementById('jobs_of_a_project');
    const nameEl = id ? document.getElementById(`project_job_${id}_path`) : null;
    const progEl = id ? document.getElementById(`project_job_${id}_progression`) : null;
    const name = nameEl ? nameEl.textContent.trim() : '';
    const prog = progEl ? progEl.textContent.trim() : '';
    const stEl = sec && sec.querySelector('li[class^="msg_"]');
    const stRaw = stEl ? stEl.textContent.trim() : '';
    const stCls = stEl ? ((stEl.className.match(/msg_([a-z]+)/i) || [])[1] || '') : '';
    const stText = stRaw ? (I18n.siteText(stRaw) || stRaw) : '';
    const meta = [
      name ? `<b>${esc(name)}</b>` : '',
      prog ? `${esc(t('proj.col.progress'))} ${esc(prog)}` : '',
      stText ? `<span class="sp-mg-badge s-${esc(stCls || 'x')}">${esc(stText)}</span>` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="wrap">
      <div class="sechead">
        <h2>${esc(t('mg.title'))}</h2>
        <span class="sub">${meta || esc(t('mg.unknown'))}</span>
      </div>
      <div class="sp-manage" id="sp-mg-host"></div>
      <div class="hint">${esc(t('mg.note'))}</div>
      <div class="foot">${esc(t('footer.source'))}</div>
    </div>`;
  }


  function mount(root, state) {
    /* 上传视图接线的两道判据：`.up-grid`（show() 先画骨架，那时还没卡片）与 `state.uploadHtml`（boot() 先
       render() 再 show()，直接开 #/upload 那次只拿到空卡片）。少了任一道就会把 body 早标成"已接线"，
       之后 render() 全被守卫早退 —— 用户拿到空壳（实测踩过）。 */
    if (state && state.view === 'upload' && root && !root.dataset.spWired
        && root.querySelector('.up-grid') && state.uploadHtml) {
      root.dataset.spWired = '1';
      SP.DomI18n.enabled = !!state.translateSite;
      /* 三个槽位全自绘（64-step1.js），站点那份 HTML 只当数据源；认不出站点结构才走 shapeNotice */
      if (!SP.Step1 || SP.Step1.mount(root, state.uploadHtml) === false) { shapeNotice(root); return false; }
    }
    const box = root && root.querySelector('#sp-chart');
    const pts = state && state.profile && state.profile.points;
    if (box && pts && pts.length > 1) SP.Charts.points(box, pts);
    if (root) SP.UI.bindHeatTips(root.querySelector('.heatwrap'), I18n.lang);
    const menu = root && root.querySelector('#sp-omenu');
    const trigger = root && root.querySelector('[data-act="owner-menu"][aria-expanded="true"]');
    if (menu && trigger) {
      const host = document.getElementById('sp');
      const b = trigger.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const z = Util.zoomOf(host);   // 界面缩放的补偿：rect 是物理像素，left/top 是 CSS 像素
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      // 左缘对齐到**菜单按钮**（用户拍板），不往左倒挂；顶到视口右边界时整体左移。
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

  SP.Views = { overview, projects, ranking, settings, account, session, upload, analyse, project, projState, rankState, acctState, sessState, dailySeries, mount };
})();

/* ===== src/62-chain.js ===== */
/* ==== 62-chain.js：上传链路的**数据层**（0.2.0）====================================

   契约来自站点源码，不是猜的：上游 GitLab `sheepitrenderfarm/www`，master 9b13032c
   （= 线上资源路径 /media/9b13032c/，就是 getShortVersion()）。行号对着那一版看。

   契约 A 上传（第一步）  HTML.php:2127-2152 → POST /project/internal/upload（multipart）
                          字段：addproject_archive（文件）+ UPLOAD_IDENTIFIER（32 位 hex）
                          成功 = 302 → /project/add/<token>；失败 = 200 纯文本原因 或 error 页
   契约 B 等待（第二步）  ProjectController.php:194-221 → GET /project/add_analyse/<token>
                          JSON {"status":"RETRY"|"PROCESSING",analysed,total} 或整段 HTML 碎片
   契约 C 提交（第三步）  addproject.js:1-101 / ProjectController.php:226-448 → POST /project/add_internal
                          27 键；响应以 "http" 开头 = 成功地址，否则整段是错误说明

   这一层的纪律：**服务端返回的 HTML 只经 DOMParser 走一遭，永不进活文档**。
   界面用我们自己的 id、我们自己的提交 —— 于是"两份同名控件""站点 JS 抢 DOM"那一整类缺陷
   （0.1.14–0.1.17 反复踩的）从根上不存在。 */
(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Chain) return;
  const t = SP.t;

  /** 核对过的上游版本；站点升级后要重新核对并同时改这里与 docs/REWRITE-0.2.0.md。 */
  const UPSTREAM = '9b13032c';

  const URL_UPLOAD = '/project/internal/upload';
  const URL_SUBMIT = '/project/add_internal';
  const analyseUrl = (token) => '/project/add_analyse/' + encodeURIComponent(token);
  const step2Url = (token) => '/project/add/' + encodeURIComponent(token);

  /** 站点资源路径里的版本号：/media/<8 位十六进制>/…（脚本、样式、图片都带）。 */
  function upstreamVersion() {
    const nodes = document.querySelectorAll('script[src*="/media/"],link[href*="/media/"]');
    for (let i = 0; i < nodes.length; i++) {
      const m = /\/media\/([0-9a-f]{8})\//.exec(nodes[i].src || nodes[i].href || '');
      if (m) return m[1];
    }
    return '';
  }

  /* ------------------------------------------------------------------ 解析 */

  const str = (v) => (v == null ? '' : String(v));
  const parseDoc = (html) => new DOMParser().parseFromString(str(html), 'text/html');
  /* 同一套查找要能在 Document 和 Element 上都用（blend 的隐藏值是在卡片元素里找的） */
  const $id = (root, id) => (root.getElementById ? root.getElementById(id) : root.querySelector('[id="' + id + '"]'));
  const valOf = (root, id) => { const el = $id(root, id); return el ? str(el.value) : null; };

  /** 站点的取值方式：$('#id').is(':checked')。
      hidden 的 input 永远不是 :checked —— HTML.php:1042 的 generate_mp4 与 1057 的
      public_thumbnail 就是这么发的（服务端 ProjectController.php:360 自己再兜一层）。 */
  const siteChecked = (el) => !!(el && String(el.type).toLowerCase() !== 'hidden' && el.checked);

  /** 三种开关形态：checkbox（用户可改）/ hidden（站点替用户定了）/ none（这一版没给）。 */
  function toggleOf(el, why) {
    if (!el) return { kind: 'none', on: false, why: why || '' };
    if (String(el.type).toLowerCase() === 'hidden') {
      return { kind: 'hidden', on: false, force: str(el.value) === '1', why: why || '' };
    }
    return { kind: 'check', on: !!el.checked, why: why || '', title: (el.parentNode && el.parentNode.querySelector('span[title]') || {}).title || '' };
  }

  /** 计算方式那一列：CPU / GPU 各带自己的"排队位次 / 项目总数"两行**裸文本**（HTML.php:1112）。 */
  function computeOf(root) {
    const cpu = $id(root, 'compute_method_cpu');
    const gpu = $id(root, 'compute_method_gpu');
    const hintOf = (el) => {
      const out = { queue: '', total: '' };
      if (!el) return out;
      const box = el.closest('div');
      if (!box) return out;
      const s = box.textContent.replace(/\s+/g, ' ');
      const q = /Est\.\s*queue position:\s*([^ ]+)/i.exec(s);
      const n = /Total projects:\s*([\d,]+)/i.exec(s);
      /* 站点给的是英文序数（"9th"）。中文模板里写「预计排队第 8th 位」是机器味，
         这里剥掉后缀，中文拿去拼「第 n 位」，英文那边退化成 "Est. queue position 9"。 */
      if (q) out.queue = q[1].replace(/(\d+)(st|nd|rd|th)\b/i, '$1');
      if (n) out.total = n[1];
      return out;
    };
    return {
      canCpu: !!cpu, canGpu: !!gpu,
      cpuOn: !!(cpu && cpu.checked), gpuOn: !!(gpu && gpu.checked),
      cpuHint: hintOf(cpu), gpuHint: hintOf(gpu),
    };
  }

  /* 我们自己渲染的控件（这些 id 的内容不进"说明文字"）：帧、切块、内存、提交、错误框、隐藏项 */
  const OWN_IDS = /^addproject_(animation_(start|end|step)_frame|singleframe_start_frame|split_tiles_number|split_(animation_)?sample_range_value|split_sample_value|animation_split_sample_value|max_ram_optional|submit|submit_div|error_box|content|exe|path|archive|engine|denoising|color_management|render_on_gpu_headless|use_adaptive_sampling|framerate|output_path|width|height|cycles_samples|samples_pixel|image_extension)|^checkbox_ad_|^checkbox_advanced_option_/;

  /** 把服务端写的**说明文字**（EXR 限制、降噪提示、切块解释、缺文件、驱动警告…）抽出来。
      不抽控件、不抽 label 的 for 目标 —— 那些我们自己画。 */
  function notesOf(scope) {
    const out = [];
    const walk = (node) => {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          const s = n.nodeValue.replace(/\s+/g, ' ').trim();
          if (s) out.push(s);
          continue;
        }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'option' || tag === 'script' || tag === 'style' || tag === 'br') continue;
        if (n.id && OWN_IDS.test(n.id)) continue;
        if (n.querySelector && n.querySelector('input,select') && !n.querySelector('ul,li,p,br')) continue;
        walk(n);
      }
    };
    walk(scope);
    /* 相邻碎片合成一行：站点的说明由 <br>/<li> 切得很碎 */
    const merged = [];
    out.forEach((s) => {
      const last = merged[merged.length - 1];
      if (last && last.length < 40 && !/[.。:：]$/.test(last)) merged[merged.length - 1] = last + ' ' + s;
      else merged.push(s);
    });
    return merged;
  }

  /* 脚本认得（会渲染或会读）的 id 清单。站点这一版多出来的元素 = 新控件：
     我们没画它、就会按站点给的默认值提交 —— 这种事必须说出来，不能沉默（用户 2026-10-07 定）。 */
  const KNOWN_IDS = [
    /^token$/, /^public_render$/, /^public_thumbnail$/, /^generate_mp4$/,
    /^compute_method_(cpu|gpu)$/,
    /^addproject_\d+$/, /^addproject_content_\d+$/,
    /^addproject_(exe|path|archive|engine|denoising|color_management|render_on_gpu_headless|use_adaptive_sampling|framerate|output_path|width|height|cycles_samples|samples_pixel|image_extension)_\d+$/,
    /^addproject_(animation_start_frame|animation_end_frame|animation_step_frame|singleframe_start_frame|max_ram_optional)_\d+$/,
    /^addproject_(split_tiles_number|split_animation_sample_range_value|animation_split_sample_value|split_sample_range_value|split_sample_value)_\d+$/,
    /^addproject_(submit|submit_div|error_box)_\d+$/,
    /^addproject_(animation_div10|animation_div11|singleframe_div20|singleframe_div21)_\d+$/,
    /^checkbox_(ad|advanced_option)_\d+$/,
  ];
  /** 站点/第三方自己塞进来的 id（与我们无关，别再报给用户） */
  const IGNORE_ID = /^(ui-|ui\.|sp-|google|g-recaptcha|__)/;

  function unknownIds(root) {
    const out = [];
    [].slice.call(root.querySelectorAll('[id]')).forEach((el) => {
      const id = el.id;
      if (!id || IGNORE_ID.test(id)) return;
      if (KNOWN_IDS.some((re) => re.test(id))) return;
      if (out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  /** 解析第三步碎片（契约 B 的 HTML 响应）。返回 null = 结构不认识 → 调用方降级。 */
  function parseStep3(html) {
    const d = parseDoc(html);
    const token = valOf(d, 'token');
    const pub = $id(d, 'public_render');
    const conts = [].slice.call(d.querySelectorAll('[id^="addproject_content_"]'));
    if (!token || !pub || !conts.length) return null;

    const blends = conts.map((c) => blendOf(c)).filter(Boolean);
    if (!blends.length) return null;

    return {
      token,
      upstream: upstreamVersion(),
      verified: UPSTREAM,
      /* 这一版多出来的元素（不在上面清单里）= 站点新加的控件，界面上要提示 */
      unknown: unknownIds(d),
      vis: {
        render: toggleOf(pub),
        mp4: toggleOf($id(d, 'generate_mp4'), 'mp4Hidden'),
        thumb: toggleOf($id(d, 'public_thumbnail'), 'thumbHidden'),
      },
      compute: computeOf(d),
      blends,
    };
  }

  const ANIM = /^addproject_animation_(start|end|step)_frame_(\d+)$/;
  const SINGLE = /^addproject_singleframe_start_frame_(\d+)$/;
  const RANGE_ANIM = /^addproject_split_animation_sample_range_value_(\d+)$/;
  const RANGE_SINGLE = /^addproject_split_sample_range_value_(\d+)$/;

  function blendOf(cont) {
    const m = /^addproject_content_(\d+)$/.exec(cont.id || '');
    if (!m) return null;
    const i = m[1];
    const form = cont.querySelector('form[id="addproject_' + i + '"]');
    const h4 = cont.querySelector('h4');
    const err = cont.querySelector('[id="addproject_error_box_' + i + '"]');
    const rej = cont.querySelector('div.error');
    const hidden = {};
    const readHidden = (key) => str(valOf(cont, 'addproject_' + key + '_' + i));
    ['exe', 'path', 'archive', 'engine', 'denoising', 'color_management', 'render_on_gpu_headless',
      'use_adaptive_sampling', 'framerate', 'output_path', 'width', 'height', 'cycles_samples',
      'samples_pixel', 'image_extension'].forEach((k) => { hidden[k] = readHidden(k); });

    const base = {
      i,
      name: h4 ? h4.textContent.trim() : (hidden.path || ('#' + i)),
      hidden,
      rejected: !form,
      reason: rej ? rej.textContent.replace(/\s+/g, ' ').trim() : '',
    };
    if (!form) return base;

    /* 类型：三形态 —— ①强制动画（EXR/降噪分支只有个 visibility:hidden 的 radio）
       ②可选（非 EXR 非降噪时给 Single frame / Animation 两个可见 radio） */
    const typeRadios = [].slice.call(form.querySelectorAll('input[name="addproject_change_type_' + i + '"]'));
    const forced = typeRadios.length === 1;
    const checkedType = (typeRadios.filter((r) => r.checked)[0] || typeRadios[0] || {}).value || 'animation';

    const num = (el) => (el ? el.value : '');
    const anim = {};
    const single = {};
    [].slice.call(form.querySelectorAll('[id]')).forEach((el) => {
      let mm;
      if ((mm = ANIM.exec(el.id))) anim[mm[1]] = el.value;
      else if ((mm = SINGLE.exec(el.id))) single.frame = el.value;
    });

    /* 切块三形态：①samples 滑条（engine=CYCLES 且不允许 tile）②tiles 下拉 ③站点定死（EXR/降噪） */
    const rangeAnim = form.querySelector('input[id^="addproject_split_animation_sample_range_value_"]');
    const rangeSingle = form.querySelector('input[id^="addproject_split_sample_range_value_"]');
    const tilesEl = form.querySelector('[id="addproject_split_tiles_number_' + i + '"]');
    let split;
    if (rangeAnim) {
      split = {
        kind: 'samples', min: Number(rangeAnim.min || 1), max: Number(rangeAnim.max || 64),
        value: Number(rangeAnim.value) || Number(rangeAnim.min || 1), tiles: -1,
      };
    } else if (tilesEl && tilesEl.tagName.toLowerCase() === 'select') {
      split = {
        kind: 'tiles', tiles: str(tilesEl.value),
        options: [].slice.call(tilesEl.options).map((o) => ({ v: str(o.value), label: o.textContent.trim() })),
      };
    } else if (rangeSingle) {
      split = {
        kind: 'samples-single', min: Number(rangeSingle.min || 4), max: Number(rangeSingle.max || 32),
        value: Number(rangeSingle.value) || Number(rangeSingle.min || 4), tiles: '',
      };
    } else {
      /* 没有可见控件：站点把 tiles 定死了（EXR/降噪分支是 1 = 整帧；单帧+降噪同理） */
      split = { kind: 'fixed', tiles: tilesEl ? str(tilesEl.value) : '' };
    }

    const advChk = form.querySelector('[id="checkbox_ad_' + i + '"]');
    const advBox = form.querySelector('[id="checkbox_advanced_option_' + i + '"]');
    const ram = form.querySelector('[id="addproject_max_ram_optional_' + i + '"]');

    return Object.assign(base, {
      type: forced ? 'animation' : (checkedType === 'singleframe' ? 'singleframe' : 'animation'),
      typeForced: forced,
      anim: { start: str(anim.start), end: str(anim.end), step: str(anim.step) },
      single: { frame: str(single.frame) },
      split,
      advanced: !!advChk && !!advBox,
      ram: ram ? str(ram.value) : '',
      notes: notesOf(form),
    });
  }

  /* ------------------------------------------------------------- 组提交体 */

  /** 27 键，顺序与站点 addproject.js:57-85 一致（顺序不影响服务端，但方便逐键比对）。 */
  const SUBMIT_KEYS = [
    'type', 'compute_method', 'executable', 'engine', 'denoising', 'color_management',
    'render_on_gpu_headless', 'token', 'public_render', 'public_thumbnail', 'generate_mp4',
    'start_frame', 'end_frame', 'step_frame', 'archive', 'max_ram_optional', 'path', 'framerate',
    'output_path', 'width', 'height', 'split_tiles', 'split_samples', 'use_adaptive_sampling',
    'cycles_samples', 'samples_pixel', 'image_extension',
  ];

  const numStr = (v) => {
    const n = parseInt(str(v).trim(), 10);
    return Number.isFinite(n) ? String(n) : '';
  };

  /**
   * model（服务端给的事实）+ ui（用户改的）→ 27 键。
   * 与站点 doAddProject 的逐键对应写在括号里；**不做任何"顺手修正"**，只做站点做的事：
   *   · 单帧项目：end_frame 恒为 0、step_frame 恒为 1（addproject.js:3-4,20-21）
   *   · 没滑条时 split_samples 发空串（站点那边是 undefined，jQuery 也发 `split_samples=`）
   *   · compute_method 是位掩码：CPU=1 GPU=8（addproject.js:24-30）
   */
  function buildPayload(model, ui) {
    const vis = ui.vis || {};
    const on = (k) => (vis[k] ? '1' : '0');
    const compute = ui.compute | 0;
    const out = [];
    model.blends.forEach((b) => {
      if (b.rejected) return;
      const u = (ui.blends || {})[b.i] || {};
      const anim = u.type !== 'singleframe';
      const key = (k) => str(b.hidden[k]);
      out.push({
        i: b.i,
        data: {
          type: anim ? 'animation' : 'singleframe',
          compute_method: String(compute),
          executable: key('exe'),
          engine: key('engine'),
          denoising: key('denoising'),
          color_management: key('color_management'),
          render_on_gpu_headless: key('render_on_gpu_headless'),
          token: model.token,
          public_render: on('render'),
          public_thumbnail: on('thumb'),
          generate_mp4: on('mp4'),
          start_frame: anim ? numStr(u.start) : numStr(u.frame),
          end_frame: anim ? numStr(u.end) : '0',
          step_frame: anim ? numStr(u.step) : '1',
          archive: key('archive'),
          max_ram_optional: str(u.ram == null ? b.ram : u.ram),
          path: key('path'),
          framerate: key('framerate'),
          output_path: key('output_path'),
          width: key('width'),
          height: key('height'),
          split_tiles: anim ? str(u.splitTiles == null ? b.split.tiles : u.splitTiles)
            : str(u.splitTiles == null ? '' : u.splitTiles),
          split_samples: u.splitSamples == null ? '' : str(u.splitSamples),
          use_adaptive_sampling: key('use_adaptive_sampling'),
          cycles_samples: key('cycles_samples'),
          samples_pixel: key('samples_pixel'),
          image_extension: key('image_extension'),
        },
      });
    });
    return out;
  }

  /** 提交前的本地校验：只挡"站点会崩/会静默建错项目"的输入，其余一律等服务端回话。 */
  function validate(model, ui) {
    const errs = [];
    if (!((ui.compute | 0) & 9)) errs.push(t('up3x.needCompute'));
    model.blends.forEach((b) => {
      if (b.rejected) return;
      const u = (ui.blends || {})[b.i] || {};
      const nm = b.name || ('#' + b.i);
      const isNum = (v) => /^\d+$/.test(str(v).trim());
      if (u.type === 'singleframe') {
        if (!isNum(u.frame)) errs.push(t('up3x.badFrame', { name: nm }));
        return;
      }
      if (!isNum(u.start) || !isNum(u.end) || !isNum(u.step)) { errs.push(t('up3x.badFrame', { name: nm })); return; }
      if (Number(u.end) < Number(u.start)) errs.push(t('up3x.badRange', { name: nm }));
      if (Number(u.step) < 1) errs.push(t('up3x.badStep', { name: nm }));
      if (u.ram && !isNum(u.ram)) errs.push(t('up3x.badRam', { name: nm }));
    });
    return errs;
  }

  /* ---------------------------------------------------------------- 请求 */

  /** 契约 C：提交。成功体是 `{scheme}://{host}/project/<id>`（ProjectController.php:430）。 */
  async function submit(payload) {
    const res = await fetch(URL_SUBMIT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams(payload).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, message: t('up3x.httpFail', { code: res.status }), raw: text };
    const body = text.trim();
    if (/^https?:\/\//i.test(body)) return { ok: true, url: body };
    return { ok: false, message: messageFrom(body) || body.slice(0, 400), raw: body };
  }

  /** 服务端的错误体：`<p class="error">…` / `<p><span style="color:red">…` / 纯文本。 */
  function messageFrom(html) {
    const s = str(html);
    if (!s.trim()) return '';
    if (/^(missing parameter|Failed to add project)$/i.test(s.trim())) return s.trim();
    const d = parseDoc(s);
    const box = d.querySelector('p.error, .error, .alert');
    const src = box || d.body;
    if (!src) return '';
    const txt = (src.textContent || '').replace(/\s+/g, ' ').trim();
    return txt.length > 600 ? txt.slice(0, 600) + '…' : txt;
  }

  const JSONish = /^\s*[{[]/;

  /** 契约 B：轮询分析状态。 */
  async function analyse(token) {
    const res = await fetch(analyseUrl(token), {
      credentials: 'include', cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) return { kind: 'error', message: t('up3x.httpFail', { code: res.status }) };
    const text = await res.text();
    if (JSONish.test(text)) {
      let o = null;
      try { o = JSON.parse(text); } catch (e) { o = null; }
      if (!o) return { kind: 'error', message: t('up3x.analyseOdd') };
      if (o.status === 'RETRY') return { kind: 'retry' };
      if (o.status === 'PROCESSING') return { kind: 'processing', done: Number(o.analysed) || 0, total: Number(o.total) || 0 };
      return { kind: 'done', html: text };
    }
    /* 不是 JSON：可能是 FINISHED 的碎片，也可能是整页错误（"找不到编号"/其他）或那句
       'Internal error, please retry to upload your file' */
    if (/^\s*<(!doctype|html)/i.test(text)) {
      if (/Failed to find uploaded file/i.test(text)) return { kind: 'gone' };
      return { kind: 'error', message: messageFrom(text) || t('up3x.analyseOdd') };
    }
    if (/addproject_content_|id="token"/.test(text)) return { kind: 'done', html: text };
    return { kind: 'error', message: messageFrom(text) || t('up3x.analyseOdd') };
  }

  /** 契约 A：上传。用 XHR 是为了拿到真正的上传进度（站点靠轮询 /project/internal/progress，
      我们不需要那一趟：XMLHttpRequest.upload.onprogress 就是浏览器自己报的字节数）。 */
  function upload(file, onProgress) {
    return new Promise((resolve) => {
      const uid = (function () {
        const a = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(a);
        return [].map.call(a, (b) => ('0' + b.toString(16)).slice(-2)).join('');
      })();
      const fd = new FormData();
      fd.append('UPLOAD_IDENTIFIER', uid);
      fd.append('addproject_archive', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', URL_UPLOAD, true);
      xhr.withCredentials = true;
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
      }
      xhr.onload = () => resolve(classifyUpload(xhr));
      xhr.onerror = () => resolve({ ok: false, message: t('up3x.netFail') });
      /* onabort 只应对浏览器自己的中断（导航、连接被断）：界面上没有中止入口。 */
      xhr.onabort = () => resolve({ ok: false, message: t('up3x.netFail') });
      xhr.send(fd);
    });
  }

  /** 上传的三种结局：跳到第二步（成功）/ 纯文本原因（addProjectCheck）/ error 页（后缀、大小…） */
  function classifyUpload(xhr) {
    const url = xhr.responseURL || '';
    const m = /\/project\/add\/([^/?#]+)/.exec(url);
    if (m) return { ok: true, token: decodeURIComponent(m[1]), url };
    if (xhr.status === 401 || xhr.status === 403) return { ok: false, message: t('state.loggedOut') };
    const text = str(xhr.responseText);
    if (xhr.status !== 200) return { ok: false, message: t('up3x.httpFail', { code: xhr.status }), raw: text };
    if (/Upload new project|add_step2/i.test(text)) {
      /* 兜底：有些路径回的是第二步整页但地址没变（理论上不会），那就当成功，让用户自己走第二步 */
      const tk = /doAnalyseUploadedProject\('([^']+)'\)/.exec(text);
      if (tk) return { ok: true, token: tk[1] };
    }
    return { ok: false, message: messageFrom(text) || t('up3x.uploadOdd'), raw: text };
  }

  /* ------------------------------------------------------------- 「原版」用 */

  /** /getstarted 那一页：上传表单在不在、站点是不是拦住了（HTML.php:2091-2108）。 */
  function uploadPage(html) {
    const d = parseDoc(html);
    const form = d.querySelector('form[action*="/project/internal/upload"]');
    const uid = form && d.querySelector('input[name="UPLOAD_IDENTIFIER"]');
    const warn = d.getElementById('addproject_warning_zero_frame');
    const note = (function () {
      const cell = form && form.querySelector('input[name="addproject_archive"]');
      const td = cell && cell.closest('td');
      return td ? td.textContent.replace(/\s+/g, ' ').trim() : '';
    })();
    const lim = limitOf(note);
    return {
      hasForm: !!form,
      warning: warn ? warn.textContent.replace(/\s+/g, ' ').trim() : '',
      note,
      /* 上限文案（"Max: 2,048 MB"）在本地就能拦住选错的文件 —— 拿在手里只用来拼提示等于白解析。
         站点不写上限时是 0 = 不判断。提示里照抄站点那个单位（"2,048 MB"），别换算成 "2.0 GB"。 */
      limitBytes: lim.bytes,
      limitText: lim.text,
      uid: uid ? str(uid.value) : '',
    };
  }

  /** "Max: 2,048 MB before ZIP compression" → { text: '2,048 MB', bytes: 2147483648 }。解析不出来返回 0/''。 */
  function limitOf(note) {
    const m = /Max:\s*([\d.,]+\s*[KMGT]?B)/i.exec(str(note));
    if (!m) return { bytes: 0, text: '' };
    const text = m[1].replace(/\s+/g, ' ');
    const n = Number((/([\d.,]+)/.exec(text) || [])[1].replace(/,/g, ''));
    const unit = ((/[KMGT]?B/i.exec(text) || [''])[0] || '').toUpperCase();
    const mult = { B: 1, KB: 1024, MB: Math.pow(1024, 2), GB: Math.pow(1024, 3), TB: Math.pow(1024, 4) }[unit];
    return { bytes: Number.isFinite(n) && mult ? Math.round(n * mult) : 0, text };
  }

  /* ------------------------------------------------------------- 估算器 */

  /** 契约 D：估算器。POST /project/estimator（ProjectController.php:925-997）——
      time = 每帧分钟数，count = 帧数，device = `cpu_<id>` 或 `gpu_<id>`（下面那个接口给的 value）。 */
  async function estimator(fields) {
    const res = await fetch('/project/estimator', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({
        time: String(fields.time), count: String(fields.count), device: String(fields.device),
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: 'http', message: t('up3x.httpFail', { code: res.status }) };
    const plain = text.trim();
    /* 服务端认不出设备时回的就是这两句纯文本（:990 / :995） */
    if (/^failed/i.test(plain)) return { ok: false, reason: plain, message: '' };
    const d = parseDoc(text);
    const body = d.body ? d.body.textContent : text;
    const cost = (function () { const m = /([\d,.]+)\s*points/i.exec(body); return m ? m[1] : ''; })();
    const rows = [].slice.call(d.querySelectorAll('table tbody tr')).map((tr) => {
      const tds = [].slice.call(tr.children);
      return tds.map((td) => ({
        text: (td.textContent || '').replace(/\s+/g, ' ').trim(),
        good: !!td.querySelector('.label-success'),
      }));
    });
    return { ok: true, cost, rows };
  }

  /** 设备自动补全：GET /device/search?term=（DeviceController.php:45-）→ [{value:'cpu_12',label:'…'}]。
      站点遇到非法字符会回一条 value='#' 的提示，那条不是设备，过滤掉。 */
  async function deviceSearch(term) {
    const res = await fetch('/device/search?term=' + encodeURIComponent(String(term)), {
      credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });
    if (!res.ok) return [];
    let list = null;
    try { list = await res.json(); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    return list.filter((o) => o && o.value && o.value !== '#')
      .map((o) => ({ value: String(o.value), label: String(o.label == null ? '' : o.label) }));
  }

  SP.Chain = {
    UPSTREAM, upstreamVersion,
    SUBMIT_KEYS, buildPayload, validate,
    parseStep3, uploadPage,
    submit, analyse, upload,
    estimator, deviceSearch,
    analyseUrl, step2Url, messageFrom,
  };
})();

/* ===== src/64-step1.js ===== */
/* ==== 64-step1.js：新版上传 · 第一步「上传」（自绘，0.2.0）========================

   契约（站点源码）：
     页面    /getstarted 最后一段（HTML.php:2021 printCreateProject）。站点在这里给的是
             **纯 PHP 拼的 HTML**，我们只当数据源读两件事：表单在不在（没给就是前置拦截：
             renderedFrames<10 且公共剩余帧>5000，HTML.php:2091-2108）、文件上限文案。
     上传    POST /project/internal/upload（multipart：addproject_archive + UPLOAD_IDENTIFIER）
             成功 → 302 /project/add/<token>；失败 → 200 纯文本原因（维护中/没头像/并发上限…）
             或 error 页（后缀不对/太大）
     估算器  POST /project/estimator + GET /device/search?term=（ProjectController.php:925-997）

   站点的进度条靠轮询 POST /project/internal/progress；我们用 XHR 自己的 upload 进度事件，
   少一趟请求，也少一份状态。上传成功就让浏览器跳到第二步（那一页由 66 那边接管）。 */

(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Step1) return;
  const { Util, I18n } = SP;
  const t = SP.t;

  const mk = (tag, cls, txt) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  };
  const zh = (s) => (I18n && I18n.siteText ? (I18n.siteText(s) || s) : s);

  let picked = null;        // 选中的 File（input 与拖放共用）
  let busy = false;         // 上传中：不许再点

  /* ---------------------------------------------------------------- 数据 */

  /** 站点"上传须知"那段 <ul>（HTML.php:2219+），只取文字 */
  function rulesFrom(html) {
    const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const head = [].slice.call(d.querySelectorAll('h4')).filter((x) => /Before adding a file/i.test(x.textContent))[0];
    if (!head) return [];
    let ul = head.nextElementSibling;
    while (ul && ul.tagName !== 'UL') ul = ul.nextElementSibling;
    if (!ul && head.parentNode) ul = head.parentNode.querySelector('ul');
    if (!ul) return [];
    return [].slice.call(ul.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim());
  }

  function limitFrom(note) {
    const m = /Max:\s*([\d.,]+\s*[KMGT]?B)/i.exec(note || '');
    return m ? m[1] : '';
  }

  /* ---------------------------------------------------------------- 上传 */

  function buildForm(slot, page, html) {
    slot.textContent = '';
    if (!page.hasForm) {
      /* 站点根本没给表单 = 前置拦截（欠帧/维护/没头像/并发上限…），原文照译 */
      const box = mk('div', 'up1-msg bad');
      box.textContent = page.warning ? zh(page.warning) : t('up1.gate');
      slot.appendChild(box);
      return;
    }

    /* 站点这次给的上限，在本地就拦住选错的文件（拿在手里只用来拼提示等于白解析）。
       提示里用站点自己的单位（"2,048 MB"），别换算成 "2.0 GB"。 */
    const maxBytes = page.limitBytes || 0;
    const maxText = page.limitText || (maxBytes ? fmtSize(maxBytes) : '');
    const drop = mk('div', 'up1-drop');
    const title = mk('div', 'up1-droptitle');
    title.appendChild(document.createTextNode(t('up1.pick') + ' '));
    /* 复用站内已有的 label.filepick（头像那个也是它）：原生 file input 塞在 label 里、
       1px 透明，Tab 顺序保得住，外观由 label 承担。 */
    const pick = mk('label', 'filepick');
    pick.appendChild(document.createTextNode(t('up1.pickBtn')));
    const inp = mk('input');
    inp.type = 'file';
    inp.accept = '.blend,.zip';
    inp.className = 'up1-input';
    pick.appendChild(inp);
    title.appendChild(pick);
    drop.appendChild(title);
    drop.appendChild(mk('div', 'up1-dropsub', t('up1.pickSub', { size: limitFrom(page.note) || t('up1.anySize') })));
    /* 选中的文件显示在**这个框里**（用户 2026-10-07）：框本身就是"放文件的地方"，
       把结果摆到框外另起一行，看起来像两件事。 */
    const nameEl = mk('div', 'up1-name');
    nameEl.hidden = true;
    drop.appendChild(nameEl);
    const bar = mk('div', 'up1-bar');
    /* 读屏用户拿不到进度与结果：进度条与消息行都要能被播报（全 src 里 role=progressbar/aria-live 本来是 0） */
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.hidden = true;
    const fill = mk('i');
    bar.appendChild(fill);
    const pct = mk('div', 'up1-pct');
    pct.hidden = true;
    const msg = mk('div', 'up1-msg');
    msg.setAttribute('aria-live', 'polite');
    msg.hidden = true;
    const foot = mk('div', 'up1-foot');
    const btn = mk('button', 'btn primary');
    btn.type = 'button';
    btn.textContent = t('up1.go');
    btn.disabled = true;   // 未选文件时它不是"已就绪"——以前那是一颗满血主色按钮
    foot.appendChild(btn);

    slot.appendChild(drop);
    /* 投递之前就说清"传完会发生什么"：这句话以前只存在于下一个页面，也就是用户已经无法反悔之后 */
    slot.appendChild(mk('div', 'up1-after', t('up1.after')));
    slot.appendChild(bar);
    slot.appendChild(pct);
    slot.appendChild(msg);
    slot.appendChild(foot);

    const say = (text, bad) => {
      msg.textContent = text || '';
      msg.hidden = !text;
      msg.classList.toggle('bad', !!bad);
    };
    /* 剩余时间：onProgress 已经把 loaded/total 给了我们，速率取滑动平均，别只报百分比 */
    const rate = { t: 0, loaded: 0, speed: 0 };
    const fmtEta = (sec) => {
      if (!Number.isFinite(sec) || sec <= 0) return '';
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return m + ':' + ('0' + s).slice(-2);
    };
    const etaOf = (loaded, total) => {
      const now = Date.now();
      if (!rate.t) { rate.t = now; rate.loaded = loaded; return ''; }
      const dt = (now - rate.t) / 1000;
      const dl = loaded - rate.loaded;
      if (dt >= 0.6 && dl > 0) {
        const inst = dl / dt;
        rate.speed = rate.speed ? rate.speed * 0.7 + inst * 0.3 : inst;
        rate.t = now;
        rate.loaded = loaded;
      }
      return rate.speed ? fmtEta((total - loaded) / rate.speed) : '';
    };
    const show = (f) => {
      picked = null;
      nameEl.hidden = true;
      if (!f) { nameEl.textContent = ''; btn.disabled = true; return; }
      if (!/\.(blend|zip)$/i.test(f.name)) {
        nameEl.textContent = '';
        btn.disabled = true;
        say(t('up1.badType', { name: f.name }), true);
        return;
      }
      if (maxBytes && f.size > maxBytes) {
        nameEl.textContent = '';
        btn.disabled = true;
        say(t('up1.tooBig', { name: f.name, size: fmtSize(f.size), max: maxText }), true);
        return;
      }
      say('');
      picked = f;
      nameEl.textContent = t('up1.picked', { name: f.name, size: fmtSize(f.size) });
      nameEl.hidden = false;
      btn.disabled = busy;
    };

    drop.addEventListener('click', (e) => {
      /* 点在 label.filepick 上由标签自己开文件框；点别处我们代开 */
      if (e.target && e.target.closest && e.target.closest('.filepick')) return;
      inp.click();
    });
    inp.addEventListener('change', () => show(inp.files && inp.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) show(f);
    });

    btn.addEventListener('click', async () => {
      if (busy) return;
      if (!picked) { say(t('up1.noFile'), true); return; }
      busy = true;
      btn.disabled = true;
      btn.textContent = t('up1.goBusy');
      say('');
      bar.hidden = false;
      pct.hidden = false;
      fill.style.width = '0%';
      pct.textContent = t('up1.uploading', { pct: 0 });
      rate.t = 0; rate.loaded = 0; rate.speed = 0;

      const r = await SP.Chain.upload(picked, (loaded, total) => {
        const p = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        fill.style.width = p + '%';
        bar.setAttribute('aria-valuenow', String(p));
        if (p >= 100) { pct.textContent = t('up1.sending'); return; }
        if (!total) { pct.textContent = t('up1.uploading', { pct: p }); return; }
        const eta = etaOf(loaded, total);
        pct.textContent = eta
          ? t('up1.progress', { done: fmtSize(loaded), total: fmtSize(total), eta })
          : t('up1.progressNoEta', { done: fmtSize(loaded), total: fmtSize(total) });
      });

      busy = false;
      btn.textContent = t('up1.go');
      if (r.ok) {
        pct.textContent = t('up1.jumping');
        location.href = SP.Chain.step2Url(r.token);
        return;
      }
      bar.hidden = true;
      pct.hidden = true;
      btn.disabled = !picked;
      say(r.message || t('up1.fail'), true);
    });
  }

  function fmtSize(n) {
    if (!Number.isFinite(n)) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
  }

  /* -------------------------------------------------------------- 估算器 */

  function buildEst(slot) {
    slot.textContent = '';
    let devValue = '';

    const dev = mk('div', 'up1-dev');
    const devInp = mk('input');
    devInp.type = 'text';
    devInp.className = 'up1-devin';
    devInp.placeholder = t('up1.devPh');
    devInp.autocomplete = 'off';
    const sug = mk('div', 'up1-sug');
    sug.hidden = true;
    dev.appendChild(devInp);
    dev.appendChild(sug);

    const fields = mk('div', 'up1-estfields');
    const timeF = mk('div', 'up1-fld');
    timeF.appendChild(mk('label', null, t('up1.time')));
    const timeInp = mk('input');
    timeInp.type = 'text';
    timeInp.inputMode = 'decimal';
    timeF.appendChild(timeInp);
    const cntF = mk('div', 'up1-fld');
    cntF.appendChild(mk('label', null, t('up1.count')));
    const cntInp = mk('input');
    cntInp.type = 'text';
    cntInp.inputMode = 'numeric';
    cntF.appendChild(cntInp);
    fields.appendChild(timeF);
    fields.appendChild(cntF);

    const foot = mk('div', 'up1-foot');
    /* 次级样式：估算不改变服务器上的任何东西，按 DESIGN.md 的 One Commit Rule 它不配穿主色
       （以前它和「开始上传」同为满主色，同屏两个等权按钮） */
    const btn = mk('button', 'btn');
    btn.type = 'button';
    btn.textContent = t('up1.estGo');
    foot.appendChild(btn);

    const out = mk('div', 'up1-estout');
    const msg = mk('div', 'up1-msg');
    msg.hidden = true;
    const say = (text, bad) => {
      msg.textContent = text || '';
      msg.hidden = !text;
      msg.classList.toggle('bad', !!bad);
    };

    slot.appendChild(mk('div', 'up1-tip', t('up1.estTip')));
    slot.appendChild(dev);
    slot.appendChild(fields);
    slot.appendChild(foot);
    slot.appendChild(msg);
    slot.appendChild(out);

    /* 设备名：站点那个 jQuery UI autocomplete 的替代品，走同一个 GET /device/search */
    let timer = null;
    let seq = 0;
    const closeSug = () => { sug.hidden = true; sug.textContent = ''; };
    devInp.addEventListener('input', () => {
      devValue = '';
      closeSug();
      const term = devInp.value.trim();
      if (term.length < 3) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const my = ++seq;
        const list = await SP.Chain.deviceSearch(term);
        if (my !== seq) return;
        sug.textContent = '';
        if (!list.length) { closeSug(); return; }
        list.slice(0, 12).forEach((o) => {
          const li = mk('div', 'up1-sugitem', o.label);
          /* 键盘也够得着：这条路径强制"必须从建议里选"，纯 click 的 div 等于把键盘用户挡死 */
          li.tabIndex = 0;
          li.setAttribute('role', 'option');
          const pickIt = () => { devValue = o.value; devInp.value = o.label; closeSug(); };
          li.addEventListener('click', pickIt);
          li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIt(); }
          });
          sug.appendChild(li);
        });
        sug.hidden = false;
      }, 250);
    });
    devInp.addEventListener('blur', () => setTimeout(closeSug, 180));

    btn.addEventListener('click', async () => {
      const time = Number(String(timeInp.value).replace(',', '.'));
      const count = Number(cntInp.value);
      say('');
      out.textContent = '';
      if (!devValue) { say(t('up1.devPick'), true); return; }
      if (!(time > 0) || !(count > 0)) { say(t('up1.estNeed'), true); return; }
      btn.disabled = true;
      btn.textContent = t('up1.estimating');
      const r = await SP.Chain.estimator({ time, count, device: devValue });
      btn.disabled = false;
      btn.textContent = t('up1.estGo');
      if (!r.ok) {
        say(r.reason === 'failed to import device' ? t('up1.devPick') : (r.message || t('up1.estFail')), true);
        return;
      }
      if (r.cost) {
        const c = mk('div', 'up1-cost');
        c.innerHTML = t('up1.cost', { pts: '<b>' + Util.esc(r.cost) + '</b>' });
        out.appendChild(c);
      }
      if (r.rows.length) {
        const tbl = mk('table', 'tbl up1-tbl');
        const thead = mk('thead');
        const tr = mk('tr');
        tr.appendChild(mk('th', null, t('up1.tiles')));
        tr.appendChild(mk('th', null, t('up1.perTile')));
        thead.appendChild(tr);
        tbl.appendChild(thead);
        const tb = mk('tbody');
        r.rows.forEach((cells) => {
          const row = mk('tr');
          cells.forEach((c, idx) => {
            const td = mk('td');
            if (idx === 1 && c.good) td.className = 'ok';
            td.textContent = /^no split$/i.test(c.text) ? t('up1.noSplit') : c.text;
            row.appendChild(td);
          });
          tb.appendChild(row);
        });
        tbl.appendChild(tb);
        out.appendChild(tbl);
      }
      if (!out.childNodes.length) say(t('up1.estFail'), true);
    });
  }

  /* ---------------------------------------------------------------- 须知 */

  /** 须知：站点那几条 `<li>` 里带 `<strong>`，按 textContent 拼成一整句反而匹配不上词典
      （词典是按文本节点/整块两种粒度写的）。所以**原样克隆节点**，再走 DOM 翻译器那一趟。 */
  function buildRules(slot, html) {
    slot.textContent = '';
    const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const head = [].slice.call(d.querySelectorAll('h4')).filter((x) => /Before adding a file/i.test(x.textContent))[0];
    let src = null;
    if (head) {
      src = head.nextElementSibling;
      while (src && src.tagName !== 'UL') src = src.nextElementSibling;
      if (!src && head.parentNode) src = head.parentNode.querySelector('ul');
    }
    const ul = mk('ul', 'up1-rules');
    if (src) [].slice.call(src.children).forEach((li) => ul.appendChild(document.importNode(li, true)));
    if (!ul.children.length) { slot.appendChild(mk('div', 'up1-tip', t('up1.noRules'))); return; }
    slot.appendChild(ul);
    /* 这是我们自己的卡片，里面的站点原文也该是中文：临时打开翻译器那一趟（用户的总开关不参与）。 */
    const di = SP.DomI18n;
    if (di && di.translateSubtree) {
      const keep = di.enabled;
      di.enabled = true;
      try { di.translateSubtree(ul); } finally { di.enabled = keep; }
    }
    /* 站点把句号写在 <strong> 外面（`…3.0 or higher</strong>.`）：中文译文自己带句号，
       后面那个 "." 就成了「。.」——译文已经以句末标点收尾时，把那个孤零零的 "." 去掉。 */
    [].slice.call(ul.querySelectorAll('li')).forEach((li) => {
      const last = li.lastChild;
      if (!last || last.nodeType !== 3) return;
      const tail = last.nodeValue.trim();
      if (!/^[.．。]+$/.test(tail)) return;
      const before = li.textContent.slice(0, li.textContent.length - tail.length).trimEnd();
      /* 站点把句号写在 <strong> 外面（`…relative paths</strong>.`）：中文译文已经以句末标点收尾时
         直接去掉，否则把那个半角 "." 换成中文句号 —— 以前只做前半段，于是留下「相对路径.」 */
      if (/[。．.！!？?]$/.test(before)) last.nodeValue = '';
      else last.nodeValue = '。';
    });
    /* 2026-10-07 用户拍板：须知**不折叠**，12 条原样平铺。折叠省的那点版面，换来的是
       "还有几条被藏起来了"的猜疑，不划算。 */
  }

  /* ---------------------------------------------------------------- 入口 */

  /** 把站点的 /getstarted 当数据源，三个槽位全部自绘。返回 false = 页面结构不认识。 */
  function mount(root, html) {
    if (!root || !html) return false;
    const page = SP.Chain.uploadPage(html);
    const form = root.querySelector('[data-up="form"]');
    const est = root.querySelector('[data-up="est"]');
    const rules = root.querySelector('[data-up="rules"]');
    if (!form || !est || !rules) return false;
    /* 站点连表单都没给时，估算器与须知也没有意义 */
    buildForm(form, page, html);
    if (page.hasForm) {
      buildEst(est);
      buildRules(rules, html);
    } else {
      est.textContent = '';
      rules.textContent = '';
    }
    return true;
  }

  SP.Step1 = { mount, rulesFrom, limitFrom, fmtSize };
})();

/* ===== src/68-step3.js ===== */
/* ==== 68-step3.js：新版上传 · 第三步「设置」（自绘，0.2.0）========================

   与已砍掉的兼容档那一套的根本区别：**不再搬站点的活节点**。
   服务端那份 HTML 只在 62-chain.js 里被 DOMParser 解析成数据，页面上从头到尾只有我们
   这一套 DOM、这一套 id，提交也是我们自己发（POST /project/add_internal，27 键）。
   于是 0.1.14–0.1.17 反复踩的那一类缺陷（两份同名控件、站点 JS 抢 DOM、$('#id') 取到
   隐藏原件）在结构上不可能出现。

   边界没变：**服务端只认 POST 键，不认 DOM**。所以自绘控件不违反任何契约；
   所有隐藏值（引擎、分辨率、采样、路径…）原样来自解析结果，一个字节都不改。

   版式（用户 2026-10-07 两轮意见的落点）：
     · 概览 = 站点算出来的事实：一行 chips（存档 / 文件数 / 上游版本）+ 每个文件一行（引擎、
       分辨率、帧率、采样、格式…）——只显示，不改，提交时原样发回
     · 上半 = 硬件需求（项目级，一个块三行）：可见性 / 计算方式 / 内存占用
       （内存是每个文件一个值，服务端契约如此；站点原来用「高级选项」勾选框只控制显隐，
        不影响提交内容，所以这里不设勾选框，留空即自动探测）
     · 下半 = 画面设置（每个 .blend 一块）：类型 / 帧范围 / 切块 / 提交；块之间只隔一条发丝线
     · 站点写的说明（降噪、EXR 限制、缺文件…）带强调线，不再是一行灰字
     · 字号一律走站内那套：标题 13.5 / 正文 13 / 次要 12.5 / 提示 12 */

(function () {
  'use strict';

  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || SP.Step3x) return;
  const { Util, UI, I18n } = SP;
  const t = SP.t;
  const esc = Util.esc;

  const REPORT_KEY = 'up3Report';
  const mk = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
  /* 这一版的 mk 不收文本（只有 tag+class），别再把第三参当文本传 —— 会被静默丢掉 */
  const tipRow = (txt) => { const el = mk('div', 'up3-tiprow up3-tip'); el.textContent = txt; return el; };

  /* 同名 radio 在同一个文档里算**一组**，会互相取消勾选：每次 render 用自己的后缀。 */
  let seq = 0;

  /** 站点说明里属于"为什么不能切块"的那几句（降噪那两行）；其余（EXR 清单、缺文件、驱动）另摆。 */
  const SPLIT_REASON = /denois|splits?\b|tile/i;

  /** 站点原文 → 中文（没命中就原样）。说明文字是站点写的，翻译表在 12-lang-zh.js。 */
  const zh = (s) => (I18n && I18n.siteText ? (I18n.siteText(s) || s) : s);

  function saveReport(rep) { try { Util.store.set(REPORT_KEY, rep); } catch (e) { /* 隐私模式 */ } }
  function report() {
    const r = Util.store.get(REPORT_KEY, null);
    return r && typeof r === 'object' ? r : null;
  }

  /** 数字好看一点：服务端 width 是 resolution_x * percentage / 100，可能是 160.0000001 */
  const num = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || String(v).trim() === '') return String(v);
    return String(Math.round(n * 100) / 100);
  };

  /* ------------------------------------------------------------------ 小组件 */

  function line(k, content) {
    const l = mk('div', 'up3-line');
    const a = mk('div', 'up3-k');
    a.textContent = k;
    const b = mk('div', 'up3-c');
    if (typeof content === 'string') b.innerHTML = content; else b.appendChild(content);
    l.appendChild(a);
    l.appendChild(b);
    return l;
  }

  function tip(text) {
    const d = mk('div', 'up3-tip');
    d.textContent = text;
    return d;
  }

  /** 选项行：<label class="up3-opt" title="…"><input …><span>文字</span></label> */
  function opt(kind, name, value, label, opts) {
    const o = opts || {};
    const lb = mk('label', 'up3-opt' + (o.cls ? ' ' + o.cls : ''));
    const inp = mk('input');
    inp.type = kind;
    if (name) inp.name = name;
    if (value != null) inp.value = value;
    inp.checked = !!o.checked;
    if (o.disabled) inp.disabled = true;
    /* 说明一律进悬停提示（用户 2026-10-07：别在界面上铺一句话） */
    if (o.title) lb.title = o.title;
    lb.appendChild(inp);
    const sp = mk('span');
    sp.textContent = label;
    lb.appendChild(sp);
    return lb;
  }

  function fld(label, opts) {
    const o = opts || {};
    const box = mk('div', 'up3-fld');
    const lb = mk('label');
    lb.textContent = label;
    if (o.title) lb.title = o.title;
    const inp = mk('input');
    inp.type = 'text';
    inp.value = o.value == null ? '' : String(o.value);
    inp.inputMode = 'numeric';
    inp.autocomplete = 'off';
    if (o.size) inp.size = o.size;
    if (o.placeholder) inp.placeholder = o.placeholder;
    if (o.title) inp.title = o.title;
    box.appendChild(lb);
    box.appendChild(inp);
    box._input = inp;
    return box;
  }

  /** 滑条 + 读数：站点那两个 range 的 value="0" 会被浏览器夹到 min，这里直接给 min。 */
  function slider(label, min, max, value) {
    const box = mk('div', 'up3-slider');
    const lb = mk('label');
    lb.textContent = label;
    const inp = mk('input');
    inp.type = 'range';
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(value);
    const out = mk('span', 'up3-read');
    const paint = () => { out.textContent = t('up3x.nTiles', { n: inp.value }); };
    inp.addEventListener('input', paint);
    paint();
    box.appendChild(lb);
    box.appendChild(inp);
    box.appendChild(out);
    box._input = inp;
    return box;
  }

  /** 站点给这个文件算出来的事实（只显示，不改；提交时也原样发回去） */
  function blendFacts(b) {    const h = b.hidden || {};
    const out = [];
    if (h.engine) out.push(t('up3x.mEngine', { v: h.engine }));
    if (h.exe) out.push(t('up3x.mBlender', { v: h.exe }));
    if (h.width && h.height) out.push(t('up3x.mRes', { w: num(h.width), h: num(h.height) }));
    if (h.framerate) out.push(t('up3x.mFps', { v: num(h.framerate) }));
    if (h.cycles_samples) out.push(t('up3x.mSamples', { v: num(h.cycles_samples) }));
    if (h.samples_pixel) out.push(t('up3x.mPerPixel', { v: h.samples_pixel }));
    if (h.image_extension) out.push(h.image_extension);
    if (h.denoising === '1') out.push(t('up3x.mDenoise'));
    if (h.use_adaptive_sampling === '1') out.push(t('up3x.mAdaptive'));
    if (h.render_on_gpu_headless === '1') out.push(t('up3x.mHeadless'));
    if (h.color_management === '1') out.push(t('up3x.mColorMgmt'));
    if (h.output_path) out.push(t('up3x.mOutput', { v: h.output_path }));
    return out;
  }

  /* ------------------------------------------------------------------ 渲染 */

  /**
   * @param box   #sp-an-result（我们自己的容器）
   * @param model 62-chain.js parseStep3() 的结果
   * @returns {{ok:boolean, reason?:string}}
   */
  function render(box, model) {
    if (!box || !model) return { ok: false, reason: 'args' };
    box.textContent = '';
    box.hidden = false;
    box.classList.add('sp-up3');

    const uid = 'sp3-' + (++seq);
    const root = mk('div', 'up3');
    const state = { vis: {}, compute: 0, blends: {} };
    const msg = mk('div', 'up3-msg');
    msg.hidden = true;

    /* 状态先摆好：内存那一行在上半部分，但它写的是每个文件的值（服务端契约如此） */
    model.blends.forEach((b) => {
      state.blends[b.i] = b.rejected ? { rejected: true } : {
        type: b.type, start: b.anim.start, end: b.anim.end, step: b.anim.step || '1',
        frame: b.single.frame, ram: b.ram,
        splitTiles: b.split.tiles,
        splitSamples: (b.split.kind === 'samples' || b.split.kind === 'samples-single') ? String(b.split.value) : '',
      };
    });

    /* ① 不再有"抬头行"与"存档/文件"那行概览。
       2026-10-07 用户两条意见：一、「存档 sptest」这种说法看不懂，而且和下面每个 .blend 的名字
       重复；二、页头已经说了这是什么页（h2「项目设置」），卡片里再来一次就是复读。
       直接进内容：上半是硬件需求，下半是每个 .blend 一块。 */

    /* ② 上半：硬件需求（一个块三行） */
    const group = mk('div', 'up3-group');

    const visBox = mk('div', 'up3-opts');
    let visAny = false;
    [['render', model.vis.render, 'up3x.render', 'up3x.renderTip'],
      ['mp4', model.vis.mp4, 'up3x.mp4', 'up3x.mp4Tip'],
      ['thumb', model.vis.thumb, 'up3x.thumb', 'up3x.thumbTip']].forEach(([key, def, lbl, tipKey]) => {
      if (def.kind === 'none') return;
      visAny = true;
      const hidden = def.kind === 'hidden';
      /* 站点锁死的开关：为什么锁 + 最终结果，全塞进悬停提示，界面上不铺文字 */
      const title = hidden
        ? t(tipKey) + '\n' + t('up3x.forcedTip', { state: def.force ? t('up3x.yes') : t('up3x.no') })
        : t(tipKey);
      const o = opt('checkbox', null, null, t(lbl), {
        checked: hidden ? !!def.force : !!def.on, disabled: hidden, title,
      });
      state.vis[key] = hidden ? false : !!def.on;   // 站点对 hidden 一律发 "0"（.is(':checked') 为假）
      const inp = o.querySelector('input');
      inp.addEventListener('change', () => { state.vis[key] = inp.checked; });
      visBox.appendChild(o);
    });
    if (visAny) group.appendChild(line(t('up3.vis'), visBox));

    const compute = model.compute;
    if (compute.cpuOn) state.compute |= 1;
    if (compute.gpuOn) state.compute |= 8;
    if (!state.compute) state.compute = compute.canCpu ? 1 : (compute.canGpu ? 8 : 0);
    const cpuBox = mk('div', 'up3-cmps');
    const addCompute = (bit, can, lbl, hint) => {
      if (!can) return;
      const o = opt('radio', uid + '-compute', String(bit), t(lbl), { checked: !!(state.compute & bit), cls: 'up3-cmp' });
      const el = o.querySelector('input');
      el.addEventListener('change', () => { if (el.checked) state.compute = bit; });
      const wrap = mk('div', 'up3-cmpbox');
      wrap.appendChild(o);
      const parts = [];
      if (hint && hint.queue) parts.push(t('up3x.queue', { v: hint.queue }));
      if (hint && hint.total) parts.push(t('up3x.total', { n: hint.total }));
      if (parts.length) {
        const h = mk('div', 'up3-tip');
        h.textContent = parts.join(' · ');
        wrap.appendChild(h);
      }
      cpuBox.appendChild(wrap);
    };
    addCompute(1, compute.canCpu, 'up3x.cpu', compute.cpuHint);
    addCompute(8, compute.canGpu, 'up3x.gpu', compute.gpuHint);
    if (cpuBox.childNodes.length) group.appendChild(line(t('up3.cpu'), cpuBox));

    /* 内存占用：属于硬件需求，跟着计算方式放。默认**折叠**（不指定 = 站点在渲染第一帧时自动探测）；
       勾上「手动指定」才展开输入框。值本身是每个文件一个（服务端契约），多文件时一行一个。 */
    const ramBox = mk('div', 'up3-rams');
    const liveBlends = model.blends.filter((b) => !b.rejected);
    if (liveBlends.length) {
      const preRam = liveBlends.some((b) => b.ram);
      const ck = opt('checkbox', null, null, t('up3x.ramManual'), { cls: 'up3-ramck', checked: preRam, title: t('up3x.ramAuto') });
      ramBox.appendChild(ck);
      const fields = mk('div', 'up3-ramfields');
      fields.hidden = !preRam;
      liveBlends.forEach((b) => {
        const w = mk('div', 'up3-ram');
        if (liveBlends.length > 1) {
          const l = mk('label');
          l.textContent = b.name;
          w.appendChild(l);
        }
        const inp = mk('input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.placeholder = t('up3x.ramPh');
        inp.value = b.ram || '';
        inp.title = t('up3x.ramTip');
        inp.addEventListener('input', (e) => { state.blends[b.i].ram = e.target.value; });
        w.appendChild(inp);
        fields.appendChild(w);
      });
      ramBox.appendChild(fields);
      /* 折叠 = 不指定：把界面上和提交里的值一起清空，免得"看得见却没发出去" */
      ck.querySelector('input').addEventListener('change', (e) => {
        fields.hidden = !e.target.checked;
        if (!e.target.checked) {
          liveBlends.forEach((b) => { state.blends[b.i].ram = ''; });
          [].forEach.call(fields.querySelectorAll('input'), (i2) => { i2.value = ''; });
        }
      });
      group.appendChild(line(t('up3x.ram'), ramBox));
    }

    root.appendChild(group);

    /* ③ 下半：画面设置（每个 .blend 一块）。页头 h2「项目设置」→ 这里 h3 → 每个文件 h4，
       大纲不跳级；这一行是真正的分区标题，不再是"区域标签"。 */
    const live = model.blends.filter((b) => !b.rejected);
    if (live.length) {
      const sub = mk('h3', 'up3-subhead');
      sub.textContent = t('up3x.picture');
      root.appendChild(sub);
    }

    let parsedKeys = 0;
    const cards = [];
    model.blends.forEach((b) => {
      parsedKeys += Object.keys(b.hidden).length + (b.rejected ? 0 : 3);
      const bl = mk('div', 'up3-blend');
      bl.dataset.i = b.i;
      const bh = mk('div', 'up3-bhead');
      const name = mk('h4');
      name.textContent = b.name || ('#' + b.i);
      bh.appendChild(name);
      const facts = b.rejected ? [] : blendFacts(b);
      if (facts.length) {
        const fm = mk('div', 'up3-bmeta');
        fm.textContent = facts.join(' · ');
        bh.appendChild(fm);
      }
      bl.appendChild(bh);

      if (b.rejected) {
        /* 站点对"缺相机 / 有活动输出节点 / 分析报错"的文件只给理由、不给表单（HTML.php:1162-1182） */
        const bad = mk('div', 'up3-notes up3-bad');
        bad.textContent = zh(b.reason) || t('up3x.rejectedBlend');
        bl.appendChild(bad);
        root.appendChild(bl);
        cards.push({ b, card: bl, body: bl, submit: null });
        return;
      }

      /* 类型：站点只在"非 EXR 且无降噪"时给可见的两个 radio（HTML.php:1259-1267）；
         EXR/降噪分支连 radio 都是 hidden 的（:1205），那就没有可选项。 */
      if (!b.typeForced) {
        const opts = mk('div', 'up3-opts');
        const anim = opt('radio', uid + '-type-' + b.i, 'animation', t('up3x.anim'), { checked: b.type !== 'singleframe' });
        const sing = opt('radio', uid + '-type-' + b.i, 'singleframe', t('up3x.single'), { checked: b.type === 'singleframe' });
        opts.appendChild(anim);
        opts.appendChild(sing);
        bl.appendChild(line(t('up3x.type'), opts));

        const animRow = mk('div', 'up3-fields');
        const singRow = mk('div', 'up3-fields');
        [['start', 'up3x.start', 6], ['end', 'up3x.end', 6], ['step', 'up3x.step', 3]].forEach(([k, lbl, size]) => {
          const f = fld(t(lbl), { value: state.blends[b.i][k], size });
          f._input.addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          animRow.appendChild(f);
        });
        const sf = fld(t('up3x.frame'), { value: state.blends[b.i].frame, size: 6 });
        sf._input.addEventListener('input', (e) => { state.blends[b.i].frame = e.target.value; });
        singRow.appendChild(sf);
        animRow.hidden = b.type === 'singleframe';
        singRow.hidden = b.type !== 'singleframe';
        const framesBox = mk('div', 'up3-frames');
        framesBox.appendChild(animRow);
        framesBox.appendChild(singRow);
        const sync = () => {
          const v = anim.querySelector('input').checked ? 'animation' : 'singleframe';
          state.blends[b.i].type = v;
          animRow.hidden = v !== 'animation';
          singRow.hidden = v !== 'singleframe';
        };
        anim.querySelector('input').addEventListener('change', sync);
        sing.querySelector('input').addEventListener('change', sync);
        framesBox.appendChild(tipRow(t('up3x.rule20')));
        bl.appendChild(line(t('up3x.frames'), framesBox));
      } else {
        const animRow = mk('div', 'up3-fields');
        [['start', 'up3x.start', 6], ['end', 'up3x.end', 6], ['step', 'up3x.step', 3]].forEach(([k, lbl, size]) => {
          const f = fld(t(lbl), { value: state.blends[b.i][k], size });
          f._input.addEventListener('input', (e) => { state.blends[b.i][k] = e.target.value; });
          animRow.appendChild(f);
        });
        animRow.appendChild(tipRow(t('up3x.rule20')));
        bl.appendChild(line(t('up3x.frames'), animRow));
      }

      /* 切块：三种形态都摆成"名字: 值"。站点认定不能切块时（EXR / 降噪），
         理由就长在**这一行**上 —— 它本来就是"为什么这里没得选"，单独摆一块反而突兀。 */
      const splitBox = mk('div', 'up3-split');
      const splitWhy = [];
      const rest = [];
      b.notes.forEach((s) => {
        if (b.split.kind === 'fixed' && SPLIT_REASON.test(s)) splitWhy.push(s);
        else rest.push(s);
      });
      if (b.split.kind === 'samples' || b.split.kind === 'samples-single') {
        const s = slider(t('up3x.splitEach'), b.split.min, b.split.max, b.split.value);
        s._input.addEventListener('input', (e) => { state.blends[b.i].splitSamples = e.target.value; });
        splitBox.appendChild(s);
      } else if (b.split.kind === 'tiles') {
        const sel = mk('select');
        b.split.options.forEach((o) => {
          const op = mk('option');
          op.value = o.v;
          op.textContent = o.v === '1' ? t('up3x.fullFrame') : o.label;
          if (o.v === String(b.split.tiles)) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', () => { state.blends[b.i].splitTiles = sel.value; });
        splitBox.appendChild(sel);
      } else {
        const chip = mk('span', 'up3-static');
        chip.textContent = t('up3x.fullFrame');
        chip.title = t('up3x.splitFixedTip');
        splitBox.appendChild(chip);
      }
      if (splitWhy.length) {
        /* 「检测到降噪」这类理由要看得见：主题色 + 警示图标，单独一行 */
        const why = mk('span', 'up3-why');
        const ico = mk('span', 'up3-whyico');
        ico.innerHTML = UI.icon('warn');
        why.appendChild(ico);
        const txt = mk('span');
        txt.textContent = splitWhy.map(zh).join(' ');
        why.appendChild(txt);
        splitBox.appendChild(why);
      }
      /* 上限也长在这一行：拨滑条的时候才需要知道"到顶是多少" */
      splitBox.appendChild(tipRow(t('up3x.ruleTiles')));
      bl.appendChild(line(t('up3x.split'), splitBox));

      /* 剩下的说明（EXR 限制、缺文件、驱动警告…）才摆成消息块 */
      if (rest.length) {
        const notes = mk('div', 'up3-notes');
        rest.forEach((s) => {
          const d = mk('div');
          d.textContent = zh(s);
          notes.appendChild(d);
        });
        bl.appendChild(notes);
      }

      const foot = mk('div', 'up3-bfoot');
      const btn = mk('button', 'btn up3-submit');
      btn.type = 'button';
      btn.textContent = t('up3x.submit');
      foot.appendChild(btn);
      bl.appendChild(foot);

      const slot = mk('div', 'up3-slot');
      slot.setAttribute('aria-live', 'polite');   // 校验错误与提交结果要能被读屏播报
      slot.hidden = true;
      bl.appendChild(slot);

      btn.addEventListener('click', () => doSubmit(b, bl, slot, btn, msg, state, model));
      root.appendChild(bl);
      cards.push({ b, card: bl, body: bl, submit: btn, slot });
    });

    /* 站点这一版多了我们没画过的控件：它们会按站点给的默认值提交 —— 明说，别沉默 */
    if (model.unknown && model.unknown.length) {
      const warn = mk('div', 'up3-notes up3-warn');
      warn.textContent = t('up3x.unknown', { n: model.unknown.length, list: model.unknown.slice(0, 8).join('、') });
      root.appendChild(warn);
    }

    /* 多文件：站点的分析编号是**一次性**的（ProjectController.php:427 成功后删除），
       所以第二份提交必然拿到 "failed to found data"。这是我们唯一能提前告诉用户的事。 */
    if (live.length > 1) {
      const warn = mk('div', 'up3-notes up3-warn');
      warn.textContent = t('up3x.multi');
      root.appendChild(warn);
    }

    root.appendChild(msg);
    box.appendChild(root);

    saveReport({
      at: Date.now(), stage: 'enter', ok: true, n: parsedKeys, missing: [],
      unknown: (model.unknown || []).slice(0, 12),
      upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
    });
    /* state 一并交出去：离线验收要用它组提交体跟站点的 doAddProject 逐键比对 */
    return { ok: true, cards: cards.length, state, model };
  }

  /* ------------------------------------------------------------------ 提交 */

  async function doSubmit(b, card, slot, btn, msg, state, model) {
    slot.hidden = true;
    slot.textContent = '';
    slot.classList.remove('up3-bad');
    msg.hidden = true;

    const ui = { vis: state.vis, compute: state.compute, blends: state.blends };
    const errs = SP.Chain.validate(model, ui);
    if (errs.length) {
      slot.hidden = false;
      slot.classList.add('up3-bad');
      slot.textContent = errs.join('；');
      return;
    }
    const list = SP.Chain.buildPayload(model, ui).filter((p) => p.i === b.i);
    if (!list.length) { slot.hidden = false; slot.textContent = t('up3x.rejectedBlend'); return; }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = t('up3x.sending');
    try {
      const r = await SP.Chain.submit(list[0].data);
      if (r.ok) {
        saveReport({
          at: Date.now(), stage: 'submit', ok: true, n: Object.keys(list[0].data).length, missing: [],
          upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
        });
        btn.textContent = t('up3x.done');
        location.href = r.url;
        return;
      }
      saveReport({
        at: Date.now(), stage: 'submit', ok: false, n: Object.keys(list[0].data).length, missing: [],
        upstream: model.upstream, verified: model.verified, version: '0.2.0-rewrite',
      });
      slot.hidden = false;
      slot.classList.add('up3-bad');
      /* 服务端的错误体是 HTML 片段（含 <strong>/<ul>），我们只取文字、不注入它 */
      slot.textContent = r.message || t('up3x.rejected');
    } catch (e) {
      slot.hidden = false;
      slot.classList.add('up3-bad');
      slot.textContent = t('up3x.netFail') + ' ' + ((e && e.message) || e);
    }
    btn.disabled = false;
    btn.textContent = old;
  }

  /** 设置面板里的上游指纹行（格式沿用 0.1.x 那一版；0.2.0 起报告来自解析层）。 */
  function fpRows() {
    const now = SP.Chain.upstreamVersion();
    const known = SP.Chain.UPSTREAM;
    const rep = report();
    const when = rep && rep.at ? new Date(rep.at).toLocaleString() : '';
    const tipLines = [];
    if (now) tipLines.push(t('set.fp.now', { v: now }), t('set.fp.same', { v: now }));
    if (rep && rep.at) {
      tipLines.push(rep.stage === 'submit' ? t('set.fp.ok', { time: when, n: rep.n }) : t('set.fp.enter', { time: when, n: rep.n }));
    } else tipLines.push(t('set.fp.never'));
    const tipAttr = esc(tipLines.join('\n'));

    let line;
    if (!now) line = `<div class="hint bad">${esc(t('set.fp.unknown'))}</div>`;
    else if (now !== known) line = `<div class="hint bad">${esc(t('set.fp.diff', { now, known }))}</div>`;
    else if (rep && rep.unknown && rep.unknown.length) {
      line = `<div class="hint bad">${esc(t('set.fp.unknownEls', { n: rep.unknown.length, list: rep.unknown.slice(0, 6).join('、') }))}</div>`;
    }
    else if (rep && rep.at) line = `<div class="hint" title="${tipAttr}">${esc(t('set.fp.one', { v: now, n: rep.n }))}</div>`;
    else line = `<div class="hint" title="${tipAttr}">${esc(t('set.fp.oneNew', { v: now }))}</div>`;

    return `<div class="fp">
        <div class="lbl2">${esc(t('set.fp.title'))}</div>
        ${line}
      </div>`;
  }

  SP.Step3x = { render, report, fpRows, version: '0.2.0-rewrite' };
})();

/* ===== src/70-i18n-dom.js ===== */
/* ==== 70-i18n-dom.js：原站页面的翻译层 ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  const { I18n, Util } = SP;
  const SKIP_TAGS = /^(script|style|noscript|code|pre|svg|textarea|iframe|canvas)$/i;
  const BLOCK_SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,td,th,dt,dd,blockquote,figcaption,div,span';
  const ATTRS = ['title', 'placeholder', 'alt'];

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

    /** 短词条：保留首尾空白 */
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
          if (!this.insideSP && p.closest('#sp')) return NodeFilter.FILTER_REJECT;
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
        if (!this.insideSP && el.closest('#sp')) continue;
        for (const a of ATTRS) {
          const v = el.getAttribute(a);
          if (!v) continue;
          const out = this.attrValue(v);
          if (out !== null) { el.setAttribute(a, out); this.stats.attr++; }
        }
      }
      // 提交按钮的文案写在 value 里，不翻会留英文
      for (const el of (root.querySelectorAll ? root.querySelectorAll('input[type="submit"],input[type="button"]') : [])) {
        const v = el.getAttribute('value');
        const out = this.attrValue(v);
        if (out !== null) { el.setAttribute('value', out); this.stats.attr++; }
      }
    },

    /** 整块替换：只对「像一段话」的元素动手（阈值见下），免得误伤包裹整页的容器 */
    patchBlocks(root) {
      const idx = this.blockIndex();
      const pack = I18n.SITE[I18n.lang];
      const bp = (pack && pack.blockPatterns) || [];
      if ((!idx || !idx.size) && !bp.length) return;

      const cands = [];
      for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
        if (!this.insideSP && (el.closest('#sp') || el.closest('[data-sp-block]'))) continue;
        /* 整块替换 = innerHTML 覆盖成译文，容器里的东西全部没了。子树里只要有一件「能干活或能画」
           的东西就必须放手 —— 实测 /getstarted 站点那句 "Max: 2,048 MB…" 和 `<input type="file">`
           同在一个 <td> 里，整块替换把**文件框**删掉了（用户实报：一翻译就不能上传）。 */
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

    /** translateSubtree：只翻一棵子树且**不跳过 #sp** —— 站点把估算结果 HTML（英文 + 表格）
     *  塞进我们卡片里，按「不进 #sp」会被整段挡掉，于是它一直是英文。词典仍是同一份。 */
    translateSubtree(root) {
      if (!this.enabled || !I18n.canTranslateSite() || !root) return;
      const keep = this.insideSP;
      this.insideSP = true;
      try {
        this.patchBlocks(root);
        this.patchTextNodes(root);
        this.patchAttributes(root);
      } finally { this.insideSP = keep; }
    },

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
        // 纯 characterData 多是我自己改的
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

    mountPill() {
      if (document.getElementById('sp-lang-pill') || document.querySelector('#sp')) return;
      const s = document.createElement('style');
      s.textContent = `
        #sp-lang-pill{order:1;position:static;
          display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;
          font:500 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;
          background:rgba(20,24,32,.82);color:#e6e9ef;border:1px solid rgba(255,255,255,.14);
          cursor:pointer;opacity:.42;transition:opacity .15s;backdrop-filter:blur(6px)}
        #sp-lang-pill:hover{opacity:1}`;
      document.head.appendChild(s);

      const b = document.createElement('button');
      b.id = 'sp-lang-pill';
      b.type = 'button';
      /* 这个开关必须一直在、且必须能双向拨：踩过的坑是只在「翻译开着」时挂载，关掉再重载后
         它自己不再挂载，页面上再没有入口能把翻译开回来（0.1.6 用户实报）。 */
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
      SP.cornerHost().appendChild(b);
    },

    /* ---------------------------------------------------------- 诊断：核对词条覆盖率 */

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
    else if (state.view === 'project') html = Views.project(state);
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

    const f = ev.target.closest('#sp-filter [data-f]');
    if (f) { Views.projState.filter = f.dataset.f; render(); return; }

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
