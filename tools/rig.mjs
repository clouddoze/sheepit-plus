// 验收执行层：起 harness + 无头 Chromium（CDP），逐页测量"导航→数据就绪"。
// 2026-11-12 从 .tmp/rig.mjs 迁入（逻辑未改）；唯一新增是 measurePage 的可选 extraExpr。
// 用法：node tools/regress.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = dirname(HERE);
const CHROME = process.env.SP_CHROME || 'C:/Users/user/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe';
const HARNESS_PORT = Number(process.env.SP_PORT || 8734);
export const BASE = `http://127.0.0.1:${HARNESS_PORT}`;
const CDP_PORT = Number(process.env.SP_CDP_PORT || 9444);
const RTT_MS = Number(process.env.SP_RTT || 400);      // 模拟公网 RTT
const DOWN_BPS = 12 * 1024 * 1024;                     // 12 MB/s 下行，别让大页面卡在带宽上

async function waitUrl(url, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return r; } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error('timeout waiting for ' + url);
}

export async function startHarness() {
  const p = spawn(process.execPath, [process.env.SP_HARNESS || join(HERE, 'harness.mjs')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(HARNESS_PORT) },
  });
  let log = '';
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  await waitUrl(BASE + '/__lab');
  return { proc: p, log: () => log };
}

export async function startChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'sp-cdp-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--hide-scrollbars', '--window-size=1400,1000',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  await waitUrl(`http://127.0.0.1:${CDP_PORT}/json/version`);
  return {
    proc,
    cleanup() { try { proc.kill(); } catch (e) {} try { rmSync(profile, { recursive: true, force: true }); } catch (e) {} },
  };
}

class CDP {
  constructor(url) { this.url = url; this.seq = 0; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = (e) => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(`${m.error.message}`));
        else p.resolve(m.result);
      } else {
        for (const cb of this.listeners.get(m.method) || []) cb(m.params, m.sessionId);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(method, cb) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(cb); }
  close() { try { this.ws.close(); } catch (e) {} }
}

export async function openCdp() {
  const info = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const cdp = new CDP(info.webSocketDebuggerUrl);
  await cdp.open();
  return cdp;
}

/** 打开一页，等到 readyExpr 为真，返回测量结果 */
export async function measurePage(cdp, path, readyExpr, label, extraExpr) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  const onErr = (params, sid) => {
    if (sid && sid !== sessionId) return;
    if (params?.exceptionDetails) {
      const d = params.exceptionDetails;
      errors.push('exception: ' + (d.exception?.description || d.text || '').split('\n')[0].slice(0, 300));
    }
  };
  cdp.on('Runtime.exceptionThrown', onErr);
  cdp.on('Log.entryAdded', (params, sid) => {
    if (sid && sid !== sessionId) return;
    const e = params?.entry;
    if (e && (e.level === 'error' || e.level === 'warning')) errors.push(`${e.level}: ${String(e.text).slice(0, 200)}`);
  });
  cdp.on('Runtime.consoleAPICalled', (params, sid) => {
    if (sid && sid !== sessionId) return;
    if (params?.type === 'error') errors.push('console.error: ' + (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'SP',{get:function(){return window.__SHEEPIT_PLUS__;},configurable:true});" }, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
  if (RTT_MS > 0) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: RTT_MS, downloadThroughput: DOWN_BPS, uploadThroughput: DOWN_BPS / 2,
      connectionType: 'wifi',
    }, sessionId);
  }
  const ev = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  };
  const t0 = Date.now();
  await cdp.send('Page.navigate', { url: BASE + path }, sessionId);
  /* 导航后先让旧文档卸掉：立刻 poll 可能读到上一个 case 的 window.SP，
     ready 误判为 true，随后新文档里 SP 还没创建 → 探针报 "reading 'app'"。 */
  await sleep(150);
  const deadline = Date.now() + 40000;
  let ready = false;
  while (Date.now() < deadline) {
    try { if (await ev(`(() => { try { return !!(${readyExpr}); } catch (e) { return false; } })()`)) { ready = true; break; } } catch (e) { /* 页面还在导航 */ }
    await sleep(80);
  }
  const ms = Date.now() - t0;
  await sleep(250);   // 让收尾的 render / 资源统计落定
  const snapshot = await ev(`(() => ({
    title: document.title,
    view: window.SP && SP.app ? SP.app.state.view : null,
    userName: window.SP && SP.app ? SP.app.state.userName : null,
    profile: window.SP && SP.app && SP.app.state.profile ? {
      name: SP.app.state.profile.name,
      stats: Object.keys(SP.app.state.profile.stats || {}).length,
      points: (SP.app.state.profile.points || []).length,
      frames: (SP.app.state.profile.frames || []).length,
      activity: (SP.app.state.profile.activity || []).length,
      machines: ((SP.app.state.profile.machines || {}).list || []).length,
      machineDetail: ((SP.app.state.profile.machines || {}).list || []).filter(m => m.detail).length,
      myProjects: (SP.app.state.profile.myProjects || []).length,
      avatar: SP.app.state.profile.avatar,
    } : null,
    projects: window.SP && SP.app && SP.app.state.projects ? SP.app.state.projects.length : null,
    ranking: window.SP && SP.app && SP.app.state.ranking ? SP.app.state.ranking.length : null,
    session: window.SP && SP.app && SP.app.state.session ? {
      hostname: SP.app.state.session.hostname,
      timeline: Array.isArray(SP.app.state.session.timeline) ? SP.app.state.session.timeline.length : SP.app.state.session.timeline,
      timelineFailed: !!SP.app.state.session.timelineFailed,
      projects: (SP.app.state.session.projects || []).length,
    } : null,
    account: window.SP && SP.app && SP.app.state.account ? {
      email: SP.app.state.account.email || SP.app.state.account.emailValue || null,
      keys: (SP.app.state.account.keys || []).length,
      priority: (SP.app.state.account.priority || []).length,
    } : null,
    domSpText: (document.getElementById('sp-body') || {}).textContent ? document.getElementById('sp-body').textContent.length : 0,
    rows: document.querySelectorAll('#sp .tbl tbody tr').length,
    kpis: document.querySelectorAll('#sp .kpi').length,
    empty: !!document.querySelector('#sp .empty'),
    spinner: !!document.querySelector('#sp .skel, #sp .skeleton'),
    spExists: !!document.getElementById('sp'),
    nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })(),
  }))()`);
  const extra = extraExpr ? await ev(extraExpr) : null;
  const resources = await ev(`performance.getEntriesByType('resource').map(e => ({ n: new URL(e.name).pathname, t: Math.round(e.startTime), d: Math.round(e.duration), i: e.initiatorType }))`);
  await cdp.send('Target.closeTarget', { targetId });
  const fetches = resources.filter((r) => r.i === 'fetch' && r.n !== '/sp.user.js');
  return { label, path, ready, ms, snapshot, extra, errors, fetchCount: fetches.length, fetches };
}

export { CDP };
