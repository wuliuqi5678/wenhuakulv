# 文化苦旅 · 中国现当代文学书影

一个在本地运行的中文文学书目网站。收录 **300 部中国现当代文学作品**、**67 位作者**、**10 份主题书单**，提供书墙、分类、作者页、作品详情、主题书单与书库进度、随机漫游、个人书库和站内 AI 助手（支持只问本书、防剧透、根据书库推荐下一本）。

封面是用 CSS 重新设计的“书影”，不是原书扫描件；全站没有构建步骤，前端是原生 HTML / CSS / ES Module，后端只有 Express。

> **在线浏览**：<https://wuliuqi5678.github.io/wenhuakulv/>
> 这是 GitHub Pages 上的纯静态版：书目、分类、作者、书单、漫游、书库都能用；AI 助手需要服务端，只在本地 `npm start` 或第十二节的方案 B 里出现。

> 截至本文：书目 300 部，作者 67 位，1928—2022 年，12 种体裁，7 个分类。
> 主题书单 10 份，覆盖 50 部作品、70 个阅读站点；每份导语 300—500 字。
> 48 部作品有可靠摘句，252 部仍标注“暂无可靠原文摘句”。
> 前端资源版本：`20261024e`。

---

## 一、快速开始

### 环境要求

- Node.js **20 或以上**
- 依赖已安装（项目根目录有 `node_modules/`）
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 安装与启动

```bash
# 在项目根目录
npm install
# 或 pnpm install

npm start
# 或 pnpm start
```

打开 <http://127.0.0.1:3000>。

> 如果 3000 已被旧进程占用，先在原窗口 `Ctrl+C` 停掉再启动；不要为了省事关掉旧窗口后改用 3010 预览，否则页面在 3000、AI 却在旧 API 上，容易出现“前端更新了但 AI 还是旧回答”。开发时建议用 `npm run dev`，它会随服务端文件变化重启。

也可以直接双击 **`启动服务.bat`**，会打开命令行窗口并启动服务。停止服务：关闭窗口或在窗口里按 `Ctrl+C`。

### 开发模式

```bash
npm run dev
```

`node --watch server.js` 会在 `server.js` / `server-ai.js` 改动后自动重启。**前端文件（HTML/CSS/JS）不需要重启**，刷新浏览器即可。

### 静态检查

```bash
npm test
```

会检查 300 本书、67 位作者、10 份书单、书单 book id、导语字数、HTML 站内链接、CSS/JS 文件是否存在，以及全站资源版本是否一致；并回归书库状态切换是否保留日期/重读次数、非法日历日期是否被拒绝。

### 端口与监听地址

默认只监听本机 `127.0.0.1:3000`：

```bash
# PowerShell
$env:PORT=3001; npm start

# CMD
set PORT=3001 && npm start
```

局域网访问：

```bash
# PowerShell
$env:HOST="0.0.0.0"; npm start
```

> 注意：`HOST=0.0.0.0` 会把整个站点暴露到局域网，而且没有登录/权限系统。只应在可信网络中临时使用。
> AI 接口在非本机监听时默认关闭，需要额外设置 `AI_ALLOW_REMOTE=1`，详见第六节。

