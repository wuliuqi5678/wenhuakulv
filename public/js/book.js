/**
 * 作品详情页：读取 ?id=xxx，渲染书影、书目信息、简介、荐语与相关阅读。
 */
import {
  loadBooks,
  loadAuthors,
  createCover,
  createBookCard,
  sortByYear,
  decadeOf,
  esc,
} from "./covers.js";
import { getEntry, setStatus, setReadingStart, setReadDates, finishReading, markReread, removeBook, today, formatDate } from "./library-store.js";
import { dateField, initDatePicker } from "./date-picker.js";
import { loadReadingLists, listNumber } from "./reading-lists-data.js";

const ids = {
  article: document.getElementById("book"),
  cover: document.getElementById("cover-slot"),
  crumbTitle: document.getElementById("crumb-title"),
  title: document.getElementById("book-title"),
  sub: document.getElementById("book-sub"),
  tags: document.getElementById("book-tags"),
  meta: document.getElementById("book-meta"),
  intro: document.getElementById("book-intro"),
  quotes: document.getElementById("book-quotes"),
  quotesList: document.getElementById("book-quotes-list"),
  why: document.getElementById("book-why"),
  note: document.getElementById("book-note"),
  bookLists: document.getElementById("book-lists"),
  bookListsList: document.getElementById("book-lists-list"),
  related: document.getElementById("related-list"),
  relatedWrap: document.getElementById("related"),
  pager: document.getElementById("pager"),
};

const notFound = (message) => {
  document.title = "没有这本书 · 文化苦旅";
  const main = document.querySelector("main");
  main.innerHTML = `
    <div class="shell" style="padding:90px 0 120px">
      <p class="crumb"><a href="index.html">← 返回书架</a></p>
      <h1 class="detail__title" style="max-width:22ch">这里没有这一本书</h1>
      <p class="intro" style="margin-top:18px">${esc(message)}</p>
    </div>`;
};

function metaRows(book, authorId) {
  const authorCell = authorId
    ? `<a href="author.html?id=${encodeURIComponent(authorId)}">${esc(book.author)}</a>`
    : esc(book.author);

  const rows = [
    ["作者", authorCell, true],
    ["初版", `${book.year} 年`],
  ];
  if (book.publisher) rows.push(["出版", book.publisher]);
  rows.push(["体裁", book.genre], ["年代", decadeOf(book.year).replace("s", " 年代")]);
  if (book.awards?.length) rows.push(["奖项", book.awards.join("；")]);

  return rows
    .map(
      ([k, v, isHtml]) => `
      <div>
        <dt>${esc(k)}</dt>
        <dd>${isHtml ? v : esc(v)}</dd>
      </div>`
    )
    .join("");
}

function renderAuthorCard(author) {
  const wrap = document.getElementById("book-author");
  const slot = document.getElementById("book-author-slot");
  if (!slot || !wrap) return;

  if (!author) {
    wrap.remove();
    return;
  }

  const first = author.bio?.[0] ?? "";
  const excerpt = first.length > 96 ? `${first.slice(0, 96)}…` : first;

  slot.innerHTML = `
    <a class="book-author__link" href="author.html?id=${encodeURIComponent(author.id)}">
      <div>
        <p class="book-author__name">${esc(author.name)}<small>${esc(author.years)}</small></p>
        <p class="book-author__bio">${esc(excerpt)}</p>
      </div>
      <span class="book-author__more">查看作者介绍 →</span>
    </a>
  `;
}

function renderBookLists(book, listData) {
  if (!ids.bookLists || !ids.bookListsList) return;

  const hits = [];
  (listData?.lists ?? []).forEach((list, index) => {
    const position = (list.books ?? []).findIndex((ref) => ref.id === book.id);
    if (position < 0) return;
    hits.push({ list, index, position, total: list.books.length });
  });

  if (!hits.length) return;

  ids.bookListsList.innerHTML = hits
    .map(
      ({ list, index, position, total }) => `
      <a class="book-list-link" href="reading-list.html?id=${encodeURIComponent(list.id)}">
        <span class="book-list-link__no">${listNumber(index)}</span>
        <span class="book-list-link__title">${esc(list.title)}</span>
        <span class="book-list-link__pos">第 ${position + 1} 本 / 共 ${total} 本 →</span>
      </a>`
    )
    .join("");
  ids.bookLists.hidden = false;
}

