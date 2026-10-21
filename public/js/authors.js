/**
 * 作者索引：按生年排序，显示生卒、定位与本站在收作品数。
 */
import { loadBooks, loadAuthors, sortByYear, esc } from "./covers.js";

const el = {
  grid: document.getElementById("authors-grid"),
  meta: document.getElementById("authors-meta"),
};

async function main() {
  try {
    const [bookData, authorData] = await Promise.all([loadBooks(), loadAuthors()]);
    const books = sortByYear(bookData.books ?? []);
    const authors = [...(authorData.authors ?? [])].sort(
      (a, b) => a.born - b.born || a.name.localeCompare(b.name, "zh")
    );

    const counts = new Map();
    for (const book of books) counts.set(book.author, (counts.get(book.author) ?? 0) + 1);

    if (el.meta) {
      el.meta.textContent = `共 ${authors.length} 位作者 · ${books.length} 部作品`;
    }

    const frag = document.createDocumentFragment();
    for (const author of authors) {
      const n = counts.get(author.name) ?? 0;
      const tile = document.createElement("a");
      tile.className = "author-tile";
      tile.href = `author.html?id=${encodeURIComponent(author.id)}`;
      tile.innerHTML = `
        <h2 class="author-tile__name">${esc(author.name)}</h2>
        <p class="author-tile__years">${esc(author.years)}${author.place ? " · " + esc(author.place) : ""}</p>
        <p class="author-tile__role">${esc(author.role)}</p>
        <span class="author-tile__count">本站收录 ${n} 部</span>
      `;
      frag.appendChild(tile);
    }
    el.grid.replaceChildren(frag);
  } catch (error) {
    el.grid.innerHTML = `<div class="empty"><b>作者数据加载失败</b>${esc(error.message)}<br>请确认通过本地服务器访问本页。</div>`;
  }
}

main();
