# SheepIt Plus

把 [SheepIt Render Farm](https://www.sheepit-renderfarm.com) 的界面换成一套现代前端。
油猴脚本：读取站点自己的页面，重绘成仪表盘、项目、排行榜、团队、实况、会话与设置。明暗双主题；**新界面中英双语，切回原版就是站点原样（不翻译）**。

## 安装

1. 装一个用户脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) / [Violentmonkey](https://violentmonkey.github.io/)
2. 从 [GreasyFork](https://greasyfork.org/scripts/598624) 安装
3. 刷新 SheepIt 页面

`@grant none`，不需要额外权限；数据只来自站点页面，不向第三方发送。

## 能做什么

- **总览**：统计卡、积分与帧数曲线、渲染活跃日历、在线机器
- **项目 / 排行榜**：搜索、筛选、排序；发布者操作（渲染优先级、捐赠积分、黑名单）；排行榜分「用户 / 机器」两档，机器榜按 CPU / GPU 分数段
- **实况**：全站此刻在跑什么、谁在跑——指标带、产出与在线趋势、项目与设备分布、正在渲染的帧与在线机器两张明细表
- **团队**：团队排行榜（搜索、分页）、团队详情（成员、在线状态 = 排名标签颜色）、我的团队高亮、创建 / 退出 / 解散 / 申请加入
- **会话页**：机器状态、按天活动汇总、暂停 / 恢复；完整日志按作业分组、可按事件类型筛选
- **账户设置**：调度与名单、捐赠积分、头像 / 邮箱 / 渲染密钥；优先级名单就地增删
- **界面**：主题、界面缩放、语言、导航项显隐（总览与设置常开）
- **上传项目**：**不接管**。点顶栏「上传项目」直接打开站点原版页（上游改动频繁，自绘维护成本高于收益）

## 用回原版

顶栏一键「切回原版界面」，原版模式下左下角也有入口切回新版。
两套界面住在同一个页面里：切换只是把对方露出来 —— **不刷新、不重新加载、不做过渡动画**，点完就是另一套界面。新版那边的界面状态和滚动位置都还在。
站点改版导致解析器认不出时，脚本会明说，并把那一页交回站点自己的界面。

## 说明

- 第三方界面重制，与 SheepIt Render Farm 官方无隶属关系；MIT 许可。
- 已知限制：原站 CSS/JS 仍会下载（新版下被隐藏 —— 这也是切回原版能瞬间完成的原因）；未重建的页面（FAQ / 上传 / 登录）保持站点原样，**不做翻译**。
- 已知限制：当前看的视图不属于这个地址时（例如从 `/home` 点「设置」），切回原版要打开那一页，会走一次正常加载。
- 代码与文案由 AI 助手（DeepSeek Harness）在人的指令与逐项验收下写成。
- 开发、发布与设计文档见 [`docs/`](docs/)；前端现代化约束见 [`docs/MODERN-WEB.md`](docs/MODERN-WEB.md)。

## English

A userscript that gives [SheepIt Render Farm](https://www.sheepit-renderfarm.com) a modern front end:
dashboard, projects, ranking, teams, live farm status, session page and settings — Chinese/English, dark and light.
Project upload is deliberately not rebuilt: the entry opens the site's own page. Switching between the two UIs is instant: no reload, no transition animation.
Install from [GreasyFork](https://greasyfork.org/scripts/598624). Third-party rebuild, MIT licensed.
