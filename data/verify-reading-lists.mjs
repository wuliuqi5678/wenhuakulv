/**
 * 校验主题书单数据：ID、书目引用、重复、导语字数。
 * 运行：node data/verify-reading-lists.mjs
 */
import fs from "node:fs";

const books = JSON.parse(fs.readFileSync("public/data/books.json", "utf8")).books ?? [];
const data = JSON.parse(fs.readFileSync("public/data/reading-lists.json", "utf8"));
const bookIds = new Set(books.map((book) => book.id));
const seenListIds = new Set();
const allBookIds = new Set();
const errors = [];
let entries = 0;

const lists = Array.isArray(data.lists) ? data.lists : [];
if (lists.length < 8 || lists.length > 12) {
  errors.push(`书单数量应为 8–12，当前 ${lists.length}`);
}

for (const list of lists) {
  if (!/^[a-z0-9-]+$/.test(String(list.id ?? ""))) {
    errors.push(`书单 id 不合法：${list.id}`);
  }
  if (seenListIds.has(list.id)) errors.push(`书单 id 重复：${list.id}`);
  seenListIds.add(list.id);

  const introText = (list.intro ?? []).join("");
  const han = [...introText].filter((char) => /\p{Script=Han}/u.test(char)).length;
  if (han < 300 || han > 500) {
    errors.push(`${list.id}: 导语 ${han} 字，应为 300–500 字`);
  }

  const refs = list.books ?? [];
  if (refs.length < 3) errors.push(`${list.id}: 至少 3 站`);
  const seenBooks = new Set();
  for (const ref of refs) {
    entries += 1;
    if (!bookIds.has(ref.id)) errors.push(`${list.id}: 找不到书 ${ref.id}`);
    if (seenBooks.has(ref.id)) errors.push(`${list.id}: 重复引用 ${ref.id}`);
    if (!String(ref.note ?? "").trim()) errors.push(`${list.id}: ${ref.id} 缺少 note`);
    seenBooks.add(ref.id);
    allBookIds.add(ref.id);
  }

  console.log(`${list.id}: ${refs.length} 站，导语 ${han} 字`);
}

if (errors.length) {
  console.error(`\n发现 ${errors.length} 个问题：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`\nOK：${lists.length} 份书单，${entries} 个站点，去重 ${allBookIds.size} 部作品`);
}
