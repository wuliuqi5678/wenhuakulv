/**
 * 合并 12 个批次到 books.json。先运行 validate.mjs，确保全部通过。
 * 运行：node data/intro-rewrite/validate.mjs && node data/intro-rewrite/merge.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "data", "intro-rewrite");
const batches = JSON.parse(fs.readFileSync(path.join(dir, "batches.json"), "utf8"));
const data = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "books.json"), "utf8"));
const byId = new Map(data.books.map((book) => [book.id, book]));
const rewritten = new Map();

for (let index = 0; index < batches.length; index += 1) {
  const number = String(index + 1).padStart(2, "0");
  const file = path.join(dir, `batch-${number}.json`);
  if (!fs.existsSync(file)) throw new Error(`缺少 batch-${number}.json`);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const expected = new Set(batches[index].map((book) => book.id));
  for (const id of expected) {
    if (!Array.isArray(payload[id])) throw new Error(`batch-${number} 缺少 ${id}`);
    if (rewritten.has(id)) throw new Error(`重复 id：${id}`);
    rewritten.set(id, payload[id]);
  }
  const extra = Object.keys(payload).filter((id) => !expected.has(id));
  if (extra.length) throw new Error(`batch-${number} 多出 id：${extra.join(", ")}`);
}

if (rewritten.size !== 300) throw new Error(`改写数量 ${rewritten.size}，应为 300`);

let changed = 0;
for (const [id, intro] of rewritten) {
  const book = byId.get(id);
  if (!book) throw new Error(`books.json 找不到 ${id}`);
  // 《老张的哲学》保留人工核对过的版本，避免被批量稿改回不确定细节。
  if (id === "laozhangdezhexue") continue;
  book.intro = intro;
  changed += 1;
}

fs.writeFileSync(path.join(root, "public", "data", "books.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`已合并 ${changed} 本；${rewritten.size - changed} 本保留人工稿。`);
