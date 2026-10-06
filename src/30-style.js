/* ==== 30-style.js：整份 CSS ==== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  const { Theme } = SP;

  SP.CSS = `
${Theme.css('#sp')}
/* .sp-acmenu 单独生成一份：唯一长在 #sp 外面的家具（jQuery UI 的补全菜单挂在 <body> 上）。
   不能合并成选择器列表 Theme.css('#sp, ul.sp-acmenu') —— 两处条件选择器只绑最后一项，实测暗色下整壳变白。 */
${Theme.css('ul.sp-acmenu')}

/* ==== 骨架 ==== */
#sp{
  position:fixed;inset:0;z-index:2147483000;overflow-y:auto;overflow-x:hidden;
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-size:14px;line-height:1.5;letter-spacing:0;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
#sp *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;line-height:inherit}

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

/* ==== 顶栏 ==== */
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
#sp nav .navshort{display:none}
#sp .top .spacer{flex:1}
#sp .metaline{font-size:12px;color:var(--text-3);white-space:nowrap}
#sp .who{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);min-width:0}
#sp .who .uname{font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .who img{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .who .ini{width:26px;height:26px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;font-size:12px;color:var(--text-3);flex:none}

/* nav 默认 flex-shrink:1，窄屏被压到 148px、按钮互相盖住 —— 必须显式 flex:none。 */
@media (max-width:860px){
  #sp .top{gap:12px}
  #sp nav{flex:none}
  #sp .metaline{display:none}
}
@media (max-width:620px){
  #sp .top{gap:8px}
  #sp .brand{font-size:14px}
  #sp .brand .sheep{width:18px;height:18px}
  #sp .brand em{display:none}
  #sp nav{gap:0}
  #sp nav button{padding:6px 7px;font-size:13px}
  #sp nav .navfull{display:none}
  #sp nav .navshort{display:inline}
  /* 头像整个撤掉而不是只藏名字：硬塞会被挤出视口，在右缘留下一条 1px 断边框。 */
  #sp .who{display:none}
}

/* ==== 图标按钮 ==== */
#sp .iconbtn{
  width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:var(--r-sm);
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  transition:border-color .12s,color .12s;
}
#sp .iconbtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .iconbtn .icon{width:14px;height:14px}
#sp .icon{width:15px;height:15px;flex:none}

/* ==== 按钮 ==== */
#sp .btn{
  display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:8px;font-size:13px;
  border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;
  text-decoration:none;transition:border-color .12s,color .12s,background .12s;
}
#sp .btn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .btn.primary:hover{filter:brightness(1.07);color:var(--btn-ink)}
#sp .btn.sm{padding:4px 10px;font-size:12px;border-radius:var(--r-sm)}
#sp .btn .icon{width:14px;height:14px}

/* ==== 身份条 ==== */
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

/* ==== 指标带 ==== */
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
/* 格数不是常数：多数账号 4 格，建过项目的 5–6 格（data-n）。
   每折一次都要重算该画哪条内边线，否则折行处多一条竖线、或少一条横线。 */
#sp .kpis[data-n="5"]{grid-template-columns:repeat(5,minmax(0,1fr))}
#sp .kpis[data-n="6"]{grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:1200px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(3n+1),#sp .kpis[data-n="6"] .kpi:nth-child(3n+1){border-left:none}
  #sp .kpis[data-n="5"] .kpi:nth-child(n+4),#sp .kpis[data-n="6"] .kpi:nth-child(n+4){border-top:1px solid var(--border)}
}
/* ≤860 折 2 列：上一档 3n+1 会连第 4 格一起去掉，所以整块重算左边线。 */
@media (max-width:860px){
  #sp .kpis[data-n="5"],#sp .kpis[data-n="6"]{grid-template-columns:repeat(2,minmax(0,1fr))}
  #sp .kpis[data-n="5"] .kpi:nth-child(n),#sp .kpis[data-n="6"] .kpi:nth-child(n){border-left:1px solid var(--border)}
  #sp .kpis[data-n="5"] .kpi:nth-child(odd),#sp .kpis[data-n="6"] .kpi:nth-child(odd){border-left:none}
}

/* ==== 主区 ==== */
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

/* ==== 图表 ==== */
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

/* ==== 产出格 ==== */
/* .tip 是 .heatwrap 的绝对定位子元素：这一格不定位，包含块会一路找到 #sp(fixed)，
   浮层实测落在离格子一千多像素的地方。 */
#sp .heatwrap{display:flex;gap:8px;position:relative}
/* 左列顶部留一个与月份行等高的占位块（.pad），两张网格的行高就自动对齐。 */
#sp .wdcol{display:flex;flex-direction:column;flex:none;font-size:11px;color:var(--text-3)}
#sp .wdcol .pad{height:13px;margin-bottom:6px}
#sp .wd{display:grid;grid-template-rows:repeat(7,minmax(0,1fr));gap:2px;flex:1;line-height:1}
#sp .wd span{align-self:center;white-space:nowrap}
#sp .heatscroll{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
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
  #sp .wdcol{display:none}
}
#sp .legend{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-3);margin-top:14px;flex-wrap:wrap}
#sp .legend i{width:11px;height:11px;border-radius:2.5px;display:block;flex:none}
#sp .legend .spacer{flex:1}
#sp .legend b{color:var(--text-2);font-weight:600}

