/**
 * 书架首页：按年代筛选、书名/作者检索、渐入动画。
 */
import { loadBooks, loadAuthors, createBookCard, createCover, decadeOf, sortByYear, esc } from "./covers.js";
import { getLibrary, LIBRARY_EVENT } from "./library-store.js";
import { AUTHOR_PINYIN } from "./pinyin-authors.js";

const el = {
  shelf: document.getElementById("shelf"),
  decades: document.getElementById("decades"),
  count: document.getElementById("count"),
  search: document.getElementById("search"),
  stats: document.getElementById("hero-stats"),
  reset: document.getElementById("filter-reset"),
};

const state = {
  rawBooks: [],
  books: [],
  order: new Map(),
  authorPlace: new Map(),
  decade: "all",
  q: "",
  genre: "all",
  region: "all",
  award: "all",
  library: "all",
  libraryEntries: {},
  sort: "year-asc",
  reveal: false,
};

const GENRE_GROUPS = {
  novel: ["长篇小说", "历史小说"],
  novella: ["中篇小说"],
  essay: ["散文", "文化随笔", "学术随笔", "杂文"],
  scifi: ["科幻"],
  children: ["儿童文学"],
  drama: ["话剧"],
  history: ["历史", "非虚构"],
};

const GENRE_OPTIONS = [
  { value: "novel", label: "长篇小说" },
  { value: "novella", label: "中篇小说" },
  { value: "essay", label: "散文随笔" },
  { value: "scifi", label: "科幻" },
  { value: "children", label: "儿童文学" },
  { value: "drama", label: "戏剧" },
  { value: "history", label: "历史与纪实" },
];

const REGION_OPTIONS = [
  { value: "beijing", label: "北京", tags: ["北京", "京味", "北平"], places: ["北京"] },
  { value: "shanghai", label: "上海", tags: ["上海", "沪语", "弄堂"], places: ["上海"] },
  {
    value: "dongbei",
    label: "东北",
    tags: ["东北", "哈尔滨", "沈阳", "黑龙江", "北大荒"],
    places: ["黑龙江", "吉林", "辽宁"],
  },
  { value: "xiangxi", label: "湘西", tags: ["湘西", "凤凰"], places: ["湘西", "凤凰"] },
  { value: "zangdi", label: "藏地", tags: ["藏地", "藏族", "西藏", "土司", "阿坝"], places: ["阿坝", "马尔康", "西藏"] },
  { value: "qinling", label: "秦岭", tags: ["秦岭", "商州", "关中", "陕西"], places: ["陕西"] },
];

const AWARD_OPTIONS = [
  { value: "maodun", label: "茅盾文学奖" },
  { value: "luxun", label: "鲁迅文学奖" },
];

const LIBRARY_OPTIONS = [
  { value: "hide-read", label: "隐藏已读" },
  { value: "wish", label: "只看想读" },
];

const SORT_OPTIONS = [
  { value: "year-asc", label: "年代：早到晚" },
  { value: "year-desc", label: "年代：晚到早" },
  { value: "author", label: "作者姓名" },
  { value: "recent", label: "书目顺序" },
];

const FILTER_CONFIG = [
  { key: "genre", options: GENRE_OPTIONS },
  { key: "region", options: REGION_OPTIONS },
  { key: "award", options: AWARD_OPTIONS },
  { key: "library", options: LIBRARY_OPTIONS },
  { key: "sort", options: SORT_OPTIONS, all: false },
];

function allowedValues(options) {
  return new Set(options.map((item) => item.value));
}

/** 从 URL 恢复搜索/筛选，返回详情再回来时不会丢状态。 */
function applyUrlState() {
  const params = new URLSearchParams(location.search);
  state.q = (params.get("q") ?? "").trim();
  if (el.search) el.search.value = state.q;

  const pick = (key, options, fallback) => {
    const value = params.get(key);
    return value && allowedValues(options).has(value) ? value : fallback;
  };
  state.genre = pick("genre", GENRE_OPTIONS, "all");
  state.region = pick("region", REGION_OPTIONS, "all");
  state.award = pick("award", AWARD_OPTIONS, "all");
  state.library = pick("library", LIBRARY_OPTIONS, "all");
  state.sort = pick("sort", SORT_OPTIONS, "year-asc");

  const decade = params.get("decade");
  state.decade = decade && /^\d{4}s$/.test(decade) ? decade : "all";
  if (state.decade !== "all" && !state.books.some((book) => decadeOf(book.year) === state.decade)) {
    state.decade = "all";
  }
}