### 健康检查

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ai/status
```

---

## 二、项目架构

```text
浏览器
  ├─ public/*.html          各页面（独立 HTML，无前端路由）
  ├─ public/css/site.css    全站样式
  ├─ public/js/*.js         原生 ES Module
  ├─ fetch public/data/*.json
  └─ /api/chat              AI 助手
        │
Express（server.js）
  ├─ 安全响应头 / gzip / 访问日志
  ├─ 静态托管 public/
  ├─ /api/health
  ├─ /api/ai/status、/api/chat → server-ai.js → DeepSeek
  └─ 中文 404
```

关键点：

- **没有数据库**。书目/作者是 JSON 文件；个人书库在浏览器 `localStorage`。
- **没有写接口**。服务端不保存用户书库、笔记或阅读记录。
- **没有前端构建**。改完 HTML/CSS/JS 直接刷新。
- `server-ai.js` 在启动时把 `books.json`、`authors.json`、`reading-lists.json` 读入内存；**改数据后如果希望 AI 也读到新数据，需要重启服务**。普通页面刷新即可。
- 首页「书库」筛选和书单进度只依赖浏览器 `localStorage`，不需要服务端参与。
- AI Key 只存在服务端，不会下发到浏览器。

---

## 三、目录结构

```text
├── server.js                 # Express：安全头、gzip、日志、静态资源、404、AI 注册
├── server-ai.js              # AI 代理：.env 读取、检索、会话、限流、DeepSeek 调用
├── package.json
├── pnpm-lock.yaml
├── .env.example              # 环境变量模板（不要提交真实 .env）
├── 启动服务.bat
├── README.md
├── data/                     # 开发期一次性数据整理脚本，不参与站点运行
│   ├── verify-reading-lists.mjs # 主题书单校验（引用、重复、300—500 字）
│   ├── verify-site.mjs      # npm test：数据、链接、资源与版本号
│   └── verify-library-store.mjs # npm test：状态切换保留日期/次数、非法日期
├── screenshots/              # 开发截图，已 gitignore
└── public/
    ├── index.html            # 书架首页
    ├── book.html             # 作品详情（?id=）
    ├── author.html           # 作者详情（?id=）
    ├── authors.html          # 作者索引
    ├── categories.html       # 分类浏览
    ├── reading-lists.html    # 主题书单索引（十条阅读路径）
    ├── reading-list.html     # 单份书单详情（?id=）
    ├── library.html          # 我的书库
    ├── roam.html             # 随机漫游
    ├── 404.html
    ├── css/
    │   └── site.css          # 全站样式，约 4300 行
    ├── data/
    │   ├── books.json        # 300 部作品
    │   ├── authors.json      # 67 位作者
    │   └── reading-lists.json # 10 份书单；只引用 book id
    └── js/
        ├── covers.js         # 数据加载、书影/书卡渲染、年代工具
        ├── ui.js             # 导航高亮、返回转场、/ 快捷键
        ├── book-effects.js   # 打开书页的翻书动画、返回标记
        ├── splash.js         # 开屏题词
        ├── index.js          # 首页筛选/排序/搜索/拼音
        ├── pinyin-authors.js # 作者拼音表
        ├── categories.js     # 体裁 → 七个分类的映射
        ├── categories-page.js
        ├── reading-lists-data.js # 书单读取、补全书目、进度、搜索
        ├── reading-lists-page.js # 书单索引页、搜索、书库进度
        ├── reading-list.js   # 单份书单详情、每站书库状态
        ├── authors.js
        ├── author.js
        ├── book.js           # 作品详情 + 书库面板
        ├── roam.js           # 随机漫游 + 摘句
        ├── date-picker.js    # 自绘日期选择器
        ├── library-store.js  # 书库 localStorage 读写
        ├── library.js        # 书库页面
        └── ai.js             # 悬浮 AI 助手
```

可选的 `public/covers/` 目录当前不存在；如果给书加真实书照，再创建它。

---

## 四、页面、路由与参数

### 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 书架 | `index.html` / `/` | 300 部书墙、年代、体裁/地区/奖项/书库状态筛选、排序、搜索 |
| 作品详情 | `book.html?id=bookId` | 简介、摘句、作者、收录书单、相关作品、个人书库 |
| 作者详情 | `author.html?id=authorId` | 生平、创作、作品、评论 |
| 作者索引 | `authors.html` | 按生年/姓名浏览 67 位作者 |
| 分类 | `categories.html` | 七个类别 |
| 主题书单 | `reading-lists.html` | 10 条编辑阅读路径；书库进度、下一站、路线搜索 |
| 单份书单 | `reading-list.html?id=listId` | 300—500 字导语 + 编号阅读顺序 + 每站在读/已读/想读状态 |
| 书库 | `library.html` | 在读 / 我看过 / 想读 / 时间轴 |
| 漫游 | `roam.html` | 随机抽书，展示荐语与摘句 |
| 404 | `404.html` | 服务端未知页面返回 |

### URL 参数

| 参数 | 页面 | 作用 |
| --- | --- | --- |
| `?q=关键词` | 首页 / 主题书单 | 首页初始搜索词；主题书单的路线搜索词 |
| `?id=xxx` | book / author / reading-list | 作品、作者或书单 ID |
| `?splash=0` | 首页 | 跳过开屏 |
| `?splash=1` | 首页 | 强制显示开屏 |
| `?turndemo=1` | 任意有书卡的页面 | 只播放翻书动画、不跳转，便于截图 |

首页的体裁/地区/奖项/书库/排序和书库标签页**不会写入 URL**，刷新后回到默认状态；书库数据本身会保留。主题书单搜索读取 `?q=`，但输入时不会改 URL。书单详情由 `?id=` 决定，未知 id 会显示站内的“没有找到这份书单”提示。

### API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务状态、uptime |
| GET | `/api/ai/status` | AI 是否配置、是否可用、书目/作者数 |
| POST | `/api/chat` | AI 问答；支持全站 / 只问本书 / 防剧透 / 书库推荐，详见 7.3 |
| GET | `/favicon.ico` | 返回 204，避免日志噪音 |

---

## 五、数据契约

所有数据文件使用 **UTF-8**。改完 JSON 必须校验，格式错误会导致页面空白。

### 5.1 `public/data/books.json`

```jsonc
{
  "site": {
    "description": "首页 meta 描述"
  },
  "books": [
    {
      "id": "wenhuakulv",              // 必填，唯一；建议小写字母/数字/中划线
      "title": "文化苦旅",              // 必填
      "coverTitle": "文化苦旅",          // 可选；封面书名，默认同 title
      "author": "余秋雨",               // 必填；必须与 authors.json 的 name 完全一致
      "year": 1992,                    // 必填；初版年份（整数）
      "publisher": "东方出版中心",       // 必填
      "genre": "散文",                  // 必填；必须在 categories.js 的映射内
      "awards": ["…"],                 // 可选；只写有依据的奖项
      "tags": ["散文", "文化散文"],      // 可选；搜索、地区筛选会用到
      "cover": {                       // 必填；CSS 书影设计参数
        "bg": "#33342F",
        "ink": "#EFE9DA",
        "accent": "#C9A227",
        "style": "frame"               // frame | vertical | numeral | band
      },
      "intro": ["段落一", "段落二"],     // 必填；当前每条 4 段以上
      "why": "一句话荐语",              // 可选，当前 300 部都有
      "note": "补充说明",               // 可选
      "quotes": [                      // 可选；只收可核实原文
        {
          "text": "原文句子",
          "from": "《文化苦旅》开头"     // 出处/位置
        }
      ],
      "photo": "covers/wenhuakulv.jpg" // 可选；真实书照，放 public/covers/ 下
    }
  ]
}
```

字段约定：

- `id` 用于 URL。不要用中文、空格或斜杠；建议 `^[a-z0-9-]+$`。
- `author` 必须和作者表 `name` **逐字一致**，否则作者页关联会断。
- `genre` 当前取值：`长篇小说`、`中篇小说`、`历史小说`、`历史`、`非虚构`、`散文`、`文化随笔`、`学术随笔`、`杂文`、`话剧`、`儿童文学`、`科幻`。新增体裁要同步 `categories.js`。
- `intro` 是一个字符串数组，每个元素一段；不要写成一个大字符串。
- `quotes` 最多放 1—2 句最有代表性的原文，必须能说出出处。**查不到就留空，不要编。**
- `cover.style` 四选一；`bg` / `ink` / `accent` 是颜色。
- `photo` 存在时优先真实照片，加载失败自动退回设计书影。图片放 `public/covers/`，并用相对 `public/` 的路径。
- CSP 只允许本站图片和 `data:`，不能直接引用外站图片。

### 5.2 `public/data/authors.json`

```jsonc
{
  "authors": [
    {
      "id": "yuqiuyu",          // 必填，唯一
      "name": "余秋雨",          // 必填，与 books.json 的 author 一致
      "born": 1946,             // 生年整数；未详写 null
      "years": "1946—",         // 展示用生卒年
      "place": "浙江余姚",       // 可选；地区筛选会用
      "role": "文化学者",        // 一句定位
      "tags": ["…"],            // 可选
      "bio": ["段落一"],         // 生平简介，字符串数组
      "works": ["…"],           // 可选；代表作
      "awards": ["…"],          // 可选
      "critique": ["段落一"]     // 可选；评论/评价
    }
  ]
}
```

当前 67 位作者都有 `works` 和 `critique`；39 位有 `awards`。

### 5.3 校验数据

```bash
node --input-type=module -e "import fs from 'node:fs'; for (const f of ['books','authors']) { const x = JSON.parse(fs.readFileSync('public/data/' + f + '.json','utf8')); console.log(f, 'ok', (x.books ?? x.authors).length); }"
```

再检查 ID 重复、作者名对不上、体裁未映射：

```bash
node --input-type=module -e "import fs from 'node:fs'; import { unmappedGenres } from './public/js/categories.js'; const b=JSON.parse(fs.readFileSync('public/data/books.json','utf8')).books; const a=JSON.parse(fs.readFileSync('public/data/authors.json','utf8')).authors; const ids=new Set(), dup=[]; for(const x of b){if(ids.has(x.id))dup.push(x.id);ids.add(x.id);} const names=new Set(a.map(x=>x.name)); console.log('duplicate ids:',dup); console.log('missing authors:',[...new Set(b.map(x=>x.author).filter(n=>!names.has(n)))]); console.log('unmapped genres:',unmappedGenres(b));"
```

### 5.4 `public/data/reading-lists.json`

主题书单不复制书目元数据，只按顺序引用 `books.json` 的 `id`；页面加载后再补成完整书卡。

```jsonc
{
  "updated": "2026-10",
  "intro": "索引页总说明，可选",
  "lists": [
    {
      "id": "northeast",                 // 必填，唯一；用于 reading-list.html?id=
      "title": "东北叙事",                // 必填
      "subtitle": "雪原、工厂与回不去的故乡",
      "theme": "地域与记忆",               // 索引卡上的小标签
      "intro": [                         // 300—500 字，建议拆成 2—3 段
        "为什么这几本放在一起……",
        "先读哪本，为什么……",
        "读完接哪本，路线怎么走……"
      ],
      "books": [                         // 有序；第一本就是起点
        { "id": "hulanhezhuan", "note": "起点。这一站读什么、注意什么。" },
        { "id": "eergunahai", "note": "第二站……" }
      ]
    }
  ]
}
```

约定：

- `lists` 顺序就是索引页和“下一条路线”的顺序；`id` 不要用中文或空格。
- `books` 必须有序，数组第一项是“起点”，最后一项是“终点”；详情页的编号、书影、年份范围和上下条路线都由此推导。
- 同一份书单里不要重复引用同一本书；不同书单可以重复，那是同一本书在不同路线中的不同角色。
- 每份书单建议 5—10 站，文学史路线可以到 20 站；当前共 10 份、70 个阅读站点、去重后 50 部作品。
- 每份 `intro` 当前 300—500 字；文字要回答“为什么放在一起 / 先读哪本 / 读完接哪本”，不要只写书目罗列。
- `note` 建议 20—50 字，写这一站在路线里的作用，而不是复制书的简介。
- `books.json` 里删书或改 id 时，必须同步清理书单引用；`reading-lists-data.js` 会跳过找不到的书并在控制台警告，但不应依赖这个兜底。

校验书单引用、重复、ID 和导语字数：

```bash
node data/verify-reading-lists.mjs
```

书单改动后普通页面刷新即可；AI 现在也会读取 `reading-lists.json`，要让 AI 看到新书单需要重启服务。

### 5.5 个人书库数据（localStorage）

书库完全存在当前浏览器，键名：

```text
wk_library_v1
```

结构：

```jsonc
{
  "v": 1,
  "entries": {
    "bookId": {
      "status": "reading",          // reading | read | wish
      "start": "2026-09-15",        // reading/read 必填；YYYY-MM-DD
      "end": "2026-10-22",          // 仅 read
      "reads": 2,                   // 仅 read；默认 1，重读一次 +1
      "note": "我的笔记",            // 仅 read；最多 4000 字
      "quote": "喜欢的句子",          // 仅 read；最多 2000 字
      "addedAt": "2026-10-22T11:01:51.694Z"
    }
  }
}
```

约定：

- 旧数据里的 `date` / `finish` 会迁移成 `end`。
- 开始日期晚于读完日期时，自动把开始日期收到读完日期。
- `reading` 只记开始日期；标记读完时补今天为 `end`，并保留开始日期。
- 笔记、摘句、重读次数只在 `read` 状态显示和编辑。
- 清浏览器数据 / 换浏览器 = 书库丢失，没有云端同步。
- 书库变更会触发 `window` 事件 `wk-library-change`，列表监听后重绘。

相关模块：`library-store.js`（纯数据）、`library.js`（书库页）、`book.js`（书页书库面板）、`date-picker.js`（日期选择）。

---

## 六、前端开发说明

### 6.1 没有构建，没有组件框架

- 每个页面是独立 HTML，导航栏和页脚是**复制**在各页面里的，不是模板。
- 改导航/品牌/页脚时，要同步改所有 `public/*.html`。
- 新增页面时：复制现有页面的 head、导航、页脚，再接入对应 JS。
- `ui.js` 根据 `location.pathname` 给导航加 `is-active`，新页面要确认高亮规则。

### 6.2 资源版本号（很重要）

所有 HTML 引用 CSS/JS 时带查询参数：

```html
<link rel="stylesheet" href="css/site.css?v=20261024e">
<script type="module" src="js/index.js?v=20261024e"></script>
```

改完 `.css` / `.js` 后，建议把所有 HTML 的版本号统一换成新值，避免浏览器 bfcache / 返回缓存继续用旧脚本：

```powershell
$ver = "20261024e"
Get-ChildItem public/*.html | ForEach-Object {
  $t = Get-Content $_.FullName -Raw -Encoding UTF8
  $t2 = $t -replace '\?v=[0-9A-Za-z]+', "?v=$ver"
  [IO.File]::WriteAllText($_.FullName, $t2, (New-Object Text.UTF8Encoding($false)))
}
```

服务端静态资源设置了 `Cache-Control: no-cache` + ETag，但仍建议 bump 版本，尤其是改过返回动画、日期选择器、筛选菜单这类容易被 bfcache 缓存的交互。

### 6.3 CSS 约定

- 颜色/字体/间距大量使用 `:root` 变量：纸色、墨色、朱红（`--paper`、`--ink`、`--seal` 等）。
- 类名沿用类似 BEM 的写法：`block__element`、`block--variant`、`is-active`、`is-returning`。
- 主要断点：`max-width: 1100px`、`max-width: 680px`。
- 全站尊重 `prefers-reduced-motion`，新动画要放进 reduced-motion 的降级路径。
- 宽屏首屏 `.hero__feature-cover` 预留 `aspect-ratio: 2/3`，书影异步插入不再撑高 hero（CLS）。
- 首页书墙首次只追加 40 张，其余用 `setTimeout` 分帧追加；筛选时 `renderToken` 会让旧批次自动失效。
- 开屏在 `prefers-reduced-motion: reduce` 下直接移除，不会先隐藏题词却继续锁滚动。
- 常用 z-index：导航 `50`、工具栏 `40`、AI 面板 `300`、筛选菜单 `500`、日期选择器 `600`、返回书影 `1200`。新增浮层时不要随手写 `9999`。

### 6.4 核心模块

| 模块 | 职责 |
| --- | --- |
| `covers.js` | `loadBooks()` / `loadAuthors()`、`createCover()`、`createBookCard()`、`decadeOf()`、`sortByYear()`、`esc()` |
| `ui.js` | 导航高亮、`/` 聚焦搜索、返回首页转场、滚动恢复 |
| `book-effects.js` | 点击书卡的翻书动画、写入 `wk_return` / `wk_book_arrival` |
| `splash.js` | 每个标签页会话只显示一次的开屏 |
| `index.js` | 首页筛选、书库状态筛选、排序、搜索、拼音、自定义下拉菜单 |
| `reading-lists-data.js` | 读取 `reading-lists.json`、按 book id 补全书目、统计、书单进度、搜索匹配 |
| `reading-lists-page.js` | 书单索引：路线卡、书库进度、搜索、三枚书影、导语摘要 |
| `reading-list.js` | 单份书单：起点/半程/终点、书库状态、进度条、编号路径、下一条路线 |
| `date-picker.js` | 全局单例日期选择器；`dateField()` + `initDatePicker()` + `date-change` 事件 |
| `library-store.js` | 书库数据读写、迁移、统计 |
| `library.js` | 书库页四个标签、条目编辑、时间轴、全屏 |
| `book.js` | 作品详情、书库面板、摘句 |
| `roam.js` | 随机漫游、摘句展示 |
| `ai.js` | 悬浮 AI 面板、会话、状态检查 |

### 6.5 不要使用原生 `<select>` / `<input type="date">`

- 原生 `<select>` 的下拉弹层由操作系统绘制，CSS 无法统一；筛选栏使用了自绘 `.filter__trigger` + `.filter__menu`。
- 日期字段使用 `date-picker.js`，不要改回 `input[type=date]`。
- 日期字段用法：

```html
<!-- 由 dateField(value, attrs) 生成，attrs 里可带 data-* -->
<button type="button" data-date-field data-value="2026-09-15">2026.09.15</button>
```

```js
import { dateField, initDatePicker } from "./date-picker.js";
initDatePicker();
container.addEventListener("date-change", (event) => { /* 读取 dataset.value */ });
```

- 日期统一 `YYYY-MM-DD` 存储；展示用 `formatDate()` / `displayDate()`。
- 日期选择器关闭：点外部、`Esc`；滚动时重新定位，不直接关闭。
- 打开时焦点落在已选日期，否则落在今天；每天有完整 `aria-label`，标题通过 `aria-labelledby` 关联。
- 未来日期禁用（阅读记录不能填未来）；选择后如果业务重绘替换了按钮，会用 `focusEquivalentField()` 找回同书同字段的新按钮。

### 6.6 自定义筛选菜单

筛选菜单在 `index.html` 的 `.filters` 里，每个筛选项结构：

```html
<div class="filter">
  <span>体裁</span>
  <button class="filter__trigger" type="button"
          data-filter-trigger="genre"
          aria-haspopup="listbox" aria-expanded="false">全部</button>
  <div class="filter__menu" data-filter-menu="genre" role="listbox" hidden></div>
