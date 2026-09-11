import * as XLSX from "xlsx"
import { SHEET_DEFS, type ColumnDef, type SheetDef } from "@/lib/models/schema"
import type { ParseResult, ValidationIssue, WorkbookData } from "@/lib/models/types"
import { validateWorkbook } from "@/lib/validation/validate"
import { adaptReferenceWorkbook } from "./reference-workbook"

function excelDateToISO(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    // Excel serial date -> JS date
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
      return d.toISOString().slice(0, 10)
    }
  }
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const asDate = new Date(text + "T00:00:00Z")
  if (!Number.isNaN(asDate.getTime()) && asDate.toISOString().slice(0, 10) === text) return text
  return null
}

function coerceValue(
  raw: unknown,
  col: ColumnDef,
  sheet: string,
  rowNumber: number,
  issues: ValidationIssue[],
): unknown {
  const empty = raw === null || raw === undefined || String(raw).trim() === ""
  if (empty && col.key === "currency") return "ZAR"

  if (col.required && col.unique && empty) {
    issues.push({
      severity: "error",
      worksheet: sheet,
      row: rowNumber,
      field: col.header,
      message: `Required field "${col.header}" is missing.`,
    })
  }

  switch (col.type) {
    case "string":
      return empty ? "" : String(raw).trim()
    case "list":
      return empty
        ? []
        : String(raw)
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean)
    case "number": {
      if (empty) return 0
      const n = typeof raw === "number" ? raw : Number(String(raw).trim())
      if (!Number.isFinite(n)) {
        issues.push({
          severity: "error",
          worksheet: sheet,
          row: rowNumber,
          field: col.header,
          message: `"${col.header}" must be a number but got "${raw}".`,
        })
        return 0
      }
      return n
    }
    case "percent": {
      if (empty) return 0
      let n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/%$/, ""))
      if (!Number.isFinite(n)) {
        issues.push({
          severity: "error",
          worksheet: sheet,
          row: rowNumber,
          field: col.header,
          message: `"${col.header}" must be a percentage but got "${raw}".`,
        })
        return 0
      }
      // Normalise to 0..1. Values above 1 are treated as whole percentages.
      if (String(raw).trim().endsWith("%") || n > 1) n = n / 100
      if (n < 0 || n > 1) {
        issues.push({
          severity: "error",
          worksheet: sheet,
          row: rowNumber,
          field: col.header,
          message: `"${col.header}" is outside the 0-100% range (${raw}).`,
        })
      }
      return n
    }
    case "boolean": {
      if (empty) return false
      const s = String(raw).trim().toLowerCase()
      if (!["true", "false", "yes", "no", "y", "n", "1", "0"].includes(s)) issues.push({ severity: "error", worksheet: sheet, row: rowNumber, field: col.header, message: `Invalid boolean: ${raw}` })
      return s === "true" || s === "yes" || s === "y" || s === "1"
    }
    case "date": {
      if (empty) return null
      const iso = excelDateToISO(raw)
      if (!iso) {
        issues.push({
          severity: "error",
          worksheet: sheet,
          row: rowNumber,
          field: col.header,
          message: `"${col.header}" is not a valid date (${raw}).`,
        })
      }
      return iso
    }
    default:
      return raw
  }
}

