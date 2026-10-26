/**
 * 站点静态检查：数据数量、书单引用、HTML 资源/站内链接、统一版本号。
 * 运行：npm test
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const errors = [];
const htmlFiles = fs.readdirSync(publicDir).filter((file) => file.endsWith(".html"));

const booksData = JSON.parse(fs.readFileSync(path.join(publicDir, "data", "books.json"), "utf8"));
const authorsData = JSON.parse(fs.readFileSync(path.join(publicDir, "data", "authors.json"), "utf8"));
const listsData = JSON.parse(fs.readFileSync(path.join(publicDir, "data", "reading-lists.json"), "utf8"));
const books = booksData.books ?? [];
const authors = authorsData.authors ?? [];
const lists = listsData.lists ?? [];
const bookIds = new Set(books.map((book) => book.id));
const authorNames = new Set(authors.map((author) => author.name));

if (books.length !== 300) errors.push(`书目数量应为 300，当前 ${books.length}`);
if (authors.length !== 67) errors.push(`作者数量应为 67，当前 ${authors.length}`);
if (lists.length < 8 || lists.length > 12) errors.push(`书单数量应为 8–12，当前 ${lists.length}`);

for (const book of books) {
  if (!authorNames.has(book.author)) errors.push(`找不到作者：${book.title} / ${book.author}`);
}
for (const list of lists) {
  const seen = new Set();
  const han = [...(list.intro ?? []).join("")].filter((char) => /\p{Script=Han}/u.test(char)).length;
  if (han < 300 || han > 500) errors.push(`${list.id} 导语 ${han} 字`);
  for (const ref of list.books ?? []) {
    if (!bookIds.has(ref.id)) errors.push(`${list.id} 引用了不存在的书：${ref.id}`);
    if (seen.has(ref.id)) errors.push(`${list.id} 重复引用：${ref.id}`);
    seen.add(ref.id);
  }
}

let version = "";
for (const file of htmlFiles) {
  const text = fs.readFileSync(path.join(publicDir, file), "utf8");
  if (!text.includes('href="reading-lists.html"')) errors.push(`${file} 缺少书单导航`);

  for (const match of text.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const url = match[1];
    const clean = url.split("?")[0];
    if (!fs.existsSync(path.join(publicDir, clean))) errors.push(`${file} 脚本不存在：${url}`);
    const versionMatch = url.match(/\?v=([^&"]+)/);
    if (!versionMatch) errors.push(`${file} 脚本缺少版本号：${url}`);
    else if (!version) version = versionMatch[1];
    else if (versionMatch[1] !== version) errors.push(`${file} 版本号不一致：${url}`);
  }
  for (const match of text.matchAll(/<link[^>]+href="([^"]+)"/g)) {
    const url = match[1];
    if (!url.startsWith("css/")) continue;
    if (!fs.existsSync(path.join(publicDir, url.split("?")[0]))) errors.push(`${file} 样式不存在：${url}`);
    const versionMatch = url.match(/\?v=([^&"]+)/);
    if (versionMatch && version && versionMatch[1] !== version) errors.push(`${file} 样式版本不一致：${url}`);
  }
  for (const match of text.matchAll(/href="([^"#?:]+\.html)[^"]*"/g)) {
    const target = match[1];
    if (!fs.existsSync(path.join(publicDir, target))) errors.push(`${file} 站内链接不存在：${target}`);
  }
}

console.log(`检查 ${htmlFiles.length} 个 HTML、${books.length} 本书、${authors.length} 位作者、${lists.length} 份书单；资源版本 ${version || "未找到"}`);
if (errors.length) {
  console.error(`发现 ${errors.length} 个问题：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("OK");
}