</div>
```

`index.js` 中的 `FILTER_CONFIG` 决定选项：

```js
const FILTER_CONFIG = [
  { key: "genre", options: GENRE_OPTIONS },
  { key: "region", options: REGION_OPTIONS },
  { key: "award", options: AWARD_OPTIONS },
  { key: "library", options: LIBRARY_OPTIONS },
  { key: "sort", options: SORT_OPTIONS, all: false },
];
```

`library` 是书库状态筛选，选项为 `隐藏已读` / `只看想读`；匹配逻辑在 `matches()` 读取 `state.libraryEntries`，这个快照由 `getLibrary().entries` 在每次渲染前刷新。

新增筛选项：

1. 在 HTML 加一个 `.filter` 块（trigger + menu）。
2. 在 `FILTER_CONFIG` 加配置，`all: false` 表示没有“全部”。
3. 在 `matches()` 加匹配规则，在 `resetFilters()` 加重置值。
4. 在 `state` 和 `filtersActive()` 里补字段。
5. 用自绘菜单，不要再换回原生 `<select>`。

筛选状态会通过 `syncUrlState()` 写回 URL（`decade/genre/region/award/library/sort/q`），页面加载时由 `applyUrlState()` 恢复；从详情页返回时，浏览器恢复同一 URL，筛选和搜索结果不会丢。URL 使用 `replaceState`，不会为每次筛选制造新的返回栈。

地区筛选是**启发式**：先看书 `tags`，再看作者 `place`。新地区规则在 `REGION_OPTIONS` 里补 `tags` / `places`。

奖项筛选是对 `awards` 字符串做包含匹配；`茅盾文学奖`、`鲁迅文学奖` 均可用。

拼音搜索目前只覆盖**作者**：`pinyin-authors.js` 里是 `{ full, initials }`。输入 `yuhua` 或 `yh` 可找到余华；`yhg` 不是余华的拼音，不会命中。要支持书名拼音，需要另外补书名拼音数据。

### 6.7 返回首页动画（不要改回去）

用户明确要求：**从作品详情返回时，不要播放书页“合上/翻页”的那几帧，直接让封面缩小回首页卡片。**

当前实现：

1. 点击书卡进入详情时，`book-effects.js` 写入 `sessionStorage.wk_return`（书目 id、scrollY 等）。
2. 在详情页点返回时，`ui.js` 把详情页大书影的 `getBoundingClientRect()` 写进 `wk_return.coverRect`，然后**立即** `history.back()`；不再播放 720ms 的详情页淡出/合书。
3. 首页内联脚本检测到 `wk_return` 时先加 `html.is-returning` 遮罩，并设置 `history.scrollRestoration = "manual"`。
4. 首页书卡渲染完成后，`restoreReturnTarget()` 恢复滚动位置，`playShelfReturn()` 创建固定定位的 `.return-book` 克隆，从详情页书影的 `coverRect` 缩到目标卡片，真实封面暂时隐藏。
5. 如果旧 `scrollY` 与目标卡对不上（例如筛选状态未恢复、布局高度变化），`restoreReturnTarget()` 会把目标卡滚到页头下方，而不是停在无关位置。
6. 动画结束后删除克隆、恢复真实封面、移除遮罩。

相关常量在 `ui.js` 顶部（`RETURN_DETAIL`、`CLOSE_FRAMES`、`CLOSE_MS` 等），但**作品详情页返回会跳过关书动画**。改这里时请同时测：

- 从书墙中间位置打开一本书，返回后滚动位置是否还原；
- 返回动画是否从详情页书影位置开始，而不是突然从屏幕中央出现；
- 无 `prefers-reduced-motion` 时是否有 46 帧、约 560ms 的缩回动画；
- 移动端是否溢出；
- 浏览器自带返回键是否也能工作（`pagehide` 时会保存封面位置）。

### 6.8 书库页面

`library.html` 有四个标签：

- **在读**：只有开始日期；可标记读完；
- **我看过**：开始/读完日期、读过 N 遍、重读一次、笔记/摘句；
- **想读**：可开始读或直接读完；
- **时间轴**：顶部“正在读”分组，然后按读完年份分组。

默认逻辑：有在读的书时打开「在读」，否则打开「我看过」。

笔记输入使用 350ms 防抖 + 失焦立即保存，走 `setNote()` 的静默保存，不触发整页重绘，避免输入时丢焦点。重读次数用 `markReread()`。

状态切换会保留开始日期、读完日期、重读次数、笔记和摘句；`wish` / `reading` 只是暂不展示，切回 `read` 不会清空。移出书库前会二次确认。

标签栏使用 roving tabindex：`← / → / Home / End` 可切换「在读 / 我看过 / 想读 / 时间轴」并同步焦点。添加一本书的搜索结果按 12 条分页，匹配书名、作者和体裁，并提供「显示更多」。

书库状态现在也联动其他页面：

- 首页筛选栏新增「书库」：隐藏已读 / 只看想读。
- 主题书单索引显示 `已读 2/5 · 下一站《…》`，并按 `listProgress()` 计算进度条。
- 书单详情每站显示 `在读 / 已读 / 想读 / 未加入`，顶部显示路线进度。
- 在书页标记读完/想读后，返回书单或首页会通过 `pageshow` / `wk-library-change` 刷新状态，不依赖服务端。
- 所有状态仍然只存在本地 `localStorage`，不上传。

### 6.9 AI 前端

- `ai.js` 先请求 `/api/ai/status`；未配置 Key 时显示配置提示。
- AI 面板副标题优先使用 status 返回的 `books` / `authors`；如果连到的是旧服务端、没有这两个字段，前端会从 `/data/books.json`、`/data/authors.json` 兜底读取数量，避免停在“站内书目”。
- 发消息：`POST /api/chat`，带 `message`、`sessionId`、当前页面信息、`mode` / `scope` / `spoiler`；书库推荐额外带 `library`。
- 作品页默认打开「只问本书」：请求带 `scope: "book"`，服务端只注入当前书和作者资料，不注入全站 300 本书目录，避免泛泛而谈。关闭后回到全站助手。
- 「防剧透」默认关闭；打开后出现“读到哪一段”输入，请求带 `spoiler: { enabled, progress }`。防剧透开启时服务端不注入完整简介、名句和结局；读者未填进度时，AI 会先问进度再谈情节。
- 「书库推荐」读取本地书库的 `read` / `wish` 条目，只发送 `{ title, tags, status }`，最多 30 本；**笔记、摘句、日期、阅读遍数不会进入请求体**。服务端还会再次按站内真实书名白名单重建标签，丢弃客户端多带的字段。
- 面板关闭时带 `inert` + `visibility: hidden`，不可见控件不会进入 Tab；打开时恢复，关闭后焦点回到「问 AI」。「清空」和关闭按钮的触控目标至少 44px。
- 「清空」会中止正在进行的请求并清空会话；旧响应不会重新插回对话框，发送按钮立即恢复。
- 防剧透进度只接受章节/页码/百分比/常见位置等有限格式，服务端会过滤掉带指令意味的文本，避免拼进 system prompt。
- 本机监听时 AI 只接受 Host 为 `127.0.0.1` / `localhost` / `::1` 的请求，挡住 DNS rebinding；反向代理或公网部署需要显式设置 `HOST=0.0.0.0` 与 `AI_ALLOW_REMOTE=1`，并自行加访问控制。
- 会话 id 存 `sessionStorage`，刷新页面仍可继续；服务重启后服务端会话丢失。
- 聊天记录在 `sessionStorage`，悬浮按钮位置在 `localStorage`。
- 书库推荐是一次独立任务，不拼接之前的泛聊历史；其他模式的对话历史仍由服务端内存会话提供。
- AI 也读取 `reading-lists.json`：常驻 10 条书单索引；问到书单/阅读路径时，会按标题、主题、书中作品和标签检索相关书单，并附上 `reading-lists.html` / `reading-list.html?id=…` 链接。作品页的“只问本书”仍可回答本书收录于哪些书单。
- `server-ai.js` 还维护 `SITE_MODULES` 网站模块清单（书架、分类、主题书单、书单详情、作品详情、作者、漫游、书库、AI 助手、导航/404）。新增页面或功能时同步改这里，否则 AI 回答“网站有哪些模块”会漏项。

### 6.10 移动端页头搜索

- ≤900px 隐藏桌面搜索框，`ui.js` 在页头注入「搜」按钮和可展开搜索条；提交后去 `index.html?q=…`。
- 打开搜索条时焦点进入输入框；`Esc` 或点外部关闭；窗口放大到 >900px 时自动收起。
- 移动端导航不再隐藏「关于」，7 个导航项使用横向滚动，不把页面撑宽。
- 404 页也加载 `ui.js`；服务端嵌套 404 的 `<base>` 让搜索与导航回到根路径。

---

## 七、服务端与 AI

### 7.1 `server.js`

处理顺序：

1. `/api` 一律 `Cache-Control: no-store`；
2. 安全响应头与 CSP；
3. gzip（文本/JSON/JS/CSS，≥1KB；`gzip;q=0` 不压缩）；
4. 访问日志；
5. JSON 解析，限制 64KB（放在安全头/日志之后，畸形 JSON 也有完整头和日志）；
6. `/api/health`；
7. `public/` 静态托管（`no-cache` + ETag）；
8. 注册 AI 路由；
9. API 404 JSON、页面 404 HTML；
10. 兜底错误。

CSP 当前允许站内资源、`data:` 图片、内联脚本/样式；**不允许外站图片、脚本、字体、connect**。要引入 CDN 或外链图片，必须同时改 `server.js` 的 CSP。

页面 404 在 Node 服务端返回时会注入 `<base href="/">`；`404.html` 自身也在 `127.0.0.1` / `localhost` 下用内联脚本补根 base，因此旧服务进程直接返回 404.html 时嵌套路径也能加载根目录 CSS/JS；同时设置 `Cache-Control: no-store`。GitHub Pages 没有 Node 注入逻辑，自定义域/子路径 404 仍按静态相对路径处理。

`/api` 的畸形 JSON 现在会经过安全头、`no-store` 和访问日志，再返回中文 400；不再出现“有响应体但没有安全头”的情况。

### 7.2 `.env`

复制 `.env.example` 为 `.env`，填写：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 空 | 必填；没有它 AI 不可用 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `3000` | 端口 |
| `AI_ALLOW_REMOTE` | 空 | 非本机监听时，设为 `1` 才允许 AI |
| `AI_DAILY_LIMIT` | `300` | 每日全站 AI 请求上限（最小 10） |

`.env` 已在 `.gitignore` 中，**不要提交真实 Key，也不要截图分享**。

### 7.3 AI 行为与限制

`POST /api/chat` 请求体：

```jsonc
{
  "message": "《活着》里福贵后来怎么样了？",
  "sessionId": "可选；服务端会话 id",
  "page": { "path": "/book.html", "id": "huozhe", "hash": "" },
  "mode": "chat",                       // chat | library
  "scope": "book",                      // site | book；仅作品详情页有效
  "spoiler": { "enabled": true, "progress": "第三章" },
  "library": [                          // 仅 mode=library
    { "title": "活着", "tags": ["苦难"], "status": "read" }
  ]
}
```

四种行为：

- **全站助手**（默认 `scope: "site"`）：保留全站索引 + 检索条目，适合问站内统计、跨书推荐、作者关系。它仍然只依据站内资料，不抓取外网。
- **只问本书**（`scope: "book"`）：只在作品详情页生效。服务端不注入 `CATALOG` / `AUTHOR_INDEX`，只注入当前 `bookBlock` 和 `authorBlock`；问题超出本书范围时，会提示关闭开关。前端在作品页默认打开，可在面板里关闭。
- **防剧透**（`spoiler.enabled`）：开启且进度不是“读完/看完”时，服务端不注入完整简介、名句和结局，只给书名、作者、年份、体裁、标签和荐语；prompt 要求 AI 只讨论读者已读位置之前的内容，未填进度时先问“你读到哪一段”。进度只接受章节/页码/百分比/“一半”等有限格式（如“第 3 章”“第 80 页”“50%”“刚到一半”），带指令意味的文本会被丢弃，避免拼进 system prompt。这是提示词 + 资料裁剪的双重约束，不能保证模型 100% 不说漏，但不会主动把页面上的结局资料喂给它。
- **书库推荐**（`mode: "library"`）：只读本地书库的 `read` / `wish` 条目；请求体只含 `{ title, tags, status }`，最多 30 本。服务端 `sanitizeLibrary()` 再按站内真实书名白名单重建条目，**笔记、摘句、日期、评分、阅读遍数一律丢弃**。候选书由标签/体裁/作者重叠度排序，prompt 只带“书库摘要 + 候选书”，不注入全站目录；推荐任务不拼接历史泛聊。

其他限制：

- 模型调用：`server-ai.js` 在服务端读取书目/作者，按问题检索相关书与作者，返回答案 + 服务端生成的站内链接。
- 会话：服务端内存保存，30 分钟无活动过期；最多 16 条；最多 300 个会话。
- 限流：每 IP 最短间隔 1.2 秒；每分钟 10 次；每小时 60 次；每日全站上限由 `AI_DAILY_LIMIT` 控制。
- 单条问题最多 1000 字；请求体 64KB；AI 超时 35 秒。
- 非本机监听（如 `0.0.0.0`）时，`REMOTE_BLOCKED` 默认关闭 AI；设 `AI_ALLOW_REMOTE=1` 才会开放。
- 本机监听时 `sameOrigin()` 还要求 Host 是回环名（`127.0.0.1` / `localhost` / `::1`），防止 DNS rebinding；反向代理或公网域名需要显式改监听/开关并自行加访问控制。
- 错误状态：未配置 Key `503`；来源不合法/远程关闭 `403`；空书库推荐 `400`；限流 `429`；上游错误 `502`；超时 `504`。
- AI 会话只存在内存，**重启服务会清空**。
- 书库推荐不会把书库写回服务器，也不会改变本地书库；它只读当前浏览器数据并构造一次请求。

### 7.4 数据与 AI 的加载时机

- `books.json` / `authors.json` / `reading-lists.json` 在 `server-ai.js` 启动时读入内存，用于检索与 prompt。
- 新增/修改书、作者或书单后：
  - 普通页面：刷新即可；
  - AI 助手：需要重启服务，才会把新数据加入检索。
- `reading-lists.json` 中的 book id 必须能在 `books.json` 找到；服务端会跳过找不到的站，但书单页面和数据校验脚本会报告。
- `categories.js` 也被服务端引用；改分类映射后要重启。

---

## 八、常见开发任务

### 8.1 加一本书

1. 先确认作者是否已在 `authors.json`；没有就先加作者。
2. 在 `books.json` 的 `books` 数组加对象。
3. 填 `id`、`title`、`author`、`year`、`publisher`、`genre`、`cover`、`intro`、`tags`。
4. `author` 必须与作者 `name` 完全一致。
5. `genre` 必须在 `categories.js` 的映射内。
6. 如果有可靠原文，加 `quotes`；否则留空，不要编。
7. 校验 JSON、ID 唯一、作者存在、体裁已映射。
8. 跑首页、详情页、作者页、分类页、AI（需重启）检查。

### 8.2 加一位作者

1. 在 `authors.json` 加 `id`、`name`、`born`、`years`、`place`、`role`、`bio`。
2. 建议补 `works`、`critique`；有依据再补 `awards`。
3. 确认 `books.json` 里该作者的 `author` 已逐字匹配。

### 8.3 补摘句

- `quotes` 数组，每项 `{ text, from }`。
- 优先补名家代表作的开头/结尾，一部书 1—2 句即可。
- 必须有出处；查不到就保持空，页面会显示“暂无可靠原文摘句”。
- 漫游页只展示每本书的**第一句**（`quotes[0]`），所以把最有代表性的一句放在最前面。
- 当前进度 48/300，剩余 252 本待补。

### 8.4 改筛选 / 排序

见 6.6。不要用原生 `<select>`。

### 8.5 改书库字段

- 所有读写集中在 `library-store.js`。
- 新增字段时，在 `normalize()` 给旧数据默认值，避免旧记录读出来是 `undefined`。
- 如果是破坏性结构变更，才考虑升级 `wk_library_v1` 键名并写迁移；不要直接清用户数据。
- 新字段要在 `library.js` / `book.js` 的渲染和保存逻辑里同步。

### 8.6 改 AI 提示词 / 检索

- 在 `server-ai.js` 的 `buildPrompt()` / `retrieve()` / `buildLinks()` 改。
- 改完必须重启服务。
- 不要把 Key、`.env`、内部 prompt 结构输出给前端；已有输出过滤，但仍要谨慎。

### 8.7 改封面样式

- 设计书影：`covers.js` + `site.css` 的 `.cover` 系列。
- 新增 `cover.style` 时，要同时补 CSS 和 `createCover()` 的分支。
- 真实书照：放 `public/covers/`，在书上加 `"photo": "covers/xxx.jpg"`；加载失败会回退。

### 8.8 加 / 改主题书单

1. 在 `public/data/reading-lists.json` 加一个对象，`id` 用小写英文短横线。
2. 按阅读顺序填 `books`，每项只写 `id` 和 `note`；第一项是起点，最后一项是终点。
3. `intro` 写 300—500 字，分三段回答：为什么放在一起、先读哪本、读完接哪本。
4. 确认所有 book id 都存在于 `books.json`，同一份书单内不重复。
5. 跑 5.4 的校验命令；刷新索引页、详情页和至少一本书的作品页。
6. 普通页面刷新即可；要让 AI 立刻看到新书单，重启服务（`server-ai.js` 启动时载入 `reading-lists.json`）。
7. 书单只从站内现有书目中选；没有收的作者（例如班宇）不要硬加一条虚构书目，可在编辑说明里注明。
8. 索引页搜索由 `listMatchesQuery()` 负责，匹配路线名、副题、主题、作者、书名、标签和每站提示；增删书目后不需要额外配置。
9. 路线进度由 `listProgress()` 从 `wk_library_v1` 计算，第一本未读的书就是“下一站”；不要另建一份进度数据。

---

## 九、测试与验收

已有静态检查，GitHub Actions 发布前也会跑 `data/verify-site.mjs`；但还没有浏览器 E2E。常用检查：

```bash
npm test
# 若 PowerShell 禁止 npm.ps1，可直接运行：
node data/verify-site.mjs
node data/verify-library-store.mjs
# 等价于：书目/作者/书单数量、书单引用、导语字数、HTML 站内链接、资源与版本号、书库状态回归

