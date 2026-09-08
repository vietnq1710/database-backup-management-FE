import { CRON_PRESETS } from "@/lib/cron-presets";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms} ms`;
  const totalS = Math.round(ms / 1000);
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${totalS}s`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Rút gọn ObjectId/UUID để hiển thị trong bảng
export function shortId(id: string | null | undefined): string {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export function totalPagesOf(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

export function cronLabel(cron: string): string {
  const map: Record<string, string> = {
    "* * * * *": "Mỗi phút",
    "*/30 * * * *": "Mỗi 30 phút",
    "0 * * * *": "Mỗi giờ",
    "0 */6 * * *": "Mỗi 6 giờ",
    "0 2 * * *": "Hằng ngày 02:00",
    "30 1 * * *": "Hằng ngày 01:30",
    "0 3 * * 0": "Chủ nhật 03:00",
  };
  if (map[cron]) return map[cron];
  const preset = CRON_PRESETS.find((p) => p.expr === cron);
  return preset?.label ?? cron;
}
