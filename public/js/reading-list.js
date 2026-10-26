/**
 * 单份主题书单：路线导语、起点/半程/终点书影，以及带编号的阅读路径。
 */
import { loadBooks, createCover, esc } from "./covers.js";
import { getLibrary, LIBRARY_EVENT } from "./library-store.js";
import {
  loadReadingLists,
  hydrateLists,
  listNumber,
  listProgress,
  LIBRARY_STATUS_LABELS,
} from "./reading-lists-data.js";

const el = {
  page: document.getElementById("list-page"),
  crumb: document.getElementById("list-crumb"),
  number: document.getElementById("list-number"),
  theme: document.getElementById("list-theme"),
  title: document.getElementById("list-title"),
  subtitle: document.getElementById("list-subtitle"),
  stats: document.getElementById("list-stats"),
  start: document.getElementById("list-start"),
  progress: document.getElementById("list-progress"),
  stack: document.getElementById("list-stack"),
  intro: document.getElementById("list-intro"),
  pathCount: document.getElementById("list-path-count"),
  pathList: document.getElementById("path-list"),
  next: document.getElementById("list-next"),
  notFound: document.getElementById("list-notfound"),
  notFoundMessage: document.getElementById("list-notfound-message"),
};

function showNotFound(message) {
  el.page.style.display = "none";
  el.notFound.hidden = false;
  el.notFoundMessage.textContent = message;
  document.title = "没有找到这份书单 · 文化苦旅";
}

function stackPicks(list) {
  const stops = list.stops;
  if (stops.length <= 3) return stops;
  return [
    stops[0],
    stops[Math.floor((stops.length - 1) / 2)],
    stops[stops.length - 1],
  ];
}

function renderStack(list) {
  const frag = document.createDocumentFragment();
  for (const stop of stackPicks(list)) {
    const cover = createCover(stop.book, { lazy: false });
    cover.classList.add("cover-stack__cover");
    frag.appendChild(cover);
  }
  el.stack.replaceChildren(frag);
}

