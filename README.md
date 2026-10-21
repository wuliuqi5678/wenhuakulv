# 文化苦旅 · 中国现当代文学书影

一个使用 Express 本地运行的中文书籍介绍网站，收录 53 部中国现当代文学作品，
提供按年代筛选、书名与作者搜索、分类浏览、作者介绍、作品详情和随机漫游。
书目与作者介绍保存在 `public/data/`，封面由 CSS 版式生成，不依赖外部图片或服务。

---

## 一、以后怎么自己启动

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

> 改动了 `server.js` 或 `src/` 下的代码后，**必须重启服务**才会生效。

### 前提条件

- 已安装 Node.js（到 <https://nodejs.org/> 下载 LTS 版，一路下一步即可）
- `node_modules` 文件夹存在（即依赖已安装过）

如果 `node_modules` 被删了或换了台电脑，先执行一次安装，二选一：

```bash
npm install      # npm 随 Node 一起装好，直接用
pnpm install     # 如果装了 pnpm
```

装完再启动即可。平时启动**不需要**重新安装。

---

## 二、目录结构

```
启动服务.bat                双击启动用
server.js                   服务入口：中间件、路由挂载、启动
public/index.html           书架首页
public/categories.html      体裁分类
public/authors.html         作者索引
public/author.html          作者详情
public/book.html            作品详情
public/roam.html            随机漫游
public/css/site.css         全站样式
public/js/                  页面交互与书影组件
public/data/books.json      作品资料与荐语
public/data/authors.json    作者生平与介绍
src/store.js                数据层：JSON 文件持久化
src/cities.js               世界城市清单：IANA 时区 + 经纬度
src/sun.js                  太阳位置与日出日落算法（NOAA 公式）
src/routes/tasks.js         任务 REST 路由
src/routes/time.js          北京时间路由
src/routes/world.js         世界时间 / 日出日落路由
scripts/check-sun.mjs       算法核对：打印若干城市的日出日落，便于和官方数据对照
scripts/check-world-api.mjs 接口自测：城市列表、日出日落、异常入参
scripts/make-server-icon.py 生成 assets/server.ico（服务器样式图标）
assets/server.ico           桌面「服务器启动」快捷方式使用的图标
assets/server.png           上面图标的 256×256 预览图
data/tasks.json             运行时生成的数据文件
pnpm-workspace.yaml         pnpm 配置（依赖布局）
```

两个自测脚本都不依赖浏览器，改完代码可以直接跑：

```bash
node scripts/check-sun.mjs           # 只需 Node
node scripts/check-world-api.mjs     # 需要服务已启动
```

桌面快捷方式的图标由 `scripts/make-server-icon.py` 生成（需要 Pillow）：

```bash
python scripts/make-server-icon.py   # 重新生成 assets/server.ico 与预览图
```

---

## 三、接口一览

所有接口统一返回 `{ ok: true, data }` 或 `{ ok: false, error }`。

### 时间

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，返回运行时长 |
| GET | `/api/time` | 北京时间，固定 UTC+8 |

`/api/time` 返回示例：

```json
{
  "ok": true,
  "data": {
    "timezone": "Asia/Shanghai",
    "timezoneLabel": "北京时间（UTC+8）",
    "utcOffset": "+08:00",
    "date": "2026-10-15",
    "time": "01:39:18",
    "weekday": "星期四",
    "weekdayIndex": 4,
    "iso": "2026-10-15T01:39:18+08:00",
    "epochMs": 1791999558095
  }
}
```

时区换算交给系统时区数据库处理，**不受服务器自身时区设置影响**；
`epochMs` 是服务器真实时间戳，客户端可以用它校正本机时钟偏差。

