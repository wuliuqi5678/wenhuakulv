/**
 * 改写稿事实边界粗查：只标出“新出现”的年份/出版/奖项/改编词，供人工复核。
 * 不是自动判错；运行：node data/intro-rewrite/fact-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "data", "intro-rewrite");
const books = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "books.json"), "utf8")).books;
const batches = JSON.parse(fs.readFileSync(path.join(dir, "batches.json"), "utf8"));
const byId = new Map(books.map((book) => [book.id, book]));
const flags = [];

for (let index = 0; index < batches.length; index += 1) {
  const number = String(index + 1).padStart(2, "0");
  const file = path.join(dir, `batch-${number}.json`);
  if (!fs.existsSync(file)) continue;
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const book of batches[index]) {
    const paragraphs = payload[book.id];
    if (!paragraphs) continue;
    const old = byId.get(book.id);
    const oldText = [...(old?.intro ?? []), old?.why ?? ""].join("");
    const newText = paragraphs.join("");
    const oldYears = new Set(oldText.match(/(?:18|19|20)\d{2}/g) ?? []);
    const newYears = new Set(newText.match(/(?:18|19|20)\d{2}/g) ?? []);
    for (const year of newYears) {
      if (!oldYears.has(year) && String(book.year) !== year) {
        flags.push(`${book.id}《${book.title}》：新出现年份 ${year}`);
      }
    }
    for (const term of ["出版社", "出版", "初版", "再版", "销量", "畅销", "改编", "电影", "电视剧", "诺贝尔", "茅盾文学奖", "鲁迅文学奖"]) {
      if (newText.includes(term) && !oldText.includes(term)) {
        flags.push(`${book.id}《${book.title}》：新出现词「${term}」`);
      }
    }
  }
}

if (!flags.length) {
  console.log("未发现新出现的年份/出版/奖项/改编词。");
} else {
  console.log(`需人工复核 ${flags.length} 条：`);
  for (const flag of [...new Set(flags)]) console.log(`- ${flag}`);
}
