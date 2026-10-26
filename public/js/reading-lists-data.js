/**
 * 主题书单的读取与整理。
 *
 * 数据文件只存书目 id；页面读取 books.json 后把每一站补成完整书卡。
 * 这样书单不需要复制书名、作者、年份，书目信息只有一份来源。
 */

export async function loadReadingLists() {
  const res = await fetch("data/reading-lists.json");
  if (!res.ok) throw new Error(`主题书单加载失败（HTTP ${res.status}）`);
  const data = await res.json();
  if (!Array.isArray(data.lists)) throw new Error("主题书单格式不正确：缺少 lists 数组");
  return data;
}

/** 把书目数组整理成 id -> book 的映射。 */
export function booksById(books) {
  return new Map((books ?? []).map((book) => [book.id, book]));
}

/** 补全书单里的每一站，并丢弃已经不存在于书目库的 id。 */
export function hydrateList(list, byId) {
  const stops = [];
  for (const ref of list.books ?? []) {
    const book = byId.get(ref.id);
    if (!book) {
      console.warn(`主题书单「${list.title}」引用了不存在的书：${ref.id}`);
      continue;
    }
    stops.push({ ...ref, book });
  }

  const years = stops
    .map((stop) => Number(stop.book.year))
    .filter((year) => Number.isFinite(year) && year > 0);

  return {
    ...list,
    stops,
    years: years.length ? `${Math.min(...years)}—${Math.max(...years)}` : "—",
    start: stops[0] ?? null,
    finish: stops[stops.length - 1] ?? null,
  };
}

/** 批量补全，保持文件里的书单顺序。 */
export function hydrateLists(lists, books) {
  const byId = booksById(books);
  return (lists ?? [])
    .map((list) => hydrateList(list, byId))
    .filter((list) => list.stops.length > 0);
}

/** 一份书单里实际去重后的作品数。 */
export function uniqueBookCount(lists) {
  const ids = new Set();
  for (const list of lists) {
    for (const stop of list.stops) ids.add(stop.book.id);
  }
  return ids.size;
}

/** 01、02……用于页面上稳定的路线编号。 */
export function listNumber(index) {
  return String(index + 1).padStart(2, "0");
}

/** 从完整介绍里取一小段，供索引卡预览。 */
export function introExcerpt(list, limit = 92) {
  const text = (list.intro ?? []).join(" ").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export const LIBRARY_STATUS_LABELS = {
  read: "已读",
  reading: "在读",
  wish: "想读",
};

/**
 * 计算一条路线在本地书库里的进度。
 * entries 是 library-store 的 `getLibrary().entries`（id -> entry）。
 */
export function listProgress(list, entries = {}) {
  const total = list.stops.length;
  let read = 0;
  let reading = 0;
  let wish = 0;
  let next = null;
  let nextStatus = "";

  for (const stop of list.stops) {
    const status = entries?.[stop.book.id]?.status ?? "";
    if (status === "read") read += 1;
    else if (status === "reading") reading += 1;
    else if (status === "wish") wish += 1;
    if (!next && status !== "read") {
      next = stop;
      nextStatus = status;
    }
  }

  const done = total > 0 && read === total;
  let label = "";
  if (done) label = "全线读完";
  else if (!total) label = "路线暂无书目";
  else if (nextStatus === "reading") label = `接着读《${next.book.title}》`;
  else if (read === 0) label = `从《${next.book.title}》开始`;
  else label = `下一站《${next.book.title}》`;

  return {
    total,
    read,
    reading,
    wish,
    next,
    nextStatus,
    done,
    label,
    percent: total ? Math.round((read / total) * 100) : 0,
  };
}

/** 索引页搜索：路线名、主题、作者、书名、标签、每站提示都能命中。 */
export function listMatchesQuery(list, rawQuery) {
  const query = String(rawQuery ?? "").trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    list.title,
    list.subtitle,
    list.theme,
    ...(list.intro ?? []),
    ...list.stops.flatMap((stop) => [
      stop.book.title,
      stop.book.author,
      stop.book.genre,
      stop.book.year,
      ...(stop.book.tags ?? []),
      stop.note,
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}
