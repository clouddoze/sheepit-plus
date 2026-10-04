/* ==========================================================================
 * 30-style.js — 样式层
 *
 * 视觉来源：docs/DESIGN.md 的 "Insight Metric Band" 与 "Data Table" 两节。
 * 这里把样张里的样式原样搬过来，只做必要改动：
 *  - 选择器统一加 #sp 前缀，把原站 CSS 完全挡在外面
 *    （id + 类 的选择器优先级高于站点绝大多数规则）
 *  - :root / html[data-theme=light] 的 token 块由 Theme.css('#sp') 生成
 *  - 样张底部的 .demo 切换条是样张专用，不带进产品
 *
 * 三个不能丢的东西，写在最前面：
 *  1) 品牌橙 #e06d58 只用于三处：可操作元素 / 当前选中 / 数据序列中代表"你"。
 *  2) 数值一律制表对齐（.num）。
 *  3) 焦点环、选区、光标、滚动条都要带设计 —— 没画的部分也是被建造的。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Theme } = SP;

  SP.CSS = `
${Theme.css('#sp')}

/* ---------------------------------------------------------------- 骨架 */
#sp{
  position:fixed;inset:0;z-index:2147483000;overflow-y:auto;overflow-x:hidden;
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-size:14px;line-height:1.5;letter-spacing:0;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
#sp *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;line-height:inherit}

/* 浏览器表面：选区 / 光标 / 滚动条 / 焦点环 / 下划线偏移 */
#sp{caret-color:var(--accent);scrollbar-color:var(--border-strong) transparent;scrollbar-width:thin}
#sp ::selection{background:var(--accent-weak);color:var(--text)}
#sp ::-webkit-scrollbar{width:10px;height:10px}
#sp ::-webkit-scrollbar-track{background:transparent}
#sp ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px;border:3px solid var(--bg)}
#sp ::-webkit-scrollbar-thumb:hover{background:var(--text-3)}
#sp :focus{outline:none}
#sp :focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-sm)}
#sp a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}
#sp ul,#sp ol{list-style:none}
#sp button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
#sp table{border-collapse:collapse;width:100%}
#sp img{display:block;max-width:100%}
#sp svg{display:block}
#sp .num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}

#sp .wrap{max-width:1240px;margin:0 auto;padding:0 24px 72px}
@media (max-width:760px){#sp .wrap{padding:0 16px 56px}}

/* ---------------------------------------------------------------- 顶栏 */
#sp .top{
  position:sticky;top:0;z-index:20;min-height:56px;
  display:flex;align-items:center;gap:28px;padding:8px 0;
  border-bottom:1px solid var(--border);
  background:color-mix(in srgb,var(--bg) 86%,transparent);
  backdrop-filter:saturate(1.6) blur(12px);
}
@supports not (background:color-mix(in srgb,var(--bg),transparent)){#sp .top{background:var(--bg)}}
#sp .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;letter-spacing:-.3px;flex:none;text-decoration:none}
#sp .brand .sheep{width:20px;height:20px;flex:none;color:var(--accent)}
#sp .brand em{
  font-style:normal;font-weight:500;font-size:11px;color:var(--text-3);
  border:1px solid var(--border);border-radius:4px;padding:1px 5px;letter-spacing:.4px;
}
#sp nav{display:flex;gap:2px}
#sp nav button{
  padding:6px 11px;border-radius:var(--r-sm);font-size:13.5px;color:var(--text-2);
  transition:background .12s,color .12s;
}
#sp nav button:hover{background:var(--surface-2);color:var(--text)}
#sp nav button[aria-current="page"]{background:var(--surface-2);color:var(--text);font-weight:550}
/* 窄屏用短标签（排行榜→排行、账户设置→账户）。与其把控件藏起来或者让导航横向滚，
   不如让标签本身短一点 —— 五项在 390px 上全都看得见、点得到。 */
#sp nav .navshort{display:none}
#sp .top .spacer{flex:1}
#sp .metaline{font-size:12px;color:var(--text-3);white-space:nowrap}
#sp .who{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);min-width:0}
#sp .who .uname{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .who img{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .who .ini{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;font-size:12px;color:var(--text-3);flex:none}

/* 窄屏顶栏：nav 默认 flex-shrink:1，会被压到 148px 让按钮互相盖住 —— 必须显式禁掉。
   时间戳先让位（刷新按钮已经表达了同一件事），用户名再让位（身份条里有）。 */
@media (max-width:860px){
  #sp .top{gap:12px}
  #sp nav{flex:none}
  #sp .metaline{display:none}
}
@media (max-width:620px){
  #sp .top{gap:8px}
  #sp .brand{font-size:14px}
  #sp .brand .sheep{width:18px;height:18px}
  /* 导航到 5 项之后，390px 上必须让出 PLUS 徽章的位置 —— 标识由羊标 + "SheepIt" 承担 */
  #sp .brand em{display:none}
  #sp nav{gap:0}
  #sp nav button{padding:6px 7px;font-size:13px}
  #sp nav .navfull{display:none}
  #sp nav .navshort{display:inline}
  /* 头像整个撤掉，而不是只藏名字：品牌+导航+刷新已经占满，
     硬塞进来只会把头像挤出视口，在右边缘留下一条 1px 的断边框。
     身份条里有一个 46px 的同款头像，就紧贴在下面。 */
  #sp .who{display:none}
}

