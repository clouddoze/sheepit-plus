#!/usr/bin/env node
/**
 * 构建：把 src/*.js 按文件名顺序拼成一个可安装的油猴脚本。
 *
 * 为什么不做真正的打包：油猴脚本天生是单文件，用拼接能在保持"发布产物零依赖、
 * 易于在 GreasyFork 上 diff"的同时，让源码仍然分模块可维护。
 *
 * 用法：
 *   node build.mjs            # 输出 dist/sheepit-plus.user.js
 *   node build.mjs --check    # 只做语法与体积校验，不写文件
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { countCommentBytes } from './tools/comment-bytes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');
const DIST = join(HERE, 'dist');
const OUT = join(DIST, 'sheepit-plus.user.js');
const checkOnly = process.argv.includes('--check');

// ---- 体积提示（只提示，不拦构建） ----
// 为什么要有：上一轮把源码注释从 99.7 KB 压到 33.4 KB、产物从 339,846 压到 271,560 字节
// （-20%）。但构建只打印 KB，没有任何东西提醒注释以后再长回来，这条就是那个提醒。
// 为什么只提示不拦（2026-10-06 用户拍板「不要硬上限，提示一下就行」）：加功能本来就会让产物
// 变大，构建不该替人挡路 —— 提醒一下，变大是否接受由人决定。
const BUDGET_OUT_BYTES = 285000;   // 产物 UTF-8 字节提示线
const BUDGET_COMMENT_RATIO = 0.25; // 注释字节 / 产物字节 的提示线

const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
if (!files.length) {
  console.error('× src/ 下没有找到任何 .js');
  process.exit(1);
}

// 第 1 个文件必须是有 @match 的用户脚本头
const meta = readFileSync(join(SRC, files[0]), 'utf8');
if (!/==UserScript==/.test(meta)) {
  console.error(`× ${files[0]} 不是用户脚本头（缺少 ==UserScript==）`);
  process.exit(1);
}
const version = (meta.match(/@version\s+(\S+)/) || [])[1];
if (!version) {
  console.error('× 用户脚本头里没有 @version');
  process.exit(1);
}

const banner = `/* sheepit-plus v${version} — 由 build.mjs 生成，请勿直接编辑。源码见 src/ */`;
const chunks = files.map((f, i) => {
  const body = readFileSync(join(SRC, f), 'utf8').trimEnd();
  // 第 1 个文件是用户脚本头。// ==UserScript== 必须落在产物第 1 行：前面挂任何注释或空白，
  // GreasyFork 都会警告「您的代码没有以 // ==UserScript== 开头」，部分管理器也会不认。
  // 所以文件 0 不挂模块横幅（模块名就是它自己），生成的 banner 排在 metadata 块之后。
  if (i === 0) return `${body}\n\n${banner}`;
  return `/* ===== src/${f} ===== */\n${body}`;
});
const out = `${chunks.join('\n\n')}\n`;

// 兜底断言：产物第 1 行必须是用户脚本头的开始
if (!out.startsWith('// ==UserScript==')) {
  console.error('× 产物第 1 行不是 // ==UserScript==（前面混进了注释或空白）');
  process.exit(1);
}

// 语法校验：在隔离上下文里编译（不执行），能抓出拼接产生的语法错误
try {
  new vm.Script(out, { filename: 'sheepit-plus.user.js' });
} catch (err) {
  console.error('× 拼接结果语法错误：', err.message);
  process.exit(1);
}

// 冒烟校验：语法正确不等于装得对。CSS 整段写在一个模板字符串里，注释里混进一个
// 反引号就会把它提前闭合 —— 结果是 SP.CSS 变成 undefined，而语法检查照样通过
// （`` `a`.row`b` `` 是合法的属性访问）。真跑一次 10-core + 30-style 才看得见。
// 这一条是被真实踩过两次之后加的。
function smoke() {
  const win = { matchMedia: () => ({ matches: false }), addEventListener() {} };
  win.__SHEEPIT_PLUS__ = win;
  const doc = {
    createElement: () => ({ style: {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }),
    getElementById: () => null,
    querySelector: () => null,
    head: { appendChild() {} },
    documentElement: { appendChild() {} },
  };
  const sandbox = {
    window: win, document: doc, navigator: { language: 'zh-CN' }, localStorage: { getItem: () => null, setItem() {} },
    location: { origin: 'https://example.invalid' }, DOMParser: function () {}, URL,
  };
  const core = chunks[1];
  const style = chunks.find((c) => c.includes('src/30-style.js'));
  const ctx = vm.createContext(sandbox);
  new vm.Script(`${core}\n${style}`).runInContext(ctx);
  const css = win.CSS;
  const problems = [];
  if (typeof css !== 'string') problems.push(`SP.CSS 不是字符串（${typeof css}）—— 模板字符串很可能被提前闭合`);
  else {
    if (css.length < 8000) problems.push(`SP.CSS 只有 ${css.length} 字符，看起来被截断了`);
    for (const sel of ['#sp{', '#sp .wrap', '#sp .kpis', '#sp .farm', '#sp .tbl', '#sp .heatwrap', '#sp .acct', '#sp .facts', '#sp .actrow']) {
      if (!css.includes(sel)) problems.push(`SP.CSS 里找不到 ${sel}`);
    }
  }
  if (typeof win.injectStyle !== 'function') problems.push('SP.injectStyle 没有导出');
  if (typeof win.injectModePillStyle !== 'function') problems.push('SP.injectModePillStyle 没有导出');
  return problems;
}

let smokeProblems = [];
try {
  smokeProblems = smoke();
} catch (err) {
  smokeProblems = [`冒烟校验抛错：${err.message}`];
}
if (smokeProblems.length) {
  console.error('× 冒烟校验未通过：');
  for (const p of smokeProblems) console.error(`    · ${p}`);
  process.exit(1);
}

// 体积一律按 UTF-8 字节数报 —— 之前用 out.length（UTF-16 码元数），中文被少算了近 30KB，
// 与 harness.mjs 的 statSync(...).size（真实字节）对不上：同一个产物一个说 194K 一个说 224K。
const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
const parts = files.map((f) => `${f}(${(statSync(join(SRC, f)).size / 1024).toFixed(1)}K)`).join(' ');
console.log(`√ 语法校验通过`);
console.log(`  模块：${parts}`);
console.log(`  产物：${kb} KB（UTF-8 字节）${checkOnly ? '（--check，未写入）' : ''}`);

// 注释字节按源文件逐个统计再求和，而不是直接扫产物：30-style.js 的模板串里装的是 CSS，
// 那段注释得按 CSS 口径算（约 7 KB）；直接扫产物时扫描器不认识"这段模板是 CSS"，
// 只能保守地跳过所有模板串，会漏掉这 7 KB；若反过来开启模板内扫描，又会把
// accept="image/*" 这类内容误判成注释起始（实测虚高 2.5 KB）。
// 分子按源码口径、分母按产物字节（用户实际下载的字节数），生成期注释（banner 与模块
// 分隔行，约 300 字节）未计入分子。
const commentBytes = files.reduce((sum, f) => {
  const code = readFileSync(join(SRC, f), 'utf8');
  return sum + countCommentBytes(code, { stripTemplate: f === '30-style.js' }).commentBytes;
}, 0);
const outBytes = Buffer.byteLength(out, 'utf8');
const commentRatio = commentBytes / outBytes;
console.log(`  注释：${commentBytes} 字节 / 产物 ${outBytes} 字节 = ${(commentRatio * 100).toFixed(1)}%`
  + `（占比提示线 ${(BUDGET_COMMENT_RATIO * 100).toFixed(0)}%）`);

// 只提示、不拦：加功能本来就会变大，构建不该替人挡路（用户 2026-10-06 拍板）。
if (outBytes > BUDGET_OUT_BYTES) {
  console.warn(`⚠ 产物 ${outBytes} 字节，已过提示线 ${BUDGET_OUT_BYTES} 字节（超 ${outBytes - BUDGET_OUT_BYTES} 字节）——`
    + '变的这版是不是有意的？');
}
if (commentRatio > BUDGET_COMMENT_RATIO) {
  console.warn(`⚠ 注释 ${commentBytes} 字节，占产物 ${(commentRatio * 100).toFixed(1)}%，`
    + `已过提示线 ${(BUDGET_COMMENT_RATIO * 100).toFixed(0)}%（${Math.floor(outBytes * BUDGET_COMMENT_RATIO)} 字节）`
    + ' —— 注释是不是又写多了？');
}

if (!checkOnly) {
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
  writeFileSync(OUT, out, 'utf8');
  console.log(`  写入：${OUT}`);
}
