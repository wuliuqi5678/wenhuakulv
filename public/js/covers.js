/**
 * 书影渲染组件。
 *
 * 每部作品都有一枚由版式生成的"书影"：底色、墨色、点缀色加上四种版式之一
 * （竖排 / 框线 / 数字水印 / 色带），全部由 CSS 渲染，无外部图片依赖。
 *
 * 若数据里给了 photo 字段（例如 "covers/hongyan.jpg"），会把真实书照盖在
 * 设计书影之上；图片加载失败时自动退回设计书影，不会出现破图。
 */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const STYLES = new Set(["vertical", "frame", "numeral", "band"]);

/** 生成一枚书影元素。 */
export function createCover(book, { lazy = true } = {}) {
  const c = book.cover ?? {};
  const style = STYLES.has(c.style) ? c.style : "frame";

  const el = document.createElement("div");
  el.className = `cover cover--${style}`;
  el.style.setProperty("--cv-bg", c.bg ?? "#33342F");
  el.style.setProperty("--cv-ink", c.ink ?? "#EFE9DA");
  el.style.setProperty("--cv-accent", c.accent ?? "#C9A227");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${book.title}，${book.author} 著，${book.year} 年`);

  const coverTitle = book.coverTitle ?? book.title;

  el.innerHTML = `
    <span class="cover__frame" aria-hidden="true"></span>
    <span class="cover__watermark" aria-hidden="true">${esc(book.year)}</span>
    <div class="cover__body">
      <span class="cover__title">${esc(coverTitle)}</span>
      <p class="cover__author">${esc(book.author)}</p>
    </div>
    <span class="cover__seal" aria-hidden="true">${esc(sealChar(book))}</span>
    <div class="cover__foot" aria-hidden="true">
      <span>${esc(book.year)}</span>
      <span>${esc(book.genre)}</span>
    </div>
  `;

  if (book.photo) {
    const img = new Image();
    img.className = "cover__photo";
    img.alt = `${book.title} 书影`;
    img.loading = lazy ? "lazy" : "eager";
    img.decoding = "async";
    img.onerror = () => img.remove();
    img.src = book.photo;
    el.appendChild(img);
  }

  return el;
}

/** 印章取一字：优先取书名首字，避免与标题重复时显得呆板。 */
function sealChar(book) {
  const chars = [...String(book.title ?? "")].filter((ch) => /[\u4e00-\u9fa5]/.test(ch));
  return chars[1] ?? chars[0] ?? "书";
}

/** 生成一张书卡（用于书架与"相关阅读"）。 */
export function createBookCard(book, { reveal = true, heading = "h2" } = {}) {
  const li = document.createElement("li");
  li.className = "book";
  if (reveal) li.classList.add("reveal");

  const a = document.createElement("a");
  a.className = "book__link";
  a.href = `book.html?id=${encodeURIComponent(book.id)}`;
  a.setAttribute("aria-label", `《${book.title}》${book.author}，${book.year} 年`);

  const cover = createCover(book);
  cover.classList.add("book__cover");

  const meta = document.createElement("div");
  meta.className = "book__meta";
  meta.innerHTML = `
    <${heading} class="book__title">${esc(book.title)}</${heading}>
    <p class="book__sub">
      <span>${esc(book.author)}</span>
      <span class="dot" aria-hidden="true">·</span>
      <span class="book__year">${esc(book.year)}</span>
    </p>
  `;

  a.append(cover, meta);
  li.appendChild(a);
  return li;
}

/** 载入书目数据。 */
export async function loadBooks() {
  const res = await fetch("data/books.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`书目数据加载失败（HTTP ${res.status}）`);
  return res.json();
}

/** 载入作者数据。 */
export async function loadAuthors() {
  const res = await fetch("data/authors.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`作者数据加载失败（HTTP ${res.status}）`);
  return res.json();
}

/** 年代键，例如 1957 -> "1950s"。 */
export const decadeOf = (year) => `${Math.floor(year / 10) * 10}s`;

export function sortByYear(books) {
  return [...books].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "zh"));
}

export { esc };
