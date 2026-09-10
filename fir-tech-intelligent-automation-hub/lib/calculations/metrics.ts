import type {
  Certification,
  Engagement,
  Opportunity,
  Requirement,
  WorkbookData,
} from "@/lib/models/types"
import { daysUntil } from "@/lib/utils/format"
import { filterWorkbook, personInDepartment } from "./filter"
import { reportingAmount } from "./currency"

export interface Filters {
  periodId: string | "all"
  departmentId: string | "all"
  employeeId?: string
}

export const EMPTY_FILTERS: Filters = { periodId: "all", departmentId: "all" }

function inPeriod(iso: string | null, data: WorkbookData, periodId: string): boolean {
  if (periodId === "all") return true
  const period = data.reportingPeriods.find((p) => p.periodId === periodId)
  if (!period || !period.startDate || !period.endDate) return true
  if (!iso) return true
  return iso >= period.startDate && iso <= period.endDate
}

// ---- Overrides ----
export function hasOverride(data: WorkbookData, entityType: string, entityId: string, field: string): boolean {
  return data.overrides.some(
    (o) =>
      o.entityType.toLowerCase() === entityType.toLowerCase() &&
      o.entityId === entityId &&
      o.field.toLowerCase() === field.toLowerCase(),
  )
}

// ---- Overview / Pathway metrics ----
export function getSetting(data: WorkbookData, key: string, fallback = ""): string {
  return data.overview.find((o) => o.key === key)?.value ?? fallback
}

export interface PathwaySummary {
  currentLevel: string
  targetLevel: string
  achieved: number
  outstanding: number
  maintain: number
  total: number
  progress: number
  requirements: Requirement[]
}

export function summarisePathway(requirements: Requirement[], currentLevel: string, targetLevel: string): PathwaySummary {
  const achieved = requirements.filter((r) => r.status === "Achieved").length
  const maintain = requirements.filter((r) => r.status === "Maintain").length
  const outstanding = requirements.filter((r) => r.status === "Outstanding").length
  const total = requirements.length
  const progress = total > 0 ? (achieved + maintain) / total : 0
  return { currentLevel, targetLevel, achieved, outstanding, maintain, total, progress, requirements }
}

export function remainingValue(r: Requirement): number {
  return Math.max(r.requiredValue - r.attainedValue, 0)
}

// ---- Certifications ----
export function isCertValid(data: WorkbookData, c: Certification): boolean {
  const override = data.overrides.find(o => o.entityType === "Certification" && o.entityId === c.certificationId && o.field === "status")
  if (override) return override.value === "Active" || override.value === "Passed"
  const passing = c.status === "Passed" || c.status === "Active"
  if (!passing) return false
  const isExpired = c.expiryDate ? (daysUntil(c.expiryDate) ?? 1) < 0 : false
  if (!isExpired) return true
  // Expired certs only count when explicitly overridden.
  return false
}

export interface CertMetrics {
  outstanding: number
  completed: number
  expiring: number
  expired: number
  inProgress: number
  total: number
}

export function certMetrics(data: WorkbookData, filters = EMPTY_FILTERS): CertMetrics {
  const certs = filterWorkbook(data, filters).certifications
  let completed = 0
  let expiring = 0
  let expired = 0
  let inProgress = 0
  for (const c of certs) {
    const valid = isCertValid(data, c)
    const days = daysUntil(c.expiryDate)
    if (!valid && (c.status === "Expired" || (days !== null && days < 0))) expired++
    else if (valid && days !== null && days >= 0 && days <= 60) expiring++
    if (valid) completed++
    if (!valid && c.status !== "Waived" && c.status !== "Not Applicable" && c.status !== "Expired" && !(days !== null && days < 0)) inProgress++
  }
  return { completed, expiring, expired, inProgress, outstanding: expired + inProgress, total: certs.length }
}

// ---- Training ----
const OUTSTANDING_TRAINING = new Set([
  "Not Allocated",
  "Allocated",
  "Not Started",
  "In Progress",
  "Exam Scheduled",
  "Awaiting Result",
  "Failed", "Expired",
])

export interface TrainingMetrics {
  outstanding: number
  completed: number
  overdue: number
  total: number
  completionRate: number
}

