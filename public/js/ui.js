/** Shared navigation and small interface interactions. */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// 返回转场的细节帧倍率：15 段 → 45 段，时长同步 ×3
const RETURN_DETAIL = 3;
const CLOSE_FRAMES = 15 * RETURN_DETAIL;
const CLOSE_MS = 240 * RETURN_DETAIL;

let closing = false;

function internalReferrer() {
  try {
    return Boolean(document.referrer) && new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

/** 兼容 GitHub Pages 的项目子路径：/repo/ 也视为书架首页。 */
function isHomePath(pathname) {
  return pathname === "/" || pathname.endsWith("/index.html") || pathname.endsWith("/");
}

function navigateBack(fallback) {
  try {
    sessionStorage.setItem("wk_splash", "1");
  } catch {}
  if (history.length > 1 && internalReferrer()) history.back();
  else if (fallback) location.href = fallback;
}

/** 回到书架时：如果浏览器没恢复滚动位置，就回到点开那本书的地方，并让书卡轻轻落定。 */
function revealShelf() {
  const root = document.documentElement;
  if (!root.classList.contains("is-returning")) return;
  root.classList.add("is-return-ready");
  window.setTimeout(() => root.classList.remove("is-returning", "is-return-ready"), 700);
}

/** 单独克隆一枚书影，从视口中央缩回书架卡片；原卡片在动画结束前隐藏。 */
function playShelfReturn(link, coverRect) {
  if (reducedMotion.matches) return false;
  const real = link.querySelector(".cover");
  if (!real) return false;

  const target = real.getBoundingClientRect();
  if (!target.width || !target.height) return false;

  const saved = coverRect && Number(coverRect.width) > 40 && Number(coverRect.height) > 40 ? coverRect : null;
  const startWidth = saved ? Number(saved.width) : Math.min(300, Math.max(140, innerWidth * 0.28));
  const startHeight = saved ? Number(saved.height) : (target.height / target.width) * startWidth;
  const startLeft = saved ? Number(saved.left) : (innerWidth - startWidth) / 2;
  const startTop = saved ? Number(saved.top) : (innerHeight - startHeight) / 2;

  const clone = real.cloneNode(true);
  clone.classList.add("return-book");
  clone.style.left = `${startLeft}px`;
  clone.style.top = `${startTop}px`;
  clone.style.width = `${startWidth}px`;
  clone.style.height = `${startHeight}px`;

  real.style.visibility = "hidden";
  document.body.appendChild(clone);

  const dx = target.left - startLeft;
  const dy = target.top - startTop;
  const scale = target.width / startWidth;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clone.remove();
    real.style.visibility = "";
  };

  try {
    const frames = [];
    for (let index = 0; index <= CLOSE_FRAMES; index += 1) {
      const t = index / CLOSE_FRAMES;
      const eased = t * t * (3 - 2 * t);
      frames.push({
        offset: t,
        transform: `translate3d(${(dx * eased).toFixed(3)}px, ${(dy * eased).toFixed(3)}px, 0) scale(${(
          1 + (scale - 1) * eased
        ).toFixed(5)})`,
        opacity: 1,
      });
    }
    const animation = clone.animate(frames, {
      duration: 560,
      easing: "linear",
      fill: "forwards",
    });
    animation.finished.then(cleanup).catch(cleanup);
  } catch {
    cleanup();
  }
  window.setTimeout(cleanup, 900);
  return true;
}

function restoreReturnTarget(attempt = 0) {
  let raw = "";
  try {
    raw = sessionStorage.getItem("wk_return") || "";
  } catch {
    revealShelf();
    return;
  }
  if (!raw) {
    revealShelf();
    return;
  }

  const isShelf = isHomePath(location.pathname);
  // 在详情页等其它页面不要清掉标记，等回到书架再消费
  if (!isShelf) return;

  let data = null;
  try { data = JSON.parse(raw); } catch {}
  if (!data?.id || (data.at && Date.now() - Number(data.at) > 10 * 60 * 1000)) {
    try { sessionStorage.removeItem("wk_return"); } catch {}
    revealShelf();
    return;
  }

  const link = [...document.querySelectorAll("a.book__link")].find((item) => {
    try {
      return new URL(item.href).searchParams.get("id") === data.id;
    } catch {
      return false;
    }
  });
  // 首页数据是异步渲染的：书卡还没出来就再等一会儿，不要提前把标记丢掉
  if (!link) {
    if (attempt < 30) {
      window.setTimeout(() => restoreReturnTarget(attempt + 1), 100);
    } else {
      try { sessionStorage.removeItem("wk_return"); } catch {}
      revealShelf();
    }
    return;
  }

  try { sessionStorage.removeItem("wk_return"); } catch {}

  const card = link.closest(".book");
  const savedY = Number(data.scrollY);
  if (Number.isFinite(savedY) && savedY > 40) {
    window.scrollTo({ top: savedY, behavior: "instant" });
  }

  // 筛选状态恢复失败/布局高度变化时，旧 scrollY 会落到无关位置。
  // 只要目标卡不在视口内，就把它滚到页头下方，避免“返回后找不到刚才那本”。
  if (card) {
    const rect = card.getBoundingClientRect();
    if (rect.top < 12 || rect.top > innerHeight - 96) {
      const header = document.querySelector(".site-header")?.offsetHeight ?? 0;
      window.scrollTo({
        top: Math.max(0, window.scrollY + rect.top - header - 18),
        behavior: "instant",
      });
    }
  }

  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "auto";
  } catch {}
  if (card) playShelfReturn(link, data.coverRect);
  // 等滚动位置与书影动画先落一帧，再开始淡出遮罩，避免第一帧还在排版
  requestAnimationFrame(() => requestAnimationFrame(revealShelf));
}