function pickRelated(book, books) {
  const scored = books
    .filter((other) => other.id !== book.id)
    .map((other) => {
      const shared = (other.tags ?? []).filter((t) => (book.tags ?? []).includes(t)).length;
      let score = shared * 3;
      if (other.author === book.author) score += 2;
      if (decadeOf(other.year) === decadeOf(book.year)) score += 1;
      if (other.genre === book.genre) score += 1;
      return { other, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(a.other.year - book.year) - Math.abs(b.other.year - book.year) ||
        a.other.year - b.other.year
    );

  const picked = scored.slice(0, 4).map((s) => s.other);
  if (picked.length < 4) {
    for (const book2 of books) {
      if (picked.length >= 4) break;
      if (book2.id !== book.id && !picked.some((p) => p.id === book2.id)) picked.push(book2);
    }
  }
  return picked;
}

function renderPager(book, books) {
  const index = books.findIndex((b) => b.id === book.id);
  const prev = books[index - 1];
  const next = books[index + 1];
  ids.pager.innerHTML = `
    ${
      prev
        ? `<a href="book.html?id=${encodeURIComponent(prev.id)}"><small>上一本</small>《${esc(prev.title)}》</a>`
        : `<span class="pager__empty"></span>`
    }
    ${
      next
        ? `<a href="book.html?id=${encodeURIComponent(next.id)}"><small>下一本</small>《${esc(next.title)}》</a>`
        : `<span class="pager__empty"></span>`
    }
  `;
}

function renderLibrary(book) {
  const section = document.getElementById("book-library");
  if (!section) return;

  const paint = () => {
    const entry = getEntry(book.id);
    const isReading = entry?.status === "reading";
    const isRead = entry?.status === "read";
    const isWish = entry?.status === "wish";
    const when = isReading
      ? entry.start
        ? `始于 ${formatDate(entry.start)}`
        : "未填开始日期"
      : isRead
        ? entry.start && entry.end
          ? entry.start === entry.end
            ? `读完 ${formatDate(entry.end)}`
            : `${formatDate(entry.start)} — ${formatDate(entry.end)}`
          : entry.end
            ? `读完 ${formatDate(entry.end)}`
            : entry.start
              ? `始于 ${formatDate(entry.start)}`
              : "未填日期"
        : "";
    section.innerHTML = `
      <div class="book-library__head">
        <h2>我的书库</h2>
        <p aria-live="polite">${
          isReading
            ? `在读 · ${when}`
            : isRead
              ? `已看过 · ${when} · 读过 ${Math.max(1, Number(entry.reads) || 1)} 遍`
              : isWish
                ? "已加入想读"
                : "还没有收藏这本书"
        }</p>
      </div>
      <div class="book-library__actions">
        <button class="btn${isReading ? "" : " btn--ghost"}" type="button" data-lib="reading">${isReading ? "✓ 在读" : "在读"}</button>
        <button class="btn${isRead ? "" : " btn--ghost"}" type="button" data-lib="read">${isRead ? "✓ 已看过" : isReading ? "标记读完" : "看过"}</button>
        <button class="btn${isWish ? "" : " btn--ghost"}" type="button" data-lib="wish">${isWish ? "✓ 已想读" : "想读"}</button>
        ${isRead ? `<button class="library-mini" type="button" data-lib="reread">重读 +1</button>` : ""}
        ${entry ? `<button class="library-mini library-mini--quiet" type="button" data-lib="remove">移出书库</button>` : ""}
      </div>
      ${
        isReading || isRead
          ? `<div class="book-library__dates">
               <span class="book-library__date-label">开始</span>${dateField(entry.start, "data-lib-start")}
               ${
                 isRead
                   ? `<span aria-hidden="true">—</span>
                      <span class="book-library__date-label">读完</span>${dateField(entry.end, "data-lib-end")}`
                   : ""
               }
             </div>`
          : ""
      }
      <p class="book-library__hint"><a href="library.html">去书库看完整记录与时间轴 →</a></p>
    `;

    section.querySelector("[data-lib='reading']")?.addEventListener("click", () => {
      setStatus(book.id, "reading", entry?.start || today());
      paint();
    });
    section.querySelector("[data-lib='read']")?.addEventListener("click", () => {
      if (isReading) finishReading(book.id, today());
      else setStatus(book.id, "read", entry?.end || today());
      paint();
    });
    section.querySelector("[data-lib='wish']")?.addEventListener("click", () => {
      setStatus(book.id, "wish");
      paint();
    });
    section.querySelector("[data-lib='remove']")?.addEventListener("click", () => {
      if (!window.confirm(`确定从书库移除《${book.title}》？笔记、摘句和日期也会一起删除。`)) return;
      removeBook(book.id);
      paint();
    });
    section.querySelector("[data-lib='reread']")?.addEventListener("click", () => {
      markReread(book.id);
      paint();
    });
  };

  section.addEventListener("date-change", (event) => {
    if (!event.target.matches("[data-lib-start], [data-lib-end]")) return;
    const entry = getEntry(book.id);
    if (entry?.status === "reading") {
      setReadingStart(book.id, section.querySelector("[data-lib-start]")?.dataset.value ?? "");
    } else if (entry?.status === "read") {
      setReadDates(book.id, {
        start: section.querySelector("[data-lib-start]")?.dataset.value ?? "",
        end: section.querySelector("[data-lib-end]")?.dataset.value ?? "",
      });
    }
    paint();
  });

  paint();
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    notFound("地址里缺少 ?id= 参数。请从书架进入，或检查链接是否完整。");
    return;
  }

  let data;
  let authorData;
  let listData = { lists: [] };
  try {
    const [booksData, authorsData, listsData] = await Promise.all([
      loadBooks(),
      // 作者数据与书单缺失不应导致整页失败
      loadAuthors().catch(() => ({ authors: [] })),
      loadReadingLists().catch(() => ({ lists: [] })),
    ]);
    data = booksData;
    authorData = authorsData;
    listData = listsData;
  } catch (error) {
    notFound(`书目数据加载失败：${error.message}。请确认通过本地服务器访问。`);
    return;
  }

  const books = sortByYear(data.books ?? []);
  const book = books.find((b) => b.id === id);

  if (!book) {
    notFound(`没有找到 id 为「${id}」的作品。它可能已经改名，或链接拼错了。`);
    return;
  }

  const author = (authorData.authors ?? []).find((a) => a.name === book.author);

  initDatePicker();

  document.title = `《${book.title}》${book.author} · 文化苦旅`;

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", `${book.title}，${book.author}，${book.year} 年。${book.why ?? ""}`);

  ids.crumbTitle.textContent = `《${book.title}》`;
  ids.title.textContent = book.title;

  const authorLink = author
    ? `<a href="author.html?id=${encodeURIComponent(author.id)}">${esc(book.author)}</a>`
    : esc(book.author);
  ids.sub.innerHTML = `${authorLink} · ${book.year} 年 · ${esc(book.genre)}`;

  ids.cover.appendChild(createCover(book, { lazy: false }));

  const tags = [
    ...(book.awards ?? []).map((a) => `<span class="tag tag--award">${esc(a)}</span>`),
    ...(book.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`),
  ];
  ids.tags.innerHTML = tags.join("");

  ids.meta.innerHTML = metaRows(book, author?.id);

  renderLibrary(book);

  renderAuthorCard(author);

  renderBookLists(book, listData);

  const intro = book.intro ?? [];
  ids.intro.innerHTML = intro.map((p) => `<p>${esc(p)}</p>`).join("");
  // 首字下沉只对完整汉字成立：标点（《、“）、数字和单笔画字（一）放大后都不像装饰，
  // 反而会压住第一句或把书名/年份拆开，这类作品改用正常字号。
  const firstChar = (intro[0] ?? "").charAt(0);
  const canDropCap = /[\u4e00-\u9fff]/.test(firstChar) && !/[一丨丶丿乙]/.test(firstChar);
  ids.intro.classList.toggle("intro--plain", !canDropCap);

  const quotes = book.quotes ?? [];
  if (quotes.length && ids.quotes && ids.quotesList) {
    ids.quotesList.innerHTML = quotes
      .map(
        (quote) => `
        <figure class="quote">
          <blockquote><p>${esc(quote.text)}</p></blockquote>
          <figcaption>${esc(quote.from ?? `《${book.title}》`)}</figcaption>
        </figure>`
      )
      .join("");
    ids.quotes.hidden = false;
  } else if (ids.quotes && ids.quotesList) {
    ids.quotesList.innerHTML = `<p class="quote quote--empty">暂无可靠原文摘句，宁缺毋滥。</p>`;
    ids.quotes.hidden = false;
  }

  if (book.why) {
    ids.why.textContent = book.why;
  } else {
    ids.why.remove();
  }

  if (book.note) {
    ids.note.textContent = book.note;
    ids.note.hidden = false;
  } else {
    ids.note.remove();
  }

  const related = pickRelated(book, books);
  const frag = document.createDocumentFragment();
  for (const item of related) frag.appendChild(createBookCard(item, { reveal: false, heading: "h3" }));
  ids.related.replaceChildren(frag);

  renderPager(book, books);

  requestAnimationFrame(() => {
    ids.article.classList.add("is-in");
  });
}

main();
