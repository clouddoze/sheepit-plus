#!/usr/bin/env node
/**
 * 按 tools/dead-keys.json 删除 src/10-core.js 里中英两份的死键（只动 DICT 块）。
 *
 * 用法：
 *   node tools/strip-dead.mjs            # 预演：只打印计划，不写文件
 *   node tools/strip-dead.mjs --write    # 真正写回 src/10-core.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORE = join(ROOT, 'src', '10-core.js');
const WRITE = process.argv.includes('--write');

const dead = JSON.parse(readFileSync(join(HERE, 'dead-keys.json'), 'utf8')).dead;
const text = readFileSync(CORE, 'utf8');
const lines = text.split('\n');

function findBlock(name) {
  const startRe = new RegExp('^\\s{4}' + name + ': \\{\\s*$');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) if (startRe.test(lines[i])) { start = i; break; }
  if (start < 0) throw new Error('找不到 DICT.' + name);
  const endRe = /^\s{4}\},?\s*$/;
  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) if (endRe.test(lines[i])) { end = i; break; }
  if (end < 0) throw new Error('找不到 DICT.' + name + ' 收尾');
  return { start, end, label: name };
}

function blockInfo(b) {
  const from = b.start + 1;
  const to = b.end;
  const content = lines.slice(from, to).join('\n');
  const lineOffsets = [0];
  for (let i = 0; i < content.length; i += 1) if (content[i] === '\n') lineOffsets.push(i + 1);
  const fileOffset = lines.slice(0, from).reduce((n, l) => n + l.length + 1, 0);
  return { content, lineOffsets, from, to, fileOffset, label: b.label };
}

function lineIdx(info, offset) {
  const arr = info.lineOffsets;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function parsePairs(info) {
  const s = info.content;
  const n = s.length;
  const pairs = [];
  let i = 0;
  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const skipLineComment = () => { while (i < n && s[i] !== '\n') i += 1; };
  const skipBlockComment = () => { i += 2; while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i += 1; i += 2; };
  const readString = (start) => {
    const q = s[start];
    let j = start + 1;
    while (j < n) {
      if (s[j] === '\\') { j += 2; continue; }
      if (s[j] === q) { j += 1; break; }
      j += 1;
    }
    return { value: s.slice(start + 1, j - 1), end: j };
  };
  while (i < n) {
    if (isWs(s[i])) { i += 1; continue; }
    if (s[i] === '/' && s[i + 1] === '/') { skipLineComment(); continue; }
    if (s[i] === '/' && s[i + 1] === '*') { skipBlockComment(); continue; }
    if (s[i] !== "'") { i += 1; continue; }
    const keyStart = i;
    const ks = readString(i);
    i = ks.end;
    while (i < n && isWs(s[i])) i += 1;
    if (s[i] !== ':') { i = ks.end; continue; }
    i += 1;
    while (i < n && isWs(s[i])) i += 1;
    const valueStart = i;
    let valueEnd = -1;
    let commaEnd = -1;
    while (i < n) {
      const c = s[i];
      if (c === "'" || c === '"') { const r = readString(i); i = r.end; continue; }
      if (c === '/' && s[i + 1] === '/') { skipLineComment(); continue; }
      if (c === '/' && s[i + 1] === '*') { skipBlockComment(); continue; }
      if (c === ',') { valueEnd = i; commaEnd = i + 1; i += 1; break; }
      i += 1;
    }
    if (valueEnd < 0) { valueEnd = i; commaEnd = i; }
    pairs.push({ key: ks.value, keyStart, valueStart, valueEnd, commaEnd });
  }
  return pairs;
}

const blocks = [findBlock('zh'), findBlock('en')].map(blockInfo);
const deadSet = new Set(dead);
const deletions = [];
const missing = [];

for (const info of blocks) {
  const pairs = parsePairs(info).map((p) => ({
    ...p,
    keyLine: lineIdx(info, p.keyStart),
    valLine: lineIdx(info, Math.max(p.valueStart, p.valueEnd)),
  }));
  const byKey = new Map();
  for (const p of pairs) byKey.set(p.key, p);

  const byLine = new Map();
  for (const p of pairs) {
    if (!byLine.has(p.keyLine)) byLine.set(p.keyLine, []);
    byLine.get(p.keyLine).push(p);
  }

  const handled = new Set();

  /* 1) 整行都是死键：整行删 */
  for (const [line, list] of byLine) {
    if (!list.length) continue;
    const allDead = list.every((p) => deadSet.has(p.key));
    const singleLine = list.every((p) => p.valLine === line);
    if (!allDead || !singleLine) continue;
    const lineStart = info.lineOffsets[line];
    const lineEnd = line + 1 < info.lineOffsets.length ? info.lineOffsets[line + 1] - 1 : info.content.length;
    let rest = '';
    let cursor = lineStart;
    for (const p of list.slice().sort((a, b) => a.keyStart - b.keyStart)) {
      rest += info.content.slice(cursor, p.keyStart);
      cursor = Math.max(cursor, p.commaEnd);
    }
    rest += info.content.slice(cursor, lineEnd);
    if (rest.trim() !== '') continue;
    for (const p of list) handled.add(p.key);
    deletions.push({
      keys: list.map((p) => p.key),
      label: info.label,
      line: line + info.from + 1,
      how: '整行',
      start: info.fileOffset + lineStart,
      end: info.fileOffset + (line + 1 < info.lineOffsets.length ? info.lineOffsets[line + 1] : info.content.length),
    });
  }

  /* 2) 跨行死键（值续行）：必须独占行，整段删 */
  for (const p of pairs) {
    if (!deadSet.has(p.key) || handled.has(p.key) || p.valLine === p.keyLine) continue;
    const lineStart = info.lineOffsets[p.keyLine];
    const valLineEnd = p.valLine + 1 < info.lineOffsets.length ? info.lineOffsets[p.valLine + 1] - 1 : info.content.length;
    const before = info.content.slice(lineStart, p.keyStart);
    const after = info.content.slice(p.commaEnd, valLineEnd);
    if (before.trim() !== '' || after.trim() !== '') throw new Error('跨行键不是独占行：' + p.key);
    handled.add(p.key);
    deletions.push({
      keys: [p.key],
      label: info.label,
      line: p.keyLine + info.from + 1,
      how: '整行(跨行)',
      start: info.fileOffset + lineStart,
      end: info.fileOffset + (p.valLine + 1 < info.lineOffsets.length ? info.lineOffsets[p.valLine + 1] : info.content.length),
    });
  }

  /* 3) 与活键同行的死键：行内删 */
  for (const p of pairs) {
    if (!deadSet.has(p.key) || handled.has(p.key)) continue;
    const lineStart = info.lineOffsets[p.keyLine];
    const before = info.content.slice(lineStart, p.keyStart);
    let start;
    let end;
    if (before.trim() === '') {
      start = p.keyStart;
      end = p.commaEnd;
      if (info.content[p.commaEnd] === ' ') end += 1;
    } else {
      const prevComma = info.content.lastIndexOf(',', p.keyStart);
      start = prevComma > lineStart ? prevComma + 1 : p.keyStart;
      end = p.commaEnd;
    }
    handled.add(p.key);
    deletions.push({
      keys: [p.key],
      label: info.label,
      line: p.keyLine + info.from + 1,
      how: '行内',
      start: info.fileOffset + start,
      end: info.fileOffset + end,
    });
  }

  for (const key of dead) if (!byKey.has(key)) missing.push(info.label + ':' + key);
}

