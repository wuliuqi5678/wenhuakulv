# 文化苦旅 · 中国现当代文学书影

一个使用 Express 本地运行的中文书籍介绍网站，收录 **53 部中国现当代文学作品**。
提供按年代筛选、书名与作者搜索、分类浏览、作者介绍、作品详情和随机漫游。
书目与作者介绍保存在 `public/data/`，封面由 CSS 版式生成，不依赖外部图片或服务。

---

## 一、怎么启动

### 方式 A：双击启动（推荐）

在项目文件夹里双击 **`启动服务.bat`**。

会弹出一个黑色命令行窗口，显示服务已启动。打开浏览器访问
<http://127.0.0.1:3000> 即可浏览网站；也可访问 `/api/health` 查看服务状态。

**要停止服务，直接关掉那个黑色窗口**（或在窗口里按 `Ctrl+C`）。

> 窗口必须一直开着，服务才在运行。关掉窗口 = 关掉服务。

### 方式 B：命令行启动

在项目文件夹里打开终端（PowerShell 或 CMD），执行：

```bash
npm start
```

停止用 `Ctrl+C`。

> 改动了 `server.js` 或 `public/` 下的代码后，**必须重启服务**才会生效（CSS/JS/JSON 有最多 1 小时缓存，改完可以强制刷新一次）。

### 前提条件

- 已安装 Node.js（到 <https://nodejs.org/> 下载 LTS 版，一路下一步即可）
- `node_modules` 文件夹存在（即依赖已安装过）

如果 `node_modules` 被删了或换了台电脑，先执行一次安装：

```bash
npm install
```

### 常见问题

| 现象 | 处理 |
| --- | --- |
| 端口 3000 已被占用 | 多半是服务已经在运行，直接开 <http://127.0.0.1:3000>；或关掉旧窗口后重启 |
| 想换个端口 | `set PORT=3001 && npm start`（PowerShell：`$env:PORT=3001; npm start`） |
| 想让局域网设备访问 | `set HOST=0.0.0.0 && npm start`，然后用本机局域网 IP 访问 |
| 页面打开是空白/报「数据加载失败」 | 必须通过 `http://127.0.0.1:3000` 访问（由服务提供数据），直接双击 HTML 文件不行 |

---

## 二、目录结构

```
├── server.js              # Express 服务器：静态托管 + gzip + 安全响应头 + 中文 404
├── 启动服务.bat            # Windows 双击启动
├── public/                # 前端全部内容（纯静态，无构建步骤）
│   ├── index.html         # 书架首页：年代筛选 + 搜索 + 书墙
│   ├── book.html          # 作品详情页（?id=xxx）
│   ├── author.html        # 作者详情页（?id=xxx）
│   ├── authors.html       # 作者索引页
│   ├── categories.html    # 分类页（七个类别）
│   ├── roam.html          # 随机漫游页
│   ├── 404.html           # 中文 404 页
│   ├── css/site.css       # 全站样式（纸、墨、朱三色体系）
│   ├── js/                # 各页逻辑（原生 ES Module，无框架）
│   │   ├── covers.js      # 书影渲染组件 + 数据加载（被各页共用）
│   │   ├── ui.js          # 导航高亮、返回动画、/ 快捷键
│   │   ├── book-effects.js# 书卡悬停放大 + 点击翻书转场（可按 Esc 跳过）
│   │   └── …              # 其余为各页面入口脚本
│   └── data/
│       ├── books.json     # 书目数据（53 部）
│       └── authors.json   # 作者数据（46 位）
```

---

## 三、数据契约（想加书/改信息看这里）

### `public/data/books.json`

```jsonc
{
  "site": { "description": "首页 meta 描述" },
  "books": [
    {
      "id": "wenhuakulv",          // 必填，唯一，仅小写字母/数字/中划线（用于 URL）
      "title": "文化苦旅",          // 必填
      "coverTitle": "文化苦旅",      // 可选，封面上的书名（默认同 title）
      "author": "余秋雨",           // 必填，须与 authors.json 的 name 完全一致
      "year": 1992,                // 必填，初版年份（整数）
      "publisher": "东方出版中心",   // 必填
      "genre": "散文",              // 必填，取值见 categories.js 的映射表
      "awards": ["…"],             // 可选，只标有依据者
      "tags": ["散文", "…"],        // 可选
      "intro": ["段落一", "段落二"],  // 必填，每段一个字符串
      "why": "一句话荐语",           // 可选
      "note": "补充说明",            // 可选
      "photo": "covers/xx.jpg",    // 可选，真实书照（放 public/covers/ 下）
      "cover": {                    // 必填，设计书影参数
        "bg": "#33342F", "ink": "#EFE9DA", "accent": "#C9A227",
        "style": "frame"            // vertical | frame | numeral | band 四选一
      }
    }
  ]
}
```

### `public/data/authors.json`

```jsonc
{
  "authors": [
    {
      "id": "yuqiuyu",       // 必填，唯一，仅小写字母/数字/中划线
      "name": "余秋雨",       // 必填，须与 books.json 的 author 完全一致
      "born": 1946,          // 生年（整数）；生年未详时写 null（排序自动放末尾）
      "years": "1946—",      // 生卒年展示文本
      "place": "浙江",       // 可选
      "role": "文化学者",     // 一句定位
      "tags": ["…"],        // 可选
      "bio": ["段落一"]       // 生平简介
    }
  ]
}
```

**注意事项**：改完 JSON 后到 <https://jsonlint.com>（或 `node -e "JSON.parse(require('fs').readFileSync('public/data/books.json','utf8'))"`）校验一下，格式错误会导致页面空白。

---

## 四、页面与 URL 参数

| 页面 | 地址 | 参数 |
| --- | --- | --- |
| 书架 | `/` 或 `/index.html` | `?q=关键词`（搜索）、`?splash=0`（跳过开屏）、`?splash=1`（强制开屏） |
| 作品详情 | `/book.html` | `?id=书目id` |
| 作者详情 | `/author.html` | `?id=作者id` |
| 分类 | `/categories.html` | — |
| 漫游 | `/roam.html` | — |
| 健康检查 | `/api/health` | — |

另外有一个隐藏的演示参数：任意页面加 `?turndemo=1`，点击书卡只播放翻书动画、不跳转，便于截图。

---

## 五、设计与技术说明

- **书影为版式再创作**：依据书名、作者与年代用 CSS 重新设计，不是原书封面扫描件。
  想换成真实书照：把图片放进 `public/covers/`，在 `books.json` 对应条目加
  `"photo": "covers/文件名.jpg"`，加载失败会自动退回设计书影。
- **零构建、零框架**：前端是原生 ES Module + 手写 CSS；服务端只有 Express 一个依赖。
- **性能**：文本资源自动 gzip（体积约省 2/3）；CSS/JS 缓存 1 小时；书目数据走 ETag 协商缓存（304 不重传）。
- **无障碍**：全站语义化标签、`aria-pressed`/`aria-current`、键盘可完整操作、对比度满足 WCAG AA、尊重 `prefers-reduced-motion`。
- **翻书转场**：约 0.6 秒；期间再点一次或按 Esc/空格/Enter 可立即跳转。

---

## 六、维护备忘

- 服务只做三件事：静态托管、`/api/health` 健康检查、gzip/安全头/404。没有数据库，没有写接口。
- 版本管理用 git（`git log` 看历史，`git checkout -- 文件名` 撤销未提交修改）。
- `screenshots/` 目录是开发期截图，已加入 `.gitignore`，不入库。
