#!/usr/bin/env node
/**
 * 解析器契约测试：检查 src/20-api.js 依赖的上游模板 / 字段是否还在。
 *
 * 为什么要有：解析器读的是站点模板的结构与文案，上游一改就可能静默失效。
 * 配合 tools/update-upstream.mjs（每日 10:00 拉取）：拉完跑一次，缺项就说明要复核解析器。
 *
 * 用法：
 *   node tools/parser-contract.mjs          # 文本报告
 *   node tools/parser-contract.mjs --json   # 机器可读
 *
 * 退出码：0 契约完整；1 有缺失（drift）；2 本地还没有上游源码。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const WWW = join(ROOT, '.tmp', 'www', 'www');
const asJson = process.argv.includes('--json');

/* 每条 = 解析器真的读过的上游位置。need 只放「换掉就解析不出数据」的原文，
   不放可自由改的文案；宁少勿多，误报会让这条告警失去意义。 */
const CONTRACTS = [
  { id: 'session-running', file: 'templates/session/running.html.twig', need: ['Session information', 'Compute device', 'Current frames'] },
  { id: 'session-past', file: 'templates/session/past.html.twig', need: [] },
  { id: 'project-manage', file: 'templates/project/manage.html.twig', need: ['printBlend'] },
  { id: 'home-machines', file: 'templates/home/machines.html.twig', need: [] },
  { id: 'ui-html', file: 'src/UI/HTML.php', need: ['printBlend', '<h2>Summary</h2>'] },
  { id: 'home-controller', file: 'src/Controller/HomeController.php', need: [] },
  { id: 'user-controller', file: 'src/Controller/UserController.php', need: [] },
  { id: 'session-controller', file: 'src/Controller/SessionController.php', need: [] },
  { id: 'project-entity', file: 'src/Entity/Project.php', need: [] },
  { id: 'pre-user-entity', file: 'src/Entity/PreUser.php', need: [] },
];

function run() {
  if (!existsSync(WWW)) {
    return { status: 'no-upstream', message: '先跑 node tools/update-upstream.mjs 拉取上游' };
  }
  const missing = [];
  let checked = 0;
  for (const c of CONTRACTS) {
    const p = join(WWW, c.file);
    if (!existsSync(p)) { missing.push({ id: c.id, file: c.file, reason: 'missing-file' }); continue; }
    checked++;
    const text = readFileSync(p, 'utf8');
    for (const s of c.need) {
      if (!text.includes(s)) missing.push({ id: c.id, file: c.file, reason: 'missing-text', text: s });
    }
  }
  return { status: missing.length ? 'drift' : 'ok', checked, total: CONTRACTS.length, missing };
}

const r = run();
if (asJson) {
  console.log(JSON.stringify(r, null, 2));
} else {
  console.log('解析器契约 · ' + r.status);
  if (r.status === 'no-upstream') {
    console.log('  ' + r.message);
  } else {
    console.log('  检查 ' + r.checked + '/' + r.total + ' 个上游文件');
    if (r.missing.length) {
      for (const m of r.missing) {
        console.log('  ✘ ' + m.id + ' · ' + m.file + (m.text ? ' · 缺 "' + m.text + '"' : ' · 文件不存在'));
      }
      console.log('  → 站点可能改版：先看上游 diff，再决定 src/20-api.js 的解析器要不要跟着改。');
    } else {
      console.log('  ✓ 依赖的模板与字段都在');
    }
  }
}
process.exit(r.status === 'ok' ? 0 : (r.status === 'no-upstream' ? 2 : 1));
