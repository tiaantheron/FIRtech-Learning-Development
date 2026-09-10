import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import * as XLSX from "xlsx"
import { parseWorkbook } from "../lib/services/parse"
import { filterWorkbook, applyOverrides } from "../lib/calculations/filter"
import { certMetrics, isCertValid, pipelineMetrics, revenueMetrics, weightedValue, remainingValue, departmentPerformance } from "../lib/calculations/metrics"
import { REPORTS } from "../lib/reports/reports"
import { exportSourceWorkbook } from "../lib/services/export"

const fixtureDirectory = mkdtempSync(join(tmpdir(), "firtech-test-"))
const fixturePath = join(fixtureDirectory, "fixture.xlsx")
execFileSync(process.execPath, ["scripts/generate-workbook.mjs", fixturePath])
const source = readFileSync(fixturePath)
unlinkSync(fixturePath)
rmdirSync(fixtureDirectory)
function parse(bytes: Uint8Array = source) { return parseWorkbook(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "test.xlsx") }
function changed(sheet: string, cell: string, value: string | number) {
  const wb = XLSX.read(source)
  wb.Sheets[sheet][cell] = { t: typeof value === "number" ? "n" : "s", v: value }
  return parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}
function data() { const result = parse(); assert.ok(result.data, JSON.stringify(result.issues)); return result.data }

test("sample parses all 14 worksheets and preserves supplied totals", () => {
  const d = data(); assert.equal(Object.keys(d).length, 14)
  assert.equal(d.resellRequirements[0].attainedValue, 420000)
  assert.equal(d.servicesRequirements[2].attainedValue, 310000)
})
test("malformed numbers, currency, dates and duplicate IDs block calculations", () => {
  for (const [sheet, cell, value] of [["Revenue", "C2", "abc"], ["Revenue", "D2", "INVALID"], ["ReportingPeriods", "C2", "2026-02-30"], ["People", "A3", "P-001"]]) {
    const r = changed(sheet, cell, value); assert.equal(r.data, null); assert.ok(r.issues.some(i => i.severity === "error" && i.worksheet === sheet))
  }
})
test("explicit 1% is one percent, invalid booleans are errors", () => {
  const result = changed("Opportunities", "H2", "1%")
  assert.equal(result.data?.opportunities[0].probability, .01)
  assert.equal(changed("ReportingPeriods", "E2", "maybe").data, null)
})
test("USD pipeline never contributes to ZAR and closed stages override probability", () => {
  const d = data(); const o = { ...d.opportunities[0], estimatedValue: 100, currency: "USD" as const, probability: .25, stage: "Proposal" }
  d.opportunities = [o, { ...o, opportunityId: "second", currency: "ZAR", estimatedValue: 200 }]
  assert.equal(pipelineMetrics(d).totalPipeline, 200)
  assert.equal(pipelineMetrics(d, { departmentId: "all", periodId: "all" }, "USD").weightedPipeline, 25)
  assert.equal(weightedValue({ ...o, stage: "Closed Won" }), 100)
  assert.equal(weightedValue({ ...o, stage: "Closed Lost" }), 0)
})
test("expired certificates require a positive explicit override", () => {
  const d = data(); const c = d.certifications.find(c => c.status === "Expired")!
  assert.equal(isCertValid(d, c), true)
  d.overrides[0].value = "Failed"; assert.equal(isCertValid(d, c), false)
  d.overrides = []; assert.equal(isCertValid(d, c), false)
})
test("memberships filter training without duplicating employees", () => {
  const d = data(); d.people[4].secondaryDepartmentIds = []
  d.departmentMemberships.push({ membershipId: "new", personId: "P-005", departmentId: "DEP-SALES", isPrimary: false, role: "Support" })
  const filtered = filterWorkbook(d, { periodId: "all", departmentId: "DEP-SALES" })
  assert.ok(filtered.trainingAssignments.some(t => t.personId === "P-005"))
  assert.equal(filtered.people.length, d.people.length)
})
test("revenue attributes to owner once and reports respect period", () => {
  const d = data(); const all = revenueMetrics(d)
  const total = d.departments.reduce((sum, dep) => sum + revenueMetrics(d, { periodId: "all", departmentId: dep.departmentId }).attainedZAR, 0)
  assert.equal(all.attainedZAR, total)
  const report = REPORTS.find(r => r.id === "revenue-performance")!
  const rows = report.build(d, { periodId: "FY26-Q2", departmentId: "all" })
  assert.ok(rows.every(r => !r.Recognized || (r.Recognized >= "2025-07-01" && r.Recognized <= "2025-09-30")))
})
test("employee report filtering applies to exports and requirement overrides are explicit", () => {
  const d = data(); const report = REPORTS.find(r => r.id === "training-outstanding")!
  const rows = report.build(d, { periodId: "all", departmentId: "all", employeeId: "P-005" })
  assert.ok(rows.length > 0); assert.ok(rows.every(r => r.Person === "Sarah Nkosi"))
  d.overrides.push({ overrideId: "test", entityType: "ResellRequirement", entityId: "RR-01", field: "attainedValue", value: "500001", reason: "Approved reconciliation" })
  assert.equal(applyOverrides(d).resellRequirements[0].attainedValue, 500001)
  assert.equal(remainingValue(applyOverrides(d).resellRequirements[0]), 0)
  assert.equal(d.resellRequirements[0].attainedValue, 420000)
})

