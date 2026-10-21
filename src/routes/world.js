/**
 * 世界时间接口（三级页面的第二、三级数据源）。
 *
 *   GET /api/world/cities              各城市当前当地时间、时差、昼夜状态
 *   GET /api/world/sun?city=&date=     某城市某日的日出日落、昼长、太阳轨迹
 *
 * 所有时刻都以 Unix 毫秒时间戳返回，前端再自行渲染；服务器只负责
 * "时区数据库 + 天文计算"这两件浏览器不方便做对的事。
 */
import { Router } from 'express';

import { CITIES, findCity } from '../cities.js';
import { solarPosition, sunEventsUtc } from '../sun.js';

const router = Router();

const BEIJING_TZ = 'Asia/Shanghai';
/** 北京固定 UTC+8，不实行夏令时，用作"快/慢几小时"的基准。 */
const BEIJING_OFFSET_MINUTES = 480;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/* ---------------- 时区工具 ---------------- */

const formatterCache = new Map();

function formatterFor(timeZone) {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** 把一个时刻拆成指定时区的年月日时分秒。 */
function partsIn(timeZone, date) {
  const raw = formatterFor(timeZone).formatToParts(date);
  const out = {};
  for (const p of raw) if (p.type !== 'literal') out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

/** 某时刻在该时区相对 UTC 的偏移（分钟，东为正）。 */
function tzOffsetMinutes(timeZone, date) {
  const p = partsIn(timeZone, date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSecond = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - wholeSecond) / 60000);
}

/** 把 "YYYY-MM-DD HH:mm" 这个挂钟时间（某个时区的墙上时间）换算成 UTC 时刻。 */
function wallTimeToUtc(timeZone, year, month, day, hour, minute = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  // 用"先猜 UTC、再看它在该时区显示成什么"的方式迭代两三次即可收敛
  for (let i = 0; i < 3; i += 1) {
    const p = partsIn(timeZone, new Date(guess));
    const diff = target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (p) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
const timeStr = (p) => `${pad(p.hour)}:${pad(p.minute)}`;
const weekdayOf = (y, m, d) => WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

/** 偏移分钟 → "UTC+08:00" 这种写法。 */
function offsetLabel(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* ---------------- 城市描述 ---------------- */

/** 汇总一个城市"此刻"的信息：当地时间、时差、太阳高度等。 */
function describeCity(city, now) {
  const p = partsIn(city.timezone, now);
  const offsetMinutes = tzOffsetMinutes(city.timezone, now);
  const { altitude, azimuth } = solarPosition(now, city.lat, city.lon);

  return {
    id: city.id,
    name: city.name,
    nameEn: city.nameEn,
    region: city.region,
    timezone: city.timezone,
    lat: city.lat,
    lon: city.lon,
    utcOffsetMinutes: offsetMinutes,
    utcOffset: offsetLabel(offsetMinutes),
    // 与北京的时差：正数表示比北京早（更靠东）
    vsBeijingMinutes: offsetMinutes - BEIJING_OFFSET_MINUTES,
    localDate: dateStr(p),
    localTime: timeStr(p),
    weekday: weekdayOf(p.year, p.month, p.day),
    // 同一时刻下，各城市日期可能差一天：用它与北京日期对比给出"昨天/明天"
    sunAltitude: Number(altitude.toFixed(2)),
    sunAzimuth: Number(azimuth.toFixed(1)),
    isDaytime: altitude > -0.833,
  };
}

/* ---------------- 路由 ---------------- */

/** 第二级：全球各地时间。 */
router.get('/cities', (req, res) => {
  const now = new Date();
  const beijingToday = dateStr(partsIn(BEIJING_TZ, now));

  const cities = CITIES.map((city) => {
    const info = describeCity(city, now);
    // 相对北京的日期差（-1 昨天 / 0 今天 / +1 明天），前端用来标注跨日
    const dayDelta = Math.round(
      (Date.parse(`${info.localDate}T00:00:00Z`) - Date.parse(`${beijingToday}T00:00:00Z`)) / 86400000,
    );
    return { ...info, dayDeltaVsBeijing: dayDelta };
  });

  res.json({
    ok: true,
    data: {
      epochMs: now.getTime(),
      timezone: BEIJING_TZ,
      beijingDate: beijingToday,
      generatedAt: now.toISOString(),
      cities,
    },
  });
});

/** 第三级：某城市某天的日出日落与太阳轨迹。 */
router.get('/sun', (req, res) => {
  const city = findCity(req.query.city);
  if (!city) {
    return res.status(400).json({ ok: false, error: `未知城市：${req.query.city ?? '(缺少 city 参数)'}` });
  }

  const now = new Date();
  const nowLocal = partsIn(city.timezone, now);
  const today = dateStr(nowLocal);

  // date 参数可选，默认该城市的"今天"
  let target = today;
  if (req.query.date !== undefined && req.query.date !== '') {
    const raw = String(req.query.date);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return res.status(400).json({ ok: false, error: `日期格式应为 YYYY-MM-DD：${raw}` });
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() + 1 !== mo ||
      probe.getUTCDate() !== d ||
      y < 1900 ||
      y > 2100
    ) {
      return res.status(400).json({ ok: false, error: `不是有效日期：${raw}` });
    }
    target = raw;
  }

  const [ty, tm, td] = target.split('-').map(Number);

  // 该城市当天"墙上时间 12:00"对应的 UTC 时刻；用它所在的 UTC 日期做天文计算，
  // 这样东十二区、西十区这些跨日时区也不会算错一天。
  const localNoon = wallTimeToUtc(city.timezone, ty, tm, td, 12, 0);
  const utcDateOfNoon = partsIn('UTC', localNoon);

  const events = sunEventsUtc(
    { year: utcDateOfNoon.year, month: utcDateOfNoon.month, day: utcDateOfNoon.day },
    city.lat,
    city.lon,
  );

  /** 把 UTC 时刻渲染成该城市的当地时间。 */
  const localize = (date) => {
    if (!date) return null;
    const p = partsIn(city.timezone, date);
    return {
      utcMs: date.getTime(),
      localDate: dateStr(p),
      localTime: timeStr(p),
      weekday: weekdayOf(p.year, p.month, p.day),
    };
  };

  const sunrise = localize(events.sunrise);
  const sunset = localize(events.sunset);

  // 昼长：按当地时间差算，避免夏令时跳变干扰
  const dayLengthMinutes =
    events.sunrise && events.sunset ? Math.round((events.sunset - events.sunrise) / 60000) : null;

  // 当天太阳高度角曲线（按当地时间每 10 分钟采样），前端据此画太阳轨迹图。
  // 说明：这里假设一天内 UTC 偏移不变；极少数夏令时切换日的曲线会平移 1 小时。
  const localMidnight = wallTimeToUtc(city.timezone, ty, tm, td, 0, 0);
  const curve = [];
  for (let minute = 0; minute <= 1440; minute += 10) {
    const at = new Date(localMidnight.getTime() + minute * 60000);
    curve.push({ minute, altitude: Number(solarPosition(at, city.lat, city.lon).altitude.toFixed(2)) });
  }

  const nowSun = solarPosition(now, city.lat, city.lon);

  res.json({
    ok: true,
    data: {
      city: {
        id: city.id,
        name: city.name,
        nameEn: city.nameEn,
        region: city.region,
        timezone: city.timezone,
        lat: city.lat,
        lon: city.lon,
      },
      date: target,
      isToday: target === today,
      isFuture: target > today,
      utcOffset: offsetLabel(tzOffsetMinutes(city.timezone, localNoon)),
      utcOffsetMinutes: tzOffsetMinutes(city.timezone, localNoon),
      localNow: {
        ...localize(now),
        timezone: city.timezone,
        minutesOfDay: nowLocal.hour * 60 + nowLocal.minute,
      },
      events: {
        sunrise,
        solarNoon: localize(events.solarNoon),
        sunset,
        civilDawn: localize(events.civilDawn),
        civilDusk: localize(events.civilDusk),
      },
      polar: events.polar,
      declination: Number(events.declination.toFixed(2)),
      dayLengthMinutes,
      sun: {
        altitude: Number(nowSun.altitude.toFixed(2)),
        azimuth: Number(nowSun.azimuth.toFixed(1)),
        isUp: nowSun.altitude > -0.833,
      },
      curve,
    },
  });
});

export default router;