/* ---------------------------------------------------------------- 图标按钮 */
#sp .iconbtn{
  width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  transition:border-color .12s,color .12s;
}
#sp .iconbtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .iconbtn .icon{width:14px;height:14px}
#sp .icon{width:15px;height:15px;flex:none}

/* ---------------------------------------------------------------- 按钮 */
#sp .btn{
  display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:8px;font-size:13px;
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  text-decoration:none;transition:border-color .12s,color .12s,background .12s;
}
#sp .btn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .btn.primary:hover{filter:brightness(1.07);color:var(--btn-ink)}
/* 行内维护动作（移除 / 删除）用的小号：它们是次级动作，尺寸上也该退一步，
   否则一列实心同宽的按钮会把列表读成按钮墙。 */
#sp .btn.sm{padding:4px 10px;font-size:12px;border-radius:var(--r-sm)}
#sp .btn .icon{width:14px;height:14px}

/* ---------------------------------------------------------------- 身份条 */
#sp .identity{display:flex;align-items:center;gap:14px;padding:22px 0 18px;flex-wrap:wrap}
#sp .identity .av,#sp .identity img{
  width:46px;height:46px;flex:none;border-radius:12px;overflow:hidden;
  border:1px solid var(--border);background:var(--surface-2);display:block;
}
#sp .identity .av{display:grid;place-items:center;font-size:20px;font-weight:600;color:var(--text-2)}
#sp .identity h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-.3px}
#sp .meta{display:flex;align-items:center;gap:0;flex-wrap:wrap;font-size:12.5px;color:var(--text-2)}
#sp .meta span{padding:0 12px;border-left:1px solid var(--border)}
#sp .meta span:first-child{padding-left:0;border-left:none}
#sp .meta b{font-weight:600;color:var(--text)}

/* ---------------------------------------------------------------- 指标带
   一个整面 + 内部 1px 分隔，不是四张各自为政的卡片 ——
   卡片是最懒的容器，嵌套卡片永远是错的。 */
#sp .kpis{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;box-shadow:var(--shadow);
}
#sp .kpi{padding:18px 20px;border-left:1px solid var(--border);min-width:0}
#sp .kpi:first-child{border-left:none}
#sp .kpi .k{font-size:11.5px;font-weight:500;color:var(--text-3);letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .v{margin-top:8px;font-size:27px;font-weight:600;letter-spacing:-.6px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sp .kpi .d{margin-top:6px;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
/* 强调不作上色：这里只是一个更重的数字，不再给第二支色相。
   全页只有一处绿、且没有第二次使用，那不叫语义色，那叫杂色。 */
#sp .kpi .d b{color:var(--text);font-weight:600}
@media (max-width:860px){
  #sp .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpi:nth-child(3){border-left:none}
  #sp .kpi:nth-child(n+3){border-top:1px solid var(--border)}
}
@media (max-width:560px){
  #sp .kpi{padding:15px 14px}
  #sp .kpi .v{font-size:22px;letter-spacing:-.4px}
}
/* 格数不是常数：多数账号 4 格，建过项目的账号 5–6 格（多出来的是"建的项目 / 订的帧"）。
   4 格的带子（含会话页）一个像素都不动；5–6 格按宽度分三档折行，
   每折一次都要重新分配"哪条内边线该画"—— 否则折行处左边缘会多一条竖线、
   或行与行之间少一条横线。 */
#sp .kpis[data-n="5"]{grid-template-columns:repeat(5,minmax(0,1fr))}
#sp .kpis[data-n="6"]{grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:1200px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(3n+1),#sp .kpis[data-n="6"] .kpi:nth-child(3n+1){border-left:none}
  #sp .kpis[data-n="5"] .kpi:nth-child(n+4),#sp .kpis[data-n="6"] .kpi:nth-child(n+4){border-top:1px solid var(--border)}
}
/* ≤860 折成 2 列（和别的带子一致）。上一档"3n+1 不画左边框"在 2 列下会把第 4 格也去掉，
   而 2 列的行首是奇数格（1/3/5）—— 所以这一档整块重算左边线；上边线沿用上面那条 n+3 的规则。 */
@media (max-width:860px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(n),#sp .kpis[data-n="6"] .kpi:nth-child(n){border-left:1px solid var(--border)}
  #sp .kpis[data-n="5"] .kpi:nth-child(odd),#sp .kpis[data-n="6"] .kpi:nth-child(odd){border-left:none}
}

/* ---------------------------------------------------------------- 主区 */
#sp .grid{display:grid;grid-template-columns:8fr 4fr;gap:16px;margin-top:16px}
@media (max-width:1000px){#sp .grid{grid-template-columns:minmax(0,1fr)}}
#sp .panel{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  box-shadow:var(--shadow);min-width:0;
}
#sp .phead{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:16px 20px 0}
#sp .phead h2{margin:0;font-size:13.5px;font-weight:600;color:var(--text);flex:none;white-space:nowrap}
#sp .phead .sub{font-size:12px;color:var(--text-3);min-width:0}
#sp .phead .sub b{color:var(--text-2);font-weight:600}
#sp .phead .spacer{flex:1}

