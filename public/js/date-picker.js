/**
 * 站内日期选择器：替代浏览器原生 date picker。
 *
 * 用法：
 *   import { initDatePicker, dateField } from "./date-picker.js";
 *   initDatePicker();
 *   dateField("2026-10-22", "data-start")
 *
 * 生成 <button data-date-field data-value="...">，点击后弹出纸色日历。
 * 选择后按钮的 data-value 更新，并派发 date-change 事件。
 */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABEL = (year, month) => `${year}年${month + 1}月`;

let popover = null;
let activeField = null;
let viewYear = 0;
let viewMonth = 0;
let selected = "";
let positionBound = false;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseISO(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function displayDate(value) {
  const date = parseISO(value);
  return date ? `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}` : "";
}

/** 生成一个日期按钮；attrs 例如 `data-start`，用于业务代码读取。 */
export function dateField(value = "", attrs = "", placeholder = "年 / 月 / 日") {
  const iso = parseISO(value) ? value : "";
  const text = iso ? displayDate(iso) : placeholder;
  return `<button class="date-field${iso ? " has-value" : ""}" type="button" data-date-field ${attrs} data-value="${iso}" aria-haspopup="dialog" aria-expanded="false">${text}</button>`;
}

function buildPopover() {
  if (popover) return popover;
  popover = document.createElement("div");
  popover.className = "datepicker";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-labelledby", "datepicker-title");
  popover.hidden = true;
  document.body.appendChild(popover);

  popover.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const step = Number(nav.dataset.nav);
      const date = new Date(viewYear, viewMonth + step, 1);
      viewYear = date.getFullYear();
      viewMonth = date.getMonth();
      render();
      return;
    }
    if (event.target.closest("[data-today]")) {
      choose(todayISO());
      return;
    }
    if (event.target.closest("[data-clear]")) {
      choose("");
      return;
    }
    const day = event.target.closest("[data-date]");
    if (day) choose(day.dataset.date);
  });

  return popover;
}

function render() {
  if (!popover) return;
  const first = new Date(viewYear, viewMonth, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(viewYear, viewMonth, 1 - offset);
  const today = todayISO();
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const outside = date.getMonth() !== viewMonth;
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const weekday = WEEKDAY_NAMES[date.getDay()];
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，星期${weekday}`;
    const future = iso > today;
    cells.push(`
      <button type="button"
        class="datepicker__day${outside ? " is-outside" : ""}${weekend ? " is-weekend" : ""}${iso === today ? " is-today" : ""}${iso === selected ? " is-selected" : ""}"
        data-date="${iso}"
        aria-label="${label}"
        ${iso === selected ? 'aria-current="date"' : ""}
        ${future ? "disabled" : ""}
        tabindex="${!future && (iso === selected || (!selected && iso === today)) ? "0" : "-1"}"
      >${date.getDate()}</button>`);
  }

  popover.innerHTML = `
    <div class="datepicker__head">
      <button type="button" class="datepicker__nav" data-nav="-12" aria-label="上一年">«</button>
      <button type="button" class="datepicker__nav" data-nav="-1" aria-label="上个月">‹</button>
      <strong class="datepicker__title" id="datepicker-title">${MONTH_LABEL(viewYear, viewMonth)}</strong>
      <button type="button" class="datepicker__nav" data-nav="1" aria-label="下个月">›</button>
      <button type="button" class="datepicker__nav" data-nav="12" aria-label="下一年">»</button>
    </div>
    <div class="datepicker__week" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="datepicker__grid">${cells.join("")}</div>
    <div class="datepicker__foot">
      <button type="button" class="datepicker__link" data-today>今天</button>
      <button type="button" class="datepicker__link datepicker__link--quiet" data-clear>清除</button>
    </div>
  `;
}

function position() {
  if (!popover || !activeField || popover.hidden) return;
  const rect = activeField.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const margin = 10;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, innerWidth - width - margin));
  let top = rect.bottom + 8;
  if (top + height > innerHeight - margin) top = rect.top - height - 8;
  top = Math.max(margin, Math.min(top, innerHeight - height - margin));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function open(field) {
  buildPopover();
  activeField = field;
  selected = field.dataset.value || "";
  const base = parseISO(selected) || new Date();
  viewYear = base.getFullYear();
  viewMonth = base.getMonth();
  render();
  popover.hidden = false;
  field.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    position();
    popover.classList.add("is-open");
    const focusTarget =
      popover.querySelector(".is-selected:not(:disabled)") ||
      popover.querySelector(".is-today:not(:disabled)") ||
      popover.querySelector(".datepicker__day:not(:disabled)");
    focusTarget?.focus({ preventScroll: true });
  });
  if (!positionBound) {
    document.addEventListener("scroll", () => {
      if (activeField && popover && !popover.hidden) position();
    }, true);
    window.addEventListener("resize", () => {
      if (activeField && popover && !popover.hidden) position();
    }, { passive: true });
    positionBound = true;
  }
}

function choose(value) {
  if (!activeField) return;
  const field = activeField;
  const iso = parseISO(value) ? value : "";
  field.dataset.value = iso;
  field.textContent = iso ? displayDate(iso) : "年 / 月 / 日";
  field.classList.toggle("has-value", Boolean(iso));
  field.dispatchEvent(new CustomEvent("date-change", { bubbles: true, detail: { value: iso } }));
  close(false);
  // 业务层通常会同步重绘日期字段；等重绘完再把焦点还给同一逻辑字段。
  requestAnimationFrame(() => focusEquivalentField(field));
}

/** 重绘后找到同一本书、同一种日期字段的按钮，恢复键盘焦点。 */
function focusEquivalentField(field) {
  if (!field) return;
  if (field.isConnected) {
    field.focus({ preventScroll: true });
    return;
  }
  const attrs = [...field.attributes].filter(
    (attr) => attr.name.startsWith("data-") && attr.name !== "data-value"
  );
  const parentId = field.closest("li")?.dataset.id ?? "";
  const candidates = [...document.querySelectorAll("[data-date-field]")];
  const match = candidates.find((candidate) => {
    if (attrs.some((attr) => candidate.getAttribute(attr.name) !== attr.value)) return false;
    return !parentId || candidate.closest("li")?.dataset.id === parentId;
  });
  (match ?? candidates.find((candidate) => attrs.every((attr) => candidate.getAttribute(attr.name) === attr.value)))?.focus({
    preventScroll: true,
  });
}

export function close(restoreFocus = false) {
  if (!popover || popover.hidden) return;
  const field = activeField;
  popover.hidden = true;
  popover.classList.remove("is-open");
  if (field) {
    field.setAttribute("aria-expanded", "false");
    if (restoreFocus) field.focus({ preventScroll: true });
  }
  activeField = null;
}

export function initDatePicker() {
  if (initDatePicker.started) return;
  initDatePicker.started = true;
  buildPopover();

  document.addEventListener("click", (event) => {
    const field = event.target.closest("[data-date-field]");
    if (field) {
      event.preventDefault();
      if (activeField === field) close(false);
      else open(field);
      return;
    }
    if (popover && !popover.hidden && !event.composedPath().includes(popover)) close(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && popover && !popover.hidden) {
      event.preventDefault();
      close(true);
    }
    if (!popover || popover.hidden) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const buttons = [...popover.querySelectorAll("[data-date]:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : 7;
    const next = buttons[index + step];
    if (next) {
      for (const button of buttons) button.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  });
}

window.addEventListener("pageshow", () => close(false));
