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