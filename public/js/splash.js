/**
 * 开屏题词：淡入、停留、淡出，共 5 秒后进入网站。
 *
 * - 每个标签页会话只出现一次（sessionStorage）；想立刻再看，加 ?splash=1；不想看，加 ?splash=0。
 * - 点击「跳过」或按 Esc 可提前进入。
 * - 即使脚本失效，CSS 动画也会在 5 秒后自动淡出，不会把页面永久挡住。
 */
const SPLASH_MS = 5000;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const splash = document.getElementById("splash");
const skipped = document.documentElement.classList.contains("splash-skip");

if (splash && !skipped) {
  if (reducedMotion.matches) {
    // 减少动态效果时不要先隐藏开屏、却继续用 5 秒锁住滚动。
    splash.remove();
    document.body.classList.remove("splash-open");
    try {
      sessionStorage.setItem("wk_splash", "1");
    } catch {
      /* 隐私模式忽略 */
    }
  } else {
    document.body.classList.add("splash-open");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      splash.classList.add("is-hidden");
      document.body.classList.remove("splash-open");
      try {
        sessionStorage.setItem("wk_splash", "1");
      } catch (error) {
        /* 隐私模式下 sessionStorage 可能不可用，忽略即可 */
      }
    };

    const timer = window.setTimeout(finish, SPLASH_MS);

    splash.querySelector(".splash__skip")?.addEventListener("click", () => {
      window.clearTimeout(timer);
      finish();
    });

    // 点题词任意位置也可跳过，避免只想快点进站时找不到按钮
    splash.addEventListener("click", () => {
      window.clearTimeout(timer);
      finish();
    });

    const onKey = (event) => {
      if (event.key === "Escape") {
        window.clearTimeout(timer);
        finish();
      }
    };
    document.addEventListener("keydown", onKey);

    // 题词结束后清掉全局监听，不留隐患。
    const cleanup = () => document.removeEventListener("keydown", onKey);
    splash.addEventListener("transitionend", cleanup, { once: true });
    window.setTimeout(cleanup, SPLASH_MS + 1000);
  }
}
