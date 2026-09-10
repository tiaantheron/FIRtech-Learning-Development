import * as XLSX from "xlsx"

export type ExportRow = Record<string, string | number>

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportSourceWorkbook(file: File) {
  // Download original bytes: SheetJS reserialization would lose template styling.
  download(file, file.name.replace(/\.xlsx$/i, "-export.xlsx"))
}

export function exportCSV(rows: ExportRow[], fileName: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: string | number) => {
    const raw = String(v ?? "")
    const s = typeof v === "string" && /^[\s]*[=+@\-]/.test(raw) ? "'" + raw : raw
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), fileName.replace(/\.[a-z]+$/i, "") + ".csv")
}

export function exportExcel(rows: ExportRow[], fileName: string, sheetName = "Report") {
  if (rows.length === 0) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, fileName.replace(/\.[a-z]+$/i, "") + ".xlsx")
}
