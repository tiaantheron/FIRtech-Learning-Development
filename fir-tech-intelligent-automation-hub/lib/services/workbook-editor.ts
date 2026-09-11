import { USER_HEADERS, accounts } from "./permissions"
import { deriveRow, DERIVED_COLUMNS } from "./derived-row"
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
  const header = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] ?? []) : (name === "Users" ? USER_HEADERS : name === "Evidence" ? ["EvidenceId", "DepartmentId", "RecordId", "FileName", "ContentType", "Notes", ...Array.from({ length: 48 }, (_, i) => `Content${i + 1}`)] : def?.columns.map(c => c.header) ?? [])
  const headers = [...header]
  if (["Training", "TrainingAssignments", "Certifications", "Leads", "Opportunities", "Revenue", "Engagements"].includes(name) && !headers.includes("Notes")) headers.push("Notes")
  if (name === "Training") for (const h of ["AssignedDate", "CompletedDate"]) if (!headers.includes(h)) headers.push(h)
  const statusColumn = name === "People" ? "EmploymentStatus" : name === "Departments" ? "Status" : null
  if (statusColumn && !headers.includes(statusColumn)) headers.push(statusColumn)
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

export async function mutateWorkbook(buffer: ArrayBuffer, sheetName: string, rowNumber: number | null, values: Record<string, CellValue>, action: "save" | "delete", actor = "Dashboard user") {
  if (sheetName === "Audit") throw new Error("Audit history is read-only in the application.")
  const { default: ExcelJS } = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const view = readEditorSheet(buffer, sheetName)
  const sheet = wb.getWorksheet(sheetName) ?? wb.addWorksheet(sheetName)
  if (!view.headers.length) throw new Error("No worksheet format is available.")
  const original = rowNumber ? view.rows.find(r => r.row === rowNumber)?.values : undefined
  if (rowNumber && !original) throw new Error("This entry no longer exists. Reopen the editor.")
  if (sheetName === "Users") {
    if (String(original?.Username ?? "").toLowerCase() === "admin" || String(values.Username ?? "").toLowerCase() === "admin") throw new Error("The built-in account cannot be modified.")
    if (action !== "delete") {
      if (!String(values.Username ?? "").trim() || !["Administrator", "Contributor", "Viewer"].includes(String(values.Role))) throw new Error("A username and valid role are required.")
      if (!/^pbkdf2\$[^$]+\$[a-f0-9]{64}$/.test(String(values.PasswordHash))) throw new Error("Set a password for this account.")
      if (accounts(buffer).some(a => a.Username.toLowerCase() === String(values.Username).toLowerCase() && a.Username !== original?.Username)) throw new Error("Username already exists.")
    }
  }
  const row = sheet.getRow(rowNumber ?? Math.max(sheet.rowCount + 1, 2))
  if (!rowNumber && sheet.rowCount > 1) {
    const template = sheet.getRow(Math.max(2, row.number - 1))
    row.height = template.height
    view.headers.forEach((_, i) => { row.getCell(i + 1).style = structuredClone(template.getCell(i + 1).style) })
  }
  const next = { ...values }
  const lifecycleField = sheetName === "People" ? "EmploymentStatus" : sheetName === "Departments" ? "Status" : null
  const archiving = action === "delete" && !!lifecycleField
  const restoring = !!lifecycleField && String(original?.[lifecycleField]).toLowerCase() === "archived" && String(next[lifecycleField]).toLowerCase() === "active"
  if (archiving && lifecycleField) { Object.assign(next, original); next[lifecycleField] = "Archived" }
  if (action === "save" && ["Training", "TrainingAssignments", "Certifications"].includes(sheetName)) {
    const personField = sheetName === "Training" ? "Person" : "PersonId"
    if (!original || original[personField] !== next[personField]) {
      const person = readEditorSheet(buffer, "People").rows.find(r => [r.values.PersonID, r.values.PersonId, r.values.FullName].includes(next[personField]))
      if (String(person?.values.EmploymentStatus).toLowerCase() === "archived") throw new Error("Archived people cannot receive new or reassigned learning records. Restore the person first.")
    }
  }
  if (action === "save" && sheetName === "Departments" && String(original?.Status).toLowerCase() === "archived" && String(next.Status).toLowerCase() !== "active" && ["RevenueTarget", "RevenueTargetZAR", "LeadTarget", "OpportunityTarget"].some(h => next[h] !== original?.[h])) throw new Error("Restore the archived department before assigning new targets.")
  if (action === "save") {
    if (monetary.includes(sheetName)) {
      next.Currency = String(next.Currency || "ZAR").toUpperCase()
      next.ReportingCurrency = String(next.ReportingCurrency || "ZAR").toUpperCase()
    }
    Object.assign(next, deriveRow(next, view.headers))
  }
  view.headers.forEach((h, i) => {
    const header = sheet.getRow(1).getCell(i + 1)
    if (!header.value) { header.value = h; header.style = structuredClone(sheet.getRow(1).getCell(1).style); sheet.getColumn(i + 1).width = Math.max(18, h.length + 2) }
    const cell = row.getCell(i + 1)
    if (action === "delete" && !archiving) cell.value = null
    else if (cell.type !== ExcelJS.ValueType.Formula || DERIVED_COLUMNS.includes(h)) cell.value = next[h] === "" || next[h] === undefined ? null : next[h]
  })
  // Name-based references in the nine-sheet layout follow a renamed person or department.
  const renameField = sheetName === "People" ? "FullName" : sheetName === "Departments" ? "Department" : ""
  if (action === "save" && original && renameField && original[renameField] !== next[renameField]) {
    const referenceFields = renameField === "FullName" ? ["Person", "Owner", "Manager", "DeliveryLead"] : ["Department", "PrimaryDepartment", "OwningDepartment"]
    wb.eachSheet(s => { if (s.name === sheetName || s.name === "Audit") return; s.eachRow((r, n) => { if (n === 1) return; r.eachCell((c, col) => { if (referenceFields.includes(String(s.getRow(1).getCell(col).value)) && c.value === original[renameField]) c.value = next[renameField] }) }) })
  }
  const audit = wb.getWorksheet("Audit") ?? wb.addWorksheet("Audit")
  if (audit.rowCount === 0) audit.addRow(["AuditID", "Timestamp", "User", "RecordType", "RecordID", "Action", "PreviousValue", "NewValue", "Reason"])
  const redact = (value: unknown) => JSON.stringify(value, (key, v) => (key === "PasswordHash" || key.startsWith("Content")) ? "[redacted]" : v)
  audit.addRow([`AUD-${crypto.randomUUID()}`, new Date().toISOString(), actor, sheetName, String(next[view.headers[0]] ?? original?.[view.headers[0]] ?? row.number), archiving ? "Archive" : restoring ? "Restore" : action === "delete" ? "Delete" : rowNumber ? "Update" : "Add", redact(original ?? {}), action === "delete" && !archiving ? "" : redact(next), "Dashboard edit"])
  wb.calcProperties.fullCalcOnLoad = true
  const bytes = await wb.xlsx.writeBuffer()
  const output = new Uint8Array(bytes).buffer as ArrayBuffer
  const parsed = parseWorkbook(output, "edited.xlsx")
  if (parsed.issues.some(i => i.severity === "error")) throw new Error(parsed.issues.filter(i => i.severity === "error").map(i => `${i.worksheet} row ${i.row ?? "—"}, ${i.field ?? ""}: ${i.message}`).join("\n"))
  return output
}


