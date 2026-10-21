/**
 * 书卡交互：
 * 1. 悬停时按网格间隙计算「不压到相邻书」的最大放大倍数；
 * 2. 点击时把书放大到屏幕中央，再像翻开封面一样转场进入详情页。
 *
 * 放大倍数由列间距实时算出：相邻两本书各占一半空隙，
 * 因此 scale ≤ 1 + 间隙 / 封面宽度（再留 20% 余量）。
 *
 * 转场三段合计约 620ms：翻页应该是一瞬，而不是一场演出；
 * 动画期间再点一次或按 Esc / 空格会立即跳转，不让人干等。
 */
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
// ?turndemo=1 只演示翻书动画、不跳转，便于演示与截图
const TURN_DEMO = new URLSearchParams(window.location.search).has("turndemo");
// 三段动画时长：放大 320ms、翻页 240ms、铺满 60ms
const TURN_ZOOM_MS = 320;
const TURN_FLIP_MS = 240;
const TURN_FILL_MS = 60;

let hovered = null;
let turning = false;
let turnRun = 0;
let pendingHref = ""; // 转场结束后要去的地址；跳过时立即前往
const BOOK_ORIGIN_KEY = "wk_book_origin";
let activeTurn = null;
let resizeFrame = 0;

/** 立即结束当前转场：清遮罩、解锁点击，并按需直接跳转。 */
function bailTurn(navigate = true) {
  turnRun += 1;
  turning = false;
  activeTurn = null;
  document.querySelectorAll(".page-turn").forEach((el) => el.remove());
  document.body.classList.remove("is-page-turn");
  if (navigate && pendingHref && !TURN_DEMO) {
    window.location.href = pendingHref;
  }
  pendingHref = "";
}

function turnLayout(rect) {
  const scale = Math.min(2.2, (window.innerHeight * 0.7) / rect.height, (window.innerWidth * 0.8) / rect.width);
  const dx = window.innerWidth / 2 - (rect.left + (rect.width * scale) / 2);
  const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
  const fillScale = Math.max(window.innerWidth / (rect.width * scale), window.innerHeight / (rect.height * scale));
  const finalScale = scale * fillScale;
  const finalDx = window.innerWidth / 2 - (rect.left + (rect.width * finalScale) / 2);
  return {
    scale,
    rest: `translate(${dx}px, ${dy}px) scale(${scale})`,
    final: `translate(${finalDx}px, ${dy}px) scale(${finalScale})`,
    finalScale,
  };
}

function retargetActiveTurn() {
  if (!activeTurn) return;
  const layout = turnLayout(activeTurn.rect);
  for (const entry of activeTurn.entries) {
    const { animation, element } = entry;
    if (animation.playState !== "running" || !animation.effect?.setKeyframes) continue;
    const elapsed = Number(animation.currentTime) || 0;
    const remaining = Math.max(140, entry.duration - elapsed);
    const from = { transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity };
    try {
      animation.effect.setKeyframes([from, entry.to(layout)]);
      animation.effect.updateTiming({ duration: remaining });
      animation.currentTime = 0;
      entry.duration = remaining;
    } catch {
      // 浏览器不支持动态关键帧时保留当前阶段，让后续页面仍可正常打开。
    }
  }
}

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(retargetActiveTurn);
  if (hovered) applyHover(hovered);
}, { passive: true });

