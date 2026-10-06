// 精确统计"注释"占用多少 UTF-8 字节。
//
// 为什么不能朴素地找 // 和 /* */：字符串、模板串、正则字面量里都可能出现这些字符。
// 例如 accept="image/*" 或 CSS 里的 url(a/*) —— 朴素扫描器会把它当成块注释的开始，
// 一路吞到下一个 */，实测把注释字节虚报约 10 KB（把大段代码算成了注释）。
// 这份扫描器带字符串 / 模板串 / 正则感知，扫描逻辑移植自 .tmp/comment-bytes-precise.mjs
// （上一轮压缩注释时验证过的那份），只改成可导出的函数形式。
//
// 口径：注释字节 = 原文字节 − 剥掉注释后的代码字节（含被注释带走的换行）。

/**
 * 剥掉注释，返回剩下的代码。
 *
 * @param {string} src 源码
 * @param {{ stripTemplate?: boolean }} [options]
 *   stripTemplate：模板字符串里的 /* *\/ 是否也当注释剥掉。默认 false（保守）。
 *   只有明确知道模板里装的是 CSS（src/30-style.js）时才适合开 —— 对普通模板串开这个开关，
 *   会把 image/* 这类内容误判成注释起始，反而数错。
 */
export function stripComments(src, options = {}) {
  const stripTemplate = options.stripTemplate === true;
  let out = ''; let i = 0; const n = src.length;
  const stack = [{ type: 'code' }]; let prev = '';
  const push = (c) => { out += c; if (c.trim()) prev = c; };
  const atCode = () => stack[stack.length - 1].type !== 'tpl';
  while (i < n) {
    const c = src[i]; const c2 = src[i + 1];
    if (!atCode()) {
      if (c === '\\') { push(c); if (c2 !== undefined) push(c2); i += 2; continue; }
      if (c === '`') { push(c); i++; stack.pop(); continue; }
      if (c === '$' && c2 === '{') { push('$'); push('{'); i += 2; stack.push({ type: 'interp', depth: 0 }); continue; }
      if (stripTemplate && c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
      push(c); i++; continue;
    }
    if (c === '/' && c2 === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; push(c); i++;
      while (i < n) { const ch = src[i]; if (ch === '\\') { push(ch); push(src[i + 1]); i += 2; continue; } push(ch); i++; if (ch === q) break; }
      continue;
    }
    if (c === '`') { push(c); i++; stack.push({ type: 'tpl' }); continue; }
    if (c === '/' && /[=(,:[!&|?{};+\-*%^~<>]/.test(prev || '(')) {
      push(c); i++; let cls = false;
      while (i < n) { const ch = src[i]; if (ch === '\\') { push(ch); push(src[i + 1]); i += 2; continue; } if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) { push(ch); i++; break; } push(ch); i++; }
      continue;
    }
    const top = stack[stack.length - 1];
    if (top.type === 'interp') {
      if (c === '{') { top.depth++; push(c); i++; continue; }
      if (c === '}') { if (top.depth === 0) { push(c); i++; stack.pop(); continue; } top.depth--; push(c); i++; continue; }
    }
    push(c); i++;
  }
  return out;
}

/**
 * 统计一段代码里的注释字节。
 *
 * @param {string} code
 * @param {{ stripTemplate?: boolean }} [options] 透传给 stripComments
 * @returns {{ totalBytes: number, commentBytes: number, codeBytes: number }}
 *   totalBytes：原文 UTF-8 字节；codeBytes：剥掉注释后剩下的字节；
 *   commentBytes：两者之差。三者满足 commentBytes + codeBytes === totalBytes。
 */
export function countCommentBytes(code, options = {}) {
  const totalBytes = Buffer.byteLength(code, 'utf8');
  const codeBytes = Buffer.byteLength(stripComments(code, options), 'utf8');
  return { totalBytes, commentBytes: totalBytes - codeBytes, codeBytes };
}
