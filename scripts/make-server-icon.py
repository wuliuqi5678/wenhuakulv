"""
生成"服务器启动"快捷方式用的图标（服务器机架样式）。

输出：
  assets/server.ico  多尺寸图标，给 Windows 用
  assets/server.png  256×256 预览图

两个关键点（都是踩过坑才知道的）：

1. **帧格式必须是 BMP/DIB，不能是 PNG。**
   Pillow 的 `Image.save(..., format="ICO")` 会把所有帧写成 PNG 压缩。
   Windows 只对 256×256 这一帧可靠支持 PNG，16/24/32/48 走的是老的
   `PrivateExtractIcons` 路径，遇到 PNG 帧直接提取失败 —— 结果就是
   快捷方式显示成空白图标。所以这里自己拼 ICO：
   小尺寸写 BMP(DIB) 帧，只有 256 用 PNG（否则文件会大到几百 KB）。

2. **每个尺寸都原生绘制，不做缩放。**
   16×16 上散热孔、指示灯这种细节只会糊成一团，所以小尺寸自动简化。

用法：python scripts/make-server-icon.py
"""
import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 256                      # 设计基准尺寸，所有坐标按它取值
OUT = Path(__file__).resolve().parent.parent / "assets"

# 配色（与项目页面同一套蓝色）
CASE_FILL = (30, 41, 56, 255)       # 机箱
CASE_EDGE = (76, 141, 255, 255)     # 机箱描边
UNIT_FILL = (129, 148, 173, 255)    # 服务器单元
UNIT_DARK = (74, 88, 108, 255)      # 散热孔
LED_OK = (53, 208, 127, 255)        # 指示灯：绿
LED_WARN = (255, 176, 32, 255)      # 指示灯：橙

# 要打包进 ICO 的尺寸；顺序从大到小，与系统里能正常显示的 .ico 保持一致
ICO_SIZES = (128, 64, 48, 32, 24, 16)
# 全部用 BMP 帧：Windows 解析快捷方式图标时会优先取最大帧，
# 若最大帧是 PNG 压缩（Pillow 默认这么写），整段解析会失败并退回默认图标。
PNG_SIZES = set()


def draw_server(size: int) -> Image.Image:
    """按给定边长原生绘制，细节量随尺寸递减。"""
    k = size / SIZE

    def s(v: float) -> float:
        return v * k

    # 小尺寸只保留"机箱 + 三条单元 + 指示灯"，散热孔是纯噪声
    detail = size >= 48
    simple = size < 32

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 机箱
    d.rounded_rectangle(
        [s(20), s(14), s(236), s(242)],
        radius=s(26),
        fill=CASE_FILL,
        outline=CASE_EDGE,
        width=max(1, round(s(10))),
    )

    # 三条服务器单元
    gap = 20 if simple else 14
    unit_h = 48 if simple else 52
    span = 3 * unit_h + 2 * gap
    top = 14 + (228 - span) / 2
    leds = [LED_OK, LED_OK, LED_WARN]

    for i in range(3):
        y0 = top + i * (unit_h + gap)
        y1 = y0 + unit_h
        # 小尺寸把单元条左右收一点，留出深色机箱边框，
        # 否则 16px 下三条浅色带会连成一整块，看不出是机架
        left, right = (46, 210) if simple else (44, 212)
        d.rounded_rectangle([s(left), s(y0), s(right), s(y1)], radius=s(10), fill=UNIT_FILL)

        # 左侧指示灯
        cy = (y0 + y1) / 2
        led_r = 11 if simple else 9
        led_l = 58 if simple else 58
        d.ellipse([s(led_l), s(cy - led_r), s(led_l + 2 * led_r), s(cy + led_r)], fill=leds[i])

        # 右侧散热孔：只在够大时才画
        if detail:
            for dy in (-8, 3):
                d.rounded_rectangle(
                    [s(150), s(cy + dy), s(198), s(cy + dy + 6)],
                    radius=s(3),
                    fill=UNIT_DARK,
                )

    return img


def bmp_frame(img: Image.Image) -> bytes:
    """
    编码成 ICO 里的 BMP 帧：BITMAPINFOHEADER + 自下而上的 BGRA 像素 + AND 掩码。
    biHeight 要写两倍高度，因为图像数据后面还跟着 1bpp 的透明掩码。
    """
    w, h = img.size
    px = img.load()

    xor = bytearray()
    for y in range(h - 1, -1, -1):          # BMP 自下而上
        for x in range(w):
            r, g, b, a = px[x, y]
            xor += bytes((b, g, r, a))      # BGRA

    row_bytes = ((w + 31) // 32) * 4        # 每行按 4 字节对齐
    and_mask = bytearray()
    for y in range(h - 1, -1, -1):
        row = bytearray(row_bytes)
        for x in range(w):
            if px[x, y][3] < 128:           # 1 = 透明
                row[x // 8] |= 0x80 >> (x % 8)
        and_mask += row

    header = struct.pack(
        "<IiiHHIIiiII",
        40,                 # biSize
        w, h * 2,           # biWidth, biHeight（两倍）
        1, 32,              # biPlanes, biBitCount
        0,                  # biCompression = BI_RGB
        len(xor) + len(and_mask),  # biSizeImage
        0, 0, 0, 0,         # 分辨率与调色板
    )
    return header + bytes(xor) + bytes(and_mask)


def png_frame(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_ico(frames: dict) -> bytes:
    """按 ICONDIR / ICONDIRENTRY 结构手写 ICO 文件。"""
    entries, payload = [], b""
    offset = 6 + 16 * len(frames)          # 目录之后就是图像数据

    for size in sorted(frames, reverse=True):   # 大帧在前，与主流图标工具一致
        data = frames[size]
        entries.append(
            struct.pack(
                "<BBBBHHII",
                size % 256,                 # 宽（256 记作 0）
                size % 256,                 # 高
                0, 0,                       # 调色板数、保留位
                1, 32,                      # 色彩平面、位深
                len(data),
                offset,
            )
        )
        payload += data
        offset += len(data)

    return struct.pack("<HHH", 0, 1, len(frames)) + b"".join(entries) + payload


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # 先渲染好每个尺寸，再分别编码
    renders = {size: draw_server(size) for size in ICO_SIZES}
    frames = {
        size: (png_frame(img) if size in PNG_SIZES else bmp_frame(img))
        for size, img in renders.items()
    }

    ico = OUT / "server.ico"
    ico.write_bytes(build_ico(frames))

    png = OUT / "server.png"
    draw_server(SIZE).save(png)     # 预览图单独按 256 画，不放进 ICO

    print("已生成：")
    for p in (ico, png):
        print(f"  {p}  ({p.stat().st_size} 字节)")
    print("  帧顺序与格式：", end="")
    print("、".join(f"{s}={'PNG' if s in PNG_SIZES else 'BMP'}" for s in sorted(frames, reverse=True)))


if __name__ == "__main__":
    main()
