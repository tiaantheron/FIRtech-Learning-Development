import type { ValidationIssue, WorkbookData } from "@/lib/models/types"
import { TRAINING_STATUSES, ENGAGEMENT_CATEGORIES } from "@/lib/models/types"

// Cross-sheet business validation. Structural/column checks happen during parsing.
export function validateWorkbook(data: WorkbookData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const deptIds = new Set(data.departments.map((d) => d.departmentId))
  const personIds = new Set(data.people.map((p) => p.personId))

  // People: referential integrity + duplicate detection by UiPath id / name
  const seenUiPath = new Map<string, string>()
  const seenName = new Map<string, string>()
  data.people.forEach((p, i) => {
    const row = i + 2
    if (p.primaryDepartmentId && !deptIds.has(p.primaryDepartmentId)) {
      issues.push({
        severity: "error",
        worksheet: "People",
        row,
        field: "PrimaryDepartmentId",
        message: `Person "${p.fullName}" references unknown department "${p.primaryDepartmentId}".`,
      })
    }
    p.secondaryDepartmentIds.forEach((d) => {
      if (d && !deptIds.has(d)) {
        issues.push({
          severity: "warning",
          worksheet: "People",
          row,
          field: "SecondaryDepartmentIds",
          message: `Person "${p.fullName}" references unknown secondary department "${d}".`,
        })
      }
    })
    if (p.managerId && !personIds.has(p.managerId)) {
      issues.push({
        severity: "warning",
        worksheet: "People",
        row,
        field: "ManagerId",
        message: `Manager "${p.managerId}" for "${p.fullName}" is not a known person.`,
      })
    }
    if (p.uiPathId) {
      if (seenUiPath.has(p.uiPathId)) {
        issues.push({
          severity: "error",
          worksheet: "People",
          row,
          field: "UiPathId",
          message: `Duplicate UiPath identifier "${p.uiPathId}" (also on ${seenUiPath.get(p.uiPathId)}).`,
        })
      } else {
        seenUiPath.set(p.uiPathId, p.fullName)
      }
    }
    const nameKey = p.fullName.toLowerCase()
    if (nameKey) {
      if (seenName.has(nameKey)) {
        issues.push({
          severity: "warning",
          worksheet: "People",
          row,
          field: "FullName",
          message: `Possible duplicate employee record for "${p.fullName}".`,
        })
      } else {
        seenName.set(nameKey, p.personId)
      }
    }
  })

  // Memberships reference valid people + departments
  data.departmentMemberships.forEach((m, i) => {
    const row = i + 2
    if (!personIds.has(m.personId)) {
      issues.push({
        severity: "error",
        worksheet: "DepartmentMemberships",
        row,
        field: "PersonId",
        message: `Membership references unknown person "${m.personId}".`,
      })
    }
    if (!deptIds.has(m.departmentId)) {
      issues.push({
        severity: "error",
        worksheet: "DepartmentMemberships",
        row,
        field: "DepartmentId",
        message: `Membership references unknown department "${m.departmentId}".`,
      })
    }
  })

  // Training statuses valid + person exists
  data.trainingAssignments.forEach((t, i) => {
    const row = i + 2
    if (!personIds.has(t.personId)) {
      issues.push({
        severity: "error",
        worksheet: "TrainingAssignments",
        row,
        field: "PersonId",
        message: `Training assignment references unknown person "${t.personId}".`,
      })
    }
    if (!TRAINING_STATUSES.includes(t.status)) {
      issues.push({
        severity: "warning",
        worksheet: "TrainingAssignments",
        row,
        field: "Status",
        message: `Unrecognised training status "${t.status}".`,
      })
    }
  })

  // Certifications person exists + expiry sanity
  data.certifications.forEach((c, i) => {
    const row = i + 2
    if (!personIds.has(c.personId)) {
      issues.push({
        severity: "error",
        worksheet: "Certifications",
        row,
        field: "PersonId",
        message: `Certification references unknown person "${c.personId}".`,
      })
    }
    if (c.issueDate && c.expiryDate && c.expiryDate < c.issueDate) {
      issues.push({
        severity: "warning",
        worksheet: "Certifications",
        row,
        field: "ExpiryDate",
        message: `Certification "${c.certName}" expires before it was issued.`,
      })
    }
  })

  // Opportunities probability range + currency
  data.opportunities.forEach((o, i) => {
    const row = i + 2
    if (o.probability < 0 || o.probability > 1) {
      issues.push({
        severity: "error",
        worksheet: "Opportunities",
        row,
        field: "Probability",
        message: `Probability for "${o.name}" must be between 0 and 100%.`,
      })
    }
    if (!o.currency) {
      issues.push({
        severity: "warning",
        worksheet: "Opportunities",
        row,
        field: "Currency",
        message: `Missing currency for opportunity "${o.name}".`,
      })
    }
  })

  // Revenue: currency present + double-counting detection
  const revenueSeen = new Map<string, number>()
  data.revenue.forEach((r, i) => {
    const row = i + 2
    if (!r.currency) {
      issues.push({
        severity: "error",
        worksheet: "Revenue",
        row,
        field: "Currency",
        message: `Revenue record for "${r.customer}" is missing a currency value.`,
      })
    }
    const key = `${r.customer}|${r.amount}|${r.currency}|${r.recognizedDate ?? ""}`
    if (revenueSeen.has(key)) {
      issues.push({
        severity: "warning",
        worksheet: "Revenue",
        row,
        field: "Amount",
        message: `Potential double-counted revenue: "${r.customer}" ${r.currency} ${r.amount} appears more than once.`,
      })
    } else {
      revenueSeen.set(key, row)
    }
  })

  // Department revenue allocations should sum to ~100%
  const allocTotal = data.departments.reduce((s, d) => s + (d.revenueAllocationPct || 0), 0)
  if (data.departments.length > 0 && Math.abs(allocTotal - 1) > 0.01) {
    issues.push({
      severity: "warning",
      worksheet: "Departments",
      row: null,
      field: "RevenueAllocationPct",
      message: `Department revenue allocations sum to ${(allocTotal * 100).toFixed(1)}% (expected 100%).`,
    })
  }

  // Engagements: valid category + duplicate qualification detection
  const qualifiedSeen = new Set<string>()
  data.engagements.forEach((e, i) => {
    const row = i + 2
    if (!ENGAGEMENT_CATEGORIES.includes(e.type)) {
      issues.push({
        severity: "warning",
        worksheet: "Engagements",
        row,
        field: "Type",
        message: `Unrecognised engagement category "${e.type}".`,
      })
    }
    if (e.qualificationStatus.toLowerCase() === "qualified") {
      const key = `${e.customer.toLowerCase()}|${e.type}`
      if (qualifiedSeen.has(key)) {
        issues.push({
          severity: "warning",
          worksheet: "Engagements",
          row,
          field: "QualificationStatus",
          message: `Duplicate qualifying engagement for "${e.customer}" of type "${e.type}".`,
        })
      } else {
        qualifiedSeen.add(key)
      }
    }
  })

  // Requirements: attained should not exceed required by huge margins (info only)
  ;[...data.resellRequirements, ...data.servicesRequirements].forEach((r) => {
    if (r.requiredValue > 0 && r.attainedValue < 0) {
      issues.push({
        severity: "warning",
        worksheet: "Requirements",
        row: null,
        field: "AttainedValue",
        message: `Requirement "${r.requirement}" has a negative attained value.`,
      })
    }
  })

  return issues
}
