/**
 * 作者详情页：生平简介、本站收录作品、同时代人。
 */
import {
  loadBooks,
  loadAuthors,
  createBookCard,
  sortByYear,
  esc,
} from "./covers.js";

const el = {
  crumb: document.getElementById("author-crumb"),
  name: document.getElementById("author-name"),
  years: document.getElementById("author-years"),
  role: document.getElementById("author-role"),
  tags: document.getElementById("author-tags"),
  bio: document.getElementById("author-bio"),
  works: document.getElementById("author-works"),
  worksWrap: document.getElementById("author-works-wrap"),
  nearby: document.getElementById("author-nearby"),
  nearbyWrap: document.getElementById("author-nearby-wrap"),
};

const notFound = (message) => {
  document.title = "没有这位作者 · 文化苦旅";
  const main = document.querySelector("main");
  main.innerHTML = `
    <div class="shell" style="padding:80px 0 120px">
      <p class="crumb"><a href="authors.html">← 返回作者</a></p>
      <h1 class="detail__title" style="max-width:22ch">没有找到这位作者</h1>
      <p class="intro" style="margin-top:18px">${esc(message)}</p>
    </div>`;
};

async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    notFound("地址里缺少 ?id= 参数。请从作者索引或书页进入。");
    return;
  }

  let bookData;
  let authorData;
  try {
    [bookData, authorData] = await Promise.all([loadBooks(), loadAuthors()]);
  } catch (error) {
    notFound(`数据加载失败：${error.message}。请确认通过本地服务器访问。`);
    return;
  }

  const authors = authorData.authors ?? [];
  const author = authors.find((a) => a.id === id);
  if (!author) {
    notFound(`没有找到 id 为「${id}」的作者。`);
    return;
  }

  const books = sortByYear(bookData.books ?? []).filter((b) => b.author === author.name);

  document.title = `${author.name} · 作者 · 文化苦旅`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", `${author.name}（${author.years}），${author.role}。`);

  el.crumb.textContent = author.name;
  el.name.textContent = author.name;
  el.years.textContent = `${author.years}${author.place ? " · " + author.place : ""}`;
  el.role.textContent = author.role;

  el.tags.innerHTML = (author.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");

  el.bio.innerHTML = (author.bio ?? []).map((p) => `<p>${esc(p)}</p>`).join("");

  if (books.length) {
    const frag = document.createDocumentFragment();
    for (const book of books) frag.appendChild(createBookCard(book, { reveal: false, heading: "h3" }));
    el.works.replaceChildren(frag);
  } else {
    el.worksWrap.remove();
  }

  const nearby = authors
    .filter((a) => a.id !== author.id)
    .map((a) => ({ a, diff: Math.abs(a.born - author.born) }))
    .sort((x, y) => x.diff - y.diff || x.a.born - y.a.born)
    .slice(0, 5);

  if (nearby.length) {
    el.nearby.innerHTML = nearby
      .map(
        ({ a }) => `
        <a class="author-chip" href="author.html?id=${encodeURIComponent(a.id)}">
          ${esc(a.name)}
          <small>${esc(a.years)}</small>
        </a>`
      )
      .join("");
  } else {
    el.nearbyWrap.remove();
  }
}

main();
