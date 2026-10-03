// 开发工具（不参与交付）：把抓下来的真实页面当"站点"喂给构建产物，做可重复的实测。
//
// 为什么不在真站点上直接测：
//  1) 站点页面还在变，测出来的东西不可复现；
//  2) 新用户空状态在真账号上根本触发不了（作者账号有 973 个采样点）；
//  3) 窄屏验证需要一个能被脚本控制的视口，真窗口宽度是用户的。
//
// 站点自己的 37 个外链脚本全部以空 JS 顶掉（我们只需要 DOM 与内联数据数组），
// 内联脚本保留原样 —— 但 $ / jQuery / google.charts / LazyLoad 用桩顶住，
// 于是它们什么都不做、也不报错。这样控制台里剩下的错误一定是我们自己的。
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
// 夹具是抓下来的真实账号页面（含作者本人数据），不进版本库，见 .gitignore。
// 换台机器先跑 tools/capture-server.mjs 抓一次，再起这个。
const RAW = process.env.SP_FIXTURES || join(ROOT, '.tmp', 'fixtures', 'raw');
const PORT = Number(process.env.PORT || 8734);

/** 渲染优先级的假状态（只活在内存里，供 /user/priority/* 的写桩用） */
const prio = new Set();

const FIXTURES = {
  '/': '_home.html',
  '/home': '_home.html',
  '/index.php': '_home.html',
  '/home/projects': '_home_projects.html',
  '/ranking/user': '_ranking_user.html',
  '/ranking': '_ranking_user.html',
};

const STUB = `<script>
(function(){
  var noop = new Proxy(function(){}, {
    get: function(t, k){ if (k === Symbol.toPrimitive || k === 'toString') return function(){ return ''; };
      if (k === 'length') return 0; return noop; },
    apply: function(){ return noop; },
    construct: function(){ return {}; }
  });
  window.$ = window.jQuery = function(){ return noop; };
  window.google = { charts: { load: function(){}, setOnLoadCallback: function(){}, arrayToDataTable: function(){ return {}; } } };
  window.LazyLoad = function(){ return { update: function(){} }; };
  window.Modernizr = { load: function(){} };
  window.jstz = { determine: function(){ return { name: function(){ return 'UTC'; } }; } };
})();
</script>`;

/** 只给内联数据数组用：把夹具里的时间线清空，模拟"还没开始渲染"的新账号 */
function emptyVariant(html) {
  return html
    .replace(/var line_points_timeline = \[[\s\S]*?\];/, "var line_points_timeline = [['Time','Points']];")
    .replace(/var line_frames_timeline = \[[\s\S]*?\];/, "var line_frames_timeline = [['Time','Frames']];")
    .replace(/var data = \[[\s\S]*?\];/, 'var data = [];')
    // 名次与徽章是"夹具里那个账号"的，新账号变体要把它们抹掉（不写死具体名次）
    .replace(/>\d+(?:st|nd|rd|th)</, '>-<')
    .replace(/>top \d+% renderers</, '><');
}

function page(name) {
  const file = join(RAW, name);
  if (!existsSync(file)) return null;
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<\/head>/i, `${STUB}</head>`);
  html = html.replace(/<\/body>/i, `<script src="/sp.user.js"></script></body>`);
  return html;
}