/* ---------------------------------------------------------------- 图表 */
#sp .chart{position:relative;padding:14px 20px 16px}
#sp .chart svg{display:block;width:100%;overflow:visible}
#sp .tip{
  position:absolute;pointer-events:none;opacity:0;transform:translate(-50%,-100%);
  background:var(--surface-3);border:1px solid var(--border-strong);border-radius:var(--r-sm);
  padding:7px 10px;font-size:12px;color:var(--text);white-space:nowrap;
  box-shadow:var(--shadow);transition:opacity .1s;z-index:5;
}
#sp .tip b{font-weight:600}
#sp .tip i{display:block;font-style:normal;color:var(--text-3);font-size:11px;margin-top:2px}

/* ---------------------------------------------------------------- 产出格
   格子随面板宽度等比缩放：53 周永远装得下，不会被 overflow 裁掉。
   窄屏改成定宽 + 横向滚动 —— 7px 的格子只是噪点，读不出的可视化不算可视化。 */
/* position:relative 是必须的：悬停浮层是 .heatwrap 的子元素，
   而 .tip 是 position:absolute。这一格没有定位，包含块就会一路找到 #sp(fixed)，
   于是浮层按"相对 #sp 内容原点"的坐标去放，实际落在离格子一千多像素的地方 —— 等于没有。 */
#sp .heatwrap{display:flex;gap:8px;position:relative}
/* 星期标签固定不动，只有格子横向滚。
   左侧那一列顶部留一个和月份行等高的占位块，两张网格的行高就自动对齐了 ——
   比"猜一个 padding-top"可靠，字体变了也不会错位。 */
#sp .wdcol{display:flex;flex-direction:column;flex:none;font-size:11px;color:var(--text-3)}
#sp .wdcol .pad{height:13px;margin-bottom:6px}
#sp .wd{display:grid;grid-template-rows:repeat(7,minmax(0,1fr));gap:2px;flex:1;line-height:1}
#sp .wd span{align-self:center;white-space:nowrap}
#sp .heatscroll{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
/* 月份标签与格子共用同一套列宽，所以永远对得齐 */
#sp .mlabels{
  display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:2px;
  font-size:11px;color:var(--text-3);height:13px;margin-bottom:6px;line-height:1;
}
#sp .mlabels span{overflow:visible;white-space:nowrap}
#sp .cells{
  --cols:53;
  display:grid;grid-auto-flow:column;
  grid-template-columns:repeat(var(--cols),minmax(0,1fr));
  grid-template-rows:repeat(7,minmax(0,1fr));
  gap:2px;aspect-ratio:var(--cols) / 7;
}
#sp .cells i{border-radius:2px;background:var(--surface-3);display:block;min-width:0;min-height:0}
#sp .cells i:hover{outline:1px solid var(--border-strong);outline-offset:1px}
@media (max-width:760px){
  #sp .heatwrap{gap:6px}
  #sp .mlabels{grid-template-columns:repeat(var(--cols),14px);gap:3px;width:max-content}
  #sp .cells{
    grid-template-columns:repeat(var(--cols),14px);
    grid-template-rows:repeat(7,14px);
    aspect-ratio:auto;gap:3px;width:max-content;
  }
  /* 窄屏上星期标签挤不下就整列撤掉，日期信息由悬停/点按的浮层承担 */
  #sp .wdcol{display:none}
}
#sp .legend{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-3);margin-top:14px;flex-wrap:wrap}
#sp .legend i{width:11px;height:11px;border-radius:2.5px;display:block;flex:none}
#sp .legend .spacer{flex:1}
#sp .legend b{color:var(--text-2);font-weight:600}

/* ---------------------------------------------------------------- 产出面板与月份条 */
#sp .produce{padding:16px 20px 18px}
#sp .months{display:flex;align-items:flex-end;gap:3px;height:132px}
#sp .months i{flex:1;background:var(--accent);opacity:.34;border-radius:2px 2px 0 0;min-height:2px;transition:opacity .12s}
#sp .months i:hover{opacity:1}
#sp .mlabel{display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:8px;font-variant-numeric:tabular-nums}
#sp .mstat{display:flex;gap:20px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
#sp .mstat div{flex:1;min-width:0}
#sp .mstat .k{font-size:11.5px;color:var(--text-3)}
#sp .mstat .v{font-size:16px;font-weight:600;margin-top:4px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:560px){
  #sp .months{height:96px}
  #sp .mstat{gap:12px}
  #sp .mstat .v{font-size:14px}
}

/* ---------------------------------------------------------------- 全站实时 */
#sp .farm{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;margin-top:16px;box-shadow:var(--shadow);
}
/* 直系子元素选择器是必须的：写成 .farm div 会把内边距加到 .k 和 .row 上，
   一个标签自己就撑成 43px、数值行撑成 83px，整格 159px —— 看着空，其实是内耗。
   注意要用 > 而不是后代选择器。 */
#sp .farm > div{padding:13px 18px;border-left:1px solid var(--border);min-width:0}
#sp .farm > div:first-child{border-left:none}
#sp .farm .k{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
#sp .farm .row{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:7px}
#sp .farm .v{font-size:18px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;line-height:1.1}
/* 走势给一个上限宽度。让它 flex:1 撑满整格，一条 300px 宽、20px 高的线会被拉成
   一道 12:1 的划痕 —— 那是纹理不是趋势。160px / 24px 才看得出起伏。 */
