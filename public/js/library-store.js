/**
 * 我的书库：在读 / 已读 / 想读记录，存在浏览器 localStorage 里。
 *
 * 数据结构：
 * { v: 1, entries: { [bookId]: { status: "reading" | "read" | "wish", start: "YYYY-MM-DD", end: "YYYY-MM-DD", reads: number, note: string, quote: string, addedAt: ISO } } }
 *
 * 旧版本只有 finish/date 字段，读取时会迁移为 end。
 */
const KEY = "wk_library_v1";
export const LIBRARY_EVENT = "wk-library-change";

let memory = null;

function blank() {
  return { v: 1, entries: {} };
}

function normalize(raw) {
  if (!raw || typeof raw !== "object") return blank();
  const lib = { v: 1, entries: {} };
  const entries = raw.entries ?? raw;
  if (!entries || typeof entries !== "object") return lib;
  for (const [id, value] of Object.entries(entries)) {
    if (!value || typeof value !== "object") continue;
    const status =
      value.status === "reading" || value.status === "read" || value.status === "wish"
        ? value.status
        : null;
    if (!status) continue;
    const start = validDate(value.start);
    const end = validDate(value.end ?? value.date ?? value.finish);
    const reads = Number.isInteger(Number(value.reads)) && Number(value.reads) > 0 ? Number(value.reads) : 1;
    lib.entries[id] = {
      status,
      // 状态切换时保留日期和重读次数：wish/reading 不展示，但切回 read 时不能丢。
      start: start && end && start > end ? end : start,
      end,
      reads,
      note: typeof value.note === "string" ? value.note.slice(0, 4000) : "",
      quote: typeof value.quote === "string" ? value.quote.slice(0, 2000) : "",
      addedAt: typeof value.addedAt === "string" ? value.addedAt : new Date().toISOString(),
    };
  }
  return lib;
}

function validDate(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return "";
  }
  return value;
}

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory ?? blank();
    return normalize(JSON.parse(raw));
  } catch {
    return memory ?? blank();
  }
}

export function getLibrary() {
  return readRaw();
}

export function getEntry(id) {
  return readRaw().entries[id] ?? null;
}

export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDate(value) {
  return validDate(value) ? value.replaceAll("-", ".") : "未填日期";
}

function persist(lib, { silent = false } = {}) {
  memory = lib;
  try {
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {
    /* 隐私模式或存储已满：本次会话仍可用 */
  }
  if (silent) return;
  try {
    window.dispatchEvent(new CustomEvent(LIBRARY_EVENT, { detail: lib }));
  } catch {
    /* 非浏览器环境 */
  }
}

export function setStatus(id, status, date) {
  if (!id || (status !== "reading" && status !== "read" && status !== "wish")) return null;
  const lib = readRaw();
  const existing = lib.entries[id] ?? {};
  const existingStart = validDate(existing.start);
  const existingEnd = validDate(existing.end);
  const reads = Number.isInteger(Number(existing.reads)) && Number(existing.reads) > 0 ? Number(existing.reads) : 1;

  let start = existingStart;
  let end = existingEnd;
  if (status === "reading") {
    start = validDate(date) || existingStart || today();
    // 从“看过”切到“在读”时保留旧读完日期，切回“看过”时不会丢。
  } else if (status === "read") {
    end = validDate(date) || existingEnd || today();
    if (start && end && start > end) start = end;
  }
  // status === "wish"：日期、重读次数原样保留，只是暂不展示。

  const next = {
    status,
    start,
    end,
    reads,
    note: existing.note ?? "",
    quote: existing.quote ?? "",
    addedAt: existing.addedAt ?? new Date().toISOString(),
  };
  lib.entries[id] = next;
  persist(lib);
  return next;
}

/** 在读状态只记开始日期；清空时允许为空。 */
export function setReadingStart(id, date) {
  const lib = readRaw();
  const entry = lib.entries[id];
  if (!entry || entry.status !== "reading") return null;
  entry.start = validDate(date);
  persist(lib);
  return entry;
}

/** 在读 → 看过：保留开始日期，补上读完日期。 */
export function finishReading(id, date = today()) {
  const lib = readRaw();
  const entry = lib.entries[id];
  if (!entry || entry.status !== "reading") return null;
  entry.status = "read";
  entry.end = validDate(date) || today();
  entry.start = validDate(entry.start);
  entry.reads = entry.reads ?? 1;
  entry.note = entry.note ?? "";
  entry.quote = entry.quote ?? "";
  persist(lib);
  return entry;
}

export function setReadDates(id, { start, end } = {}) {
  const lib = readRaw();
  const entry = lib.entries[id];
  if (!entry || entry.status !== "read") return null;
  const from = validDate(start);
  const to = validDate(end);
  // 以读完日期为准：开始日期晚于读完日期时，把开始日期收到读完日期
  entry.start = from && to && from > to ? to : from;
  entry.end = to;
  persist(lib);
  return entry;
}

export function setReadDate(id, date) {
  return setReadDates(id, { start: getEntry(id)?.start ?? "", end: date });
}

/** 个人笔记与喜欢的句子：走静默保存，避免输入时整块列表重绘。 */
export function setNote(id, { note = "", quote = "" } = {}) {
  const lib = readRaw();
  const entry = lib.entries[id];
  if (!entry || entry.status !== "read") return null;
  entry.note = String(note ?? "").slice(0, 4000);
  entry.quote = String(quote ?? "").slice(0, 2000);
  persist(lib, { silent: true });
  return entry;
}

/** 重读一次：累计阅读遍数。 */
export function markReread(id) {
  const lib = readRaw();
  const entry = lib.entries[id];
  if (!entry || entry.status !== "read") return null;
  entry.reads = (Number(entry.reads) || 1) + 1;
  persist(lib);
  return entry;
}

export function removeBook(id) {
  const lib = readRaw();
  delete lib.entries[id];
  persist(lib);
}

export function getReadEntries() {
  const lib = readRaw();
  return Object.entries(lib.entries)
    .filter(([, entry]) => entry.status === "read")
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => {
      const da = a.end || a.start;
      const db = b.end || b.start;
      if (da && db) return db.localeCompare(da);
      if (da) return -1;
      if (db) return 1;
      return b.addedAt.localeCompare(a.addedAt);
    });
}

export function getReadingEntries() {
  const lib = readRaw();
  return Object.entries(lib.entries)
    .filter(([, entry]) => entry.status === "reading")
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => {
      if (a.start && b.start) return b.start.localeCompare(a.start);
      if (a.start) return -1;
      if (b.start) return 1;
      return b.addedAt.localeCompare(a.addedAt);
    });
}

export function getWishEntries() {
  const lib = readRaw();
  return Object.entries(lib.entries)
    .filter(([, entry]) => entry.status === "wish")
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function getStats() {
  const entries = Object.values(readRaw().entries);
  const read = entries.filter((entry) => entry.status === "read");
  const reading = entries.filter((entry) => entry.status === "reading");
  const dates = [...read, ...reading]
    .flatMap((entry) => [entry.start, entry.end])
    .filter(Boolean)
    .sort();
  return {
    reading: reading.length,
    read: read.length,
    wish: entries.filter((entry) => entry.status === "wish").length,
    first: dates[0] ?? "",
    last: dates[dates.length - 1] ?? "",
  };
}