/* ==== 产出面板与月份条 ==== */
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

/* ==== 全站实时 ==== */
#sp .farm{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
  overflow:hidden;margin-top:16px;box-shadow:var(--shadow);
}
/* 必须用 > 而不是后代选择器：.farm div 会把内边距加到 .k / .row 上，整格撑到 159px。 */
#sp .farm > div{padding:13px 18px;border-left:1px solid var(--border);min-width:0}
#sp .farm > div:first-child{border-left:none}
#sp .farm .k{font-size:11.5px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
#sp .farm .row{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-top:7px}
#sp .farm .v{font-size:18px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;line-height:1.1}
/* 走势给一个上限宽度：flex:1 撑满整格，会把线拉成一道 12:1 的划痕。 */
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

/* ==== 表格 ==== */
#sp .tablewrap{overflow-x:auto}
#sp .tbl{width:100%;border-collapse:collapse;font-size:13px}
#sp .tbl th{
  text-align:left;font-size:11.5px;font-weight:500;color:var(--text-3);
  padding:0 14px 10px;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .tbl th.r,#sp .tbl td.r{text-align:right}
/* 数值列收紧到内容宽度：th 和 td 都要 nowrap —— 只给 th 加，列会被压窄换行、单位掉到第二行。 */
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
#sp .pnwrap{display:flex;align-items:center;gap:7px;min-width:0}
#sp .pnwrap .pn{flex:0 1 auto;min-width:0}
#sp .ow{display:flex;align-items:center;gap:8px;color:var(--text-2)}
#sp .ow img{width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);flex:none}
#sp .ow .ini{
  width:20px;height:20px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-2);
  display:grid;place-items:center;font-size:11.5px;color:var(--text-3);flex:none;
}
#sp .ow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sp .ow a.nm{color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#sp .ow a.nm:hover{color:var(--accent);text-decoration:underline}
#sp .ow em{font-style:normal;color:var(--accent);font-weight:600}
#sp .ow span{min-width:0}
/* .mk 常驻显示：星 = 在渲染优先级名单，心 = 在捐赠名单，禁止符 = 在黑名单。 */
#sp .ow .mk{flex:none;display:inline-flex;margin-left:4px;color:var(--accent)}
#sp .ow .mk .icon{width:13px;height:13px}
#sp .ow .btn{margin-left:6px;flex:none}
#sp .ow .kebab{padding:4px 7px}
#sp .ow .kebab .icon{width:13px;height:13px}
#sp .ow .kebab[aria-expanded="true"]{opacity:1;border-color:var(--border-strong);color:var(--text)}

/* .omenu 挂在 #sp 里而不是表格里：.tablewrap 是 overflow:auto，绝对定位子元素会被它裁掉。 */
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

#sp .omenu .mi .mi-ck{width:15px;height:15px;flex:none;color:var(--accent)}
#sp .omenu .mi .mi-ck .icon{width:15px;height:15px}
@media (hover:hover) and (pointer:fine){
  /* 藏的是 opacity 不是 display：display:none 会把按钮从 Tab 顺序里摘掉；触屏没有 hover，一直显示。 */
  #sp .ow .btn{opacity:0;transition:opacity .12s}
  #sp .tbl tbody tr:hover .ow .btn,#sp .tbl tbody tr:focus-within .ow .btn{opacity:1}
}
/* 分数放自己的列（td.frac）：挂在条子后面，轨道长度会随数字宽度变化、整列参差不齐。 */
#sp .bar{min-width:180px}
#sp .bar .t{position:relative;height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
#sp .bar .f{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
#sp .tbl td.frac{width:1%;font-size:11.5px;color:var(--text-3)}
#sp .dev{display:inline-flex;gap:4px}
#sp .dev span{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-3)}
#sp .dev span.on{border-color:transparent;background:var(--accent-weak);color:var(--accent);font-weight:600}
/* 状态列在会话页放的是站点给的一整句原因（"Not enough free memory, requiring: …"），
   而 .st 原来既 nowrap 又没有上限 → 整列被最长那句撑到 376px，表格溢出容器出横向滚条
   （实测差 129px）。给个上限 + 省略号，完整原因走 title。 */
#sp .st{font-size:12.5px;color:var(--text-2);white-space:nowrap;display:inline-block;max-width:210px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
#sp .rankcell{font-variant-numeric:tabular-nums;color:var(--text-3);white-space:nowrap}
@media (max-width:760px){
  #sp .tbl{min-width:660px}
  #sp .tbl th,#sp .tbl td{padding-left:12px;padding-right:12px}
}

