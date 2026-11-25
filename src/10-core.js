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
