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
  const { esc, fmt, foot, moreRow, pageSize } = SP.VK;

  const liveState = { tab: 'frames', q: '', limit: pageSize(), mq: '' };

  /* 占比用**一条堆叠条 + 图例**：横向条每项单独一条时，"占总多少"要靠心算，
     截图里名字还被 190px 截断。堆叠条一行就看完整分布，图例写全名字和百分比。 */
  const SHADES = [1, 0.88, 0.76, 0.64, 0.53, 0.43, 0.34, 0.26];
  const shade = (i) => (i < SHADES.length
    ? `color-mix(in srgb, var(--accent) ${Math.round(SHADES[i] * 100)}%, var(--surface-3))`
    : 'var(--text-3)');

  function stackBar(entries, total) {
    const sum = total || entries.reduce((n, x) => n + x.v, 0) || 1;
    return `<div class="stack">${entries.map((x, i) => `<i style="width:${(x.v / sum * 100).toFixed(2)}%;background:${x.other ? 'var(--text-3)' : shade(i)}" title="${esc(x.d)}: ${fmt(x.v)}"></i>`).join('')}</div>`;
  }

  function legend(entries, total) {
    const sum = total || entries.reduce((n, x) => n + x.v, 0) || 1;
    return `<div class="llegend">${entries.map((x, i) => `<div class="lrow">
        <span class="sw" style="background:${x.other ? 'var(--text-3)' : shade(i)}"></span>
        <span class="ln" title="${esc(x.d)}">${esc(x.d)}</span>
        <span class="lv num">${fmt(x.v)}</span>
        <span class="lp num">${Math.round(x.v / sum * 100)}%</span>
      </div>`).join('')}</div>`;
  }

  function distPanel(title, sub, list, top) {
    const items = (list || []).filter((x) => x.v > 0);
    if (!items.length) return '';
    const shown = items.slice(0, top);
    const rest = items.slice(top);
    const restV = rest.reduce((n, x) => n + x.v, 0);
    const entries = shown.map((x) => ({ d: x.d, v: x.v }));
    if (restV) entries.push({ d: t('live.dist.other', { n: rest.length }), v: restV, other: true });
    return `<div class="panel" style="padding:14px 20px 16px">
      <div class="phead"><h2>${esc(title)}</h2><span class="sub">${esc(sub)}</span></div>
      ${stackBar(entries)}
      ${legend(entries)}
    </div>`;
  }

  function pairPanel(title, sub, list) {
    const items = (list || []).filter((x) => x.v > 0);
    if (!items.length) return '';
    const entries = items.map((x) => ({ d: x.d, v: x.v }));
    return `<div class="panel" style="padding:14px 20px 16px">
      <div class="phead"><h2>${esc(title)}</h2><span class="sub">${esc(sub)}</span></div>
      ${stackBar(entries)}
      ${legend(entries)}
    </div>`;
  }

  function framesTab(state) {
    const d = state.live || {};
    const all = (d.frames || []).filter((r) => {
      const q = liveState.q.trim().toLowerCase();
      return !q || String(r.project).toLowerCase().includes(q) || String(r.user).toLowerCase().includes(q) || String(r.machine).toLowerCase().includes(q);
    });
    const body = all.length ? all.slice(0, liveState.limit).map((r) => `<tr>
        <td><div class="pn" title="${esc(r.project)}">${esc(r.project)}</div></td>
        <td class="r num">${esc(r.frame)}</td>
        <td>${r.userId ? `<a class="nm" href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}</td>
        <td class="r num">${esc(r.waited || '—')}</td>
        <td class="r num">${esc(r.eta || '—')}</td>
        <td>${esc(r.remaining || '—')}</td>
        <td class="num">${esc(r.machine || '—')}</td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="state" style="padding:36px 12px"><div class="small">${esc(t('live.none'))}</div></div></td></tr>`;
    return `<div class="toolbar">
        <label class="input">${UI.icon('search')}<input id="sp-lq" type="search" placeholder="${esc(t('live.searchFrames'))}" value="${esc(liveState.q)}"></label>
        <span class="sub num">${esc(t('live.showing', { n: Math.min(all.length, liveState.limit), total: all.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr><th>${esc(t('live.col.project'))}</th><th class="r">${esc(t('live.col.frame'))}</th>
            <th>${esc(t('live.col.user'))}</th><th class="r">${esc(t('live.col.waited'))}</th>
            <th class="r">${esc(t('live.col.eta'))}</th><th class="r">${esc(t('live.col.remaining'))}</th>
            <th>${esc(t('live.col.machine'))}</th></tr></thead>
          <tbody>${body}</tbody></table></div>
        ${moreRow(Math.min(all.length, liveState.limit), all.length, 100)}
      </div>`;
  }

  function machinesTab(state) {
    const d = state.live || {};
    const m = d.machines || {};
    const all = [...(m.active || []), ...(m.paused || [])].filter((r) => {
      const q = liveState.mq.trim().toLowerCase();
      return !q || String(r.model).toLowerCase().includes(q) || String(r.user).toLowerCase().includes(q);
    });
    const body = all.length ? all.slice(0, liveState.limit).map((r) => `<tr class="${r.active ? '' : 'dim'}">
        <td><div class="pn" title="${esc(r.model)}">${esc(r.model)}</div></td>
        <td class="r num">${esc(r.memory || '—')}</td>
        <td class="r num">${esc(r.frames || '—')}</td>
        <td class="r num">${esc(r.heartbeat || '—')}</td>
        <td class="r num">${esc(r.elapsed || '—')}</td>
        <td>${r.userId ? `<a class="nm" href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}</td>
      </tr>`).join('') : `<tr><td colspan="6"><div class="state" style="padding:36px 12px"><div class="small">${esc(t('live.none'))}</div></div></td></tr>`;
    return `<div class="toolbar">
        <label class="input">${UI.icon('search')}<input id="sp-lmq" type="search" placeholder="${esc(t('live.searchMachines'))}" value="${esc(liveState.mq)}"></label>
        <span class="sub num">${esc(t('live.showing', { n: Math.min(all.length, liveState.limit), total: all.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap"><table class="tbl">
          <thead><tr><th>${esc(t('live.col.model'))}</th><th class="r">${esc(t('live.col.memory'))}</th>
            <th class="r">${esc(t('live.col.frames'))}</th><th class="r">${esc(t('live.col.heartbeat'))}</th>
            <th class="r">${esc(t('live.col.elapsed'))}</th><th>${esc(t('live.col.user'))}</th></tr></thead>
          <tbody>${body}</tbody></table></div>
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

    const chartPanel = (id, title, sub) => `<div class="panel" style="padding:14px 20px 6px">
        <div class="phead"><h2>${esc(title)}</h2><span class="sub">${esc(sub)}</span></div>
        <div class="chart" id="${id}"><div class="tip"></div></div>
      </div>`;

    const trend = `<div class="grid2">
      ${chartPanel('sp-live-frames', t('live.trend.frames'), t('live.trend.framesSub'))}
      ${chartPanel('sp-live-machines', t('live.trend.machines'), t('live.trend.machinesSub'))}
    </div>`;

    const comp = `<div class="grid2">
      ${distPanel(t('live.dist.projects'), t('live.dist.projectsSub'), ch.projectDist, 8)}
      <div class="grid2" style="grid-template-columns:1fr;gap:16px;margin:0">
        ${pairPanel(t('live.dist.os'), t('live.dist.osSub'), ch.os)}
        ${pairPanel(t('live.dist.device'), t('live.dist.deviceSub'), ch.device)}
      </div>
    </div>`;

    const tabBar = `<div class="seg" id="sp-live-tab">
      <button data-l="frames" aria-pressed="${liveState.tab === 'frames'}">${esc(t('live.tab.frames'))}
        <span class="num">${(d.frames || []).length}</span></button>
      <button data-l="machines" aria-pressed="${liveState.tab === 'machines'}">${esc(t('live.tab.machines'))}
        <span class="num">${nActive + nPaused}</span></button>
    </div>`;

    const detail = `<div class="sechead"><h2>${esc(t('live.detail'))}</h2>
        <span class="sub">${esc(t('live.detailSub'))}</span></div>
      ${tabBar}
      ${liveState.tab === 'machines' ? machinesTab(state) : framesTab(state)}
      ${foot()}`;

    /* 折线要等 DOM 落地才能量宽度：放到微任务里画。 */
    queueMicrotask(() => {
      const b1 = document.getElementById('sp-live-frames');
      const b2 = document.getElementById('sp-live-machines');
      if (b1 && ch.framesByDay && ch.framesByDay.length > 1) SP.Charts.points(b1, ch.framesByDay, { unit: t('live.unit.frames') });
      if (b2 && ch.machinesByDay && ch.machinesByDay.length > 1) SP.Charts.points(b2, ch.machinesByDay, { unit: t('live.unit.machines') });
    });

    return `<div class="sechead"><h2>${esc(t('live.title'))}</h2>
        <span class="sub">${esc(t('live.sub'))}</span></div>
      ${kpi}${trend}${comp}${detail}`;
  }

  /* 自己的委托：tab 切换 + 两个搜索框（和排行榜同一套写法，不塞进 80-app 的事件表）。 */
  document.addEventListener('click', (ev) => {
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

  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { live, liveState });
})();
