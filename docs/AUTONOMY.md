# 自主改进循环

> P8 自主循环的规则与记录。一轮只做一件事，一轮最多一个 commit。

## 规则表

| 判定 | 范围 | 例子 |
|---|---|---|
| 可自主 | 已有视图的入口补齐、数据解析修正、小缺陷、未接管阅读页接管 | `/user/logout` 入口、`/ranking/machine` |
| 需拍板 | 支付/资金、账户写操作、长正文翻译、论坛、社区页、发布/版本 | `/donation`、`/termsofuse`、`/faq`、`/forum`、`/team`、`/servers` |
| 禁止 | 改断言、改基线、改 PRODUCT.md；连续两轮改同一文件；一轮多个 commit | — |

判定口径：
- 用户任务来自 `.notes/PRODUCT.md`（看贡献 / 浏览项目 / 排行榜定位自己）。答不出对应任务的 UI 不新增。
- 选中的路径不在「可自主」→ 写进 `docs/BACKLOG.md`，本轮结束，不改代码。
- 链接数来自 `node tools/coverage.mjs`（真站点夹具里的 `href` 计数）。

## 每轮流程

1. `node tools/coverage.mjs` —— 接管面 + 未接管排行
2. `node tools/regress.mjs` —— 基线是否漂移
3. 6 页 console（排除 `Bad masonry`）
4. 选题：未接管排行第一；为零则取 regress 失败项
5. 假设：一句，带链接数/夹具/报错证据
6. 实施：最小范围，一次只碰一个视图文件或一个模块
7. 验证：`node build.mjs --check && node tools/regress.mjs`；真站探测 `spCount=1`、无新错
8. 收尾：全绿 commit + 更新 coverage 基线；变红 `git checkout` 回滚 + 失败写 BACKLOG

## 记录

| 日期 | 选题 | 结果 | 失败原因 |
|---|---|---|---|
| 2026-11-12 | `/donation`（45 次，未接管第一） | 判定不可自主，写进 BACKLOG，本轮不改代码 | 支付/资金流程，PRODUCT 用户任务无捐赠；接管需用户拍板 |
