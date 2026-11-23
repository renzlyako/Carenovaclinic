function cell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}


export function toCsv(columns, rows) {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c.key])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel opens UTF-8 correctly
}
