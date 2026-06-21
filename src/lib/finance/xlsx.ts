import * as XLSX from "xlsx";

export function exportCSV(name: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  triggerDownload(name, blob);
}

export function exportXLSX(
  name: string,
  sheets: { name: string; headers: string[]; rows: (string | number | null)[][] }[],
) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa = [s.headers, ...s.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Right-to-left for Arabic
    (ws as any)["!cols"] = s.headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(name, new Blob([buf], { type: "application/octet-stream" }));
}

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
