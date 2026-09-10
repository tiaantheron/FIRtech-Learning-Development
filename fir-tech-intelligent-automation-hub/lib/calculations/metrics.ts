import type {
  Certification,
  Engagement,
  Opportunity,
  Requirement,
  WorkbookData,
} from "@/lib/models/types"
import { daysUntil } from "@/lib/utils/format"

export interface Filters {
  periodId: string | "all"
  departmentId: string | "all"
}

export const EMPTY_FILTERS: Filters = { periodId: "all", departmentId: "all" }

function inPeriod(iso: string | null, data: WorkbookData, periodId: string): boolean {
  if (periodId === "all") return true
  const period = data.reportingPeriods.find((p) => p.periodId === periodId)
  if (!period || !period.startDate || !period.endDate) return true
  if (!iso) return false
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
  const passing = c.status === "Passed" || c.status === "Active"
  if (!passing) return false
  const isExpired = c.status === "Expired" || (c.expiryDate ? (daysUntil(c.expiryDate) ?? 1) < 0 : false)
  if (!isExpired) return true
  // Expired certs only count when explicitly overridden.
  return hasOverride(data, "Certification", c.certificationId, "status")
}

export interface CertMetrics {
  completed: number
  expiring: number
  expired: number
  inProgress: number
  total: number
}

export function certMetrics(data: WorkbookData, filters = EMPTY_FILTERS): CertMetrics {
  const certs = data.certifications.filter((c) => inPeriod(c.issueDate, data, filters.periodId))
  let completed = 0
  let expiring = 0
  let expired = 0
  let inProgress = 0
  for (const c of certs) {
    const valid = isCertValid(data, c)
    const days = daysUntil(c.expiryDate)
    if (c.status === "Expired" || (days !== null && days < 0 && !valid)) expired++
    else if (valid && days !== null && days <= 60) expiring++
    if (valid) completed++
    if (c.status === "In Progress" || c.status === "Scheduled" || c.status === "Not Started") inProgress++
  }
  return { completed, expiring, expired, inProgress, total: certs.length }
}

// ---- Training ----
const OUTSTANDING_TRAINING = new Set([
  "Not Allocated",
  "Allocated",
  "Not Started",
  "In Progress",
  "Exam Scheduled",
  "Awaiting Result",
  "Failed",
])

export interface TrainingMetrics {
  outstanding: number
  completed: number
  overdue: number
  total: number
  completionRate: number
}

export function trainingMetrics(data: WorkbookData, filters = EMPTY_FILTERS): TrainingMetrics {
  const items = data.trainingAssignments.filter((t) => inPeriod(t.assignedDate, data, filters.periodId))
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
  if (stage.includes("won")) return o.estimatedValue
  if (stage.includes("lost")) return 0
  return o.estimatedValue * o.probability
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

export function pipelineMetrics(data: WorkbookData, filters = EMPTY_FILTERS): PipelineMetrics {
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
    const stage = o.stage.toLowerCase()
    if (stage.includes("won")) {
      wonRevenue += o.estimatedValue
      won++
      closed++
    } else if (stage.includes("lost")) {
      lostRevenue += o.estimatedValue
      closed++
    } else {
      totalPipeline += o.estimatedValue
      weightedPipeline += weightedValue(o)
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
  const attainedZAR = records.filter((r) => r.currency === "ZAR").reduce((s, r) => s + r.amount, 0)
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
  const items = data.engagements.filter((e) => inPeriod(e.date, data, filters.periodId))
  const uniqueCustomers = new Set<string>()
  let customer = 0
  let ps = 0
  let qualifying = 0
  let nonQualifying = 0
  for (const e of items) {
    if (e.type === "Resell Customer Engagement") customer++
    if (e.type === "Professional Services Engagement" || e.type === "Unique Professional Services Engagement") ps++
    if (e.type === "Unique Professional Services Engagement") uniqueCustomers.add(e.customer.toLowerCase())
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
  const requirementsAtRisk = [...data.resellRequirements, ...data.servicesRequirements].filter((r) => {
    if (r.status !== "Outstanding") return false
    const days = daysUntil(r.dueDate)
    return days !== null && days < 45
  }).length

  const overdueTraining = trainingMetrics(data, filters).overdue
  const overdueCertifications = data.certifications.filter((c) => {
    const days = daysUntil(c.expiryDate)
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
    const revenueAttainedZAR = data.revenue
      .filter((r) => r.ownerDepartmentId === d.departmentId && r.currency === "ZAR")
      .reduce((s, r) => s + r.amount, 0)
    const opps = data.opportunities.filter((o) => o.departmentId === d.departmentId)
    const pipelineValue = opps
      .filter((o) => !o.stage.toLowerCase().includes("won") && !o.stage.toLowerCase().includes("lost"))
      .reduce((s, o) => s + o.estimatedValue, 0)
    const weightedPipeline = opps.reduce((s, o) => s + weightedValue(o), 0)
    const leadCount = data.leads.filter((l) => l.departmentId === d.departmentId).length

    const deptPeople = new Set(
      data.people
        .filter((p) => p.primaryDepartmentId === d.departmentId || p.secondaryDepartmentIds.includes(d.departmentId))
        .map((p) => p.personId),
    )
    const validCertifications = data.certifications.filter(
      (c) => deptPeople.has(c.personId) && isCertValid(data, c),
    ).length
    const qualifyingEngagements = data.engagements.filter(
      (e) => e.qualificationStatus.toLowerCase() === "qualified",
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
