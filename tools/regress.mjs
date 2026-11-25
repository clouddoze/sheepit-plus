#!/usr/bin/env node
/**
 * 回归门：静态账 + 页面数据 + 空态/错误态。
 *
 * 用法：
 *   node tools/regress.mjs            # 只读比对 tools/regress-baseline.json
 *   node tools/regress.mjs --update   # 重新测量并写回基线（唯一的写路径）
 *
 * 门槛与 docs/ROADMAP.md 的「基线」节对齐；页面数据由 tools/harness.mjs 回放夹具。
 * 不引入依赖；执行层复用 tools/rig.mjs（2026-11-12 从 .tmp/rig.mjs 迁入）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { measurePage, startHarness, startChrome, openCdp, BASE } from './rig.mjs';
import { countCommentBytes } from './comment-bytes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist', 'sheepit-plus.user.js');
const BASELINE = join(HERE, 'regress-baseline.json');
const UPDATE = process.argv.includes('--update');

if (!existsSync(DIST)) {
  console.error('× 没有 dist 产物：先跑 node build.mjs');
  process.exit(2);
}
if (!UPDATE && !existsSync(BASELINE)) {
  console.error('× 没有基线：先跑 node tools/regress.mjs --update');
  process.exit(2);
}

/* 每页只取这条断言需要的字段；ready 条件与 .tmp/run-matrix.mjs 的 6 页一致。 */
const CASES = [
  {
    key: 'overview', path: '/home',
    ready: 'SP.app.state.profile !== null && SP.app.state.loading === false',
    extra: '(function(){var s=SP.app.state;return {stats:Object.keys(s.profile.stats||{}).length,points:(s.profile.points||[]).length,activity:(s.profile.activity||[]).length};})()',
  },
  {
    key: 'projects', path: '/home/projects',
    ready: 'SP.app.state.projects !== null && SP.app.state.loading === false',
    extra: '(function(){var s=SP.app.state;return {projects:(s.projects||[]).length,rows:document.querySelectorAll("#sp .tbl tbody tr").length};})()',
  },
  {
    key: 'ranking', path: '/ranking/user',
    ready: 'SP.app.state.ranking !== null && SP.app.state.loading === false',
    extra: '(function(){var s=SP.app.state;return {ranking:(s.ranking||[]).length,rows:document.querySelectorAll("#sp .tbl tbody tr").length};})()',
  },
  {
    key: 'session', path: '/session/12345',
    ready: 'SP.app.state.session !== null && SP.app.state.session.timeline !== undefined && SP.app.state.loading === false',
    extra: '(function(){var s=SP.app.state;return {timeline:(s.session.timeline||[]).length,actrows:document.querySelectorAll("#sp .actrow").length};})()',
  },
  {
    key: 'empty', path: '/home?variant=empty',
    ready: 'SP.app.state.profile !== null && SP.app.state.loading === false',
    extra: '(function(){var b=document.getElementById("sp-body");return {empty:!!document.querySelector("#sp .empty"),kpis:document.querySelectorAll("#sp .kpi").length,bodyHasRealFrames:!!b&&b.textContent.indexOf("952,825")>=0};})()',
  },
  {
    key: 'teams', path: '/team',
    ready: 'SP.app.state.teams !== null && SP.app.state.teams.length > 0 && SP.app.state.loading === false && document.querySelectorAll("#sp .tbl-teams tbody tr").length > 0',
    extra: '(function(){var s=SP.app.state;return {teams:s.teams.length,rows:document.querySelectorAll("#sp .tbl-teams tbody tr").length,myTeam:!!s.myTeam};})()',
  },
  {
    key: 'team', path: '/team/2109',
    ready: 'SP.app.state.team !== null && SP.app.state.loading === false',
    extra: '(function(){var s=SP.app.state;return {members:s.team.members.length,rows:document.querySelectorAll("#sp .tbl-team tbody tr").length,rendering:s.team.members.filter(function(m){return m.rendering;}).length,hasLastFrame:s.team.hasLastFrame,hasRemove:s.team.hasRemove};})()',
  },
  {
    key: 'teamown', path: '/team/2542',
    ready: 'SP.app.state.team !== null && SP.app.state.loading === false && document.querySelectorAll("#sp .tbl-team tbody tr").length > 0',
    extra: '(function(){var s=SP.app.state;return {members:s.team.members.length,hasLastFrame:s.team.hasLastFrame,hasRemove:s.team.hasRemove,leave:!!s.team.leaveUrl,del:!!s.team.deleteUrl,btns:document.querySelectorAll("#sp [data-team-act]").length};})()',
  },
  {
    /* 账户设置：/user/<x>/edit 走 edit.html 夹具。夹具里的优先级名单是空的（只有"添加"输入框），
       所以 ready 不能像 teams 那样等行 —— 等账户面板真的画出来：三个标签按钮 + 名单容器。
       只等 state.account 会拿到 #sp-body 还是空壳的那一帧。 */
    key: 'account', path: '/user/test-user/edit',
    ready: 'SP.app.state.account !== null && SP.app.state.loading === false && document.querySelectorAll("#sp-acct-tabs [data-tab]").length === 3 && !!document.getElementById("sp-prio-list")',
    extra: '(function(){var s=SP.app.state;return {acctKeys:Object.keys(s.account).length,tabBtns:document.querySelectorAll("#sp-acct-tabs [data-tab]").length,prioRows:document.querySelectorAll("#sp-prio-list [data-prio-row]").length,prioBox:!!document.getElementById("sp-prio-list"),prioNone:!!document.querySelector("#sp-prio-list .none"),hasSort:!!SP.Views.projState&&typeof SP.Views.projState.sort==="string",sortVal:(SP.Views.projState||{}).sort};})()',
  },
    {
    key: 'settings', path: '/user/test-user/edit#/settings',
    ready: 'SP.app.state.view === "settings" && !!document.querySelector("#sp .settings") && document.querySelectorAll("#sp .settings .row").length > 0',
    extra: '(function(){var s=SP.app.state;return {rows:document.querySelectorAll("#sp .settings .row").length,themeBtns:document.querySelectorAll("#sp-theme [data-v]").length,ovRows:document.querySelectorAll("#sp .ovlist .ovrow").length};})()',
  },
  {
    key: 'live', path: '/home/frames',
    ready: 'SP.app.state.view === "live" && !!SP.app.state.live && document.querySelectorAll("#sp .kpis .kpi").length === 4 && document.querySelectorAll("#sp .chart svg").length === 2',
    extra: '(function(){var d=SP.app.state.live;return {frames:d.frames.length,machines:(d.machines.active||[]).length+paused((d.machines.paused||[]).length),kpis:document.querySelectorAll("#sp .kpis .kpi").length,charts:document.querySelectorAll("#sp .chart svg").length,drows:document.querySelectorAll("#sp .lrow").length,rows:document.querySelectorAll("#sp .tbl tbody tr").length};function paused(n){return n;}})()',
  },
  {
    key: 'livemach', path: '/home/machines',
    ready: 'SP.app.state.view === "live" && !!SP.app.state.live && document.querySelectorAll("#sp-live-tab [data-l]").length === 2',
    extra: '(function(){var d=SP.app.state.live;return {frames:d.frames.length,machines:(d.machines.active||[]).length,charts:document.querySelectorAll("#sp .chart svg").length};})()',
  },
  {
    key: 'machrank', path: '/ranking/machine',
    ready: 'SP.app.state.view === "ranking" && !!document.querySelector("#sp-rank-tab") && document.querySelectorAll("#sp .tbl tbody tr").length > 0',
    extra: '(function(){var s=SP.app.state;return {tab:SP.Views.rankState.tab,rows:document.querySelectorAll("#sp .tbl tbody tr").length,hasSeg:!!document.querySelector("#sp-mach")};})()',
  },
  {
    key: 'fail', path: '/home?fail=1',
    ready: 'SP.app.state.loading === false && !!SP.app.state.error',
    extra: '(function(){var s=SP.app.state;return {error:String(s.error||""),hasRetry:!!document.querySelector("#sp-retry"),empty:!!document.querySelector("#sp .empty")};})()',
  },
];

