# SheepIt Plus

把 [SheepIt Render Farm](https://www.sheepit-renderfarm.com) 的界面换成一套现代前端。
油猴脚本：读取站点自己的页面，重绘成仪表盘、项目、排行榜、会话、上传与设置。中英双语，明暗双主题。

## 安装

1. 装一个用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
2. 从 [GreasyFork](https://greasyfork.org/scripts/598624) 安装
3. 刷新 SheepIt 页面

`@grant none`，不需要额外权限；数据只来自站点页面，不向第三方发送。

## 能做什么

- **总览**：统计卡、积分与帧数曲线、渲染活跃日历、在线机器
- **项目 / 排行榜**：搜索、筛选、排序；发布者操作（渲染优先级、捐赠积分、黑名单）
- **会话页**：机器状态、按天活动汇总、暂停 / 恢复
- **账户设置**：调度与名单、捐赠积分、头像 / 邮箱 / 渲染密钥
- **上传项目**：上传 → 分析等待 → 项目设置（设置里可切回站点原版上传页）
- **界面**：主题、界面缩放、语言；未重建的页面只把文案翻译成当前语言

## 用回原版

顶栏一键「切回原版界面」，原版模式下也有入口切回新版。
站点改版导致解析器认不出时，脚本会明说，并把那一页交回站点自己的界面。

## 说明

- 第三方界面重制，与 SheepIt Render Farm 官方无隶属关系；MIT 许可。
- 已知限制：原站 CSS/JS 仍会下载（只是被隐藏）；未重建的页面保持原版布局，仅翻译文案。
- 代码与文案由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下写成。
- 开发、发布与设计文档见 [`docs/`](docs/)。

## English

A userscript that gives [SheepIt Render Farm](https://www.sheepit-renderfarm.com) a modern front end:
dashboard, projects, ranking, session page, upload and settings — Chinese/English, dark and light.
Install from [GreasyFork](https://greasyfork.org/scripts/598624). Third-party rebuild, MIT licensed.
