/* ==== 12-lang-zh.js：中文语言包 ====
   site = 短词条精确匹配；blocks = 整块替换（值可含链接）；patterns = 带变量，捕获组回填 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP || !SP.I18n) return;

  /* 站点把日期写成「20th Oct 06:10」（项目管理页）或「06:40 Sep 29」（会话页）两种形状，
     照抄进中文句子太刺眼：只本地化这两种。作为 pack.dateText 注册，视图层可以直接用
     I18n.date() 要本地化结果（10-core.js 的 I18n.date）。
     （patterns 的替换值可以是函数——10-core.js 用的是 String.replace(re, rep)。） */
  const MONTH_ZH = { Jan: '1月', Feb: '2月', Mar: '3月', Apr: '4月', May: '5月', Jun: '6月',
    Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月' };
  const monthOf = (mon) => MONTH_ZH[String(mon).slice(0, 3).charAt(0).toUpperCase() + String(mon).slice(1, 3).toLowerCase()];
  const farmDate = (s) => String(s == null ? '' : s)
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}:\d{2})\b/g,
      (m, d, mon, time) => {
        const z = monthOf(mon);
        return z ? z + d + '日 ' + time : m;
      })
    .replace(/\b(\d{1,2}:\d{2})\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2})\b/g,
      (m, time, mon, d) => {
        const z = monthOf(mon);
        return z ? z + d + '日 ' + time : m;
      });

  SP.I18n.register('zh', {
    label: '中文',
    dateText: farmDate,

    /* 短词条 */
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
      /* 估算器返回的英文片段落在卡片里，用 DomI18n.translateSubtree() 翻。 */
      'How much your project will cost you': '你的项目会花掉多少积分',
      'How you could split your project': '可以怎么拆分',
      'Your project will cost you up to': '你的项目最多会花掉',
      'Having a very low render time is not necessarily a good thing. Please keep the render time over 1 minute.':
        '渲染时间太短未必是好事 —— 请把单块渲染时间保持在 1 分钟以上。',
      'Number of tiles': '分块数',
      'Expected render time': '预计耗时',
      'No split': '不拆分',

      /* 分析完成后的站点「新增项目」表单：站点把它整块塞进 #sp-an-result，我们只翻文案、
         不动结构（站点 JS 按 id 拼参数）。键必须与站点 DOM 归一化后的文本逐字一致——
         原文快照见 .tmp/upload-test/step3-outer.html。 */
      'Renderable by all members': '所有成员均可渲染',
      'By default every member can render your project. If you want to restrict the access to your project do not check this box. On the project administration page you will be able to modify this setting and add specific members to renderers.':
        '默认每个成员都能渲染你的项目。想限制访问就别勾这一项；之后可以在项目管理页改这个设置，并把指定成员加进渲染者名单。',
      'Generate MP4 video': '生成 MP4 视频',
      'Generates an MP4 video of the projects, it is really resource intensive for the server so only check it if you really need it.':
        '为项目生成一段 MP4 视频。这非常吃服务器资源，确实需要时才勾。',
      'Compute method:': '计算方式：',
      'Denoising detected: Splits (multiple smaller frames with reduced samples) are not supported.':
        '检测到降噪：本项目不支持拆分（把帧切成小块、再降低每块的采样）。',
      'It does not make sense to denoise separate splits and recombine them together.':
        '把拆分后的各块分别降噪、再拼回一起，是没有意义的。',
      'Start frame': '起始帧',
      'End frame': '结束帧',
      'Step': '步长',
      'Advanced options': '高级选项',
      'Memory used': '内存占用',
      'You can specify the memory used your project. If you think your project will take a lot of ram (more than 20GB), please fill the amount. You can find this value on the top right of Blender. It will help the renderfarm, by allowing the server to give a frame to a small configuration. It is an optional attribute, this value will be detected on the first frame rendered.':
        '可以在这里指定项目要用的内存。预计占用很大（超过 20GB）就填上——这个值显示在 Blender 界面右上角。填了能帮农场把帧派给小机器。可选项，不填会在渲染第一帧时自动探测。',
      'Memory used in Mbytes': '内存占用（MB）',
      'Add this blend': '添加这个 blend',

      /* 项目管理页 /project/<数字>：整页自绘（0.2.2 起），站点节点不进壳。这里这些词条
         是给**解析出来的站点原文**用的（概要几行、动作按钮的 title、名单面板的占位符），
         视图层自己那几句话走 10-core.js 的 UI 词典（mg.*）。 */
      'Administration': '项目管理',
      'Summary': '概要', 'Legend': '图例',
      'Finished': '已完成', 'In progress': '进行中', 'Waiting': '等待中',
      'Rendered': '已渲染', 'Processing': '渲染中', 'Failed': '失败', 'Expired': '已过期',
      'Permissions': '权限', 'Renderers': '渲染者', 'Actions': '操作',
      'Managers': '管理员', 'Users': '用户',
      'Compute method': '计算方式',
      'Add a user to manager list': '输入用户名，加入管理员名单',
      'Add': '添加',
      'See frames': '查看帧图像', 'Download frames': '下载帧图像', 'Remove': '删除项目',
      'CPU enabled': 'CPU 已启用', 'CPU disabled': 'CPU 已禁用',
      'GPU enabled': 'GPU 已启用', 'GPU disabled': 'GPU 已禁用',
      /* 站点把这句话拆成 <strong>Caution!</strong> + 文本节点，整句当键永远匹配不上 */
      'Caution!': '注意！',
      'not all the rendering features are supported by GPUs': 'GPU 并不支持站点全部的渲染特性。',
      'You might have different results depending on the rendering technology.': '换一种渲染技术，结果可能有差异。',

      /* 项目管理页：调度器那一段（只在项目「等待中 / 渲染中」时渲染）。
         注意 site 表是**短词条精确匹配**，值放在子 <b> 里的整句要用下面的 patterns。 */
      'Scheduler': '调度器',
      /* 站点在「从没活动过」的机器上印红色小字 never（账户页三行、旧版会话页）。 */
      'never': '从未',
      'How many machines can actually render the project?': '有多少台机器能真正渲染这个项目？',
      'Connected machines:': '已连接机器：',
      'Connected machines for CPU:': 'CPU 已连接机器：',
      'Potential rendering machines:': '潜在渲染机器：',
      'Pause': '暂停',
      'Resume': '继续',

      /* 项目管理页：项目「已渲染」状态下的提示块与动作按钮
         （站点把两句话直接拼在一起，中间**没有空格**，所以带空格的变体也留一份） */
      'Your project has finished rendering, the frames are being packed.The server hosting your project will soon create a zip with your frames.':
        '项目已经渲染完成，正在打包帧文件。托管你项目的服务器很快会生成一个包含所有帧的 zip。',
      'Your project has finished rendering, the frames are being packed. The server hosting your project will soon create a zip with your frames.':
        '项目已经渲染完成，正在打包帧文件。托管你项目的服务器很快会生成一个包含所有帧的 zip。',
      'Generating archive.': '正在打包存档。',
      'More information about SheepIt network on the servers page': '关于 SheepIt 网络的更多信息见「服务器」页面。',

      /* 项目管理页：其它状态（渲染中／暂停／私有／封禁／限速／服务器不可用）
         注意 site 表是短词条精确匹配：被 <strong> 拆开的整句（如 "Your project is <strong>private</strong>, …"）
         site 表盖不住（单词 "private" 又太泛、全站误伤面太大），所以那句走下面的 blockPatterns ——
         patchBlocks 是按**整块 textContent** 匹配的，正则只吃英文前半句、替换值里带 <strong>，
         后半句（另一句，已有 site 词条）原样留着给 patchTextNodes 翻（0.1.18）。 */
      'Rendering': '渲染中',
      'Paused': '已暂停',
      'Current renderers:': '正在渲染的成员：',
      'Resume is disabled because you have too many active projects': '继续已被禁用：你的进行中项目太多',
      'Ask for a partial Archive Frame': '申请部分帧压缩包',
      'Your project has finished rendering, the frames are being packed.': '项目已经渲染完成，正在打包帧文件。',
      'Download video': '下载视频',
      'Statistics about the render': '渲染统计',
      'Note: this is not the final image. It is a thumbnail of the on going render.': '注意：这不是最终画面，而是渲染中的缩略图。',
      'Note: this is not the final video. It is a reduced thumbnail.': '注意：这不是最终视频，而是降质缩略图。',
      "To make it renderable by everyone, check 'Renderable by all members' on the renderers options.": '想让所有人都能渲染，请在渲染者选项里勾选「所有成员均可渲染」。',
      'Your project has been blocked.': '你的项目已被封禁。',
      'Members can not render your project BUT you still can.': '其他成员无法渲染你的项目，但你仍然可以。',
      'Members (including you) can not render your project.': '包括你在内的成员都无法渲染你的项目。',
      'You can remove this limitation by connecting your machine to the farm.': '把你的机器接入农场即可解除这个限制。',
      'As long as you are rendering, your project will be unthrottled.': '只要你在参与渲染，你的项目就不会被限速。',
      'The server hosting your project is currently not available.': '托管你项目的服务器当前不可用。',
      'No download or rendering is possible.': '无法下载，也无法渲染。',
      'Add a user to renderer list': '输入用户名，加入渲染者名单',
      'Add a team to renderer list': '输入团队名，加入渲染者名单',
      'If you are using Eevee, CPU rendering is not available.': '使用 Eevee 时无法使用 CPU 渲染。',
      'MP4 generation disabled': 'MP4 生成已禁用',
    },

    /* 整块替换（值是 HTML，可保留链接）：键 = 翻译前的整块归一化文本，必须与页面拼接结果一致。
       取键：把 translateSite 设为 false 打开页面，控制台跑 DomI18n.reportUnmatched(20)。 */
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

    /* 整块模式规则：段落含动态数字 → 用正则整块替换，捕获组按 $1…$9 回填。 */
    blockPatterns: [
      [/^Max:\s*([\d,]+)\s*MB\s*before ZIP compression\s*Blender compression is recommended and supported\.$/i,
        '上限：$1 MB（ZIP 压缩前）<br>推荐并支持 Blender 压缩。'],

      [/^The render order is based on points\..*?You currently have ([\d,]+) points\.\s*Since you are part of a team who generated ([\d,]+) points some of those will give you an extra boost of ([\d,]+) points\.\s*Predicted position in queue:$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前拥有 $1 积分。由于你所在团队累计产生了 $2 积分，其中一部分会给你带来 $3 积分的额外加成。<br>预计排队位置：'],

      /* 项目是私有的时候那句提醒：站点写成 "Your project is <strong>private</strong>, not every worker…"，
         <strong> 把句子切成三个文本节点、site 表配不上整句 —— 这里整块吃英文前半句、替换值自带 <strong>，
         后面那句（"To make it renderable by everyone…"）有 site 词条，交给 patchTextNodes 翻。 */
      [/^Your project is private, not every worker will be able to participate in your project\./,
        '你的项目是<strong>私有的</strong>，不是所有 worker 都能参与你的项目。'],
    ],

    /* 模式规则（带变量的文案） */
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
      /* 序数：排行榜名次与排队位置（CPU: 1st）共用 */
      [/^(\d+)(st|nd|rd|th)$/i, '第 $1 位'],
      [/^([\d.]+)\s+or higher\.?$/, '$1 或更高。'],
      /* 估算器结果 */
      [/^([\d,]+)\s+points$/, '$1 积分'],
      [/^If you could try to pick a render time of about (\d+) minutes, you can keep a margin of error for the max render time\.$/,
        '如果把单块渲染时间定在 $1 分钟左右，就能给「单帧上限」留出余量。'],
      /* 上传页「排队情况」：站点看有没有团队加成会输出两个变体，上面 blockPatterns 只盖住长的那条 */
      [/^The render order is based on points\. The more points you have, the higher priority you get\. You currently have ([\d,]+) points\.$/i,
        '渲染顺序由积分决定：积分越高，优先级越高。你当前有 $1 积分。'],
      /* 分析完成后第三步表单的排队位置 */
      [/^Est\. queue position:\s*([\d,]+)(st|nd|rd|th)$/i, '预计排队：第 $1 位'],
      /* 项目管理页 /project/<数字> 的概要行（数字每次不同，逐行规则） */
      [/^The project will be done in\s*(.+)$/i, '预计完成：$1'],
      [/^Storage used:\s*(.+)$/i, '已用存储：$1'],
      [/^Real duration of render:\s*(.+)$/i, '实际渲染用时：$1'],
      [/^On reference per frame rendertime:?$/i, '基准机单帧用时：'],
      [/^RAM usage:\s*(.+)$/i, '内存占用：$1'],
      [/^Project will be automatically deleted on\s*(.+)$/i,
        (m, rest) => '项目将于 ' + farmDate(rest) + ' 自动删除'],
      [/^Connected machines:\s*(.+)$/i, '已连接机器：$1'],
      /* 项目管理页：调度器那一段（值常被站点放在子 <b> 里，纯标签的走 site 表） */
      [/^Connected machines for CPU:\s*(.+)$/i, 'CPU 已连接机器：$1'],
      [/^Potential rendering machines:\s*(.+)$/i, '潜在渲染机器：$1'],
      /* 版本号会随站点升级变（Blender 4.5+），带值的写法必须排在纯标签那行之前 */
      [/^Machines who can use ([^:]+):\s*(.+)$/i, '能用 $1 的机器：$2'],
      [/^Machines who can use ([^:]+):\s*$/i, '能用 $1 的机器：'],
      /* 项目管理页：项目「已渲染」时状态块里被 <br> 分行的几行 */
      [/^Current position:\s*(\d+)(st|nd|rd|th)$/i, '当前排位：第 $1 位'],
      [/^Tasks for this project:\s*([\d,]+)$/i, '本项目任务数：$1'],
      [/^Total tasks on Shepherd:\s*([\d,]+)$/i, 'Shepherd 上的任务总数：$1'],
      [/^Cumulated time of render:\s*(.+)$/i, '累计渲染用时：$1'],
      [/^Points spent:\s*([\d,]+) points$/i, '已消耗积分：$1'],
      [/^(\d+)\/([\d,]+) \(remaining (.+)\)$/, '$1/$2（剩余 $3）'],
      /* 齿轮按钮的 title 属性：站点把整段状态 HTML 塞在里面（attr 只查 site + patterns） */
      [/^<strong>Generating archive\.<\/strong>$/, '<strong>正在打包存档。</strong>'],
      [/^<strong>Generating archive\.<\/strong><br>Current position: (\d+)(?:st|nd|rd|th)<br>Tasks for this project: ([\d,]+)<br>Total tasks on Shepherd: ([\d,]+)$/,
        '<strong>正在打包存档。</strong><br>当前排位：第 $1 位<br>本项目任务数：$2<br>Shepherd 上的任务总数：$3'],
      /* 封禁 / 限速（点位不够的账号） */
      [/^Your project has been blocked because '(.+)'\.$/, '你的项目已被封禁，原因：「$1」。'],
      [/^You are currently rated? limited to ([\d,]+) machines? because you have 0 points\.$/i, '你因为 0 积分被限速到 $1 台机器。'],
      /* 帧缩略图的 tooltip：站点把整段 HTML 塞进了 title 属性（frame / cost / rendertime） */
      [/^<center>frame:\s*([^<]+)<br\s*\/?>cost:\s*([^<]*)<br\s*\/?>rendertime:\s*([^<]*)<br\s*\/?><\/center>/i,
        '<center>第 $1 帧<br>积分：$2<br>用时：$3<br></center>'],
      /* 第三步「设置」里站点给每个 .blend 的说明/拒绝理由（68-step3.js 直接把它们当文本渲染，
         走 siteText：先查 site 精确匹配，再走这里）。 */
      [/^No camera in scene, cannot render\.$/, '场景里没有相机，无法渲染。'],
      [/^Since active "output file" nodes result in files being written to arbitrary locations on the renderer's system we do not allow it\.$/, '活动的「输出文件」节点会把文件写到渲染机上的任意位置，所以站点不允许。'],
      [/^We will accept your \.blend if you mute the node\.$/, '把这个节点静音（mute）后就可以重新上传。'],
      [/^EXR output detected$/, '检测到 EXR 输出'],
      [/^Limitation on EXR {2}support:$/, 'EXR 的限制：'],
      [/^Full frame renders only\. No split-layers or checkerboarding\.$/, '只能整帧渲染，不支持拆分图层或棋盘格切块。'],
      [/^Only animations are supported, no single image projects\.$/, '只支持动画项目，不支持单张图片项目。'],
      [/^Maximum image resolution (\d+)x(\d+)y px\.$/, '最大分辨率 $1x$2 像素。'],
      [/^Maximum image file size (.+)B$/, '单张图片最大 $1B。'],
      [/^Use of compression is required \(any of (.+)\)\.$/, '必须使用压缩（$1 之一）。'],
      [/^Denoising detected: Splits \(multiple smaller frames with reduced samples\) are not supported\.$/, '检测到降噪：不支持拆分（把帧切成小块、降低采样再拼回去）。'],
      [/^It does not make sense to denoise separate splits and recombine them together\.$/, '把拆分后的各块分别降噪、再拼回一起没有意义。'],
      [/^Drivers will not work$/i, '驱动器（Driver）不会生效'],
      [/^because scripts are disabled for security reasons\.$/, '出于安全考虑站点禁用了脚本。'],
      [/^Warning, files not found:$/, '警告：这些文件找不到：'],
      [/^You can add project up to ([\d,]+) tiles, this project is over this limit, with your current tile setup you can go up to ([\d,]+) frames\.$/, '项目上限是 $1 块；按现在的切块设置，最多能做 $2 帧。'],
      [/^You can add project up to ([\d,]+) frames, this project is over this limit\.$/, '项目上限是 $1 帧，这个项目超了。'],
    ],
  });
})();
