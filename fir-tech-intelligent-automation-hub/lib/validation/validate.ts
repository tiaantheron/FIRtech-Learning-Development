import type { ValidationIssue, WorkbookData } from "@/lib/models/types"
import { TRAINING_STATUSES, CERT_STATUSES, REQUIREMENT_STATUSES, ENGAGEMENT_CATEGORIES } from "@/lib/models/types"

// Cross-sheet business validation. Structural/column checks happen during parsing.
export function validateWorkbook(data: WorkbookData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const deptIds = new Set(data.departments.map((d) => d.departmentId))
  const personIds = new Set(data.people.map((p) => p.personId))
  const issue = (worksheet: string, record: object, index: number, field: string, message: string, severity: "error" | "warning" = "error") => issues.push({ severity, worksheet, row: (record as { __rowNum__?: number }).__rowNum__ ?? index + 2, field, message })
  for (const [sheet, rows] of [["Leads", data.leads], ["Opportunities", data.opportunities], ["Revenue", data.revenue], ["Engagements", data.engagements]] as const) {
    rows.forEach((record, i) => {
      if (!/^[A-Z]{3}$/.test(record.currency)) issue(sheet, record, i, "Currency", "Original currency must be a three-letter code, such as ZAR, USD or EUR.")
      const hasConversion = (record as typeof record & { __hasConversion?: boolean }).__hasConversion ?? (record.exchangeRate !== undefined || record.convertedAmount !== undefined || !!record.exchangeRateDate || !!record.exchangeRateSource)
      if (hasConversion) {
        if (!record.reportingCurrency || !/^[A-Z]{3}$/.test(record.reportingCurrency)) issue(sheet, record, i, "ReportingCurrency", "A conversion needs a three-letter reporting currency.")
        if (!record.exchangeRate || record.exchangeRate <= 0) issue(sheet, record, i, "ExchangeRate", "A conversion needs a positive exchange rate (reporting units per original unit).")
        if (!record.exchangeRateDate) issue(sheet, record, i, "ExchangeRateDate", "A conversion needs a rate date.")
        if (!record.exchangeRateSource?.trim()) issue(sheet, record, i, "ExchangeRateSource", "A conversion needs a rate source.")
        const amount = "amount" in record ? record.amount : "estimatedValue" in record ? record.estimatedValue : record.contractValue
        if (record.convertedAmount !== undefined && record.exchangeRate && Math.abs(record.convertedAmount - Math.round(amount * record.exchangeRate * 100) / 100) > 0.011) issue(sheet, record, i, "ConvertedAmount", "Converted amount must equal original amount × exchange rate, rounded to cents.")
        if (record.reportingCurrency === record.currency && record.exchangeRate !== 1) issue(sheet, record, i, "ExchangeRate", "Same-currency conversion must use a rate of 1.")
      } else if (record.currency !== "ZAR") issue(sheet, record, i, "ExchangeRate", "No documented ZAR conversion. This transaction is retained in its original currency and excluded from ZAR totals.", "warning")
      for (const [field, value] of Object.entries(record)) {
        if (field.endsWith("DepartmentId") || field === "departmentId") {
          if (value && !deptIds.has(String(value))) issue(sheet, record, i, field[0].toUpperCase() + field.slice(1), `Unknown department: ${value}`)
        }
        if (typeof value === "number" && value < 0) issue(sheet, record, i, field[0].toUpperCase() + field.slice(1), "Value must not be negative.")
      }
      if ("owner" in record && record.owner && !personIds.has(record.owner)) issue(sheet, record, i, "Owner", "Owner must reference a PersonId.")
    })
  }
  data.certifications.forEach((c, i) => {
    if (c.status && !CERT_STATUSES.includes(c.status)) issue("Certifications", c, i, "Status", `Unknown certification status: ${c.status}`)
  })
  data.reportingPeriods.forEach((p, i) => {
    if (!p.startDate || !p.endDate || p.startDate > p.endDate) issue("ReportingPeriods", p, i, "EndDate", "A period needs valid start/end dates in chronological order.")
  })
  for (const [sheet, requirements] of [["ResellRequirements", data.resellRequirements], ["ServicesRequirements", data.servicesRequirements]] as const) {
    requirements.forEach((r, i) => {
      if (r.status && !REQUIREMENT_STATUSES.includes(r.status)) issue(sheet, r, i, "Status", "Status must be Achieved, Outstanding or Maintain.")
      if (r.requiredValue < 0 || r.attainedValue < 0) issue(sheet, r, i, "AttainedValue", "Requirement values must be non-negative.")
      if (r.status === "Achieved" && r.attainedValue < r.requiredValue && r.unit.toLowerCase() !== "boolean") issue(sheet, r, i, "Status", "Supplied achieved status differs from numerical attainment; supplied values are preserved.", "warning")
    })
  }
  const overrideKeys = new Set<string>()
  data.overrides.forEach((o, i) => {
    const key = `${o.entityType}|${o.entityId}|${o.field}`
    if (overrideKeys.has(key)) issue("Overrides", o, i, "Field", "Conflicting duplicate override.")
    overrideKeys.add(key)
    if (!o.reason) issue("Overrides", o, i, "Reason", "An override requires an audit reason.")
    const rows = o.entityType === "Certification" ? data.certifications : o.entityType === "ResellRequirement" ? data.resellRequirements : o.entityType === "ServicesRequirement" ? data.servicesRequirements : null
    if (!rows || !rows.some(r => ("certificationId" in r ? r.certificationId : r.requirementId) === o.entityId)) issue("Overrides", o, i, "EntityId", "Unknown override entity or entity type.")
    const allowed = o.entityType === "Certification" ? ["status"] : ["status", "requiredValue", "attainedValue"]
    if (!allowed.includes(o.field)) issue("Overrides", o, i, "Field", "Unsupported override field.")
    if (o.field === "status" && !(o.entityType === "Certification" ? [...CERT_STATUSES] : [...REQUIREMENT_STATUSES]).includes(o.value as never)) issue("Overrides", o, i, "Value", "Invalid override status.")
    if (o.field !== "status" && (!o.value.trim() || !Number.isFinite(Number(o.value)) || Number(o.value) < 0)) issue("Overrides", o, i, "Value", "Override value must be a non-negative number.")
  })

  // People: referential integrity + duplicate detection by UiPath id / name
  const seenUiPath = new Map<string, string>()
  const seenName = new Map<string, string>()
  data.people.forEach((p, i) => {
    const row = (p as typeof p & { __rowNum__?: number }).__rowNum__ ?? i + 2
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
          severity: "error",
          worksheet: "People",
          row,
          field: "SecondaryDepartmentIds",
          message: `Person "${p.fullName}" references unknown secondary department "${d}".`,
        })
      }
    })
    if (p.managerId && !personIds.has(p.managerId)) {
      issues.push({
        severity: "error",
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
          severity: "error",
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
    const row = (m as typeof m & { __rowNum__?: number }).__rowNum__ ?? i + 2
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
    if (t.status === "Completed" && !t.completedDate) issue("TrainingAssignments", t, i, "CompletedDate", "Completed training requires a completion date.")
    const row = (t as typeof t & { __rowNum__?: number }).__rowNum__ ?? i + 2
    if (!personIds.has(t.personId)) {
      issues.push({
        severity: "error",
        worksheet: "TrainingAssignments",
        row,
        field: "PersonId",
        message: `Training assignment references unknown person "${t.personId}".`,
      })
    }
    if (t.status && !TRAINING_STATUSES.includes(t.status)) {
      issues.push({
        severity: "error",
        worksheet: "TrainingAssignments",
        row,
        field: "Status",
        message: `Unrecognised training status "${t.status}".`,
      })
    }
  })

  // Certifications person exists + expiry sanity
  data.certifications.forEach((c, i) => {
    const row = (c as typeof c & { __rowNum__?: number }).__rowNum__ ?? i + 2
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
        severity: "error",
        worksheet: "Certifications",
        row,
        field: "ExpiryDate",
        message: `Certification "${c.certName}" expires before it was issued.`,
      })
    }
  })

  // Opportunities probability range + currency
  data.opportunities.forEach((o, i) => {
    const row = (o as typeof o & { __rowNum__?: number }).__rowNum__ ?? i + 2
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
        severity: "error",
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
    const row = (r as typeof r & { __rowNum__?: number }).__rowNum__ ?? i + 2
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
        severity: "error",
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
  const activeDepartments = data.departments.filter(d => !["archived", "inactive"].includes((d.status ?? "Active").toLowerCase()))
  const allocTotal = activeDepartments.reduce((s, d) => s + (d.revenueAllocationPct || 0), 0)
  if (activeDepartments.length > 0 && Math.abs(allocTotal - 1) > 0.000001) {
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
    const row = (e as typeof e & { __rowNum__?: number }).__rowNum__ ?? i + 2
    if (e.type && !ENGAGEMENT_CATEGORIES.includes(e.type)) {
      issues.push({
        severity: "error",
        worksheet: "Engagements",
        row,
        field: "Type",
        message: `Unrecognised engagement category "${e.type}".`,
      })
    }
    if (e.qualificationStatus.toLowerCase() === "qualified") {
      const key = `${e.customer.toLowerCase().trim()}|${e.type}|${e.type === "Unique Professional Services Engagement" ? "" : e.name.toLowerCase().trim()}`
      if (qualifiedSeen.has(key)) {
        issues.push({
          severity: "error",
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
        severity: "error",
        worksheet: "Requirements",
        row: null,
        field: "AttainedValue",
        message: `Requirement "${r.requirement}" has a negative attained value.`,
      })
    }
  })

  return issues
}




