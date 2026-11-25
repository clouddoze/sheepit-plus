#!/usr/bin/env node
/**
 * 本地脚本服务器：把 dist 产物喂给浏览器，供油猴安装 / 检查更新。
 *
 * 与 serve-test.mjs 的分工：
 *   - serve-test.mjs 只把 dist 目录原样喂给页面 fetch（harness 用）；
 *   - 这里额外把脚本头的 @updateURL / @downloadURL 改写成指向本机（只在内存里改，
 *     不碰 dist），装完之后在 Tampermonkey 里点「检查更新」拉的就是本地最新产物。
 *
 * 用法：
 *   node tools/serve-local.mjs            # 默认 http://127.0.0.1:8787/
 *   PORT=8790 node tools/serve-local.mjs
 *
 * 每次请求都重新读 dist：改代码 → node build.mjs → 浏览器刷新即最新，不用重启。
 */
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const FILE = join(ROOT, 'dist', 'sheepit-plus.user.js');
const PORT = Number(process.env.PORT || 8787);
const BASE = 'http://127.0.0.1:' + PORT;
const HEADER = /\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/;

function readSrc() {
  return readFileSync(FILE, 'utf8');
}

function rewrite(src) {
  return src.replace(HEADER, function (block) {
    return block
      .replace(/^(\/\/ @updateURL\s+).*$/m, '$1' + BASE + '/sheepit-plus.meta.js')
      .replace(/^(\/\/ @downloadURL\s+).*$/m, '$1' + BASE + '/sheepit-plus.user.js');
  });
}

function metaOf(src) {
  const m = src.match(HEADER);
  return m ? rewrite(m[0]) + '\n' : '';
}

function info() {
  const src = readSrc();
  const st = statSync(FILE);
  return {
    version: (src.match(/\/\/ @version\s+(\S+)/) || [])[1] || '?',
    bytes: Buffer.byteLength(src),
    sha256: createHash('sha256').update(src).digest('hex'),
    mtime: new Date(st.mtimeMs).toISOString(),
    base: BASE,
    file: FILE,
  };
}

const CSS = 'html{color-scheme:dark}'
  + 'body{margin:0;background:#0b0d11;color:#e8eaed;font:14px/1.65 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}'
  + '.wrap{max-width:720px;margin:0 auto;padding:56px 24px 72px}'
  + 'h1{margin:0 0 6px;font-size:22px;letter-spacing:-.3px}'
  + '.sub{color:#7c8695;font-size:13px;margin-bottom:28px}'
  + '.card{background:#111419;border:1px solid #22272f;border-radius:10px;padding:22px 24px;box-shadow:0 1px 2px rgba(0,0,0,.5),0 4px 12px rgba(0,0,0,.28)}'
  + 'table{border-collapse:collapse;width:100%;margin-bottom:22px}'
  + 'th,td{text-align:left;padding:8px 0;border-bottom:1px solid #1c2129;font-size:13px;vertical-align:top}'
  + 'th{color:#7c8695;font-weight:500;width:112px;white-space:nowrap}'
  + 'td{color:#a8b0bb}'
  + '.mono{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:#e8eaed}'
  + 'a.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:8px;font-size:13.5px;text-decoration:none;border:1px solid #22272f;color:#a8b0bb;background:#161a21;margin:0 8px 8px 0}'
  + 'a.btn.primary{background:#e06d58;border-color:#e06d58;color:#0f1218;font-weight:600}'
  + 'p{margin:0 0 12px;color:#a8b0bb;font-size:13px}'
  + 'p.note{color:#7c8695;font-size:12.5px;line-height:1.7}'
  + 'code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:#1c2129;border:1px solid #22272f;border-radius:4px;padding:1px 5px;color:#e8eaed}'
  + '.ok{color:#3fb950}';

function page() {
  const i = info();
  return '<!doctype html><html lang=zh-CN><meta charset=utf-8>'
    + '<meta name=viewport content="width=device-width,initial-scale=1">'
    + '<title>SheepIt Plus · 本地更新源</title>'
    + '<style>' + CSS + '</style>'
    + '<div class=wrap>'
    + '<h1>SheepIt Plus · 本地更新源</h1>'
    + '<div class=sub>把 dist 里的构建产物直接喂给浏览器；脚本头的更新地址已指向本机。</div>'
    + '<div class=card>'
    + '<table>'
    + '<tr><th>版本</th><td>' + i.version + '</td></tr>'
    + '<tr><th>产物</th><td>' + i.bytes.toLocaleString('en-US') + ' 字节</td></tr>'
    + '<tr><th>SHA256</th><td class=mono>' + i.sha256.slice(0, 24) + '…</td></tr>'
    + '<tr><th>构建时间</th><td>' + i.mtime + '</td></tr>'
    + '<tr><th>更新源</th><td class=mono>' + i.base + '/sheepit-plus.meta.js</td></tr>'
    + '</table>'
    + '<p>安装或覆盖当前版本：</p>'
    + '<a class="btn primary" href=sheepit-plus.user.js>安装 / 更新（本地更新源）</a>'
    + '<a class=btn href="sheepit-plus.user.js?raw=1">安装原始版本（GreasyFork 更新源）</a>'
    + '<p class=note>装本地更新源这一版之后，在 Tampermonkey / Violentmonkey 的脚本菜单里点'
    + '「检查更新」会从 <code>' + i.base + '</code> 拉取；改代码后重新 <code>node build.mjs</code>，'
    + '刷新本页再检查更新即可。想恢复官方更新源，用右边那个「原始版本」链接重装一次。</p>'
    + '<p class=note>装上后打开 <code>https://www.sheepit-renderfarm.com/home</code>，'
    + '确认新版界面和删除确认框。本地服务只监听 127.0.0.1，不对外。</p>'
    + '</div></div></html>';
}

function send(res, code, type, body) {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

const js = (res, body) => send(res, 200, 'application/javascript; charset=utf-8', body);
const html = (res, body) => send(res, 200, 'text/html; charset=utf-8', body);
const json = (res, code, obj) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj, null, 2));

const server = createServer((req, res) => {
  const u = new URL(req.url || '/', BASE);
  const p = u.pathname;
  try {
    if (p === '/health') return json(res, 200, info());
    if (p === '/') return html(res, page());
    if (p === '/sheepit-plus.user.js') {
      const src = readSrc();
      return js(res, u.searchParams.has('raw') ? src : rewrite(src));
    }
    if (p === '/sheepit-plus.meta.js') return js(res, metaOf(readSrc()));
    return send(res, 404, 'text/plain; charset=utf-8', 'not found: ' + p);
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const i = info();
  console.log('[' + new Date().toISOString() + '] sheepit-plus 本地更新源');
  console.log('  安装页  ' + BASE + '/');
  console.log('  脚本    ' + BASE + '/sheepit-plus.user.js');
  console.log('  meta    ' + BASE + '/sheepit-plus.meta.js');
  console.log('  产物    v' + i.version + ' · ' + i.bytes + ' 字节 · sha256 ' + i.sha256.slice(0, 12));
});
