// ==UserScript==
// @name         SheepIt Plus · 渲染农场界面重制
// @name:en      SheepIt Plus · Renderfarm UI Rebuild
// @namespace    sheepit-plus
// @version      0.1.0
// @description  把 SheepIt Render Farm 的老旧界面整个换掉：现代化仪表盘、可读的项目列表、精确排行榜，中英双语，明暗双主题。数据全部来自站内页面，不向任何第三方发送。
// @description:en  Rebuild the outdated SheepIt Render Farm UI: a modern dashboard, a readable project list, an accurate ranking. Bilingual (zh/en), dark/light themes. All data is parsed from your own session; nothing is sent anywhere.
// @author       clouddoze
// @match        https://www.sheepit-renderfarm.com/*
// @exclude      https://www.sheepit-renderfarm.com/forum/*
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

/* TODO（首次发布前回填，清单见 docs/PUBLISHING.md 的「四」）：
 *   @namespace    必须在上传前定死 —— Tampermonkey 与 Violentmonkey 都用 @name + @namespace
 *                 认脚本身份，先发布再改会让已装用户收不到更新、并变成两个脚本。现在是占位值
 *                 sheepit-plus，应换成 https://greasyfork.org/users/<用户 ID> 或作者主页 / GitHub 地址。
 *   @updateURL    https://update.greasyfork.org/scripts/<id>/SheepIt%20Plus.meta.js
 *   @downloadURL  https://update.greasyfork.org/scripts/<id>/SheepIt%20Plus.user.js
 *   @homepageURL  脚本页地址 https://greasyfork.org/scripts/<id>
 */
