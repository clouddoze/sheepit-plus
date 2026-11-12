# BACKLOG

## 未接管路径（按链接数，来源：`node tools/coverage.mjs`，2026-11-12 基线）

| 路径 | 链接数 | 判定 | 原因 |
|---|---:|---|---|
| `/donation` | 45 | 需拍板 | 支付/资金流程；PRODUCT 用户任务无捐赠，新增 UI 答不出对应任务 |
| `/termsofuse` | 22 | 需拍板 | 长正文，PRODUCT 拍板「不翻译长正文」 |
| `/faq` | 17 | 需拍板 | 同上 |
| `/team` | 11 | 需拍板 | 社区页，是否纳入需拍板 |
| `/servers` | 11 | 需拍板 | 站点状态页，是否纳入需拍板 |
| `/forum` | 11 | 不做 | 独立 phpBB3，PRODUCT 拍板不纳入（`@exclude`） |
| `/user/logout` | 10（动作，不是页面） | **可自主，下一轮候选** | ROADMAP 止血 #3：新版界面缺退出登录入口 |

## 已知噪声

- `/getstarted` 的 console 报错 `ReferenceError: keepPHPSessionAlives is not defined`：站点自己的会话保活函数，harness 把外链脚本桩掉导致；真站有定义，不是本脚本的错。

## 历史欠账

- 上一轮的 50-views 拆分与 regress 工具仍未提交（本轮遵守「一轮最多一个 commit」，未代为提交）。
