/**
 * 站内 AI 助手入口。
 *
 * - 全站右下角悬浮「问 AI」，随时打开；
 * - 把当前页面（作品/作者）告诉服务端，回答会更贴合上下文；
 * - 服务端只依据站内资料检索并调用 DeepSeek，密钥不下发到浏览器；
 * - 对话存在 sessionStorage，站内翻页后仍能接着问；
 * - 作品页可开启「只问本书」「防剧透」；「书库推荐」只发送书名、标签与状态。
 */
import { getLibrary, LIBRARY_EVENT } from "./library-store.js";

/**
 * GitHub Pages 这类纯静态托管没有 /api/*（没有 server.js、server-ai.js）。
 * 这类环境下整个 AI 入口都不渲染，访客不会点到「发送后报错」的空壳。
 * 有了自定义域名后这个判断不成立：需要自己加标记，或继续用能跑 Node 的方案。
 */
const IS_STATIC_HOST = /(?:^|\.)github\.io$/i.test(window.location.hostname);

const STORE_KEY = "wk_ai_history";
const SESSION_KEY = "wk_ai_session";
const POS_KEY = "wk_ai_pos";
const MAX_HISTORY = 24;
const MAX_LIBRARY_ITEMS = 30;

let sessionId = "";
try {
  sessionId = sessionStorage.getItem(SESSION_KEY) || "";
} catch {
  sessionId = "";
}

const page = {
  path: window.location.pathname,
  id: new URLSearchParams(window.location.search).get("id") ?? "",
  hash: window.location.hash,
};

const isBookPage = page.path.endsWith("/book.html") && Boolean(page.id);
let bookOnly = isBookPage;
let spoilerOn = false;
let booksPromise = null;

let history = loadHistory();
let busy = false;
let activeController = null;
let requestSeq = 0;
let els = null;
let statusChecked = false;
let dragState = null;
let dragBlockHandler = null;
let suppressClick = false;

function loadHistory() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    /* 隐私模式下忽略 */
  }
}

function scrollToEnd() {
  if (els?.body) els.body.scrollTop = els.body.scrollHeight;
}

function hideEmpty() {
  if (els?.empty) els.empty.hidden = true;
}

function showEmptyIfNeeded() {
  if (!els?.empty) return;
  els.empty.hidden = history.length > 0;
}

function messageNode(role, content, links = []) {
  const wrap = document.createElement("div");
  wrap.className = `ai-msg ai-msg--${role}`;

  const text = document.createElement("p");
  text.className = "ai-msg__text";
  text.textContent = content;
  wrap.appendChild(text);

  if (links?.length) {
    const nav = document.createElement("div");
    nav.className = "ai-msg__links";
    for (const link of links) {
      if (!link?.href || !link?.label) continue;
      const a = document.createElement("a");
      a.className = "ai-link";
      a.href = link.href;
      a.textContent = link.label;
      nav.appendChild(a);
    }
    if (nav.childElementCount) wrap.appendChild(nav);
  }
  return wrap;
}

function appendMessage(entry, persist = true) {
  els.messages.appendChild(messageNode(entry.role, entry.content, entry.links));
  if (persist) {
    history.push(entry);
    history = history.slice(-MAX_HISTORY);
    saveHistory();
  }
  hideEmpty();
  scrollToEnd();
}

function errorNode(message) {
  const wrap = document.createElement("div");
  wrap.className = "ai-msg ai-msg--error";
  const text = document.createElement("p");
  text.className = "ai-msg__text";
  text.textContent = message;
  wrap.appendChild(text);
  els.messages.appendChild(wrap);
  scrollToEnd();
}

function typingNode() {
  const wrap = document.createElement("div");
  wrap.className = "ai-msg ai-msg--assistant ai-typing";
  wrap.innerHTML = '<span></span><span></span><span></span>';
  return wrap;
}

