/**
 * 书架首页：按年代筛选、书名/作者检索、渐入动画。
 */
import { loadBooks, createBookCard, createCover, decadeOf, sortByYear } from "./covers.js";

const el = {
  shelf: document.getElementById("shelf"),
  decades: document.getElementById("decades"),
  count: document.getElementById("count"),
  search: document.getElementById("search"),
  stats: document.getElementById("hero-stats"),
};

const state = { books: [], decade: "all", q: "" };

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
  const years = state.books.map((b) => b.year);
  const decades = new Set(state.books.map((b) => decadeOf(b.year)));
  el.stats.innerHTML = `
    <span><b>${state.books.length}</b>部作品</span>
    <span><b>${decades.size}</b>个年代</span>
    <span><b>${Math.min(...years)}—${Math.max(...years)}</b>年</span>
  `;

  const range = document.getElementById("hero-range");
  if (range) {
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
  all.setAttribute("aria-pressed", "true");
  all.textContent = "全部";
  frag.appendChild(all);

  for (const [decade] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.decade = decade;
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = decade;
    frag.appendChild(chip);
  }

  el.decades.replaceChildren(frag);
}

function matches(book) {
  if (state.decade !== "all" && decadeOf(book.year) !== state.decade) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  const haystack = [book.title, book.author, book.genre, ...(book.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function render() {
  const list = state.books.filter(matches);

  const frag = document.createDocumentFragment();
  let i = 0;
  for (const book of list) {
    // 只有首屏附近的卡片做渐入；其余直接显示，避免滚动前出现空白，
    // 也让整页截图、打印、无 IntersectionObserver 的环境都不缺内容。
    const card = createBookCard(book, { reveal: i < 12 });
    if (i < 12) card.style.transitionDelay = `${i * 35}ms`;
    frag.appendChild(card);
    i += 1;
  }

  if (!list.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.innerHTML = `<b>没有找到这本书</b>换个书名、作者或年代试试。${
      state.decade !== "all" ? "<br>当前按年代筛选中，也可以直接查看全部。" : ""
    }`;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "empty__reset";
    reset.textContent = `查看全部 ${state.books.length} 部`;
    reset.addEventListener("click", () => {
      state.decade = "all";
      state.q = "";
      el.search.value = "";
      for (const c of el.decades.querySelectorAll(".chip")) {
        c.setAttribute("aria-pressed", String(c.dataset.decade === "all"));
      }
      render();
    });
    empty.appendChild(reset);
    frag.appendChild(empty);
  }

  el.shelf.replaceChildren(frag);

  const obs = observer();
  obs?.disconnect();
  for (const node of el.shelf.querySelectorAll(".reveal")) {
    if (obs) obs.observe(node);
    else node.classList.add("is-in");
  }

  el.count.textContent =
    state.decade === "all" && !state.q.trim()
      ? `共 ${state.books.length} 部`
      : `${list.length} / ${state.books.length} 部`;
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
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state.q = el.search.value;
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
}

async function main() {
  try {
    const data = await loadBooks();
    state.books = sortByYear(data.books ?? []);

    // 顶部搜索框提交到 index.html?q=…，这里接住并回填工具栏检索框
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) {
      state.q = query;
      el.search.value = query;
    }

    setStats(data);
    buildChips();
    bind();
    render();
    renderFeature();
  } catch (error) {
    console.error(error);
    el.shelf.innerHTML = `<li class="empty"><b>书目加载失败</b>${error.message}<br>请确认通过本地服务器访问本页（http://127.0.0.1:3000）。</li>`;
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
