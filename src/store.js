/**
 * 轻量数据存储：以 JSON 文件持久化任务数据。
 *
 * 之所以不引入数据库，是为了让这个本地服务零外部依赖、开箱即用；
 * 写入采用「先写临时文件再重命名」的方式，避免进程中断导致数据文件损坏。
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

/** 内存中的任务列表，作为唯一数据源，磁盘文件只是它的快照。 */
let tasks = [];
/** 串行化写操作，避免并发请求同时写文件互相覆盖。 */
let writeChain = Promise.resolve();

/** 从磁盘加载数据；文件不存在或损坏时退化为空列表，保证服务一定能启动。 */
export async function load() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[store] 数据文件无法解析，已按空列表启动：${err.message}`);
    }
    tasks = [];
  }
  return tasks;
}

/** 将当前内存数据落盘，写操作排队执行。 */
function persist() {
  writeChain = writeChain.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
  }).catch((err) => {
    console.error(`[store] 数据落盘失败：${err.message}`);
  });
  return writeChain;
}

export function list() {
  return tasks;
}

export function find(id) {
  return tasks.find((t) => t.id === id);
}

export function create({ title, done = false, priority = 'normal' }) {
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title,
    done: Boolean(done),
    priority,
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  persist();
  return task;
}

export function update(id, patch) {
  const task = find(id);
  if (!task) return null;
  if (patch.title !== undefined) task.title = patch.title;
  if (patch.done !== undefined) task.done = Boolean(patch.done);
  if (patch.priority !== undefined) task.priority = patch.priority;
  task.updatedAt = new Date().toISOString();
  persist();
  return task;
}

export function remove(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const [removed] = tasks.splice(index, 1);
  persist();
  return removed;
}

export function stats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, pending: total - done };
}
