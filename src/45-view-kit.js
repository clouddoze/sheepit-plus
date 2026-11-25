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
