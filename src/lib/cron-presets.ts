// Đủ enum CronExpression của BE (@nestjs/schedule) — KEY phải khớp đúng
// vì DTO validate IsIn(Object.keys(CronExpression))
export const CRON_PRESETS: ReadonlyArray<{
  key: string;
  expr: string;
  label: string;
}> = [
  { key: "EVERY_SECOND", expr: "* * * * * *", label: "Mỗi giây" },
  { key: "EVERY_5_SECONDS", expr: "*/5 * * * * *", label: "Mỗi 5 giây" },
  { key: "EVERY_10_SECONDS", expr: "*/10 * * * * *", label: "Mỗi 10 giây" },
  { key: "EVERY_30_SECONDS", expr: "*/30 * * * * *", label: "Mỗi 30 giây" },
  { key: "EVERY_MINUTE", expr: "*/1 * * * *", label: "Mỗi phút" },
  { key: "EVERY_5_MINUTES", expr: "0 */5 * * * *", label: "Mỗi 5 phút" },
  { key: "EVERY_10_MINUTES", expr: "0 */10 * * * *", label: "Mỗi 10 phút" },
  { key: "EVERY_30_MINUTES", expr: "0 */30 * * * *", label: "Mỗi 30 phút" },
  { key: "EVERY_HOUR", expr: "0 0-23/1 * * *", label: "Mỗi giờ" },
  { key: "EVERY_2_HOURS", expr: "0 0-23/2 * * *", label: "Mỗi 2 giờ" },
  { key: "EVERY_3_HOURS", expr: "0 0-23/3 * * *", label: "Mỗi 3 giờ" },
  { key: "EVERY_4_HOURS", expr: "0 0-23/4 * * *", label: "Mỗi 4 giờ" },
  { key: "EVERY_5_HOURS", expr: "0 0-23/5 * * *", label: "Mỗi 5 giờ" },
  { key: "EVERY_6_HOURS", expr: "0 0-23/6 * * *", label: "Mỗi 6 giờ" },
  { key: "EVERY_7_HOURS", expr: "0 0-23/7 * * *", label: "Mỗi 7 giờ" },
  { key: "EVERY_8_HOURS", expr: "0 0-23/8 * * *", label: "Mỗi 8 giờ" },
  { key: "EVERY_9_HOURS", expr: "0 0-23/9 * * *", label: "Mỗi 9 giờ" },
  { key: "EVERY_10_HOURS", expr: "0 0-23/10 * * *", label: "Mỗi 10 giờ" },
  { key: "EVERY_11_HOURS", expr: "0 0-23/11 * * *", label: "Mỗi 11 giờ" },
  { key: "EVERY_12_HOURS", expr: "0 0-23/12 * * *", label: "Mỗi 12 giờ" },
  { key: "EVERY_DAY_AT_MIDNIGHT", expr: "0 0 * * *", label: "Hằng ngày 00:00" },
  { key: "EVERY_DAY_AT_1AM", expr: "0 01 * * *", label: "Hằng ngày 01:00" },
  { key: "EVERY_DAY_AT_2AM", expr: "0 02 * * *", label: "Hằng ngày 02:00" },
  { key: "EVERY_DAY_AT_3AM", expr: "0 03 * * *", label: "Hằng ngày 03:00" },
  { key: "EVERY_DAY_AT_4AM", expr: "0 04 * * *", label: "Hằng ngày 04:00" },
  { key: "EVERY_DAY_AT_5AM", expr: "0 05 * * *", label: "Hằng ngày 05:00" },
  { key: "EVERY_DAY_AT_6AM", expr: "0 06 * * *", label: "Hằng ngày 06:00" },
  { key: "EVERY_DAY_AT_7AM", expr: "0 07 * * *", label: "Hằng ngày 07:00" },
  { key: "EVERY_DAY_AT_8AM", expr: "0 08 * * *", label: "Hằng ngày 08:00" },
  { key: "EVERY_DAY_AT_9AM", expr: "0 09 * * *", label: "Hằng ngày 09:00" },
  { key: "EVERY_DAY_AT_10AM", expr: "0 10 * * *", label: "Hằng ngày 10:00" },
  { key: "EVERY_DAY_AT_11AM", expr: "0 11 * * *", label: "Hằng ngày 11:00" },
  { key: "EVERY_DAY_AT_NOON", expr: "0 12 * * *", label: "Hằng ngày 12:00" },
  { key: "EVERY_DAY_AT_1PM", expr: "0 13 * * *", label: "Hằng ngày 13:00" },
  { key: "EVERY_DAY_AT_2PM", expr: "0 14 * * *", label: "Hằng ngày 14:00" },
  { key: "EVERY_DAY_AT_3PM", expr: "0 15 * * *", label: "Hằng ngày 15:00" },
  { key: "EVERY_DAY_AT_4PM", expr: "0 16 * * *", label: "Hằng ngày 16:00" },
  { key: "EVERY_DAY_AT_5PM", expr: "0 17 * * *", label: "Hằng ngày 17:00" },
  { key: "EVERY_DAY_AT_6PM", expr: "0 18 * * *", label: "Hằng ngày 18:00" },
  { key: "EVERY_DAY_AT_7PM", expr: "0 19 * * *", label: "Hằng ngày 19:00" },
  { key: "EVERY_DAY_AT_8PM", expr: "0 20 * * *", label: "Hằng ngày 20:00" },
  { key: "EVERY_DAY_AT_9PM", expr: "0 21 * * *", label: "Hằng ngày 21:00" },
  { key: "EVERY_DAY_AT_10PM", expr: "0 22 * * *", label: "Hằng ngày 22:00" },
  { key: "EVERY_DAY_AT_11PM", expr: "0 23 * * *", label: "Hằng ngày 23:00" },
  { key: "EVERY_WEEK", expr: "0 0 * * 0", label: "Hằng tuần (CN 00:00)" },
  {
    key: "EVERY_WEEKDAY",
    expr: "0 0 * * 1-5",
    label: "Ngày thường (T2–T6 00:00)",
  },
  {
    key: "EVERY_WEEKEND",
    expr: "0 0 * * 6,0",
    label: "Cuối tuần (T7 + CN 00:00)",
  },
  {
    key: "EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT",
    expr: "0 0 1 * *",
    label: "Ngày 1 hằng tháng 00:00",
  },
  {
    key: "EVERY_1ST_DAY_OF_MONTH_AT_NOON",
    expr: "0 12 1 * *",
    label: "Ngày 1 hằng tháng 12:00",
  },
  { key: "EVERY_2ND_HOUR", expr: "0 */2 * * *", label: "Mỗi giờ chẵn (0, 2, 4…)" },
  {
    key: "EVERY_2ND_HOUR_FROM_1AM_THROUGH_11PM",
    expr: "0 1-23/2 * * *",
    label: "Mỗi giờ lẻ (1, 3, 5…23)",
  },
  {
    key: "EVERY_2ND_MONTH",
    expr: "0 0 1 */2 *",
    label: "Cách 1 tháng (ngày 1, 00:00)",
  },
  { key: "EVERY_QUARTER", expr: "0 0 1 */3 *", label: "Hằng quý (ngày 1, 00:00)" },
  {
    key: "EVERY_6_MONTHS",
    expr: "0 0 1 */6 *",
    label: "Mỗi 6 tháng (ngày 1, 00:00)",
  },
  { key: "EVERY_YEAR", expr: "0 0 1 1 *", label: "Hằng năm (01/01, 00:00)" },
  {
    key: "EVERY_30_MINUTES_BETWEEN_9AM_AND_5PM",
    expr: "0 */30 9-17 * * *",
    label: "Mỗi 30 phút (09:00–17:00)",
  },
  {
    key: "EVERY_30_MINUTES_BETWEEN_9AM_AND_6PM",
    expr: "0 */30 9-18 * * *",
    label: "Mỗi 30 phút (09:00–18:00)",
  },
  {
    key: "EVERY_30_MINUTES_BETWEEN_10AM_AND_7PM",
    expr: "0 */30 10-19 * * *",
    label: "Mỗi 30 phút (10:00–19:00)",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_1AM",
    expr: "0 0 01 * * 1-5",
    label: "T2–T6 01:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_2AM",
    expr: "0 0 02 * * 1-5",
    label: "T2–T6 02:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_3AM",
    expr: "0 0 03 * * 1-5",
    label: "T2–T6 03:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_4AM",
    expr: "0 0 04 * * 1-5",
    label: "T2–T6 04:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_5AM",
    expr: "0 0 05 * * 1-5",
    label: "T2–T6 05:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_6AM",
    expr: "0 0 06 * * 1-5",
    label: "T2–T6 06:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_7AM",
    expr: "0 0 07 * * 1-5",
    label: "T2–T6 07:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_8AM",
    expr: "0 0 08 * * 1-5",
    label: "T2–T6 08:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_9AM",
    expr: "0 0 09 * * 1-5",
    label: "T2–T6 09:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_09_30AM",
    expr: "0 30 09 * * 1-5",
    label: "T2–T6 09:30",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_10AM",
    expr: "0 0 10 * * 1-5",
    label: "T2–T6 10:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_11AM",
    expr: "0 0 11 * * 1-5",
    label: "T2–T6 11:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_11_30AM",
    expr: "0 30 11 * * 1-5",
    label: "T2–T6 11:30",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_12PM",
    expr: "0 0 12 * * 1-5",
    label: "T2–T6 12:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_1PM",
    expr: "0 0 13 * * 1-5",
    label: "T2–T6 13:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_2PM",
    expr: "0 0 14 * * 1-5",
    label: "T2–T6 14:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_3PM",
    expr: "0 0 15 * * 1-5",
    label: "T2–T6 15:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_4PM",
    expr: "0 0 16 * * 1-5",
    label: "T2–T6 16:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_5PM",
    expr: "0 0 17 * * 1-5",
    label: "T2–T6 17:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_6PM",
    expr: "0 0 18 * * 1-5",
    label: "T2–T6 18:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_7PM",
    expr: "0 0 19 * * 1-5",
    label: "T2–T6 19:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_8PM",
    expr: "0 0 20 * * 1-5",
    label: "T2–T6 20:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_9PM",
    expr: "0 0 21 * * 1-5",
    label: "T2–T6 21:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_10PM",
    expr: "0 0 22 * * 1-5",
    label: "T2–T6 22:00",
  },
  {
    key: "MONDAY_TO_FRIDAY_AT_11PM",
    expr: "0 0 23 * * 1-5",
    label: "T2–T6 23:00",
  },
];

export function cronPresetLabelByKey(key: string): string | null {
  return CRON_PRESETS.find((p) => p.key === key)?.label ?? null;
}
