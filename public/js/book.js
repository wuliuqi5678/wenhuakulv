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

const ids = {
  article: document.getElementById("book"),
  cover: document.getElementById("cover-slot"),
  crumbTitle: document.getElementById("crumb-title"),
  title: document.getElementById("book-title"),
  sub: document.getElementById("book-sub"),
  tags: document.getElementById("book-tags"),
  meta: document.getElementById("book-meta"),
  intro: document.getElementById("book-intro"),
  why: document.getElementById("book-why"),
  note: document.getElementById("book-note"),
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
    ["出版", book.publisher],
    ["体裁", book.genre],
    ["年代", decadeOf(book.year).replace("s", " 年代")],
  ];
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

async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    notFound("地址里缺少 ?id= 参数。请从书架进入，或检查链接是否完整。");
    return;
  }

  let data;
  let authorData;
  try {
    [data, authorData] = await Promise.all([
      loadBooks(),
      // 作者数据缺失不应导致整页失败
      loadAuthors().catch(() => ({ authors: [] })),
    ]);
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

  renderAuthorCard(author);

  ids.intro.innerHTML = (book.intro ?? []).map((p) => `<p>${esc(p)}</p>`).join("");

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
