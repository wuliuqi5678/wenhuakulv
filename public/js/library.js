/**
 * 我的书库：在读 / 已读 / 想读列表、日期与阅读时间轴。
 * 数据保存在 localStorage，页面只负责展示与编辑。
 */
import { loadBooks, createCover, sortByYear, esc } from "./covers.js";
import { dateField, initDatePicker } from "./date-picker.js";
import {
  getEntry,
  getReadingEntries,
  getReadEntries,
  getWishEntries,
  getStats,
  setStatus,
  setReadingStart,
  setReadDates,
  setNote,
  markReread,
  finishReading,
  removeBook,
  today,
  formatDate,
  LIBRARY_EVENT,
} from "./library-store.js";

const el = {
  stats: document.getElementById("library-stats"),
  addToggle: document.getElementById("library-add-toggle"),
  addPanel: document.getElementById("library-add"),
  addInput: document.getElementById("library-add-input"),
  addResults: document.getElementById("library-add-results"),
  timelineJump: document.getElementById("library-timeline-jump"),
  readingList: document.getElementById("library-reading-list"),
  readingEmpty: document.getElementById("library-reading-empty"),
  readList: document.getElementById("library-read-list"),
  readEmpty: document.getElementById("library-read-empty"),
  wishList: document.getElementById("library-wish-list"),
  wishEmpty: document.getElementById("library-wish-empty"),
  timeline: document.getElementById("library-timeline"),
  timelineEmpty: document.getElementById("library-timeline-empty"),
  timelineFull: document.getElementById("library-timeline-full"),
  countReading: document.getElementById("library-count-reading"),
  countRead: document.getElementById("library-count-read"),
  countWish: document.getElementById("library-count-wish"),
  tabs: [...document.querySelectorAll(".library-tab")],
  panels: {
    reading: document.getElementById("library-panel-reading"),
    read: document.getElementById("library-panel-read"),
    wish: document.getElementById("library-panel-wish"),
    timeline: document.getElementById("library-panel-timeline"),
  },
};

const state = {
  books: [],
  byId: new Map(),
  view: "reading",
  suggestions: [],
  addLimit: 12,
};

function bookOf(id) {
  return state.byId.get(id) ?? null;
}

function rangeText(entry) {
  if (entry.start && entry.end) {
    if (entry.start === entry.end) return `读完 ${formatDate(entry.end)}`;
    return `${formatDate(entry.start)} — ${formatDate(entry.end)}`;
  }
  if (entry.end) return `读完 ${formatDate(entry.end)}`;
  if (entry.start) return `始于 ${formatDate(entry.start)}`;
  return "未填日期";
}

