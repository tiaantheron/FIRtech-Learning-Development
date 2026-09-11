import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as XLSX from "xlsx"
import { accounts, authenticate, GUEST, assertEdit, scopeData, hashPassword, canEditSheet } from "../lib/services/permissions"
import { parseWorkbook } from "../lib/services/parse"
import { mutateWorkbook, readEditorSheet } from "../lib/services/workbook-editor"
const bytes = readFileSync("public/firtech_dashboard.xlsx")
const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const data = parseWorkbook(source, "reference.xlsx").data!

test("guest is read-only, contributors cannot cross departments or edit configuration", () => {
  const row = readEditorSheet(source, "Opportunities").rows[0].values
  const department = data.departments.find(d => d.name === row.OwningDepartment)!
  const editor = { ...GUEST, Username: "editor", Role: "Contributor" as const, Departments: department.departmentId }
  assert.throws(() => assertEdit(GUEST, data, "Opportunities", row, row, "save"), /cannot edit/)
  assert.doesNotThrow(() => assertEdit(editor, data, "Opportunities", row, row, "save"))
  assert.throws(() => assertEdit(editor, data, "Opportunities", row, { ...row, OwningDepartment: "OTHER" }, "save"), /permitted/)
  assert.throws(() => assertEdit(editor, data, "Opportunities", { ...row, OwningDepartment: "OTHER" }, row, "save"), /permitted/)
  assert.throws(() => assertEdit(editor, data, "Opportunities", row, row, "delete"), /administrators/)
  for (const sheet of ["Users", "Settings", "Departments", "People", "Requirements", "Overrides", "ReportingPeriods", "Audit"]) assert.equal(canEditSheet(editor, sheet), false)
  assert.equal(canEditSheet({ ...editor, ManagePathways: true }, "Requirements"), true)
  assert.equal(canEditSheet({ ...editor, ManageUsers: true }, "Users"), true)
  const scoped = scopeData(data, editor)
  assert.equal(scoped.departments.length, 1)
  assert.ok(scoped.opportunities.every(o => o.departmentId === department.departmentId))
  assert.equal(scoped.overview.length, 0)
  assert.equal(scopeData(data, { ...editor, Departments: "" }).people.length, 0)
})

test("built-in account authenticates from the source and is absent from business records", async () => {
  const admin = await authenticate(source, "admin", "admin")
  assert.equal(admin.Role, "Administrator")
  assert.ok(accounts(source).find(a => a.Username === "admin")?.PasswordHash.startsWith("pbkdf2$"))
  await assert.rejects(authenticate(source, "admin", "incorrect"), /Invalid/)
  assert.ok(!data.people.some(p => p.fullName.toLowerCase() === "admin"))
  const row = readEditorSheet(source, "Users").rows.find(r => r.values.Username === "admin")!
  await assert.rejects(mutateWorkbook(source, "Users", row.row, row.values, "delete"), /cannot be modified/)
})

test("user permissions round-trip and audit omits password hashes", async () => {
  const values = { Username: "test-editor", PasswordHash: await hashPassword("test-password"), Role: "Contributor", Departments: "DEP-001", ExportReports: true, ManagePathways: false, ManageUsers: false, Active: true }
  const updated = await mutateWorkbook(source, "Users", null, values, "save", "System administrator")
  const user = await authenticate(updated, "test-editor", "test-password")
  assert.equal(user.Role, "Contributor"); assert.equal(user.Departments, "DEP-001")
  const audit = readEditorSheet(updated, "Audit").rows.at(-1)!.values
  assert.equal(audit.User, "System administrator")
  assert.ok(!String(audit.NewValue).includes(values.PasswordHash))
  const row = readEditorSheet(updated, "Users").rows.find(r => r.values.Username === "test-editor")!
  const inactive = await mutateWorkbook(updated, "Users", row.row, { ...values, Active: false }, "save")
  await assert.rejects(authenticate(inactive, "test-editor", "test-password"), /Invalid/)
})

test("evidence round-trips with notes and is excluded from ordinary data sheets", async () => {
  const output = await mutateWorkbook(source, "Evidence", null, { EvidenceId: "E-1", DepartmentId: "DEP-001", RecordId: "OPP-1", FileName: "proof.txt", ContentType: "text/plain", Content1: btoa("Supporting proof"), Notes: "Reviewed" }, "save", "System administrator")
  const row = readEditorSheet(output, "Evidence").rows[0]
  assert.equal(atob(String(row.values.Content1)), "Supporting proof")
  assert.equal(row.values.Notes, "Reviewed")
  assert.deepEqual(XLSX.read(output).Sheets.People.A2.v, XLSX.read(source).Sheets.People.A2.v)
  assert.ok(!String(readEditorSheet(output, "Audit").rows.at(-1)!.values.NewValue).includes(btoa("Supporting proof")))
})
