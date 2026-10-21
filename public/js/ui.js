/** Shared navigation and small interface interactions. */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const originKey = "wk_book_origin";
let returning = false;
let returnObserver = null;
let returnTimer = 0;

function internalReferrer() {
  try { return Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; }
  catch { return false; }
}

function navigateBack(fallback) {
  try { sessionStorage.setItem("wk_splash", "1"); } catch {}
  if (history.length > 1 && internalReferrer()) history.back();
  else if (fallback) location.href = fallback;
}

function readOrigin() {
  try { return JSON.parse(sessionStorage.getItem(originKey) || "null"); }
  catch { return null; }
}

function routeKey(value) {
  const url = new URL(value, location.href);
  return `${url.pathname}${url.search}${url.hash}`;
}

function animateBookReturn(fallback) {
  const origin = readOrigin();
  const currentId = new URLSearchParams(location.search).get("id");
  const sourceCover = document.querySelector(".detail__cover .cover");
  let safeOriginHref = "";
  try {
    const candidate = new URL(origin?.href || "", location.href);
    if (candidate.origin === location.origin) safeOriginHref = candidate.href;
  } catch {}
  if (origin?.id !== currentId || !safeOriginHref || !sourceCover) return false;

  const rect = sourceCover.getBoundingClientRect();
  origin.returnRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  origin.returnViewport = { width: innerWidth, height: innerHeight };
  try { sessionStorage.setItem(originKey, JSON.stringify(origin)); } catch {}
  navigateBack(safeOriginHref || fallback);
  return true;
}

function findOriginCard(origin) {
  return [...document.querySelectorAll("a.book__link")].find((link) => {
    try { return new URL(link.href, location.href).searchParams.get("id") === origin.id; }
    catch { return false; }
  });
}

function finishReturn(observer, target) {
  observer?.disconnect();
  clearTimeout(returnTimer);
  returnObserver = null;
  if (target) target.style.visibility = target.dataset.returnVisibility || "";
  document.querySelectorAll(".page-return").forEach((node) => node.remove());
  try { sessionStorage.removeItem(originKey); } catch {}
}

function playReturn(origin, targetLink) {
  const target = targetLink?.querySelector(".cover");
  const saved = origin.returnRect;
  const viewport = origin.returnViewport;
  if (!target || !saved?.width || !saved?.height || !viewport?.width || !viewport?.height) return false;
  const from = {
    left: (saved.left / viewport.width) * innerWidth,
    top: (saved.top / viewport.height) * innerHeight,
    width: (saved.width / viewport.width) * innerWidth,
    height: (saved.height / viewport.height) * innerHeight,
  };
  const to = target.getBoundingClientRect();
  if (!to.width || !to.height) return false;

  const overlay = document.createElement("div");
  overlay.className = "page-return";
  const cover = target.cloneNode(true);
  cover.classList.add("page-turn__book", "page-return__cover");
  Object.assign(cover.style, {
    left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
  });
  overlay.appendChild(cover);
  document.body.appendChild(overlay);
  target.dataset.returnVisibility = target.style.visibility;
  target.style.visibility = "hidden";

  const dx = to.left - from.left;
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;
  const animation = cover.animate([
    { transform: "translate(0, 0) scale(1) rotateY(0deg)", filter: "brightness(1.06)", offset: 0 },
    { transform: `translate(${dx * 0.42}px, ${dy * 0.42}px) scale(${1 + (scale - 1) * 0.42}) rotateY(-5deg)`, filter: "brightness(1.02)", offset: 0.42 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotateY(0deg)`, filter: "brightness(1)", offset: 1 },
  ], { duration: reducedMotion.matches ? 1 : 720, easing: "cubic-bezier(0.2, 0.78, 0.18, 1)", fill: "forwards" });
  animation.finished.then(() => finishReturn(null, target)).catch(() => finishReturn(null, target));
  return true;
}

function resumeBookReturn() {
  if (returnObserver) return;
  const origin = readOrigin();
  if (!origin?.returnRect || !origin?.href) return;
  let onSource = false;
  try { onSource = routeKey(location.href) === routeKey(origin.href); } catch {}
  if (!onSource) {
    // Preserve the origin while paging between detail pages; clear it once another route is reached.
    const currentId = new URLSearchParams(location.search).get("id");
    if (currentId !== origin.id) {
      try { sessionStorage.removeItem(originKey); } catch {}
    }
    return;
  }

  const attempt = () => {
    const link = findOriginCard(origin);
    if (link && playReturn(origin, link)) {
      returnObserver?.disconnect();
      clearTimeout(returnTimer);
      returnObserver = null;
      return true;
    }
    return false;
  };
  if (attempt()) return;
  returnObserver = new MutationObserver(() => attempt());
  returnObserver.observe(document.body, { childList: true, subtree: true });
  returnTimer = window.setTimeout(() => finishReturn(returnObserver, null), 2600);
}

document.querySelectorAll("[data-back]").forEach((el) => {
  el.addEventListener("click", (event) => {
    if (returning) { event.preventDefault(); return; }
    const fallback = el.href;
    const isBookDetail = location.pathname.endsWith("/book.html") || location.pathname === "/book.html";
    if (isBookDetail) {
      event.preventDefault();
      if (animateBookReturn(fallback)) {
        returning = true;
        return;
      }
      navigateBack(fallback);
      return;
    }
    if (reducedMotion.matches || typeof document.body.animate !== "function") return;
    event.preventDefault();
    returning = true;
    document.body.animate(
      [{ opacity: 1 }, { opacity: 0.45 }],
      { duration: 220, easing: "ease-out", fill: "forwards" }
    ).finished.then(() => navigateBack(fallback)).catch(() => navigateBack(fallback));
  });
});

window.addEventListener("pageshow", () => {
  document.querySelectorAll(".page-return").forEach((el) => el.remove());
  document.body.classList.remove("is-returning", "is-page-turn");
  returning = false;
  resumeBookReturn();
});

// Mark the current section in the primary navigation.
const sectionForPath = (pathname) => {
  if (pathname === "/" || pathname.endsWith("/index.html") || pathname.endsWith("/book.html")) return "books";
  if (pathname.endsWith("/categories.html")) return "categories";
  if (pathname.endsWith("/roam.html")) return "roam";
  if (pathname.endsWith("/authors.html") || pathname.endsWith("/author.html")) return "authors";
  return null;
};
const currentSection = sectionForPath(window.location.pathname);
for (const link of document.querySelectorAll(".site-nav a")) {
  const target = new URL(link.href, window.location.href);
  const targetSection = target.hash === "#about" ? "about" : sectionForPath(target.pathname);
  if (targetSection && targetSection === currentSection) link.setAttribute("aria-current", "page");
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
  const input = document.querySelector(".head-search input");
  if (!input) return;
  event.preventDefault();
  input.focus();
  input.select?.();
});
