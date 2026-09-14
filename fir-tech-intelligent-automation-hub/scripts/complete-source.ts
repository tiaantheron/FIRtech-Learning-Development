import { readFileSync, writeFileSync } from "node:fs"
import ExcelJS from "exceljs"
import { SHEET_DEFS } from "../lib/models/schema"
import { parseWorkbook } from "../lib/services/parse"
async function main() {
  const path = "public/firtech_dashboard.xlsx"
  const workbook = new ExcelJS.Workbook()
  const input = readFileSync(path)
  await workbook.xlsx.load(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength))
  for (const name of ["Leads", "Revenue", "Certifications"]) {
    if (workbook.getWorksheet(name)) continue
    const sheet = workbook.addWorksheet(name)
    const schema = Object.values(SHEET_DEFS).find(s => s.sheet === name)!
    sheet.addRow(schema.columns.map(c => c.header))
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF216689" } }
    sheet.columns.forEach(c => { c.width = 23 })
    sheet.views = [{ state: "frozen", ySplit: 1 }]
  }
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const parsed = parseWorkbook(bytes.buffer, "firtech_dashboard.xlsx")
  if (!parsed.data) throw new Error(JSON.stringify(parsed.issues))
  writeFileSync(path, bytes)
  console.log("Detailed worksheet headers added; no business records invented.")
}
void main()