#sp .farm svg{display:block;height:24px;width:100%;max-width:160px;opacity:.85;flex:none}
@media (max-width:860px){
  #sp .farm{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .farm div:nth-child(3){border-left:none}
  #sp .farm div:nth-child(n+3){border-top:1px solid var(--border)}
}
@media (max-width:560px){
  #sp .farm div{padding:12px 13px}
  #sp .farm .v{font-size:16px}
}

/* ---------------------------------------------------------------- 表格 */
#sp .tablewrap{overflow-x:auto}
#sp .tbl{width:100%;border-collapse:collapse;font-size:13px}
#sp .tbl th{
  text-align:left;font-size:11.5px;font-weight:500;color:var(--text-3);
  padding:0 14px 10px;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .tbl th.r,#sp .tbl td.r{text-align:right}
/* 数值列收紧到内容宽度：留白交给名称列，而不是把三个数字摊到半个屏幕上。
   th 和 td 都要 nowrap —— 只给 th 加，列会被压到"32.6"就换行，"GB"掉到第二行。 */
#sp .tbl th.r{width:1%;white-space:nowrap}
#sp .tbl th.r,#sp .tbl td.r{white-space:nowrap}
#sp .tbl th.tight{width:1%;white-space:nowrap}
#sp .tbl th.sortable{cursor:pointer;user-select:none}
#sp .tbl th.sortable:hover{color:var(--text-2)}
#sp .tbl th .arw{opacity:.5;margin-left:4px;display:inline-flex;vertical-align:middle}
#sp .tbl th .arw .icon{width:10px;height:10px}
#sp .tbl td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
#sp .tbl tbody tr:last-child td{border-bottom:none}
#sp .tbl tbody tr{transition:background .1s}
#sp .tbl tbody tr:hover{background:var(--surface-2)}
#sp .tbl tbody tr.me{background:var(--accent-weak)}
#sp .pn{font-weight:550;color:var(--text);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .ow{display:flex;align-items:center;gap:8px;color:var(--text-2)}
#sp .ow img{width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ow .ini{
  width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);
  display:grid;place-items:center;font-size:11.5px;color:var(--text-3);flex:none;
}
#sp .ow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 名字进主页：项目页的发布者与排行榜的用户名都是链接。读数沿用原来那一格，
   只在悬停时给品牌橙 + 下划线 —— 一整列名字都染成链接色，这页就成了链接墙。 */
#sp .ow a.nm{color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#sp .ow a.nm:hover{color:var(--accent);text-decoration:underline}
#sp .ow em{font-style:normal;color:var(--accent);font-weight:600}
/* 发布者那一格：名字 + 「已在优先级名单里」的星 + 一个行内动作。
   星是常驻的（这件事不该等鼠标移上来才知道）；动作按钮默认藏着，
   鼠标移到这一行、或键盘焦点落进这一行时才现身 —— 让整张表在静止时是安静的。
   min-width:0 让发布者名字继续能被截断，而不是把这一列越撑越宽。 */
#sp .ow span{min-width:0}
/* 名字后面那排状态标记：星 = 在渲染优先级名单，心 = 在捐赠名单，禁止符 = 在黑名单。
   常驻显示 —— "我是不是已经把他放进某份名单了"不该等鼠标移上来才知道。 */
#sp .ow .mk{flex:none;display:inline-flex;margin-left:4px;color:var(--accent)}
#sp .ow .mk .icon{width:13px;height:13px}
#sp .ow .btn{margin-left:6px;flex:none}
/* 3 点按钮：「优先 / 移出」怎么藏它就怎么藏（同一套 hover/:focus-within 规则）。
   菜单开着的时候必须一直看得见 —— 鼠标移到浮层上时这一行已经不是 hover 状态了。 */
#sp .ow .kebab{padding:4px 7px}
#sp .ow .kebab .icon{width:13px;height:13px}
#sp .ow .kebab[aria-expanded="true"]{opacity:1;border-color:var(--border-strong);color:var(--text)}

/* 3 点菜单的浮层。它挂在 #sp 里而不是表格里 —— .tablewrap 是 overflow:auto，
   绝对定位的子元素会被它裁掉（最后几行尤其明显）；坐标由 Views.mount() 量一次。
   外观沿用其它浮层：surface 底 + 发丝边 + 环境阴影 + 小圆角。 */
