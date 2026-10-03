// 本地静态测试服务器：只用于把构建产物喂给浏览器做实测，不参与交付。
// 页面是 https，而 127.0.0.1 属于 potentially trustworthy origin，
// 因此 https → http://127.0.0.1 的 fetch 不算 mixed content，可以直连。
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8731);

const server = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  const rel = url.replace(/^\/+/, '') || 'sheepit-plus.user.js';
  const file = join(HERE, 'dist', rel);
  // CORS 头必须出现在所有分支上：404 缺 CORS 时浏览器会把响应变成不透明的 NetworkError，
  // 排查起来会误以为是混合内容被拦。
  const cors = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
  if (!file.startsWith(join(HERE, 'dist')) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...cors });
    res.end(`not found: ${rel}`);
    return;
  }
  res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', ...cors });
  res.end(readFileSync(file));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`sheepit-plus test server listening on http://127.0.0.1:${PORT}/sheepit-plus.user.js`);
});
