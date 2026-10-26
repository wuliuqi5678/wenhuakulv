/**
 * 文化苦旅 · 本地静态服务器
 *
 * 启动：npm start（或双击「启动服务.bat」）
 * 默认监听 127.0.0.1:3000（仅本机访问）。
 * 局域网访问：HOST=0.0.0.0 PORT=8080 npm start
 */
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import express from "express";
import { registerAiRoutes } from "./server-ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bootAt = Date.now();

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[启动失败] PORT 环境变量的值「${process.env.PORT}」不是 1–65535 之间的整数。`);
  process.exit(1);
}

const app = express();

app.disable("x-powered-by");

// API 响应一律不缓存
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* ---------- 基础安全响应头（本地站点同样值得加，成本为零） ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // 站内页面有少量内联脚本/样式，因此保留 unsafe-inline；仍限制外部资源与外连
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ")
  );
  next();
});

/* ---------- 零依赖 gzip：CSS / JS / JSON 全部压缩，体积可省约 2/3 ----------
 * 本站资源都在 50KB 以内，采用「攒齐再压」最简单也最快；
 * 内容不大于 1KB 或类型不可压缩时原样发送。 */
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg\+xml)/;

app.use((req, res, next) => {
  const accept = String(req.headers["accept-encoding"] ?? "");
  const gzipToken = accept
    .split(",")
    .map((token) => token.trim())
    .find((token) => token.toLowerCase().startsWith("gzip"));
  const gzipQ = gzipToken?.match(/;\s*q=([0-9.]+)/i);
  res.setHeader("Vary", "Accept-Encoding");
  if (req.method === "HEAD" || !gzipToken || (gzipQ && Number(gzipQ[1]) <= 0)) return next();

  const rawWrite = res.write.bind(res);
  const rawEnd = res.end.bind(res);
  let chunks = null; // 收集中的原始分片；非 null 表示本次响应将走 gzip
  let decided = false;

  const wantGzip = () => {
    const type = String(res.getHeader("Content-Type") ?? "").split(";")[0].trim();
    if (!COMPRESSIBLE.test(type)) return false;
    const len = Number(res.getHeader("Content-Length") ?? NaN);
    return !Number.isFinite(len) || len >= 1024;
  };

  res.write = (chunk, ...rest) => {
    if (!decided) {
      decided = true;
      if (wantGzip()) {
        chunks = [];
        res.removeHeader("Content-Length");
      }
    }
    if (chunks) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }
    return rawWrite(chunk, ...rest);
  };

  res.end = (chunk, ...rest) => {
    if (!decided) {
      decided = true;
      if (wantGzip()) {
        chunks = [];
        res.removeHeader("Content-Length");
      }
    }
    if (chunks) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = zlib.gzipSync(Buffer.concat(chunks), { level: 6 });
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", body.length);
      return rawEnd(body, ...rest);
    }
    return rawEnd(chunk, ...rest);
  };

  next();
});

/* ---------- 简易访问日志：方法、路径、状态码、耗时 ---------- */
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

// JSON 解析放在安全头/no-store/日志之后：畸形 JSON 的 400 也有安全头并会被记录。
// 站内 AI 的请求体很小，限制在 64KB，避免异常大包。
app.use(express.json({ limit: "64kb" }));

/* ---------- 健康检查（供启动脚本与探活使用） ---------- */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    data: {
      status: "up",
      uptime: Number(process.uptime().toFixed(1)),
      time: new Date().toISOString(),
    },
  });
});

/* 页面里用的是 data URI 图标；这里挡掉浏览器的默认 /favicon.ico 请求，避免 404 日志噪音。 */
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

/* ---------- 静态站点 ----------
 * 本地开发站点：一律 no-cache（靠 ETag 304 保持轻量），
 * 保证改完 CSS/JS 刷新即可看到，不会出现「改了半天还是旧样式」。 */
const PUBLIC_DIR = path.join(__dirname, "public");
// 嵌套 404 也要能加载根目录资源、跳回正确页面；静态 404 仍保持相对路径，
// 只在 Node 服务端渲染 404 时注入根 base。
const NOT_FOUND_HTML = fs
  .readFileSync(path.join(PUBLIC_DIR, "404.html"), "utf8")
  .replace("<head>", '<head><base href="/">');
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-cache");
    },
  })
);

/* ---------- 站内 AI 助手（DeepSeek 代理 + 站内检索） ---------- */
registerAiRoutes(app);
console.log(
  process.env.DEEPSEEK_API_KEY
    ? "[ai] DeepSeek 已配置：/api/chat 可用"
    : "[ai] 未配置 DEEPSEEK_API_KEY：AI 面板会提示配置方法"
);

/* ---------- API 未知路径返回 JSON；页面未知路径返回中文 404 ---------- */
app.use("/api", (req, res) => {
  // 不回显请求路径，避免反射内容被用于钓鱼/探测
  res.status(404).json({ ok: false, error: "接口不存在" });
});

app.use((req, res) => {
  res.status(404);
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(NOT_FOUND_HTML);
});

/* ---------- 兜底错误处理 ---------- */
app.use((err, req, res, next) => {
  console.error("[error]", err?.message ?? err);
  if (res.headersSent) return next(err);
  const status = Number(err.status) || 500;
  if (status === 400 && err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "请求体不是合法 JSON" });
  }
  if (status === 413) {
    return res.status(413).json({ ok: false, error: "请求内容过大" });
  }
  if (status >= 500) {
    return res.status(500).json({ ok: false, error: "服务器内部错误" });
  }
  return res.status(status).json({ ok: false, error: "请求无法处理" });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`本地服务器已启动：http://${HOST}:${PORT}（${Date.now() - bootAt}ms）`);
  console.log('按 Ctrl+C 停止服务');
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[启动失败] 端口 ${PORT} 已被占用——多半是服务已经在运行了。`);
    console.error(`  · 直接在浏览器打开 http://127.0.0.1:${PORT} 使用现有服务；`);
    console.error("  · 或先关闭占用该端口的旧窗口/进程，再重新启动；");
    console.error(`  · 也可以换个端口启动，例如：set PORT=3001 && npm start`);
  } else {
    console.error("[启动失败]", err);
  }
  process.exit(1);
});
