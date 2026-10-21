/**
 * 太阳位置与日出日落计算。
 *
 * 实现的是 NOAA Solar Calculator 的公式集（赤纬、均时差、高度角、方位角），
 * 全部只依赖「UTC 时刻 + 经纬度」，与服务器本地时区无关；把结果换算成
 * 某城市当地时间由 Intl 时区数据库完成（见 src/routes/world.js）。
 *
 * 精度：日出日落一般与官方值相差 1 分钟以内；太阳高度角误差在 0.1° 量级。
 * 极昼/极夜、以及高纬度地区"当天太阳不落地/不升起"的情况会显式返回状态，
 * 而不是硬算出一个无意义的时间。
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** 儒略日 2451545.0 对应的 Unix 毫秒时间戳：2000-01-01 12:00 UT。 */
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

const mod360 = (x) => ((x % 360) + 360) % 360;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** 某 UTC 日 0 时的儒略日。 */
export function julianDayUT(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** 儒略日 → Date。 */
export function jdToDate(jd) {
  return new Date(J2000_MS + (jd - 2451545.0) * 86400000);
}

/**
 * 计算某一时刻的太阳参数。
 *
 * @param {Date} date   UTC 时刻
 * @param {number} lat  纬度（北纬为正，单位度）
 * @param {number} lon  经度（东经为正，单位度）
 * @returns {{declination:number, eqTime:number, altitude:number, azimuth:number, zenith:number}}
 *          declination 太阳赤纬（度）；eqTime 均时差（分钟）；
 *          altitude 高度角（度，地平线以上为正）；azimuth 方位角（度，正北为 0，顺时针）；
 *          zenith 天顶角（度）。
 */
export function solarPosition(date, lat, lon) {
  const t = (date.getTime() - J2000_MS) / 86400000 / 36525; // 儒略世纪

  // 太阳几何平黄经与平近点角
  const l0 = mod360(280.46646 + t * (36000.76983 + 0.0003032 * t));
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // 中心差
  const c =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;

  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  // 黄赤交角（含修正）与太阳赤纬
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;

  // 均时差（分钟）
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD));

  // 真太阳时（分钟，0~1440）→ 时角（度）
  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  const trueSolarTime = ((utcMinutes + eqTime + 4 * lon) % 1440 + 1440) % 1440;
  let hourAngle = trueSolarTime / 4 - 180; // -180 ~ +180，负数表示上午
  if (hourAngle < -180) hourAngle += 360;

  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(declination * RAD) +
    Math.cos(lat * RAD) * Math.cos(declination * RAD) * Math.cos(hourAngle * RAD);
  const zenith = Math.acos(clamp(cosZenith, -1, 1)) * DEG;
  const altitude = 90 - zenith;

  // 方位角（NOAA 公式）：正午前用 540 - acos(...)，正午后用 acos(...) + 180，再对 360 取模
  const sinZenith = Math.sin(zenith * RAD);
  let azimuth;
  if (Math.abs(sinZenith) < 1e-9) {
    azimuth = hourAngle > 0 ? 270 : 90; // 太阳正当头，方位角无定义，给个合理值
  } else {
    const cosAz = clamp(
      (Math.sin(lat * RAD) * cosZenith - Math.sin(declination * RAD)) / (Math.cos(lat * RAD) * sinZenith),
      -1,
      1,
    );
    azimuth = hourAngle > 0 ? mod360(Math.acos(cosAz) * DEG + 180) : mod360(540 - Math.acos(cosAz) * DEG);
  }

  return { declination, eqTime, altitude, azimuth, zenith };
}

/**
 * 计算某 UTC 日的日出、日落、正午等时刻，以及极昼/极夜状态。
 *
 * 做法（与 NOAA 一致）：
 *   1. 用均时差迭代两次，求出当天的"太阳正午"时刻（UTC 分钟）；
 *   2. 由正午的赤纬算出日出/日落对应的时角；
 *   3. 时角 × 4 分钟 = 距正午的分钟数。
 *
 * @param {{year:number, month:number, day:number}} utcDate 该日（UTC 日期）
 * @returns {{solarNoon:Date, sunrise:Date|null, sunset:Date|null,
 *            civilDawn:Date|null, civilDusk:Date|null,
 *            polar:('midnight-sun'|'polar-night'|null), declination:number}}
 */
export function sunEventsUtc(utcDate, lat, lon) {
  const { year, month, day } = utcDate;
  const base = Date.UTC(year, month - 1, day);

  // 1. 太阳正午（UTC 日内的分钟数）：720 - 4×经度 - 均时差
  const transitMinutes = (guessMs) => 720 - 4 * lon - solarPosition(new Date(guessMs), lat, lon).eqTime;
  let transit = transitMinutes(base + 720 * 60000);
  transit = transitMinutes(base + transit * 60000);

  const noon = new Date(base + transit * 60000);
  const { declination } = solarPosition(noon, lat, lon);

  // 2~3. 给定时角高度（天顶角）求上升/下降时刻；越出 [-1,1] 说明当天不穿越该高度
  const crossing = (zenithDeg) => {
    const cosHA =
      (Math.cos(zenithDeg * RAD) - Math.sin(lat * RAD) * Math.sin(declination * RAD)) /
      (Math.cos(lat * RAD) * Math.cos(declination * RAD));
    if (cosHA > 1) return { state: 'below' };  // 太阳始终达不到这个高度
    if (cosHA < -1) return { state: 'above' }; // 太阳始终高于这个高度
    const hours = (Math.acos(cosHA) * DEG) / 15;
    return {
      state: 'cross',
      rise: new Date(base + (transit - hours * 60) * 60000),
      set: new Date(base + (transit + hours * 60) * 60000),
    };
  };

  const sun = crossing(90 + 50 / 60); // 日出日落：含大气折射与日面半径，取 -0.833°
  const civil = crossing(96);          // 民用晨昏蒙影：太阳高度 -6°

  return {
    solarNoon: noon,
    sunrise: sun.state === 'cross' ? sun.rise : null,
    sunset: sun.state === 'cross' ? sun.set : null,
    civilDawn: civil.state === 'cross' ? civil.rise : null,
    civilDusk: civil.state === 'cross' ? civil.set : null,
    // 'above' = 太阳整天在地平线上（极昼）；'below' = 整天在地平线下（极夜）
    polar: sun.state === 'cross' ? null : sun.state === 'above' ? 'midnight-sun' : 'polar-night',
    declination,
  };
}
