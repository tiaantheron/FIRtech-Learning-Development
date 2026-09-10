import * as XLSX from "xlsx"
import { SHEET_DEFS, FX_COLUMNS } from "@/lib/models/schema"
import type { ValidationIssue } from "@/lib/models/types"

// Adapt the user's presentation workbook without changing the original file.
export function adaptReferenceWorkbook(source: XLSX.WorkBook) {
  const currency = "ZAR"
  const issues: ValidationIssue[] = []
  const rows = (name: string) => XLSX.utils.sheet_to_json<Record<string, string | number>>(source.Sheets[name] ?? {}, { defval: "" })
  const required: Record<string, string[]> = {
    Settings: ["Setting", "Value"], Departments: ["DepartmentID", "Department", "RevenueAllocation", "RevenueTarget", "LeadTarget", "OpportunityTarget"],
    People: ["PersonID", "FullName", "PrimaryDepartment"], Memberships: ["MembershipID", "Person", "Department"],
    Requirements: ["RequirementID", "Pathway", "Requirement", "Required", "Attained", "Owner", "Department", "DueDate", "Status"],
    Training: ["AssignmentID", "Person", "Course", "DueDate", "Status"],
    Opportunities: ["RecordID", "Customer", "Opportunity", "OwningDepartment", "Owner", "Stage", "EstimatedValue", "Probability", "ExpectedClose"],
    Engagements: ["EngagementID", "Customer", "Engagement", "Type", "OwningDepartment", "QualificationStatus"], Audit: ["AuditID"],
  }
  for (const [sheet, columns] of Object.entries(required)) {
    if (!source.Sheets[sheet]) { issues.push({ severity: "error", worksheet: sheet, row: null, field: null, message: `Missing reference worksheet: ${sheet}` }); continue }
    const headers = (XLSX.utils.sheet_to_json(source.Sheets[sheet], { header: 1 }) as unknown[][])[0] ?? []
    for (const field of columns) if (!headers.includes(field)) issues.push({ severity: "error", worksheet: sheet, row: 1, field, message: `Missing reference column: ${field}` })
  }
  rows("Requirements").forEach((r, i) => {
    if (!["Resell", "Services"].includes(String(r.Pathway))) issues.push({ severity: "error", worksheet: "Requirements", row: Number(r.__rowNum__ ?? i + 1) + 1, field: "Pathway", message: "Pathway must be Resell or Services." })
  })
  const departments = rows("Departments"), people = rows("People")
  const department = (name: unknown) => departments.find(d => d.Department === name || d.DepartmentID === name)?.DepartmentID ?? name ?? ""
  const person = (name: unknown) => people.find(p => p.FullName === name || p.PersonID === name)?.PersonID ?? name ?? ""
  const title = (value: unknown) => String(value).toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  const settings = rows("Settings")
  const fx = (r: Record<string, string | number>) => Object.fromEntries(FX_COLUMNS.map(c => [c.header, r[c.header] ?? '']))
  const mapped: Record<string, Record<string, unknown>[]> = {
    Overview: settings.map(r => ({ Key: r.Setting, Value: r.Value })),
    Departments: departments.map(r => ({ DepartmentId: r.DepartmentID, Name: r.Department, Head: r.Head, RevenueAllocationPct: r.RevenueAllocation, RevenueTargetZAR: r.RevenueTarget, LeadTarget: r.LeadTarget, OpportunityTarget: r.OpportunityTarget })),
    People: people.map(r => ({ PersonId: r.PersonID, FullName: r.FullName, JobTitle: r.JobTitle, PrimaryDepartmentId: department(r.PrimaryDepartment), SecondaryDepartmentIds: "", ManagerId: person(r.Manager), EmploymentStatus: r.EmploymentStatus, UiPathId: "" })),
    DepartmentMemberships: rows("Memberships").filter(r => !r.Status || r.Status === "Active").map(r => ({ MembershipId: r.MembershipID, PersonId: person(r.Person), DepartmentId: department(r.Department), Role: r.Role, IsPrimary: false })),
    TrainingAssignments: rows("Training").map(r => ({ AssignmentId: r.AssignmentID, PersonId: person(r.Person), CourseName: r.Course, Status: title(r.Status) === "Overdue" ? "In Progress" : title(r.Status), AssignedDate: "", DueDate: r.DueDate, CompletedDate: "" })),
    Opportunities: rows("Opportunities").map(r => ({ ...fx(r), OpportunityId: r.RecordID, Customer: r.Customer, Name: r.Opportunity, Owner: person(r.Owner), DepartmentId: department(r.OwningDepartment), EstimatedValue: r.EstimatedValue, Currency: r.Currency || currency, Probability: r.Probability, Stage: title(r.Stage), CloseDate: r.ExpectedClose })),
    Engagements: rows("Engagements").map(r => ({ ...fx(r), EngagementId: r.EngagementID, Customer: r.Customer, Name: r.Engagement, Type: String(r.Type).toLowerCase().includes("resell") ? "Resell Customer Engagement" : String(r.Type).toLowerCase().includes("professional services") ? "Professional Services Engagement" : r.Type, DepartmentId: department(r.OwningDepartment), Owner: person(r.DeliveryLead), QualificationStatus: r.QualificationStatus === "Qualifies" ? "Qualified" : r.QualificationStatus, ContractValue: r.ContractValue ?? 0, Currency: r.Currency || currency, NPSStatus: r.NPS, CSATStatus: r.CSAT, Date: r.Date ?? "" })),
  }
  for (const pathway of ["Resell", "Services"]) {
    mapped[pathway + "Requirements"] = rows("Requirements").filter(r => r.Pathway === pathway).map(r => ({ RequirementId: r.RequirementID, Requirement: r.Requirement, RequiredValue: r.Required, AttainedValue: r.Attained, Unit: String(r.Requirement).includes("USD") ? "USD" : "", Owner: r.Owner, DepartmentId: department(r.Department), DueDate: r.DueDate, Status: r.Notes === "Maintain" ? "Maintain" : r.Status === "At risk" ? "Outstanding" : r.Status }))
  }
  const periodName = String(settings.find(r => r.Setting === "ReportingPeriod")?.Value ?? "")
  const quarter = /^(\d{4}) Q([1-4])$/.exec(periodName)
  if (quarter) {
    const year = Number(quarter[1]), month = (Number(quarter[2]) - 1) * 3
    mapped.ReportingPeriods = [{ PeriodId: periodName, Name: periodName, StartDate: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), EndDate: new Date(Date.UTC(year, month + 3, 0)).toISOString().slice(0, 10), Active: true }]
  }
  const workbook = XLSX.utils.book_new()
  for (const def of Object.values(SHEET_DEFS)) XLSX.utils.book_append_sheet(workbook, !mapped[def.sheet] && source.Sheets[def.sheet] ? source.Sheets[def.sheet] : XLSX.utils.json_to_sheet(mapped[def.sheet] ?? [], { header: def.columns.map(c => c.header) }), def.sheet)
  issues.push({ severity: "warning", worksheet: "Settings", row: null, field: "Currency", message: "Amounts without a currency default to ZAR. Original currencies and supplied USD requirement totals are retained. Only documented conversions enter ZAR reporting totals." })
  const missing = ["Revenue", "Leads", "Certifications"].filter(name => !source.Sheets[name])
  if (missing.length) issues.push({ severity: "warning", worksheet: "Settings", row: null, field: null, message: `No detailed ${missing.join(", ")} sheets supplied. These inventories remain empty. Add entries through the section editor to create these sheets; opportunity values and employee summaries are not substituted.` })
  const sheetNames: Record<string, string> = { Overview: "Settings", DepartmentMemberships: "Memberships", ResellRequirements: "Requirements", ServicesRequirements: "Requirements", TrainingAssignments: "Training" }
  const columnNames: Record<string, string> = { Key: "Setting", DepartmentId: "Department", PersonId: "Person", PrimaryDepartmentId: "PrimaryDepartment", ManagerId: "Manager", RevenueAllocationPct: "RevenueAllocation", RevenueTargetZAR: "RevenueTarget", MembershipId: "MembershipID", AssignmentId: "AssignmentID", CourseName: "Course", OpportunityId: "RecordID", CloseDate: "ExpectedClose", EngagementId: "EngagementID", NPSStatus: "NPS", CSATStatus: "CSAT", RequirementId: "RequirementID", RequiredValue: "Required", AttainedValue: "Attained" }
  const remapIssue = (issue: ValidationIssue): ValidationIssue => {
    const sheet = sheetNames[issue.worksheet] ?? issue.worksheet
    let originalRows = rows(sheet)
    if (issue.worksheet.endsWith("Requirements")) originalRows = originalRows.filter(r => r.Pathway === (issue.worksheet === "ResellRequirements" ? "Resell" : "Services"))
    if (issue.worksheet === "DepartmentMemberships") originalRows = originalRows.filter(r => !r.Status || r.Status === "Active")
    const record = issue.row ? originalRows[issue.row - 2] : undefined
    const field = issue.field === "Name" ? (sheet === "Opportunities" ? "Opportunity" : sheet === "Engagements" ? "Engagement" : "Department") : issue.field === "DepartmentId" && ["Opportunities", "Engagements"].includes(sheet) ? "OwningDepartment" : issue.field === "PersonId" && sheet === "People" ? "PersonID" : issue.field === "DepartmentId" && sheet === "Departments" ? "DepartmentID" : issue.field ? columnNames[issue.field] ?? issue.field : null
    return { ...issue, worksheet: sheet, row: record ? Number(record.__rowNum__) + 1 : issue.row, field }
  }
  return { workbook, issues, remapIssue }
}