/* ==== 工具条 ==== */
#sp .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
#sp .more{display:flex;justify-content:center;padding:14px 0 6px}
#sp .more .btn{gap:9px}
#sp .more .num{color:var(--text-3);font-size:12px}
#sp .input{
  display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:var(--r-sm);background:var(--surface);
  border:1px solid var(--border);min-width:220px;flex:1;max-width:340px;color:var(--text-3);
}
#sp .input input{flex:1;min-width:0;border:none;background:none;color:var(--text);font-size:13px}
/* 焦点环画在整只控件上，绝不能给 input 写 outline:none —— #sp .input input 优先级高过
   全局的 #sp :focus-visible，会把键盘焦点环整个吃掉；改用 :focus-within 让容器亮起来。 */
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

/* ==== 空状态 ==== */
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

/* ==== 已连接的机器 ==== */
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

/* ==== 顶栏模式开关 ==== */
#sp .modebtn{
  height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;
  border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);
  color:var(--text-2);font-size:12px;cursor:pointer;transition:border-color .12s,color .12s;white-space:nowrap;
}
#sp .modebtn:hover{border-color:var(--border-strong);color:var(--text)}
#sp .modebtn .icon{width:13px;height:13px}
@media (max-width:1000px){#sp .modebtn .txt{display:none}#sp .modebtn{padding:0 7px}}

/* ==== 账户设置 ==== */
#sp .acct{max-width:820px}
#sp .acct .panel{padding:0}
#sp .acct .phead{padding:16px 20px 0}
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
/* 状态徽章的墨色：三级墨实测 4.39:1、差 0.11 没到 AA，提到二级墨约 7.4:1。 */
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
/* file input 让 label 当按钮，但绝不能 display:none —— 那会把它从 Tab 顺序里摘掉；改成 1px 透明。 */
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

/* ==== 会话页 ==== */
#sp .sesshead .chip{
  flex:none;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:4px;
  background:var(--surface-3);color:var(--text-2);white-space:nowrap;
}
/* 会话页的状态徽章两者都上色（用户 2026-10-04 拍板，DESIGN.md 里记为一次具名例外）：
   实心说「开着」、浅底说「要你处理」，没破「只用一个色相」—— 靠强度分。 */
#sp .sesshead .chip.on{background:var(--accent);color:var(--btn-ink);border:1px solid var(--accent)}
#sp .sesshead .chip.off{background:var(--accent-weak);color:var(--accent);border:1px solid transparent}

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


#sp .tlbar{padding:12px 20px 0}
#sp .tlwrap{padding:12px 6px 6px}
/* 事件表给独立滚动区：表头 sticky 才不跟着滚没，页面高度从 5000px 落回 1800px。 */
#sp .tablewrap.log{max-height:min(58vh,560px);overflow:auto}
#sp .tablewrap.log th{position:sticky;top:0;z-index:1;background:var(--surface)}
#sp .tablewrap.log:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#sp .tbl.dense{font-size:12.5px}
#sp .tbl.dense th{padding:0 14px 8px}
#sp .tbl.dense td{padding:7px 14px}
#sp .tbl.dense .job{color:var(--text-2)}
@media (max-width:720px){#sp .tbl.dense{min-width:560px}}

#sp .now{flex:none;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--accent-weak);color:var(--accent);white-space:nowrap}
#sp .dash{color:var(--text-3)}
#sp .sess .none{padding:4px 0;font-size:13px;color:var(--text-3)}

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

/* ==== 设置 ==== */
#sp .settings{max-width:680px;padding:4px 20px}
/* 必须限定在 .settings 里：.farm .row 也叫 row，不加限定设置页的 padding 会套过去、把一行撑成 56px。 */
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

/* ==== 上传页 / 分析等待页（局部换装）====
   站点渲染的表单 / 估算器 / 进度条原样搬过来：addproject.js 认 id 不认外观，不重实现上传逻辑。 */

/* 必须 align-items:start 而不是 stretch：估算结果撑高右卡时，stretch 会把左卡一起拉长（用户实报）。 */
#sp .up-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start;margin-top:16px}
#sp .up-col{display:contents}
#sp .up-grid .panel{min-width:0}
#sp .up-rules{grid-column:1 / -1}
@media (max-width:900px){#sp .up-grid{grid-template-columns:minmax(0,1fr)}}
#sp .up .panel{padding:0}
#sp .up-body{padding:14px 20px 18px}
#sp .up-body > :last-child{margin-bottom:0}
#sp .up-src{font-size:12px;color:var(--text-3);line-height:1.65;margin:12px 20px 18px;padding-top:12px;border-top:1px solid var(--border)}
#sp .expnote{
  margin:0 0 16px;padding:11px 14px;border:1px solid var(--border);border-radius:var(--r-sm);
  background:var(--surface);color:var(--text-2);font-size:12.5px;line-height:1.7;
}

#sp .up-rules .up-body h4{
  font-size:12px;font-weight:600;color:var(--text-3);letter-spacing:.02em;
  margin:22px 0 10px;padding-top:18px;border-top:1px solid var(--border);
}
#sp .up-rules .up-body h4:first-child{margin-top:0;padding-top:0;border-top:none}
#sp .up-rules .up-body p{margin:0 0 14px;max-width:76ch;font-size:12.5px;color:var(--text-2);line-height:1.75}
/* 试过把数字钉到卡片最右（空出 686px）、给说明分两栏（「积分」被劈开），都不行；
   正解：说明限宽 44em、数字紧跟其后一行。 */
