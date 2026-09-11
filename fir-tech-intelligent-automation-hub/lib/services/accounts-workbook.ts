import { USER_HEADERS, hashPassword, accounts } from "./permissions"
export async function ensureAccounts(bytes: ArrayBuffer) {
  if (accounts(bytes).some(a => a.Username.toLowerCase() === "admin")) return bytes
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes)
  const sheet = workbook.getWorksheet("Users") ?? workbook.addWorksheet("Users")
  if (sheet.rowCount === 0) sheet.addRow(USER_HEADERS)
  const values: Record<string, unknown> = { Username: "admin", PasswordHash: await hashPassword("admin"), Role: "Administrator", Departments: "*", ExportReports: true, ManagePathways: true, ManageUsers: true, Active: true }
  sheet.addRow((sheet.getRow(1).values as unknown[]).slice(1).map(h => values[String(h)] ?? ""))
  sheet.columns.forEach(c => { c.width = 24 }); sheet.getRow(1).font = { bold: true }
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer as ArrayBuffer
}