export function trainingMetrics(data: WorkbookData, filters = EMPTY_FILTERS): TrainingMetrics {
  const items = filterWorkbook(data, filters).trainingAssignments
  let outstanding = 0
  let completed = 0
  let overdue = 0
  for (const t of items) {
    if (t.status === "Completed" || t.status === "Passed") completed++
    else if (OUTSTANDING_TRAINING.has(t.status)) {
      outstanding++
      const days = daysUntil(t.dueDate)
      if (days !== null && days < 0) overdue++
    }
  }
  const total = items.length
  return { outstanding, completed, overdue, total, completionRate: total > 0 ? completed / total : 0 }
}

// ---- Pipeline ----
export function weightedValue(o: Opportunity): number {
  const stage = o.stage.toLowerCase()
  if (stage === "closed won") return o.estimatedValue
  if (stage === "closed lost") return 0
  return o.estimatedValue * o.probability
}

export function effectiveProbability(o: Opportunity): number {
  return o.stage.toLowerCase() === "closed won" ? 1 : o.stage.toLowerCase() === "closed lost" ? 0 : o.probability
}

export interface PipelineMetrics {
  leads: number
  openOpportunities: number
  totalPipeline: number
  weightedPipeline: number
  wonRevenue: number
  lostRevenue: number
  conversionRate: number
}

export function pipelineMetrics(data: WorkbookData, filters = EMPTY_FILTERS, currency: "USD" | "ZAR" = "ZAR"): PipelineMetrics {
  data = filterWorkbook(data, filters)
  const leads = data.leads.filter(
    (l) =>
      inPeriod(l.createdDate, data, filters.periodId) &&
      (filters.departmentId === "all" || l.departmentId === filters.departmentId),
  )
  const opps = data.opportunities.filter(
    (o) =>
      inPeriod(o.closeDate, data, filters.periodId) &&
      (filters.departmentId === "all" || o.departmentId === filters.departmentId),
  )
  let totalPipeline = 0
  let weightedPipeline = 0
  let wonRevenue = 0
  let lostRevenue = 0
  let won = 0
  let closed = 0
  let open = 0
  for (const o of opps) {
    const value = currency === "ZAR" ? reportingAmount(o.estimatedValue, o) : o.currency === currency ? o.estimatedValue : null
    const stage = o.stage.toLowerCase()
    if (stage === "closed won") {
      wonRevenue += value ?? 0
      won++
      closed++
    } else if (stage === "closed lost") {
      lostRevenue += value ?? 0
      closed++
    } else {
      if (value !== null) { totalPipeline += value; weightedPipeline += value * effectiveProbability(o) }
      open++
    }
  }
  return {
    leads: leads.length,
    openOpportunities: open,
    totalPipeline,
    weightedPipeline,
    wonRevenue,
    lostRevenue,
    conversionRate: closed > 0 ? won / closed : 0,
  }
}

// ---- Revenue (kept per-currency, never double counted) ----
export interface RevenueMetrics {
  attainedZAR: number
  attainedUSD: number
  targetZAR: number
  remainingZAR: number
  attainmentPct: number
}

export function revenueMetrics(data: WorkbookData, filters = EMPTY_FILTERS): RevenueMetrics {
  const records = data.revenue.filter(
    (r) =>
      inPeriod(r.recognizedDate, data, filters.periodId) &&
      (filters.departmentId === "all" || r.ownerDepartmentId === filters.departmentId),
  )
  // Only the owning department is counted to prevent double counting.
  const attainedZAR = records.reduce((s, r) => s + (reportingAmount(r.amount, r) ?? 0), 0)
  const attainedUSD = records.filter((r) => r.currency === "USD").reduce((s, r) => s + r.amount, 0)

  let targetZAR = 0
  if (filters.departmentId === "all") {
    const overviewTarget = Number(getSetting(data, "CompanyRevenueTargetZAR", "0"))
    targetZAR = overviewTarget || data.departments.reduce((s, d) => s + d.revenueTargetZAR, 0)
  } else {
    targetZAR = data.departments.find((d) => d.departmentId === filters.departmentId)?.revenueTargetZAR ?? 0
  }
  const remainingZAR = Math.max(targetZAR - attainedZAR, 0)
  return {
    attainedZAR,
    attainedUSD,
    targetZAR,
    remainingZAR,
    attainmentPct: targetZAR > 0 ? attainedZAR / targetZAR : 0,
  }
}

// ---- Engagements (deduped) ----
export interface EngagementMetrics {
  total: number
  customer: number
  professionalServices: number
  uniqueProfessionalServices: number
  qualifying: number
  nonQualifying: number
}

