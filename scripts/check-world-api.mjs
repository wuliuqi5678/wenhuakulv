const BASE = process.env.BASE ?? 'http://127.0.0.1:3001';

const get = async (path) => {
  const res = await fetch(BASE + path);
  const body = await res.json();
  return { status: res.status, body };
};

// 1) 城市列表
const { body: cities } = await get('/api/world/cities');
console.log('城市数：', cities.data.cities.length, ' 北京日期：', cities.data.beijingDate);
console.log('--- 抽样 ---');
for (const id of ['beijing', 'urumqi', 'london', 'newyork', 'auckland', 'honolulu', 'longyearbyen']) {
  const c = cities.data.cities.find((x) => x.id === id);
  console.log(
    `${c.name.padEnd(6)} ${c.localDate} ${c.localTime} ${c.weekday} ${c.utcOffset} 时差${String(c.vsBeijingMinutes).padStart(5)}分 日差${c.dayDeltaVsBeijing} ${c.isDaytime ? '白天' : '夜晚'} 高度${c.sunAltitude}°`,
  );
}

// 2) 日出日落
const show = async (id, date) => {
  const { status, body } = await get(`/api/world/sun?city=${id}${date ? `&date=${date}` : ''}`);
  if (!body.ok) return console.log(`${id} ${date} -> HTTP ${status} ${body.error}`);
  const d = body.data;
  const f = (e) => (e ? `${e.localDate} ${e.localTime}` : '—');
  console.log(
    `${d.city.name.padEnd(6)} ${d.date} ${d.isToday ? '(今天)' : ''} UTC偏移${d.utcOffset} 日出 ${f(d.events.sunrise)} 日落 ${f(d.events.sunset)} ` +
      `正午 ${f(d.events.solarNoon)} 昼长 ${d.dayLengthMinutes}分 赤纬${d.declination}° 极值:${d.polar ?? '无'} 曲线点${d.curve.length}`,
  );
};

console.log('--- 日出日落 ---');
await show('beijing');
await show('beijing', '2025-06-21');
await show('london', '2026-12-21');
await show('sydney', '2026-01-15');
await show('longyearbyen', '2026-06-21');
await show('longyearbyen', '2026-12-21');
await show('reykjavik', '2026-06-21');
await show('auckland', '2026-06-21');
await show('honolulu', '2026-06-21');

// 3) 错误处理
console.log('--- 异常输入 ---');
for (const p of ['/api/world/sun', '/api/world/sun?city=nowhere', '/api/world/sun?city=beijing&date=2026-13-01', '/api/world/sun?city=beijing&date=abc']) {
  const { status, body } = await get(p);
  console.log(`${status} ${p} -> ${body.error}`);
}