#sp .omenu{
  position:absolute;z-index:30;min-width:224px;padding:5px;
  background:var(--surface-2);border:1px solid var(--border-strong);border-radius:var(--r-sm);
  box-shadow:var(--shadow);
}
#sp .omenu .mh{padding:6px 10px 7px;font-size:11.5px;color:var(--text-3);border-bottom:1px solid var(--border);margin-bottom:5px}
#sp .omenu .mi{display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;color:var(--text-2);text-align:left}
#sp .omenu .mi:hover{background:var(--surface-3);color:var(--text)}
#sp .omenu .mi .mi-ic{flex:none;color:var(--text-3)}
#sp .omenu .mi:hover .mi-ic{color:var(--accent)}
#sp .omenu .mi .mi-ic .icon{width:15px;height:15px}
#sp .omenu .mi .mi-tx{flex:1;min-width:0}
/* 勾放最右边：左边那格留给"这是什么动作"的图标，两个含义不要挤在一个槽里 */
#sp .omenu .mi .mi-ck{width:15px;height:15px;flex:none;color:var(--accent)}
#sp .omenu .mi .mi-ck .icon{width:15px;height:15px}
@media (hover:hover) and (pointer:fine){
  /* 藏的是透明度而不是 display：display:none 会把这个按钮从 Tab 顺序里摘掉。
     触屏（没有 hover）上一直显示，否则这个动作永远点不到。 */
  #sp .ow .btn{opacity:0;transition:opacity .12s}
  #sp .tbl tbody tr:hover .ow .btn,#sp .tbl tbody tr:focus-within .ow .btn{opacity:1}
}
/* 进度条。分数在**自己的列**里（td.frac），不挂在条子后面 —— 挂上去会让每行的轨道长度
   随数字宽度变来变去，一整列参差不齐；进了列，表格布局保证每行轨道等长，分数也右对齐成线。
   .bar 仍被活动汇总表的表头当弹性占位用（见 .acthead .bar），所以这里不给它定 display。 */
#sp .bar{min-width:180px}
#sp .bar .t{position:relative;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .bar .f{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
#sp .tbl td.frac{width:1%;font-size:11.5px;color:var(--text-3)}
#sp .dev{display:inline-flex;gap:4px}
#sp .dev span{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-3)}
#sp .dev span.on{border-color:transparent;background:var(--accent-weak);color:var(--accent);font-weight:600}
/* 状态文案保持中性 —— 品牌橙只留给可操作元素、当前选中、以及数据序列里代表"你"的那条。
   给"渲染中"上橙色会把它变成一堵橙墙，也会稀释橙色本身的意义。 */
#sp .st{font-size:12.5px;color:var(--text-2);white-space:nowrap}
#sp .rankcell{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap}
@media (max-width:760px){
  #sp .tbl{min-width:660px}
  #sp .tbl th,#sp .tbl td{padding-left:12px;padding-right:12px}
}

/* ---------------------------------------------------------------- 工具条 */
#sp .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
#sp .more{display:flex;justify-content:center;padding:14px 0 6px}
#sp .more .btn{gap:9px}
#sp .more .num{color:var(--text-3);font-size:12px}
#sp .input{
  display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:var(--r-sm);background:var(--surface);
  border:1px solid var(--border);min-width:220px;flex:1;max-width:340px;color:var(--text-3);
}
#sp .input input{flex:1;min-width:0;border:none;background:none;color:var(--text);font-size:13px}
/* 焦点环画在整只控件上，而不是里面的输入框上。
   注意：这里绝不能给 input 写 outline:none —— 它的优先级(#sp .input input)
   高过全局的 #sp :focus-visible，会把键盘焦点环整个吃掉，输入框就成了
   键盘用户找不到的控件。改成 :focus-within 让容器亮起来。 */
#sp .input:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
#sp .input input:focus-visible{outline:none}
#sp .input input::placeholder{color:var(--text-3)}
#sp .seg{display:inline-flex;gap:2px;padding:3px;border-radius:8px;background:var(--surface);border:1px solid var(--border);flex-wrap:wrap}
#sp .seg button{padding:5px 11px;border-radius:var(--r-sm);font-size:12.5px;color:var(--text-2)}
#sp .seg button:hover{color:var(--text)}
#sp .seg button[aria-pressed="true"]{background:var(--accent-weak);color:var(--accent);font-weight:600}
#sp .sechead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:26px 0 12px}
#sp .sechead h2{font-size:15px;color:var(--text)}
#sp .sechead .sub{font-size:12px;color:var(--text-3)}
#sp .sechead .spacer{flex:1}

/* ---------------------------------------------------------------- 空状态
   不是"暂无数据"。是"你还没开始，这是怎么开始"。 */
