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
      /* 「我发布的」：数据来自个人主页那张表，没有设备/内存可筛，所以那一档只放状态筛 */
      'proj.scope.all': '全部', 'proj.scope.mine': '我发布的',
      'proj.searchMine': '搜索我发布的…', 'proj.col.manage': '操作',
      'proj.status.finished': '已完成', 'proj.status.blocked': '已被站点封禁',
      'my.title': '我的项目', 'my.count': '共 {n} 个', 'my.all': '看全部',
      'my.open': '项目设置',
      'my.empty': '你还没有发布过项目',
      'my.emptyCta': '上传一个项目',
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
      /* 设置区自绘：三行开关 + 一行危险动作，动作直发站点端点（见 80-app.js 的 mgSet） */
      'mg.ops': '项目设置', 'mg.opsSub': '这些开关直接提交到站点自己的接口，和你原来在这一页点它们是一回事。',
      'mg.compute': '计算方式', 'mg.computeHint': 'CPU 与 GPU 二选一。GPU 不支持站点的全部渲染特性，结果可能有差异。',
      'mg.mp4': '生成 MP4 视频', 'mg.mp4Hint': '把渲染好的帧打成一段 MP4。很吃服务器资源，真需要再开。',
      'mg.public': '公开渲染', 'mg.publicHint': '关掉之后，只有「渲染者」名单里的人与团队能渲染这个项目。',
      'mg.del': '删除项目', 'mg.delHint': '不可撤销：项目与已渲染的帧会一起消失。',
      'mg.delConfirm': '确定删除这个项目吗？删了就回不来了。',
      /* 项目管理页整页自绘：动作行 / 名单 / 概要 / 帧。站点没渲染的那几项不画。 */
      'mg.noId': '地址里没有项目编号', 'mg.noData': '站点没有给出这一页的项目数据（站点改版了，或者你没有权限）',
      'mg.act.frames': '查看帧图像', 'mg.act.zip': '下载帧图像', 'mg.act.video': '下载视频',
      'mg.act.pause': '暂停', 'mg.act.resume': '继续', 'mg.act.reset': '重置', 'mg.act.partial': '申请部分帧压缩包',
      'mg.act.disabled': '站点现在不允许这一步',
      'mg.partialConfirm': '申请部分帧压缩包会**自动暂停**这个项目；打包好之后站点会发邮件告诉你怎么下载。'
        + '收到之后要你自己把项目继续起来，而继续会销毁那份存档。确定要申请吗？',
      'mg.partialOk': '已提交申请，站点打包好会发邮件', 'mg.resetConfirm': '确定重置这个项目吗？（这是管理员动作）',
      'mg.summary': '概要', 'mg.frames': '帧', 'mg.framesN': '共 {n} 帧',
      'mg.legend.done': '已完成', 'mg.legend.progress': '进行中', 'mg.legend.waiting': '等待中',
      'mg.videoNote': '注意：这不是最终视频，而是降质缩略图。',
      'mg.acl.managers': '管理员', 'mg.acl.managersHint': '名单里的人可以改这个项目的设置。',
      'mg.acl.renderers': '渲染者', 'mg.acl.teams': '团队',
      'mg.acl.publicOn': '现在是「公开渲染」：所有成员都能渲染这个项目。',
      'mg.acl.publicOff': '现在只允许下面这些人（与团队）渲染。',
      'mg.acl.teamsHint': '团队必须从建议列表里选（站点要的是团队编号，不是名字）。',
      'mg.acl.add': '添加', 'mg.acl.remove': '移除', 'mg.acl.none': '名单还是空的',
      'mg.delBtn': '删除',
      'mg.acl.publicOnly': '现在是「公开渲染」：所有成员都能渲染这个项目，站点因此不渲染「渲染者名单」这一块。'
        + '把上面「项目设置」里的公开渲染关掉，名单与添加框才会出现在这里。',
      'mg.acl.needName': '先填一个名字', 'mg.acl.needPick': '请从建议列表里选一个团队',
      'mg.acl.delConfirm': '把「{name}」从这个名单里移除？',
      'mg.note': '这一页的设置、动作与名单全部由我们自绘，提交直发站点自己的接口 —— 和你原来在这一页点它们是一回事。',
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
      'proj.scope.all': 'All', 'proj.scope.mine': 'Published by me',
      'proj.searchMine': 'Search my projects…', 'proj.col.manage': 'Action',
      'proj.status.finished': 'Rendered', 'proj.status.blocked': 'Blocked by the site',
      'my.title': 'My projects', 'my.count': '{n} in total', 'my.all': 'See all',
      'my.open': 'Project settings',
      'my.empty': 'You have not published a project yet',
      'my.emptyCta': 'Upload a project',
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
      'mg.ops': 'Project settings', 'mg.opsSub': 'These switches POST to the site\u2019s own endpoints \u2014 the same thing the original page does.',
      'mg.compute': 'Compute method', 'mg.computeHint': 'CPU or GPU. Not every render feature is supported on GPU; results can differ.',
      'mg.mp4': 'Generate MP4 video', 'mg.mp4Hint': 'Pack the rendered frames into an MP4. Very heavy on the server \u2014 only if you really need it.',
      'mg.public': 'Renderable by all members', 'mg.publicHint': 'Turn it off and only the users and teams on your renderer list can render this project.',
      'mg.del': 'Delete project', 'mg.delHint': 'Cannot be undone: the project and its rendered frames go away.',
      'mg.delConfirm': 'Delete this project? It can NOT be undone.',
      'mg.noId': 'No project id in the URL', 'mg.noData': 'The site did not give project data for this page (layout changed, or you have no access)',
      'mg.act.frames': 'See frames', 'mg.act.zip': 'Download frames', 'mg.act.video': 'Download video',
      'mg.act.pause': 'Pause', 'mg.act.resume': 'Resume', 'mg.act.reset': 'Reset', 'mg.act.partial': 'Ask for a partial archive',
      'mg.act.disabled': 'The site does not allow this right now',
      'mg.partialConfirm': 'Asking for the partial archive will PAUSE this project; the site emails you download instructions. '
        + 'You have to resume the project yourself afterwards, and resuming destroys that archive. Ask for it?',
      'mg.partialOk': 'Requested \u2014 the site will email you when the archive is ready', 'mg.resetConfirm': 'Reset this project? (moderator action)',
      'mg.summary': 'Summary', 'mg.frames': 'Frames', 'mg.framesN': '{n} frames',
      'mg.legend.done': 'Finished', 'mg.legend.progress': 'In progress', 'mg.legend.waiting': 'Waiting',
      'mg.videoNote': 'Note: this is not the final video. It is a reduced thumbnail.',
      'mg.acl.managers': 'Managers', 'mg.acl.managersHint': 'People on this list can change this project\u2019s settings.',
      'mg.acl.renderers': 'Renderers', 'mg.acl.teams': 'Teams',
      'mg.acl.publicOn': 'Public rendering is on: every member can render this project.',
      'mg.acl.publicOff': 'Only the users and teams below can render it.',
      'mg.acl.teamsHint': 'Pick a team from the suggestions \u2014 the site wants the team id, not the name.',
      'mg.acl.add': 'Add', 'mg.acl.remove': 'Remove', 'mg.acl.none': 'The list is empty',
      'mg.delBtn': 'Delete',
      'mg.acl.publicOnly': 'Public rendering is on: every member can render this project, so the site does not render the renderer list at all. '
        + 'Turn public rendering off in Project settings above and the list (with its add box) appears here.',
      'mg.acl.needName': 'Type a name first', 'mg.acl.needPick': 'Pick a team from the suggestions',
      'mg.acl.delConfirm': 'Remove \u201c{name}\u201d from this list?',
      'mg.note': 'Settings, actions and lists on this page are all drawn by the extension and POST straight to the site\u2019s own endpoints \u2014 the same thing the original page does.',
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