/** 把当前筛选写回 URL；用 replaceState，不制造额外的返回栈。 */
function syncUrlState() {
  try {
    const url = new URL(location.href);
    const params = url.searchParams;
    const setOrDelete = (key, value, defaultValue = "all") => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    if (state.q.trim()) params.set("q", state.q.trim());
    else params.delete("q");
    setOrDelete("decade", state.decade);
    setOrDelete("genre", state.genre);
    setOrDelete("region", state.region);
    setOrDelete("award", state.award);
    setOrDelete("library", state.library);
    setOrDelete("sort", state.sort, "year-asc");

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (next !== current) history.replaceState(null, "", next);
  } catch {
    /* file:// 或隐私模式忽略 */
  }
}

// 入场渐入只在本次会话的第一次渲染时播放；从详情页返回时不再重放，避免闪一帧。
try {
  state.reveal = sessionStorage.getItem("wk_reveal") !== "1";
  sessionStorage.setItem("wk_reveal", "1");
} catch {
  state.reveal = true;
}

let io = null;
const observer = () => {
  if (io) return io;
  if (typeof IntersectionObserver === "undefined") return null;
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "160px 0px 0px 0px", threshold: 0.05 }
  );
  return io;
};

function setStats(data) {
  if (!el.stats) return;
  const years = state.books.map((b) => Number(b.year)).filter((y) => Number.isFinite(y) && y > 0);
  const decades = new Set(state.books.map((b) => decadeOf(b.year)));
  const rangeText = years.length
    ? `${Math.min(...years)}—${Math.max(...years)}`
    : "1941—2022";
  el.stats.innerHTML = `
    <span><b>${state.books.length}</b>部作品</span>
    <span><b>${decades.size}</b>个年代</span>
    <span><b>${rangeText}</b>年</span>
  `;

  const range = document.getElementById("hero-range");
  if (range && years.length) {
    range.textContent = `${Math.min(...years)} — ${Math.max(...years)} · 中国现当代文学书影`;
  }

  const desc = document.querySelector('meta[name="description"]');
  if (desc && data.site?.description) desc.setAttribute("content", data.site.description);
}