#sp .up-rules .qband{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-bottom:6px}
#sp .up-rules .qtext p{margin:0;max-width:44em}
#sp .up-rules .qdata{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 30px;min-width:0;padding-top:1px}
#sp .up-rules .qdata .qlead{margin:0;font-size:12px;color:var(--text-3);max-width:none}
#sp .up-rules .qdata .qtotal{margin:0}

#sp .up-rules .up-body .qpos{display:flex;flex-direction:row;flex-wrap:wrap;gap:6px 26px;margin:0}
#sp .up-rules .up-body .qpos li{padding-left:0;font-size:12.5px;color:var(--text-3)}
#sp .up-rules .up-body .qpos li::before{display:none}
#sp .up-rules .up-body .qpos li strong{
  margin-left:6px;font-size:15px;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;
}
#sp .up-rules .up-body .qtotal{display:inline;margin:0;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums}

/* 多栏只对块级容器生效：ul 在别处是 flex 列，这里要还原成 block（.qpos 是数据，排除）。 */
@media (min-width:820px){
  #sp .up-rules .up-body ul:not(.qpos){display:block;columns:2;column-gap:36px}
  #sp .up-rules .up-body ul:not(.qpos) li{break-inside:avoid;margin-bottom:9px}
}
@media (min-width:1200px){
  #sp .up-rules .up-body ul:not(.qpos){columns:3}
}

/* ==== 抹掉原站外观 ==== */
#sp .up-body .w-section,#sp .up-body .w-box,#sp .up-body .container,
#sp .up-body .sign-in-wr,#sp .up-body .blog-post{
  padding:0;margin:0;background:none;border:none;box-shadow:none;border-radius:0;max-width:none;width:auto;
}
#sp .up-body .row{margin:0}
/* 站点那套栅格也要一起抹掉：搬来的「须知」列是 col-md-6，Bootstrap 给它 float:left +
   width:50%，内容只占卡片左半边（实测那列 744px，卡片正文 1488px）。.input-group 同类坑已
   踩三次。（本文件整段 CSS 是一个模板字符串，注释里不能出现反引号。） */
#sp .up-body [class*="col-md-"],#sp .up-body [class*="col-sm-"],
#sp .up-body [class*="col-xs-"],#sp .up-body [class*="col-lg-"]{float:none;width:auto;max-width:none;padding:0;margin:0}
#sp .up-body h4{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--text)}
#sp .up-body p{margin:0 0 14px;font-size:13px;color:var(--text-2);line-height:1.75}
#sp .up-body ul{margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#sp .up-body ul li{position:relative;padding-left:15px;font-size:12.5px;color:var(--text-2);line-height:1.7}
#sp .up-body ul li::before{content:"";position:absolute;left:0;top:.66em;width:4px;height:4px;border-radius:50%;background:var(--text-3)}
#sp .up-body strong{color:var(--text);font-weight:600}
#sp .up-body a{color:var(--accent)}
#sp .up-body #addproject_warning_zero_frame{font-size:13px}

#sp .up-body form table,
#sp .up-body form tbody,
#sp .up-body form tr,
#sp .up-body form td{display:block;width:auto;padding:0}
#sp .up-body form td{text-align:left !important;vertical-align:baseline !important}
#sp .up-body form td:first-child{font-size:12px;color:var(--text-3);margin-bottom:8px}
#sp .up-body form td + td{margin-bottom:16px}
#sp .up-body form td:last-child{margin-bottom:0}
#sp .up-body form br + strong{color:var(--text-2)}


#sp .up-body input[type=file]{
  display:block;width:100%;padding:11px 12px;margin:0 0 10px;
  background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:var(--r-sm);
  color:var(--text-3);font-size:12.5px;cursor:pointer;transition:border-color .12s,color .12s;
}
#sp .up-body input[type=file]:hover{border-color:var(--accent);color:var(--text-2)}
#sp .up-body input[type=file]::file-selector-button{
  font:inherit;font-weight:600;margin:0 12px 0 0;padding:6px 12px;border-radius:var(--r-sm);
  border:1px solid var(--border-strong);background:var(--surface-3);color:var(--text);cursor:pointer;
}
#sp .up-body input[type=file]::file-selector-button:hover{border-color:var(--accent);color:var(--accent)}
#sp .up-body .note{display:block;margin-top:1px;font-size:12px;color:var(--text-3);line-height:1.65}

#sp .up-body input[type=submit],#sp .up-body button.btn,#sp .up-body input.btn{
  font:inherit;font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--r-sm);
  background:var(--accent);border:1px solid var(--accent);color:var(--btn-ink);cursor:pointer;
  transition:filter .12s;
}
#sp .up-body input[type=submit]:hover,#sp .up-body button.btn:hover,#sp .up-body input.btn:hover{filter:brightness(1.07)}

