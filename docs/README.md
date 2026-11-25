# docs 索引

> 只列**当前有效**的文档。历史文档已删除（git 历史里仍可查），不再维护。

## 先读这两份

| 文档 | 内容 |
|---|---|
| [ARCH.md](ARCH.md) | 项目结构、视图层真实结构（共享 IIFE）、已知结构债 |
| [ROADMAP.md](ROADMAP.md) | 接管面、缺口、优先级 |

## 开发约束

| 文档 | 内容 |
|---|---|
| [MODERN-WEB.md](MODERN-WEB.md) | 现代 Web 基线：modern-web-guidance 用法、浏览器支持策略、落地清单 |
| [AUTONOMY.md](AUTONOMY.md) | 自主循环规则 |
| [BACKLOG.md](BACKLOG.md) | 未接管路径与待拍板项 |

## 资产

| 文档 | 内容 |
|---|---|
| [DESIGN.md](DESIGN.md) | 设计系统（视觉方向、token、组件规则） |
| [PUBLISHING.md](PUBLISHING.md) | 发布流程与版本记录 |

## 已删除（git 历史可查）

| 文档 | 为什么删 |
|---|---|
| `CLEANUP-AUDIT.md`（54KB） | 审计已执行完；判定口径沉淀进 `ARCH.md`，过程留在 git 历史 |
| `SWITCH-0LATENCY.md`（22KB） | 结论已落地为 `72-sweep.js`，一次性实测记录不再维护 |
| `STRATEGY-0.4.md`（4.8KB） | 一次性策略，结论已被 0.2.6 的实现超越 |
| `REWRITE-0.2.0.md`（68KB） | 描述的上传链路已整块删除，无对应代码 |
| `design-system.json`（102KB） | DESIGN.md 的机器副本，零引用 |
| `design-proposal.md`（16.7KB） | 视觉方案提案，已被 DESIGN.md 取代 |
