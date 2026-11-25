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