/* 站点内联写死了 #EEB0A0 的底色，只能用 !important 压过去 —— 必要的例外。 */
#sp .up-body #upload_progress_bar{
  height:7px !important;margin:2px 0 8px !important;border-radius:4px;
  background:var(--surface-2) !important;border:1px solid var(--border) !important;
}
#sp .up-body #upload_progress_bar .ui-progressbar-value{
  background:var(--accent) !important;border:none !important;border-radius:3px;margin:0;height:100%;
}
#sp .up-body #upload_progress_label{
  position:static !important;text-shadow:none !important;text-align:right;
  display:block;font-size:11.5px;color:var(--text-3);padding:0 0 6px;
}

/* 这一行用的是 2013 版 Bootstrap 的 .input-group（table-cell + float），没管住时等效宽度
   949px、OK 的右缘超出视口 5px；整行重声明成普通 flex 并给输入封顶。 */
#sp .up-body input[type=text],#sp .up-body input.form-control{
  font:inherit;font-size:13px;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface-2);border:1px solid var(--border);color:var(--text);
}
#sp .up-body table input[type=text]{width:92px}
/* 估算器那两个数字是「标签 + 值」两列，站点用的是内容自适应 <table>，这里摊平成两列网格
   （标签列必须 max-content）。只认 .numband：站点稍后返回的结果表格是另一个形状，被误伤过
   一次 —— 单元格被摊成网格项，分块数和耗时对调了。 */
#sp [data-up="est"] .numband{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:10px 14px;align-items:center;width:auto;margin:0 0 16px}
#sp [data-up="est"] .numband tbody,#sp [data-up="est"] .numband tr{display:contents}
#sp [data-up="est"] .numband td{display:block;padding:0;text-align:left !important;white-space:nowrap}
#sp .up-body input[type=text]:focus,#sp .up-body input.form-control:focus{outline:none;border-color:var(--accent)}
#sp .up-body form.form-inline{display:block;margin:0 0 14px}
#sp .up-body .input-group{display:flex;flex-wrap:nowrap;align-items:stretch;gap:8px;width:100%}
#sp .up-body .input-group .form-control{flex:1 1 auto;min-width:0;width:auto;max-width:320px}
#sp .up-body .input-group-btn{display:flex;flex:0 0 auto;width:auto;white-space:nowrap}
#sp .up-body .input-group-btn > *{flex:0 0 auto}
#sp .up-body #addproject_estimator_result{
  font-size:12.5px;color:var(--text-2);line-height:1.7;
  padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2);
}
#sp .up-body #addproject_estimator_result:empty{display:none}
/* 站点返回的结果表带 Bootstrap 的 .table，在深色卡片里白底白字（用户实报），整段按我们的表格重画。 */
#sp .up-body #addproject_estimator_result table{
  width:100%;border-collapse:collapse;background:none;color:var(--text-2);font-size:12.5px;margin:0;
  border:none !important;   /* .table-bordered 表格本身也画了一圈边框 */
}
#sp .up-body #addproject_estimator_result thead th,
#sp .up-body #addproject_estimator_result th{
  background:none;color:var(--text-3);font-weight:600;font-size:11.5px;
  text-align:left;padding:0 14px 8px 0;border-bottom:1px solid var(--border);white-space:nowrap;
}
#sp .up-body #addproject_estimator_result td{
  background:none;padding:9px 14px 9px 0;border-bottom:1px solid var(--border);
  color:var(--text-2);vertical-align:baseline;
}
#sp .up-body #addproject_estimator_result tr:last-child td{border-bottom:none}
#sp .up-body #addproject_estimator_result td:last-child,
#sp .up-body #addproject_estimator_result th:last-child{padding-right:0}
#sp .up-body #addproject_estimator_result strong,#sp .up-body #addproject_estimator_result b{color:var(--text);font-weight:600}
#sp .up-body #addproject_estimator_result .num,#sp .up-body #addproject_estimator_result td strong{
  font-variant-numeric:tabular-nums;
}
#sp .up-body #addproject_estimator_result h4{margin:16px 0 8px;font-size:13px;font-weight:600;color:var(--text)}
#sp .up-body #addproject_estimator_result h4:first-of-type{margin-top:2px}
#sp .up-body #addproject_estimator_result > br:first-child{display:none}
/* 站点给耗时套了 Bootstrap 绿色小标签。调色板里没有绿色，2026-10-04 用户确认保持中性、
   不恢复红 / 绿语义，别再翻回去。 */
#sp .up-body #addproject_estimator_result .label{
  background:none !important;border:none !important;color:var(--text) !important;
  font-size:12.5px !important;font-weight:600;padding:0 !important;
  text-shadow:none;border-radius:0;
}
/* 只要一条下边发丝线；Bootstrap 的 .table-bordered 是四边框，整段拆掉 */
#sp .up-body #addproject_estimator_result .table-bordered > thead > tr > th,
#sp .up-body #addproject_estimator_result .table-bordered > tbody > tr > td{
  border:none;border-bottom:1px solid var(--border);
}
/* 斑马纹画在 <tr> 上（奇数行 #f9f9f9），只清 td 的底色是盖不住的 */
#sp .up-body #addproject_estimator_result tbody tr{background-color:transparent !important}
/* 站点给这些单元格写了内联的 text-align:center，只能用 !important 压过去（同类例外） */
#sp .up-body #addproject_estimator_result th,
#sp .up-body #addproject_estimator_result td{text-align:left !important}

