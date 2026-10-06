# tools/ —— 开发工具（不参与交付）

这些脚本只在开发与验收时用，**不会**被打进 `dist/sheepit-plus.user.js`。

| 文件 | 作用 |
|---|---|
| `capture-server.mjs` | 把浏览器里已登录的真实页面 POST 到本地落盘，做成夹具（默认 8733） |
| `harness.mjs` | 夹具服务器（默认 8734）：把 `.tmp/fixtures/raw/*.html` 当站点回放，含会话页时间线 JSON、写操作桩、`?fail=1` 故障注入、`/__lab` 取景页 |
| `inspect.mjs` | 交叉校验：直接读夹具，算出「站点自己说的数字」，与界面渲染结果逐项对照 |
| `stitch.py` | 把分片截图拼回整页（滚动截图的补丁工具） |
| `comment-bytes.mjs` | 精确统计注释占多少字节（字符串 / 模板串 / 正则感知）；`build.mjs` 的体积护栏用它 |

## 夹具怎么来

夹具是**你自己账号**的页面快照，含登录态数据，所以不进仓库（`.tmp/` 已被 `.gitignore` 忽略）。做法：

1. 起抓取服务：`node tools/capture-server.mjs`
2. 在你已登录 SheepIt 的浏览器里，把页面 HTML POST 到 `http://127.0.0.1:8733/save?name=<名字>`
3. 文件落到 `.tmp/fixtures/raw/<名字>.html`，`harness.mjs` 按文件名对应路径（见里面的 `FIXTURES` 表）

预设文件名：`_home.html`、`_home_projects.html`、`_ranking_user.html`、`_user_profile.html`、
`edit.html`、`session.html`、`session-timeline.json`。

环境变量：`SP_FIXTURES` 改夹具目录，`SP_PROFILE_FIXTURE` 改 `inspect.mjs` 读的档案文件名。

没有夹具时这些工具会明确报缺文件 —— 它们本来就是「对着自己的账号自测」用的，不是通用测试套件。