function suggestions() {
  const path = page.path;
  if (path.endsWith("/book.html")) {
    const title = document.querySelector("h1")?.textContent?.trim() ?? "这本书";
    if (bookOnly) {
      return [
        spoilerOn ? "我读到一半，帮我理一下前面的人物关系" : `《${title}》讲了什么？`,
        "这本书好在哪里？",
        "作者还有哪些作品？",
      ];
    }
    return [`《${title}》讲了什么？`, "作者还有哪些作品？", "有没有类似的书？"];
  }
  if (path.endsWith("/author.html")) {
    const name = document.querySelector("h1")?.textContent?.trim() ?? "这位作者";
    return [`介绍一下${name}`, "得过哪些奖？", "站内收录了哪些作品？"];
  }
  if (path.endsWith("/categories.html")) {
    return ["有哪些长篇小说？", "推荐一本 1980 年代的书", "散文随笔都有哪些？"];
  }
  if (path.endsWith("/roam.html")) {
    return ["帮我随机推荐一本", "有哪些适合入门的小说？", "科幻类只有《三体》吗？"];
  }
  return ["站内一共收录了多少本书？", "推荐一本 1990 年代的小说", "余华的书有哪些？"];
}

function renderSuggestions() {
  if (!els.suggest) return;
  els.suggest.replaceChildren();
  for (const text of suggestions()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-suggest__item";
    button.textContent = text;
    button.addEventListener("click", () => ask(text));
    els.suggest.appendChild(button);
  }
}

function setCatalogSubtitle(books, authors) {
  if (!els?.sub) return false;
  const bookCount = Number(books);
  const authorCount = Number(authors);
  if (!Number.isFinite(bookCount) || !Number.isFinite(authorCount) || bookCount <= 0 || authorCount <= 0) {
    return false;
  }
  els.sub.textContent = `${bookCount} 部作品 · ${authorCount} 位作者`;
  return true;
}

/** 兜底：旧版 /api/ai/status 不带 counts 时，直接从数据文件取。 */
async function loadCatalogCounts() {
  try {
    const [booksResponse, authorsResponse] = await Promise.all([
      fetch("data/books.json", { cache: "no-store" }),
      fetch("data/authors.json", { cache: "no-store" }),
    ]);
    if (!booksResponse.ok || !authorsResponse.ok) return false;
    const [booksData, authorsData] = await Promise.all([
      booksResponse.json(),
      authorsResponse.json(),
    ]);
    return setCatalogSubtitle(booksData?.books?.length, authorsData?.authors?.length);
  } catch {
    return false;
  }
}

async function checkStatus() {
  if (statusChecked) return;
  statusChecked = true;
  try {
    const response = await fetch("api/ai/status");
    const data = await response.json();
    if (!setCatalogSubtitle(data?.data?.books, data?.data?.authors)) {
      // 兼容尚未重启的旧服务端：不再依赖 status 中的计数字段。
      await loadCatalogCounts();
    }
    if (data?.data?.configured === false && els.status) {
      els.status.textContent = "AI 尚未配置密钥：在 .env 写入 DEEPSEEK_API_KEY 并重启服务。";
      els.status.hidden = false;
    } else if (data?.data?.available === false && els.status) {
      els.status.textContent = "AI 在非本机访问时默认关闭；如需开启，请设置 AI_ALLOW_REMOTE=1。";
      els.status.hidden = false;
    }
  } catch {
    /* 服务未启动时由提问报错 */
  }
}

/** 书库推荐只需要书目元数据；缓存一次，避免反复请求。 */
function loadBooksForAi() {
  if (!booksPromise) {
    booksPromise = fetch("data/books.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`书目数据加载失败（HTTP ${response.status}）`);
        const data = await response.json();
        if (!Array.isArray(data?.books)) throw new Error("书目数据格式不正确");
        return data;
      })
      .catch((error) => {
        booksPromise = null;
        throw error;
      });
  }
  return booksPromise;
}

function libraryCounts() {
  const entries = Object.values(getLibrary().entries ?? {});
  return {
    read: entries.filter((entry) => entry.status === "read").length,
    wish: entries.filter((entry) => entry.status === "wish").length,
  };
}

/**
 * 书库推荐请求体只包含：书名、标签、状态。
 * 笔记、摘句、开始/读完日期和阅读遍数都不在这里。
 */