/** 在书页返回前，把大书影的当前位置留给首页，用来做“直接缩回书架”的起点。 */
function saveBookCoverForReturn() {
  try {
    const cover = document.querySelector(".detail__cover .cover");
    if (!cover) return;
    const rect = cover.getBoundingClientRect();
    let data = {};
    try {
      data = JSON.parse(sessionStorage.getItem("wk_return") || "{}") ?? {};
    } catch {}
    data.id = data.id || new URLSearchParams(location.search).get("id");
    data.scrollY = Number.isFinite(Number(data.scrollY)) ? Number(data.scrollY) : 0;
    data.coverRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    data.at = Date.now();
    sessionStorage.setItem("wk_return", JSON.stringify(data));
  } catch {
    /* 无存储时退回普通返回 */
  }
}

/**
 * 返回转场：内容淡出、纸色遮罩合上。
 * 不对整页做缩放，避免 300 张书卡一起重绘造成掉帧。
 */
function playClose(fallback) {
  // 作品详情页返回：不要播放“合上书”的几帧，直接回书架，
  // 由首页把详情页的大书影缩回卡片。
  if (document.getElementById("book") && document.querySelector(".detail__cover .cover")) {
    saveBookCoverForReturn();
    navigateBack(fallback);
    return;
  }

  if (reducedMotion.matches || typeof document.body.animate !== "function") {
    navigateBack(fallback);
    return;
  }

  document.documentElement.classList.add("is-closing");

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    navigateBack(fallback);
  };

  const target = document.querySelector(".detail") || document.querySelector("main") || document.body;
  try {
    // 用平滑的 45 个关键帧代替原来的 2 帧，让纸面合上的过程更细
    const frames = [];
    for (let index = 0; index <= CLOSE_FRAMES; index += 1) {
      const t = index / CLOSE_FRAMES;
      const eased = t * t * (3 - 2 * t);
      frames.push({
        offset: t,
        opacity: 1 - 0.65 * eased,
        transform: `translateY(${(-10 * eased).toFixed(3)}px)`,
      });
    }
    const animation = target.animate(frames, {
      duration: CLOSE_MS,
      easing: "linear",
      fill: "forwards",
    });
    animation.finished.then(done).catch(done);
  } catch {
    done();
    return;
  }

  // 兜底：动画被中断时也能返回
  window.setTimeout(done, CLOSE_MS + 180);
}

document.querySelectorAll("[data-back]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    if (closing) return;
    closing = true;
    playClose(el.href);
  });
});

