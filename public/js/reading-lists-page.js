/**
 * 主题书单索引：十条编辑路线，每条用三枚书影和一段导语预告。
 * 支持按路线/主题/作者/书名搜索，并显示本地书库进度。
 */
import { loadBooks, createCover, esc } from "./covers.js";
import { getLibrary, LIBRARY_EVENT } from "./library-store.js";
import {
  loadReadingLists,
  hydrateLists,
  uniqueBookCount,
  listNumber,
  introExcerpt,
  listProgress,
  listMatchesQuery,
} from "./reading-lists-data.js";

const el = {
  grid: document.getElementById("reading-lists-grid"),
  meta: document.getElementById("lists-meta"),
  lead: document.getElementById("lists-lead"),
  error: document.getElementById("lists-error"),
  search: document.getElementById("lists-search"),
  searchCount: document.getElementById("lists-search-count"),
  searchEmpty: document.getElementById("lists-search-empty"),
  searchReset: document.getElementById("lists-search-reset"),
};

let allLists = [];
let libraryEntries = getLibrary().entries;
let query = "";

/** 从路线中挑出起点、半程与终点，给出三个不同方向的书影。 */
function stackPicks(list) {
  const stops = list.stops;
  if (stops.length <= 3) return stops;
  return [
    stops[0],
    stops[Math.floor((stops.length - 1) / 2)],
    stops[stops.length - 1],
  ];
}

function makeCoverStack(list) {
  const stack = document.createElement("div");
  stack.className = "cover-stack cover-stack--card";
  stack.setAttribute("aria-hidden", "true");
  for (const stop of stackPicks(list)) {
    const cover = createCover(stop.book);
    cover.classList.add("cover-stack__cover");
    stack.appendChild(cover);
  }
  return stack;
}

function makeCard(list, index) {
  const li = document.createElement("li");
  li.className = "list-card reveal";
  const progress = listProgress(list, libraryEntries);
  const readLabel = `${progress.read}/${progress.total}`;

  const a = document.createElement("a");
  a.className = "list-card__link";
  a.href = `reading-list.html?id=${encodeURIComponent(list.id)}`;
  a.innerHTML = `
    <div class="list-card__visual">
      <span class="list-card__no" aria-hidden="true">${listNumber(index)}</span>
      <span class="list-card__count">${list.stops.length} 本</span>
    </div>
    <div class="list-card__body">
      <p class="list-card__theme">${esc(list.theme)}</p>
      <h2 class="list-card__title">${esc(list.title)}</h2>
      <p class="list-card__sub">${esc(list.subtitle)}</p>
      <p class="list-card__excerpt">${esc(introExcerpt(list))}</p>
      <p class="list-card__route">
        <span>从《${esc(list.start.book.title)}》开始</span>
        <span class="list-card__arrow" aria-hidden="true">→</span>
        <span>到《${esc(list.finish.book.title)}》收束</span>
      </p>
      <div class="list-card__library" aria-label="阅读进度">
        <span class="list-card__read">已读 <b>${readLabel}</b></span>
        <span class="list-card__next">${esc(progress.label)}</span>
        <span class="list-card__bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></span>
      </div>
      <span class="list-card__cta">进入书单 <span aria-hidden="true">→</span></span>
    </div>
  `;

  a.querySelector(".list-card__visual")?.appendChild(makeCoverStack(list));
  li.appendChild(a);
  return li;
}

function observeCards(cards) {
  if (!cards.length) return;
  if (!("IntersectionObserver" in window) || query.trim()) {
    for (const card of cards) card.classList.add("is-in");
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "120px 0px 0px 0px", threshold: 0.04 }
  );
  for (const card of cards) io.observe(card);
}

function applySearch() {
  if (!allLists.length) return;
  const filtered = allLists.filter((list) => listMatchesQuery(list, query));
  const searching = Boolean(query.trim());
  const frag = document.createDocumentFragment();
  filtered.forEach((list) => {
    frag.appendChild(makeCard(list, allLists.indexOf(list)));
  });
  el.grid.replaceChildren(frag);

  if (el.searchCount) {
    el.searchCount.textContent = searching
      ? `找到 ${filtered.length} 条路线`
      : `${allLists.length} 条路线`;
  }
  if (el.searchEmpty) el.searchEmpty.hidden = filtered.length > 0;
  observeCards([...el.grid.querySelectorAll(".list-card")]);
}

function bindSearch() {
  if (!el.search) return;
  let timer = 0;
  el.search.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      query = el.search.value;
      applySearch();
    }, 110);
  });
  el.search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    el.search.value = "";
    query = "";
    applySearch();
  });
  el.searchReset?.addEventListener("click", () => {
    el.search.value = "";
    query = "";
    applySearch();
    el.search.focus();
  });
}

async function main() {
  try {
    const [bookData, listData] = await Promise.all([loadBooks(), loadReadingLists()]);
    const books = bookData.books ?? [];
    allLists = hydrateLists(listData.lists, books);

    if (!allLists.length) throw new Error("书单数据为空，或所有条目都找不到对应书目。");

    const unique = uniqueBookCount(allLists);
    const entries = allLists.reduce((sum, list) => sum + list.stops.length, 0);
    el.meta.textContent = `${allLists.length} 条路线 · ${unique} 部作品 · ${entries} 次推荐`;
    if (listData.intro) el.lead.textContent = listData.intro;

    // 链接到 ?q= 时保留搜索词，便于分享某次搜索。
    const initialQuery = new URLSearchParams(location.search).get("q") ?? "";
    if (el.search && initialQuery) el.search.value = initialQuery;
    query = initialQuery;
    bindSearch();
    applySearch();

    window.addEventListener(LIBRARY_EVENT, () => {
      libraryEntries = getLibrary().entries;
      applySearch();
    });
    window.addEventListener("pageshow", () => {
      libraryEntries = getLibrary().entries;
      applySearch();
    });
  } catch (error) {
    console.error(error);
    el.meta.textContent = "书单暂时没有打开";
    el.error.hidden = false;
    el.error.innerHTML = `<b>主题书单加载失败</b>${esc(error.message)}<br>请确认通过本地服务器访问本页。`;
  }
}

main();