export function engagementMetrics(data: WorkbookData, filters = EMPTY_FILTERS): EngagementMetrics {
  const items = filterWorkbook(data, filters).engagements
  const uniqueCustomers = new Set<string>()
  let customer = 0
  let ps = 0
  let qualifying = 0
  let nonQualifying = 0
  for (const e of items) {
    if (e.type === "Resell Customer Engagement") customer++
    if (e.type === "Professional Services Engagement" || e.type === "Unique Professional Services Engagement") ps++
    if (e.type === "Unique Professional Services Engagement" && e.qualificationStatus.toLowerCase() === "qualified") uniqueCustomers.add(e.customer.toLowerCase().trim())
    if (e.type === "Non-Qualifying Engagement") nonQualifying++
    else if (e.qualificationStatus.toLowerCase() === "qualified") qualifying++
  }
  return {
    total: items.length,
    customer,
    professionalServices: ps,
    uniqueProfessionalServices: uniqueCustomers.size,
    qualifying,
    nonQualifying,
  }
}

// ---- Risk ----
export interface RiskMetrics {
  requirementsAtRisk: number
  overdueTraining: number
  overdueCertifications: number
}

export function riskMetrics(data: WorkbookData, filters = EMPTY_FILTERS): RiskMetrics {
  data = filterWorkbook(data, filters)
  const requirementsAtRisk = [...data.resellRequirements, ...data.servicesRequirements].filter((r) => {
    if (r.status !== "Outstanding") return false
    const days = daysUntil(r.dueDate)
    return days !== null && days <= 45
  }).length

  const overdueTraining = trainingMetrics(data, filters).overdue
  const overdueCertifications = data.certifications.filter((c) => {
    const days = daysUntil(c.dueDate ?? c.expiryDate)
    return days !== null && days < 0 && !isCertValid(data, c)
  }).length

  return { requirementsAtRisk, overdueTraining, overdueCertifications }
}

// ---- Department rollups ----
export interface DepartmentPerformance {
  departmentId: string
  name: string
  head: string
  revenueTargetZAR: number
  revenueAttainedZAR: number
  revenuePct: number
  pipelineValue: number
  weightedPipeline: number
  leadCount: number
  opportunityCount: number
  qualifyingEngagements: number
  validCertifications: number
}

export function departmentPerformance(data: WorkbookData): DepartmentPerformance[] {
  return data.departments.map((d) => {
    const revenueAttainedZAR = revenueMetrics(data, { departmentId: d.departmentId, periodId: "all" }).attainedZAR
    const opps = data.opportunities.filter((o) => o.departmentId === d.departmentId)
    const pipelineValue = opps
      .filter((o) => o.stage.toLowerCase() !== "closed won" && o.stage.toLowerCase() !== "closed lost")
      .reduce((s, o) => s + (reportingAmount(o.estimatedValue, o) ?? 0), 0)
    const weightedPipeline = pipelineMetrics(data, { periodId: "all", departmentId: d.departmentId }).weightedPipeline
    const leadCount = data.leads.filter((l) => l.departmentId === d.departmentId).length

    const deptPeople = new Set(
      data.people
        .filter((p) => personInDepartment(data, p.personId, d.departmentId))
        .map((p) => p.personId),
    )
    const validCertifications = data.certifications.filter(
      (c) => deptPeople.has(c.personId) && isCertValid(data, c),
    ).length
    const qualifyingEngagements = data.engagements.filter(
      (e) => e.departmentId === d.departmentId && e.type !== "Non-Qualifying Engagement" && e.qualificationStatus.toLowerCase() === "qualified",
    ).length

    return {
      departmentId: d.departmentId,
      name: d.name,
      head: d.head,
      revenueTargetZAR: d.revenueTargetZAR,
      revenueAttainedZAR,
      revenuePct: d.revenueTargetZAR > 0 ? revenueAttainedZAR / d.revenueTargetZAR : 0,
      pipelineValue,
      weightedPipeline,
      leadCount,
      opportunityCount: opps.length,
      qualifyingEngagements,
      validCertifications,
    }
  })
}

export function departmentName(data: WorkbookData, id: string): string {
  return data.departments.find((d) => d.departmentId === id)?.name ?? id ?? "—"
}

export function personName(data: WorkbookData, id: string): string {
  return data.people.find((p) => p.personId === id)?.fullName ?? id ?? "—"
}