test("missing sheets report structural errors instead of returning partial dashboards", () => {
  const wb = XLSX.read(source); delete wb.Sheets.People; wb.SheetNames = wb.SheetNames.filter(s => s !== "People")
  const result = parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
  assert.equal(result.data, null); assert.ok(result.issues.some(i => i.worksheet === "People" && i.row === null))
})
test("physical row numbers survive blank rows", () => {
  const wb = XLSX.read(source); const rows = XLSX.utils.sheet_to_json(wb.Sheets.Revenue, { header: 1 }) as unknown[][]
  rows.splice(1, 0, []); rows[2][2] = "bad value"; wb.Sheets.Revenue = XLSX.utils.aoa_to_sheet(rows)
  const result = parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
  assert.ok(result.issues.some(i => i.worksheet === "Revenue" && i.field === "Amount" && i.row === 3))
})
test("invalid overrides and duplicate revenue block import", () => {
  assert.equal(changed("Overrides", "E2", "invalid status").data, null)
  const wb = XLSX.read(source); const rows = XLSX.utils.sheet_to_json(wb.Sheets.Revenue) as Record<string, unknown>[]
  rows.push({ ...rows[0], RevenueId: "new-id" }); wb.Sheets.Revenue = XLSX.utils.json_to_sheet(rows)
  const result = parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
  assert.equal(result.data, null); assert.ok(result.issues.some(i => i.message.includes("double-counted")))
})
test("department engagement attribution never repeats the company total", () => {
  const d = data(); const perf = departmentPerformance(d)
  assert.equal(perf.reduce((sum, p) => sum + p.qualifyingEngagements, 0), 3)
  assert.equal(perf.find(p => p.departmentId === "DEP-SALES")?.qualifyingEngagements, 0)
})

test("user reference imports with exact pathway totals and memberships", () => {
  const r = parse(readFileSync("public/firtech_dashboard.xlsx")); assert.ok(r.data, JSON.stringify(r.issues))
  assert.equal(r.data.resellRequirements.length, 9); assert.equal(r.data.servicesRequirements.length, 7)
  assert.equal(r.data.resellRequirements[0].attainedValue, 600000)
  assert.equal(r.data.people.length, 11); assert.equal(r.data.departmentMemberships.length, 5)
  assert.equal(r.data.revenue.length, 0); assert.equal(r.data.certifications.length, 0)
  assert.equal(pipelineMetrics(r.data).weightedPipeline, 695500)
  assert.equal(filterWorkbook(r.data, { departmentId: "DEP-005", periodId: "all" }).resellRequirements.length, 3)
})
test("reference validation points to original source sheet and physical row", () => {
  const wb = XLSX.read(readFileSync("public/firtech_dashboard.xlsx")); wb.Sheets.Requirements.E12 = { t: "s", v: "bad" }
  const r = parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
  assert.equal(r.data, null)
  assert.ok(r.issues.some(i => i.worksheet === "Requirements" && i.row === 12 && i.field === "Attained"), JSON.stringify(r.issues))
})
test("reference missing columns are errors and the default currency is ZAR", () => {
  const bytes = readFileSync("public/firtech_dashboard.xlsx")
  const r = parseWorkbook(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "reference.xlsx")
  assert.ok(r.data); assert.equal(pipelineMetrics(r.data).totalPipeline, 1570000)
  assert.equal(pipelineMetrics(r.data, { departmentId: "all", periodId: "all" }, "USD").totalPipeline, 0)
  const wb = XLSX.read(bytes); delete wb.Sheets.Training.C1
  // Required Course header is column E in this reference.
  delete wb.Sheets.Training.E1
  assert.equal(parse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })).data, null)
})

test("Excel source export preserves the exact reference bytes and filename", async () => {
  const bytes = readFileSync("public/firtech_dashboard.xlsx")
  const file = new File([bytes], "firtech_dashboard.xlsx")
  const anchor = { href: "", download: "", click() {} }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => anchor, body: { appendChild() {}, removeChild() {} } } })
  try {
    exportSourceWorkbook(file)
    assert.equal(anchor.download, "firtech_dashboard-export.xlsx")
    const exported = await fetch(anchor.href).then(response => response.arrayBuffer())
    assert.deepEqual(Buffer.from(exported), bytes)
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous)
    else Reflect.deleteProperty(globalThis, "document")
  }
})
