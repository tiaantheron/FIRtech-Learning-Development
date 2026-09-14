import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, unlinkSync, rmdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as XLSX from "xlsx"
import { exportCSV, exportExcel } from "../lib/services/export"

test("report exports preserve selected rows, numeric types and escaped CSV content", async () => {
  const rows = [{ Customer: '=QA("mock")', "Amount, ZAR": 1800, Notes: "Mock, draft\nQA only" }]
  const anchor = { href: "", download: "", click() {} }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => anchor, body: { appendChild() {}, removeChild() {} } } })
  try {
    exportCSV(rows, "qa-report")
    assert.equal(anchor.download, "qa-report.csv")
    const csv = await fetch(anchor.href).then(r => r.text())
    assert.match(csv, /Customer,"Amount, ZAR",Notes/)
    assert.ok(csv.includes('"\'=QA(""mock"")"'))
    assert.ok(csv.includes('"Mock, draft\nQA only"'))
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous)
    else Reflect.deleteProperty(globalThis, "document")
  }
  const directory = mkdtempSync(join(tmpdir(), "firtech-report-")), path = join(directory, "report.xlsx")
  try {
    exportExcel(rows, path, "QA report")
    const workbook = XLSX.read(readFileSync(path))
    assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets["QA report"]), rows)
  } finally { unlinkSync(path); rmdirSync(directory) }
})
