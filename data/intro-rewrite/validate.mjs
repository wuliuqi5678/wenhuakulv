/**
 * 校验 12 个改写批次：id 完整、4—6 段、段内无完全重复、JSON 合法。
 * 运行：node data/intro-rewrite/validate.mjs
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data", "intro-rewrite");
const batches = JSON.parse(fs.readFileSync(path.join(dir, "batches.json"), "utf8"));
const normalize = (text) => String(text).replace(/[\s，。；：、！？""''（）()《》·—…,.;:!?]/g, "");
const errors = [];
let booksDone = 0;

function lcsLength(a, b) {
  if (a.length < b.length) [a, b] = [b, a];
  let previous = new Uint16Array(b.length + 1);
  let best = 0;
  for (let i = 0; i < a.length; i += 1) {
    const current = new Uint16Array(b.length + 1);
    for (let j = 0; j < b.length; j += 1) {
      if (a[i] === b[j]) {
        current[j + 1] = previous[j] + 1;
        if (current[j + 1] > best) best = current[j + 1];
      }
    }
    previous = current;
  }
  return best;
}

function tooSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 24) return false;
  const lcs = lcsLength(a, b);
  return (lcs >= 18 && lcs / min >= 0.45) || (min / max >= 0.7 && lcs / min >= 0.5);
}

for (let index = 0; index < batches.length; index += 1) {
  const number = String(index + 1).padStart(2, "0");
  const file = path.join(dir, `batch-${number}.json`);
  if (!fs.existsSync(file)) {
    console.log(`batch-${number}: 尚未生成`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`batch-${number}: JSON 解析失败：${error.message}`);
    continue;
  }
  const expected = new Set(batches[index].map((book) => book.id));
  const actual = Object.keys(data);
  for (const id of expected) {
    if (!actual.includes(id)) errors.push(`batch-${number}: 缺少 ${id}`);
  }
  for (const id of actual) {
    if (!expected.has(id)) errors.push(`batch-${number}: 多出 ${id}`);
  }

  for (const id of actual) {
    const paragraphs = data[id];
    if (!Array.isArray(paragraphs)) {
      errors.push(`${id}: 不是数组`);
      continue;
    }
    if (paragraphs.length < 4 || paragraphs.length > 6) {
      errors.push(`${id}: 段数 ${paragraphs.length}（应为 4—6）`);
    }
    const seen = new Set();
    const normalized = [];
    let total = 0;
    for (const paragraph of paragraphs) {
      if (typeof paragraph !== "string" || !paragraph.trim()) {
        errors.push(`${id}: 有空段落`);
        continue;
      }
      const key = normalize(paragraph);
      total += [...paragraph].filter((char) => /\p{Script=Han}/u.test(char)).length;
      if (seen.has(key)) errors.push(`${id}: 完全重复段落`);
      seen.add(key);
      normalized.push(key);
    }
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        if (tooSimilar(normalized[i], normalized[j])) {
          errors.push(`${id}: 第 ${i + 1}、${j + 1} 段内容过近`);
        }
      }
    }
    if (total < 300) errors.push(`${id}: 总字数偏少 ${total}`);
    if (total > 700) errors.push(`${id}: 总字数偏多 ${total}`);
    booksDone += 1;
  }
  console.log(`batch-${number}: ${actual.length}/${expected.size} 本，JSON OK`);
}

console.log(`\n已检查 ${booksDone}/300 本`);
if (errors.length) {
  console.error(`发现 ${errors.length} 个问题：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (booksDone === 300) {
  console.log("全部通过");
}