// 浏览器自带返回键不会经过上面的 click：离开书页时也记下大书影位置，
// 这样 bfcache / 浏览器返回也能从正确位置缩回卡片。
window.addEventListener("pagehide", () => {
  if (document.getElementById("book")) saveBookCoverForReturn();
});

window.addEventListener("pageshow", () => {
  closing = false;
  document.documentElement.classList.remove("is-closing");
  document.querySelectorAll(".page-turn").forEach((el) => el.remove());
  document.body.classList.remove("is-returning", "is-page-turn");
  window.setTimeout(restoreReturnTarget, 60);
});

// Mark the current section in the primary navigation.
const sectionForPath = (pathname) => {
  if (isHomePath(pathname) || pathname.endsWith("/book.html")) return "books";
  if (pathname.endsWith("/categories.html")) return "categories";
  if (pathname.endsWith("/reading-lists.html") || pathname.endsWith("/reading-list.html")) return "reading-lists";
  if (pathname.endsWith("/roam.html")) return "roam";
  if (pathname.endsWith("/authors.html") || pathname.endsWith("/author.html")) return "authors";
  if (pathname.endsWith("/library.html")) return "library";
  return null;
};

const isHome = () => sectionForPath(window.location.pathname) === "books";

/** 页头 + 工具栏的实际高度：跳转到锚点时用，避免标题被遮住。 */
function anchorOffset() {
  return (
    (document.querySelector(".site-header")?.offsetHeight ?? 0) +
    (document.querySelector(".toolbar")?.offsetHeight ?? 0) +
    18
  );
}

function updateNav() {
  const showAbout = isHome() && window.location.hash === "#about";
  for (const link of document.querySelectorAll(".site-nav a")) {
    const target = new URL(link.href, window.location.href);
    const isAboutLink = target.hash === "#about";
    const active = showAbout ? isAboutLink : !isAboutLink && sectionForPath(target.pathname) === sectionForPath(window.location.pathname);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

updateNav();
window.addEventListener("hashchange", updateNav);

// 在首页点「关于」时直接滚动过去，不再重新加载页面，也不会先停在书架。
for (const link of document.querySelectorAll('.site-nav a[href*="#"]')) {
  link.addEventListener("click", (event) => {
    if (!isHome() || !link.hash) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.querySelector(link.hash);
    if (!target) return;
    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - anchorOffset();
    window.scrollTo({ top, behavior: reducedMotion.matches ? "auto" : "smooth" });
    history.replaceState(null, "", link.hash);
    updateNav();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
  const input = document.querySelector(".head-search input");
  // 小屏下搜索框隐藏时不去抢焦点，避免「按了没反应」的错觉。
  if (!input || input.offsetParent === null) return;
  event.preventDefault();
  input.focus();
  input.select?.();
});

/** 小屏页头搜索：桌面继续用原搜索框；≤900px 用一个按钮展开搜索条。 */
function setupMobileSearch() {
  const right = document.querySelector(".site-header__right");
  const nav = right?.querySelector(".site-nav");
  const header = document.querySelector(".site-header");
  if (!right || !nav || !header || right.querySelector(".mobile-search-btn")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-search-btn";
  button.setAttribute("aria-label", "搜索书目");
  button.setAttribute("aria-controls", "mobile-search-panel");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "搜";

  const panel = document.createElement("div");
  panel.className = "mobile-search-panel";
  panel.id = "mobile-search-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <form role="search" action="index.html" method="get">
      <input type="search" name="q" placeholder="搜索书名 / 作者" aria-label="搜索书目" autocomplete="off">
      <button type="submit">搜索</button>
    </form>
  `;

  right.insertBefore(button, nav);
  header.appendChild(panel);
  const input = panel.querySelector("input");

  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!panel.hidden) {
      close();
      button.focus();
      return;
    }
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    input?.focus();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      close();
      button.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 900) close();
  });
}

setupMobileSearch();

/** 页脚补一个「关于本站」入口，保证小屏横向导航滚不到「关于」时也能找到。 */
function setupFooterAbout() {
  const footer = document.querySelector(".site-footer__in");
  if (!footer || footer.querySelector('a[href$="#about"]')) return;
  const link = document.createElement("a");
  link.href = "index.html#about";
  link.textContent = "关于本站";
  footer.appendChild(link);
}

setupFooterAbout();
