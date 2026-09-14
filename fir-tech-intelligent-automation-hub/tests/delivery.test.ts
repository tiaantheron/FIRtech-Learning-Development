import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mutateWorkbook, undoWorkbook, readEditorSheet } from "../lib/services/workbook-editor"
import { parseWorkbook } from "../lib/services/parse"
import { assertWorkbookSaveable } from "../lib/services/save-checks"
import { revenueMetrics, certMetrics, trainingMetrics } from "../lib/calculations/metrics"
const bytes = readFileSync("public/firtech_dashboard.xlsx")
const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

test("delivery gate: add, edit, validate, export/reload and undo preserve stable IDs and audit", async () => {
  const values = { RevenueId: "QA-GATE-REV", Customer: "QA mock customer", Amount: 500, Currency: "ZAR", OwnerDepartmentId: "DEP-001", RecognizedDate: "2026-09-11", Type: "Services" }
  const added = await mutateWorkbook(source, "Revenue", null, values, "save", "System administrator")
  const row = readEditorSheet(added, "Revenue").rows.find(r => r.values.RevenueId === values.RevenueId)!
  await assert.rejects(mutateWorkbook(added, "Revenue", row.row, { ...row.values, RevenueId: "CHANGED" }, "save"), /immutable/)
  await assert.rejects(mutateWorkbook(added, "Revenue", row.row, { ...row.values, Amount: -100 }, "save"), /negative/)
  const edited = await mutateWorkbook(added, "Revenue", row.row, { ...row.values, Amount: 750, Currency: "USD", ReportingCurrency: "ZAR", ExchangeRate: 18, ExchangeRateDate: "2026-09-11", ExchangeRateSource: "QA mock rate" }, "save", "System administrator")
  const parsed = parseWorkbook(edited, "exported.xlsx")
  assertWorkbookSaveable(parsed)
  assert.equal(revenueMetrics(parsed.data!).attainedZAR, 13500)
  const directory = mkdtempSync(join(tmpdir(), "firtech-qa-"))
  try {
    const path = join(directory, "exported.xlsx"); writeFileSync(path, new Uint8Array(edited))
    const file = readFileSync(path); const reloaded = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
    assert.equal(readEditorSheet(reloaded, "Revenue").rows.find(r => r.values.RevenueId === values.RevenueId)!.values.ConvertedAmount, 13500)
    assert.equal(readEditorSheet(reloaded, "Audit").rows.at(-1)!.values.RecordID, values.RevenueId)
    const reverted = await undoWorkbook(added, reloaded, "System administrator")
    assert.equal(revenueMetrics(parseWorkbook(reverted, "undo.xlsx").data!).attainedZAR, 500)
    const audit = readEditorSheet(reverted, "Audit").rows
    assert.equal(audit.length, readEditorSheet(reloaded, "Audit").rows.length + 1)
    assert.equal(audit.at(-1)!.values.Action, "Undo")
    assert.equal(audit.at(-2)!.values.Action, "Update")
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test("default source has labelled draft data and empty detailed source sheets with usable headers", () => {
  for (const name of ["Leads", "Revenue", "Certifications"]) {
    const view = readEditorSheet(source, name)
    assert.ok(view.headers.length > 5); assert.equal(view.rows.length, 0)
  }
  assert.match(parseWorkbook(source, "reference.xlsx").data!.overview.find(s => s.key === "DataStatus")!.value, /mock|draft/i)
})

test("learning states distinguish outstanding, overdue, expired and expiring", () => {
  const data = parseWorkbook(source, "source.xlsx").data!
  const date = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  data.overrides = []
  data.certifications = [
    { certificationId: "QA-C1", personId: "PER-001", certName: "Expiring", status: "Active", issueDate: date(-30), expiryDate: date(30), uiPathCertCode: "" },
    { certificationId: "QA-C2", personId: "PER-001", certName: "Expired", status: "Passed", issueDate: date(-30), expiryDate: date(-1), uiPathCertCode: "" },
    { certificationId: "QA-C3", personId: "PER-001", certName: "Outstanding", status: "Scheduled", issueDate: null, expiryDate: null, uiPathCertCode: "" },
  ]
  assert.deepEqual(certMetrics(data), { completed: 1, expiring: 1, expired: 1, inProgress: 1, outstanding: 2, total: 3 })
  data.trainingAssignments = [{ assignmentId: "QA-T1", personId: "PER-001", courseName: "Overdue", status: "In Progress", assignedDate: date(-10), dueDate: date(-1), completedDate: null }]
  assert.equal(trainingMetrics(data).outstanding, 1)
  assert.equal(trainingMetrics(data).overdue, 1)
})
