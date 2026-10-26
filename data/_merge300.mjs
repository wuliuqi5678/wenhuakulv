import fs from "node:fs";
import { categoryOf } from "../public/js/categories.js";
import a from "./_books300a.mjs";
import b from "./_books300b.mjs";
import c from "./_books300c.mjs";
import d from "./_books300d.mjs";
import { extras, added } from "./_books300d_extra.mjs";
import newAuthors from "./_authors300.mjs";

const existingBooks = JSON.parse(fs.readFileSync("public/data/books.json", "utf8"));
const existingAuthors = JSON.parse(fs.readFileSync("public/data/authors.json", "utf8"));

const palettes = [
  { bg: "#4A3B32", ink: "#F0E6D2", accent: "#C9A227" },
  { bg: "#2F3E46", ink: "#E8E4D8", accent: "#9FB3A8" },
  { bg: "#5B2F2A", ink: "#F3E8D5", accent: "#D2A24C" },
  { bg: "#3C4A3E", ink: "#EDE7D8", accent: "#B9A46A" },
  { bg: "#4B3F5A", ink: "#F1E9DD", accent: "#C4A96A" },
  { bg: "#6B4A2F", ink: "#F5EAD6", accent: "#D8B06A" },
  { bg: "#2E3A4A", ink: "#E9E6DA", accent: "#A8B7C4" },
  { bg: "#5A4632", ink: "#F2E8D7", accent: "#C9A227" },
  { bg: "#3A3F34", ink: "#EEE9DA", accent: "#B5A06A" },
  { bg: "#5C3A3A", ink: "#F4E9D8", accent: "#C9A227" },
  { bg: "#33413B", ink: "#EAE7D9", accent: "#A7B5A5" },
  { bg: "#4A3A2E", ink: "#F1E8D6", accent: "#D0A85C" },
];
const styles = ["frame", "vertical", "numeral", "band"];

function compactToBook(row, index) {
  const [id, title, author, year, genre, tags, intro, why] = row;
  return {
    id,
    title,
    author,
    year,
    genre,
    tags: tags.split("/").map((item) => item.trim()).filter(Boolean),
    intro: intro.split("\n").map((item) => item.trim()).filter(Boolean),
    why,
    cover: { ...palettes[index % palettes.length], style: styles[index % styles.length] },
  };
}

const compact = [];
const baseD = d.map((row, index) => {
  const book = compactToBook(row, index);
  const extra = extras[book.id];
  if (!extra) throw new Error(`缺少补充段落：${book.id}`);
  book.intro.push(extra.p3, extra.p4);
  if (extra.quote) book.quotes = [extra.quote];
  return book;
});

const addedBooks = added.map((book, index) => ({
  ...book,
  cover: {
    ...palettes[(baseD.length + index) % palettes.length],
    style: styles[(baseD.length + index) % styles.length],
  },
}));

const extraBooks = [...baseD, ...addedBooks];
const allBooks = [...existingBooks.books, ...extraBooks];

if (allBooks.length !== 201) throw new Error(`总书目数量不对：${allBooks.length}`);

const authorNames = new Set([...existingAuthors.authors, ...newAuthors].map((author) => author.name));
const ids = new Set();
const titles = new Set();
const problems = [];
const newIds = new Set(extraBooks.map((book) => book.id));
for (const book of allBooks) {
  if (ids.has(book.id)) problems.push(`重复 id：${book.id}`);
  if (titles.has(book.title)) problems.push(`重复书名：${book.title}`);
  if (!authorNames.has(book.author)) problems.push(`作者不存在：${book.author}`);
  if (!categoryOf(book.genre)) problems.push(`体裁未归类：${book.genre}（${book.title}）`);
  if (!book.cover) problems.push(`缺少封面：${book.title}`);
  if (newIds.has(book.id) && (!Array.isArray(book.intro) || book.intro.length < 4)) {
    problems.push(`详细介绍不足 4 段：${book.title}（${book.intro?.length}）`);
  }
  if (newIds.has(book.id) && !book.why) problems.push(`缺少荐语：${book.title}`);
  ids.add(book.id);
  titles.add(book.title);
}
if (problems.length) throw new Error(problems.join("\n"));

const authors = [...existingAuthors.authors, ...newAuthors];
for (const author of authors) {
  const siteBooks = allBooks.filter((book) => book.author === author.name);
  const works = author.works ?? [];
  const workTitles = new Set(works.map((item) => item.title));
  for (const book of siteBooks) {
    if (workTitles.has(book.title)) continue;
    works.push({ title: book.title, year: String(book.year) });
    workTitles.add(book.title);
  }
  author.works = works.sort((x, y) => {
    const nx = Number(String(x.year).match(/\d{4}/)?.[0] ?? 9999);
    const ny = Number(String(y.year).match(/\d{4}/)?.[0] ?? 9999);
    return nx - ny;
  });
}

fs.writeFileSync("public/data/books.json", JSON.stringify({ ...existingBooks, books: allBooks }, null, 2) + "\n", "utf8");
fs.writeFileSync("public/data/authors.json", JSON.stringify({ ...existingAuthors, authors }, null, 2) + "\n", "utf8");

const counts = {};
for (const book of allBooks) {
  const category = categoryOf(book.genre);
  counts[category.name] = (counts[category.name] ?? 0) + 1;
}
console.log("总书目:", allBooks.length, "| 作者:", authors.length, "| 新增书籍:", extraBooks.length, "| 新增作者:", newAuthors.length);
console.log(counts);