# 语法
node --check server.js
node --check server-ai.js
node --check public/js/index.js
node --check public/js/library.js
node --check public/js/library-store.js
node --check public/js/reading-lists-data.js
node --check public/js/reading-lists-page.js
node --check public/js/reading-list.js
node --check public/js/ai.js
node --check public/js/date-picker.js

# 健康检查
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ai/status

# 畸形 JSON 的 400 也应带安全头 / no-store
curl -i -X POST http://127.0.0.1:3000/api/chat -H "Content-Type: application/json" -d "{bad"
```

手工验收清单：

- [ ] 首页显示 300 部；搜索 `yuhua` / `yh` 能找到余华作品。
- [ ] 输入搜索/切换筛选后打开一本书，再返回：搜索词、筛选、计数和滚动位置都恢复；目标书卡在视口内。
- [ ] 300 部书架分帧追加后仍完整；筛选时不会残留上一轮书卡；`#about` 锚点不被分批渲染顶偏。
- [ ] 宽屏 1440px、`?splash=0` 首次加载时，右侧“同名之作”占位高度稳定，不把工具栏推下去（CLS 接近 0）。
- [ ] AI 面板关闭时按 Tab 不会进入清空/关闭/书库推荐/推荐问题/输入框；打开后能正常聚焦，关闭后焦点回到「问 AI」。
- [ ] `prefers-reduced-motion: reduce` 下首页不显示开屏、页面不被锁滚动 5 秒。
- [ ] 手机页头有「搜」按钮可展开搜索；「关于」可从导航进入；横向滑动导航不把页面撑宽。
- [ ] 「书单」导航进入 `reading-lists.html` 显示 10 条路线；每张卡的三枚书影、导语摘要、起点/终点正确。
- [ ] 打开任意书单，导语为 300—500 字，阅读路径按编号排列，起点/终点标记正确，点击书影/书名能进作品页。
- [ ] 作品页「收录于主题书单」显示该书的书单位置；不在书单里的书不显示这一节。
- [ ] 书单页「下一条路线」可从第 10 条绕回第 1 条；未知 `?id=` 显示友好提示。
- [ ] 书单索引可以按路线名、主题、作者、书名搜索；`双雪涛` 能找到东北叙事，结果数和空状态正确。
- [ ] 书单索引显示书库进度：例如已读 1/5、下一站/接着读；详情页每站显示在读/已读/想读/未加入，顶部进度条同步。
- [ ] 首页「书库」筛选可选择隐藏已读 / 只看想读；从书页标记后返回首页或书单，进度立即刷新。
- [ ] 体裁、地区、奖项、书库、排序五个自绘菜单能打开、选择、重置，点外部/Esc 能关闭。
- [ ] 手机 390px 下筛选菜单在视口内，页面无横向滚动。
- [ ] 打开一本书再返回，滚动位置还原，封面从详情页位置缩回卡片，没有书页合上/翻页帧。
- [ ] 日期选择器打开后焦点在已选日期/今天；选完后即使字段重绘，焦点仍在同一本书的开始/读完字段；未来日期不可选。
- [ ] 书库状态在已读、在读、想读之间切换，日期和重读次数不丢；移出书库有二次确认。
- [ ] 书库标签栏可用 `← / → / Home / End` 切换；添加一本书搜索超过 12 条时出现“显示更多”。
- [ ] 书库「在读」可以开始日期、标记读完；开始日期保留，读完日期补今天。
- [ ] 「我看过」可以改开始/读完日期、重读 +1、写摘句/笔记，刷新后仍在。
- [ ] 时间轴顶部有“正在读”分组，读完后归入对应年份。
- [ ] 漫游到有摘句的书，能看到原文和出处。
- [ ] AI 面板同时清空正在请求的对话：旧回答不会在清空后插回来，发送按钮立即恢复。
- [ ] 未配置 AI Key 时，AI 面板给出配置提示；配置后能问答。
- [ ] 作品页打开 AI，默认「只问本书」开启；问跨书推荐会被提示关闭开关；关闭后可问全站。
- [ ] 打开「防剧透」，不填进度问情节，AI 先问“读到哪一段”；填入“第三章 / 一半”后，回答不主动讲后文。
- [ ] 「书库推荐」只读取已读/想读；空书库给出提示；抓包/看请求体时，`library` 里没有 `note`、`quote`、`start`、`end`、`reads`。
- [ ] 问 AI「书单里都有什么」能列出主题书单并给 `reading-lists.html` 链接，不再回答“没有书单页面”；从书单详情页问“先读哪本”能识别当前书单。
- [ ] 问 AI「网站都有哪些模块」时，回答必须包含主题书单、我的书库和 AI 助手，不能只列书架/分类/漫游/作者。
- [ ] 访问 `/a/b` 这类嵌套未知路径：仍是 404，但页面有样式、导航完整、资源不 404。
- [ ] 畸形 JSON 的 400 带 CSP、`X-Content-Type-Options`、`Cache-Control: no-store`。
- [ ] 本机服务收到 `Host: evil.example` 的 `/api/chat` 返回 403（DNS rebinding 防护）。
- [ ] 控制台无报错；`prefers-reduced-motion` 下动画降级。

