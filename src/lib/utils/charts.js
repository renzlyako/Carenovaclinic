

const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return toStr(d); };

const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (s) => `${SHORT_MONTH[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`;


export function fillDays(rows, today, back = 6, forward = 7) {
  const byDay = new Map((rows ?? []).map((r) => [String(r.day).slice(0, 10), Number(r.total)]));
  const out = [];
  for (let i = -back; i <= forward; i++) {
    const day = addDays(today, i);
    out.push({ label: dayLabel(day), value: byDay.get(day) ?? 0 });
  }
  return out;
}


export function fillMonths(rows, today, count = 6) {
  const byMonth = new Map((rows ?? []).map((r) => [r.month, Number(r.revenue)]));
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return keys.map((k) => ({ label: `${SHORT_MONTH[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, value: byMonth.get(k) ?? 0 }));
}
