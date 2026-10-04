# 开发工具（不参与交付）：把整页截图按顺序纵向拼接成一张。
#
# 用法 A（简单拼接，每片都完整保留）：
#   python stitch.py <out.png> <css_width> <dpr> <slice1.png> <slice2.png> ...
#
# 用法 B（分片截图，自动处理 #sp 的粘性顶栏与末屏重复）：
#   python stitch.py <out.png> --css-w 1440 --dpr 1.25 --total 4988 --vh 1180 --sticky 56 \
#          --y 0,1124,2248,3372,3808 -- s0.png s1.png ...
#
# 为什么需要 B：#sp 的顶栏是 position:sticky，往下滚的每一屏顶部都会重复它；而滚动容器
# 有最大滚动量，最后一屏一定和上一屏重叠。B 按"每片负责的内容区间"裁剪。
#
# 分片步长取 vh - sticky 时是精确的：每片保留 [y+sticky, y+vh]，顶栏不重复、内容不漏。
# 步长更大时被顶栏盖住的那一段内容在本片里根本看不见、别处也没有 —— 脚本会吼一声，
# 并退回上一片的终点（图里重复一条顶栏），绝不静默挖掉内容。
import sys
from PIL import Image

args = sys.argv[1:]
out = args.pop(0)

opts = {'css-w': None, 'dpr': 1.0, 'total': None, 'vh': None, 'sticky': 0, 'y': None}
if args and args[0].startswith('--'):
    files = []
    while args:
        a = args.pop(0)
        if a == '--':
            files = args[:]
            break
        opts[a[2:]] = args.pop(0)
    css_w = int(opts['css-w'])
    dpr = float(opts['dpr'])
    vh = float(opts['vh'])
    sticky = float(opts['sticky'])
    total = float(opts['total'])
    ys = [float(v) for v in opts['y'].split(',')]
    if len(ys) != len(files):
        sys.exit(f'× y 的个数（{len(ys)}）与截图张数（{len(files)}）不一致')
    if any(b <= a for a, b in zip(ys, ys[1:])):
        sys.exit('× y 必须严格递增')
else:
    css_w = int(args.pop(0))
    dpr = float(args.pop(0))
    files = args
    ys = None
    vh = sticky = total = 0

crop_w = round(css_w * dpr)
parts = []
prev_end = None
for i, p in enumerate(files):
    im = Image.open(p).convert('RGB')
    im = im.crop((0, 0, min(crop_w, im.width), im.height))
    if ys is None:
        parts.append(im)
        continue
    # 这一片负责的内容区间（内容坐标 → 该片像素用 (start - ys[i]) * dpr 换算）
    prev = prev_end if prev_end is not None else 0
    start = ys[i] + (0 if i == 0 else sticky)
    if start < prev:
        start = prev                     # 与本片之前已拼的内容重叠：裁掉，不重复
    elif start > prev and i > 0:
        # 步长太大：这一段的像素被顶栏盖住了，任何一片都没有。宁可重复一条顶栏也要留住内容。
        print(f'! 第 {i + 1} 片：步长 {ys[i] - ys[i - 1]:.0f} > vh-sticky（{vh - sticky:.0f}），'
              f'内容 {prev:.0f}–{start:.0f} 被顶栏盖住：拼图里会重复一条顶栏，且这段内容缺失',
              file=sys.stderr)
        start = prev
    end = min(ys[i] + vh, total)
    if end <= start:
        continue
    top = round((start - ys[i]) * dpr)
    bottom = round((end - ys[i]) * dpr)
    if top >= im.height or bottom <= top:
        # 片子高度不够（多半是把 CSS px 和 device px 搞混了）：宁可报出来，也不要裁出一张空图
        sys.exit(f'× 第 {i + 1} 片只有 {im.height}px 高，但要裁 {top}–{bottom}：'
                 f'请确认截图是按 dpr={dpr} 出的整屏图（应为 {round(vh * dpr)}px 高）')
    parts.append(im.crop((0, top, im.width, min(bottom, im.height))))
    prev_end = end

canvas_h = sum(p.height for p in parts)
canvas = Image.new('RGB', (crop_w, canvas_h), (255, 255, 255))
y = 0
for p in parts:
    canvas.paste(p, (0, y))
    y += p.height
canvas.save(out)
print(f'{out}: {canvas.width}x{canvas.height} css={css_w} dpr={dpr} slices={len(parts)}')