测试书库时注意：Playwright / 浏览器测试会写入真实 `localStorage`。要恢复干净状态，在 DevTools 执行：

```js
localStorage.removeItem("wk_library_v1");
sessionStorage.clear();
```

---

## 十、常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 改了 CSS/JS 没生效 | 刷新；必要时 bump 所有 `?v=`；Ctrl+F5 强刷；检查是否有旧标签页 bfcache |
| 端口 3000 被占用 | 多半已有服务在跑，直接访问；或关旧窗口；或换 `PORT` |
| 页面空白、数据加载失败 | 必须通过 `http://127.0.0.1:3000` 访问，不能双击 HTML |
| 改完 JSON 页面空白 | JSON 语法错误；用 `node` 校验 |
| 作者页作品为空 | `books.json` 的 `author` 与 `authors.json` 的 `name` 不一致 |
| 分类页少书 | 新 `genre` 没加入 `categories.js` |
| 书单卡片少书 / 控制台警告 | `reading-lists.json` 引用了不存在的 book id，或 id 拼错 |
| 书单详情显示“没有找到” | URL 的 `?id=` 与 `reading-lists.json` 的 `id` 不一致 |
| 书单导语太长/太短 | 按 5.4 的命令统计汉字数；300—500 字，不要把书目简介直接复制进来 |
| 书单进度不更新 | 书库记录以 book id 关联书籍；确认书目 id 没改。从书页/书库返回时会读一次 `wk_library_v1` |
| 首页「只看想读」是空的 | 书库的 `wish` 条目为空；先到书页或书库页加入想读 |
| 书库记录没了 | 清了站点数据/换浏览器/隐私模式；书库只在本机 localStorage |
| 日期选择器不弹 / 位置不对 | 确认调用了 `initDatePicker()`，字段用 `dateField()`；检查 z-index |
| 日期选择后焦点跑到页面顶部 | 业务重绘会替换按钮；`date-picker.js` 的 `focusEquivalentField()` 会按 `data-*` 和所在书库条目的 id 找回新按钮 |
| 嵌套 404 页面没有样式 | Node 服务端会注入 `<base href="/">`；直接双击 HTML 或静态托管到子路径时不适用 |
| 手机页头没有搜索入口 | 页头「搜」按钮由 `ui.js` 注入；≤900px 显示，桌面仍用原搜索框 |
| 筛选菜单样式变成系统蓝 | 说明又用了原生 `<select>`；改回 `.filter__trigger` + `.filter__menu` |
| AI 提示未配置 | `.env` 没有 `DEEPSEEK_API_KEY`；填完重启 |
| AI 403 | 非本机监听且未设 `AI_ALLOW_REMOTE=1`；或请求来源不合法 |
| AI 429 | 触发限流/每日上限；等一会儿或调 `AI_DAILY_LIMIT` |
| AI 回答没有新书 | AI 数据在启动时加载；重启服务 |
| AI 还是旧模块/旧书单答案 | 3000 上可能仍是旧 Node 进程：在同端口重启，确认 `/api/health` 的 uptime 归零；静态 HTML 即使更新，Node 的 `server-ai.js` 不会热替换 |
| AI 书库推荐提示空书库 | 只在「我看过」「想读」里标记过才可用；“在读”不计入推荐摘要 |
| AI 防剧透仍然讲后文 | 当前是提示词 + 资料裁剪，不是章节级数据库；可把进度写得更具体，或先只问人物/主题 |
| AI 提示“只问本书”范围外 | 这是作品页的默认开关；关闭面板里的「只问本书」再问全站 |
| 返回动画又出现合书帧 | 检查是否在作品详情页重新调用了 `playClose()`；详情页应直接保存 `coverRect` 后返回 |