async function collectLibraryItems() {
  const lib = getLibrary();
  const entries = Object.entries(lib.entries ?? {})
    .filter(([, entry]) => entry.status === "read" || entry.status === "wish")
    .sort(([idA, a], [idB, b]) => {
      if (a.status !== b.status) return a.status === "read" ? -1 : 1;
      return String(a.addedAt ?? "").localeCompare(String(b.addedAt ?? "")) || idA.localeCompare(idB);
    });
  if (!entries.length) return [];

  const data = await loadBooksForAi();
  const byId = new Map((data.books ?? []).map((book) => [book.id, book]));
  const items = [];
  for (const [id, entry] of entries) {
    if (items.length >= MAX_LIBRARY_ITEMS) break;
    const book = byId.get(id);
    if (!book) continue;
    items.push({
      title: book.title,
      tags: (book.tags ?? []).slice(0, 6),
      status: entry.status,
    });
  }
  return items;
}

function updateLibraryButton() {
  if (!els?.library) return;
  const { read, wish } = libraryCounts();
  const total = read + wish;
  els.library.textContent = total ? `书库推荐 · ${total}` : "书库推荐";
  els.library.title = total
    ? "只发送已读/想读的书名与标签，不发送笔记和日期"
    : "书库还没有已读或想读的书";
  els.library.disabled = busy;
}

function updateHint() {
  if (!els?.hint) return;
  if (isBookPage && bookOnly) {
    els.hint.textContent = spoilerOn
      ? "只就这本书回答；涉及情节时，会停在你说读到的地方。"
      : "只就这本书回答；关闭「只问本书」可以问全站。";
    return;
  }
  if (isBookPage) {
    els.hint.textContent = "可以问这本书，也可以问全站；打开「只问本书」会聚焦当前作品。";
    return;
  }
  const { read, wish } = libraryCounts();
  const total = read + wish;
  els.hint.textContent = total
    ? `可以问书、问作者；书库里的 ${read} 本已读、${wish} 本想读，可用来推荐下一本。`
    : "可以问书、问作者，也可以让它带你去某一页。";
}

async function recommendFromLibrary() {
  if (busy) return;
  let items;
  try {
    items = await collectLibraryItems();
  } catch (error) {
    errorNode(`读取书库失败：${error.message}`);
    return;
  }
  if (!items.length) {
    errorNode("书库还没有已读或想读的书。先在书页或书库页标记几本，再来推荐。");
    return;
  }
  const read = items.filter((item) => item.status === "read").length;
  const wish = items.filter((item) => item.status === "wish").length;
  await ask(`根据我的书库（已读 ${read} 本、想读 ${wish} 本），推荐下一本。`, {
    mode: "library",
    library: items,
  });
}

