import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DataTable } from "../components/data-table"
test("large tables initially render 25 rows rather than the entire workbook", () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ name: `Record-${i + 1}` }))
  const html = renderToStaticMarkup(createElement(DataTable, { rows, columns: [{ key: "name", header: "Name", sortable: true }] }))
  assert.equal((html.match(/<tr[ >]/g) ?? []).length, 26)
  assert.ok(html.includes("Record-25")); assert.ok(!html.includes("Record-26"))
  assert.ok(html.includes("of 1000 records"))
})
