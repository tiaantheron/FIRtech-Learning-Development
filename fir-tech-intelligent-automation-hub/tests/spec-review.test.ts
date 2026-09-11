import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as XLSX from "xlsx"
import { parseWorkbook } from "../lib/services/parse"
import { mutateWorkbook, readEditorSheet } from "../lib/services/workbook-editor"
import { assertWorkbookSaveable } from "../lib/services/save-checks"
import { engagementMetrics } from "../lib/calculations/metrics"
import { REPORTS } from "../lib/reports/reports"
const sourceBytes = readFileSync("public/firtech_dashboard.xlsx")
const source = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength)
const filters = { periodId: "all", departmentId: "all" }

test("unique PS recognises source UniqueCustomer flag without counting unqualified engagements", () => {
  const data = parseWorkbook(source, "reference.xlsx").data!
  assert.equal(engagementMetrics(data).uniqueProfessionalServices, 1)
  data.engagements[0].qualificationStatus = "Under review"
  assert.equal(engagementMetrics(data).uniqueProfessionalServices, 0)
})
test("save rejects invalid allocation, including small deviations, and excludes archived departments", () => {
  const result = parseWorkbook(source, "reference.xlsx")
  assert.doesNotThrow(() => assertWorkbookSaveable(result))
  result.data!.departments[0].revenueAllocationPct = .799
  assert.throws(() => assertWorkbookSaveable(result), /100%/)
  result.data!.departments[0].revenueAllocationPct = .8
  result.data!.departments[1].status = "Archived"
  result.data!.departments[0].revenueAllocationPct = .9
  assert.doesNotThrow(() => assertWorkbookSaveable(result))
})
test("audit is created when absent and cannot be edited through the mutation API", async () => {
  const workbook = XLSX.read(source); delete workbook.Sheets.Audit; workbook.SheetNames = workbook.SheetNames.filter(n => n !== "Audit")

  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  const row = readEditorSheet(bytes, "Training").rows[0]
  const updated = await mutateWorkbook(bytes, "Training", row.row, { ...row.values, Notes: "Reviewed" }, "save")
  assert.equal(readEditorSheet(updated, "Audit").rows.length, 1)
  await assert.rejects(mutateWorkbook(updated, "Audit", 2, {}, "delete"), /read-only/)
})
test("completed training needs a date and the reference editor can record it", async () => {
  const row = readEditorSheet(source, "Training").rows[0]
  await assert.rejects(mutateWorkbook(source, "Training", row.row, { ...row.values, Status: "Completed" }, "save"), /completion date/)
  const updated = await mutateWorkbook(source, "Training", row.row, { ...row.values, Status: "Completed", CompletedDate: "2026-09-10" }, "save")
  assert.equal(parseWorkbook(updated, "updated.xlsx").data!.trainingAssignments[0].completedDate, "2026-09-10")
})
test("gap and additional reports respect their advertised subsets", () => {
  const data = parseWorkbook(source, "reference.xlsx").data!
  const gaps = REPORTS.find(r => r.id === "resell-gap")!.build(data, filters)
  assert.ok(gaps.length); assert.ok(gaps.every(r => r.Status === "Outstanding"))
  assert.equal(REPORTS.find(r => r.id === "nps-csat")!.build(data, filters).length, 2)
  assert.equal(REPORTS.find(r => r.id === "pipeline-owner")!.build(data, { ...filters, employeeId: "PER-008" }).length, 1)
  assert.equal(REPORTS.find(r => r.id === "certifications-completed")!.build(data, filters).length, 0)
})