function buildChips() {
  const counts = new Map();
  for (const book of state.books) {
    const d = decadeOf(book.year);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const frag = document.createDocumentFragment();
  const all = document.createElement("button");
  all.type = "button";
  all.className = "chip";
  all.dataset.decade = "all";
  all.setAttribute("aria-pressed", String(state.decade === "all"));
  all.textContent = "全部";
  frag.appendChild(all);

  for (const [decade] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.decade = decade;
    chip.setAttribute("aria-pressed", String(state.decade === decade));
    chip.textContent = decade;
    frag.appendChild(chip);
  }

  el.decades.replaceChildren(frag);
}

let openFilter = null;

function filterOptions(config) {
  return config.all === false
    ? config.options
    : [{ value: "all", label: "全部" }, ...config.options];
}

function updateFilterControls() {
  for (const config of FILTER_CONFIG) {
    const trigger = document.querySelector(`[data-filter-trigger="${config.key}"]`);
    const menu = document.querySelector(`[data-filter-menu="${config.key}"]`);
    if (!trigger || !menu) continue;
    const value = state[config.key];
    const selected = filterOptions(config).find((item) => item.value === value);
    trigger.textContent = selected?.label ?? "全部";
    trigger.dataset.value = value;
    for (const option of menu.querySelectorAll(".filter__option")) {
      const active = option.dataset.value === value;
      option.classList.toggle("is-selected", active);
      option.setAttribute("aria-selected", String(active));
    }
  }
}

function closeFilterMenu(restoreFocus = false) {
  if (!openFilter) return;
  const { trigger, menu } = openFilter;
  menu.hidden = true;
  menu.classList.remove("is-open");
  trigger.setAttribute("aria-expanded", "false");
  if (restoreFocus) trigger.focus();
  openFilter = null;
}

function positionFilterMenu(menu, trigger) {
  menu.hidden = false;
  menu.style.maxHeight = "none";
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const margin = 8;
  const fullHeight = menu.offsetHeight;
  const spaceBelow = innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;

  // 下方放得下就向下；放不下但上方放得下就完整向上展开。
  // 两边都放不下时才限制高度，在菜单内部滚动。
  let openBelow;
  if (spaceBelow >= fullHeight) openBelow = true;
  else if (spaceAbove >= fullHeight) openBelow = false;
  else openBelow = spaceBelow >= spaceAbove;

  const limit = openBelow ? spaceBelow : spaceAbove;
  menu.style.maxHeight = limit >= fullHeight
    ? "none"
    : `${Math.max(96, Math.min(360, limit))}px`;

  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(margin, Math.min(rect.left, innerWidth - width - margin));
  const top = openBelow
    ? rect.bottom + gap
    : Math.max(margin, rect.top - height - gap);
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function buildFilters() {
  for (const config of FILTER_CONFIG) {
    const trigger = document.querySelector(`[data-filter-trigger="${config.key}"]`);
    const menu = document.querySelector(`[data-filter-menu="${config.key}"]`);
    if (!trigger || !menu) continue;

    menu.innerHTML = filterOptions(config)
      .map(
        (item) => `<button class="filter__option" type="button" role="option" data-value="${esc(item.value)}" aria-selected="false">
          <span>${esc(item.label)}</span>
        </button>`
      )
      .join("");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (openFilter?.trigger === trigger) {
        closeFilterMenu();
        return;
      }
      closeFilterMenu();
      openFilter = { trigger, menu };
      positionFilterMenu(menu, trigger);
      trigger.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => menu.classList.add("is-open"));
      menu.querySelector(".filter__option.is-selected")?.focus({ preventScroll: true });
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".filter__option");
      if (!option) return;
      event.stopPropagation();
      state[config.key] = option.dataset.value;
      updateFilterControls();
      closeFilterMenu(true);
      render();
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilterMenu(true);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const options = [...menu.querySelectorAll(".filter__option")];
      const current = options.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + options.length) % options.length;
      options[next]?.focus({ preventScroll: true });
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trigger.click();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (openFilter && !event.target.closest(".filter")) closeFilterMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFilterMenu();
  });
  window.addEventListener("scroll", () => closeFilterMenu(), { passive: true });
  window.addEventListener("resize", () => closeFilterMenu());

  updateFilterControls();
}

function bookInGenre(book, group) {
  if (group === "all") return true;
  return (GENRE_GROUPS[group] ?? []).includes(book.genre);
}

function bookInRegion(book, regionValue) {
  if (regionValue === "all") return true;
  const rule = REGION_OPTIONS.find((item) => item.value === regionValue);
  if (!rule) return true;
  const tags = (book.tags ?? []).join(" ");
  const place = state.authorPlace.get(book.author) ?? "";
  return (
    rule.tags.some((tag) => tags.includes(tag)) ||
    rule.places.some((area) => place.includes(area))
  );
}

function bookHasAward(book, awardValue) {
  if (awardValue === "all") return true;
  const awards = (book.awards ?? []).join(" ");
  if (awardValue === "maodun") return awards.includes("茅盾文学奖");
  if (awardValue === "luxun") return awards.includes("鲁迅文学奖");
  return true;
}

