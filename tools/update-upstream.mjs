#!/usr/bin/env node
/**
 * 拉取配合开发的上游源码（GitLab sheepitrenderfarm/www）。
 *
 * 为什么要有：站点解析器（src/20-api.js）直接依赖上游模板的 DOM 结构与文案。
 * 上游一改，解析就可能静默失效 —— 定时拉取 + 记录 HEAD，是把「站点改版」这件事
 * 从「用户发现某页坏了」提前到「拉取时就看到」。
 *
 * 用法：
 *   node tools/update-upstream.mjs            # 拉取（没有就浅克隆）并报告
 *   node tools/update-upstream.mjs --check    # 只比较本地与远端 HEAD，不写工作区
 *   node tools/update-upstream.mjs --json     # 机器可读输出
 *
 * 位置：.tmp/www（.tmp 已 gitignore）。首次 clone 约 3500 个文件，之后只 fetch 新提交。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const DIR = join(ROOT, '.tmp', 'www');
const STATE = join(ROOT, '.tmp', 'upstream-state.json');
const REMOTE = 'https://gitlab.com/sheepitrenderfarm/www.git';
const BRANCH = 'master';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const asJson = args.includes('--json');

function git(argv, cwd) {
  return execFileSync('git', argv, { cwd: cwd || DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function lsRemote() {
  const out = execFileSync('git', ['ls-remote', REMOTE, 'refs/heads/' + BRANCH], { encoding: 'utf8' });
  const line = out.trim().split('\n')[0] || '';
  return line.split('\t')[0] || '';
}

function headOf() {
  try { return git(['rev-parse', 'HEAD']); } catch (e) { return ''; }
}

function shortLog(sha) {
  try { return git(['log', '-1', '--format=%h %ad %s', '--date=short', sha]); } catch (e) { return ''; }
}

function filesOf(sha) {
  try { return git(['show', '--name-only', '--format=', sha]).split('\n').filter(Boolean); } catch (e) { return []; }
}

function report(obj) {
  if (asJson) { console.log(JSON.stringify(obj, null, 2)); return; }
  console.log('上游 www · ' + (obj.status || '?'));
  console.log('  本地 HEAD  ' + (obj.local || '（未克隆）'));
  console.log('  远端 HEAD  ' + (obj.remote || '?'));
  if (obj.commit) console.log('  提交       ' + obj.commit);
  if (obj.files && obj.files.length) {
    console.log('  本次提交涉及 ' + obj.files.length + ' 个文件：');
    for (const f of obj.files.slice(0, 12)) console.log('    ' + f);
    if (obj.files.length > 12) console.log('    … 其余 ' + (obj.files.length - 12) + ' 个');
  }
  if (obj.status === 'updated') console.log('  → 已更新到最新；解析器（src/20-api.js）如有失配，检查上面的模板与控制器。');
  if (obj.status === 'cloned') console.log('  → 首次克隆完成。');
  if (obj.status === 'up-to-date') console.log('  → 已是最新，无变更。');
}

function saveState(obj) {
  try { writeFileSync(STATE, JSON.stringify(obj, null, 2) + '\n'); } catch (e) { /* 状态文件写不了不影响拉取 */ }
}

const remote = lsRemote();
if (!remote) {
  console.error('× 读不到远端 HEAD：检查网络或仓库地址 ' + REMOTE);
  process.exit(1);
}

if (!existsSync(join(DIR, '.git'))) {
  if (checkOnly) {
    report({ status: 'not-cloned', local: '', remote });
    process.exit(0);
  }
  mkdirSync(DIR, { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', '--branch', BRANCH, REMOTE, DIR], { stdio: ['ignore', 'pipe', 'inherit'] });
  const obj = { status: 'cloned', local: headOf(), remote, commit: shortLog('HEAD'), files: filesOf('HEAD'), checkedAt: new Date().toISOString() };
  saveState(obj);
  report(obj);
  process.exit(0);
}

const before = headOf();
if (before === remote) {
  const obj = { status: 'up-to-date', local: before, remote, checkedAt: new Date().toISOString() };
  saveState(obj);
  report(obj);
  process.exit(0);
}

if (checkOnly) {
  report({ status: 'behind', local: before, remote, commit: shortLog(remote) });
  process.exit(0);
}

git(['fetch', '--depth', '1', 'origin', BRANCH]);
git(['reset', '--hard', 'FETCH_HEAD']);
const after = headOf();
const obj = {
  status: 'updated',
  local: after,
  remote,
  previous: before,
  commit: shortLog('HEAD'),
  files: filesOf('HEAD'),
  changed: before !== after,
  checkedAt: new Date().toISOString(),
};
saveState(obj);
report(obj);