function durationText(entry) {
  if (!entry.start || !entry.end) return "";
  const start = new Date(`${entry.start}T00:00:00`);
  const end = new Date(`${entry.end}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "";
  const days = Math.round((end - start) / 86400000) + 1;
  return `共 ${days} 天`;
}

function renderStats() {
  const stats = getStats();
  const range = stats.first && stats.last
    ? stats.first === stats.last
      ? `${formatDate(stats.first)}`
      : `${formatDate(stats.first)} — ${formatDate(stats.last)}`
    : "还没有日期";
  el.stats.innerHTML = `
    <span><b>${stats.reading}</b><small>本在读</small></span>
    <span><b>${stats.read}</b><small>本读过</small></span>
    <span><b>${stats.wish}</b><small>本想读</small></span>
    <span class="library-stats__range">${esc(range)}</span>
  `;
  el.countReading.textContent = String(stats.reading);
  el.countRead.textContent = String(stats.read);
  el.countWish.textContent = String(stats.wish);
}

function emptyBook() {
  return {
    title: "已不在书目里",
    author: "—",
    year: "—",
    genre: "",
  };
}

function makeItem(entry, { mode = "read" } = {}) {
  const wish = mode === "wish";
  const reading = mode === "reading";
  const book = bookOf(entry.id);
  const data = book ?? emptyBook();

  const li = document.createElement("li");
  li.className = `library-item${reading ? " library-item--reading" : ""}`;
  li.dataset.id = entry.id;

  const coverLink = document.createElement(book ? "a" : "div");
  coverLink.className = "library-item__cover";
  if (book) {
    coverLink.href = `book.html?id=${encodeURIComponent(book.id)}`;
    coverLink.setAttribute("aria-label", `《${book.title}》详情`);
    coverLink.appendChild(createCover(book, { lazy: false }));
  }

  const body = document.createElement("div");
  body.className = "library-item__body";
  body.innerHTML = `
    <p class="library-item__kicker">${reading ? "在读" : wish ? "想读" : "读过"}</p>
    ${
      book
        ? `<a class="library-item__title" href="book.html?id=${encodeURIComponent(book.id)}">《${esc(book.title)}》</a>`
        : `<p class="library-item__title">${esc(data.title)}</p>`
    }
    <p class="library-item__sub">${esc(data.author)}${data.year !== "—" ? ` · ${esc(String(data.year))} 年` : ""}${data.genre ? ` · ${esc(data.genre)}` : ""}</p>
    ${
      wish
        ? ""
        : `<div class="library-item__dates">
             <span class="library-item__date-label">开始</span>${dateField(entry.start, "data-start")}
             ${
               reading
                 ? ""
                 : `<span class="library-item__dash" aria-hidden="true">—</span>
                    <span class="library-item__date-label">读完</span>${dateField(entry.end, "data-end")}
                    ${durationText(entry) ? `<span class="library-item__duration">${durationText(entry)}</span>` : ""}`
             }
           </div>`
    }
    ${
      reading || wish
        ? ""
        : `<div class="library-item__meta">
             <span class="library-item__reads">读过 ${Math.max(1, Number(entry.reads) || 1)} 遍</span>
             <button class="library-mini" type="button" data-reread>重读一次</button>
             <button class="library-mini library-mini--quiet" type="button" data-note-toggle aria-expanded="false">笔记 / 摘句</button>
           </div>
           <div class="library-note" hidden>
             <label>喜欢的句子<textarea data-quote rows="2" placeholder="抄一句喜欢的原文，或记下让你停下来的那句话">${esc(entry.quote ?? "")}</textarea></label>
             <label>我的笔记<textarea data-note rows="3" placeholder="这本书让你想到什么？读过之后，留下一点自己的话。">${esc(entry.note ?? "")}</textarea></label>
             <p class="library-note__hint" data-note-status>自动保存</p>
           </div>`
    }
  `;

  const actions = document.createElement("div");
  actions.className = "library-item__actions";
  if (reading) {
    actions.innerHTML = `<button class="library-mini library-mini--solid" type="button" data-finish>标记读完</button>`;
  } else if (wish) {
    actions.innerHTML = `
      <button class="library-mini library-mini--solid" type="button" data-start-reading>开始读</button>
      <button class="library-mini" type="button" data-read>直接读完</button>`;
  }
  actions.insertAdjacentHTML("beforeend", `<button class="library-mini library-mini--quiet" type="button" data-remove>移除</button>`);

  li.append(coverLink, body, actions);

  li.querySelector("[data-remove]")?.addEventListener("click", () => {
    if (!window.confirm(`确定从书库移除《${data.title}》？笔记、摘句和日期也会一起删除。`)) return;
    removeBook(entry.id);
  });
  li.querySelector("[data-start-reading]")?.addEventListener("click", () => {
    setStatus(entry.id, "reading", today());
    setView("reading");
  });
  li.querySelector("[data-read]")?.addEventListener("click", () => {
    setStatus(entry.id, "read", today());
    setView("read");
  });
  li.querySelector("[data-finish]")?.addEventListener("click", () => {
    finishReading(entry.id, today());
    setView("read");
  });
  li.querySelector("[data-reread]")?.addEventListener("click", () => {
    markReread(entry.id);
  });
  li.querySelector("[data-note-toggle]")?.addEventListener("click", (event) => {
    const note = li.querySelector(".library-note");
    if (!note) return;
    const open = note.hidden;
    note.hidden = !open;
    event.currentTarget.setAttribute("aria-expanded", String(open));
    if (open) note.querySelector("textarea")?.focus();
  });
  const quoteInput = li.querySelector("[data-quote]");
  const noteInput = li.querySelector("[data-note]");
  const noteStatus = li.querySelector("[data-note-status]");
  let saveTimer = 0;
  const flushNote = () => {
    window.clearTimeout(saveTimer);
    setNote(entry.id, {
      quote: quoteInput?.value ?? "",
      note: noteInput?.value ?? "",
    });
    if (noteStatus) noteStatus.textContent = "已保存";
  };
  const saveNote = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushNote, 350);
  };
  quoteInput?.addEventListener("input", saveNote);
  noteInput?.addEventListener("input", saveNote);
  quoteInput?.addEventListener("blur", flushNote);
  noteInput?.addEventListener("blur", flushNote);
  li.addEventListener("date-change", (event) => {
    if (!event.target.matches("[data-start], [data-end]")) return;
    if (reading) {
      setReadingStart(entry.id, li.querySelector("[data-start]")?.dataset.value ?? "");
      return;
    }
    setReadDates(entry.id, {
      start: li.querySelector("[data-start]")?.dataset.value ?? "",
      end: li.querySelector("[data-end]")?.dataset.value ?? "",
    });
  });

  return li;
}

function renderReading() {
  const entries = getReadingEntries();
  el.readingList.replaceChildren(...entries.map((entry) => makeItem(entry, { mode: "reading" })));
  el.readingEmpty.hidden = entries.length > 0;
}

function renderRead() {
  const entries = getReadEntries();
  el.readList.replaceChildren(...entries.map((entry) => makeItem(entry, { mode: "read" })));
  el.readEmpty.hidden = entries.length > 0;
}

function renderWish() {
  const entries = getWishEntries();
  el.wishList.replaceChildren(...entries.map((entry) => makeItem(entry, { mode: "wish" })));
  el.wishEmpty.hidden = entries.length > 0;
}

function timelineItem(entry, { reading = false } = {}) {
  const item = document.createElement("article");
  item.className = `timeline__item${reading ? " timeline__item--reading" : ""}`;
  item.dataset.id = entry.id;

  const date = document.createElement("time");
  date.className = "timeline__date";
  date.dateTime = entry.end || entry.start || "";
  date.textContent = entry.end
    ? entry.end.slice(5).replace("-", ".")
    : entry.start
      ? entry.start.slice(5).replace("-", ".")
      : "—";

  const dot = document.createElement("span");
  dot.className = `timeline__dot${reading ? " timeline__dot--reading" : ""}`;
  dot.setAttribute("aria-hidden", "true");

  const card = document.createElement("a");
  card.className = "timeline__card";
  card.href = `book.html?id=${encodeURIComponent(entry.book.id)}`;

  const cover = document.createElement("span");
  cover.className = "timeline__cover";
  cover.appendChild(createCover(entry.book, { lazy: false }));

  const text = document.createElement("span");
  text.className = "timeline__text";
  const range = reading
    ? entry.start
      ? `始于 ${formatDate(entry.start)}`
      : "未填开始日期"
    : entry.start && entry.end && entry.start !== entry.end
      ? rangeText(entry)
      : "";
  text.innerHTML = `
    <strong>《${esc(entry.book.title)}》</strong>
    <small>${esc(entry.book.author)} · ${esc(String(entry.book.year))} 年</small>
    ${range ? `<em>${esc(range)}${!reading && durationText(entry) ? ` · ${durationText(entry)}` : ""}</em>` : ""}
  `;

  card.append(cover, text);
  item.append(date, dot, card);
  return item;
}

function renderTimeline() {
  const readingEntries = getReadingEntries()
    .map((entry) => ({ ...entry, book: bookOf(entry.id) }))
    .filter((entry) => entry.book);
  const entries = getReadEntries()
    .map((entry) => ({ ...entry, book: bookOf(entry.id) }))
    .filter((entry) => entry.book);

  el.timeline.replaceChildren();
  el.timelineEmpty.hidden = readingEntries.length + entries.length > 0;
  el.timeline.classList.toggle("is-empty", readingEntries.length + entries.length === 0);
  if (!readingEntries.length && !entries.length) return;

  if (readingEntries.length) {
    const heading = document.createElement("div");
    heading.className = "timeline__year timeline__year--reading";
    heading.innerHTML = `<span>正在读</span>`;
    el.timeline.appendChild(heading);
    for (const entry of readingEntries) {
      el.timeline.appendChild(timelineItem(entry, { reading: true }));
    }
  }

  let lastGroup = "";
  for (const entry of entries) {
    const anchor = entry.end || entry.start;
    const group = anchor ? anchor.slice(0, 4) : "未填日期";
    if (group !== lastGroup) {
      const year = document.createElement("div");
      year.className = "timeline__year";
      year.innerHTML = `<span>${esc(group)}</span>`;
      el.timeline.appendChild(year);
      lastGroup = group;
    }
    el.timeline.appendChild(timelineItem(entry));
  }

  requestAnimationFrame(() => el.timeline.classList.add("is-expanded"));
}

function suggestionPool() {
  if (!state.suggestions.length) {
    state.suggestions = [...state.books]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
  }
  return state.suggestions;
}

function renderAddResults() {
  const query = el.addInput.value.trim().toLowerCase();
  const pool = query
    ? state.books.filter((book) =>
        `${book.title} ${book.author} ${book.genre} ${(book.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(query)
      )
    : suggestionPool();
  const results = pool.slice(0, query ? state.addLimit : 8);

  if (!results.length) {
    el.addResults.innerHTML = `<li class="library-result library-result--empty">没有找到这本书，换个书名、作者或体裁试试。</li>`;
    return;
  }

  el.addResults.innerHTML = results
    .map((book) => {
      const entry = getStatusOf(book.id);
      const badge = entry
        ? `<span class="library-result__badge">${
            entry.status === "read"
              ? `已看过 · ${esc(rangeText(entry))}`
              : entry.status === "reading"
                ? `在读${entry.start ? ` · 始于 ${formatDate(entry.start)}` : ""}`
                : "已在想读"
          }</span>`
        : "";
      return `
        <li class="library-result" data-book-id="${esc(book.id)}">
          <span class="library-result__cover" data-cover></span>
          <span class="library-result__text">
            <a href="book.html?id=${encodeURIComponent(book.id)}">《${esc(book.title)}》</a>
            <small>${esc(book.author)} · ${esc(String(book.year))} 年</small>
            ${badge}
          </span>
          <span class="library-result__actions">
            <button class="library-mini" type="button" data-add="wish">想读</button>
            <button class="library-mini" type="button" data-add="reading">在读</button>
            <button class="library-mini library-mini--solid" type="button" data-add="read">看过</button>
          </span>
        </li>`;
    })
    .join("");

  if (query && pool.length > results.length) {
    const more = document.createElement("li");
    more.className = "library-result library-result--more";
    more.innerHTML = `<span>共 ${pool.length} 条，已显示 ${results.length} 条</span><button class="library-mini" type="button" data-more>显示更多</button>`;
    more.querySelector("[data-more]")?.addEventListener("click", () => {
      state.addLimit += 12;
      renderAddResults();
    });
    el.addResults.appendChild(more);
  }

  for (const row of el.addResults.querySelectorAll(".library-result[data-book-id]")) {
    const book = bookOf(row.dataset.bookId);
    if (!book) continue;
    row.querySelector("[data-cover]")?.appendChild(createCover(book, { lazy: false }));
  }
}

function getStatusOf(id) {
  return getEntry(id);
}

function renderAll() {
  renderStats();
  renderReading();
  renderRead();
  renderWish();
  renderTimeline();
  if (!el.addPanel.hidden) renderAddResults();
}

function setView(view) {
  state.view = view;
  for (const tab of el.tabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const [name, panel] of Object.entries(el.panels)) {
    const active = name === view;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  if (view === "timeline") {
    renderTimeline();
    el.panels.timeline.classList.add("is-expanded");
  }
}

async function main() {
  try {
    const data = await loadBooks();
    state.books = sortByYear(data.books ?? []);
    state.byId = new Map(state.books.map((book) => [book.id, book]));
  } catch (error) {
    el.stats.textContent = `书目加载失败：${error.message}`;
    return;
  }

  for (const tab of el.tabs) {
    tab.addEventListener("click", () => setView(tab.dataset.view));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = el.tabs.indexOf(tab);
      let nextIndex = index;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + el.tabs.length) % el.tabs.length;
      else if (event.key === "ArrowRight") nextIndex = (index + 1) % el.tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = el.tabs.length - 1;
      const next = el.tabs[nextIndex];
      setView(next.dataset.view);
      next.focus();
    });
  }

  el.timelineJump.addEventListener("click", () => {
    setView("timeline");
    el.panels.timeline.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  el.addToggle.addEventListener("click", () => {
    const open = el.addPanel.hidden;
    el.addPanel.hidden = !open;
    el.addToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      renderAddResults();
      el.addInput.focus();
    }
  });

  el.addInput.addEventListener("input", () => {
    state.addLimit = 12;
    renderAddResults();
  });

  el.addResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    const row = event.target.closest("[data-book-id]");
    if (!button || !row) return;
    const id = row.dataset.bookId;
    const status = button.dataset.add;
    const existing = getEntry(id);
    const date =
      status === "reading"
        ? existing?.start || today()
        : status === "read"
          ? existing?.end || today()
          : undefined;
    setStatus(id, status, date);
    if (status === "reading") setView("reading");
    if (status === "read") setView("read");
    renderAddResults();
  });

  el.timelineFull.addEventListener("click", async () => {
    const panel = el.panels.timeline;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch {
      const on = panel.classList.toggle("is-presenting");
      el.timelineFull.textContent = on ? "退出全屏" : "全屏观看";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const panel = el.panels.timeline;
    if (!panel.classList.contains("is-presenting")) return;
    panel.classList.remove("is-presenting");
    el.timelineFull.textContent = "全屏观看";
  });

  document.addEventListener("fullscreenchange", () => {
    el.timelineFull.textContent = document.fullscreenElement ? "退出全屏" : "全屏观看";
  });

  window.addEventListener(LIBRARY_EVENT, renderAll);

  initDatePicker();
  renderAll();
  setView(getReadingEntries().length ? "reading" : "read");
}

main();