function matches(book) {
  if (state.decade !== "all" && decadeOf(book.year) !== state.decade) return false;
  if (!bookInGenre(book, state.genre)) return false;
  if (!bookInRegion(book, state.region)) return false;
  if (!bookHasAward(book, state.award)) return false;

  const libraryStatus = state.libraryEntries?.[book.id]?.status ?? "";
  if (state.library === "hide-read" && libraryStatus === "read") return false;
  if (state.library === "wish" && libraryStatus !== "wish") return false;

  const q = state.q.trim().toLowerCase();
  if (!q) return true;

  const haystack = [book.title, book.author, book.genre, ...(book.tags ?? [])]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(q)) return true;

  // 作者全拼 / 首字母，例如 yuhua、yh 都能找到余华
  if (/^[a-z]+$/.test(q)) {
    const pinyin = AUTHOR_PINYIN[book.author];
    if (pinyin && (pinyin.full.includes(q) || pinyin.initials.startsWith(q))) return true;
  }
  return false;
}

function sortList(list) {
  const sorted = [...list];
  if (state.sort === "year-desc") {
    return sorted.sort((a, b) => Number(b.year) - Number(a.year));
  }
  if (state.sort === "author") {
    return sorted.sort((a, b) => String(a.author).localeCompare(String(b.author), "zh"));
  }
  if (state.sort === "recent") {
    return sorted.sort(
      (a, b) => (state.order.get(b.id) ?? 0) - (state.order.get(a.id) ?? 0)
    );
  }
  return sorted.sort((a, b) => Number(a.year) - Number(b.year));
}

function filtersActive() {
  return (
    state.decade !== "all" ||
    Boolean(state.q.trim()) ||
    state.genre !== "all" ||
    state.region !== "all" ||
    state.award !== "all" ||
    state.library !== "all"
  );
}

function resetFilters() {
  state.decade = "all";
  state.q = "";
  state.genre = "all";
  state.region = "all";
  state.award = "all";
  state.library = "all";
  state.sort = "year-asc";
  if (el.search) el.search.value = "";
  closeFilterMenu();
  updateFilterControls();
  for (const chip of el.decades.querySelectorAll(".chip")) {
    chip.setAttribute("aria-pressed", String(chip.dataset.decade === "all"));
  }
  render();
}

let renderToken = 0;

function render() {
  const token = ++renderToken;
  state.libraryEntries = getLibrary().entries;
  const list = sortList(state.books.filter(matches));
  const revealThisRender = state.reveal;

  el.shelf.replaceChildren();
  el.count.textContent = filtersActive()
    ? `${list.length} / ${state.books.length} 部`
    : `共 ${state.books.length} 部`;
  syncUrlState();

  if (!list.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.innerHTML = `<b>没有找到这本书</b>换个书名、作者、年代或筛选条件试试。${
      filtersActive() ? "<br>当前有条件筛选中，也可以直接查看全部。" : ""
    }`;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "empty__reset";
    reset.textContent = `查看全部 ${state.books.length} 部`;
    reset.addEventListener("click", resetFilters);
    empty.appendChild(reset);
    el.shelf.replaceChildren(empty);
    state.reveal = false;
    return;
  }

  // 首次 40 张，其余分帧追加：避免一次重建 300 张卡造成 200–400ms 长任务。
  const obs = observer();
  obs?.disconnect();
  let i = 0;
  const appendBatch = () => {
    if (token !== renderToken) return;
    const frag = document.createDocumentFragment();
    const end = Math.min(i + 40, list.length);
    for (; i < end; i += 1) {
      const book = list[i];
      // 只有首屏附近的卡片做渐入；其余直接显示，避免滚动前出现空白，
      // 也让整页截图、打印、无 IntersectionObserver 的环境都不缺内容。
      const card = createBookCard(book, { reveal: revealThisRender && i < 12 });
      if (revealThisRender && i < 12) card.style.transitionDelay = `${i * 35}ms`;
      frag.appendChild(card);
    }
    el.shelf.appendChild(frag);
    if (obs) {
      for (const node of el.shelf.querySelectorAll(".reveal:not(.is-in)")) obs.observe(node);
    } else {
      for (const node of el.shelf.querySelectorAll(".reveal")) node.classList.add("is-in");
    }
    if (i < list.length) window.setTimeout(appendBatch, 0);
  };
  appendBatch();

  // 首屏渐入只播一次，之后筛选/检索/返回都不再重放
  state.reveal = false;
}

