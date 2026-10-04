/* ==========================================================================
 * 12-lang-zh.js — 中文语言包
 *
 * 三层结构，对应三类站点文案：
 *   site     短词条，精确匹配单个文本节点（导航、按钮、标题、表头）
 *   blocks   整块替换：被 <a>/<strong>/<em> 切碎的句子。键是整块归一化文本，
 *            值是 HTML（可以保留链接）。纯文本节点替换救不了这类句子，
 *            因为语序会碎掉。
 *   patterns 带变量的文案（"13 Rendering frames"），用捕获组回填。
 *
 * 加一门语言就是照着这个文件再写一个 —— 不需要改任何逻辑代码。
 * ========================================================================== */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  SP.I18n.register('zh', {
    label: '中文',

    /* ------------------------------------------------ 短词条 */
    site: {
      /* 导航 / 顶栏 */
      'Toggle navigation': '切换导航',
      'Home': '首页',
      'Get started': '开始使用',
      'Projects': '项目',
      'Teams': '团队',
      'Forum': '论坛',
      'FAQ': '常见问题',
      'Servers': '服务器',
      'Donate': '捐赠',
      'Store': '商店',

      /* 用户菜单 */
      'Please sign in': '请登录',
      'Create a new account': '创建新账户',
      'Switch to dark theme': '切换到暗色主题',
      'Switch to light theme': '切换到亮色主题',
      'My account': '我的账户',
      'Edit profile': '编辑资料',
      'Log out': '退出登录',

      /* 页脚 */
      'Latest projects': '最新项目',
      'Social': '社交',
      'Help us': '支持我们',
      'We need you to keep the service alive. Help us now!': '我们需要你的支持才能维持这项服务，现在就帮我们一把！',
      'Top renderers over 30 day rolling period': '近 30 天渲染榜',
      'Terms of use': '使用条款',
      'Privacy policy': '隐私政策',

      /* 首页 */
      'SheepIt is a free distributed renderfarm for Blender. Try it now!': 'SheepIt 是一个面向 Blender 的免费分布式渲染农场，立刻试试！',
      'Free': '免费',
      'No subscription, no credit card.': '无需订阅，无需信用卡。',
      'Free forever — since 2007.': '自 2007 年起永久免费。',
      'User-friendly': '易用',
      'Submit and track your renders from your browser.': '在浏览器中提交并跟踪你的渲染任务。',
      'No Blender installation required to help render.': '帮忙渲染无需安装 Blender。',
      'Collaborative': '协作',
      'Join in and start helping the community.': '加入进来，开始帮助社区。',
      'Always up to date': '始终最新',
      'New Blender versions supported within days.': '新的 Blender 版本数天内即可支持。',
      'Cycles, Eevee, and Workbench included.': '包含 Cycles、Eevee 和 Workbench。',
      'Frames remaining': '待渲染帧',
      'Active projects': '进行中项目',
      'Connected clients': '在线客户端',
      'Processing frames': '正在处理帧',
      'Sheepit power': '羊群算力',
      'computed frames per hour': '帧/小时',
      'to complete all projects': '可完成全部项目',
      'How many months of rendering do we complete every day?': '我们每天完成多少个月的渲染量？',
      'History': '历史',
      'total frames rendered': '累计渲染帧数',
      'computed projects': '已完成项目',
      'Latest news': '最新动态',
      'Read more': '阅读更多',

      /* 开始使用 */
      'Get started!': '开始使用！',
      'The render farm relies on you to live; the more computers that are connected to the system, the better the service will be.':
        '渲染农场靠你而活：接入的机器越多，服务质量就越好。',
      "You don't need to have Blender installed, it will be downloaded for you.": '你不需要安装 Blender，客户端会自动下载。',
      'Your own project will be rendered first, then your computer will help other users.':
        '你自己的项目会优先渲染，之后你的电脑再帮助其他用户。',
      "If you don't want to share your computer, but still help SheepIt, you should consider donating":
        '如果你不想共享电脑，但仍想支持 SheepIt，可以考虑捐赠',
      'Download the client and start rendering now.': '下载客户端，立刻开始渲染。',
      'Minimum client requirements': '客户端最低要求',
      'Add your project': '添加你的项目',
      'Estimator': '估算器',
      'Waiting list': '排队情况',
      'Predicted position in queue:': '预计排队位置：',
      'CPU:': 'CPU：',
      'GPU:': 'GPU：',
      'Render time:': '渲染耗时：',
      'minutes per frame.': '分钟/帧。',
      'Number of frames:': '帧数：',
      'frames.': '帧。',
      'Before adding a file to the render farm you should check if:': '把文件加入渲染农场前，请先确认以下几点：',
      'The render engine is compatible.': '渲染引擎受支持。',
      'Image output size must be under a width of 8,000 px, and a height of 8,000 px.':
        '输出图片的宽和高都必须小于 8,000 px。',
      'Maximum tile file size 50.0 MB': '单个分块文件上限 50.0 MB',
      'Blender compression is recommended and supported.': '推荐并支持 Blender 压缩。',
      'The 20 minute rule is intended to ensure that even small computers can render any project.':
        '「20 分钟规则」是为了保证即使小电脑也能渲染任何项目。',
      'Maximum image resolution 4096x2160 px.': '最大图像分辨率 4096x2160 px。',
      'Maximum image file size 50.0 MB': '最大图像文件大小 50.0 MB',
      'Full frame renders only. No split-layers or checkerboarding.': '仅支持整帧渲染，不支持分层渲染或棋盘式分割。',
      'Only animations are supported, no single image projects.': '仅支持动画项目，不支持单张图片。',
      'Use of compression is required (any of pxr24, zip, piz, rle, zips, dwaa, dwab).':
        '必须使用压缩（pxr24、zip、piz、rle、zips、dwaa、dwab 任选其一）。',
      'Limitation on EXR support:': 'EXR 支持限制：',
      'There is a': '这里有',
      'list of average power per machine': '各机器的平均算力列表',
      'check out the faq for more info': '详见 FAQ',
      'nudity': '色情',
      'racist': '种族主义',
      'content is allowed.': '内容。',
      'Be aware that': '请注意：',
      'scripts are disabled due to security reasons.': '出于安全原因，脚本已被禁用。',
      'Your blend version is': '你的 blend 版本需要是',
      'or higher.': '或更高。',
      'You set the output file to an': '你需要把输出文件设为',
      'image': '图片',
      ', for example jpg or png.': '，例如 jpg 或 png。',
      'The path to external data is': '外部数据的路径必须是',
      'relative': '相对路径',
      'File names': '文件名',
      'must not be locale specific': '不能包含本地化字符',
      ', i.e. do not put any accents in filenames.': '，也就是说文件名里不要出现重音符号。',
      'You should keep the render time per frame (or split) under 20 min (on the reference machine)':
        '每帧（或每个分块）的渲染时间应控制在 20 分钟以内（以基准机器计）',
      '. As an example,': '。例如，',
      'this scene': '这个场景',
      'will be rendered in 20min on the reference machine (i5-9600).': '在基准机器（i5-9600）上需要 20 分钟。',
      'You can add up to': '你最多可以添加',
      'File': '文件',
      'ZIP compression': 'ZIP 压缩',
      ', but make sure to use relative paths for all files in the archive.': '，但要确保压缩包内所有文件都使用相对路径。',
      'You can use a': '你可以使用',
      'single blend file': '单个 blend 文件',
      ', with packed textures.': '，并打包贴图。',
      'Or a': '或者使用',
      'ZIP file': 'ZIP 文件',

      /* 服务器 */
      "SheepIt's servers": 'SheepIt 的服务器',
      'network': '网络',
      "The 'SheepIt network' is handled by four type of servers:": '「SheepIt 网络」由四类服务器组成：',
      'We are always looking for new servers. If you are interested in lending us a server, please contact us through Discord.':
        '我们一直在寻找新的服务器。如果你有兴趣提供服务器，请通过 Discord 联系我们。',
      'Requirements for sharing a server:': '共享服务器的要求：',
      'A dedicated IP and dedicated hardware are required.': '需要独立 IP 和独立硬件。',
      'You can not run a shepherd on your home network.': '不能在你的家庭网络上运行 shepherd。',
      'Requirement': '要求',
      'Shepherd': 'Shepherd 节点',
      'Uptime': '在线率',
      'critical': '关键',
      'Installation': '安装',
      'RAM': '内存',
      'Disk usage': '磁盘占用',
      'Traffic per month': '每月流量',
      'Shepherds status': 'Shepherd 节点状态',
      'Server': '服务器',
      'Processing': '处理中',
      'Storage': '存储',
      'Tasks': '任务',
      'binary mirror': '二进制镜像',
      ": stores Blender binary copy. Traffic is handled by Cloudflare's CDN.": '：存放 Blender 二进制副本，流量由 Cloudflare CDN 承载。',
      'project mirror': '项目镜像',
      ': stores blend file copy. Traffic is handled by Cloudflare\'s CDN.': '：存放 blend 文件副本，流量由 Cloudflare CDN 承载。',
      'shepherd': 'shepherd',
      '(blue): stores the actual render. Creates zip and mp4.': '（蓝色）：存放实际渲染结果，生成 zip 和 mp4。',
      '(yellow), situated in Texas, USA. It handles users, project creation and rendering request.':
        '（黄色），位于美国德州，负责用户、项目创建和渲染请求。',

      /* 错误页 / 通用 */
      'Back to homepage': '返回首页',
      'The page could not be found': '找不到该页面',
      'The Sheep is out there!': '羊就在外面！',
      'Forbidden': '无权限',
      'You are not allowed to manage this project.': '你没有权限管理这个项目。',
      'Loading': '加载中',

      /* 属性文案（title / alt / placeholder） */
      'CPU disabled': 'CPU 已禁用',
      'cpu disabled': 'CPU 已禁用',
      'GPU nvidia enabled': 'GPU（NVIDIA）已启用',
      'gpu enabled': 'GPU 已启用',
      'Login': '用户名',
      'Password': '密码',
      'Email': '邮箱',
      'Search': '搜索',
      'Close': '关闭',
      'Next': '下一页',
      'Previous': '上一页',
      'Send this file': '发送此文件',
      'To Top': '回到顶部',
      'Processor or GPU name': '处理器或 GPU 名称',
      'PayPal - The safer, easier way to pay online!': 'PayPal —— 更安全、更便捷的在线支付方式',
      'Donate with PayPal button': '使用 PayPal 捐赠',
      'Become a Patron': '成为赞助者',
      /* 估算器返回的那段结果：站点渲染的英文片段，落进我们的卡片里。
         用 DomI18n.translateSubtree() 翻 —— 它允许翻译器走进 #sp。 */
      'How much your project will cost you': '你的项目会花掉多少积分',
      'How you could split your project': '可以怎么拆分',
      'Your project will cost you up to': '你的项目最多会花掉',
      'Having a very low render time is not necessarily a good thing. Please keep the render time over 1 minute.':
        '渲染时间太短未必是好事 —— 请把单块渲染时间保持在 1 分钟以上。',
      'Number of tiles': '分块数',
      'Expected render time': '预计耗时',
      'No split': '不拆分',
    },

    /* ------------------------------------------------ 整块替换（值是 HTML，可保留链接）
     * 键是「翻译前」的整块归一化文本，必须与页面实际拼接结果一致。
     * 获取真实键的办法：把 translateSite 设为 false 打开页面，控制台执行
     *   __SHEEPIT_PLUS__.DomI18n.reportUnmatched(20)
     */
    blocks: {
      "The render farm relies on you to live; the more computers that are connected to the system, the better the service will be. You don't need to have Blender installed, it will be downloaded for you. Your own project will be rendered first, then your computer will help other users. If you don't want to share your computer, but still help SheepIt, you should consider donating.":
        '渲染农场靠你而活：接入的机器越多，服务质量就越好。<br>你不需要安装 Blender，客户端会自动为你下载。<br>你自己的项目会优先渲染，之后你的电脑再帮助其他用户。<br>如果你不想共享电脑，但仍想支持 SheepIt，可以考虑<a href="/donation">捐赠</a>。',

      'The 20 minute rule is intended to ensure that even small computers can render any project. If a frame of your project can be rendered in under 20 min on the reference machine then you don\'t need to split it, but if you do, this formula can help you determine what the best value is.':
        '「20 分钟规则」是为了保证即使小电脑也能渲染任何项目。如果项目的某一帧在基准机器上能在 20 分钟内渲染完，你就不需要拆分；但如果需要拆分，下面这个公式可以帮你算出最合适的拆分方式。',

      'The render engine is compatible. Cycles, Eevee and Workbench renderer are supported.':
        '渲染引擎需要受支持，目前支持 Cycles、Eevee 和 Workbench 渲染器。',

      'You should keep the render time per frame (or split) under 20 min (on the reference machine). As an example, this scene will be rendered in 20min on the reference machine (i5-9600).There is a list of average power per machine, check out the faq for more info.':
        '每帧（或每个分块）在基准机器上的渲染时间应控制在 20 分钟以内。例如这个场景在基准机器（i5-9600）上需要 20 分钟。这里有一份<a href="/faq">各机器的平均算力列表</a>，详见 FAQ。',

      "You can add up to 12,000 tiles at a time. If you divide it into 8x8, your project can be up to 187 frames; if you don't split frames, you will have 1 tile <=> 1 frame.":
        '一次最多可以添加 12,000 个分块。如果按 8x8 拆分，你的项目最多可以有 187 帧；如果不拆分帧，则 1 个分块对应 1 帧。',

      'No nudity or any racist content is allowed.': '禁止色情内容，也禁止任何种族主义内容。',

      'Be aware that if you have set RGBA as output, the MP4 file will include the alpha layer and will make the file unplayable by some video players. The file could need special treatment in editing software.':
        '请注意：如果输出格式设为 RGBA，生成的 MP4 会带上 alpha 图层，部分播放器将无法播放，可能需要在剪辑软件里做特殊处理。',
    },

    /* ------------------------------------------------ 整块模式规则
     * 段落里含动态数字时没法用静态键，改用正则整块替换。捕获组按 $1…$9 回填。
     */
    blockPatterns: [
      [/^Max:\s*([\d,]+)\s*MB\s*before ZIP compression\s*Blender compression is recommended and supported\.$/i,
        '上限：$1 MB（ZIP 压缩前）<br>推荐并支持 Blender 压缩。'],

      [/^The render order is based on points\..*?You currently have ([\d,]+) points\.\s*Since you are part of a team who generated ([\d,]+) points some of those will give you an extra boost of ([\d,]+) points\.\s*Predicted position in queue:$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前拥有 $1 积分。由于你所在团队累计产生了 $2 积分，其中一部分会给你带来 $3 积分的额外加成。<br>预计排队位置：'],
    ],

    /* ------------------------------------------------ 模式规则（带变量的文案） */
    patterns: [
      [/^Connected as (.+)$/, '已登录：$1'],
      [/^(\d[\d,]*)\s+machines rendering right now\.$/, '当前有 $1 台机器在渲染。'],
      [/^(\d[\d,]*)\s+Rendering frames$/, '$1 帧渲染中'],
      [/^Rendered ([\d,]+) frames$/, '已渲染 $1 帧'],
      [/^Sent (.+) ago$/, '$1前发送'],
      [/^Total projects:\s*([\d,]+)$/, '项目总数：$1'],
      [/^Max:\s*([\d,]+) MB$/, '上限：$1 MB'],
      [/^(\d[\d,]*)\s+computed projects$/, '已完成 $1 个项目'],
      [/^(\d[\d,]*)\s+computed frames per hour$/, '每小时 $1 帧'],
      [/^(\d+[mhd])\s+to complete all projects$/, '$1 可完成全部项目'],
      [/^(\d[\d,]*)\s+frames? remaining$/i, '待渲染 $1 帧'],
      [/^(\d[\d,]*)\s+connected clients?$/i, '在线客户端 $1'],
      [/^(\d[\d,]*)\s+processing frames?$/i, '正在处理 $1 帧'],
      [/^(\d[\d,]*)\s+active projects?$/i, '进行中项目 $1'],
      /* 序数：既用于排行榜名次，也用于排队位置（CPU: 1st） */
      [/^(\d+)(st|nd|rd|th)$/i, '第 $1 位'],
      [/^([\d.]+)\s+or higher\.?$/, '$1 或更高。'],
      /* 估算器结果里的两句带变量的文案 */
      [/^([\d,]+)\s+points$/, '$1 积分'],
      [/^If you could try to pick a render time of about (\d+) minutes, you can keep a margin of error for the max render time\.$/,
        '如果把单块渲染时间定在 $1 分钟左右，就能给「单帧上限」留出余量。'],
    ],
  });
})();
