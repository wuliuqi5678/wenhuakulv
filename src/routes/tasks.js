/**
 * 任务相关的 REST 路由。
 *
 * 统一响应格式：成功 { ok: true, data }，失败 { ok: false, error }，
 * 让前端可以用同一套逻辑处理所有接口。
 */
import { Router } from 'express';
import * as store from '../store.js';

const router = Router();

const PRIORITIES = ['low', 'normal', 'high'];

/** 校验并归一化请求体中的任务字段。 */
function parseTaskInput(body, { partial = false } = {}) {
  const errors = [];
  const patch = {};

  if (body.title !== undefined || !partial) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      errors.push('title 不能为空');
    } else if (title.length > 200) {
      errors.push('title 长度不能超过 200 个字符');
    } else {
      patch.title = title;
    }
  }

  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') {
      errors.push('done 必须是布尔值');
    } else {
      patch.done = body.done;
    }
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      errors.push(`priority 必须是 ${PRIORITIES.join(' / ')} 之一`);
    } else {
      patch.priority = body.priority;
    }
  }

  return { patch, errors };
}

// 列表：支持 ?done=true|false 过滤、?q= 关键字搜索
router.get('/', (req, res) => {
  let items = store.list();

  if (req.query.done !== undefined) {
    const wantDone = req.query.done === 'true';
    items = items.filter((t) => t.done === wantDone);
  }

  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const keyword = req.query.q.trim().toLowerCase();
    items = items.filter((t) => t.title.toLowerCase().includes(keyword));
  }

  res.json({ ok: true, data: items, stats: store.stats() });
});

// 详情
router.get('/:id', (req, res) => {
  const task = store.find(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: '任务不存在' });
  }
  res.json({ ok: true, data: task });
});

// 新建
router.post('/', (req, res) => {
  const { patch, errors } = parseTaskInput(req.body ?? {});
  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join('；') });
  }
  const task = store.create(patch);
  res.status(201).json({ ok: true, data: task });
});

// 更新（支持部分字段）
router.put('/:id', (req, res) => {
  const { patch, errors } = parseTaskInput(req.body ?? {}, { partial: true });
  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join('；') });
  }
  const task = store.update(req.params.id, patch);
  if (!task) {
    return res.status(404).json({ ok: false, error: '任务不存在' });
  }
  res.json({ ok: true, data: task });
});

// 删除
router.delete('/:id', (req, res) => {
  const task = store.remove(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: '任务不存在' });
  }
  res.json({ ok: true, data: task });
});

export default router;