const EQUAL = [
  'artifact.bytes', 'artifact.comments', 'artifact.srcBytes', 'artifact.literalCalls',
  'pages.overview.stats', 'pages.overview.points', 'pages.overview.activity',
  'pages.projects.projects', 'pages.projects.rows',
  'pages.ranking.ranking', 'pages.ranking.rows',
  'pages.teams.teams', 'pages.teams.rows',
  'pages.team.members', 'pages.team.rows', 'pages.team.rendering',
  'pages.teamown.members', 'pages.teamown.btns',
  'pages.settings.rows', 'pages.settings.themeBtns', 'pages.settings.ovRows',
  'pages.live.frames', 'pages.live.kpis', 'pages.live.charts', 'pages.live.lrows', 'pages.live.rows',
  'pages.livemach.frames', 'pages.livemach.machines', 'pages.livemach.charts',
  'pages.machrank.tab', 'pages.machrank.rows', 'pages.machrank.hasSeg',
  'pages.account.acctKeys', 'pages.account.tabBtns', 'pages.account.prioRows',
  'pages.account.prioBox', 'pages.account.prioNone',
  'pages.account.hasSort', 'pages.account.sortVal',
  'pages.session.timeline', 'pages.session.actrows',
  'pages.empty.empty', 'pages.empty.kpis', 'pages.empty.bodyHasRealFrames',
  'pages.fail.hasRetry', 'pages.fail.empty',
];

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function staticFacts() {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
  const srcBytes = files.reduce((n, f) => n + statSync(join(SRC, f)).size, 0);
  /* 口径与 build.mjs 一致：30-style.js 的模板串里装的是 CSS，要按 CSS 口径剥注释 */
  const comments = files.reduce((n, f) => n
    + countCommentBytes(readFileSync(join(SRC, f), 'utf8'), { stripTemplate: f === '30-style.js' }).commentBytes, 0);
  /* 空态行必须是函数调用；写成 `emptyRow(...)` 字面量会原样渲染给用户（2026-11-23 线上实报）。
     这里只数反引号紧跟 emptyRow( 的形态，定义处 const emptyRow = (...) 不会命中。 */
  const literalCalls = files.reduce((n, f) => n
    + (readFileSync(join(SRC, f), 'utf8').match(/`emptyRow\(/g) || []).length, 0);
  return { bytes: statSync(DIST).size, comments, srcBytes, literalCalls };
}

/* 空态设 spvariant、失败态设 spfail，都是 harness 的 cookie 注入；切场景前在页面里清掉。
   不走 Network.clearBrowserCookies：这个 Chrome 版本不认（2026-11-12 实测）。 */
async function wipeCookies(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: BASE + '/__lab' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await sleep(500);
  await cdp.send('Runtime.evaluate', {
    expression: "document.cookie='spfail=; Max-Age=0; path=/';document.cookie='spvariant=; Max-Age=0; path=/';",
  }, sessionId);
  await cdp.send('Target.closeTarget', { targetId });
}

async function measureAll() {
  const artifact = staticFacts();
  const harness = await startHarness();
  const chrome = await startChrome();
  const pages = {};
  try {
    const cdp = await openCdp();
    for (const c of CASES) {
      if (c.key === 'fail') await wipeCookies(cdp);
      const r = await measurePage(cdp, c.path, c.ready, c.key, c.extra);
      if (!r.ready) throw new Error(`${c.key} 20s 内未就绪（${c.path}）`);
      pages[c.key] = r.extra;
    }
    cdp.close();
  } finally {
    chrome.cleanup();
    harness.proc.kill();
  }
  return { artifact, pages };
}

function makeBaseline(now) {
  const fail = now.pages.fail;
  return {
    note: 'node tools/regress.mjs --update 生成；默认跑只读比对，不写文件。',
    when: new Date().toISOString(),
    artifact: now.artifact,
    pages: {
      overview: now.pages.overview,
      projects: now.pages.projects,
      ranking: now.pages.ranking,
      session: now.pages.session,
      teams: now.pages.teams,
      team: now.pages.team,
      teamown: now.pages.teamown,
      settings: now.pages.settings,
      live: now.pages.live,
      livemach: now.pages.livemach,
      machrank: now.pages.machrank,
      account: now.pages.account,
      empty: now.pages.empty,
      fail: { errorIncludes: 'HTTP 500', hasRetry: fail.hasRetry, empty: fail.empty },
    },
  };
}

function compare(base, now) {
  const rows = [];
  const add = (path, exp, got, ok) => rows.push({ path, exp, got, ok });
  for (const path of EQUAL) {
    const exp = get(base, path);
    const got = get(now, path);
    add(path, exp, got, exp === got);
  }
  const expErr = base.pages.fail.errorIncludes;
  const gotErr = now.pages.fail.error;
  add('fail.errorIncludes', expErr, gotErr, String(gotErr || '').indexOf(expErr) >= 0);
  return rows;
}

function fmt(v) {
  if (typeof v === 'string') return v;
  return String(v);
}

const rows = UPDATE ? null : compare(
  JSON.parse(readFileSync(BASELINE, 'utf8')),
  await measureAll(),
);

if (UPDATE) {
  const now = await measureAll();
  writeFileSync(BASELINE, JSON.stringify(makeBaseline(now), null, 2) + '\n');
  console.log('✔ 基线已更新：' + BASELINE);
  console.log('  artifact  ' + now.artifact.bytes + ' 字节 / 注释 ' + now.artifact.comments + ' / 源码 ' + now.artifact.srcBytes);
  for (const [k, v] of Object.entries(now.pages)) console.log('  ' + k + ': ' + JSON.stringify(v));
  process.exit(0);
}

console.log('SheepIt Plus · regress  (' + BASELINE + ')');
let pass = 0;
let fail = 0;
for (const r of rows) {
  if (r.ok) { pass++; console.log('  ✔ ' + r.path.padEnd(26) + ' ' + fmt(r.got)); }
  else { fail++; console.log('  ✘ ' + r.path.padEnd(26) + ' 期望 ' + fmt(r.exp) + ' / 实际 ' + fmt(r.got)); }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
