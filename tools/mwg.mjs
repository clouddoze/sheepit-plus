#!/usr/bin/env node
/**
 * modern-web-guidance 的薄封装：统一入口，避免每个人手敲不同的 npx 参数。
 * 真正的指南与规则在插件里，本文件不复制任何规则。
 *
 * 用法：
 *   node tools/mwg.mjs search "responsive table"
 *   node tools/mwg.mjs retrieve "responsive-table,sortable-table"
 *   node tools/mwg.mjs legacy-scan src --json
 *   node tools/mwg.mjs list
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('用法：node tools/mwg.mjs <search|retrieve|list|legacy-scan> [...args]');
  process.exit(2);
}

/* Windows 上 npx 是 .cmd，必须过 shell；参数统一用双引号包住（cmd 也认双引号）。 */
const line = 'npx -y modern-web-guidance@latest ' + args.map((a) => JSON.stringify(String(a))).join(' ');
const r = spawnSync(line, { stdio: 'inherit', shell: true });
if (r.error) {
  console.error('× 调用 npx 失败：' + r.error.message);
  console.error('  确认 node ≥ 22 且网络可用，或改用 npx -y modern-web-guidance@latest 直接调用。');
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
