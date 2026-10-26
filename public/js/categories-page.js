/**
 * 分类页：按体裁把全部书目分成七类，顶部提供跳转。
 */
import { loadBooks, createBookCard, sortByYear, esc } from "./covers.js";
import { groupByCategory, unmappedGenres } from "./categories.js";

const el = {
  meta: document.getElementById("cat-meta"),
  jump: document.getElementById("cat-jump"),
  sections: document.getElementById("cat-sections"),
};

function renderJump(groups) {
  el.jump.innerHTML = groups
    .map(
      (g) =>
        `<a href="#cat-${g.id}">${esc(g.name)}<span>${g.books.length}</span></a>`
    )
    .join("");
}

/**
 * 类别导航吸顶后高度会随换行变化，算出「页头 + 导航」的占位高度，
 * 供锚点跳转时让标题不被遮住。
 */
function syncOffset() {
  const header = document.querySelector(".site-header")?.offsetHeight ?? 0;
  const offset = header + el.jump.offsetHeight + 16;
  document.documentElement.style.setProperty("--cat-offset", `${offset}px`);
  return offset;
}

function scrollToHash(offset) {
  if (!location.hash.startsWith("#cat-")) return;
  const target = document.querySelector(location.hash);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  try {
    window.scrollTo({ top, behavior: "instant" });
  } catch {
    window.scrollTo(0, top);
  }
}

function renderSections(groups) {
  const frag = document.createDocumentFragment();
  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "category";
    section.id = `cat-${group.id}`;

    const head = document.createElement("div");
    head.className = "category__head";
    head.innerHTML = `
      <h2 class="category__name">${esc(group.name)}</h2>
      <span class="category__count">${group.books.length} 部</span>
      <p class="category__desc">${esc(group.desc)}</p>
    `;

    const shelf = document.createElement("ul");
    shelf.className = "shelf";
    for (const book of group.books) {
      shelf.appendChild(createBookCard(book, { reveal: false, heading: "h3" }));
    }

    section.append(head, shelf);
    frag.appendChild(section);
  }
  el.sections.replaceChildren(frag);
}

async function main() {
  try {
    const data = await loadBooks();
    const books = sortByYear(data.books ?? []);
    const groups = groupByCategory(books);

    const missing = unmappedGenres(books);
    if (missing.length) console.warn("未归类的体裁：", missing.join("、"));

    el.meta.textContent = `共 ${books.length} 部作品 · ${groups.length} 个类别`;
    renderJump(groups);
    renderSections(groups);

    syncOffset();
    requestAnimationFrame(() => {
      scrollToHash(syncOffset());
    });

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => syncOffset());
      observer.observe(el.jump);
    }
    window.addEventListener("resize", syncOffset, { passive: true });
  } catch (error) {
    console.error(error);
    if (el.meta) el.meta.textContent = "分类加载失败";
    const reason = error instanceof TypeError ? "连不上本地数据，请确认服务已启动。" : error.message;
    el.sections.innerHTML = `<p class="empty"><b>分类加载失败</b>${esc(reason)}<br>请通过本地服务器访问本页。</p>`;
  }
}

main();