#sp .empty{margin-top:16px}
#sp .empty .inner{
  padding:40px 28px;text-align:center;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);
}
#sp .empty h2{margin:0 0 8px;font-size:16px;font-weight:600}
#sp .empty p{margin:0 auto;max-width:560px;font-size:13.5px;color:var(--text-2);line-height:1.7;text-wrap:pretty}
#sp .steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:760px;margin:26px auto 0;text-align:left}
@media (max-width:760px){#sp .steps{grid-template-columns:minmax(0,1fr)}}
#sp .step{display:flex;gap:11px;align-items:flex-start}
#sp .step .n{
  flex:none;width:20px;height:20px;border-radius:50%;border:1px solid var(--border-strong);
  display:grid;place-items:center;font-size:11px;color:var(--text-3);font-variant-numeric:tabular-nums;
}
#sp .step .h{font-size:13px;font-weight:600;margin-bottom:3px}
#sp .step .b{font-size:12.5px;color:var(--text-3);line-height:1.55}
#sp .empty .cta{margin-top:26px;display:inline-flex;gap:9px;flex-wrap:wrap;justify-content:center}
@media (max-width:560px){#sp .empty .inner{padding:32px 18px}}

/* ---------------------------------------------------------------- 已连接的机器
   一台机器一行：客户端名做成徽章，机型是安静的灰，出口在右边。
   不做成一排卡片 —— 机器数量会变，卡片网格一多就成了"仪表盘壁纸"。 */
#sp .machines{display:flex;flex-direction:column}
#sp .machine{display:flex;align-items:center;gap:12px;padding:11px 20px;border-bottom:1px solid var(--border)}
#sp .machine:last-child{border-bottom:none}
#sp .machine .tag{
  flex:none;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:4px;
  background:var(--accent-weak);color:var(--accent);
}
#sp .machine .spec{flex:1;min-width:0;font-size:13px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .machine a.open{font-size:12px;color:var(--text-3);white-space:nowrap;text-decoration:none}
#sp .machine a.open:hover{color:var(--accent);text-decoration:underline}
#sp .machines .none{padding:16px 20px;font-size:13px;color:var(--text-3)}
@media (max-width:560px){#sp .machine{flex-wrap:wrap;gap:6px 10px;padding:11px 16px}}

/* ---------------------------------------------------------------- 顶栏模式开关 */
#sp .modebtn{
  height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;
  border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);
  color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color .12s,color .12s;white-space:nowrap;
}
#sp .modebtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .modebtn .icon{width:13px;height:13px}
@media (max-width:1000px){#sp .modebtn .txt{display:none}#sp .modebtn{padding:0 7px}}

/* ---------------------------------------------------------------- 账户设置 */
#sp .acct{max-width:820px}
#sp .acct .panel{padding:0}
#sp .acct .phead{padding:16px 20px 0}
/* pbody / hint 是账户设置和会话页共用的两个块，不做两份。
   .settings 里的 .hint 有自己的一条规则，优先级更高，不受这里影响。 */
#sp .pbody{padding:14px 20px 18px}
#sp .hint{font-size:12px;color:var(--text-3);line-height:1.65;margin:0 0 12px}
#sp .sw{display:flex;align-items:flex-start;gap:11px;padding:9px 0;cursor:pointer}
#sp .sw input{position:absolute;opacity:0;width:0;height:0}
#sp .sw .track{
  flex:none;width:34px;height:20px;margin-top:1px;border-radius:10px;background:var(--surface-3);
  border:1px solid var(--border);position:relative;transition:background .14s,border-color .14s;
}
#sp .sw .knob{
  position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--text-3);
  transition:transform .14s,background .14s;
}
#sp .sw input:checked + .track{background:var(--accent);border-color:var(--accent)}
#sp .sw input:checked + .track .knob{transform:translateX(14px);background:var(--btn-ink)}
#sp .sw input:focus-visible + .track{outline:2px solid var(--accent);outline-offset:2px}
#sp .sw .txt{font-size:13px;color:var(--text-2);line-height:1.45}
#sp .sw .txt b{display:block;font-weight:550;color:var(--text)}
#sp .sw .txt small{display:block;font-size:12px;color:var(--text-3);margin-top:2px;line-height:1.55}
#sp .sw:hover .track{border-color:var(--border-strong)}

#sp .ulist{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden}
#sp .ulist .u{display:flex;align-items:center;gap:9px;padding:9px 12px;border-bottom:1px solid var(--border)}
#sp .ulist .u:last-child{border-bottom:none}
#sp .ulist .u img,#sp .ulist .u .ini{width:22px;height:22px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ulist .u .ini{display:grid;place-items:center;font-size:11.5px;color:var(--text-3);background:var(--surface-2)}
#sp .ulist .u .n{flex:1;min-width:0;font-size:13px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .ulist .u .n a{color:inherit}
#sp .ulist .u .n a:hover{color:var(--accent);text-decoration:underline}
#sp .ulist .none{padding:11px 12px;font-size:12.5px;color:var(--text-3)}
#sp .addrow{display:flex;gap:8px;margin-top:11px;flex-wrap:wrap}
#sp .addrow .input{flex:1;min-width:180px;max-width:none}
#sp .keyrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border)}
#sp .keyrow:last-child{border-bottom:none}
#sp .keyrow .k{
  flex:1;min-width:0;font-size:12.5px;color:var(--text-2);letter-spacing:.3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
#sp .keyrow .c{flex:none;font-size:12px;color:var(--text-3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 渲染密钥的状态徽章。「空闲」这一档原来用三级墨色压在下沉层上 —— 实测 4.39:1，
   差 0.11 没到 AA 的 4.5:1（机检在账户页产物上检出来的）。徽章本来也不属于三级墨色
   的用法（那是轴标签/表头/说明的地方），提到二级墨色，约 7.4:1。 */
#sp .keyrow .use{flex:none;font-size:11px;padding:1px 6px;border-radius:4px;background:var(--surface-3);color:var(--text-2)}
#sp .keyrow .use.on{background:var(--accent-weak);color:var(--accent)}
#sp .avatarline{display:flex;align-items:center;gap:14px}
#sp .avatarline img,#sp .avatarline .ini{
  width:64px;height:64px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface-2);flex:none;
}
#sp .avatarline .ini{display:grid;place-items:center;font-size:22px;color:var(--text-3)}
#sp .filepick{
  display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;
}
#sp .filepick:hover{border-color:var(--border-strong);color:var(--text)}
/* 原生的 file input 没法打扮成细边框控件，所以让 label 当按钮。
   但这里绝不能用 display:none —— 那会把它从 Tab 顺序里摘掉，整个产品就多出一个
   键盘够不到、也读屏不到的控件。改成"看不见但还在"：1px、透明、绝对定位。 */