---

## 十一、已知限制与下一步

- **摘句未补全**：48/300；252 本仍是“暂无可靠原文摘句”。不能为了数量编造。
- **拼音搜索只覆盖作者**，不覆盖书名；`yuhua` / `yh` 可找余华，`yhg` 不匹配。要做书名拼音，需要补数据。
- **地区筛选是启发式**：依据 `tags` + 作者 `place`，不是严格的文学地理数据库。
- **主题书单是编辑路线，不是个性化推荐**：目前 10 条覆盖 50 部作品；未收录作者（例如班宇）不会出现在书单里，书单页会明确说明只从站内书目选取。
- **AI 读取主题书单索引**：`reading-lists.json` 在服务启动时载入；改完书单后普通页面刷新即可，AI 需重启服务。作品页“只问本书”只回答本书收录书单，全部路线要关闭该开关。
- **防剧透不是章节级数据库**：站点没有按章节切分的情节摘要，防剧透模式只能拒绝注入完整简介/名句/结局，靠 prompt 约束模型；不能保证百分百不说漏。
- **书库推荐只使用「已读 / 想读」**：这是有意的隐私边界；“在读”和笔记/日期不参与推荐。
- **书库只在本地**：没有账号、云同步、导出/导入（可后续加 JSON 导出）。
- **有静态检查与发布前 CI，但没有浏览器 E2E**：`npm test` 覆盖数据、链接、资源、版本和书库状态回归；Pages 工作流发布前会再跑一次站点自检；CLS、焦点顺序、日期选择器、AI 交互仍靠手工/Playwright 回归。
- **AI 是本地代理**：需要外网和 Key；服务重启会清空会话；没有多用户权限。
- **CSP 仍保留 `'unsafe-inline'`**：页面有内联启动脚本和样式；要收紧需要先移除内联脚本并加 nonce/hash。
- **封面是版式再创作**，不是原书扫描；真实书照当前为 0 张。
- **“书目顺序”按数据数组倒序**，不是真实入库时间。
- **站点无登录系统**，不要直接暴露到公网；开启 `AI_ALLOW_REMOTE=1` 前先加访问控制。

