/**
 * 书卡交互：
 * 1. 悬停时按网格间隙算出「不压到相邻书」的最大放大倍数；
 * 2. 点击时把书放大到屏幕中央，再像翻开封面一样进入详情页。
 *
 * 性能约定：所有位移/缩放/旋转只用 transform 与 opacity，
 * 每个阶段只给 2 个关键帧、靠缓动曲线过渡，交给合成器插值；
 * 不再逐帧生成几十个关键帧，避免主线程为每一帧重新计算样式。
 */
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
// ?turndemo=1 只演示翻书动画、不跳转，便于演示与截图
const TURN_DEMO = new URLSearchParams(window.location.search).has("turndemo");
const TURN_ZOOM_MS = 500;
const TURN_FLIP_MS = 440;
const EASE_OUT = "cubic-bezier(0.22, 0.72, 0.18, 1)";
const EASE_FLIP = "cubic-bezier(0.45, 0.05, 0.55, 0.95)";

const BOOK_ARRIVAL_KEY = "wk_book_arrival";

let hovered = null;
let turning = false;
let turnRun = 0;
let pendingHref = "";

/** 立即结束当前转场：清遮罩、解锁点击，并按需直接跳转。 */
function bailTurn(navigate = true) {
  turnRun += 1;
  turning = false;
  document.querySelectorAll(".page-turn").forEach((el) => el.remove());
  document.body.classList.remove("is-page-turn");
  if (navigate && pendingHref && !TURN_DEMO) window.location.href = pendingHref;
  pendingHref = "";
}

