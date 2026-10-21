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
  } catch (error) {
    console.error(error);
    el.sections.innerHTML = `<p class="empty"><b>分类加载失败</b>${esc(error.message)}<br>请确认通过本地服务器访问本页。</p>`;
  }
}

main();
