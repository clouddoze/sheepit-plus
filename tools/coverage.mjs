#!/usr/bin/env node
/**
 * 覆盖率观察：接管面 + 未接管路径按链接数排行。
 *
 * 用法：
 *   node tools/coverage.mjs            # 只读打印，并与基线对比
 *   node tools/coverage.mjs --update   # 写 tools/coverage-baseline.json
 *
 * 链接数来自 .tmp/fixtures/raw 的真站点快照（不入库）。没有夹具时只打印接管面。
 * 接管清单与 src/80-app.js 的 viewForPath 同步；改路由时两边一起改。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const FIXTURES = join(ROOT, '.tmp', 'fixtures', 'raw');
const BASELINE = join(HERE, 'coverage-baseline.json');
const UPDATE = process.argv.includes('--update');

/* 与 80-app.js:27-49 的 viewForPath 一一对应 */
const HANDLED = [
  [/^\/$/, 'overview'],
  [/^\/home$/, 'overview'],
  [/^\/index\.php$/, 'overview'],
  [/^\/home\/projects$/, 'projects'],
  [/^\/ranking\/user$/, 'ranking'],
  [/^\/ranking$/, 'ranking'],
  [/^\/user\/[^/]+\/profile$/, 'overview'],
  [/^\/user\/[^/]+\/edit$/, 'account'],
  [/^\/session\/\d+$/, 'session'],
  [/^\/getstarted$/, 'upload'],
  [/^\/project\/add\/[^/]+$/, 'analyse'],
  [/^\/project\/\d+$/, 'project'],
];

/* 不是页面：静态资源、下载、登录跳转、站点自己处理的动作 */
const IGNORE = [/^\/media\//, /^\/reference_machine\.blend$/, /^\/user\/logout$/, /^\/user\/signin/, /^\/favicon/];

function official(path) {
  return HANDLED.find(([re]) => re.test(path));
}

function scan() {
  const out = { handled: HANDLED.map(([, v]) => v), unhandled: [], fixtures: 0, when: new Date().toISOString() };
  if (!existsSync(FIXTURES)) {
    out.note = '没有 .tmp/fixtures/raw，只打印接管面';
    return out;
  }
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.html'));
  out.fixtures = files.length;
  const counts = new Map();
  for (const f of files) {
    const html = readFileSync(join(FIXTURES, f), 'utf8');
    for (const m of html.matchAll(/href="(\/[^"#?]+)/g)) {
      const p = m[1].replace(/\/+$/, '') || '/';
      if (official(p) || IGNORE.some((re) => re.test(p))) continue;
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  out.unhandled = [...counts.entries()].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count);
  return out;
}

const now = scan();
console.log('接管面：' + new Set(now.handled).size + ' 个视图 / ' + HANDLED.length + ' 条路径');
console.log('夹具：' + now.fixtures + ' 个 HTML');
if (now.note) console.log('  ' + now.note);
console.log('未接管（按链接数）：');
for (const x of now.unhandled.slice(0, 15)) console.log('  ' + String(x.count).padStart(4) + '  ' + x.path);

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
  console.log('\n基线已写入 ' + BASELINE);
  process.exit(0);
}
if (!existsSync(BASELINE)) {
  console.log('\n没有基线：先跑 node tools/coverage.mjs --update');
  process.exit(0);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const baseMap = new Map((base.unhandled || []).map((x) => [x.path, x.count]));
const cur = new Map(now.unhandled.map((x) => [x.path, x.count]));
const added = now.unhandled.filter((x) => !baseMap.has(x.path));
const removed = [...baseMap.keys()].filter((p) => !cur.has(p));
const changed = now.unhandled.filter((x) => baseMap.has(x.path) && baseMap.get(x.path) !== x.count);
console.log('\n对基线：新增 ' + added.length + ' / 消失 ' + removed.length + ' / 计数变化 ' + changed.length);
if (added.length || removed.length || changed.length) {
  console.log('  新增：' + (added.map((x) => x.path + '(' + x.count + ')').join(', ') || '无'));
  console.log('  消失：' + (removed.join(', ') || '无'));
  console.log('  变化：' + (changed.map((x) => x.path + ' ' + baseMap.get(x.path) + '→' + x.count).join(', ') || '无'));
}
