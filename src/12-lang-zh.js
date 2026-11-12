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