async function ask(value, options = {}) {
  const text = String(value ?? "").trim();
  if (!text || busy) return;
  if (!els) return;
  const mode = options.mode === "library" ? "library" : "chat";
  const seq = ++requestSeq;
  const controller = new AbortController();
  activeController = controller;

  hideEmpty();
  appendMessage({ role: "user", content: text });
  els.input.value = "";
  els.input.style.height = "auto";

  busy = true;
  els.send.disabled = true;
  if (els.library) els.library.disabled = true;
  const typing = typingNode();
  els.messages.appendChild(typing);
  scrollToEnd();

  const payload = {
    sessionId,
    message: text,
    page,
    mode,
    scope: mode === "library" ? "site" : isBookPage && bookOnly ? "book" : "site",
    spoiler:
      mode === "chat" && isBookPage
        ? { enabled: spoilerOn, progress: els.spoilerProgress?.value.trim() ?? "" }
        : { enabled: false, progress: "" },
  };
  if (mode === "library") payload.library = options.library ?? [];

  try {
    const response = await fetch("api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (seq !== requestSeq) return;
    if (!response.ok) {
      throw new Error(data?.error || `AI 请求失败（${response.status}）`);
    }
    const answer = data?.data?.answer;
    if (!answer) throw new Error("AI 没有返回内容，请换个问法再试。");
    if (data.data.sessionId) {
      sessionId = data.data.sessionId;
      try {
        sessionStorage.setItem(SESSION_KEY, sessionId);
      } catch {
        /* 隐私模式忽略 */
      }
    }
    appendMessage({ role: "assistant", content: answer, links: data.data.links ?? [] });
  } catch (error) {
    if (error?.name === "AbortError" || seq !== requestSeq) return;
    const message =
      error instanceof TypeError
        ? "连不上服务端。请确认用 http://127.0.0.1:3000 打开本站，并且服务正在运行。"
        : error.message || "AI 暂时不可用，请稍后再试。";
    errorNode(message);
  } finally {
    typing.remove();
    if (seq === requestSeq) {
      busy = false;
      activeController = null;
      els.send.disabled = false;
      updateLibraryButton();
      els.input.focus();
      scrollToEnd();
    }
  }
}

function openPanel() {
  els.panel.inert = false;
  els.panel.classList.add("is-open");
  els.panel.setAttribute("aria-hidden", "false");
  els.launch.setAttribute("aria-expanded", "true");
  showEmptyIfNeeded();
  renderSuggestions();
  updateHint();
  updateLibraryButton();
  checkStatus();
  positionPanel();
  requestAnimationFrame(positionPanel);
  window.setTimeout(() => els.input.focus(), 60);
  scrollToEnd();
}

function closePanel() {
  els.panel.classList.remove("is-open");
  els.panel.setAttribute("aria-hidden", "true");
  els.panel.inert = true;
  els.launch.setAttribute("aria-expanded", "false");
  els.launch.focus();
}

function clearChat() {
  requestSeq += 1;
  activeController?.abort();
  activeController = null;
  busy = false;
  if (els.send) els.send.disabled = false;
  history = [];
  sessionId = "";
  saveHistory();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 隐私模式忽略 */
  }
  els.messages.replaceChildren();
  showEmptyIfNeeded();
  renderSuggestions();
  updateHint();
  updateLibraryButton();
  els.input.focus();
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function applyLauncherPosition(left, top) {
  els.launch.style.left = `${left}px`;
  els.launch.style.top = `${top}px`;
  els.launch.style.right = "auto";
  els.launch.style.bottom = "auto";
}

function restoreLauncherPosition() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return;
  const rect = els.launch.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  applyLauncherPosition(
    clamp(saved.left, 8, window.innerWidth - rect.width - 8),
    clamp(saved.top, 8, window.innerHeight - rect.height - 8)
  );
}

function saveLauncherPosition() {
  const rect = els.launch.getBoundingClientRect();
  try {
    localStorage.setItem(
      POS_KEY,
      JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) })
    );
  } catch {
    /* 隐私模式忽略 */
  }
}

function clampLauncherPosition() {
  if (!els.launch.style.left) return;
  const rect = els.launch.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  applyLauncherPosition(
    clamp(rect.left, 8, window.innerWidth - rect.width - 8),
    clamp(rect.top, 8, window.innerHeight - rect.height - 8)
  );
}

/** 面板跟随按钮：优先显示在按钮上方，放不下就放下方；小屏仍用底部抽屉。 */
function positionPanel() {
  if (!els.panel.classList.contains("is-open")) return;
  if (window.innerWidth <= 680) {
    for (const prop of ["left", "top", "right", "bottom"]) els.panel.style[prop] = "";
    return;
  }
  const buttonRect = els.launch.getBoundingClientRect();
  const margin = 8;
  // 用 offset 尺寸而不是 rect：面板打开时有 scale 过渡，rect 会偏小
  const width = els.panel.offsetWidth;
  const height = els.panel.offsetHeight;
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - height - margin;

  const fits = (left, top) => left >= margin && top >= margin && left <= maxLeft && top <= maxTop;
  const candidates = [
    { left: buttonRect.right - width, top: buttonRect.top - height - 10 }, // 上方
    { left: buttonRect.right - width, top: buttonRect.bottom + 10 }, // 下方
    { left: buttonRect.right + 10, top: clamp(buttonRect.top, margin, maxTop) }, // 右侧
    { left: buttonRect.left - width - 10, top: clamp(buttonRect.top, margin, maxTop) }, // 左侧
  ];

  let spot = candidates.find((item) => fits(item.left, item.top));
  if (!spot) {
    // 上下都放不下时优先放到按钮侧边，避免面板把按钮整个盖住
    const right = { left: buttonRect.right + 10, top: clamp(buttonRect.top, margin, maxTop) };
    const left = { left: buttonRect.left - width - 10, top: clamp(buttonRect.top, margin, maxTop) };
    if (right.left <= maxLeft) spot = right;
    else if (left.left >= margin) spot = left;
    else {
      const preferred = buttonRect.top - height - 10 >= margin
        ? { left: buttonRect.right - width, top: buttonRect.top - height - 10 }
        : { left: buttonRect.right - width, top: buttonRect.bottom + 10 };
      spot = {
        left: clamp(preferred.left, margin, maxLeft),
        top: clamp(preferred.top, margin, maxTop),
      };
    }
  }

  els.panel.style.left = `${spot.left}px`;
  els.panel.style.top = `${spot.top}px`;
  els.panel.style.right = "auto";
  els.panel.style.bottom = "auto";
}

