/** 书库状态与日期的小回归：npm test 的一部分。 */
const store = new Map();
global.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
global.window = { dispatchEvent() {} };
global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

const { setStatus, getEntry, markReread, setReadDates } = await import("../public/js/library-store.js");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

setStatus("test-book", "read", "2026-09-20");
assert(getEntry("test-book").end === "2026-09-20", "read date not stored");
markReread("test-book");
const reread = getEntry("test-book");
assert(reread.reads === 2, "reread count not incremented");

setStatus("test-book", "wish");
const wished = getEntry("test-book");
assert(wished.end === "2026-09-20", "read date lost when switching to wish");
assert(wished.reads === 2, "reread count lost when switching to wish");

setStatus("test-book", "read", wished.end);
assert(getEntry("test-book").reads === 2, "reread count lost when switching back to read");

setStatus("test-book", "reading", "2026-09-21");
assert(getEntry("test-book").end === "2026-09-20", "read date lost when switching to reading");
setStatus("test-book", "read", getEntry("test-book").end || "2026-09-20");
setReadDates("test-book", { start: "2026-02-30", end: "2026-09-20" });
const invalid = getEntry("test-book");
assert(invalid.start === "", "invalid calendar date should be rejected");
assert(invalid.end === "2026-09-20", "valid end date should remain");

console.log("书库状态回归：OK");