### 世界时间

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/world/cities` | 各城市当地时间、UTC 偏移、与北京时差、昼夜状态 |
| GET | `/api/world/sun?city=<id>&date=YYYY-MM-DD` | 某城市某天的日出日落、昼长、太阳轨迹 |

`city` 取 `src/cities.js` 里的 id（如 `beijing`、`london`、`longyearbyen`），
`date` 可省略，默认该城市的"今天"。城市 id 不存在返回 400，日期非法也返回 400。

`/api/world/sun` 返回节选：

```json
{
  "ok": true,
  "data": {
    "city": { "id": "london", "name": "伦敦", "timezone": "Europe/London", "lat": 51.5074, "lon": -0.1278 },
    "date": "2025-06-21",
    "isToday": false,
    "utcOffset": "UTC+01:00",
    "events": {
      "sunrise": { "utcMs": 1750480990000, "localDate": "2025-06-21", "localTime": "04:43" },
      "solarNoon": { "localTime": "13:02" },
      "sunset": { "localTime": "21:21" },
      "civilDawn": { "localTime": "03:55" },
      "civilDusk": { "localTime": "22:09" }
    },
    "polar": null,
    "dayLengthMinutes": 998,
    "sun": { "altitude": -8.38, "azimuth": 267.1, "isUp": false },
    "curve": [{ "minute": 0, "altitude": -12.4 }, "... 每 10 分钟一个点，共 145 个"]
  }
}
```

高级纬度地区会把 `sunrise`/`sunset` 置为 `null`，并用 `polar` 说明原因：
`midnight-sun`（极昼）或 `polar-night`（极夜）。

`curve` 是当天太阳高度角的采样序列（当地时间 0—24 时每 10 分钟一个点），
原本是给前端画太阳轨迹图用的，接口保留，客户端不需要的话忽略即可。

### 日期与时区处理的两个坑

1. 城市时区不用固定偏移量，一律走 `Intl` 时区数据库，夏令时才不会算错
   （比如悉尼 1 月是 UTC+11、6 月是 UTC+10）。
2. 日出日落按"该城市当地日期的正午对应的 UTC 时刻"来确定儒略日，而不是直接拿 UTC 日期，
   否则奥克兰（UTC+12/13）、檀香山（UTC-10）这类跨日时区会整体差一天；
   雷克雅未克 6 月的日落会落到次日 00:03，接口会如实返回次日日期。

太阳高度角、赤纬、均时差用的是 NOAA Solar Calculator 的公式（见 `src/sun.js`），
与官方日出日落数据通常相差 1 分钟以内。

### 任务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/tasks` | 列表，支持 `?done=true\|false`、`?q=关键字` |
| GET | `/api/tasks/:id` | 单个任务详情 |
| POST | `/api/tasks` | 新建，body 为 `{ title, priority? }` |
| PUT | `/api/tasks/:id` | 更新，body 可只传要改的字段 |
| DELETE | `/api/tasks/:id` | 删除 |

`priority` 取值为 `low` / `normal` / `high`，默认 `normal`。

调用示例：

```bash
curl -X POST http://127.0.0.1:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"写课程报告\",\"priority\":\"high\"}"

curl http://127.0.0.1:3000/api/time

curl "http://127.0.0.1:3000/api/world/sun?city=london&date=2025-06-21"
```

---

## 四、配置

通过环境变量调整，无需改代码：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址；只有本机可访问最安全 |

让局域网内其他设备访问：

```powershell
$env:HOST='0.0.0.0'; $env:PORT='8080'; npm start
```

再用 `ipconfig` 查到本机内网 IP，其他设备访问 `http://<你的IP>:8080`。
注意这会把写接口暴露给同网段机器，仅建议在可信网络下临时使用。

---

## 五、三个开发中的坑（已解决，记录备查）

**1. 依赖布局必须用扁平模式。**
本机环境下 pnpm 默认的 `isolated` 布局会创建 junction，而 Node 无法穿透这些
junction 解析 express 的传递依赖，启动时报 `Cannot find module 'body-parser'`。
`pnpm-workspace.yaml` 中已设 `nodeLinker: hoisted` 修复。
另外 pnpm 11 已不再从 `.npmrc` 读取该配置，只能写在 `pnpm-workspace.yaml` 里。

**2. `启动服务.bat` 必须存成 GBK 编码。**
如果存成 UTF-8，cmd 会按本地编码解析文件，中文被截断成乱码并当成命令执行，
脚本直接报一堆 `不是内部或外部命令`。
所以该文件用 GBK 保存，并在调用 `node` 前后用 `chcp` 临时切换编码，
以保证 Node 输出的中文日志也正常显示。**用记事本编辑该文件时注意别存成 UTF-8。**

**3. 快捷方式图标：ICO 不能含 PNG 帧，且不能靠改写旧 .lnk 来换图标。**
两条都是实测踩出来的：

- Pillow 的 `Image.save(..., format="ICO")` 会把**所有**帧写成 PNG 压缩。
  Windows 解析快捷方式图标时会优先取最大帧，撞上 PNG 帧就整段失败、
  退回默认图标（而 `PrivateExtractIcons` 这类按尺寸取的接口却能正常读到小帧，
  所以只看这些接口会误判成"图标没问题"）。
  现在 `scripts/make-server-icon.py` 手写 ICO，**全部用 BMP 帧、大帧在前**，
  与系统里能正常显示的 `ds.ico` 结构一致。
- 用 `WScript.Shell` 去**改写**已有的 `.lnk` 换图标，改完仍解析不出自定义图标；
  把同一个 `.lnk` 删掉后**新建**则立刻正常。所以换图标要重建文件，不要就地改。

桌面快捷方式 `启动服务.lnk` 指向 `AppData\Local\ServerIcon\server.ico`
（项目里的 `assets/server.ico` 是源文件，改完重新生成并复制过去即可）。

---

## 六、数据说明

数据保存在 `data/tasks.json`，采用「先写临时文件再改名」的方式落盘，
避免写入中途被中断而损坏文件。删除该文件即可清空所有数据。

目前没有多用户与鉴权机制，只适合本机开发与演示使用。
