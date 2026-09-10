import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as XLSX from "xlsx"
import { readEditorSheet, mutateWorkbook } from "../lib/services/workbook-editor"
import { parseWorkbook } from "../lib/services/parse"
import { pipelineMetrics, revenueMetrics } from "../lib/calculations/metrics"
import ExcelJS from "exceljs"
const bytes = readFileSync("public/firtech_dashboard.xlsx")
const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

test("edited foreign transaction retains original amount and documents ZAR conversion", async () => {
  const row = readEditorSheet(source, "Opportunities").rows[0]
  const output = await mutateWorkbook(source, "Opportunities", row.row, { ...row.values, EstimatedValue: 100, Currency: "USD", ReportingCurrency: "ZAR", ExchangeRate: 18.5, ExchangeRateDate: "2026-09-10", ExchangeRateSource: "Treasury approved rate" }, "save")
  const parsed = parseWorkbook(output, "edited.xlsx")
  assert.ok(parsed.data, JSON.stringify(parsed.issues))
  const transaction = parsed.data.opportunities[0]
  assert.equal(transaction.estimatedValue, 100); assert.equal(transaction.currency, "USD")
  assert.equal(transaction.convertedAmount, 1850); assert.equal(transaction.exchangeRate, 18.5)
  assert.equal(transaction.exchangeRateDate, "2026-09-10"); assert.equal(transaction.exchangeRateSource, "Treasury approved rate")
  assert.equal(pipelineMetrics(parsed.data).totalPipeline, 721850)
  assert.equal(pipelineMetrics(parsed.data, { departmentId: "all", periodId: "all" }, "USD").totalPipeline, 100)
  assert.equal(readEditorSheet(output, "Opportunities").rows[0].values.WeightedValue, 55)
})
test("incomplete conversions are rejected without altering the input workbook", async () => {
  const row = readEditorSheet(source, "Opportunities").rows[0]
  await assert.rejects(mutateWorkbook(source, "Opportunities", row.row, { ...row.values, Currency: "USD", ExchangeRate: 18, ExchangeRateDate: "2026-09-10", ExchangeRateSource: "" }, "save"), /rate source/)
  assert.equal(readEditorSheet(source, "Opportunities").rows[0].values.EstimatedValue, 850000)
})
test("add and remove records round-trip through Excel with no phantom blank records", async () => {
  const row = readEditorSheet(source, "Opportunities").rows[0]
  const added = await mutateWorkbook(source, "Opportunities", null, { ...row.values, RecordID: "OPP-NEW", Customer: "New customer" }, "save")
  const view = readEditorSheet(added, "Opportunities")
  assert.equal(view.rows.length, 5)
  const removed = await mutateWorkbook(added, "Opportunities", view.rows[4].row, view.rows[4].values, "delete")
  assert.equal(readEditorSheet(removed, "Opportunities").rows.length, 4)
  assert.equal(parseWorkbook(removed, "roundtrip.xlsx").data?.opportunities.length, 4)
})
test("renaming an employee updates linked names, while deleting a referenced employee is blocked", async () => {
  const row = readEditorSheet(source, "People").rows.find(r => r.values.FullName === "Sanveer")!
  const output = await mutateWorkbook(source, "People", row.row, { ...row.values, FullName: "Sanveer Updated" }, "save")
  assert.ok(readEditorSheet(output, "Memberships").rows.some(r => r.values.Person === "Sanveer Updated"))
  assert.ok(readEditorSheet(output, "Opportunities").rows.some(r => r.values.Owner === "Sanveer Updated"))
  await assert.rejects(mutateWorkbook(source, "People", row.row, row.values, "delete"), /unknown person|Owner must reference/i)
})
test("creating detailed revenue records extends reference workbook and updates ZAR totals", async () => {
  const output = await mutateWorkbook(source, "Revenue", null, { RevenueId: "REV-NEW", Customer: "Customer", Amount: 100, Currency: "EUR", OwnerDepartmentId: "DEP-001", RecognizedDate: "2026-09-10", Type: "Services", ReportingCurrency: "ZAR", ExchangeRate: 20, ExchangeRateDate: "2026-09-10", ExchangeRateSource: "Approved invoice rate" }, "save")
  const data = parseWorkbook(output, "extended.xlsx").data!
  assert.ok(data); assert.equal(data.revenue[0].currency, "EUR"); assert.equal(revenueMetrics(data).attainedZAR, 2000)
})
test("reference cell styles survive edits, audit is appended, derived remaining is updated", async () => {
  const row = readEditorSheet(source, "Requirements").rows[0]
  const output = await mutateWorkbook(source, "Requirements", row.row, { ...row.values, Attained: 800000 }, "save")
  const before = new ExcelJS.Workbook(), after = new ExcelJS.Workbook()
  await before.xlsx.load(source); await after.xlsx.load(output)
  assert.deepEqual(after.getWorksheet("Requirements")!.getCell("A1").style, before.getWorksheet("Requirements")!.getCell("A1").style)
  assert.equal(readEditorSheet(output, "Requirements").rows[0].values.Remaining, 2200000)
  assert.equal(readEditorSheet(output, "Audit").rows.length, readEditorSheet(source, "Audit").rows.length + 1)
  assert.ok(XLSX.read(output).Sheets.Settings)
})
