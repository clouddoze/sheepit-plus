// ==UserScript==
// @name         SheepIt Plus · 渲染农场界面重制
// @name:en      SheepIt Plus · Renderfarm UI Rebuild
// @namespace    https://github.com/clouddoze
// @version      0.2.10
// @description  给 SheepIt Render Farm 换一套现代前端：仪表盘、项目、排行榜、团队、实况、会话与设置；明暗主题，数据只来自站点页面。
// @description:en  A modern front end for SheepIt Render Farm: dashboard, projects, ranking, teams, live farm status, sessions and settings; dark/light, all data read from the site's own pages.
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

/* ===== src/10-core.js ===== */
/* ==== 10-core.js：工具 / 语言包注册表 / 主题 token ==== */
(function () {
  'use strict';

  const NS = 'sheepit-plus';
  const SP = (window.__SHEEPIT_PLUS__ = window.__SHEEPIT_PLUS__ || {});

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
      if (h > 0) out += `${h}h`;
      if (out) return out;
      /* 不到 1 小时：别写 "0h"（原来的 `|| !out` 会先塞 0h，末尾的 m 分支永远走不到）。 */
      const m = Math.floor((s % 3600) / 60);
      return m > 0 ? `${m}m` : `${Math.max(1, Math.round(s))}s`;
    },

    /** Date → 'YYYY-MM-DD'；走 UTC，免得时区把日期挪一天 */
    dkey(d) { return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10); },

    /** 本地日历日的 'YYYY-MM-DD'。站点给的「某一天有没有渲染」是本地日；
        用 dkey() 的 UTC 日期在东八区 00:00–08:00 会差一天（热力图高亮/连续天数会错）。 */
    dkeyLocal(d) {
      const x = d instanceof Date ? d : new Date(d === undefined ? Date.now() : d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    },

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
      'top.account': '账户设置', 'top.logout': '退出登录', 'nav.more': '更多',
      'top.themeCycle': '主题：{cur}（点击切换）',
      'hero.rank': '排名', 'hero.rankNone': '暂无排名', 'hero.team': '团队', 'hero.joined': '注册于',
      'stat.frames': '已渲染帧数', 'stat.points': '积分', 'stat.time': '累计渲染时长',
      'stat.streak': '当前连续', 'stat.days': '天',
      'stat.streakHint': '历史最长 {best} 天',
      // 键由原文 slug 化（见 50-views.js packLabel）
      'badge.top-10-renderers': 'TOP 10% 渲染者',
      'stat.avgPeak': '历史日均 {avg} 帧 · 历史峰值 {peak}',
      'stat.rankWindow': '全站排名 {rank} · 30 天滚动',
      'stat.rankNone': '暂无排名 · 30 天滚动',
      'stat.daysEquiv': '约 {days} 天机时',
      'stat.created': '建的项目', 'stat.createdHint': '你上传的任务数',
      'stat.ordered': '订的帧', 'stat.orderedHint': '为你自己的项目下单的帧数',
      'site.frames': '待渲染帧', 'site.projects': '进行中项目',
      'site.clients': '在线客户端', 'site.processing': '正在处理帧',
      'chart.points': '积分增长',
      'chart.tipPoints': '积分',
      'chart.pointsSub': '{n} 个采样点 · {from} → {to}',
      'months.title': '月度产出', 'months.sub': '按月汇总',
      'months.max': '最高月', 'months.min': '最低月',
      'months.toRecent': '换成近 30 天',
      'recent.title': '近 30 天概览', 'recent.sub': '含今天',
      'recent.frames': '产出帧数', 'recent.framesHint': '日均 {avg} 帧',
      'recent.active': '活跃天数', 'recent.activeHint': '按站点渲染日历统计',
      'recent.peak': '单日峰值', 'recent.peakHint': '{date}',
      'recent.points': '积分变化', 'recent.pointsHint': '30 天净变化（含支出）',
      'recent.toMonths': '换回月度产出',
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
      /* 「我发布的」：数据来自个人主页那张表，没有设备/内存可筛，所以那一档只放状态筛 */
      'proj.scope.all': '全部', 'proj.scope.mine': '我发布的',
      'proj.searchMine': '搜索我发布的…', 'proj.col.manage': '操作',
      /* 「我发布的」多选 + 批量删除（只在这张表上；全站列表不做删除） */
      'proj.pick': '选择', 'proj.pickAll': '选择本页全部', 'proj.pickNone': '取消选择',
      'proj.picked': '已选 {n} 项', 'proj.del': '删除',
      'proj.delConfirm': '删除「{name}」？不可撤销：项目与已渲染的帧会一起消失。',
      'proj.delConfirmInline': '确认删除', 'proj.back': '返回',
      'proj.delPicked': '删除所选',
      'proj.delPickedConfirm': '删除选中的 {n} 个项目？不可撤销：项目与已渲染的帧会一起消失。',
      'proj.delRunning': '正在删除 {i}/{n}…', 'proj.delStop': '停止',
      'proj.delOk': '已删除 {n} 个项目', 'proj.delPartial': '已删除 {n} 个，{m} 个失败',
      'proj.delStopped': '已停止：成功 {n}，失败 {m}，未处理 {k}',
      'proj.match': '匹配 {n} / 共 {total}', 'proj.clearFilters': '清除筛选',
      'proj.frameUnit': '帧',
      'proj.status.finished': '已完成', 'proj.status.blocked': '已被站点封禁',
      'my.title': '我的项目', 'my.count': '共 {n} 个', 'my.all': '看全部',
      'my.open': '项目设置',
      'my.empty': '你还没有发布过项目',
      'my.emptyCta': '上传一个项目',
      /* 总览「我的项目」标题旁的汇总（渲染中数量 / 最近自动删除日期） */
      'my.meta.running': '{n} 个渲染中', 'my.meta.next': '最近 {date} 自动删除',
      'my.meta.deleted': '自动删除 {date}',
      'list.more': '显示更多', 'list.shown': '已显示 {n} / {total}',
      'mode.toClassic': '原版界面', 'mode.toClassicShort': '原版',
      // pill 上写**动作**不是状态：写状态读起来像标签不像按钮。
      'mode.classicHint': '切换新界面', 'mode.classicTip': '点这里回到 SheepIt Plus 的现代化界面',
      'mode.enter': '进入新界面', 'mode.enterTip': '这一页没有重制版，点此去新界面的总览',
      'mode.toClassicTip': '立刻切回站点原版界面（不刷新）',
      'mode.opening': '正在打开…',
      /* 已连接的机器 */
      'machines.title': '在线机器', 'machines.count': '共 {n} 台',
      'machines.none': '当前没有连着算力的客户端',
      'machines.open': '查看会话', 'machines.unknown': '未识别机型',
      'machines.created': '开始 {v}',
      'machines.uptime': '已连接 {v}',
      /* 在线机器那一格的**状态**（用户 2026-10-07）。判据见 40-ui.js 的 machineDetail：
         Current frames 那行只在站点有帧在跑时才印 → 有=渲染中、没有=等待任务。 */
      'machines.state.rendering': '渲染中', 'machines.state.idle': '等待任务',
      /* 渲染产出：日期轴 */
      'heat.weekday': '一,三,五', 'heat.tip': '{n} 帧',
      'heat.tipOn': '有渲染', 'heat.tipOff': '没有渲染',
      /* 账户设置 */
      'nav.account': '账户设置',
      'account.title': '账户设置',
      'account.tab.sched': '调度与名单',
      'account.tab.sponsor': '捐赠积分', 'account.tab.account': '账户',
      'account.only': '只能管理自己的账户',
      'account.scheduler': '调度设置', 'account.schedulerHint': '决定优先渲染谁的项目：优先级由低到高是 其他用户 < 我的团队 < 我自己。',
      'account.sched.mine': '优先渲染我自己的项目',
      'account.sched.mineHint': '默认开启。如果你的机器较旧，交给调度器挑更轻的帧可能更划算。',
      'account.sched.team': '优先渲染我团队的项目',
      'account.sched.heavy': '重负载项目优先',
      'account.sched.heavyHint': '机器很强（> 200%）时开启，可以减少"下载解压"相对于渲染的占比。',
      'account.priority': '渲染优先级', 'account.priorityHint': '这些发布者的项目会被优先领取。', 'account.prioNone': '名单还是空的',
      // 自动补全是按**用户名**、不是 ID（source=/user/list_from_term）
      'account.priorityAdd': '输入用户名后回车', 'account.add': '添加', 'account.remove': '移除',
      'account.sponsor': '捐赠积分', 'account.sponsorSub': '站点叫 Sponsorship',
      'account.sponsorHint': '把你在渲染中挣到的积分送出去：每渲染一帧，这一帧的积分会给名单里随机一位，而不是进你自己的账户。',
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
      'nav.teams': '团队', 'nav.teamsShort': '团队',
      'team.title': '团队排行榜',
      'team.sub': '按最近 90 天积分排名；团队上限 200 人。',
      'team.count': '{n} 个团队',
      'team.search': '搜索团队',
      'team.none': '没有匹配的团队。',
      'team.col.rank': '排名', 'team.col.name': '团队',
      'team.col.p90': '90 天积分', 'team.col.p180': '180 天积分',
      'team.col.total': '总积分', 'team.col.members': '成员',
      'team.col.member': '成员', 'team.col.points': '积分', 'team.col.joined': '加入日期',
      'team.col.lastFrame': '最后渲染', 'team.col.remove': '移除成员',
      'team.rendering': '正在渲染',
      'team.requests': '待批准的加入申请', 'team.requestsSub': '{n} 条',
      'team.update': '修改团队信息', 'team.updateSub': '保存后会给每位成员发一封通知邮件',
      'team.updateName': '团队名称（英文）', 'team.updateDesc': '简介（可选）',
      'team.updateGo': '保存', 'team.updated': '已保存，正在刷新…',
      'team.accept': '接受', 'team.refuse': '拒绝',
      'team.refuseConfirm': '拒绝这条加入申请？申请人会收到通知。',
      'team.remove': '移除',
      'team.removeConfirm': '把这个成员移出团队？他的积分记录会留在团队历史里。',
      'team.back': '返回团队榜',
      'team.noMembers': '这个团队没有成员数据。',
      'team.leave': '退出这个团队',
      'team.leaveConfirm': '退出这个团队？退出后团队的积分记录不会再算上你。',
      'team.join': '申请加入这个团队',
      'team.joinConfirm': '向这个团队的管理员发送加入申请？',
      'team.ok': '已提交，正在刷新…',
      'team.rankLine': '· 团队榜第 {rank} 名',
      'team.armConfirm': '再点一次确认',
      'team.created': '团队已创建，正在刷新…',
      'team.mine': '我的团队',
      'team.create': '创建一个团队',
      'team.createName': '团队名称（站点要求英文名）',
      'team.createGo': '创建',
      'team.createHint': '创建后你就是队长：可以在团队页解散，也可以让成员申请加入。',
      'team.disband': '解散这个团队',
      'team.disbandConfirm': '解散这个团队？所有成员都会退出，团队的积分记录不会回来。',
      'rank.title': '渲染者排行榜', 'rank.sub': '按 30 天滚动周期计分',
      'rank.col.rank': '名次', 'rank.col.user': '渲染者', 'rank.col.frames': '已渲染帧数',
      'rank.col.time': '渲染时长', 'rank.col.points': '获得积分',
      'rank.you': '你', 'rank.count': '共 {n} 位渲染者',
      /* 机器档：站点 /ranking/machine 的四张表（数据来自 RankingController::machine） */
      'rank.tab.user': '用户', 'rank.tab.machine': '机器',
      'live.title': '实况', 'live.sub': '全站此刻在跑什么、谁在跑',
      'live.kpi.frames': '正在渲染', 'live.kpi.machines': '在线机器', 'live.kpi.machinesSub': '{a} 活跃 · {p} 暂停',
      'live.kpi.remaining': '剩余待渲染', 'live.kpi.perDay': '昨日产出',
      'live.trend.frames': '渲染产出', 'live.trend.framesSub': '每天完成渲染的帧数（近 90 天）',
      'live.trend.machines': '机器在线', 'live.trend.machinesSub': '每天连上来的机器数（近 4 个月）',
      'live.dist.projects': '项目分布', 'live.dist.projectsSub': '正在渲染的帧按项目聚合，前 8 名',
      'live.dist.os': '系统', 'live.dist.osSub': '在线机器的操作系统',
      'live.dist.vendor': '硬件厂商', 'live.dist.vendorSub': '在线机器的型号归属（CPU / GPU）',
      'live.vendor.nvidia': 'NVIDIA', 'live.vendor.amd': 'AMD', 'live.vendor.apple': 'Apple',
      'live.vendor.intel': 'Intel', 'live.vendor.other': '其它',
      'live.filter.project': '项目：{name}', 'live.filter.vendor': '厂商：{name}',
      'live.me': '我的',
      'live.dist.device': '算力设备', 'live.dist.deviceSub': '机器用什么在算',
      'live.unit.frames': '帧', 'live.unit.machines': '台',
      'live.dist.other': '其它（{n} 个）',
      'live.tab.frames': '正在渲染', 'live.tab.machines': '在线机器',
      'live.detail': '明细', 'live.detailSub': '两张表都能搜；暂停或阻塞的机器标灰',
      'live.searchFrames': '搜索项目 / 用户 / 机器', 'live.searchMachines': '搜索型号 / 用户',
      'live.col.project': '项目', 'live.col.frame': '帧', 'live.col.user': '用户',
      'live.col.waited': '已等', 'live.col.eta': '预计', 'live.col.remaining': '剩余', 'live.col.machine': '机器',
      'live.col.model': '型号', 'live.col.memory': '显存', 'live.col.frames': '已渲染帧',
      'live.col.heartbeat': '心跳', 'live.col.elapsed': '已渲染', 'live.none': '没有匹配的记录。',
      'live.showing': '显示 {n} / 共 {total}',
      'nav.live': '实况',
      'rank.search': '搜索用户名', 'rank.showing': '显示 {n} / 共 {total}',
      'rank.machine.search': '搜索型号',
      'rank.machine.title': '机器性能榜',
      'rank.machine.sub': '按单机强度排序；强度是相对基准机型的百分比',
      'rank.machine.count': '共 {n} 款机型',
      'rank.machine.empty': '没有机器数据。',
      'rank.machine.col.model': '型号', 'rank.machine.col.memory': '显存', 'rank.machine.col.power': '强度',
      'state.loading': '正在读取站点数据…',
      'state.error': '读取失败', 'state.retry': '重试',
      'state.loggedOut': '未检测到登录状态',
      'state.loggedOutHint': 'SheepIt Plus 依赖你的登录会话读取数据。请先在原站登录，然后刷新本页。',
      'state.loggedOutBtn': '前往原站登录',
      'state.empty': '暂无数据',
      'set.title': '设置', 'set.theme': '主题', 'set.theme.auto': '跟随系统',
      'set.theme.dark': '暗色', 'set.theme.light': '亮色',
      'set.on': '开启', 'set.off': '关闭',
      'set.pageSize': '每页条数', 'set.pageSizeHint': '项目、排行榜、渲染中这些长列表一次显示多少行。「显示更多」按这个数递增。',
      'set.nav': '导航栏', 'set.navReset': '重置',
      'set.navHint': '点一下切换显示/隐藏；总览和设置常开。隐藏只是入口不见，直接打开那个地址仍然可用。',
      'set.navLocked': '这一项常开',
      'set.showRanking': '导航显示排行榜', 'set.showRankingHint': '关掉后顶栏不出现「排行榜」，直接打开 /ranking/user 仍然接管。',
      'set.lang': '界面语言', 'set.lang.auto': '跟随浏览器',
      'set.scale': '界面缩放', 'set.scaleHint': '觉得小就调大。整块界面按这个比例缩放 —— 字号、间距、图表一起走，不是只放大字。',
      'set.psort': '默认排序', 'set.psortHint': '项目列表按什么排。点表头排序也会一并记住 —— 下次打开还是这个排法。',
      'set.pdir.asc': '升序', 'set.pdir.desc': '降序',
      'set.ovblocks': '总览区块', 'set.ovblocksHint': '总览页显示哪些块、按什么顺序排。关掉的整块不画；开关与顺序都会被记住。',
      'ovb.kpi': '指标带', 'ovb.charts': '图表',
      'ovb.up': '上移', 'ovb.down': '下移', 'ovb.pinned': '固定在顶部',
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
      'sess.computeRaw': '站点给的计算方式：{raw}',
      // 暂停时说"当前作业"，否则和旁边的「已暂停」徽章自相矛盾。
      'sess.rendering': '正在渲染', 'sess.currentJob': '当前作业', 'sess.frame': '帧',
      'sess.status.enable': '已启用', 'sess.status.disable': '已停用',
      'sess.noId': '地址里没有会话编号', 'sess.parseFailed': '这一页没读到机器信息',
      'sess.kpi.frames': '已渲染帧数', 'sess.kpi.points': '获得积分',
      'sess.kpi.maxTime': '单帧渲染时长上限',
      'sess.kpi.since': '自 {t} 起', 'sess.kpi.perFrame': '每帧约 {n} 分',
      'sess.kpi.powerLink': '各机型算力榜',
      'sess.facts': '机器信息',
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
      'sess.controlHint': '暂停后客户端会停止领活，恢复要等它下一次连上才生效。',
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

      /* 设置区自绘：三行开关 + 一行危险动作，动作直发站点端点（见 80-app.js 的 mgSet） */
      /* 项目管理页整页自绘：动作行 / 名单 / 概要 / 帧。站点没渲染的那几项不画。 */
      'mg.acl.needName': '先填一个名字', 'mg.acl.needPick': '请从建议列表里选一个团队',
      /* 站点结构变了：不许沉默 —— 说清 + 给出切档办法 */

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
      'top.account': 'Account settings', 'top.logout': 'Log out', 'nav.more': 'More',
      'top.themeCycle': 'Theme: {cur} (click to cycle)',
      'hero.rank': 'Rank', 'hero.rankNone': 'No rank', 'hero.team': 'Team', 'hero.joined': 'Joined',
      'stat.frames': 'Frames rendered', 'stat.points': 'Points', 'stat.time': 'Render time',
      'stat.streak': 'Current streak', 'stat.days': 'days',
      'stat.streakHint': 'Best {best}d',
      'badge.top-10-renderers': 'TOP 10% RENDERERS',
      'stat.avgPeak': 'Lifetime avg {avg}/day · peak {peak}',
      'stat.rankWindow': 'Site rank {rank} · 30-day rolling',
      'stat.rankNone': 'No rank · 30-day rolling',
      'stat.daysEquiv': '≈ {days} machine-days',
      'stat.created': 'Projects created', 'stat.createdHint': 'Tasks you uploaded',
      'stat.ordered': 'Frames ordered', 'stat.orderedHint': 'Frames you ordered for your own projects',
      'site.frames': 'Frames remaining', 'site.projects': 'Active projects',
      'site.clients': 'Connected clients', 'site.processing': 'Processing frames',
      'chart.points': 'Points growth',
      'chart.tipPoints': 'points',
      'chart.pointsSub': '{n} samples · {from} → {to}',
      'months.title': 'Monthly output', 'months.sub': 'By calendar month',
      'months.max': 'Best month', 'months.min': 'Lowest month',
      'months.toRecent': 'Switch to last 30 days',
      'recent.title': 'Last 30 days', 'recent.sub': 'Through today',
      'recent.frames': 'Frames', 'recent.framesHint': 'Avg {avg} frames/day',
      'recent.active': 'Active days', 'recent.activeHint': "From the site's render calendar",
      'recent.peak': 'Best day', 'recent.peakHint': '{date}',
      'recent.points': 'Points change', 'recent.pointsHint': 'Net over 30 days (incl. spending)',
      'recent.toMonths': 'Switch to monthly output',
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
      'proj.scope.all': 'All', 'proj.scope.mine': 'Published by me',
      'proj.searchMine': 'Search my projects…', 'proj.col.manage': 'Action',
      /* Multi-select + batch delete on the "published by me" table only */
      'proj.pick': 'Select', 'proj.pickAll': 'Select all on this page', 'proj.pickNone': 'Clear selection',
      'proj.picked': '{n} selected', 'proj.del': 'Delete',
      'proj.delConfirm': 'Delete "{name}"? This cannot be undone: the project and its rendered frames are removed.',
      'proj.delConfirmInline': 'Confirm delete', 'proj.back': 'Back',
      'proj.delPicked': 'Delete selected',
      'proj.delPickedConfirm': 'Delete the {n} selected projects? This cannot be undone: the projects and their rendered frames are removed.',
      'proj.delRunning': 'Deleting {i}/{n}\u2026', 'proj.delStop': 'Stop',
      'proj.delOk': 'Deleted {n} projects', 'proj.delPartial': 'Deleted {n}; {m} failed',
      'proj.delStopped': 'Stopped: {n} deleted, {m} failed, {k} not processed',
      'proj.match': '{n} matching / {total} total', 'proj.clearFilters': 'Clear filters',
      'proj.frameUnit': 'frames',
      'proj.status.finished': 'Rendered', 'proj.status.blocked': 'Blocked by the site',
      'my.title': 'My projects', 'my.count': '{n} in total', 'my.all': 'See all',
      'my.open': 'Project settings',
      'my.empty': 'You have not published a project yet',
      'my.emptyCta': 'Upload a project',
      'my.meta.running': '{n} rendering', 'my.meta.next': 'next auto-delete {date}',
      'my.meta.deleted': 'auto-delete {date}',
      'list.more': 'Show more', 'list.shown': 'Showing {n} / {total}',
      'mode.toClassic': 'Classic UI', 'mode.toClassicShort': 'Classic',
      'mode.classicHint': 'Switch to new UI', 'mode.classicTip': 'Return to the SheepIt Plus interface',
      'mode.enter': 'Open the new UI', 'mode.enterTip': 'This page has no rebuilt version; open the modern overview instead',
      'mode.toClassicTip': 'Switch to the site\u2019s own interface instantly, without reloading',
      'mode.opening': 'Opening\u2026',
      'machines.title': 'Online machines', 'machines.count': '{n} machines',
      'machines.none': 'No machine is connected right now',
      'machines.open': 'Open session', 'machines.unknown': 'Unknown machine',
      'machines.created': 'Started {v}',
      'machines.uptime': 'Connected {v}',
      'machines.state.rendering': 'Rendering', 'machines.state.idle': 'Waiting for work',
      'heat.weekday': 'Mon,Wed,Fri', 'heat.tip': '{n} frames',
      'heat.tipOn': 'Rendered', 'heat.tipOff': 'No rendering',
      'nav.account': 'Account',
      'account.title': 'Account settings',
      'account.tab.sched': 'Scheduler & lists',
      'account.tab.sponsor': 'Donating points', 'account.tab.account': 'Account',
      'account.only': 'Your own account only',
      'account.scheduler': 'Scheduler', 'account.schedulerHint': 'Who gets rendered first: other users < my team < myself.',
      'account.sched.mine': 'Render my projects first',
      'account.sched.mineHint': 'On by default. On an older machine it may be better to let the scheduler pick an easier frame.',
      'account.sched.team': 'Render my team\u2019s projects first',
      'account.sched.heavy': 'Heavy projects have high priority',
      'account.sched.heavyHint': 'For machines above 200%: reduces the download-and-extract share of each job.',
      'account.priority': 'Render priority', 'account.priorityHint': 'Projects from these owners get picked up first.', 'account.prioNone': 'The list is empty',
      'account.priorityAdd': 'Type a username and press Enter', 'account.add': 'Add', 'account.remove': 'Remove',
      'account.sponsor': 'Donating points', 'account.sponsorSub': 'the site calls it Sponsorship',
      'account.sponsorHint': 'Give away the points you earn: every frame you render sends that frame\u2019s points to a random person on this list instead of to your own account.',
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
      'nav.teams': 'Teams', 'nav.teamsShort': 'Teams',
      'team.title': 'Team ranking',
      'team.sub': 'Ranked by points over the last 90 days; teams are capped at 200 members.',
      'team.count': '{n} teams',
      'team.search': 'Search teams',
      'team.none': 'No team matches.',
      'team.col.rank': 'Rank', 'team.col.name': 'Team',
      'team.col.p90': '90-day points', 'team.col.p180': '180-day points',
      'team.col.total': 'Total points', 'team.col.members': 'Members',
      'team.col.member': 'Member', 'team.col.points': 'Points', 'team.col.joined': 'Joined',
      'team.col.lastFrame': 'Last rendered', 'team.col.remove': 'Remove member',
      'team.rendering': 'Rendering now',
      'team.requests': 'Join requests', 'team.requestsSub': '{n} pending',
      'team.update': 'Rename or describe', 'team.updateSub': 'Every member gets an email after saving',
      'team.updateName': 'Team name (English)', 'team.updateDesc': 'Description (optional)',
      'team.updateGo': 'Save', 'team.updated': 'Saved, reloading\u2026',
      'team.accept': 'Accept', 'team.refuse': 'Refuse',
      'team.refuseConfirm': 'Refuse this join request? The applicant will be notified.',
      'team.remove': 'Remove',
      'team.removeConfirm': 'Remove this member from the team? Their points stay in the team history.',
      'team.back': 'Back to teams',
      'team.noMembers': 'No member data for this team.',
      'team.leave': 'Leave this team',
      'team.leaveConfirm': 'Leave this team? Your points will no longer count towards it.',
      'team.join': 'Ask to join this team',
      'team.joinConfirm': 'Send a join request to this team\u2019s admins?',
      'team.ok': 'Submitted, reloading\u2026',
      'team.rankLine': '\u00b7 {rank} on the team ranking',
      'team.armConfirm': 'Click again to confirm',
      'team.created': 'Team created, reloading\u2026',
      'team.mine': 'My team',
      'team.create': 'Create a team',
      'team.createName': 'Team name (English required)',
      'team.createGo': 'Create',
      'team.createHint': 'You become the owner: you can disband it from the team page, and members can ask to join.',
      'team.disband': 'Disband this team',
      'team.disbandConfirm': 'Disband this team? Every member will be removed and its points history will not come back.',
      'rank.title': 'Renderer ranking', 'rank.sub': 'Scored over a 30-day rolling window',
      'rank.col.rank': 'Rank', 'rank.col.user': 'Renderer', 'rank.col.frames': 'Frames rendered',
      'rank.col.time': 'Render time', 'rank.col.points': 'Points earned',
      'rank.you': 'you', 'rank.count': '{n} renderers',
      /* Machine tab: the four tables of the site's /ranking/machine page */
      'rank.tab.user': 'Users', 'rank.tab.machine': 'Machines',
      'live.title': 'Live', 'live.sub': 'What the farm is rendering right now and who is rendering it',
      'live.kpi.frames': 'Rendering now', 'live.kpi.machines': 'Machines online', 'live.kpi.machinesSub': '{a} active · {p} paused',
      'live.kpi.remaining': 'Frames remaining', 'live.kpi.perDay': 'Rendered yesterday',
      'live.trend.frames': 'Throughput', 'live.trend.framesSub': 'Frames rendered per day (last 90 days)',
      'live.trend.machines': 'Machines online', 'live.trend.machinesSub': 'Machines connected per day (last 4 months)',
      'live.dist.projects': 'By project', 'live.dist.projectsSub': 'Frames in progress, top 8 projects',
      'live.dist.os': 'Systems', 'live.dist.osSub': 'Operating systems of connected machines',
      'live.dist.vendor': 'Hardware vendors', 'live.dist.vendorSub': 'What the online machines are running (CPU / GPU)',
      'live.vendor.nvidia': 'NVIDIA', 'live.vendor.amd': 'AMD', 'live.vendor.apple': 'Apple',
      'live.vendor.intel': 'Intel', 'live.vendor.other': 'Other',
      'live.filter.project': 'Project: {name}', 'live.filter.vendor': 'Vendor: {name}',
      'live.me': 'yours',
      'live.dist.device': 'Compute', 'live.dist.deviceSub': 'What the machines render with',
      'live.unit.frames': 'frames', 'live.unit.machines': 'machines',
      'live.dist.other': 'Others ({n})',
      'live.tab.frames': 'Rendering', 'live.tab.machines': 'Machines',
      'live.detail': 'Details', 'live.detailSub': 'Both tables are searchable; paused or blocked machines are dimmed',
      'live.searchFrames': 'Search project / user / machine', 'live.searchMachines': 'Search model / user',
      'live.col.project': 'Project', 'live.col.frame': 'Frame', 'live.col.user': 'User',
      'live.col.waited': 'Waited', 'live.col.eta': 'Estimated', 'live.col.remaining': 'Remaining', 'live.col.machine': 'Machine',
      'live.col.model': 'Model', 'live.col.memory': 'Memory', 'live.col.frames': 'Frames',
      'live.col.heartbeat': 'Heartbeat', 'live.col.elapsed': 'Rendering', 'live.none': 'Nothing matches.',
      'live.showing': '{n} of {total}',
      'nav.live': 'Live',
      'rank.search': 'Search user', 'rank.showing': '{n} of {total}',
      'rank.machine.search': 'Search model',
      'rank.machine.title': 'Machine performance ranking',
      'rank.machine.sub': 'Sorted by single-machine strength; strength is a percentage of the reference machine',
      'rank.machine.count': '{n} machine models',
      'rank.machine.empty': 'No machine data.',
      'rank.machine.col.model': 'Model', 'rank.machine.col.memory': 'Memory', 'rank.machine.col.power': 'Strength',
      'state.loading': 'Reading site data…',
      'state.error': 'Failed to load', 'state.retry': 'Retry',
      'state.loggedOut': 'Not signed in',
      'state.loggedOutHint': 'SheepIt Plus reads data through your existing session. Sign in on the original site, then reload.',
      'state.loggedOutBtn': 'Sign in on the site',
      'state.empty': 'No data',
      'set.title': 'Settings', 'set.theme': 'Theme', 'set.theme.auto': 'System',
      'set.theme.dark': 'Dark', 'set.theme.light': 'Light',
      'set.on': 'On', 'set.off': 'Off',
      'set.pageSize': 'Rows per page', 'set.pageSizeHint': 'How many rows long lists show at once; “show more” adds this many.',
      'set.nav': 'Navigation', 'set.navReset': 'Reset',
      'set.navHint': 'Click to toggle. Overview and Settings always stay visible; hiding an entry only removes the link.',
      'set.navLocked': 'Always visible',
      'set.showRanking': 'Show ranking in nav', 'set.showRankingHint': 'When off, the 「Ranking」 tab is hidden; opening /ranking/user still works.',
      'set.lang': 'Language', 'set.lang.auto': 'Browser',
      'set.scale': 'Interface scale', 'set.scaleHint': 'Everything scales together \u2014 type, spacing and charts, not just the font size.',
      'set.psort': 'Default sort', 'set.psortHint': 'How the project list is ordered. Clicking a column header is remembered too \u2014 the same order is in force next time.',
      'set.pdir.asc': 'Ascending', 'set.pdir.desc': 'Descending',
      'set.ovblocks': 'Dashboard blocks', 'set.ovblocksHint': 'Which blocks the dashboard shows and in what order. A block that is off is not drawn at all; both the switches and the order are remembered.',
      'ovb.kpi': 'Key numbers', 'ovb.charts': 'Charts',
      'ovb.up': 'Move up', 'ovb.down': 'Move down', 'ovb.pinned': 'Pinned to the top',
      'nav.upload': 'Upload a project',
      'set.about': 'About', 'set.aboutText':
        'SheepIt Plus is a pure front-end UI rebuild. It reads the pages you could already see and renders them in a new interface; it calls no undocumented endpoints and sends nothing to a third party. Three things can change server state, all of them buttons you press yourself: the forms in Account settings, pause/resume on a machine\u2019s session page, and the priority toggle on a publisher in the project list. They post to the site\u2019s own endpoints, the same ones those pages use.',
      'set.dangerHint': 'To get the original interface back, use "Switch to the original interface" in the top bar, or disable this script and reload.',
      'footer.source': 'Data source: the site\u2019s own pages · no private endpoints',
      'sess.owner': 'Owner', 'sess.client': 'Client', 'sess.unknownHost': 'Unnamed machine',
      'sess.on': 'Running', 'sess.off': 'Paused',
      'sess.pausedServer': 'Paused server-side', 'sess.pausedClient': 'Paused client-side',
      'sess.statusRaw': 'the site writes: {raw}',
      'sess.computeRaw': 'compute method from the site: {raw}',
      'sess.rendering': 'Rendering', 'sess.currentJob': 'Current job', 'sess.frame': 'frame',
      'sess.status.enable': 'Enabled', 'sess.status.disable': 'Disabled',
      'sess.noId': 'No session id in the address', 'sess.parseFailed': 'No machine information on this page',
      'sess.kpi.frames': 'Frames rendered', 'sess.kpi.points': 'Points earned',
      'sess.kpi.maxTime': 'Per-frame render time limit',
      'sess.kpi.since': 'since {t}', 'sess.kpi.perFrame': '≈ {n} points per frame',
      'sess.kpi.powerLink': 'Power by machine model',
      'sess.facts': 'Machine',
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
      'sess.controlHint': 'A paused client stops taking new work; resuming takes effect the next time it connects.',
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

      'mg.acl.needName': 'Type a name first', 'mg.acl.needPick': 'Pick a team from the suggestions',

      /* 原生 <dialog> 确认框（替代 window.confirm） */
      'dlg.title': 'Are you sure?', 'dlg.ok': 'Confirm', 'dlg.cancel': 'Cancel',
      /* 可排序表头的无障碍名称：方向必须是文字，不能只靠箭头图标 */
      'sort.none': 'not sorted', 'sort.asc': 'ascending', 'sort.desc': 'descending',
      'sort.title': 'Sort by {col} ({dir})',
      /* 实况页：厂商归类、钻取筛选、我的机器 */
      'live.dist.vendor': 'GPU vendors', 'live.dist.vendorSub': 'What the online machines are running',
      'live.vendor.nvidia': 'NVIDIA', 'live.vendor.amd': 'AMD', 'live.vendor.apple': 'Apple',
      'live.vendor.intel': 'Intel', 'live.vendor.other': 'Other',
      'live.filter.project': 'Project: {name}', 'live.filter.vendor': 'Vendor: {name}',
      'live.me': 'yours',
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

    coverage() {
      const pack = SITE[this.lang];
      if (!pack) return null;
      return { entries: pack.site ? Object.keys(pack.site).length : 0 };
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
      // 上传页估算器的「推荐这么切」行（30-style 的 .up1-tbl td.ok）：站点原本用 label-success 标它
      '--positive': '#3fb950',
      /* 分类色板：只给「构成类」图表（系统 / 算力设备）用。
         实况页每边只有 3 类，单色 100%/88%/76% 的透明度阶梯在深色底上几乎连成一条 ——
         这不是"种类少"的问题，是编码维度选错了：用色相区分，而不是用同一色相的浓淡。 */
      '--cat-1': '#e06d58', '--cat-2': '#d9a441', '--cat-3': '#4f92a8',
      '--cat-4': '#9479b0', '--cat-5': '#5f9a70', '--cat-other': '#7c8695',
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
      /* 分类色板的浅色主题版本：同一组色相压深，保证在 #fbfbfc 上也有对比 */
      '--cat-1': '#b6472f', '--cat-2': '#8a6415', '--cat-3': '#2f6f86',
      '--cat-4': '#6b5385', '--cat-5': '#3f7350', '--cat-other': '#656d79',
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
  SP.t = (k, v) => I18n.t(k, v);
})();

