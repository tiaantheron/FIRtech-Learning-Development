import { test } from "node:test"
import assert from "node:assert/strict"
import { amountInRand, displayAmount, originalCurrencyTotals } from "../lib/calculations/currency"
import { courseState, courseSummaries, isOutstandingCourse } from "../lib/calculations/courses"
import { parseWorkbook } from "../lib/services/parse"
import { readFileSync } from "node:fs"
import { readCloudWorkbook } from "../lib/services/cloud-workbook"

const file = readFileSync("public/firtech_dashboard.xlsx")
const source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)

test("source amounts stay separate by currency and Rand needs a documented rate", () => {
  const records = [
    { amount: 100, currency: "USD", reportingCurrency: "ZAR", exchangeRate: 18, exchangeRateDate: "2026-09-18", exchangeRateSource: "Test rate" },
    { amount: 50, currency: "ZAR" },
    { amount: 25, currency: "EUR" },
  ]
  assert.deepEqual(originalCurrencyTotals(records, record => record.amount), [
    { currency: "EUR", value: 25 }, { currency: "USD", value: 100 }, { currency: "ZAR", value: 50 },
  ])
  assert.equal(amountInRand(records[0].amount, records[0]), 1800)
  assert.equal(amountInRand(50, records[0]), 900)
  assert.equal(amountInRand(records[2].amount, records[2]), null)
  assert.match(displayAmount(100, records[0], "source"), /\$|USD/)
  assert.match(displayAmount(100, records[0], "ZAR"), /1\s?800/)
  assert.equal(displayAmount(25, records[2], "ZAR"), "No ZAR rate")
})

test("course cards classify completed, doing, planned and overdue source assignments", () => {
  const data = parseWorkbook(source, "reference.xlsx").data!
  const today = new Date().toISOString().slice(0, 10)
  data.trainingAssignments = [
    { assignmentId: "C-1", personId: data.people[0].personId, courseName: "Automation", status: "Completed", assignedDate: null, dueDate: null, completedDate: today },
    { assignmentId: "C-2", personId: data.people[1].personId, courseName: "Automation", status: "In Progress", assignedDate: null, dueDate: "2020-01-01", completedDate: null },
    { assignmentId: "C-3", personId: data.people[2].personId, courseName: "Automation", status: "Not Started", assignedDate: null, dueDate: null, completedDate: null },
    { assignmentId: "C-4", personId: data.people[2].personId, courseName: "Automation", status: "Waived", assignedDate: null, dueDate: null, completedDate: null },
  ]
  const course = courseSummaries(data, { departmentId: "all", periodId: "all" })[0]
  assert.equal(course.done, 1)
  assert.equal(course.doing, 1)
  assert.equal(course.planned, 1)
  assert.equal(course.overdue, 1)
  assert.equal(course.total, 3)
  assert.equal(courseState(data.trainingAssignments[0]), "done")
  assert.equal(isOutstandingCourse(data.trainingAssignments[0]), false)
})

test("development API module does not replace the bundled Excel workbook", async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response("export default function handler() {}", {
    headers: { "content-type": "text/javascript", etag: 'W/"module"' },
  })
  try {
    assert.equal(await readCloudWorkbook(), null)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("a missing SharePoint workbook opens the workbook-selection recovery path", async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response("Not found", { status: 404 })
  try {
    await assert.rejects(() => readCloudWorkbook(), /configured SharePoint workbook was not found/)
  } finally {
    globalThis.fetch = previousFetch
  }
})
