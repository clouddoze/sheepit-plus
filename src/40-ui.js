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
    heart: '<path d="M12 20.3l-1.4-1.3C5.4 14.4 2 11.3 2 7.5 2 4.4 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1C13.1 2.8 14.8 2 16.5 2 19.6 2 22 4.4 22 7.5c0 3.8-3.4 6.9-8.6 11.5L12 20.3z"/>',
    ban: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2"/>',
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