/* 设备名补全菜单是 jQuery UI 的 widget，挂在 <body> 上 —— 唯一一件长在 #sp 外面的家具
   （见 injectGuard：挂进 #sp 会被 CSS zoom 把定位算成 0）。选择器因此不带 #sp，用我们
   自己的类名 .sp-acmenu 划边界，不碰站点可能有的其他 .ui-autocomplete。 */
body > ul.sp-acmenu{
  position:absolute;z-index:2147483001;margin:0;padding:4px;list-style:none;
  max-height:280px;overflow:auto;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);
  box-shadow:0 14px 30px rgba(0,0,0,.30);
  font:400 12.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;
  color:var(--text-2);
}
body > ul.sp-acmenu li{margin:0;padding:7px 10px;border-radius:4px;list-style:none;cursor:pointer;color:var(--text-2)}
body > ul.sp-acmenu li.ui-state-focus,body > ul.sp-acmenu li:hover{background:var(--surface-2);color:var(--text)}

/* ==== 分析等待页 ==== */
#sp .an-card{padding:0}
#sp .an-head{display:flex;gap:15px;align-items:flex-start;padding:24px 20px 0}
#sp .an-head .spin{flex:none;margin-top:2px}
#sp .an-state{font-size:15px;font-weight:600;color:var(--text)}
#sp .an-sub{font-size:12.5px;color:var(--text-3);line-height:1.75;margin-top:7px;max-width:640px}
#sp .an-track{height:6px;margin:18px 20px 0;border-radius:3px;background:var(--surface-2);overflow:hidden}
#sp .an-track i{display:block;height:100%;width:0;background:var(--accent);border-radius:3px;transition:width .35s ease}
#sp .an-track.indet i{width:32%;animation:sp-indet 1.15s ease-in-out infinite}
@keyframes sp-indet{from{margin-left:-32%}to{margin-left:100%}}
#sp .an-done{padding:20px 20px 0}
#sp .an-done .an-sub{margin-bottom:14px}
#sp .an-foot{padding:0 20px 20px}

/* 分析完成后站点把它自己那套「新增项目」表单塞进 #sp-an-result，本版没重制，只做可读性兜底。 */
#sp .sp-siteform{padding:18px 20px 20px;border-top:1px solid var(--border)}
#sp .sp-siteform section,#sp .sp-siteform .slice,
#sp .sp-siteform .container,#sp .sp-siteform .w-section,#sp .sp-siteform .w-box,
#sp .sp-siteform .form-light,#sp .sp-siteform .padding-15{
  padding:0;margin:0;background:none;border:none;box-shadow:none;border-radius:0;max-width:none;width:auto;
}
#sp .sp-siteform .row{margin:0}
#sp .sp-siteform [class*="col-md-"],#sp .sp-siteform [class*="col-sm-"]{float:none;width:auto;padding:0}
#sp .sp-siteform h4{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--text)}
#sp .sp-siteform hr{margin:18px 0;border:none;border-top:1px solid var(--border)}
#sp .sp-siteform label{font-size:12.5px;color:var(--text-2)}
#sp .sp-siteform .form-group{margin-bottom:14px}
#sp .sp-siteform input[type=text],#sp .sp-siteform input[type=number],#sp .sp-siteform input.form-control,
#sp .sp-siteform select,#sp .sp-siteform textarea{
  font:inherit;font-size:13px;padding:8px 10px;border-radius:var(--r-sm);
  background:var(--surface-2);border:1px solid var(--border);color:var(--text);max-width:100%;
}
#sp .sp-siteform input[type=checkbox],#sp .sp-siteform input[type=radio]{accent-color:var(--accent);margin-right:7px}
#sp .sp-siteform input[type=submit],#sp .sp-siteform button{
  font:inherit;font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--r-sm);
  background:var(--accent);border:1px solid var(--accent);color:var(--btn-ink);cursor:pointer;
}
#sp .sp-siteform .checkbox,#sp .sp-siteform .persistent{display:block;margin:0 0 12px}
#sp .sp-siteform .error,#sp .sp-siteform div[style*="color:red"]{color:var(--accent) !important;font-size:12.5px}

/* 项目管理页 /project/<数字>：站点那一整块（.w-section，含 #jobs_of_a_project 与右侧图例/页签）由
   80-app.js 的 wireManageDoc **搬**进 #sp-mg-host。结构、id、内联 onclick 全没动，这里只把它从原站
   的深色底改成我们的卡片外观；两列仍用站点自己的 bootstrap 栅格（那套 CSS 本来就在这一页里加载）。 */
