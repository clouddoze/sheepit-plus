// 开发工具（不参与交付）：把作者账号在真实站点上的页面原样抓下来做夹具。
// 为什么不让页面把 HTML 直接返回给 Agent：一份 profile 页有 300KB+，
// 全塞进对话既浪费上下文，也把会话 cookie 之外的东西带进来。
// 这里让页面把 HTML POST 到本地，落盘后再用 —— Agent 只看统计数字。
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const OUT = process.env.SP_FIXTURES || join(ROOT, '.tmp', 'fixtures', 'raw');
mkdirSync(OUT, { recursive: true });

const server = createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (url.pathname !== '/save') { res.writeHead(404, cors); res.end('only /save'); return; }

  const name = (url.searchParams.get('name') || 'page').replace(/[^\w.-]/g, '_');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    writeFileSync(join(OUT, `${name}.html`), body);
    console.log(`saved ${name}.html ${body.length} bytes`);
    res.writeHead(200, { 'content-type': 'text/plain', ...cors });
    res.end(`ok ${body.length}`);
  });
});

server.listen(8733, '127.0.0.1', () => console.log('capture server on http://127.0.0.1:8733/save?name=...'));
