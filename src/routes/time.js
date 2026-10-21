/**
 * 时间接口：返回北京时间。
 *
 * 北京时间固定为 UTC+8 且不实行夏令时，这里交给 Intl 的 Asia/Shanghai 时区
 * 处理，而不是手工做 +8 小时偏移，这样不依赖服务器的本地时区设置。
 */
import { Router } from 'express';

const router = Router();

const TIME_ZONE = 'Asia/Shanghai';

/** 中文星期名到数字编号（1=周一 … 7=周日），便于前端按需使用。 */
const WEEKDAY_INDEX = {
  星期一: 1, 星期二: 2, 星期三: 3, 星期四: 4,
  星期五: 5, 星期六: 6, 星期日: 7,
};

function beijingNow() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(now);

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '';

  const date = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const time = `${pick('hour')}:${pick('minute')}:${pick('second')}`;
  const weekday = pick('weekday');

  return {
    timezone: 'Asia/Shanghai',
    timezoneLabel: '北京时间（UTC+8）',
    utcOffset: '+08:00',
    date,
    time,
    weekday,
    weekdayIndex: WEEKDAY_INDEX[weekday] ?? null,
    iso: `${date}T${time}+08:00`,
    // 服务器真实时间戳，前端据此校正本地时钟偏差
    epochMs: now.getTime(),
  };
}

router.get('/', (req, res) => {
  res.json({ ok: true, data: beijingNow() });
});

export default router;