#sp .filepick input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
#sp .filepick:focus-within{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
#sp .toast.ok{border-color:var(--border-strong);color:var(--text)}

#sp .state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:88px 20px;text-align:center}
#sp .state .big{font-size:15px;color:var(--text-2);font-weight:600}
#sp .state .small{font-size:13px;color:var(--text-3);max-width:460px;line-height:1.65}
#sp .spin{width:26px;height:26px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:sp-spin .8s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
#sp .sk{background:linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 37%,var(--surface) 63%);background-size:400% 100%;animation:sp-sk 1.3s ease infinite;border-radius:8px}
@keyframes sp-sk{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* ---------------------------------------------------------------- 会话页
   一台机器的一屏：身份条 → 指标带 → 机器信息 → 机器控制 → 时间线 → 可渲染项目。
   新类名都以 .sess / .fact / .tl / .w 打头，避开 .row 那种撞名（设置页正用着 .row）。 */
#sp .sesshead .chip{
  flex:none;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:4px;
  background:var(--surface-3);color:var(--text-2);white-space:nowrap;
}
/* 暂停是要紧的状态，但状态不是动作：只加边框权重，不动品牌橙 */
#sp .sesshead .chip.off{border:1px solid var(--border-strong);color:var(--text)}

#sp .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
#sp .fact{
  display:flex;align-items:baseline;gap:12px;padding:12px 20px;min-width:0;
  border-top:1px solid var(--border);
}
#sp .fact:nth-child(-n+2){border-top:none}
#sp .fact:nth-child(even){border-left:1px solid var(--border)}
#sp .fact .k{flex:none;font-size:12px;color:var(--text-3);min-width:88px}
#sp .fact .v{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-width:0;font-size:13px;color:var(--text)}
#sp .fact .v a:hover{color:var(--accent)}
#sp .fact .sec{letter-spacing:1px;color:var(--text-3)}
@media (max-width:720px){
  #sp .facts{grid-template-columns:minmax(0,1fr)}
  #sp .fact:nth-child(even){border-left:none}
  #sp .fact:nth-child(-n+2){border-top:1px solid var(--border)}
  #sp .fact:first-child{border-top:none}
  #sp .fact .k{min-width:76px}
}

/* 时间线：761 条事件是日志不是表格，行距收紧到能扫读的密度 */
#sp .tlbar{padding:12px 20px 0}
#sp .tlwrap{padding:12px 6px 6px}
/* 时间线：761 条事件是日志，不是页面正文。给它自己的滚动区，表头才不会跟着滚没
   （两个日期列一旦失去表头就分不清谁是开始谁是结束）；页面也从 5000px 落回 1800px，
   底下的「可渲染项目」才够得着。tabindex 让键盘也能滚这段。 */
#sp .tablewrap.log{max-height:min(58vh,560px);overflow:auto}
#sp .tablewrap.log th{position:sticky;top:0;z-index:1;background:var(--surface)}
#sp .tablewrap.log:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#sp .tbl.dense{font-size:12.5px}
#sp .tbl.dense th{padding:0 14px 8px}
#sp .tbl.dense td{padding:7px 14px}
#sp .tbl.dense .job{color:var(--text-2)}
@media (max-width:720px){#sp .tbl.dense{min-width:560px}}

/* 可渲染项目：与项目页同构的表（项目 / 发布者 / 状态）。
   早先这里是按原因分组的 chip 墙（.wgroup/.wname）—— 站点把同一句原因重复 27 遍，
   当时认为原因本身才是能读的那层信息。用户反馈那一坨不直观，改成表之后原因进了
   「状态」列：同因的行按排序天然相邻，不必再印分组标题，那一列自己就是那层信息。 */
#sp .dash{color:var(--text-3)}
#sp .sess .none{padding:4px 0;font-size:13px;color:var(--text-3)}

/* 活动汇总：时间线的默认视图。一段一行、四个数、一条按渲染时长画的条。
   761 条事件不该占满一屏，它只该回答"这台机器哪天在干活"。
   用 flex 而不是 grid：末尾那列（发送失败）有没有是看数据决定的。 */
#sp .acts{padding:2px 0 0}
#sp .acthead,#sp .actrow{display:flex;align-items:center;gap:12px;padding:0 20px}
#sp .acthead{font-size:11.5px;color:var(--text-3);padding-bottom:8px;border-bottom:1px solid var(--border)}
#sp .actrow{padding-top:9px;padding-bottom:9px;border-bottom:1px solid var(--border);font-size:12.5px;color:var(--text-2)}
#sp .actrow .ad{flex:none;width:64px;color:var(--text)}
#sp .actrow .ab{flex:1;min-width:28px;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .actrow .ab i{display:block;height:100%;background:var(--accent);opacity:.55;border-radius:3px}
#sp .actrow .av{flex:none;width:62px;text-align:right;color:var(--text)}
#sp .actrow .an{flex:none;width:44px;text-align:right}
#sp .actrow .aj,#sp .actrow .af{flex:none;width:44px;text-align:right;color:var(--text-3)}
#sp .actrow .af.on{color:var(--text-2)}
#sp .acthead .ad{flex:none;width:64px}
#sp .acthead .bar{flex:1;min-width:28px}
#sp .acthead .h{flex:none;width:62px;text-align:right}
#sp .acthead .h.s{width:44px}
#sp .tlfoot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px 18px}
#sp .tlfoot .sub{font-size:12px;color:var(--text-3)}
@media (max-width:560px){
  #sp .acthead,#sp .actrow{gap:8px;padding-left:14px;padding-right:14px}
  #sp .actrow .ad{width:52px}
  #sp .actrow .av,#sp .acthead .h{width:52px}
  #sp .actrow .an,#sp .actrow .aj,#sp .actrow .af,#sp .acthead .h.s{width:34px}
}

/* ---------------------------------------------------------------- 设置 */
#sp .settings{max-width:680px;padding:4px 20px}
/* 注意：这些必须限定在 .settings 里。row 这个名字同时被全站实时那条带子
   （.farm .row，数值 + 走势的一行）用着，不加限定的话设置页的 padding:16px 0
   会套到那条带子上，把 24px 的一行撑成 56px。 */
#sp .settings .row{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
#sp .settings .row:last-child{border-bottom:none}
#sp .settings .row .lbl{font-size:13px;font-weight:550;color:var(--text);min-width:104px}
#sp .settings .row.block{display:block}
#sp .settings .row.block .lbl{margin-bottom:10px}
#sp .settings .row .hint{font-size:12px;color:var(--text-3);margin-top:9px;line-height:1.65;max-width:520px}
#sp .foot{font-size:12px;color:var(--text-3);margin-top:26px;text-align:center}
#sp .toast{
  position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
  background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text-2);
  padding:9px 15px;border-radius:var(--r-sm);font-size:12.5px;box-shadow:var(--shadow);z-index:10;
}