function renderIntro(list) {
  el.intro.innerHTML = (list.intro ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
}

function statusMeta(status) {
  return {
    key: status || "none",
    label: LIBRARY_STATUS_LABELS[status] ?? "未加入",
  };
}

function renderProgress(list, entries) {
  if (!el.progress) return;
  const progress = listProgress(list, entries);
  const small = [
    progress.reading ? `在读 ${progress.reading}` : "",
    progress.wish ? `想读 ${progress.wish}` : "",
  ].filter(Boolean);
  el.progress.innerHTML = `
    <div class="list-hero__progress-line">
      <span>已读 <b>${progress.read}</b>/${progress.total}</span>
      <span class="list-hero__progress-label">${esc(progress.label)}</span>
      ${small.length ? `<span class="list-hero__progress-small">${esc(small.join(" · "))}</span>` : ""}
    </div>
    <span class="list-hero__progress-bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></span>
  `;
}

function paintPathStatuses(entries) {
  for (const item of el.pathList.querySelectorAll(".list-path__item")) {
    const badge = item.querySelector(".list-path__status");
    if (!badge) continue;
    const meta = statusMeta(entries?.[item.dataset.bookId]?.status ?? "");
    badge.className = `list-path__status is-${meta.key}`;
    badge.textContent = meta.label;
  }
}

function pathItem(stop, index, total, entries) {
  const li = document.createElement("li");
  li.className = "list-path__item";
  li.dataset.bookId = stop.book.id;
  if (index === 0) li.classList.add("is-start");
  if (index === total - 1) li.classList.add("is-finish");

  const isStart = index === 0;
  const isFinish = index === total - 1;
  const flag = isStart ? "起点" : isFinish ? "终点" : `第 ${index + 1} 站`;
  const href = `book.html?id=${encodeURIComponent(stop.book.id)}`;
  const status = statusMeta(entries?.[stop.book.id]?.status ?? "");

  li.innerHTML = `
    <div class="list-path__rail" aria-hidden="true">
      <span class="list-path__step">${String(index + 1).padStart(2, "0")}</span>
      <span class="list-path__line"></span>
    </div>
    <a class="list-path__cover book__link" href="${href}" tabindex="-1" aria-hidden="true"></a>
    <div class="list-path__body">
      <p class="list-path__eyebrow">
        <span class="list-path__flag">${flag}</span>
        <span class="list-path__status is-${status.key}">${esc(status.label)}</span>
        <span>${esc(stop.book.year)} · ${esc(stop.book.genre)}</span>
      </p>
      <h3 class="list-path__book"><a href="${href}">《${esc(stop.book.title)}》</a></h3>
      <p class="list-path__author">${esc(stop.book.author)}</p>
      <p class="list-path__note">${esc(stop.note)}</p>
    </div>
  `;

  const cover = createCover(stop.book);
  cover.classList.add("book__cover");
  li.querySelector(".list-path__cover")?.appendChild(cover);
  return li;
}

function renderNext(lists, index) {
  const next = lists[(index + 1) % lists.length];
  const nextIndex = (index + 1) % lists.length;
  el.next.innerHTML = `
    <p class="list-next__kicker">下一条路线 · NO. ${listNumber(nextIndex)}</p>
    <a class="list-next__link" href="reading-list.html?id=${encodeURIComponent(next.id)}">
      <span class="list-next__body">
        <span class="list-next__title">${esc(next.title)}</span>
        <span class="list-next__sub">${esc(next.subtitle)}</span>
      </span>
      <span class="list-next__arrow" aria-hidden="true">→</span>
    </a>
  `;
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    showNotFound("地址里缺少书单编号。请从主题书单页进入，或检查链接是否完整。");
    return;
  }

  let books;
  let listData;
  try {
    const [bookData, data] = await Promise.all([loadBooks(), loadReadingLists()]);
    books = bookData.books ?? [];
    listData = data;
  } catch (error) {
    showNotFound(`书单数据加载失败：${error.message}。请确认通过本地服务器访问本页。`);
    return;
  }

  const lists = hydrateLists(listData.lists, books);
  const index = lists.findIndex((list) => list.id === id);
  if (index < 0) {
    showNotFound(`没有找到编号为「${id}」的书单。它可能已经改名，或链接拼错了。`);
    return;
  }

  const list = lists[index];
  document.title = `${list.title} · 主题书单 · 文化苦旅`;
  const summary = (list.intro ?? []).join(" ").replace(/\s+/g, " ").trim();
  const desc = document.querySelector('meta[name="description"]');
  if (desc) {
    desc.setAttribute(
      "content",
      `${list.title}：${list.subtitle}。${summary.slice(0, 168)}${summary.length > 168 ? "…" : ""}`
    );
  }
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", `${list.title} · 主题书单 · 文化苦旅`);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", `${list.subtitle}。${summary.slice(0, 120)}`);

  el.crumb.textContent = list.title;
  el.number.textContent = `NO. ${listNumber(index)} / ${String(lists.length).padStart(2, "0")}`;
  el.theme.textContent = list.theme;
  el.title.textContent = list.title;
  el.subtitle.textContent = list.subtitle;
  el.stats.textContent = `${list.stops.length} 本作品 · ${list.years} 年`;

  el.start.innerHTML = `从 <a href="book.html?id=${encodeURIComponent(list.start.book.id)}">《${esc(
    list.start.book.title
  )}》</a> 开始，按下面的顺序读。`;

  renderStack(list);
  renderIntro(list);

  let libraryEntries = getLibrary().entries;
  renderProgress(list, libraryEntries);

  el.pathCount.textContent = `共 ${list.stops.length} 站 · 从《${list.start.book.title}》到《${list.finish.book.title}》`;
  const frag = document.createDocumentFragment();
  list.stops.forEach((stop, stopIndex) => {
    frag.appendChild(pathItem(stop, stopIndex, list.stops.length, libraryEntries));
  });
  el.pathList.replaceChildren(frag);

  window.addEventListener(LIBRARY_EVENT, () => {
    libraryEntries = getLibrary().entries;
    renderProgress(list, libraryEntries);
    paintPathStatuses(libraryEntries);
  });
  window.addEventListener("pageshow", () => {
    libraryEntries = getLibrary().entries;
    renderProgress(list, libraryEntries);
    paintPathStatuses(libraryEntries);
  });

  renderNext(lists, index);
}

main();
