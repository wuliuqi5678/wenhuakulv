/**
 * 本地 Express 服务器入口。
 *
 * 启动：pnpm start
 * 默认监听 127.0.0.1:3000（仅本机可访问，适合开发调试）。
 * 需要局域网其他设备访问时：HOST=0.0.0.0 PORT=8080 pnpm start
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import tasksRouter from './src/routes/tasks.js';
import timeRouter from './src/routes/time.js';
import worldRouter from './src/routes/world.js';
import * as store from './src/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// 简易访问日志：方法、路径、状态码、耗时
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

// 健康检查：用于确认服务是否存活
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    data: {
      status: 'up',
      uptime: Number(process.uptime().toFixed(1)),
      time: new Date().toISOString(),
    },
  });
});

app.use('/api/tasks', tasksRouter);
app.use('/api/time', timeRouter);
app.use('/api/world', worldRouter);

// 静态前端页面
app.use(express.static(path.join(__dirname, 'public')));

// 未匹配的接口一律返回 JSON 404，避免返回 HTML 让调用方困惑
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: `接口不存在：${req.method} ${req.originalUrl}` });
});

// 兜底错误处理
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  const status = err.status ?? 500;
  res.status(status).json({ ok: false, error: err.message ?? '服务器内部错误' });
});

await store.load();

app.listen(PORT, HOST, () => {
  console.log(`本地服务器已启动：http://${HOST}:${PORT}`);
  console.log(`接口文档（示例）：http://${HOST}:${PORT}/api/tasks`);
  console.log('按 Ctrl+C 停止服务');
});
