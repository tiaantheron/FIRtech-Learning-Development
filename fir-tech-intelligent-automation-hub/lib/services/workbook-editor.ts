import * as XLSX from "xlsx"
import { SHEET_DEFS, FX_COLUMNS } from "@/lib/models/schema"
import { parseWorkbook } from "./parse"
export type CellValue = string | number | boolean
export interface EditableRow { row: number; values: Record<string, CellValue> }
export interface SheetView { name: string; headers: string[]; rows: EditableRow[]; formulas: Record<string, boolean>; numeric: string[] }
const monetary = ["Revenue", "Opportunities", "Leads", "Engagements"]
export function readEditorSheet(buffer: ArrayBuffer, name: string): SheetView {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const sheet = wb.Sheets[name]
  const def = Object.values(SHEET_DEFS).find(d => d.sheet === name)
  const header = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] ?? []) : def?.columns.map(c => c.header) ?? []
  const headers = [...header]
  if (name === "Engagements") for (const h of ["ContractValue", "Date"]) if (!headers.includes(h)) headers.push(h)
  if (monetary.includes(name)) for (const h of ["Currency", ...FX_COLUMNS.map(c => c.header)]) if (!headers.includes(h)) headers.push(h)
  const formulas: Record<string, boolean> = {}
  const numeric = new Set(def?.columns.filter(c => c.type === "number" || c.type === "percent").map(c => c.header) ?? [])
  for (const h of ["Required", "Attained", "Remaining", "Progress", "RevenueAllocation", "RevenueTarget", "WeightedValue", "ExchangeRate", "ConvertedAmount"]) if (headers.includes(h)) numeric.add(h)
  const rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map(r => {
    const row = Number(r.__rowNum__) + 1
    const values = Object.fromEntries(headers.map((h, i) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: i })]
      if (cell?.f) formulas[`${row}:${h}`] = true
      if (typeof r[h] === "number") numeric.add(h)
      const value = r[h] instanceof Date ? r[h].toISOString().slice(0, 10) : r[h] ?? (h === "Currency" || h === "ReportingCurrency" ? "ZAR" : "")
      return [h, value as CellValue]
    }))
    return { row, values }
  }) : []
  return { name, headers, rows, formulas, numeric: [...numeric] }
}
export function workbookSheetNames(buffer: ArrayBuffer) { return XLSX.read(buffer, { type: "array", bookSheets: true }).SheetNames }

export async function mutateWorkbook(buffer: ArrayBuffer, sheetName: string, rowNumber: number | null, values: Record<string, CellValue>, action: "save" | "delete") {
  const { default: ExcelJS } = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const view = readEditorSheet(buffer, sheetName)
  const sheet = wb.getWorksheet(sheetName) ?? wb.addWorksheet(sheetName)
  if (!view.headers.length) throw new Error("No worksheet format is available.")
  const original = rowNumber ? view.rows.find(r => r.row === rowNumber)?.values : undefined
  if (rowNumber && !original) throw new Error("This entry no longer exists. Reopen the editor.")
  const row = sheet.getRow(rowNumber ?? Math.max(sheet.rowCount + 1, 2))
  if (!rowNumber && sheet.rowCount > 1) {
    const template = sheet.getRow(Math.max(2, row.number - 1))
    row.height = template.height
    view.headers.forEach((_, i) => { row.getCell(i + 1).style = structuredClone(template.getCell(i + 1).style) })
  }
  const next = { ...values }
  if (action === "save") {
    if (monetary.includes(sheetName)) {
      next.Currency = String(next.Currency || "ZAR").toUpperCase()
      next.ReportingCurrency = String(next.ReportingCurrency || "ZAR").toUpperCase()
      const amount = Number(next.Amount ?? next.EstimatedValue ?? next.ContractValue ?? 0)
      next.ConvertedAmount = next.ExchangeRate === "" || next.ExchangeRate === undefined ? "" : Math.round(amount * Number(next.ExchangeRate) * 100) / 100
    }
    if (view.headers.includes("Remaining")) next.Remaining = Math.max(Number(next.Required) - Number(next.Attained), 0)
    if (view.headers.includes("WeightedValue")) {
      const stage = String(next.Stage).toLowerCase(), probability = Number(next.Probability) > 1 ? Number(next.Probability) / 100 : Number(next.Probability)
      next.WeightedValue = Math.round(Number(next.EstimatedValue) * (stage === "closed won" ? 1 : stage === "closed lost" ? 0 : probability) * 100) / 100
    }
  }
  view.headers.forEach((h, i) => {
    const header = sheet.getRow(1).getCell(i + 1)
    if (!header.value) { header.value = h; header.style = structuredClone(sheet.getRow(1).getCell(1).style); sheet.getColumn(i + 1).width = Math.max(18, h.length + 2) }
    const cell = row.getCell(i + 1)
    if (action === "delete") cell.value = null
    else if (cell.type !== ExcelJS.ValueType.Formula || ["Remaining", "WeightedValue", "ConvertedAmount"].includes(h)) cell.value = next[h] === "" || next[h] === undefined ? null : next[h]
  })
  // Name-based references in the nine-sheet layout follow a renamed person or department.
  const renameField = sheetName === "People" ? "FullName" : sheetName === "Departments" ? "Department" : ""
  if (action === "save" && original && renameField && original[renameField] !== next[renameField]) {
    const referenceFields = renameField === "FullName" ? ["Person", "Owner", "Manager", "DeliveryLead"] : ["Department", "PrimaryDepartment", "OwningDepartment"]
    wb.eachSheet(s => { if (s.name === sheetName || s.name === "Audit") return; s.eachRow((r, n) => { if (n === 1) return; r.eachCell((c, col) => { if (referenceFields.includes(String(s.getRow(1).getCell(col).value)) && c.value === original[renameField]) c.value = next[renameField] }) }) })
  }
  const audit = wb.getWorksheet("Audit")
  if (audit && sheetName !== "Audit") audit.addRow([`AUD-${crypto.randomUUID()}`, new Date().toISOString(), "Dashboard user", sheetName, String(next[view.headers[0]] ?? original?.[view.headers[0]] ?? row.number), action === "delete" ? "Delete" : rowNumber ? "Update" : "Add", JSON.stringify(original ?? {}), action === "delete" ? "" : JSON.stringify(next), "Dashboard edit"])
  wb.calcProperties.fullCalcOnLoad = true
  const bytes = await wb.xlsx.writeBuffer()
  const output = new Uint8Array(bytes).buffer as ArrayBuffer
  const parsed = parseWorkbook(output, "edited.xlsx")
  if (parsed.issues.some(i => i.severity === "error")) throw new Error(parsed.issues.filter(i => i.severity === "error").map(i => `${i.worksheet} row ${i.row ?? "—"}, ${i.field ?? ""}: ${i.message}`).join("\n"))
  return output
}