function rememberBookOrigin(link, cover) {
  try {
    const rect = cover.getBoundingClientRect();
    sessionStorage.setItem(BOOK_ORIGIN_KEY, JSON.stringify({
      id: new URL(link.href).searchParams.get("id"),
      href: window.location.href,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    }));
  } catch {
    // 不支持会话存储时仍可使用普通返回动画。
  }
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
  rememberBookOrigin(link, cover);

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
  const title = cover.querySelector(".cover__title")?.textContent ?? "";
  const author = cover.querySelector(".cover__author")?.textContent ?? "";
  page.innerHTML = `<span class="page-turn__title">${escape(title)}</span><span class="page-turn__author">${escape(author)}</span>`;

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

  const layout = turnLayout(rect);
  // 页面与封面都以左侧书脊为缩放轴，按放大后的宽度计算位移，
  // 才能让整本书最终停在视口中央，而不是偏向右侧。
  const rest = layout.rest;
  const easing = "cubic-bezier(0.2, 0.7, 0.2, 1)";

  try {
    // 封面与内页使用同一时长、曲线、起点和书脊缩放轴，放大时严丝合缝。
    const zoomIn = { duration: TURN_ZOOM_MS, easing, fill: "forwards" };
    const zoomCover = clone.animate([{ transform: "none" }, { transform: rest }], zoomIn);
    const zoomPage = page.animate([{ opacity: 0, transform: "none" }, { opacity: 1, transform: rest }], zoomIn);
    activeTurn = {
      rect, stage: "zoom",
      entries: [
        { animation: zoomCover, element: clone, duration: zoomIn.duration, to: (next) => ({ transform: next.rest, opacity: 1 }) },
        { animation: zoomPage, element: page, duration: zoomIn.duration, to: (next) => ({ transform: next.rest, opacity: 1 }) },
      ],
    };
    await Promise.all([
      zoomCover.finished,
      zoomPage.finished,
    ]);

    // 隐去封面背面，避免旋转到背面时标题镜像透出。
    clone.classList.add("is-open");
    // 书封翻过书脊，完整露出带书名与作者的内页。
    const flipRest = turnLayout(rect).rest;
    const flip = clone.animate(
      [{ transform: getComputedStyle(clone).transform, opacity: 1 }, { transform: `${flipRest} rotateY(-168deg)`, opacity: 0.98 }],
      { duration: TURN_FLIP_MS, easing: "cubic-bezier(0.32, 0.06, 0.2, 1)", fill: "forwards" }
    );
    const pageFollow = page.animate(
      [{ transform: getComputedStyle(page).transform }, { transform: flipRest }],
      { duration: TURN_FLIP_MS, easing: "cubic-bezier(0.32, 0.06, 0.2, 1)", fill: "forwards" }
    );
    activeTurn = {
      rect, stage: "flip",
      entries: [
        { animation: flip, element: clone, duration: TURN_FLIP_MS, to: (next) => ({ transform: `${next.rest} rotateY(-168deg)`, opacity: 0.98 }) },
        { animation: pageFollow, element: page, duration: TURN_FLIP_MS, to: (next) => ({ transform: next.rest, opacity: 1 }) },
      ],
    };
    await Promise.all([flip.finished, pageFollow.finished]);
    clone.remove();

    // 内页保持原比例放大到铺满屏幕，作为进入作品详情的衔接画面。
    const fillLayout = turnLayout(rect);
    const fill = page.animate(
      [{ transform: getComputedStyle(page).transform, opacity: 1 }, { transform: fillLayout.final, opacity: 1 }],
      { duration: TURN_FILL_MS, easing, fill: "forwards" }
    );
    activeTurn = {
      rect, stage: "fill",
      entries: [{ animation: fill, element: page, duration: TURN_FILL_MS, to: (next) => ({ transform: next.final, opacity: 1 }) }],
    };
    await fill.finished;

    if (TURN_DEMO) {
      // 让演示参数可重复使用：内页轻轻淡出后清理遮罩并恢复书架。
      await page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished;
      bailTurn(false);
      return;
    }

    try {
      const title = cover.querySelector(".cover__title")?.textContent ?? "";
      const author = cover.querySelector(".cover__author")?.textContent ?? "";
      sessionStorage.setItem(
        "wk_book_arrival",
        JSON.stringify({ id: new URL(link.href).searchParams.get("id"), title, author, scale: turnLayout(rect).finalScale })
      );
    } catch {
      // 隐私模式可能禁用 sessionStorage；此时继续正常打开详情页。
    }
    turning = false;
    activeTurn = null;
    pendingHref = "";
    window.location.href = link.href;
  } catch (error) {
    if (run !== turnRun) {
      // 已被跳过/新一轮接管，此处只负责清理，不重复跳转。
      overlay.remove();
      return;
    }
    activeTurn = null;
    turning = false;
    pendingHref = "";
    // 转场被浏览器中断时仍打开作品，不让链接失去作用。
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
document.addEventListener("keydown", (event) => {
  if (!turning) return;
  if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
    event.preventDefault();
    bailTurn(true);
  }
},
true);

// 从 bfcache 返回时清掉可能残留的转场层
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    turnRun += 1;
    turning = false;
    activeTurn = null;
    pendingHref = "";
    document.querySelectorAll(".page-turn").forEach((el) => el.remove());
    document.body.classList.remove("is-page-turn", "is-returning");
    try {
      const origin = JSON.parse(sessionStorage.getItem(BOOK_ORIGIN_KEY) || "null");
      const currentId = new URLSearchParams(window.location.search).get("id");
      // ui.js consumes this record after the originating page is restored.
      // Keep it while moving between detail pages so the original shelf remains known.
      if (origin && origin.id !== currentId && !origin.returnRect) sessionStorage.removeItem(BOOK_ORIGIN_KEY);
    } catch {}
  }
});
