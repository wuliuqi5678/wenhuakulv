/**
 * 书籍漫游：按兴趣标签给书目加权，随机推荐一本。
 * 未选标签时均匀随机；选得越多，标签越接近的书越容易被挑中。
 */
import { loadBooks, createCover, sortByYear, esc } from "./covers.js";

const el = {
  interests: document.getElementById("roam-interests"),
  stage: document.getElementById("roam-stage"),
  next: document.getElementById("roam-next"),
  clear: document.getElementById("roam-clear"),
};

const state = {
  books: [],
  tags: [],
  selected: new Set(),
  shown: new Set(),
  current: null,
  count: 0,
};

function topTags(books, limit = 14) {
  const freq = new Map();
  for (const book of books) {
    for (const tag of book.tags ?? []) freq.set(tag, (freq.get(tag) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function renderInterests() {
  const frag = document.createDocumentFragment();
  for (const tag of state.tags) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.tag = tag;
    chip.setAttribute("aria-pressed", String(state.selected.has(tag)));
    chip.textContent = tag;
    frag.appendChild(chip);
  }
  el.interests.replaceChildren(frag);
}

function pickWeighted() {
  if (!state.books.length) return null;

  let pool = state.books.filter((book) => !state.shown.has(book.id));
  if (!pool.length) {
    state.shown.clear();
    pool = [...state.books];
  }

  const weightOf = (book) => {
    if (!state.selected.size) return 1;
    const shared = (book.tags ?? []).filter((tag) => state.selected.has(tag)).length;
    return 1 + shared * 3;
  };

  const total = pool.reduce((sum, book) => sum + weightOf(book), 0);
  let ticket = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const book of pool) {
    ticket -= weightOf(book);
    if (ticket <= 0) {
      chosen = book;
      break;
    }
  }
  return chosen;
}

function renderStage() {
  const book = state.current;
  if (!book) {
    el.stage.innerHTML = `<p class="roam-empty">没有可推荐的书目。</p>`;
    return;
  }

  el.stage.innerHTML = `
    <div class="roam-stage__cover" id="roam-cover"></div>
    <div>
      <p class="roam-stage__eyebrow">第 ${state.count} 本 · ${
        state.selected.size ? "按你的偏好随机" : "随机漫游"
      }</p>
      <h2 class="roam-stage__title">${esc(book.title)}</h2>
      <p class="roam-stage__sub">${esc(book.author)} · ${book.year} 年 · ${esc(book.genre)}</p>
      <p class="roam-stage__why">${esc(book.why ?? "")}</p>
      ${
        book.quotes?.length
          ? `<blockquote class="roam-stage__quote">
               <p>“${esc(book.quotes[0].text)}”</p>
               <cite>${esc(book.quotes[0].from ?? `《${book.title}》`)}</cite>
             </blockquote>`
          : ""
      }
      <div class="roam-stage__tags">${(book.tags ?? [])
        .map((tag) => `<span class="tag">${esc(tag)}</span>`)
        .join("")}</div>
      <div class="roam-stage__actions">
        <a class="btn" href="book.html?id=${encodeURIComponent(book.id)}">去读这一页</a>
        <button class="btn btn--ghost" type="button" id="roam-again">再来一本</button>
      </div>
    </div>
  `;

  document.getElementById("roam-cover").appendChild(createCover(book, { lazy: false }));

  const again = document.getElementById("roam-again");
  again?.addEventListener("click", () => {
    draw();
    el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function draw({ advance = true } = {}) {
  const book = pickWeighted();
  if (!book) return;
  state.shown.add(book.id);
  state.current = book;
  // 勾选/清空偏好只是换一本，不推进“第 N 本”的计数
  if (advance) state.count += 1;
  renderStage();
}

function bind() {
  el.interests.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const tag = chip.dataset.tag;
    if (state.selected.has(tag)) state.selected.delete(tag);
    else state.selected.add(tag);
    chip.setAttribute("aria-pressed", String(state.selected.has(tag)));
    draw({ advance: false });
  });

  el.next.addEventListener("click", () => {
    draw();
    el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  el.clear.addEventListener("click", () => {
    state.selected.clear();
    for (const chip of el.interests.querySelectorAll(".chip")) {
      chip.setAttribute("aria-pressed", "false");
    }
    draw({ advance: false });
  });
}

async function main() {
  try {
    const data = await loadBooks();
    state.books = sortByYear(data.books ?? []);
    state.tags = topTags(state.books);
    renderInterests();
    bind();
    draw();
  } catch (error) {
    console.error(error);
    el.stage.innerHTML = `<p class="roam-empty">书目加载失败：${esc(error.message)}<br>请确认通过本地服务器访问本页。</p>`;
  }
}

main();