function turnLayout(rect) {
  const scale = Math.min(2.2, (innerHeight * 0.7) / rect.height, (innerWidth * 0.8) / rect.width);
  const dx = innerWidth / 2 - (rect.left + (rect.width * scale) / 2);
  const dy = innerHeight / 2 - (rect.top + rect.height / 2);
  return {
    rest: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`,
    scale,
  };
}

function applyHover(link) {
  const cover = link.querySelector(".cover");
  if (!cover) return;

  const shelf = link.closest(".shelf") || link.parentElement;
  if (!shelf) return;

  const gap = parseFloat(getComputedStyle(shelf).columnGap) || 16;
  const rect = cover.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  // 相邻两本书各占一半间隙：放大后每侧最多伸进 gap/2，留 5% 余量
  const scale = Math.min(1.18, 1 + (gap * 0.95) / rect.width);
  const lift = ((scale - 1) * rect.height) / 2 + 6;

  link.style.setProperty("--hover-scale", scale.toFixed(4));
  link.style.setProperty("--lift", `${lift.toFixed(1)}px`);
}

document.addEventListener(
  "pointerover",
  (event) => {
    const link = event.target.closest?.(".book__link");
    if (!link || link === hovered) return;
    hovered = link;
    applyHover(link);
  },
  true
);

document.addEventListener("focusin", (event) => {
  const link = event.target.closest?.(".book__link");
  if (link) applyHover(link);
});

async function startTurn(link) {
  const cover = link.querySelector(".cover");
  if (!cover) return;

  const rect = cover.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  turning = true;
  pendingHref = link.href;
  const run = ++turnRun;

  try {
    sessionStorage.setItem(
      "wk_return",
      JSON.stringify({
        id: new URL(link.href).searchParams.get("id"),
        scrollY: window.scrollY,
        at: Date.now(),
      })
    );
  } catch {
    /* 隐私模式可能禁用 sessionStorage */
  }

  const overlay = document.createElement("div");
  overlay.className = "page-turn";

  const page = document.createElement("div");
  page.className = "page-turn__page";
  page.style.left = `${rect.left}px`;
  page.style.top = `${rect.top}px`;
  page.style.width = `${rect.width}px`;
  page.style.height = `${rect.height}px`;

  const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  page.innerHTML = `<span class="page-turn__title">${escape(
    cover.querySelector(".cover__title")?.textContent ?? ""
  )}</span><span class="page-turn__author">${escape(
    cover.querySelector(".cover__author")?.textContent ?? ""
  )}</span>`;

  const clone = cover.cloneNode(true);
  clone.classList.add("page-turn__book");
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  overlay.append(page, clone);
  document.body.appendChild(overlay);
  document.body.classList.add("is-page-turn");
  overlay.classList.add("is-active");
  // 先把这一层布局/栅格化落定，动画第一帧就不会卡在首次绘制上
  void overlay.offsetWidth;

  const layout = turnLayout(rect);
  const timing = (duration, easing) => ({ duration, easing, fill: "forwards" });

  try {
    // 阶段一：封面与内页一起放大到屏幕中央
    const zoomCover = clone.animate(
      [{ transform: "translate3d(0,0,0) scale(1)", opacity: 1 }, { transform: layout.rest, opacity: 1 }],
      timing(TURN_ZOOM_MS, EASE_OUT)
    );
    const zoomPage = page.animate(
      [{ transform: "translate3d(0,0,0) scale(1)", opacity: 0 }, { transform: layout.rest, opacity: 1 }],
      timing(TURN_ZOOM_MS, EASE_OUT)
    );
    await Promise.all([zoomCover.finished, zoomPage.finished]);

    // 阶段二：封面绕左侧书脊翻开，露出内页
    clone.classList.add("is-open");
    const flip = clone.animate(
      [
        { transform: layout.rest },
        { transform: `${layout.rest} perspective(1600px) rotateY(-168deg)` },
      ],
      timing(TURN_FLIP_MS, EASE_FLIP)
    );
    await flip.finished;
    clone.remove();

    // 翻开的内页稍作停留，然后进入详情页；详情页的纸纹层负责衔接。
    await new Promise((resolve) => setTimeout(resolve, 140));

    if (TURN_DEMO) {
      await page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" }).finished;
      bailTurn(false);
      return;
    }

    try {
      sessionStorage.setItem(
        BOOK_ARRIVAL_KEY,
        JSON.stringify({
          id: new URL(link.href).searchParams.get("id"),
          title: cover.querySelector(".cover__title")?.textContent ?? "",
          author: cover.querySelector(".cover__author")?.textContent ?? "",
          scale: layout.scale,
        })
      );
    } catch {
      /* 隐私模式可能禁用 sessionStorage */
    }

    turning = false;
    pendingHref = "";
    window.location.href = link.href;
  } catch {
    if (run !== turnRun) {
      overlay.remove();
      return;
    }
    turning = false;
    pendingHref = "";
    if (!TURN_DEMO) window.location.href = link.href;
    else {
      overlay.remove();
      document.body.classList.remove("is-page-turn");
    }
  }
}

document.addEventListener(
  "click",
  (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (prefersReduced.matches) return;

    // 转场进行中：任意一次普通点击都视为「跳过」，立即前往目标页。
    if (turning) {
      event.preventDefault();
      event.stopPropagation();
      bailTurn(true);
      return;
    }

    const link = event.target.closest?.("a.book__link");
    if (!link) return;

    event.preventDefault();
    startTurn(link);
  },
  true
);

// 键盘同样可以跳过：Esc / 空格 / Enter 立即结束转场。
document.addEventListener(
  "keydown",
  (event) => {
    if (!turning) return;
    if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
      event.preventDefault();
      bailTurn(true);
    }
  },
  true
);

// 动画途中改变窗口尺寸会让位移计算失准，直接结束转场并打开作品。
window.addEventListener(
  "resize",
  () => {
    if (turning) bailTurn(true);
  },
  { passive: true }
);

// 从 bfcache 返回时清掉可能残留的转场层
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  turnRun += 1;
  turning = false;
  pendingHref = "";
  document.querySelectorAll(".page-turn").forEach((el) => el.remove());
  document.body.classList.remove("is-page-turn", "is-returning");
});
