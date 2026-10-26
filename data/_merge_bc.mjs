import fs from "node:fs";
import { categoryOf } from "../public/js/categories.js";
import b from "./_books300b.mjs";
import c from "./_books300c.mjs";
import extras from "./_bc_extra.mjs";

const data = JSON.parse(fs.readFileSync("public/data/books.json", "utf8"));
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

const rows = [...b, ...c];
const books = rows.map((row, index) => {
  const [id, title, author, year, genre, tags, intro, why] = row;
  const extra = extras[id];
  if (!extra) throw new Error(`缺少补充段落：${id}`);
  const book = {
    id, title, author, year, genre,
    tags: tags.split("/").map((item) => item.trim()).filter(Boolean),
    intro: [...intro.split("\n"), extra.p3, extra.p4, extra.p5].filter(Boolean),
    why,
    cover: { ...palettes[index % palettes.length], style: styles[index % styles.length] },
  };
  if (extra.quote) book.quotes = [extra.quote];
  return book;
});

const existingIds = new Set(data.books.map((book) => book.id));
const existingTitles = new Set(data.books.map((book) => book.title));
for (const book of books) {
  if (existingIds.has(book.id)) throw new Error(`重复 id：${book.id}`);
  if (existingTitles.has(book.title)) throw new Error(`重复书名：${book.title}`);
  if (!categoryOf(book.genre)) throw new Error(`体裁未归类：${book.genre}`);
  if (book.intro.length !== 5) throw new Error(`段落数不对：${book.title}（${book.intro.length}）`);
}

data.books.push(...books);
fs.writeFileSync("public/data/books.json", JSON.stringify(data, null, 2) + "\n", "utf8");

const authors = JSON.parse(fs.readFileSync("public/data/authors.json", "utf8"));
for (const author of authors.authors) {
  const siteBooks = data.books.filter((book) => book.author === author.name);
  const titles = new Set((author.works ?? []).map((item) => item.title));
  for (const book of siteBooks) {
    if (titles.has(book.title)) continue;
    author.works = author.works ?? [];
    author.works.push({ title: book.title, year: String(book.year) });
    titles.add(book.title);
  }
  if (author.works) {
    author.works.sort((x, y) => Number(String(x.year).match(/\d{4}/)?.[0] ?? 9999) - Number(String(y.year).match(/\d{4}/)?.[0] ?? 9999));
  }
}
fs.writeFileSync("public/data/authors.json", JSON.stringify(authors, null, 2) + "\n", "utf8");

const counts = {};
for (const book of data.books) {
  const cat = categoryOf(book.genre);
  counts[cat.name] = (counts[cat.name] ?? 0) + 1;
}
console.log("总书目:", data.books.length, "| 作者:", authors.authors.length, "| 新增:", books.length);
console.log(counts);
