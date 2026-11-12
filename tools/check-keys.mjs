/* 词条体检：扫 src/ 里所有 t('字面量')，确认 10-core 的 DICT 里都有对应键。
   防的是"词条被删了但引用还在"——页面上会直接显示键名（set.on、mg.acl.none 都栽过）。
   用法：node tools/check-keys.mjs（有缺失时退出码 1）。 */
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = fs.readFileSync(join(ROOT, 'src', '10-core.js'), 'utf8');
const files = fs.readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.js') && f !== '10-core.js');
const missing = new Set();
let used = 0;
for (const f of files) {
  const s = fs.readFileSync(join(ROOT, 'src', f), 'utf8');
  for (const m of s.matchAll(/\bt\('([a-z][\w.]+)'/g)) {
    if (!m[1] || m[1].endsWith('.')) continue;    // t('nav.' + k) 之类动态拼接的碎片
    used++;
    if (!core.includes("'" + m[1] + "'")) missing.add(f + ': ' + m[1]);
  }
}
console.log('字面量词条引用：' + used + ' 处');
if (missing.size) {
  console.error('缺失 ' + missing.size + ' 个：');
  for (const m of missing) console.error('  ' + m);
  process.exit(1);
}
console.log('全部命中 ✓');
