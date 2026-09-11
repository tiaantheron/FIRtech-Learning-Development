import * as XLSX from "xlsx"
import type { WorkbookData } from "../models/types"
import { filterWorkbook, personInDepartment } from "../calculations/filter"
export type Role = "Administrator" | "Contributor" | "Viewer"
export interface Account { Username: string; PasswordHash: string; Role: Role; Departments: string; ExportReports: boolean; ManagePathways: boolean; ManageUsers: boolean; Active: boolean }
export const GUEST: Account = { Username: "", PasswordHash: "", Role: "Viewer", Departments: "*", ExportReports: false, ManagePathways: false, ManageUsers: false, Active: true }
export const USER_HEADERS = ["Username", "PasswordHash", "Role", "Departments", "ExportReports", "ManagePathways", "ManageUsers", "Active"]
export function accounts(bytes: ArrayBuffer): Account[] {
  const sheet = XLSX.read(bytes).Sheets.Users
  const yes = (v: unknown) => v === true || String(v).toLowerCase() === "true"
  return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(r => ({ Username: String(r.Username ?? ""), PasswordHash: String(r.PasswordHash ?? ""), Role: r.Role as Role, Departments: String(r.Departments ?? ""), ExportReports: yes(r.ExportReports), ManagePathways: yes(r.ManagePathways), ManageUsers: yes(r.ManageUsers), Active: yes(r.Active) })) : []
}
export async function hashPassword(password: string, salt: string = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 210000 }, key, 256)
  return `pbkdf2$${salt}$${Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("")}`
}
export async function authenticate(bytes: ArrayBuffer, username: string, password: string) {
  const account = accounts(bytes).find(a => a.Active && a.Username.toLowerCase() === username.trim().toLowerCase())
  const salt = account?.PasswordHash.split("$")[1]
  if (!account || !salt || await hashPassword(password, salt) !== account.PasswordHash) throw new Error("Invalid username or password.")
  return account
}
export function canEditSheet(user: Account, sheet: string) {
  if (user.Role === "Administrator") return sheet !== "Audit"
  if (user.Role !== "Contributor") return false
  if (sheet === "Users") return user.ManageUsers
  if (["Requirements", "ResellRequirements", "ServicesRequirements", "Overrides"].includes(sheet)) return user.ManagePathways
  return ["Training", "TrainingAssignments", "Certifications", "Leads", "Opportunities", "Revenue", "Engagements", "Evidence"].includes(sheet)
}
export function scopeData(data: WorkbookData, user: Account): WorkbookData {
  if (user.Role === "Administrator" || user.Departments === "*") return data
  const ids = user.Departments.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  const slices = ids.map(departmentId => filterWorkbook(data, { departmentId, periodId: "all" }))
  const result = { ...data }
  for (const key of ["departments", "trainingAssignments", "certifications", "leads", "opportunities", "revenue", "engagements", "resellRequirements", "servicesRequirements"] as const) {
    Object.assign(result, { [key]: [...new Set(slices.flatMap(d => d[key] as object[]))] })
  }
  result.people = data.people.filter(p => ids.some(id => personInDepartment(data, p.personId, id)))
  result.departmentMemberships = data.departmentMemberships.filter(m => ids.includes(m.departmentId))
  result.overview = []
  result.overrides = data.overrides.filter(o => o.entityType === "Certification" ? result.certifications.some(c => c.certificationId === o.entityId) : o.entityType === "ResellRequirement" ? result.resellRequirements.some(r => r.requirementId === o.entityId) : o.entityType === "ServicesRequirement" && result.servicesRequirements.some(r => r.requirementId === o.entityId))
  return result
}
export function rowAllowed(user: Account, data: WorkbookData, sheet: string, values: Record<string, unknown>) {
  if (user.Role === "Administrator" || user.Departments === "*") return true
  if (user.Role === "Contributor" && user.ManagePathways && ["Requirements", "ResellRequirements", "ServicesRequirements", "Overrides"].includes(sheet)) return true
  const ids = user.Departments.split(/[,;]/).map(s => s.trim())
  if (["Training", "TrainingAssignments", "Certifications"].includes(sheet)) {
    const person = data.people.find(p => p.personId === values.PersonId || p.fullName === values.Person)
    return !!person && ids.some(id => personInDepartment(data, person.personId, id))
  }
  const dept = values.OwnerDepartmentId ?? values.DepartmentId ?? values.OwningDepartment
  return data.departments.some(d => ids.includes(d.departmentId) && (d.departmentId === dept || d.name === dept))
}
export function assertEdit(user: Account, data: WorkbookData, sheet: string, before: Record<string, unknown> | undefined, after: Record<string, unknown>, action: string) {
  if (!canEditSheet(user, sheet)) throw new Error("Your role cannot edit this worksheet.")
  if (user.Role === "Administrator") return
  if (action === "delete") throw new Error("Only administrators can remove or archive records.")
  if (sheet === "Users" && user.ManageUsers || ["Requirements", "ResellRequirements", "ServicesRequirements", "Overrides"].includes(sheet) && user.ManagePathways) return
  if ((before && !rowAllowed(user, data, sheet, before)) || !rowAllowed(user, data, sheet, after)) throw new Error("This record is outside your permitted departments.")
}