const LAB = (q) => {
  const w = Number(q.get('w') || 1382);
  const h = Number(q.get('h') || 1100);
  const path = decodeURIComponent(q.get('path') || '/home');
  const scale = Number(q.get('scale') || 1);
  const y = Number(q.get('y') || 0);
  const nav = q.get('nav') || '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>lab ${path} @${w}</title>
<style>html,body{margin:0;background:#2a2d33}
iframe{width:${w}px;height:${h}px;border:0;display:block;transform-origin:0 0;${scale !== 1 ? `transform:scale(${scale});` : ''}}
</style></head><body><iframe id="f" src="${path}"></iframe>
<script>
  // #sp 是它自己的滚动容器，外层滚不动它。这里把内层滚到指定位置，
  // 好让截图能分片取到"整页"，而不用把浏览器窗口撑到几千像素高。
  const f = document.getElementById('f');
  f.addEventListener('load', function () {
    const go = function () {
      const sp = f.contentDocument && f.contentDocument.getElementById('sp');
      if (!sp) return setTimeout(go, 120);
      const nav = f.contentDocument.querySelector('[data-nav="${nav}"]');
      if (nav) nav.click();            // 设置视图没有独立 URL，只能从应用内导航进去
      sp.scrollTop = ${y};
      document.title = 'lab y=${y} h=' + sp.scrollHeight;
    };
    setTimeout(go, 250);
  });
</script></body></html>`;
};

const server = createServer((req, res) => {
  const q = new URL(req.url || '/', 'http://127.0.0.1');
  const p = q.pathname;
  const send = (type, body, code) => { res.writeHead(code || 200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };

  // 故障注入：带 ?fail=1 打开页面 → 记一个 cookie；此后凡是脚本用 fetch 取数据的请求都回 500
  // （页面本身的文档请求照常给）。用来走一遍"数据取不到 → 降级"那条路，不必改夹具。
  // 走 cookie 而不是 URL：脚本取数据时用的是不带 query 的规范路径。
  const cookies0 = req.headers.cookie || '';
  const failing = !!q.searchParams.get('fail') || /(?:^|;\s*)spfail=1/.test(cookies0);
  if (failing && req.headers['x-requested-with'] === 'fetch') {
    return send('text/plain', 'injected failure', 500);
  }

  if (p === '/sp.user.js') {
    const f = join(ROOT, 'dist', 'sheepit-plus.user.js');
    if (!existsSync(f)) return send('text/plain', 'build first', 404);
    return send('application/javascript; charset=utf-8', readFileSync(f));
  }
  if (p === '/__lab') return send('text/html; charset=utf-8', LAB(q.searchParams));

  // 站点的静态资源：不给我们不需要的东西，但要让请求成功，避免 404 噪声。
  // 图片给一张真的会显示出来的占位 —— 否则头像就是一片空白，
  // 截图里分不清"头像没解析出来"和"夹具没有图"。
  if (p.startsWith('/media/')) {
    if (/\.css$/.test(p)) return send('text/css; charset=utf-8', '/* stub */');
    if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(p)) {
      const letter = (p.split('/').pop() || '?').replace(/\.[a-z]+$/i, '').slice(0, 1).toUpperCase();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
        `<rect width="64" height="64" rx="14" fill="#c4553f"/>` +
        `<text x="32" y="43" font-family="sans-serif" font-size="30" font-weight="600" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
      return send('image/svg+xml; charset=utf-8', svg);
    }
    return send('application/javascript; charset=utf-8', '/* stub */');
  }

  // 会话页的时间线不在 HTML 里：站点自己的 AJAX 端点拉一段 JSON。
  // 夹具按原样存一份（文件是抓取工具加的后缀，这里是重命名过的 .json）。
  if (/^\/session\/\d+\/timeline$/.test(p)) {
    const f = join(RAW, 'session-timeline.json');
    if (!existsSync(f)) return send('text/plain', 'no fixture for ' + p, 404);
    return send('application/json; charset=utf-8', readFileSync(f));
  }

  // 会话页的机器控制：站点自己的端点回一句 'OK'（见 /media/*/script/common.js 的
  // requestReloadOnSuccess）。夹具也回同样的东西，好把"成功"那条路走一遍。
  // 注意它不会真的改夹具里的状态 —— 真实往返只在真站点上验。
  if (req.method === 'POST' && /^\/session\/\d+\/running\/[01]$/.test(p)) {
    return send('text/plain', 'OK');
  }

  // 渲染优先级的写端点（账户设置页与会话页的项目 chip 共用）：
  // 内存里记一份状态，好把「优先 ↔ 移出」这条路走完整；重启 harness 即复位。
  const pm = p.match(/^\/user\/priority\/(add|remove)\/(.+)$/);
  if (req.method === 'POST' && pm) {
    const who = decodeURIComponent(pm[2]);
    if (pm[1] === 'add') prio.add(who); else prio.delete(who);
    console.log(`priority ${pm[1]} ${who} → {${[...prio].join(',')}}`);
    return send('text/plain', 'OK');
  }

  // 赞助（捐赠积分）的写端点：两个开关 + 名单增删。都只回 'OK'（站点就是这么定的），
  // 好把"点一下 → 提交 → 整页重取"这条路走完。真站点上不点 —— 那是真的把积分送出去。
  if (req.method === 'POST' && /^\/user\/sponsor\/(give|receive)\/enable\/[01]$/.test(p)) {
    console.log(`sponsor ${p}`);
    return send('text/plain', 'OK');
  }
  if (req.method === 'POST' && /^\/user\/sponsor\/(add|remove)\//.test(p)) {
    console.log(`sponsor ${p}`);
    return send('text/plain', 'OK');
  }

  let name = FIXTURES[p];
  if (!name && /^\/session\/\d+$/.test(p)) name = 'session.html';
  if (!name && /^\/user\/[^/]+\/profile$/.test(p)) name = '_user_profile.html';
  if (!name && /^\/user\/[^/]+\/edit$/.test(p)) name = 'edit.html';
  if (!name) return send('text/plain', `no fixture for ${p}`, 404);

  let html = page(name);
  // 变体要跟着 cookie 走：页面里的数据是脚本再 fetch 一次 /user/<u>/profile 拿的，
  // 只给当前这次请求加 ?variant= 根本传不到那一次抓取上。
  const cookies = req.headers.cookie || '';
  const variant = q.searchParams.get('variant')
    || ((cookies.match(/(?:^|;\s*)spvariant=([^;]+)/) || [])[1] || '');
  if (variant === 'empty') html = emptyVariant(html);

  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
  if (q.searchParams.get('variant')) headers['set-cookie'] = `spvariant=${variant}; Path=/; Max-Age=600`;
  if (q.searchParams.get('fail')) headers['set-cookie'] = 'spfail=1; Path=/; Max-Age=600';
  res.writeHead(200, headers);
  return res.end(html);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`harness on http://127.0.0.1:${PORT}/  (sp.user.js ${(statSync(join(ROOT, 'dist', 'sheepit-plus.user.js')).size / 1024).toFixed(1)}K)`);
  console.log(`  /home  /home/projects  /ranking/user  /user/<你>/profile  /__lab?w=390&h=880&path=/home`);
  console.log(`  空状态变体: 在页面 URL 后加 ?variant=empty`);
});
