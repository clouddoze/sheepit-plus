// 开发工具（不参与交付）：直接读夹具，算出"站点自己说的数字"，
// 供后面和界面渲染出来的数字逐项对照。这是独立于浏览器的一次交叉校验。
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = process.env.SP_FIXTURES || join(dirname(HERE), '.tmp', 'fixtures', 'raw');
const raw = (n) => readFileSync(join(RAW, n), 'utf8');

const p = raw(process.env.SP_PROFILE_FIXTURE || '_user_profile.html');

/* dl.dl-horizontal 的 dt/dd 对 */
const dl = p.match(/<dl[^>]*dl-horizontal[^>]*>([\s\S]*?)<\/dl>/);
const stats = {};
if (dl) {
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let m;
  while ((m = re.exec(dl[1]))) stats[m[1].replace(/<[^>]+>/g, '').trim()] = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
console.log('=== dl 统计 ===');
for (const [k, v] of Object.entries(stats)) console.log(`  ${k} = ${v}`);

/* 内联数组 */
function arr(name) {
  const i = p.indexOf('var ' + name);
  if (i < 0) return null;
  const s = p.indexOf('[', i), e = p.indexOf('];', s);
  let body = p.slice(s, e + 1).replace(/,\s*\]$/, ']');
  return JSON.parse(body.replace(/'/g, '"'));
}
for (const name of ['line_points_timeline', 'line_frames_timeline', 'line_frames_timeline_2']) {
  const a = arr(name);
  if (!a) { console.log(`\n=== ${name} === 缺失`); continue; }
  const rows = a.slice(1);
  const vals = rows.map((r) => Number(r[1]));
  const mono = vals.every((v, i) => i === 0 || v >= vals[i - 1]);
  console.log(`\n=== ${name} === ${rows.length} 行, ${rows[0][0]} → ${rows[rows.length - 1][0]}, 单调递增=${mono}`);
  console.log(`  first=${rows[0][1]} last=${rows[rows.length - 1][1]} min=${Math.min(...vals)} max=${Math.max(...vals)}`);
  console.log(`  样例: ${JSON.stringify(rows.slice(0, 3))} ... ${JSON.stringify(rows.slice(-2))}`);
}

/* 逐日差分（与 50-views.js 的 dailySeries 同口径） */
const fr = arr('line_frames_timeline');
if (fr) {
  const rows = fr.slice(1).map((r) => ({ d: String(r[0]), v: Number(r[1]) }));
  const at = new Map(rows.map((r) => [r.d, r.v]));
  const dk = (d) => d.toISOString().slice(0, 10);
  const shift = (k, n) => { const x = new Date(k + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return dk(x); };
  const daily = [];
  let prev = null;
  for (let d = rows[0].d, g = 0; d <= rows[rows.length - 1].d && g < 20000; d = shift(d, 1), g++) {
    const v = at.has(d) ? at.get(d) : prev;
    if (prev !== null) daily.push({ d, v: Math.max(0, v - prev) });
    prev = v;
  }
  const tot = daily.reduce((a, b) => a + b.v, 0);
  const nz = daily.filter((x) => x.v > 0);
  console.log(`\n=== 逐日差分 === ${daily.length} 天, 非零 ${nz.length} 天`);
  console.log(`  合计 ${tot.toLocaleString('en-US')} 帧 · 日均 ${Math.round(tot / daily.length).toLocaleString('en-US')} · 峰值 ${Math.max(...daily.map((x) => x.v)).toLocaleString('en-US')}`);
  console.log(`  区间 ${daily[0].d} → ${daily[daily.length - 1].d}`);
}

/* 活跃日历 */
const anchor = p.indexOf('consecutive-render-heatmap');
const mm = p.slice(Math.max(0, anchor)).match(/var\s+data\s*=\s*\[([\s\S]*?)\];/);
if (mm) {
  // 站点写的是 JS 字面量：单引号 + **不带引号的键**（{date:"...", count: 1}）。
  // 直接 JSON.parse 会炸 —— 两步归一化（和 src/20-api.js 的 extractArray 同一套）。
  const items = JSON.parse('[' + mm[1]
    .replace(/'/g, '"')
    .replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,\s*$/, '') + ']');
  const counts = [...new Set(items.map((x) => x.count))];
  console.log(`\n=== 活跃日历 === ${items.length} 天, count 取值集合 = ${JSON.stringify(counts)}`);
  console.log(`  ${items[0].date} → ${items[items.length - 1].date}`);
}

/* 项目页 */
const pj = raw('_home_projects.html');
console.log(`\n=== 项目页 === tr[data-project_id] 行数 = ${(pj.match(/data-project_id=/g) || []).length}`);
const rk = raw('_ranking_user.html');
const rkRows = [...rk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].filter((m) => /data-sort/.test(m[1])).length;
console.log(`=== 排行榜 === 含 data-sort 的行数 = ${rkRows}`);
const hm = raw('_home.html');
console.log(`=== 首页 === stat-box = ${(hm.match(/stat-box/g) || []).length}, w-box = ${(hm.match(/w-box/g) || []).length}, news 链接 = ${(hm.match(/href="\/news\//g) || []).length}`);

/* 会话页：独立于浏览器的一次对账 —— 解析器读到的每个键值，这里用正则再从原文里抠一遍 */
const se = raw('session.html');
console.log('\n=== 会话页 ===');
const info = se.slice(se.indexOf('Session information'), se.indexOf('<h1>Timeline</h1>'));
const pairs = [...info.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)]
  .map((m) => [m[1].replace(/<[^>]+>/g, '').trim(), m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()]);
for (const [k, v] of pairs) console.log(`  ${k} = ${v || '(空)'}`);
console.log(`  键值对 ${pairs.length} 项`);
const keyM = info.match(/html\('([^']+)'\)/);
console.log(`  渲染密钥 ${keyM ? keyM[1].length + ' 位' : '未找到'}`);
const actM = info.match(/requestReloadOnSuccess\('([^']+)'/);
console.log(`  动作地址 ${actM ? actM[1] : '未找到'}（最后一段是"点下去要变成的状态"）`);
const tlm = se.match(/url:\s*'([^']*\/timeline[^']*)'/);
console.log(`  时间线地址（页面内联脚本）${tlm ? tlm[1] : '未找到'}`);
const prj = se.slice(se.indexOf('Renderable projects'));
const prjRows = [...prj.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()))
  .filter((r) => r.length >= 1 && r[0]);
console.log(`  可渲染项目 ${prjRows.length} 行`);
const reasons = {};
for (const r of prjRows) reasons[r[1] || '(无原因)'] = (reasons[r[1] || '(无原因)'] || 0) + 1;
for (const [k, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${n} × ${k}`);

const tl = JSON.parse(raw('session-timeline.json'));
const cnt = {};
for (const r of tl) cnt[r[0]] = (cnt[r[0]] || 0) + 1;
const ms = tl.map((r) => r[2]).sort((a, b) => a - b);
console.log(`  时间线 ${tl.length} 条 · ${JSON.stringify(cnt)}`);
console.log(`  区间 ${new Date(ms[0]).toISOString()} → ${new Date(ms[ms.length - 1]).toISOString()}`);