function refreshLibraryFilter() {
  if (!state.books.length) return;
  state.libraryEntries = getLibrary().entries;
  render();
}

function bind() {
  el.decades.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.decade = chip.dataset.decade ?? "all";
    for (const c of el.decades.querySelectorAll(".chip")) {
      c.setAttribute("aria-pressed", String(c === chip));
    }
    render();
  });

  let timer = 0;
  el.search.addEventListener("input", () => {
    // 先更新状态和 URL：输入后 110ms 内点进详情，返回时也不会丢搜索词。
    state.q = el.search.value;
    syncUrlState();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      render();
    }, 110);
  });

  el.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      el.search.value = "";
      state.q = "";
      render();
    }
  });

  el.reset?.addEventListener("click", resetFilters);
  window.addEventListener(LIBRARY_EVENT, refreshLibraryFilter);
  window.addEventListener("pageshow", refreshLibraryFilter);
}

/** 页头 + 工具栏的实际高度，锚点跳转时避免标题被遮住。 */
function homeAnchorOffset() {
  return (
    (document.querySelector(".site-header")?.offsetHeight ?? 0) +
    (document.querySelector(".toolbar")?.offsetHeight ?? 0) +
    18
  );
}

function scrollToHomeHash() {
  if (!window.location.hash) return;
  let target;
  try {
    target = document.querySelector(window.location.hash);
  } catch {
    return;
  }
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - homeAnchorOffset();
  try {
    window.scrollTo({ top, behavior: "instant" });
  } catch {
    window.scrollTo(0, top);
  }
}

/**
 * 带 #about 从别的页面进来时，书架是异步渲染的，
 * 浏览器初始的锚点定位会被后插入的内容顶掉——等渲染完再定位一次。
 * 如果开屏题词正显示，等它结束（滚动锁在这期间是生效的）。
 */
function scheduleHashScroll() {
  if (!window.location.hash) return;
  const run = () => requestAnimationFrame(() => requestAnimationFrame(scrollToHomeHash));

  if (!document.body.classList.contains("splash-open")) {
    run();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains("splash-open")) {
      observer.disconnect();
      run();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.setTimeout(() => {
    observer.disconnect();
    run();
  }, 7000);
}

async function main() {
  try {
    const [data, authorData] = await Promise.all([
      loadBooks(),
      loadAuthors().catch(() => ({ authors: [] })),
    ]);
    state.rawBooks = data.books ?? [];
    state.order = new Map(state.rawBooks.map((book, index) => [book.id, index]));
    state.books = sortByYear(state.rawBooks);
    state.authorPlace = new Map(
      (authorData.authors ?? []).map((author) => [author.name, author.place ?? ""])
    );

    // 从 URL 恢复搜索/筛选：从详情返回时依赖浏览器恢复同一 URL。
    applyUrlState();

    setStats(data);
    buildChips();
    buildFilters();
    bind();
    render();
    renderFeature();
    // 书架是分帧追加的；等队列基本落定后再定位 #about，避免被后追加的书卡顶偏。
    window.setTimeout(scheduleHashScroll, 320);
  } catch (error) {
    console.error(error);
    const reason =
      error instanceof TypeError
        ? "连不上本地数据。请确认服务已启动，并通过本地服务器打开本站。"
        : error.message;
    el.shelf.innerHTML = `<li class="empty"><b>书目加载失败</b>${esc(reason)}<br>刷新后重试；若仍未恢复，请检查 data/books.json 是否存在。</li>`;
  }
}

/** 首屏右侧的“同名之作”书影，用于在大屏上平衡版面。 */
function renderFeature() {
  const feature = document.getElementById("hero-feature");
  const slot = document.getElementById("hero-feature-cover");
  if (!feature || !slot) return;

  const namesake = state.books.find((b) => b.id === "wenhuakulv");
  if (!namesake) {
    feature.remove();
    return;
  }

  slot.appendChild(createCover(namesake, { lazy: false }));
}

main();