/* ---------------------------------------------------------------- 一次编排的动效
   曲线的绘制由 JS 用 getTotalLength() 精确驱动，这里只管其余块的一次性入场。
   "一次性"是字面意思：只有换视图（或刷新）才播。筛选项、排序、显示更多这些只改列表的
   render() 不再重放 —— 加一个筛选条件却让上面那条实时状态带重新淡入一次，
   看起来就像整页在重载（用户报的就是这个）。开关是 #sp 上的 .sp-anim，由 render() 决定。 */
@keyframes sp-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  #sp .chart .area{animation:sp-rise .7s cubic-bezier(.16,1,.3,1) .15s both}
  #sp.sp-anim .kpis,#sp.sp-anim .grid,#sp.sp-anim .farm{animation:sp-rise .5s cubic-bezier(.16,1,.3,1) both}
  #sp.sp-anim .grid{animation-delay:.06s}
  #sp.sp-anim .farm{animation-delay:.1s}
}
`;

  /**
   * 原版界面模式下的"切回现代化"小开关的样式。
   * 单独注入，因为那种模式下整套 SP.CSS 是故意不加载的 —— 它是给 #sp 用的，
   * 而 #sp 在原版模式下根本不存在。这条只有 30 行，也只作用于自己的 id。
   */
  SP.injectModePillStyle = function injectModePillStyle() {
    if (document.getElementById('sp-mode-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-mode-style';
    s.textContent = `
      #sp-mode-pill{
        position:fixed;left:14px;bottom:14px;z-index:2147482000;
        display:inline-flex;align-items:center;gap:8px;
        padding:10px 15px;border-radius:9px;cursor:pointer;
        background:#e06d58;color:#fff;border:1px solid rgba(0,0,0,.2);
        font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        box-shadow:0 2px 6px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.3);
        transition:transform .12s, box-shadow .12s;
      }
      /* 原版模式下整页都是站点自己的样式，这个按钮是唯一属于我们的东西 ——
         它必须一眼看得见：之前是 opacity:.62 的深色小条，实测等于隐形。
         品牌橙在这里用得正当：它是可操作元素。 */
      #sp-mode-pill:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.34)}
      #sp-mode-pill:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #sp-mode-pill svg{width:15px;height:15px;flex:none;fill:#fff}
    `;
    (document.head || document.documentElement).appendChild(s);
  };

  /** 注入样式（幂等） */
  SP.injectStyle = function injectStyle() {
    if (document.getElementById('sp-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-style';
    s.textContent = SP.CSS;
    (document.head || document.documentElement).appendChild(s);
  };

  /**
   * 页面一开始就压住原站 UI，避免闪烁。
   * 用 display:none 而不是 visibility —— 原站的 2013 版 Bootstrap 表头是 fixed 的，
   * 只藏可见性仍会挡住我们。背景色与 token 里的 --bg 一致，避免接管瞬间闪白。
   */
  SP.injectGuard = function injectGuard() {
    if (document.getElementById('sp-guard')) return;
    const s = document.createElement('style');
    s.id = 'sp-guard';
    s.textContent = `
      html{background:#0b0d11}
      @media (prefers-color-scheme:light){html{background:#fbfbfc}}
      body > *:not(#sp){display:none !important}
      body{overflow:hidden !important;background:transparent !important}
    `;
    (document.head || document.documentElement).appendChild(s);
  };
})();