function parseSheet(
  workbook: XLSX.WorkBook,
  def: SheetDef,
  issues: ValidationIssue[],
): Record<string, unknown>[] {
  const ws = workbook.Sheets[def.sheet]
  if (!ws) {
    issues.push({
      severity: "error",
      worksheet: def.sheet,
      row: null,
      field: null,
      message: `Required worksheet "${def.sheet}" is missing from the workbook.`,
    })
    return []
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true })
  const presentHeaders = new Set(rows.length > 0 ? Object.keys(rows[0]) : headerRow(ws))

  for (const col of def.columns) {
    if (!col.optional && !presentHeaders.has(col.header)) {
      issues.push({
        severity: "error",
        worksheet: def.sheet,
        row: null,
        field: col.header,
        message: `Required column "${col.header}" is missing from worksheet "${def.sheet}".`,
      })
    }
  }

  const seenUnique: Record<string, Set<string>> = {}
  const parsed: Record<string, unknown>[] = []

  rows.forEach((row, idx) => {
    const rowNumber = typeof row.__rowNum__ === "number" ? row.__rowNum__ + 1 : idx + 2
    const obj: Record<string, unknown> = {}
    Object.defineProperty(obj, "__hasConversion", { value: ["ExchangeRate", "ConvertedAmount", "ExchangeRateDate", "ExchangeRateSource"].some(key => row[key] != null && String(row[key]).trim() !== ""), enumerable: false })
    Object.defineProperty(obj, "__rowNum__", { value: rowNumber, enumerable: false })
    for (const col of def.columns) {
      const value = coerceValue(row[col.header], col, def.sheet, rowNumber, issues)
      obj[col.key] = value
      if (col.unique) {
        const set = (seenUnique[col.key] ??= new Set())
        const strVal = String(value)
        if (strVal && set.has(strVal)) {
          issues.push({
            severity: "error",
            worksheet: def.sheet,
            row: rowNumber,
            field: col.header,
            message: `Duplicate value "${strVal}" for unique column "${col.header}".`,
          })
        }
        set.add(strVal)
      }
    }
    parsed.push(obj)
  })

  return parsed
}

function headerRow(ws: XLSX.WorkSheet): string[] {
  const ref = ws["!ref"]
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const headers: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]
    if (cell && cell.v != null) headers.push(String(cell.v).trim())
  }
  return headers
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string): ParseResult {
  const issues: ValidationIssue[] = []
  let data: WorkbookData | null = null
  let remapIssue: ((issue: ValidationIssue) => ValidationIssue) | undefined
  let referenceIssueCount = 0

  try {
    let workbook = XLSX.read(buffer, { type: "array", cellDates: true })
    if (workbook.Sheets.Settings && workbook.Sheets.Requirements && !workbook.Sheets.Overview) {
      const adapted = adaptReferenceWorkbook(workbook)
      workbook = adapted.workbook
      issues.push(...adapted.issues)
      referenceIssueCount = issues.length
      remapIssue = adapted.remapIssue
    }

    const raw = {
      overview: parseSheet(workbook, SHEET_DEFS.overview, issues),
      departments: parseSheet(workbook, SHEET_DEFS.departments, issues),
      people: parseSheet(workbook, SHEET_DEFS.people, issues),
      departmentMemberships: parseSheet(workbook, SHEET_DEFS.departmentMemberships, issues),
      trainingAssignments: parseSheet(workbook, SHEET_DEFS.trainingAssignments, issues),
      certifications: parseSheet(workbook, SHEET_DEFS.certifications, issues),
      leads: parseSheet(workbook, SHEET_DEFS.leads, issues),
      opportunities: parseSheet(workbook, SHEET_DEFS.opportunities, issues),
      revenue: parseSheet(workbook, SHEET_DEFS.revenue, issues),
      engagements: parseSheet(workbook, SHEET_DEFS.engagements, issues),
      resellRequirements: parseSheet(workbook, SHEET_DEFS.resellRequirements, issues),
      servicesRequirements: parseSheet(workbook, SHEET_DEFS.servicesRequirements, issues),
      overrides: parseSheet(workbook, SHEET_DEFS.overrides, issues),
      reportingPeriods: parseSheet(workbook, SHEET_DEFS.reportingPeriods, issues),
    }

    data = raw as unknown as WorkbookData

    // Cross-sheet business validation (only meaningful if structure parsed)
    const structuralErrors = issues.filter((i) => i.severity === "error" && i.row === null)
    if (structuralErrors.length === 0) {
      issues.push(...validateWorkbook(data))
    }
  } catch (err) {
    issues.push({
      severity: "error",
      worksheet: "(workbook)",
      row: null,
      field: null,
      message: `Failed to read workbook: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  return {
    data: issues.some((issue) => issue.severity === "error") ? null : data,
    issues: issues.map((issue, i) => remapIssue && i >= referenceIssueCount ? remapIssue(issue) : issue),
    loadedAt: new Date().toISOString(),
    fileName,
  }
}