---

## 十二、部署到 GitHub / 公网

先分清两件事：

- **GitHub 仓库**只是放代码，不会自动运行 Express。
- **GitHub Pages** 只能托管静态文件，不能运行 `server.js`、`server-ai.js`，所以没有 AI、没有 `/api/*`、没有服务端安全头。
- 要保留完整功能（AI、Express 头、404、限流），需要 Render / Railway / Fly / VPS 这类能跑 Node 的平台。

### 12.1 推到 GitHub

本地仓库已经有提交历史，缺的只是远端。第一次发布：

1. 在 GitHub 网页右上角 **+ → New repository** 新建空仓库：
   - **Repository name** 填 `wenhuakulv`；
   - 可见性选 **Public**（公开仓库才能免费开 Pages；Private 需要付费方案）；
   - **不要**勾选 Add a README / .gitignore / license，否则第一次 push 会冲突。
2. 回到本地，设置提交作者（只对这个仓库生效）并绑定远端：

```bash
git config user.name "wuliuqi5678"
git config user.email "wuliuqi5678@users.noreply.github.com"
git remote add origin https://github.com/wuliuqi5678/wenhuakulv.git
git push -u origin main
```

3. 第一次 push 会弹出浏览器让你登录 GitHub（Git Credential Manager）。登录后凭据存进 Windows 凭据管理器，之后 push 不再询问。

说明：

- `.env`（含 DeepSeek Key）已被 `.gitignore` 忽略，不会上传；不要用 `git add -f .env`。
- `node_modules/`、`.pnpm-store/`、`screenshots/` 同样不会上传。
- `data/` 是数据整理与校验脚本，会一起提交；`npm test` 与 CI 只用到 `data/verify-*.mjs`。
- 公开仓库意味着 `public/data/` 里的书目、作者、摘句全部公开——这本来就是网站要给人看的内容。
- 如果曾经把真实 Key 提交过，先去 DeepSeek 控制台作废重发，再清理历史；只删当前文件不够。