/* ===== src/12-lang-zh.js ===== */
/* ==== 12-lang-zh.js：中文语言包 ====
   只提供**日期本地化**（视图层用 I18n.date()）。
   站点原版页的文案翻译已移除（用户 2026-11-13）：原版界面保持站点原样，
   中文只在新版界面提供 —— 逐条覆盖整站文案的维护成本压不住，覆盖不全反而显得半吊子。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  /* 站点把日期写成「20th Oct 06:10」（项目管理页）或「06:40 Sep 29」（会话页）两种形状，
     照抄进中文句子太刺眼：只本地化这两种。 */
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

  SP.I18n.register('zh', { label: '中文', dateText: farmDate });
})();

/* ===== src/20-api.js ===== */
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
  /* 从原版界面**就地**启动新版时，活 document 已经不可信：页面上可能已经被翻译（状态词、按钮
     文字都是解析判据），也可能被站点自己的脚本改过。那种情况下宁可多抓一次页面。
     一旦关掉就不再打开 —— 这一页的 DOM 不会变回原文。 */
  let liveDocOff = false;
  function currentDoc(path) {
    const norm = (p) => String(p || '').replace(/\/+$/, '') || '/';
    if (liveDocOff) return null;
    if (norm(location.pathname) !== norm(path)) return null;
    if (liveDocUsed === norm(path)) return null;
    liveDocUsed = norm(path);
    return document;
  }
  function disableLiveDoc() { liveDocOff = true; }

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
;