function endDrag() {
  dragState = null;
  if (els?.launch) els.launch.classList.remove("is-dragging");
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.removeEventListener("pointercancel", onDragCancel);
  if (dragBlockHandler) {
    document.removeEventListener("dragstart", dragBlockHandler, true);
    dragBlockHandler = null;
  }
}

function blockNativeDrag(event) {
  event.preventDefault();
  event.stopPropagation();
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  if (!dragState.moved && Math.hypot(dx, dy) < 6) return;
  dragState.moved = true;
  const rect = els.launch.getBoundingClientRect();
  const left = clamp(event.clientX - dragState.offsetX, 8, window.innerWidth - rect.width - 8);
  const top = clamp(event.clientY - dragState.offsetY, 8, window.innerHeight - rect.height - 8);
  applyLauncherPosition(left, top);
  if (els.panel.classList.contains("is-open")) positionPanel();
}

function onDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const moved = dragState.moved;
  endDrag();
  if (moved) {
    saveLauncherPosition();
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 400);
  }
}

function onDragCancel() {
  endDrag();
}

function build() {
  // GitHub Pages 只有静态文件，没有 /api/*；不渲染一个点了会报错的 AI 入口。
  if (/\.github\.io$/i.test(location.hostname)) return;

  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "ai-launch";
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "ai-panel");
  launch.innerHTML = '<span class="ai-launch__mark" aria-hidden="true">✦</span><span class="ai-launch__text">问 AI</span>';

  const panel = document.createElement("section");
  panel.className = "ai-panel";
  panel.id = "ai-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "ai-panel-title");
  panel.setAttribute("aria-hidden", "true");
  panel.inert = true;
  panel.innerHTML = `
    <header class="ai-panel__head">
      <div>
        <p class="ai-panel__title" id="ai-panel-title">书旅 · 站内助手</p>
        <p class="ai-panel__sub" id="ai-panel-sub">站内书目</p>
      </div>
      <div class="ai-panel__actions">
        <button type="button" class="ai-icon" data-ai-clear aria-label="清空对话" title="清空对话">清空</button>
        <button type="button" class="ai-icon ai-icon--close" data-ai-close aria-label="关闭">×</button>
      </div>
    </header>
    <div class="ai-tools" aria-label="回答范围">
      <label class="ai-toggle" id="ai-book-only-wrap"${isBookPage ? "" : " hidden"} title="只使用当前作品的资料，不引入全站书目">
        <input type="checkbox" id="ai-book-only"${isBookPage ? " checked" : ""}>
        <span>只问本书</span>
      </label>
      <label class="ai-toggle" id="ai-spoiler-wrap"${isBookPage ? "" : " hidden"} title="涉及情节时只讲到你说读到的地方">
        <input type="checkbox" id="ai-spoiler">
        <span>防剧透</span>
      </label>
      <button type="button" class="ai-library" id="ai-library" title="只发送已读/想读的书名与标签，不发送笔记和日期">书库推荐</button>
    </div>
    <div class="ai-spoiler-field" id="ai-spoiler-field" hidden>
      <label for="ai-spoiler-progress">读到哪一段？</label>
      <input type="text" id="ai-spoiler-progress" maxlength="80" placeholder="例如：第三章 / 第 80 页 / 刚过半">
    </div>
    <div class="ai-panel__body">
      <div class="ai-messages" id="ai-messages" aria-live="polite"></div>
      <div class="ai-empty" id="ai-empty">
        <p class="ai-empty__hint" id="ai-hint">可以问书、问作者，也可以让它带你去某一页。</p>
        <div class="ai-suggest" id="ai-suggest"></div>
        <p class="ai-empty__status" id="ai-status" hidden></p>
      </div>
    </div>
    <form class="ai-form" id="ai-form">
      <textarea id="ai-input" rows="2" maxlength="500" placeholder="问一本书、一位作者，或让它推荐"></textarea>
      <button type="submit" class="ai-send">发送</button>
    </form>
    <p class="ai-note">回答由 AI 依据站内资料生成，可能有误；书库推荐只发送书名与标签，不发送笔记和日期。</p>
  `;

  document.body.append(launch, panel);

  els = {
    launch,
    panel,
    body: panel.querySelector(".ai-panel__body"),
    messages: panel.querySelector("#ai-messages"),
    empty: panel.querySelector("#ai-empty"),
    suggest: panel.querySelector("#ai-suggest"),
    status: panel.querySelector("#ai-status"),
    sub: panel.querySelector("#ai-panel-sub"),
    hint: panel.querySelector("#ai-hint"),
    form: panel.querySelector("#ai-form"),
    input: panel.querySelector("#ai-input"),
    send: panel.querySelector(".ai-send"),
    bookOnlyWrap: panel.querySelector("#ai-book-only-wrap"),
    bookOnly: panel.querySelector("#ai-book-only"),
    spoilerWrap: panel.querySelector("#ai-spoiler-wrap"),
    spoiler: panel.querySelector("#ai-spoiler"),
    spoilerField: panel.querySelector("#ai-spoiler-field"),
    spoilerProgress: panel.querySelector("#ai-spoiler-progress"),
    library: panel.querySelector("#ai-library"),
  };

  els.bookOnly.addEventListener("change", () => {
    bookOnly = els.bookOnly.checked;
    renderSuggestions();
    updateHint();
  });

  els.spoiler.addEventListener("change", () => {
    spoilerOn = els.spoiler.checked;
    els.spoilerField.hidden = !spoilerOn;
    if (spoilerOn) els.spoilerProgress.focus();
    renderSuggestions();
    updateHint();
  });

  els.library.addEventListener("click", recommendFromLibrary);
  window.addEventListener(LIBRARY_EVENT, () => {
    updateLibraryButton();
    updateHint();
  });
  updateLibraryButton();
  updateHint();

  launch.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    if (panel.classList.contains("is-open")) closePanel();
    else openPanel();
  });

  // 悬浮按钮：可拖动，位置记在 localStorage；移动不超过 6px 仍算点击
  launch.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = launch.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    launch.classList.add("is-dragging");
    // 按钮浮在书卡上方，拖动时浏览器可能把底层 <a> 当成拖拽源；先全局拦掉 dragstart
    if (!dragBlockHandler) {
      dragBlockHandler = blockNativeDrag;
      document.addEventListener("dragstart", dragBlockHandler, true);
    }
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
    document.addEventListener("pointercancel", onDragCancel);
  });

  launch.addEventListener("dragstart", (event) => event.preventDefault());

  panel.querySelector("[data-ai-close]").addEventListener("click", closePanel);
  panel.querySelector("[data-ai-clear]").addEventListener("click", clearChat);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(els.input.value);
  });

  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      ask(els.input.value);
    }
  });

  els.input.addEventListener("input", () => {
    els.input.style.height = "auto";
    els.input.style.height = `${Math.min(120, els.input.scrollHeight)}px`;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("is-open")) closePanel();
  });

  window.addEventListener("resize", () => {
    clampLauncherPosition();
    if (panel.classList.contains("is-open")) positionPanel();
  });

  restoreLauncherPosition();

  // 恢复本次会话里之前的对话
  for (const entry of history) {
    els.messages.appendChild(messageNode(entry.role, entry.content, entry.links));
  }
  renderSuggestions();
  showEmptyIfNeeded();
}

/* 纯静态托管（GitHub Pages）下不构建 AI 入口：没有服务端，按钮只会变成死链接。 */
if (!IS_STATIC_HOST) {
  if (document.body) {
    build();
  } else {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  }
}