### 12.2 方案 A：GitHub Pages（免费，只展示静态站）

适合“让别人浏览书目 / 详情 / 书单 / 书库”，**AI 不可用**（AI 需要 Node 后端）。

仓库里已经准备好：

- `.github/workflows/pages.yml`：push 到 `main` 后自动把 `public/` 发布到 Pages；发布前先跑 `node data/verify-site.mjs`，数据或站内链接有问题就不发布；
- `public/.nojekyll`：避免 Jekyll 处理静态资源；
- 页面链接与 `data/*.json` 全部用相对路径，`/仓库名/` 子路径下直接可用；
- `404.html` 在 `*.github.io` 下把自己锚回仓库根，深层路径的 404 也有样式；
- `ai.js` 在 `*.github.io` 下不渲染 AI 入口，访客不会点到只会报错的按钮。

启用步骤：

1. 按 12.1 推完代码。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment → Source** 选 **GitHub Actions**（不要选 “Deploy from a branch”）。
4. 打开 **Actions** 标签，等 `Deploy static site to GitHub Pages` 跑完。如果第一次因为 Pages 还没开启而失败，点 **Re-run all jobs** 再来一次。
5. 访问：

```text
https://wuliuqi5678.github.io/wenhuakulv/
```

之后每次 `git push` 到 `main`，Actions 都会自动重新发布，一般 1 分钟内生效。

注意：

- Pages 不执行 `server.js`，所以 `/api/health`、CSP、gzip、Node 版 404 都不生效；静态页面本身照常访问。
- 书库（已读 / 想读、笔记、日期）存在访客自己的浏览器 localStorage 里，不会上传到服务器。
- 想绑自定义域名：在 **Settings → Pages → Custom domain** 填域名并配 DNS；同时要改 `ai.js` 里的 `IS_STATIC_HOST` 判断，否则 AI 按钮会重新出现。
- 打开是 404 时，先确认 Actions 成功、Pages Source 是 GitHub Actions、仓库里确实有 `public/index.html`。

### 12.3 方案 B：Render / Railway（完整站点 + AI）

以 Render 为例：

1. GitHub 仓库推好后，在 Render 新建 **Web Service**，连接该仓库。
2. 配置：
   - Runtime：Node
   - Build Command：`npm install`
   - Start Command：`npm start`
3. 环境变量：
   - `HOST=0.0.0.0`（必须，平台需要监听所有网卡）
   - `DEEPSEEK_API_KEY=...`（想启用 AI 才填）
   - `PORT` 由平台注入，不要写死
   - `AI_ALLOW_REMOTE=1` **只在你能接受公开 AI 额度被刷时设置**；当前 `/api/chat` 没有用户登录，只有 IP 限流
4. 部署完成后用平台给的公网 URL 访问。

说明：

- 不设置 `DEEPSEEK_API_KEY` 时，站点仍可浏览，AI 面板会提示未配置。
- 设置 `HOST=0.0.0.0` 后，`server-ai.js` 默认会关闭 AI；要开启必须显式 `AI_ALLOW_REMOTE=1`。公开站点建议先保持关闭，或先加访问令牌/登录。
- Render 免费实例会休眠；会话保存在内存，重启/休眠会丢 AI 会话。
- 书库仍然只存在访问者自己的浏览器，不会上传到服务器。

### 12.4 我的建议

- **只是让别人看书、看介绍**：GitHub Pages，零成本，最简单（本站已按这个方案配置，地址见文首）。
- **要保留 AI 助手**：Render/Railway，且不要把 AI 直接裸露在公网；先加访问控制，或暂时不配 Key。
- 不要为了“能跑”把 `server.js` 改成纯前端；AI Key 一旦进浏览器就必然泄露。

---

## 十三、维护与提交

- `.env`、`node_modules/`、`screenshots/` 已在 `.gitignore`；不要提交密钥和截图。
- `data/` 下是开发期数据整理脚本，不是运行时依赖；可保留作历史，也可清理。
- 改动较大时建议：
  1. `node --check` 相关 JS；
  2. 校验 JSON；
  3. 本机跑一遍首页（含书库筛选）/ 书单（搜索、进度、每站状态）/ 作品页 / 书库 / 漫游；
  4. 手机宽度看一遍；
  5. bump 资源版本；
  6. git 提交说明写清“数据 / 前端 / 服务端 / AI”哪一块。

更细的交互细节以 `public/js/` 源码和 `public/css/site.css` 为准；这份 README 负责说明结构、契约和容易踩的坑。

---

## 附录：测试报告修复对照（2026-10-24）

依据 `文化苦旅-测试报告.md` 完成的第一批修改：

| 报告项 | 状态 | 处理 |
|---|---|---|
| H1 筛选后返回错位 | 已修 | 筛选/搜索写 URL，返回先恢复再渲染；目标卡不在视口时滚动到目标卡 |
| H2 首屏 CLS 0.543 | 已修 | `hero__feature-cover` 预留 2/3 宽高比，异步书影不再撑高 hero |
| H3 AI 隐藏面板可聚焦 | 已修 | 关闭态 `inert` + `visibility: hidden`，打开恢复；面板补 `role="dialog"` |
| H4 减少动效下开屏锁滚动 | 已修 | `prefers-reduced-motion` 时直接移除开屏，不添加 `splash-open` |
| M1 300 卡重建长任务 | 已缓解 | 首屏 40 张、其余分帧追加；筛选用 token 取消旧批次（未做虚拟列表） |
| M2 AI 清空竞态 | 已修 | `AbortController` + 请求序号；清空后旧响应不落回 |
| M3 日期选择器焦点/ARIA | 已修 | 日期按钮 aria-label、标题 labelledby、重绘后焦点找回；禁用未来日期 |
| M4 状态切换丢日期/次数 | 已修 | `normalize()` / `setStatus()` 保留字段；移出书库二次确认 |
| M5 移动搜索/关于缺失 | 已修 | ≤900px 注入「搜」搜索条；「关于」保留在导航，页脚也补入口 |
| M6 标签栏无键盘模式 | 已修 | roving tabindex + `←/→/Home/End` |
| M7 添加搜索最多 12 条 | 已修 | 显示总数与「显示更多」，搜索覆盖体裁 |
| M8 豆豆等生年 null 的同时代人 | 已修 | 当前作者生年未知时不计算 nearby |
| M9 DNS rebinding / 代理 Host | 已修 | 本机监听要求 Host 为回环名；公网需显式远程开关 |
| M10 防剧透进度注入 | 已修 | 进度白名单格式，非法文本丢弃，不拼进 system prompt |
| L1 嵌套 404 失去样式 | 已修（本地） | `404.html` 本地 host 补 `<base>`；Node 404 再注入 base |
| L2 404 导航不全 | 已修 | 补书库/关于/搜索 |
| L3 「最近添加」语义 | 已修 | 改名为「书目顺序」 |
| L4 畸形 JSON 无安全头 | 已修 | JSON 解析移到安全头/no-store/日志之后 |
| L5 CSP unsafe-inline | 未改 | 页面仍有内联脚本/样式；收紧需单独做 nonce/hash 迁移 |
| L6 AI 小触控目标 | 已修 | 清空/关闭至少 44×44 |
| L7 README 90/70 不一致 | 已修 | 当前统一为 48/300 摘句、252 未补 |
| L8 错误文案/无测试入口 | 部分修 | 增加 `npm test` 静态检查、书单校验与书库状态回归；仍未做浏览器 E2E |
| L9 日期/Node/压缩/密钥 | 部分修 | 严格日历、禁用未来、`gzip;q=0`、Node ≥20；密钥轮换仍靠部署流程 |

仍未做的：CSP 严格化、浏览器 E2E、自定义域名下的 AI 入口检测、公网 AI 登录或访问令牌。