#sp .sp-manage{padding:18px 20px 20px;color:var(--text-2)}
#sp .sp-manage .w-section,#sp .sp-manage .container,#sp .sp-manage .w-box,
#sp .sp-manage .padding-15,#sp .sp-manage [class*="col-md-"]{padding:0;margin:0;background:none;border:none;box-shadow:none;max-width:none}
/* 别改 .row 的布局方式：站点用 bootstrap 的 float 栅格，8/4 栏加起来正好 100%，
   一旦给 .row 加 display:flex + gap，多出来的 gap 会把右栏挤到下一行（实测两栏会竖着叠）。 */
#sp .sp-manage .row{margin:0}
#sp .sp-manage .row::after{content:'';display:block;clear:both}
#sp .sp-manage h2{margin:0 0 8px;font-size:14.5px;font-weight:600;color:var(--text)}
#sp .sp-manage h4{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text)}
#sp .sp-manage a{color:var(--accent);text-decoration:none}
#sp .sp-manage a:hover{text-decoration:underline}
#sp .sp-manage ul{padding:0;margin:0;list-style:none}
#sp .sp-manage .meta-list{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 0}
#sp .sp-manage li{font-size:12.5px;color:var(--text-3);line-height:1.95}
#sp .sp-manage .meta-list li[class^="msg_"]{font-weight:600;color:var(--text-2)}
#sp .sp-manage .breadcrumb{display:none}
/* 站点那几个方块本来就是「卡片」：它们的底色/边框被上面统一掉了，这里按我们的样式还回来，
   免得整页糊成一片（Summary 与项目卡是 .w-box，右栏图例/页签是 .widget）。 */
#sp .sp-manage .w-box,#sp .sp-manage .widget{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:14px}
#sp .sp-manage .widget-heading{margin:0 0 10px}
/* 图例：站点用三个 .square 当色块，色是 bootstrap 的 btn-neutral/warning/default */
#sp .sp-manage .legend{display:flex;gap:16px;flex-wrap:wrap}
#sp .sp-manage .legend a{display:flex;align-items:center;gap:7px;color:var(--text-2);font-size:12.5px;text-decoration:none}
#sp .sp-manage .legend i{display:none}
#sp .sp-manage .legend .square{width:14px !important;height:14px !important;margin:0 !important;border-radius:3px;border:none}
#sp .sp-manage .legend .btn-neutral{background:var(--text-3)}
#sp .sp-manage .legend .btn-warning{background:#e0a13a}
#sp .sp-manage .legend .btn-default{background:var(--surface-3);border:1px solid var(--border-strong)}
#sp .sp-manage div[style*="color:red"]{color:var(--accent) !important}
#sp .sp-manage .nav-tabs{display:flex;gap:4px;margin:16px 0 12px;border-bottom:1px solid var(--border)}
#sp .sp-manage .nav-tabs > li{margin:0}
#sp .sp-manage .nav-tabs > li > a{display:block;padding:7px 12px;font-size:12.5px;border:1px solid transparent;border-bottom:none;border-radius:var(--r-sm) var(--r-sm) 0 0;text-decoration:none;color:var(--text-2)}
#sp .sp-manage .nav-tabs > li > a:hover{text-decoration:none;color:var(--text)}
#sp .sp-manage .nav-tabs > li.active > a{background:var(--surface-2);border-color:var(--border);color:var(--text)}
#sp .sp-manage .btn:not(.square){font:inherit;font-size:12.5px;padding:7px 12px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);cursor:pointer;box-shadow:none;text-shadow:none;text-decoration:none}
#sp .sp-manage .btn:not(.square):hover{border-color:var(--border-strong);color:var(--text);text-decoration:none}
#sp .sp-manage .btn-primary:not(.square){background:var(--accent);border-color:var(--accent);color:var(--btn-ink);font-weight:600}
#sp .sp-manage .btn:not(.square).btn-danger{color:var(--accent);border-color:var(--accent-weak)}
#sp .sp-manage .btn-round i{display:none}   /* 图标是 FA4 类名、站点只装了 FA6：::before 根本没内容，留着就是空心圆 */
/* 站点把 .btn-round 钉成 34×34 的圆（配一个根本画不出来的图标），字写进去就被裁掉 */
#sp .sp-manage .btn-round{width:auto !important;height:auto !important;border-radius:var(--r-sm) !important;padding:6px 10px !important}
/* 站点给 .btn.square 上了 !important 的 16×16：帧缩略图与图例色块必须跟着用 !important 才拨得动 */
#sp .sp-manage .square{display:inline-block;width:22px !important;height:22px !important;margin:0 6px 0 0 !important;padding:0 !important;border-radius:4px;border:1px solid var(--border);vertical-align:middle;text-align:center;overflow:hidden}
#sp .sp-manage .square img{display:block;width:100% !important;height:100% !important;object-fit:cover;border-radius:3px}
#sp .sp-manage input[type=text],#sp .sp-manage input.form-control{font:inherit;font-size:12.5px;padding:7px 9px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);color:var(--text);max-width:100%}
#sp .sp-manage input[type=text]::placeholder{color:var(--text-3)}
#sp .sp-manage input[type=checkbox],#sp .sp-manage input[type=radio]{accent-color:var(--accent);margin-right:7px;vertical-align:middle}
#sp .sp-manage label{font-size:12.5px;color:var(--text-2);margin:0}
#sp .sp-manage .form-inline,#sp .sp-manage .checkbox{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#sp .sp-manage .tiles{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#sp .sp-manage .tiles .square{width:80px !important;height:60px !important;margin:0 !important}
/* 站点给 .tab-content 铺了白底 + 边框，在暗色主题下是一块亮斑 */
#sp .sp-manage .tab-content{background:none;border:none;padding:0;box-shadow:none}
#sp .sp-manage .tab-pane{padding:0}
#sp .sp-manage .tab-pane img{display:inline-block;vertical-align:middle;height:16px;margin:0 3px}
#sp .sp-manage .tab-pane input[type=radio]{margin:0 2px 0 10px}
#sp .sp-manage .text-right{text-align:right}
#sp .sp-manage .sp-mg-badge{font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;background:var(--accent-weak);color:var(--accent)}

