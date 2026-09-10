import type { WorkbookData, Requirement } from "@/lib/models/types"
import type { Filters } from "./metrics"

export function personInDepartment(data: WorkbookData, id: string, departmentId: string) {
  if (departmentId === "all") return true
  const person = data.people.find(p => p.personId === id)
  return person?.primaryDepartmentId === departmentId || person?.secondaryDepartmentIds.includes(departmentId) || data.departmentMemberships.some(m => m.personId === id && m.departmentId === departmentId)
}

// A single selection is shared by cards, charts, tables and exported reports.
// Undated records remain visible so outstanding work cannot disappear from a period.
export function filterWorkbook(data: WorkbookData, filters: Filters): WorkbookData {
  const period = data.reportingPeriods.find(p => p.periodId === filters.periodId)
  const within = (date?: string | null) => !period || !date || ((!period.startDate || date >= period.startDate) && (!period.endDate || date <= period.endDate))
  const department = (id?: string) => filters.departmentId === "all" || id === filters.departmentId
  const employee = (id: string) => (!filters.employeeId || filters.employeeId === "all" || filters.employeeId === id) && personInDepartment(data, id, filters.departmentId)
  const requirement = (r: Requirement) => {
    const dept = data.departments.find(d => d.departmentId === filters.departmentId)
    const ownerId = data.people.find(p => p.personId === r.owner || p.fullName === r.owner)?.personId ?? r.owner
    const ownerMatches = department(r.departmentId ?? r.owner) || r.owner === dept?.name || personInDepartment(data, ownerId, filters.departmentId)
    return ownerMatches && within(r.dueDate)
  }
  return { ...data,
    departments: data.departments.filter(d => department(d.departmentId)),
    trainingAssignments: data.trainingAssignments.filter(t => employee(t.personId) && within(t.dueDate ?? t.assignedDate)),
    certifications: data.certifications.filter(c => employee(c.personId) && (!period || !c.issueDate || !period.endDate || c.issueDate <= period.endDate)),
    leads: data.leads.filter(l => department(l.departmentId) && within(l.createdDate) && (!filters.employeeId || filters.employeeId === "all" || filters.employeeId === l.owner)),
    opportunities: data.opportunities.filter(o => department(o.departmentId) && within(o.closeDate) && (!filters.employeeId || filters.employeeId === "all" || filters.employeeId === o.owner)),
    revenue: data.revenue.filter(r => department(r.ownerDepartmentId) && within(r.recognizedDate)),
    engagements: data.engagements.filter(e => department(e.departmentId) && within(e.date)),
    resellRequirements: data.resellRequirements.filter(requirement),
    servicesRequirements: data.servicesRequirements.filter(requirement),
  }
}

export function applyOverrides(data: WorkbookData): WorkbookData {
  const requirement = (r: Requirement, entityType: string) => {
    const result = { ...r }
    for (const o of data.overrides.filter(o => o.entityType === entityType && o.entityId === r.requirementId)) {
      if (o.field === "attainedValue" || o.field === "requiredValue") result[o.field] = Number(o.value)
      if (o.field === "status") result.status = o.value as Requirement["status"]
    }
    return result
  }
  return { ...data,
    people: data.people.map(p => ({ ...p, secondaryDepartmentIds: [...new Set([...p.secondaryDepartmentIds, ...data.departmentMemberships.filter(m => m.personId === p.personId && m.departmentId !== p.primaryDepartmentId).map(m => m.departmentId)])] })),
    resellRequirements: data.resellRequirements.map(r => requirement(r, "ResellRequirement")), servicesRequirements: data.servicesRequirements.map(r => requirement(r, "ServicesRequirement")) }
}