function parseProfile(html, userName) {
    const doc = asDoc(html);
    /* 时间线数组与热力图数据写在站点内联 <script> 里。传进来的是活 document 时，
       用站点脚本的文本当原文扫（站点脚本改 DOM 不改 script 文本）。 */
    const source = typeof html === 'string' ? html : scriptsSource(doc);

    const stats = {};
    /* Team 那一行是个链接（<dt>Team</dt><dd><a href="/team/<id>">名字</a></dd>）：
       文字已经进 stats，这里额外把 id 留下来，身份条才能做成能点的团队链接。 */
    let team = null;
    const dl = doc.querySelector('dl.dl-horizontal');
    if (dl) {
      const kids = [...dl.children];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName === 'DT' && kids[i + 1] && kids[i + 1].tagName === 'DD') {
          const label = text(kids[i]).trim();
          stats[label] = text(kids[i + 1]);
          if (/^team$/i.test(label)) {
            const a = kids[i + 1].querySelector('a[href*="/team/"]');
            if (a) team = { id: (String(a.getAttribute('href')).match(/\/team\/(\d+)/) || [])[1] || '', name: text(a).trim() };
          }
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

    return { name, avatar, badge, status, stats, team, points, frames, activity, machines, sessions, derived, myProjects };
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
  /** 全站「正在渲染的帧」（/home/frames）：7 列表——项目 / 帧 / 用户 / 已等 / 预计 / 剩余 / 机器。
      站点把几百行一次吐出来，没有分页参数；视图层自己截断。 */
  function parseProcessingFrames(html) {
    const doc = asDoc(html);
    const table = [...doc.querySelectorAll('table')].find((t) => /Request time/i.test(text(t)) && /Machine/i.test(text(t)));
    if (!table) return null;
    const out = [];
    for (const tr of table.querySelectorAll('tbody tr')) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 7) continue;
      const link = tr.querySelector('a[href*="/user/"]');
      const sortOf = (td) => { const v = Number(td.getAttribute('data-sort')); return Number.isFinite(v) ? v : null; };
      out.push({
        project: text(tds[0]).trim(),
        frame: text(tds[1]).trim(),
        user: link ? text(link).trim() : text(tds[2]).trim(),
        userId: link ? ((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
        waited: text(tds[3]).trim(),
        eta: text(tds[4]).trim(),
        remaining: text(tds[5]).trim(),
        machine: text(tds[6]).trim(),
        waitedSec: sortOf(tds[3]),
      });
    }
    return out;
  }

  /** /home/machines 的会话表：活跃（表 0）与暂停/阻塞（表 1）两张，6 列。 */
  function parseMachineSessions(html) {
    const doc = asDoc(html);
    const tables = [...doc.querySelectorAll('table')].filter((t) => /Rendered frames/i.test(text(t)));
    const rowsOf = (table, active) => {
      const out = [];
      if (!table) return out;
      for (const tr of table.querySelectorAll('tbody tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (tds.length < 6) continue;
        const link = tr.querySelector('a[href*="/user/"]');
        const numOf = (td) => { const v = Number(td.getAttribute('data-sort')); return Number.isFinite(v) ? v : null; };
        out.push({
          model: text(tds[0]).trim(),
          memory: text(tds[1]).trim(),
          frames: text(tds[2]).trim(),
          heartbeat: text(tds[3]).trim(),
          elapsed: text(tds[4]).trim(),
          user: link ? text(link).trim() : text(tds[5]).trim(),
          userId: link ? ((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
          framesNum: numOf(tds[2]),
          active,
        });
      }
      return out;
    };
    return { active: rowsOf(tables[0], true), paused: rowsOf(tables[1], false) };
  }

  /** 站点把图表数据写成内联 \`var name = [...]\`（不是 JSON：键带单引号、数组有尾逗号）。 */
  function parseChartArrays(html) {
    /* 内联数组只能从源码字符串里抠：传 Document 时先取回源码。 */
    const htmlText = typeof html === 'string' ? html : (html && html.documentElement ? html.documentElement.outerHTML : '');
    const grab = (name) => {
      const i = htmlText.indexOf('var ' + name);
      if (i < 0) return [];
      const eq = htmlText.indexOf('[', i);
      if (eq < 0) return [];
      let depth = 0, end = -1;
      for (let j = eq; j < htmlText.length; j++) {
        if (htmlText[j] === '[') depth++;
        else if (htmlText[j] === ']') { depth--; if (depth === 0) { end = j + 1; break; } }
      }
      if (end < 0) return [];
      let raw = htmlText.slice(eq, end).replace(/'/g, '"').replace(/,\s*([\]}])/g, '$1');
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.slice(1).map((p) => ({ d: String(p[0]), v: Number(p[1]) || 0 })) : [];
      } catch (e) {
        return [];
      }
    };
    return {
      framesByDay: grab('line_rendered_frames_by_day'),
      renderDaysByDay: grab('line_time_ordered_per_day'),
      remainingByHour: grab('line_remaining_frames_public_by_hour'),
      projectDist: grab('project_distribution'),
      machinesByHour: grab('sessions_by_hours'),
      machinesByDay: grab('sessions_by_day'),
      os: grab('piechart_os'),
      device: grab('piechart_compute_device'),
    };
  }

  /** 团队详情（/team/<id>，要登录）：站点模板给的是 h2 团队名 + h3 总积分 + 4 列成员表 + 最近项目。
      成员表在 tbody 里（不是 AJAX）；最近项目是 ul.popular 里的 li。 */
  function parseTeamPage(html) {
    const doc = asDoc(html);
    const h2 = [...doc.querySelectorAll('h2')].map((x) => text(x).trim()).filter(Boolean)[0] || '';
    const h3 = doc.querySelector('h3');
    const table = [...doc.querySelectorAll('table')].find((tbl) => /points generated/i.test(text(tbl)));
    const numOf = (td) => {
      const raw = td.getAttribute('data-sort');
      if (raw != null && raw !== '') { const v = Number(raw); if (Number.isFinite(v)) return v; }
      return null;
    };
    const members = [];
    let hasLastFrame = false;
    let hasRemove = false;
    if (table) {
      /* 列数不是固定的：团队创建者看到 6 列（多「Last rendered frame」和「Remove member」），
         普通成员只有 4 列。按表头文字定位，不按位置硬编码。 */
      const heads = [...table.querySelectorAll('thead th')].map((th) => text(th).trim().toLowerCase());
      const colOf = (needle) => heads.findIndex((h) => h.includes(needle));
      const iUser = Math.max(1, colOf('member'));
      const iPts = colOf('points');
      const iJoin = colOf('join');
      const iLast = colOf('last rendered');
      const iRemove = colOf('remove');
      hasLastFrame = iLast >= 0;
      hasRemove = iRemove >= 0;
      for (const tr of table.querySelectorAll('tbody tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (tds.length < 2) continue;
        const cell = (i) => (i >= 0 && tds[i] ? tds[i] : null);
        /* 头像那个 <a> 里只有 <img>、没有文字：先挑有文字的链接，拿不到再退回第一个 */
        const links = [...tr.querySelectorAll('a[href*="/user/"]')];
        const link = links.find((a) => text(a).trim()) || links[0] || null;
        const av = tr.querySelector('img.avatar, .avatar-small img');
        const pc = cell(iPts);
        const jc = cell(iJoin);
        const lc = cell(iLast);
        /* 「移除成员」列只在创建者视角存在。按钮形态站点没给样本，所以三种常见载体都认：
           <a href>、<form action>、onclick="requestReloadOnSuccess('...')"。认不出就留空，
           渲染层看到空动作就不画按钮 —— 不猜 URL。 */
        const rc = cell(iRemove);
        let removeUrl = '';
        if (rc) {
          const ra = rc.querySelector('a[href*="/team/"]');
          const rf = rc.querySelector('form[action]');
          const rb = rc.querySelector('[onclick*="requestReloadOnSuccess"]');
          if (ra) removeUrl = String(ra.getAttribute('href'));
          else if (rf) removeUrl = String(rf.getAttribute('action'));
          else if (rb) removeUrl = (String(rb.getAttribute('onclick')).match(/requestReloadOnSuccess\('([^']+)'\)/) || [])[1] || '';
        }
        members.push({
          rank: text(tds[0]).trim(),
          /* 站点模板：member.rendering ? 'label label-success' : 'label label-default'
             —— 排名标签是绿色 = 这个成员此刻正在渲染（这就是"在线"）。 */
          rendering: !!tds[0].querySelector('.label-success'),
          user: link ? text(link).trim() : text(cell(iUser) || tds[1]).trim(),
          userId: link ? ((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
          avatar: Util.safePath(av ? (av.getAttribute('data-src') || av.getAttribute('src') || '') : ''),
          points: pc ? numOf(pc) : null,
          pointsText: pc ? text(pc).trim() : '',
          joined: jc ? text(jc).trim() : '',
          lastFrame: lc ? text(lc).trim() : '',
          removeUrl,
        });
      }
    }
    /* 待批的加入申请（只有创建者看得到）：<h3>Join requests</h3> 后面那张表，
       每行一个申请人 + Accept / Refuse 两个 requestReloadOnSuccess 按钮。 */
    const requests = [];
    const reqHead = [...doc.querySelectorAll('h3')].find((x) => /join requests/i.test(text(x)));
    const reqTable = reqHead && reqHead.parentElement ? reqHead.parentElement.querySelector('table') : null;
    if (reqTable) {
      for (const tr of reqTable.querySelectorAll('tr')) {
        const tds = [...tr.querySelectorAll('td')];
        if (tds.length < 4) continue;   // 表头行没有 td
        const link = tr.querySelector('a[href*="/user/"]');
        const av = tr.querySelector('img');
        const urls = [...tr.querySelectorAll('[onclick*="requestReloadOnSuccess"]')].map((b) => {
          const m = String(b.getAttribute('onclick')).match(/requestReloadOnSuccess\('([^']+)'/);
          return m ? m[1].trim() : '';
        });
        requests.push({
          user: link ? text(link).trim() : text(tds[1]).trim(),
          userId: link ? ((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
          avatar: Util.safePath(av ? (av.getAttribute('data-src') || av.getAttribute('src') || '') : ''),
          time: text(tds[2]).trim(),
          accept: urls.find((u) => /\/adduser\//.test(u)) || '',
          refuse: urls.find((u) => /\/refuseuser\//.test(u)) || '',
        });
      }
    }

    const projects = [];
    const head = [...doc.querySelectorAll('h4')].find((x) => /latest projects/i.test(text(x)));
    const ul = (head && head.parentElement ? head.parentElement.querySelector('ul.popular') : null) || doc.querySelector('ul.popular');
    if (ul) for (const li of ul.querySelectorAll('li')) {
      const p = li.querySelector('p');
      const link = li.querySelector('a[href*="/user/"]');
      const av = li.querySelector('img');
      projects.push({
        name: p ? text(p).replace(/\s*Sent\s.*$/i, '').trim() : '',
        owner: link ? ((String(link.getAttribute('href')).match(/\/user\/([^/]+)\/profile/) || [])[1] || '') : '',
        avatar: Util.safePath(av ? (av.getAttribute('data-src') || av.getAttribute('src') || '') : ''),
      });
    }
    /* 团队动作：站点用 requestReloadOnSuccess(url) 发 POST（common.js），成功回 'OK'。
       /team/leave = 我在这个团队；/team/<id>/askforjoin = 我还没加入。 */
    /* 动作地址可能写在 onclick 上，也可能包在内联脚本里（退出团队就是后者：
       onclick 只写 `return leaveTeam()`）。两处都扫。 */
    const actions = [];
    for (const el of doc.querySelectorAll('[onclick]')) {
      const m = String(el.getAttribute('onclick')).match(/requestReloadOnSuccess\('([^']+)'\)/);
      if (m) actions.push(m[1]);
    }
    for (const sc of doc.querySelectorAll('script:not([src])')) {
      const txt = sc.textContent || '';
      for (const m of txt.matchAll(/requestReloadOnSuccess\('([^']+)'\)/g)) actions.push(m[1]);
    }
    const leaveUrl = actions.find((u) => /^\/team\/leave$/.test(u)) || '';
    /* 解散只有创建者看得到（站点把两个按钮一起给她）：/team/leave_them_delete */
    const deleteUrl = actions.find((u) => /\/leave_them_delete$/.test(u)) || '';
    const joinUrl = actions.find((u) => /\/askforjoin$/.test(u)) || '';
    /* 改名/改描述（创建者可见）：<h3>Update name and description</h3> 后面那张表单 */
    let update = null;
    const updHead = [...doc.querySelectorAll('h3')].find((x) => /update name and description/i.test(text(x)));
    const updForm = updHead && updHead.parentElement ? updHead.parentElement.querySelector('form[action*="/update"]') : null;
    if (updForm) {
      const nameEl = updForm.querySelector('[name="team_update_name"]');
      const descEl = updForm.querySelector('[name="team_update_description"]');
      update = {
        url: updForm.getAttribute('action') || '',
        name: nameEl ? String(nameEl.getAttribute('value') || '') : '',
        description: descEl ? text(descEl).trim() : '',
      };
    }

    return { name: h2, pointsText: h3 ? text(h3).trim() : '', members, projects, requests, update, hasLastFrame, hasRemove, leaveUrl, deleteUrl, joinUrl };
  }
  /** 团队榜：站点 `/team` 的 6 列表格。积分列带 data-sort 原值（缩写只是显示），
      所以排序/统计用数值、显示照原文 —— 与 parseRanking 同一口径。
      团队详情页 /team/<id> 需要登录，未登录时站点只给登录提示；那一页不接管。 */
  function parseTeams(html) {
    const doc = asDoc(html);
    const table = [...doc.querySelectorAll('table')].find((tbl) => /points over 90 days/i.test(text(tbl)));
    if (!table) return null;
    const out = [];
    for (const tr of table.querySelectorAll('tbody tr')) {
      const tds = [...tr.querySelectorAll('td')];
      if (tds.length < 6) continue;
      const link = tr.querySelector('a[href*="/team/"]');
      const numOf = (td) => {
        const raw = td.getAttribute('data-sort');
        if (raw != null && raw !== '') { const v = Number(raw); if (Number.isFinite(v)) return v; }
        return null;
      };
      out.push({
        rank: text(tds[0]).trim(),
        id: link ? ((String(link.getAttribute('href')).match(/\/team\/(\d+)/) || [])[1] || '') : '',
        name: link ? text(link).trim() : text(tds[1]).trim(),
        p90: numOf(tds[2]), p180: numOf(tds[3]), total: numOf(tds[4]), members: numOf(tds[5]),
        p90Text: text(tds[2]).trim(), p180Text: text(tds[3]).trim(),
        totalText: text(tds[4]).trim(), membersText: text(tds[5]).trim(),
      });
    }
    return out;
  }
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

  /* 机器性能榜（/ranking/machine，需登录）：四张独立的表，按 h1 里的锚点分节 ——
     CPUs / GPUs OPTIX / GPUs HIP / GPUs METAL。站点的列布局：
       CPU  = Model + Strength(data-sort=power)
       GPU  = Model + Memory(data-sort=memory_int，"95 GB") + Strength
     与用户榜同一口径：排序/统计读 data-sort 原值，显示照原文。
     行上 class="danger" 表示这台机器连在当前账号上 —— 只标"你的"，不改数据形状。
     admin 会多看一列 Coef、mod 多一列 Reset；所以数值列按**固定位置**取（CPU：model=0,
     strength=1；GPU：model=0, memory=1, strength=2），不用"最后一列"—— 否则管理员视角下
     会把 Coef 当成强度。 */
  const MACHINE_TABLES = [
    ['cpus', 'cpus', false],
    ['gpus_optix', 'optix', true],
    ['gpus_hip', 'hip', true],
    ['gpus_metal', 'metal', true],
  ];
  function parseMachineRanking(html) {
    const doc = asDoc(html);
    const out = { cpus: [], optix: [], hip: [], metal: [] };
    const numOf = (td) => {
      const raw = td.getAttribute('data-sort');
      if (raw != null && raw !== '') {
        const v = Number(raw);
        if (Number.isFinite(v)) return v;
      }
      /* 没有 data-sort 才退到显示文本（"95 GB" / "8040 %"）；站点这个页面每列都带原值，
         正常走不到这里 —— 与 parseRanking 同一条降级策略。 */
      const n = Number(text(td).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    for (const [anchor, key, gpu] of MACHINE_TABLES) {
      const a = doc.querySelector('a[name="' + anchor + '"]') || doc.getElementById(anchor);
      const table = a ? tableAfter(a.closest('h1,h2,h3,h4,h5') || a) : null;
      if (!table) continue;
      for (const tr of table.querySelectorAll('tbody tr')) {
        const tds = [...tr.querySelectorAll('td')];
        const powerIdx = gpu ? 2 : 1;
        if (tds.length < powerIdx + 1) continue;
        const model = text(tds[0]).trim();
        if (!model) continue;
        const row = {
          model,
          mine: (' ' + String(tr.className || '') + ' ').indexOf(' danger ') >= 0,
          power: numOf(tds[powerIdx]),
          powerText: text(tds[powerIdx]).trim(),
        };
        if (gpu) {
          row.memory = numOf(tds[1]);
          row.memoryText = text(tds[1]).trim();
        }
        out[key].push(row);
      }
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

    /* 我的团队：站点把 Team 放在统计 dl 里（<dt>Team</dt><dd><a href="/team/<id>">名字</a></dd>）。
       没加入任何团队时那一行不存在 → team = null（不猜）。 */
    let team = null;
    for (const dt of doc.querySelectorAll('dt')) {
      if (!/^team$/i.test(text(dt).trim())) continue;
      const dd = dt.nextElementSibling;
      const a = dd ? dd.querySelector('a[href*="/team/"]') : null;
      if (a) team = { id: (String(a.getAttribute('href')).match(/\/team\/(\d+)/) || [])[1] || '', name: text(a).trim() };
      break;
    }

    return {
      team,
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

  /** /project/<id> 管理页的**副标题事实**（owner 可读的那一页）：Summary 列表、
      Compute method、公开渲染、帧进度。只挑能挂一行副标题的字段，缺项给 '' / null。
      站点结构见上游 manage.html.twig + HTML.php：Summary 是 <h2> + <ul><li>标签: 值</li>，
      计算方式写在两只 radio 的 onclick 里（'cpu' / 'gpu'），帧进度是 li#project_job_<id>_progression。 */
  function parseProjectManage(html) {
    const doc = asDoc(html);
    const textOf = (el) => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const out = {
      storage: '', ram: '', duration: '', perFrame: '', autoDelete: '',
      compute: '', publicRender: null, done: null, total: null,
    };

    const head = [...doc.querySelectorAll('h2')].find((h) => /^summary$/i.test(textOf(h)));
    const list = head && head.parentElement ? head.parentElement.querySelector('ul') : null;
    for (const li of (list ? list.querySelectorAll('li') : [])) {
      const raw = textOf(li);
      /* 「自动删除」那一行没有「标签:」前缀，是 <li><span style="color:red">…</span></li> */
      const auto = raw.match(/automatically deleted on\s+(.+)$/i);
      if (auto) { out.autoDelete = auto[1].trim(); continue; }
      const kv = raw.match(/^([^:]+):\s*(.+)$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (/storage used/.test(key)) out.storage = val;
      else if (/^ram usage/.test(key)) out.ram = val;
      else if (/real duration/.test(key)) out.duration = val;
      else if (/per frame rendertime/.test(key)) out.perFrame = val;
    }

    /* 计算方式：两只 radio，onclick 里写死 'cpu' / 'gpu'；两只都 checked 才算 CPU+GPU */
    const on = [];
    for (const r of doc.querySelectorAll('input[name="compute_method"]')) {
      if (!r.hasAttribute('checked')) continue;
      const m = String(r.getAttribute('onclick') || '').match(/doModifyComputeMethod\(\s*[^,]+,\s*['"](cpu|gpu)['"]/i);
      if (m) on.push(m[1].toLowerCase());
    }
    out.compute = on.includes('cpu') && on.includes('gpu') ? 'both' : on.includes('gpu') ? 'gpu' : on.includes('cpu') ? 'cpu' : '';

    /* 公开渲染：公开时可见 checkbox ..._1 是 checked；私有时 ..._value 那只才是可见 checkbox。
       判据只认 HTML 的 checked 属性（站点的初始状态），不猜谁可见。 */
    const pub = doc.getElementById('project_public_render_checkbox_1');
    out.publicRender = pub ? pub.hasAttribute('checked') : null;

    /* 帧进度：li#project_job_<项目 id>_progression 的「2/2」 */
    const prog = [...doc.querySelectorAll('li[id]')].find((li) => /^project_job_\d+_progression$/.test(li.id));
    const pm = prog ? textOf(prog).match(/^(\d+)\s*\/\s*(\d+)$/) : null;
    if (pm) { out.done = Number(pm[1]); out.total = Number(pm[2]); }
    return out;
  }

  SP.Api = {
    fetchPage, fetchJson, fetchWithTimeout, invalidate, cache, post,
    currentDoc, disableLiveDoc, isOk,
    parseProfile, parseHome, parseProjects, parseRanking, parseMachineRanking, parseTeams, parseTeamPage, parseStatBoxes, detectUser,
    parseMyProjects, parseProcessingFrames, parseMachineSessions, parseChartArrays,
    parseAccount, parseMachines, parseSession, parseTimeline,
    extractArray, computeDerived, parseProjectManage,
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
/* 切回原版时只是给 #sp 挂上 hidden（DOM、状态、滚动位置都留着），别让它继续占着屏幕 */
#sp[hidden]{display:none !important}
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
  display:flex;align-items:center;gap:20px;padding:8px 0;
  border-bottom:1px solid var(--border);
  /* 不透明：浅色下 86% 白 + 深色文字会让下面的列表透上来（用户实报「像被割裂」）。
     毛玻璃靠 backdrop-filter 遮挡不可靠，直接给实色。 */
  background:var(--bg);
  /* 往两侧铺满到 .wrap 的 padding 外沿、往下多盖 4px：
     缩放/高分屏下 sticky 边界会有亚像素缝，下面的表格边框会从那条缝里露出来。 */
  margin:0 -24px;
  padding:8px 24px;
  box-shadow:0 4px 0 var(--bg);
}
/* 窄屏顶栏铺满视口（覆盖上面的 -24/+24）：这条必须写在 .top 基础规则**之后**，
   否则被基础规则的 margin/padding 盖掉 —— 390px 下顶栏会顶出视口、出现横向滚动条。 */
@media (max-width:760px){#sp .top{margin:0 -16px;padding:8px 16px}}
#sp .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.3px;flex:none;text-decoration:none}
/* 品牌图标是位图（深色底），固定尺寸 + 圆角；别给它上 currentColor（那是给单色 SVG 的） */
#sp .brand .sheep{width:24px;height:24px;flex:none;border-radius:6px;object-fit:cover;display:block}
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
/* 右侧控制组：刷新时间 / 主题快速切换 / 刷新 / 原版界面 / 头像（用户 2026-10-18 定序） */
#sp .topright{display:flex;align-items:center;gap:8px;flex:none;min-width:0}
#sp .metaline{font-size:12px;color:var(--text-3);white-space:nowrap}
/* 「更新于 …」是信息不是操作，中等宽度就让位给导航 */
@media (max-width:1180px){#sp .metaline{display:none}}
#sp .who{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);min-width:0}
#sp .who .uname{font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .who img{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .who .ini{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;font-size:12px;color:var(--text-3);flex:none}
/* 头像菜单：退出登录的常驻入口。窄屏只收名字，入口本身不消失。 */
#sp .who-wrap{position:relative;display:flex;align-items:center;min-width:0}
#sp button.who{background:none;border:none;padding:0;font:inherit;cursor:pointer;border-radius:var(--r-sm)}
#sp button.who:hover .uname,#sp button.who[aria-expanded="true"] .uname{color:var(--accent)}
#sp .umenu{position:absolute;right:0;top:calc(100% + 8px);min-width:0;width:max-content;max-width:220px;padding:5px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--r-sm);box-shadow:var(--shadow);z-index:40}
#sp .umenu[hidden]{display:none}
#sp .umenu a,#sp .umenu button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;font-size:12.5px;color:var(--text-2);text-decoration:none;background:none;border:none;cursor:pointer}
#sp .umenu a:hover,#sp .umenu button:hover{background:var(--surface-3);color:var(--text)}

/* nav 默认 flex-shrink:1，窄屏被压到 148px、按钮互相盖住 —— 必须显式 flex:none。 */
@media (max-width:860px){
  #sp .top{gap:12px}
  #sp nav{flex:none}
  #sp .metaline{display:none}
}
@media (max-width:620px){
  #sp .top{gap:8px;flex-wrap:nowrap}
  /* 底部导航接管后 nav 已隐藏，品牌 + 右侧控制一行放得下，不再折成两行。 */
  #sp .topright{flex:none;justify-content:flex-end;min-width:0}
  #sp .brand{font-size:14px}
  #sp .brand .sheep{width:20px;height:20px;border-radius:5px}
  #sp .brand em{display:none}
  #sp nav{gap:0}
  #sp nav button{padding:6px 7px;font-size:13px}
  #sp nav .navfull{display:none}
  #sp nav .navshort{display:inline}
  /* 底部导航起来后顶栏右侧有空间：只收名字、保留头像 —— 退出登录入口不能在窄屏消失。 */
  #sp .who .uname{display:none}
}

/* ==== 底部导航（≤620px） ====
   8 个导航项在 390px 会折成两行、把右侧控制挤下去；窄屏改成底部 5 个高频入口，
   顶栏 nav 隐藏但保留品牌与刷新/主题/切原版。 */
#sp .tabbar{display:none}
@media (max-width:620px){
  #sp .top nav{display:none}
  #sp .tabbar{
    display:flex;position:fixed;left:0;right:0;bottom:0;z-index:26;
    background:var(--bg);border-top:1px solid var(--border);
    padding:6px 8px calc(6px + env(safe-area-inset-bottom));
  }
  #sp .tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:8px;font-size:11px;color:var(--text-3)}
  #sp .tabbar button[aria-current="page"]{color:var(--accent);background:var(--accent-weak);font-weight:600}
  #sp .tabbar .icon{width:18px;height:18px}
  #sp .tabmore-wrap{position:relative;flex:1;display:flex;min-width:0}
  #sp .tabmore-wrap > button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:8px;font-size:11px;color:var(--text-3)}
  #sp .tabmore-wrap > button[aria-expanded="true"]{color:var(--accent);background:var(--accent-weak)}
  #sp .tabmore{position:absolute;bottom:calc(100% + 10px);right:8px;min-width:0;width:max-content;max-width:200px;padding:5px;background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--r-sm);box-shadow:var(--shadow);z-index:45}
  #sp .tabmore[hidden]{display:none}
  #sp .tabmore button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;font-size:12.5px;color:var(--text-2)}
  #sp .tabmore button:hover{background:var(--surface-3);color:var(--text)}
  #sp .wrap{padding-bottom:88px}
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
 */
#sp .btn:disabled{opacity:.5;cursor:not-allowed}
#sp .btn.primary:disabled{filter:none}
#sp .btn.sm{padding:4px 10px;font-size:12px;border-radius:var(--r-sm)}
#sp .btn .icon{width:14px;height:14px}

/* ==== 身份条 ====
   用户名一行、排名/TOP/团队/注册时间另一行（用户 2026-10-18 拍板）。用户名用正文色，
   不要和下面那排灰色元信息混成一片。 */
#sp .identity{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px 0 18px}
/* 头像与右侧两行文字按**底边**对齐：元信息行的底边正好压在头像下边缘上（用户 2026-10-18） */
#sp .idmain{display:flex;align-items:flex-end;gap:14px;min-width:0;max-width:100%}
#sp .idtext{display:flex;flex-direction:column;gap:4px;min-width:0}
#sp .identity .av,#sp .identity img{
  width:46px;height:46px;flex:none;border-radius:12px;overflow:hidden;
  border:1px solid var(--border);background:var(--surface-2);display:block;
}
#sp .identity .av{display:grid;place-items:center;font-size:20px;font-weight:600;color:var(--text-2)}
#sp .identity h1{margin:0;font-size:20px;line-height:1.15;font-weight:600;letter-spacing:-.3px;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 两行合计 = 23(h1) + 4(gap) + 19(meta) = 46 = 头像高度，所以底边天然齐平 */
#sp .identity .meta{max-width:100%}
#sp .meta{display:flex;align-items:center;gap:0;flex-wrap:wrap;font-size:12.5px;color:var(--text-2)}
#sp .meta span{padding:0 12px;border-left:1px solid var(--border)}
#sp .meta span:first-child{padding-left:0;border-left:none}
#sp .meta b{font-weight:600;color:var(--text)}

/* ==== 指标带 ====
   格数不是常数：多数账号 4 格，建过项目的 5–6 格（data-n 由 UI.kpis 写死）。
   布局用 flex + 一个变量 --kb（每格的基准宽度 = 容器宽 / 每排格数），两个好处：
     ① --kb = 100% / 格数 时就是整齐的一行；窄到放不下才换档折行；
     ② 每格都能伸（flex-grow:1），所以**折行后最后一排会自动铺满整行**，
        不会像固定列数的栅格那样在右下角留一块空洞。
   分隔线不用 border 而用 box-shadow：折行后"谁是每排第一个"由布局决定，CSS 选不出来；
   每格各往左、往上画 1px，最左/最上那两条正好落在容器边框上被 overflow:hidden 吃掉，
   于是任意排版下都只有一条线 —— 不缺线，也不双线。 */
#sp .kpis{
  display:flex;flex-wrap:wrap;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;box-shadow:var(--shadow);
}
#sp .kpi{
  flex:1 1 var(--kb,25%);min-width:0;padding:18px 20px;
  box-shadow:-1px 0 0 var(--border),0 -1px 0 var(--border);
}
#sp .kpi .k{font-size:11.5px;font-weight:500;color:var(--text-3);letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .v{margin-top:8px;font-size:27px;font-weight:600;letter-spacing:-.6px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .d{margin-top:6px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
#sp .kpi .d b{color:var(--text);font-weight:600}
/* 一行装几格：基准 = 容器宽 / 格数。减 1px 是留给亚像素取整的余量 —— 6 个 16.667% 相加
   可能超过 100%，不减速会让第 6 格被挤到第二排（曾经就是这么出问题的）。 */
#sp .kpis[data-n="3"]{--kb:calc(100% / 3 - 1px)}
#sp .kpis[data-n="4"]{--kb:calc(100% / 4 - 1px)}
#sp .kpis[data-n="5"]{--kb:calc(100% / 5 - 1px)}
#sp .kpis[data-n="6"]{--kb:calc(100% / 6 - 1px)}
/* 第一档（≤1240）：先缩内边距与数值字号，把一行**尽量保住** —— 越窄格越小，整条一起缩，
   缩完每个格还能容下最长那类数字（356,569,549 ≈ 140px），于是折行可以再往后推一档 */
@media (max-width:1240px){
  #sp .kpi{padding:16px 15px}
  #sp .kpi .v{font-size:24px;letter-spacing:-.4px}
}
/* 第二档：真放不下了才折成「一排 3 格」。阈值按"每格至少留约 145px 内容"倒推，
   最长的那类数字（356,569,549）在这个宽度下刚好不被省略号截断。 */
@media (max-width:1090px){#sp .kpis[data-n="6"]{--kb:calc(100% / 3 - 1px)}}
@media (max-width:920px){#sp .kpis[data-n="5"]{--kb:calc(100% / 3 - 1px)}}
/* 第三档：一排 2 格（4/3 格先掉到这档，5/6 格窄到 3 格也放不下时才掉） */
@media (max-width:745px){#sp .kpis[data-n="4"]{--kb:calc(50% - 1px)}}
@media (max-width:620px){#sp .kpis[data-n="3"]{--kb:calc(50% - 1px)}}
@media (max-width:480px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{--kb:calc(50% - 1px)}
}
@media (max-width:560px){
  #sp .kpi{padding:15px 14px}
  #sp .kpi .v{font-size:22px;letter-spacing:-.4px}
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
/* 面板内容的水平内边距：.phead 自己带 20px，内容必须同一边距，否则会左右各凸出 20px */
#sp .pbody{padding:0 20px}

/* ==== 图表 ==== */
#sp .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
@media (max-width:900px){#sp .grid2{grid-template-columns:1fr}}
/* 实况的占比：一条 100% 堆叠条 + 图例（比每项一条横条更直观，也不截断名字） */
#sp .stack{display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--surface-3);margin:8px 0 14px;gap:2px}
#sp .stack i{display:block;height:100%;min-width:3px;border-radius:3px;transition:opacity .12s}
/* 分类色块之间留 2px 缝：相邻色相（橙 / 金）在色弱下可能接近，缝是第二道边界。 */
#sp .stack.hl i{opacity:.3}
#sp .stack.hl i.hl{opacity:1}
/* 用 .llegend 而不是 .legend：后者已经被日历热力图的图例占用（横排、居中），同名会互相覆盖。 */
#sp .llegend{display:flex;flex-direction:column;gap:7px;width:100%}
#sp .lrow{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:3px 5px;border-radius:5px;transition:background .12s}
#sp .lrow:hover{background:var(--surface-2)}
#sp .lrow .sw{width:12px;height:12px;border-radius:3px;flex:none}
#sp .lrow .ln{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)}
#sp .lrow .lv{flex:none;min-width:54px;text-align:right;color:var(--text)}
#sp .lrow .lp{flex:none;min-width:40px;text-align:right;color:var(--text-3)}
/* 项目分布：条形列表。排名的重点是长短，不是色相 —— 8 项各配一色只会变成调色盘。 */
#sp .lbars{display:flex;flex-direction:column;gap:9px;margin-top:2px}
#sp .lbar{display:flex;align-items:center;gap:10px;font-size:12.5px;border-radius:5px;margin:0 -4px;padding:2px 4px}
/* 可钻取的行：项目分布点一行 → 下方明细按这个项目筛 */
#sp .lbar[data-p]{cursor:pointer;transition:background .12s}
#sp .lbar[data-p]:hover{background:var(--surface-2)}
#sp .lrow[data-v]{cursor:pointer}
#sp .you{font-size:11px;color:var(--accent);margin-left:6px;font-weight:600;white-space:nowrap}
#sp .lbar .ln{flex:0 1 44%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)}
#sp .lbar .ltrack{flex:1;min-width:36px;height:8px;border-radius:4px;background:var(--surface-3);overflow:hidden}
#sp .lbar .ltrack i{display:block;height:100%;border-radius:4px;background:var(--accent)}
/* 「其它」是聚合项，不是第 9 名：用分隔线和灰条把它和排名分开 */
#sp .lbar.other{border-top:1px solid var(--border);padding-top:9px;margin-top:2px}
#sp .lbar.other .ltrack i{background:var(--text-3)}
#sp .lbar .lv{flex:none;min-width:52px;text-align:right;color:var(--text);font-variant-numeric:tabular-nums}
#sp .lbar .lp{flex:none;min-width:38px;text-align:right;color:var(--text-3);font-variant-numeric:tabular-nums}
@media (max-width:620px){#sp .lbar .ln{flex-basis:38%}#sp .lbar .ltrack{min-width:24px}}
/* 「正在渲染 / 在线机器」这排切换离下面的搜索框远一点 */
#sp #sp-live-tab{margin:10px 0 18px}
#sp .tbl tbody tr.dim{opacity:.55}
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

/* ==== 渲染效率卡（总览右侧，可与月度产出互换） ==== */
#sp .effgrid{
  display:grid;grid-template-columns:1fr 1fr;gap:1px;
  border:1px solid var(--border);border-radius:var(--r-sm);
  overflow:hidden;background:var(--border);
}
#sp .eff{background:var(--surface);padding:12px 14px;min-width:0}
#sp .eff .k{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .eff .v{margin-top:6px;font-size:19px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .eff .h{margin-top:4px;font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 卡片右上角的「换回…」：phead 里的文字按钮 */
#sp .phead .subbtn{
  font:inherit;font-size:12px;color:var(--text-3);background:none;border:none;
  padding:0;cursor:pointer;white-space:nowrap;text-decoration:none;
}
#sp .phead .subbtn:hover{color:var(--accent);text-decoration:underline}
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
/* 走势给一个上限宽度：flex:1 撑满整格，会把线拉成一道 12:1 的划痕。
   但**必须能收缩**：窄窗口下格子只有 166px 宽，固定 160px 的线加数值会溢出格右边缘、
   被邻格盖住（实测溢出 43–77px）。flex-shrink:1 + min-width:0 让它按剩余空间缩，
   宽格子时仍由 max-width 顶在 160px。 */
#sp .farm svg{display:block;height:24px;width:100%;max-width:160px;opacity:.85;flex:1 1 auto;min-width:0}
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
/* 只有真的溢出才允许横向滚动：width:100% 的表格在宽屏下会有 1–2px 亚像素误差，
   scrollWidth 比 clientWidth 略大，不关掉 overflow-x 就会常驻一条底部滚动条。
   80-app 的 applyTableOverflow() 用 2px 阈值判断并挂 .has-x。 */
#sp .tablewrap:not(.has-x),#sp .tablewrap.log:not(.has-x){overflow-x:hidden}
/* 顶部镜像滚动条：只在表格真的横向溢出时由 80-app 插入。比原生滚动条细一档，
   不参与表格布局（高度固定 12px）。 */
/* 顶部镜像条不再自绘：继承全局 ::-webkit-scrollbar（10px / border-strong / 6px 圆角 /
   3px 底色描边），与表格底部那条原生滚动条完全同一套样式。容器高度就取 10px，
   等于滚动条自身高度 —— 之前 14px 加槽底，多的空白让条看起来被截断、不居中。 */
#sp .tscroll{overflow-x:auto;overflow-y:hidden;height:10px;margin:0 6px 2px;scrollbar-width:thin;scrollbar-color:var(--border-strong) transparent}
#sp .tscroll > div{height:1px}
/* 横向滚动的表格要能被键盘滚：wrapper 拿 tabindex=0，焦点环说明"这一块可以滚" */
#sp .tablewrap:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
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
/* 宽表横向滚动时固定首列：滚走以后读者不知道这一行是谁。只给 .fit 表做，
   避免影响那些首列本来就没有标识作用的表。 */
/* 首列 sticky 必须带 z-index：只给 position/背景时，后面滚过来的单元格（进度条）
   会在它上面绘制，肉眼看就是"进度条穿过项目名"。 */
#sp .tbl.fit thead th:first-child,#sp .tbl.fit tbody td:first-child{position:sticky;left:0;z-index:1;background:var(--surface)}
#sp .tbl.fit thead th:first-child{z-index:2}
#sp .tbl.fit tbody tr:hover td:first-child{background:var(--surface-2)}
#sp .tbl.fit tbody tr.me td:first-child{background:var(--accent-weak)}
/* 团队详情：固定列宽，成员列吃掉剩余空间（否则积分被推到中间、两边各一大片空） */
/* 列宽写在 th 上（col 的 width 在 fixed 布局里不稳），表格给显式宽度：
   否则 width:100% 会把成员列拉到一整屏，积分被推到中间、两边各一大片空。 */
#sp .tbl-team,#sp .tbl-teams{width:auto;max-width:100%;table-layout:fixed}
/* 数值列按内容给固定宽度，成员列吃剩余：百分比会让「最后渲染 / 移除成员」
   这两列各占 200px，中间空出一大截（用户实报"相隔有点远"）。 */
#sp .tbl-team{width:100%;table-layout:fixed}
#sp .tbl-team th:nth-child(1){width:64px}
#sp .tbl-team th:nth-child(2){width:auto}
#sp .tbl-team th:nth-child(3){width:150px}
#sp .tbl-team th:nth-child(4){width:180px}
/* 创建者视角多一列「最后渲染」：它和加入日期一样宽，成员列吃剩余 */
#sp .tbl-team-5 th:nth-child(5){width:150px}
/* 六列时第五列（最后渲染）也要给宽度 —— 它不属于 .tbl-team-5，漏了就挤成一团 */
#sp .tbl-team-6 th:nth-child(5){width:150px}
/* 再一列「移除成员」：按钮只有 60px，别给它 19% */
#sp .tbl-team-6 th:nth-child(6){width:88px}
/* 团队榜：六列固定宽度，队名列吃剩余 */
#sp .tbl-teams{width:100%}
#sp .tbl-teams th:nth-child(1){width:7%}
#sp .tbl-teams th:nth-child(2){width:31%}
#sp .tbl-teams th:nth-child(3),#sp .tbl-teams th:nth-child(4),#sp .tbl-teams th:nth-child(5){width:16%}
#sp .tbl-teams th:nth-child(6){width:14%}
/* 团队榜的「创建团队」表单 */
/* 导航显隐复用 .seg 的分段控件样式（用户 2026-11-13：风格要和下面一致）；
   常开项 disabled，但仍按选中态上色。 */
#sp #sp-navcfg{margin:10px 0 2px}
#sp #sp-navcfg button[disabled]{cursor:default}
#sp .teamcreate{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:6px}
#sp .teamcreate .input{flex:1 1 320px;min-width:0}
#sp .pn{font-weight:550;color:var(--text);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .pnwrap{display:flex;align-items:center;gap:7px;min-width:0}
#sp .pnwrap .pn{flex:0 1 auto;min-width:0}
#sp .ow{display:flex;align-items:center;gap:8px;color:var(--text-2)}
/* 排名标签的颜色就是原版那个状态：绿色 = 该成员此刻正在渲染（member.rendering） */
#sp .rankpill{display:inline-block;min-width:46px;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:600;line-height:1.5;text-align:center;background:var(--surface-3);color:var(--text-3)}
#sp .rankpill.on{background:var(--positive);color:#fff}
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
/* 进度：**条子与分数同一格**（用户 2026-10-07）。以前分数独占一列并右对齐，条子右端到数字
   之间空出近 100px（等于"列宽-条宽"再加"数字列左半截"），而项目名反被挤到截断。
   合成一格后条子 flex:1 吃满剩余宽度，和数字之间只隔一个 gap。
   ⚠ 分数必须**定宽**（min-width + 右对齐）：它宽度随数字位数变（498 / 500 是 29px，
   8,439 / 11,000 是 72px），不定宽时条子右端参差不齐 —— 实测项目页 51 行右端差 42px
   （用户 2026-10-07：「进度条也不等长」）。min-width 兜住最长的 16 字符分数，超长时盒子自己涨、
   条子让位，绝不裁掉数字。 */
#sp .pwrap{display:flex;align-items:center;gap:10px;min-width:0}
#sp .pwrap .bar{flex:1 1 auto;min-width:48px}
#sp .pwrap .frac{flex:0 0 auto;min-width:6.6em;text-align:right;font-size:11.5px;color:var(--text-3);white-space:nowrap}
#sp .bar .t{position:relative;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .bar .f{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
#sp .dev{display:inline-flex;gap:4px}
#sp .dev span{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-3)}
#sp .dev span.on{border-color:transparent;background:var(--accent-weak);color:var(--accent);font-weight:600}
/* 状态列在会话页放的是站点给的一整句原因（"Not enough free memory, requiring: …"），
   而 .st 原来既 nowrap 又没有上限 → 整列被最长那句撑到 376px，表格溢出容器出横向滚条
   （实测差 129px）。给个上限 + 省略号，完整原因走 title。 */
#sp .st{font-size:12.5px;color:var(--text-2);white-space:nowrap;display:inline-block;max-width:210px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
#sp .rankcell{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap}
/* 会话页「状态」列装的是站点给的一整句原因（"可用内存不足：需要 20 GB，现有 16 GB"）。
   只给省略号 + 悬浮，用户读不到结果本身（2026-10-07 实报），所以这一列**换行显示全文**：
   句子在列宽处折行，行高只对"真的长"的那几行变高。
   ⚠ 别退回 .st 的 inline-block 默认行为：.tbl.fit .st 的 max-width:none 去掉上限后它是
   "宽度=内容宽"，会撑出单元格被 td 的 overflow:hidden **硬裁**（没有省略号、没有换行）——这正是
   "很别扭"的来源。这里显式给 max-width:100% + 换行，两个毛病一起治。 */
/* 项目名过长也**换行显示全文**（用户 2026-10-07）：「既然能换行，那项目名过长也给换行了吧」。
   与「状态」列同一个理由 —— 省略号 + 悬浮读不到名字本身。名字常是下划线连成的一长串，
   得靠 overflow-wrap:anywhere 才断得开（不然一整个 token 撑破列宽）。 */
#sp .tbl .pn{white-space:normal;overflow-wrap:anywhere;max-width:100%;overflow:visible;text-overflow:clip}
#sp .tbl.dense.fit .st{white-space:normal;max-width:100%;overflow-wrap:break-word;overflow:visible;text-overflow:clip}
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
/* 高度恒定：批量操作常驻在右侧（未选中时只是「匹配 n / 共 total」文字），
   选中/确认/删除中都不该把它顶高一行 —— 否则点一下勾选，整张表就往下跳。 */
#sp .sechead{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:30px;margin:26px 0 12px}
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

/* ==== 已连接的机器 ====
   **一行一台**（用户 2026-10-07）：身份（标签 + 规格）/ 运行状态与时间 / 产出 / 查看会话 全在同一条线上。
   规格是唯一可伸缩的那段（窗口不够先省略号化），其余各段 nowrap；窄到 900px 以下才折行，
   那时身份独占第一行。之前是"标题一行 + 明细一行"两层盒子，两台机器就吃掉四行。 */
#sp .machines{display:flex;flex-direction:column}
#sp .machine{
  display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;
  padding:12px 20px;border-bottom:1px solid var(--border);
}
#sp .machine:last-child{border-bottom:none}
#sp .machine .mhead{display:flex;align-items:center;gap:10px;flex:1 1 200px;min-width:0}
#sp .machine .tag{
  flex:none;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:4px;
  background:var(--accent-weak);color:var(--accent);
}
#sp .machine .spec{flex:1;min-width:0;font-size:13.5px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .machine a.open{flex:none;font-size:12px;color:var(--text-3);white-space:nowrap;text-decoration:none}
#sp .machine a.open:hover{color:var(--accent);text-decoration:underline}
/* 状态与时间那一段：现在是**一条不折的行**（用「 · 」连起来），跟着规格后面走 */
#sp .machine .mline{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-3);min-width:0}
#sp .machine .mline > span{white-space:nowrap}
/* 产出那排贴着右边：左边是身份与状态，右边是数值 —— 全堆在左侧时右半边是空的，重心偏得厉害。
   数值做成**单行**（标签+数值并排）而不是标签在上/数值在下：后者是两行高的块。 */
#sp .machine .mfoot{display:flex;align-items:center;gap:10px 18px;min-width:0}
#sp .machine .mstats{display:flex;align-items:baseline;gap:18px}
#sp .machine .mstats .ms{display:flex;align-items:baseline;gap:5px;min-width:0}
#sp .machine .mstats .k{font-size:11.5px;color:var(--text-3);white-space:nowrap}
#sp .machine .mstats .v{font-size:14px;font-weight:600;color:var(--text);letter-spacing:-.2px;white-space:nowrap}
/* 窄到 900px：一行真放不下了才折 —— 身份占满第一行，明细与链接落到第二行，链接靠右 */
@media (max-width:900px){
  #sp .machine .mhead{flex:1 1 100%}
  #sp .machine .mfoot{flex:1 1 auto;flex-wrap:wrap}
  #sp .machine a.open{margin-left:auto}
}
#sp .machines .none{padding:16px 20px;font-size:13px;color:var(--text-3)}
@media (max-width:560px){#sp .machine{padding:12px 16px} #sp .machine .mstats{gap:22px}}

/* ==== 我的项目（总览区块 + 项目页「我发布的」档） ==== */
/* 行式样与「在线机器」同一套：左名字、右状态，行高与分隔线一致 */
#sp .myproj{display:flex;flex-direction:column}
#sp .myproj .mp{display:flex;align-items:center;gap:12px;padding:11px 20px;border-bottom:1px solid var(--border)}
#sp .myproj .mp:last-child{border-bottom:none}
#sp .myproj .nm{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .myproj .nm a{color:var(--text);text-decoration:none}
#sp .myproj .nm a:hover{color:var(--accent);text-decoration:underline}
/* 总览行内只放一个关键事实（自动删除日期 / 帧进度）：11.5px 单行省略，不撑高桌面行 */
#sp .myproj .mp .meta{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
/* 标题旁的一句汇总：渲染中数量 · 最近自动删除日期 */
#sp .phead .meta-sub{font-size:12px;color:var(--text-3);white-space:nowrap}
/* 「已被站点封禁」是状态不是警报：保持中性墨色，只加粗一点来区分。
   强调色只留给"你"和主操作，不给状态词上色（用户 2026-11-21 评审：红色误读成错误）。 */
#sp .st.bad{color:var(--text-2);font-weight:550}
#sp .phead a.sub{color:var(--text-3);text-decoration:none;white-space:nowrap}
#sp .phead a.sub:hover{color:var(--accent);text-decoration:underline}
/* 我发布的这张表没有设备/内存列，不必撑到 .tbl 的 660px 下限；进度列给条子留够就行。
   列宽一律按 class 定（c-pick / c-status / c-prog / c-act），不再用 nth-child ——
   行首是勾选列，按序号定宽会把整张表错位一列。 */
#sp .tbl-mine{min-width:0}
#sp .tbl-mine .c-pick{width:34px;padding:0 0 0 14px}
/* 勾选命中区是整个 44px 高的格子（label 包住 input），不是那个 14px 小方块 ——
   鼠标/触屏都不用瞄准。表头同一套，所以行高稳定在 44 上下。 */
#sp .tbl-mine .c-pick label{display:flex;align-items:center;justify-content:center;min-height:44px;cursor:pointer}
/* 44px 命中区只给行内单元格；表头 label 不撑高（否则 th 被顶高、勾选框与相邻表头文字错位） */
#sp .tbl-mine thead .c-pick label{min-height:0;height:100%}
/* 表头 c-pick 也要和其它 th 一样的 bottom padding：padding 不同 → cell 内容区高度不同，
   垂直居中后勾选框会比表头文字低半个 padding（实测 5px）。 */
#sp .tbl-mine thead .c-pick{padding-bottom:10px}
#sp .tbl-mine th{vertical-align:middle}
#sp .tbl-mine .c-status{width:110px}
#sp .tbl-mine .c-prog{width:200px}
#sp .tbl-mine .c-act{width:170px;text-align:right;white-space:nowrap}
#sp .tbl-mine .c-act .btn{margin-left:6px}
#sp .tbl-mine input[type=checkbox]{width:14px;height:14px;accent-color:var(--accent);cursor:pointer;vertical-align:middle}
/* 选中行比 hover 深一档：hover 是 surface-2，选中必须能被区分出来，否则移开鼠标就找不到选中的行 */
#sp .tbl-mine tr.picked{background:var(--surface-3)}
/* 项目名下的副标题（manage 页的事实）：12px 单行省略，没有数据时整行不存在，不占位 */
#sp .tbl-mine .pmeta{font-size:12px;color:var(--text-3);line-height:1.5;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 批量操作常驻在 sechead 右侧：未选中时它只是「匹配 n / 共 total」那段文字，选中后才长出按钮。
   容器一直占位，表格表头不会因为批量条出现/消失而上下跳。 */
#sp .sechead #sp-bulk{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2)}
/* .bulkbar 里的按钮有 .btn 的 display:inline-flex，会盖掉浏览器对 [hidden] 的默认 display:none ——
   不单独兜这两条，"该藏的按钮"会一直显示在行上。 */
#sp .bulkbar[hidden]{display:none}
#sp .bulkbar [hidden]{display:none}
/* 窄屏五列一起横向滚动，不隐藏进度列：表格给足列宽下限（34+110+200+170+项目名 ≥160），
   让 .tablewrap（overflow-x:auto + tabindex）滚，而不是把项目名压成每行一两个字。 */
@media (max-width:560px){#sp .tbl-mine{min-width:680px} #sp .bulkbar{flex-wrap:wrap} #sp .tbl-mine .c-act{white-space:normal} #sp .tbl-mine .c-act .btn{display:inline-block;margin:2px 6px 2px 0}}
@media (max-width:560px){#sp .myproj .mp{flex-wrap:wrap;gap:6px 10px;padding:11px 16px}}

/* ==== 顶栏模式开关 ==== */
#sp .modebtn{
  height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;
  border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);
  color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color .12s,color .12s;white-space:nowrap;
}
#sp .modebtn:hover{border-color:var(--border-strong);color:var(--text)}
/* 按钮内容只有文字（用户 2026-10-18：不要前面的羊图标，文案改成「< 原版界面」）。
   窄屏换短文案，别退化成空按钮。 */
#sp .modebtn .txts{display:none}
@media (max-width:1000px){#sp .modebtn .txt{display:none}#sp .modebtn .txts{display:inline}#sp .modebtn{padding:0 7px}}

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

/* ==== 项目管理页自绘的「项目设置」区 ====
   一行一件事：左边标签、右边控件、下面一句后果。开关行直接用 .sw，所以分隔线统一下在直接子元素上。 */
#sp .mg-ops .pbody > *{border-bottom:1px solid var(--border)}
#sp .mg-ops .pbody > *:last-child{border-bottom:none}
#sp .mg-ops .mg-row{display:flex;align-items:center;gap:14px;padding:12px 0}
#sp .mg-ops .mg-row .k{flex:none;width:96px;font-size:13px;color:var(--text-2)}
#sp .mg-ops .mg-row .seg{flex:none}
#sp .mg-ops .mg-row small{font-size:12px;color:var(--text-3);line-height:1.5;min-width:0}
#sp .mg-ops .mg-row.danger .k{color:var(--text);font-weight:550}
/* 危险动作：只有这一处用强调色描边，不做实心红按钮（误点的代价不可逆，宁可它不显眼） */
#sp .btn.danger{color:var(--accent);border-color:var(--accent)}
#sp .btn.danger:hover{background:var(--accent-weak);border-color:var(--accent);color:var(--accent)}
@media (max-width:560px){
  #sp .mg-ops .mg-row{flex-wrap:wrap;gap:8px 12px}
  #sp .mg-ops .mg-row .k{width:100%}
}

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
/* 完整日志：事件名左侧一个类型色点，行高压到一行 30px —— 一屏能看 30 条而不是 15 条 */
#sp .tbl.dense.log td{padding:4px 14px}
#sp .tbl.dense.log th{padding-bottom:6px}
#sp .tbl.dense.log .st{position:relative;padding-left:15px}
#sp .tbl.dense.log .st::before{
  content:'';position:absolute;left:0;top:50%;width:7px;height:7px;margin-top:-3.5px;
  border-radius:50%;background:var(--text-3);opacity:.7;
}
#sp .tbl.dense.log .st-rendering::before{background:var(--accent);opacity:1}
#sp .tbl.dense.log .st-validate::before,#sp .tbl.dense.log .st-send::before{background:#3f9d63;opacity:1}
#sp .tbl.dense.log .st-senderror::before,#sp .tbl.dense.log .st-error::before,#sp .tbl.dense.log .st-kill::before{background:#d9534f;opacity:1}
#sp .tbl.dense.log .st-request::before{background:var(--text-3);opacity:1}
/* 作业分组：连续的同一个 job 是一组，奇数组铺极淡底色 —— 组边界一眼可见，又不抢内容 */
#sp .tbl.dense.log tbody tr.grp > td{background:var(--surface-2)}
/* 这张表（会话页的「这台机器相关项目」）列多、状态那列又是长句子，自动布局下总宽会超过容器
   → 容器出现横向滚动条、右边两列被推出视野。固定列宽 + 单元格内省略号，让它永远正好装下；
   被截断的那些格子（.pn / 状态 / 发布者）本来就有 title，悬浮即可看全文。 */
/* 中等宽度（761–1200）不把六列压扁：压扁的结果是发布者/状态/设备/帧数全被截断，
   而容器又没有滚动条可看。给一个可读下限，不够宽就横向滚动。 */
#sp .tbl.fit{table-layout:fixed;min-width:980px}
#sp .tbl.fit th,#sp .tbl.fit td{overflow:hidden}

/* 列宽已经由 colgroup 定死了，.pn/.st 上那两个写死的 max-width 只会白白空出一截 */
#sp .tbl.fit .pn,#sp .tbl.fit .st{max-width:100%}
@media (max-width:720px){#sp .tbl.dense{min-width:560px}}
/* 1200 以下：横向滚动解决"列看不全"，但发布者/状态在列内再省略一次，读者还是读不到人。
   这两个字段改为换行；项目名仍保持单行（首列 sticky 时换行会把行高拉得很高）。 */
@media (max-width:1200px){
  /* 用户名常常是一整串没有空格的字符（mztothemoonstudio2）：只给 white-space:normal 不会断词，
     仍然溢出被裁；和项目名一样补 overflow-wrap:anywhere，长名字才会真的换到第二行。 */
  #sp .tbl.fit .ow span,#sp .tbl.fit .ow a.nm,#sp .tbl.fit .st{white-space:normal;overflow:visible;text-overflow:clip;max-width:none;overflow-wrap:anywhere}
  #sp .tbl.fit .ow{flex-wrap:wrap}
}
/* 窄屏：六列压进 390px 的代价是省略号、进度条溢出、名字全截断。
   保持表格可读宽度、靠横向滚动；首列**不再 sticky** —— 390px 里固定 28% 的首列会吃掉
   半屏，可动区域只剩右边一小块；取消后整表左右滑（与排行榜一致）。名字允许换行。 */
@media (max-width:760px){
  #sp .tbl.fit{min-width:760px}
  #sp .tbl.fit thead th:first-child,#sp .tbl.fit tbody td:first-child{position:static}
  #sp .tbl.fit .pn,#sp .tbl.fit .ow span,#sp .tbl.fit .ow a.nm,#sp .tbl.fit .st{
    white-space:normal;overflow:visible;text-overflow:clip;max-width:none;
  }
  #sp .tbl.fit .pn{overflow-wrap:anywhere}
  #sp .tbl.fit .ow{flex-wrap:wrap}
  /* 进度列：分数文本（最长 "8,439 / 11,000"）会把条子挤出列宽，横向滚动时看起来像穿透。
     窄屏让条子独占一行、分数落到下一行右对齐。 */
  #sp .tbl.fit .pwrap{flex-wrap:wrap;gap:4px 8px}
  #sp .tbl.fit .pwrap .bar{flex:1 1 100%;min-width:0}
  #sp .tbl.fit .pwrap .frac{flex:0 0 auto;min-width:0}
}

#sp .now{flex:none;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--accent-weak);color:var(--accent);white-space:nowrap}
#sp .dash{color:var(--text-3)}

#sp .acts{padding:2px 0 0}
#sp .acthead,#sp .actrow{display:flex;align-items:center;gap:12px;padding:0 20px}
#sp .acthead{font-size:11.5px;color:var(--text-3);padding-bottom:8px;border-bottom:1px solid var(--border)}
#sp .actrow{padding-top:9px;padding-bottom:9px;border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-2)}
#sp .actrow .ad{flex:none;width:64px;color:var(--text)}
/* 条列已删（用户 2026-11-13：和右边的时长数字重复，还占掉一半宽度）。
   数值列靠右、其余留白，不需要弹簧列也能对齐。 */
#sp .actrow .av{margin-left:auto}
#sp .actrow .av{flex:none;width:62px;text-align:right;color:var(--text)}
#sp .actrow .an{flex:none;width:44px;text-align:right}
#sp .actrow .aj,#sp .actrow .af{flex:none;width:44px;text-align:right;color:var(--text-3)}
#sp .actrow .af.on{color:var(--text-2)}
#sp .acthead .ad{flex:none;width:64px}
#sp .acthead .ad + .h{margin-left:auto}
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
/* 总览区块：每块一行（开关 + 上/下移）。行序就是页面上的顺序，所以别给这里的 .seg 加 flex:1。 */
#sp .ovlist{display:flex;flex-direction:column;gap:6px}
#sp .ovrow{display:flex;align-items:center;gap:8px}
#sp .ovrow .lock{font-size:11.5px;color:var(--text-3)}
#sp .foot{font-size:12px;color:var(--text-3);margin-top:26px;text-align:center}
#sp .toast{
  position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
  background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text-2);
  padding:9px 15px;border-radius:var(--r-sm);font-size:12.5px;box-shadow:var(--shadow);z-index:10;
}

#sp .hint.bad{color:var(--accent)}

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
      #sp-mode-pill img{width:16px;height:16px;flex:none;border-radius:4px;display:block}
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
      /* 换界面的幕布与导航遮罩也活在 body 下：它们是过渡本身，不能被守卫一起压掉 */
      body > *:not(#sp):not(#sp-sweep):not(#sp-veil){display:none !important}
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
    /* 16×16 的路径放进 24 的 viewBox 会偏到左上角（刷新按钮"看着不居中"就是这个）：
       统一 scale(1.5) 折到 24，圆心正好落在中间。 */
    refresh: '<g transform="scale(1.5)"><path d="M13.65 2.35A7.96 7.96 0 0 0 8 0C3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"/></g>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M20.6 14.4A8.7 8.7 0 0 1 9.6 3.4a8.7 8.7 0 1 0 11 11z"/>',
    search: '<path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/>',
    user: '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.34 0-10 1.67-10 5v3h20v-3c0-3.33-6.66-5-10-5z"/>',
    gear: '<path d="M19.14 12.94a7.5 7.5 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.86a.5.5 0 0 0 .12.62l2.03 1.58a7.5 7.5 0 0 0 0 1.88L2.82 14.52a.5.5 0 0 0-.12.62l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.39 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.55 1.62-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.6 3.6 0 0 1 12 15.6z"/>',
    sheep: '<path d="M17 4a3 3 0 0 0-2.82 2H9.82A3 3 0 1 0 4 8.83V15a4 4 0 0 0 4 4h8a2 2 0 0 0 2-2v-2.2A3 3 0 0 0 17 4zm0 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/>',
    caretUp: '<path d="M12 8.5l5.5 7h-11z"/>',
    caretDown: '<path d="M12 15.5l-5.5-7h11z"/>',
    star: '<path d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96z"/>',
    more: '<path d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    /* 底部导航用：文件夹（项目）与条形（排行榜） */
    folder: '<path d="M2 5.5h6.2l1.7 2H22v11.9a1.1 1.1 0 0 1-1.1 1.1H3.1A1.1 1.1 0 0 1 2 19.4zm2 3.5v10.9h16V9z"/>',
    bars: '<path d="M4 6h16v2H4zm0 5h11v2H4zm0 5h14v2H4z"/>',
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
  /* 品牌图标：用户给的位图（64×64，深色底，量化到 64 色减小体积）。
     顶栏 20px、左下角「切回新界面」16px 都用它；替换素材时只改这一条 data URI。 */
  const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAwFBMVEX+///9//r7//39/Pb8+vT7+/X9+fH8+fT8+fP8+fL7+fP++PH8+PP8+PL7+PP7+PL6+PL7+PH+9+/+9u799+/99u799u3+9e399e399Oz89/H89O769vD39O/68Or66+Tz7efx6OLz5t/s497u1s7juK79kn79cFj+ZEj+YUb+XkT7dV6xgnj+WT3+UzfgVj6cQzRcOTM4LSohHh0fHBwdHBscHBscGxscGxobGxocGhobGhobGhkYGhoSFxcNDg8uHn+GAAAJKklEQVR42l1Yi3qizBIchKyEIHjCqoBc5RJQARFdERN8/7f6qwd03TNfYkTpmu7q6p4m7HKmRa+nc3tp2/7UnPrr6XJp8YN1OV/oDV3SH/4Zvec3/DmfWUf3nC/DR+25r6uqOrQ/p/HG9mXd6OX6egEDdhvw8Lbl9nm+3WZV0xMCPu3oXqzx9Tq+7brbbfgYAOTLqf35aU+nU3/It4AAws+ZbAlgvJfWFQDtiMNX1zK+/7n/aZpr3xNAXh0yIPwMLnY3sr8OO75AjavtOMAQeXWoz/djvq0aQjj0pxHi+rRt/88aRNwI4DREDt+ruj9k2eEOhPzYn0cOcWfXEX2E1XWP+AmgAwCS0FewzzNOX73Nt82pyrOKAxAEIr0N/HOnn360iKxDGgeAqq4PW2wMT+BCDSLrvmlO51PTnPmWVw71bxBwhtKIEGBZHe/NoaJY8u0RQeRVf7/fe7z0pzNnvh1T+swJUUNCOoP8LM+zw/H+U1cZMXg/gpG63idY++O9bwYP/nWBZ5jB/Afb1Igi3z4hGkAWKRuWlhzvp3H/pw+QBDgAwKnvm/pQVUP0+aHpr7hs+uO2+LIcJwjD0GXz/X1IKoJ+iANQJA/WHxE4AoDLGa363hzr+tiAhSKeOEEUxXHksf29GYRJCR0DABCEBOp5DkFadTjUR+AVRUFJycpkYkuS4gZRHLF69AH7jlF0PA1sUABUeAQVxEWZ7dJdVmZVVaQTe6brijQP4iC+fF9ICtdh60caWwbz6nDsQTQgmkPxlfhvwpufFnlW7CR1pqq6rkpyKNQUxMDBSzZbRvK9E29UQNjUY+K7PRMnSZFtd2tpJquqrGqyw5KBhbEPPKXE8sPxQDRS9g9wWlrPZFm27cmuIIB3XMiqLOvafOCxG1rKmElwwPnLeSWR/czm98v2JCm3O3FG7weE6ZCJMYihlrkHPAWQUXaoso1gy8MCQEEkjpeIw9FETkN7OnckhOuVAL5Ztd0iBVR9hxcD2WZpUSR/r+GEI8Q/P82pvfd/BiKoW32z5gjRoJi2SGDC7NFhVZ7uiswfQxjiAJF7JLqv657370GZ7PYHH0HHVZKW8eQBsGZJUabsGQF/0eZilCQxEkpdfyCzY839CNO8SNgOHqyH+9cTHyqgJP67dAG1xevi0t6GVsXutWvl2yIVJmm5E2V7NrNtm/m7Ih/8UV9YQBSuu++/L5wA3k86thdYWqJuBCEG7WwiigITk69ysP9rzpnRp2F9v5xe+vU3E9/8bAvRzmy4UKSx72+SXVnuYK+9bE2/GlStRfuejq2OtxPqiQ4UkxH/s6maFmWJEijLr9TC/qr60ICqkiIVFYUhsIQfW7chjy3T36DZzH+byTNJiFGHKMbEn7w5kuPK74DQOIZKZfVOUbgsBkL3ODDZJC6yEgrCrYhiYnuePWFvti3roSPrcJ0A3mUXF6MmXJb0HfefEsEmnEIOoKq2PRVFyUYqZDkM4fRIgyoFrqQ/6HSpKsZTt2MREvZFEQzfq2QrK9h/Ez75VwEQPAFUXXOP/ODjWYgzHoHuvuhFkZzQ9zaDxyrPQBg8QsDiLhCFdC74X+VuIzqhKykULGd+6oXepxXqj1pW4VCoP91RdTE49pcblxJ728Sq4IaBNIp1Jk8dzzcNc+U78owzQw0pBKXKIwbNoR47tjRbnOhBNOCDYV1yPM/6NFbmp+9JOgcAPc5m88KizmPgB23LVDsII54x+iZwA880DNOyLMMKwJdNEQAgjAiO60F3BhK4GDumqW7gKoqO3qtP3SjyPpemuRJF0TQ8V7I9mfqyvPYipAFSxpJDl1rsiY4VpFHTptJU0zUCkIINvMf+H8kuFq2VN5+G7lSf6bJrQhYat59LQegMIfCeOJ2iQnSNf6nAfQRgiXFZZv7HylxLSKYKYh3Dj2x+jzaX4M0LgMM1pniOPtf1tYG1soSUxPVhLs216kNPM9U2rI2rzLGPMpfcKBDGk+7aMRy+su64oUP4C5MAfvlZXqaCZZhYhu+vZW22/Aw9ac4dVZxYTO7noSUSQBSFAYSkzHVtYa0+F5aAAt+CA2OxAKEfouLYGrIKFjWsuYIzf5AyVyJyiCxIYSjNwYHv+7DbUYcxzeViYZq/vTT1f6/NTy8EgKIomiPGZD+OXyyKAlHWFTcCFcoaAP5vf5uXiWAtDNiDj5LCMQ0r5BQQQIRxio9eFEIURQ7yOwUL07nib4AgpcXO+20igCUc+MrRca3lykCUPAbdYfERo9dlGHVBAQUHdj1X0XSK4fevjfUBe7gAPgq0C9FamMQiT/dMdYRov8cgytt64m0QxBzpdUPDtn9bCHwlLczFcrGEpMQUhzSSsUAaAmmuAIFKRkBf+77wjnTEIBeGMxsQgWWtLHJ2aa6W3ANL2mwz4sNcGGYUQghgK1AVwd03cIA31b75qYMoQBfVPM+wLM49/zGMJWU0327erRUqI0JP0ecy6mWN0fH7dOMHPfuDMS1N0wQQtrfizhJ7cB9/LSlGvxItfPwZRFSyOoQc+TjnzzyJAMBsn2EsK77SyA19iM8wFvzHAMDClPx4gdoGKnE9dR0Jg1+I85lPWEQiDXU0IW7LDFz4qEUSIBhcAmW5tH5JpA3PCEJVlrwA7TUKk5ZXMh8Q2C7FYVKUBUHs4iCkbkQltaAFHJPUCYQAXSWgrhJFK1RSN54sN/YmCFM/TqBeHGp5EmwCQJjkP0WB8jYtsvcx8kL1uhJEH3sMGH8BdNtWRZxFcZoXVITBJgw84xMyXq2WFAQQ0Fog2CiM3P+JH8H++/v8fBTsGLrcO0aC2WSygWYyjhCGnmV8/vqg1ogErJDCiBwIXCHc13duf+tGDx7nr20Lk/gLuk04AtxAVxbQ11aWR3InF1wWHOnx4+VhlHswLgyXXlpuv7h9uAnSDPJwN2S5CZLQ+2AMDw7N6cWaA8w07QGxlibJtoQR7N0YkxsmPQcMWsG+jvbJvv7um8GUmsGF93WmzzQcqKMPQpKilPlDRpKVUEh53A8PPQ0K+E7TzfAg9/eZmg229CrPhA1pIYEDAWLBoJEk9f3+TaP8Nx5tm4bb0vP8+cnDCwcYb6l2JxPZdVNMS8oEi+1PF/xDoINVOzznt8M/DEAAH9b+A3ldNssfsJkhAAAAAElFTkSuQmCC';
  const logo = (cls) => `<img class="logo ${cls || ''}" src="${LOGO}" alt="" decoding="async">`;

  const icon = (name, cls) =>
    `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const initial = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();

  /** 头像：取不到图（懒加载未完成）就退回首字母，不留破图 */
  const avatar = (src, name, cls) => (src
    ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls || ''}">${esc(initial(name))}</span>`);

  /* ---- 确认框：原生 <dialog>，替代 window.confirm ----
     window.confirm 两个硬伤：样式不可控（深色界面弹一个白框）、说不出"删了会怎样"。
     原生 dialog 自带焦点陷阱、Esc 关闭、::backdrop、关闭后焦点回到触发元素 —— 这些都不该手写。
     返回 Promise<boolean>，调用点仍然是一次 await。危险操作默认焦点落在「取消」上。 */
  let dlgSeq = 0;
  function confirmBox(opts) {
    const o = opts || {};
    const id = ++dlgSeq;
    const dlg = document.createElement('dialog');
    dlg.className = 'spdlg' + (o.danger ? ' danger' : '');
    /* 不写 role / aria-modal：原生 modal 已经提供 dialog 语义（指南的 DON'T）。
       危险操作靠红色确认键与后果文案表达，不靠改 role。 */
    dlg.setAttribute('aria-labelledby', 'sp-dlg-t' + id);
    if (o.body) dlg.setAttribute('aria-describedby', 'sp-dlg-b' + id);
    /* closedby="any"：原生的「点遮罩关闭」。不支持的浏览器由下面那个 click 兜底。 */
    dlg.setAttribute('closedby', 'any');
    /* <form method="dialog">：按钮的 value 直接写进 returnValue；
       Esc、点遮罩、两个按钮全都汇到同一个 close 事件 —— 不需要给每个出口各挂一个处理器
       （html 指南的 DO：用原生关闭，不要手写 JS）。 */
    dlg.innerHTML = `<form method="dialog" class="dlg-in">
        <h2 class="dlg-t" id="sp-dlg-t${id}">${esc(o.title || t('dlg.title'))}</h2>
        ${o.body ? `<p class="dlg-b" id="sp-dlg-b${id}">${esc(o.body)}</p>` : ''}
        <div class="dlg-a">
          <button type="submit" class="btn" value="cancel" autofocus>${esc(o.cancel || t('dlg.cancel'))}</button>
          <button type="submit" class="btn ${o.danger ? 'danger' : 'primary'}" value="ok">${esc(o.ok || t('dlg.ok'))}</button>
        </div>
      </form>`;
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => {
        resolve(dlg.returnValue === 'ok');
        // 先 close 让浏览器把焦点还给触发元素，再摘节点
        setTimeout(() => dlg.remove(), 0);
      });
      /* closedby 的降级（Safari 尚未支持）：只在缺这个 IDL 属性时补一次。
         点遮罩时 event.target 就是 dialog 本身（内容全在 .dlg-in 里），子元素不会误判。 */
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dlg.addEventListener('click', (ev) => { if (ev.target === dlg && dlg.open) dlg.close(''); });
      }
      // 挂进 #sp 才能在 top layer 里继承主题 token；dialog 的 top layer 不受父级 overflow 影响
      (document.getElementById('sp') || document.body).appendChild(dlg);
      dlg.showModal();
    });
  }

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
    const today = Util.dkeyLocal();   // 本地日：与站点活动日期、streak 口径一致（UTC 在东八区 0–8 点会差一天）
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
    if (!keys.length) return { html: '' };

    const vals = keys.map((k) => buckets.get(k));
    const mx = Math.max(...vals), mn = Math.min(...vals);
    const bars = vals.map((v, i) =>
      `<i style="height:${Math.max(2, Math.round((v / Math.max(1, mx)) * 132))}px" title="${esc(keys[i])} · ${fmt(v)} ${esc(t('heat.frame'))}"></i>`).join('');

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
        /* 站点只给值序列、不给时间戳；悬停只能报「第几个采样点的值」。
           每个点一段透明热区 + 原生 <title>，不引 JS、不占布局。 */
        const n = series.length;
        const hits = series.map((v, i) =>
          `<rect x="${(i * 100 / n).toFixed(2)}" y="0" width="${(100 / n).toFixed(2)}" height="20" fill="transparent"><title>${esc(fmt(v))}</title></rect>`).join('');
        spark = `<svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".75"/>${hits}</svg>`;
      }
      return `<div>
        <div class="k">${esc(s.key ? t(s.key) : s.label || '—')}</div>
        <div class="row"><span class="v num">${esc(s.value === undefined || s.value === null || s.value === '' ? '—' : s.value)}</span>${spark}</div>
      </div>`;
    }).join('')}</div>`;
  }

  /* 站点的时间字符串是 "06:40 Sep 29"（**不给年份**），认不出就返回 null —— 宁可不显示也不猜。 */
  const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function whenOf(raw) {
    const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2})$/);
    const mo = m && MON3[m[3].toLowerCase()];
    if (!mo) return null;
    const now = new Date();
    const mk = (y) => new Date(y, mo - 1, Number(m[4]), Number(m[1]), Number(m[2])).getTime();
    const t = mk(now.getFullYear());
    // 用它自己的年份算出来比现在晚一天以上 → 那是去年的（跨年那几天会踩到，所以留一天的余量）
    return t - now.getTime() > 864e5 ? mk(now.getFullYear() - 1) : t;
  }

  /** 站点的「相对时间」："9m" / "02h05m" / "3d04h" / "1y20d"（Misc::humanTime 的格式，可补零）。
      返回毫秒数；认不出（如 "Never"）返回 null。会话页的 Last request (Job) 就是这种。 */
  function agoMs(raw) {
    const s = String(raw || '').trim();
    if (!/^\d/.test(s)) return null;
    const m = s.match(/^(?:(\d+)y)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return null;
    const [y, d, h, mi, se] = m.slice(1).map((v) => Number(v || 0));
    if (!y && !d && !h && !mi && !se && !/\d/.test(s)) return null;
    return ((((y * 365 + d) * 24 + h) * 60 + mi) * 60 + se) * 1000;
  }
  const relOf = (raw) => { const ms = agoMs(raw); return ms == null ? null : Date.now() - ms; };

  /** 时长的紧凑写法：3d4h / 2h30m / 19m。**故意不翻译** —— 翻一次要多四组词条，不值。 */
  function agoText(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d${h}h` : h ? `${h}h${m}m` : m ? `${m}m` : `${s}s`;
  }

  /** 站点把「客户端侧暂停」与「服务端侧暂停」写成**两个独立条件、两行**
      （`running.html.twig:296-314`），所以**两个可以同时成立**。返回全部命中的词条键（按站点行序）：
      会话页一档画一个 chip；在线机器那行拼成一句（那里是紧凑数据行，不套 chip）。
      原文一并返回，调用方挂在 title 上 —— 站点那行写的什么，悬浮就能看到。 */
  const PAUSE_RES = [['sess.pausedClient', /paused\s+client\s+side/i], ['sess.pausedServer', /paused\s+server\s+side/i]];
  function pauseKeys(note) {
    const s = String(note || '');
    return PAUSE_RES.filter(([, re]) => re.test(s)).map(([k]) => k);
  }

  /** 一台连着的机器的详情。主页那块只给「客户端 + 规格」；其余都是**逐台取它自己的会话页**
      解析出来的（见 80-app.js 的 machineDetails）。取不到就整截不画、照旧只显示规格 ——
      不编数据。

      渲染方式看站点的 **Compute device** 那一格，那才是"客户端这一路开着没有"的权威字段
      （模型单元格不能用：客户端取消了 CPU，CPU 型号照样在页上）。没那一格就退回算力单元格
      ——**关掉的那一路不会有 Power 值**；两样都没有就整排不画，不猜。**只画开着的那几路**：
      只勾 CPU 的机器就只有一个 CPU 徽章，不再摆一个灰的 GPU。

      算力百分比直接写在 CPU / GPU 标签里（`CPU 22 %` / `GPU 260 %`），不再单列「算力 CPU」
      那种格子 —— 同一件事说两遍正是"看着杂"的来源。
      时间显示**算出来的相对值**（跑着的算到"现在"，停了的算到最后一次请求），站点原文挂在
      title 上，鼠标悬浮才出来；算不出来就整条不显示。 */
  function machineDetail(d) {
    if (!d || !d.info) return '';
    const val = (k) => { const x = d.info[k]; return x && x.value ? String(x.value) : ''; };
    const now = Date.now();
    const cRaw = val('createdAt');
    const cT = whenOf(cRaw);
    const cdRaw = val('computeDevice');          // 站点原文（挂在 title 上，别小写化）
    const cd = cdRaw.toLowerCase();              // 判据用小写比较
    const power = (k) => { const v = val(k).trim(); return v && !/^0\s*%?$/.test(v) ? v : ''; };
    const pCpu = power('power'), pGpu = power('powerGpu');
    const cpuOn = cd ? /cpu/.test(cd) : !!pCpu;
    const gpuOn = cd ? /gpu/.test(cd) : !!pGpu;
    const chip = (label, v) => `<span class="on">${esc(label)}${v ? ` ${esc(v)}` : ''}</span>`;
    /* **只画勾选了的那一路**（用户 2026-10-07）：只勾了 CPU 就只写 CPU，不再摆一个灰的 GPU 徽章。
       判据仍是站点的 **Compute device** —— 它只可能是 `CPU` / `GPU` / `CPU,GPU` / 空
       （SessionController.php:121-130 一段一段拼出来的），所以"哪几路开着"是站点自己说的；
       没有那一格时退回"有非零算力才算开着"。认不出的值（站点以后加了第三种）原样画出来
       —— 不猜，也不吞数据。cd 有值时把原文挂 title。 */
    const devChips = [];
    if (cpuOn) devChips.push(chip(t('proj.cpu'), pCpu));
    if (gpuOn) devChips.push(chip(t('proj.gpu'), pGpu));
    if (!devChips.length && cdRaw) devChips.push(chip(cdRaw, ''));
    const dev = devChips.length
      ? `<span class="dev"${cdRaw ? ` title="${esc(t('sess.computeRaw', { raw: cdRaw }))}"` : ''}>${devChips.join('')}</span>` : '';
    const lastRaw = val('lastRequestJob');
    /* Last request (Job) 是**相对时间**（"19m" / "02h05m"），Creation Time 才是绝对时间。
       停着的机器用「最后一次请求」当结束点，两种格式都认；认不出就不画那条。
       用显式 null 判断（别用 ||：绝对时间戳理论上可能是 0）。 */
    const lastAbs = whenOf(lastRaw);
    const endT = d.running === true ? now : (lastAbs != null ? lastAbs : relOf(lastRaw));
    /* 这一格现在只说**状态**（用户 2026-10-07：被列进"在线机器"本身就等于在运行，写「运行中」
       没有信息量）。三种状态，判据都在站点自己的页面上：
         · 暂停：那两行 note（客户端侧 / 服务端侧，可同时成立）；
         · 渲染中：`Current frames` 那一行**只在 frames_processing 非空时才印**（running.html.twig:381），
           所以"有这一行"就是正在干活；
         · 等待任务：连着的、没暂停、也没有当前帧 —— 就是闲着等派活。 */
    const note = (d.info.note && d.info.note.value) || '';
    const pauseText = pauseKeys(note).map((k) => t(k)).join(' · ');
    const working = !!val('currentFrames');
    const statusHtml = pauseText
      ? `<span title="${esc(t('sess.statusRaw', { raw: note }))}">${esc(pauseText)}</span>`
      : note ? `<span title="${esc(note)}">${esc(note)}</span>`
        : working ? `<span>${esc(t('machines.state.rendering'))}</span>`
          : d.running === false ? `<span>${esc(t('sess.off'))}</span>`
            : d.running === true ? `<span>${esc(t('machines.state.idle'))}</span>` : '';
    const bits = [
      statusHtml,
      cRaw && cT && endT
        ? `<span title="${esc(t('machines.created', { v: cRaw }))}">${esc(t('machines.uptime', { v: agoText(endT - cT) }))}</span>` : '',
    ].filter(Boolean);
    const stats = [['frames', 'stat.frames'], ['points', 'stat.points']]
      .filter(([k]) => val(k))
      .map(([k, key]) => `<div class="ms"><span class="k">${esc(t(key))}</span><span class="v num">${esc(val(k))}</span></div>`);
    if (!dev && !bits.length && !stats.length) return '';
    const line = (dev || bits.length) ? `<div class="mline">${dev}${bits.join(' · ')}</div>` : '';
    return `<div class="mfoot">${line}${stats.length ? `<div class="mstats">${stats.join('')}</div>` : ''}</div>`;
  }

  function machines(m) {
    const list = (m && m.list) || [];
    if (!list.length) return `<div class="machines"><div class="none">${esc(t('machines.none'))}</div></div>`;
    /* 一行一台：身份（标签 + 规格）→ 运行状态与产出 → 「查看会话」。链接放在**最后**，
       它才落在整行右端；跟着身份走会插在状态中间，看着像"规格的附属"。 */
    return `<div class="machines">${list.map((x) => `<div class="machine">
        <div class="mhead">
          <span class="tag">${esc(x.client || t('machines.unknown'))}</span>
          <span class="spec" title="${esc(x.spec)}">${esc(x.spec || '—')}</span>
        </div>
        ${machineDetail(x.detail)}
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

  /** 6px 轨道 + 强调色填充。分数与条子**同一格**（见 50-views.js 的项目表 `pcell`，用户 2026-10-07）：
   *  分数用 `.frac` 定宽（`min-width:6.6em`）才不会把每行的条子挤成长短不一；`label` 只挂在轨道上做悬停提示。 */
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
    error: (msg, retryId) => `<div class="state">
        <div class="big">${esc(t('state.error'))}</div>
        <div class="small">${esc(msg || '')}</div>
        <button class="btn primary" id="${retryId || 'sp-retry'}">${icon('refresh')}${esc(t('state.retry'))}</button>
      </div>`,
    empty: (msg) => `<div class="state"><div class="small">${esc(msg || t('state.empty'))}</div></div>`,
    /* 登录后跳回 /home。**重定向那段不能 URL 编码**：实测 /user/signin/%2Fhome 与
       /user/signin%2Fhome 都是 404，站点路由认不出编码过的斜杠（2026-10-07 真机）。
       /user/signin 与 /user/signin/home 都是 200，后者签完确实跳回 /home。 */
    loggedOut: () => `<div class="state">
        <div class="big">${esc(t('state.loggedOut'))}</div>
        <div class="small">${esc(t('state.loggedOutHint'))}</div>
        <a class="btn primary" href="/user/signin/home">${esc(t('state.loggedOutBtn'))}</a>
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
  let chartResize = null;   // 没有 ResizeObserver 时的 window.resize 兜底监听

  /** 视图卸载/切换时收掉图表观察器（单节点泄漏 + 对 0 宽节点重画）。 */
  function disposeCharts() {
    if (chartObs) { chartObs.disconnect(); chartObs = null; }
    if (chartResize) { window.removeEventListener('resize', chartResize); chartResize = null; }
  }

  /* 站点给的日期串有三种形状："Aug 27" / "27-07-2026" / "2026-10-07"。
     中文环境统一成「7月27日」；跨年才带年份（图表跨度 3–4 个月，同年省略年份更省 x 轴空间）。
     英文环境保持站点原样 —— 这是站点自己的日期写法，不替它改。 */
  function dateLabel(raw, opts) {
    const s = String(raw || '').trim();
    if (!SP.I18n || SP.I18n.lang !== 'zh') return s;
    const forceYear = !!(opts && opts.year);
    let y = '', m = 0, d = 0, mm;
    if ((mm = s.match(/^(\d{1,2})-(\d{2})-(\d{4})$/))) { d = +mm[1]; m = +mm[2]; y = mm[3]; }
    else if ((mm = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { y = mm[1]; m = +mm[2]; d = +mm[3]; }
    else if ((mm = s.match(/^(\d{1,2})-(\d{2})$/))) { m = +mm[1]; d = +mm[2]; }
    else if ((mm = s.match(/^(\d{4})-(\d{2})$/))) { y = mm[1]; m = +mm[2]; }
    else if ((mm = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2})$/)) && MON3[mm[1].toLowerCase()]) { m = MON3[mm[1].toLowerCase()]; d = +mm[2]; }
    if (!m) return s;
    const sameYear = !y || y === String(new Date().getFullYear());
    const head = (y && (forceYear || !sameYear)) ? y + '年' : '';
    return head + m + '月' + (d ? d + '日' : '');
  }

  function pointsChart(box, series, opts) {
    if (!box || !series || series.length < 2) return;
    /* 单位跟着调用方走：总览是「积分」，实况是「帧 / 台」——不能写死。 */
    const unit = opts && opts.unit !== undefined ? opts.unit : t('chart.tipPoints');
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
        `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}" font-size="11" fill="var(--text-3)">${esc(dateLabel(series[i].d))}</text>`).join('');

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
        tip.innerHTML = `<b class="num">${fmt(vals[i])}</b>${unit ? ' ' + esc(unit) : ''}<i>${esc(dateLabel(series[i].d))}</i>`;
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
    disposeCharts();
    if (window.ResizeObserver) {
      chartObs = new ResizeObserver(() => window.requestAnimationFrame(draw));
      chartObs.observe(box);
    } else {
      chartResize = draw;
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

  SP.UI = { icon, ICONS, logo, avatar, confirmBox, kpis, heatmap, bindHeatTips, months, farm, machines, machineDetail, pauseKeys, progress, progressText, devices, state, newUser, skeleton, compact, dateLabel };
  SP.Charts = { points: pointsChart, dispose: disposeCharts };
})();

/* ===== src/45-view-kit.js ===== */
/* ==== 45-view-kit.js：视图层的公共小件 ==== */
/* 50-54 是同一个 IIFE 的五个片段（见 docs/ARCH.md §2），它们共用的东西放这里，
   让「谁提供 esc/fmt/foot」不再只存在于 50 的顶部。

   这是视图层解耦的第一步：先让公共件有单一来源，再把 51-54 各自 IIFE 化。
   目前 51-54 仍然通过 50 的作用域拿到这些名字（50 从 SP.VK 解构），行为不变。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t } = { Util: SP.Util, UI: SP.UI, t: SP.t };

  const esc = Util.esc;
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const foot = () => `<div class="foot">${esc(t('footer.source'))}</div>`;

    function dailySeries(cum) {
    /* toSorted：不先拷贝再排序，原数组也不可能被就地改掉（这里传进来的 cum 来自 state） */
    const rows = (cum || []).filter((p) => p && p.d && Number.isFinite(p.v))
      .toSorted((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
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

  /* 站点 Rank 只有两种形态：名次本体（"718th" / "1,123rd"），或一句说明
     （"Has not rendered anything for at least 31 days"）。上游排名计算出过 bug
     （2026-11：有积分的账号也拿到这句），旧实现把非数字全抹掉，会把那句里的
     31 当成第 31 名。所以只认「数字 + 可选序数后缀」，其余一律视为没有排名。 */
  const RANK_RE = /^(\d{1,3}(?:,\d{3})*|\d+)\s*(?:st|nd|rd|th)?$/i;
  const rankOf = (st) => {
    const m = String(statOf(st, ['Rank'])).trim().match(RANK_RE);
    if (!m) return '';
    const n = m[1].replace(/,/g, '');
    return /^0+$/.test(n) ? '' : n;
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

  /* 站点给的原因里有的带数字（内存那句每次都不一样），slug 查不到 → 先用 WHY_RULES 规则匹配；
     英文词典里没有 why.* 条目，所以没命中要回落原句。 */
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

  /** 每页条数（设置里可选）：moreRow 的步长与各列表的初始 limit 都读它。 */
  const pageSize = () => {
    const n = Number(Util.store.get('pageSize', 100));
    return [100, 200, 500].includes(n) ? n : 100;
  };

  function moreRow(shown, total, step) {
    if (shown >= total) return '';
    return `<div class="more">
      <button class="btn" id="sp-more" data-step="${pageSize()}">${esc(t('list.more'))}
        <span class="num">${esc(t('list.shown', { n: shown, total }))}</span></button>
    </div>`;
  }

  /* 导航项的唯一清单：80-app 的顶栏与 54 的设置页都读它，两边永远一致。
     locked = 常开（总览 / 设置）。 */
  const NAV_ITEMS = [
    ['overview', true],
    ['projects', false],
    ['upload', false],
    ['ranking', false],
    ['live', false],
    ['teams', false],
    ['account', false],
    ['settings', true],
  ];

  /* ---- 视图公共组件 ----
     这些片段原来在每个视图里各写一遍（panel 27 处、sechead 10 处、表内空行 7 处）。
     提取判据：结构完全同构、只差文案与类名；带视图私有事件的不放进来。 */

  /** 面板：标题 + 副标题 + 内容。内容默认走 .pbody（与 .phead 同为 20px 边距）——
   *  「内容比标题凸出」就是漏了这层。pad:false 表示调用方自己控制内容边距。
   *  title / sub / right 接**已转义**的 HTML，组件不重复转义。 */
  const panel = (o) => `<div class="panel${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''}${o.style ? ` style="${o.style}"` : ''}>`
    + (o.title ? `<div class="phead"><h2>${o.title}</h2>${o.sub ? `<span class="sub">${o.sub}</span>` : ''}${o.right ? `<span class="spacer"></span>${o.right}` : ''}</div>` : '')
    + (o.pad === false ? (o.body || '') : `<div class="pbody">${o.body || ''}</div>`)
    + '</div>';

  /** 区块标题：左标题 + 可选副标题 + 右侧操作。sub / right 接已转义 HTML。 */
  const sechead = (o) => `<div class="sechead"><h2>${o.title}</h2>${o.sub ? `<span class="sub">${o.sub}</span>` : ''}<span class="spacer"></span>${o.right || ''}</div>`;

  /** 表内空行：colspan + 文案。表格里的空态统一 36px 12px，别每处各写一个 padding。 */
  const emptyRow = (colspan, msg, pad) => `<tr><td colspan="${colspan}"><div class="state" style="padding:${pad || '36px 12px'}"><div class="small">${msg}</div></div></td></tr>`;

  /** 横向滚动容器：统一 tabindex=0；可选 aria 名称与内联样式。 */
  const tableWrap = (html, o) => `<div class="tablewrap${o && o.cls ? ' ' + o.cls : ''}" tabindex="0"${o && o.style ? ` style="${o.style}"` : ''}${o && o.label ? ` role="region" aria-label="${o.label}"` : ''}>${html}</div>`;
  SP.VK = { esc, fmt, foot, moreRow, pageSize, dailySeries, statOf, asCount, rankOf, isoDate, packLabel, whyLabel, NAV_ITEMS, panel, sechead, emptyRow, tableWrap };
})();

/* ===== src/50-views-overview.js ===== */
/* ==== 50-views.js：视图层（六个视图 + 上传卡片 + 分析等待页） ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  /* 视图层公共件（45-view-kit 提供）：解构成局部名字，下面代码不用动。 */
  const { esc, fmt, foot, moreRow, dailySeries, statOf, asCount, rankOf, isoDate, packLabel, whyLabel } = SP.VK;

  /* 站点主页那个「Connected as …」框里的客户端状态（Waiting to render / Rendering for X / …）
     **不再画**（用户 2026-10-07）：说的是"你自己客户端"的状态，现在在线机器那块把每台机器的
     真实状态（等待任务 / 渲染中 / 暂停）逐台说清了，身份条上这一格只会重复且容易误读。 */

  /* ==== 我的项目（个人主页那张表，两处共用） ====
     数据来自 Api.parseMyProjects（见 20-api.js 的那段注释）：自己的主页每行带 id，别人的主页没有。
     站点**没给**最后更新时间、也不给设备/内存，所以这两处只画名字、状态、（渲染中的）百分比。 */

  const MY_KIND_KEY = {
    rendering: 'proj.status.rendering', waiting: 'proj.status.waiting',
    paused: 'proj.status.paused', finished: 'proj.status.finished',
  };

  /** 百分比站点只对"渲染中/等待中"给（HTML.php 的 printProjects），没有就只说状态 */
  function myStatus(x) {
    const key = MY_KIND_KEY[x.statusKind];
    const base = key ? t(key) : (x.status || '—');
    return x.pct === null || x.pct === undefined ? base : `${base} ${x.pct}%`;
  }

  const myName = (x) => (x.id
    ? `<a href="/project/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : `<span>${esc(x.name)}</span>`);

  const MY_SHOW = 5;

  /* ==== 总览行内的「一个关键事实」 ====
     数据来自 /project/<id> 管理页（80-app 的 fillMetaFor 挂到 p.meta）。总览行只放**一个**
     事实：优先自动删除日期（压成「20 Oct」），其次是帧进度；完整事实放整行 title，不铺开。
     拼接口径与项目页「我发布的」副标题一致（compute · RAM · 帧 · 删除），两处说法不打架。 */

  const MONS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  /** '20th Oct 06:10' → { key: 1020, short: '20 Oct' }；认不出来给 null */
  function parseDelDate(raw) {
    const m = String(raw || '').match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})/);
    if (!m) return null;
    const mon = MONS[m[2].toLowerCase()];
    if (!mon) return null;
    const day = Number(m[1]);
    return { key: mon * 100 + day, short: `${day} ${m[2]}` };
  }

  /** 完整事实（与 51 的 mineMetaLine 同一口径），用于整行 title */
  function metaFacts(p) {
    const m = p && p.meta;
    if (!m) return '';
    const cpu = t('proj.cpu');
    const gpu = t('proj.gpu');
    const compute = m.compute === 'both' ? `${cpu}+${gpu}` : m.compute === 'gpu' ? gpu : m.compute === 'cpu' ? cpu : '';
    const parts = [];
    if (compute) parts.push(compute);
    if (m.ram) parts.push(`${m.ram} RAM`);
    if (m.done !== null && m.done !== undefined && m.total) parts.push(`${m.done}/${m.total} ${t('proj.frameUnit')}`);
    if (m.autoDelete) parts.push(`${m.autoDelete} ${t('proj.del')}`);
    return parts.join(' · ');
  }

  /** 行内那一个关键事实：自动删除日期优先，其次帧进度；都没有返回 null（不占位） */
  function metaKeyFact(p) {
    const m = p && p.meta;
    if (!m) return null;
    const d = parseDelDate(m.autoDelete);
    if (d) return { text: d.short, title: t('my.meta.deleted', { date: m.autoDelete }) };
    if (m.done !== null && m.done !== undefined && m.total) {
      return { text: `${m.done}/${m.total} ${t('proj.frameUnit')}`, title: metaFacts(p) };
    }
    return null;
  }

  /** 标题旁汇总：全部 rows（不只前 5）里的渲染中数量 + 最近自动删除日期 */
  function panelSummary(rows) {
    const running = rows.filter((x) => x && x.statusKind === 'rendering').length;
    let best = null;
    for (const x of rows) {
      const d = parseDelDate(x && x.meta && x.meta.autoDelete);
      if (!d) continue;
      if (!best || d.key < best.key) best = d;
    }
    const bits = [];
    if (running) bits.push(t('my.meta.running', { n: running }));
    if (best) bits.push(t('my.meta.next', { date: best.short }));
    return bits.join(' · ');
  }

  /** 总览的「我的项目」区块。两条边界（用户 2026-10-07 拍板）：
   *  ① 一个项目都没有 → **整块不画**（不摆一块空态占首屏；去上传页的入口在项目页那一档里）；
   *  ② 不是自己的主页 → 不画（那张表没有 id，点不进管理页）。 */
  function myPanel(state, p) {
    if (!state.userName || (state.profileName && state.profileName !== state.userName)) return '';
    const rows = (p && p.myProjects) || [];
    if (!rows.length) return '';
    const summary = panelSummary(rows);

    const list = rows.slice(0, MY_SHOW).map((x) => {
      const fact = metaKeyFact(x);
      const full = metaFacts(x);
      return `<div class="mp"${full ? ` title="${esc(full)}"` : ''}>
        <span class="nm">${myName(x)}</span>
        ${fact ? `<span class="meta" title="${esc(fact.title)}">${esc(fact.text)}</span>` : ''}
        ${x.blocked ? `<span class="st bad">${esc(t('proj.status.blocked'))}</span>` : ''}
        <span class="st">${esc(myStatus(x))}</span>
      </div>`;
    }).join('');

    return `<div class="panel" style="margin-top:16px">
      <div class="phead">
        <h2>${esc(t('my.title'))}</h2>
        <span class="sub num">${esc(t('my.count', { n: rows.length }))}</span>
        ${summary ? `<span class="sub meta-sub">${esc(summary)}</span>` : ''}
        <span class="spacer"></span>
        <a class="sub" href="#/projects" data-scope="mine">${esc(t('my.all'))}</a>
      </div>
      <div class="myproj">${list}</div>
    </div>`;
  }

  /* ==== 总览 ==== */

  /* 总览页的区块注册表与显隐。块名 → 文案；`identity` 与页脚**不做成可关的块**：
     一个是这一页的身份，一个是数据来源那行，关掉只会让页面看着像出错了。
     块标签优先复用区块自己的标题词条（我的项目 / 渲染产出 / 在线机器），只有没有现成
     标题的两块才新增文案。 */
  const OV_BLOCKS = {
    kpi: { label: 'ovb.kpi' },
    mine: { label: 'my.title' },
    charts: { label: 'ovb.charts' },
    heat: { label: 'heat.title' },
    machines: { label: 'machines.title' },
  };
  /* 位置固定的块：不进可调序的那条列表（顶上那条数据看板钉死在那儿，用户 2026-10-07 拍板），
     但**仍然可以关掉** —— "不挪位置"和"不许隐藏"是两件事。 */
  const OV_PINNED = ['kpi'];
  const OV_MOVABLE = Object.keys(OV_BLOCKS).filter((k) => !OV_PINNED.includes(k));
  const OV_PREF = 'ovHidden';
  const OV_PREF_ORDER = 'ovOrder';

  /* 存的是**被关掉的那些键**，不是"开着的那些"。这样以后新加一个块，老用户的偏好里没有它
     → 默认就是开着的；反过来存（存开着的集合）就会出现"加了新块但谁都不显示"。
     认不出的键直接忽略，不留在集合里。 */
  const ovHidden = new Set();
  (function restoreOv() {
    const s = Util.store.get(OV_PREF, null);
    if (!Array.isArray(s)) return;
    for (const k of s) if (OV_BLOCKS[k]) ovHidden.add(k);
  })();

  const ovOn = (k) => !ovHidden.has(k);

  /** 单块开关（设置页那排按钮调它）。全部关掉也允许 —— 那是用户自己的选择。 */
  function setOvHidden(key) {
    if (!OV_BLOCKS[key]) return false;
    if (ovHidden.has(key)) ovHidden.delete(key); else ovHidden.add(key);
    Util.store.set(OV_PREF, [...ovHidden]);
    return true;
  }

  /* 可调序的那条顺序。存法同样是"从宽"：认不出的键丢掉、重复的去掉、固定块不许进来，
     而**偏好里没提到的块按注册表顺序补到末尾** —— 以后新加一块，老用户直接就能看见它，
     不会被一份旧名单挡在外面（和 ovHidden 存"关掉的"是同一个思路）。 */
  let ovSeq = OV_MOVABLE.slice();
  (function restoreOvOrder() {
    const s = Util.store.get(OV_PREF_ORDER, null);
    if (!Array.isArray(s)) return;
    const seen = new Set();
    const out = [];
    for (const k of s) {
      if (!OV_BLOCKS[k] || OV_PINNED.includes(k) || seen.has(k)) continue;
      seen.add(k); out.push(k);
    }
    for (const k of OV_MOVABLE) if (!seen.has(k)) out.push(k);
    ovSeq = out;
  })();

  /** 页面上的渲染顺序：固定块在前（按注册表顺序），其余按用户排的 */
  const ovDisplayOrder = () => OV_PINNED.concat(ovSeq);

  /** 上/下移一格（设置页那对箭头调它）。到头了就返回 false，不落盘也不重画。 */
  function moveOv(key, dir) {
    const i = ovSeq.indexOf(key);
    if (i < 0 || !dir) return false;
    const j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= ovSeq.length) return false;
    ovSeq.splice(i, 1);
    ovSeq.splice(j, 0, key);
    Util.store.set(OV_PREF_ORDER, ovSeq);
    return true;
  }

  /** 设置页里的一块：开关 + 上/下移。固定块只画开关，旁边标一句"固定在顶部"。 */
  function ovRow(k) {
    const i = OV_PINNED.includes(k) ? -1 : ovSeq.indexOf(k);
    const last = ovSeq.length - 1;
    const arrow = (dir, off, icon, key) => `<button class="btn sm" data-ov-move="${k}" data-ov-dir="${dir}"`
      + `${off ? ' disabled' : ''} title="${esc(t(key))}" aria-label="${esc(t(key))}">${UI.icon(icon)}</button>`;
    return `<div class="ovrow">
      <div class="seg"><button data-ov-toggle="${k}" aria-pressed="${ovOn(k)}">${esc(t(OV_BLOCKS[k].label))}</button></div>
      ${i < 0 ? `<span class="lock">${esc(t('ovb.pinned'))}</span>`
    : arrow(-1, i === 0, 'caretUp', 'ovb.up') + arrow(1, i === last, 'caretDown', 'ovb.down')}
    </div>`;
  }

  function identity(p, st) {
    const rank = rankOf(st);
    const badge = packLabel('badge', p.badge, true);
    const teamText = statOf(st, ['Team']).trim();
    /* 团队做成链接：id 来自 parseProfile 在 <dd> 里读到的 /team/<id>（用户 2026-11-12） */
    const teamHref = p.team && p.team.id ? `/team/${encodeURIComponent(p.team.id)}` : '';
    const joined = isoDate(statOf(st, ['Registration']));
    /* 站点那个「Connected as …」的客户端状态**不画**（用户 2026-10-07，见上面那段注释）：
       在线机器那块已经逐台说清"等待任务 / 渲染中 / 暂停"，这里再来一格只会重复且容易误读。 */
    const bits = [];
    if (rank) bits.push(`<span><b class="num">#${esc(rank)}</b> ${esc(t('hero.rank'))}</span>`);
    /* 站点不给名次（未上榜，或上游排名计算出 bug 回一句 "Has not rendered anything…"）：
       如实说没有排名，不留空、也不把句子里的数字当名次。 */
    else bits.push(`<span>${esc(t('hero.rankNone'))}</span>`);
    if (badge) bits.push(`<span><b>${esc(badge)}</b></span>`);
    if (teamText) bits.push(`<span>${teamHref ? `<a href="${esc(teamHref)}" target="_self"><b>${esc(teamText.toUpperCase())}</b></a>` : `<b>${esc(teamText.toUpperCase())}</b>`} ${esc(t('hero.team'))}</span>`);
    if (joined) bits.push(`<span>${esc(t('hero.joined'))} <b class="num">${esc(UI.dateLabel(joined, { year: true }))}</b></span>`);

    return `<div class="identity">
      <div class="idmain">
        ${UI.avatar(p.avatar, p.name, 'av')}
        <div class="idtext">
          <h1>${esc(p.name)}</h1>
          ${bits.length ? `<div class="meta">${bits.join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  function overview(state) {
    const p = state.profile;
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
      // 新用户却已经有项目（在建、还没出帧）：把项目摆出来，别让人找不到自己传上去的东西
      return identity(p, st) + (parsed ? UI.newUser() : UI.state.empty())
        + (ovOn('mine') ? myPanel(state, p) : '') + foot();
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
        d: rank ? t('stat.rankWindow', { rank: `<span class="num">${esc(rank)}</span>` }) : t('stat.rankNone'),
      },
      { k: t('stat.time'), v: Util.renderTime(rawTime), d: days ? t('stat.daysEquiv', { days: fmt(days) }) : '' },
      /* 连续天数是从产出日历算出来的：站点没给日历就整格不画（否则会给新账号摆一个"连续 0 天"） */
      ...(hasCalendar ? [{
        k: t('stat.streak'),
        v: d.streakExclToday !== undefined ? `${fmt(d.streakExclToday)} ${t('stat.days')}` : '—',
        d: d.best !== undefined ? t('stat.streakHint', { best: fmt(d.best) }) : '',
      }] : []),
      ...(asCount(created) > 0
        ? [{ k: t('stat.created'), v: Util.statNum(created), d: t('stat.createdHint') }] : []),
      ...(asCount(ordered) > 0
        ? [{ k: t('stat.ordered'), v: Util.statNum(ordered), d: t('stat.orderedHint') }] : []),
    ];
    // 格数变了，每排几格与分隔线由 CSS 按 data-n 自己算（见 30-style.js 的 .kpis[data-n]）
    const kpiBand = UI.kpis(kpiItems);

    /* ---- 8/4 主区：积分增长 + 月度产出 ----
       只有**自己的主页**内联这两块；没有数据源就整块不画（不摆"暂无数据"），只剩一块时铺满整行。
       副标题不再写"当前 X 积分"：上面指标带已有同一个数（用户 2026-10-18）。 */
    const hasPoints = !!(p.points && p.points.length > 1);
    const first = p.points[0], last = p.points[p.points.length - 1];
    const chartSub = t('chart.pointsSub', {
      n: p.points.length, from: first ? first.d : '—', to: last ? last.d : '—',
    });
    const mo = UI.months(daily);
    const pointsPanel = !hasPoints ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('chart.points'))}</h2><span class="sub num">${esc(chartSub)}</span></div>
        <div class="chart" id="sp-chart"><div class="tip" id="sp-tip"></div></div>
      </div>`;

    /* 右侧那张卡：默认「近 30 天概览」，右上角可一键切回「月度产出」，选择落盘（用户 2026-10-18）。
       口径是**含今天的 30 个日历日**（没跑的日子按 0 算），全部是真值、不做任何估算。 */
    const today = Util.dkeyLocal();
    const start30 = Util.dshift(today, -29);
    const byDay = new Map(daily.map((x) => [x.d, x.v]));
    let frames30 = 0, peak30 = { d: '', v: 0 };
    for (let n = 0, d = start30; n < 30; n += 1, d = Util.dshift(d, 1)) {
      const v = byDay.get(d) || 0;
      frames30 += v;
      if (v > peak30.v) peak30 = { d, v };
    }
    /* 活跃天数用站点自己的渲染日历（derived.active30，和上面 KPI 的连续天数同一份数据）；
       帧数曲线在个别日子缺采样点，数出来会比站点少一天。 */
    const active30 = Number.isFinite(Number(d.active30))
      ? Number(d.active30)
      : daily.filter((x) => x.d >= start30 && x.d <= today && x.v > 0).length;
    const avg30 = Math.round(frames30 / 30);
    const peakDate = peak30.v ? new Date(`${peak30.d}T00:00:00`).toLocaleDateString(
      I18n.lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' },
    ) : '';
    /* 积分是累计曲线：取"30 天前（含今天算起）那个采样点"做差，能反映净变化（可能是负的） */
    const pCurve = (p.points && p.points.length > 1) ? p.points : [];
    const pLast = pCurve.length ? pCurve[pCurve.length - 1] : null;
    const pBase = pLast
      ? (pCurve.slice(0, -1).reverse().find((x) => Util.ddiff(x.d, today) >= 30) || pCurve[0])
      : null;
    const points30 = (pLast && pBase) ? Number(pLast.v) - Number(pBase.v) : null;
    const recentOk = daily.length > 0;
    const canToggle = !!(mo.html && recentOk);
    const toggleBtn = (v, label) =>
      `<span class="spacer"></span><button type="button" class="subbtn" data-act="ov-right" data-v="${v}">${esc(label)}</button>`;
    const effCell = (k, v, h) => `<div class="eff"><div class="k">${esc(k)}</div><div class="v num">${esc(v)}</div>${h ? `<div class="h">${esc(h)}</div>` : ''}</div>`;
    const recentPanel = !recentOk ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('recent.title'))}</h2><span class="sub">${esc(t('recent.sub'))}</span>${canToggle ? toggleBtn('months', t('recent.toMonths')) : ''}</div>
        <div class="produce"><div class="effgrid">
          ${effCell(t('recent.frames'), fmt(frames30), t('recent.framesHint', { avg: fmt(avg30) }))}
          ${effCell(t('recent.active'), `${active30} / 30`, t('recent.activeHint'))}
          ${effCell(t('recent.peak'), peak30.v ? fmt(peak30.v) : '—', peak30.v ? t('recent.peakHint', { date: peakDate }) : '')}
          ${effCell(t('recent.points'), points30 == null ? '—' : `${points30 > 0 ? '+' : ''}${fmt(points30)}`, t('recent.pointsHint'))}
        </div></div>
      </div>`;
    const monthsPanel = !mo.html ? '' : `<div class="panel">
        <div class="phead"><h2>${esc(t('months.title'))}</h2><span class="sub">${esc(t('months.sub'))}</span>${canToggle ? toggleBtn('recent', t('months.toRecent')) : ''}</div>
        <div class="produce">${mo.html}</div>
      </div>`;
    /* 偏好 'months' 才显示月度；没有近 30 天数据时自动回退；两边都没有就整块不画 */
    const rightPanel = (state.ovRight === 'months' || !recentPanel) ? monthsPanel : recentPanel;
    const main = pointsPanel && rightPanel
      ? `<div class="grid">${pointsPanel}${rightPanel}</div>`
      : pointsPanel + rightPanel;

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

    /* ---- 按 OV_ORDER 拼块，用户关掉的整块跳过。顺序是固定的（拖拽排序还没做）；
           myPanel 自己在"没项目 / 不是自己的主页"时返回空串，所以"被关掉"和"本来就没有"
           在页面上是同一种结果，不需要分开处理。 ---- */
    const blocks = { kpi: kpiBand, mine: myPanel(state, p), charts: main, heat, machines: machinesPanel };
    let body = identity(p, st);
    for (const k of ovDisplayOrder()) if (ovOn(k)) body += blocks[k];
    return body + foot();
  }

  SP.Views = SP.Views || {};
  /* ovRow 是设置页「总览区块」编辑行要用的渲染函数，一并注册 */
  Object.assign(SP.Views, { overview, ovDisplayOrder, ovRow, setOvHidden, moveOv, dailySeries });
})();

/* ===== src/51-views-projects.js ===== */
/* ==== 51-views-projects.js：项目列表 ====
   独立 IIFE：不再借用 50 的作用域。公共件从 45-view-kit 取，跨视图状态挂到 SP.Views。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  /* 重复注入（站点导航 / 同页再 eval 产物）时不要重建 projState：第二个实例会用默认排序
     覆盖 SP.Views，表头看起来像「记忆丢了」（用户实报：内存升序刷新后回退）。与 52 的 rankState 同规。 */
  if (SP.Views && SP.Views.projState) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow, packLabel, whyLabel , pageSize, sechead, emptyRow } = SP.VK;

  /* ==== 项目 ==== */

  /* 可排序列的注册表：字段 → { 表头词条, 取值 }。
     表头词条复用既有的 `proj.col.*`，所以加一列排序**不需要新文案**；取值一律用站点给的
     原始数值（memKb / pct），不用 "1.3 G" 这种显示文本 —— 否则按字面量排。
     「我发布的」那张表站点只给得出名字与百分比，所以它有一份自己的注册表。 */
  const P_SORTS = {
    name: { label: 'proj.col.project', get: (p) => p.name, text: true },
    owner: { label: 'proj.col.owner', get: (p) => p.owner, text: true },
    progress: { label: 'proj.col.progress', get: (p) => p.pct || 0 },
    memory: { label: 'proj.col.memory', get: (p) => p.memKb || 0 },
  };
  const M_SORTS = {
    name: { label: 'proj.col.project', get: (x) => x.name, text: true },
    /* 站点对"没给百分比"的行就是不排进度，摆到最小那一头，别当成 0% 混进去 */
    progress: { label: 'proj.col.progress', get: (x) => (x.pct === null || x.pct === undefined ? -1 : x.pct) },
  };
  const SORT_PREF = 'projSort';

  /* picked：「我发布的」勾选的项目 id（字符串数组，仅内存，不落盘）。
     刷新/换视图就没了 —— 选中集是"这一屏要删的一批"，不是用户偏好。
     confirm：批量删除两步确认的第一阶段（只由 80-app 改；渲染时据此决定批量条形态）。 */
  const projState = { q: '', filter: 'all', sort: 'progress', dir: 'desc', limit: 120, menu: null, scope: 'all', msort: '', picked: [], confirm: false };

  /* 排序偏好落盘（用户自定义）：点一次表头就是一次"记住这个默认"，刷新与换页后仍在。
     存的字段名认不出来（旧版本存过、或以后删了某列）就退回默认 —— 别把列表卡在一个
     不存在的排序上，那样表头不会有箭头、点哪列都不生效，看起来像坏了。 */
  const SESS_KEY = 'sheepit-plus:' + SORT_PREF;

  /* 站点偶尔会清 localStorage（站点自己的脚本会 clear），排序偏好跟着一起没。
     写两份：localStorage 正常路径，sessionStorage 兜底（同标签页刷新仍在）。 */
  function readSortPref() {
    const fromLocal = Util.store.get(SORT_PREF, null);
    if (fromLocal && typeof fromLocal === 'object') return fromLocal;
    try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null'); } catch (e) { return null; }
  }

  function restoreSort() {
    const s = readSortPref();
    if (!s || typeof s !== 'object') return;
    if (P_SORTS[s.sort]) projState.sort = s.sort;
    if (M_SORTS[s.msort]) projState.msort = s.msort;
    if (s.dir === 'asc' || s.dir === 'desc') projState.dir = s.dir;
  }
  restoreSort();

  function saveSort() {
    const v = { sort: projState.sort, msort: projState.msort, dir: projState.dir };
    Util.store.set(SORT_PREF, v);
    try { sessionStorage.setItem(SESS_KEY, JSON.stringify(v)); } catch (e) { /* 隐私模式等 */ }
  }

  /** 设置页改默认排序。主列表一定跟着改；「我发布的」那张表站点只给得出名字与进度，
      选到它排不了的列（发布者 / 内存）就**不动它自己那份偏好**，不硬塞一个无效字段。 */
  function setSortPref(key) {
    if (!P_SORTS[key] || projState.sort === key) return false;
    projState.sort = key;
    if (M_SORTS[key]) projState.msort = key;
    saveSort();
    return true;
  }

  function setDirPref(dir) {
    if (dir !== 'asc' && dir !== 'desc') return false;
    if (projState.dir === dir) return false;
    projState.dir = dir;
    saveSort();
    return true;
  }

  /** 比较器：文本 localeCompare、数值相减；升降方向由调用处统一翻，注册表里不写两遍 */
  function sortCmp(spec, key) {
    const s = spec[key];
    if (!s) return null;
    return s.text
      ? (a, b) => String(s.get(a) || '').localeCompare(String(s.get(b) || ''))
      : (a, b) => s.get(a) - s.get(b);
  }


  function statusLabel(p) {
    if (p.statusKind === 'rendering') {
      return p.statusCount != null ? t('proj.status.renderingN', { n: p.statusCount }) : t('proj.status.rendering');
    }
    if (p.statusKind === 'waiting') return t('proj.status.waiting');
    if (p.statusKind === 'paused') return t('proj.status.paused');
    if (p.statusKind === 'finished') return t('proj.status.finished');
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

  /** 进度：条子与分数**同一格**（用户 2026-10-07）。
      合成一格后条子 `flex:1` 吃满剩余宽度，和数字之间只隔一个 10px 的 gap。 */
  const pcell = (pct, frac, title) => `<td><div class="pwrap">${UI.progress(pct, frac)}`
    + `<span class="frac num"${title ? ` title="${esc(title)}"` : ''}>${esc(frac)}</span></div></td>`;

  function projectRow(p, me, maps) {
    const frac = UI.progressText(p.pct, p.done, p.total);
    return `<tr data-project="${esc(p.id)}">
      <td><div class="pn" title="${esc(p.name)}">${esc(p.name)}</div></td>
      <td>${ownerCell(p, me, maps)}</td>
      <td><span class="st ${p.statusKind}" title="${esc(statusLabel(p))}">${esc(statusLabel(p))}</span></td>
      ${pcell(p.pct, frac, frac)}
      <td>${UI.devices(p.cpu, p.gpu)}</td>
      <td class="r num" title="${esc(p.memory || '—')}">${esc(p.memory || '—')}</td>
    </tr>`;
  }

  /** 范围切换（全部 / 我发布的）：两档共用同一只控件，位置也一样。 */
  const scopeSeg = () => `<div class="seg" id="sp-scope">${[['all', t('proj.scope.all')], ['mine', t('proj.scope.mine')]]
    .map(([k, label]) => `<button data-s="${k}" aria-pressed="${projState.scope === k}">${esc(label)}</button>`).join('')}</div>`;

  /* ---- 「我发布的」那张表 ---- */

  /** 状态与名字的显示口径与 50 的总览小列表一致，但 51 是独立 IIFE、借不到那边的局部函数：
      不在这里定义，这张表只要有行就会 ReferenceError（空态不执行，所以一直没暴露）。 */
  const MY_KIND_KEY = {
    rendering: 'proj.status.rendering', waiting: 'proj.status.waiting',
    paused: 'proj.status.paused', finished: 'proj.status.finished',
  };
  /** 状态列只说状态：百分比归「进度」列（与全站表同构），两边都说一遍数字是重复信息。 */
  function myStatus(x) {
    const key = MY_KIND_KEY[x.statusKind];
    return key ? t(key) : (x.status || '—');
  }
  const myName = (x) => (x.id
    ? `<a href="/project/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : `<span>${esc(x.name)}</span>`);

  /** 筛选档位：按钮与过滤判据共用一份，档位改了只改一处。 */
  const mineFilterOpts = () => [['all', t('proj.all')], ['rendering', t('proj.status.rendering')],
    ['waiting', t('proj.status.waiting')], ['finished', t('proj.status.finished')]];

  /** 「我发布的」**唯一**的搜索 + 筛选 + 排序实现：渲染与「全选」都走这里。
      两边各写一份的话，"全选选中了谁"和"屏幕上画了谁"迟早对不上 —— 而这是要删数据的操作。 */
  function mineRows(state) {
    const all = (state && state.myProjects) || [];
    const q = projState.q.trim().toLowerCase();
    let rows = all.filter((x) => !q || String(x.name || '').toLowerCase().includes(q));
    if (mineFilterOpts().some(([k]) => k === projState.filter) && projState.filter !== 'all') {
      rows = rows.filter((x) => x.statusKind === projState.filter);
    }

    /* 默认顺序 = 解析器给的（站点 id 倒序 ≈ 新建在前）；点了表头（或设置里选了）才按列排 */
    const cmp = sortCmp(M_SORTS, projState.msort);
    if (cmp) rows = rows.toSorted((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
    return { all, rows };
  }

  /** 全选只覆盖**当前渲染出来的行**（slice(0, limit)）：没画在屏幕上的项目
      不能被"全选"带进删除名单。没有 id 的行不能删，直接不进名单。 */
  function mineVisibleIds(state) {
    return mineRows(state).rows.slice(0, projState.limit)
      .map((x) => (x && x.id ? String(x.id) : '')).filter(Boolean);
  }

  /** manage 页里的事实拼成一行副标题：计算方式 · RAM · 帧进度 · 自动删除日期。
      只拼存在的字段；没有 meta（没抓到 / 没权限）就整行不出 —— 不占位、不撑高行。
      站点只给英文日期字符串，I18n 没有对应格式化就原样显示，不编翻译。 */
  function mineMetaLine(p) {
    const m = p && p.meta;
    if (!m) return '';
    const cpu = t('proj.cpu');
    const gpu = t('proj.gpu');
    const compute = m.compute === 'both' ? `${cpu}+${gpu}` : m.compute === 'gpu' ? gpu : m.compute === 'cpu' ? cpu : '';
    const parts = [];
    if (compute) parts.push(compute);
    if (m.ram) parts.push(`${m.ram} RAM`);
    if (m.done !== null && m.done !== undefined && m.total) parts.push(`${m.done}/${m.total} ${t('proj.frameUnit')}`);
    if (m.autoDelete) parts.push(`${m.autoDelete} ${t('proj.del')}`);
    if (!parts.length) return '';
    const line = parts.join(' · ');
    return `<div class="pmeta" title="${esc(line)}">${esc(line)}</div>`;
  }

  /** 「我发布的」：只有个人主页那张表给得出的字段（名字 / 状态 / 百分比），
     设备、内存、发布者站点没给 —— 所以不复用全站那张七列表。
      五列：勾选 / 项目 / 状态 / 进度 / 操作；删除有行内与批量两条入口，都是两步确认。 */
  function mineProjects(state) {
    const { all, rows } = mineRows(state);
    const opts = mineFilterOpts();
    const shown = rows.slice(0, projState.limit);
    const picked = new Set(projState.picked || []);
    /* 没有 id 的行（别人的主页、解析失败）不能删：不画 checkbox，也不画行内删除按钮 */
    const idOf = (x) => (x && x.id ? String(x.id) : '');

    /* 排序入口必须是 <button>：只给 th 绑 click 时，键盘用户没有可达的激活点。
       aria-sort 放在 th 上（语义属于表头），按钮自己带一句可读的排序说明。 */
    const th = (key, label, cls) => {
      const on = projState.msort === key;
      const dir = on ? (projState.dir === 'asc' ? t('sort.asc') : t('sort.desc')) : t('sort.none');
      return `<th scope="col" class="sortable${cls ? ' ' + cls : ''}" data-msort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
        + `<button type="button" class="thbtn" aria-label="${esc(t('sort.title', { col: label, dir }))}">${esc(label)}`
        + `${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</button></th>`;
    };

    /* 空态两种，别混成一句「你还没有发布过项目」：
       ① 一个项目都没有 → 上传入口（accent 主按钮）；
       ② 有项目但搜索/筛选没匹配 → 「没有匹配的项目」+ 次级「清除筛选」；
          表头与表格框留着，否则整块消失会让人分不清"是筛没了"还是"真没有"。 */
    const emptyRow = all.length === 0
      ? `<tr><td colspan="5"><div class="state" style="padding:40px 12px">
            <div class="small">${esc(t('my.empty'))}</div>
            <a class="btn primary" href="/getstarted" target="_blank" rel="noopener" style="margin-top:12px">${esc(t('my.emptyCta'))}</a>
          </div></td></tr>`
      : `<tr><td colspan="5"><div class="state" style="padding:40px 12px">
            <div class="small">${esc(t('proj.empty'))}</div>
            <button class="btn" data-act="proj-clear-filters" style="margin-top:12px">${esc(t('proj.clearFilters'))}</button>
          </div></td></tr>`;

    const body = shown.map((x) => {
      const id = idOf(x);
      const on = !!id && picked.has(id);
      const pct = x.pct;
      return `<tr data-project="${esc(id)}"${on ? ' class="picked"' : ''}>
        <td class="c-pick">${id
    ? `<label class="pickbox"><input type="checkbox" data-pick="${esc(id)}" aria-label="${esc(t('proj.pick') + ' ' + x.name)}"${on ? ' checked' : ''}></label>`
    : ''}</td>
        <td><div class="pn">${myName(x)}</div>${mineMetaLine(x)}</td>
        <td class="c-status"><span class="st ${esc(x.statusKind)}">${esc(myStatus(x))}</span>
          ${x.blocked ? `<span class="st bad">${esc(t('proj.status.blocked'))}</span>` : ''}</td>
        <td class="c-prog">${pct === null || pct === undefined ? '<span class="st">—</span>'
    : `<div class="pwrap">${UI.progress(pct, `${pct}%`)}<span class="frac num">${pct}%</span></div>`}</td>
        <td class="c-act">${id
    ? `<a class="btn sm" href="/project/${esc(id)}" target="_self">${esc(t('my.open'))}</a>`
      + `<button class="btn sm" data-act="proj-del" data-id="${esc(id)}" data-name="${esc(x.name)}">${esc(t('proj.del'))}</button>`
    : '<span class="st">—</span>'}</td>
      </tr>`;
    }).join('') || emptyRow;

    /* 批量操作常驻在 sechead 右侧（不是表格上方另起一行）：未选中时它只是
       「匹配 n / 共 total」那段文字，选中后才长出按钮 —— 表头因此不会因为批量条出现/消失而上下跳。 */
    return `<div class="sechead"><h2>${esc(t('my.title'))}</h2>
        <span class="sub num">${esc(t('my.count', { n: all.length }))}</span>
        <span class="spacer"></span>
        <div class="bulkbar" id="sp-bulk">
          <span class="btext" role="status" aria-live="polite">${esc(t('proj.match', { n: rows.length, total: all.length }))}</span>
          <button class="btn sm" data-act="proj-del-picked" hidden>${esc(t('proj.delPicked'))}</button>
          <button class="btn sm" data-act="proj-picknone" hidden>${esc(t('proj.pickNone'))}</button>
          <button class="btn sm" data-act="proj-del-confirm" hidden>${esc(t('proj.delConfirmInline'))}</button>
          <button class="btn sm" data-act="proj-del-back" hidden>${esc(t('proj.back'))}</button>
          <button class="btn sm" data-act="proj-del-stop" hidden>${esc(t('proj.delStop'))}</button>
        </div></div>
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.searchMine'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${opts.map(([k, label]) =>
    `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-mine">
          <colgroup>
            <col class="c-pick"><col><col class="c-status"><col class="c-prog"><col class="c-act">
          </colgroup>
          <thead><tr>
            <th scope="col" class="c-pick"><label class="pickbox"><input type="checkbox" id="sp-pickall" data-pickall="1" aria-label="${esc(t('proj.pickAll'))}"></label></th>
            ${th('name', t('proj.col.project'))}
            <th scope="col" class="c-status">${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'), 'c-prog')}
            <th scope="col" class="c-act">${esc(t('proj.col.manage'))}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>`;
  }

  function projects(state) {
    /* 每次渲染都以存储为准：实例被重建、或 localStorage 被站点清掉时，排序不会退回默认。 */
    restoreSort();
    if (projState.scope === 'mine') return mineProjects(state);
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

    /* 排序字段来自注册表（设置页可选、表头可点，两处都落盘）；认不出来的字段退回进度 */
    const cmp = sortCmp(P_SORTS, projState.sort) || sortCmp(P_SORTS, 'progress');
    rows = rows.toSorted((a, b) => (projState.dir === 'asc' ? cmp(a, b) : -cmp(a, b)));

    const th = (key, label, span) => {
      const on = projState.sort === key;
      const dir = on ? (projState.dir === 'asc' ? t('sort.asc') : t('sort.desc')) : t('sort.none');
      return `<th scope="col" class="sortable"${span ? ` colspan="${span}"` : ''} data-sort="${key}" aria-sort="${on ? (projState.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
        + `<button type="button" class="thbtn" aria-label="${esc(t('sort.title', { col: label, dir }))}">${esc(label)}`
        + `${on ? `<span class="arw">${UI.icon(projState.dir === 'asc' ? 'caretUp' : 'caretDown')}</span>` : ''}</button></th>`;
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

    return farmRow + `${sechead({ title: esc(t('proj.title')), sub: esc(t('proj.count', { n: all.length })), right: `<span class="sub num">${esc(t('proj.match', { n: rows.length, total: all.length }))}</span>` })}
      <div class="toolbar">
        ${scopeSeg()}
        <label class="input">${UI.icon('search')}
          <input id="sp-q" type="search" placeholder="${esc(t('proj.search'))}" value="${esc(projState.q)}">
        </label>
        <div class="seg" id="sp-filter">${filters.map(([k, label]) =>
          `<button data-f="${k}" aria-pressed="${projState.filter === k}">${esc(label)}</button>`).join('')}</div>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl fit">
          <colgroup>
            <col style="width:28%"><col style="width:19%"><col style="width:13%">
            <col style="width:19%"><col style="width:11%"><col style="width:10%">
          </colgroup>
          <thead><tr>
            ${th('name', t('proj.col.project'))}
            ${th('owner', t('proj.col.owner'))}
            <th scope="col">${esc(t('proj.col.status'))}</th>
            ${th('progress', t('proj.col.progress'))}
            <th scope="col">${esc(t('proj.col.device'))}</th>
            ${th('memory', t('proj.col.memory'))}
          </tr></thead>
          <tbody>${rows.slice(0, projState.limit).map((p) => projectRow(p, state.userName, maps)).join('')
            || emptyRow(6, esc(t('proj.empty')), '40px 12px')}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, projState.limit), rows.length, 120)}
      </div>
      ${menuHtml}`;
  }

  /* ==== 挂载后补丁：只有总览的积分曲线需要真实像素宽度 ==== */
  
  /* 注册：52/54 与 80-app 通过 SP.Views 拿这些（不再靠共享作用域）。 */
  SP.Views = SP.Views || {};
  Object.assign(SP.Views, {
    projects, projState, P_SORTS, M_SORTS,
    saveSort, setSortPref, setDirPref, sortCmp,
    moreRow, statusLabel, ownerActions, ownerCell, ownerMenu, listsOf, pcell, projectRow, scopeSeg, mineProjects,
    mineRows, mineVisibleIds,
  });
})();

/* ===== src/52-views-ranking.js ===== */
/* ==== 52-views-ranking.js：排行榜 / 团队榜 / 团队详情 ====
   独立 IIFE：公共件从 45-view-kit 取，跨视图状态挂 SP.Views。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow , pageSize, sechead, emptyRow } = SP.VK;

  /* 重复注入（同一页里再 eval 一次产物）时不要把委托监听挂两遍。 */
  if (SP.Views && SP.Views.rankState) return;

  /* 排行榜的每页条数（原放在 51 里，跟着视图走）；limit 由 80-app 的 #sp-more 统一加。
     tab / sect：这一页里的两档（用户榜 / 机器榜），机器榜再分站点那四张表。 */
  const rankState = {
    limit: pageSize(),
    tab: location.pathname === '/ranking/machine' ? 'machine' : 'user',
    sect: 'cpus',
    machineErr: '',
    uq: '',   // 用户榜搜索
    mq: '',   // 机器榜搜索
  };
  /** 两档共用的切换控件。点击由本文件末尾的委托监听处理（80-app 的事件表只认 data-act，
      这两个档位是排行榜自己的状态，不该塞进它那张表里）。 */
  const rankSeg = () => `<div class="toolbar"><div class="seg" id="sp-rank-tab">${[['user', t('rank.tab.user')], ['machine', t('rank.tab.machine')]]
    .map(([k, label]) => `<button data-t="${k}" aria-pressed="${rankState.tab === k}">${esc(label)}</button>`).join('')}</div></div>`;

  /* ==== 排行榜：用户档 ==== */

  function usersRank(state) {
    const rows = state.ranking || [];
    /* 用户榜为空时也要留切换控件：否则站点哪天把 /ranking/user 换掉，机器档就再也进不去了 */
    if (!rows.length) return rankSeg() + UI.state.empty();
    const q = rankState.uq.trim().toLowerCase();
    const shown = q ? rows.filter((r) => String(r.user || r.userId).toLowerCase().includes(q)) : rows;
    const me = state.userName;
    const body = shown.slice(0, rankState.limit).map((r) => {
      const isMe = me && r.user === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight">${esc(r.rank)}</td>
        <td><div class="ow">${UI.avatar(r.avatar, r.user, 'ini')}
          ${r.user || r.userId
            ? `<a class="nm" href="/user/${encodeURIComponent(r.userId || r.user)}/profile" target="_self" title="${esc(r.user)}">${esc(r.user || r.userId)}</a>`
            : ''}</div></td>
        <td class="r num">${esc(Util.num(r.frames))}</td>
        <td class="r num">${esc(Util.duration(r.seconds))}</td>
        <td class="r num">${esc(Util.num(Math.round(r.points)))}</td>
      </tr>`;
    }).join('');

    return `${sechead({ title: esc(t('rank.title')), sub: esc(t('rank.sub')), right: `<span class="sub num">${esc(t('rank.count', { n: rows.length }))}</span>` })}
      ${rankSeg()}
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-rq" type="search" placeholder="${esc(t('rank.search'))}" value="${esc(rankState.uq)}">
        </label>
        <span class="sub num">${esc(t('rank.showing', { n: Math.min(shown.length, rankState.limit), total: shown.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl">
          <thead><tr>
            <th scope="col" class="tight">${esc(t('rank.col.rank'))}</th><th scope="col">${esc(t('rank.col.user'))}</th>
            <th scope="col" class="r">${esc(t('rank.col.frames'))}</th><th scope="col" class="r">${esc(t('rank.col.time'))}</th>
            <th scope="col" class="r">${esc(t('rank.col.points'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(shown.length, rankState.limit), shown.length, 100)}
      </div>`;
  }

  /* ==== 排行榜：机器档 ====
     站点 /ranking/machine 是四张独立的表（CPU / GPUs OPTIX / HIP / METAL），服务端已按强度降序排好。
     一次只画一张：CPU 表 5900+ 行，四张一起画会把首屏按住好几秒；分页沿用 rankState.limit
     （80-app 的 #sp-more 会 +100 再 render，和用户档同一条路）。
     段名沿用站点的后端名，不翻译。 */
  const MACH_SECTS = ['cpus', 'optix', 'hip', 'metal'];
  /* 段名就是站点的后端名，中英都一样 —— 不占词条，也不该被"翻译"成别的说法。 */
  const MACH_LABELS = { cpus: 'CPU', optix: 'GPU · OPTIX', hip: 'GPU · HIP', metal: 'GPU · METAL' };
  const machineTotal = (m) => (m ? MACH_SECTS.reduce((n, k) => n + ((m[k] || []).length), 0) : 0);

  /* 进行中的取数：渲染是同步的，这里只发请求，回来由 loadMachine 自己再 render 一次。
     模块级是因为「渲染 → 排加载 → 再渲染」这条环必须有个闸，否则 render 一次就抓一次。 */
  let machineLoading = false;

  async function loadMachine(force) {
    const S = SP.app && SP.app.state;
    if (!S || machineLoading) return;
    if (S.machine && !force) return;
    machineLoading = true;
    rankState.machineErr = '';
    try {
      const path = '/ranking/machine';
      /* 当前页就是数据源时直接解析活 document，省一次约 2.8 MB 的整页下载
         （和 80-app 里 /ranking/user 的处理同一策略）。 */
      const doc = SP.Api.currentDoc(path);
      let data = doc ? SP.Api.parseMachineRanking(doc) : null;
      if (!data || !machineTotal(data)) data = SP.Api.parseMachineRanking(await SP.Api.fetchPage(path));
      S.machine = data;
    } catch (e) {
      rankState.machineErr = e && e.code === 'SIGNED_OUT' ? t('state.loggedOut') : ((e && e.message) || String(e));
    } finally {
      machineLoading = false;
      if (SP.app && SP.app.state.view === 'ranking') SP.app.render();
    }
  }

  function machineRank(state) {
    const m = state.machine;
    /* 还没取到数据时不印「共 0 款机型」—— 那是"没加载"，不是"确实没有" */
    const head = `${sechead({ title: esc(t('rank.machine.title')), sub: esc(t('rank.machine.sub')), right: (m ? `<span class="sub num">${esc(t('rank.machine.count', { n: machineTotal(m) }))}</span>` : '') })}`;
    if (!m) {
      /* 第一次切到机器档（或直接打开 /ranking/machine）时在这里排一次加载。
         失败过就不再自动重排：给错误态和一个重试按钮，别在 render 里空转。 */
      if (!machineLoading && !rankState.machineErr) queueMicrotask(loadMachine);
      return head + rankSeg() + (rankState.machineErr
        ? UI.state.error(rankState.machineErr, 'sp-mach-retry')
        : UI.skeleton(4));
    }
    const sect = MACH_SECTS.indexOf(rankState.sect) >= 0 ? rankState.sect : 'cpus';
    const gpu = sect !== 'cpus';
    const all = m[sect] || [];
    const mq = rankState.mq.trim().toLowerCase();
    const list = mq ? all.filter((r) => String(r.model).toLowerCase().includes(mq)) : all;
    const body = list.slice(0, rankState.limit).map((r) => `<tr class="${r.mine ? 'me' : ''}">
        <td><div class="pn" title="${esc(r.model)}">${esc(r.model)}</div></td>
        ${gpu ? `<td class="r num">${esc(r.memoryText || '—')}</td>` : ''}
        <td class="r num" title="${esc(r.powerText)}">${esc(r.powerText)}</td>
      </tr>`).join('') || emptyRow(gpu ? 3 : 2, esc(t('rank.machine.empty')));

    const sectSeg = `<div class="seg" id="sp-mach">${MACH_SECTS.map((k) =>
    `<button data-m="${k}" aria-pressed="${sect === k}">${esc(MACH_LABELS[k])}
        <span class="num">${(m[k] || []).length}</span></button>`).join('')}</div>`;

    return head + rankSeg() + `<div class="toolbar">${sectSeg}</div>
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-mq" type="search" placeholder="${esc(t('rank.machine.search'))}" value="${esc(rankState.mq)}">
        </label>
        <span class="sub num">${esc(t('rank.showing', { n: Math.min(list.length, rankState.limit), total: list.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-mach">
          <thead><tr><th scope="col">${esc(t('rank.machine.col.model'))}</th>
            ${gpu ? `<th scope="col" class="r">${esc(t('rank.machine.col.memory'))}</th>` : ''}
            <th scope="col" class="r">${esc(t('rank.machine.col.power'))}</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(list.length, rankState.limit), list.length, 100)}
      </div>`;
  }

  /** 入口：两档都在这一页里，不换路由 —— 切档只是本视图内部换一份数据。 */
  function ranking(state) {
    return rankState.tab === 'machine' ? machineRank(state) : usersRank(state);
  }

  /* ==== 团队榜 ==== */
  const teamsState = { q: '', limit: pageSize() };

  function teams(state) {
    const all = state.teams || [];
    if (!all.length) return UI.state.empty();
    const q = teamsState.q.trim().toLowerCase();
    const rows = all.filter((x) => !q || String(x.name).toLowerCase().includes(q));
    const mineId = state.myTeam && state.myTeam.id ? String(state.myTeam.id) : '';
    const body = rows.length ? rows.slice(0, teamsState.limit).map((x) => {
      const mine = !!mineId && String(x.id) === mineId;
      return `<tr class="${mine ? 'me' : ''}">
        <td class="rankcell tight">${esc(x.rank)}</td>
        <td>${x.id
    ? `<a class="nm" href="/team/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : esc(x.name)}</td>
        <td class="r num">${esc(x.p90Text)}</td>
        <td class="r num">${esc(x.p180Text)}</td>
        <td class="r num">${esc(x.totalText)}</td>
        <td class="r num">${esc(x.membersText)}</td>
      </tr>`;
    }).join('') : emptyRow(6, esc(t('team.none')));

    /* 我的团队单独一行：榜单按积分排，自己那个队可能在第 1600 名，分页里根本看不到 */
    const mine = mineId ? all.find((x) => String(x.id) === mineId) : null;
    const mineLine = mine
      ? `<div class="toolbar"><span class="sub">${esc(t('team.mine'))}
          <a href="/team/${esc(mine.id)}" target="_self"><b>${esc(mine.name)}</b></a>
          ${esc(t('team.rankLine', { rank: mine.rank }))}</span></div>`
      : '';
    /* 创建入口只在登录时出现（站点对未登录用户只给一句"需要登录"） */
    const createForm = state.userName
      ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
          <div class="phead"><h2>${esc(t('team.create'))}</h2></div>
          <div class="teamcreate">
            <label class="input"><input id="sp-tname" type="text" maxlength="70" autocomplete="off" placeholder="${esc(t('team.createName'))}"></label>
            <button class="btn primary" data-act="team-create" data-input="sp-tname">${esc(t('team.createGo'))}</button>
          </div>
          <p class="hint">${esc(t('team.createHint'))}</p>
        </div>`
      : '';

    return `${sechead({ title: esc(t('team.title')), sub: esc(t('team.sub')), right: `<span class="sub num">${esc(t('team.count', { n: all.length }))}</span>` })}
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-tq" type="search" placeholder="${esc(t('team.search'))}" value="${esc(teamsState.q)}">
        </label>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-teams">
          <colgroup><col class="c-rank"><col class="c-name"><col class="c-90"><col class="c-180"><col class="c-total"><col class="c-mem"></colgroup>
          <thead><tr>
            <th scope="col" class="tight">${esc(t('team.col.rank'))}</th><th scope="col">${esc(t('team.col.name'))}</th>
            <th scope="col" class="r">${esc(t('team.col.p90'))}</th><th scope="col" class="r">${esc(t('team.col.p180'))}</th>
            <th scope="col" class="r">${esc(t('team.col.total'))}</th><th scope="col" class="r">${esc(t('team.col.members'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, teamsState.limit), rows.length, 100)}
      </div>
      ${createForm}`;
  }

  /* ==== 团队详情 ==== */
  const teamState = { limit: pageSize() };

  function teamDetail(state) {
    const d = state.team;
    if (!d) return UI.state.empty();
    const me = state.userName || '';
    /* 团队在榜上的名次：从已经加载的榜单里查（没加载就不显示，不为了一行排名再拖 1.6MB） */
    const row = (state.teams || []).find((x) => String(x.id) === String(state.teamId || ''));
    const rank = row ? row.rank : '';
    const disband = d.deleteUrl
      ? `<button class="btn" data-act="team-act" data-team-act="disband" data-url="${esc(d.deleteUrl)}" data-confirm="${esc(t('team.disbandConfirm'))}" style="color:var(--accent)">${esc(t('team.disband'))}</button>`
      : '';
    const act = d.leaveUrl
      ? `<button class="btn" data-act="team-act" data-team-act="leave" data-url="${esc(d.leaveUrl)}" data-confirm="${esc(t('team.leaveConfirm'))}">${esc(t('team.leave'))}</button>`
      : (d.joinUrl
        ? `<button class="btn primary" data-act="team-act" data-team-act="join" data-url="${esc(d.joinUrl)}" data-confirm="${esc(t('team.joinConfirm'))}">${esc(t('team.join'))}</button>`
        : '');

    const members = d.members || [];
    const body = members.slice(0, teamState.limit).map((m) => {
      const isMe = !!me && !!m.userId && m.userId === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight"><span class="rankpill${m.rendering ? ' on' : ''}"${m.rendering ? ` title="${esc(t('team.rendering'))}"` : ''}>${esc(m.rank)}</span></td>
        <td><div class="ow">${UI.avatar(m.avatar, m.user, 'ini')}
          ${m.userId
    ? `<a class="nm" href="/user/${encodeURIComponent(m.userId)}/profile" target="_self">${esc(m.user)}</a>`
    : esc(m.user)}</div></td>
        <td class="r num">${esc(m.pointsText)}</td>
        <td class="r num">${esc(m.joined)}</td>
        ${d.hasLastFrame ? `<td class="r num">${esc(m.lastFrame || '—')}</td>` : ''}
        ${d.hasRemove ? `<td class="r">${m.removeUrl ? `<button class="btn sm" data-act="team-act" data-url="${esc(m.removeUrl)}" data-confirm="${esc(t('team.removeConfirm'))}">${esc(t('team.remove'))}</button>` : ''}</td>` : ''}
      </tr>`;
    }).join('') || emptyRow(4, esc(t('team.noMembers')), '30px 12px');

    return `<div class="sechead"><h2>${esc(d.name)}</h2>
        <span class="sub num">${esc(d.pointsText)}</span>
        ${rank ? `<span class="sub">${esc(t('team.rankLine', { rank }))}</span>` : ''}
        <span class="spacer"></span>
        ${disband}
        ${act}
        <a class="btn" href="/team" target="_self">${esc(t('team.back'))}</a></div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-team${d.hasRemove ? ' tbl-team-6' : (d.hasLastFrame ? ' tbl-team-5' : '')}">
          <colgroup><col class="c-rank"><col class="c-member"><col class="c-pts"><col class="c-date">${d.hasLastFrame ? '<col class="c-last">' : ''}${d.hasRemove ? '<col class="c-rm">' : ''}</colgroup>
          <thead><tr><th scope="col" class="tight">${esc(t('team.col.rank'))}</th><th scope="col">${esc(t('team.col.member'))}</th>
            <th scope="col" class="r">${esc(t('team.col.points'))}</th><th scope="col" class="r">${esc(t('team.col.joined'))}</th>${d.hasLastFrame ? `<th scope="col" class="r">${esc(t('team.col.lastFrame'))}</th>` : ''}${d.hasRemove ? `<th scope="col" class="r">${esc(t('team.col.remove'))}</th>` : ''}</tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(members.length, teamState.limit), members.length, 100)}
      </div>
      ${d.update ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
        <div class="phead"><h2>${esc(t('team.update'))}</h2><span class="sub">${esc(t('team.updateSub'))}</span></div>
        <div class="addrow"><label class="input"><input id="sp-tname" type="text" maxlength="70" value="${esc(d.update.name)}" placeholder="${esc(t('team.updateName'))}"></label></div>
        <div class="addrow"><label class="input"><input id="sp-tdesc" type="text" value="${esc(d.update.description)}" placeholder="${esc(t('team.updateDesc'))}"></label></div>
        <div class="addrow"><button class="btn primary" data-act="team-update" data-url="${esc(d.update.url)}">${esc(t('team.updateGo'))}</button></div>
      </div>` : ''}
      ${(d.requests || []).length ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
        <div class="phead"><h2>${esc(t('team.requests'))}</h2><span class="sub">${esc(t('team.requestsSub', { n: d.requests.length }))}</span></div>
        <div class="ulist">${d.requests.map((r) => `<div class="u">
          ${UI.avatar(r.avatar, r.user, 'ini')}
          <span class="n">${r.userId ? `<a href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}</span>
          <span class="sub">${esc(r.time)}</span>
          <span class="spacer"></span>
          ${r.accept ? `<button class="btn sm primary" data-act="team-act" data-url="${esc(r.accept)}">${esc(t('team.accept'))}</button>` : ''}
          ${r.refuse ? `<button class="btn sm" data-act="team-act" data-url="${esc(r.refuse)}" data-confirm="${esc(t('team.refuseConfirm'))}">${esc(t('team.refuse'))}</button>` : ''}
        </div>`).join('')}</div>
      </div>` : ''}`;
  }

  /* 两档切换 / 机器档四个分段 / 加载失败的重试：都是本视图的私有控件，
     自己挂一个委托监听（80-app 的事件表按 data-act 派发，这些不该塞进去）。
     一个 closest 认三种目标，免得三个监听器抢同一个点击。 */
  /* 两档各自的搜索框：输入即过滤，保留光标（和项目列表同一套手感）。 */
  document.addEventListener('input', (ev) => {
    const id = ev.target && ev.target.id;
    if (id !== 'sp-rq' && id !== 'sp-mq') return;
    const v = ev.target.value;
    if (id === 'sp-rq') rankState.uq = v; else rankState.mq = v;
    clearTimeout(rankState.timer);
    rankState.timer = setTimeout(() => {
      const pos = ev.target.selectionStart;
      if (SP.app) SP.app.render();
      const again = document.getElementById(id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
    }, 180);
  });

  document.addEventListener('click', (ev) => {
    const tgt = ev.target && ev.target.closest
      ? ev.target.closest('#sp-rank-tab [data-t], #sp-mach [data-m], #sp-mach-retry')
      : null;
    if (!tgt) return;
    /* 只在排行榜视图里生效：切走后 #sp-body 已经换内容，迟到的点击不该再改状态 */
    if (!SP.app || SP.app.state.view !== 'ranking') return;
    if (tgt.id === 'sp-mach-retry') {
      rankState.machineErr = '';
      loadMachine(true);
      return;
    }
    if (tgt.dataset.t) {
      const v = tgt.dataset.t === 'machine' ? 'machine' : 'user';
      if (rankState.tab === v) return;
      rankState.tab = v;
      rankState.limit = pageSize();   // 换档从头一页看起，别带着上一档「更多」撑大的行数
      if (v === 'machine') loadMachine();
      SP.app.render();
      return;
    }
    const m = tgt.dataset.m;
    if (m && MACH_SECTS.indexOf(m) >= 0 && rankState.sect !== m) {
      rankState.sect = m;
      rankState.limit = pageSize();
      SP.app.render();
    }
  });

  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { ranking, teams, teamDetail, rankState, teamsState, teamState });
})();

/* ===== src/53-views-session.js ===== */
/* ==== 53-views-session.js：会话页（一台机器） ====
   独立 IIFE：公共件从 45-view-kit 取，项目组件从 SP.Views 取。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow, packLabel, whyLabel, dailySeries , pageSize } = SP.VK;

  /* ==== 会话页（一台机器）：机器信息 + 可渲染项目在同一份 HTML 里，时间线是站点自己的 AJAX JSON；
     任何一块拿不到，只让那一块说"没有数据"，其余照常显示。 */
  const sessState = { type: 'all', limit: pageSize() };

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

  /** 事件时长单独写：时间线里的事件要精确到秒/分，和排行榜那种"机时"（y/d/h）不是一个口径。 */
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
    const ev = (list || []).filter((e) => Number.isFinite(e.start)).toSorted((a, b) => b.start - a.start);
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

    /* **两种暂停是两件事，而且可以同时成立**："Paused server side" 与 "Paused client side" 以站点那行为准
       （站点是两条独立条件、各写一行）；Action 只说"服务器认不认它在跑"（本地暂停时 Status 照样 Enable），
       只看 Action 会报成「运行中」。两个都在就画两个 chip —— 合成一个词会丢掉"哪一端停的"。
       词条与 40-ui.js 的 pauseKeys() 共用一份判据。 */
    const status = val('status');
    const note = s.info.note ? s.info.note.value : '';
    const noteTitle = note ? ` title="${esc(t('sess.statusRaw', { raw: note }))}"` : '';
    const pauseChip = UI.pauseKeys(note).map((k) => `<span class="chip off"${noteTitle}>${esc(t(k))}</span>`).join('');
    const chip = pauseChip
      ? pauseChip
      : note ? `<span class="chip off"${noteTitle}>${esc(note)}</span>`
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
        <h2>${esc(t('sess.facts'))}</h2>
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

  /* 日志行：连续的同一个 job 算一组，奇数组铺淡底 ——
     领任务→渲染→校验 是一次作业的三步，上色后能一眼看出组边界。 */
    /** 日志按时间倒序，「领任务」是一次作业的最后一环；所以**上一行是领任务**时，
      当前行就属于下一次作业，这就是组边界。比按 job 分组稳：同一 job 会有多次循环，
      按 job 分会把它们拆成好几段（用户实测看到交替色）。 */
  function logRows(list) {
    let prev = null, band = 0;
    return list.map((e) => {
      if (prev && prev.type === 'request') band += 1;
      const cls = band % 2 ? "grp" : "";
      prev = e;
      return `<tr class="${cls}">
        <td><span class="st st-${esc(e.type)}">${esc(typeLabel(e.type))}</span></td>
        <td class="num">${esc(stamp(e.start, acts.crossYear))}</td>
        <td class="r num">${esc(spanText(e.end - e.start))}</td>
        <td class="job num">${esc(e.job || "—")}</td>
      </tr>`;
    }).join("");
  }

    const tlHead = tl.length
      ? t('sess.tlSub', {
        n: fmt(tl.length),
        from: stamp(tl[tl.length - 1].start, acts.crossYear),
        to: stamp(tl[0].start, acts.crossYear),
      })
      // 接口没回应时不在这里说"站点没返回记录"：正文已说"没取到"，两句会互相打脸。
      : (s.timelineFailed ? '' : t('sess.tlSubEmpty'));

    /* 只留数字，不画条（用户 2026-11-13）：条的基准是"本期最长那天"，同一天数换个时段长度就变；
       而渲染时长本身已经写在右边，条只是重复表达、还占掉一半宽度。 */
    const actTable = buckets.length ? `<div class="acts" role="table">
      <div class="acthead" role="row">
        <span class="ad" role="columnheader">${esc(acts.byMonth ? t('sess.act.month') : t('sess.act.day'))}</span>
        <span class="h" role="columnheader">${esc(t('sess.act.render'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.events'))}</span>
        <span class="h s" role="columnheader">${esc(t('sess.act.jobs'))}</span>
        ${acts.anyFail ? `<span class="h s" role="columnheader">${esc(t('sess.act.failed'))}</span>` : ''}
      </div>
      ${buckets.map((b) => `<div class="actrow" role="row">
        <span class="ad num" role="cell">${esc(UI.dateLabel(b.key))}</span>
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
      <div class="tlwrap"><div class="tablewrap log" tabindex="0" role="region" aria-label="${esc(t('sess.timeline'))}"><table class="tbl dense log">
        <thead><tr><th scope="col">${esc(t('sess.col.type'))}</th><th scope="col">${esc(t('sess.col.start'))}</th>
          <th scope="col" class="r">${esc(t('sess.col.span'))}</th>
          <th scope="col">${esc(t('sess.col.job'))}</th></tr></thead>
        <tbody>${logRows(rows.slice(0, sessState.limit))}
        </tbody>
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

    const maps = SP.Views.listsOf(state);
    const openP = SP.Views.projState.menu ? [...own.values()].find((x) => x.id === SP.Views.projState.menu) : null;
    const menuHtml = openP ? SP.Views.ownerMenu(openP, state.userName, maps) : '';

    const prjPanel = s.hasProjects !== false ? `<div class="panel" style="margin-top:16px">
      <div class="phead" style="padding-bottom:14px">
        <h2>${esc(t('sess.projects'))}</h2>
        <span class="sub">${esc(t('sess.prjSub', { n: fmt(s.projects.length) }))}</span>
      </div>
      ${prjRows.length ? `<div class="tablewrap" tabindex="0" style="margin:0 6px 6px"><table class="tbl dense fit">
        <colgroup>
          <col style="width:29%"><col style="width:19%"><col style="width:17%">
          <col style="width:19%"><col style="width:9%"><col style="width:7%">
        </colgroup>
        <thead><tr>
          <th scope="col">${esc(t('proj.col.project'))}</th>
          <th scope="col">${esc(t('proj.col.owner'))}</th>
          <th scope="col">${esc(t('proj.col.status'))}</th>
          <th scope="col">${esc(t('proj.col.progress'))}</th>
          <th scope="col">${esc(t('proj.col.device'))}</th>
          <th scope="col" class="r">${esc(t('proj.col.memory'))}</th>
        </tr></thead>
        <tbody>${prjRows.map(({ n, label, p }) => {
          const who = p && (p.ownerId || p.owner) ? SP.Views.ownerCell(p, state.userName, maps) : '<span class="dash">—</span>';
          const isCur = !!curProject && (curProject === n || curProjectBase === n);
          const frac = p ? UI.progressText(p.pct, p.done, p.total) : '';
          return `<tr>
            <td><div class="pnwrap"><div class="pn" title="${esc(n)}">${esc(n)}</div>${
              isCur ? `<span class="now">${esc(t('sess.rendering'))}</span>` : ''}</div></td>
            <td>${who}</td>
            <td><span class="st" title="${esc(label)}">${esc(label)}</span></td>
            ${p ? SP.Views.pcell(p.pct, frac, frac) : '<td class="r"><span class="dash">—</span></td>'}
            <td>${p ? UI.devices(p.cpu, p.gpu) : '<span class="dash">—</span>'}</td>
            <td class="r num" title="${p ? esc(p.memory || '—') : ''}">${p ? esc(p.memory || '—') : '<span class="dash">—</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="pbody"><div class="none">${esc(t('sess.prjNone'))}</div></div>`}
    </div>` : '';

    return head + UI.kpis(kpiItems) + factsPanel + control + timelinePanel + prjPanel + foot() + menuHtml;
  }


  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { session, sessState });
})();

/* ===== src/54-views-account.js ===== */
/* ==== 54-views-account.js：设置 / 账户 ====
   独立 IIFE：公共件从 45-view-kit 取，项目状态从 SP.Views 取。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow, sechead } = SP.VK;

  /* 账户页当前标签（原放在 51 里，跟着视图走） */
  const acctState = { tab: 'sched' };
  /* ==== 设置 ==== */

  function settings(state) {
    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, label]) =>
      `<button data-v="${v}" aria-pressed="${String(cur) === v}">${esc(label)}</button>`).join('')}</div>`;

    const langOpts = [['auto', t('set.lang.auto')]]
      .concat(I18n.available().map((l) => [l.code, l.label]));

    return `${sechead({ title: esc(t('set.title')) })}
      <div class="panel settings">
        <div class="row"><div class="lbl">${esc(t('set.theme'))}</div>
          ${seg('sp-theme', state.themePref, [['auto', t('set.theme.auto')], ['dark', t('set.theme.dark')], ['light', t('set.theme.light')]])}</div>

        <div class="row block">
          <div class="lbl">${esc(t('set.pageSize'))}</div>
          ${seg('sp-pagesize', String(SP.VK.pageSize()), [['100', '100'], ['200', '200'], ['500', '500']])}
          <div class="hint">${esc(t('set.pageSizeHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.nav'))}
            <button class="btn sm" data-nav-reset>${esc(t('set.navReset'))}</button></div>
          <div class="seg" id="sp-navcfg">${SP.VK.NAV_ITEMS.map(([k, locked]) => {
    const on = locked || !state.navHidden.includes(k);
    return `<button data-nav-toggle="${esc(k)}" aria-pressed="${on}"${locked ? ' disabled' : ''} title="${esc(locked ? t('set.navLocked') : '')}">${esc(t('nav.' + k))}</button>`;
  }).join('')}</div>
          <div class="hint">${esc(t('set.navHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.scale'))}</div>
          ${seg('sp-scale', String(state.uiScale), [['0.9', '90%'], ['1', '100%'], ['1.1', '110%'], ['1.25', '125%'], ['1.4', '140%']])}
          <div class="hint">${esc(t('set.scaleHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.lang'))}</div>
          ${seg('sp-lang', state.langPref, langOpts)}
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.psort'))}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            ${seg('sp-psort', SP.Views.projState.sort, Object.keys(SP.Views.P_SORTS).map((k) => [k, t(SP.Views.P_SORTS[k].label)]))}
            ${seg('sp-pdir', SP.Views.projState.dir, [['asc', t('set.pdir.asc')], ['desc', t('set.pdir.desc')]])}
          </div>
          <div class="hint">${esc(t('set.psortHint'))}</div>
        </div>

        <div class="row block">
          <div class="lbl">${esc(t('set.ovblocks'))}</div>
          <div class="ovlist">${SP.Views.ovDisplayOrder().map(SP.Views.ovRow).join('')}</div>
          <div class="hint">${esc(t('set.ovblocksHint'))}</div>
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
    const list = (opts && opts.list) || '';
    const box = (inner) => `<div class="ulist" data-listbox="${esc(list)}" data-empty="${esc(emptyText)}">${inner}</div>`;
    if (!items || !items.length) return box(`<div class="none">${esc(emptyText)}</div>`);
    const needAction = !!(opts && opts.requiresAction);
    return box(items.map((u) => `<div class="u">
        ${UI.avatar(u.avatar, u.name, 'ini')}
        <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
        ${u.action || !needAction
    ? `<button class="btn sm" data-list-del="${esc(u.name)}" data-url="${esc(u.action)}" data-list="${esc(list)}">${esc(t('account.remove'))}</button>`
    : ''}
      </div>`).join(''));
  }

  /* ---- 渲染优先级名单：就地增删（这一屏最高频的动作，别整页重画） ----
     整页重画不只慢：render() 会把 #sp-body 整个替换掉，输入框、光标位置、敲了一半的用户名
     一起消失，连着加几个人就得反复点回输入框。所以这一段写操作只动两处 DOM —— 名单本身、
     输入框下面那行状态。写端点仍是站点自己的：添加用解析出来的 /user/priority/add/ 前缀，
     移除用每一行 onclick 里带的 /user/priority/remove/<名字>（20-api.js parseAccount 的 action）。
     行上的删除按钮改名 data-prio-del 而不是 data-del：80-app.js 那份 [data-del] 收口是
     "提交后整页重取"，正好是这里要去掉的行为。 */

  /** 空名单不是一片留白：说清"还没有人"，并把下一步（输入用户名后回车）写在原地。 */
  const prioEmptyText = () => `${t('account.prioNone')} · ${t('account.priorityAdd')}`;

  const prioRow = (u) => `<div class="u" data-prio-row="${esc(u.name)}">
      ${UI.avatar(u.avatar, u.name, 'ini')}
      <span class="n"><a href="/user/${encodeURIComponent(u.name)}/profile" target="_self">${esc(u.name)}</a></span>
      ${u.action ? `<button class="btn sm" data-prio-del="${esc(u.name)}" data-url="${esc(u.action)}">${esc(t('account.remove'))}</button>` : ''}
    </div>`;

  const prioList = (items) => `<div class="ulist" id="sp-prio-list">${items && items.length
    ? items.map(prioRow).join('')
    : `<div class="none">${esc(prioEmptyText())}</div>`}</div>`;

  let prioBusy = false;      // 一次只发一个写请求：双击「移除」不会再打两发
  let prioSeq = 0;           // 每次重取的序号：慢的那次回来时，更晚的一次可能已经落过地
  let prioMsgTimer = 0;
  /* 本屏内已经删成功的名字：写操作回了 OK 就是删掉了，之后的重取（可能命中站点/代理的
     过期页）不能再把它画回来。整页重开时这份集合自然失效（那时以站点数据为准）。 */
  const prioGone = new Set();

  const prioEl = (id) => document.getElementById(id);
  const prioState = () => (SP.app && SP.app.state) || null;

  /** 输入框下面那行状态：text 空即收起；bad 用警示色（校验不通过 / 站点报错）。 */
  function prioSay(text, bad) {
    const msg = prioEl('sp-prio-msg');
    if (!msg) return;
    if (prioMsgTimer) { clearTimeout(prioMsgTimer); prioMsgTimer = 0; }
    msg.textContent = text || '';
    msg.hidden = !text;
    msg.classList.toggle('bad', !!(text && bad));
  }

  /** 成功提示：说完就收，别占着校验的位置。 */
  function prioFlash(text) {
    prioSay(text);
    prioMsgTimer = setTimeout(() => {
      const msg = prioEl('sp-prio-msg');
      if (msg && msg.textContent === text) { msg.textContent = ''; msg.hidden = true; }
    }, 2200);
  }

  /** 只重画名单这一块（输入框、光标、焦点都不动）。 */
  function prioPaint() {
    const list = prioEl('sp-prio-list');
    const s = prioState();
    if (!list || !s || !s.account) return;
    const items = s.account.priority || [];
    list.innerHTML = items.length ? items.map(prioRow).join('') : `<div class="none">${esc(prioEmptyText())}</div>`;
  }

  /** 输入即校验：空 → 按钮禁用（placeholder 已说明下一步）；重复 → 说明"已在名单里"并挡住
      （再提交一次是纯浪费）；自己 → 说明调度器默认把「我自己」排最前，但**不挡**：关掉
      "优先渲染我自己的项目"开关时，把自己加进名单是有意义的。 */
  function prioCheck() {
    const inp = prioEl('sp-prio');
    const btn = prioEl('sp-prio-add');
    if (!inp || !btn) return { name: '', blocked: true, dup: false };
    const s = prioState() || {};
    const acc = s.account || {};
    const name = inp.value.trim();
    const me = String(s.userName || '').toLowerCase();
    const dup = !!name && (acc.priority || []).some((x) => String(x.name).toLowerCase() === name.toLowerCase());
    const self = !!name && !!me && name.toLowerCase() === me;
    if (!name) { btn.disabled = true; prioSay(''); }
    else if (dup) { btn.disabled = true; prioSay(t('proj.prio.inList'), true); }
    else if (self) { btn.disabled = false; prioSay(t('account.schedulerHint'), true); }
    else { btn.disabled = false; prioSay(''); }
    return { name, blocked: !name || dup, dup };
  }

  /** 写成功后重拉一次账户页数据，只回填优先级名单（其余面板不动 —— 整页重画就丢焦点）。
      opts.added：刚加成功的名字，站点页面偶尔还没带上它，先补一行（没有移除按钮：站点给的
      action 要等下一次整页数据才知道），下次整页取数会补全。 */
  async function prioReload(opts) {
    const s = prioState();
    const user = s && s.userName;
    if (!user || !s.account) return false;
    const seq = ++prioSeq;
    SP.Api.invalidate();
    let acc;
    try {
      acc = SP.Api.parseAccount(await SP.Api.fetchPage(`/user/${encodeURIComponent(user)}/edit`));
    } catch (e) {
      return false;   // 写已经成功：读失败就保持现状，下次整页取数会纠正；别把成功报成失败
    }
    if (seq !== prioSeq) return false;   // 更晚的一次刷新已经落地，这份数据已经过时
    let items = (acc.priority || []).filter((x) => !prioGone.has(x.name));
    if (opts && opts.added && !items.some((x) => x.name === opts.added)) {
      items = items.concat([{ name: opts.added, action: '', avatar: '' }]);
    }
    s.account = Object.assign({}, s.account, { priority: items });
    prioPaint();
    return true;
  }

  async function prioAdd() {
    if (prioBusy) return;
    const inp = prioEl('sp-prio');
    const btn = prioEl('sp-prio-add');
    const s = prioState();
    if (!inp || !btn || !s || !s.account) return;
    const v = prioCheck();
    if (!v.name) { prioSay(t('mg.acl.needName'), true); return; }   // 空：说清楚，别静默
    if (v.dup) return;                                              // 已在名单里：按钮已禁用，这里兜底
    const base = (s.account.add && s.account.add.priority) || '/user/priority/add/';
    prioBusy = true;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(base + encodeURIComponent(v.name));
      if (!SP.Api.isOk(r)) { prioSay(t('account.failed', { msg: r }), true); return; }
    } catch (e) {
      prioSay(t('account.failed', { msg: (e && e.message) || String(e) }), true);
      return;
    } finally {
      prioBusy = false;
      if (btn.isConnected) btn.disabled = false;
    }
    /* 先就地补一行再重拉：用户马上看到结果（重拉只负责把站点那份完整数据换进来） */
    prioGone.delete(v.name);
    s.account = Object.assign({}, s.account, {
      priority: (s.account.priority || []).concat([{ name: v.name, action: '', avatar: '' }]),
    });
    inp.value = '';
    prioPaint();
    prioCheck();
    inp.focus();                        // 连续录入：焦点留在输入框
    prioFlash(t('account.ok'));
    prioReload({ added: v.name });
  }

  async function prioRemove(btn) {
    if (prioBusy || !btn) return;
    const url = btn.dataset.url;
    const name = btn.dataset.prioDel;
    const row = btn.closest('[data-prio-row]');
    const s = prioState();
    if (!url || !name || !row || !s || !s.account) return;   // 读不到站点给的地址：不发请求
    prioBusy = true;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(url);
      if (!SP.Api.isOk(r)) { prioSay(t('account.failed', { msg: r }), true); btn.disabled = false; return; }
    } catch (e) {
      prioSay(t('account.failed', { msg: (e && e.message) || String(e) }), true);
      btn.disabled = false;
      return;
    } finally {
      prioBusy = false;
    }
    prioGone.add(name);
    s.account = Object.assign({}, s.account, {
      priority: (s.account.priority || []).filter((x) => x.name !== name),
    });
    row.remove();                       // 就地删一行：输入框、选中位置、焦点全都没动
    prioPaint();                        // 删空了要换成空态
    prioCheck();                        // 输入的若正好是刚删掉的名字，现在可以加了
    prioFlash(t('account.ok'));
    prioReload();
  }

  /** 名单行删除：就地摘掉那一行（赞助 / 两个黑名单 / 渲染密钥）。
      与 priority 的 prioRemove 是同一套手感：不整页重画，输入框和焦点都不动。 */
  const LIST_KEYS = {
    sponsor: (acc) => (acc.sponsor && acc.sponsor.list) || [],
    blockedRenderers: (acc) => acc.blockedRenderers || [],
    blockedOwners: (acc) => acc.blockedOwners || [],
    keys: (acc) => acc.renderKeys || [],
  };

  /** 名字字段不一样：其它名单按 name，密钥按 key。 */
  function listBoxSync(list, acc, name) {
    const arr = LIST_KEYS[list] ? LIST_KEYS[list](acc) : null;
    if (!Array.isArray(arr)) return;
    const next = arr.filter((x) => (list === 'keys' ? x.key !== name : x.name !== name));
    if (list === 'sponsor') acc.sponsor = Object.assign({}, acc.sponsor, { list: next });
    else if (list === 'keys') acc.renderKeys = next;
    else acc[list] = next;
  }

  async function listRemove(btn) {
    const url = btn && btn.dataset.url;
    const list = btn && btn.dataset.list;
    const name = btn && btn.dataset.listDel;
    const s = prioState();
    if (!url || !list || !s || !s.account) return;   // 读不到站点给的地址：不发空 POST
    /* 原生对话框：样式跟随主题，Esc 取消，焦点默认在「取消」 */
    if (btn.dataset.confirm && !(await SP.UI.confirmBox({ body: btn.dataset.confirm, danger: true }))) return;
    btn.disabled = true;
    try {
      const r = await SP.Api.post(url);
      if (!SP.Api.isOk(r)) {
        btn.disabled = false;
        if (SP.app && SP.app.toast) SP.app.toast(t('account.failed', { msg: r }));
        return;
      }
    } catch (e) {
      btn.disabled = false;
      if (SP.app && SP.app.toast) SP.app.toast(t('account.failed', { msg: (e && e.message) || String(e) }));
      return;
    }
    const row = btn.closest('.u, .keyrow');
    if (row) row.remove();                     // 就地摘行：不动输入框、不丢焦点
    listBoxSync(list, s.account, name);
    const box = document.querySelector('[data-listbox="' + list + '"]');
    if (box && !box.querySelector('.u') && !box.querySelector('.keyrow')) {
      const none = document.createElement('div');
      none.className = 'none';
      none.textContent = box.dataset.empty || t('account.empty');
      box.appendChild(none);
    }
    if (SP.app && SP.app.toast) SP.app.toast(t('account.ok'));
  }

  /** 账户页的事件委托：装一次，挂在 #sp-body 上（它整场会话都不换）。 */
  function prioWire(root) {
    if (!root || root.dataset.spAcct === '1') return;
    root.dataset.spAcct = '1';
    root.addEventListener('click', (ev) => {
      const tgt = ev.target;
      const add = tgt && tgt.closest && tgt.closest('[data-act="prio-add"]');
      if (add) {
        /* 只 stopPropagation：80-app.js 那份 prio-add 逻辑原样留着当兜底 —— 这里的接线万一
           没绑上，按钮仍按老路走（整页重画但能用）；绑上了就不能让它再跑一遍。 */
        ev.stopPropagation();
        prioAdd();
        return;
      }
      const del = tgt && tgt.closest && tgt.closest('[data-prio-del]');
      if (del) { ev.stopPropagation(); prioRemove(del); return; }
      /* 其余三份名单（赞助 / 两个黑名单 / 渲染密钥）：同一条就地路径 ——
         删除只摘掉那一行，不再走 80-app 的 [data-del] → submit() → 整页重取。 */
      const ld = tgt && tgt.closest && tgt.closest('[data-list-del]');
      if (ld) { ev.stopPropagation(); listRemove(ld); }
    });
    root.addEventListener('input', (ev) => {
      if (ev.target && ev.target.id === 'sp-prio') prioCheck();
    });
    root.addEventListener('keydown', (ev) => {
      if (!ev.target || ev.target.id !== 'sp-prio') return;
      /* 占位符承诺了"回车添加"（原来回车什么都不做）；输入法组合中的回车不能当提交 */
      if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); prioAdd(); }
    });
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
      ${prioList(a.priority)}
      <div class="addrow">
        <label class="input">${UI.icon('search')}
          <input id="sp-prio" type="text" autocomplete="off" spellcheck="false"
            placeholder="${esc(t('account.priorityAdd'))}" aria-describedby="sp-prio-msg">
        </label>
        <button class="btn primary" id="sp-prio-add" data-act="prio-add" data-input="sp-prio">${esc(t('account.add'))}</button>
      </div>
      <div class="hint" id="sp-prio-msg" role="status" style="margin:8px 0 0" hidden></div>`);

    /* 捐赠积分（站点叫 Sponsorship）：积分会给名单里的随机一位；地址全来自解析结果，拿不到就不画。 */
    const spon = a.sponsor || { give: null, receive: null, addUrl: '', list: [] };
    const sponsor = panel(t('account.sponsor'), t('account.sponsorSub'), `
      <p class="hint">${esc(t('account.sponsorHint'))}</p>
      ${spon.give || spon.receive
        ? swAction(spon.give, t('account.sponsor.give'), t('account.sponsor.giveHint'))
          + swAction(spon.receive, t('account.sponsor.receive'), t('account.sponsor.receiveHint'))
        : ''}
      <div class="phead" style="padding:18px 0 0"><h2>${esc(t('account.sponsorList'))}</h2></div>
      ${userList(spon.list, t('account.sponsorEmpty'), { requiresAction: true, list: 'sponsor' })}
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
      ${a.renderKeys.length ? `<div class="ulist" data-listbox="keys" data-empty="${esc(t('account.empty'))}">${a.renderKeys.map((k) => `<div class="keyrow">
          <span class="k num" title="${esc(k.key)}">${esc(k.key)}</span>
          <span class="c" title="${esc(k.comment)}">${esc(k.comment)}</span>
          <span class="use ${k.inUse ? 'on' : ''}">${esc(k.inUse ? t('account.keys.inUse') : t('account.keys.free'))}</span>
          <button class="btn sm" data-list-del="${esc(k.key)}" data-url="${esc(k.action)}" data-list="keys" data-confirm="${esc(t('account.keys.delConfirm'))}">${esc(t('account.keys.del'))}</button>
        </div>`).join('')}</div>` : `<div class="ulist" data-listbox="keys" data-empty="${esc(t('account.empty'))}"><div class="none">${esc(t('account.empty'))}</div></div>`}
      <div class="addrow">
        <label class="input"><input id="sp-keycomment" type="text" autocomplete="off" placeholder="${esc(t('account.keys.comment'))}"></label>
        <button class="btn primary" data-act="key-add" data-input="sp-keycomment">${esc(t('account.keys.add'))}</button>
      </div>`);

    const blacklist = panel(t('account.block.renderer'), '', `
      <p class="hint">${esc(t('account.block.rendererHint'))}</p>
      ${userList(a.blockedRenderers, t('account.empty'), { list: 'blockedRenderers' })}
      <div class="addrow">
        <label class="input"><input id="sp-block-renderer" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(t('account.block.add'))}"></label>
        <button class="btn primary" data-act="block-add" data-kind="renderer" data-input="sp-block-renderer">${esc(t('account.add'))}</button>
      </div>
      <div class="phead" style="padding:20px 0 0"><h2>${esc(t('account.block.owner'))}</h2></div>
      <p class="hint" style="margin-top:8px">${esc(t('account.block.ownerHint'))}</p>
      ${userList(a.blockedOwners, t('account.empty'), { list: 'blockedOwners' })}
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

    return `${sechead({ title: esc(t('account.title')) })}
      <div class="seg" id="sp-acct-tabs" role="tablist">${acctTabs.map(([k, label]) =>
        `<button data-tab="${k}" role="tab" aria-selected="${tab === k}" aria-pressed="${tab === k}">${esc(label)}</button>`).join('')}</div>
      <div class="acct">${acctPanels[tab]}</div>
      ${foot()}`;
  }

  function mount(root, state) {
    /* 上一屏的图表观察器/兜底 resize 监听先收掉：否则它挂在已摘除的节点上（单节点泄漏，
       切走再回来还可能对 0 宽节点重画）。 */
    if (SP.Charts && SP.Charts.dispose) SP.Charts.dispose();
    /* 账户设置：优先级名单就地增删的接线（装一次，事件委托挂在 #sp-body 上）。
       每次画完都同步一次输入框状态 —— 面板重建后按钮是新的，禁用与提示得按当前输入重算。 */
    if (root && root.querySelector('#sp-prio')) { prioWire(root); prioCheck(); }
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

  /* 只注册本文件产出的：50/51/52/53 各自注册自己的。 */
  SP.Views = Object.assign(SP.Views || {}, { settings, account, mount, acctState });
})();

/* ===== src/55-views-live.js ===== */
/* ==== 55-views-live.js：实况（/home/frames + /home/machines） ====
   站点的这两页原本是两块独立的全站统计：frames 讲「羊群在跑什么」，machines 讲「谁在跑」。
   这里合成一页四段：指标带 → 趋势（两条折线）→ 构成（横向条）→ 明细（两个 tab）。
   图表数据是内联的 `var name = [...]`，由 20-api 的 parseChartArrays 抠出来；
   折线复用 40-ui 的 Charts.points，不引外挂图表库。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t } = { Util: SP.Util, UI: SP.UI, t: SP.t };
  const { esc, fmt, foot, moreRow, pageSize, panel, sechead, emptyRow, tableWrap } = SP.VK;

  const liveState = { tab: 'frames', q: '', limit: pageSize(), mq: '', vendor: '', pq: '' };

  /* 厂商归类：站点不给厂商字段，只能从机器型号推断。推断不出就归 other，不硬猜成 NVIDIA。 */
  const VENDOR_RES = [
    /* NVIDIA：除了 GeForce/Quadro/Tesla 这些常见前缀，还要认矿卡与计算卡 ——
       P104-100 / P102-100 / P106-100（Pascal 矿卡）、CMP 系列（30HX/50HX/90HX）、
       A40/L4/L40/V100/T4（数据中心卡），以及 GP104/GA102 这类芯片代号。 */
    ['nvidia', /(geforce|rtx|gtx|quadro|tesla|titan|nvidia|a100|h100|a40|l4|l40|v100|t4|p10[0-9]|cmp\s*\d|gp10[0-9]|ga10[0-9])/i],
    ['amd', /(radeon|rx |vega|instinct|firepro|amd)/i],
    ['apple', /(apple|m1|m2|m3|m4)/i],
    ['intel', /(intel|arc|iris|uhd)/i],
  ];
  function vendorOf(model) {
    const s = String(model || '');
    for (const pair of VENDOR_RES) if (pair[1].test(s)) return pair[0];
    return 'other';
  }
  /* 构成类图表用分类色板（见 10-core 的 --cat-*）：
     实况页每边只有 3 类，同一橙色 100% / 88% / 76% 的透明度阶梯在深色底上几乎连成一条。
     分类色板只在这里用 —— 状态、按钮、强调仍然是 --accent。 */
  const cat = (i) => `var(--cat-${i < 5 ? i + 1 : 5})`;

  function stackBar(entries, total) {
    const sum = total || entries.reduce((n, x) => n + x.v, 0) || 1;
    return `<div class="stack">${entries.map((x, i) => `<i data-i="${i}" style="width:${(x.v / sum * 100).toFixed(2)}%;background:${x.other ? 'var(--cat-other)' : cat(i)}" title="${esc(x.d)}: ${fmt(x.v)} (${Math.round(x.v / sum * 100)}%)"></i>`).join('')}</div>`;
  }

  function legend(entries, total, labelOf) {
    const sum = total || entries.reduce((n, x) => n + x.v, 0) || 1;
    const nameOf = (x) => (labelOf ? labelOf(x) : x.d);
    return `<div class="llegend">${entries.map((x, i) => `<div class="lrow" data-i="${i}"${labelOf ? ` data-v="${esc(x.d)}"` : ''}>
        <span class="sw" style="background:${x.other ? 'var(--cat-other)' : cat(i)}"></span>
        <span class="ln" title="${esc(nameOf(x))}">${esc(nameOf(x))}</span>
        <span class="lv num">${fmt(x.v)}</span>
        <span class="lp num">${Math.round(x.v / sum * 100)}%</span>
      </div>`).join('')}</div>`;
  }

  /* 项目分布是**排名**，不是几个类别：用条形列表，读者比的是长短。
     给 8 项各配一种颜色只会变成调色盘，颜色超过 5 个也不再可靠。 */
  function barRow(name, v, ratio, other, filter) {
    return `<div class="lbar${other ? ' other' : ''}"${filter ? ` data-p="${esc(filter)}"` : ''}>
      <span class="ln" title="${esc(name)}">${esc(name)}</span>
      <span class="ltrack"><i style="width:${Math.max(1, ratio * 100).toFixed(2)}%"></i></span>
      <span class="lv num">${fmt(v)}</span>
      <span class="lp num">${Math.round(ratio * 100)}%</span>
    </div>`;
  }

  function distPanel(title, sub, list, top) {
    const items = (list || []).filter((x) => x.v > 0);
    if (!items.length) return '';
    const sum = items.reduce((n, x) => n + x.v, 0) || 1;
    const shown = items.slice(0, top);
    const rest = items.slice(top);
    const restV = rest.reduce((n, x) => n + x.v, 0);
    const rows = shown.map((x) => barRow(x.d, x.v, x.v / sum, false, x.d));
    if (restV) rows.push(barRow(t('live.dist.other', { n: rest.length }), restV, restV / sum, true));
    return panel({ title: esc(title), sub: esc(sub), style: 'padding:14px 0 16px', body: `<div class="lbars">${rows.join('')}</div>` });
  }

  function pairPanel(title, sub, list) {
    const items = (list || []).filter((x) => x.v > 0);
    if (!items.length) return '';
    const entries = items.map((x) => ({ d: x.d, v: x.v }));
    return panel({ title: esc(title), sub: esc(sub), style: 'padding:14px 0 16px', body: `${stackBar(entries)}${legend(entries)}` });
  }

  /* 厂商分布：站点没有厂商字段，从型号推断；点图例可筛下方机器表。 */
  function vendorPanel(m) {
    const list = [...(m.active || []), ...(m.paused || [])];
    if (!list.length) return '';
    const counts = new Map();
    for (const r of list) {
      const k = vendorOf(r.model);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ d: k, v, other: k === 'other' }));
    return panel({ title: esc(t('live.dist.vendor')), sub: esc(t('live.dist.vendorSub')), style: 'padding:14px 0 16px', body: `${stackBar(entries)}${legend(entries, 0, (x) => t('live.vendor.' + x.d))}` });
  }

  function framesTab(state) {
    const d = state.live || {};
    const all = (d.frames || []).filter((r) => {
      if (liveState.pq && r.project !== liveState.pq) return false;
      const q = liveState.q.trim().toLowerCase();
      return !q || String(r.project).toLowerCase().includes(q) || String(r.user).toLowerCase().includes(q) || String(r.machine).toLowerCase().includes(q);
    });
    const body = all.length ? all.slice(0, liveState.limit).map((r) => `<tr>
        <td><div class="pn" title="${esc(r.project)}">${esc(r.project)}</div></td>
        <td class="r num">${esc(r.frame)}</td>
        <td>${r.userId ? `<a class="nm" href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}${state && state.userName && r.user === state.userName ? `<span class="you">${esc(t('live.me'))}</span>` : ''}</td>
        <td class="r num">${esc(r.waited || '—')}</td>
        <td class="r num">${esc(r.eta || '—')}</td>
        <td>${esc(r.remaining || '—')}</td>
        <td class="num">${esc(r.machine || '—')}</td>
      </tr>`).join('') : emptyRow(7, esc(t('live.none')));
    return `<div class="toolbar">
        <label class="input">${UI.icon('search')}<input id="sp-lq" type="search" placeholder="${esc(t('live.searchFrames'))}" value="${esc(liveState.q)}"></label>
        <span class="sub num">${esc(t('live.showing', { n: Math.min(all.length, liveState.limit), total: all.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        ${tableWrap(`<table class="tbl">
          <thead><tr><th scope="col">${esc(t('live.col.project'))}</th><th scope="col" class="r">${esc(t('live.col.frame'))}</th>
            <th scope="col">${esc(t('live.col.user'))}</th><th scope="col" class="r">${esc(t('live.col.waited'))}</th>
            <th scope="col" class="r">${esc(t('live.col.eta'))}</th><th scope="col" class="r">${esc(t('live.col.remaining'))}</th>
            <th scope="col">${esc(t('live.col.machine'))}</th></tr></thead>
          <tbody>${body}</tbody></table>`)}
        ${moreRow(Math.min(all.length, liveState.limit), all.length, 100)}
      </div>`;
  }

  function machinesTab(state) {
    const d = state.live || {};
    const m = d.machines || {};
    const all = [...(m.active || []), ...(m.paused || [])].filter((r) => {
      if (liveState.vendor && vendorOf(r.model) !== liveState.vendor) return false;
      const q = liveState.mq.trim().toLowerCase();
      return !q || String(r.model).toLowerCase().includes(q) || String(r.user).toLowerCase().includes(q);
    });
    const body = all.length ? all.slice(0, liveState.limit).map((r) => `<tr class="${r.active ? '' : 'dim'}${state && state.userName && r.user === state.userName ? ' me' : ''}">
        <td><div class="pn" title="${esc(r.model)}">${esc(r.model)}</div></td>
        <td class="r num">${esc(r.memory || '—')}</td>
        <td class="r num">${esc(r.frames || '—')}</td>
        <td class="r num">${esc(r.heartbeat || '—')}</td>
        <td class="r num">${esc(r.elapsed || '—')}</td>
        <td>${r.userId ? `<a class="nm" href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}${state && state.userName && r.user === state.userName ? `<span class="you">${esc(t('live.me'))}</span>` : ''}</td>
      </tr>`).join('') : emptyRow(6, esc(t('live.none')));
    return `<div class="toolbar">
        <label class="input">${UI.icon('search')}<input id="sp-lmq" type="search" placeholder="${esc(t('live.searchMachines'))}" value="${esc(liveState.mq)}"></label>
        <span class="sub num">${esc(t('live.showing', { n: Math.min(all.length, liveState.limit), total: all.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        ${tableWrap(`<table class="tbl">
          <thead><tr><th scope="col">${esc(t('live.col.model'))}</th><th scope="col" class="r">${esc(t('live.col.memory'))}</th>
            <th scope="col" class="r">${esc(t('live.col.frames'))}</th><th scope="col" class="r">${esc(t('live.col.heartbeat'))}</th>
            <th scope="col" class="r">${esc(t('live.col.elapsed'))}</th><th scope="col">${esc(t('live.col.user'))}</th></tr></thead>
          <tbody>${body}</tbody></table>`)}
        ${moreRow(Math.min(all.length, liveState.limit), all.length, 100)}
      </div>`;
  }

  function live(state) {
    const d = state.live;
    if (!d) return UI.state.empty();
    const ch = d.charts || {};
    const lastOf = (a) => (a && a.length ? a[a.length - 1].v : null);
    const m = d.machines || {};
    const nActive = (m.active || []).length;
    const nPaused = (m.paused || []).length;

    const kpi = UI.kpis([
      { k: t('live.kpi.frames'), v: fmt((d.frames || []).length) },
      { k: t('live.kpi.machines'), v: fmt(nActive + nPaused), d: t('live.kpi.machinesSub', { a: nActive, p: nPaused }) },
      { k: t('live.kpi.remaining'), v: lastOf(ch.remainingByHour) != null ? fmt(lastOf(ch.remainingByHour)) : '—' },
      { k: t('live.kpi.perDay'), v: lastOf(ch.framesByDay) != null ? fmt(lastOf(ch.framesByDay)) : '—' },
    ]);

    const chartPanel = (id, title, sub) => panel({
      title: esc(title), sub: esc(sub), style: 'padding:14px 20px 6px', pad: false,
      body: `<div class="chart" id="${id}"><div class="tip"></div></div>`,
    });

    const trend = `<div class="grid2">
      ${chartPanel('sp-live-frames', t('live.trend.frames'), t('live.trend.framesSub'))}
      ${chartPanel('sp-live-machines', t('live.trend.machines'), t('live.trend.machinesSub'))}
    </div>`;

    const comp = `<div class="grid2">
      <div class="grid2" style="grid-template-columns:1fr;gap:16px;margin:0">
        ${distPanel(t('live.dist.projects'), t('live.dist.projectsSub'), ch.projectDist, 8)}
        ${vendorPanel(m)}
      </div>
      <div class="grid2" style="grid-template-columns:1fr;gap:16px;margin:0">
        ${pairPanel(t('live.dist.os'), t('live.dist.osSub'), ch.os)}
        ${pairPanel(t('live.dist.device'), t('live.dist.deviceSub'), ch.device)}
      </div>
    </div>`;

    const filt = (liveState.pq ? `<button class="btn sm" data-live-clear="pq">${esc(t('live.filter.project', { name: liveState.pq }))} ×</button>` : '')
      + (liveState.vendor ? `<button class="btn sm" data-live-clear="vendor">${esc(t('live.filter.vendor', { name: t('live.vendor.' + liveState.vendor) }))} ×</button>` : '');
    const tabBar = `<div class="seg" id="sp-live-tab">
      <button data-l="frames" aria-pressed="${liveState.tab === 'frames'}">${esc(t('live.tab.frames'))}
        <span class="num">${(d.frames || []).length}</span></button>
      <button data-l="machines" aria-pressed="${liveState.tab === 'machines'}">${esc(t('live.tab.machines'))}
        <span class="num">${nActive + nPaused}</span></button>
    </div>`;

    const detail = `<div class="sechead"><h2>${esc(t('live.detail'))}</h2>
        <span class="sub">${esc(t('live.detailSub'))}</span></div>
      ${filt}${tabBar}
      ${liveState.tab === 'machines' ? machinesTab(state) : framesTab(state)}
      ${foot()}`;

    /* 折线要等 DOM 落地才能量宽度：放到微任务里画。 */
    queueMicrotask(() => {
      const b1 = document.getElementById('sp-live-frames');
      const b2 = document.getElementById('sp-live-machines');
      if (b1 && ch.framesByDay && ch.framesByDay.length > 1) SP.Charts.points(b1, ch.framesByDay, { unit: t('live.unit.frames') });
      if (b2 && ch.machinesByDay && ch.machinesByDay.length > 1) SP.Charts.points(b2, ch.machinesByDay, { unit: t('live.unit.machines') });
    });

    return sechead({ title: esc(t('live.title')), sub: esc(t('live.sub')) }) + `${kpi}${trend}${comp}${detail}`;
  }

  /* 自己的委托：tab 切换 + 两个搜索框（和排行榜同一套写法，不塞进 80-app 的事件表）。 */
  document.addEventListener('click', (ev) => {
    const clear = ev.target.closest('[data-live-clear]');
    if (clear) { liveState[clear.dataset.liveClear] = ''; liveState.limit = pageSize(); if (SP.app) SP.app.render(); return; }
    const prow = ev.target.closest('.lbar[data-p]');
    if (prow) { liveState.pq = prow.dataset.p; liveState.tab = 'frames'; liveState.limit = pageSize(); if (SP.app) SP.app.render(); return; }
    const vrow = ev.target.closest('.lrow[data-v]');
    if (vrow) { liveState.vendor = liveState.vendor === vrow.dataset.v ? '' : vrow.dataset.v; liveState.tab = 'machines'; liveState.limit = pageSize(); if (SP.app) SP.app.render(); return; }
    const b = ev.target.closest('#sp-live-tab [data-l]');
    if (!b) return;
    const k = b.dataset.l;
    if (k === liveState.tab) return;
    liveState.tab = k;
    liveState.limit = pageSize();
    if (SP.app) SP.app.render();
  });

  document.addEventListener('input', (ev) => {
    const id = ev.target && ev.target.id;
    if (id !== 'sp-lq' && id !== 'sp-lmq') return;
    const v = ev.target.value;
    if (id === 'sp-lq') liveState.q = v; else liveState.mq = v;
    clearTimeout(liveState.timer);
    liveState.timer = setTimeout(() => {
      const pos = ev.target.selectionStart;
      if (SP.app) SP.app.render();
      const again = document.getElementById(id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
    }, 180);
  });

  /* 图例与堆叠条联动：鼠标停在一类上，其余段压暗。
     3 类时颜色已能分，但相邻色相（橙 / 金）在色弱下仍可能接近 —— 联动是第二道保险。 */
  document.addEventListener('pointerover', (ev) => {
    const row = ev.target && ev.target.closest ? ev.target.closest('.lrow[data-i]') : null;
    if (!row) return;
    const panel = row.closest('.panel');
    const stack = panel && panel.querySelector('.stack');
    if (!stack) return;
    stack.classList.add('hl');
    stack.querySelectorAll('i[data-i]').forEach((el) => el.classList.toggle('hl', el.dataset.i === row.dataset.i));
  });
  document.addEventListener('pointerout', (ev) => {
    const row = ev.target && ev.target.closest ? ev.target.closest('.lrow[data-i]') : null;
    if (!row || (ev.relatedTarget && row.contains(ev.relatedTarget))) return;
    const panel = row.closest('.panel');
    const stack = panel && panel.querySelector('.stack');
    if (!stack) return;
    stack.classList.remove('hl');
    stack.querySelectorAll('i.hl').forEach((el) => el.classList.remove('hl'));
  });

  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { live, liveState });
})();

/* ===== src/72-sweep.js ===== */
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

/* ===== src/80-app.js ===== */
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
    /* 窄屏底部导航：只放 5 个高频入口；设置页隐藏的项在底部也一起隐藏。 */
    const TAB_ITEMS = [['overview', 'sheep'], ['projects', 'folder'], ['ranking', 'bars'], ['live', 'cpu'], ['account', 'user']];
    const tabs = TAB_ITEMS
      .filter(([k]) => NAV_ITEMS.some(([n, locked]) => n === k && (locked || !state.navHidden.includes(k))))
      .map(([k, ic]) => `<button data-nav="${k}" ${navHere === k ? 'aria-current="page"' : ''}>${UI.icon(ic)}<span>${Util.esc(t('nav.' + k))}</span></button>`)
      .join('');
    /* 底部没放的项（上传 / 团队 / 设置）收进「更多」：否则设置在手机上没有入口。 */
    const tabKeys = TAB_ITEMS.map(([k]) => k);
    const moreItems = NAV_ITEMS
      .filter(([k, locked]) => tabKeys.indexOf(k) < 0 && (locked || !state.navHidden.includes(k)))
      .map(([k]) => [k, t('nav.' + k)]);
    const tabMore = moreItems.length
      ? `<div class="tabmore-wrap">
          <button type="button" data-act="tab-more" aria-haspopup="menu" aria-expanded="false">${UI.icon('more')}<span>${Util.esc(t('nav.more'))}</span></button>
          <div class="tabmore" id="sp-tabmore" role="menu" hidden>
            ${moreItems.map(([k, label]) => `<button type="button" role="menuitem" data-nav="${k}">${Util.esc(label)}</button>`).join('')}
          </div>
        </div>`
      : '';
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
                    ${u ? `<div class="who-wrap">
                      <button type="button" class="who" data-act="user-menu" aria-haspopup="menu" aria-expanded="false" title="${Util.esc(u)}">${UI.avatar(SP.state && SP.state.myAvatar, u, 'ini')}<span class="uname">${Util.esc(u)}</span></button>
                      <div class="umenu" id="sp-umenu" role="menu" hidden>
                        <button type="button" role="menuitem" data-nav="account">${Util.esc(t('top.account'))}</button>
                        <a role="menuitem" href="/user/logout">${Util.esc(t('top.logout'))}</a>
                      </div>
                    </div>` : ''}
        </div>
      </div>
      <div id="sp-body"></div>
    </div>
    <nav class="tabbar">${tabs}${tabMore}</nav>`;
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
    /* 表头全选 / 批量条 / 行勾选的状态必须跟着新 DOM 一起落定（render 不负责这些派生状态） */
    syncPicks();
    initTableScrollX();
  }

  /* ---- 表格横向滚动：顶部镜像条 ----
     窄屏/中宽表格靠横向滚动，但原生滚动条在表格最底部 —— 表格一长，用户得先滚到底才能拖它。
     在每张真的溢出的表格上方插一条镜像滚动条，两边 scrollLeft 双向同步；不溢出的表格不插。 */
  let tscrollObs = null;
  /* 真溢出才允许横向滚动：宽屏下表格 width:100% 的亚像素会让 scrollWidth 比 clientWidth
     多 1–2px，不关掉 overflow-x 就会常驻一条底部滚动条。阈值 2px 吞掉亚像素。 */
  function applyTableOverflow() {
    document.querySelectorAll('#sp .tablewrap').forEach((w) => {
      w.classList.toggle('has-x', w.scrollWidth > w.clientWidth + 2);
    });
  }
  /* 给溢出的表格插一条顶部镜像条；已经存在就不重复插。 */
  function attachTopScroll(w) {
    const prev = w.previousElementSibling;
    if (prev && prev.classList.contains('tscroll')) return;
    const top = document.createElement('div');
    top.className = 'tscroll';
    top.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('div');
    top.appendChild(inner);
    w.parentNode.insertBefore(top, w);
    top.addEventListener('scroll', () => { w.scrollLeft = top.scrollLeft; });
    w.addEventListener('scroll', () => { if (top.scrollLeft !== w.scrollLeft) top.scrollLeft = w.scrollLeft; });
  }
  /* 宽度变化时同时维护三件事：overflow-x 开关、顶部条的插入/移除、顶部条宽度同步。
     从宽屏缩到放不下 → 出现；从窄屏放大到放得下 → 消失。 */
  function syncTableScrollX() {
    applyTableOverflow();
    document.querySelectorAll('#sp .tablewrap').forEach((w) => {
      const need = w.scrollWidth > w.clientWidth + 2;
      const prev = w.previousElementSibling;
      const top = prev && prev.classList.contains('tscroll') ? prev : null;
      if (need && !top) attachTopScroll(w);
      if (!need && top) top.remove();
      const t = w.previousElementSibling;
      if (t && t.classList.contains('tscroll')) {
        const inner = t.firstElementChild;
        if (inner) inner.style.width = w.scrollWidth + 'px';
      }
    });
  }
  function initTableScrollX() {
    if (!window.ResizeObserver) return;
    if (tscrollObs) tscrollObs.disconnect();
    tscrollObs = new ResizeObserver(syncTableScrollX);
    document.querySelectorAll('#sp .tablewrap').forEach((w) => {
      tscrollObs.observe(w);
      const tbl = w.firstElementChild;
      if (tbl) tscrollObs.observe(tbl);
    });
    syncTableScrollX();
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
      /* 总览「我的项目」行内要一个关键事实（自动删除日期 / 帧进度）：只补前 5 个、不阻塞首屏。
         放在分支末尾 = **每次进总览都尝试补**：首轮失败或中途切走（alive 为假）后，
         下次回来会重试；fillMetaFor 内部的 !p.meta 过滤保证已成功的不重复抓。 */
      const prof = state.profile;
      if (prof && state.profileName === state.userName && (prof.myProjects || []).some((x) => x && x.id && !x.meta)) {
        fillMetaFor(prof.myProjects, 5, () => state.view === 'overview' && state.profile === prof);
      }
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
      /* 「我发布的」副标题：manage 页的事实异步补，不阻塞首屏；已有 meta 的不会重复抓。 */
      if (state.myProjects && state.myProjects.some((p) => p && p.id && !p.meta)) fillProjectMeta();
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
      /* 写操作的结果必须被读屏念出来：toast 是唯一的提示出口 */
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
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

  /* ---- 「我发布的」多选与删除 ---- */

  /** 删除进行中 / 已请求停止。**必须防重入**：串行删除期间再点一次会并发打同一端点。 */
  let deletingProjects = false;
  let deletingStop = false;
  /** 批量确认态的自动退回计时器（4 秒无操作退出确认，别一直停在"确认删除"上）。 */
  let confirmTimer = null;
  /** Shift 连选的锚点：最后一次点击的行 id。 */
  let lastPickId = '';

  function bulkEls() {
    const bar = document.getElementById('sp-bulk');
    if (!bar) return null;
    return {
      bar,
      text: bar.querySelector('.btext'),
      del: bar.querySelector('[data-act="proj-del-picked"]'),
      none: bar.querySelector('[data-act="proj-picknone"]'),
      ok: bar.querySelector('[data-act="proj-del-confirm"]'),
      back: bar.querySelector('[data-act="proj-del-back"]'),
      stop: bar.querySelector('[data-act="proj-del-stop"]'),
    };
  }

  /** 批量条是**固定结构**：这里只改 textContent / hidden / disabled，不重建 innerHTML。
      重建会丢焦点（键盘用户刚 Tab 到「确认删除」，一次重画就回到 body），读屏也会重复播报。
      形态由 deletingProjects / Views.projState.confirm / picked 长度三者决定。 */
  function paintBulk(busy) {
    const host = document.getElementById('sp');
    if (host) {
      const off = deletingProjects;
      host.querySelectorAll('#sp .tbl-mine [data-pick]').forEach((cb) => { cb.disabled = off; });
      const allBox = host.querySelector('#sp-pickall');
      if (allBox) allBox.disabled = off;
      host.querySelectorAll('#sp .tbl-mine .c-act .btn').forEach((b) => {
        if (b.tagName === 'BUTTON') b.disabled = off;
        else { b.setAttribute('aria-disabled', off ? 'true' : 'false'); b.style.pointerEvents = off ? 'none' : ''; }
      });
    }
    const e = bulkEls();
    if (!e) return;
    const picked = Views.projState.picked || [];
    const n = picked.length;
    const confirming = !deletingProjects && !!Views.projState.confirm && n > 0;
    /* 容器常驻在 sechead 右侧：未选中时它就是「匹配 n / 共 total」那段文字，不占新行、不推表头。 */
    e.bar.hidden = false;
    if (deletingProjects) {
      const i = busy && busy.i ? busy.i : 1;
      const total = busy && busy.n ? busy.n : n;
      e.text.textContent = t('proj.delRunning', { i, n: total });
    } else if (confirming) e.text.textContent = t('proj.delPickedConfirm', { n });
    else if (n > 0) e.text.textContent = t('proj.picked', { n });
    else {
      const rowsInfo = Views.mineRows(state);
      e.text.textContent = t('proj.match', { n: rowsInfo.rows.length, total: rowsInfo.all.length });
    }
    /* 只播报开始与结束：第 1 项用 polite 念一次，之后关掉逐项播报；结果交给 toast（role=status）。 */
    e.text.setAttribute('aria-live', deletingProjects && busy && busy.i > 1 ? 'off' : 'polite');
    e.del.hidden = deletingProjects || confirming || n === 0;
    e.none.hidden = deletingProjects || confirming || n === 0;
    e.ok.hidden = !confirming;
    e.back.hidden = !confirming;
    e.stop.hidden = !deletingProjects;
    e.stop.disabled = deletingStop;
    e.del.disabled = deletingProjects;
    e.none.disabled = deletingProjects;
  }

  function exitConfirm() {
    clearTimeout(confirmTimer);
    confirmTimer = null;
    if (!Views.projState.confirm) return;
    Views.projState.confirm = false;
    paintBulk();
  }

  /** 进入批量确认态：第一次点「删除所选」只走到这里，4 秒无操作自动退回。 */
  function enterConfirm() {
    if (deletingProjects) return;
    if (!(Views.projState.picked || []).length) return;
    Views.projState.confirm = true;
    paintBulk();
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirmTimer = null; exitConfirm(); }, 4000);
    const e = bulkEls();
    /* 默认焦点给「返回」：确认删除不能靠一次误触 Enter 完成 */
    if (e && e.back && !e.back.hidden) { try { e.back.focus(); } catch (err) { /* 焦点拿不到不影响功能 */ } }
  }

  /** 勾选态的定向同步：行 class、行 checkbox、表头全选（含 indeterminate）、批量条。
      整页重画会换掉用户刚点到的节点（焦点丢、滚动被拉回），所以只动该动的这几处。 */
  function syncPicks() {
    const host = document.getElementById('sp');
    const picked = new Set(Views.projState.picked || []);
    if (host) {
      host.querySelectorAll('#sp .tbl-mine tr[data-project]').forEach((tr) => {
        const id = tr.dataset.project;
        if (!id) return;
        const on = picked.has(id);
        tr.classList.toggle('picked', on);
        const cb = tr.querySelector('[data-pick]');
        if (cb) cb.checked = on;
      });
      const all = host.querySelector('#sp-pickall');
      if (all) {
        const visible = Views.mineVisibleIds(state);
        const n = visible.filter((id) => picked.has(id)).length;
        all.checked = n > 0 && n === visible.length;
        all.indeterminate = n > 0 && n < visible.length;
      }
    }
    paintBulk();
  }

  /** 删除中拦刷新/关页：串行 POST 丢在半路，用户不知道删到哪了。 */
  function blockUnload(ev) {
    if (!deletingProjects) return;
    ev.preventDefault();
    ev.returnValue = '';   // Chrome 需要它才会弹确认
    return '';
  }
  function watchUnload(on) {
    if (on) window.addEventListener('beforeunload', blockUnload);
    else window.removeEventListener('beforeunload', blockUnload);
  }

  /** 删除结束后把焦点还回表头全选（没有就搜索框）：焦点留在被删掉的按钮上会掉到 body。 */
  function focusAfterDelete() {
    const el = document.getElementById('sp-pickall') || document.getElementById('sp-q');
    if (!el || !el.isConnected) return;
    try { el.focus(); } catch (e) { /* 焦点拿不到不影响功能 */ }
  }

  /** 给列表里还没有 meta 的前 limit 个项目异步抓 manage 页（并发 3、失败静默跳过）。
      抓完只有 alive() 仍为真才重画（用户可能已经切走）；全部失败不重画 —— 列表本身没变化。
      项目页与总览共用这一份：两处显示的事实口径必须同一套解析。 */
  async function fillMetaFor(list, limit, alive) {
    const items = (list || []).filter((p) => p && p.id && !p.meta).slice(0, limit);
    if (!items.length) return;
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        const p = items[i];
        try {
          p.meta = Api.parseProjectManage(await Api.fetchPage('/project/' + encodeURIComponent(String(p.id))));
        } catch (e) { /* 拿不到就不显示这一项，不影响列表本身 */ }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const changed = items.some((p) => !!p.meta);
    if (changed && (!alive || alive())) render();
  }

  /** 「我发布的」副标题：只补前 30 个，切走再回来因为 meta 已存在而跳过。 */
  function fillProjectMeta() {
    return fillMetaFor(state.myProjects, 30, () => state.view === 'projects' && Views.projState.scope === 'mine');
  }

  /** 把删掉的项目从三份内存数据里摘掉：
      - state.myProjects：项目页「我发布的」直接读它（懒加载判据也看它是不是 null）
      - state.profile.myProjects：看的是自己主页时才与上面那份同源（总览的「我的项目」读它）
      - state.projects：全站列表（切回「全部」时不该还看见已删的项目）
      两份 myProjects 设为**同一个新数组**，否则一处删了另一处还留着。 */
  function dropProjects(ids) {
    const gone = new Set((ids || []).map(String));
    const keep = (arr) => (arr || []).filter((x) => !gone.has(String(x && x.id)));
    const next = keep(state.myProjects);
    state.myProjects = next;
    if (state.profile && state.profileName === state.userName) state.profile.myProjects = next;
    if (state.projects) state.projects = keep(state.projects);
  }

  /** 串行删除：站点一个项目一发 POST（没有批量端点，批量 = 我们自己串起来）。
      Api.post 的结果按 isOk 判成功；失败记下继续下一项；SIGNED_OUT 立刻中止剩余项；
      「停止」置位后不再发下一项，剩下的算"未处理"。结束后 invalidate → 摘数据 →
      失败/未处理项写回选中（只批量入口）→ render → 焦点回表头 → toast 汇总。 */
  async function deleteProjects(ids, opts) {
    if (deletingProjects) { toast(t('account.saving')); return false; }
    const single = !!(opts && opts.single);
    /* id 要拼进 URL：只收纯数字，别的字符直接忽略（不把用户数据当命令发出去） */
    const list = (ids || []).map((x) => String(x)).filter((x) => /^\d+$/.test(x));
    if (!list.length) return false;
    deletingProjects = true;
    deletingStop = false;
    watchUnload(true);
    const n = list.length;
    const ok = [];
    const failed = [];
    const unprocessed = [];
    let msg = '';
    let signedOut = false;
    try {
      for (let i = 0; i < n; i++) {
        /* 用户点了「停止」：剩下的项不再发，原样留在选中里，toast 报"未处理 k 个" */
        if (deletingStop) { for (let j = i; j < n; j++) unprocessed.push(list[j]); break; }
        const id = list[i];
        paintBulk({ i: i + 1, n });   // 每项开始前先把进度说出来
        try {
          const r = await Api.post('/project/' + id + '/remove_no_redirect');
          if (Api.isOk(r)) { ok.push(id); continue; }
          failed.push(id);
          if (!msg) msg = String(r);
        } catch (e) {
          if (e && e.code === 'SIGNED_OUT') {
            /* 登录失效：剩下的项不必再发，全部留在选中里等用户重新登录 */
            signedOut = true;
            for (let j = i; j < n; j++) failed.push(list[j]);
            break;
          }
          failed.push(id);
          if (!msg) msg = errText(e);
        }
      }
    } finally {
      deletingProjects = false;
      deletingStop = false;
      watchUnload(false);
      clearTimeout(confirmTimer);
      confirmTimer = null;
      Views.projState.confirm = false;
    }
    Api.invalidate();
    if (ok.length) dropProjects(ok);
    /* 收尾：成功项与本次目标移出选中；非数字 id 顺手清掉（它不是可删的项目，
       留着只会让下一次批量再忽略一遍）；其它没参与的勾选保持原样。
       失败项 / 未处理项只有**批量入口**才写回选中（行还在，可原地重试）—— 行内单删的
       用户本来没勾这一行，失败后把它勾上会让批量条凭空跳出「已选 1 项」，那是状态噪声。 */
    const okSet = new Set(ok);
    const target = new Set(list);
    const rest = (Views.projState.picked || []).filter((x) => {
      const id = String(x);
      return /^\d+$/.test(id) && !target.has(id) && !okSet.has(id);
    });
    Views.projState.picked = single ? [...new Set(rest)] : [...new Set(rest.concat(failed, unprocessed))];
    render();   // DOM 行消失、计数与「匹配 n / 共 total」由数据重算
    focusAfterDelete();
    if (signedOut) { toast(t('state.loggedOut')); return false; }
    if (unprocessed.length) { toast(t('proj.delStopped', { n: ok.length, m: failed.length, k: unprocessed.length })); return false; }
    if (!failed.length) { toast(t('proj.delOk', { n: ok.length })); return true; }
    if (single) { toast(t('account.failed', { msg: msg || String(failed.length) })); return false; }
    toast(t('proj.delPartial', { n: ok.length, m: failed.length }));
    return false;
  }

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

    /* 头像菜单：账户设置 / 退出登录。点按钮切换，点别处关闭。 */
    const umBtn = ev.target.closest('[data-act="user-menu"]');
    const umenu = document.getElementById('sp-umenu');
    if (umBtn) {
      if (umenu) {
        const open = umenu.hidden;
        umenu.hidden = !open;
        umBtn.setAttribute('aria-expanded', String(open));
      }
      return;
    }
    if (umenu && !umenu.hidden && !ev.target.closest('.umenu')) {
      umenu.hidden = true;
      const b = document.querySelector('[data-act="user-menu"]');
      if (b) b.setAttribute('aria-expanded', 'false');
    }

    /* 底部「更多」二级菜单：上传 / 团队 / 设置 */
    const tmBtn = ev.target.closest('[data-act="tab-more"]');
    const tm = document.getElementById('sp-tabmore');
    if (tmBtn) {
      if (tm) { const open = tm.hidden; tm.hidden = !open; tmBtn.setAttribute('aria-expanded', String(open)); }
      return;
    }
    if (tm && !tm.hidden && !ev.target.closest('.tabmore')) {
      tm.hidden = true;
      const b = document.querySelector('[data-act="tab-more"]');
      if (b) b.setAttribute('aria-expanded', 'false');
    }

    const nav = ev.target.closest('[data-nav]');
    if (nav) {
      /* 删除中不许跳走：串行 POST 还在发，换页会让"删到哪了"完全断掉 */
      if (deletingProjects) { toast(t('account.saving')); return; }
      /* 上传三步交还站点：入口就是新标签页打开站点自己的 /getstarted，我们不接管那一页。 */
      if (nav.dataset.nav === 'upload') { window.open('/getstarted', '_blank', 'noopener'); return; }
      go(nav.dataset.nav); return;
    }

    /* 「我发布的」表头全选：独立分支、在 data-pick 之前判断（表头 label 也会触发 input 的 click）。 */
    const pickAll = ev.target.closest('[data-pickall]');
    if (pickAll) {
      Views.projState.picked = pickAll.checked ? Views.mineVisibleIds(state) : [];
      lastPickId = '';
      syncPicks();
      return;
    }

    /* 「我发布的」行勾选：只更新 Views.projState.picked 与那几处 DOM，绝不整页 render。
       Shift+点击按当前可见行序把区间一起选中/取消（锚点是上一次点的行）。 */
    const pick = ev.target.closest('[data-pick]');
    if (pick) {
      const id = String(pick.dataset.pick || '');
      if (!id) return;
      const set = new Set(Views.projState.picked || []);
      if (ev.shiftKey && lastPickId && lastPickId !== id) {
        const visible = Views.mineVisibleIds(state);
        const a = visible.indexOf(lastPickId);
        const b = visible.indexOf(id);
        if (a >= 0 && b >= 0) {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          for (let i = lo; i <= hi; i++) {
            if (pick.checked) set.add(visible[i]); else set.delete(visible[i]);
          }
          Views.projState.picked = [...set];
          lastPickId = id;
          syncPicks();
          return;
        }
      }
      if (pick.checked) set.add(id); else set.delete(id);
      Views.projState.picked = [...set];
      lastPickId = id;
      syncPicks();
      return;
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

      // ---- 我发布的：行内两步确认 / 批量两步确认 / 取消选择 / 停止 / 清除筛选 ----
      if (kind === 'proj-del') {
        const id = String(act.dataset.id || '');
        const name = act.dataset.name || '';
        if (!/^\d+$/.test(id)) return;
        /* 两步确认：第一次点击把按钮变成「确认删除」（3 秒复原），第二次才真删。
           不用 window.confirm：它挡住整页、和批量条/键盘流程都打架，还不可样式化。 */
        if (act.dataset.armed !== '1') {
          act.dataset.armed = '1';
          act.dataset.label = act.textContent;
          act.textContent = t('proj.delConfirmInline');
          act.setAttribute('aria-label', t('proj.delConfirmInline') + (name ? ' ' + name : ''));
          setTimeout(() => {
            if (!act.isConnected || act.dataset.armed !== '1') return;
            act.dataset.armed = '0';
            act.textContent = act.dataset.label || t('proj.del');
            act.removeAttribute('aria-label');
          }, 3000);
          return;
        }
        act.dataset.armed = '0';
        deleteProjects([id], { single: true });
        return;
      }
      if (kind === 'proj-del-picked') { enterConfirm(); return; }
      if (kind === 'proj-del-back') { exitConfirm(); return; }
      if (kind === 'proj-del-confirm') {
        if (!Views.projState.confirm) return;
        const ids = (Views.projState.picked || []).slice();
        exitConfirm();   // 先退出确认态，再开始删除（进度由 deleteProjects 接管）
        deleteProjects(ids);
        return;
      }
      if (kind === 'proj-del-stop') {
        if (!deletingProjects || deletingStop) return;
        deletingStop = true;
        act.disabled = true;   // 当前项返回前先按掉，避免连点
        return;
      }
      if (kind === 'proj-picknone') {
        if (Views.projState.confirm) exitConfirm();
        Views.projState.picked = [];
        lastPickId = '';
        syncPicks();
        return;
      }
      if (kind === 'proj-clear-filters') {
        Views.projState.q = '';
        Views.projState.filter = 'all';
        render();
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
        /* 确认文案一直存在 data-confirm 上，但旧实现只做了「再点一次」的 arm ——
           用户看不到「离开会怎样」。改成原生对话框：文案一次说清，取消是默认焦点。
           危险动作（解散 / 退出 / 移除）用红色确认键；接受申请这类可逆操作直接执行。 */
        const danger = /disband|leave|remove/.test(act.dataset.teamAct || '');
        const go = () => {
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
        };
        if (act.dataset.confirm) {
          UI.confirmBox({ body: act.dataset.confirm, danger }).then((ok) => { if (ok) go(); });
          return;
        }
        go();
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
      if (!del.dataset.del) return;   // 站点给不出动作地址时不发空 POST（会打到当前页）
      /* 事件回调不能 await：确认框返回 Promise，用 then 串起"确认后才发请求" */
      if (del.dataset.confirm) {
        const url = del.dataset.del;
        UI.confirmBox({ body: del.dataset.confirm, danger: true })
          .then((ok) => { if (ok) submit(() => Api.post(url)); });
        return;
      }
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
    if (f) {
      Views.projState.filter = f.dataset.f;
      Views.projState.picked = [];   // 筛选变了，原来选中的行可能已经不在表里
      Views.projState.confirm = false;
      render();
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
      Views.projState.picked = [];   // 换数据源 = 换选中集（这些 id 在另一张表上未必存在）
      Views.projState.confirm = false;
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
      Views.projState.picked = [];   // 搜索词变了同理：选中项可能已经看不见
      Views.projState.confirm = false;
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
    /* 删除中不许换页（导航点击、应用内跳转都走这里）：串行 POST 丢在半路会说不清删到哪 */
    if (deletingProjects) { toast(t('account.saving')); return; }
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
