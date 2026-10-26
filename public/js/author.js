/**
 * 作者详情页：生平经历、创作风格与读法、主要作品、获奖与荣誉、本站收录、同时代人。
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
  critique: document.getElementById("author-critique"),
  bibliography: document.getElementById("author-bibliography"),
  bibliographyWrap: document.getElementById("author-bibliography-wrap"),
  awards: document.getElementById("author-awards"),
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

  if (el.critique) {
    el.critique.innerHTML = (author.critique ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
    if (!(author.critique ?? []).length) el.critique.closest(".author-section")?.remove();
  }

  const yearOf = (item) => {
    const match = String(item.year ?? "").match(/\d{4}/);
    return match ? Number(match[0]) : 9999;
  };

  const works = [...(author.works ?? [])].sort((a, b) => yearOf(a) - yearOf(b));
  if (works.length) {
    el.bibliography.innerHTML = works
      .map(
        (item) => `
        <li>
          <span class="author-list__year">${esc(item.year ?? "—")}</span>
          <span class="author-list__title">《${esc(item.title)}》</span>
        </li>`
      )
      .join("");
  } else {
    el.bibliographyWrap.remove();
  }

  const awards = [...(author.awards ?? [])].sort((a, b) => yearOf(a) - yearOf(b));
  if (awards.length) {
    el.awards.innerHTML = awards
      .map(
        (item) => `
        <li>
          <span class="author-list__year">${esc(item.year ?? "—")}</span>
          <span class="author-list__text">${esc(item.text)}</span>
        </li>`
      )
      .join("");
  } else {
    el.awards.innerHTML = `<li class="author-list__empty">暂无重要文学奖项记录；其作品影响见「生平经历」与「本站收录」。</li>`;
  }

  if (books.length) {
    const frag = document.createDocumentFragment();
    for (const book of books) frag.appendChild(createBookCard(book, { reveal: false, heading: "h3" }));
    el.works.replaceChildren(frag);
  } else {
    el.worksWrap.remove();
  }

  // 「同时代人」按生年就近排列；生年不详（born 为 null）时不计算差值，
  // 否则 null 会被当成 0，把十九世纪作家误排成同时代人。
  const nearby = Number.isFinite(author.born)
    ? authors
        .filter((a) => a.id !== author.id && Number.isFinite(a.born))
        .map((a) => ({ a, diff: Math.abs(a.born - author.born) }))
        .sort((x, y) => x.diff - y.diff || x.a.born - y.a.born)
        .slice(0, 5)
    : [];

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