deletions.sort((a, b) => b.start - a.start);

let out = text;
for (const d of deletions) out = out.slice(0, d.start) + out.slice(d.end);

if (missing.length) {
  console.error('× 以下键在 DICT 中找不到：');
  for (const m of missing) console.error('  ' + m);
  process.exit(1);
}

const beforeBytes = Buffer.byteLength(text, 'utf8');
const afterBytes = Buffer.byteLength(out, 'utf8');

const total = deletions.reduce((n, d) => n + d.keys.length, 0);
console.log('删除键值对：' + total + ' 个（死键 ' + dead.length + ' 个 x 中英 2 份）');
console.log('删除区间：' + deletions.length + ' 段');
console.log('文件字节：' + beforeBytes + ' -> ' + afterBytes + '（-' + (beforeBytes - afterBytes) + '）');
console.log('');
for (const d of deletions.slice().sort((a, b) => a.start - b.start)) {
  const raw = text.slice(d.start, d.end);
  console.log('[' + d.label + '] 行 ' + d.line + ' ' + d.how + ' ' + d.keys.join(', ')
    + ' | 片段 ' + JSON.stringify(raw.length > 70 ? raw.slice(0, 70) + '...' : raw));
}

if (WRITE) {
  writeFileSync(CORE, out, 'utf8');
  console.log('');
  console.log('已写回：' + CORE);
} else {
  writeFileSync(join(HERE, '10-core.preview.js'), out, 'utf8');
  console.log('');
  console.log('预演完成，未写原文件；预览在 tools/10-core.preview.js');
}