/* 只有换视图（或刷新）才播：筛选 / 排序 / 显示更多的 render() 不再重放，否则实时状态带
   重新淡入，看起来像整页在重载。开关是 #sp 的 .sp-anim。 */
@keyframes sp-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
  #sp .chart .area{animation:sp-rise .7s cubic-bezier(.16,1,.3,1) .15s both}
  #sp.sp-anim .kpis,#sp.sp-anim .grid,#sp.sp-anim .farm{animation:sp-rise .5s cubic-bezier(.16,1,.3,1) both}
  #sp.sp-anim .grid{animation-delay:.06s}
  #sp.sp-anim .farm{animation-delay:.1s}
}
`;

  /* 原版界面模式下「切回现代化」小开关的样式：那种模式下整套 SP.CSS 故意不加载（它给 #sp 用）。 */
  /* 左下角两个开关（「进入 / 切回新界面」与「译 ZH」）共用一个竖排容器，上下顺序由 CSS 的 order 决定 —— 两者由不同代码路径挂载，靠插入顺序排是赌运气。 */
  SP.cornerHost = function cornerHost() {
    const host = document.getElementById('sp-corner');
    if (host) return host;
    const s = document.createElement('style');
    s.id = 'sp-corner-style';
    s.textContent = `
      #sp-corner{position:fixed;left:14px;bottom:14px;z-index:2147482000;
        display:flex;flex-direction:column;align-items:flex-start;gap:8px}
    `;
    (document.head || document.documentElement).appendChild(s);
    const box = document.createElement('div');
    box.id = 'sp-corner';
    (document.body || document.documentElement).appendChild(box);
    return box;
  };

  SP.injectModePillStyle = function injectModePillStyle() {
    if (document.getElementById('sp-mode-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-mode-style';
    s.textContent = `
      #sp-mode-pill{
        order:2;position:static;
        display:inline-flex;align-items:center;gap:8px;
        padding:10px 15px;border-radius:9px;cursor:pointer;
        background:#e06d58;color:#fff;border:1px solid rgba(0,0,0,.2);
        font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        box-shadow:0 2px 6px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.3);
        transition:transform .12s, box-shadow .12s;
      }
      /* 原版模式下这个按钮是唯一属于我们的东西，必须一眼看得见：之前 opacity:.62 的深色小条实测等于隐形。 */
      #sp-mode-pill:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.4), 0 10px 28px rgba(0,0,0,.34)}
      #sp-mode-pill:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #sp-mode-pill svg{width:15px;height:15px;flex:none;fill:#fff}
    `;
    (document.head || document.documentElement).appendChild(s);
  };

  SP.injectStyle = function injectStyle() {
    if (document.getElementById('sp-style')) return;
    const s = document.createElement('style');
    s.id = 'sp-style';
    s.textContent = SP.CSS;
    (document.head || document.documentElement).appendChild(s);
  };

  /* 一开始压住原站 UI 防闪烁：用 display:none 而非 visibility —— 原站 2013 版 Bootstrap 表头是 fixed 的，只藏可见性仍会挡住我们。 */
  SP.injectGuard = function injectGuard() {
    if (document.getElementById('sp-guard')) return;
    const s = document.createElement('style');
    s.id = 'sp-guard';
    /* 唯一的例外 .sp-acmenu：jQuery UI 的补全菜单由我们的控件创建，却被它挂在 <body> 上，
       不放开的表现是「输入了没反应」。不 appendTo 进 #sp 的原因：实测在 #sp 的 CSS zoom 下
       jQuery 的 offset() 会把差值算成 0，菜单落到左上角。 */
    s.textContent = `
      html{background:#0b0d11}
      @media (prefers-color-scheme:light){html{background:#fbfbfc}}
      body > *:not(#sp):not(.sp-acmenu){display:none !important}
      body{overflow:hidden !important;background:transparent !important}
    `;
    (document.head || document.documentElement).appendChild(s);
  };
})();
