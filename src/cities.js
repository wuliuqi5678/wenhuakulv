/**
 * 世界城市清单。
 *
 * 每个城市只需要三样东西：
 *   - timezone：IANA 时区名，交给 Intl/ICU 换算当地时间（含夏令时）；
 *   - lat/lon：纬度、经度（东经为正、西经为负），用于日出日落与太阳高度角；
 *   - region：页面分组用。
 *
 * 注意：这里不存"与 UTC 相差几小时"，因为夏令时会让这个数字一年变两次，
 * 偏移量一律在运行时由时区数据库推算。
 */

/** 城市按大洲分组，页面沿用这个顺序展示。 */
export const REGIONS = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '极地'];

export const CITIES = [
  // ---------- 亚洲 ----------
  { id: 'beijing',    name: '北京',   nameEn: 'Beijing',    region: '亚洲', timezone: 'Asia/Shanghai',      lat: 39.9042,  lon: 116.4074 },
  { id: 'urumqi',     name: '乌鲁木齐', nameEn: 'Urumqi',   region: '亚洲', timezone: 'Asia/Urumqi',        lat: 43.8256,  lon: 87.6168 },
  { id: 'shanghai',   name: '上海',   nameEn: 'Shanghai',   region: '亚洲', timezone: 'Asia/Shanghai',      lat: 31.2304,  lon: 121.4737 },
  { id: 'hongkong',   name: '香港',   nameEn: 'Hong Kong',  region: '亚洲', timezone: 'Asia/Hong_Kong',     lat: 22.3193,  lon: 114.1694 },
  { id: 'taipei',     name: '台北',   nameEn: 'Taipei',     region: '亚洲', timezone: 'Asia/Taipei',        lat: 25.0330,  lon: 121.5654 },
  { id: 'tokyo',      name: '东京',   nameEn: 'Tokyo',      region: '亚洲', timezone: 'Asia/Tokyo',         lat: 35.6762,  lon: 139.6503 },
  { id: 'seoul',      name: '首尔',   nameEn: 'Seoul',      region: '亚洲', timezone: 'Asia/Seoul',         lat: 37.5665,  lon: 126.9780 },
  { id: 'singapore',  name: '新加坡', nameEn: 'Singapore',  region: '亚洲', timezone: 'Asia/Singapore',     lat: 1.3521,   lon: 103.8198 },
  { id: 'bangkok',    name: '曼谷',   nameEn: 'Bangkok',    region: '亚洲', timezone: 'Asia/Bangkok',       lat: 13.7563,  lon: 100.5018 },
  { id: 'mumbai',     name: '孟买',   nameEn: 'Mumbai',     region: '亚洲', timezone: 'Asia/Kolkata',       lat: 19.0760,  lon: 72.8777 },
  { id: 'dubai',      name: '迪拜',   nameEn: 'Dubai',      region: '亚洲', timezone: 'Asia/Dubai',         lat: 25.2048,  lon: 55.2708 },

  // ---------- 欧洲 ----------
  { id: 'moscow',     name: '莫斯科', nameEn: 'Moscow',     region: '欧洲', timezone: 'Europe/Moscow',      lat: 55.7558,  lon: 37.6173 },
  { id: 'london',     name: '伦敦',   nameEn: 'London',     region: '欧洲', timezone: 'Europe/London',      lat: 51.5074,  lon: -0.1278 },
  { id: 'paris',      name: '巴黎',   nameEn: 'Paris',      region: '欧洲', timezone: 'Europe/Paris',       lat: 48.8566,  lon: 2.3522 },
  { id: 'berlin',     name: '柏林',   nameEn: 'Berlin',     region: '欧洲', timezone: 'Europe/Berlin',      lat: 52.5200,  lon: 13.4050 },
  { id: 'reykjavik',  name: '雷克雅未克', nameEn: 'Reykjavik', region: '欧洲', timezone: 'Atlantic/Reykjavik', lat: 64.1466, lon: -21.9426 },

  // ---------- 非洲 ----------
  { id: 'cairo',      name: '开罗',   nameEn: 'Cairo',      region: '非洲', timezone: 'Africa/Cairo',       lat: 30.0444,  lon: 31.2357 },
  { id: 'nairobi',    name: '内罗毕', nameEn: 'Nairobi',    region: '非洲', timezone: 'Africa/Nairobi',     lat: -1.2921,  lon: 36.8219 },
  { id: 'capetown',   name: '开普敦', nameEn: 'Cape Town',  region: '非洲', timezone: 'Africa/Johannesburg', lat: -33.9249, lon: 18.4241 },

  // ---------- 北美洲 ----------
  { id: 'newyork',    name: '纽约',   nameEn: 'New York',   region: '北美洲', timezone: 'America/New_York',  lat: 40.7128,  lon: -74.0060 },
  { id: 'chicago',    name: '芝加哥', nameEn: 'Chicago',    region: '北美洲', timezone: 'America/Chicago',   lat: 41.8781,  lon: -87.6298 },
  { id: 'losangeles', name: '洛杉矶', nameEn: 'Los Angeles', region: '北美洲', timezone: 'America/Los_Angeles', lat: 34.0522, lon: -118.2437 },
  { id: 'honolulu',   name: '檀香山', nameEn: 'Honolulu',   region: '北美洲', timezone: 'Pacific/Honolulu',  lat: 21.3069,  lon: -157.8583 },
  { id: 'vancouver',  name: '温哥华', nameEn: 'Vancouver',  region: '北美洲', timezone: 'America/Vancouver', lat: 49.2827,  lon: -123.1207 },

  // ---------- 南美洲 ----------
  { id: 'saopaulo',   name: '圣保罗', nameEn: 'São Paulo',  region: '南美洲', timezone: 'America/Sao_Paulo', lat: -23.5505, lon: -46.6333 },
  { id: 'lima',       name: '利马',   nameEn: 'Lima',       region: '南美洲', timezone: 'America/Lima',      lat: -12.0464, lon: -77.0428 },
  { id: 'ushuaia',    name: '乌斯怀亚', nameEn: 'Ushuaia',  region: '南美洲', timezone: 'America/Argentina/Ushuaia', lat: -54.8019, lon: -68.3030 },

  // ---------- 大洋洲 ----------
  { id: 'sydney',     name: '悉尼',   nameEn: 'Sydney',     region: '大洋洲', timezone: 'Australia/Sydney',  lat: -33.8688, lon: 151.2093 },
  { id: 'auckland',   name: '奥克兰', nameEn: 'Auckland',   region: '大洋洲', timezone: 'Pacific/Auckland',  lat: -36.8485, lon: 174.7633 },

  // ---------- 极地 ----------
  { id: 'longyearbyen', name: '朗伊尔城', nameEn: 'Longyearbyen', region: '极地', timezone: 'Arctic/Longyearbyen', lat: 78.2232, lon: 15.6267 },
];

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));

/** 按 id 取城市；找不到返回 null（接口据此返回 400）。 */
export function findCity(id) {
  return BY_ID.get(String(id ?? '').trim().toLowerCase()) ?? null;
}
