import { CITIES } from '../src/cities.js';
import { solarPosition, sunEventsUtc } from '../src/sun.js';

// 1) 校验所有时区名在本机 ICU 中可用
const bad = [];
for (const c of CITIES) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: c.timezone }).format(new Date());
  } catch {
    bad.push(`${c.id} -> ${c.timezone}`);
  }
}
console.log('时区无效的城市：', bad.length ? bad : '无');

// 2) 指定日期日出日落（用 UTC 日期算，再换算成当地时间）
const fmt = (tz, d) =>
  d
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit',
      }).format(d)
    : '—';

const cases = [
  ['beijing', '2025-06-21'],
  ['beijing', '2025-12-21'],
  ['london', '2025-06-21'],
  ['sydney', '2025-06-21'],
  ['newyork', '2025-06-21'],
  ['ushuaia', '2025-06-21'],
  ['longyearbyen', '2025-06-21'],
  ['longyearbyen', '2025-12-21'],
  ['reykjavik', '2025-06-21'],
];

for (const [id, date] of cases) {
  const c = CITIES.find((x) => x.id === id);
  const [y, m, d] = date.split('-').map(Number);
  const e = sunEventsUtc({ year: y, month: m, day: d }, c.lat, c.lon);
  const len = e.sunrise && e.sunset ? ((e.sunset - e.sunrise) / 3600000).toFixed(2) : '—';
  console.log(
    `${c.name.padEnd(5)} ${date}  日出 ${fmt(c.timezone, e.sunrise).padEnd(12)} 日落 ${fmt(c.timezone, e.sunset).padEnd(12)}` +
      ` 正午 ${fmt(c.timezone, e.solarNoon).padEnd(12)} 昼长 ${len}h  ${e.polar ?? ''}`,
  );
}

// 3) 当前太阳高度角抽查（北京现在若为白天应 > 0）
const now = new Date();
const bj = solarPosition(now, 39.9042, 116.4074);
console.log('北京此刻 高度角', bj.altitude.toFixed(2), '方位角', bj.azimuth.toFixed(1), '赤纬', bj.declination.toFixed(2));
