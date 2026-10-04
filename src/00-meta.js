// ==UserScript==
// @name         SheepIt Plus · 渲染农场界面重制
// @name:en      SheepIt Plus · Renderfarm UI Rebuild
// @namespace    https://github.com/clouddoze
// @version      0.1.10
// @description  给 SheepIt Render Farm 换一套新前端：仪表盘、项目列表、排行榜、会话页、账户设置；中英双语、明暗双主题。数据读自站点自己的页面，不向第三方发送。
// @description:en  A new front end for SheepIt Render Farm: dashboard, project list, ranking, session page, account settings. Bilingual (zh/en), dark and light. All data is read from the site's own pages.
// @author       clouddoze
// @match        https://www.sheepit-renderfarm.com/*
// @exclude      https://www.sheepit-renderfarm.com/forum/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://greasyfork.org/scripts/598624
// @supportURL   https://greasyfork.org/scripts/598624/feedback
// @updateURL    https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/598624/SheepIt%20Plus%20%C2%B7%20%E6%B8%B2%E6%9F%93%E5%86%9C%E5%9C%BA%E7%95%8C%E9%9D%A2%E9%87%8D%E5%88%B6.user.js
// ==/UserScript==

/* 回填记录（清单见 docs/PUBLISHING.md 的「四」，2026-10-04 首次发布时填妥）：
 *
 *   @namespace   https://github.com/clouddoze —— 首次上传前定死，此后不可再改。
 *                Tampermonkey 与 Violentmonkey 用 @name + @namespace 认脚本身份，
 *                发布后改动会让已装用户收不到更新，并在他们那里变成两个脚本。
 *
 *   @updateURL / @downloadURL 里的中文 slug 是 GreasyFork 给的那一条（脚本页「安装此脚本」
 *                的原样地址）。服务端按 /scripts/<id>/ 取脚本，slug 只影响可读性 ——
 *                实测换成 SheepIt%20Plus.user.js 也能取到，但跟站点保持一致最稳。
 *
 *   以后发新版：改上面的 @version → node build.mjs → 在 GreasyFork 脚本页点「更新」。
 *   已装用户由 @updateURL 拉 .meta.js 比对版本号，所以 @version 必须往上走。
 */
